 const fs = require('fs');
const zlib = require('zlib');

const CSV_URL = 'https://pub-e682421888d945d684bcae8890b0ec20.r2.dev/data/players.csv.gz';
const FILES = ['data/squads.json', 'data/players.json'];
const OVERRIDES_FILE = 'data/overrides.json';

function parseCsv(text) {
  const rows = [];
  let row = [], field = '', inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (ch === '"') inQuotes = false;
      else field += ch;
    } else if (ch === '"') inQuotes = true;
    else if (ch === ',') { row.push(field); field = ''; }
    else if (ch === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
    else if (ch !== '\r') field += ch;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  return rows;
}

// Lowercase, no accents, hyphens become spaces: "Rayan Aït-Nouri" -> "rayan ait nouri"
const norm = s => s.toLowerCase()
  .replace(/ø/g, 'o').replace(/ß/g, 'ss').replace(/ł/g, 'l').replace(/đ/g, 'd')
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .replace(/-/g, ' ')
  .replace(/[^a-z ]/g, '').replace(/\s+/g, ' ').trim();

// football-data.org uses short club names; the dataset uses long ones.
const CLUB_ALIASES = {
  'man city': 'manchester city',
  'man united': 'manchester united',
  'wolves': 'wolverhampton wanderers',
  'nottm forest': 'nottingham forest',
};
const normClub = s => {
  const c = norm(s).replace(/\b(football club|fc|afc|and|the)\b/g, '').replace(/\s+/g, ' ').trim();
  return CLUB_ALIASES[c] || c;
};
const clubsMatch = (a, b) => a && b && (a === b || a.includes(b) || b.includes(a));

// How many single-letter edits turn word a into word b?
function lev(a, b) {
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i]);
  for (let j = 1; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return dp[a.length][b.length];
}
const lastWord = s => s.split(' ').pop();

async function main() {
  const res = await fetch(CSV_URL);
  if (!res.ok) throw new Error('Download failed: ' + res.status);
  const csv = zlib.gunzipSync(Buffer.from(await res.arrayBuffer())).toString('utf8');
  const rows = parseCsv(csv);
  const header = rows[0];

  const col = name => {
    const i = header.indexOf(name);
    if (i === -1) throw new Error('Missing column: ' + name + '\nColumns are: ' + header.join(', '));
    return i;
  };
  const iName = col('name');
  const iClub = col('current_club_name');
  const iLeague = col('current_club_domestic_competition_id');
  const iValue = col('market_value_in_eur');

    const iDob = header.indexOf('date_of_birth');   // optional: used to sanity-check ages
  const ageFrom = s => {
    if (!s) return null;
    const d = new Date(s);
    if (isNaN(d)) return null;
    return Math.floor((Date.now() - d) / 31557600000);   // ms in a year
  };

  const gb1 = new Map();       // Premier League players, by name
  const anyMap = new Map();    // every league, by name
  const surnames = new Map();  // last word -> list of names (for close-spelling matches)
  for (const r of rows.slice(1)) {
    if (r[iValue] === '') continue;
    const k = norm(r[iName]);
        const entry = { club: normClub(r[iClub]), value: Number(r[iValue]),
                    age: iDob === -1 ? null : ageFrom(r[iDob]) };
    if (!anyMap.has(k)) {
      anyMap.set(k, []);
      const w = lastWord(k);
      if (!surnames.has(w)) surnames.set(w, []);
      surnames.get(w).push(k);
    }
    anyMap.get(k).push(entry);
    if (r[iLeague] === 'GB1') {
      if (!gb1.has(k)) gb1.set(k, []);
      gb1.get(k).push(entry);
    }
  }

    // Same person? Ages must be within 1 year (or unknown on either side).
  const ageOk = (e, p) => e.age == null || p.age == null || Math.abs(e.age - p.age) <= 1;

  function findValue(p) {
    const n = norm(p.name), c = normClub(p.club);

    // 1. Same name at the same club
    const same = (anyMap.get(n) || []).find(e => clubsMatch(e.club, c));
    if (same) return { value: same.value, how: 'exact' };

    // 2. Partial name at the same club ("Gabriel" vs "Gabriel Magalhaes")
    const hits = [];
    for (const [k, list] of gb1) {
      if (k.length < 4) continue;
      if (k.includes(n) || n.includes(k))
        for (const e of list) if (clubsMatch(e.club, c)) hits.push({ e, k });
    }
    if (hits.length === 1) return { value: hits[0].e.value, how: 'partial name', matched: hits[0].k };

        // 3. Only one person with this name whose age fits (their club may be out of date)
    const byAge = (anyMap.get(n) || []).filter(e => ageOk(e, p));
    if (byAge.length === 1) return { value: byAge[0].value, how: 'name only, dataset club differs' };

    
        // 4. Spelling one letter off, same surname, one candidate, age fits
    if (n.length >= 8) {
      const close = (surnames.get(lastWord(n)) || []).filter(k => lev(n, k) <= 1);
      if (close.length === 1) {
        const list = anyMap.get(close[0]).filter(e => ageOk(e, p));
        if (list.length === 1) return { value: list[0].value, how: 'close spelling', matched: close[0] };
      }
    }
    return null;
  }

  const overrides = fs.existsSync(OVERRIDES_FILE)
    ? JSON.parse(fs.readFileSync(OVERRIDES_FILE, 'utf8')) : {};

  const review = [];
  for (const file of FILES) {
    const players = JSON.parse(fs.readFileSync(file, 'utf8'));
    let matched = 0;
    const unmatched = [];
    for (const p of players) {
      const found = findValue(p);
      let v = found ? found.value : undefined;
      if (found && found.how !== 'exact' && file === 'data/squads.json')
        review.push(p.name + ' (' + p.club + ') <- ' + found.how + (found.matched ? ': ' + found.matched : ''));
      const o = overrides[p.apiId];                 // your hand-kept values win
      if (o && o.value !== undefined) v = o.value;
      if (o && o.photo) p.photo = o.photo;
      if (v !== undefined) { p.value = v; matched++; }
      else unmatched.push(p.apiId + '  ' + p.name + ' (' + p.club + ')');
    }
    fs.writeFileSync(file, JSON.stringify(players, null, 2));
    console.log(file + ': values set for ' + matched + ' of ' + players.length);
    if (unmatched.length) console.log('  Still no value:\n    ' + unmatched.join('\n    '));
  }
  if (review.length) console.log('\nMatches to double-check (' + review.length + '):\n  ' + review.join('\n  '));
}

main().catch(err => { console.error(err.message); process.exit(1); });