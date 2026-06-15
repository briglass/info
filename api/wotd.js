const HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  "Accept": "application/xml, text/xml, */*",
  "Accept-Language": "en-US,en;q=0.9",
  "Cache-Control": "no-cache"
};

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "public, max-age=1800, s-maxage=1800");
  try {
    const r = await fetch("https://www.merriam-webster.com/wotd/feed/rss2", { headers: HEADERS });
    if (!r.ok) throw new Error("upstream status " + r.status);
    const text = await r.text();
    const m = text.match(/<item>([\s\S]*?)<\/item>/);
    if (!m) throw new Error("No item found in RSS feed");
    const item = m[1];
    
    // Extract word
    const wordMatch = item.match(/<title>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/title>/i);
    const word = wordMatch ? wordMatch[1].trim() : "unknown";
    
    // Extract shortdef
    const shortdefMatch = item.match(/<merriam:shortdef>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/merriam:shortdef>/i);
    const shortdef = shortdefMatch ? shortdefMatch[1].trim() : "Definition unavailable.";
    
    // Extract summary for pronunciation and POS (part of speech)
    const summaryMatch = item.match(/<itunes:summary>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/itunes:summary>/i);
    const summary = summaryMatch ? summaryMatch[1] : "";
    
    let pronunciation = "";
    let pos = "";
    if (summary) {
      // Find pronunciation between slashes (e.g. \im-BLAY-zun\)
      const pronMatch = summary.match(/\\([^\\]+)\\/);
      if (pronMatch) pronunciation = "\\" + pronMatch[1].trim() + "\\";
      
      const posList = ["noun", "verb", "adjective", "adverb", "conjunction", "preposition", "interjection", "pronoun"];
      for (const p of posList) {
        if (summary.toLowerCase().includes(`\\ ${p}`) || summary.toLowerCase().includes(`\\  ${p}`) || summary.toLowerCase().includes(`\\` + p)) {
          pos = p;
          break;
        }
      }
    }
    
    res.json({ word, pronunciation, pos, shortdef });
  } catch (e) {
    res.status(502).json({ error: "upstream", details: e.message });
  }
}
