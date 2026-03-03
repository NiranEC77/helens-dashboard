"use client";

import { useState, useMemo, useCallback } from "react";
import {
    AreaChart,
    Area,
    XAxis,
    YAxis,
    Tooltip,
    ResponsiveContainer,
    CartesianGrid,
    ReferenceLine,
    ReferenceArea,
    Brush,
} from "recharts";
import { useQuery } from "@tanstack/react-query";
import { fetchChart, fetchNews, formatPrice, type NewsItem } from "@/lib/api";

interface ChartPanelProps {
    ticker: string;
    name: string;
    onClose: () => void;
}

/** A chart point enriched with optional news */
interface EnrichedPoint {
    time: string;
    timestamp: number;
    close: number | null;
    open: number | null;
    high: number | null;
    low: number | null;
    volume: number | null;
    session?: "pre" | "regular" | "post";
    newsTitle?: string;
    newsPublisher?: string;
    newsLink?: string;
    hasNews?: boolean;
}

export default function ChartPanel({ ticker, name, onClose }: ChartPanelProps) {
    const [hoveredNews, setHoveredNews] = useState<string | null>(null);
    const [range, setRange] = useState("1d");

    // Fetch chart data
    const { data: chartData, isLoading, error } = useQuery({
        queryKey: ["chart", ticker, range],
        queryFn: () => fetchChart(ticker, range),
        refetchInterval: 60_000,
    });

    // Fetch news data
    const { data: newsData } = useQuery({
        queryKey: ["news", ticker],
        queryFn: () => fetchNews(ticker),
    });

    const rawPoints = chartData?.points ?? [];
    const newsItems = newsData?.news ?? [];

    const hasSessions = range === "1d" && rawPoints.some(p => p.session && p.session !== "regular");

    // Merge news into chart points and find session boundaries
    const { enrichedPoints, newsOnChart, sessionBoundaries } = useMemo(() => {
        const newsMap = new Map<string, NewsItem>();
        for (const item of newsItems) {
            if (item.time) newsMap.set(item.time, item);
        }

        const matched: { time: string; newsItem: NewsItem; price: number }[] = [];

        // Find session boundary time labels for ReferenceArea zones
        const boundaries: { session: string; startTime: string; endTime: string }[] = [];
        let currentSession: string | null = null;
        let sessionStart: string | null = null;

        const pts: EnrichedPoint[] = rawPoints.map((p, idx) => {
            const news = newsMap.get(p.time);
            const session = p.session || "regular";

            // Track session boundaries
            if (session !== currentSession) {
                if (currentSession && sessionStart) {
                    boundaries.push({
                        session: currentSession,
                        startTime: sessionStart,
                        endTime: rawPoints[idx - 1]?.time || sessionStart,
                    });
                }
                currentSession = session;
                sessionStart = p.time;
            }

            if (news) {
                matched.push({ time: p.time, newsItem: news, price: p.close ?? 0 });
            }

            return {
                ...p,
                hasNews: !!news,
                newsTitle: news?.title,
                newsPublisher: news?.publisher,
                newsLink: news?.link,
            };
        });

        // Close the last boundary
        if (currentSession && sessionStart && rawPoints.length > 0) {
            boundaries.push({
                session: currentSession,
                startTime: sessionStart,
                endTime: rawPoints[rawPoints.length - 1]?.time || sessionStart,
            });
        }

        return { enrichedPoints: pts, newsOnChart: matched, sessionBoundaries: boundaries };
    }, [rawPoints, newsItems]);

    // Determine trend
    const isPositive =
        enrichedPoints.length > 1
            ? (enrichedPoints[enrichedPoints.length - 1]?.close ?? 0) >=
            (enrichedPoints[0]?.close ?? 0)
            : true;

    const accentColor = isPositive ? "var(--neon-teal)" : "var(--electric-orange)";
    const gradientId = `chart-gradient-${ticker}`;

    // Session zone boundaries
    const preBoundary = sessionBoundaries.find(b => b.session === "pre");
    const postBoundary = sessionBoundaries.find(b => b.session === "post");

    // Custom tooltip with session info
    const CustomTooltip = useCallback(({ active, payload, label }: any) => {
        if (!active || !payload?.length) return null;
        const dataPoint = payload[0]?.payload as EnrichedPoint | undefined;
        const price = dataPoint?.close;
        const session = dataPoint?.session;

        const sessionLabel = session === "pre" ? "Pre-Market" : session === "post" ? "After-Hours" : null;
        const sessionColor = session === "pre" ? "#a78bfa" : session === "post" ? "#f59e0b" : null;

        return (
            <div
                className="glass-card p-3 !rounded-xl max-w-xs"
                style={{
                    background: "rgba(13,13,18,0.97)",
                    border: "1px solid rgba(255,255,255,0.12)",
                }}
            >
                <div className="flex items-center gap-2 mb-1">
                    <p className="text-text-muted text-[11px]">{label}</p>
                    {sessionLabel && (
                        <span
                            className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full"
                            style={{
                                color: sessionColor!,
                                background: session === "pre" ? "rgba(167,139,250,0.15)" : "rgba(245,158,11,0.15)",
                            }}
                        >
                            {sessionLabel}
                        </span>
                    )}
                </div>
                <p className="font-bold text-sm" style={{ color: accentColor }}>
                    {price != null ? formatPrice(price) : "—"}
                </p>
                {dataPoint?.hasNews && (
                    <div className="mt-2 pt-2 border-t border-white/10">
                        <div className="flex items-center gap-1.5 mb-1">
                            <span className="w-2 h-2 rounded-full bg-electric-purple animate-pulse-glow" />
                            <span className="text-electric-purple text-[10px] font-bold uppercase tracking-wider">
                                Breaking News
                            </span>
                        </div>
                        <p className="text-xs text-text-primary leading-snug">
                            {dataPoint.newsTitle}
                        </p>
                        {dataPoint.newsPublisher && (
                            <p className="text-[10px] text-text-muted mt-1">
                                — {dataPoint.newsPublisher}
                            </p>
                        )}
                        <p className="text-[9px] text-electric-purple/70 mt-2 font-medium">
                            Click ⚡ on chart to read
                        </p>
                    </div>
                )}
            </div>
        );
    }, [accentColor]);

    return (
        <div
            className="chart-overlay fixed inset-0 z-50 flex items-center justify-center p-4 md:p-8"
            onClick={onClose}
        >
            <div
                className="glass-card w-full max-w-6xl p-6 md:p-8 relative animate-fade-in-up"
                onClick={(e) => e.stopPropagation()}
                style={{ animationDelay: "0s" }}
            >
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <div className="flex items-center gap-4">
                            <h2 className="text-2xl md:text-3xl font-bold tracking-tight">
                                {ticker}
                            </h2>
                            {/* Range Selector */}
                            <div className="flex bg-white/5 rounded-lg p-0.5">
                                {['1d', '5d', '1mo'].map((r) => (
                                    <button
                                        key={r}
                                        onClick={() => setRange(r)}
                                        className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${range === r
                                            ? "bg-white/10 text-white shadow-sm"
                                            : "text-text-muted hover:text-text-secondary"
                                            }`}
                                    >
                                        {r.toUpperCase()}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <p className="text-text-secondary text-sm mt-1">{name}</p>
                    </div>
                    {enrichedPoints.length > 0 && (
                        <div className="text-right mr-12">
                            <p
                                className="text-2xl md:text-3xl font-bold"
                                style={{ color: accentColor }}
                            >
                                {formatPrice(
                                    enrichedPoints[enrichedPoints.length - 1]?.close ?? 0
                                )}
                            </p>
                            <p className="text-text-secondary text-xs mt-1">Latest</p>
                        </div>
                    )}
                    <button
                        onClick={onClose}
                        className="absolute top-4 right-4 w-10 h-10 rounded-full flex items-center justify-center
                       bg-white/5 hover:bg-white/10 transition-colors text-text-secondary hover:text-white"
                        aria-label="Close chart"
                    >
                        ✕
                    </button>
                </div>

                {/* Legend row */}
                <div className="flex items-center gap-4 mb-4 flex-wrap">
                    {hasSessions && (
                        <div className="flex items-center gap-3 text-[11px] text-text-muted">
                            {preBoundary && (
                                <div className="flex items-center gap-1.5">
                                    <span className="w-3 h-2 rounded-sm" style={{ background: "rgba(167,139,250,0.2)", border: "1px solid rgba(167,139,250,0.4)" }} />
                                    <span className="font-medium" style={{ color: "rgba(167,139,250,0.7)" }}>Pre-Market</span>
                                </div>
                            )}
                            <div className="flex items-center gap-1.5">
                                <span className="w-3 h-2 rounded-sm" style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)" }} />
                                <span className="text-text-secondary font-medium">Regular</span>
                            </div>
                            {postBoundary && (
                                <div className="flex items-center gap-1.5">
                                    <span className="w-3 h-2 rounded-sm" style={{ background: "rgba(245,158,11,0.12)", border: "1px solid rgba(245,158,11,0.3)" }} />
                                    <span className="font-medium" style={{ color: "rgba(245,158,11,0.7)" }}>After-Hours</span>
                                </div>
                            )}
                        </div>
                    )}

                    {newsOnChart.length > 0 && (
                        <div className="flex items-center gap-2 text-[11px] text-text-muted">
                            <span className="w-2 h-2 rounded-full bg-electric-purple animate-pulse-glow" />
                            <span>
                                <strong className="text-electric-purple">{newsOnChart.length}</strong>{" "}
                                news events on timeline — hover to read
                            </span>
                        </div>
                    )}
                </div>

                {/* Chart */}
                <div className="h-[280px] md:h-[360px]">
                    {isLoading ? (
                        <div className="w-full h-full skeleton" />
                    ) : error ? (
                        <div className="flex items-center justify-center h-full text-text-secondary">
                            Unable to load chart data.
                        </div>
                    ) : (
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart
                                data={enrichedPoints}
                                margin={{ top: 10, right: 10, left: 10, bottom: 0 }}
                            >
                                <defs>
                                    <linearGradient
                                        id={gradientId}
                                        x1="0"
                                        y1="0"
                                        x2="0"
                                        y2="1"
                                    >
                                        <stop
                                            offset="5%"
                                            stopColor={accentColor}
                                            stopOpacity={0.3}
                                        />
                                        <stop
                                            offset="95%"
                                            stopColor={accentColor}
                                            stopOpacity={0}
                                        />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid
                                    strokeDasharray="3 3"
                                    stroke="rgba(255,255,255,0.04)"
                                    vertical={false}
                                />

                                {/* Session background zones */}
                                {hasSessions && preBoundary && (
                                    <ReferenceArea
                                        x1={preBoundary.startTime}
                                        x2={preBoundary.endTime}
                                        fill="rgba(167,139,250,0.10)"
                                        fillOpacity={1}
                                        stroke="rgba(167,139,250,0.2)"
                                        strokeDasharray="4 4"
                                    />
                                )}
                                {hasSessions && postBoundary && (
                                    <ReferenceArea
                                        x1={postBoundary.startTime}
                                        x2={postBoundary.endTime}
                                        fill="rgba(245,158,11,0.08)"
                                        fillOpacity={1}
                                        stroke="rgba(245,158,11,0.15)"
                                        strokeDasharray="4 4"
                                    />
                                )}

                                {/* Vertical separator lines at session boundaries */}
                                {hasSessions && preBoundary && (
                                    <ReferenceLine
                                        x={preBoundary.endTime}
                                        stroke="rgba(167,139,250,0.4)"
                                        strokeDasharray="6 3"
                                        strokeWidth={1.5}
                                        label={{ value: "PRE", position: "insideTopLeft", fill: "rgba(167,139,250,0.6)", fontSize: 9, fontWeight: 700 }}
                                    />
                                )}
                                {hasSessions && postBoundary && (
                                    <ReferenceLine
                                        x={postBoundary.startTime}
                                        stroke="rgba(245,158,11,0.35)"
                                        strokeDasharray="6 3"
                                        strokeWidth={1.5}
                                        label={{ value: "AH", position: "insideTopRight", fill: "rgba(245,158,11,0.6)", fontSize: 9, fontWeight: 700 }}
                                    />
                                )}

                                <XAxis
                                    dataKey="time"
                                    tick={{ fill: "var(--text-secondary)", fontSize: 11 }}
                                    axisLine={{ stroke: "rgba(255,255,255,0.06)" }}
                                    tickLine={false}
                                    interval="preserveStartEnd"
                                    minTickGap={50}
                                />
                                <YAxis
                                    domain={["auto", "auto"]}
                                    tick={{ fill: "var(--text-secondary)", fontSize: 11 }}
                                    axisLine={false}
                                    tickLine={false}
                                    width={60}
                                    tickFormatter={(v: number) => `$${v.toFixed(0)}`}
                                />
                                <Tooltip
                                    content={<CustomTooltip />}
                                    cursor={{
                                        stroke: "rgba(167,139,250,0.3)",
                                        strokeWidth: 1,
                                        strokeDasharray: "4 4",
                                    }}
                                />

                                {/* News reference lines */}
                                {newsOnChart.map((n, i) => (
                                    <ReferenceLine
                                        key={`news-line-${i}`}
                                        x={n.time}
                                        stroke="var(--electric-purple)"
                                        strokeDasharray="4 4"
                                        strokeOpacity={0.5}
                                    />
                                ))}

                                {/* Single continuous line — same color throughout */}
                                <Area
                                    type="monotone"
                                    dataKey="close"
                                    stroke={accentColor}
                                    strokeWidth={2.5}
                                    fill={`url(#${gradientId})`}
                                    dot={(props: any) => {
                                        const { cx, cy, payload } = props;
                                        if (!payload?.hasNews) return <g key={`dot-${cx}-${cy}`} />;
                                        return (
                                            <g
                                                key={`news-dot-${cx}-${cy}`}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    if (payload.newsLink) window.open(payload.newsLink, "_blank");
                                                }}
                                                style={{ cursor: "pointer" }}
                                            >
                                                {/* Outer glow ring */}
                                                <circle
                                                    cx={cx}
                                                    cy={cy}
                                                    r={12}
                                                    fill="rgba(167,139,250,0.15)"
                                                    stroke="none"
                                                />
                                                {/* Inner dot */}
                                                <circle
                                                    cx={cx}
                                                    cy={cy}
                                                    r={5}
                                                    fill="var(--electric-purple)"
                                                    stroke="var(--bg-primary)"
                                                    strokeWidth={2}
                                                />
                                                {/* News icon (⚡) */}
                                                <text
                                                    x={cx}
                                                    y={cy - 16}
                                                    textAnchor="middle"
                                                    fontSize={11}
                                                    fill="white"
                                                    fontWeight="bold"
                                                >
                                                    ⚡
                                                </text>
                                            </g>
                                        );
                                    }}
                                    activeDot={{
                                        r: 5,
                                        fill: accentColor,
                                        stroke: "var(--bg-primary)",
                                        strokeWidth: 2,
                                    }}
                                />

                                <Brush
                                    dataKey="time"
                                    height={30}
                                    stroke="var(--text-secondary)"
                                    fill="rgba(255,255,255,0.02)"
                                    tickFormatter={() => ""}
                                    travellerWidth={10}
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    )}
                </div>

                {/* News list below chart */}
                {newsOnChart.length > 0 && (
                    <div className="mt-5 pt-4 border-t border-white/5">
                        <h3 className="text-xs font-bold text-text-muted uppercase tracking-wider mb-3">
                            📰 Timeline Events
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                            {newsOnChart.map((n, i) => (
                                <a
                                    key={i}
                                    href={n.newsItem.link}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-start gap-2.5 p-2.5 rounded-xl bg-white/[0.02] hover:bg-white/[0.05] transition-colors group cursor-pointer"
                                    onMouseEnter={() => setHoveredNews(n.time)}
                                    onMouseLeave={() => setHoveredNews(null)}
                                >
                                    <div className="flex-shrink-0 mt-0.5">
                                        <span
                                            className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-[9px] font-bold
                                            ${hoveredNews === n.time
                                                    ? "bg-electric-purple text-white"
                                                    : "bg-electric-purple/20 text-electric-purple"
                                                } transition-colors`}
                                        >
                                            {n.time}
                                        </span>
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <p className="text-xs text-text-primary leading-snug line-clamp-2 group-hover:text-electric-purple transition-colors underline-offset-2 group-hover:underline">
                                            {n.newsItem.title}
                                        </p>
                                        <div className="flex items-center gap-2 mt-0.5 text-[10px] text-text-muted">
                                            <span>{n.newsItem.publisher}</span>
                                            <span className="text-white/20">•</span>
                                            <span className="text-xs">↗</span>
                                        </div>
                                    </div>
                                </a>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
