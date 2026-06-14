const FEEDS = [
  { key: "WORLD", url: "https://feeds.bbci.co.uk/news/world/rss.xml" },
  { key: "US",    url: "https://feeds.npr.org/1001/rss.xml" },
  { key: "TECH",  url: "https://hnrss.org/frontpage?count=10" },
];

function tagText(block, tag) {
  const m = block.match(new RegExp(`<${tag}[^>]*>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?<\\/${tag}>`, "i"));
  if (!m) return null;
  return m[1].trim()
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#\d+;/g, "");
}

function parseRss(xml, max = 5) {
  const items = [];
  const re = /<item[^>]*>([\s\S]*?)<\/item>/g;
  let m;
  while ((m = re.exec(xml)) !== null && items.length < max) {
    const b = m[1];
    const title  = tagText(b, "title");
    const link   = tagText(b, "link");
    const source = tagText(b, "source");
    if (title && link) items.push({ title, link, source: source || null });
  }
  return items;
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "public, max-age=1800, s-maxage=1800");
  try {
    const cats = await Promise.all(
      FEEDS.map(async f => {
        try {
          const r = await fetch(f.url, { headers: { "User-Agent": "Mozilla/5.0" } });
          const text = await r.text();
          return { key: f.key, items: parseRss(text) };
        } catch {
          return { key: f.key, items: [] };
        }
      })
    );
    res.json({ categories: cats.filter(c => c.items.length > 0) });
  } catch {
    res.status(502).json({ error: "upstream" });
  }
}
