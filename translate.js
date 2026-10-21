// Terjemahan otomatis untuk input kartu "satu kata per baris".
// Urutan: kamus bawaan (568 kartu) → AI Cloudflare (jika dipasang) → pinyin offline.
import { pinyin } from 'pinyin-pro';
import builtin from '../src/data/builtin.json';
import { BASIC } from './basic_dict.js';
import { EN } from './en_dict.js';

export const CJK = /[㐀-鿿豈-﫿]/;
const ONLY_CJK = /^[㐀-鿿豈-﫿]+$/;
const BY_H = new Map();
const BY_M = new Map();
for (const c of builtin.cards) {
  if (!BY_H.has(c.h)) BY_H.set(c.h, c);
  const k = c.m.toLowerCase().trim();
  if (!BY_M.has(k)) BY_M.set(k, c);
}
// kamus dasar: dipakai bila kata tidak ada di 568 kartu bawaan
for (const line of BASIC.trim().split('\n')) {
  const [h, m, mw] = line.split('|');
  if (!h || !m) continue;
  const c = { h, p: '', m, mw: mw || '', pic: '' };
  if (!BY_H.has(h)) BY_H.set(h, c);
  for (const part of m.split('/').map((x) => x.trim().toLowerCase())) if (part && !BY_M.has(part)) BY_M.set(part, c);
}

// Arti bahasa Inggris (kamus offline)
const EN_H = new Map(), BY_E = new Map();
for (const line of EN.trim().split('\n')) {
  const [h, e] = line.split('|'); if (!h || !e) continue;
  EN_H.set(h, e);
  for (const part of e.split('/').map((x) => x.replace(/\(.*?\)/g, '').trim().toLowerCase())) if (part && !BY_E.has(part)) BY_E.set(part, h);
}
export const enOf = (h) => EN_H.get(h) || '';

// Pinyin bernada, suku kata digabung; apostrof sebelum suku kata berawalan a/o/e (jiāo'ào)
export function toPinyin(h) {
  if (!h || !CJK.test(h)) return '';
  const syl = pinyin(h, { type: 'array', toneType: 'symbol' });
  let out = '';
  syl.forEach((s, i) => {
    if (i > 0 && /^[aoeāáǎàōóǒòēéěè]/i.test(s)) out += "'";
    out += s;
  });
  return out.slice(0, 60);
}

