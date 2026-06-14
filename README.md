# at·a·glance

A single-screen, dark-mode personal dashboard. No build step, no database, no API keys.
Designed to fit a Pixel 9 Pro browser window with no scrolling.

## What's on it
- **Weather** for ZIP 97062 (Open-Meteo, called directly from the browser — no key)
- **Markets** — XOM, FXAIX, GOOG, AMZN, ETLGX, MSFT, BROS (Yahoo Finance, via serverless proxy)
- **Bitcoin** USD spot (Coinbase, CoinGecko fallback)
- **Sports** — Cardinals, Blues, Trail Blazers, Portland Fire, Timbers, USMNT (ESPN public JSON).
  Shows live score if playing, else last final (W/L), else next game date/time.
- **Headlines** — top 2 per category: World, US, Oregon, Tech, AI, Sports (Google News RSS)
- **Did you know** — a rotating, hand-picked fact; tap "next" to cycle. No network needed.

Data refreshes on page load (open/reload to update).

## Deploy to Vercel
The folder is already Vercel-ready (static `index.html` + `/api` serverless functions).

**Easiest (drag & drop):**
1. Go to vercel.com → Add New → Project.
2. Drag this whole folder in, or push it to a GitHub repo and import it.
3. Framework preset: **Other**. Build command: none. Output dir: leave default.
4. Deploy. Done.

**Or with the CLI:**
```bash
npm i -g vercel
cd at-a-glance
vercel        # follow prompts; accept defaults
vercel --prod # promote to production
```

No environment variables required.

## Files
```
index.html      the whole UI (HTML + CSS + JS in one file)
api/stocks.js   stock/ETF/mutual-fund quotes (Yahoo Finance)
api/btc.js      bitcoin price (Coinbase / CoinGecko)
api/sports.js   team schedules & scores (ESPN)
api/news.js     headlines per category (Google News RSS)
vercel.json     function settings
package.json    marks /api files as ES modules
```

## Customizing
- **Tickers:** edit `SYMBOLS` in `api/stocks.js`.
- **Teams:** edit `TEAMS` in `api/sports.js` (path = `sport/league`, id = ESPN team id).
- **News categories:** edit `FEEDS` in `api/news.js`.
- **Weather location:** edit `lat`/`lon` in the `loadWeather()` function in `index.html`
  (currently 45.36, -122.76 for the 97062 area).
- **Facts:** edit the `FACTS` array in `index.html`.

## Notes / caveats
- Yahoo, ESPN, and Google News are **unofficial** endpoints. They're free and widely used,
  but can change without notice. Each card fails independently — if one source breaks,
  the rest still load and you'll see a small "unavailable" note in that card only.
- Mutual funds (FXAIX, ETLGX) only update once per day after market close — that's the
  fund NAV, not an intraday price. Normal.
- Portland Fire is the 2026 WNBA expansion team; if a game/schedule isn't published yet
  by ESPN, that cell will show the next available info or "unavailable."
- Add to your phone home screen (Share → Add to Home Screen) for an app-like launch.
```
