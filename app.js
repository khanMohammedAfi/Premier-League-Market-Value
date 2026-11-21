// Fetch and display Premier League table data
const tableBody = document.getElementById("table-body");

fetch("data/table.json")
  .then(response => response.json())
  .then(clubs => {
    clubs.forEach(club => {
      const row = document.createElement("tr");
      row.innerHTML = `
        <td>${club.position}</td>
                <td>${club.crest && club.crest.startsWith("https://") ? `<img class="team-crest" src="${club.crest}" alt="" loading="lazy" referrerpolicy="no-referrer">` : ""}${club.club}</td>
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
            <td>${player.appearances ?? "-"}</td>
      <td>${player.goals ?? "-"}</td>
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
      <li>Appearances: ${player.appearances ?? "-"}</li>
    <li>Goals: ${player.goals ?? "-"}</li>
  
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

fetch("data/movers.json")
  .then(response => response.json())
  .then(movers => {
    const box = document.getElementById("market-movers");
    box.innerHTML = "";

    if (movers.summary) {
      const paragraph = document.createElement("p");
      paragraph.textContent = movers.summary;
      box.appendChild(paragraph);
    }

    const list = document.createElement("ul");
    movers.items.forEach(item => {
      const li = document.createElement("li");
      li.textContent = item;
      list.appendChild(li);
    });
    box.appendChild(list);

    const stamp = document.createElement("small");
    stamp.textContent = "Updated " + new Date(movers.updated).toLocaleString();
    box.appendChild(stamp);
  })
  .catch(error => console.error("Could not load market movers:", error));


  // Latest news
const newsList = document.getElementById("news-list");

fetch("data/news.json")
  .then(response => response.json())
  .then(data => {
    data.news.forEach(story => {
      if (!story.link.startsWith("https://")) return;

      const item = document.createElement("li");

      if (story.image && story.image.startsWith("https://")) {
        const img = document.createElement("img");
        img.src = story.image;
        img.alt = "";
        img.className = "news-thumb";
        img.loading = "lazy";
        img.referrerPolicy = "no-referrer";
        img.onerror = () => img.remove();
        item.appendChild(img);
      }

      const text = document.createElement("div");

      const link = document.createElement("a");
      link.href = story.link;
      link.textContent = story.title;
      link.target = "_blank";
      link.rel = "noopener";

      const source = document.createElement("span");
      source.textContent = story.source;

      text.appendChild(link);
      text.appendChild(source);
      item.appendChild(text);
      newsList.appendChild(item);
    });
  })
  .catch(error => console.error("Could not load news:", error));

  // Top scorers
function fillLeaders(listId, period) {
  const list = document.getElementById(listId);

  if (!period.leaders || period.leaders.length === 0) {
    const empty = document.createElement("li");
    empty.textContent = "Nothing yet since " + period.since + ", check back after more matches.";
    list.appendChild(empty);
    return;
  }

  period.leaders.forEach(p => {
    const li = document.createElement("li");
    li.textContent = `${p.name} (${p.team}) - ${p.goals} ${p.goals === 1 ? "goal" : "goals"}`;
    list.appendChild(li);
  });
}

fetch("data/leaders.json")
  .then(response => response.json())
  .then(data => {
    fillLeaders("leaders-week", data.week);
    fillLeaders("leaders-month", data.month);
  })
  .catch(error => console.error("Could not load leaders:", error));


  // Awards (form-based nominees)
function fillAwards(listId, items, makeText) {
  const list = document.getElementById(listId);

  if (!items || items.length === 0) {
    const empty = document.createElement("li");
    empty.textContent = "No nominees yet, check back after more matches.";
    list.appendChild(empty);
    return;
  }

  items.forEach(item => {
    const li = document.createElement("li");
    li.textContent = makeText(item);
    list.appendChild(li);
  });
}

fetch("data/awards.json")
  .then(response => response.json())
  .then(data => {
    fillAwards("awards-player", data.playerNominees,
      p => `${p.name} (${p.team}) - ${p.goals} ${p.goals === 1 ? "goal" : "goals"}`);

    fillAwards("awards-manager", data.managerNominees,
      m => `${m.manager} (${m.team}) - ${m.won} wins from ${m.played}, ${m.points} points`);

    document.getElementById("awards-note").textContent = data.note;
  })
  .catch(error => console.error("Could not load awards:", error));