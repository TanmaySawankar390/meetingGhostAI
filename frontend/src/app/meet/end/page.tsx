"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { CheckCircle, RefreshCcw, FileText, Download, Loader2, Calendar } from "lucide-react";
import { motion } from "framer-motion";
import { api, MeetingSummary } from "@/lib/api";

function MeetingEndScreenContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  
  const roomName = searchParams.get("room") || "unknown";
  const userName = searchParams.get("name") || "Guest";
  
  const [summary, setSummary] = useState<MeetingSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchSummary() {
      try {
        if (roomName && roomName !== "unknown") {
          // Add a small delay to allow backend processing time
          await new Promise(resolve => setTimeout(resolve, 2000));
          const data = await api.getSummary(roomName);
          setSummary(data);
        }
      } catch (err) {
        console.error("Failed to fetch summary:", err);
      } finally {
        setLoading(false);
      }
    }
    
    fetchSummary();
  }, [roomName]);

  const handleRejoin = () => {
    router.push(`/meet/${roomName}?name=${encodeURIComponent(userName)}`);
  };

  const handleGoHome = () => {
    router.push("/");
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4 sm:p-8 font-sans">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-2xl bg-white rounded-3xl shadow-floating border border-gray-100 p-8 md:p-12 overflow-hidden relative"
      >
        <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-cyan-500 to-teal-500" />
        
        <div className="flex flex-col items-center text-center mb-10">
          <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-6">
            <CheckCircle className="w-8 h-8" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2 tracking-tight">You left the meeting</h1>
          <p className="text-gray-500">Thank you for using bolchal.ai. Your session has ended securely.</p>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-12">
          <button
            onClick={handleRejoin}
            className="w-full sm:w-auto px-6 py-3 bg-white border border-gray-200 text-gray-700 font-semibold rounded-xl hover:bg-gray-50 hover:text-teal-600 transition-colors flex items-center justify-center gap-2"
          >
            <RefreshCcw className="w-4 h-4" />
            Rejoin
          </button>
          <button
            onClick={handleGoHome}
            className="w-full sm:w-auto px-6 py-3 bg-gradient-to-r from-cyan-600 to-teal-600 text-white font-semibold rounded-xl hover:from-cyan-700 hover:to-teal-700 transition-colors flex items-center justify-center gap-2 shadow-sm"
          >
            Return to home
          </button>
        </div>

        <div className="bg-gray-50 rounded-2xl p-6 border border-gray-100">
          <div className="flex items-center justify-between mb-4 pb-4 border-b border-gray-200">
            <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <FileText className="w-5 h-5 text-teal-600" />
              Meeting Summary
            </h2>
            <div className="flex gap-2">
              <button 
                className="p-2 text-gray-400 hover:text-teal-600 hover:bg-teal-50 rounded-lg transition-colors"
                title="Download Recording"
              >
                <Download className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="min-h-[150px]">
            {loading ? (
              <div className="flex flex-col items-center justify-center h-full text-gray-400 py-8">
                <Loader2 className="w-6 h-6 animate-spin mb-3 text-teal-600" />
                <p className="text-sm">Generating AI summary...</p>
              </div>
            ) : summary ? (
              <div className="space-y-4">
                <p className="text-sm text-gray-600 leading-relaxed font-medium">
                  {summary.executive_summary || "No executive summary available for this meeting."}
                </p>
                
                {summary.action_items && summary.action_items.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-gray-200">
                    <h3 className="text-sm font-bold text-gray-900 mb-2 uppercase tracking-wider text-xs">Action Items</h3>
                    <ul className="space-y-2">
                      {summary.action_items.map((item, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-gray-600">
                          <CheckCircle className="w-4 h-4 text-green-500 shrink-0 mt-0.5" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-gray-400 py-8">
                <Calendar className="w-8 h-8 mb-3 opacity-20" />
                <p className="text-sm">No summary generated or meeting was too short.</p>
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
}

export default function MeetingEndScreen() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
        <Loader2 className="w-8 h-8 animate-spin text-teal-600 mb-4" />
        <p className="text-gray-500">Loading screen...</p>
      </div>
    }>
      <MeetingEndScreenContent />
    </Suspense>
  );
}
