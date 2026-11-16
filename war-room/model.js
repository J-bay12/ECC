(function (root) {
  'use strict';
  const DEF = { beta: 0.12, gamma: 0.9, delta: 0.7, rho: 0.6, eps: 0.6, fixed: 460, growth: 0.05, noise: 0.06, aggr: 0, lambda: 0.5, maxMkt: 2000, maxRd: 1500 };
  const sum = a => a.reduce((s, x) => s + x, 0);
  const mean = a => sum(a) / a.length;
  const std = a => { const m = mean(a); return Math.sqrt(mean(a.map(x => (x - m) ** 2))); };
  const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));
  function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  function gauss(r) { let u = 0; while (!u) u = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * r()); }
  function pct(sorted, p) { return sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))]; }
  function stats(arr) { const s = [...arr].sort((a, b) => a - b); return { mean: mean(arr), std: std(arr), p10: pct(s, 0.1), p50: pct(s, 0.5), p90: pct(s, 0.9), pneg: arr.filter(x => x < 0).length / arr.length }; }

  const att = (P, price, brand, q, off) => Math.exp(-P.beta * price + P.gamma * Math.log(1 + brand / 600) + P.delta * Math.log(1 + q / 400) + off);

  function solve3(A, y) {
    const M = A.map((r, i) => r.concat(y[i]));
    for (let c = 0; c < 3; c++) {
      let p = c; for (let r = c + 1; r < 3; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
      if (Math.abs(M[p][c]) < 1e-9) return null;
      [M[c], M[p]] = [M[p], M[c]];
      for (let r = 0; r < 3; r++) if (r !== c) { const f = M[r][c] / M[c][c]; for (let k = c; k < 4; k++) M[r][k] -= f * M[c][k]; }
    }
    return M.map((r, i) => r[3] / r[i]);
  }
  // Estime beta, gamma, delta par moindres carres (effets fixes equipe et tour) sur ln(part).
  function fit(data, rho) {
    const T = Math.min(...data.teams.map(t => t.history.length)), J = data.teams.length;
    if (T < 3 || J < 3) return null;
    const Z = [[], [], [], []];
    data.teams.forEach(t => { let b = 0, q = 0; const r = [[], [], [], []];
      for (let i = 0; i < T; i++) { const h = t.history[i]; b = rho * b + h.mkt; q = rho * q + h.rd;
        r[0].push(Math.log(Math.max(0.1, h.share))); r[1].push(-h.price); r[2].push(Math.log(1 + b / 600)); r[3].push(Math.log(1 + q / 400)); }
      r.forEach((x, v) => Z[v].push(x)); });
    const W = Z.map(z => { const rm = z.map(r => mean(r)), cm = Array.from({ length: T }, (_, i) => mean(z.map(r => r[i]))), g = mean(rm);
      return z.map((r, j) => r.map((x, i) => x - rm[j] - cm[i] + g)); });
    const X = [1, 2, 3].map(v => W[v].flat()), y = W[0].flat();
    const A = X.map(a => X.map(b => sum(a.map((x, i) => x * b[i])))), c = X.map(a => sum(a.map((x, i) => x * y[i])));
    const sol = solve3(A, c);
    if (!sol || sol.some(x => !isFinite(x)) || sol[0] <= 0.01) return null;
    return { beta: clamp(sol[0], 0.02, 0.6), gamma: clamp(sol[1], 0, 2), delta: clamp(sol[2], 0, 2), n: y.length };
  }

  function calibrate(data, over) {
    const P = Object.assign({}, DEF, data.settings || {}, over || {});
    const fitted = (over && over.noFit) ? null : fit(data, P.rho);
    if (fitted) { P.beta = fitted.beta; P.gamma = fitted.gamma; P.delta = fitted.delta; }
    const teams = data.teams.map(t => {
      let b = 0, q = 0;
      for (const h of t.history) { b = P.rho * b + h.mkt; q = P.rho * q + h.rd; }
      return { name: t.name, me: t.name === data.me, hist: t.history, brand: b, q, last: t.history[t.history.length - 1] };
    });
    const mi = Math.max(0, teams.findIndex(t => t.me));
    const tot = sum(teams.map(t => Math.max(0.1, t.last.share)));
    teams.forEach(t => { t.off = Math.log(Math.max(0.1, t.last.share) / tot) - Math.log(att(P, t.last.price, t.brand, t.q, 0)); });
    const me = teams[mi], units = me.last.rev / me.last.price;
    const cost = clamp(me.last.price - (me.last.profit + me.last.mkt + me.last.rd + P.fixed) / units, 5, me.last.price - 1);
    return { P, fitted, teams, mi, units0: sum(teams.map(t => t.last.rev / t.last.price)), pavg0: mean(teams.map(t => t.last.price)), cost };
  }
  const stateOf = m => ({ brand: m.teams.map(t => t.brand), q: m.teams.map(t => t.q) });

  function forecast(m, j, k) {
    const t = m.teams[j], P = m.P, out = {};
    for (const v of ['price', 'mkt', 'rd']) {
      const s = t.hist.map(h => h[v]), last = s[s.length - 1];
      const d = s.length > 1 ? last - s[s.length - 2] : 0;
      const diffs = s.slice(1).map((x, i) => x - s[i]);
      const sd = diffs.length > 1 ? std(diffs) : 0;
      let pred = last + d * (1 - Math.pow(0.5, k));
      if (v === 'price') pred -= 3 * P.aggr; else if (v === 'mkt') pred *= 1 + 0.2 * P.aggr;
      const floor = v === 'price' ? Math.max(0.05 * last, 0.8) : Math.max(0.15 * last, 20);
      out[v] = Math.max(v === 'price' ? 10 : 0, pred);
      out['s' + v] = Math.max(sd, floor) * Math.sqrt(k);
    }
    return out;
  }

  function scenarios(m, st, k, n, seed) {
    const r = rng(seed), P = m.P, out = [];
    const fcs = m.teams.map((t, j) => (j === m.mi ? null : forecast(m, j, k)));
    for (let i = 0; i < n; i++) {
      let A = 0, Pc = 0, N = 0;
      m.teams.forEach((t, j) => {
        if (j === m.mi) return;
        const f = fcs[j];
        const p = Math.max(10, f.price + f.sprice * gauss(r)), mk = Math.max(0, f.mkt + f.smkt * gauss(r)), rd = Math.max(0, f.rd + f.srd * gauss(r));
        A += att(P, p, P.rho * st.brand[j] + mk, P.rho * st.q[j] + rd, t.off); Pc += p; N++;
      });
      out.push({ A, P: Pc, N: N + 1, shock: P.noise * gauss(r) });
    }
    return out;
  }

  function evalMine(m, d, sc, st, k, full) {
    const P = m.P, me = m.teams[m.mi];
    const a = att(P, d.price, P.rho * st.brand[m.mi] + d.mkt, P.rho * st.q[m.mi] + d.rd, me.off);
    const g = m.units0 * Math.pow(1 + P.growth, k);
    let sp = 0, sp2 = 0, ss = 0; const pr = full ? [] : null, sh = full ? [] : null;
    for (const s of sc) {
      const share = a / (a + s.A), pavg = (d.price + s.P) / s.N;
      const u = g * Math.pow(pavg / m.pavg0, -P.eps) * (1 + s.shock) * share;
      const prof = u * (d.price - m.cost) - d.mkt - d.rd - P.fixed;
      sp += prof; sp2 += prof * prof; ss += share;
      if (full) { pr.push(prof); sh.push(share); }
    }
    const n = sc.length, mp = sp / n;
    return { mp, sd: Math.sqrt(Math.max(0, sp2 / n - mp * mp)), ms: ss / n, pr, sh };
  }

  function score(q, obj, lambda) {
    if (obj === 'profit') return q.mp;
    if (obj === 'share') return q.ms * 1000 + Math.min(0, q.mp);
    return q.mp - lambda * q.sd;
  }

  function horizon(m, st, k, H, n, seed) {
    const out = []; let s = st;
    for (let h = 0; h < H; h++) { out.push({ st: s, k: k + h, sc: scenarios(m, s, k + h, n, seed + h), w: Math.pow(0.9, h) }); s = advance(m, s, { price: 36, mkt: 0, rd: 0 }, k + h); }
    return out;
  }
  function hval(m, d, hz, full) {
    let b = hz[0].st.brand[m.mi], q = hz[0].st.q[m.mi], mp = 0, v = 0, first = null;
    hz.forEach((x, i) => {
      const s2 = { brand: x.st.brand.slice(), q: x.st.q.slice() }; s2.brand[m.mi] = b; s2.q[m.mi] = q;
      const e = evalMine(m, d, x.sc, s2, x.k, full && i === 0);
      mp += x.w * e.mp; v += x.w * x.w * e.sd * e.sd; if (i === 0) first = e;
      b = m.P.rho * b + d.mkt; q = m.P.rho * q + d.rd;
    });
    return { mp, sd: Math.sqrt(v), ms: first.ms, first };
  }
  function optimize(m, st, k, obj, seed) {
    const hz = horizon(m, st, k, 3, 100, seed), res = [];
    for (let price = 24; price <= 56; price += 2) for (let mkt = 0; mkt <= m.P.maxMkt; mkt += 100) for (let rd = 0; rd <= m.P.maxRd; rd += 100) {
      const d = { price, mkt, rd }; res.push({ d, s: score(hval(m, d, hz), obj, m.P.lambda) });
    }
    res.sort((a, b) => b.s - a.s);
    return res.slice(0, 5).map(x => x.d);
  }

  function meanDecs(m, k, mine) {
    return m.teams.map((t, j) => (j === m.mi ? mine : (f => ({ price: f.price, mkt: f.mkt, rd: f.rd }))(forecast(m, j, k))));
  }
  function evalRound(m, st, decs, k, shock) {
    const P = m.P, a = decs.map((d, j) => att(P, d.price, P.rho * st.brand[j] + d.mkt, P.rho * st.q[j] + d.rd, m.teams[j].off));
    const A = sum(a), pavg = mean(decs.map(d => d.price));
    const D = m.units0 * Math.pow(1 + P.growth, k) * Math.pow(pavg / m.pavg0, -P.eps) * (1 + (shock || 0));
    return decs.map((d, j) => { const u = D * a[j] / A; return { share: a[j] / A, rev: u * d.price, profit: u * (d.price - m.cost) - d.mkt - d.rd - P.fixed }; });
  }
  function advance(m, st, mine, k) {
    const decs = meanDecs(m, k, mine), P = m.P;
    return { brand: st.brand.map((b, j) => P.rho * b + decs[j].mkt), q: st.q.map((q, j) => P.rho * q + decs[j].rd) };
  }

  function analyse(m, st, k, d, last) {
    const hz = horizon(m, st, k, 3, 1500, 7), e = hval(m, d, hz, true), f = e.first, base = e.mp;
    const at = x => hval(m, Object.assign({}, d, x), hz), dm = at({ mkt: d.mkt + 100 }), dr = at({ rd: d.rd + 100 });
    const hold = last ? hval(m, last, hz, true) : null;
    const rows = evalRound(m, st, meanDecs(m, k, d), k, 0);
    return {
      dec: d, val: base, pr: f.pr, st: Object.assign(stats(f.pr), { share: f.ms }),
      hold: hold && Object.assign(stats(hold.first.pr), { val: hold.mp, share: hold.ms }),
      sens: { price: at({ price: d.price + 2 }).mp - base, mkt: at({ mkt: d.mkt + 200 }).mp - base, rd: at({ rd: d.rd + 200 }).mp - base },
      roiMkt: dm.mp - base, shareMkt: (dm.ms - e.ms) * 100, roiRd: dr.mp - base,
      field: rows.map((r, j) => ({ name: m.teams[j].name, me: j === m.mi, share: r.share * 100, profit: r.profit, last: m.teams[j].last.share, dec: meanDecs(m, k, d)[j] })),
    };
  }

  function plan(m, rounds, obj) {
    let st = stateOf(m), out = [];
    const me = m.teams[m.mi], hold = { price: me.last.price, mkt: me.last.mkt, rd: me.last.rd };
    for (let k = 1; k <= rounds; k++) {
      const top = optimize(m, st, k, obj, 11 + k), best = top[0];
      out.push(Object.assign({ k, top }, analyse(m, st, k, best, hold)));
      st = advance(m, st, best, k);
    }
    return out;
  }

  function matrix(m, st, k, base, rival) {
    const ri = m.teams.findIndex(t => t.name === rival), ds = [-4, -2, 0, 2, 4];
    return ds.map(dp => ds.map(dr => {
      const decs = meanDecs(m, k, { price: base.price + dp, mkt: base.mkt, rd: base.rd });
      decs[ri] = Object.assign({}, decs[ri], { price: decs[ri].price + dr });
      return evalRound(m, st, decs, k, 0)[m.mi].profit;
    }));
  }

  const f0 = n => Math.round(n).toLocaleString('fr-FR');
  function advise(m, row, rounds) {
    const out = [], d = row.dec, s = row.st, h = row.hold, me = m.teams[m.mi].last;
    const dir = (a, b, u) => (Math.abs(a - b) < 1e-9 ? 'inchangé' : (a > b ? 'hausse' : 'baisse') + ' de ' + f0(Math.abs(a - b)) + u);
    out.push(`Tour +${row.k} : prix ${d.price} $ (${dir(d.price, me.price, ' $')}), marketing ${f0(d.mkt)} k$ (${dir(d.mkt, me.mkt, ' k$')}), R&D ${f0(d.rd)} k$ (${dir(d.rd, me.rd, ' k$')}). Profit attendu ${f0(s.mean)} k$ (P10 ${f0(s.p10)} à P90 ${f0(s.p90)}), part ${(s.share * 100).toFixed(1)} %.`);
    if (h) out.push(`Gain vs reconduire la décision actuelle : ${row.val - h.val >= 0 ? '+' : ''}${f0(row.val - h.val)} k$ de valeur sur 3 tours (${s.mean - h.mean >= 0 ? '+' : ''}${f0(s.mean - h.mean)} k$ ce tour), risque de perte ${(s.pneg * 100).toFixed(0)} % (actuelle ${(h.pneg * 100).toFixed(0)} %).`);
    out.push(row.roiMkt < 0 ? `Marketing saturé : +100 k$ rapporte ${f0(row.roiMkt)} k$ sur 3 tours (+${row.shareMkt.toFixed(2)} pt de part). Ne pas dépasser ${f0(d.mkt)} k$.` : `Marketing encore rentable : +100 k$ donne ${f0(row.roiMkt)} k$ sur 3 tours et +${row.shareMkt.toFixed(2)} pt de part.`);
    out.push(row.roiRd < 0 ? `R&D à faible retour sur 3 tours (${f0(row.roiRd)} k$ par +100 k$) : effet cumulatif sur la qualité, à justifier par l'horizon.` : `R&D rentable (+${f0(row.roiRd)} k$ sur 3 tours par +100 k$ supplémentaire).`);
    const sens = Object.entries(row.sens).sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))[0];
    out.push(`Levier le plus sensible : ${{ price: 'prix (+2 $)', mkt: 'marketing (+200 k$)', rd: 'R&D (+200 k$)' }[sens[0]]} change la valeur sur 3 tours de ${sens[1] >= 0 ? '+' : ''}${f0(sens[1])} k$.`);
    if (d.mkt >= m.P.maxMkt || d.rd >= m.P.maxRd) out.push(`Plafond de budget atteint (marketing ${f0(m.P.maxMkt)} k$, R&D ${f0(m.P.maxRd)} k$) : l'optimum est au bord, vérifiez votre trésorerie réelle et ajustez les plafonds dans Données.`);
    const rivals = row.field.filter(x => !x.me).sort((a, b) => (b.share - b.last) - (a.share - a.last));
    const r = rivals[0];
    out.push(`Menace principale : ${r.name} (${(r.share - r.last >= 0 ? '+' : '') + (r.share - r.last).toFixed(1)} pt attendu, prix prévu ${r.dec.price.toFixed(1)} $, marketing ${f0(r.dec.mkt)} k$, R&D ${f0(r.dec.rd)} k$).`);
    const cheap = rivals.slice().sort((a, b) => a.dec.price - b.dec.price)[0];
    if (d.price > cheap.dec.price + 4) out.push(`Alerte prix : vous êtes ${f0(d.price - cheap.dec.price)} $ au-dessus de ${cheap.name} ; justifié seulement par marque et qualité.`);
    return out;
  }

  function sample() {
    const P = Object.assign({}, DEF), offs = [0, 0.15, -0.1, -0.25, -0.6], names = ['A', 'B', 'C', 'D', 'E'];
    const dec = [
      [[40, 700, 400], [39, 750, 450], [38, 800, 500], [38, 800, 500]],
      [[37, 900, 500], [36, 950, 550], [36, 1000, 600], [35, 1000, 600]],
      [[33, 600, 300], [33, 600, 350], [32, 650, 400], [32, 700, 450]],
      [[42, 500, 700], [41, 500, 750], [41, 500, 800], [40, 550, 800]],
      [[30, 300, 100], [30, 300, 100], [29, 300, 150], [29, 300, 150]],
    ];
    const teams = names.map(n => ({ name: n, history: [] })), br = names.map(() => 0), qq = names.map(() => 0);
    const m = { P, teams: names.map((n, j) => ({ name: n, off: offs[j] })), mi: 0, units0: 1100, pavg0: 36, cost: 27 };
    for (let t = 0; t < 4; t++) {
      const ds = dec.map(x => ({ price: x[t][0], mkt: x[t][1], rd: x[t][2] }));
      const st = { brand: br.slice(), q: qq.slice() };
      const rows = evalRound(m, { brand: br.map(b => b / P.rho), q: qq.map(q => q / P.rho) }, ds, t, 0);
      names.forEach((n, j) => { br[j] = P.rho * br[j] + ds[j].mkt; qq[j] = P.rho * qq[j] + ds[j].rd; teams[j].history.push({ price: ds[j].price, mkt: ds[j].mkt, rd: ds[j].rd, rev: Math.round(rows[j].rev), profit: Math.round(rows[j].profit), share: +(rows[j].share * 100).toFixed(1) }); });
      void st;
    }
    return { me: 'A', teams };
  }

  function fromCsv(text, me) {
    const lines = text.trim().split(/\r?\n/), head = lines[0].split(/[;,\t]/).map(s => s.trim().toLowerCase()), by = {};
    lines.slice(1).forEach(l => { const c = l.split(/[;,\t]/), o = {}; head.forEach((h, i) => { o[h] = c[i] && c[i].trim(); }); (by[o.team] = by[o.team] || []).push(o); });
    const teams = Object.keys(by).map(n => ({ name: n, history: by[n].sort((a, b) => a.round - b.round).map(o => ({ price: +o.price, mkt: +o.mkt, rd: +o.rd, rev: +o.rev, profit: +o.profit, share: +o.share })) }));
    return { me: me || teams[0].name, teams };
  }

  const api = { DEF, fit, calibrate, stateOf, forecast, scenarios, evalMine, optimize, evalRound, analyse, plan, matrix, advise, sample, fromCsv, stats };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.WR = api;
})(typeof window !== 'undefined' ? window : globalThis);
