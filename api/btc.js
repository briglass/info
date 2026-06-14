const HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  "Accept": "application/json, text/plain, */*",
  "Accept-Language": "en-US,en;q=0.9",
  "Cache-Control": "no-cache"
};

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "public, max-age=300, s-maxage=300");
  
  // Try Kraken first (extremely reliable and friendly to Vercel/cloud IPs)
  try {
    const r = await fetch("https://api.kraken.com/0/public/Ticker?pair=XBTUSD", { headers: HEADERS });
    if (r.ok) {
      const j = await r.json();
      const pairData = j.result?.XXBTZUSD || j.result?.XBTUSD;
      if (pairData) {
        const price = parseFloat(pairData.c[0]);
        const open = parseFloat(pairData.o);
        const change24h = (price - open) / open * 100;
        res.json({ price, change24h });
        return;
      }
    }
  } catch (e) {
    console.warn("Kraken fetch failed, trying Yahoo fallback:", e.message);
  }

  // Backup fallback: Yahoo Finance with complete/realistic browser headers
  try {
    const r = await fetch(
      "https://query1.finance.yahoo.com/v8/finance/chart/BTC-USD?interval=1d&range=1d",
      { headers: HEADERS }
    );
    if (!r.ok) throw new Error("upstream");
    const j = await r.json();
    const meta = j.chart?.result?.[0]?.meta;
    if (!meta) throw new Error("no data");
    const price = meta.regularMarketPrice ?? null;
    const prev = meta.previousClose ?? meta.chartPreviousClose ?? null;
    const change24h = price != null && prev != null && prev !== 0
      ? (price - prev) / prev * 100
      : null;
    res.json({ price, change24h });
  } catch (e) {
    res.status(502).json({ error: "upstream", details: e.message });
  }
}
