"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchMovers, type Mover } from "@/lib/api";
import StockCard from "@/components/StockCard";
import ChartPanel from "@/components/ChartPanel";

export default function Dashboard() {
  const [selectedTicker, setSelectedTicker] = useState<Mover | null>(null);
  const [filter, setFilter] = useState<"all" | "gainers" | "losers">("all");

  const {
    data,
    isLoading,
    error,
    dataUpdatedAt,
  } = useQuery({
    queryKey: ["movers"],
    queryFn: fetchMovers,
    refetchInterval: 30_000,
  });

  const movers = data?.movers ?? [];
  const source = data?.source ?? "live";

  const filtered =
    filter === "all"
      ? movers
      : filter === "gainers"
        ? movers.filter((m) => m.gapPct > 0)
        : movers.filter((m) => m.gapPct < 0);

  const lastUpdated = dataUpdatedAt
    ? new Date(dataUpdatedAt).toLocaleTimeString()
    : null;

  return (
    <div className="relative z-10 min-h-screen">
      {/* ── Header ── */}
      <header className="sticky top-0 z-40 px-6 py-4 flex items-center justify-between border-b border-glass-border bg-[var(--bg-primary)]/80 backdrop-blur-xl">
        <div className="flex items-center gap-3">
          {/* Logo */}
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-neon-teal to-electric-purple flex items-center justify-center text-sm font-bold text-white shadow-lg">
            AG
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight leading-none">
              Anti-Gravity
            </h1>
            <p className="text-text-secondary text-[11px] tracking-wide">
              PRE-MARKET DASHBOARD
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {/* Filter tabs */}
          <div className="hidden sm:flex items-center bg-white/5 rounded-xl p-1 text-xs font-semibold">
            {(["all", "gainers", "losers"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3.5 py-1.5 rounded-lg capitalize transition-all ${filter === f
                  ? "bg-white/10 text-white"
                  : "text-text-muted hover:text-text-secondary"
                  }`}
              >
                {f}
              </button>
            ))}
          </div>

          {/* Live indicator */}
          <div className="flex items-center gap-2 text-xs text-text-muted">
            <span className="relative flex h-2 w-2">
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${source === "live" ? "bg-neon-teal" : "bg-electric-orange"
                }`} />
              <span className={`relative inline-flex rounded-full h-2 w-2 ${source === "live" ? "bg-neon-teal" : "bg-electric-orange"
                }`} />
            </span>
            {lastUpdated && <span className="hidden md:inline">Updated {lastUpdated}</span>}
          </div>
        </div>
      </header>

      {/* ── Main content ── */}
      <main className="px-4 md:px-8 py-6 max-w-[1600px] mx-auto">
        {/* Summary bar */}
        {movers.length > 0 && (
          <div className="flex items-center gap-4 mb-6 text-xs text-text-muted flex-wrap">
            {source !== "live" && (
              <span className="glass-card px-3 py-1.5 !rounded-lg hover:!transform-none border !border-electric-orange/30">
                🕐 <strong className="text-electric-orange">
                  {source === "previous_close" ? "LAST SESSION" : "CACHED"}
                </strong> — {source === "previous_close"
                  ? "Showing previous trading day (markets closed)"
                  : "Showing last fetched data (yfinance unavailable)"}
              </span>
            )}
            <span className="glass-card px-3 py-1.5 !rounded-lg hover:!transform-none">
              📊 Tracking <strong className="text-white">{movers.length}</strong> stocks
            </span>
            <span className="glass-card px-3 py-1.5 !rounded-lg hover:!transform-none">
              🟢 Gainers:{" "}
              <strong className="text-neon-teal">
                {movers.filter((m) => m.gapPct > 0).length}
              </strong>
            </span>
            <span className="glass-card px-3 py-1.5 !rounded-lg hover:!transform-none">
              🔻 Losers:{" "}
              <strong className="text-electric-orange">
                {movers.filter((m) => m.gapPct < 0).length}
              </strong>
            </span>
          </div>
        )}

        {/* Loading state */}
        {isLoading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="skeleton h-52" />
            ))}
          </div>
        )}

        {/* Error state */}
        {error && (
          <div className="glass-card p-12 text-center">
            <p className="text-electric-orange text-lg font-bold mb-2">
              Unable to fetch market data
            </p>
            <p className="text-text-secondary text-sm">
              Could not reach the API at{" "}
              <code className="text-accent-pink">
                {process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}
              </code>
            </p>
            <p className="text-text-muted text-xs mt-2">
              {process.env.NEXT_PUBLIC_API_URL
                ? "The backend may be starting up — try refreshing in a moment."
                : "Set NEXT_PUBLIC_API_URL to your deployed backend URL."}
            </p>
          </div>
        )}

        {/* Cards grid */}
        {!isLoading && !error && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filtered.map((mover, i) => (
              <StockCard
                key={mover.ticker}
                mover={mover}
                index={i}
                onClick={() => setSelectedTicker(mover)}
              />
            ))}
          </div>
        )}

        {/* Empty filter state */}
        {!isLoading && !error && filtered.length === 0 && movers.length > 0 && (
          <div className="glass-card p-12 text-center">
            <p className="text-text-secondary">
              No {filter} to show right now.
            </p>
          </div>
        )}
      </main>

      {/* ── Chart panel overlay ── */}
      {selectedTicker && (
        <ChartPanel
          ticker={selectedTicker.ticker}
          name={selectedTicker.name}
          onClose={() => setSelectedTicker(null)}
        />
      )}
    </div>
  );
}
