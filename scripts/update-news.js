 const fs = require("fs");

const FEEDS = [
  { source: "BBC Sport", url: "https://feeds.bbci.co.uk/sport/football/rss.xml" },
  { source: "The Guardian", url: "https://www.theguardian.com/football/rss" },
];

// Headlines matching TRANSFER_WORDS (and not NOT_TRANSFER) count as transfer stories
const TRANSFER_WORDS = /(transfer|window|gossip|release clause|swoop|linked with|move for|bid for|signing)/i;
const NOT_TRANSFER = /(women|mls|world cup|netflix|quiz)/i;
function decode(s) {
  return s
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

// Pull the text out of <name>...</name>, removing the CDATA wrapper
function tag(block, name) {
  const m = block.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`));
  if (!m) return "";
  return m[1].replace(/^\s*<!\[CDATA\[/, "").replace(/\]\]>\s*$/, "").trim();
}

// Find the thumbnail URL in an RSS item (BBC and Guardian both include one)
function findImage(block) {
  const matches = [...block.matchAll(/<media:(?:thumbnail|content)[^>]*\burl="([^"]+)"/g)];
  if (matches.length === 0) return null;
  const url = decode(matches[matches.length - 1][1]);
  return url.startsWith("https://") ? url : null;
}




function parseItems(xml, source) {
  const blocks = xml.match(/<item>[\s\S]*?<\/item>/g) || [];
  return blocks.map((block) => {
    const d = new Date(tag(block, "pubDate"));
    return {
      title: decode(tag(block, "title")),
      link: decode(tag(block, "link")),
      date: isNaN(d) ? null : d.toISOString(),
      source,
       image: findImage(block)
    };
  });
}

async function main() {
  let all = [];

  for (const feed of FEEDS) {
    try {
      const res = await fetch(feed.url, {
        headers: { "User-Agent": "plmv-agent (student project)" },
      });
      if (!res.ok) throw new Error("HTTP " + res.status);
      const items = parseItems(await res.text(), feed.source);
      console.log(`${feed.source}: ${items.length} items`);
      all = all.concat(items);
    } catch (e) {
      console.log(`${feed.source} failed: ${e.message}`);
    }
  }

  // keep complete stories, drop quizzes and similar non-news
  all = all
    .filter((i) => i.title && i.link && i.date)
    .filter((i) => !/(quiz|who am i|podcast|newsletter)/i.test(i.title));

  if (all.length === 0) {
    console.log("No news fetched, keeping the old news.json");
    return;
  }

  // newest first
  all.sort((a, b) => new Date(b.date) - new Date(a.date));

  // remove duplicate links
  const seen = new Set();
  all = all.filter((i) => !seen.has(i.link) && seen.add(i.link));

  const news = all.slice(0, 15);

  // transfer stories from the last two weeks only
  const TWO_WEEKS = 14 * 24 * 60 * 60 * 1000;
  const rumours = all
    .filter((i) => Date.now() - new Date(i.date) < TWO_WEEKS)
    .filter((i) => TRANSFER_WORDS.test(i.title) && !NOT_TRANSFER.test(i.title))
    .slice(0, 10);

   // Remove accents so "Šeško" matches "Sesko"
  function deaccent(s) {
    return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  }

  // Stories that mention each player (all squads, not just the curated list)
  const playerNews = {};
  try {
    const players = JSON.parse(fs.readFileSync("data/squads.json", "utf8"));

    // How many players share each surname? Shared ones need the full name.
    const surnameCount = {};
    for (const p of players) {
      const s = deaccent(p.name.split(" ").slice(-1)[0]);
      surnameCount[s] = (surnameCount[s] || 0) + 1;
    }

    for (const p of players) {
      const fullName = deaccent(p.name).toLowerCase();
      const surname = deaccent(p.name.split(" ").slice(-1)[0]);
      const safe = surname.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const surnameOk = surname.length >= 4 && surnameCount[surname] === 1;
      const surnameRe = new RegExp(`\\b${safe}\\b`); // whole word, keeps capital letter

      const hits = all
           .filter((i) => {
      const title = deaccent(i.title);
      const lower = title.toLowerCase();
      // Single-name players (e.g. "Rayan") must also have their club in the headline,
      // otherwise "Rayan Cherki" stories would match them too
      if (!p.name.includes(" ")) {
        return lower.includes(fullName) && lower.includes(deaccent(p.club).toLowerCase());
      }
      return lower.includes(fullName) || (surnameOk && surnameRe.test(title));
    })
        .slice(0, 3);

      if (hits.length) playerNews[p.name] = hits;
    }
  } catch (e) {
    console.log("Player news skipped: " + e.message);
  }

  fs.writeFileSync(
    "data/news.json",
    JSON.stringify(
      { updated: new Date().toISOString(), news, rumours, playerNews },
      null,
      2
    )
  );
  console.log(
    `Saved ${news.length} news, ${rumours.length} transfer stories, ` +
      `${Object.keys(playerNews).length} players with news`
  );
}

main();