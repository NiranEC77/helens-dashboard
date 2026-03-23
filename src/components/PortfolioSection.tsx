"use client";

import { useState, useRef, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { usePortfolio, type PortfolioItem } from "@/lib/usePortfolio";
import { fetchPortfolioQuotes, formatPrice, type PortfolioQuote } from "@/lib/api";

/* ───────── Add / Edit Form ───────── */
function PortfolioForm({
    initial,
    onSubmit,
    onCancel,
}: {
    initial?: PortfolioItem;
    onSubmit: (name: string, ticker: string, shares: number) => void;
    onCancel: () => void;
}) {
    const [name, setName] = useState(initial?.name ?? "");
    const [ticker, setTicker] = useState(initial?.ticker ?? "");
    const [shares, setShares] = useState(initial?.shares?.toString() ?? "");
    const nameRef = useRef<HTMLInputElement>(null);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const n = name.trim();
        const t = ticker.trim().toUpperCase();
        const s = parseFloat(shares);
        if (!n || !t || isNaN(s) || s <= 0) return;
        onSubmit(n, t, s);
    };

    return (
        <form onSubmit={handleSubmit} className="portfolio-form animate-fade-in-up" style={{ animationDuration: "0.25s" }}>
            <div className="portfolio-form-fields">
                <div className="portfolio-form-field">
                    <label className="portfolio-form-label">Name</label>
                    <input
                        ref={nameRef}
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="My AAPL shares"
                        className="portfolio-form-input"
                        autoFocus
                        autoComplete="off"
                    />
                </div>
                <div className="portfolio-form-field">
                    <label className="portfolio-form-label">Ticker</label>
                    <input
                        type="text"
                        value={ticker}
                        onChange={(e) => setTicker(e.target.value.toUpperCase())}
                        placeholder="AAPL"
                        className="portfolio-form-input portfolio-form-input--ticker"
                        autoComplete="off"
                        spellCheck={false}
                    />
                </div>
                <div className="portfolio-form-field">
                    <label className="portfolio-form-label">Shares</label>
                    <input
                        type="number"
                        value={shares}
                        onChange={(e) => setShares(e.target.value)}
                        placeholder="10"
                        className="portfolio-form-input portfolio-form-input--shares"
                        min="0"
                        step="any"
                    />
                </div>
            </div>
            <div className="portfolio-form-actions">
                <button type="submit" className="portfolio-form-submit">
                    {initial ? "Save" : "Add Holding"}
                </button>
                <button type="button" onClick={onCancel} className="portfolio-form-cancel">
                    Cancel
                </button>
            </div>
        </form>
    );
}

/* ───────── Single Holding Card ───────── */
function HoldingCard({
    item,
    quote,
    onEdit,
    onRemove,
}: {
    item: PortfolioItem;
    quote: PortfolioQuote | undefined;
    onEdit: () => void;
    onRemove: () => void;
}) {
    const price = quote?.price ?? null;
    const prevClose = quote?.prevClose ?? null;
    const changePct = quote?.changePct ?? null;
    const totalValue = price !== null ? price * item.shares : null;
    const prevValue = prevClose !== null ? prevClose * item.shares : null;
    const dayChange = totalValue !== null && prevValue !== null ? totalValue - prevValue : null;
    const isUp = changePct !== null ? changePct >= 0 : null;

    return (
        <div className="portfolio-card glass-card group">
            {/* Top row: name + ticker */}
            <div className="portfolio-card-header">
                <div className="portfolio-card-title-row">
                    <span className="portfolio-card-name">{item.name}</span>
                    <span className="portfolio-card-ticker">{item.ticker}</span>
                </div>
                <div className="portfolio-card-actions">
                    <button onClick={onEdit} className="portfolio-card-btn" title="Edit">
                        ✏️
                    </button>
                    <button onClick={onRemove} className="portfolio-card-btn portfolio-card-btn--delete" title="Remove">
                        ✕
                    </button>
                </div>
            </div>

            {/* Price per share */}
            <div className="portfolio-card-price-row">
                <span className="portfolio-card-price-label">Price</span>
                <span className="portfolio-card-price-value">
                    {price !== null ? formatPrice(price) : "—"}
                </span>
            </div>

            {/* Shares count */}
            <div className="portfolio-card-shares">
                {item.shares.toLocaleString(undefined, { maximumFractionDigits: 4 })} shares
            </div>

            {/* Total value */}
            <div className="portfolio-card-total">
                <span className="portfolio-card-total-label">Total Value</span>
                <span className="portfolio-card-total-value">
                    {totalValue !== null ? formatPrice(totalValue) : "—"}
                </span>
            </div>

            {/* Day change */}
            <div className={`portfolio-card-change ${isUp === null ? "" : isUp ? "portfolio-card-change--up" : "portfolio-card-change--down"}`}>
                {dayChange !== null && changePct !== null ? (
                    <>
                        <span className="portfolio-card-change-icon">{isUp ? "▲" : "▼"}</span>
                        <span className="portfolio-card-change-amount">
                            {isUp ? "+" : ""}{formatPrice(dayChange)}
                        </span>
                        <span className="portfolio-card-change-pct">
                            ({isUp ? "+" : ""}{changePct.toFixed(2)}%)
                        </span>
                    </>
                ) : (
                    <span className="portfolio-card-change-na">—</span>
                )}
            </div>
        </div>
    );
}

