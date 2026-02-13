import { NextResponse } from "next/server";
import YahooFinance from "yahoo-finance2";

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

                // Sparkline
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
