"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Video, Mic, MicOff, VideoOff, Loader2, Settings } from "lucide-react";
import { motion } from "framer-motion";

export default function MeetLobby() {
  const router = useRouter();
  const [userName, setUserName] = useState("");
  const [roomName, setRoomName] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [error, setError] = useState("");

  const [micOn, setMicOn] = useState(true);
  const [cameraOn, setCameraOn] = useState(true);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);

  // Initialize camera preview
  useEffect(() => {
    let activeStream: MediaStream | null = null;
    if (cameraOn) {
      navigator.mediaDevices
        .getUserMedia({ video: true, audio: false })
        .then((s) => {
          activeStream = s;
          setStream(s);
          if (videoRef.current) {
            videoRef.current.srcObject = s;
          }
        })
        .catch((err) => {
          console.warn("Camera access denied or unavailable", err);
          setCameraOn(false);
        });
    } else {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
        setStream(null);
      }
    }

    return () => {
      if (activeStream) {
        activeStream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [cameraOn]);

  const handleCreateRoom = async () => {
    if (!userName.trim()) {
      setError("Please enter your name first");
      return;
    }
    setIsCreating(true);
    setError("");

    try {
      const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      const response = await fetch(`${API_URL}/api/meetings/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: `${userName}'s Meeting`,
          description: "Instant meeting created from lobby",
        }),
      });

      if (!response.ok) throw new Error("Failed to create meeting");
      const data = await response.json();
      router.push(`/meet/${data.room_name}?name=${encodeURIComponent(userName)}&mic=${micOn}&cam=${cameraOn}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unknown error occurred");
      setIsCreating(false);
    }
  };

  const handleJoinRoom = () => {
    if (!userName.trim()) {
      setError("Please enter your name first");
      return;
    }
    if (!roomName.trim()) {
      setError("Please enter a room name or meeting ID");
      return;
    }
    setIsJoining(true);
    router.push(`/meet/${roomName}?name=${encodeURIComponent(userName)}&mic=${micOn}&cam=${cameraOn}`);
  };

  return (
    <div className="relative flex flex-col items-center justify-center min-h-screen bg-gray-50 text-gray-900 p-4 sm:p-8 font-sans">
      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="relative z-10 w-full max-w-4xl bg-white rounded-3xl shadow-floating border border-gray-100 overflow-hidden flex flex-col md:flex-row"
      >
        {/* Left Side: Camera Preview */}
        <div className="md:w-3/5 p-6 md:p-8 bg-gray-50 border-r border-gray-100 flex flex-col">
          <h2 className="text-xl font-bold text-gray-800 mb-6 flex items-center gap-2">
            <Video className="w-5 h-5 text-teal-600" />
            Check your audio and video
          </h2>
          
          <div className="relative flex-1 bg-gray-900 rounded-2xl overflow-hidden shadow-inner min-h-[240px] md:min-h-[320px] flex items-center justify-center group">
            {cameraOn ? (
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover mirror"
              />
            ) : (
              <div className="flex flex-col items-center justify-center text-gray-500">
                <div className="w-20 h-20 rounded-full bg-gray-800 flex items-center justify-center mb-4">
                  <VideoOff className="w-8 h-8 text-gray-400" />
                </div>
                <p>Camera is off</p>
              </div>
            )}
            
            {/* Overlay Controls */}
            <div className="absolute bottom-6 left-0 right-0 flex items-center justify-center gap-4 transition-opacity duration-300">
              <button
                onClick={() => setMicOn(!micOn)}
                className={`w-12 h-12 rounded-full flex items-center justify-center shadow-lg transition-all ${
                  micOn ? "bg-white/10 hover:bg-white/20 text-white backdrop-blur-sm border border-white/20" : "bg-red-500 hover:bg-red-600 text-white"
                }`}
                title={micOn ? "Turn off microphone" : "Turn on microphone"}
              >
                {micOn ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
              </button>
              <button
                onClick={() => setCameraOn(!cameraOn)}
                className={`w-12 h-12 rounded-full flex items-center justify-center shadow-lg transition-all ${
                  cameraOn ? "bg-white/10 hover:bg-white/20 text-white backdrop-blur-sm border border-white/20" : "bg-red-500 hover:bg-red-600 text-white"
                }`}
                title={cameraOn ? "Turn off camera" : "Turn on camera"}
              >
                {cameraOn ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
              </button>
              <button className="w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 text-white backdrop-blur-sm border border-white/20 flex items-center justify-center shadow-lg transition-all">
                <Settings className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Right Side: Join Form */}
        <div className="md:w-2/5 p-6 md:p-8 flex flex-col justify-center">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2 tracking-tight">Ready to join?</h1>
            <p className="text-gray-500">Enter your details to enter the meeting.</p>
          </div>

          <div className="space-y-5">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Your Name</label>
              <input
                type="text"
                placeholder="e.g. John Doe"
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 text-gray-900 rounded-xl focus:outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 transition-all placeholder:text-gray-400 font-medium"
                value={userName}
                onChange={(e) => setUserName(e.target.value)}
              />
            </div>

            <div className="relative py-4">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-gray-100" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-white px-3 text-gray-400 font-bold tracking-wider">Join instantly</span>
              </div>
            </div>

            <div className="space-y-3">
              <button
                className="w-full flex items-center justify-center px-4 py-3.5 bg-gradient-to-r from-cyan-600 to-teal-600 hover:from-cyan-700 hover:to-teal-700 text-white font-semibold rounded-xl transition-all shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed group"
                onClick={handleCreateRoom}
                disabled={isCreating || isJoining}
              >
                {isCreating ? (
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                ) : (
                  <Video className="w-5 h-5 mr-2 group-hover:scale-110 transition-transform" />
                )}
                New Meeting
              </button>

              <div className="flex gap-2 pt-2">
                <input
                  type="text"
                  placeholder="Meeting ID"
                  className="flex-1 px-4 py-3 bg-gray-50 border border-gray-200 text-gray-900 rounded-xl focus:outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 transition-all min-w-0 placeholder:text-gray-400 font-medium"
                  value={roomName}
                  onChange={(e) => setRoomName(e.target.value)}
                />
                <button
                  className="px-6 py-3 bg-white border border-gray-200 font-semibold text-teal-600 rounded-xl hover:bg-gray-50 hover:border-teal-200 hover:text-teal-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center shrink-0 shadow-sm"
                  onClick={handleJoinRoom}
                  disabled={isCreating || isJoining}
                >
                  {isJoining ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    "Join"
                  )}
                </button>
              </div>
            </div>

            {error && (
              <motion.p
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-sm text-red-600 bg-red-50 py-2.5 px-3 rounded-lg border border-red-100 font-medium"
              >
                {error}
              </motion.p>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
}
