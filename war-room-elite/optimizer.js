(function (root) {
  'use strict';
  const X = typeof module !== 'undefined' && module.exports ? require('./engine') : root.CAP;
  const COMPS = ['passif', 'standard', 'agressif'], SHOCKS = [-.25, 0, .15];
  const q4 = (v, st) => +(Math.round(v / st) * st).toFixed(4);

  function specs(s, ctx) {
    const out = [], P = X.PRODS, B = X.BASE, G = X.SEG, L = X.LIM, free = ctx.esgKnown, tr = ctx.trust !== false;
    const num = (id, label, grp, min, max, step, get, set, unit) => { if (max > min) out.push({ id, label, grp, kind: 'num', min, max, step, get, set, unit }); };
    for (const n of P) { const b = B[n], g = G[b.seg], d = () => s.D[n];
      num(n + '.pfmn', 'Performance', n, Math.max(0, b.pfmn - 1), b.pfmn + 3, .1, () => d().pfmn, v => { d().pfmn = v; }, '');
      num(n + '.size', 'Taille', n, b.size - 3, Math.min(20, b.size + 1), .1, () => d().size, v => { d().size = v; }, '');
      num(n + '.mtbf', 'Fiabilité (MTBF)', n, g.mtbf[0] - 2000, g.mtbf[1] + 1000, 500, () => d().mtbf, v => { d().mtbf = v; }, ' h');
      num(n + '.rec', 'Matière recyclée', n, 0, tr ? 40 : 100, 5, () => d().rec || 0, v => { d().rec = v; }, ' %');
      num(n + '.price', 'Prix', n, tr ? g.price[0] - .5 : g.price[0] - 3, tr ? g.price[1] - .5 : g.price[1] + 3, .25, () => d().price, v => { d().price = v; }, ' $');
      num(n + '.promo', 'Budget promo', n, tr ? Math.round(b.promo * .5 / 50) * 50 : 0, tr ? Math.max(3000 * .5, b.promo * 2.5) : 3000, 50, () => d().promo, v => { d().promo = v; }, ' k$');
      num(n + '.sales', 'Budget ventes', n, tr ? Math.round(b.sales * .5 / 50) * 50 : 0, tr ? Math.max(3000 * .5, b.sales * 2.5) : 3000, 50, () => d().sales, v => { d().sales = v; }, ' k$');
      num(n + '.auto', 'Automatisation', n, b.auto, tr ? Math.min(10, b.auto + 4) : 10, .5, () => d().auto, v => { d().auto = v; }, '');
      num(n + '.capAdd', 'Capacité ajoutée', n, 0, tr ? 600 : 1000, 50, () => d().capAdd, v => { d().capAdd = v; }, ' k');
    }
    num('F.bond', 'Obligations', 'Finance', 0, L.bond, 100, () => s.F.bond, v => { s.F.bond = v; }, ' k$');
    num('F.curDebt', 'Dette courte', 'Finance', 0, L.curDebt, 100, () => s.F.curDebt, v => { s.F.curDebt = v; }, ' k$');
    num('F.stock', 'Actions émises', 'Finance', 0, L.stock, 100, () => s.F.stock, v => { s.F.stock = v; }, ' k$');
    num('F.div', 'Dividende par action', 'Finance', 0, 2, .25, () => s.F.div, v => { s.F.div = v; }, ' $');
    num('F.energy', 'Énergie renouvelable', 'Sustainability', 0, 2000, 100, () => s.F.energy, v => { s.F.energy = v; }, ' k$');
    out.push({ id: 'F.supplier', label: 'Fournisseur', grp: 'Sustainability', kind: 'enum', opts: Object.keys(X.SUP), get: () => s.F.supplier, set: v => { s.F.supplier = v; } });
    if (free) {
      num('F.train', 'Formation par salarié', 'Sustainability', 0, 6000, 250, () => s.F.train, v => { s.F.train = v; }, ' $');
      num('F.rr', 'Recruitment & Retention', 'Sustainability', 0, 3000, 100, () => s.F.rr, v => { s.F.rr = v; }, ' k$');
      out.push({ id: 'F.cb', label: 'Compensation & Benefits', grp: 'Sustainability', kind: 'enum', opts: Object.keys(X.CB), get: () => s.F.cb, set: v => { s.F.cb = v; } });
      X.PROG.forEach((p, i) => out.push({ id: 'F.prog' + i, label: p[0], grp: 'Sustainability', kind: 'enum', opts: [0, 1], get: () => ((s.F.programs || []).includes(i) ? 1 : 0), set: v => { const a = (s.F.programs || []).filter(j => j !== i); if (v) a.push(i); s.F.programs = a.sort(); } }));
    }
    return out;
  }

  function context(E, mode, futureW, trust, penW) {
    const sc = mode === 'base' ? [{ w: 1, comp: 'standard', shock: 0 }] : [{ w: .5, comp: 'standard', shock: 0 }, { w: .25, comp: 'standard', shock: -.25 }, { w: .25, comp: 'agressif', shock: 0 }];
    return { E, mode: mode || 'robust', scen: sc, futureW: futureW == null ? .5 : futureW, trust: trust !== false, penW: penW == null ? .35 : penW, esgKnown: X.esgKnown() };
  }
  function value(r, ctx, F) {
    const ru = X.rules(r, ctx.E, F), lim = X.LIM.capex;
    return { v: r.marketCap - ctx.penW * ru.pen - 3 * r.eloan / 1000 - (r.capex > lim ? 3 * (r.capex - lim) / 1000 : 0) - (r.alerts.some(a => a.lv === 'bad' && /200 %/.test(a.t)) ? 50 : 0) + ctx.futureW * r.labSave * .65 * 5 / 1000, ru };
  }
  function evalState(s, ctx) {
    X.fitProduction(s.D, s.F, 'standard', 1);
    let J = 0, worst = Infinity; const det = [];
    for (const q of ctx.scen) { const r = X.simulate(s.D, s.F, { comp: q.comp, shock: q.shock }), x = value(r, ctx, s.F); J += q.w * x.v; worst = Math.min(worst, x.v); det.push({ q, r, ru: x.ru, v: x.v }); }
    return { J: ctx.mode === 'worst' ? worst : J, det };
  }
  const tick = () => new Promise(r => setTimeout(r, 0));

  async function climb(start, ctx, progress) {
    const s = X.clone(start), sp = specs(s, ctx); sp.forEach(p => { if (p.kind === 'num') p.set(X.clamp(p.get(), p.min, p.max)); }); let best = evalState(s, ctx).J;
    for (const mult of [8, 4, 2, 1, 1]) {
      let improved = false;
      for (const p of sp) {
        const v0 = p.get(), c = p.kind === 'enum' ? p.opts.filter(o => o !== v0) : [-3, -2, -1, 1, 2, 3].map(k => X.clamp(q4(v0 + k * mult * p.step, p.step), p.min, p.max)).filter(v => v !== v0);
        let bv = v0;
        for (const v of c) { p.set(v); const j = evalState(s, ctx).J; if (j > best + 1e-9) { best = j; bv = v; } }
        p.set(bv); if (bv !== v0) improved = true;
      }
      if (progress) { progress(best); await tick(); }
      if (!improved && mult === 1) break;
    }
    return { s, J: evalState(s, ctx).J };
  }

  async function optimize(current, ctx, progress) {
    const starts = [['Stratégie A', X.build('A')], ['Stratégie B', X.build('B')], ['Stratégie C', X.build('C')], ['Ne rien changer', X.zero()], ['Votre scénario actuel', X.clone(current)]], tried = [];
    let best = null;
    for (const [label, st] of starts) { const r = await climb(st, ctx, progress ? j => progress(label, j) : null); tried.push({ label, J: r.J }); if (!best || r.J > best.J) best = Object.assign(r, { from: label }); }
    const ev = evalState(best.s, ctx), sp = specs(best.s, ctx), cur = X.clone(current), spc = specs(cur, ctx), levers = [];
    for (const p of sp) {
      const ref = spc.find(x => x.id === p.id).get(), rec = p.get();
      p.set(ref); const jref = evalState(best.s, ctx).J; p.set(rec);
      let lo = rec, hi = rec; const tol = .15;
      if (p.kind === 'num') {
        for (let k = 1; k <= 24; k++) { const v = X.clamp(q4(rec - k * p.step, p.step), p.min, p.max); p.set(v); if (evalState(best.s, ctx).J < ev.J - tol) break; lo = v; if (v === p.min) break; }
        for (let k = 1; k <= 24; k++) { const v = X.clamp(q4(rec + k * p.step, p.step), p.min, p.max); p.set(v); if (evalState(best.s, ctx).J < ev.J - tol) break; hi = v; if (v === p.max) break; }
        p.set(rec);
      }
      levers.push({ id: p.id, label: p.label, grp: p.grp, kind: p.kind, unit: p.unit || '', ref, rec, value: ev.J - jref, zone: [lo, hi] });
    }
    X.fitProduction(best.s.D, best.s.F, 'standard', 1);
    return { state: best.s, J: ev.J, det: ev.det, from: best.from, tried, levers };
  }

  function matrix(s, E) {
    const ctx = context(E, 'base', 0); X.fitProduction(s.D, s.F, 'standard', 1);
    return COMPS.map(c => SHOCKS.map(sh => { const r = X.simulate(s.D, s.F, { comp: c, shock: sh }), x = value(r, ctx, s.F); return { comp: c, shock: sh, net: r.marketCap - x.ru.pen, cap: r.marketCap, pen: x.ru.pen, ni: r.ni, eloan: r.eloan, cash: r.cash }; }));
  }
  const api = { specs, context, evalState, optimize, matrix, value, COMPS, SHOCKS };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.OPT = api;
})(typeof window !== 'undefined' ? window : globalThis);
