const fs = require("fs");
const token = process.env.FOOTBALL_DATA_TOKEN;

async function main() {
  const response = await fetch(
    "https://api.football-data.org/v4/competitions/PL/standings",
    { headers: { "X-Auth-Token": token } }
  );

  if (!response.ok) {
    console.log("Request failed with status", response.status);
    return;
  }

  const data = await response.json();
  const table = data.standings[0].table;

  const rows = table.map(row => ({
    position: row.position,
    club: row.team.shortName,
     crest: row.team.crest,
    played: row.playedGames,
    won: row.won,
    drawn: row.draw,
    lost: row.lost,
    gd: row.goalDifference,
    points: row.points
  }));

  fs.writeFileSync("data/table.json", JSON.stringify(rows, null, 2));
  console.log("Saved", rows.length, "clubs to data/table.json");
}

main();