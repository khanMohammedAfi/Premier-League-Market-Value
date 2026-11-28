 const fs = require("fs");
const { execSync } = require("child_process");

const ENDPOINT = "https://oai-plmv-afi.openai.azure.com";
const DEPLOYMENT = "summary-model";
const OUT = "data/transfers.json";

const MAX_AGE_DAYS = 10;   // only look at headlines this recent
const KEEP_DAYS = 14;      // keep rumours on the site this long
const MAX_ITEMS = 12;

const FEEDS = [
  { name: "BBC Sport", url: "https://feeds.bbci.co.uk/sport/football/rss.xml" },
  { name: "BBC Sport", url: "https://feeds.bbci.co.uk/sport/football/premier-league/rss.xml" },
  { name: "The Guardian", url: "https://www.theguardian.com/football/rss" },
  {
    name: "Google News",
    google: true, // titles look like "Headline - Publisher"
    url: "https://news.google.com/rss/search?q=" +
      encodeURIComponent("Premier League transfer OR loan when:7d") +
      "&hl=en-GB&gl=GB&ceid=GB:en"
  }
];

const KEYWORDS = /transfer|loan|sign|bid|deal|move|target|interest|fee|contract|join|swap|linked|want|eye|talks|agree|window|release clause|offer/i;
const TYPES = ["permanent", "loan", "contract"];
const STAGES = ["interest", "talks", "advanced", "agreed"];

function getToken() {
  return execSync(
    "az account get-access-token --resource https://cognitiveservices.azure.com --query accessToken -o tsv"
  ).toString().trim();
}

// ---------- RSS parsing (no dependencies) ----------
function clean(s) {
  return String(s || "")
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/<[^>]+>/g, " ")
    .replace(/&quot;/g, '"').replace(/&#0?39;|&apos;/g, "'").replace(/&amp;/g, "&")
    .replace(/\s+/g, " ").trim();
}

function tag(block, name) {
  const m = block.match(new RegExp("<" + name + "[^>]*>([\\s\\S]*?)</" + name + ">", "i"));
  return m ? clean(m[1]) : "";
}

async function readFeed(feed) {
  const res = await fetch(feed.url, { headers: { "User-Agent": "plmv-agent" } });
  if (!res.ok) throw new Error("status " + res.status);
  const xml = await res.text();
  const blocks = xml.match(/<item[\s\S]*?<\/item>/gi) || [];

  return blocks.map(b => {
    let title = tag(b, "title");
    let source = feed.name;
    if (feed.google) {
      const i = title.lastIndexOf(" - ");
      if (i > 0) { source = title.slice(i + 3); title = title.slice(0, i); }
    }
    const date = new Date(tag(b, "pubDate"));
    return {
      title,
      description: tag(b, "description").slice(0, 220),
      url: tag(b, "link"),
      source,
      time: date.getTime()
    };
  }).filter(h => h.title && /^https?:\/\//.test(h.url) && !isNaN(h.time));
}

async function collectHeadlines() {
  const cutoff = Date.now() - MAX_AGE_DAYS * 86400000;
  const seen = new Set();
  const all = [];

  for (const feed of FEEDS) {
    try {
      const items = await readFeed(feed);
      console.log(`${feed.name}: ${items.length} items`);
      for (const h of items) {
        if (h.time < cutoff || seen.has(h.url)) continue;
        if (!KEYWORDS.test(h.title + " " + h.description)) continue;
        seen.add(h.url);
        all.push(h);
      }
    } catch (error) {
      console.log(`Feed skipped (${feed.url}):`, error.message);
    }
  }
  if (all.length === 0) throw new Error("No headlines collected from any feed");

  return all.sort((a, b) => b.time - a.time).slice(0, 60)
    .map((h, i) => ({ ...h, id: i, date: new Date(h.time).toISOString().slice(0, 10) }));
}

// ---------- Model call ----------
async function extract(headlines) {
  const list = headlines
    .map(h => `[${h.id}] ${h.title}${h.description ? " — " + h.description : ""}`)
    .join("\n");

  const response = await fetch(
    `${ENDPOINT}/openai/deployments/${DEPLOYMENT}/chat/completions?api-version=2024-10-21`,
    {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${getToken()}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        response_format: { type: "json_object" },
        max_tokens: 2000,
        messages: [
          {
            role: "system",
            content:
              "You extract football transfer and loan rumours from numbered headlines. " +
              "Use ONLY information stated in the headline text. Never add names, clubs, fees or facts. " +
              "Include a story only if it names a specific player and a specific club he is linked with, " +
              "and at least one club involved is a Premier League club. Skip everything else. " +
              "Respond with JSON only, in this shape: " +
              '{"items":[{"id":number,"player":string,"from":string,"to":string,' +
              '"type":"permanent|loan|contract","stage":"interest|talks|advanced|agreed",' +
              '"summary":string}]}. ' +
              '"id" is the headline number. "from" is the player\'s current club ONLY if the headline states it, otherwise "". ' +
              '"to" is the linked club. For contract extension stories, "to" is the player\'s current club. ' +
              "Stage: interest = linked or monitoring, talks = discussions or bid made, advanced = agreement close, agreed = deal reported as agreed. " +
              "Write summary in your own words, max 20 words, no opinions."
          },
          { role: "user", content: list }
        ]
      })
    }
  );

  if (!response.ok) throw new Error("OpenAI request failed with status " + response.status);
  const data = await response.json();
  const parsed = JSON.parse(data.choices[0].message.content);
  return Array.isArray(parsed.items) ? parsed.items : [];
}

