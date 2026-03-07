"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { createMeetingSocket, TranscriptEntry } from "@/lib/api";

interface UseMeetingSocketReturn {
    transcript: TranscriptEntry[];
    isConnected: boolean;
    latestAiResponse: string | null;
    statusMessage: string;
    isMicActive: boolean;
    sendAudio: (base64Audio: string) => void;
    sendTextInput: (speaker: string, text: string) => void;
    endMeeting: () => void;
}

export function useMeetingSocket(meetingId: string | null): UseMeetingSocketReturn {
    const wsRef = useRef<WebSocket | null>(null);
    const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
    const [isConnected, setIsConnected] = useState(false);
    const [isMicActive, setIsMicActive] = useState(false);
    const [latestAiResponse, setLatestAiResponse] = useState<string | null>(null);
    const [statusMessage, setStatusMessage] = useState("Disconnected");

    // Mic resources refs
    const audioContextRef = useRef<AudioContext | null>(null);
    const mediaStreamRef = useRef<MediaStream | null>(null);
    const processorRef = useRef<ScriptProcessorNode | null>(null);

    // ── Start Microphone Capture ──────────────────────────
    const startMicCapture = useCallback(async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    sampleRate: 16000,
                    channelCount: 1,
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true,
                },
            });
            mediaStreamRef.current = stream;

            const audioContext = new AudioContext({ sampleRate: 16000 });
            audioContextRef.current = audioContext;

            const source = audioContext.createMediaStreamSource(stream);

            // ScriptProcessor to capture audio chunks (4096 samples = ~256ms at 16kHz)
            const processor = audioContext.createScriptProcessor(4096, 1, 1);
            processorRef.current = processor;

            processor.onaudioprocess = (e) => {
                if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;

                const inputData = e.inputBuffer.getChannelData(0);

                // Convert float32 [-1, 1] to int16 PCM
                const pcm16 = new Int16Array(inputData.length);
                for (let i = 0; i < inputData.length; i++) {
                    const s = Math.max(-1, Math.min(1, inputData[i]));
                    pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
                }

                // Base64 encode and send
                const bytes = new Uint8Array(pcm16.buffer);
                let binary = "";
                for (let i = 0; i < bytes.length; i++) {
                    binary += String.fromCharCode(bytes[i]);
                }
                const base64Audio = btoa(binary);

                wsRef.current.send(JSON.stringify({ type: "audio", data: base64Audio }));
            };

            source.connect(processor);
            processor.connect(audioContext.destination);

            setIsMicActive(true);
            console.log("🎙️ Microphone capture started");
        } catch (err) {
            console.error("Microphone access denied or failed:", err);
            setStatusMessage("Mic access denied — use simulator instead");
        }
    }, []);

    // ── Stop Microphone Capture ───────────────────────────
    const stopMicCapture = useCallback(() => {
        if (processorRef.current) {
            processorRef.current.disconnect();
            processorRef.current = null;
        }
        if (audioContextRef.current) {
            audioContextRef.current.close();
            audioContextRef.current = null;
        }
        if (mediaStreamRef.current) {
            mediaStreamRef.current.getTracks().forEach((t) => t.stop());
            mediaStreamRef.current = null;
        }
        setIsMicActive(false);
        console.log("🎙️ Microphone capture stopped");
    }, []);

    // ── WebSocket Connection ──────────────────────────────
    useEffect(() => {
        if (!meetingId) return;

        setTranscript([]);
        setLatestAiResponse(null);

        const ws = createMeetingSocket(meetingId);
        wsRef.current = ws;

        ws.onopen = () => {
            setIsConnected(true);
            setStatusMessage("Connected — Listening...");
            // Start mic capture when WebSocket connects
            startMicCapture();
        };

        ws.onclose = () => {
            setIsConnected(false);
            setStatusMessage("Disconnected");
            stopMicCapture();
        };

        ws.onerror = () => {
            setStatusMessage("Connection error");
            stopMicCapture();
        };

        ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                switch (data.type) {
                    case "transcript":
                        setTranscript((prev) => [
                            ...prev,
                            {
                                speaker: data.speaker,
                                text: data.text,
                                timestamp: data.timestamp,
                                is_ai_response: false,
                            },
                        ]);
                        break;
                    case "response":
                        setLatestAiResponse(data.text);
                        setTranscript((prev) => [
                            ...prev,
                            {
                                speaker: "Meeting Ghost AI",
                                text: data.text,
                                timestamp: Date.now() / 1000,
                                is_ai_response: true,
                            },
                        ]);
                        if (data.audio) {
                            try {
                                const audio = new Audio(`data:audio/mpeg;base64,${data.audio}`);
                                audio.play().catch(() => { });
                            } catch { /* audio playback optional */ }
                        }
                        break;
                    case "status":
                        setStatusMessage(data.message);
                        break;
                    case "error":
                        setStatusMessage(`Error: ${data.message}`);
                        break;
                }
            } catch (err) {
                console.error("WebSocket message parse error:", err);
            }
        };

        return () => {
            stopMicCapture();
            ws.close();
        };
    }, [meetingId, startMicCapture, stopMicCapture]);

    const sendAudio = useCallback((base64Audio: string) => {
        wsRef.current?.send(JSON.stringify({ type: "audio", data: base64Audio }));
    }, []);

    const sendTextInput = useCallback((speaker: string, text: string) => {
        wsRef.current?.send(JSON.stringify({ type: "text_input", speaker, text }));
    }, []);

    const endMeeting = useCallback(() => {
        stopMicCapture();
        wsRef.current?.send(JSON.stringify({ type: "end_meeting" }));
    }, [stopMicCapture]);

    return { transcript, isConnected, latestAiResponse, statusMessage, isMicActive, sendAudio, sendTextInput, endMeeting };
}
