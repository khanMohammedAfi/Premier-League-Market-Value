 const fs = require("fs");
const token = process.env.FOOTBALL_DATA_TOKEN;

function readJson(path, fallback) {
  try {
    return JSON.parse(fs.readFileSync(path, "utf8"));
  } catch (error) {
    return fallback;
  }
}

// The newest snapshot taken on or before the cutoff date, else the oldest we have
function pickBaseline(history, cutoff) {
  const older = history.filter(h => h.date <= cutoff);
  return older.length > 0 ? older[older.length - 1] : history[0];
}

// Goals scored between the baseline snapshot and the latest one
function leadersFrom(latest, baseline) {
  const before = {};
  for (const p of baseline.scorers) {
    before[p.id] = p.goals;
  }
  return latest.scorers
    .map(p => ({ name: p.name, team: p.team, goals: p.goals - (before[p.id] || 0) }))
    .filter(p => p.goals > 0)
    .sort((a, b) => b.goals - a.goals)
    .slice(0, 10);
}

async function main() {
  const response = await fetch(
    "https://api.football-data.org/v4/competitions/PL/scorers?limit=300",
    { headers: { "X-Auth-Token": token } }
  );

  if (!response.ok) {
    console.log("Request failed with status", response.status);
    return;
  }

  const data = await response.json();
  const today = new Date().toISOString().slice(0, 10);

  const snapshot = {
    date: today,
    scorers: data.scorers.map(s => ({
      id: s.player.id,
      name: s.player.name,
      team: s.team.shortName,
      goals: s.goals,
      played: s.playedMatches
    }))
  };

  // One snapshot per day, keep the last 60 days
  let history = readJson("data/history.json", []);
  history = history.filter(h => h.date !== today);
  history.push(snapshot);
  history.sort((a, b) => a.date.localeCompare(b.date));
  history = history.slice(-60);
  fs.writeFileSync("data/history.json", JSON.stringify(history));

  // Baselines: a week ago, and the end of last month
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 86400000).toISOString().slice(0, 10);
  const lastMonthEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 0))
    .toISOString().slice(0, 10);

  const weekBase = pickBaseline(history, weekAgo);
  const monthBase = pickBaseline(history, lastMonthEnd);

  const leaders = {
    updated: now.toISOString(),
    week: { since: weekBase.date, leaders: leadersFrom(snapshot, weekBase) },
    month: { since: monthBase.date, leaders: leadersFrom(snapshot, monthBase) }
  };

  fs.writeFileSync("data/leaders.json", JSON.stringify(leaders, null, 2));
  console.log("Snapshots saved:", history.length);
  console.log("Weekly leaders since", weekBase.date, ":", leaders.week.leaders.length);
}

main();