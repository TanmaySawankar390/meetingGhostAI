import Link from "next/link";
import { Video } from "lucide-react";

export default function Footer() {
  return (
    <footer className="border-t border-gray-100 bg-white py-12">
      <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white">
            <Video className="w-4 h-4" />
          </div>
          <span className="font-bold text-gray-900 tracking-tight">
            Meeting Ghostwd
          </span>
        </div>

        <p className="text-sm text-gray-500">
          © {new Date().getFullYear()} Meeting Ghost. All rights reserved.
        </p>

        <div className="flex gap-6">
          <Link
            href="/terms"
            className="text-sm text-gray-500 hover:text-blue-600 transition-colors"
          >
            Terms
          </Link>
          <Link
            href="/privacy"
            className="text-sm text-gray-500 hover:text-blue-600 transition-colors"
          >
            Privacy
          </Link>
          <Link
            href="/help"
            className="text-sm text-gray-500 hover:text-blue-600 transition-colors"
          >
            Help
          </Link>
        </div>
      </div>
    </footer>
  );
}
