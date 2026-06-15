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

function formatDateForScoreboard(date) {
  return date.toISOString().slice(0, 10).replace(/-/g, "");
}

async function fetchScoreboardEvents(t, startDate, endDate) {
  const url = `https://site.api.espn.com/apis/site/v2/sports/${t.sport}/${t.league}/scoreboard?dates=${startDate}-${endDate}`;
  const r = await fetch(url, { headers: HEADERS });
  if (!r.ok) return [];
  const j = await r.json();
  return (j.events || []).filter((e) =>
    e.competitions?.[0]?.competitors?.some((c) => c.team?.id === String(t.id))
  );
}

async function fetchScoreboardFallback(t, now) {
  const today = new Date(now);
  const futureStart = formatDateForScoreboard(today);
  const futureEnd = formatDateForScoreboard(new Date(today.getTime() + 90 * 24 * 60 * 60 * 1000));
  const fallbackStart = formatDateForScoreboard(new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000));
  const fallbackEnd = formatDateForScoreboard(new Date(today.getTime() + 120 * 24 * 60 * 60 * 1000));

  const primary = await fetchScoreboardEvents(t, futureStart, futureEnd);
  if (primary.length) return primary;
  return await fetchScoreboardEvents(t, fallbackStart, fallbackEnd);
}

function buildGame(event, myId, state) {
  const comp = event.competitions?.[0];
  if (!comp?.competitors?.length) return null;
  const mine = comp.competitors.find((c) => c.team?.id === String(myId));
  const opp = comp.competitors.find((c) => c.team?.id !== String(myId));
  if (!opp) return null;
  const vs = opp.team?.abbreviation || opp.team?.shortDisplayName || opp.team?.displayName || "?";
  if (state === "pre") {
    const d = new Date(event.date);
    const date = d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "America/Los_Angeles" });
    const time = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "America/Los_Angeles" });
    return { state: "pre", vs, date, time };
  }
  const myScore = getScoreValue(mine?.score);
  const oppScore = getScoreValue(opp?.score);
  if (state === "in") return { state: "in", vs, myScore, oppScore };
  const result = mine?.winner === true ? "W" : mine?.winner === false ? "L" : "";
  return { state: "post", vs, myScore, oppScore, result };
}

async function fetchTeam(t) {
  try {
    const url = `https://site.api.espn.com/apis/site/v2/sports/${t.sport}/${t.league}/teams/${t.id}/schedule`;
    const r = await fetch(url, { headers: HEADERS });
    if (!r.ok) return { team: t.team, recent: null, upcoming: null };
    const j = await r.json();
    const myId = j.team?.id || t.id;
    const events = j.events || [];
    const now = Date.now();

    const scheduleLive = events.find((e) => e.competitions?.[0]?.status?.type?.state === "in");
    const scheduleCompleted = events
      .filter((e) => e.competitions?.[0]?.status?.type?.completed || e.competitions?.[0]?.status?.type?.state === "post")
      .sort((a, b) => new Date(b.date) - new Date(a.date));
    const scheduleUpcoming = events
      .filter((e) => e.competitions?.[0]?.status?.type?.state === "pre" && new Date(e.date).getTime() > now)
      .sort((a, b) => new Date(a.date) - new Date(b.date));

    let recent = null;
    let upcoming = null;

    if (scheduleLive) {
      recent = buildGame(scheduleLive, myId, "in");
    } else if (scheduleCompleted.length) {
      recent = buildGame(scheduleCompleted[0], myId, "post");
    }

    if (scheduleUpcoming.length) {
      upcoming = buildGame(scheduleUpcoming[0], myId, "pre");
    }

    if (!recent || !upcoming) {
      const fallbackEvents = await fetchScoreboardFallback(t, now);

      if (!recent) {
        const fallbackLive = fallbackEvents.find((e) => e.competitions?.[0]?.status?.type?.state === "in");
        const fallbackCompleted = fallbackEvents
          .filter((e) => e.competitions?.[0]?.status?.type?.completed || e.competitions?.[0]?.status?.type?.state === "post")
          .sort((a, b) => new Date(b.date) - new Date(a.date));
        if (fallbackLive) {
          recent = buildGame(fallbackLive, myId, "in");
        } else if (fallbackCompleted.length) {
          recent = buildGame(fallbackCompleted[0], myId, "post");
        }
      }

      if (!upcoming) {
        const fallbackUpcoming = fallbackEvents
          .filter((e) => e.competitions?.[0]?.status?.type?.state === "pre" && new Date(e.date).getTime() > now)
          .sort((a, b) => new Date(a.date) - new Date(b.date));
        if (fallbackUpcoming.length) {
          upcoming = buildGame(fallbackUpcoming[0], myId, "pre");
        }
      }
    }

    return { team: t.team, recent, upcoming };
  } catch {
    return { team: t.team, recent: null, upcoming: null };
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
