"use client";

import { useEffect, useState } from "react";

interface Props {
    isActive: boolean;
}

export default function AudioVisualizer({ isActive }: Props) {
    const [bars, setBars] = useState<number[]>(Array(20).fill(4));

    useEffect(() => {
        if (!isActive) {
            setBars(Array(20).fill(4));
            return;
        }
        const interval = setInterval(() => {
            setBars(Array(20).fill(0).map(() => Math.random() * 28 + 4));
        }, 100);
        return () => clearInterval(interval);
    }, [isActive]);

    return (
        <div className="flex items-end justify-center gap-[3px] h-8">
            {bars.map((height, i) => (
                <div
                    key={i}
                    className="w-1 rounded-full transition-all duration-100"
                    style={{
                        height: `${height}px`,
                        backgroundColor: isActive
                            ? `hsl(${170 + i * 5}, 80%, ${50 + Math.random() * 20}%)`
                            : "#2a2a40",
                    }}
                />
            ))}
        </div>
    );
}
