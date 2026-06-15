const HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  "Accept": "application/json, text/plain, xml, */*",
  "Accept-Language": "en-US,en;q=0.9",
  "Cache-Control": "no-cache"
};

// Simple HTML decoder for common entities
function decodeHtmlEntities(str) {
  if (!str) return "";
  return str
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#160;/g, " ")
    .replace(/&#39;/g, "'")
    .replace(/&#039;/g, "'")
    .replace(/&ldquo;/g, '"')
    .replace(/&rdquo;/g, '"')
    .replace(/&lsquo;/g, "'")
    .replace(/&rsquo;/g, "'")
    .replace(/&ndash;/g, "–")
    .replace(/&mdash;/g, "—")
    .replace(/&#\d+;/g, "");
}

async function fetchWikiOnThisDay() {
  try {
    const r = await fetch("https://en.wikipedia.org/w/api.php?action=featuredfeed&feed=onthisday&format=xml", { headers: HEADERS });
    if (!r.ok) return [];
    const text = await r.text();
    
    // Split by <item>
    const items = [];
    const re = /<item[^>]*>([\s\S]*?)<\/item>/gi;
    let m;
    while ((m = re.exec(text)) !== null) {
      items.push(m[1]);
    }
    if (items.length === 0) return [];
    
    // Take the most recent day's item
    const lastItem = items[items.length - 1];
    const descMatch = lastItem.match(/<description[^>]*>([\s\S]*?)<\/description>/i);
    if (!descMatch) return [];
    
    const desc = decodeHtmlEntities(descMatch[1]);
    
    const bullets = [];
    // Find all <li>...</li> entries
    const reLi = /<li>([\s\S]*?)<\/li>/gi;
    let mLi;
    while ((mLi = reLi.exec(desc)) !== null) {
      const raw = mLi[1]
        .replace(/<[^>]*>/g, "") // strip html tags
        .replace(/\s+/g, " ") // normalize whitespace
        .trim();
      
      // We only want historical facts, which start with a year and an ndash (e.g., "1920 – " or "1520 – ")
      if (/^\d+\s*[\u2013\u2014-]\s*/.test(raw)) {
        bullets.push({
          category: "on this day",
          text: raw
        });
      }
    }
    return bullets;
  } catch (e) {
    console.error("Wikipedia fetch failed:", e.message);
    return [];
  }
}

async function fetchSingleUselessFact() {
  try {
    const r = await fetch("https://uselessfacts.jsph.pl/api/v2/facts/random?language=en", { headers: HEADERS });
    if (!r.ok) return null;
    const j = await r.json();
    if (!j.text) return null;
    return {
      category: "did you know",
      text: j.text.replace(/`/g, "'").trim()
    };
  } catch {
    return null;
  }
}

async function fetchUselessFacts(count = 5) {
  try {
    // Fetch multiple in parallel
    const promises = Array.from({ length: count }, () => fetchSingleUselessFact());
    const results = await Promise.all(promises);
    return results.filter(f => f !== null);
  } catch (e) {
    console.error("Useless facts fetch failed:", e.message);
    return [];
  }
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "public, max-age=1800, s-maxage=1800");
  try {
    const [wikiFacts, uselessFacts] = await Promise.all([
      fetchWikiOnThisDay(),
      fetchUselessFacts(6)
    ]);
    
    // Combine and shuffle
    const combined = [...wikiFacts, ...uselessFacts];
    if (combined.length === 0) {
      // Return hardcoded fallbacks if completely offline
      combined.push({
        category: "science",
        text: "Helium was discovered on the Sun before it was found on Earth — spotted in 1868 as an unknown spectral line in sunlight, named after Helios."
      });
    }
    
    // Shuffle helper
    for (let i = combined.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [combined[i], combined[j]] = [combined[j], combined[i]];
    }
    
    res.json({ facts: combined });
  } catch (e) {
    res.status(502).json({ error: "upstream", details: e.message });
  }
}
