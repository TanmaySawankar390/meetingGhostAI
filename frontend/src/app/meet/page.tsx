"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Video, Users, Loader2 } from 'lucide-react';

export default function MeetLobby() {
    const router = useRouter();
    const [userName, setUserName] = useState('');
    const [roomName, setRoomName] = useState('');
    const [isCreating, setIsCreating] = useState(false);
    const [isJoining, setIsJoining] = useState(false);
    const [error, setError] = useState('');

    const handleCreateRoom = async () => {
        if (!userName) {
            setError("Please enter your name first");
            return;
        }

        setIsCreating(true);
        setError('');

        try {
            const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
            const response = await fetch(`${API_URL}/api/meetings/create`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    title: `${userName}'s Meeting`,
                    description: "Instant meeting created from lobby"
                }),
            });

            if (!response.ok) throw new Error("Failed to create meeting");

            const data = await response.json();

            // Navigate to the newly created room, passing the name so we can join
            router.push(`/meet/${data.room_name}?name=${encodeURIComponent(userName)}`);
        } catch (err) {
            setError(err instanceof Error ? err.message : "An unknown error occurred");
            setIsCreating(false);
        }
    };

    const handleJoinRoom = () => {
        if (!userName) {
            setError("Please enter your name first");
            return;
        }
        if (!roomName) {
            setError("Please enter a room name or meeting ID");
            return;
        }

        setIsJoining(true);
        router.push(`/meet/${roomName}?name=${encodeURIComponent(userName)}`);
    };

    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-neutral-950 p-4">
            <div className="text-center mb-8">
                <h1 className="text-4xl font-black text-white tracking-tight mb-2 flex items-center justify-center gap-3">
                    <Video className="w-8 h-8 text-neutral-400" />
                    Native Meeting
                </h1>
                <p className="text-neutral-400">Join a meeting or create a new one instantly</p>
            </div>

            <div className="w-full max-w-md bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden shadow-2xl">
                <div className="p-6 border-b border-neutral-800">
                    <h2 className="text-xl font-bold text-white">Get Started</h2>
                    <p className="text-sm text-neutral-400 mt-1">Enter your name to join or create a video room.</p>
                </div>
                <div className="p-6 space-y-6">
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-neutral-300">Your Name</label>
                        <input
                            type="text"
                            placeholder="e.g. John Doe"
                            className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 text-white rounded-md focus:outline-none focus:ring-2 focus:ring-white/20 transition-all"
                            value={userName}
                            onChange={(e) => setUserName(e.target.value)}
                        />
                    </div>

                    <div className="relative py-4">
                        <div className="absolute inset-0 flex items-center">
                            <span className="w-full border-t border-neutral-800" />
                        </div>
                        <div className="relative flex justify-center text-xs uppercase">
                            <span className="bg-neutral-900 px-2 text-neutral-500 font-semibold tracking-wider">Pick an option</span>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <button
                            className="w-full flex items-center justify-center px-4 py-3 bg-white text-black font-semibold rounded-md hover:bg-neutral-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            onClick={handleCreateRoom}
                            disabled={isCreating || isJoining}
                        >
                            {isCreating ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : <Video className="w-5 h-5 mr-2" />}
                            Create New Meeting
                        </button>

                        <div className="flex gap-2">
                            <input
                                type="text"
                                placeholder="Meeting ID (e.g. meeting-1234)"
                                className="flex-1 px-3 py-2 bg-neutral-800 border border-neutral-700 text-white rounded-md focus:outline-none focus:ring-2 focus:ring-white/20 transition-all min-w-0"
                                value={roomName}
                                onChange={(e) => setRoomName(e.target.value)}
                            />
                            <button
                                className="px-6 py-2 bg-transparent border border-neutral-700 font-medium text-neutral-300 rounded-md hover:bg-neutral-800 hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center shrink-0"
                                onClick={handleJoinRoom}
                                disabled={isCreating || isJoining}
                            >
                                {isJoining ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Join'}
                            </button>
                        </div>
                    </div>

                    {error && (
                        <p className="text-sm text-red-500 text-center font-medium">{error}</p>
                    )}
                </div>
            </div>

            <p className="text-xs text-neutral-600 mt-8 max-w-sm text-center">
                Powered by LiveKit. The AI Meeting Ghost will automatically join rooms created here.
            </p>
        </div>
    );
}
