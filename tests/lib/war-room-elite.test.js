'use strict';
const assert = require('assert');
const X = require('../../war-room-elite/engine');
const O = require('../../war-room-elite/optimizer');

async function part1() {
  X.resetData();
  // controle: sans rien changer, concurrents passifs: 115,0 M$ de ventes et 6,0 M$ de resultat (extraction Capsim)
  const r0 = X.simulate(X.defaultDecisions(), X.defaultFin(), { comp: 'passif' });
  assert.ok(Math.abs(r0.rev - 114991) < 50 && Math.abs(r0.ni - 6025) < 50, 'controle moteur');
  const E = X.getData().STARTE, ctx = O.context(E, 'robust', .5), cur = X.build('C');
  const t = Date.now(), res = await O.optimize(cur, ctx);
  const jOf = s => O.evalState(X.clone(s), ctx).J;
  ['A', 'B', 'C'].forEach(k => assert.ok(res.J >= jOf(X.build(k)) - 1e-6, 'optimum >= strategie ' + k));
  assert.ok(res.det[0].r.eloan === 0, 'pas d\'emprunt d\'urgence en scenario central');
  assert.ok(res.levers.length > 50 && res.levers.every(l => isFinite(l.value)));
  assert.strictEqual(O.matrix(res.state, E).length, 4);
  // setData remplace les donnees et le moteur suit
  X.setData({ BASE: { Able: { price: 30 } } }); assert.strictEqual(X.BASE.Able.price, 30); X.resetData();
  console.log('war-room elite: ok', (Date.now() - t) + ' ms', 'J=' + res.J.toFixed(1), 'depuis', res.from);
}

// lookahead, adaptive competitors, multi-round plan
async function part2() {
  X.resetData(); const E = X.getData().STARTE, t = Date.now();
  const ctx1 = O.context(E, 'robust', .5, true, .35, 1), r1 = await O.optimize(X.build('C'), ctx1);
  assert.ok(isFinite(r1.J) && r1.det.length === 4);
  const plan = await O.planYears(X.build('C'), E, 3, { mode: 'robust', futureW: .5, penW: .35, trust: true });
  assert.strictEqual(plan.rows.length, 3); assert.strictEqual(plan.baseline.length, 3);
  plan.rows.forEach(r => assert.ok(isFinite(r.r.marketCap) && isFinite(r.r.cash)));
  assert.ok(plan.rows[2].r.marketCap > plan.baseline[2].r.marketCap, 'le plan bat le statu quo en annee 3');
  assert.ok(plan.rows[2].ru.miss <= 2, 'le plan franchit les seuils emissions et dechets au dernier round');
  assert.strictEqual(X.getData().round, 1, 'donnees actives restaurees');
  console.log('war-room elite plan: ok', (Date.now() - t) + ' ms', plan.rows.map(r => r.r.marketCap.toFixed(0)).join(' > '), 'vs', plan.baseline.map(r => r.r.marketCap.toFixed(0)).join(' > '));
}

async function part3() {
  const N = require('../../war-room-elite/intel'); X.resetData(); X.setData({ INTEL: N.demo() });
  const f = N.findings(), kinds = new Set(f.map(x => x.kind));
  ['price_high', 'cash_crisis', 'segment_gap', 'mtbf_low', 'price_war', 'drift_wrong', 'age_off', 'low_visibility', 'stockout', 'loss'].forEach(k => assert.ok(kinds.has(k), 'faille detectee: ' + k));
  assert.ok(f[0].sev === 3 && f.every(x => isFinite(x.value) && isFinite(x.freed)));
  const E = X.getData().STARTE, ci = O.context(E, 'robust', .5, true, .35, 0, .65), ex = await O.optimize(X.build('C'), ci), gen = await O.optimize(X.build('C'), O.context(E, 'robust', .5, true, .35, 0, 0));
  const jEx = O.evalState(X.clone(ex.state), ci).J, jGen = O.evalState(X.clone(gen.state), ci).J;
  assert.ok(jEx >= jGen - 1e-6, 'jouer contre les equipes reelles bat la reco generique');
  assert.strictEqual(O.matrix(ex.state, E).length, 7);
  X.resetData();
  console.log('war-room elite intel: ok', f.length + ' failles, valeur de l\'information ' + (jEx - jGen).toFixed(2));
}

part1().then(part2).then(part3).catch(e => { console.error(e); process.exit(1); });
