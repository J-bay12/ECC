(function (root) {
  'use strict';
  const X = typeof module !== 'undefined' && module.exports ? require('./engine') : root.CAP;
  const f1 = (x, d) => (+x).toLocaleString(root.__LOC || 'fr-FR', { minimumFractionDigits: d == null ? 1 : d, maximumFractionDigits: d == null ? 1 : d });

  /* Detecte les erreurs des equipes adverses (etat courant et evolution d'un round a l'autre) et chiffre la demande qu'elles liberent. */
  function findings() {
    const D = X.getData(), H = (D.INTEL && D.INTEL.history) || []; if (!H.length) return [];
    const cur = H[H.length - 1], prev = H.length > 1 ? H[H.length - 2] : null, SEG = D.SEG, out = [], z = X.zero().D, tot = X.segmentTotals(z, X.hasIntel() ? 'intel_persist' : 'standard');
    const ours = sg => X.PRODS.find(n => D.BASE[n].seg === sg), avg = (b, d, sg, rev, mv) => { let s = 0; for (let m = 1; m <= 12; m++) s += X.scoreAt(b, d, sg, m, rev, mv); return s / 12; };
    const median = a => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : 0; };
    const vis = {}; X.SEGS.forEach(sg => { const v = []; for (const t of Object.keys(cur.teams)) for (const p of Object.values(cur.teams[t].products || {})) if (p.seg === sg) v.push((p.promo || 0) + (p.sales || 0)); vis[sg] = median(v); });
    for (const team of Object.keys(cur.teams)) {
      const T = cur.teams[team], P = T.products || {}, fin = T.fin || {}, segs = new Set(), push = (o) => out.push(Object.assign({ team, product: '', seg: '', freed: 0, value: 0, sev: 1, ev: '', act: '' }, o));
      for (const pn of Object.keys(P)) {
        const p = Object.assign({ auto: 3, age: 2, aware: .45, mtbf: 15000, promo: 800, sales: 800 }, P[pn]), s = SEG[p.seg]; if (!s) continue; segs.add(p.seg);
        const q = prev && prev.teams[team] && prev.teams[team].products && prev.teams[team].products[pn], lo = s.price[0] - .5, hi = s.price[1] - .5, ix = s.ideal[0] + s.drift[0] * .5, iy = s.ideal[1] + s.drift[1] * .5;
        const dc = Math.hypot(p.pfmn - (ix - s.off[0]), p.size - (iy - s.off[1])), dist = Math.hypot(p.pfmn - ix, p.size - iy), T0 = tot[p.seg], vf = (1 + p.aware) / 2 * (1 + s.acc) / 2;
        const freedOf = (fix, rev, mv) => { const d = Object.assign({}, p, fix), g = (avg(p, d, p.seg, rev, mv) - avg(p, p, p.seg, 0, false)) * vf; return Math.max(0, g / ((T0.mine + T0.theirs) || 1) * T0.demand); };
        const op = ours(p.seg), margin = op ? D.BASE[op].price * .30 : 8, val = u => .35 * u * margin / 1000, sev = u => (u / T0.demand > .04 ? 3 : u / T0.demand > .015 ? 2 : 1), base = { team, product: pn, seg: p.seg };
        if (p.price > hi + .05) { const u = freedOf({ price: hi }, 0, false); push(Object.assign({ kind: 'price_high', ev: `prix ${f1(p.price, 2)} $ pour une bande jusqu'à ${f1(hi, 2)} $`, freed: u, value: val(u), sev: sev(u), act: `Tenez ${op} au prix haut de la bande (${f1(hi, 2)} $), poussez promo et ventes : leurs clients partent.` }, base)); }
        if (p.price < lo - .05) push(Object.assign({ kind: 'price_low', sev: 2, ev: `prix ${f1(p.price, 2)} $, sous la bande (${f1(lo, 2)} $)`, act: `Ne suivez pas sur le prix : ils détruisent leur marge. Gagnez sur la position et la fiabilité.` }, base));
        if (dc > 2.5) { const u = freedOf({ pfmn: ix, size: iy }, 8, true); push(Object.assign({ kind: 'off_target', ev: `distance ${f1(dc)} du centre du segment (seuil 2,5)`, freed: u, value: val(u), sev: Math.max(sev(u), dc > 4 ? 3 : 2), act: `Placez ${op} au point idéal (${f1(ix)} / ${f1(iy)}) et ancrez la notoriété avant qu'ils ne corrigent.` }, base)); }
        else if (q) { const dq = Math.hypot(q.pfmn - ix, q.size - iy); if (dist - dq > .5) push(Object.assign({ kind: 'drift_wrong', ev: `distance à l'idéal ${f1(dq)} puis ${f1(dist)}`, sev: 1, act: `Ils s'éloignent de la cible : consolidez ${op} et captez leurs clients.` }, base)); }
        if (p.mtbf < s.mtbf[0] - 500) { const u = freedOf({ mtbf: s.mtbf[0] }, 1, false); push(Object.assign({ kind: 'mtbf_low', ev: `fiabilité ${f1(p.mtbf, 0)} h pour un minimum de ${f1(s.mtbf[0], 0)} h`, freed: u, value: val(u), sev: sev(u), act: `Montez la fiabilité de ${op} au-dessus de ${f1(s.mtbf[0], 0)} h pour prendre leurs clients.` }, base)); }
        if (Math.abs(p.age - s.age) > 2.2 * s.aw && s.age > 0 || (s.age === 0 && p.age > 3)) push(Object.assign({ kind: 'age_off', ev: `âge ${f1(p.age)} ans pour un idéal de ${s.age} ans`, sev: 1, act: `Produit vieilli : une révision R&D sur ${op} creuse l'écart.` }, base));
        if ((p.aware < .30) || ((p.promo || 0) + (p.sales || 0) < .5 * vis[p.seg] && vis[p.seg] > 0)) push(Object.assign({ kind: 'low_visibility', ev: `notoriété ${f1(p.aware * 100, 0)} %, promo + ventes ${f1((p.promo || 0) + (p.sales || 0), 0)} k$`, sev: 1, act: `Peu visible : augmentez promo et ventes sur ${p.seg}, sa demande est captable.` }, base));
        if (p.sold != null && p.inv != null && p.inv < .03 * p.sold) push(Object.assign({ kind: 'stockout', ev: `stock ${f1(p.inv, 0)} k pour ${f1(p.sold, 0)} k vendus`, sev: 2, act: `En rupture : gardez du stock et de la capacité sur ${p.seg} pour absorber la demande qu'ils ne servent pas.` }, base));
        if (q && p.price < q.price - 1.5) push(Object.assign({ kind: 'price_war', ev: `prix ${f1(q.price, 2)} $ puis ${f1(p.price, 2)} $`, sev: 2, act: `Guerre des prix lancée : tenez la marge, évitez de suivre et attendez l'épuisement de leur trésorerie.` }, base));
      }
      const miss = X.SEGS.filter(sg => !segs.has(sg));
      miss.forEach(sg => { const T0 = tot[sg], op = ours(sg), u = T0.demand * .2, v = .35 * u * (op ? D.BASE[op].price * .3 : 8) / 1000; push({ kind: 'segment_gap', seg: sg, ev: `aucun produit sur ${sg}`, freed: u, value: v, sev: 2, act: `Segment libre : montez stock, capacité et budgets sur ${op || sg} pour capter la part qu'ils laissent.` }); });
      if ((fin.eloan || 0) > 0 || fin.cash < 0 || (fin.leverage || 0) > 3) push({ kind: 'cash_crisis', sev: 3, ev: `${fin.eloan ? 'emprunt d\'urgence ' + f1(fin.eloan, 0) + ' k$' : 'trésorerie ' + f1(fin.cash || 0, 0) + ' k$'}${fin.leverage ? ', levier ' + f1(fin.leverage, 2) : ''}`, act: `Trésorerie sous tension : attendez des coupes en R&D et marketing et des prix bradés ; prenez leur place sur leurs segments forts.` });
      else if ((fin.profit || 0) < 0 && fin.profit != null) push({ kind: 'loss', sev: 1, ev: `résultat ${f1(fin.profit, 0)} k$`, act: `Équipe en perte : elle devra rééquilibrer ses dépenses au prochain round.` });
    }
    return out.sort((a, b) => b.sev - a.sev || b.value - a.value);
  }

  /* Donnees de demonstration FICTIVES avec des erreurs plantees (pour essayer la fonction). */
  function demo() {
    const D = X.getData(), names = { Baldwin: ['Baker', 'Bead', 'Bid', 'Bold', 'Buzz'], Chester: ['Cake', 'Cedar', 'Cid', 'Coat', 'Cure'], Digby: ['Daze', 'Dell', 'Dixie', 'Dot', 'Dune'], Erie: ['Eat', 'Echo', 'Edge', 'Egg', 'Ever'] }, segs = X.SEGS, mk = (team, round, fn) => {
      const products = {}; names[team].forEach((n, i) => { const sg = segs[i], b = D.BASE[X.PRODS[i]]; if (team === 'Chester' && round === 1 && sg === 'Size') return; products[n] = Object.assign({ seg: sg, pfmn: b.pfmn, size: b.size, mtbf: b.mtbf, age: b.age, price: b.price, promo: b.promo, sales: b.sales, aware: b.aware, inv: Math.round(b.sold * .15), sold: b.sold, auto: b.auto }, fn(n, sg, b)); });
      return { fin: team === 'Chester' && round === 1 ? { cash: 0, eloan: 4200, leverage: 3.4, profit: -2800 } : team === 'Erie' && round === 1 ? { cash: 800, profit: -600 } : { cash: 3400, profit: 4000 }, products }; };
    const e0 = { round: D.round - 1, teams: {} }, e1 = { round: D.round, teams: {} };
    Object.keys(names).forEach(t => { e0.teams[t] = mk(t, 0, () => ({})); e1.teams[t] = mk(t, 1, (n, sg, b) => {
      if (n === 'Baker') return { price: b.price + 4.5 }; if (n === 'Dixie') return { pfmn: b.pfmn - 1.6, size: b.size + .9 };
      if (n === 'Echo') return { price: b.price - 3.6 }; if (n === 'Bead') return { mtbf: 11000, inv: 2, sold: 1500 }; if (n === 'Egg') return { age: 5.4, aware: .22, promo: 300, sales: 250 };
      return {}; }); });
    return { history: [e0, e1], demo: true };
  }

  const api = { findings, demo };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.INTEL = api;
})(typeof window !== 'undefined' ? window : globalThis);
