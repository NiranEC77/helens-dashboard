"use client";

import {
    AreaChart,
    Area,
    ResponsiveContainer,
    YAxis,
    ReferenceLine,
    ReferenceArea,
    Tooltip,
} from "recharts";
import { type Mover, formatPrice, formatVolume, formatMarketCap } from "@/lib/api";

/* Compact sparkline tooltip with session badge */
function SparkTooltip({ active, payload }: any) {
    if (!active || !payload?.length) return null;
    const dataPoint = payload[0]?.payload;
    const val = dataPoint?.v as number;
    const session = dataPoint?.session as string | undefined;

    const sessionLabel = session === "pre" ? "PRE" : session === "post" ? "AH" : null;
    const sessionColor = session === "pre" ? "#a78bfa" : session === "post" ? "#f59e0b" : null;

    return (
        <div
            style={{
                background: "rgba(20, 20, 30, 0.95)",
                border: "1px solid rgba(255,255,255,0.15)",
                borderRadius: 6,
                padding: "3px 8px",
                fontSize: 11,
                fontWeight: 700,
                color: "#f0f0f5",
                whiteSpace: "nowrap",
                display: "flex",
                alignItems: "center",
                gap: 6,
            }}
        >
            <span>${val.toFixed(2)}</span>
            {sessionLabel && (
                <span
                    style={{
                        fontSize: 8,
                        fontWeight: 800,
                        color: sessionColor!,
                        background: session === "pre" ? "rgba(167,139,250,0.2)" : "rgba(245,158,11,0.2)",
                        padding: "1px 4px",
                        borderRadius: 3,
                        letterSpacing: "0.05em",
                    }}
                >
                    {sessionLabel}
                </span>
            )}
        </div>
    );
}

interface StockListViewProps {
    stocks: Mover[];
    onSelect: (mover: Mover) => void;
}

