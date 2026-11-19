 const token = process.env.FOOTBALL_DATA_TOKEN;

async function main() {
  const response = await fetch(
    "https://api.football-data.org/v4/competitions/PL/scorers?limit=20",
    { headers: { "X-Auth-Token": token } }
  );

  if (!response.ok) {
    console.log("Request failed with status", response.status);
    return;
  }

  const data = await response.json();

  data.scorers.forEach((entry, index) => {
    console.log(
      index + 1,
      entry.player.name,
      "| id", entry.player.id,
      "|", entry.team.shortName,
      "|", entry.goals, "goals"
    );
  });
}

main();