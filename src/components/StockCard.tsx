"use client";

import {
    AreaChart,
    Area,
    ResponsiveContainer,
} from "recharts";
import VolumeRing from "./VolumeRing";
import { type Mover, formatPrice, formatVolume, formatMarketCap } from "@/lib/api";

interface StockCardProps {
    mover: Mover;
    index: number;
    onClick: () => void;
}

export default function StockCard({ mover, index, onClick }: StockCardProps) {
    const isUp = mover.gapPct >= 0;
    const accentColor = isUp ? "var(--neon-teal)" : "var(--electric-orange)";
    const gradientId = `spark-${mover.ticker}`;

    // Sparkline data
    const sparkData = mover.sparkline.map((v, i) => ({ v, i }));

    return (
        <button
            onClick={onClick}
            className="glass-card p-5 text-left w-full cursor-pointer animate-fade-in-up group"
            style={{ animationDelay: `${index * 0.06}s`, opacity: 0 }}
        >
            {/* Top row — ticker + gap pill */}
            <div className="flex items-start justify-between mb-3">
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                        <h3 className="text-lg font-bold tracking-tight">{mover.ticker}</h3>
                        <span
                            className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${isUp ? "gap-pill-up" : "gap-pill-down"
                                }`}
                        >
                            {isUp ? "▲" : "▼"} {Math.abs(mover.gapPct).toFixed(2)}%
                        </span>
                    </div>
                    <p className="text-text-secondary text-xs mt-0.5 truncate pr-2">
                        {mover.name}
                    </p>
                </div>

                {/* Volume ring */}
                <VolumeRing ratio={mover.volumeRatio} size={48} />
            </div>

            {/* Price */}
            <p className="text-2xl font-bold tracking-tight mb-1" style={{ color: accentColor }}>
                {formatPrice(mover.price)}
            </p>
            <p className="text-text-muted text-xs mb-4">
                Prev: {formatPrice(mover.prevClose)}
            </p>

            {/* Sparkline */}
            {sparkData.length > 1 && (
                <div className="h-10 -mx-1 mb-3">
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={sparkData} margin={{ top: 2, right: 2, left: 2, bottom: 2 }}>
                            <defs>
                                <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor={accentColor} stopOpacity={0.25} />
                                    <stop offset="95%" stopColor={accentColor} stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <Area
                                type="monotone"
                                dataKey="v"
                                stroke={accentColor}
                                strokeWidth={1.5}
                                fill={`url(#${gradientId})`}
                                dot={false}
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            )}

            {/* Bottom stats row */}
            <div className="flex items-center justify-between text-[11px] text-text-muted">
                <span>Vol: {formatVolume(mover.volume)}</span>
                <span>MCap: {formatMarketCap(mover.marketCap)}</span>
            </div>

            {/* Hover hint */}
            <div className="mt-3 text-center opacity-0 group-hover:opacity-100 transition-opacity text-text-muted text-[10px] tracking-wider uppercase">
                View Chart →
            </div>
        </button>
    );
}
