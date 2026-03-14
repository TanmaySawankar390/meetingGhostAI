"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { Video, Keyboard, ArrowRight } from "lucide-react";
import { GLSLHills } from "@/components/ui/glsl-hills";
import bolchalLogo from "@/assets/bolchalText.png";

export default function HeroSection() {
  return (
    <section className="relative min-h-[90vh] flex items-center justify-center pt-24 pb-16 overflow-hidden bg-gradient-to-b from-gray-100 to-white">
      {/* 3D Animated Background */}
      <GLSLHills />

      <div className="max-w-7xl mx-auto px-6 relative z-10 w-full flex flex-col items-center pointer-events-none text-center">
        
        {/* Top Text Content */}
        <div className="max-w-5xl mx-auto pointer-events-auto mt-12 md:mt-20">
          {/* <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.8, ease: "easeOut" }}
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-teal-100/50 text-teal-800 text-sm font-semibold mb-6 border border-teal-200/50 backdrop-blur-md shadow-sm"
          >
            <div className="w-5 h-5 relative flex items-center justify-center overflow-hidden shrink-0">
              <img src={bolchalLogo.src} alt="Bolchal.ai Logo" className="object-contain w-full h-full" />
            </div>
            <span className="press-start-2p-regular text-xs pt-1">bolchal.ai</span>
          </motion.div> */}

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.8 }}
            className="text-4xl lg:text-6xl xl:text-7xl text-gray-900 leading-[1.2] tracking-tighter mb-6 relative press-start-2p-regular"
          >
            <span className="text-gray-500 text-3xl lg:text-5xl xl:text-6xl">AI that keeps</span> <br className="hidden sm:block" />
            meetings moving.
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.8 }}
            className="text-xl md:text-2xl text-gray-600 mb-10 max-w-3xl mx-auto leading-relaxed font-medium"
          >
             Focus on your conversation and let AI handle the rest.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.8 }}
            className="flex flex-col sm:flex-row items-center gap-4 justify-center"
          >
            <Link
              href="/meet"
              className="flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-cyan-600 to-teal-600 text-white rounded-xl font-bold text-lg hover:from-cyan-700 hover:to-teal-700 transition w-full sm:w-auto shadow-xl hover:shadow-teal-500/30 hover:-translate-y-1"
            >
              <Video className="w-5 h-5" />
              Start Meeting
            </Link>
            
            <div className="flex items-center gap-2 w-full sm:w-auto relative shadow-lg rounded-xl overflow-hidden bg-white/80 backdrop-blur-md border border-gray-200/50 transition hover:bg-white">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <Keyboard className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="text"
                placeholder="Enter room code or link"
                className="block w-full pl-12 pr-4 py-4 leading-5 bg-transparent placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-teal-500 font-medium sm:text-lg transition sm:w-80"
              />
              <Link
                href="/meet"
                className="hidden sm:flex items-center text-teal-600 font-bold hover:text-teal-800 transition tracking-wide px-4 h-full bg-teal-50 rounded-r-xl"
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
            <span>Learn more about bolchal.ai</span>
            <ArrowRight className="w-4 h-4 text-gray-400 group-hover:translate-x-1 transition" />
          </motion.div>
        </div>
      </div>
    </section>
  );
}
