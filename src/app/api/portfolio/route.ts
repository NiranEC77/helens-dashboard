import { NextResponse } from "next/server";
import YahooFinance from "yahoo-finance2";

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

export interface PortfolioQuote {
    ticker: string;
    name: string;
    price: number;
    prevClose: number;
    changePct: number;
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
        return NextResponse.json({ quotes: [], timestamp: new Date().toISOString() });
    }

    // Deduplicate — multiple portfolio items may track the same ticker
    const unique = [...new Set(tickers)];
    const quotes: PortfolioQuote[] = [];

    const yf = getYF();

    try {
        const raw = await yf.quote(unique);
        const arr = Array.isArray(raw) ? raw : [raw];

        for (const q of arr) {
            const price = safeNum(q.regularMarketPrice);
            const prevClose = safeNum(q.regularMarketPreviousClose);

            if (!price || !prevClose || prevClose === 0) continue;

            const changePct = Math.round(((price - prevClose) / prevClose) * 10000) / 100;

            quotes.push({
                ticker: q.symbol,
                name: q.shortName || q.longName || q.symbol,
                price,
                prevClose,
                changePct,
            });
        }
    } catch (err) {
        console.error("Portfolio quote fetch failed:", err);
        return NextResponse.json(
            { error: "Failed to fetch portfolio data" },
            { status: 500 }
        );
    }

    return NextResponse.json({
        quotes,
        timestamp: new Date().toISOString(),
    });
}
