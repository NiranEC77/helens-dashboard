"use client";

import { useState, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchMovers, fetchWatchlist, type Mover } from "@/lib/api";
import { useWatchlist } from "@/lib/useWatchlist";
import StockCard from "@/components/StockCard";
import ChartPanel from "@/components/ChartPanel";

type ViewMode = "movers" | "watchlist";

export default function Dashboard() {
  const [selectedTicker, setSelectedTicker] = useState<Mover | null>(null);
  const [filter, setFilter] = useState<"all" | "gainers" | "losers">("all");
  const [view, setView] = useState<ViewMode>("movers");
  const [tickerInput, setTickerInput] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);
  const [refreshInterval, setRefreshInterval] = useState(5000); // Default 5s
  const inputRef = useRef<HTMLInputElement>(null);

  const { tickers: watchlistTickers, loaded: watchlistLoaded, addTicker, removeTicker, moveTicker } = useWatchlist();

  // ── Movers query ──
  const {
    data: moversData,
    isLoading: moversLoading,
    error: moversError,
    dataUpdatedAt: moversUpdatedAt,
  } = useQuery({
    queryKey: ["movers"],
    queryFn: fetchMovers,
    refetchInterval: refreshInterval,
    enabled: view === "movers",
  });

  // ── Watchlist query ──
  const {
    data: watchlistData,
    isLoading: watchlistLoading,
    error: watchlistError,
    dataUpdatedAt: watchlistUpdatedAt,
  } = useQuery({
    queryKey: ["watchlist", watchlistTickers],
    queryFn: () => fetchWatchlist(watchlistTickers),
    refetchInterval: refreshInterval,
    enabled: view === "watchlist" && watchlistLoaded && watchlistTickers.length > 0,
  });

  // Derive active data based on view
  const isMoversView = view === "movers";
  const stocks = isMoversView
    ? (moversData?.movers ?? [])
    : (watchlistData?.stocks ?? []);
  const source = isMoversView ? (moversData?.source ?? "live") : "live";
  const isLoading = isMoversView ? moversLoading : (watchlistLoading && watchlistTickers.length > 0);
  const error = isMoversView ? moversError : watchlistError;
  const dataUpdatedAt = isMoversView ? moversUpdatedAt : watchlistUpdatedAt;

  const filtered =
    filter === "all"
      ? stocks
      : filter === "gainers"
        ? stocks.filter((m) => m.gapPct > 0)
        : stocks.filter((m) => m.gapPct < 0);

  const lastUpdated = dataUpdatedAt
    ? new Date(dataUpdatedAt).toLocaleTimeString()
    : null;

  const handleAddTicker = (e?: React.FormEvent) => {
    e?.preventDefault();
    const val = tickerInput.trim().toUpperCase();
    if (!val) return;

    // Support comma-separated input: "AAPL, MSFT, VOO"
    const newTickers = val.split(",").map((t) => t.trim()).filter((t) => t.length > 0);
    newTickers.forEach(addTicker);
    setTickerInput("");
    inputRef.current?.focus();
  };

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

        <div className="flex items-center gap-3">
          {/* View toggle */}
          <div className="flex items-center bg-white/5 rounded-xl p-1 text-xs font-semibold">
            <button
              onClick={() => setView("movers")}
              className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${view === "movers"
                ? "bg-gradient-to-r from-neon-teal/20 to-electric-purple/20 text-white border border-white/10"
                : "text-text-muted hover:text-text-secondary"
                }`}
            >
              <span className="text-sm">🔥</span>
              <span className="hidden sm:inline">Movers</span>
            </button>
            <button
              onClick={() => setView("watchlist")}
              className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${view === "watchlist"
                ? "bg-gradient-to-r from-electric-purple/20 to-accent-pink/20 text-white border border-white/10"
                : "text-text-muted hover:text-text-secondary"
                }`}
            >
              <span className="text-sm">⭐</span>
              <span className="hidden sm:inline">Watchlist</span>
              {watchlistTickers.length > 0 && (
                <span className="bg-white/10 text-text-secondary text-[10px] px-1.5 py-0.5 rounded-full">
                  {watchlistTickers.length}
                </span>
              )}
            </button>
          </div>

          {/* Filter tabs (movers only) */}
          {isMoversView && (
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
          )}

          {/* Refresh rate toggle */}
          <div className="hidden md:flex items-center gap-1 bg-white/5 rounded-lg p-1 text-[10px] font-semibold">
            <span className="px-2 text-text-muted">Refresh:</span>
            {[1000, 2000, 5000].map((ms) => (
              <button
                key={ms}
                onClick={() => setRefreshInterval(ms)}
                className={`px-2 py-1 rounded transition-all ${refreshInterval === ms
                  ? "bg-white/10 text-white"
                  : "text-text-muted hover:text-text-secondary"
                  }`}
              >
                {ms / 1000}s
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

        {/* ── Watchlist toolbar ── */}
        {!isMoversView && (
          <div className="mb-6 flex flex-wrap items-center gap-3">
            {/* Add ticker button / input */}
            {!showAddForm ? (
              <button
                onClick={() => {
                  setShowAddForm(true);
                  setTimeout(() => inputRef.current?.focus(), 50);
                }}
                className="add-ticker-btn"
                id="add-ticker-btn"
              >
                <span className="text-base leading-none">+</span>
                Add Stock
              </button>
            ) : (
              <form
                onSubmit={handleAddTicker}
                className="flex items-center gap-2 animate-fade-in-up"
                style={{ animationDuration: "0.2s" }}
              >
                <input
                  ref={inputRef}
                  type="text"
                  value={tickerInput}
                  onChange={(e) => setTickerInput(e.target.value.toUpperCase())}
                  placeholder="AAPL, VOO, BTC-USD…"
                  className="ticker-input"
                  id="ticker-input"
                  autoComplete="off"
                  spellCheck={false}
                />
                <button type="submit" className="add-ticker-submit" id="add-ticker-submit">
                  Add
                </button>
                <button
                  type="button"
                  onClick={() => { setShowAddForm(false); setTickerInput(""); }}
                  className="text-text-muted hover:text-text-secondary transition-colors text-sm px-2 py-1.5"
                >
                  ✕
                </button>
              </form>
            )}

            {/* Ticker chips */}
            <div className="flex flex-wrap gap-2">
              {watchlistTickers.map((t, idx) => (
                <span
                  key={t}
                  className="ticker-chip group pl-2 pr-1"
                >
                  <span className="text-xs font-semibold mr-1">{t}</span>
                  <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => moveTicker(t, -1)}
                      disabled={idx === 0}
                      className="w-4 h-4 flex items-center justify-center text-[10px] text-text-muted hover:text-white disabled:opacity-30 disabled:hover:text-text-muted"
                    >
                      ←
                    </button>
                    <button
                      onClick={() => moveTicker(t, 1)}
                      disabled={idx === watchlistTickers.length - 1}
                      className="w-4 h-4 flex items-center justify-center text-[10px] text-text-muted hover:text-white disabled:opacity-30 disabled:hover:text-text-muted"
                    >
                      →
                    </button>
                    <div className="w-px h-3 bg-white/10 mx-1" />
                    <button
                      onClick={() => removeTicker(t)}
                      className="w-4 h-4 flex items-center justify-center text-[10px] text-text-muted hover:text-danger"
                      aria-label={`Remove ${t}`}
                    >
                      ✕
                    </button>
                  </div>
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Summary bar */}
        {stocks.length > 0 && (
          <div className="flex items-center gap-4 mb-6 text-xs text-text-muted flex-wrap">
            {isMoversView && source !== "live" && (
              <span className="glass-card px-3 py-1.5 !rounded-lg hover:!transform-none border !border-electric-orange/30">
                🕐 <strong className="text-electric-orange">
                  {source === "previous_close" ? "LAST SESSION" : "CACHED"}
                </strong> — {source === "previous_close"
                  ? "Showing previous trading day (markets closed)"
                  : "Showing last fetched data (yfinance unavailable)"}
              </span>
            )}
            <span className="glass-card px-3 py-1.5 !rounded-lg hover:!transform-none">
              📊 Tracking <strong className="text-white">{stocks.length}</strong> stocks
            </span>
            <span className="glass-card px-3 py-1.5 !rounded-lg hover:!transform-none">
              🟢 Gainers:{" "}
              <strong className="text-neon-teal">
                {stocks.filter((m) => m.gapPct > 0).length}
              </strong>
            </span>
            <span className="glass-card px-3 py-1.5 !rounded-lg hover:!transform-none">
              🔻 Losers:{" "}
              <strong className="text-electric-orange">
                {stocks.filter((m) => m.gapPct < 0).length}
              </strong>
            </span>
          </div>
        )}

        {/* Loading state */}
        {isLoading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {Array.from({ length: isMoversView ? 12 : watchlistTickers.length || 8 }).map((_, i) => (
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
              {isMoversView
                ? "Could not load top movers. Try refreshing."
                : "Could not load watchlist data. Check your tickers and try again."}
            </p>
          </div>
        )}

        {/* Watchlist empty state */}
        {!isMoversView && !isLoading && !error && watchlistTickers.length === 0 && (
          <div className="glass-card p-16 text-center">
            <div className="text-5xl mb-4">⭐</div>
            <p className="text-white text-lg font-bold mb-2">
              Your watchlist is empty
            </p>
            <p className="text-text-secondary text-sm mb-6">
              Add stocks and ETFs you care about to track them here.
            </p>
            <button
              onClick={() => {
                setShowAddForm(true);
                setTimeout(() => inputRef.current?.focus(), 50);
              }}
              className="add-ticker-btn inline-flex"
            >
              <span className="text-base leading-none">+</span>
              Add your first stock
            </button>
          </div>
        )}

        {/* Cards grid */}
        {!isLoading && !error && filtered.length > 0 && (
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
        {!isLoading && !error && filtered.length === 0 && stocks.length > 0 && (
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
