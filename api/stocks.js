// "GOOGLE" -> GOOGL is Alphabet's actual ticker symbol
const TICKERS = ["XOM", "FXAIX", "GOOGL", "AMZN", "ETLGX", "MSFT", "BROS", "BETA"];

const HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  "Accept": "application/json, text/plain, */*",
  "Accept-Language": "en-US,en;q=0.9",
  "Cache-Control": "no-cache",
  "Origin": "https://finance.yahoo.com",
  "Referer": "https://finance.yahoo.com/"
};

async function fetchQuote(sym) {
  try {
    // Try query1 which is the primary Yahoo Finance endpoint
    const r = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${sym}?interval=1d&range=1d`,
      { headers: HEADERS }
    );
    if (!r.ok) {
      // Fallback to query2 if query1 fails
      const r2 = await fetch(
        `https://query2.finance.yahoo.com/v8/finance/chart/${sym}?interval=1d&range=1d`,
        { headers: HEADERS }
      );
      if (!r2.ok) return { symbol: sym, price: null, changePct: null };
      return parseYahooResult(sym, await r2.json());
    }
    return parseYahooResult(sym, await r.json());
  } catch (e) {
    console.error(`Error fetching quote for ${sym}:`, e.message);
    return { symbol: sym, price: null, changePct: null };
  }
}

function parseYahooResult(sym, j) {
  const meta = j.chart?.result?.[0]?.meta;
  if (!meta) return { symbol: sym, price: null, changePct: null };
  const price = meta.regularMarketPrice ?? null;
  const prev = meta.previousClose ?? meta.chartPreviousClose ?? null;
  const changePct = price != null && prev != null && prev !== 0
    ? (price - prev) / prev * 100
    : null;
  return { symbol: sym, price, changePct };
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
