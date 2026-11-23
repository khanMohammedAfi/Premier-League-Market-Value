 const fs = require("fs");
const token = process.env.FOOTBALL_DATA_TOKEN;

function ageFrom(dateOfBirth) {
  if (!dateOfBirth) return null;
  const born = new Date(dateOfBirth);
  const now = new Date();
  let age = now.getFullYear() - born.getFullYear();
  const hadBirthday =
    now.getMonth() > born.getMonth() ||
    (now.getMonth() === born.getMonth() && now.getDate() >= born.getDate());
  if (!hadBirthday) age--;
  return age;
}

function shortPosition(position) {
  if (!position) return "-";
  if (position.includes("Goalkeeper")) return "GK";
  if (position.includes("Defen") || position.includes("Back")) return "DF";
  if (position.includes("Midfield")) return "MF";
  if (position.includes("Offence") || position.includes("Forward") ||
      position.includes("Winger") || position.includes("Striker")) return "FW";
  return "-";
}

async function main() {
  const response = await fetch(
    "https://api.football-data.org/v4/competitions/PL/teams",
    { headers: { "X-Auth-Token": token } }
  );

  if (!response.ok) {
    console.log("Request failed with status", response.status);
    return;
  }

  const data = await response.json();
  const players = [];

  for (const team of data.teams) {
    for (const p of team.squad || []) {
      players.push({
        apiId: p.id,
        name: p.name,
        club: team.shortName,
        crest: team.crest,
        position: shortPosition(p.position),
        age: ageFrom(p.dateOfBirth),
        nationality: p.nationality
      });
    }
  }

  if (players.length === 0) {
    console.log("No players found, keeping the old squads.json");
    return;
  }

    // Keep values/photos from the previous file, so a failed values download never blanks them
  let old = [];
  try { old = JSON.parse(fs.readFileSync("data/squads.json", "utf8")); } catch (e) {}
  const oldById = new Map(old.map(o => [o.apiId, o]));
  for (const p of players) {
  const o = oldById.get(p.apiId);
  if (!o) continue;
  for (const key of ["value", "photo", "appearances", "goals", "assists"]) {
    if (o[key] !== undefined) p[key] = o[key];
  }
}

  fs.writeFileSync("data/squads.json", JSON.stringify(players, null, 2));
  console.log("Saved", players.length, "players from", data.teams.length, "clubs");
}

main();