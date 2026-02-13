const API_BASE = process.env.NEXT_PUBLIC_API_URL || "";

export interface Mover {
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

export interface MoversResponse {
    movers: Mover[];
    source: "live" | "previous_close" | "cached";
    timestamp: string;
}

export interface ChartPoint {
    time: string;
    timestamp: number;
    open: number | null;
    high: number | null;
    low: number | null;
    close: number | null;
    volume: number | null;
}

export interface ChartResponse {
    ticker: string;
    name: string;
    points: ChartPoint[];
}

export interface NewsItem {
    title: string;
    publisher: string;
    timestamp: number | null;
    time: string;
    link: string;
}

export interface NewsResponse {
    ticker: string;
    news: NewsItem[];
}

export async function fetchMovers(): Promise<MoversResponse> {
    const res = await fetch(`${API_BASE}/api/movers`);
    if (!res.ok) throw new Error(`Failed to fetch movers: ${res.status}`);
    return res.json();
}

export async function fetchChart(ticker: string): Promise<ChartResponse> {
    const res = await fetch(`${API_BASE}/api/chart/${ticker}`);
    if (!res.ok) throw new Error(`Failed to fetch chart: ${res.status}`);
    return res.json();
}

export async function fetchNews(ticker: string): Promise<NewsResponse> {
    const res = await fetch(`${API_BASE}/api/news/${ticker}`);
    if (!res.ok) throw new Error(`Failed to fetch news: ${res.status}`);
    return res.json();
}

export interface WatchlistResponse {
    stocks: Mover[];
    timestamp: string;
}

export async function fetchWatchlist(tickers: string[]): Promise<WatchlistResponse> {
    if (tickers.length === 0) return { stocks: [], timestamp: new Date().toISOString() };
    const res = await fetch(`${API_BASE}/api/watchlist?tickers=${tickers.join(",")}`);
    if (!res.ok) throw new Error(`Failed to fetch watchlist: ${res.status}`);
    return res.json();
}

export function formatPrice(n: number): string {
    return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        minimumFractionDigits: 2,
    }).format(n);
}

export function formatVolume(n: number | null): string {
    if (n === null || n === undefined) return "—";
    if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
    return n.toString();
}

export function formatMarketCap(n: number | null): string {
    if (n === null || n === undefined) return "—";
    if (n >= 1_000_000_000_000) return `$${(n / 1_000_000_000_000).toFixed(1)}T`;
    if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(1)}B`;
    if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
    return `$${n}`;
}
