 const token = process.env.FOOTBALL_DATA_TOKEN;

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

  for (const team of data.teams) {
    for (const player of team.squad) {
      console.log(player.id, player.name, "|", team.shortName);
    }
  }
}

main();