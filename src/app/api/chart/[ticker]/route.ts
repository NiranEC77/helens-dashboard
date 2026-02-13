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
        const url = new URL(_request.url);
        const range = url.searchParams.get("range") || "1d"; // "1d", "5d", "1mo"

        const yf = getYF();
        const now = new Date();

        let queryOptions: any = { period2: now };

        // Map range to yf params
        switch (range) {
            case "1d":
                queryOptions.period1 = new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000); // 24h
                queryOptions.interval = "1m"; // High res
                break;
            case "5d":
                queryOptions.period1 = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000);
                queryOptions.interval = "15m"; // 15m for 5d
                break;
            case "1mo":
                queryOptions.period1 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
                queryOptions.interval = "1h"; // Hourly for 1mo
                break;
            default: // Default to 1d
                queryOptions.period1 = new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000);
                queryOptions.interval = "1m";
        }

        let chartData = await yf.chart(ticker, queryOptions);

        // Fallback for 1d if empty (e.g. weekend/closed) -> try 2d
        if (range === "1d" && (!chartData.quotes || chartData.quotes.length === 0)) {
            queryOptions.period1 = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000); // 48h
            chartData = await yf.chart(ticker, queryOptions);
        }

        if (!chartData.quotes || chartData.quotes.length === 0) {
            return NextResponse.json(
                { error: "No chart data available" },
                { status: 404 }
            );
        }

        const points = chartData.quotes.map((q: Record<string, unknown>) => {
            const date = q.date instanceof Date ? q.date : new Date(q.date as string);

            let timeStr;
            if (range === "1d") {
                timeStr = date.toLocaleTimeString("en-US", {
                    hour: "2-digit",
                    minute: "2-digit",
                    hour12: false,
                });
            } else {
                // For longer ranges, include date
                timeStr = date.toLocaleDateString("en-US", {
                    month: "numeric",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                    hour12: false,
                });
            }

            return {
                time: timeStr,
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
