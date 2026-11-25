 const fs = require("fs");

const MIN_MINUTES = 450;                 // need ~5 full matches of play before a player is rated
const MIN_VALUE = 5000000;               // below this, percentages explode and values are coarse
const MAX_VALUE = 80000000;              // above this, price is brand and scarcity; too few examples to learn from
const GAP_LIMIT = Math.log(1.4);         // fair value must differ from current by 40% to be flagged
const RIDGE = 0.1;                       // keeps the model from over-reacting to a few players

function readJson(path, fallback) {
  try { return JSON.parse(fs.readFileSync(path, "utf8")); }
  catch (e) { return fallback; }
}

// Club strength: average log(value) of the player's teammates (not counting the player),
// compared with the league average. Captures club tier and reputation.
function clubStrength(valued) {
  const sum = {}, count = {};
  for (const p of valued) {
    sum[p.club] = (sum[p.club] || 0) + Math.log(p.value);
    count[p.club] = (count[p.club] || 0) + 1;
  }
  const globalMean = valued.reduce((s, p) => s + Math.log(p.value), 0) / valued.length;
  return p => {
    const others = count[p.club] - 1;
    return others > 0 ? (sum[p.club] - Math.log(p.value)) / others - globalMean : 0;
  };
}

// Turn a player into a row of numbers the model can use
function features(p, clubOf) {
  const minutes = p.minutes || 0;
  const per90 = x => (minutes >= 180 ? Math.min((x || 0) / (minutes / 90), 1.5) : 0);
  const a = ((p.age || 25) - 25) / 5;
  const g = per90(p.goals);
  const s = per90(p.assists);
  const gk = p.position === "GK" ? 1 : 0;
  const df = p.position === "DF" ? 1 : 0;
  const mf = p.position === "MF" ? 1 : 0;       // forwards are the baseline
  return [
    1,
    a,
    a * a,
    gk,
    df,
    mf,
    g,
    s,
    Math.log1p(minutes) / 7,
    clubOf(p),
    g * mf,     // extra weight for a midfielder's goals
    s * mf,     // extra weight for a midfielder's assists
    g * df,
    s * df
  ];
}

// Solve A x = b by Gaussian elimination
function solve(A, b) {
  const n = b.length;
  const M = A.map((row, i) => [...row, b[i]]);
  for (let c = 0; c < n; c++) {
    let pivot = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[pivot][c])) pivot = r;
    [M[c], M[pivot]] = [M[pivot], M[c]];
    for (let r = c + 1; r < n; r++) {
      const f = M[r][c] / M[c][c];
      for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k];
    }
  }
  const x = new Array(n).fill(0);
  for (let i = n - 1; i >= 0; i--) {
    let s = M[i][n];
    for (let k = i + 1; k < n; k++) s -= M[i][k] * x[k];
    x[i] = s / M[i][i];
  }
  return x;
}

// Ridge regression: find the weights that best explain log(value)
function fit(rows, ys) {
  const n = rows[0].length;
  const A = Array.from({ length: n }, () => new Array(n).fill(0));
  const b = new Array(n).fill(0);
  rows.forEach((x, i) => {
    for (let r = 0; r < n; r++) {
      b[r] += x[r] * ys[i];
      for (let c = 0; c < n; c++) A[r][c] += x[r] * x[c];
    }
  });
  for (let d = 1; d < n; d++) A[d][d] += RIDGE;   // do not shrink the baseline
  return solve(A, b);
}

const predict = (beta, x) => x.reduce((s, v, i) => s + v * beta[i], 0);

