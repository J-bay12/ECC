'use strict';
const M = window.WR, KEY = 'warroom.data.v2';
const $ = id => document.getElementById(id), fmt = n => Math.round(n).toLocaleString('fr-FR');
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const sg = n => (n >= 0 ? '+' : '') + fmt(n);
const PARAMS = [['fixed', 'Coûts fixes (k$)', 0, 2000, 10], ['growth', 'Croissance du marché / tour', -0.1, 0.3, 0.01], ['noise', 'Incertitude de la demande', 0, 0.25, 0.01], ['lambda', 'Aversion au risque', 0, 2, 0.1], ['maxMkt', 'Plafond marketing (k$)', 200, 6000, 100], ['maxRd', 'Plafond R&D (k$)', 200, 6000, 100]];
const VIEWS = { dash: 'Tableau de bord', dec: 'Décisions', mkt: 'Concurrents', sim: 'Simulations', data: 'Données' };
let data, S = { obj: 'prudent', hz: 3, over: {}, round: 0, view: 'dash', rival: null }, m, st, planRes, pick = 0;

function load() { try { return JSON.parse(localStorage.getItem(KEY)); } catch (e) { return null; } }
function save() { try { localStorage.setItem(KEY, JSON.stringify(data)); } catch (e) { /* stockage indisponible */ } }
function T() { return Math.min(...data.teams.map(t => t.history.length)); }

function rebuild() {
  m = M.calibrate(data, S.over); st = M.stateOf(m);
  planRes = M.plan(m, S.hz, S.obj);
  if (S.round >= T() || S.round < 0) S.round = T() - 1;
  if (!S.rival || !m.teams.some(t => t.name === S.rival && !t.me)) S.rival = m.teams.find(t => !t.me).name;
}

function svgHist(arr) {
  const lo = Math.min(...arr), hi = Math.max(...arr), n = 24, w = (hi - lo) / n || 1, bins = Array(n).fill(0);
  arr.forEach(v => { bins[Math.min(n - 1, Math.floor((v - lo) / w))]++; });
  const mx = Math.max(...bins), W = 520, H = 200, bw = (W - 20) / n;
  const bars = bins.map((c, i) => `<rect x="${10 + i * bw}" y="${H - 28 - c / mx * (H - 50)}" width="${bw - 2}" height="${c / mx * (H - 50)}" rx="3" fill="${lo + (i + .5) * w < 0 ? 'var(--bad)' : 'var(--brand)'}" opacity=".85"/>`).join('');
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Distribution du profit">${bars}<text class="lbl" x="10" y="${H - 8}">${fmt(lo)}</text><text class="lbl" x="${W - 10}" y="${H - 8}" text-anchor="end">${fmt(hi)} k$</text></svg>`;
}

function viewDash() {
  const me = m.teams[m.mi].hist, i = S.round, cur = me[i], prev = me[i - 1] || cur;
  const it = [["Chiffre d'affaires", cur.rev, prev.rev, ' k$'], ['Profit', cur.profit, prev.profit, ' k$'], ['Part de marché', cur.share, prev.share, ' %'], ['Marge', cur.profit / cur.rev * 100, prev.profit / prev.rev * 100, ' %']];
  $('kpis').innerHTML = it.map(([l, v, p, u]) => { const d = v - p; return `<div class="card kpi"><small>${l}</small><b>${fmt(v)}${u}</b><span class="delta ${d >= 0 ? 'up' : 'down'}">${sg(d)}${u} vs tour précédent</span></div>`; }).join('');
  const W = 560, H = 240, mg = 32, n = me.length, max = Math.max(...me.map(h => h.rev)) * 1.1, bw = Math.min(44, 300 / n);
  const x = k => mg + (k + .5) * (W - 2 * mg) / n, y = v => H - mg - v / max * (H - 2 * mg);
  const bars = me.map((h, k) => `<rect x="${x(k) - bw / 2}" y="${y(h.rev)}" width="${bw}" height="${H - mg - y(h.rev)}" rx="6" fill="var(--brand)" opacity="${k === i ? 1 : .35}"/>`).join('');
  const line = me.map((h, k) => `${k ? 'L' : 'M'}${x(k)},${y(h.profit * 5)}`).join('');
  $('chart').innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Chiffre d'affaires par tour, profit en ligne">${bars}<path d="${line}" fill="none" stroke="var(--good)" stroke-width="3" stroke-linecap="round"/>${me.map((_, k) => `<text class="lbl" x="${x(k)}" y="${H - 10}" text-anchor="middle">T${k + 1}</text>`).join('')}</svg>`;
  $('adv-short').innerHTML = M.advise(m, planRes[0], S.hz).slice(0, 3).map(l => `<li>${esc(l)}</li>`).join('');
  const rows = m.teams.map(t => ({ n: t.name, me: t.me, h: t.hist[i] })).sort((a, b) => b.h.share - a.h.share);
  $('rank').innerHTML = rows.map(r => `<tr class="${r.me ? 'me' : ''}"><td>${esc(r.n)}${r.me ? ' (vous)' : ''}</td><td>${r.h.share.toFixed(1)} %</td><td>${fmt(r.h.profit)}</td><td>${r.h.price}</td><td>${fmt(r.h.mkt)}</td><td>${fmt(r.h.rd)}</td></tr>`).join('');
}

