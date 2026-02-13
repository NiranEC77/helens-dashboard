"use client";

import { useState, useEffect, useCallback } from "react";

const STORAGE_KEY = "ag-watchlist";

const DEFAULT_WATCHLIST = [
    "VOO", "QQQ", "SPY", "AAPL", "MSFT", "GOOGL", "AMZN", "NVDA",
];

export function useWatchlist() {
    const [tickers, setTickers] = useState<string[]>([]);
    const [loaded, setLoaded] = useState(false);

    // Load from localStorage on mount
    useEffect(() => {
        try {
            const stored = localStorage.getItem(STORAGE_KEY);
            if (stored) {
                const parsed = JSON.parse(stored);
                if (Array.isArray(parsed) && parsed.length > 0) {
                    setTickers(parsed);
                } else {
                    setTickers(DEFAULT_WATCHLIST);
                }
            } else {
                setTickers(DEFAULT_WATCHLIST);
            }
        } catch {
            setTickers(DEFAULT_WATCHLIST);
        }
        setLoaded(true);
    }, []);

    // Persist to localStorage on change (skip initial load)
    useEffect(() => {
        if (loaded) {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(tickers));
        }
    }, [tickers, loaded]);

    const addTicker = useCallback((ticker: string) => {
        const upper = ticker.trim().toUpperCase();
        if (!upper) return false;
        setTickers((prev) => {
            if (prev.includes(upper)) return prev;
            return [...prev, upper];
        });
        return true;
    }, []);

    const removeTicker = useCallback((ticker: string) => {
        const upper = ticker.trim().toUpperCase();
        setTickers((prev) => prev.filter((t) => t !== upper));
    }, []);

    const reorderTickers = useCallback((newOrder: string[]) => {
        setTickers(newOrder);
    }, []);

    return {
        tickers,
        loaded,
        addTicker,
        removeTicker,
        reorderTickers,
    };
}
