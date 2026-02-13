"use client";

import { PieChart, Pie, Cell } from "recharts";

interface VolumeRingProps {
    ratio: number | null; // volume / avgVolume
    size?: number;
}

export default function VolumeRing({ ratio, size = 56 }: VolumeRingProps) {
    const capped = ratio ? Math.min(ratio, 3) : 0; // cap at 3x for visual
    const pct = (capped / 3) * 100;
    const remaining = 100 - pct;

    // Color based on ratio
    let fillColor = "var(--text-muted)";
    if (ratio !== null) {
        if (ratio >= 2) fillColor = "var(--neon-teal)";
        else if (ratio >= 1) fillColor = "var(--electric-purple)";
        else fillColor = "var(--electric-orange)";
    }

    const data = [
        { value: pct },
        { value: remaining },
    ];

    return (
        <div className="relative" style={{ width: size, height: size }}>
            <PieChart width={size} height={size}>
                <Pie
                    data={data}
                    cx={size / 2 - 1}
                    cy={size / 2 - 1}
                    innerRadius={size / 2 - 7}
                    outerRadius={size / 2 - 2}
                    startAngle={90}
                    endAngle={-270}
                    dataKey="value"
                    stroke="none"
                >
                    <Cell fill={fillColor} />
                    <Cell fill="rgba(255,255,255,0.05)" />
                </Pie>
            </PieChart>
            <span
                className="absolute inset-0 flex items-center justify-center text-[10px] font-semibold"
                style={{ color: fillColor }}
            >
                {ratio !== null ? `${ratio.toFixed(1)}x` : "—"}
            </span>
        </div>
    );
}