const EMOJI_OK = /^(?:\p{Extended_Pictographic}|\p{Emoji_Component}|‍|️)+$/u;
export const cleanEmoji = (e) => (typeof e === 'string' && [...e].length <= 8 && EMOJI_OK.test(e) ? e : '');
const cleanMeaning = (m) => (typeof m === 'string' ? m.replace(/[\u0000-\u001f<>"`]/g, '').trim().slice(0, 60) : '');
const cleanHanzi = (h) => (typeof h === 'string' && ONLY_CJK.test(h.trim()) && [...h.trim()].length <= 12 ? h.trim() : '');
const cleanMw = (w) => (typeof w === 'string' && /^[㐀-鿿]$/.test(w.trim()) ? w.trim() : '');

const SCHEMA = {
  type: 'object',
  properties: {
    items: {
      type: 'array',
      items: {
        type: 'object',
        properties: { i: { type: 'integer' }, h: { type: 'string' }, m: { type: 'string' }, en: { type: 'string' }, mw: { type: 'string' }, emoji: { type: 'string' } },
        required: ['i', 'h', 'm', 'en', 'mw', 'emoji'],
      },
    },
  },
  required: ['items'],
};

// Mengurai jawaban AI apa pun bentuknya (objek, string JSON, atau teks berisi JSON)
export function parseAi(res) {
  let v = res && res.response !== undefined ? res.response : res;
  if (typeof v === 'string') {
    const m = v.match(/\{[\s\S]*\}/);
    try { v = JSON.parse(m ? m[0] : v); } catch (_) { return []; }
  }
  const items = v && Array.isArray(v.items) ? v.items : Array.isArray(v) ? v : [];
  return items.filter((x) => x && typeof x === 'object');
}

async function askAi(ai, entries) {
  const sys = 'Kamu adalah kamus Mandarin–Indonesia untuk murid SD. Untuk tiap entri: jika "type" = "zh", tulis arti bahasa Indonesia yang paling umum, singkat (1–4 kata, huruf kecil) di "m" dan salin hanzinya ke "h". '
    + 'Jika "type" = "id", teksnya bisa bahasa Indonesia atau Inggris: tulis kata Mandarin aksara sederhana yang paling umum di "h" dan arti bahasa Indonesianya di "m". '
    + 'Selalu isi "en" dengan arti bahasa Inggris yang singkat (huruf kecil). '
    + 'Isi "mw" dengan satu karakter kata satuan (量词) yang paling umum bila kata benda, selain itu kosong. '
    + 'Isi "emoji" dengan satu emoji yang cocok bila ada, selain itu kosong. Jawab hanya JSON sesuai skema.';
  const res = await ai.run('@cf/meta/llama-3.1-8b-instruct', {
    messages: [{ role: 'system', content: sys }, { role: 'user', content: JSON.stringify({ items: entries }) }],
    response_format: { type: 'json_schema', json_schema: SCHEMA },
    max_tokens: 1800,
    temperature: 0.1,
  });
  return parseAi(res);
}

export async function translateLines(env, lines) {
  const items = lines.map((raw, i) => {
    const t = String(raw || '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 40);
    return CJK.test(t)
      ? { i, src: 'zh', h: t.replace(/[^㐀-鿿豈-﫿]/g, '').slice(0, 12), p: '', m: '', en: '', mw: '', pic: '', emoji: '', from: '' }
      : { i, src: 'id', h: '', p: '', m: t, en: '', mw: '', pic: '', emoji: '', from: '' };
  }).filter((x) => (x.src === 'zh' ? x.h : x.m));

  // 1) kamus bawaan
  for (const it of items) {
    let d = it.src === 'zh' ? BY_H.get(it.h) : BY_M.get(it.m.toLowerCase());
    let viaEn = false;
    if (!d && it.src === 'id') { const h = BY_E.get(it.m.toLowerCase()); if (h && BY_H.get(h)) { d = BY_H.get(h); viaEn = true; } } // input bahasa Inggris
    if (d) Object.assign(it, { h: d.h, p: d.p || '', m: it.src === 'zh' || viaEn ? d.m : it.m, mw: d.mw, pic: d.pic, from: 'kamus' });
    if (it.h) it.en = enOf(it.h);
  }
  // 2) AI untuk yang belum ketemu
  const need = items.filter((it) => !it.from);
  let aiUsed = false, aiError = false;
  if (need.length && env.AI) {
    try {
      const out = await askAi(env.AI, need.map((it) => ({ i: it.i, type: it.src, text: it.src === 'zh' ? it.h : it.m })));
      const byI = new Map(out.map((o) => [Number(o.i), o]));
      for (const it of need) {
        const o = byI.get(it.i); if (!o) continue;
        if (it.src === 'zh') { const m = cleanMeaning(o.m); if (m) it.m = m; }
        else {
          const h = cleanHanzi(o.h); if (h) it.h = h;
          // input bahasa Inggris → pakai arti Indonesia dari AI
          const m = cleanMeaning(o.m); if (m && cleanMeaning(o.en).toLowerCase() === it.m.toLowerCase()) it.m = m;
        }
        it.en = cleanMeaning(o.en) || enOf(it.h);
        it.mw = cleanMw(o.mw); it.emoji = cleanEmoji(o.emoji);
        if (it.h && it.m) it.from = 'ai';
      }
      aiUsed = true;
    } catch (_) { aiError = true; }
  }
  // 3) pinyin offline untuk semua yang punya hanzi
  for (const it of items) { if (it.h && !it.p) it.p = toPinyin(it.h); if (!it.from) it.from = 'manual'; }
  return { items: items.map(({ i, src, ...rest }) => rest), ai: !!env.AI, aiUsed, aiError };
}
