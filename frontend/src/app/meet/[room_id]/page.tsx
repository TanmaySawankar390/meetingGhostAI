"use client";

import { useEffect, useState } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import {
    LiveKitRoom,
    VideoConference,
    RoomAudioRenderer,
} from '@livekit/components-react';
import '@livekit/components-styles';
import { Loader2 } from 'lucide-react';
import AiControlPanel from '@/components/AiControlPanel';

export default function MeetingRoom() {
    const params = useParams();
    const searchParams = useSearchParams();
    const router = useRouter();

    const roomName = params.room_id as string;
    const userName = searchParams.get('name') || 'Guest';

    const [token, setToken] = useState<string>('');
    const [error, setError] = useState<string>('');

    useEffect(() => {
        async function getToken() {
            try {
                const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
                const response = await fetch(`${API_URL}/api/meetings/join`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ room_name: roomName, participant_name: userName }),
                });

                if (!response.ok) throw new Error("Failed to get meeting token");

                const data = await response.json();
                setToken(data.token);
            } catch (err) {
                setError(err instanceof Error ? err.message : "Error connecting to meeting");
            }
        }
        getToken();
    }, [roomName, userName]);

    if (error) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen bg-neutral-950 text-white p-4">
                <h1 className="text-2xl font-bold text-red-500 mb-4">Connection Error</h1>
                <p className="text-neutral-400 mb-6">{error}</p>
                <button
                    onClick={() => router.push('/meet')}
                    className="px-4 py-2 bg-white text-black rounded-md font-medium"
                >
                    Return to Lobby
                </button>
            </div>
        );
    }

    if (token === '') {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen bg-neutral-950 text-white">
                <Loader2 className="w-8 h-8 animate-spin text-neutral-400 mb-4" />
                <p>Generating secure access token...</p>
            </div>
        );
    }

    return (
        <LiveKitRoom
            video={true}
            audio={true}
            token={token}
            serverUrl={process.env.NEXT_PUBLIC_LIVEKIT_URL || "ws://localhost:7880"}
            data-lk-theme="default"
            style={{ height: '100vh', backgroundColor: '#0a0a0a' }}
            onDisconnected={() => router.push('/meet')}
        >
            <VideoConference />
            <RoomAudioRenderer />

            <AiControlPanel roomName={roomName} userName={userName} />
        </LiveKitRoom>
    );
}
