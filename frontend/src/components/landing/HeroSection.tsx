"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { Video, Keyboard, ArrowRight } from "lucide-react";
import { GLSLHills } from "@/components/ui/glsl-hills";

export default function HeroSection() {
  return (
    <section className="relative min-h-[90vh] flex items-center justify-center pt-24 pb-16 overflow-hidden bg-gradient-to-b from-blue-50 to-white">
      {/* 3D Animated Background */}
      <GLSLHills />

      <div className="max-w-7xl mx-auto px-6 relative z-10 w-full flex flex-col items-center pointer-events-none text-center">
        
        {/* Top Text Content */}
        <div className="max-w-5xl mx-auto pointer-events-auto mt-12 md:mt-20">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.8, ease: "easeOut" }}
            className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-100/50 text-blue-700 text-sm font-semibold mb-6 border border-blue-200/50 backdrop-blur-md"
          >
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
            </span>
            Meeting Ghost AI
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.8 }}
            className="text-5xl lg:text-7xl xl:text-8xl font-black text-gray-900 leading-[1.1] tracking-tighter mb-6 relative"
          >
            <span className="italic font-light text-gray-500">Designs That Speak</span> <br className="hidden sm:block" />
            Louder Than Words.
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.8 }}
            className="text-xl md:text-2xl text-gray-600 mb-10 max-w-3xl mx-auto leading-relaxed font-medium"
          >
            Seamless AI proxy that takes over your identity to listen and speak securely during meetings.
            <br className="hidden md:block"/> Connect with your audience and never miss a beat.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.8 }}
            className="flex flex-col sm:flex-row items-center gap-4 justify-center"
          >
            <Link
              href="/meet"
              className="flex items-center gap-2 px-8 py-4 bg-blue-600 text-white rounded-xl font-bold text-lg hover:bg-blue-700 transition w-full sm:w-auto shadow-xl hover:shadow-blue-500/30 hover:-translate-y-1"
            >
              <Video className="w-5 h-5" />
              Start Ghosting
            </Link>
            
            <div className="flex items-center gap-2 w-full sm:w-auto relative shadow-lg rounded-xl overflow-hidden bg-white/80 backdrop-blur-md border border-gray-200/50 transition hover:bg-white">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <Keyboard className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="text"
                placeholder="Enter room code or link"
                className="block w-full pl-12 pr-4 py-4 leading-5 bg-transparent placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium sm:text-lg transition sm:w-80"
              />
              <Link
                href="/meet"
                className="hidden sm:flex items-center text-blue-600 font-bold hover:text-blue-800 transition tracking-wide px-4 h-full bg-blue-50 rounded-r-xl"
              >
                Join
              </Link>
            </div>
          </motion.div>
          <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            transition={{ delay: 0.6, duration: 1 }}
            className="mt-8 pt-6 border-t border-gray-200/30 flex items-center justify-center gap-2 text-sm text-gray-500 font-medium"
          >
            <span>Learn more about Meeting Ghost Protocol</span>
            <ArrowRight className="w-4 h-4 text-gray-400 group-hover:translate-x-1 transition" />
          </motion.div>
        </div>
      </div>
    </section>
  );
}
