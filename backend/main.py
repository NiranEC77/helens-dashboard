"""
Anti-Gravity — Pre-Market Stock Dashboard Backend
FastAPI server providing pre-market movers and intraday chart data via yfinance.
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import yfinance as yf
import pandas as pd
from datetime import datetime, timedelta
from pathlib import Path
import json
import traceback
import os

# ── Cache for offline fallback ──
CACHE_PATH = Path(__file__).parent / "movers_cache.json"

def _load_cache():
    """Load the last successfully-fetched movers from disk."""
    try:
        if CACHE_PATH.exists():
            return json.loads(CACHE_PATH.read_text())
    except Exception:
        pass
    return None

def _save_cache(data: dict):
    """Persist movers to disk so we survive yfinance outages."""
    try:
        CACHE_PATH.write_text(json.dumps(data))
    except Exception:
        pass

app = FastAPI(title="Anti-Gravity API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Well-known volatile / popular tickers to scan for pre-market movement
WATCHLIST = [
    "AAPL", "MSFT", "GOOGL", "AMZN", "NVDA", "META", "TSLA", "AMD",
    "NFLX", "INTC", "BA", "DIS", "PLTR", "SOFI", "RIVN", "LCID",
    "NIO", "COIN", "MARA", "RIOT", "SQ", "SNAP", "UBER", "PYPL",
    "ROKU", "SHOP", "CRWD", "SNOW", "DKNG", "ABNB",
]


def _safe_float(val):
    """Convert numpy/pandas numeric to plain float, or None."""
    if val is None or (hasattr(val, '__float__') and pd.isna(val)):
        return None
    try:
        return round(float(val), 2)
    except Exception:
        return None


@app.get("/api/movers")
def get_movers():
    """
    Return top movers from the watchlist.
    First attempts live fast_info (works during pre-market / market hours).
    If that yields nothing (off-hours), falls back to the last two trading
    sessions from history so the dashboard always has real data to show.
    """
    movers = []
    source = "live"

    tickers_str = " ".join(WATCHLIST)
    tickers = yf.Tickers(tickers_str)

    # ── Attempt 1: live fast_info ──
    for symbol in WATCHLIST:
        try:
            t = tickers.tickers[symbol]
            info = t.fast_info

            prev_close = _safe_float(getattr(info, "previous_close", None))
            current = _safe_float(getattr(info, "last_price", None))

            if prev_close is None or current is None or prev_close == 0:
                continue

            gap_pct = round((current - prev_close) / prev_close * 100, 2)
            market_cap = _safe_float(getattr(info, "market_cap", None))

            day_volume = _safe_float(getattr(info, "last_volume", None))
            avg_volume = _safe_float(getattr(info, "three_month_average_volume", None))

            volume_ratio = None
            if day_volume and avg_volume and avg_volume > 0:
                volume_ratio = round(day_volume / avg_volume, 2)

            try:
                hist = t.history(period="5d", interval="1d")
                sparkline = [round(float(v), 2) for v in hist["Close"].dropna().tolist()]
            except Exception:
                sparkline = []

            try:
                full_info = t.info
                name = full_info.get("shortName", symbol)
            except Exception:
                name = symbol

            movers.append({
                "ticker": symbol,
                "name": name,
                "price": current,
                "prevClose": prev_close,
                "gapPct": gap_pct,
                "volume": day_volume,
                "avgVolume": avg_volume,
                "volumeRatio": volume_ratio,
                "marketCap": market_cap,
                "sparkline": sparkline,
            })

        except Exception:
            traceback.print_exc()
            continue

    # ── Attempt 2: previous session fallback via batch download ──
    if len(movers) == 0:
        source = "previous_close"
        try:
            df = yf.download(
                tickers_str,
                period="5d",
                interval="1d",
                group_by="ticker",
                progress=False,
                threads=True,
            )

            if df is not None and not df.empty:
                # Get ticker names in a single batch
                names_map = {}
                try:
                    for symbol in WATCHLIST:
                        try:
                            t = tickers.tickers[symbol]
                            full_info = t.info
                            names_map[symbol] = full_info.get("shortName", symbol)
                        except Exception:
                            names_map[symbol] = symbol
                except Exception:
                    pass

                for symbol in WATCHLIST:
                    try:
                        # Access per-ticker data from the multi-level columns
                        if len(WATCHLIST) > 1:
                            ticker_df = df[symbol] if symbol in df.columns.get_level_values(0) else None
                        else:
                            ticker_df = df

                        if ticker_df is None or ticker_df.empty:
                            continue

                        closes = ticker_df["Close"].dropna()
                        volumes = ticker_df["Volume"].dropna()

                        if len(closes) < 2:
                            continue

                        current = round(float(closes.iloc[-1]), 2)
                        prev_close = round(float(closes.iloc[-2]), 2)
                        if prev_close == 0:
                            continue

                        gap_pct = round((current - prev_close) / prev_close * 100, 2)
                        day_volume = round(float(volumes.iloc[-1]), 0) if len(volumes) >= 1 else None

                        volume_ratio = None
                        sparkline = [round(float(v), 2) for v in closes.tolist()]

                        movers.append({
                            "ticker": symbol,
                            "name": names_map.get(symbol, symbol),
                            "price": current,
                            "prevClose": prev_close,
                            "gapPct": gap_pct,
                            "volume": day_volume,
                            "avgVolume": None,
                            "volumeRatio": volume_ratio,
                            "marketCap": None,
                            "sparkline": sparkline,
                        })

                    except Exception:
                        traceback.print_exc()
                        continue

        except Exception:
            traceback.print_exc()

    # Sort by absolute gap — biggest movers first
    movers.sort(key=lambda m: abs(m["gapPct"]), reverse=True)

    result = {
        "movers": movers,
        "source": source,
        "timestamp": datetime.utcnow().isoformat(),
    }

    # Save to cache on success
    if len(movers) > 0:
        _save_cache(result)
    else:
        # ── Attempt 3: serve from disk cache ──
        cached = _load_cache()
        if cached and len(cached.get("movers", [])) > 0:
            cached["source"] = "cached"
            return cached

    return result


@app.get("/api/chart/{ticker}")
def get_chart(ticker: str):
    """
    Return intraday 1-minute data for the given ticker (today).
    Falls back to the most recent trading day if today has no data yet.
    """
    ticker = ticker.upper()
    try:
        t = yf.Ticker(ticker)
        hist = t.history(period="1d", interval="1m")

        if hist.empty:
            # Try last 2 days
            hist = t.history(period="2d", interval="1m")

        if hist.empty:
            raise HTTPException(status_code=404, detail="No chart data available")

        points = []
        for ts, row in hist.iterrows():
            points.append({
                "time": ts.strftime("%H:%M"),
                "timestamp": int(ts.timestamp()),
                "open": _safe_float(row["Open"]),
                "high": _safe_float(row["High"]),
                "low": _safe_float(row["Low"]),
                "close": _safe_float(row["Close"]),
                "volume": _safe_float(row["Volume"]),
            })

        try:
            info = t.info
            name = info.get("shortName", ticker)
        except Exception:
            name = ticker

        return {
            "ticker": ticker,
            "name": name,
            "points": points,
        }

    except HTTPException:
        raise
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/news/{ticker}")
def get_news(ticker: str):
    """
    Return recent news articles for a given ticker using yfinance.
    Each item includes title, publisher, timestamp, and link.
    """
    ticker = ticker.upper()
    try:
        t = yf.Ticker(ticker)
        raw_news = t.news

        articles = []
        for item in (raw_news or [])[:10]:
            content = item.get("content", {})
            pub_date = content.get("pubDate", "")

            # Parse the publish timestamp
            ts = None
            time_str = ""
            if pub_date:
                try:
                    from dateutil import parser as dateparser
                    dt = dateparser.parse(pub_date)
                    ts = int(dt.timestamp()) if dt else None
                    time_str = dt.strftime("%H:%M") if dt else ""
                except Exception:
                    pass

            title = content.get("title", "")
            provider = content.get("provider", {})
            publisher = provider.get("displayName", "") if isinstance(provider, dict) else ""

            # Try to get the canonical URL
            link = ""
            canon = content.get("canonicalUrl", {})
            if isinstance(canon, dict):
                link = canon.get("url", "")

            if not title:
                continue

            articles.append({
                "title": title,
                "publisher": publisher,
                "timestamp": ts,
                "time": time_str,
                "link": link,
            })

        return {"ticker": ticker, "news": articles}

    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/health")
def health():
    return {"status": "ok"}
