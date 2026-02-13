import { NextResponse } from "next/server";
import YahooFinance from "yahoo-finance2";

// Well-known volatile / popular tickers to scan
const WATCHLIST = [
    "AAPL", "MSFT", "GOOGL", "AMZN", "NVDA", "META", "TSLA", "AMD",
    "NFLX", "INTC", "BA", "DIS", "PLTR", "SOFI", "RIVN", "LCID",
    "NIO", "COIN", "MARA", "RIOT", "SQ", "SNAP", "UBER", "PYPL",
    "ROKU", "SHOP", "CRWD", "SNOW", "DKNG", "ABNB",
];

interface Mover {
    ticker: string;
    name: string;
    price: number;
    prevClose: number;
    gapPct: number;
    volume: number | null;
    avgVolume: number | null;
    volumeRatio: number | null;
    marketCap: number | null;
    sparkline: number[];
}

function safeNum(val: unknown): number | null {
    if (val === undefined || val === null) return null;
    const n = Number(val);
    return isNaN(n) ? null : Math.round(n * 100) / 100;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getYF(): any {
    // yahoo-finance2 v3 requires instantiation
    return new (YahooFinance as unknown as new (opts?: Record<string, unknown>) => Record<string, unknown>)({
        suppressNotices: ["yahooSurvey", "ripHistorical"],
    });
}

export async function GET() {
    const movers: Mover[] = [];
    let source: "live" | "previous_close" = "live";

    const yf = getYF();

    // ── Attempt 1: live quote data ──
    try {
        const quotes = await yf.quote(WATCHLIST);
        const quoteArr = Array.isArray(quotes) ? quotes : [quotes];

        for (const q of quoteArr) {
            try {
                const symbol = q.symbol;
                const current = safeNum(q.regularMarketPrice);
                const prevClose = safeNum(q.regularMarketPreviousClose);

                if (!current || !prevClose || prevClose === 0) continue;

                const gapPct = Math.round(((current - prevClose) / prevClose) * 10000) / 100;
                const dayVolume = safeNum(q.regularMarketVolume);
                const avgVolume = safeNum(q.averageDailyVolume3Month);
                const marketCap = safeNum(q.marketCap);

                let volumeRatio: number | null = null;
                if (dayVolume && avgVolume && avgVolume > 0) {
                    volumeRatio = Math.round((dayVolume / avgVolume) * 100) / 100;
                }

                // Sparkline from 5-day daily chart
                let sparkline: number[] = [];
                try {
                    const now = new Date();
                    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                    const chartData = await yf.chart(symbol, {
                        period1: weekAgo,
                        period2: now,
                        interval: "1d",
                    });
                    sparkline = (chartData.quotes || [])
                        .map((h: Record<string, unknown>) => safeNum(h.close))
                        .filter((v: number | null): v is number => v !== null);
                } catch {
                    // sparkline is optional
                }

                movers.push({
                    ticker: symbol,
                    name: q.shortName || q.longName || symbol,
                    price: current,
                    prevClose,
                    gapPct,
                    volume: dayVolume,
                    avgVolume,
                    volumeRatio,
                    marketCap,
                    sparkline,
                });
            } catch {
                continue;
            }
        }
    } catch (err) {
        console.error("Quote fetch failed:", err);
    }

    // ── Attempt 2: chart-based fallback ──
    if (movers.length === 0) {
        source = "previous_close";
        const now = new Date();
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

        for (const symbol of WATCHLIST) {
            try {
                const chartData = await yf.chart(symbol, {
                    period1: weekAgo,
                    period2: now,
                    interval: "1d",
                });
                const quotes = chartData.quotes || [];

                if (quotes.length < 2) continue;

                const closes = quotes
                    .map((h: Record<string, unknown>) => safeNum(h.close))
                    .filter((v: number | null): v is number => v !== null);
                if (closes.length < 2) continue;

                const current = closes[closes.length - 1];
                const prevClose = closes[closes.length - 2];
                if (prevClose === 0) continue;

                const gapPct = Math.round(((current - prevClose) / prevClose) * 10000) / 100;
                const dayVolume = safeNum(quotes[quotes.length - 1].volume);

                movers.push({
                    ticker: symbol,
                    name: symbol,
                    price: current,
                    prevClose,
                    gapPct,
                    volume: dayVolume,
                    avgVolume: null,
                    volumeRatio: null,
                    marketCap: null,
                    sparkline: closes,
                });
            } catch {
                continue;
            }
        }
    }

    // Sort by absolute gap — biggest movers first
    movers.sort((a, b) => Math.abs(b.gapPct) - Math.abs(a.gapPct));

    return NextResponse.json({
        movers,
        source,
        timestamp: new Date().toISOString(),
    });
}
