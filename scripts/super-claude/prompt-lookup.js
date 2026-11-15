#!/usr/bin/env node
'use strict';
// Recherche locale dans prompts.chat (CSV: act,prompt,for_devs,type,contributor).
const fs = require('fs');
const path = require('path');

const CSV = path.join(__dirname, '..', '..', '_external_tools', 'prompts.chat', 'prompts.csv');

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field); field = '';
      if (row.length > 1) rows.push(row);
      row = [];
    } else field += c;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  return rows;
}

function search(rows, terms, devsOnly) {
  const [header, ...data] = rows;
  const idx = Object.fromEntries(header.map((h, i) => [h.trim(), i]));
  const t = terms.flatMap(s => s.toLowerCase().split(/\s+/)).filter(Boolean);
  const has = (text, w) => new RegExp('\\b' + w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).test(text);
  return data
    .filter(r => !devsOnly || String(r[idx.for_devs]).toUpperCase() === 'TRUE')
    .map(r => {
      const title = (r[idx.act] || '').toLowerCase();
      const body = (r[idx.prompt] || '').toLowerCase();
      const score = t.reduce((s, w) => s + (has(title, w) ? 3 : 0) + (has(body, w) ? 1 : 0), 0);
      return { score, act: r[idx.act], prompt: r[idx.prompt] };
    })
    .filter(x => x.score > 0)
    .sort((a, b) => b.score - a.score);
}

function main(argv) {
  const devs = argv.includes('--devs');
  const li = argv.indexOf('--limit');
  const limit = li >= 0 ? Number(argv[li + 1]) || 3 : 3;
  const terms = argv.filter((a, i) => !a.startsWith('--') && (li < 0 || i !== li + 1));
  if (!terms.length) { console.error('[prompt-lookup] usage: prompt-lookup.js <mots> [--devs] [--limit N]'); return 0; }
  if (!fs.existsSync(CSV)) { console.error('[prompt-lookup] CSV introuvable: ' + CSV); return 0; }
  const hits = search(parseCsv(fs.readFileSync(CSV, 'utf8')), terms, devs).slice(0, limit);
  for (const h of hits) console.log('## ' + h.act + '\n' + h.prompt + '\n');
  if (!hits.length) console.log('Aucun resultat.');
  return 0;
}

if (require.main === module) process.exit(main(process.argv.slice(2)));
module.exports = { parseCsv, search };
