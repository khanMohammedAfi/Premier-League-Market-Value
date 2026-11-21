 const fs = require("fs");

const token = process.env.FOOTBALL_DATA_TOKEN;
const BASE = "https://api.football-data.org/v4";
const DAYS = 30;

async function get(path) {
  const res = await fetch(BASE + path, { headers: { "X-Auth-Token": token } });
  if (!res.ok) throw new Error(path + " -> HTTP " + res.status);
  return res.json();
}

async function main() {
  const since = Date.now() - DAYS * 24 * 60 * 60 * 1000;

  const [matchData, teamData] = await Promise.all([
    get("/competitions/PL/matches?status=FINISHED"),
    get("/competitions/PL/teams"),
  ]);

  // Points each team won in the last 30 days
  const table = {};
  for (const m of matchData.matches) {
    if (new Date(m.utcDate) < since) continue;
    const winner = m.score.winner;
    const sides = [
      ["HOME_TEAM", m.homeTeam],
      ["AWAY_TEAM", m.awayTeam],
    ];
    for (const [side, team] of sides) {
      const t = (table[team.id] ??= { team: team.name, played: 0, won: 0, points: 0 });
      t.played++;
      if (winner === side) {
        t.won++;
        t.points += 3;
      } else if (winner === "DRAW") {
        t.points += 1;
      }
    }
  }

  // Manager of each team
  const coach = {};
  for (const t of teamData.teams) coach[t.id] = t.coach && t.coach.name;

  const managerNominees = Object.entries(table)
    .map(([id, t]) => ({ ...t, manager: coach[id] || null }))
    .filter((t) => t.played >= 3)
    .sort((a, b) => b.points - a.points || b.won - a.won)
    .slice(0, 3);

  // Player nominees come from the monthly leaders the other script already builds
  let playerNominees = [];
  try {
    const leaders = JSON.parse(fs.readFileSync("data/leaders.json", "utf8"));
    playerNominees = (leaders.month && leaders.month.leaders || []).slice(0, 3);
  } catch (e) {
    console.log("No leaders.json yet: " + e.message);
  }

  fs.writeFileSync(
    "data/awards.json",
    JSON.stringify(
      {
        updated: new Date().toISOString(),
        note: "Form-based picks from the last " + DAYS + " days, not the official awards",
        playerNominees,
        managerNominees,
      },
      null,
      2
    )
  );
  console.log(
    `Saved ${playerNominees.length} player and ${managerNominees.length} manager nominees`
  );
}

main().catch((e) => console.log("Awards skipped: " + e.message));