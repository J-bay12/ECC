#!/usr/bin/env node
'use strict';
// Usage: node war-room/cli.js [data.json|data.csv] [--rounds N] [--obj profit|prudent|share] [--aggr -1..1]
const fs = require('fs');
const M = require('./model');
const a = process.argv.slice(2), opt = n => { const i = a.indexOf('--' + n); return i >= 0 ? a[i + 1] : undefined; };
const file = a.find((x, i) => !x.startsWith('--') && !(i > 0 && a[i - 1].startsWith('--')));
let data = M.sample();
if (file) { const t = fs.readFileSync(file, 'utf8'); data = t.trim()[0] === '{' ? JSON.parse(t) : M.fromCsv(t); }
const m = M.calibrate(data, opt('aggr') ? { aggr: +opt('aggr') } : {});
const plan = M.plan(m, +(opt('rounds') || 3), opt('obj') || 'prudent');
for (const r of plan) {
  console.log(`\n== Tour +${r.k} ==`);
  M.advise(m, r, plan.length).forEach(l => console.log('- ' + l));
}
