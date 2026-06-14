// ESPN team IDs — soccer IDs (Timbers, Fire, USMNT) may need tuning if ESPN changes slugs
const TEAMS = [
  { team: "Cardinals", sport: "baseball",   league: "mlb",          id: "24"   },
  { team: "Blues",     sport: "hockey",     league: "nhl",          id: "19"   },
  { team: "Blazers",   sport: "basketball", league: "nba",          id: "25"   },
  { team: "Timbers",   sport: "soccer",     league: "usa.1",        id: "9723" },
  { team: "Fire",      sport: "soccer",     league: "usa.1",        id: "182"  },
  { team: "USMNT",     sport: "soccer",     league: "fifa.world",   id: "660"  },
];

const HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  "Accept": "application/json, text/plain, */*",
  "Accept-Language": "en-US,en;q=0.9",
  "Cache-Control": "no-cache"
};

function getScoreValue(s) {
  if (s == null) return "?";
  if (typeof s === "object") return s.displayValue ?? s.value ?? "?";
  return s;
}

function buildGame(event, myId, state) {
  const comp = event.competitions?.[0];
  if (!comp?.competitors?.length) return null;
  const mine = comp.competitors.find(c => c.team?.id === String(myId));
  const opp  = comp.competitors.find(c => c.team?.id !== String(myId));
  if (!opp) return null;
  const vs = opp.team?.abbreviation || opp.team?.shortDisplayName || opp.team?.displayName || "?";
  if (state === "pre") {
    const d = new Date(event.date);
    const date = d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "America/Los_Angeles" });
    const time = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "America/Los_Angeles" });
    return { state: "pre", vs, date, time };
  }
  const myScore  = getScoreValue(mine?.score);
  const oppScore = getScoreValue(opp?.score);
  if (state === "in") return { state: "in", vs, myScore, oppScore };
  const result = mine?.winner === true ? "W" : mine?.winner === false ? "L" : "";
  return { state: "post", vs, myScore, oppScore, result };
}

async function fetchTeam(t) {
  try {
    const url = `https://site.api.espn.com/apis/site/v2/sports/${t.sport}/${t.league}/teams/${t.id}/schedule`;
    const r = await fetch(url, { headers: HEADERS });
    if (!r.ok) return { team: t.team, game: null };
    const j = await r.json();
    const myId = j.team?.id || t.id;
    const events = j.events || [];
    const now = Date.now();
    const ms7 = 7 * 86400000;
    const ms14 = 14 * 86400000;

    const live = events.find(e => e.competitions?.[0]?.status?.type?.state === "in");
    if (live) return { team: t.team, game: buildGame(live, myId, "in") };

    const posts = events
      .filter(e => e.competitions?.[0]?.status?.type?.completed && now - new Date(e.date).getTime() < ms7)
      .sort((a, b) => new Date(b.date) - new Date(a.date));
    if (posts.length) return { team: t.team, game: buildGame(posts[0], myId, "post") };

    const pres = events
      .filter(e => {
        const t = new Date(e.date).getTime();
        return e.competitions?.[0]?.status?.type?.state === "pre" && t > now && t - now < ms14;
      })
      .sort((a, b) => new Date(a.date) - new Date(b.date));
    if (pres.length) return { team: t.team, game: buildGame(pres[0], myId, "pre") };

    return { team: t.team, game: null };
  } catch {
    return { team: t.team, game: null };
  }
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "public, max-age=300, s-maxage=300");
  try {
    const teams = await Promise.all(TEAMS.map(fetchTeam));
    res.json({ teams });
  } catch {
    res.status(502).json({ error: "upstream" });
  }
}
