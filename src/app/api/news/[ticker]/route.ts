import { NextResponse } from "next/server";
import YahooFinance from "yahoo-finance2";

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
        const searchResult = await yf.search(ticker, { newsCount: 10 });

        const articles = ((searchResult.news as Record<string, unknown>[]) || []).map(
            (item: Record<string, unknown>) => {
                let ts: number | null = null;
                let timeStr = "";

                if (item.providerPublishTime) {
                    const epoch =
                        typeof item.providerPublishTime === "number"
                            ? item.providerPublishTime * 1000
                            : new Date(item.providerPublishTime as string).getTime();
                    const d = new Date(epoch);
                    ts = Math.floor(d.getTime() / 1000);
                    timeStr = d.toLocaleTimeString("en-US", {
                        hour: "2-digit",
                        minute: "2-digit",
                        hour12: false,
                    });
                }

                return {
                    title: (item.title as string) || "",
                    publisher: (item.publisher as string) || "",
                    timestamp: ts,
                    time: timeStr,
                    link: (item.link as string) || "",
                };
            }
        );

        return NextResponse.json({ ticker, news: articles });
    } catch (err) {
        console.error("News error:", err);
        return NextResponse.json(
            { error: String(err) },
            { status: 500 }
        );
    }
}
