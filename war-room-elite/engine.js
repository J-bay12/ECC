(function (root) {
  'use strict';
  /* Moteur Capstone 2.0 Sustainability (Round 1, 2027): approximation des regles. $K et milliers d'unites.
     Repris de l'extraction Capsim de l'equipe Andrews, rendu remplacable via setData(). */
  const DEFAULT_DATA = {
    round: 1, year: 2027,
    SEG: {
      Traditional: { size: 6156, g: .092, ideal: [5.0, 15.0], off: [0, 0], drift: [.7, -.7], price: [20, 30], mtbf: [14000, 19000], age: 2, aw: 1.5, w: { age: .47, price: .23, pos: .21, mtbf: .09 }, acc: .54 },
      'Low End': { size: 7467, g: .117, ideal: [1.7, 18.3], off: [-.8, .8], drift: [.5, -.5], price: [15, 25], mtbf: [12000, 17000], age: 7, aw: 3.0, w: { price: .53, age: .24, pos: .16, mtbf: .07 }, acc: .40 },
      'High End': { size: 2128, g: .162, ideal: [8.9, 11.1], off: [1.4, -1.4], drift: [.9, -.9], price: [30, 40], mtbf: [20000, 25000], age: 0, aw: 1.5, w: { pos: .43, age: .29, mtbf: .19, price: .09 }, acc: .48 },
      Performance: { size: 1596, g: .198, ideal: [9.4, 16.0], off: [1.4, -1.0], drift: [1.0, -.7], price: [25, 35], mtbf: [22000, 27000], age: 1, aw: 1.5, w: { mtbf: .43, pos: .29, price: .19, age: .09 }, acc: .37 },
      Size: { size: 1653, g: .183, ideal: [4.0, 10.6], off: [1.0, -1.4], drift: [.7, -1.0], price: [25, 35], mtbf: [16000, 21000], age: 1, aw: 1.5, w: { pos: .43, age: .29, mtbf: .19, price: .09 }, acc: .42 },
    },
    BASE: {
      Able: { seg: 'Traditional', pfmn: 5.5, size: 14.5, mtbf: 17500, age: 3.1, price: 28, promo: 1000, sales: 1000, inv: 189, cap: 1800, auto: 4, mat: 10.99, aware: .55, sold: 999 },
      Acre: { seg: 'Low End', pfmn: 3.0, size: 17.0, mtbf: 14000, age: 4.6, price: 21, promo: 900, sales: 900, inv: 39, cap: 1400, auto: 5, mat: 7.35, aware: .517, sold: 1763 },
      Adam: { seg: 'High End', pfmn: 8.0, size: 12.0, mtbf: 23000, age: 1.7, price: 38, promo: 800, sales: 800, inv: 40, cap: 900, auto: 3, mat: 15.23, aware: .486, sold: 366 },
      Aft: { seg: 'Performance', pfmn: 9.4, size: 15.5, mtbf: 25000, age: 2.5, price: 33, promo: 700, sales: 700, inv: 78, cap: 600, auto: 3, mat: 15.18, aware: .455, sold: 358 },
      Agape: { seg: 'Size', pfmn: 4.0, size: 11.0, mtbf: 19000, age: 2.6, price: 33, promo: 700, sales: 700, inv: 62, cap: 600, auto: 3, mat: 12.96, aware: .455, sold: 314 },
    },
    R0: { cash: 3431, ar: 8307, inv: 8618, fixed: 75867, ap: 6584, ltd: 41700, equity: 47939, shares: 2000, price: 34.25, sales: 101073, profit: 4185, depr: 7587, interest: 5421, eps: 2.09, bv: 23.97, ebit: 11991, cmPct: .2825, ros: .041, roe: .087, units: 3800 },
    LIM: { bond: 18900, curDebt: 20300, stock: 13600, capex: 32693, div: 2.09, employees: 704, bondRate: .113, debtRate: .099, tax: .35, issueFee: .05, retireDebt: 41700, buyback: 13600 }, // retireDebt et buyback: plafonds a lire dans l'ecran Finance de Capsim
    TARGET: { shares: 2000 }, // actions en circulation visees a la fin de partie (k)
    SUP: { value: { n: 'Value Supply', mat: -.05, em: .05, w: .02, d: -.03 }, corecraft: { n: 'Corecraft Materials', mat: 0, em: 0, w: 0, d: 0 }, protech: { n: 'ProTech Resources', mat: .05, em: -.10, w: -.04, d: .02 }, ecolux: { n: 'Ecolux Solutions', mat: .075, em: -.20, w: -.06, d: .04 } },
    CB: { budget: { n: 'Budget', lab: -.10 }, competitive: { n: 'Competitive', lab: .05 }, leader: { n: 'Leader', lab: .10 } },
    PROG: [['Food Drive', 500], ['Fundraising Banquet', 500], ['Charity 5K Race', 1000], ['Youth Technology Program', 1500], ['Community Housing Initiative', 2000]],
    PEN: [0, 20, 50, 100, 150], WAGE: 1.1025, STARTE: { community: 45.6, employee: 2.4 },
    ESGFX: { prog: [0, 0, 0, 0, 0], train: 0, rr: 0, leader: 0 }, // effets mesures sur Community/Employee (inconnus par defaut)
    compObs: null,
    INTEL: { history: [], demo: false }, // equipes adverses: [{round, teams:{Nom:{fin:{}, products:{p:{seg,pfmn,size,mtbf,age,price,promo,sales,aware,inv,sold}}}}}]
  };
  const clone = o => JSON.parse(JSON.stringify(o));
  let DATA, SEG, BASE, R0, LIM, SUP, CB, PROG, PEN, WAGE, PRODS, SEGS, CBASE;
  function bind() { ({ SEG, BASE, R0, LIM, SUP, CB, PROG, PEN, WAGE } = DATA); CBASE = DATA.CBASE || DATA.BASE; PRODS = Object.keys(BASE); SEGS = Object.keys(SEG); }
  function setData(patch) {
    const base = DATA ? DATA : clone(DEFAULT_DATA), next = clone(base);
    const merge = (t, s) => { for (const k of Object.keys(s || {})) { if (s[k] && typeof s[k] === 'object' && !Array.isArray(s[k]) && t[k] && typeof t[k] === 'object' && !Array.isArray(t[k])) merge(t[k], s[k]); else t[k] = clone(s[k]); } };
    merge(next, patch || {}); if ((patch && patch.BASE && !patch.CBASE) || !next.CBASE) next.CBASE = clone(next.BASE); DATA = next; bind();
    return DATA;
  }
  function resetData() { DATA = null; return setData({}); }
  function activate(d) { const prev = DATA; DATA = d; bind(); return prev; }
  function withData(d, fn) { const prev = activate(d); try { return fn(); } finally { activate(prev); } }
  setData({});

  const laborAt = a => 11.87 - 1.10 * a;
  const rdMonths = (b, d) => { const dist = Math.hypot(d.pfmn - b.pfmn, d.size - b.size); if (dist < .01) return d.mtbf !== b.mtbf ? 1 : 0; return dist * 7.5 * (0.85 + 0.05 * b.auto); };
  const awareGain = x => .5 * (1 - Math.exp(-x / 1100)), accGain = x => .35 * (1 - Math.exp(-x / 2000));
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

  function defaultDecisions(B) { B = B || BASE; const D = {}; for (const n of PRODS) { const b = B[n]; D[n] = { pfmn: b.pfmn, size: b.size, mtbf: b.mtbf, price: b.price, promo: b.promo, sales: b.sales, prod: Math.round(b.sold * 1.1 / 10) * 10, auto: b.auto, capAdd: 0, rev: null, rec: 0 }; } return D; }
  const defaultFin = () => ({ bond: 0, retire: 0, buyback: 0, stock: 0, div: 0, curDebt: 0, supplier: 'corecraft', energy: 0, cb: 'competitive', train: 0, rr: 0, programs: [] });

  function competitor(mode) {
    const D = defaultDecisions(CBASE), o = DATA.compObs;
    for (const n of PRODS) { const b = CBASE[n], s = SEG[b.seg], d = D[n];
      if (mode === 'observe' && o) { d.pfmn = +(b.pfmn + s.drift[0] * (o.drift == null ? .8 : o.drift)).toFixed(1); d.size = +(b.size + s.drift[1] * (o.drift == null ? .8 : o.drift)).toFixed(1); d.rev = o.rev || 8; d.price = b.price + (o.priceDelta || 0); d.promo = o.promo || b.promo; d.sales = o.sales || b.sales; continue; }
      if (mode !== 'passif' && n !== 'Acre') { d.pfmn = +(b.pfmn + s.drift[0] * .8).toFixed(1); d.size = +(b.size + s.drift[1] * .8).toFixed(1); d.rev = mode === 'agressif' ? 6 : 8; }
      if (mode === 'standard') { d.price = b.price - .5; d.promo = 1400; d.sales = 1400; }
      if (mode === 'agressif') { d.price = b.price - 1.5; d.promo = 2000; d.sales = 2000; d.mtbf = b.mtbf + 1000; }
    } return D;
  }

  function scoreAt(b, d, segName, m, revMonth, moved) {
    const s = SEG[segName], t = m / 12, done = revMonth > 0 && revMonth <= m;
    const pf = done ? d.pfmn : b.pfmn, sz = done ? d.size : b.size, mt = done ? d.mtbf : b.mtbf;
    const r = revMonth / 12, age = (done && moved) ? (b.age + r) / 2 + (t - r) : b.age + t;
    const ix = s.ideal[0] + s.drift[0] * t, iy = s.ideal[1] + s.drift[1] * t;
    const dc = Math.hypot(pf - (ix - s.off[0]), sz - (iy - s.off[1]));
    if (dc >= 4) return 0;
    const di = Math.hypot(pf - ix, sz - iy), pos = clamp(1 - di / 3, 0.02, 1);
    const ageS = s.age === 0 ? Math.exp(-Math.pow(age / s.aw, 2)) : Math.exp(-Math.pow((age - s.age) / s.aw, 2));
    const lo = s.price[0] - .5, hi = s.price[1] - .5;
    let pr = 1 - .96 * clamp((d.price - lo) / 10, 0, 1); if (d.price > hi) pr = Math.max(0, .2 - .2 * (d.price - hi));
    let cut = 1; if (d.price > hi) cut *= Math.max(0, 1 - .2 * (d.price - hi)); if (d.price < lo) cut *= Math.max(0, 1 - .2 * (lo - d.price));
    let ms = .2 + .8 * clamp((mt - s.mtbf[0]) / 5000, 0, 1); if (mt < s.mtbf[0]) cut *= Math.max(0, 1 - .2 * (s.mtbf[0] - mt) / 1000);
    if (dc > 2.5) cut *= (4 - dc) / 1.5;
    return (s.w.age * ageS + s.w.price * pr + s.w.pos * pos + s.w.mtbf * ms) * cut;
  }

  function firmScores(D, B) {
    B = B || BASE; const P = Object.keys(B);
    const acc = {}; for (const sg of SEGS) { const bud = P.filter(n => B[n].seg === sg).reduce((a, n) => a + D[n].sales, 0); acc[sg] = clamp(SEG[sg].acc * .67 + accGain(bud), 0, 1); }
    const out = {}, meta = {};
    for (const n of P) { const b = B[n], d = D[n], moved = Math.hypot(d.pfmn - b.pfmn, d.size - b.size) > .01;
      const est = rdMonths(b, d) + .65 * (d.rec || 0) / 10, rev = est === 0 ? 0 : (d.rev || Math.ceil(est)), aware = clamp(b.aware * .67 + awareGain(d.promo), 0, 1);
      out[n] = {}; meta[n] = { rev, est, aware, moved };
      for (const sg of SEGS) { let sum = 0; for (let m = 1; m <= 12; m++) sum += scoreAt(b, d, sg, m, rev, moved); out[n][sg] = sum / 12 * (1 + aware) / 2 * (1 + acc[sg]) / 2; }
    } return { scores: out, meta, acc };
  }


  const hasIntel = () => !!(DATA.INTEL && DATA.INTEL.history && DATA.INTEL.history.length && Object.keys(DATA.INTEL.history[DATA.INTEL.history.length - 1].teams || {}).length);
  function cache() { if (!DATA.__c) Object.defineProperty(DATA, '__c', { value: {}, enumerable: false, writable: true }); return DATA.__c; }
  function intelState(mode) {
    const H = DATA.INTEL.history, cur = H[H.length - 1], prev = H.length > 1 ? H[H.length - 2] : null, B = {}, D = {};
    for (const t of Object.keys(cur.teams)) { B[t] = {}; D[t] = {}; const P = cur.teams[t].products || {};
      for (const n of Object.keys(P)) { const p = Object.assign({ auto: 3, age: 2, aware: .45, mtbf: 15000, promo: 800, sales: 800, inv: 0, cap: 1000 }, P[n]); B[t][n] = p; const q = prev && prev.teams[t] && prev.teams[t].products && prev.teams[t].products[n], s = SEG[p.seg] || SEG[SEGS[0]];
        const d = { pfmn: p.pfmn, size: p.size, mtbf: p.mtbf, price: p.price, promo: p.promo, sales: p.sales, prod: Math.max(10, p.sold || 100), auto: p.auto, capAdd: 0, rev: null, rec: 0 };
        if (mode === 'intel_trend') { if (q) { d.pfmn += (p.pfmn - q.pfmn) * .8; d.size += (p.size - q.size) * .8; d.price = clamp(p.price + clamp(p.price - q.price, -2, 2), 5, 80); d.promo = Math.max(0, p.promo + (p.promo - q.promo) * .5); d.sales = Math.max(0, p.sales + (p.sales - q.sales) * .5); d.mtbf = p.mtbf + (p.mtbf - q.mtbf) * .5; } else { d.pfmn += s.drift[0] * .8; d.size += s.drift[1] * .8; } d.rev = 8; }
        else if (mode === 'intel_correct') { d.pfmn = s.ideal[0] + s.drift[0] * .5; d.size = s.ideal[1] + s.drift[1] * .5; d.price = clamp(p.price, s.price[0] - .5, s.price[1] - .5); d.mtbf = Math.max(p.mtbf, s.mtbf[0]); d.promo = Math.max(p.promo, 1200); d.sales = Math.max(p.sales, 1200); d.rev = 8; }
        D[t][n] = d; } }
    return { B, D };
  }
  function sumSeg(scores, mult) { const o = {}; for (const sg of SEGS) { let t = 0; for (const n of Object.keys(scores)) t += scores[n][sg]; o[sg] = t * mult; } return o; }
  function compSums(mode) {
    if (/^intel_/.test(mode) && !hasIntel()) mode = 'standard';
    const c = cache(); if (c[mode]) return c[mode]; let out;
    if (/^intel_/.test(mode)) { const I = intelState(mode), th = {}; SEGS.forEach(sg => { th[sg] = 0; }); for (const t of Object.keys(I.D)) { const fs = firmScores(I.D[t], I.B[t]); for (const n of Object.keys(fs.scores)) for (const sg of SEGS) th[sg] += fs.scores[n][sg]; } out = { th, cd: null, teamD: I.D }; }
    else { const cd = competitor(mode); out = { th: sumSeg(firmScores(cd, CBASE).scores, 4), cd, teamD: null }; }
    c[mode] = out; return out;
  }
  function segmentTotals(D, comp) { const me = firmScores(D), th = compSums(comp || 'standard').th, o = {}; for (const sg of SEGS) { let m = 0; for (const n of PRODS) m += me.scores[n][sg]; o[sg] = { mine: m, theirs: th[sg], demand: SEG[sg].size * (1 + SEG[sg].g) }; } return o; }

  function simulate(D, F, opts) {
    opts = opts || {}; const shock = opts.shock || 0, fmt = x => Math.round(x).toLocaleString(root.__LOC || 'fr-FR');
    const me = firmScores(D);
    let cd = null, teamD = null, thSeg;
    if (opts.comp === 'adaptatif') { const c0 = compSums('standard'), sh = {}; for (const sg of SEGS) { let mi = 0; for (const n of PRODS) mi += me.scores[n][sg]; sh[sg] = mi / ((mi + c0.th[sg]) || 1); } cd = competitor('standard'); for (const n of PRODS) { const dl = clamp((sh[BASE[n].seg] - .2) / .2, 0, 1); cd[n].price -= 1.5 * dl; cd[n].promo += 800 * dl; cd[n].sales += 800 * dl; } thSeg = sumSeg(firmScores(cd, CBASE).scores, 4); }
    else { const cs = compSums(opts.comp || 'standard'); thSeg = cs.th; cd = cs.cd; teamD = cs.teamD; }
    const sup = SUP[F.supplier || 'corecraft'], cb = CB[F.cb || 'competitive'];
    for (const n of PRODS) { const rv = me.meta[n].rev, fr = rv > 0 && rv <= 12 ? (12 - rv) / 12 : 0; for (const sg of SEGS) me.scores[n][sg] *= (1 + sup.d) * (1 + (D[n].rec || 0) / 1000 * fr); }
    const res = { products: {}, segments: {}, alerts: [] }, demand = {}; PRODS.forEach(n => demand[n] = 0);
    for (const sg of SEGS) { const s = SEG[sg], tot = s.size * (1 + s.g) * (1 + shock); let mine = 0;
      for (const n of PRODS) mine += me.scores[n][sg];
      const all = mine + thSeg[sg]; res.segments[sg] = { demand: tot, share: all ? mine / all : 0, acc: me.acc[sg], units: 0 };
      for (const n of PRODS) demand[n] += all ? tot * me.scores[n][sg] / all : 0; }
    let rev = 0, varc = 0, carry = 0, invVal = 0, prodCost = 0, mkt = 0, rd = 0, capex = 0, units = 0, labSave = 0;
    for (const n of PRODS) { const b = BASE[n], d = D[n], m = me.meta[n];
      const prod = Math.min(d.prod, b.cap * 2), ot = prod > b.cap ? (prod - b.cap) / prod : 0, fracNew = m.rev > 0 && m.rev <= 12 ? (12 - m.rev) / 12 : 0;
      const matNew = (b.mat + .3 * (d.mtbf - b.mtbf) / 1000 + .55 * (d.pfmn - b.pfmn) - .55 * (d.size - b.size)) * (1 + .0123 * (d.rec || 0) / 10);
      const mat = (b.mat * (1 - fracNew) + matNew * fracNew) * (1 + sup.mat), lab = laborAt(b.auto) * WAGE * (1 + cb.lab) * (1 + .5 * ot);
      const unit = mat + lab, avail = b.inv + prod, sold = Math.min(demand[n], avail), end = avail - sold;
      rev += sold * d.price; varc += sold * unit; carry += end * unit * .12; invVal += end * unit; prodCost += prod * unit; mkt += d.promo + d.sales; units += sold; rd += Math.min(m.est, 24) / 12 * 1000;
      const cx = b.cap * 4 * Math.max(0, d.auto - b.auto) + Math.max(0, d.capAdd) * (6 + 4 * d.auto); capex += cx; res.segments[b.seg].units += sold;
      const lab28 = laborAt(d.auto) * WAGE * 1.05 * (1 + cb.lab); labSave += sold * Math.max(0, lab - lab28);
      res.products[n] = { demand: demand[n], sold, end, avail, unit, mat, lab, cm: (d.price - unit) / d.price, util: prod / b.cap, rev: m.rev, est: m.est, aware: m.aware, stockout: demand[n] > avail + .5, capex: cx, share: demand[n] / res.segments[b.seg].demand, lab2028: lab28, matNew };
      if (d.prod > b.cap * 2) res.alerts.push({ lv: 'bad', t: `${n} : production au-dessus de 200 % de la capacité (max ${b.cap * 2}).` });
      if (demand[n] > avail + .5) res.alerts.push({ lv: 'warn', t: `${n} : rupture de stock, ${fmt(demand[n] - avail)} k unités perdues.` });
      if (end > sold * .25 && end > 40) res.alerts.push({ lv: 'warn', t: `${n} : stock final élevé (${fmt(end)} k, ${fmt(end / Math.max(sold, 1) * 100)} % des ventes).` });
      if (m.rev > 12) res.alerts.push({ lv: 'warn', t: `${n} : la révision R&D sort après décembre (mois ${m.rev}). Aucun effet sur l'année.` });
      const s = SEG[b.seg]; if (d.price > s.price[1] - .5 || d.price < s.price[0] - .5) res.alerts.push({ lv: 'warn', t: `${n} : prix hors de la fourchette du segment (${(s.price[0] - .5).toFixed(2)} à ${(s.price[1] - .5).toFixed(2)} $).` });
    }
    const depr = R0.depr + capex / 15, admin = rev * .008, progCost = (F.programs || []).reduce((a, i) => a + PROG[i][1], 0), trainCost = (F.train || 0) * LIM.employees / 1000, esg = (F.energy || 0) + progCost + trainCost + (F.rr || 0);
    const ebit = rev - varc - carry - depr - rd - mkt - admin - esg, retire = Math.min(F.retire || 0, R0.ltd), bb = F.buyback || 0, interest = R0.interest + F.bond * LIM.bondRate + F.curDebt * LIM.debtRate - retire * LIM.bondRate, fees = F.bond * LIM.issueFee + F.stock * LIM.issueFee;
    const ebt = ebit - interest - fees, tax = ebt > 0 ? ebt * LIM.tax : 0, ps = ebt > 0 ? (ebt - tax) * .02 : 0, ni = ebt - tax - ps;
    const shares = Math.max(1, R0.shares + F.stock / R0.price - bb / R0.price), divTotal = F.div * shares, ar = rev * 30 / 365, ap = prodCost * 30 / 365;
    let cash = R0.cash + ni + depr - (ar - R0.ar) + (ap - R0.ap) - (invVal - R0.inv) - capex + F.bond + F.stock + F.curDebt - divTotal - (R0.repay || 0) - retire - bb;
    const eloan = cash < 0 ? -cash : 0; if (eloan) cash = 0;
    const equity = R0.equity + ni + F.stock - bb - divTotal, fixed = R0.fixed + capex - depr, assets = cash + ar + invVal + fixed, liab = ap + R0.ltd - retire + F.bond + F.curDebt + eloan;
    const eps = ni / shares, bv = equity / shares; let price = bv + 5 * eps; price *= 1 - Math.min(.4, eloan / 40000); price = Math.max(1, bv * .5, price);
    const RAT = ['AAA', 'AA', 'A', 'BBB', 'BB', 'B', 'CCC', 'CC', 'C', 'D'], rating = RAT[clamp(Math.floor(liab / assets / .09), 0, 9)];
    if (eloan) res.alerts.unshift({ lv: 'bad', t: `Emprunt d'urgence de ${fmt(eloan)} k$ : la trésorerie de fin d'année est négative.` });
    if ((F.retire || 0) > LIM.retireDebt) res.alerts.push({ lv: 'bad', t: `Remboursement de dette long terme de ${fmt(F.retire)} k$ : plafond de ${fmt(LIM.retireDebt)} k$.` });
    if ((F.buyback || 0) > LIM.buyback) res.alerts.push({ lv: 'bad', t: `Rachat d'actions de ${fmt(F.buyback)} k$ : plafond de ${fmt(LIM.buyback)} k$.` });
    if (capex > LIM.capex) res.alerts.push({ lv: 'bad', t: `Investissement usine de ${fmt(capex)} k$ : Capsim plafonne à ${fmt(LIM.capex)} k$.` });
    const totDemand = SEGS.reduce((a, s) => a + res.segments[s].demand, 0);
    Object.assign(res, { rev, varc, carry, cmPct: (rev - varc - carry) / rev, depr, rd, mkt, admin, esg, ebit, interest, fees, tax, ps, ni, cash, eloan, capex, equity, assets, liab, eps, bv, price, rating, shares, ltdEnd: R0.ltd - retire + F.bond, apNew: ap, fixedNew: fixed, compD: cd, teamD, marketCap: price * shares / 1000, share: units / totDemand, units, ros: ni / rev, roe: ni / equity, roa: ni / assets, leverage: assets / equity, invVal, divTotal, acc: me.acc, labSave,
      emissions: 100 * (1 + sup.em) * (1 - .10 * (F.energy || 0) / 2000), waste: PRODS.reduce((a, n) => a + 10 * (1 - .05 * (me.meta[n].rev > 0 && me.meta[n].rev <= 12 ? (D[n].rec || 0) : 0) / 10), 0) / PRODS.length * (1 + sup.w), progCost, trainCost });
    return res;
  }


  /* Passage a l'annee suivante: BASE, R0, segments et base des concurrents mis a jour depuis les resultats. */
  function roll(D, F, r) {
    const nx = clone(DATA);
    for (const n of PRODS) {
      const b = BASE[n], d = D[n], p = r.products[n], nb = nx.BASE[n], moved = Math.hypot(d.pfmn - b.pfmn, d.size - b.size) > .01, rr = (p.rev > 0 ? Math.min(12, p.rev) : 0) / 12;
      nb.age = moved ? (b.age + rr) / 2 + (1 - rr) : b.age + 1;
      if (p.est > 0) { nb.pfmn = d.pfmn; nb.size = d.size; nb.mtbf = d.mtbf; nb.mat = p.matNew / (1 + .0123 * (d.rec || 0) / 10); }
      nb.price = d.price; nb.promo = d.promo; nb.sales = d.sales; nb.inv = Math.max(0, p.end); nb.cap = b.cap + Math.max(0, d.capAdd || 0); nb.auto = Math.max(b.auto, d.auto); nb.aware = p.aware; nb.sold = p.sold;
    }
    Object.assign(nx.R0, { cash: r.cash, ar: r.rev * 30 / 365, inv: r.invVal, fixed: r.fixedNew, ap: r.apNew, ltd: r.ltdEnd, equity: r.equity, shares: r.shares, price: r.price, sales: r.rev, profit: r.ni, depr: r.depr, interest: DATA.R0.interest + (r.ltdEnd - DATA.R0.ltd) * LIM.bondRate, eps: r.eps, bv: r.bv, ebit: r.ebit, cmPct: r.cmPct, ros: r.ros, roe: r.roe, units: r.units, repay: F.curDebt });
    for (const sg of SEGS) { const s = nx.SEG[sg]; s.size *= 1 + s.g; s.ideal = [s.ideal[0] + s.drift[0], s.ideal[1] + s.drift[1]]; }
    if (r.compD) for (const n of PRODS) { const cb = CBASE[n], d = r.compD[n], nb = nx.CBASE[n], mv = Math.hypot(d.pfmn - cb.pfmn, d.size - cb.size) > .01;
      Object.assign(nb, { pfmn: d.pfmn, size: d.size, mtbf: d.mtbf, price: d.price, promo: d.promo, sales: d.sales, age: mv ? (cb.age + .5) / 2 + .5 : cb.age + 1, aware: clamp(cb.aware * .67 + awareGain(d.promo), 0, 1) }); }
    if (r.teamD && hasIntel()) { const H = DATA.INTEL.history, cur = H[H.length - 1], ent = { round: (cur.round || 0) + 1, teams: {} };
      for (const t of Object.keys(cur.teams)) { ent.teams[t] = { fin: clone(cur.teams[t].fin || {}), products: {} }; for (const n of Object.keys(cur.teams[t].products)) { const p = cur.teams[t].products[n], d = r.teamD[t][n], mv = Math.hypot(d.pfmn - p.pfmn, d.size - p.size) > .01; ent.teams[t].products[n] = Object.assign({}, p, { pfmn: d.pfmn, size: d.size, mtbf: d.mtbf, price: d.price, promo: d.promo, sales: d.sales, age: mv ? (p.age + .5) / 2 + .5 : p.age + 1, aware: clamp((p.aware == null ? .45 : p.aware) * .67 + awareGain(d.promo), 0, 1) }); } }
      nx.INTEL.history = [cur, ent]; }
    nx.round = (DATA.round || 1) + 1; nx.year = (DATA.year || 2027) + 1; return nx;
  }
  const hold = F => { const D = defaultDecisions(), G = Object.assign(defaultFin(), clone(F), { bond: 0, retire: 0, buyback: 0, curDebt: 0, stock: 0, div: 0 }); return { D, F: G }; };

  function fitProduction(D, F, comp, iters) { for (let i = 0; i < (iters || 3); i++) { const r = simulate(D, F, { comp, shock: 0 }); for (const n of PRODS) D[n].prod = Math.min(BASE[n].cap * 2, Math.max(0, Math.round((r.products[n].demand * 1.1 - BASE[n].inv) / 10) * 10)); } }
  function effE(F, E) { const x = DATA.ESGFX, e = { community: E.community, employee: E.employee }; (F.programs || []).forEach(i => { e.community += x.prog[i] || 0; }); e.employee += (x.train || 0) * (F.train || 0) / 1000 + (x.rr || 0) * (F.rr || 0) / 1000 + (F.cb === 'leader' ? x.leader || 0 : 0); return e; }
  function rules(r, E, F) { const lf = (x, d) => x.toLocaleString(root.__LOC || 'fr-FR', { minimumFractionDigits: d, maximumFractionDigits: d }), e = F ? effE(F, E) : E, L = [['Déchets', r.waste, '< 8 g', r.waste < 8, lf(r.waste, 2) + ' g'], ['Émissions', r.emissions, '< 80 kg', r.emissions < 80, lf(r.emissions, 1) + ' kg'], ['Community', e.community, '> 50', e.community > 50, lf(e.community, 1)], ['Employee', e.employee, '> 3', e.employee > 3, lf(e.employee, 1)]]; const miss = L.filter(x => !x[3]).length; return { L, miss, pen: PEN[miss] }; }
  const esgKnown = () => DATA.ESGFX.prog.some(x => x) || DATA.ESGFX.train || DATA.ESGFX.rr || DATA.ESGFX.leader;

  const STRATS = {
    A: { rec: 0, name: 'A · Leader coûts', tag: 'Volume et automatisation sur Low End et Traditional',
      thesis: 'On automatise Acre et Able de 2 points chacun, on baisse les prix sur les deux gros segments (71 % des unités) et on laisse les trois niches vivre avec un budget minimal.',
      plus: ['Coûts de main-d\'œuvre les plus bas dès 2028, marge qui monte chaque année', 'Prix bas sur le Low End, où le prix pèse 53 % de l\'achat', 'Peu de R&D : Acre gagne à vieillir vers 7 ans'],
      minus: ['Année 2027 la plus lourde : 32 M$ d\'usine, le maximum autorisé, tous les plafonds de financement utilisés', 'Trésorerie fragile si une guerre des prix démarre tout de suite', 'L\'automatisation ralentit les révisions R&D', 'ESG repoussé : un seul programme Community en 2027'],
      D: { Able: { pfmn: 5.9, size: 14.1, mtbf: 17000, price: 26.5, promo: 1400, sales: 1500, auto: 6 }, Acre: { price: 19.5, promo: 1500, sales: 1700, auto: 7, capAdd: 200 }, Adam: { mtbf: 23500, price: 38.5, promo: 800, sales: 800 }, Aft: { mtbf: 26000, price: 33, promo: 700, sales: 700 }, Agape: { mtbf: 19500, price: 33, promo: 700, sales: 700 } },
      F: { bond: 18900, stock: 13600, div: 0, curDebt: 20300, supplier: 'corecraft', energy: 0, cb: 'competitive', train: 0, rr: 0, programs: [0] } },
    B: { rec: 20, name: 'B · Premium durable', tag: 'Différenciation sur High End, Performance et Size',
      thesis: 'On investit en R&D et marketing sur les trois segments qui croissent de 16 à 20 % par an, prix hauts, fournisseur Ecolux, maximum d\'énergie renouvelable et 20 % de matière recyclée.',
      plus: ['Segments les plus dynamiques, peu sensibles au prix', 'Peu d\'investissement usine : trésorerie plus sûre', 'Règle Émissions passée dès 2027, déchets déjà à 8,5 g'],
      minus: ['Segments petits : 29 % des unités', 'R&D à refaire chaque année, la matière recyclée allonge chaque révision', 'Matière 7,5 % plus chère avec Ecolux', 'Low End et Traditional exposés si un concurrent casse les prix'],
      D: { Able: { pfmn: 6.0, size: 14.0, mtbf: 18000, price: 28, promo: 1200, sales: 1200 }, Acre: { price: 21, promo: 1000, sales: 1000 }, Adam: { pfmn: 8.9, size: 11.1, mtbf: 25000, price: 39.5, promo: 1800, sales: 1800 }, Aft: { pfmn: 10.2, size: 15.4, mtbf: 27000, price: 34.5, promo: 1500, sales: 1500 }, Agape: { pfmn: 4.6, size: 10.1, mtbf: 21000, price: 34.5, promo: 1500, sales: 1500 } },
      F: { bond: 0, stock: 13600, div: 0, curDebt: 14500, supplier: 'ecolux', energy: 2000, cb: 'competitive', train: 250, rr: 250, programs: [0, 1] } },
    C: { rec: 15, name: 'C · Sobre', tag: 'Présence sur les 5 segments, dépenses mesurées',
      thesis: 'On repositionne quatre produits, on garde nos prix, on augmente peu les budgets, on automatise Acre d\'un point et on finance par actions et dette courte, sans obligations.',
      plus: ['Résultat 2027 proche de l\'équilibre', 'Aucune obligation : pas de frais de 5 % ni d\'intérêts à 11,3 %', 'Résiste à une chute de 25 % de la demande sans emprunt d\'urgence', 'A ou B reste possible au Round 2'],
      minus: ['Part de marché en léger recul face à des concurrents plus dépensiers', 'Coûts de main-d\'œuvre presque inchangés en 2028', 'Retard à rattraper si un concurrent prend l\'avantage'],
      D: { Able: { pfmn: 6.0, size: 14.0, price: 28, promo: 1200, sales: 1200 }, Acre: { price: 21, promo: 1100, sales: 1100, auto: 6 }, Adam: { pfmn: 8.9, size: 11.1, mtbf: 23500, price: 38.5, promo: 1000, sales: 1000 }, Aft: { pfmn: 10.0, size: 15.4, mtbf: 26000, price: 33, promo: 900, sales: 900 }, Agape: { pfmn: 4.5, size: 10.2, mtbf: 19500, price: 33.5, promo: 900, sales: 900 } },
      F: { bond: 0, stock: 13600, div: 0, curDebt: 9000, supplier: 'corecraft', energy: 1000, cb: 'competitive', train: 0, rr: 0, programs: [0] } },
  };
  function build(key, strat) { const s = strat || STRATS[key], D = defaultDecisions(); for (const n of PRODS) Object.assign(D[n], (s.D || {})[n] || {}, { rec: s.rec || 0 }); const F = Object.assign(defaultFin(), clone(s.F)); fitProduction(D, F, 'standard'); return { D, F }; }
  function zero() { const D = defaultDecisions(), F = defaultFin(); fitProduction(D, F, 'standard'); return { D, F }; }

  const api = { hasIntel, segmentTotals, scoreAt, compSums, setData, resetData, activate, withData, roll, hold, getData: () => DATA, defaultDecisions, defaultFin, competitor, simulate, fitProduction, rules, effE, esgKnown, STRATS, build, zero, clone, clamp, laborAt,
    get PRODS() { return PRODS; }, get SEGS() { return SEGS; }, get BASE() { return BASE; }, get SEG() { return SEG; }, get R0() { return R0; }, get LIM() { return LIM; }, get SUP() { return SUP; }, get CB() { return CB; }, get PROG() { return PROG; } };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.CAP = api;
})(typeof window !== 'undefined' ? window : globalThis);
