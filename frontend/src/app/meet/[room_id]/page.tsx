"use client";

import { useEffect, useState, Suspense } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import {
    LiveKitRoom,
} from '@livekit/components-react';
import '@livekit/components-styles';
import { Loader2 } from 'lucide-react';
import AiControlPanel from '@/components/AiControlPanel';
import CustomVideoConference from '@/components/CustomVideoConference';

function MeetingRoomContent() {
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
            <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 text-gray-900 p-4">
                <div className="bg-white p-8 rounded-2xl shadow-floating border border-gray-100 max-w-md w-full text-center">
                    <h1 className="text-2xl font-bold text-gray-900 mb-2">Connection Error</h1>
                    <p className="text-gray-500 mb-8">{error}</p>
                    <button
                        onClick={() => router.push('/meet')}
                        className="px-6 py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition"
                    >
                        Return to Lobby
                    </button>
                </div>
            </div>
        );
    }

    if (token === '') {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen bg-[#0f172a] text-white">
                <Loader2 className="w-10 h-10 animate-spin text-blue-500 mb-6" />
                <p className="text-lg font-medium text-gray-300">Generating secure access...</p>
            </div>
        );
    }

    return (
        <div className="relative w-full h-screen bg-[#0f172a] overflow-hidden">
            <LiveKitRoom
                video={true}
                audio={true}
                token={token}
                serverUrl={process.env.NEXT_PUBLIC_LIVEKIT_URL || "ws://localhost:7880"}
                data-lk-theme="default"
                style={{ height: '100%', width: '100%', position: 'absolute', top: 0, left: 0 }}
                onDisconnected={() => router.push(`/meet/end?room=${roomName}&name=${encodeURIComponent(userName)}`)}
            >
                <CustomVideoConference SettingsComponent={() => <AiControlPanel roomName={roomName} userName={userName} />} />
            </LiveKitRoom>
        </div>
    );
}

export default function MeetingRoom() {
    return (
        <Suspense fallback={
            <div className="flex flex-col items-center justify-center min-h-screen bg-[#0f172a] text-white">
                <Loader2 className="w-10 h-10 animate-spin text-blue-500 mb-6" />
                <p className="text-lg font-medium text-gray-300">Loading meeting room...</p>
            </div>
        }>
            <MeetingRoomContent />
        </Suspense>
    );
}
