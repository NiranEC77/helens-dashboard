import { type Mover, type ChartPoint, type NewsItem } from "./api";

/**
 * Realistic demo data used when the backend returns empty movers
 * (e.g. outside market hours). This ensures the UI is always demonstrable.
 */
export const DEMO_MOVERS: Mover[] = [
    {
        ticker: "NVDA",
        name: "NVIDIA Corporation",
        price: 142.87,
        prevClose: 136.52,
        gapPct: 4.65,
        volume: 87400000,
        avgVolume: 62000000,
        volumeRatio: 1.41,
        marketCap: 3500000000000,
        sparkline: [131.20, 133.50, 135.80, 136.52, 142.87],
    },
    {
        ticker: "TSLA",
        name: "Tesla, Inc.",
        price: 412.30,
        prevClose: 396.88,
        gapPct: 3.88,
        volume: 95200000,
        avgVolume: 72000000,
        volumeRatio: 1.32,
        marketCap: 1320000000000,
        sparkline: [388.10, 392.40, 390.80, 396.88, 412.30],
    },
    {
        ticker: "PLTR",
        name: "Palantir Technologies Inc.",
        price: 82.45,
        prevClose: 79.60,
        gapPct: 3.58,
        volume: 41200000,
        avgVolume: 35000000,
        volumeRatio: 1.18,
        marketCap: 188000000000,
        sparkline: [76.30, 77.80, 78.50, 79.60, 82.45],
    },
    {
        ticker: "COIN",
        name: "Coinbase Global, Inc.",
        price: 298.50,
        prevClose: 288.40,
        gapPct: 3.50,
        volume: 12800000,
        avgVolume: 9500000,
        volumeRatio: 1.35,
        marketCap: 74000000000,
        sparkline: [275.20, 280.50, 284.10, 288.40, 298.50],
    },
    {
        ticker: "AMD",
        name: "Advanced Micro Devices, Inc.",
        price: 168.90,
        prevClose: 164.22,
        gapPct: 2.85,
        volume: 58900000,
        avgVolume: 52000000,
        volumeRatio: 1.13,
        marketCap: 274000000000,
        sparkline: [160.40, 162.10, 163.50, 164.22, 168.90],
    },
    {
        ticker: "MARA",
        name: "MARA Holdings, Inc.",
        price: 24.88,
        prevClose: 24.20,
        gapPct: 2.81,
        volume: 32500000,
        avgVolume: 28000000,
        volumeRatio: 1.16,
        marketCap: 7200000000,
        sparkline: [22.80, 23.40, 23.90, 24.20, 24.88],
    },
    {
        ticker: "AAPL",
        name: "Apple Inc.",
        price: 237.60,
        prevClose: 233.80,
        gapPct: 1.63,
        volume: 48200000,
        avgVolume: 56000000,
        volumeRatio: 0.86,
        marketCap: 3620000000000,
        sparkline: [230.50, 231.80, 232.90, 233.80, 237.60],
    },
    {
        ticker: "META",
        name: "Meta Platforms, Inc.",
        price: 682.10,
        prevClose: 674.50,
        gapPct: 1.13,
        volume: 21600000,
        avgVolume: 18000000,
        volumeRatio: 1.20,
        marketCap: 1740000000000,
        sparkline: [665.30, 668.90, 672.10, 674.50, 682.10],
    },
    {
        ticker: "SNAP",
        name: "Snap Inc.",
        price: 11.20,
        prevClose: 11.72,
        gapPct: -4.44,
        volume: 28800000,
        avgVolume: 22000000,
        volumeRatio: 1.31,
        marketCap: 18500000000,
        sparkline: [12.40, 12.10, 11.90, 11.72, 11.20],
    },
    {
        ticker: "RIVN",
        name: "Rivian Automotive, Inc.",
        price: 14.85,
        prevClose: 15.40,
        gapPct: -3.57,
        volume: 34200000,
        avgVolume: 30000000,
        volumeRatio: 1.14,
        marketCap: 16800000000,
        sparkline: [16.20, 15.90, 15.60, 15.40, 14.85],
    },
    {
        ticker: "INTC",
        name: "Intel Corporation",
        price: 21.55,
        prevClose: 22.10,
        gapPct: -2.49,
        volume: 55600000,
        avgVolume: 48000000,
        volumeRatio: 1.16,
        marketCap: 92000000000,
        sparkline: [22.80, 22.50, 22.30, 22.10, 21.55],
    },
    {
        ticker: "NIO",
        name: "NIO Inc.",
        price: 4.52,
        prevClose: 4.62,
        gapPct: -2.16,
        volume: 42100000,
        avgVolume: 38000000,
        volumeRatio: 1.11,
        marketCap: 9200000000,
        sparkline: [4.80, 4.72, 4.68, 4.62, 4.52],
    },
];

/**
 * Generate plausible intraday chart points for demo mode.
 */
