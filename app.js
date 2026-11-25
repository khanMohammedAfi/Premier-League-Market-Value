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
let playerNews = {};



// Simple silhouette, used when a player has no photo or the photo fails to load
const PLACEHOLDER_PHOTO = "data:image/svg+xml;utf8," + encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">' +
  '<rect width="100" height="100" fill="#3b2447"/>' +
  '<circle cx="50" cy="38" r="18" fill="#8a7a96"/>' +
  '<path d="M14 100c0-24 16-38 36-38s36 14 36 38z" fill="#8a7a96"/></svg>'
);

function loadPhoto(player, img) {
  // If the photo link is broken, swap in the silhouette instead of a broken-image icon
  img.onerror = () => { img.onerror = null; img.src = PLACEHOLDER_PHOTO; };
  img.src = player.photo || PLACEHOLDER_PHOTO;
}

function renderPlayers(list) {
  playersBody.innerHTML = "";
  list.forEach(player => {
    const row = document.createElement("tr");
    row.innerHTML = `
     <td><img alt="${player.name}" class="player-photo" loading="lazy"></td>
      <td>${player.name}</td>
      <td>${player.club}</td>
      <td>${player.position}</td>
      <td>${player.age}</td>
            <td>${player.appearances ?? "-"}</td>
      <td>${player.goals ?? "-"}</td>
            <td>${player.value != null ? euro.format(player.value) : "-"}</td>
    `;
    playersBody.appendChild(row);{
        loadPhoto(player, row.querySelector(".player-photo"));
    }
        row.addEventListener("click", () => {
      showDashboard(player, row.querySelector(".player-photo").src);
    });
  });
}

// A player "has news" if at least one story mentions them
function hasNews(player) {
  return (playerNews[player.name] || []).length > 0;
}

// Draws the "In the News" table with only those players
function renderNewsTab() {
  const list = playersData.filter(p => hasNews(p) && matchesSearch(p))
  document.getElementById("news-empty").hidden = list.length > 0;
  renderPlayers(list);
}


// ---------- Search ----------
let searchQuery = "";

