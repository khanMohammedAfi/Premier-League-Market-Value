  const fs = require("fs");
const token = process.env.FOOTBALL_DATA_TOKEN;

async function main() {
  const response = await fetch(
    "https://api.football-data.org/v4/competitions/PL/matches?status=SCHEDULED",
    { headers: { "X-Auth-Token": token } }
  );

  if (!response.ok) {
    console.log("Request failed with status", response.status);
    return;
  }

  const data = await response.json();

  const fixtures = data.matches
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

  fs.writeFileSync("data/fixtures.json", JSON.stringify(fixtures, null, 2));
  console.log("Saved", fixtures.length, "fixtures to data/fixtures.json");
}

main();