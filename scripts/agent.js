 const fs = require("fs");
const { execSync } = require("child_process");

const ENDPOINT = "https://oai-plmv-afi.openai.azure.com";
const DEPLOYMENT = "summary-model";

function readJson(path) {
  return JSON.parse(fs.readFileSync(path, "utf8"));
}

function getToken() {
  return execSync(
    "az account get-access-token --resource https://cognitiveservices.azure.com --query accessToken -o tsv"
  ).toString().trim();
}

async function summarise(items) {
  const response = await fetch(
    `${ENDPOINT}/openai/deployments/${DEPLOYMENT}/chat/completions?api-version=2024-10-21`,
    {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${getToken()}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        messages: [
          {
            role: "system",
            content: "You write short news blurbs for a Premier League stats website. Use only the facts given. Do not add names, numbers, time periods (such as 'this week' or 'this season'), opinions or praise. Write 1 to 2 plain sentences."
          },
          { role: "user", content: "Changes since the last update:\n" + items.join("\n") }
        ],
        max_tokens: 150
      })
    }
  );

  if (!response.ok) {
    throw new Error("OpenAI request failed with status " + response.status);
  }

  const data = await response.json();
  return data.choices[0].message.content;
}

function valueMovers(history, days = 30) {
  if (history.length < 2) return { windowDays: 0, risers: [], fallers: [] };

  const latest = history[history.length - 1];
  const cutoff = new Date(latest.date).getTime() - days * 86400000;

  // newest snapshot that is at least `days` old; if the history is
  // younger than that, fall back to the oldest snapshot we have
  const older = [...history].reverse()
    .find(s => new Date(s.date).getTime() <= cutoff) || history[0];

  const windowDays = Math.round(
    (new Date(latest.date) - new Date(older.date)) / 86400000
  );

  const movers = [];
  for (const [id, now] of Object.entries(latest.values)) {
    const before = older.values[id];
    if (!before) continue;
    const change = now - before;
    const pct = (change / before) * 100;
    if (Math.abs(pct) >= 10 && Math.abs(change) >= 2000000) {
      movers.push({ id, before, now, change, pct: Math.round(pct) });
    }
  }

  movers.sort((a, b) => b.change - a.change);
  return {
    windowDays,
    risers: movers.filter(m => m.change > 0).slice(0, 5),
    fallers: movers.filter(m => m.change < 0).slice(-5).reverse()
  };
}

function valueLines(movers) {
  const fmt = n => "€" + (n / 1000000) + "M";
  return [...movers.risers, ...movers.fallers].map(m =>
    `${m.name} value went from ${fmt(m.before)} to ${fmt(m.now)} (${m.pct}%)`
  );
}
function reasonFor(clubId, fixtures, direction) {
  // this club's finished matches, newest first
  const played = fixtures
    .filter(m => m.status === "FINISHED" &&
                 (m.homeId === clubId || m.awayId === clubId))
    .sort((a, b) => new Date(b.date) - new Date(a.date));

  const m = played[0];
  if (!m) return null;

  // ignore old matches: if it was over 4 days ago, it didn't cause this move
  const ageDays = (Date.now() - new Date(m.date)) / 86400000;
  if (ageDays > 4) return null;

  const isHome = m.homeId === clubId;
  const mine = isHome ? m.homeGoals : m.awayGoals;
  const theirs = isHome ? m.awayGoals : m.homeGoals;
  const opponent = isHome ? m.away : m.home;
  const where = isHome ? "at home" : "away";
  const score = mine + "-" + theirs;

  if (mine > theirs) return `Beat ${opponent} ${score} ${where}`;
  if (mine < theirs) return `Lost ${score} to ${opponent} ${where}`;
  return `Drew ${score} with ${opponent} ${where}`;
}

