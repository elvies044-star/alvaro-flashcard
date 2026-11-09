// Deck bawaan kk1-5, ks1-5, nt1-5 dibedakan lewat id karena namanya tidak memakai "part N".
const WORD_GROUPS = [
  { key: 'kk', zh: '动词', idn: 'Kata Kerja', icon: 'barbell' },
  { key: 'ks', zh: '形容词', idn: 'Kata Sifat', icon: 'heart' },
  { key: 'nt', zh: '地点', idn: 'Nama Tempat', icon: 'pin' },
];

function wordGroups(decks) {
  return WORD_GROUPS.flatMap((w) => {
    const no = (d) => (d.id.startsWith(w.key) && /^\d+$/.test(d.id.slice(2)) ? +d.id.slice(2) : 0);
    const parts = decks.filter(no).sort((a, b) => no(a) - no(b));
    return parts.length >= 2 ? [{ ...w, color: parts[0].color, parts, parent: null }] : [];
  });
}

// Deck bernama "<nama> part N" dengan arti sama digabung jadi satu kartu, seperti HSK.
export function partGroups(decks) {
  const groups = new Map();
  for (const d of decks) {
    const m = /^(.+) part (\d+)$/i.exec(d.zh);
    if (!m || d.hskLevel || d.speak) continue;
    const key = `${m[1]}|${d.idn}`;
    if (!groups.has(key)) groups.set(key, { key, zh: m[1], idn: d.idn, color: d.color, parts: [] });
    groups.get(key).parts.push({ d, no: +m[2] });
  }
  return [...wordGroups(decks), ...[...groups.values()].filter((g) => g.parts.length >= 2).map((g) => ({
    ...g,
    parts: g.parts.sort((a, b) => a.no - b.no).map((p) => p.d),
    parent: decks.find((d) => d.zh === g.zh && d.idn === g.idn) || null,
  }))];
}
