'use strict';
const data = [
  {rev: 8200, profit: 640, share: 18}, {rev: 9100, profit: 910, share: 20},
  {rev: 9800, profit: 1180, share: 22}, {rev: 11000, profit: 1420, share: 24},
];
const teams = [['A (vous)', 24, 1420, 88], ['B', 27, 1210, 84], ['C', 21, 1590, 83], ['D', 18, 760, 71], ['E', 10, 300, 55]];
const $ = id => document.getElementById(id);
const fmt = n => n.toLocaleString('fr-FR');
let round = data.length - 1;

function kpis() {
  const cur = data[round], prev = data[round - 1] || cur;
  const items = [['Chiffre d\'affaires', cur.rev, prev.rev, ' k$'], ['Profit', cur.profit, prev.profit, ' k$'],
    ['Part de marche', cur.share, prev.share, ' %'], ['Marge', Math.round(cur.profit / cur.rev * 100), Math.round(prev.profit / prev.rev * 100), ' %']];
  $('kpis').innerHTML = items.map(([l, v, p, u]) => {
    const d = v - p;
    return `<div class="card kpi"><small>${l}</small><b>${fmt(v)}${u}</b><span class="delta ${d >= 0 ? 'up' : 'down'}">${d >= 0 ? '+' : ''}${fmt(d)}${u} vs tour precedent</span></div>`;
  }).join('');
}

function chart() {
  const W = 560, H = 240, m = 32, max = 12000, n = data.length, bw = 44;
  const x = i => m + (i + .5) * (W - 2 * m) / n, y = v => H - m - v / max * (H - 2 * m);
  const bars = data.map((d, i) => `<rect x="${x(i) - bw / 2}" y="${y(d.rev)}" width="${bw}" height="${H - m - y(d.rev)}" rx="6" fill="var(--brand)" opacity="${i === round ? 1 : .35}"/>`).join('');
  const line = data.map((d, i) => `${i ? 'L' : 'M'}${x(i)},${y(d.profit * 5)}`).join('');
  const labels = data.map((_, i) => `<text class="lbl" x="${x(i)}" y="${H - 10}" text-anchor="middle">T${i + 1}</text>`).join('');
  $('chart').innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Chiffre d'affaires par tour, profit en ligne">${bars}<path d="${line}" fill="none" stroke="var(--good)" stroke-width="3" stroke-linecap="round"/>${labels}</svg>`;
}

function rounds() {
  $('rounds').innerHTML = data.map((_, i) => `<button aria-pressed="${i === round}" data-i="${i}">T${i + 1}</button>`).join('');
}

function proj() {
  const p = +$('price').value, k = +$('mkt').value, r = +$('rd').value;
  $('o-price').textContent = p + ' $'; $('o-mkt').textContent = fmt(k); $('o-rd').textContent = fmt(r);
  const units = 300 - 4 * p + k * 0.12 + r * 0.05;
  const profit = Math.round(units * (p - 22) * 0.9 - k - r);
  $('proj').textContent = fmt(profit) + ' k$';
}

$('rounds').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; round = +b.dataset.i; render(); });
['price', 'mkt', 'rd'].forEach(id => $(id).addEventListener('input', proj));
$('rank').innerHTML = teams.map(([t, s, p, sc], i) => `<tr class="${i ? '' : 'me'}"><td>${t}</td><td>${s} %</td><td>${fmt(p)}</td><td>${sc}</td></tr>`).join('');
function render() { rounds(); kpis(); chart(); proj(); }
render();
