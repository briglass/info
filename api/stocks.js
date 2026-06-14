// "GOOGLE" -> GOOGL is Alphabet's actual ticker symbol
const TICKERS = ["XOM", "FXAIX", "GOOGL", "AMZN", "ETLGX", "MSFT", "BROS", "BETA"];

async function fetchQuote(sym) {
  try {
    const r = await fetch(
      `https://query2.finance.yahoo.com/v8/finance/chart/${sym}?interval=1d&range=1d`,
      { headers: { "User-Agent": "Mozilla/5.0" } }
    );
    if (!r.ok) return { symbol: sym, price: null, changePct: null };
    const j = await r.json();
    const meta = j.chart?.result?.[0]?.meta;
    if (!meta) return { symbol: sym, price: null, changePct: null };
    const price = meta.regularMarketPrice ?? null;
    const prev = meta.previousClose ?? meta.chartPreviousClose ?? null;
    const changePct = price != null && prev != null && prev !== 0
      ? (price - prev) / prev * 100
      : null;
    return { symbol: sym, price, changePct };
  } catch {
    return { symbol: sym, price: null, changePct: null };
  }
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "public, max-age=300, s-maxage=300");
  try {
    const quotes = await Promise.all(TICKERS.map(fetchQuote));
    res.json({ quotes });
  } catch {
    res.status(502).json({ error: "upstream" });
  }
}
