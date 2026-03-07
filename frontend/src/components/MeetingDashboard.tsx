"use client";

import { useState, useEffect } from "react";
import { useMeetingSocket } from "@/hooks/useWebSocket";
import TranscriptPanel from "./TranscriptPanel";
import SummaryCard from "./SummaryCard";
import AudioVisualizer from "./AudioVisualizer";
import { api, MeetingSummary } from "@/lib/api";
import { motion, AnimatePresence } from "framer-motion";

export default function MeetingDashboard() {
    const [meetingId, setMeetingId] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<"live" | "summary">("live");
    const [summary, setSummary] = useState<MeetingSummary | null>(null);
    const [summaryLoading, setSummaryLoading] = useState(false);
    const [simSpeaker, setSimSpeaker] = useState("Manager");
    const [simText, setSimText] = useState("");
    const [userName, setUserName] = useState("User");

    const { transcript, isConnected, latestAiResponse, statusMessage, isMicActive, sendTextInput, endMeeting } =
        useMeetingSocket(meetingId);

    // ── Fetch user name from backend ─────────────────────
    useEffect(() => {
        api.stats()
            .then((data) => {
                const name = (data as Record<string, unknown>).user_name;
                if (typeof name === "string" && name) setUserName(name);
            })
            .catch(() => { /* backend not running yet */ });
    }, []);

    // ── Start Meeting ─────────────────────────────────
    const handleStartMeeting = async () => {
        const id = `meeting-${Date.now().toString(36)}`;
        setMeetingId(id);
        setSummary(null);
        setActiveTab("live");
    };

    // ── End Meeting ───────────────────────────────────
    const handleEndMeeting = async () => {
        endMeeting();
        setSummaryLoading(true);
        // Wait a moment, then fetch summary
        setTimeout(async () => {
            try {
                if (meetingId) {
                    const s = await api.getSummary(meetingId);
                    setSummary(s);
                }
            } catch { /* summary may not be ready yet */ }
            setSummaryLoading(false);
            setActiveTab("summary");
        }, 2000);
    };

    // ── Send simulated message ────────────────────────
    const handleSendMessage = () => {
        if (!simText.trim()) return;
        sendTextInput(simSpeaker, simText.trim());
        setSimText("");
    };

    // Dynamic quick messages using the actual user name
    const quickMessages = [
        `${userName}, when will the API be ready?`,
        `Let's discuss the timeline.`,
        `${userName}, can you handle deployment?`,
        `What do you think about the budget, ${userName}?`,
    ];

    return (
        <div className="min-h-screen bg-[#0a0a0f]">
            {/* Navbar */}
            <nav className="glass-strong sticky top-0 z-50 border-b border-white/5">
                <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center text-white font-bold text-sm">
                            👻
                        </div>
                        <div>
                            <h1 className="text-base font-bold text-white tracking-tight">Meeting Ghost AI</h1>
                            <p className="text-[10px] text-gray-500 -mt-0.5">Your AI Meeting Assistant</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        {isMicActive && (
                            <span className="text-[10px] px-2 py-1 rounded-full bg-red-500/20 text-red-400 font-medium animate-pulse">
                                🎙️ Mic Active
                            </span>
                        )}
                        <AudioVisualizer isActive={isConnected} />
                        <span className={`text-xs px-3 py-1.5 rounded-full font-medium ${isConnected ? "bg-green-500/15 text-green-400" : "bg-gray-500/15 text-gray-400"
                            }`}>
                            {statusMessage}
                        </span>
                    </div>
                </div>
            </nav>

            <main className="max-w-7xl mx-auto px-6 py-8">
                {/* Hero / Controls */}
                <div className="mb-8">
                    {!meetingId ? (
                        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                            className="text-center py-20">
                            <div className="text-6xl mb-6">👻</div>
                            <h2 className="text-4xl font-bold text-white mb-3">
                                Your AI <span className="gradient-text">Meeting Twin</span>
                            </h2>
                            <p className="text-gray-400 max-w-lg mx-auto mb-8 leading-relaxed">
                                Start a meeting session and let your AI ghost listen, understand context,
                                respond when you&apos;re addressed, and generate comprehensive summaries.
                            </p>
                            <button onClick={handleStartMeeting}
                                className="px-8 py-4 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white rounded-2xl font-semibold text-lg transition-all duration-300 hover:shadow-lg hover:shadow-purple-500/20 hover:scale-[1.02] active:scale-[0.98]">
                                🎙️ Start Meeting Session
                            </button>
                            <div className="mt-12 grid grid-cols-3 gap-6 max-w-2xl mx-auto">
                                {[
                                    { icon: "🎧", title: "Listens", desc: "Real-time transcription" },
                                    { icon: "🧠", title: "Understands", desc: "Context-aware AI" },
                                    { icon: "📋", title: "Summarizes", desc: "Auto-generated reports" },
                                ].map((f) => (
                                    <div key={f.title} className="glass rounded-xl p-4 text-center">
                                        <div className="text-2xl mb-2">{f.icon}</div>
                                        <h3 className="text-sm font-semibold text-white">{f.title}</h3>
                                        <p className="text-xs text-gray-500 mt-1">{f.desc}</p>
                                    </div>
                                ))}
                            </div>
                        </motion.div>
                    ) : (
                        <div className="flex items-center justify-between">
                            <div>
                                <h2 className="text-2xl font-bold text-white">Meeting Session</h2>
                                <p className="text-sm text-gray-500 mt-1">ID: {meetingId}</p>
                            </div>
                            <div className="flex gap-3">
                                <button onClick={() => setActiveTab(activeTab === "live" ? "summary" : "live")}
                                    className="px-4 py-2 text-sm glass rounded-xl hover:bg-white/10 transition text-gray-300">
                                    {activeTab === "live" ? "📋 View Summary" : "🎙️ Live View"}
                                </button>
                                <button onClick={handleEndMeeting}
                                    className="px-4 py-2 text-sm bg-rose-500/20 text-rose-400 hover:bg-rose-500/30 rounded-xl transition font-medium">
                                    ⏹ End Meeting
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {meetingId && (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* Main Content - Transcript or Summary */}
                        <div className="lg:col-span-2 h-[600px]">
                            <AnimatePresence mode="wait">
                                {activeTab === "live" ? (
                                    <motion.div key="live" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="h-full">
                                        <TranscriptPanel transcript={transcript} isLive={isConnected} />
                                    </motion.div>
                                ) : (
                                    <motion.div key="summary" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                                        <SummaryCard summary={summary} loading={summaryLoading} />
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>

                        {/* Sidebar */}
                        <div className="space-y-6">
                            {/* AI Response */}
                            {latestAiResponse && (
                                <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                                    className="glass rounded-2xl p-5 glow-blue">
                                    <h3 className="text-sm font-semibold text-cyan-400 mb-2 flex items-center gap-2">
                                        🤖 Last AI Response
                                    </h3>
                                    <p className="text-sm text-gray-300 leading-relaxed">{latestAiResponse}</p>
                                </motion.div>
                            )}

                            {/* Meeting Stats */}
                            <div className="glass rounded-2xl p-5">
                                <h3 className="text-sm font-semibold text-white mb-3">📊 Session Stats</h3>
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="bg-white/[0.03] rounded-xl p-3 text-center">
                                        <div className="text-2xl font-bold text-purple-400">{transcript.length}</div>
                                        <div className="text-[10px] text-gray-500 mt-1">Messages</div>
                                    </div>
                                    <div className="bg-white/[0.03] rounded-xl p-3 text-center">
                                        <div className="text-2xl font-bold text-cyan-400">
                                            {transcript.filter((t) => t.is_ai_response).length}
                                        </div>
                                        <div className="text-[10px] text-gray-500 mt-1">AI Responses</div>
                                    </div>
                                    <div className="bg-white/[0.03] rounded-xl p-3 text-center">
                                        <div className="text-2xl font-bold text-green-400">
                                            {new Set(transcript.map((t) => t.speaker)).size}
                                        </div>
                                        <div className="text-[10px] text-gray-500 mt-1">Speakers</div>
                                    </div>
                                    <div className="bg-white/[0.03] rounded-xl p-3 text-center">
                                        <div className="text-2xl font-bold text-amber-400">
                                            {isMicActive ? "🎙️" : isConnected ? "🟢" : "🔴"}
                                        </div>
                                        <div className="text-[10px] text-gray-500 mt-1">{isMicActive ? "Mic On" : "Status"}</div>
                                    </div>
                                </div>
                            </div>

                            {/* Simulation Input */}
                            <div className="glass rounded-2xl p-5">
                                <h3 className="text-sm font-semibold text-white mb-3">🧪 Meeting Simulator</h3>
                                <p className="text-[11px] text-gray-500 mb-3">Simulate meeting messages for testing</p>
                                <select value={simSpeaker} onChange={(e) => setSimSpeaker(e.target.value)}
                                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-gray-300 mb-2 focus:outline-none focus:border-purple-500/50">
                                    {["Manager", "Designer", "Developer", "QA Lead", "Product Owner"].map((s) => (
                                        <option key={s} value={s} className="bg-gray-900">{s}</option>
                                    ))}
                                </select>
                                <div className="flex gap-2">
                                    <input type="text" value={simText} onChange={(e) => setSimText(e.target.value)}
                                        onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
                                        placeholder="Type a message..."
                                        className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-gray-300 placeholder:text-gray-600 focus:outline-none focus:border-purple-500/50" />
                                    <button onClick={handleSendMessage}
                                        disabled={!isConnected || !simText.trim()}
                                        className="px-4 py-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-30 disabled:cursor-not-allowed text-white text-sm rounded-xl transition">
                                        Send
                                    </button>
                                </div>

                                {/* Quick messages with dynamic user name */}
                                <div className="mt-3 flex flex-wrap gap-1.5">
                                    {quickMessages.map((msg) => (
                                        <button key={msg} onClick={() => { setSimText(msg); }}
                                            className="text-[10px] bg-white/5 hover:bg-white/10 text-gray-400 px-2 py-1 rounded-lg transition truncate max-w-full">
                                            {msg}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
}
