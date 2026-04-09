"use client";

import { useState, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchMovers, fetchWatchlist, type Mover } from "@/lib/api";
import { useWatchlist } from "@/lib/useWatchlist";
import { usePersistedState } from "@/lib/usePersistedState";
import { useAuth } from "@/providers/AuthProvider";
import StockCard from "@/components/StockCard";
import StockListView from "@/components/StockListView";
import ChartPanel from "@/components/ChartPanel";
import PortfolioSection from "@/components/PortfolioSection";

type ViewMode = "movers" | "watchlist";

export default function Dashboard() {
  const { user, loading: authLoading, signInWithGoogle, signOut } = useAuth();
  const [selectedTicker, setSelectedTicker] = useState<Mover | null>(null);
  const [filter, setFilter] = usePersistedState<"all" | "gainers" | "losers">("ag-dashboard-filter", "all", ["all", "gainers", "losers"]);
  const [view, setView] = usePersistedState<ViewMode>("ag-dashboard-view", "movers", ["movers", "watchlist"]);
  const [tickerInput, setTickerInput] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);
  const [refreshInterval, setRefreshInterval] = useState(5000); // Default 5s
  const [layout, setLayout] = usePersistedState<"cards" | "list">("ag-dashboard-layout", "cards", ["cards", "list"]);
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

          {/* Layout toggle */}
          <div className="flex items-center bg-white/5 rounded-xl p-1 text-xs font-semibold">
            <button
              onClick={() => setLayout("cards")}
              className={`px-2.5 py-1.5 rounded-lg transition-all ${layout === "cards"
                ? "bg-white/10 text-white"
                : "text-text-muted hover:text-text-secondary"
                }`}
              title="Card view"
            >
              ▦
            </button>
            <button
              onClick={() => setLayout("list")}
              className={`px-2.5 py-1.5 rounded-lg transition-all ${layout === "list"
                ? "bg-white/10 text-white"
                : "text-text-muted hover:text-text-secondary"
                }`}
              title="List view"
            >
              ☰
            </button>
          </div>

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

          {/* Auth button */}
          {!authLoading && (
            user ? (
              <button
                onClick={signOut}
                className="flex items-center gap-2 bg-white/5 hover:bg-white/10 rounded-xl px-3 py-1.5 text-xs font-semibold text-text-secondary hover:text-white transition-all"
                title={`Signed in as ${user.displayName || user.email}`}
              >
                {user.photoURL ? (
                  <img
                    src={user.photoURL}
                    alt=""
                    className="w-5 h-5 rounded-full"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <span className="w-5 h-5 rounded-full bg-gradient-to-br from-neon-teal to-electric-purple flex items-center justify-center text-[10px] text-white font-bold">
                    {(user.displayName || user.email || "?")[0].toUpperCase()}
                  </span>
                )}
                <span className="hidden sm:inline">{user.displayName?.split(" ")[0] || "Account"}</span>
              </button>
            ) : (
              <button
                onClick={signInWithGoogle}
                className="flex items-center gap-2 bg-white/5 hover:bg-white/10 rounded-xl px-3 py-1.5 text-xs font-semibold text-text-secondary hover:text-white transition-all border border-white/10"
              >
                <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
                <span className="hidden sm:inline">Sign in</span>
              </button>
            )
          )}
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

        {/* Stock display */}
        {!isLoading && !error && filtered.length > 0 && (
          layout === "list" ? (
            <StockListView
              stocks={filtered}
              onSelect={(mover) => setSelectedTicker(mover)}
            />
          ) : (
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
          )
        )}

        {/* Empty filter state */}
        {!isLoading && !error && filtered.length === 0 && stocks.length > 0 && (
          <div className="glass-card p-12 text-center">
            <p className="text-text-secondary">
              No {filter} to show right now.
            </p>
          </div>
        )}

        {/* ── Portfolio holdings tracker ── */}
        <PortfolioSection />
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
