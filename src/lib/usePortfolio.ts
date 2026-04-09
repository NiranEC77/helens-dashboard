"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { doc, setDoc, onSnapshot } from "firebase/firestore";
import { getFirebaseDb } from "@/lib/firebase";
import { useAuth } from "@/providers/AuthProvider";

const STORAGE_KEY = "ag-portfolio";

export type HoldingType = "stock" | "cash";

export interface PortfolioItem {
    id: string;
    name: string;
    ticker: string;
    shares: number;
    excludeFromTotals?: boolean;
    type: HoldingType;
    /** For cash items: the dollar amount (shares field used as dollar amount) */
}

function generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function migrateItem(item: PortfolioItem): PortfolioItem {
    // Add type field to old items that don't have it
    if (!item.type) {
        return { ...item, type: "stock" };
    }
    return item;
}

function loadFromLocalStorage(): PortfolioItem[] {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
            const parsed = JSON.parse(stored);
            if (Array.isArray(parsed)) {
                return parsed.map(migrateItem);
            }
        }
    } catch {
        // noop
    }
    return [];
}

function saveToLocalStorage(items: PortfolioItem[]) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch {
        // noop
    }
}

export function usePortfolio() {
    const { user } = useAuth();
    const [items, setItems] = useState<PortfolioItem[]>([]);
    const [loaded, setLoaded] = useState(false);
    const [syncing, setSyncing] = useState(false);
    const skipNextSync = useRef(false);

    // Load data: Firestore if signed in, otherwise localStorage
    useEffect(() => {
        if (user) {
            const fireDb = getFirebaseDb();
            if (!fireDb) { setItems(loadFromLocalStorage()); setLoaded(true); return; }
            // Subscribe to real-time Firestore updates
            const docRef = doc(fireDb, "users", user.uid, "data", "portfolio");
            const unsubscribe = onSnapshot(docRef, (snap) => {
                if (snap.exists()) {
                    const data = snap.data();
                    const firestoreItems = (data.items || []).map(migrateItem);
                    setItems(firestoreItems);
                    saveToLocalStorage(firestoreItems);
                } else {
                    // First sign-in: seed Firestore with localStorage data
                    const localItems = loadFromLocalStorage();
                    if (localItems.length > 0) {
                        setItems(localItems);
                        // Push local data to Firestore
                        setDoc(docRef, { items: localItems, updatedAt: new Date().toISOString() });
                    }
                }
                setLoaded(true);
            }, (err) => {
                console.error("Portfolio snapshot error:", err);
                // Fallback to localStorage
                setItems(loadFromLocalStorage());
                setLoaded(true);
            });
            return unsubscribe;
        } else {
            // Not signed in: use localStorage
            setItems(loadFromLocalStorage());
            setLoaded(true);
        }
    }, [user]);

    // Persist changes to Firestore + localStorage
    const persistItems = useCallback(async (newItems: PortfolioItem[]) => {
        saveToLocalStorage(newItems);

        if (user) {
            setSyncing(true);
            try {
                const fireDb = getFirebaseDb();
                if (!fireDb) return;
                const docRef = doc(fireDb, "users", user.uid, "data", "portfolio");
                skipNextSync.current = true;
                await setDoc(docRef, {
                    items: newItems,
                    updatedAt: new Date().toISOString(),
                });
            } catch (err) {
                console.error("Failed to sync portfolio:", err);
            } finally {
                setSyncing(false);
            }
        }
    }, [user]);

    const addItem = useCallback((name: string, ticker: string, shares: number, type: HoldingType = "stock") => {
        const item: PortfolioItem = {
            id: generateId(),
            name: name.trim(),
            ticker: type === "cash" ? "CASH" : ticker.trim().toUpperCase(),
            shares,
            excludeFromTotals: false,
            type,
        };
        setItems((prev) => {
            const next = [...prev, item];
            persistItems(next);
            return next;
        });
        return item;
    }, [persistItems]);

    const removeItem = useCallback((id: string) => {
        setItems((prev) => {
            const next = prev.filter((item) => item.id !== id);
            persistItems(next);
            return next;
        });
    }, [persistItems]);

    const updateItem = useCallback((id: string, updates: Partial<Omit<PortfolioItem, "id">>) => {
        setItems((prev) => {
            const next = prev.map((item) =>
                item.id === id
                    ? {
                        ...item,
                        ...(updates.name !== undefined ? { name: updates.name.trim() } : {}),
                        ...(updates.ticker !== undefined ? { ticker: updates.ticker.trim().toUpperCase() } : {}),
                        ...(updates.shares !== undefined ? { shares: updates.shares } : {}),
                        ...(updates.excludeFromTotals !== undefined ? { excludeFromTotals: updates.excludeFromTotals } : {}),
                        ...(updates.type !== undefined ? { type: updates.type } : {}),
                    }
                    : item
            );
            persistItems(next);
            return next;
        });
    }, [persistItems]);

    return { items, loaded, syncing, addItem, removeItem, updateItem };
}
