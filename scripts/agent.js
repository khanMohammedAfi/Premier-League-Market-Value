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

async function main() {
  // 1. Remember how things looked before
  const oldTable = readJson("data/table.json");
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

  // 4. Ask the AI to explain, but only if something changed
  const hasChanges = items.length > 0;
  if (!hasChanges) {
    items.push("No changes since the last update.");
  }

  let summary = null;
  if (hasChanges) {
    try {
      summary = await summarise(items);
    } catch (error) {
      console.log("Summary skipped:", error.message);
    }
  }

  // 5. Write the result for the website
  const movers = { updated: new Date().toISOString(), summary: summary, items: items };
  fs.writeFileSync("data/movers.json", JSON.stringify(movers, null, 2));
  console.log("Market movers:", items);
  if (summary) console.log("Summary:", summary);
}

main();