// lowercase + strip accents so "moises" finds "Moisés"
function plain(text) {
  return String(text).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function matchesSearch(player) {
  const q = plain(searchQuery.trim());
  return !q || plain(player.name).includes(q) || plain(player.club).includes(q);
}

// ---------- All Players tab, grouped by club ----------
function renderAllTab() {
  const container = document.getElementById("clubs-container");
  container.innerHTML = "";

  const matches = playersData.filter(matchesSearch);
  document.getElementById("all-empty").hidden = matches.length > 0;

  // Group into { "Arsenal": [players], "Chelsea": [players], ... }
  const byClub = {};
  matches.forEach(p => {
    if (!byClub[p.club]) byClub[p.club] = [];
    byClub[p.club].push(p);
  });

  Object.keys(byClub).sort().forEach(clubName => {
    const players = byClub[clubName];
    players.sort((a, b) => (b.value ?? -1) - (a.value ?? -1));

    const details = document.createElement("details");
    details.className = "club";
    details.open = searchQuery.trim() !== "";   // auto-open clubs while searching

    const crestUrl = players[0].crest;
    const crest = crestUrl && crestUrl.startsWith("https://")
      ? `<img class="team-crest" src="${crestUrl}" alt="" loading="lazy" referrerpolicy="no-referrer">`
      : "";

    const summary = document.createElement("summary");
    summary.innerHTML = `${crest}${clubName} <span class="club-count">(${players.length})</span>`;
    details.appendChild(summary);

    players.forEach(player => {
      const row = document.createElement("div");
      row.className = "club-player";
      row.innerHTML = `
        <img alt="${player.name}" class="player-photo" loading="lazy">
        <div class="cp-name">${player.name}<small>${player.position} · Age ${player.age}</small></div>
        <div class="cp-value">${player.value != null ? euro.format(player.value) : "-"}</div>
      `;
      loadPhoto(player, row.querySelector(".player-photo"));
      row.addEventListener("click", () => {
        showDashboard(player, row.querySelector(".player-photo").src);
      });
      details.appendChild(row);
    });

    container.appendChild(details);
  });
}

document.getElementById("player-search").addEventListener("input", e => {
  searchQuery = e.target.value;
  renderNewsTab();
  renderAllTab();
});


Promise.all([
  fetch("data/squads.json").then(r => r.json()),
  fetch("data/players.json").then(r => r.json()),
  fetch("data/news.json").then(r => r.json())
])
  .then(([squads, curated, newsData]) => {
    playerNews = newsData.playerNews || {};

    const byId = {};
    curated.forEach(p => { byId[p.apiId] = p; });

    playersData = squads.map(s => {
      const c = byId[s.apiId] || {};
      return {
        ...s,
        value: c.value ?? s.value ?? null,
        appearances: c.appearances ?? s.appearances ?? null,
        goals: c.goals ?? s.goals ?? null,
        assists: c.assists ?? s.assists ?? null
      };
    });

    playersData.sort((a, b) => (b.value ?? -1) - (a.value ?? -1));
    renderNewsTab();
    renderAllTab();
  })
  .catch(error => console.error("Could not load player data:", error));

valueHeader.addEventListener("click", () => {
   playersData.sort((a, b) => descending
    ? (b.value ?? -1) - (a.value ?? -1)
    : (a.value ?? Infinity) - (b.value ?? Infinity));
  descending = !descending;
    renderNewsTab();
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
          <li>Starts: ${player.appearances ?? "-"}</li>
    <li>Minutes: ${player.minutes ?? "-"}</li>
    <li>Goals: ${player.goals ?? "-"}</li>
  
  `;

    const latest = document.getElementById("dash-latest");
  latest.innerHTML = "";
  const stories = playerNews[player.name] || [];

  if (stories.length === 0) {
    const none = document.createElement("li");
    none.textContent = "No recent headlines mention this player.";
    latest.appendChild(none);
  } else {
        stories.forEach(story => {
      if (!story.link.startsWith("https://")) return;

      const li = document.createElement("li");

      if (story.image && story.image.startsWith("https://")) {
        const img = document.createElement("img");
        img.src = story.image;
        img.alt = "";
        img.className = "news-thumb";
        img.loading = "lazy";
        img.referrerPolicy = "no-referrer";
        img.onerror = () => img.remove();
        li.appendChild(img);
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
      li.appendChild(text);
      latest.appendChild(li);
    });
  }

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

  // Upcoming fixtures
function crestImg(url) {
  if (!url || !url.startsWith("https://")) return null;
  const img = document.createElement("img");
  img.src = url;
  img.alt = "";
  img.className = "team-crest";
  img.loading = "lazy";
  img.referrerPolicy = "no-referrer";
  img.onerror = () => img.remove();
  return img;
}

fetch("data/fixtures.json")
  .then(response => response.json())
  .then(fixtures => {
    const list = document.getElementById("fixtures-list");

    if (fixtures.length === 0) {
      const empty = document.createElement("li");
      empty.textContent = "No upcoming fixtures right now.";
      list.appendChild(empty);
      return;
    }

        const upcoming = fixtures.filter(f => new Date(f.date) > new Date());

    if (upcoming.length === 0) {
      const empty = document.createElement("li");
      empty.textContent = "No upcoming fixtures right now.";
      list.appendChild(empty);
      return;
    }

    upcoming.forEach(f => {
      const li = document.createElement("li");

      const when = document.createElement("small");
      when.textContent = new Date(f.date).toLocaleString("en-GB", {
        weekday: "short", day: "numeric", month: "short",
        hour: "2-digit", minute: "2-digit",
        timeZoneName: "short"
      }) + " | Matchday " + f.matchday;

      const match = document.createElement("div");
      const homeImg = crestImg(f.homeCrest);
      const awayImg = crestImg(f.awayCrest);
      if (homeImg) match.appendChild(homeImg);
      match.appendChild(document.createTextNode(f.home + " v " + f.away + " "));
      if (awayImg) match.appendChild(awayImg);

      li.appendChild(when);
      li.appendChild(match);
      list.appendChild(li);
    });
  })
  .catch(error => console.error("Could not load fixtures:", error));

  // ---------- Tabs ----------
const tabBtnNews = document.getElementById("tab-btn-news");
const tabBtnAll = document.getElementById("tab-btn-all");
const viewNews = document.getElementById("view-news");
const viewAll = document.getElementById("view-all");

function showTab(which) {
  const showNews = which === "news";
  viewNews.hidden = !showNews;
  viewAll.hidden = showNews;
  tabBtnNews.classList.toggle("active", showNews);
  tabBtnAll.classList.toggle("active", !showNews);
}

tabBtnNews.addEventListener("click", () => showTab("news"));
tabBtnAll.addEventListener("click", () => showTab("all"));