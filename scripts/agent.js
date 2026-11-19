 const fs = require("fs");
const { execSync } = require("child_process");

function readJson(path) {
  return JSON.parse(fs.readFileSync(path, "utf8"));
}

// 1. Remember how things looked before
const oldTable = readJson("data/table.json");
const oldPlayers = readJson("data/players.json");

// 2. Refresh the data
execSync("node scripts/update-table.js", { stdio: "inherit" });
execSync("node scripts/update-players.js", { stdio: "inherit" });

// 3. Compare before and after
const newTable = readJson("data/table.json");
const newPlayers = readJson("data/players.json");
const items = [];

for (const club of newTable) {
  const before = oldTable.find(c => c.club === club.club);
  if (before && before.position !== club.position) {
    items.push(`${club.club} moved from ${before.position} to ${club.position}`);
  }
}

for (const player of newPlayers) {
  const before = oldPlayers.find(p => p.name === player.name);
  if (before && player.goals > before.goals) {
    const extra = player.goals - before.goals;
    items.push(`${player.name} scored ${extra} more (now ${player.goals})`);
  }
}

if (items.length === 0) {
  items.push("No changes since the last update.");
}

// 4. Write the result for the website
const movers = { updated: new Date().toISOString(), items: items };
fs.writeFileSync("data/movers.json", JSON.stringify(movers, null, 2));
console.log("Market movers:", items);