function cur() { return { price: +$('price').value, mkt: +$('mkt').value, rd: +$('rd').value }; }
function setSliders(d) { $('price').value = d.price; $('mkt').value = d.mkt; $('rd').value = d.rd; viewDec(); }
function viewDec() {
  $('mkt').max = m.P.maxMkt; $('rd').max = m.P.maxRd;
  const d = cur(); $('o-price').textContent = d.price + ' $'; $('o-mkt').textContent = fmt(d.mkt); $('o-rd').textContent = fmt(d.rd);
  const r = planRes[0], a = M.analyse(m, st, 1, d, r.hold ? { price: m.teams[m.mi].last.price, mkt: m.teams[m.mi].last.mkt, rd: m.teams[m.mi].last.rd } : null);
  $('proj').textContent = fmt(a.st.mean) + ' k$'; $('range').textContent = fmt(a.st.p10) + ' à ' + fmt(a.st.p90) + ' k$';
  $('pshare').textContent = (a.st.share * 100).toFixed(1) + ' % / ' + (a.st.pneg * 100).toFixed(0) + ' %';
  $('hist').innerHTML = svgHist(a.pr);
  const c = (x, k) => x ? k(x) : '-';
  $('cmp').innerHTML = [['Profit moyen', x => fmt(x.mean)], ['Valeur sur 3 tours', x => fmt(x.val)], ['Part (%)', x => (x.share * 100).toFixed(1)], ['Risque de perte', x => (x.pneg * 100).toFixed(0) + ' %']]
    .map(([l, f]) => { const v = o => o && (l === 'Valeur sur 3 tours' ? { val: o.val, ...o } : o); return `<tr><td>${l}</td><td>${c(a.hold, f)}</td><td>${f({ ...r.st, val: r.val })}</td><td>${f({ ...a.st, val: a.val })}</td></tr>`; void v; }).join('');
  $('adv').innerHTML = M.advise(m, r, S.hz).map(l => `<li>${esc(l)}</li>`).join('');
}

