// Grafik ringan tanpa library: batang horizontal (HTML) dan garis (SVG).
// Semua label sudah di-escape oleh pemanggil.

export function hbars(rows, { fmt = (v) => v, color = 'var(--brand)', empty = 'Belum ada data.' } = {}) {
  if (!rows.length) return `<p class="note">${empty}</p>`;
  const max = Math.max(...rows.map((r) => r.value), 1);
  return `<div class="hb" role="list">${rows.map((r) => `
    <div class="hb-row" role="listitem">
      <div class="hb-l">${r.label}${r.sub ? `<small>${r.sub}</small>` : ''}</div>
      <div class="hb-t"><i style="width:${Math.max(2, (r.value / max) * 100).toFixed(1)}%;background:${r.color || color}"></i></div>
      <div class="hb-v">${fmt(r.value)}${r.extra ? `<small>${r.extra}</small>` : ''}</div>
    </div>`).join('')}</div>`;
}

export function lineChart(points, { height = 180, color = 'var(--brand)' } = {}) {
  if (points.length < 2) return '<p class="note">Butuh minimal 2 sesi untuk menampilkan grafik.</p>';
  const W = 600, H = height, L = 34, R = 12, T = 12, B = 26;
  const xs = points.map((p) => p.x), x0 = Math.min(...xs), x1 = Math.max(...xs) || x0 + 1;
  const X = (x) => L + ((x - x0) / (x1 - x0 || 1)) * (W - L - R);
  const Y = (y) => T + (1 - y / 100) * (H - T - B);
  const grid = [0, 25, 50, 75, 100].map((v) => `<line x1="${L}" x2="${W - R}" y1="${Y(v)}" y2="${Y(v)}" stroke="var(--line)" stroke-width="1"/><text x="${L - 6}" y="${Y(v) + 4}" text-anchor="end" font-size="11" fill="var(--muted)">${v}</text>`).join('');
  const d = points.map((p, i) => `${i ? 'L' : 'M'}${X(p.x).toFixed(1)} ${Y(p.y).toFixed(1)}`).join(' ');
  const area = `${d} L${X(points[points.length - 1].x).toFixed(1)} ${Y(0)} L${X(points[0].x).toFixed(1)} ${Y(0)} Z`;
  const fmtD = (t) => new Date(t).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
  const last = points[points.length - 1];
  return `<svg class="lc" viewBox="0 0 ${W} ${H}" role="img" aria-label="Grafik skor dari waktu ke waktu">
    ${grid}
    <path d="${area}" fill="${color}" opacity=".10"/>
    <path d="${d}" fill="none" stroke="${color}" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>
    ${points.map((p) => `<circle cx="${X(p.x).toFixed(1)}" cy="${Y(p.y).toFixed(1)}" r="3.2" fill="var(--paper)" stroke="${color}" stroke-width="2"><title>${fmtD(p.x)}: ${p.y}</title></circle>`).join('')}
    <circle cx="${X(last.x).toFixed(1)}" cy="${Y(last.y).toFixed(1)}" r="5" fill="${color}"/>
    <text x="${L}" y="${H - 6}" font-size="11" fill="var(--muted)">${fmtD(x0)}</text>
    <text x="${W - R}" y="${H - 6}" font-size="11" fill="var(--muted)" text-anchor="end">${fmtD(x1)}</text>
  </svg>`;
}