export function generateDemoChart(ticker: string): ChartPoint[] {
    const mover = DEMO_MOVERS.find((m) => m.ticker === ticker);
    const basePrice = mover?.prevClose ?? 150;
    const finalPrice = mover?.price ?? basePrice * 1.02;
    const points: ChartPoint[] = [];

    // Generate minute-by-minute data from 4:00 AM to 9:30 AM (pre-market)
    const totalMinutes = 330; // 5.5 hours
    const drift = (finalPrice - basePrice) / totalMinutes;

    let price = basePrice;
    for (let i = 0; i < totalMinutes; i++) {
        const noise = (Math.random() - 0.5) * basePrice * 0.003;
        price = price + drift + noise;
        const hour = Math.floor(i / 60) + 4;
        const minute = i % 60;
        const time = `${hour.toString().padStart(2, "0")}:${minute
            .toString()
            .padStart(2, "0")}`;

        points.push({
            time,
            timestamp: Math.floor(Date.now() / 1000) - (totalMinutes - i) * 60,
            open: Math.round(price * 100) / 100,
            high: Math.round((price + Math.random() * 0.5) * 100) / 100,
            low: Math.round((price - Math.random() * 0.5) * 100) / 100,
            close: Math.round(price * 100) / 100,
            volume: Math.round(10000 + Math.random() * 50000),
        });
    }

    return points;
}

/** Chart-time indices where news appears (as fraction of total 330 minutes) */
const DEMO_NEWS_MAP: Record<string, { minuteOffset: number; title: string; publisher: string }[]> = {
    NVDA: [
        { minuteOffset: 30, title: "NVIDIA announces record Q4 data center revenue of $15.5B, beating estimates", publisher: "Reuters" },
        { minuteOffset: 150, title: "Jensen Huang: 'Blackwell demand is insane' — new GPU orders surge 3x", publisher: "CNBC" },
        { minuteOffset: 270, title: "Morgan Stanley upgrades NVDA to $180 PT on AI infrastructure boom", publisher: "Bloomberg" },
    ],
    TSLA: [
        { minuteOffset: 45, title: "Tesla FSD v13 achieves 99.97% safety rating in NHTSA pilot test", publisher: "TechCrunch" },
        { minuteOffset: 180, title: "Elon Musk confirms Robotaxi launch in Austin for Q2 2026", publisher: "Reuters" },
    ],
    PLTR: [
        { minuteOffset: 60, title: "Palantir wins $1.8B Pentagon contract for AI battlefield systems", publisher: "WSJ" },
        { minuteOffset: 200, title: "Palantir AIP platform adoption triples among Fortune 500", publisher: "Forbes" },
    ],
    COIN: [
        { minuteOffset: 40, title: "Bitcoin surges past $112K as ETF inflows hit daily record", publisher: "CoinDesk" },
        { minuteOffset: 210, title: "SEC approves Coinbase staking services under new framework", publisher: "Bloomberg" },
    ],
    AMD: [
        { minuteOffset: 80, title: "AMD MI350 AI chips outperform NVIDIA H200 in new benchmarks", publisher: "AnandTech" },
        { minuteOffset: 250, title: "Microsoft Azure expands AMD Instinct cluster capacity by 40%", publisher: "The Verge" },
    ],
    MARA: [
        { minuteOffset: 55, title: "Bitcoin mining revenue surges as BTC breaks new all-time high", publisher: "CoinDesk" },
    ],
    AAPL: [
        { minuteOffset: 90, title: "Apple Vision Pro 2 leaks reveal 50% cost reduction, consumer pricing", publisher: "MacRumors" },
        { minuteOffset: 240, title: "Apple services revenue hits $30B quarterly milestone", publisher: "CNBC" },
    ],
    META: [
        { minuteOffset: 70, title: "Meta AI assistant reaches 1 billion monthly active users", publisher: "The Verge" },
    ],
    SNAP: [
        { minuteOffset: 50, title: "Snap misses Q4 ad revenue expectations by 12%, guides lower", publisher: "CNBC" },
        { minuteOffset: 190, title: "Analyst: 'Snapchat losing Gen-Z engagement to TikTok'", publisher: "WSJ" },
    ],
    RIVN: [
        { minuteOffset: 35, title: "Rivian recalls 12,000 R1S units over battery cooling defect", publisher: "Reuters" },
        { minuteOffset: 160, title: "Rivian burns $1.6B cash in Q4, pushes profitability to 2028", publisher: "Bloomberg" },
    ],
    INTC: [
        { minuteOffset: 65, title: "Intel 18A process yields remain below 50%, report says", publisher: "SemiAnalysis" },
        { minuteOffset: 220, title: "Intel loses Apple modem contract to Qualcomm", publisher: "WSJ" },
    ],
    NIO: [
        { minuteOffset: 45, title: "China EV subsidies slashed 30% starting March 2026", publisher: "Reuters" },
    ],
};

/**
 * Generate demo news items aligned with chart time points.
 */
export function generateDemoNews(ticker: string): NewsItem[] {
    const entries = DEMO_NEWS_MAP[ticker] ?? [];
    return entries.map((entry) => {
        const hour = Math.floor(entry.minuteOffset / 60) + 4;
        const minute = entry.minuteOffset % 60;
        const time = `${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}`;
        return {
            title: entry.title,
            publisher: entry.publisher,
            timestamp: null,
            time,
            link: "",
        };
    });
}
