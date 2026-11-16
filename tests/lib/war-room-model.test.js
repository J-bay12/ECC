'use strict';
const assert = require('assert');
const M = require('../../war-room/model');

const data = M.sample();
const m = M.calibrate(data);
const st = M.stateOf(m);
const me = m.teams[m.mi].last;
assert.ok(m.fitted && Math.abs(m.fitted.beta - 0.12) < 0.03 && Math.abs(m.fitted.gamma - 0.9) < 0.25, 'fit recovers params: ' + JSON.stringify(m.fitted));

// calibration: shares of the last round are reproduced
const pre = { brand: st.brand.map((b, j) => (b - m.teams[j].last.mkt) / m.P.rho), q: st.q.map((q, j) => (q - m.teams[j].last.rd) / m.P.rho) };
const rows = M.evalRound(m, pre, m.teams.map(t => ({ price: t.last.price, mkt: t.last.mkt, rd: t.last.rd })), 0, 0);
rows.forEach((r, j) => assert.ok(Math.abs(r.share * 100 - m.teams[j].last.share) < 0.6, 'share ' + j));
assert.ok(Math.abs(rows.reduce((s, r) => s + r.share, 0) - 1) < 1e-9);

// determinism and plan shape
const p1 = M.plan(m, 2, 'prudent'), p2 = M.plan(m, 2, 'prudent');
assert.strictEqual(p1.length, 2);
assert.deepStrictEqual(p1[0].dec, p2[0].dec);
assert.ok(p1[0].st.mean >= p1[0].hold.mean - 1, 'optimum not worse than holding');
assert.ok(M.advise(m, p1[0], 2).length >= 5);
assert.strictEqual(M.matrix(m, st, 1, p1[0].dec, 'B').length, 5);

// csv import
const csv = 'round,team,price,mkt,rd,rev,profit,share\n1,X,30,100,50,500,40,60\n1,Y,32,100,50,300,20,40\n';
assert.strictEqual(M.fromCsv(csv, 'X').teams.length, 2);
void me;
console.log('war-room model: ok');
