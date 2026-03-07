"use client";

import { MeetingSummary } from "@/lib/api";
import { motion } from "framer-motion";

interface Props {
    summary: MeetingSummary | null;
    loading?: boolean;
}

export default function SummaryCard({ summary, loading }: Props) {
    if (loading) {
        return (
            <div className="glass rounded-2xl p-6 animate-pulse">
                <div className="h-5 bg-white/10 rounded w-1/3 mb-4" />
                <div className="space-y-2">
                    <div className="h-3 bg-white/5 rounded w-full" />
                    <div className="h-3 bg-white/5 rounded w-4/5" />
                    <div className="h-3 bg-white/5 rounded w-3/5" />
                </div>
            </div>
        );
    }

    if (!summary) {
        return (
            <div className="glass rounded-2xl p-6 text-center text-gray-500">
                <p>No summary available yet.</p>
                <p className="text-xs mt-1">Summary generates automatically when the meeting ends.</p>
            </div>
        );
    }

    return (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass rounded-2xl p-6 space-y-5">
            {/* Summary */}
            <div>
                <h3 className="text-lg font-semibold text-white mb-2 flex items-center gap-2">
                    <span className="text-xl">📋</span> Summary
                </h3>
                <p className="text-sm text-gray-300 leading-relaxed">{summary.summary || "N/A"}</p>
            </div>

            {/* Key Points */}
            {summary.key_points?.length > 0 && (
                <div>
                    <h4 className="text-sm font-semibold text-amber-400 mb-2 flex items-center gap-2">
                        <span>💡</span> Key Points
                    </h4>
                    <ul className="space-y-1.5">
                        {summary.key_points.map((pt, i) => (
                            <li key={i} className="text-sm text-gray-300 flex items-start gap-2">
                                <span className="text-amber-500 mt-1">•</span>{pt}
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            {/* Decisions */}
            {summary.decisions?.length > 0 && (
                <div>
                    <h4 className="text-sm font-semibold text-green-400 mb-2 flex items-center gap-2">
                        <span>✅</span> Decisions
                    </h4>
                    <ul className="space-y-1.5">
                        {summary.decisions.map((d, i) => (
                            <li key={i} className="text-sm text-gray-300 flex items-start gap-2">
                                <span className="text-green-500 mt-1">•</span>{d}
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            {/* Action Items */}
            {summary.action_items?.length > 0 && (
                <div>
                    <h4 className="text-sm font-semibold text-blue-400 mb-2 flex items-center gap-2">
                        <span>🎯</span> Action Items
                    </h4>
                    <div className="space-y-2">
                        {summary.action_items.map((item, i) => (
                            <div key={i} className="bg-white/[0.03] rounded-lg p-3 text-sm">
                                <p className="text-gray-200 font-medium">{item.task}</p>
                                <div className="flex gap-3 mt-1 text-xs text-gray-500">
                                    {item.assignee && <span>👤 {item.assignee}</span>}
                                    {item.deadline && <span>📅 {item.deadline}</span>}
                                    {item.priority && (
                                        <span className={`px-1.5 py-0.5 rounded ${item.priority === "high" ? "bg-rose-500/20 text-rose-300" :
                                                item.priority === "medium" ? "bg-amber-500/20 text-amber-300" :
                                                    "bg-gray-500/20 text-gray-400"
                                            }`}>{item.priority}</span>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Topics & Meta */}
            <div className="flex flex-wrap gap-2 pt-2 border-t border-white/5">
                {summary.topics_discussed?.map((t, i) => (
                    <span key={i} className="text-[10px] bg-purple-500/20 text-purple-300 px-2 py-1 rounded-full">{t}</span>
                ))}
                {summary.duration_minutes && (
                    <span className="text-[10px] bg-white/5 text-gray-400 px-2 py-1 rounded-full ml-auto">
                        ⏱ {summary.duration_minutes} min
                    </span>
                )}
            </div>
        </motion.div>
    );
}
