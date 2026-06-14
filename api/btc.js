export default async function handler(req, res) {
  res.setHeader("Cache-Control", "public, max-age=300, s-maxage=300");
  try {
    const r = await fetch(
      "https://query2.finance.yahoo.com/v8/finance/chart/BTC-USD?interval=1d&range=1d",
      { headers: { "User-Agent": "Mozilla/5.0" } }
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
  } catch {
    res.status(502).json({ error: "upstream" });
  }
}