function main() {
  const players = readJson("data/squads.json", []);
  const valued = players.filter(p => p.value > 0);
  if (valued.length < 50) {
    console.log("Predictions skipped: only " + valued.length + " players have a value");
    return;
  }

  // 1. Learn from every player who has a value
  const clubOf = clubStrength(valued);
  const rows = valued.map(p => features(p, clubOf));
  const ys = valued.map(p => Math.log(p.value));
  const beta = fit(rows, ys);

  const meanY = ys.reduce((a, b) => a + b, 0) / ys.length;
  const ssTot = ys.reduce((s, y) => s + (y - meanY) ** 2, 0);
  const ssRes = ys.reduce((s, y, i) => s + (y - predict(beta, rows[i])) ** 2, 0);
  const r2 = 1 - ssRes / ssTot;

  // 2. Fair value for each player, and how far it is from the current value
    // 2. Fair value for each player, and how far it is from the current value
  const out = {};
  const rated = [];
  for (const p of valued) {
    const raw = Math.exp(predict(beta, features(p, clubOf)));
    const step = raw >= 5e6 ? 500000 : 100000;
    const fair = Math.max(step, Math.round(raw / step) * step);
    const gap = Math.log(fair / p.value);

    // Age outlook: same player, one year older, everything else held equal
    const older = { ...p, age: (p.age || 25) + 1 };
    const drift = Math.exp(predict(beta, features(older, clubOf)) - predict(beta, features(p, clubOf))) - 1;

    const entry = {
      name: p.name,
      club: p.club,
      position: p.position,
      value: p.value,
      fair,
      diffPct: Math.round((fair / p.value - 1) * 100),
      label: null,
      ageOutlook: drift >= 0.05 ? "Up" : drift <= -0.05 ? "Down" : "Flat",
      ageOutlookPct: Math.round(drift * 100)
    };
    const canRate = (p.minutes || 0) >= MIN_MINUTES
      && (p.position === "FW" || p.position === "MF")   // goals and assists say little about defenders and keepers
      && p.value >= MIN_VALUE && p.value <= MAX_VALUE;
    if (canRate) {
      entry.label = gap >= GAP_LIMIT ? "Undervalued" : gap <= -GAP_LIMIT ? "Overvalued" : "Fairly valued";
      rated.push({ id: p.apiId, gap, pos: p.position });
    }
    out[p.apiId] = entry;
  }

  rated.sort((a, b) => b.gap - a.gap);
  const undervalued = rated.filter(r => out[r.id].label === "Undervalued").slice(0, 5).map(r => r.id);
  const overvalued = rated.filter(r => out[r.id].label === "Overvalued").slice(-5).reverse().map(r => r.id);

    const byPosition = {};
  for (const pos of ["FW", "MF"]) {
    byPosition[pos] = {
      undervalued: rated.filter(r => r.pos === pos && out[r.id].label === "Undervalued").slice(0, 3).map(r => r.id),
      overvalued: rated.filter(r => r.pos === pos && out[r.id].label === "Overvalued").slice(-3).reverse().map(r => r.id)
    };
  }

  fs.writeFileSync("data/predictions.json", JSON.stringify({
    updated: new Date().toISOString(),
    model: {
      type: "ridge regression on log(market value)",
      inputs: "age, position, goals per 90, assists per 90, minutes played, club strength",
      trainedOn: valued.length,
      ratedPlayers: rated.length,
      r2: Number(r2.toFixed(2)),
      note: "A rough estimate from goals, assists and playing time. Only forwards and midfielders worth 5M-80M are rated; it cannot see defending, reputation or contracts."
    },
    undervalued,
    overvalued,
    byPosition,
    players: out
  }, null, 2));

  // 3. Phase 2: keep a daily snapshot of every value so trends can be shown later
  const today = new Date().toISOString().slice(0, 10);
  let history = readJson("data/values-history.json", []);
  history = history.filter(h => h.date !== today);
 const snap = { date: today, values: {}, stats: {} };
for (const p of valued) {
  snap.values[p.apiId] = p.value;
  snap.stats[p.apiId] = [p.goals || 0, p.assists || 0, p.minutes || 0];   // [goals, assists, minutes]
}
history.push(snap);
  history = history.slice(-90);
  fs.writeFileSync("data/values-history.json", JSON.stringify(history));

  console.log(`Predictions: trained on ${valued.length} players, R2 ${r2.toFixed(2)}, ` +
    `${rated.length} rated, ${undervalued.length} undervalued, ${overvalued.length} overvalued, ` +
    `${history.length} value snapshots kept`);
}

main();