function viewMkt() {
  $('o-aggr').textContent = (S.over.aggr || 0);
  const r = planRes[0];
  $('fc').innerHTML = r.field.filter(f => !f.me).map(f => { const dl = f.share - f.last; return `<tr><td>${esc(f.name)}</td><td>${f.dec.price.toFixed(1)} $</td><td>${fmt(f.dec.mkt)}</td><td>${fmt(f.dec.rd)}</td><td>${f.share.toFixed(1)} %</td><td class="${dl >= 0 ? 'down' : 'up'}">${dl >= 0 ? '+' : ''}${dl.toFixed(1)} pt</td></tr>`; }).join('');
  $('rival').innerHTML = m.teams.filter(t => !t.me).map(t => `<option ${t.name === S.rival ? 'selected' : ''}>${esc(t.name)}</option>`).join('');
  const mx = M.matrix(m, st, 1, r.dec, S.rival), ds = [-4, -2, 0, 2, 4], flat = mx.flat(), lo = Math.min(...flat), hi = Math.max(...flat);
  $('matrix').innerHTML = `<table class="heat"><thead><tr><th>Vous \\ ${esc(S.rival)}</th>${ds.map(d => `<th>${sg(d)} $</th>`).join('')}</tr></thead><tbody>${mx.map((row, i) => `<tr><th>${r.dec.price + ds[i]} $</th>${row.map((v, j) => `<td class="${i === 2 && j === 2 ? 'c' : ''}" style="background:color-mix(in srgb,var(--good) ${Math.round((v - lo) / (hi - lo || 1) * 45)}%,transparent)">${fmt(v)}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
}

function viewSim() {
  $('plan').innerHTML = planRes.map(r => `<tr><td>+${r.k}</td><td>${r.dec.price} $</td><td>${fmt(r.dec.mkt)}</td><td>${fmt(r.dec.rd)}</td><td>${fmt(r.st.mean)}</td><td>${fmt(r.st.p10)} à ${fmt(r.st.p90)}</td><td>${(r.st.share * 100).toFixed(1)} %</td><td>${(r.st.pneg * 100).toFixed(0)} %</td></tr>`).join('');
  $('pk').innerHTML = planRes.map((r, i) => `<option value="${i}" ${i === pick ? 'selected' : ''}>Tour +${r.k}</option>`).join('');
  $('adv2').innerHTML = M.advise(m, planRes[Math.min(pick, planRes.length - 1)], S.hz).map(l => `<li>${esc(l)}</li>`).join('');
}

function viewData() {
  $('params').innerHTML = `<div class="par">${PARAMS.map(([k, l, lo, hi, step]) => `<div class="field"><label for="p-${k}">${l}</label><output>${m.P[k]}</output><input id="p-${k}" data-k="${k}" type="range" min="${lo}" max="${hi}" step="${step}" value="${m.P[k]}"></div>`).join('')}</div>`;
  $('fitinfo').textContent = (m.fitted ? `Estimé sur vos données (${m.fitted.n} observations) : sensibilité prix ${m.fitted.beta.toFixed(3)}, effet marketing ${m.fitted.gamma.toFixed(2)}, effet R&D ${m.fitted.delta.toFixed(2)}. ` : 'Pas assez d\'historique (3 tours et 3 équipes) : paramètres par défaut. ') + `Coût unitaire déduit : ${m.cost.toFixed(1)} $. Marché : ${fmt(m.units0)} k unités au dernier tour.`;
}

function show(v) {
  S.view = VIEWS[v] ? v : 'dash';
  Object.keys(VIEWS).forEach(k => { $('v-' + k).hidden = k !== S.view; });
  document.querySelectorAll('#nav a').forEach(a => a.classList.toggle('on', a.dataset.v === S.view));
  $('title').textContent = VIEWS[S.view];
  $('sub').textContent = 'Équipe ' + data.me + ', ' + T() + ' tours chargés.';
  $('rounds').hidden = S.view !== 'dash';
  ({ dash: viewDash, dec: viewDec, mkt: viewMkt, sim: viewSim, data: viewData })[S.view]();
}
function rounds() { $('rounds').innerHTML = Array.from({ length: T() }, (_, i) => `<button aria-pressed="${i === S.round}" data-i="${i}">T${i + 1}</button>`).join(''); }
function full() { rebuild(); rounds(); const d = planRes[0].dec; if (!full.init) { full.init = 1; $('price').value = d.price; $('mkt').value = d.mkt; $('rd').value = d.rd; } show(S.view); }

function apply(text) {
  try {
    const t = text.trim(), me = $('me').value.trim() || undefined;
    const d = t[0] === '{' ? JSON.parse(t) : M.fromCsv(t, me);
    if (me) d.me = me;
    if (!d.teams || d.teams.length < 2 || d.teams.some(x => !x.history || !x.history.length)) throw new Error('Il faut au moins 2 équipes avec un historique.');
    d.teams.forEach(x => x.history.forEach(h => ['price', 'mkt', 'rd', 'rev', 'profit', 'share'].forEach(k => { if (!isFinite(h[k])) throw new Error('Valeur invalide pour ' + x.name + ' (' + k + ')'); })));
    if (!d.teams.some(x => x.name === d.me)) d.me = d.teams[0].name;
    data = d; save(); S.round = T() - 1; full.init = 0; full(); $('msg').textContent = 'Données appliquées : ' + d.teams.length + ' équipes, ' + T() + ' tours.';
  } catch (e) { $('msg').textContent = 'Erreur : ' + e.message; }
}

document.addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  if (b.dataset.i) { S.round = +b.dataset.i; rounds(); show('dash'); }
  else if (b.dataset.go) location.hash = b.dataset.go;
  else if (b.id === 'apply') setSliders(planRes[0].dec);
  else if (b.id === 'hold') { const l = m.teams[m.mi].last; setSliders({ price: l.price, mkt: l.mkt, rd: l.rd }); }
  else if (b.id === 'load') apply($('raw').value);
  else if (b.id === 'demo') { $('raw').value = JSON.stringify(M.sample(), null, 1); apply($('raw').value); }
  else if (b.id === 'export') { $('raw').value = JSON.stringify(data, null, 1); $('raw').select(); $('msg').textContent = 'Données exportées dans la zone de texte : copiez-les.'; }
});
['price', 'mkt', 'rd'].forEach(id => $(id).addEventListener('input', viewDec));
$('aggr').addEventListener('input', e => { S.over.aggr = +e.target.value; full(); });
$('rival').addEventListener('change', e => { S.rival = e.target.value; viewMkt(); });
$('obj').addEventListener('change', e => { S.obj = e.target.value; full(); });
$('hz').addEventListener('change', e => { S.hz = +e.target.value; full(); });
$('pk').addEventListener('change', e => { pick = +e.target.value; viewSim(); });
$('params').addEventListener('change', e => { const k = e.target.dataset.k; if (k) { S.over[k] = +e.target.value; full(); } });
window.addEventListener('hashchange', () => show(location.hash.slice(1)));
data = load() || M.sample();
$('raw').value = ''; $('me').value = data.me; S.view = VIEWS[location.hash.slice(1)] ? location.hash.slice(1) : 'dash';
full();
