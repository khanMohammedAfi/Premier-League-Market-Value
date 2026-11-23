 const fs = require("fs");

const URL = "https://fantasy.premierleague.com/api/bootstrap-static/";
const PHOTO_BASE = "https://resources.premierleague.com/premierleague/photos/players/110x140/p";

// "Rayan Aït-Nouri" -> "rayan ait nouri"
const norm = s => (s || "").toLowerCase()
  .replace(/ø/g, "o").replace(/ß/g, "ss").replace(/ł/g, "l").replace(/đ/g, "d")
  .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
  .replace(/-/g, " ").replace(/[^a-z ]/g, "").replace(/\s+/g, " ").trim();

// FPL and football-data.org write club names differently
const CLUB_ALIASES = {
  "man utd": "man united", "spurs": "tottenham", "nottm forest": "nottingham",
  "nottingham forest": "nottingham", "wolves": "wolverhampton", "man city": "man city",
};
const normClub = s => {
  const c = norm(s).replace(/\b(football club|fc|afc|and|the)\b/g, "").replace(/\s+/g, " ").trim();
  return CLUB_ALIASES[c] || c;
};
const clubsMatch = (a, b) => a && b && (a === b || a.includes(b) || b.includes(a));

const ageFrom = s => {
  if (!s) return null;
  const d = new Date(s);
  return isNaN(d) ? null : Math.floor((Date.now() - d) / 31557600000);
};
// Same person? Ages within 1 year (or unknown on either side).
const ageOk = (a, p) => a == null || p.age == null || Math.abs(a - p.age) <= 1;

async function main() {
  const res = await fetch(URL, { headers: { "User-Agent": "Mozilla/5.0 (student project)" } });
  if (!res.ok) { console.log("FPL request failed with status", res.status); return; }
  const data = await res.json();
  if (!data.elements || data.elements.length === 0) { console.log("FPL returned no players"); return; }

  const teamClub = new Map(data.teams.map(t => [t.id, normClub(t.name)]));
  const fpl = data.elements.map(e => ({
    raw: e,
    full: norm(e.first_name + " " + e.second_name),
    web: norm(e.web_name),
    surname: norm(e.second_name),
    initial: norm(e.first_name).charAt(0),
    club: teamClub.get(e.team),
    age: ageFrom(e.birth_date),
  }));

  // Four steps, safest first. Each only counts if it finds exactly one player.
  function find(p) {
    const n = norm(p.name), c = normClub(p.club);
    const last = n.split(" ").pop(), init = n.charAt(0);
    let hits;

    hits = fpl.filter(f => f.full === n && clubsMatch(f.club, c));
    if (hits.length === 1) return hits[0];

    hits = fpl.filter(f => clubsMatch(f.club, c) && ageOk(f.age, p) && f.initial === init &&
      (f.surname.split(" ").includes(last) || f.web.split(" ").includes(last)));
    if (hits.length === 1) return hits[0];

    hits = fpl.filter(f => f.full === n && ageOk(f.age, p));
    if (hits.length === 1) return hits[0];

    hits = fpl.filter(f => clubsMatch(f.club, c) && ageOk(f.age, p) && (f.web === n || f.surname === n));
    if (hits.length === 1) return hits[0];

    return null;
  }

  const squads = JSON.parse(fs.readFileSync("data/squads.json", "utf8"));
  let matched = 0;
  const unmatched = [];
  let samplePhoto = null;

  for (const p of squads) {
    const f = find(p);
    if (!f) { unmatched.push(p.apiId + "  " + p.name + " (" + p.club + ")"); continue; }
    const e = f.raw;
    p.appearances = e.starts;          // kept under the old name so app.js needs no change
    p.minutes = e.minutes;
    p.goals = e.goals_scored;
    p.assists = e.assists;
    if (e.photo) {
      p.photo = PHOTO_BASE + e.photo.replace(/\.jpg$/, "") + ".png";
      if (!samplePhoto) samplePhoto = p.photo;
    }
    matched++;
  }

  fs.writeFileSync("data/squads.json", JSON.stringify(squads, null, 2));
  console.log("FPL stats and photos set for " + matched + " of " + squads.length + " players");
  if (samplePhoto) console.log("Sample photo URL to test in your browser:", samplePhoto);
  if (unmatched.length) console.log("No FPL match for:\n  " + unmatched.join("\n  "));
}

main().catch(err => console.log("FPL stats skipped:", err.message));