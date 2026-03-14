import { useState, useEffect, useRef } from "react";
import { Loader2 } from "lucide-react";
import { useLocalParticipant } from "@livekit/components-react";
import { LocalAudioTrack, Track } from "livekit-client";

interface AiControlPanelProps {
    roomName: string;
    userName: string;
}

export default function AiControlPanel({ roomName, userName }: AiControlPanelProps) {
    const [aiActive, setAiActive] = useState(false);
    const [summary, setSummary] = useState('');
    const [isSummaryLoading, setIsSummaryLoading] = useState(false);

    // LiveKit hooks to manage local tracks
    const { localParticipant } = useLocalParticipant();

    // Refs for WebAudio
    const audioContextRef = useRef<AudioContext | null>(null);
    const destinationNodeRef = useRef<MediaStreamAudioDestinationNode | null>(null);
    const aiTrackRef = useRef<LocalAudioTrack | null>(null);
    const wsRef = useRef<WebSocket | null>(null);
    const startTimeRef = useRef<number>(0);

    // Initialization check
    useEffect(() => {
        async function checkAgentStatus() {
            try {
                const API_URL = "";
                const response = await fetch(`${API_URL}/api/meetings/agents`);
                if (response.ok) {
                    const data = await response.json();
                    const myAgent = data.agents.find((a: any) => a.room_name === roomName && a.user_name === userName);
                    if (myAgent) {
                        // If we are re-entering and the agent is active, we should trigger start sequence
                        // However, auto-connecting audio context might require user interaction first.
                        setAiActive(true);
                    }
                }
            } catch (e) {
                console.error("Failed to check agent status", e);
            }
        }
        checkAgentStatus();

        return () => {
            stopAiStream();
        };
    }, [roomName, userName]);

    const initWebAudio = () => {
        if (!audioContextRef.current) {
            audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({
                sampleRate: 48000 // Match what LiveKit expects
            });
            destinationNodeRef.current = audioContextRef.current.createMediaStreamDestination();
        }
        if (audioContextRef.current.state === "suspended") {
            audioContextRef.current.resume();
        }
        startTimeRef.current = audioContextRef.current.currentTime;
    };

    const startAiStream = async () => {
        try {
            initWebAudio();

            // 1. Mute the user's actual hardware microphone in LiveKit
            if (localParticipant.isMicrophoneEnabled) {
                await localParticipant.setMicrophoneEnabled(false);
            }

            // 2. Wrap the WebAudio destination track in a LiveKit LocalAudioTrack
            const audioTrack = destinationNodeRef.current!.stream.getAudioTracks()[0];
            aiTrackRef.current = new LocalAudioTrack(audioTrack);

            // 3. Publish the AI track *as if* it were the user's microphone
            await localParticipant.publishTrack(aiTrackRef.current, {
                source: Track.Source.Microphone,
                name: "ghost-voice"
            });

            // 4. Connect to the WebSocket to receive AI Audio Bytes
            const API_URL = "";
            const wsUrl = API_URL.replace("http://", "ws://").replace("https://", "wss://");
            const ws = new WebSocket(`${wsUrl}/api/meetings/${roomName}/agent/stream/${encodeURIComponent(userName)}`);
            ws.binaryType = "arraybuffer";
            wsRef.current = ws;

            ws.onmessage = async (event) => {
                if (event.data instanceof ArrayBuffer && audioContextRef.current && destinationNodeRef.current) {
                    // event.data is 16kHz 16-bit mono PCM bytes from Polly.
                    // Let's decode or simply play it. We actually need to convert RAW PCM to an AudioBuffer, 
                    // OR we can tell the backend to send WAV/Opus, but right now it sends raw float32 or int16?
                    // According to our Python `agent._speak`, it sends exactly what Polly returns, wait.
                    // Oh, Polly returns mp3 or pcm. Our python code says `pcm_bytes = await self.voice.synthesize_pcm(text)` which is raw pcm 16kHz 16-bit little-endian mono.

                    const pcm16Data = new Int16Array(event.data);
                    const numSamples = pcm16Data.length;

                    // The backend sends 16kHz. 
                    const audioBuffer = audioContextRef.current.createBuffer(1, numSamples, 16000);
                    const channelData = audioBuffer.getChannelData(0);

                    for (let i = 0; i < numSamples; i++) {
                        // Convert int16 to float32
                        channelData[i] = pcm16Data[i] / 32768.0;
                    }

                    const sourceNode = audioContextRef.current.createBufferSource();
                    sourceNode.buffer = audioBuffer;
                    sourceNode.connect(destinationNodeRef.current);

                    // Schedule gaplessly
                    const scheduleTime = Math.max(startTimeRef.current, audioContextRef.current.currentTime);
                    sourceNode.start(scheduleTime);
                    startTimeRef.current = scheduleTime + audioBuffer.duration;
                }
            };

            ws.onerror = (err) => console.error("Agent Stream WebSocket Error", err);

        } catch (err) {
            console.error("Failed to start AI WebRTC Stream", err);
        }
    };

    const stopAiStream = async () => {
        // Close WebSocket
        if (wsRef.current) {
            wsRef.current.close();
            wsRef.current = null;
        }

        // Unpublish AI track
        if (aiTrackRef.current && localParticipant) {
            try {
                // Actually need to find the publication and unpublish
                const publications = Array.from(localParticipant.audioTrackPublications.values());
                for (const p of publications) {
                    if (p.source === Track.Source.Microphone && p.track === aiTrackRef.current) {
                        await localParticipant.unpublishTrack(p.track as LocalAudioTrack);
                    }
                }
            } catch (e) { console.error("Error unpublishing", e); }

            aiTrackRef.current.stop();
            aiTrackRef.current = null;
        }

        // Close Audio Context
        if (audioContextRef.current) {
            audioContextRef.current.close().catch(() => { });
            audioContextRef.current = null;
            destinationNodeRef.current = null;
        }

        // Note: we let the user manually turn their real microphone back on by using the LiveKit UI buttons.
    };

    const toggleAi = async () => {
        const API_URL = "";
        try {
            if (aiActive) {
                // Backend call
                await fetch(`${API_URL}/api/meetings/${roomName}/agent?participant_name=${encodeURIComponent(userName)}`, { method: 'DELETE' });

                // Cleanup frontend streams
                await stopAiStream();
                setAiActive(false);
            } else {
                // Backend call
                await fetch(`${API_URL}/api/meetings/${roomName}/agent/start`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ participant_name: userName }),
                });

                // Start frontend streams
                await startAiStream();
                setAiActive(true);
            }
        } catch (err) {
            console.error("Failed to toggle AI", err);
        }
    };

    const getSummary = async () => {
        const API_URL = "";
        setIsSummaryLoading(true);
        try {
            const res = await fetch(`${API_URL}/api/meetings/${roomName}/summary`);
            if (res.ok) {
                const data = await res.json();
                setSummary(data.summary);
            }
        } catch (err) {
            console.error("Failed to get summary", err);
            setSummary("Failed to fetch meeting summary.");
        } finally {
            setIsSummaryLoading(false);
        }
    };

    return (
        <div className="flex flex-col h-full w-full text-white">
            {/* Header — matches Chat "Messages" header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
                <h3 className="text-base font-semibold flex items-center gap-2">
                    <span className={`w-2.5 h-2.5 rounded-full ${aiActive ? 'bg-red-500 animate-pulse' : 'bg-green-500'}`}></span>
                    AI Ghost Controls
                </h3>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-5 space-y-5">
                <p className="text-sm text-gray-400 leading-relaxed">
                    {aiActive
                        ? "AI is active and connected! It has taken over your microphone. You can leave your camera on."
                        : "Have the AI proxy seamlessly take over your identity to listen and speak securely during this meeting."}
                </p>

                <button
                    onClick={toggleAi}
                    className={`w-full py-3 px-4 rounded-xl font-semibold transition-all flex items-center justify-center gap-2 ${aiActive
                        ? 'bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30'
                        : 'bg-gradient-to-r from-cyan-600 to-teal-600 text-white border border-teal-600 hover:from-cyan-700 hover:to-teal-700'
                        }`}
                >
                    {aiActive ? 'Disconnect AI Proxy' : 'Enable AI Takeover'}
                </button>

                <div className="relative py-2">
                    <div className="absolute inset-0 flex items-center">
                        <span className="w-full border-t border-white/10" />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                        <span className="bg-[rgba(15,23,42,0.85)] px-3 text-gray-500 font-bold tracking-wider">Summary</span>
                    </div>
                </div>

                <button
                    onClick={getSummary}
                    disabled={isSummaryLoading}
                    className="w-full py-3 px-4 rounded-xl font-semibold bg-white/[0.06] border border-white/10 text-gray-300 hover:bg-white/10 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                >
                    {isSummaryLoading && <Loader2 className="w-4 h-4 animate-spin text-gray-400" />}
                    Get Live Discussion Summary
                </button>

                {summary && (
                    <div className="mt-2 p-4 bg-teal-500/10 rounded-xl border border-teal-500/20 text-sm max-h-60 overflow-y-auto">
                        <h4 className="font-semibold text-teal-400 mb-2 flex items-center gap-1.5">
                            <span>📝</span> Latest Notes
                        </h4>
                        <p className="whitespace-pre-wrap text-gray-300 leading-relaxed">{summary}</p>
                    </div>
                )}
            </div>
        </div>
    );
}
