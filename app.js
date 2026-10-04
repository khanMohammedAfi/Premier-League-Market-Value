// Fetch and display Premier League table data
const tableBody = document.getElementById("table-body");

fetch("data/table.json")
  .then(response => response.json())
  .then(clubs => {
    clubs.forEach(club => {
      const row = document.createElement("tr");
      row.innerHTML = `
        <td>${club.position}</td>
        <td>${club.club}</td>
        <td>${club.played}</td>
        <td>${club.won}</td>
        <td>${club.drawn}</td>
        <td>${club.lost}</td>
        <td>${club.gd}</td>
        <td>${club.points}</td>
      `;
      tableBody.appendChild(row);
    });
  })
  .catch(error => console.error("Could not load table data:", error));



  //Market value of players
  

  const playersBody = document.getElementById("players-body");
const valueHeader = document.getElementById("value-header");

const euro = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0
});

let playersData = [];
let descending = true;

function renderPlayers(list) {
  playersBody.innerHTML = "";
  list.forEach(player => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${player.name}</td>
      <td>${player.club}</td>
      <td>${player.position}</td>
      <td>${player.age}</td>
      <td>${euro.format(player.value)}</td>
    `;
    playersBody.appendChild(row);
  });
}

fetch("data/players.json")
  .then(response => response.json())
  .then(players => {
    playersData = players;
    renderPlayers(playersData);
  })
  .catch(error => console.error("Could not load player data:", error));

valueHeader.addEventListener("click", () => {
  playersData.sort((a, b) => descending ? b.value - a.value : a.value - b.value);
  descending = !descending;
  renderPlayers(playersData);
});