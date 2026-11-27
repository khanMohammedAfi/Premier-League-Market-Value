 const fs = require("fs");
const token = process.env.FOOTBALL_DATA_TOKEN;

// Past seasons to read. 2025 means the 2025-26 season.
const SEASONS = [2026,2025, 2024, 2023];

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function main() {
  let h2h = {};
if (fs.existsSync("data/h2h.json")) {
  h2h = JSON.parse(fs.readFileSync("data/h2h.json", "utf8"));
}

  for (const season of SEASONS) {
    const response = await fetch(
      `https://api.football-data.org/v4/competitions/PL/matches?season=${season}`,
      { headers: { "X-Auth-Token": token } }
    );

    if (!response.ok) {
      console.log("Season", season, "failed with status", response.status, "- skipping");
      continue;
    }

    const data = await response.json();
    let count = 0;

    for (const m of data.matches) {
      if (m.status !== "FINISHED") continue;

      // Key is the two club IDs, smaller first, so Man City v Ipswich
      // and Ipswich v Man City both land under the same key
      const a = m.homeTeam.id;
      const b = m.awayTeam.id;
      const key = a < b ? `${a}-${b}` : `${b}-${a}`;

            if (!h2h[key]) h2h[key] = [];
      if (h2h[key].some(x => x.date === m.utcDate)) continue;

      h2h[key].push({
        date: m.utcDate,
        homeId: a,
        home: m.homeTeam.shortName,
        awayId: b,
        away: m.awayTeam.shortName,
        homeGoals: m.score.fullTime.home,
        awayGoals: m.score.fullTime.away
      });
      count++;
    }

    console.log("Season", season, ":", count, "New Matches Added");
    await sleep(7000); // free tier allows about 10 requests a minute
  }

  // Newest meeting first for every pair
  for (const key in h2h) {
    h2h[key].sort((x, y) => new Date(y.date) - new Date(x.date));
  }

  fs.writeFileSync("data/h2h.json", JSON.stringify(h2h, null, 2));
  console.log("Saved", Object.keys(h2h).length, "club pairs to data/h2h.json");
}

main();