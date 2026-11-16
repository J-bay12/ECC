'use strict';
const assert = require('assert');
const X = require('../../war-room-elite/engine');
const O = require('../../war-room-elite/optimizer');

(async () => {
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
  assert.strictEqual(O.matrix(res.state, E).length, 3);
  // setData remplace les donnees et le moteur suit
  X.setData({ BASE: { Able: { price: 30 } } }); assert.strictEqual(X.BASE.Able.price, 30); X.resetData();
  console.log('war-room elite: ok', (Date.now() - t) + ' ms', 'J=' + res.J.toFixed(1), 'depuis', res.from);
})().catch(e => { console.error(e); process.exit(1); });
