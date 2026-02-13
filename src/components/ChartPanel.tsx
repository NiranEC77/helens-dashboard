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
    newsTitle?: string;
    newsPublisher?: string;
    newsLink?: string;
    hasNews?: boolean;
}

export default function ChartPanel({ ticker, name, onClose }: ChartPanelProps) {
    const [hoveredNews, setHoveredNews] = useState<string | null>(null);

    // Fetch chart data
    const { data: chartData, isLoading, error } = useQuery({
        queryKey: ["chart", ticker],
        queryFn: () => fetchChart(ticker),
        refetchInterval: 60_000,
    });

    // Fetch news data
    const { data: newsData } = useQuery({
        queryKey: ["news", ticker],
        queryFn: () => fetchNews(ticker),
    });

    const rawPoints = chartData?.points ?? [];
    const newsItems = newsData?.news ?? [];

    // Merge news into chart points by matching time strings
    const { enrichedPoints, newsOnChart } = useMemo(() => {
        const newsMap = new Map<string, NewsItem>();
        for (const item of newsItems) {
            if (item.time) newsMap.set(item.time, item);
        }

        const matched: { time: string; newsItem: NewsItem; price: number }[] = [];
        const pts: EnrichedPoint[] = rawPoints.map((p) => {
            const news = newsMap.get(p.time);
            if (news) {
                matched.push({ time: p.time, newsItem: news, price: p.close ?? 0 });
                return {
                    ...p,
                    newsTitle: news.title,
                    newsPublisher: news.publisher,
                    newsLink: news.link,
                    hasNews: true,
                };
            }
            return { ...p, hasNews: false };
        });

        return { enrichedPoints: pts, newsOnChart: matched };
    }, [rawPoints, newsItems]);

    // Determine trend
    const isPositive =
        enrichedPoints.length > 1
            ? (enrichedPoints[enrichedPoints.length - 1]?.close ?? 0) >=
            (enrichedPoints[0]?.close ?? 0)
            : true;

    const accentColor = isPositive ? "var(--neon-teal)" : "var(--electric-orange)";
    const gradientId = `chart-gradient-${ticker}`;

    // Custom tooltip that shows news when hovering on a news point
    const CustomTooltip = useCallback(({ active, payload, label }: any) => {
        if (!active || !payload?.length) return null;
        const dataPoint = payload[0]?.payload as EnrichedPoint | undefined;
        const price = dataPoint?.close;

        return (
            <div
                className="glass-card p-3 !rounded-xl max-w-xs"
                style={{
                    background: "rgba(13,13,18,0.97)",
                    border: "1px solid rgba(255,255,255,0.12)",
                }}
            >
                <p className="text-text-muted text-[11px] mb-1">Time: {label}</p>
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
                        <h2 className="text-2xl md:text-3xl font-bold tracking-tight">
                            {ticker}
                        </h2>
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

                {/* News legend */}
                {newsOnChart.length > 0 && (
                    <div className="flex items-center gap-2 mb-4 text-[11px] text-text-muted">
                        <span className="w-2 h-2 rounded-full bg-electric-purple animate-pulse-glow" />
                        <span>
                            <strong className="text-electric-purple">{newsOnChart.length}</strong>{" "}
                            news events on timeline — hover to read
                        </span>
                    </div>
                )}

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
                                <XAxis
                                    dataKey="time"
                                    tick={{ fill: "var(--text-muted)", fontSize: 11 }}
                                    axisLine={{ stroke: "rgba(255,255,255,0.06)" }}
                                    tickLine={false}
                                    interval="preserveStartEnd"
                                    minTickGap={50}
                                />
                                <YAxis
                                    domain={["auto", "auto"]}
                                    tick={{ fill: "var(--text-muted)", fontSize: 11 }}
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

                                {/* News reference lines — vertical dashed lines at news points */}
                                {newsOnChart.map((n, i) => (
                                    <ReferenceLine
                                        key={`news-line-${i}`}
                                        x={n.time}
                                        stroke="var(--electric-purple)"
                                        strokeDasharray="4 4"
                                        strokeOpacity={0.5}
                                    />
                                ))}

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
