"use client";

import { TranscriptEntry } from "@/lib/api";
import { useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface Props {
    transcript: TranscriptEntry[];
    isLive?: boolean;
}

const SPEAKER_COLORS: Record<string, string> = {
    Manager: "#f59e0b",
    Designer: "#ec4899",
    Developer: "#3b82f6",
    "QA Lead": "#10b981",
    "Product Owner": "#8b5cf6",
    "Meeting Ghost AI": "#06b6d4",
    Unknown: "#6b7280",
};

function getSpeakerColor(speaker: string): string {
    return SPEAKER_COLORS[speaker] || `hsl(${(speaker.charCodeAt(0) * 47) % 360}, 70%, 60%)`;
}

function formatTimestamp(ts: number): string {
    const mins = Math.floor(ts / 60);
    const secs = Math.floor(ts % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
}

export default function TranscriptPanel({ transcript, isLive = false }: Props) {
    const bottomRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (isLive) bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [transcript.length, isLive]);

    return (
        <div className="glass rounded-2xl p-6 h-full flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                    <svg className="w-5 h-5 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    Live Transcript
                </h3>
                {isLive && (
                    <span className="relative flex items-center gap-2 text-xs text-green-400 font-medium">
                        <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                        </span>
                        LIVE
                    </span>
                )}
            </div>

            {/* Transcript entries */}
            <div className="flex-1 overflow-y-auto space-y-3 pr-2">
                {transcript.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-gray-500">
                        <svg className="w-12 h-12 mb-3 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                        </svg>
                        <p className="text-sm">Waiting for conversation...</p>
                    </div>
                ) : (
                    <AnimatePresence initial={false}>
                        {transcript.map((entry, i) => {
                            const color = getSpeakerColor(entry.speaker);
                            const isAI = entry.is_ai_response;
                            return (
                                <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                                    transition={{ duration: 0.3 }}
                                    className={`p-3 rounded-xl ${isAI ? "bg-cyan-500/10 border border-cyan-500/20" : "bg-white/[0.03]"}`}>
                                    <div className="flex items-center gap-2 mb-1">
                                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
                                        <span className="text-xs font-semibold" style={{ color }}>{entry.speaker}</span>
                                        <span className="text-[10px] text-gray-500 ml-auto">{formatTimestamp(entry.timestamp)}</span>
                                        {isAI && (
                                            <span className="text-[10px] bg-cyan-500/20 text-cyan-300 px-1.5 py-0.5 rounded font-medium">AI</span>
                                        )}
                                    </div>
                                    <p className="text-sm text-gray-300 leading-relaxed pl-4">{entry.text}</p>
                                </motion.div>
                            );
                        })}
                    </AnimatePresence>
                )}
                <div ref={bottomRef} />
            </div>
        </div>
    );
}
