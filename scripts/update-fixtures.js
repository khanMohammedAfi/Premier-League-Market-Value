 const fs = require("fs");
const token = process.env.FOOTBALL_DATA_TOKEN;

async function main() {
  // CHANGED: no ?status=SCHEDULED filter, so we get finished matches too
  const response = await fetch(
    "https://api.football-data.org/v4/competitions/PL/matches",
    { headers: { "X-Auth-Token": token } }
  );

  if (!response.ok) {
    console.log("Request failed with status", response.status);
    return;
  }

  const data = await response.json();

  // 1) Your original file: next 10 upcoming matches (same output as before)
  const upcoming = data.matches
    .filter(m => m.status === "SCHEDULED" || m.status === "TIMED")
    .sort((a, b) => new Date(a.utcDate) - new Date(b.utcDate))
    .slice(0, 10)
    .map(m => ({
      date: m.utcDate,
      matchday: m.matchday,
      home: m.homeTeam.shortName,
      homeCrest: m.homeTeam.crest,
      away: m.awayTeam.shortName,
      awayCrest: m.awayTeam.crest
    }));

  fs.writeFileSync("data/fixtures.json", JSON.stringify(upcoming, null, 2));
  console.log("Saved", upcoming.length, "fixtures to data/fixtures.json");

  // 2) NEW: every match, used when you click a club
  const all = data.matches.map(m => ({
    date: m.utcDate,
    status: m.status,
    matchday: m.matchday,
    homeId: m.homeTeam.id,
    home: m.homeTeam.shortName,
    homeCrest: m.homeTeam.crest,
    awayId: m.awayTeam.id,
    away: m.awayTeam.shortName,
    awayCrest: m.awayTeam.crest,
    homeGoals: m.score.fullTime.home,
    awayGoals: m.score.fullTime.away
  }));

  fs.writeFileSync("data/club-fixtures.json", JSON.stringify(all, null, 2));
  console.log("Saved", all.length, "matches to data/club-fixtures.json");
}

main();