// ---------- Checks ----------
function surnameAppears(player, text) {
  const parts = String(player).trim().split(/\s+/);
  const last = parts[parts.length - 1].toLowerCase();
  return last.length >= 3 && text.toLowerCase().includes(last);
}

const PARTICLES = new Set(["de", "da", "do", "dos", "van", "von", "der", "di", "el", "al", "bin", "le", "la", "ten"]);
const GENERIC = /\b(former|ex|striker|midfielder|defender|winger|goalkeeper|keeper|forward|star|player|manager|boss|teenager|youngster|veteran|club|side|target|talent)\b/i;

function looksLikeName(name) {
  const words = String(name).trim().split(/\s+/);
  if (words.length < 1 || words.length > 4) return false;
  if (GENERIC.test(name)) return false;
  // every word (except particles like "de" or "van") must start with a capital
  return words.every(w => PARTICLES.has(w.toLowerCase()) || /^\p{Lu}/u.test(w));
}

function build(extracted, headlines, squads) {
  const byId = new Map(headlines.map(h => [h.id, h]));
  const norm = s => String(s).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
  const squadBy = new Map(squads.map(p => [norm(p.name), p]));
  const out = [];

  for (const e of extracted) {
    const h = byId.get(e.id);
    if (!h) continue;                                          // id must exist
    if (!e.player || !e.to) continue;
    if (!looksLikeName(e.player)) continue;                    // must look like a real name
    if (!TYPES.includes(e.type) || !STAGES.includes(e.stage)) continue;
    if (!surnameAppears(e.player, h.title + " " + h.description)) continue; // player must be in the source text

    const known = squadBy.get(norm(e.player));
    
    out.push({
      player: String(e.player).trim(),
      from: (known && known.club) || String(e.from || "").trim() || "Unknown club",
      photo: (known && known.photo) || null,
      to: String(e.to).trim(),
      type: e.type,
      stage: e.stage,
      source: h.source,
      url: h.url,                       // always taken from the feed, never from the model
      summary: String(e.summary || "").slice(0, 200),
      date: h.date
    });
  }
  return out;
}

function merge(fresh) {
  const cutoff = Date.now() - KEEP_DAYS * 86400000;
  const old = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, "utf8")).items || [] : [];
  const keep = old.filter(t => Date.parse(t.date) >= cutoff);

  const byKey = new Map();
  for (const t of [...keep, ...fresh]) {
    byKey.set((t.player + "|" + t.to).toLowerCase(), t); // newest story per player+club wins
  }
  return [...byKey.values()]
    .sort((a, b) => Date.parse(b.date) - Date.parse(a.date))
    .slice(0, MAX_ITEMS);
}

async function main() {
  const headlines = await collectHeadlines();
  const squads = fs.existsSync("data/squads.json") ? JSON.parse(fs.readFileSync("data/squads.json", "utf8")) : [];

  const extracted = await extract(headlines);
  const fresh = build(extracted, headlines, squads);
  console.log(`Transfers: ${extracted.length} extracted, ${fresh.length} passed checks`);

  const items = merge(fresh);
  fs.writeFileSync(OUT, JSON.stringify({ updated: new Date().toISOString().slice(0, 10), items }, null, 2));
}

main().catch(error => { console.error(error.message); process.exit(1); });