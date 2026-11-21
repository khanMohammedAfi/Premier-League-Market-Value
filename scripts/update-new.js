const fs = require("fs");

const FEEDS = [
  { source: "BBC Sport", url: "https://feeds.bbci.co.uk/sport/football/rss.xml" },
  { source: "The Guardian", url: "https://www.theguardian.com/football/rss" },
];

// Headlines containing these words are treated as transfer stories
const TRANSFER_WORDS = /(transfer|bid for|signing|signs |loan|january window|release clause|agree|deal)/
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
      link: tag(block, "link"),
      date: isNaN(d) ? null : d.toISOString(),
      source,
      image: findImage(block),
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

  all = all.filter((i) => i.title && i.link && i.date);

  if (all.length === 0) {
    console.log("No news fetched, keeping the old news.json");
    return;
  }

  all.sort((a, b) => new Date(b.date) - new Date(a.date));

  // remove duplicate links
  const seen = new Set();
  all = all.filter((i) => !seen.has(i.link) && seen.add(i.link));

  const news = all.slice(0, 15);
  const rumours = all.filter((i) => TRANSFER_WORDS.test(i.title)).slice(0, 10);

  fs.writeFileSync(
    "data/news.json",
    JSON.stringify({ updated: new Date().toISOString(), news, rumours }, null, 2)
  );
  console.log(`Saved ${news.length} news and ${rumours.length} transfer stories`);
}

main();