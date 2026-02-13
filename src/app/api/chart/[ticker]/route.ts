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

export async function GET(
    _request: Request,
    { params }: { params: Promise<{ ticker: string }> }
) {
    const { ticker: rawTicker } = await params;
    const ticker = rawTicker.toUpperCase();

    try {
        const yf = getYF();
        const now = new Date();
        const oneDayAgo = new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000);

        // Try intraday 1-minute data
        let chartData = await yf.chart(ticker, {
            period1: oneDayAgo,
            period2: now,
            interval: "1m",
        });

        // Fallback to 2 days if no data
        if (!chartData.quotes || chartData.quotes.length === 0) {
            const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);
            chartData = await yf.chart(ticker, {
                period1: twoDaysAgo,
                period2: now,
                interval: "1m",
            });
        }

        if (!chartData.quotes || chartData.quotes.length === 0) {
            return NextResponse.json(
                { error: "No chart data available" },
                { status: 404 }
            );
        }

        const points = chartData.quotes.map((q: Record<string, unknown>) => {
            const date = q.date instanceof Date ? q.date : new Date(q.date as string);
            return {
                time: date.toLocaleTimeString("en-US", {
                    hour: "2-digit",
                    minute: "2-digit",
                    hour12: false,
                }),
                timestamp: Math.floor(date.getTime() / 1000),
                open: safeNum(q.open),
                high: safeNum(q.high),
                low: safeNum(q.low),
                close: safeNum(q.close),
                volume: safeNum(q.volume),
            };
        });

        // Get name from quote
        let name = ticker;
        try {
            const quote = await yf.quote(ticker);
            name = quote.shortName || quote.longName || ticker;
        } catch {
            // name fallback is fine
        }

        return NextResponse.json({ ticker, name, points });
    } catch (err) {
        console.error("Chart error:", err);
        return NextResponse.json(
            { error: String(err) },
            { status: 500 }
        );
    }
}
