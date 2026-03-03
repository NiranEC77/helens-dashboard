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

/** Determine session type from timestamp and trading period boundaries */
function getSession(
    timestampSec: number,
    pre: { start: number; end: number } | null,
    regular: { start: number; end: number } | null,
    post: { start: number; end: number } | null,
): "pre" | "regular" | "post" {
    if (pre && timestampSec >= pre.start && timestampSec < pre.end) return "pre";
    if (post && timestampSec >= post.start && timestampSec <= post.end) return "post";
    // Default to regular
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

        let queryOptions: any = { period2: now, includePrePost: true };

        // Start of today (midnight local) so pre-market is at the beginning of the graph
        const todayMidnight = new Date(now);
        todayMidnight.setHours(0, 0, 0, 0);

        // Map range to yf params
        switch (range) {
            case "1d":
                queryOptions.period1 = todayMidnight;
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
                queryOptions.period1 = todayMidnight;
                queryOptions.interval = "1m";
        }

        let chartData = await yf.chart(ticker, queryOptions);

        // Fallback for 1d if empty (e.g. weekend/closed) -> try yesterday
        if (range === "1d" && (!chartData.quotes || chartData.quotes.length === 0)) {
            const yesterdayMidnight = new Date(todayMidnight);
            yesterdayMidnight.setDate(yesterdayMidnight.getDate() - 1);
            queryOptions.period1 = yesterdayMidnight;
            queryOptions.period2 = todayMidnight; // Show yesterday's full day
            chartData = await yf.chart(ticker, queryOptions);
        }

        if (!chartData.quotes || chartData.quotes.length === 0) {
            return NextResponse.json(
                { error: "No chart data available" },
                { status: 404 }
            );
        }

        // Extract trading period boundaries from meta
        const meta = chartData.meta || {};
        const ctp = meta.currentTradingPeriod || {};
        const prePeriod = extractPeriod(ctp.pre);
        const regularPeriod = extractPeriod(ctp.regular);
        const postPeriod = extractPeriod(ctp.post);

        const points = chartData.quotes.map((q: Record<string, unknown>) => {
            const date = q.date instanceof Date ? q.date : new Date(q.date as string);
            const timestampSec = Math.floor(date.getTime() / 1000);

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

            // Determine session based on trading period boundaries
            const session = (range === "1d")
                ? getSession(timestampSec, prePeriod, regularPeriod, postPeriod)
                : "regular"; // For multi-day ranges, don't tag sessions

            return {
                time: timeStr,
                timestamp: timestampSec,
                open: safeNum(q.open),
                high: safeNum(q.high),
                low: safeNum(q.low),
                close: safeNum(q.close),
                volume: safeNum(q.volume),
                session,
            };
        });

        // Build session boundaries for the frontend to draw zones
        const tradingPeriods = (range === "1d") ? {
            pre: prePeriod ? {
                start: prePeriod.start,
                end: prePeriod.end,
            } : null,
            regular: regularPeriod ? {
                start: regularPeriod.start,
                end: regularPeriod.end,
            } : null,
            post: postPeriod ? {
                start: postPeriod.start,
                end: postPeriod.end,
            } : null,
        } : null;

        // Get name from quote
        let name = ticker;
        try {
            const quote = await yf.quote(ticker);
            name = quote.shortName || quote.longName || ticker;
        } catch {
            // name fallback is fine
        }

        return NextResponse.json({ ticker, name, points, tradingPeriods });
    } catch (err) {
        console.error("Chart error:", err);
        return NextResponse.json(
            { error: String(err) },
            { status: 500 }
        );
    }
}