export default function StockListView({ stocks, onSelect }: StockListViewProps) {
    return (
        <div className="glass-card overflow-hidden">
            {/* Header row */}
            <div className="grid grid-cols-[minmax(120px,1fr)_100px_130px_140px_100px_100px] gap-2 px-4 py-2.5 border-b border-white/5 text-[11px] font-semibold text-text-secondary uppercase tracking-wider">
                <span>Stock</span>
                <span className="text-right">Price</span>
                <span className="text-right">Change</span>
                <span className="text-center">Sparkline</span>
                <span className="text-right">Volume</span>
                <span className="text-right">MCap</span>
            </div>

            {/* Rows */}
            {stocks.map((mover, i) => {
                const isUp = mover.gapPct >= 0;
                const accentColor = isUp ? "var(--neon-teal)" : "var(--electric-orange)";
                const refLineColor = isUp ? "rgba(45, 212, 191, 0.5)" : "rgba(251, 146, 60, 0.5)";
                const changeVal = Math.abs(mover.price - mover.prevClose).toFixed(2);
                const pctVal = Math.abs(mover.gapPct).toFixed(2);
                const gradientId = `list-spark-${mover.ticker}`;

                // Use intraday sparkline if available
                const hasIntraday = mover.intradaySparkline && mover.intradaySparkline.length > 1;

                // Single continuous line data
                const sparkData = hasIntraday
                    ? mover.intradaySparkline!.map((p, idx) => ({ v: p.v, i: idx, session: p.session }))
                    : mover.sparkline.map((v, idx) => ({ v, i: idx, session: "regular" as const }));

                const hasSessions = hasIntraday && mover.intradaySparkline!.some(p => p.session !== "regular");

                const allValues = [
                    ...(hasIntraday ? mover.intradaySparkline!.map(p => p.v) : mover.sparkline),
                    mover.prevClose,
                ];
                const minVal = Math.min(...allValues);
                const maxVal = Math.max(...allValues);
                const range = maxVal - minVal || 1;
                const domainMin = minVal - range * 0.08;
                const domainMax = maxVal + range * 0.08;

                // Session boundaries for subtle background zones
                const sessionBoundaries: { session: string; startIdx: number; endIdx: number }[] = [];
                if (hasIntraday) {
                    let currentSession: string | null = null;
                    let startIdx = 0;
                    const intradayData = mover.intradaySparkline!;
                    for (let j = 0; j < intradayData.length; j++) {
                        if (intradayData[j].session !== currentSession) {
                            if (currentSession) {
                                sessionBoundaries.push({ session: currentSession, startIdx, endIdx: j - 1 });
                            }
                            currentSession = intradayData[j].session;
                            startIdx = j;
                        }
                    }
                    if (currentSession) {
                        sessionBoundaries.push({ session: currentSession, startIdx, endIdx: intradayData.length - 1 });
                    }
                }

                return (
                    <button
                        key={mover.ticker}
                        onClick={() => onSelect(mover)}
                        className="grid grid-cols-[minmax(120px,1fr)_100px_130px_140px_100px_100px] gap-2 px-4 py-2 items-center text-left w-full cursor-pointer transition-all hover:bg-white/[0.04] animate-fade-in-up border-b border-white/[0.03] last:border-b-0"
                        style={{ animationDelay: `${i * 0.03}s`, opacity: 0, minHeight: 0 }}
                    >
                        {/* Ticker & Name */}
                        <div className="min-w-0">
                            <div className="flex items-center gap-2">
                                <span className="font-bold text-sm tracking-tight">{mover.ticker}</span>
                                <span
                                    className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${isUp ? "gap-pill-up" : "gap-pill-down"}`}
                                >
                                    {isUp ? "▲" : "▼"}
                                </span>
                            </div>
                            <p className="text-text-secondary text-[11px] truncate">{mover.name}</p>
                        </div>

                        {/* Price */}
                        <span className="text-right text-sm font-bold" style={{ color: accentColor }}>
                            {formatPrice(mover.price)}
                        </span>

                        {/* Change */}
                        <div className="text-right">
                            <span className="text-sm font-bold" style={{ color: accentColor }}>
                                {isUp ? "+" : "-"}${changeVal}
                            </span>
                            <span className="text-sm font-bold ml-1" style={{ color: accentColor }}>
                                ({pctVal}%)
                            </span>
                        </div>

                        {/* Sparkline */}
                        <div className="h-8 px-1">
                            {sparkData.length > 1 && (
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={sparkData} margin={{ top: 1, right: 1, left: 1, bottom: 1 }}>
                                        <YAxis type="number" domain={[domainMin, domainMax]} hide />
                                        <defs>
                                            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor={accentColor} stopOpacity={0.3} />
                                                <stop offset="95%" stopColor={accentColor} stopOpacity={0} />
                                            </linearGradient>
                                        </defs>
                                        <Tooltip
                                            content={<SparkTooltip />}
                                            cursor={{ stroke: "rgba(255,255,255,0.2)", strokeWidth: 1, strokeDasharray: "2 2" }}
                                            isAnimationActive={false}
                                        />
                                        <ReferenceLine
                                            y={mover.prevClose}
                                            stroke={refLineColor}
                                            strokeDasharray="3 2"
                                            strokeWidth={1}
                                        />

                                        {/* Session background zones */}
                                        {hasSessions && sessionBoundaries.filter(b => b.session === "pre").map((b, bi) => (
                                            <ReferenceArea
                                                key={`pre-zone-${bi}`}
                                                x1={b.startIdx}
                                                x2={b.endIdx}
                                                fill="rgba(167,139,250,0.12)"
                                                fillOpacity={1}
                                                stroke="none"
                                            />
                                        ))}
                                        {hasSessions && sessionBoundaries.filter(b => b.session === "post").map((b, bi) => (
                                            <ReferenceArea
                                                key={`post-zone-${bi}`}
                                                x1={b.startIdx}
                                                x2={b.endIdx}
                                                fill="rgba(245,158,11,0.10)"
                                                fillOpacity={1}
                                                stroke="none"
                                            />
                                        ))}

                                        {/* Single continuous line */}
                                        <Area
                                            type="monotone"
                                            dataKey="v"
                                            stroke={accentColor}
                                            fill={`url(#${gradientId})`}
                                            strokeWidth={1.5}
                                            dot={false}
                                            isAnimationActive={false}
                                            activeDot={{
                                                r: 3,
                                                fill: accentColor,
                                                stroke: "var(--bg-primary)",
                                                strokeWidth: 1.5,
                                            }}
                                        />
                                    </AreaChart>
                                </ResponsiveContainer>
                            )}
                        </div>

                        {/* Volume */}
                        <span className="text-right text-[11px] text-text-secondary font-medium">
                            {formatVolume(mover.volume)}
                        </span>

                        {/* Market Cap */}
                        <span className="text-right text-[11px] text-text-secondary font-medium">
                            {formatMarketCap(mover.marketCap)}
                        </span>
                    </button>
                );
            })}
        </div>
    );
}
