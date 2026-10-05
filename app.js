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

function loadPhoto(player, img) {
  const title = encodeURIComponent(player.name.replace(/ /g, "_"));
  fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${title}`)
    .then(response => response.json())
    .then(data => {
      if (data.thumbnail) {
        img.src = data.thumbnail.source;
      }
    })
    .catch(() => {});
}

function renderPlayers(list) {
  playersBody.innerHTML = "";
  list.forEach(player => {
    const row = document.createElement("tr");
    row.innerHTML = `
   <td><img alt="${player.name}" class="player-photo"></td>
      <td>${player.name}</td>
      <td>${player.club}</td>
      <td>${player.position}</td>
      <td>${player.age}</td>
      <td>${player.appearances}</td>
      <td>${player.goals}</td>
      <td>${player.assists}</td>
      <td>${euro.format(player.value)}</td>
    `;
    playersBody.appendChild(row);
    loadPhoto(player, row.querySelector(".player-photo"));
        row.addEventListener("click", () => {
      showDashboard(player, row.querySelector(".player-photo").src);
    });
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

function showDashboard(player, photoUrl) {
  document.getElementById("dash-name").textContent = player.name;

  const dashPhoto = document.getElementById("dash-photo");
  if (photoUrl) {
    dashPhoto.src = photoUrl;
  } else {
    dashPhoto.removeAttribute("src");
  }

  document.getElementById("dash-info").textContent =
    `${player.club} | ${player.position} | Age ${player.age} | ${euro.format(player.value)}`;

  document.getElementById("dash-stats").innerHTML = `
    <li>Appearances: ${player.appearances}</li>
    <li>Goals: ${player.goals}</li>
    <li>Assists: ${player.assists}</li>
  `;

  document.getElementById("dash-latest").textContent =
    player.latest || "No recent news added yet.";

  const dashboard = document.getElementById("player-dashboard");
  dashboard.hidden = false;
  dashboard.scrollIntoView({ behavior: "smooth" });
}

document.getElementById("close-dashboard").addEventListener("click", () => {
  document.getElementById("player-dashboard").hidden = true;
});