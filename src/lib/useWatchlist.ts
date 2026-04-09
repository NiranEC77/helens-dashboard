"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { doc, setDoc, onSnapshot } from "firebase/firestore";
import { getFirebaseDb } from "@/lib/firebase";
import { useAuth } from "@/providers/AuthProvider";

const STORAGE_KEY = "ag-watchlist";

const DEFAULT_WATCHLIST = [
    "VOO", "QQQ", "SPY", "AAPL", "MSFT", "GOOGL", "AMZN", "NVDA",
];

function loadFromLocalStorage(): string[] | null {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
            const parsed = JSON.parse(stored);
            if (Array.isArray(parsed) && parsed.length > 0) {
                return parsed;
            }
        }
    } catch {
        // noop
    }
    return null;
}

function saveToLocalStorage(tickers: string[]) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(tickers));
    } catch {
        // noop
    }
}

export function useWatchlist() {
    const { user } = useAuth();
    const [tickers, setTickers] = useState<string[]>([]);
    const [loaded, setLoaded] = useState(false);
    const [syncing, setSyncing] = useState(false);
    const skipNextSync = useRef(false);

    // Load data: Firestore if signed in, otherwise localStorage
    useEffect(() => {
        if (user) {
            const fireDb = getFirebaseDb();
            if (!fireDb) { setTickers(loadFromLocalStorage() || DEFAULT_WATCHLIST); setLoaded(true); return; }
            const docRef = doc(fireDb, "users", user.uid, "data", "watchlist");
            const unsubscribe = onSnapshot(docRef, (snap) => {
                if (snap.exists()) {
                    const data = snap.data();
                    const firestoreTickers = data.tickers || [];
                    setTickers(firestoreTickers);
                    saveToLocalStorage(firestoreTickers);
                } else {
                    // First sign-in: seed Firestore with localStorage or default
                    const localTickers = loadFromLocalStorage() || DEFAULT_WATCHLIST;
                    setTickers(localTickers);
                    setDoc(docRef, { tickers: localTickers, updatedAt: new Date().toISOString() });
                }
                setLoaded(true);
            }, (err) => {
                console.error("Watchlist snapshot error:", err);
                setTickers(loadFromLocalStorage() || DEFAULT_WATCHLIST);
                setLoaded(true);
            });
            return unsubscribe;
        } else {
            const local = loadFromLocalStorage();
            setTickers(local || DEFAULT_WATCHLIST);
            setLoaded(true);
        }
    }, [user]);

    // Persist to Firestore + localStorage
    const persistTickers = useCallback(async (newTickers: string[]) => {
        saveToLocalStorage(newTickers);

        if (user) {
            setSyncing(true);
            try {
                const fireDb = getFirebaseDb();
                if (!fireDb) return;
                const docRef = doc(fireDb, "users", user.uid, "data", "watchlist");
                skipNextSync.current = true;
                await setDoc(docRef, {
                    tickers: newTickers,
                    updatedAt: new Date().toISOString(),
                });
            } catch (err) {
                console.error("Failed to sync watchlist:", err);
            } finally {
                setSyncing(false);
            }
        }
    }, [user]);

    const addTicker = useCallback((ticker: string) => {
        const upper = ticker.trim().toUpperCase();
        if (!upper) return false;
        setTickers((prev) => {
            if (prev.includes(upper)) return prev;
            const next = [...prev, upper];
            persistTickers(next);
            return next;
        });
        return true;
    }, [persistTickers]);

    const removeTicker = useCallback((ticker: string) => {
        const upper = ticker.trim().toUpperCase();
        setTickers((prev) => {
            const next = prev.filter((t) => t !== upper);
            persistTickers(next);
            return next;
        });
    }, [persistTickers]);

    const reorderTickers = useCallback((newOrder: string[]) => {
        setTickers(newOrder);
        persistTickers(newOrder);
    }, [persistTickers]);

    const moveTicker = useCallback((ticker: string, direction: -1 | 1) => {
        setTickers((prev) => {
            const index = prev.indexOf(ticker);
            if (index === -1) return prev;
            const newIndex = index + direction;
            if (newIndex < 0 || newIndex >= prev.length) return prev;

            const newArr = [...prev];
            [newArr[index], newArr[newIndex]] = [newArr[newIndex], newArr[index]];
            persistTickers(newArr);
            return newArr;
        });
    }, [persistTickers]);

    return {
        tickers,
        loaded,
        syncing,
        addTicker,
        removeTicker,
        reorderTickers,
        moveTicker,
    };
}
