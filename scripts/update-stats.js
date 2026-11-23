 const fs = require("fs");

const token = process.env.FOOTBALL_DATA_TOKEN;
const URL = "https://api.football-data.org/v4/competitions/PL/scorers?limit=500";

async function main() {
  const response = await fetch(URL, { headers: { "X-Auth-Token": token } });
  if (!response.ok) {
    console.log("Stats request failed with status", response.status);
    return;                      // keep the old squads.json untouched
  }

  const data = await response.json();
  const scorers = data.scorers || [];
  console.log("Scorers returned:", scorers.length);

  // Look scorers up by player id, which is the same id as apiId in squads.json
  const byId = new Map(scorers.map(s => [s.player.id, s]));

  const squads = JSON.parse(fs.readFileSync("data/squads.json", "utf8"));
  const fullList = scorers.length > 50;   // if the limit was ignored we only got 10, so don't guess

  let withStats = 0;
  for (const p of squads) {
    const s = byId.get(p.apiId);
    if (s) {
      p.appearances = s.playedMatches ?? null;
      p.goals = s.goals ?? 0;
      p.assists = s.assists ?? null;
      withStats++;
    } else if (fullList) {
      p.goals = 0;               // not in the full scorers list means no goals
      delete p.appearances;
      delete p.assists;
    }
  }

  fs.writeFileSync("data/squads.json", JSON.stringify(squads, null, 2));
  console.log("Stats set for " + withStats + " of " + squads.length + " players");
}

main().catch(err => console.log("Stats skipped:", err.message));