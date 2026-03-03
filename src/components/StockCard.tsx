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
import VolumeRing from "./VolumeRing";
import { type Mover, formatPrice, formatVolume, formatMarketCap } from "@/lib/api";

interface StockCardProps {
    mover: Mover;
    index: number;
    onClick: () => void;
}

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

export default function StockCard({ mover, index, onClick }: StockCardProps) {
    const isUp = mover.gapPct >= 0;
    const accentColor = isUp ? "var(--neon-teal)" : "var(--electric-orange)";
    const refLineColor = isUp ? "rgba(45, 212, 191, 0.5)" : "rgba(251, 146, 60, 0.5)";

    const preColor = "#a78bfa";
    const postColor = "#f59e0b";

    // Use intraday sparkline if available, otherwise fallback to daily
    const hasIntraday = mover.intradaySparkline && mover.intradaySparkline.length > 1;

    // Intraday data with session split for multi-colored rendering
    const intradayData = hasIntraday
        ? mover.intradaySparkline!.map((p, i) => ({
            v: p.v,
            i,
            session: p.session,
            vPre: p.session === "pre" ? p.v : null,
            vRegular: p.session === "regular" ? p.v : null,
            vPost: p.session === "post" ? p.v : null,
        }))
        : null;

    // Bridge gaps at session transitions for connected rendering
    if (intradayData) {
        for (let i = 1; i < intradayData.length; i++) {
            const prev = intradayData[i - 1];
            const curr = intradayData[i];
            if (prev.session !== curr.session) {
                // Copy previous value into current session series
                if (curr.session === "regular") {
                    prev.vRegular = prev.v;
                } else if (curr.session === "post") {
                    prev.vPost = prev.v;
                } else if (curr.session === "pre") {
                    prev.vPre = prev.v;
                }
            }
        }
    }

    // Daily sparkline fallback
    const dailyData = mover.sparkline.map((v, i) => ({ v, i }));

    const sparkData = intradayData || dailyData;
    const hasSessions = hasIntraday && mover.intradaySparkline!.some(p => p.session !== "regular");

    // Gradient IDs
    const gradientId = `spark-${mover.ticker}`;
    const gradientPreId = `spark-pre-${mover.ticker}`;
    const gradientPostId = `spark-post-${mover.ticker}`;

    // Calculate domain to include prevClose
    const allValues = [
        ...(hasIntraday ? mover.intradaySparkline!.map(p => p.v) : mover.sparkline),
        mover.prevClose,
    ];
    const minVal = Math.min(...allValues);
    const maxVal = Math.max(...allValues);
    const range = maxVal - minVal || 1;
    const domainMin = minVal - range * 0.08;
    const domainMax = maxVal + range * 0.08;

    // Determine session boundary indices for ReferenceArea
    const sessionBoundaries: { session: string; startIdx: number; endIdx: number }[] = [];
    if (intradayData) {
        let currentSession: string | null = null;
        let startIdx = 0;
        for (let i = 0; i < intradayData.length; i++) {
            if (intradayData[i].session !== currentSession) {
                if (currentSession) {
                    sessionBoundaries.push({ session: currentSession, startIdx, endIdx: i - 1 });
                }
                currentSession = intradayData[i].session;
                startIdx = i;
            }
        }
        if (currentSession) {
            sessionBoundaries.push({ session: currentSession, startIdx, endIdx: intradayData.length - 1 });
        }
    }

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
                            {isUp ? "▲" : "▼"} ${Math.abs(mover.price - mover.prevClose).toFixed(2)} ({Math.abs(mover.gapPct).toFixed(2)}%)
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
            <p className="text-text-secondary text-xs mb-4">
                Prev: {formatPrice(mover.prevClose)}
            </p>

            {/* Session legend (only if intraday with extended hours) */}
            {hasSessions && (
                <div className="flex items-center gap-2 mb-2 text-[9px] font-bold">
                    {mover.intradaySparkline!.some(p => p.session === "pre") && (
                        <span className="flex items-center gap-1" style={{ color: preColor }}>
                            <span className="w-2 h-1 rounded-sm" style={{ background: preColor, opacity: 0.7 }} />
                            PRE
                        </span>
                    )}
                    <span className="flex items-center gap-1 text-text-muted">
                        <span className="w-2 h-1 rounded-sm" style={{ background: accentColor, opacity: 0.7 }} />
                        REG
                    </span>
                    {mover.intradaySparkline!.some(p => p.session === "post") && (
                        <span className="flex items-center gap-1" style={{ color: postColor }}>
                            <span className="w-2 h-1 rounded-sm" style={{ background: postColor, opacity: 0.7 }} />
                            AH
                        </span>
                    )}
                </div>
            )}

            {/* Sparkline */}
            {sparkData.length > 1 && (
                <div className="h-16 -mx-1 mb-3">
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={sparkData} margin={{ top: 2, right: 2, left: 2, bottom: 2 }}>
                            <YAxis type="number" domain={[domainMin, domainMax]} hide />
                            <defs>
                                <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor={accentColor} stopOpacity={0.4} />
                                    <stop offset="95%" stopColor={accentColor} stopOpacity={0} />
                                </linearGradient>
                                {hasSessions && (
                                    <>
                                        <linearGradient id={gradientPreId} x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor={preColor} stopOpacity={0.3} />
                                            <stop offset="95%" stopColor={preColor} stopOpacity={0} />
                                        </linearGradient>
                                        <linearGradient id={gradientPostId} x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor={postColor} stopOpacity={0.25} />
                                            <stop offset="95%" stopColor={postColor} stopOpacity={0} />
                                        </linearGradient>
                                    </>
                                )}
                            </defs>
                            <Tooltip
                                content={<SparkTooltip />}
                                cursor={{ stroke: "rgba(255,255,255,0.25)", strokeWidth: 1, strokeDasharray: "3 3" }}
                                isAnimationActive={false}
                            />
                            <ReferenceLine
                                y={mover.prevClose}
                                stroke={refLineColor}
                                strokeDasharray="4 3"
                                strokeWidth={1.5}
                            />

                            {/* Session background zones */}
                            {hasSessions && sessionBoundaries.filter(b => b.session === "pre").map((b, i) => (
                                <ReferenceArea
                                    key={`pre-zone-${i}`}
                                    x1={b.startIdx}
                                    x2={b.endIdx}
                                    fill="rgba(167,139,250,0.08)"
                                    fillOpacity={1}
                                    stroke="none"
                                />
                            ))}
                            {hasSessions && sessionBoundaries.filter(b => b.session === "post").map((b, i) => (
                                <ReferenceArea
                                    key={`post-zone-${i}`}
                                    x1={b.startIdx}
                                    x2={b.endIdx}
                                    fill="rgba(245,158,11,0.06)"
                                    fillOpacity={1}
                                    stroke="none"
                                />
                            ))}

                            {hasSessions ? (
                                <>
                                    <Area
                                        type="monotone"
                                        dataKey="vPre"
                                        stroke={preColor}
                                        fill={`url(#${gradientPreId})`}
                                        strokeWidth={1.5}
                                        dot={false}
                                        isAnimationActive={false}
                                        connectNulls={false}
                                        activeDot={{
                                            r: 3,
                                            fill: preColor,
                                            stroke: "var(--bg-primary)",
                                            strokeWidth: 1.5,
                                        }}
                                    />
                                    <Area
                                        type="monotone"
                                        dataKey="vRegular"
                                        stroke={accentColor}
                                        fill={`url(#${gradientId})`}
                                        strokeWidth={2}
                                        dot={false}
                                        isAnimationActive={false}
                                        connectNulls={false}
                                        activeDot={{
                                            r: 4,
                                            fill: accentColor,
                                            stroke: "var(--bg-primary)",
                                            strokeWidth: 2,
                                        }}
                                    />
                                    <Area
                                        type="monotone"
                                        dataKey="vPost"
                                        stroke={postColor}
                                        fill={`url(#${gradientPostId})`}
                                        strokeWidth={1.5}
                                        dot={false}
                                        isAnimationActive={false}
                                        connectNulls={false}
                                        activeDot={{
                                            r: 3,
                                            fill: postColor,
                                            stroke: "var(--bg-primary)",
                                            strokeWidth: 1.5,
                                        }}
                                    />
                                </>
                            ) : (
                                <Area
                                    type="monotone"
                                    dataKey="v"
                                    stroke={accentColor}
                                    fill={`url(#${gradientId})`}
                                    strokeWidth={2}
                                    dot={false}
                                    isAnimationActive={false}
                                    activeDot={{
                                        r: 4,
                                        fill: accentColor,
                                        stroke: "var(--bg-primary)",
                                        strokeWidth: 2,
                                    }}
                                />
                            )}
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            )}

            {/* Bottom stats row */}
            <div className="flex items-center justify-between text-[11px] text-text-secondary font-medium">
                <span>Vol: {formatVolume(mover.volume)}</span>
                <span>MCap: {formatMarketCap(mover.marketCap)}</span>
            </div>

            {/* Hover hint */}
            <div className="mt-3 text-center opacity-0 group-hover:opacity-100 transition-opacity text-text-secondary text-[10px] tracking-wider uppercase font-bold">
                View Chart →
            </div>
        </button>
    );
}