async function main() {
  // 1. Remember how things looked before
  const oldTable = readJson("data/table.json");
  const oldMovers = fs.existsSync("data/movers.json") ? readJson("data/movers.json") : null;
  const oldPlayers = readJson("data/players.json");

  // 2. Refresh the data
  execSync("node scripts/update-table.js", { stdio: "inherit" });
  try { execSync("node scripts/update-fixtures.js", { stdio: "inherit" }); }
catch (error) { console.log("Fixtures skipped:", error.message); }
  execSync("node scripts/update-players.js", { stdio: "inherit" });
  execSync("node scripts/update-leaders.js", { stdio: "inherit" });
  execSync("node scripts/update-news.js", { stdio: "inherit" });
execSync("node scripts/update-awards.js", { stdio: "inherit" });
execSync("node scripts/update-squads.js", { stdio: "inherit" });
try { execSync("node scripts/update-stats.js", { stdio: "inherit" }); }
catch (error) { console.log("Stats skipped:", error.message); }
try { execSync("node scripts/update-fpl.js", { stdio: "inherit" }); }
catch (error) { console.log("FPL stats skipped:", error.message); }
try { execSync("node scripts/update-values.js", { stdio: "inherit" }); }
catch (error) { console.log("Market values skipped:", error.message); }
// Head-to-head history only changes when matches finish, so refresh it
// on Mondays (or if the file is missing) instead of on every daily run
const isMonday = new Date().getUTCDay() === 1;
if (isMonday || !fs.existsSync("data/h2h.json")) {
  try { execSync("node scripts/update-h2h.js", { stdio: "inherit" }); }
  catch (error) { console.log("Head-to-head skipped:", error.message); }
}
try { execSync("node scripts/update-predictions.js", { stdio: "inherit" }); }
catch (error) { console.log("Predictions skipped:", error.message); }
try { execSync("node scripts/update-transfers.js", { stdio: "inherit" }); }
catch (error) { console.log("Transfers skipped:", error.message); }

  // 3. Compare before and after
  const newTable = readJson("data/table.json");
  const newPlayers = readJson("data/players.json");
  const items = [];

    const fixtures = fs.existsSync("data/club-fixtures.json")
    ? readJson("data/club-fixtures.json") : [];
  const moves = [];

  for (const club of newTable) {
    const before = oldTable.find(c => c.club === club.club);
    if (before && before.position !== club.position) {
      const direction = club.position < before.position ? "up" : "down";
      const reason = reasonFor(club.id, fixtures, direction);

      moves.push({
        club: club.club,
        crest: club.crest,
        from: before.position,
        to: club.position,
        reason
      });

      items.push(
        `${club.club} moved from ${before.position} to ${club.position}` +
        (reason ? ` (${reason})` : "")
      );
    }
  }

  for (const player of newPlayers) {
    const before = oldPlayers.find(p => p.name === player.name);
    if (before && player.goals > before.goals) {
      const extra = player.goals - before.goals;
      items.push(`${player.name} scored ${extra} more (now ${player.goals})`);
    }
  }

  // 4. Player value movers (history was updated by update-predictions.js above)
const playerMovers = valueMovers(readJson("data/values-history.json"), 30);
const squads = readJson("data/squads.json");
const byId = {};
for (const p of squads) byId[p.apiId] = p;

for (const m of [...playerMovers.risers, ...playerMovers.fallers]) {
  const p = byId[m.id];
  m.name = p ? p.name : "Unknown player";
  m.club = p ? p.club : "";
  m.photo = p ? p.photo : null;
}

const hasChanges = items.length > 0;
let summary = null;
let lastChange = null;
let movesToSave = moves;

if (hasChanges) {
  lastChange = new Date().toISOString();
  try {
    summary = await summarise([...items, ...valueLines(playerMovers)]);
  } catch (error) {
    console.log("Summary skipped:", error.message);
  }
} else if (oldMovers && oldMovers.lastChange) {
  // nothing new, so keep showing the last real changes
  items.push(...oldMovers.items);
    movesToSave = oldMovers.moves || [];
  summary = oldMovers.summary;
  lastChange = oldMovers.lastChange;
} else {
  items.push("No changes since the last update.");
}

// 5. Write the result for the website
const movers = {
  updated: new Date().toISOString(),
  lastChange,
  summary,
  items,
    moves: movesToSave,
  players: playerMovers
};
fs.writeFileSync("data/movers.json", JSON.stringify(movers, null, 2));
console.log("Market movers:", items);
}

main();