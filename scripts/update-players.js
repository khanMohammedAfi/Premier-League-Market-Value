 const fs = require("fs");
const token = process.env.FOOTBALL_DATA_TOKEN;

function ageFrom(dateOfBirth) {
  const born = new Date(dateOfBirth);
  const now = new Date();
  let age = now.getFullYear() - born.getFullYear();
  const beforeBirthday =
    now.getMonth() < born.getMonth() ||
    (now.getMonth() === born.getMonth() && now.getDate() < born.getDate());
  if (beforeBirthday) age--;
  return age;
}

async function main() {
  const response = await fetch(
    "https://api.football-data.org/v4/competitions/PL/scorers?limit=50",
    { headers: { "X-Auth-Token": token } }
  );

  if (!response.ok) {
    console.log("Request failed with status", response.status);
    return;
  }

  const data = await response.json();

  const byId = {};
  for (const entry of data.scorers) {
    byId[entry.player.id] = entry;
  }

  const players = JSON.parse(fs.readFileSync("data/players.json", "utf8"));

  for (const player of players) {
    if (!player.apiId || player.position === "GK") continue;

    const entry = byId[player.apiId];
    if (!entry) {
      console.log("Not in top 50 scorers, keeping old stats:", player.name);
      continue;
    }

    player.appearances = entry.playedMatches;
    player.goals = entry.goals;
    player.age = ageFrom(entry.player.dateOfBirth);
    console.log("Updated", player.name);
  }

  fs.writeFileSync("data/players.json", JSON.stringify(players, null, 2));
}

main();