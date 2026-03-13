"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import bolchalLogo from "@/assets/bolchalLogos.png";
import { FlickeringGrid } from "@/components/ui/flickering-grid";
import { useEffect, useState } from "react";

export function useMediaQuery(query: string) {
  const [value, setValue] = useState(false);

  useEffect(() => {
    // Handle initial check and subsequent changes
    function checkQuery() {
      const result = window.matchMedia(query);
      setValue(result.matches);
    }

    // Check immediately
    checkQuery();

    // Add resize listener
    window.addEventListener("resize", checkQuery);

    // Add media query change listener
    const mediaQuery = window.matchMedia(query);
    mediaQuery.addEventListener("change", checkQuery);

    // Cleanup
    return () => {
      window.removeEventListener("resize", checkQuery);
      mediaQuery.removeEventListener("change", checkQuery);
    };
  }, [query]);

  return value;
}

export const siteConfig = {
  description:
    "AI assistant designed to seamlessly proxy your presence, transcribe, and summarize securely in real-time, so you can focus on what truly matters.",
  footerLinks: [
    {
      title: "Product",
      links: [
        { id: 1, title: "Features", url: "#features" },
        { id: 2, title: "Pricing", url: "#" },
        { id: 3, title: "Security", url: "#" },
      ],
    },
    {
      title: "Company",
      links: [
        { id: 4, title: "About Us", url: "#" },
        { id: 5, title: "Careers", url: "#" },
        { id: 6, title: "Contact", url: "#" },
      ],
    },
    {
      title: "Legal",
      links: [
        { id: 7, title: "Privacy Policy", url: "/privacy" },
        { id: 8, title: "Terms of Service", url: "/terms" },
      ],
    },
  ],
};

export default function Footer() {
  const tablet = useMediaQuery("(max-width: 1024px)");
  const mobile = useMediaQuery("(max-width: 768px)");

  return (
    <footer id="footer" className="w-full pb-0 bg-white border-t border-gray-100 relative overflow-hidden">
      <div className="max-w-7xl mx-auto px-6 py-16 flex flex-col md:flex-row md:justify-between gap-12 relative z-20 bg-white/80 backdrop-blur-sm">
        
        {/* Left Section - Branding */}
        <div className="flex flex-col items-start justify-start gap-y-5 max-w-sm mx-0">
          <Link href="/" className="flex items-center gap-2 group">
              <div className="w-8 h-8 relative flex items-center justify-center overflow-hidden shrink-0">
                <img src={bolchalLogo.src} alt="bolchal.ai logo" className="object-contain w-full h-full" />
              </div>
              
          </Link>
          <p className="tracking-tight text-gray-500 font-medium leading-relaxed">
            {siteConfig.description}
          </p>
          <p className="text-sm text-gray-400 mt-4">
             © {new Date().getFullYear()} bolchal.ai. All rights reserved.
          </p>
        </div>
        
        {/* Right Section - Links */}
        <div className="pt-2 md:w-1/2">
          <div className="flex flex-col items-start justify-start sm:flex-row sm:justify-between gap-y-10 lg:pl-10 lg:gap-x-12">
            {siteConfig.footerLinks.map((column, columnIndex) => (
              <ul key={columnIndex} className="flex flex-col gap-y-3 w-full sm:w-auto">
                <li className="mb-2 text-sm font-semibold text-gray-900 uppercase tracking-wider">
                  {column.title}
                </li>
                {column.links.map((link) => (
                  <li
                    key={link.id}
                    className="group inline-flex cursor-pointer items-center justify-start gap-1 text-[15px]/snug text-gray-500 hover:text-teal-600 transition-colors"
                  >
                    <Link href={link.url}>{link.title}</Link>
                    <div className="flex size-4 items-center justify-center translate-x-0 transform opacity-0 transition-all duration-300 ease-out group-hover:translate-x-1 group-hover:opacity-100 text-teal-600">
                      <ChevronRight className="h-4 w-4" />
                    </div>
                  </li>
                ))}
              </ul>
            ))}
          </div>
        </div>
      </div>
      
      {/* Flickering Grid Background Section */}
      <div className="w-full h-48 md:h-64 relative mt-12 z-0">
        <div className="absolute inset-0 bg-gradient-to-t from-transparent to-white z-10 from-40% pointer-events-none" />
        <div className="absolute inset-0 mx-6">
          <FlickeringGrid
            text={"bolchal.ai"}
            fontSize={mobile ? 40 : (tablet ? 70 : 100)}
            className="h-full w-full"
            squareSize={2}
            gridGap={tablet ? 2 : 3}
            color="#0d9488"
            maxOpacity={0.3}
            flickerChance={0.1}
          />
        </div>
      </div>
    </footer>
  );
}
