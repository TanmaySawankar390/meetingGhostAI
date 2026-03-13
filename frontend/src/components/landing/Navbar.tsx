"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import bolchalLogo from "@/assets/bolchalLogos.png";

export default function Navbar() {
  return (
    <motion.nav
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-100"
    >
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 group">
          <div className="w-8 h-8 relative  flex items-center justify-center overflow-hidden shrink-0">
            <img src={bolchalLogo.src} alt="bolchal.ai logo" className="object-contain w-full h-full" />
          </div>
          <h1 className="text-xl text-gray-900 tracking-tight press-start-2p-regular">
            bolchal.ai
          </h1>
        </Link>
        <div className="flex items-center gap-6">
          <div className="hidden md:flex items-center gap-6 text-sm font-medium text-gray-600">
            <Link href="#features" className="hover:text-teal-600 transition-colors">Features</Link>
            <Link href="#solutions" className="hover:text-teal-600 transition-colors">Solutions</Link>
            <Link href="#pricing" className="hover:text-teal-600 transition-colors">Pricing</Link>
          </div>
          <div className="flex items-center gap-4 border-l border-gray-200 pl-6">
            <Link
              href="/auth/login"
              className="text-sm font-semibold text-gray-700 hover:text-teal-600 transition-colors"
            >
              Log in
            </Link>
            <Link
              href="/meet"
              className="px-4 py-2 bg-gradient-to-r from-cyan-600 to-teal-600 text-white text-sm font-semibold rounded-lg hover:from-cyan-700 hover:to-teal-700 transition shadow-sm"
            >
              Start for free
            </Link>
          </div>
        </div>
      </div>
    </motion.nav>
  );
}
