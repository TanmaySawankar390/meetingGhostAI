"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { Video } from "lucide-react";

export default function Navbar() {
  return (
    <motion.nav
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-100"
    >
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 group">
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white">
            <Video className="w-4 h-4" />
          </div>
          <h1 className="text-xl font-bold text-gray-900 tracking-tight">
            Meeting Ghost
          </h1>
        </Link>
        <div className="flex items-center gap-6">
          <div className="hidden md:flex items-center gap-6 text-sm font-medium text-gray-600">
            <Link href="#features" className="hover:text-blue-600 transition-colors">Features</Link>
            <Link href="#solutions" className="hover:text-blue-600 transition-colors">Solutions</Link>
            <Link href="#pricing" className="hover:text-blue-600 transition-colors">Pricing</Link>
          </div>
          <div className="flex items-center gap-4 border-l border-gray-200 pl-6">
            <Link
              href="/auth/login"
              className="text-sm font-semibold text-gray-700 hover:text-blue-600 transition-colors"
            >
              Log in
            </Link>
            <Link
              href="/meet"
              className="px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition"
            >
              Start for free
            </Link>
          </div>
        </div>
      </div>
    </motion.nav>
  );
}
