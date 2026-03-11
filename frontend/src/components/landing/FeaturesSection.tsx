"use client";

import { motion } from "framer-motion";
import { Video, MonitorUp, MessageSquare, AudioLines } from "lucide-react";

const features = [
  {
    title: "HD Video & Audio",
    description:
      "Crystal clear 1080p video and noise-canceling audio to make every meeting feel like you're in the same room.",
    icon: Video,
    color: "bg-blue-100 text-blue-600",
    delay: 0.1,
  },
  {
    title: "Screen Share",
    description:
      "Share your entire screen, a specific window, or a single browser tab instantly with zero lag.",
    icon: MonitorUp,
    color: "bg-purple-100 text-purple-600",
    delay: 0.2,
  },
  {
    title: "Real-time Chat",
    description:
      "Send links, files, and messages to individuals or the entire group without interrupting the presentation.",
    icon: MessageSquare,
    color: "bg-emerald-100 text-emerald-600",
    delay: 0.3,
  },
  {
    title: "Cloud Recording",
    description:
      "Record your meetings automatically. Get AI-generated summaries and action items sent straight to your inbox.",
    icon: AudioLines,
    color: "bg-rose-100 text-rose-600",
    delay: 0.4,
  },
];

export default function FeaturesSection() {
  return (
    <section id="features" className="py-24 relative overflow-hidden bg-white border-t border-gray-100">
      <div className="max-w-7xl mx-auto px-6 relative z-10">
        <div className="text-center mb-16">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-3xl md:text-5xl font-bold text-gray-900 mb-4 tracking-tight"
          >
            Everything you need for <br className="hidden sm:block" />
            <span className="text-blue-600">perfect meetings</span>
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="text-lg text-gray-600 max-w-2xl mx-auto mt-6"
          >
            Built for modern teams that need reliable, high-quality video conferencing without the clunky software.
          </motion.p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
          {features.map((feature, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: feature.delay }}
              className="bg-gray-50 p-8 rounded-2xl border border-gray-100 hover:shadow-md transition-shadow group"
            >
              <div
                className={`w-14 h-14 rounded-xl mb-6 flex items-center justify-center ${feature.color} shadow-sm group-hover:scale-110 transition-transform`}
              >
                <feature.icon className="w-6 h-6" />
              </div>

              <h3 className="text-xl font-bold text-gray-900 mb-3 tracking-tight">
                {feature.title}
              </h3>
              <p className="text-sm text-gray-600 leading-relaxed">
                {feature.description}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
