 const fs = require('fs');
const data = JSON.parse(fs.readFileSync('data/transfers.json', 'utf8'));
const types = ['permanent', 'loan', 'contract'];
const stages = ['interest', 'talks', 'advanced', 'agreed'];
const cutoff = Date.now() - 14 * 24 * 60 * 60 * 1000;

const bad = [];
data.items.forEach((t, i) => {
  if (!t.player || !t.from || !t.to) bad.push(`#${i}: missing player/from/to`);
  if (!/^https?:\/\//.test(t.url || '')) bad.push(`#${i} ${t.player}: missing source URL`);
  if (!t.source) bad.push(`#${i} ${t.player}: missing source name`);
  if (!types.includes(t.type)) bad.push(`#${i} ${t.player}: bad type`);
  if (!stages.includes(t.stage)) bad.push(`#${i} ${t.player}: bad stage`);
  if (!(Date.parse(t.date) >= cutoff)) bad.push(`#${i} ${t.player}: older than 14 days or bad date`);
});

if (bad.length) { console.error(bad.join('\n')); process.exit(1); }
console.log(`transfers.json OK (${data.items.length} items)`);