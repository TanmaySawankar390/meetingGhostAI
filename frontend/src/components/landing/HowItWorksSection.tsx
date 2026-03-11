"use client";

import { motion } from "framer-motion";
import { LogIn, ToggleRight, Coffee, FileSearch } from "lucide-react";

const steps = [
  {
    icon: LogIn,
    title: "1. Join the Lobby",
    description:
      "Enter your name and join a LiveKit room just like any video call.",
  },
  {
    icon: ToggleRight,
    title: "2. Enable Takeover",
    description:
      "Click the toggle. Your mic is muted, and the AI WebSocket stream intercepts your audio track.",
  },
  {
    icon: Coffee,
    title: "3. Step Away",
    description:
      "The AI listens to everyone, tracking context. If addressed directly, it speaks through your avatar.",
  },
  {
    icon: FileSearch,
    title: "4. Return & Review",
    description:
      "Click 'Get Summary' to read what happened while you were gone, then disable the proxy.",
  },
];

export default function HowItWorksSection() {
  return (
    <section className="py-24 relative" id="how-it-works">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-5xl font-black text-white mb-4">
            How it works
          </h2>
          <p className="text-gray-400">
            Four simple steps to clone yourself in meetings.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {steps.map((step, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1 }}
              className="relative"
            >
              {/* Connector Line */}
              {index < steps.length - 1 && (
                <div className="hidden lg:block absolute top-8 left-1/2 w-full h-[1px] bg-gradient-to-r from-purple-500/50 to-transparent" />
              )}

              <div className="relative z-10 flex flex-col items-center text-center">
                <div className="w-16 h-16 rounded-full glass-strong border border-purple-500/30 flex items-center justify-center mb-6 shadow-[0_0_20px_rgba(139,92,246,0.1)] text-purple-400">
                  <step.icon className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-white mb-2">
                  {step.title}
                </h3>
                <p className="text-sm text-gray-400">{step.description}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