/* ───────── Portfolio Section ───────── */
export default function PortfolioSection() {
    const { items, loaded, addItem, removeItem, updateItem } = usePortfolio();
    const [showForm, setShowForm] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);

    // Gather unique tickers needed
    const tickers = useMemo(() => [...new Set(items.map((i) => i.ticker))], [items]);

    // Fetch live quotes for all portfolio tickers
    const { data: quotesData } = useQuery({
        queryKey: ["portfolio-quotes", tickers],
        queryFn: () => fetchPortfolioQuotes(tickers),
        refetchInterval: 15000, // every 15s
        enabled: loaded && tickers.length > 0,
    });

    const quotesMap = useMemo(() => {
        const map = new Map<string, PortfolioQuote>();
        if (quotesData?.quotes) {
            for (const q of quotesData.quotes) {
                map.set(q.ticker, q);
            }
        }
        return map;
    }, [quotesData]);

    // Grand totals
    const totals = useMemo(() => {
        let totalValue = 0;
        let totalPrevValue = 0;
        let valid = false;

        for (const item of items) {
            const q = quotesMap.get(item.ticker);
            if (q) {
                totalValue += q.price * item.shares;
                totalPrevValue += q.prevClose * item.shares;
                valid = true;
            }
        }

        const dayChange = totalValue - totalPrevValue;
        const dayChangePct = totalPrevValue > 0 ? (dayChange / totalPrevValue) * 100 : 0;
        return { totalValue, dayChange, dayChangePct, valid };
    }, [items, quotesMap]);

    const handleAdd = (name: string, ticker: string, shares: number) => {
        addItem(name, ticker, shares);
        setShowForm(false);
    };

    const handleEdit = (id: string, name: string, ticker: string, shares: number) => {
        updateItem(id, { name, ticker, shares });
        setEditingId(null);
    };

    const editingItem = editingId ? items.find((i) => i.id === editingId) : null;

    // Don't render anything if not loaded yet
    if (!loaded) return null;

    return (
        <section className="portfolio-section">
            {/* Section header */}
            <div className="portfolio-header">
                <div className="portfolio-header-left">
                    <div className="portfolio-header-icon">💼</div>
                    <div>
                        <h2 className="portfolio-header-title">My Holdings</h2>
                        {totals.valid && (
                            <div className="portfolio-header-summary">
                                <span className="portfolio-header-total-value">
                                    {formatPrice(totals.totalValue)}
                                </span>
                                <span className={`portfolio-header-change ${totals.dayChange >= 0 ? "portfolio-header-change--up" : "portfolio-header-change--down"}`}>
                                    {totals.dayChange >= 0 ? "▲" : "▼"}{" "}
                                    {totals.dayChange >= 0 ? "+" : ""}{formatPrice(totals.dayChange)}{" "}
                                    ({totals.dayChange >= 0 ? "+" : ""}{totals.dayChangePct.toFixed(2)}%) today
                                </span>
                            </div>
                        )}
                    </div>
                </div>
                {!showForm && !editingId && (
                    <button
                        onClick={() => setShowForm(true)}
                        className="add-ticker-btn"
                        id="add-holding-btn"
                    >
                        <span className="text-base leading-none">+</span>
                        Add Holding
                    </button>
                )}
            </div>

            {/* Add form */}
            {showForm && (
                <PortfolioForm
                    onSubmit={handleAdd}
                    onCancel={() => setShowForm(false)}
                />
            )}

            {/* Edit form */}
            {editingItem && (
                <PortfolioForm
                    initial={editingItem}
                    onSubmit={(name, ticker, shares) => handleEdit(editingItem.id, name, ticker, shares)}
                    onCancel={() => setEditingId(null)}
                />
            )}

            {/* Holdings grid */}
            {items.length > 0 ? (
                <div className="portfolio-grid">
                    {items.map((item) => (
                        <HoldingCard
                            key={item.id}
                            item={item}
                            quote={quotesMap.get(item.ticker)}
                            onEdit={() => setEditingId(item.id)}
                            onRemove={() => removeItem(item.id)}
                        />
                    ))}
                </div>
            ) : !showForm ? (
                <div className="portfolio-empty glass-card">
                    <div className="portfolio-empty-icon">📊</div>
                    <p className="portfolio-empty-title">No holdings yet</p>
                    <p className="portfolio-empty-desc">
                        Add stocks you own to track their total value and daily performance.
                    </p>
                    <button
                        onClick={() => setShowForm(true)}
                        className="add-ticker-btn inline-flex"
                    >
                        <span className="text-base leading-none">+</span>
                        Add your first holding
                    </button>
                </div>
            ) : null}
        </section>
    );
}
