(function (root) {
  'use strict';
  const DEF = { beta: 0.12, gamma: 0.9, delta: 0.7, rho: 0.6, eps: 0.6, fixed: 460, growth: 0.05, noise: 0.06, aggr: 0, lambda: 0.5, maxMkt: 2000, maxRd: 1500, budget: 2400 };
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
    let cost = clamp(me.last.price - (me.last.profit + me.last.mkt + me.last.rd + P.fixed) / units, 5, me.last.price - 1), costFit = null;
    if (me.hist.length >= 3 && !(over && over.fixed !== undefined)) {
      const xs = me.hist.map(h => h.rev / h.price), ys = me.hist.map((h, i) => h.profit + h.mkt + h.rd - h.rev), mx = mean(xs), my = mean(ys);
      const vx = sum(xs.map(x => (x - mx) ** 2));
      if (vx > 1e-9) { const b = sum(xs.map((x, i) => (x - mx) * (ys[i] - my))) / vx, a = my - b * mx, c = -b, F = -a;
        if (c >= 5 && c < Math.min(...me.hist.map(h => h.price)) - 0.5 && F >= 0 && F <= 5000) { cost = c; P.fixed = F; costFit = { c, F }; } }
    }
    return { P, fitted, costFit, teams, mi, units0: sum(teams.map(t => t.last.rev / t.last.price)), pavg0: mean(teams.map(t => t.last.price)), cost };
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
  function optimize(m, st, k, obj, seed, H, lam, con) {
    const hz = horizon(m, st, k, H || 3, 100, seed), res = [], L = lam === undefined ? m.P.lambda : lam;
    for (let price = 24; price <= 56; price += 2) for (let mkt = 0; mkt <= m.P.maxMkt; mkt += 100) for (let rd = 0; rd <= m.P.maxRd; rd += 100) {
      if (mkt + rd > m.P.budget || (con && (rd < (con.minRd || 0) || mkt < (con.minMkt || 0)))) continue;
      const d = { price, mkt, rd }; res.push({ d, s: score(hval(m, d, hz), obj, L) });
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
    if (d.mkt + d.rd >= m.P.budget - 50) out.push(`Budget marketing + R&D consommé (${f0(m.P.budget)} k$) : le partage ${f0(d.mkt)} / ${f0(d.rd)} est l'arbitrage optimal sous cette contrainte. Vérifiez votre trésorerie réelle et ajustez le budget dans Données.`);
    else if (d.mkt >= m.P.maxMkt || d.rd >= m.P.maxRd) out.push(`Plafond atteint (marketing ${f0(m.P.maxMkt)} k$, R&D ${f0(m.P.maxRd)} k$) : ajustez les plafonds dans Données si vos règles le permettent.`);
    const rivals = row.field.filter(x => !x.me).sort((a, b) => (b.share - b.last) - (a.share - a.last));
    const r = rivals[0];
    out.push(`Menace principale : ${r.name} (${(r.share - r.last >= 0 ? '+' : '') + (r.share - r.last).toFixed(1)} pt attendu, prix prévu ${r.dec.price.toFixed(1)} $, marketing ${f0(r.dec.mkt)} k$, R&D ${f0(r.dec.rd)} k$).`);
    const cheap = rivals.slice().sort((a, b) => a.dec.price - b.dec.price)[0];
    if (d.price > cheap.dec.price + 4) out.push(`Alerte prix : vous êtes ${f0(d.price - cheap.dec.price)} $ au-dessus de ${cheap.name} ; justifié seulement par marque et qualité.`);
    return out;
  }


  /* ---------- Retrospective: que fallait-il jouer a chaque tour ---------- */
  function preAt(m, t) {
    const P = m.P, brand = [], q = [];
    m.teams.forEach(tm => { let b = 0, qq = 0; for (let i = 0; i < t; i++) { b = P.rho * b + tm.hist[i].mkt; qq = P.rho * qq + tm.hist[i].rd; } brand.push(b); q.push(qq); });
    return { brand, q };
  }
  function retro(m) {
    const P = m.P, mi = m.mi, me = m.teams[mi], T = me.hist.length, rows = [];
    const act = t => m.teams.map(tm => ({ price: tm.hist[t].price, mkt: tm.hist[t].mkt, rd: tm.hist[t].rd }));
    const fx = t => {
      const pre = preAt(m, t), dec = act(t); let A = 0, Pc = 0;
      dec.forEach((x, j) => { if (j !== mi) { A += att(P, x.price, P.rho * pre.brand[j] + x.mkt, P.rho * pre.q[j] + x.rd, m.teams[j].off); Pc += x.price; } });
      return { pre, A, Pc, N: dec.length, U: sum(m.teams.map(tm => tm.hist[t].rev / tm.hist[t].price)), pavgT: mean(dec.map(x => x.price)) };
    };
    const ev = (f, d, b0, q0) => {
      const a = att(P, d.price, P.rho * b0 + d.mkt, P.rho * q0 + d.rd, me.off), sh = a / (a + f.A), pavg = (d.price + f.Pc) / f.N;
      return { profit: f.U * Math.pow(pavg / f.pavgT, -P.eps) * sh * (d.price - m.cost) - d.mkt - d.rd - P.fixed, share: sh };
    };
    for (let t = 0; t < T; t++) {
      const f = fx(t), f2 = t + 1 < T ? fx(t + 1) : null, a0 = act(t)[mi], a1 = f2 ? act(t + 1)[mi] : null, b0 = f.pre.brand[mi], q0 = f.pre.q[mi];
      const V = d => { const e = ev(f, d, b0, q0); let v = e.profit; if (f2) v += 0.9 * ev(f2, a1, P.rho * b0 + d.mkt, P.rho * q0 + d.rd).profit; return { v, e }; };
      const va = V(a0); let best = null;
      for (let price = 20; price <= 60; price += 1) for (let mkt = 0; mkt <= Math.max(P.maxMkt, a0.mkt); mkt += 100) for (let rd = 0; rd <= Math.max(P.maxRd, a0.rd); rd += 100) {
        if (mkt + rd > Math.max(P.budget, a0.mkt + a0.rd)) continue;
        const d = { price, mkt, rd }, r = V(d); if (!best || r.v > best.v) best = { v: r.v, e: r.e, price, mkt, rd };
      }
      const real = me.hist[t], contrib = {};
      ['price', 'mkt', 'rd'].forEach(k => { contrib[k] = V(Object.assign({}, a0, { [k]: best[k] })).v - va.v; });
      const mt = { P, teams: m.teams.map(tm => ({ hist: tm.hist.slice(0, t) })) }, surprises = [];
      if (t >= 1) m.teams.forEach((tm, j) => { if (j === mi) return; const fc = forecast(mt, j, 1), x = tm.hist[t]; surprises.push({ name: tm.name, price: x.price, predicted: fc.price, z: (x.price - fc.price) / fc.sprice, mkt: x.mkt, predMkt: fc.mkt }); });
      rows.push({ t, a0, best: { price: best.price, mkt: best.mkt, rd: best.rd }, real, pred: { profit: va.e.profit, share: va.e.share * 100 }, err: real.profit - va.e.profit,
        regret: Math.max(0, best.v - va.v), hindProfit: real.profit + (best.e.profit - va.e.profit), hindShare: real.share + (best.e.share - va.e.share) * 100, contrib, surprises, carry: !!f2 });
    }
    return rows;
  }
  function retroSummary(rows) {
    const n = rows.length, g = k => mean(rows.map(r => r.a0[k] - r.best[k])), cs = k => sum(rows.map(r => r.contrib[k]));
    const cum = sum(rows.map(r => r.regret)), L = [], units = { price: ' $', mkt: ' k$', rd: ' k$' }, names = { price: 'Prix', mkt: 'Marketing', rd: 'R&D' };
    ['price', 'mkt', 'rd'].forEach(k => {
      const gap = g(k), thr = k === 'price' ? 1.5 : 150;
      if (Math.abs(gap) >= thr && cs(k) > 20) L.push(`${names[k]} : vous avez joué en moyenne ${f0(Math.abs(gap))}${units[k]} ${gap > 0 ? 'au-dessus' : 'en dessous'} de l'optimum a posteriori, soit ${f0(cs(k))} k$ de valeur perdue sur ${n} tours. Correction : ${gap > 0 ? 'abaisser' : 'relever'} la base de ${f0(Math.abs(gap) / 2)}${units[k]} dès le prochain tour et revoir la règle de décision.`);
    });
    const errRel = mean(rows.map(r => r.err)) / (mean(rows.map(r => Math.abs(r.pred.profit))) || 1);
    if (Math.abs(errRel) > 0.1) L.push(`Écart modèle : le profit réalisé est en moyenne ${errRel < 0 ? 'inférieur' : 'supérieur'} de ${f0(Math.abs(errRel) * 100)} % à la prévision du modèle. ${errRel < 0 ? 'Appliquer une décote prudente aux projections et vérifier coûts et règles du simulateur.' : 'Le modèle est conservateur : les projections sont prudentes.'}`);
    if (n >= 4) { const a = mean(rows.slice(-2).map(r => r.regret)), b = mean(rows.slice(0, -2).map(r => r.regret)); L.push(a < b ? `Progression : le regret moyen passe de ${f0(b)} k$ (tours précédents) à ${f0(a)} k$ (2 derniers tours). Vos décisions se rapprochent de l'optimum.` : `Dérive : le regret moyen passe de ${f0(b)} k$ à ${f0(a)} k$ sur les 2 derniers tours. Reprendre la recommandation du modèle comme base de décision.`); }
    rows.forEach(r => r.surprises.filter(s => Math.abs(s.z) > 1.5).forEach(s => L.push(`T${r.t + 1} : ${s.name} a pris le marché à contre-pied (prix ${s.price.toFixed(1)} $ contre ${s.predicted.toFixed(1)} $ attendu). Surveiller ses mouvements et anticiper une réaction.`)));
    return { cum, mean: cum / n, last: rows[n - 1].regret, lessons: L, bias: { price: g('price'), mkt: g('mkt'), rd: g('rd') }, errRel };
  }

  /* ---------- Options strategiques, regles de reaction, courbes de reponse ---------- */
  function options(m) {
    const st = stateOf(m), hz5 = horizon(m, st, 1, 5, 600, 9);
    const defs = [['defend', 'Défendre la rentabilité', 'prudent', 3, 1.2, null, 'Les rivaux restent proches de leur tendance ; la marge prime sur la part.'],
      ['grow', 'Gagner des parts de marché', 'share', 3, 0.5, null, 'La part de marché se transforme en profit durable ; les rivaux ne ripostent pas immédiatement.'],
      ['invest', 'Pari qualité et innovation', 'profit', 5, 0.5, { minRd: Math.min(m.P.maxRd, Math.round(m.P.budget * 0.7 / 100) * 100) }, 'La R&D s\'accumule (rétention de 60 % par tour) et se paie sur 5 tours ; les rivaux n\'imitent pas vite.']];
    const out = defs.map(([id, label, obj, H, lam, con, bet]) => {
      const d = optimize(m, st, 1, obj, 31, H, lam, con)[0], a = analyse(m, st, 1, d, null), v5 = hval(m, d, hz5);
      return { id, label, bet, dec: d, a, val5: v5.mp, sd5: v5.sd, score: v5.mp - m.P.lambda * v5.sd };
    });
    const l = m.teams[m.mi].last, hd = { price: l.price, mkt: l.mkt, rd: l.rd }, hv = hval(m, hd, hz5);
    out.push({ id: 'hold', label: 'Reconduire la décision du dernier tour', bet: 'Rien ne change chez les rivaux et le marché reste stable.', dec: hd, a: analyse(m, st, 1, hd, null), val5: hv.mp, sd5: hv.sd, score: hv.mp - m.P.lambda * hv.sd });
    const bestI = out.reduce((b, o, i) => (o.score > out[b].score ? i : b), 0);
    out.forEach((o, i) => { o.recommended = i === bestI; });
    return out;
  }
  function reactionRules(m, rival) {
    const st = stateOf(m), base = plan(m, 1, 'prudent')[0].dec, ri = m.teams.findIndex(t => t.name === rival), rows = [];
    for (const dl of [-4, -2, 0, 2, 4]) {
      let best = null;
      for (let p = base.price - 8; p <= base.price + 8; p += 1) {
        const decs = meanDecs(m, 1, { price: p, mkt: base.mkt, rd: base.rd }); decs[ri] = Object.assign({}, decs[ri], { price: decs[ri].price + dl });
        const r = evalRound(m, st, decs, 1, 0), me = r[m.mi];
        if (!best || me.profit > best.profit) best = { price: p, profit: me.profit, share: me.share * 100, rivalPrice: decs[ri].price };
      }
      rows.push(Object.assign({ delta: dl }, best));
    }
    return { base, rows };
  }
  function sweep(m, st, d, lever, k) {
    const hz = horizon(m, st, k || 1, 3, 400, 5), lo = { price: 24, mkt: 0, rd: 0 }[lever], hi = Math.max(lo + 1, Math.min({ price: 56, mkt: m.P.maxMkt, rd: m.P.maxRd }[lever], lever === 'mkt' ? m.P.budget - d.rd : lever === 'rd' ? m.P.budget - d.mkt : 56)), pts = [];
    for (let i = 0; i <= 24; i++) {
      const x = lever === 'price' ? Math.round((lo + (hi - lo) * i / 24) * 2) / 2 : Math.round(lo + (hi - lo) * i / 24);
      const h = hval(m, Object.assign({}, d, { [lever]: x }), hz, true), s = stats(h.first.pr);
      pts.push({ x, val: h.mp, mean: s.mean, p10: s.p10, p90: s.p90, share: h.ms * 100 });
    }
    const bi = pts.reduce((b, p, i) => (p.val > pts[b].val ? i : b), 0), top = pts[bi].val, span = Math.max(1, top - Math.min(...pts.map(p => p.val)));
    const ok = pts.filter(p => p.val >= top - 0.05 * span);
    return { pts, best: pts[bi], plateau: [Math.min(...ok.map(p => p.x)), Math.max(...ok.map(p => p.x))] };
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

  const api = { DEF, fit, retro, retroSummary, options, reactionRules, sweep, preAt, calibrate, stateOf, forecast, scenarios, evalMine, optimize, evalRound, analyse, plan, matrix, advise, sample, fromCsv, stats };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.WR = api;
})(typeof window !== 'undefined' ? window : globalThis);
