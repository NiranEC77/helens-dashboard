"use client";

import { useState, useEffect, useCallback } from "react";

const STORAGE_KEY = "ag-portfolio";

export interface PortfolioItem {
    id: string;
    name: string;
    ticker: string;
    shares: number;
    excludeFromTotals?: boolean;
}

function generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

export function usePortfolio() {
    const [items, setItems] = useState<PortfolioItem[]>([]);
    const [loaded, setLoaded] = useState(false);

    // Load from localStorage on mount
    useEffect(() => {
        try {
            const stored = localStorage.getItem(STORAGE_KEY);
            if (stored) {
                const parsed = JSON.parse(stored);
                if (Array.isArray(parsed)) {
                    setItems(parsed);
                }
            }
        } catch {
            // noop
        }
        setLoaded(true);
    }, []);

    // Persist on change
    useEffect(() => {
        if (loaded) {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
        }
    }, [items, loaded]);

    const addItem = useCallback((name: string, ticker: string, shares: number) => {
        const item: PortfolioItem = {
            id: generateId(),
            name: name.trim(),
            ticker: ticker.trim().toUpperCase(),
            shares,
            excludeFromTotals: false,
        };
        setItems((prev) => [...prev, item]);
        return item;
    }, []);

    const removeItem = useCallback((id: string) => {
        setItems((prev) => prev.filter((item) => item.id !== id));
    }, []);

    const updateItem = useCallback((id: string, updates: Partial<Omit<PortfolioItem, "id">>) => {
        setItems((prev) =>
            prev.map((item) =>
                item.id === id
                    ? {
                        ...item,
                        ...(updates.name !== undefined ? { name: updates.name.trim() } : {}),
                        ...(updates.ticker !== undefined ? { ticker: updates.ticker.trim().toUpperCase() } : {}),
                        ...(updates.shares !== undefined ? { shares: updates.shares } : {}),
                        ...(updates.excludeFromTotals !== undefined ? { excludeFromTotals: updates.excludeFromTotals } : {}),
                    }
                    : item
            )
        );
    }, []);

    return { items, loaded, addItem, removeItem, updateItem };
}
