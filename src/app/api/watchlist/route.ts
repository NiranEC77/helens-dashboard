import { NextResponse } from "next/server";
import YahooFinance from "yahoo-finance2";

interface SparkPoint {
    v: number;
    session: "pre" | "regular" | "post";
}

interface WatchlistItem {
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
    intradaySparkline: SparkPoint[];
}

function safeNum(val: unknown): number | null {
    if (val === undefined || val === null) return null;
    const n = Number(val);
    return isNaN(n) ? null : Math.round(n * 100) / 100;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getYF(): any {
    return new (YahooFinance as unknown as new (opts?: Record<string, unknown>) => Record<string, unknown>)({
        suppressNotices: ["yahooSurvey", "ripHistorical"],
    });
}

/** Determine session type from timestamp and trading period boundaries */
function getSession(
    timestampSec: number,
    pre: { start: number; end: number } | null,
    regular: { start: number; end: number } | null,
    post: { start: number; end: number } | null,
): "pre" | "regular" | "post" {
    if (pre && timestampSec >= pre.start && timestampSec < pre.end) return "pre";
    if (post && timestampSec >= post.start && timestampSec <= post.end) return "post";
    return "regular";
}

/** Extract unix timestamps from Yahoo Finance trading period objects */
function extractPeriod(period: any): { start: number; end: number } | null {
    if (!period) return null;
    const start = period.start instanceof Date ? Math.floor(period.start.getTime() / 1000)
        : typeof period.start === "number" ? period.start : null;
    const end = period.end instanceof Date ? Math.floor(period.end.getTime() / 1000)
        : typeof period.end === "number" ? period.end : null;
    if (start === null || end === null) return null;
    return { start, end };
}

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const tickersParam = searchParams.get("tickers");

    if (!tickersParam) {
        return NextResponse.json(
            { error: "Missing 'tickers' query parameter" },
            { status: 400 }
        );
    }

    const tickers = tickersParam
        .split(",")
        .map((t) => t.trim().toUpperCase())
        .filter((t) => t.length > 0);

    if (tickers.length === 0) {
        return NextResponse.json({ stocks: [], timestamp: new Date().toISOString() });
    }

    // Cap at 50 tickers to prevent abuse
    const cappedTickers = tickers.slice(0, 50);
    const stocks: WatchlistItem[] = [];

    const yf = getYF();

    try {
        const quotes = await yf.quote(cappedTickers);
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

                // Daily sparkline (5-day)
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
                    // sparkline optional
                }

                // Intraday sparkline with session info (today, 15m intervals for compact view)
                let intradaySparkline: SparkPoint[] = [];
                try {
                    const now = new Date();
                    const todayMidnight = new Date(now);
                    todayMidnight.setHours(0, 0, 0, 0);
                    const intradayData = await yf.chart(symbol, {
                        period1: todayMidnight,
                        period2: now,
                        interval: "15m",
                        includePrePost: true,
                    });

                    // Extract session boundaries
                    const meta = intradayData.meta || {};
                    const ctp = meta.currentTradingPeriod || {};
                    const prePeriod = extractPeriod(ctp.pre);
                    const regularPeriod = extractPeriod(ctp.regular);
                    const postPeriod = extractPeriod(ctp.post);

                    intradaySparkline = (intradayData.quotes || [])
                        .map((h: Record<string, unknown>) => {
                            const close = safeNum(h.close);
                            if (close === null) return null;
                            const date = h.date instanceof Date ? h.date : new Date(h.date as string);
                            const ts = Math.floor(date.getTime() / 1000);
                            const session = getSession(ts, prePeriod, regularPeriod, postPeriod);
                            return { v: close, session };
                        })
                        .filter((v: SparkPoint | null): v is SparkPoint => v !== null);
                } catch {
                    // intraday sparkline optional
                }

                stocks.push({
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
                    intradaySparkline,
                });
            } catch {
                continue;
            }
        }
    } catch (err) {
        console.error("Watchlist fetch failed:", err);
        return NextResponse.json(
            { error: "Failed to fetch stock data" },
            { status: 500 }
        );
    }

    // Preserve the user's original ordering
    const orderedStocks = cappedTickers
        .map((t) => stocks.find((s) => s.ticker === t))
        .filter((s): s is WatchlistItem => s !== undefined);

    return NextResponse.json({
        stocks: orderedStocks,
        timestamp: new Date().toISOString(),
    });
}
