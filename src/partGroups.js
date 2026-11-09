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
  return [...groups.values()].filter((g) => g.parts.length >= 2).map((g) => ({
    ...g,
    parts: g.parts.sort((a, b) => a.no - b.no).map((p) => p.d),
    parent: decks.find((d) => d.zh === g.zh && d.idn === g.idn) || null,
  }));
}
