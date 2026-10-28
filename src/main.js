import './style.css';
import IMG from './data/images.json';
import MW from './data/mw.json';
import { api } from './api/http.js';
import { hbars, lineChart } from './charts.js';
import { pinyin as pyPro } from 'pinyin-pro';
import LESSONS from './data/lessons.json';

const APP = 'Alvaro Mandarin Flashcard Tamer';
const APP_VERSION = '2026.10.28-materi';
const BUILD = typeof __BUILD_ID__ === 'string' ? __BUILD_ID__ : 'dev';

/* ================= helpers ================= */
const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"'`]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;', '`': '&#96;' }[c]));
const shuffle = (a) => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; };
const yi = (m) => (MW[m] && MW[m][1] === 4 ? 'yí' : 'yì');
const fmtDate = (t, o = { dateStyle: 'medium', timeStyle: 'short' }) => new Date(t).toLocaleString('id-ID', o);
const secs = (ms) => (ms / 1000).toFixed(ms < 10000 ? 1 : 0) + ' dtk';
const dur = (ms) => { const s = Math.max(0, Math.round(ms / 1000)); return s < 60 ? `${s} dtk` : `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
const store = { get(k, d) { try { const v = localStorage.getItem('aft_' + k); return v === null ? d : JSON.parse(v); } catch (_) { return d; } }, set(k, v) { try { localStorage.setItem('aft_' + k, JSON.stringify(v)); } catch (_) { /* abaikan */ } } };
const SVGSRC = {};
const svgSrc = (k) => SVGSRC[k] || (SVGSRC[k] = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(IMG[k]));
const scoreCls = (v) => (v >= 75 ? 'g' : v >= 50 ? 'w' : 'b');
const scoreTag = (v) => `<span class="score ${scoreCls(v ?? 0)}">${v ?? 0}</span>`;
const initial = (n) => esc(([...(n || '?')][0] || '?').toUpperCase());
const avaHTML = (name, photo, cls) => `<div class="avatar ${cls || ''}" aria-hidden="true">${photo ? `<img src="${esc(photo)}" alt="">` : initial(name)}</div>`;
function pickImage(cb) { const i = document.createElement('input'); i.type = 'file'; i.accept = 'image/*'; i.onchange = () => { const f = i.files && i.files[0]; if (f) cb(f); }; i.click(); }

const ICON = {
  learn: '<rect x="3" y="5" width="13" height="16" rx="2"/><path d="M8 3h11a2 2 0 0 1 2 2v13"/>',
  hist: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5M12 7v5l3 2"/>',
  edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
  teach: '<path d="M3 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2"/><circle cx="9" cy="8" r="4"/><path d="M17 11l2 2 4-4"/>',
  out: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>',
  back: '<path d="M15 18l-6-6 6-6"/>', check: '<path d="M5 12l5 5L20 7"/>', x: '<path d="M18 6L6 18M6 6l12 12"/>', plus: '<path d="M12 5v14M5 12h14"/>',
  trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>', copy: '<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/>',
  play: '<path d="M7 4l13 8-13 8z"/>', flip: '<path d="M4 12a8 8 0 0 1 14-5.3L20 9"/><path d="M20 4v5h-5M20 12a8 8 0 0 1-14 5.3L4 15"/><path d="M4 20v-5h5"/>',
  sound: '<path d="M11 5L6 9H3v6h3l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13"/>', mute: '<path d="M11 5L6 9H3v6h3l5 4z"/><path d="M22 9l-6 6M16 9l6 6"/>',
  users: '<circle cx="9" cy="8" r="4"/><path d="M2 21v-1a6 6 0 0 1 6-6h2a6 6 0 0 1 6 6v1M16 4a4 4 0 0 1 0 8M22 21v-1a6 6 0 0 0-4-5.6"/>',
  chart: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>', clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1"/>',
  eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  inbox: '<path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.5 5.1L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.5-6.9A2 2 0 0 0 16.8 4H7.2a2 2 0 0 0-1.7 1.1z"/>',
  key: '<circle cx="7.5" cy="15.5" r="4.5"/><path d="M11 12l9-9M17 6l3 3"/>',
  alert: '<path d="M12 9v4M12 17h.01"/><path d="M10.3 3.9L1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/>',
  smile: '<circle cx="12" cy="12" r="9"/><path d="M8 14s1.5 2 4 2 4-2 4-2M9 9h.01M15 9h.01"/>', send: '<path d="M22 2L11 13M22 2l-7 20-4-9-9-4z"/>',
  image: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/>', sparkle: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/>',
  list: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
  download: '<path d="M12 3v12M7 10l5 5 5-5M5 21h14"/>',
  laoshi: '<path d="M12 3l8 4-8 4-8-4 8-4z"/><path d="M6 10v4c0 1.5 2.7 3 6 3s6-1.5 6-3v-4"/><path d="M20 8v5"/>',
  book2: '<path d="M4 4h11a2 2 0 0 1 2 2v14H6a2 2 0 0 1-2-2z"/><path d="M9 4v14"/>',
  gift: '<rect x="3" y="8" width="18" height="13" rx="2"/><path d="M12 8v13M3 12h18M12 8S10.5 3 8 3a2.5 2.5 0 0 0 0 5h4zM12 8s1.5-5 4-5a2.5 2.5 0 0 1 0 5h-4z"/>',
  chat: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
  social: '<circle cx="12" cy="8" r="3.2"/><path d="M5.5 20a6.5 6.5 0 0 1 13 0"/><path d="M19 4.5l.7 1.6 1.8.2-1.3 1.2.4 1.8-1.6-.9-1.6.9.4-1.8-1.3-1.2 1.8-.2z"/>',
  heart: '<path d="M12 20s-7-4.6-9.2-9A4.5 4.5 0 0 1 12 6.5 4.5 4.5 0 0 1 21.2 11C19 15.4 12 20 12 20z"/>',
  pin: '<path d="M9 3h6l-1 6 3 3v2H7v-2l3-3-1-6z"/><path d="M12 14v7"/>',
  speak: '<path d="M4 5h16a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H9l-4 4v-4H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z"/><path d="M8 9h8M8 12h5"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 0 1 4.5 1.5c0 1.5-2 2-2 3.5"/><path d="M12 17h.01"/>',
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18"/>',
  snow: '<path d="M12 2v20M4 6l16 12M20 6L4 18"/><path d="M12 2l-2.5 2.5M12 2l2.5 2.5M12 22l-2.5-2.5M12 22l2.5-2.5"/>',
  basket: '<path d="M5 11h14l-1.2 8a2 2 0 0 1-2 1.7H8.2a2 2 0 0 1-2-1.7z"/><path d="M9 11 12 4l3 7"/><path d="M3 11h18"/>',
  split: '<rect x="3" y="4" width="7" height="16" rx="2"/><rect x="14" y="4" width="7" height="16" rx="2"/>',
  bulb: '<path d="M9 18h6M10 22h4"/><path d="M12 2a7 7 0 0 0-4 12.7c.6.5 1 1.2 1 2V17h6v-.3c0-.8.4-1.5 1-2A7 7 0 0 0 12 2z"/>',
  bolt: '<path d="M13 2L3 14h9l-1 8 10-12h-9z"/>', flag: '<path d="M4 22V4M4 4h13l-2 4 2 4H4"/>',
  stop: '<rect x="5" y="5" width="14" height="14" rx="2"/>', resume: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/><path d="M10 9l5 3-5 3z"/>',
};
const ic = (n) => `<svg class="i" viewBox="0 0 24 24" aria-hidden="true">${ICON[n]}</svg>`;
let toastT;
function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('on'), 2800); }
async function copyText(txt) { try { await navigator.clipboard.writeText(txt); toast('Disalin'); } catch (_) { toast('Tidak bisa menyalin otomatis. Pilih teksnya lalu salin manual.'); } }
const logoHTML = () => '<span class="logo-wrap"><img class="logo" src="/logo.png" alt="Alvaro Education Centre"></span>';

/* ---- suara ---- */
let AC = null;
function tone(seq) {
  if (!S.sfx) return;
  try {
    AC = AC || new (window.AudioContext || window.webkitAudioContext)(); const t0 = AC.currentTime;
    seq.forEach(([f, d, st, type]) => { const o = AC.createOscillator(), g = AC.createGain(); o.type = type || 'sine'; o.frequency.value = f; g.gain.setValueAtTime(0.0001, t0 + st); g.gain.exponentialRampToValueAtTime(0.16, t0 + st + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t0 + st + d); o.connect(g).connect(AC.destination); o.start(t0 + st); o.stop(t0 + st + d + 0.02); });
  } catch (_) { /* tanpa suara */ }
}
const SFX = { right: () => tone([[660, 0.14, 0], [990, 0.22, 0.11]]), wrong: () => tone([[196, 0.22, 0, 'square'], [156, 0.28, 0.12, 'square']]), r1: () => tone([[220, 0.2, 0, 'triangle']]), r2: () => tone([[392, 0.16, 0, 'triangle']]), r3: () => tone([[523, 0.12, 0], [784, 0.18, 0.09]]), r4: () => tone([[523, 0.1, 0], [659, 0.1, 0.08], [784, 0.1, 0.16], [1047, 0.25, 0.24]]), flip: () => tone([[880, 0.05, 0, 'triangle']]) };
let zhVoice = null;
function loadVoices() { try { const v = speechSynthesis.getVoices(); zhVoice = v.find((x) => /zh[-_]CN/i.test(x.lang)) || v.find((x) => /^zh/i.test(x.lang)) || null; } catch (_) { /* tidak didukung */ } }
try { loadVoices(); speechSynthesis.onvoiceschanged = loadVoices; } catch (_) { /* tidak didukung */ }
function speak(t) { if (!t) return; try { speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(t); u.lang = 'zh-CN'; u.rate = 0.8; if (zhVoice) u.voice = zhVoice; speechSynthesis.speak(u); } catch (_) { /* tidak didukung */ } }

/* ---- efek ---- */
function fx(el, cls) { if (!el) return; el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); setTimeout(() => el.classList.remove(cls), 600); }
function burst(n = 36) {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const b = document.createElement('div'); b.className = 'burst'; const cols = ['#1f3fbf', '#f6c933', '#16a34a', '#e8513f', '#7a4fd0', '#2fa3d6'];
  for (let i = 0; i < n; i++) { const p = document.createElement('i'); p.style.left = Math.random() * 100 + 'vw'; p.style.background = cols[i % cols.length]; p.style.setProperty('--dx', (Math.random() * 160 - 80) + 'px'); p.style.setProperty('--r', (Math.random() * 720 - 360) + 'deg'); p.style.animationDelay = Math.random() * 0.25 + 's'; b.appendChild(p); }
  document.body.appendChild(b); setTimeout(() => b.remove(), 2000);
}
function badgeFx(ok) { const t = $('#tilt'); if (!t) return; const b = document.createElement('div'); b.className = 'badge-fx ' + (ok ? 'ok' : 'no'); b.innerHTML = ic(ok ? 'check' : 'x'); t.appendChild(b); setTimeout(() => b.remove(), 1000); }

/* ================= state ================= */
const MODES = ['pic', 'han', 'arti', 'mix'];
const MODE_LABEL = { pic: 'Gambar', han: '汉字', arti: 'Arti', mix: 'Campur' };
const RATE = { 1: { l: 'Susah', w: 'muncul lagi segera', gap: 2 }, 2: { l: 'Lumayan', w: 'muncul lagi nanti', gap: 7 }, 3: { l: 'Bisa', w: 'muncul besok', days: 1 }, 4: { l: 'Mudah', w: 'muncul 3 hari lagi', days: 3 } };
const COLORS = ['#1f3fbf', '#2fa3d6', '#16a34a', '#0f9f74', '#e0b51b', '#f08a24', '#e8513f', '#e0559b', '#7a4fd0', '#5b6789'];
const S = Object.assign({ mode: 'pic', quiz: true, auto: true, sfx: true, all: false, sel: [], view: 'learn', ttab: 'live', hints: true, kind: 'card', lang: 'id', split: { on: false, size: 10, part: 0 } }, store.get('prefs', {}));
if (!S.split || typeof S.split !== 'object') S.split = { on: false, size: 10, part: 0 };
const savePrefs = () => store.set('prefs', { mode: S.mode, quiz: S.quiz, auto: S.auto, sfx: S.sfx, all: S.all, sel: S.sel, view: ['study', 'done'].includes(S.view) ? 'learn' : S.view, ttab: S.ttab, hints: S.hints, kind: S.kind, split: S.split, lang: S.lang });
let ME = null, SET = null, DECKS = [], CARDS = [], SRS = {}, Q = null, STUDENTS = [], AI_ON = false, PINS = new Set(), FRZ_DECKS = new Set(), FRZ_CARDS = new Set();
const aiName = () => (SET && SET.ai_name) || 'Laoshi';
let ADMIN_PHONE = '';
const waLink = (p) => { const d = String(p || '').replace(/[^0-9]/g, '').replace(/^0/, '62'); return d ? 'https://wa.me/' + d : ''; };
const adminHTML = () => { const w = waLink(ADMIN_PHONE); return w ? `<p class="note" style="text-align:center">Butuh bantuan? <a href="${w}" target="_blank" rel="noopener" class="adminlink">Hubungi admin</a></p>` : ''; };
const isTeacher = () => !!ME && ME.role === 'teacher';
const canCreate = () => !!ME && (ME.role === 'teacher' || !!ME.can_create);

function cleanSettings(s) {
  s = s || {};
  const modes = Array.isArray(s.modes) ? MODES.filter((m) => s.modes.includes(m)) : MODES.slice();
  const ms = modes.length ? modes : ['pic'];
  return { modes: ms, default_mode: ms.includes(s.default_mode) ? s.default_mode : ms[0], student_can_choose: s.student_can_choose !== false, quiz_enabled: s.quiz_enabled !== false, mw_quiz: s.mw_quiz !== false, all_can_create: s.all_can_create !== false, ai_laoshi: s.ai_laoshi !== false, admin_phone: (typeof s.admin_phone === 'string' ? s.admin_phone.replace(/[^0-9+]/g, '').slice(0, 20) : ''), ai_name: (typeof s.ai_name === 'string' && s.ai_name.trim()) ? s.ai_name.trim().slice(0, 20) : 'Laoshi', hidden_decks: Array.isArray(s.hidden_decks) ? s.hidden_decks.filter((x) => typeof x === 'string') : [] };
}
function applyContent(c) {
  SET = cleanSettings(c.settings);
  AI_ON = !!c.ai;
  if (SET && SET.admin_phone) ADMIN_PHONE = SET.admin_phone;
  if (c.me) ME = c.me;
  CARDS = (c.cards || []).filter((x) => x && typeof x.id === 'string' && typeof x.h === 'string');
  const by = {};
  for (const card of CARDS) (by[card.deck_id] ||= []).push(card);
  DECKS = (c.decks || []).filter((d) => d && typeof d.id === 'string').map((d) => { const hm = /^hsk([123])(?:_l(\d+))?$/.exec(d.id); const sm = /^speak(\d+)$/.exec(d.id); return { ...d, color: /^#[0-9a-f]{6}$/i.test(d.color) ? d.color : '#1f3fbf', cards: by[d.id] || [], hskLevel: hm ? +hm[1] : 0, hskLesson: hm && hm[2] ? +hm[2] : 0, speak: d.kind === 'speak' || !!sm, speakLevel: sm ? +sm[1] : 0 }; });
  PINS = new Set(Array.isArray(c.pins) ? c.pins : []);
  FRZ_DECKS = new Set(c.frozen && Array.isArray(c.frozen.decks) ? c.frozen.decks : []);
  FRZ_CARDS = new Set(c.frozen && Array.isArray(c.frozen.cards) ? c.frozen.cards : []);
  LEX = new Map();
  for (const card of CARDS) { if (card.h && !LEX.has(card.h)) LEX.set(card.h, { p: card.p || '', m: card.m || '' }); }
}
let LEX = new Map();
const HAN_RE = /[一-鿿]/;
// pinyin ber-nada untuk sebuah kata (pakai pinyin-pro)
function pyOf(w) { try { return pyPro(w, { type: 'array' }).join(' '); } catch (_) { return ''; } }
function toneOf(ch) { try { const a = pyPro(ch, { toneType: 'num', type: 'array' }); const m = /([1-5])/.exec(a[0] || ''); return m ? +m[1] : 5; } catch (_) { return 5; } }
// pecah teks jadi token kata (cocokkan kosakata terpanjang dari LEX) + tanda baca
function segHan(text) {
  const out = []; const chars = [...text];
  for (let i = 0; i < chars.length;) {
    if (!HAN_RE.test(chars[i])) { out.push({ t: 'x', s: chars[i] }); i++; continue; }
    let matched = null;
    for (let len = Math.min(4, chars.length - i); len >= 2; len--) { const sub = chars.slice(i, i + len).join(''); if (LEX.has(sub)) { matched = sub; break; } }
    const w = matched || chars[i];
    out.push({ t: 'w', s: w }); i += [...w].length;
  }
  return out;
}
const isSpeak = (c) => { const d = deckOf(c.deck_id); return !!(d && d.speak); };
const pinnedCards = () => CARDS.filter((c) => PINS.has(c.id) && studyDecks().some((d) => d.id === c.deck_id));
// Untuk belajar: guru tidak ikut melihat kategori pribadi murid
const studyDecks = () => DECKS.filter((d) => d.cards.length && (!isTeacher() || !d.owner_id || d.status === 'public'));
const deckOf = (id) => DECKS.find((d) => d.id === id);
const pendingCount = () => (isTeacher() ? DECKS.filter((d) => d.status === 'pending').length : 0);
const isDue = (c) => { const r = SRS[c.id]; return !r || r.due <= Date.now(); };
const effMode = () => (SET.student_can_choose && SET.modes.includes(S.mode) ? S.mode : SET.default_mode);

function picHTML(c) {
  const p = c.pic || '';
  if (/^i\d+$/.test(p) && IMG[p]) return `<img src="${svgSrc(p)}" alt="">`;
  if (/^\/api\/img\/[a-f0-9]{32}$/.test(p)) return `<img src="${p}" alt="" loading="lazy">`;
  if (p && [...p].length <= 8 && /^\p{Extended_Pictographic}/u.test(p) && !/[<>/\\"'`=a-z0-9]/i.test(p)) return `<span class="emo">${esc(p)}</span>`;
  return '';
}
const hasPic = (c) => picHTML(c) !== '';
const LANG_LABEL = { id: 'ID', en: 'EN', both: 'ID + EN' };
const mean = (c) => (S.lang === 'en' ? c.en || c.m : S.lang === 'both' && c.en ? `${c.m} · ${c.en}` : c.m);
const meanAns = (c) => (S.lang === 'en' ? c.en || c.m : c.m);

/* ================= shell ================= */
function navItems() {
  const n = [['learn', 'learn', 'Belajar'], ['hist', 'hist', 'Riwayat'], ['social', 'social', 'Sosial']];
  if (AI_ON) n.push(['ai', 'laoshi', 'AI ' + aiName()]);
  if (canCreate()) n.push(['cards', 'edit', isTeacher() ? 'Kartu' : 'Kartu saya']);
  if (isTeacher()) n.push(['teach', 'teach', 'Guru']);
  return n;
}
function shell() {
  const cur = (v) => S.view === v || (['study', 'done', 'story', 'lesson'].includes(S.view) && v === 'learn');
  const pend = pendingCount();
  const btns = navItems().map(([v, i, l]) => `<button data-nav="${v}" ${cur(v) ? 'aria-current="page"' : ''}>${ic(i)}<span>${l}</span>${v === 'teach' && pend ? `<span class="dot">${pend}</span>` : ''}</button>`).join('');
  $('.top').hidden = false;
  $('#topin').innerHTML = `<div class="brand">${logoHTML()}<span class="sep"></span><span class="name">Flashcard Tamer <span>· Mandarin</span></span></div>
    <nav class="nav" aria-label="Menu utama">${btns}</nav>
    <button class="icon-btn" data-guide aria-label="Petunjuk" title="Petunjuk pemakaian">${ic('help')}</button>
    <button class="icon-btn" data-act="logout" aria-label="Keluar akun" title="Keluar akun">${ic('out')}</button>`;
  const bn = $('#bottomnav'); bn.hidden = false; bn.innerHTML = btns;
}
function hideShell() { $('.top').hidden = true; $('#bottomnav').hidden = true; $('#actionbar').hidden = true; }
function go(v) {
  if (v === 'teach' && !isTeacher()) v = 'learn';
  if (v === 'cards' && !canCreate()) v = 'learn';
  if (v === 'ai' && !AI_ON) v = 'learn';
  if (!['learn', 'hist', 'cards', 'teach', 'ai', 'social'].includes(v)) v = 'learn';
  stopLive();
  S.view = v; savePrefs(); shell(); window.scrollTo(0, 0);
  ({ learn: renderLearn, hist: renderHist, cards: renderCards, teach: renderTeach, ai: renderAI, social: renderFeed })[v]();
}

/* ================= masuk ================= */
function authCard(inner) { hideShell(); $('#view').innerHTML = `<div class="auth"><form class="auth-card" id="authForm" novalidate>${logoHTML()}${inner}</form></div>`; }
function renderLogin(msg = '') {
  authCard(`<h1>Flashcard Tamer<small>${APP}</small></h1>
    <label class="field" for="lu">Username<input id="lu" name="username" autocomplete="username" autocapitalize="none" spellcheck="false" maxlength="64" required></label>
    <label class="field" for="lp">Password<input id="lp" name="password" type="password" autocomplete="current-password" maxlength="128" required></label>
    <div class="err" id="lerr" role="alert">${esc(msg)}</div>
    <button class="btn lg" type="submit" id="lbtn">Masuk</button>
    <p class="note" style="text-align:center">Belum punya akun? Akun dibuat oleh gurumu.</p>${adminHTML()}<p class="ver">Versi ${APP_VERSION}</p>`);
  $('#authForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = $('#lbtn'); btn.disabled = true; $('#lerr').textContent = '';
    try { ME = await api.login($('#lu').value, $('#lp').value); await loadAll(); enterApp(); }
    catch (err) { $('#lerr').textContent = err.message; btn.disabled = false; $('#lp').value = ''; $('#lp').focus(); }
  });
}
function renderSetup(configured) {
  authCard(`<h1>Buat akun guru<small>Langkah ini hanya sekali.</small></h1>
    ${configured ? '' : '<div class="away-banner" style="margin:0">SETUP_CODE belum diatur di Cloudflare. Ikuti langkah 5 di panduan, lalu deploy ulang.</div>'}
    <label class="field" for="xc">Kode setup<input id="xc" type="password" autocomplete="off" maxlength="128"></label>
    <label class="field" for="xn">Nama guru<input id="xn" maxlength="40" placeholder="Laoshi Elvies"></label>
    <label class="field" for="xu">Username guru<input id="xu" maxlength="24" autocapitalize="none" spellcheck="false" placeholder="guru"></label>
    <label class="field" for="xp">Password (minimal 10 karakter)<input id="xp" type="password" autocomplete="new-password" maxlength="128"></label>
    <label class="field" for="xp2">Ulangi password<input id="xp2" type="password" autocomplete="new-password" maxlength="128"></label>
    <div class="err" id="xerr" role="alert"></div>
    <button class="btn lg" type="submit" id="xbtn">Buat akun guru</button>`);
  $('#authForm').addEventListener('submit', async (e) => {
    e.preventDefault(); const err = $('#xerr'); err.textContent = '';
    if ($('#xp').value !== $('#xp2').value) { err.textContent = 'Kedua password belum sama.'; return; }
    if ($('#xp').value.length < 10) { err.textContent = 'Password minimal 10 karakter.'; return; }
    const btn = $('#xbtn'); btn.disabled = true;
    try { ME = await api.setup({ code: $('#xc').value, display_name: $('#xn').value, username: $('#xu').value, password: $('#xp').value }); await loadAll(); S.ttab = 'students'; go('teach'); toast('Akun guru dibuat. Selamat datang!'); }
    catch (ex) { err.textContent = ex.message; btn.disabled = false; }
  });
}
async function loadAll() {
  applyContent(await api.content());
  try { SRS = await api.srs(); } catch (_) { SRS = {}; }
  try { STORIES = await api.stories(); } catch (_) { STORIES = []; }
  if (!S.sel.length) S.sel = studyDecks().slice(0, 1).map((d) => d.id);
  startInbox();
}
let STORIES = [], STORY = null;
async function reloadContent() { applyContent(await api.content()); }

/* ================= Belajar ================= */
const mwOn = () => SET.mw_quiz !== false;
const kindNow = () => (S.kind === 'mw' && mwOn() ? 'mw' : S.kind === 'cloze' ? 'cloze' : S.kind === 'type' ? 'type' : 'card');
const forKind = (cs) => (kindNow() === 'mw' ? cs.filter((c) => c.mw) : cs);
const isFrozenDeck = (d) => FRZ_DECKS.has(typeof d === 'string' ? d : d.id);
const usable = (cards) => cards.filter((c) => !FRZ_CARDS.has(c.id) && !FRZ_DECKS.has(c.deck_id));
const liveCards = (d) => usable(d.cards);
const poolCards = () => forKind(usable(studyDecks().filter((d) => S.sel.includes(d.id) && !isFrozenDeck(d)).flatMap((d) => d.cards)));
const selCards = poolCards;
const isPriv = (d) => !isTeacher() && (d.mine || !!d.delivered_at);
const isNewGift = (d) => !!d.delivered_at && Date.now() - d.delivered_at < 3 * 864e5 && !d.cards.some((c) => SRS[c.id]);
// Bagi kategori: potong daftar kartu yang dipilih menjadi beberapa bagian tetap
const partKey = () => kindNow() + ':' + S.sel.slice().sort().join(',');
function parts() {
  const cs = poolCards(), size = Math.max(1, Math.min(500, S.split.size | 0 || 10)), out = [];
  for (let i = 0; i < cs.length; i += size) out.push(cs.slice(i, i + size));
  return out;
}
const doneParts = () => (store.get('parts', {})[partKey()] || []);
function markPart(key, idx) { const all = store.get('parts', {}); const l = new Set(all[key] || []); l.add(idx); all[key] = [...l]; const ks = Object.keys(all); if (ks.length > 40) delete all[ks[0]]; store.set('parts', all); }
function planCards() {
  if (S.split.on) { const ps = parts(); if (!ps.length) return []; if (S.split.part >= ps.length) S.split.part = 0; return ps[S.split.part]; }
  const cs = poolCards(); return S.all ? cs : cs.filter(isDue);
}
const lessonsOf = (lv) => DECKS.filter((d) => d.hskLevel === lv && d.hskLesson).length;
const dlBtn = (d) => `<span class="dl" role="button" tabindex="0" data-dl="${esc(d.id)}" aria-label="Unduh tabel kosakata" title="Unduh tabel kosakata">${ic('download')}</span>`;
function hskCard(d) {
  const open = HSK_OPEN === d.hskLevel, n = d.cards.length;
  return `<button class="deck hsk lv${d.hskLevel} ${open ? 'open' : ''}" data-hsk="${d.hskLevel}" aria-expanded="${open}" style="--dc:${d.color}">${dlBtn(d)}
    <div class="hsk-badge"><span class="h3o">HSK 3.0</span><span class="lvl">级${d.hskLevel}</span></div>
    <div class="hsk-big">HSK${d.hskLevel}</div>
    <div class="id">${n} kosakata · ${lessonsOf(d.hskLevel)} pelajaran</div>
    <div class="meta"><span class="dotc"></span>${open ? 'Pelajaran terbuka di bawah ↓' : 'Ketuk untuk lihat semua pelajaran'}</div></button>`;
}
const frzBtn = (d) => `<span class="frz" role="button" tabindex="0" data-freezedeck="${esc(d.id)}" aria-label="Bekukan kategori" title="Bekukan: sembunyikan dari belajar sampai dipecahkan">${ic('snow')}</span>`;
function frozenDeckCard(d) {
  return `<div class="deck frozen" style="--dc:${d.color}">
    <div class="frz-badge">${ic('snow')} Beku</div>
    <div class="zh">${esc(d.zh)}</div><div class="id">${esc(d.idn)}</div>
    <div class="meta">${d.cards.length} kartu · tidak dipakai untuk belajar</div>
    <button class="btn sm" data-unfreezedeck="${esc(d.id)}">${ic('snow')} Pecahkan (cairkan)</button></div>`;
}
function deckCard(d) {
  if (d.hskLevel && !d.hskLesson) return hskCard(d);
  if (isFrozenDeck(d)) return frozenDeckCard(d);
  const live = liveCards(d), nFrz = d.cards.length - live.length;
  const due = live.filter(isDue).length, sched = live.length - due, on = S.sel.includes(d.id);
  const mwN = live.filter((c) => c.mw).length;
  const pics = live.filter(hasPic).slice(0, 3).map(picHTML).join('') || `<span class="hz">${esc((live[0] || d.cards[0] || {}).h || '')}</span>`;
  const tags = [];
  if (isPriv(d)) tags.push(`<span class="pill priv">${ic('key')} Pribadi</span>`);
  const fromWho = d.delivered_from ? esc(d.delivered_from) : 'guru';
  if (d.delivered_at && !isTeacher()) tags.push(isNewGift(d) ? `<span class="pill new">Baru dari ${fromWho}</span>` : `<span class="pill mute">Dari ${fromWho}</span>`);
  else if (d.owner_id) tags.push(`<span class="pill mute">Buatan ${d.mine ? 'kamu' : esc(d.owner_name || 'murid')}</span>`);
  if (isTeacher() && !d.owner_id && d.status === 'private') tags.push('<span class="pill priv">Hanya untuk penerima kiriman</span>');
  if (d.hskLesson) tags.push(`<span class="pill hsk-tag">HSK3.0 级${d.hskLevel}·${d.hskLesson}</span>`);
  if (d.speak) tags.push(`<span class="pill speak-tag">${ic('speak')} Speaking</span>`);
  if (nFrz) tags.push(`<span class="pill mute">${ic('snow')} ${nFrz} beku</span>`);
  const total = live.length || d.cards.length;
  return `<button class="deck ${isPriv(d) ? 'mine' : ''} ${d.speak ? 'speak-deck' : ''} ${d.hskLesson ? 'hsk-lesson lv' + d.hskLevel : ''}" data-pick="${esc(d.id)}" aria-pressed="${on}" style="--dc:${d.color}"><span class="chk">${ic('check')}</span>${dlBtn(d)}${frzBtn(d)}
    <div class="pics">${pics}</div><div class="zh">${esc(d.zh)}</div><div class="id">${esc(d.idn)}</div>
    ${tags.length ? `<div class="tags">${tags.join('')}</div>` : ''}
    <div class="bar"><i style="width:${total ? (sched / total) * 100 : 0}%"></i></div>
    <div class="meta"><span class="dotc"></span>${kindNow() === 'mw' ? `${mwN} kartu ber-量词` : `${due} siap · ${live.length} kartu`}</div></button>`;
}
function updateBucket() { const el = document.getElementById('bucketBox'); if (el && S.view === 'learn') el.innerHTML = selBucketHTML(); }
function updateStartFab() { const el = document.getElementById('startFab'); if (!el) return; const n = poolCards().length; el.hidden = !n; el.innerHTML = `${ic('play')} Mulai${n ? ` · ${n} kartu` : ''}`; }
function selBucketHTML() {
  const sel = studyDecks().filter((d) => S.sel.includes(d.id) && !isFrozenDeck(d));
  const n = poolCards().length;
  if (!sel.length) return '<div class="bucket empty"><span class="note">Belum ada kategori dipilih. Ketuk kategori di bawah untuk menambahkannya ke keranjang.</span></div>';
  return `<div class="bucket"><div class="bucket-head"><b>${ic('basket')} Keranjang belajar · ${n} kartu</b><button class="chip sm" data-clearsel>${ic('x')} Kosongkan</button></div>
    <div class="bucket-chips">${sel.map((d) => `<span class="bchip" style="--dc:${d.color}"><span class="dotc"></span>${esc(d.zh)} <small>${liveCards(d).length}</small><button class="bx" data-unselect="${esc(d.id)}" aria-label="Keluarkan ${esc(d.zh)}">${ic('x')}</button></span>`).join('')}</div></div>`;
}
function lastSessHTML() {
  const r = store.get('lastsess', null); if (!r || !ME || (savedRun() && RESUME_OK)) return '';
  const decks = (r.decks || []).map((id) => deckOf(id)).filter((d) => d && d.cards.length && studyDecks().some((x) => x.id === d.id));
  if (!decks.length) return '';
  const names = decks.map((d) => esc(d.zh)).join('、');
  const days = Math.floor((Date.now() - (r.at || 0)) / 864e5);
  const when = days <= 0 ? 'terakhir kamu pelajari' : days === 1 ? 'kemarin' : `${days} hari lalu`;
  return `<div class="resume last"><div class="ic">${ic('hist')}</div><div><b>Lanjut belajar</b><span class="han">${names}</span><span> · ${r.kind === 'mw' ? 'Kuis 量词' : 'Flashcard'} · ${when}</span></div>
    <div class="row"><button class="btn sm" data-act="studylast">${ic('play')} Belajar lagi</button></div></div>`;
}
function resumeHTML() {
  const r = savedRun(); if (!r || !RESUME_OK) return '';
  const nm = r.decks.map((id) => deckOf(id)?.zh).filter(Boolean).join('、');
  return `<div class="resume" role="region" aria-label="Sesi yang belum selesai"><div class="ic">${ic('resume')}</div><div><b>Sesi belum selesai · ${r.done}/${r.total} kartu</b><span class="han">${esc(nm)}</span><span> · ${r.kind === 'mw' ? 'Kuis 量词' : 'Flashcard'}${r.partLabel ? ' · ' + esc(r.partLabel) : ''}</span></div>
    <div class="row"><button class="btn sm secondary" data-act="endsaved">${ic('stop')} Akhiri</button><button class="btn sm" data-act="resume">${ic('play')} Lanjutkan</button></div></div>`;
}
function renderLearn() {
  Q = null; if (S.view !== 'learn') BAR_OPEN = false; document.documentElement.style.setProperty('--c', 'var(--brand)');
  const ds = studyDecks(); S.sel = S.sel.filter((id) => ds.some((d) => d.id === id));
  if (S.kind === 'mw' && !mwOn()) S.kind = 'card';
  const dueAll = ds.filter((d) => !isFrozenDeck(d)).flatMap((d) => liveCards(d)).filter(isDue).length;
  const priv = ds.filter(isPriv).sort((a, b) => (b.delivered_at || b.created_at || 0) - (a.delivered_at || a.created_at || 0));
  const rest = ds.filter((d) => !isPriv(d) && !d.hskLevel && !d.speak);
  const speakDecks = ds.filter((d) => d.speak).sort((a, b) => (a.speakLevel || 0) - (b.speakLevel || 0));
  const pinned = pinnedCards();
  const frozenCardList = CARDS.filter((c) => FRZ_CARDS.has(c.id) && !isFrozenDeck(c.deck_id) && studyDecks().some((d) => d.id === c.deck_id));
  const hskLevels = ds.filter((d) => d.hskLevel && !d.hskLesson).sort((a, b) => a.hskLevel - b.hskLevel);
  const hskLessons = ds.filter((d) => d.hskLesson && d.hskLevel === HSK_OPEN).sort((a, b) => a.hskLesson - b.hskLesson);
  const ps = S.split.on ? parts() : [], dp = doneParts(), pool = poolCards().length;
  if (S.split.part >= ps.length) S.split.part = 0;
  $('#view').innerHTML = `<div class="page-head"><div class="hello"><button class="avatar edit" data-act="setphoto" title="Ganti foto profil" aria-label="Ganti foto profil">${ME.photo ? `<img src="${esc(ME.photo)}" alt="">` : initial(ME.display_name)}<span class="cam">${ic('image')}</span></button><div>
      <h1 class="h1">Halo, ${esc(ME.display_name)}!</h1><p class="sub" style="margin-top:2px">${dueAll ? `${dueAll} kartu siap kamu pelajari hari ini.` : 'Semua kartu sudah terjadwal. Kerja bagus!'}</p></div></div>
    ${ds.length ? `<button class="chip" data-act="selall">${S.sel.length === ds.length ? 'Kosongkan pilihan' : 'Pilih semua'}</button>` : ''}</div>
    ${installHTML()}
    <div id="resumeBox">${resumeHTML()}</div>
    ${lastSessHTML()}
    ${pinned.length ? `<div class="sec-title">${ic('pin')} Disematkan · ${pinned.length}</div>
      <div class="pinbar"><p class="note" style="flex:1;min-width:140px">Kartu yang kamu sematkan untuk diulang. Belajar khusus kartu ini.</p><button class="btn sm" data-studypinned>${ic('play')} Belajar sematan</button></div>` : ''}
    <div class="learnbar">
      <div class="seg" role="group" aria-label="Jenis latihan"><button data-lkind="card" aria-pressed="${kindNow() === 'card'}">Flashcard</button>${mwOn() ? `<button data-lkind="mw" aria-pressed="${kindNow() === 'mw'}">Kuis 量词</button>` : ''}<button data-lkind="cloze" aria-pressed="${kindNow() === 'cloze'}">Isi rumpang</button><button data-lkind="type" aria-pressed="${kindNow() === 'type'}">Latihan ketik</button></div>
      <button class="chip" data-act="split" aria-pressed="${S.split.on}">${ic('split')} Atur sesi</button>
      <button class="chip" data-act="togall" aria-pressed="${S.all}" title="Latih semua kartu, abaikan jadwal">${ic('play')} Latih semua</button>
      <button class="chip" data-act="sendsheet">${ic('send')} Kirim kartu</button>
      ${!isTeacher() && 'Notification' in window ? `<button class="chip" data-act="reminder" aria-pressed="${store.get('remind', false)}">${ic('alert')} Pengingat</button>` : ''}
    </div>
    <div id="bucketBox">${selBucketHTML()}</div>
    ${S.split.on ? `<div class="splitbox">
      <label class="field" for="spSize">Kartu per sesi<input id="spSize" type="number" inputmode="numeric" min="1" max="500" value="${S.split.size}"></label>
      <span class="x-sign">=</span>
      <label class="field" for="spCount">Jumlah sesi<input id="spCount" type="number" inputmode="numeric" min="1" max="100" value="${Math.max(1, ps.length)}"></label>
      <p class="note" style="flex:1;min-width:180px;padding-bottom:10px">${pool} kartu dari kategori yang dipilih. Pilih sesi yang mau dipelajari sekarang.</p>
      <div class="parts">${ps.map((p, i) => `<button class="part ${dp.includes(i) ? 'ok' : ''}" data-part="${i}" aria-pressed="${S.split.part === i}">Sesi ${i + 1}<small>${dp.includes(i) ? '✓ selesai · ' : ''}${p.length} kartu</small></button>`).join('') || '<span class="note">Pilih kategori dulu.</span>'}</div>
    </div>` : `<p class="note" style="margin:-6px 0 16px">${kindNow() === 'mw' ? 'Kuis 量词: tebak kata satuan yang tepat untuk tiap benda, misalnya 一<b>本</b>书.' : kindNow() === 'cloze' ? 'Isi rumpang: lengkapi kalimat dengan kata yang tepat — ketik (pinyin/hanzi) atau pilih. Arti kalimat ditampilkan di depan. Kalimat dibuat otomatis jika belum ada.' : kindNow() === 'type' ? 'Latihan ketik: lihat hanzi, lalu ketik pinyin-nya tanpa dikasih dulu — mengetik sambil menebak bacaannya.' : 'Ketuk kategori untuk memilih. <b>Ketuk 2× cepat</b> untuk membuka tombol Mulai. Nilai 1 & 2 diulang di sesi ini, 3 muncul besok, 4 muncul 3 hari lagi.'}</p>`}
    ${hskLevels.length ? `<div class="sec-title">${ic('book2')} HSK 3.0</div><div class="decks hsk-row">${hskLevels.map(hskCard).join('')}</div>
      ${HSK_OPEN && hskLessons.length ? `<div class="hsk-open"><div class="hsk-open-bar"><b>级${HSK_OPEN} · ${hskLessons.length} pelajaran</b><span class="spacer"></span><button class="btn sm" data-studyhsk="${HSK_OPEN}">${ic('play')} Belajar semua</button><button class="chip" data-babpick="${HSK_OPEN}">${ic('list')} Per bab</button><button class="chip" data-hsk="${HSK_OPEN}">${ic('x')} Tutup</button></div>
        <div class="decks">${hskLessons.map(deckCard).join('')}</div></div>` : '<p class="note" style="margin:-4px 0 14px">Ketuk salah satu kartu HSK di atas untuk membuka semua pelajarannya.</p>'}` : ''}
    ${speakDecks.length ? `<div class="sec-title">${ic('speak')} Percakapan harian</div><div class="decks">${speakDecks.map(deckCard).join('')}</div>` : ''}
    ${STORIES && STORIES.length ? `<div class="sec-title">${ic('book2')} Cerita</div><div class="stories">${STORIES.map(storyTile).join('')}</div>` : ''}
    ${LESSONS && LESSONS.lessons.length ? `<div class="sec-title">${ic('book2')} Materi</div><div class="lessons">${LESSONS.lessons.map(lessonTile).join('')}</div>` : ''}
    ${!isTeacher() || priv.length ? `<div class="sec-title">${ic('key')} Pribadi${priv.length ? ' · ' + priv.length : ''}</div><div class="decks">${!isTeacher() ? `<button class="deck custom" data-act="custom" aria-label="Buat kartu sendiri"><span class="plus">${ic('plus')}</span><b>Custom</b><span>Buat kartu sendiri</span></button>` : ''}${priv.map(deckCard).join('')}</div>${rest.length ? '<div class="sec-title">Kategori kelas</div>' : ''}` : ''}
    <div class="decks">${rest.map(deckCard).join('') || (priv.length ? '' : '<div class="panel empty"><b>Belum ada kategori</b>Gurumu belum menampilkan kategori untukmu.</div>')}</div>
    ${frozenCardList.length ? `<div class="sec-title">${ic('snow')} Kata beku · ${frozenCardList.length}</div>
      <div class="frozen-cards">${frozenCardList.map((c) => `<button class="frz-chip" data-unfreezecard="${esc(c.id)}" title="Pecahkan (cairkan)"><span class="han">${esc(c.h)}</span><span class="fm">${esc(mean(c))}</span>${ic('snow')}</button>`).join('')}</div>
      <p class="note" style="margin-top:6px">Ketuk kata untuk mencairkannya agar muncul lagi saat belajar.</p>` : ''}
    <p class="ver">Versi ${APP_VERSION}</p>
    <button class="start-fab" id="startFab" data-startsel ${poolCards().length ? '' : 'hidden'}>${ic('play')} Mulai${poolCards().length ? ` · ${poolCards().length} kartu` : ''}</button>`;
  const sz = $('#spSize'), ct = $('#spCount');
  if (sz) {
    const upd = (from) => {
      const n = poolCards().length || 1;
      if (from === 'size') S.split.size = Math.max(1, Math.min(500, parseInt(sz.value, 10) || 1));
      else { const k = Math.max(1, Math.min(100, parseInt(ct.value, 10) || 1)); S.split.size = Math.max(1, Math.ceil(n / k)); }
      S.split.part = 0; savePrefs();
      clearTimeout(splitT); splitT = setTimeout(() => { const f = document.activeElement && document.activeElement.id; renderLearn(); const el = f && $('#' + f); if (el) { el.focus(); try { el.setSelectionRange(99, 99); } catch (_) { /* number */ } } }, 500);
    };
    sz.addEventListener('input', () => upd('size')); ct.addEventListener('input', () => upd('count'));
  }
  renderActionbar();
  checkSaved();
}
let splitT = 0;
let BAR_OPEN = false;
function renderActionbar() {
  const bar = $('#actionbar'); if (S.view !== 'learn' || !BAR_OPEN || !S.sel.length) { bar.hidden = true; if (!S.sel.length) BAR_OPEN = false; return; } bar.hidden = false;
  const cs = planCards(), n = cs.length, ps = S.split.on ? parts() : [], pool = poolCards().length;
  const info = S.split.on ? `Sesi ${ps.length ? S.split.part + 1 : 0} dari ${ps.length}${doneParts().includes(S.split.part) ? ' · ✓ sudah selesai' : ''}` : `${S.sel.length} kategori · ${S.all ? 'semua kartu, jadwal diabaikan' : 'kartu baru & yang jatuh tempo'}`;
  bar.innerHTML = `<div class="in"><div class="info"><b>${n} kartu${kindNow() === 'mw' ? ' · 量词' : ''}</b><span>${info}</span></div>
    <button class="switch" role="switch" aria-checked="${S.split.on}" data-act="split"><span class="track"></span>Bagi jadi sesi</button>
    ${S.split.on ? `<div class="splitctl">
        <label class="per" for="abSize"><input id="abSize" type="number" inputmode="numeric" min="1" max="500" value="${S.split.size}" aria-label="Kartu per sesi"><span>kartu/sesi</span></label>
        <div class="stepper" role="group" aria-label="Pilih sesi"><button data-act="partprev" aria-label="Sesi sebelumnya" ${S.split.part > 0 ? '' : 'disabled'}>${ic('back')}</button><b>${ps.length ? S.split.part + 1 : 0}/${ps.length}</b><button data-act="partnext" aria-label="Sesi berikutnya" ${S.split.part + 1 < ps.length ? '' : 'disabled'}><svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 18l6-6-6-6"/></svg></button></div>
      </div>` : `<button class="switch" role="switch" aria-checked="${S.all}" data-act="togall"><span class="track"></span>Latih semua</button>`}
    <button class="btn" data-act="start" ${n ? '' : 'disabled'}>${ic('play')} Mulai${S.split.on && ps.length ? ` sesi ${S.split.part + 1}` : ''}</button>
    <button class="icon-btn bar-x" data-act="closebar" aria-label="Tutup">${ic('x')}</button></div>`;
  const inp = $('#abSize');
  if (inp) inp.addEventListener('change', () => {
    S.split.size = Math.max(1, Math.min(500, parseInt(inp.value, 10) || 1)); S.split.part = 0; savePrefs();
    if (S.view === 'learn') renderLearn();
    toast(`${pool} kartu dibagi jadi ${parts().length} sesi, masing-masing ${S.split.size} kartu.`);
  });
}

/* ---- pilih bab HSK ---- */
function openBabPick(lv) {
  const ls = DECKS.filter((d) => d.hskLevel === lv && d.hskLesson).sort((a, b) => a.hskLesson - b.hskLesson);
  if (!ls.length) return;
  const el = document.createElement('div'); el.className = 'overlay sheet babpick'; el.id = 'babPick'; el.setAttribute('role', 'dialog');
  el.innerHTML = `<div class="box">
    <div class="sh-head"><b>Pilih bab · HSK 级${lv}</b><button class="icon-btn" data-act="closebab" aria-label="Tutup">${ic('x')}</button></div>
    <p class="note" style="margin:0 0 10px">Ketuk bab untuk langsung belajar pelajaran itu.</p>
    <div class="bab-grid">${ls.map((d) => `<button class="bab" data-babgo="${esc(d.id)}"><b>${d.hskLesson}</b><span>${d.cards.length} kata</span></button>`).join('')}</div></div>`;
  document.body.appendChild(el);
  el.addEventListener('click', (e) => { if (e.target === el) closeBabPick(); });
}
function closeBabPick() { const el = document.getElementById('babPick'); if (el) el.remove(); }

/* ---- unduh tabel kosakata (semua deck) ---- */
let HSK_OPEN = 0;
function downloadTable(deckId) {
  const d = deckOf(deckId); if (!d || !d.cards.length) { toast('Kategori ini kosong.'); return; }
  const rows = d.cards.map((c, i) => `<tr><td>${i + 1}</td><td class="h">${esc(c.h)}</td><td>${esc(c.p || '')}</td><td>${esc(c.m || '')}</td><td>${esc(c.en || '')}</td><td>${esc(c.mw || '')}</td></tr>`).join('');
  const title = `${d.zh}${d.idn ? ' — ' + d.idn : ''}`;
  const html = `<!doctype html><html lang="id"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title>
<style>body{font-family:-apple-system,Segoe UI,Roboto,sans-serif;margin:24px;color:#13161c}h1{font-size:20px;margin:0 0 4px}p.sub{color:#667;margin:0 0 16px;font-size:13px}
table{border-collapse:collapse;width:100%;font-size:14px}th,td{border:1px solid #d7dbe3;padding:7px 10px;text-align:left}th{background:${d.color};color:#fff}
td.h{font:700 20px "Noto Sans SC","PingFang SC",sans-serif}tr:nth-child(even){background:#f5f6f8}@media print{body{margin:0}th{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
.b{margin:16px 0;text-align:center}.b button{font-size:14px;padding:8px 16px;border:0;border-radius:8px;background:${d.color};color:#fff;cursor:pointer}</style></head>
<body><h1>${esc(title)}</h1><p class="sub">${d.cards.length} kosakata · Alvaro Education Centre · dari Flashcard Tamer</p>
<div class="b"><button onclick="print()">Cetak / Simpan PDF</button></div>
<table><thead><tr><th>No</th><th>汉字</th><th>Pinyin</th><th>Arti</th><th>English</th><th>量词</th></tr></thead><tbody>${rows}</tbody></table></body></html>`;
  try {
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob), a = document.createElement('a');
    a.href = url; a.download = `${(d.zh || 'kosakata').replace(/[^\w\u4e00-\u9fff-]/g, '_')}.html`;
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 4000);
    toast('Tabel kosakata diunduh. Buka filenya, bisa dicetak atau simpan PDF.');
  } catch (_) { toast('Gagal mengunduh.'); }
}

/* ---- simpan & lanjutkan sesi (setelah keluar / refresh) ---- */
let RESUME_OK = false;
const savedRun = () => { const r = store.get('run', null); return r && ME && r.uid === ME.id && typeof r.sid === 'string' && Array.isArray(r.ids) ? r : null; };
function saveRun() {
  if (!Q || !Q.sid) return;
  store.set('run', { uid: ME.id, sid: Q.sid, ids: Q.queue.map((c) => c.id), total: Q.total, done: Q.done, mode: Q.mode, kind: Q.kind, awayCount: Q.awayCount, clues: Q.clues, streak: Q.streak, rushCount: Q.rushCount || 0, decks: Q.decks, part: Q.part || null, partLabel: Q.part ? `Sesi ${Q.part.idx + 1} dari ${Q.part.of}` : '', at: Date.now() });
}
const clearRun = () => { store.set('run', null); RESUME_OK = false; };
let checkingSaved = false;
async function checkSaved() {
  const r = savedRun(); if (!r || checkingSaved) return;
  if (RESUME_OK) return;
  checkingSaved = true;
  try { const st = await api.runStatus(r.sid); if (st.open) RESUME_OK = true; else clearRun(); }
  catch (_) { /* offline: coba lagi nanti */ }
  checkingSaved = false;
  const box = $('#resumeBox'); if (box && S.view === 'learn') box.innerHTML = resumeHTML();
}
function resumeRun() {
  const r = savedRun(); if (!r) return;
  const byId = new Map(CARDS.map((c) => [c.id, c]));
  const queue = r.ids.map((id) => byId.get(id)).filter(Boolean);
  if (!queue.length) { toast('Kartu di sesi itu sudah tidak tersedia.'); endSaved(); return; }
  Q = { sid: r.sid, queue, total: r.total, done: r.done, mode: r.mode, kind: r.kind === 'mw' ? 'mw' : 'card', decks: r.decks, part: r.part, clues: r.clues ?? CLUE_START, streak: r.streak || 0, rushCount: r.rushCount || 0, chain: Promise.resolve(), failed: 0, awayCount: r.awayCount || 0, awayMs: 0, awayStart: 0 };
  PRES.state = 'away'; S.view = 'study'; $('#actionbar').hidden = true; shell(); startBeat(); window.scrollTo(0, 0);
  setPresence('active', true); renderStudy(); toast('Sesi dilanjutkan.');
}
async function endSaved() {
  const r = savedRun(); clearRun();
  if (r) { try { await api.finishSession(r.sid, true); } catch (_) { /* sudah selesai */ } }
  if (S.view === 'learn') { const box = $('#resumeBox'); if (box) box.innerHTML = ''; }
}

/* ================= sesi belajar + deteksi keluar aplikasi ================= */
let hiddenAt = 0, blurT = 0, beatT = 0;
const PRES = { state: 'active' };
function setPresence(st) {
  if (!Q || !Q.sid || S.view !== 'study') return;
  if (PRES.state === st) return;
  PRES.state = st;
  if (st === 'away') { Q.awayCount++; Q.awayStart = Date.now(); saveRun(); }
  else if (Q.awayStart) { Q.awayMs += Date.now() - Q.awayStart; Q.awayStart = 0; showAwayBanner(); }
  api.presence(Q.sid, st).then(onPresence);
}
// Server bilang sesi sudah ditutup (mis. diakhiri guru)
function onPresence(r) {
  if (!r || r.ok !== false || !Q || S.view !== 'study') return;
  const by = r.ended_by; stopBeat(); clearRun(); Q = null;
  S.view = 'learn'; savePrefs(); shell(); renderLearn();
  showOverlay({ cls: by === 'teacher' ? 'warn' : '', icon: 'stop', title: by === 'teacher' ? 'Sesi diakhiri oleh guru' : 'Sesi sudah berakhir',
    body: `<p class="msg">${by === 'teacher' ? 'Gurumu mengakhiri sesi ini. Jawaban yang sudah kamu beri tetap tersimpan.' : 'Sesi ini sudah ditutup. Mulai sesi baru dari daftar kategori.'}</p>`, buttons: [['ok', 'Mengerti']], delay: by === 'teacher' ? 2000 : 0 });
}
document.addEventListener('visibilitychange', () => {
  if (Q && Q.cur) { if (document.hidden) hiddenAt = performance.now(); else if (hiddenAt) { Q.cur.hidden += performance.now() - hiddenAt; hiddenAt = 0; } }
  setPresence(document.hidden ? 'away' : 'active');
});
window.addEventListener('blur', () => { clearTimeout(blurT); blurT = setTimeout(() => { if (!document.hasFocus()) setPresence('away'); }, 1500); });
window.addEventListener('focus', () => { clearTimeout(blurT); setPresence('active'); });
window.addEventListener('pagehide', () => setPresence('away'));
function startBeat() { stopBeat(); beatT = setInterval(() => { if (Q && Q.sid && S.view === 'study' && !document.hidden) api.presence(Q.sid, PRES.state).then(onPresence); }, 10000); }
function stopBeat() { clearInterval(beatT); beatT = 0; }
function showAwayBanner() {
  const el = $('#awayBanner'); if (!el) return;
  el.hidden = false;
  el.innerHTML = `${ic('alert')}<span>Kamu baru saja keluar dari aplikasi. Ini sudah ${Q.awayCount} kali, dan gurumu bisa melihatnya. Yuk, fokus lagi!</span>`;
  fx(el, 'fx-wrong');
}

async function withRetry(fn, tries = 3) {
  for (let i = 0; ; i++) { try { return await fn(); } catch (e) { if (i >= tries - 1 || (e.status && e.status < 500)) throw e; await new Promise((r) => setTimeout(r, 600 * (i + 1))); } }
}
async function startStudy(cards) {
  const cs = cards || planCards(); if (!cs.length) return;
  const btn = document.querySelector('[data-act="start"]'); if (btn) btn.disabled = true;
  if (savedRun()) await endSaved(); // sesi lama yang ditinggal ditutup dulu
  BAR_OPEN = false;
  const kind = cards ? 'card' : kindNow();
  const mode = kind === 'mw' ? 'mw' : (kind === 'cloze' || kind === 'type') ? 'han' : effMode();
  const decks = [...new Set(cs.map((c) => c.deck_id))];
  let sid;
  try { sid = await api.startSession(decks, mode, cs.length); }
  catch (e) { toast(e.message); if (btn) btn.disabled = false; return; }
  const part = !cards && S.split.on ? { key: partKey(), idx: S.split.part, of: parts().length } : null;
  Q = { sid, queue: shuffle(cs), total: cs.length, done: 0, mode, kind, decks, part, clues: CLUE_START, rushCount: 0, chain: Promise.resolve(), failed: 0, streak: 0, awayCount: 0, awayMs: 0, awayStart: 0 };
  PRES.state = 'active'; saveRun();
  S.view = 'study'; $('#actionbar').hidden = true; shell(); startBeat(); window.scrollTo(0, 0); renderStudy();
}
function cardMode(c) { if (Q && Q.kind === 'mw') return 'mw'; if (Q && Q.kind === 'cloze') return 'cloze'; if (Q && Q.kind === 'type') return 'type'; if (isSpeak(c)) return 'arti'; let m = effMode(); if (m === 'mix') m = ['pic', 'han', 'arti'][(Math.random() * 3) | 0]; if (m === 'pic' && !hasPic(c)) m = 'han'; return m; }
function frontHTML(c, m) {
  if (m === 'mw') return `${hasPic(c) ? `<div class="big" style="width:min(40%,150px)">${picHTML(c)}</div>` : ''}<div class="mwq">一<span class="blank">个</span>${esc(c.h)}</div><div class="mwq-sub">${esc(c.p)} · ${esc(mean(c))}</div><div class="q">Kata satuannya apa?</div>`;
  if (m === 'han') return `<div class="bighan">${esc(c.h)}</div><div class="q">Apa artinya?</div>`;
  if (m === 'arti') return `<div class="bigid">${esc(mean(c))}</div><div class="q">Bahasa Mandarinnya apa?</div>`;
  if (m === 'cloze') return `<div class="cloze-front" id="clozeFront"><div class="note">Menyusun kalimat…</div></div>`;
  if (m === 'type') return `<div class="type-front"><div class="bighan ${[...c.h].length >= 6 ? 'small' : ''}">${esc(c.h)}</div><div class="q">Ketik pinyin-nya — tebak bacaannya</div></div>`;
  return `<div class="big">${picHTML(c)}</div><div class="q">Ini apa dalam bahasa Mandarin?</div>`;
}
function backHTML(c) {
  const L = [...c.h].length; let extra = '';
  if (c.mw) { const d = MW[c.mw] || ['', 0, '']; extra = `<div class="extra"><div class="z">一<b>${esc(c.mw)}</b>${esc(c.h)}</div>${d[0] ? `<div class="y">${yi(c.mw)} ${esc(d[0])} ${esc(c.p)}</div>` : ''}${c.alt && c.alt.length ? `<div class="a">juga: ${c.alt.map((a) => '一' + esc(a) + esc(c.h)).join(' / ')}</div>` : ''}</div>`; }
  else if (c.s && isSpeak(c)) extra = `<div class="extra resp"><div class="resp-lbl">${ic('speak')} Cara menjawab<button class="say sm" data-sayresp aria-label="Dengarkan jawaban">${ic('sound')}</button></div><div class="s">${esc(c.s)}</div><div class="y">${esc(c.sp)}</div><div class="a">${esc(c.si)}</div></div>`;
  else if (c.s) extra = `<div class="extra">${c.opp ? `<div class="z">↔ <b>${esc(c.opp)}</b></div>` : ''}<div class="s">${esc(c.s)}</div><div class="y">${esc(c.sp)}</div><div class="a">${esc(c.si)}</div></div>`;
  return `${hasPic(c) ? `<div class="sm">${picHTML(c)}</div>` : ''}<div class="h ${L >= 5 ? 'l5' : L === 4 ? 'l4' : ''}">${esc(c.h)}</div>${c.p ? `<div class="p">${esc(c.p)}</div>` : ''}<div class="m">${esc(mean(c))}</div>${extra}`;
}
const sayText = (c) => (c.mw ? c.h : c.s || c.h);
function renderStudy() {
  if (!Q.queue.length) { renderDone(); return; }
  const c = Q.queue[0], d = deckOf(c.deck_id) || { zh: '', color: '#1f3fbf', cards: [] }, m = cardMode(c);
  const isMw = Q.kind === 'mw';
  const isCloze = m === 'cloze';
  const isType = m === 'type';
  const canQuiz = !isCloze && !isType && (isMw || (SET.quiz_enabled && S.quiz && d.cards.length >= 4));
  Q.cur = { c, m, t0: performance.now(), hidden: 0, answered: !canQuiz && !isCloze && !isType, flipped: false, sug: 0 };
  document.documentElement.style.setProperty('--c', d.color);
  $('#view').innerHTML = `<div class="study">
    <div class="study-top"><button class="btn ghost sm" data-act="quit">${ic('back')} Kategori</button><div class="progress"><i style="width:${(Q.done / Q.total) * 100}%"></i></div><span class="count">${Q.part ? `Sesi ${Q.part.idx + 1} · ` : ''}${Q.done}/${Q.total}</span><button class="btn ghost sm end" data-act="endrun" title="Akhiri sesi sekarang">${ic('stop')} <span>Akhiri</span></button></div>
    <div id="rushBanner" class="away-banner rush" role="status" hidden></div>
    <div id="awayBanner" class="away-banner" role="status" ${Q.awayCount ? '' : 'hidden'}>${Q.awayCount ? `${ic('alert')}<span>Kamu sudah keluar dari aplikasi ${Q.awayCount} kali di sesi ini. Gurumu bisa melihatnya.</span>` : ''}</div>
    <div class="study-opts">
      ${isMw ? '<span class="pill priv">Kuis 量词</span>' : ''}
      ${isCloze ? '<span class="pill priv">Isi rumpang</span>' : ''}
      ${isType ? '<span class="pill priv">Latihan ketik</span>' : ''}
      ${!isMw && !isCloze && !isType && SET.student_can_choose && SET.modes.length > 1 ? `<div class="seg" role="group" aria-label="Sisi depan kartu">${SET.modes.map((x) => `<button data-mode="${x}" aria-pressed="${effMode() === x}">${MODE_LABEL[x]}</button>`).join('')}</div>` : ''}
      <span class="spacer"></span>
      ${!isCloze && !isType ? `<button class="chip clue-btn" data-act="clue" ${Q.clues > 0 ? '' : 'disabled'} title="Clue: huruf depan jawaban. Dapat clue baru tiap ${CLUE_STREAK} jawaban benar berturut-turut.">${ic('bulb')} Clue <b>${Q.clues}</b></button>
      <button class="chip" data-act="lang" title="Bahasa arti">${LANG_LABEL[S.lang] || 'ID'}</button>` : ''}
      <button class="chip pinchip ${PINS.has(c.id) ? 'on' : ''}" data-pincard aria-pressed="${PINS.has(c.id)}" title="Sematkan kartu ini untuk diulang">${ic('pin')} <span>Sematkan</span></button>
      <button class="chip" data-freezecard title="Bekukan kata ini — tidak muncul lagi sampai dicairkan">${ic('snow')} <span>Belum berguna</span></button>
      ${SET.quiz_enabled && !isMw && !isCloze && !isType ? `<button class="chip" data-act="quiz" aria-pressed="${S.quiz}">Tebak</button>` : ''}
      <button class="chip" data-act="auto" aria-pressed="${S.auto}" aria-label="Ucapan otomatis" title="Ucapan otomatis">${ic('sound')}</button>
      <button class="chip" data-act="sfx" aria-pressed="${S.sfx}" aria-label="Efek suara" title="Efek suara">${ic(S.sfx ? 'sparkle' : 'mute')}</button>
      ${AI_ON ? `<button class="chip ailah" data-act="asklaoshi" title="Tanya ${esc(aiName())} soal kartu ini">${monkey()} ${esc(aiName())}</button>` : ''}
    </div>
    <div class="stage"><div class="tilt" id="tilt"><div class="fc" id="fc" tabindex="0" role="button" aria-label="Kartu. Ketuk untuk membalik">
      <div class="face front"><div class="tag"><span class="dotc" style="--dc:${d.color}"></span>${esc(d.zh)}</div>${frontHTML(c, m)}<div class="clue" id="clueBox" hidden></div><div class="hint">${canQuiz ? 'Pilih jawaban di bawah' : (isCloze || isType) ? 'Ketik jawaban di bawah' : 'Ketuk kartu untuk membalik'}</div></div>
      <div class="face bface"><div class="tag"><span class="dotc" style="--dc:${d.color}"></span>${esc(d.zh)}</div><button class="say" data-act="say" aria-label="Dengarkan pengucapan">${ic('sound')}</button>${backHTML(c)}</div>
    </div></div></div>
    <div id="ctrl">${canQuiz ? `<div class="quiz" aria-busy="true">${'<button class="qo skeleton" disabled>…</button>'.repeat(4)}</div>` : isCloze ? '<p class="note" style="text-align:center">Menyusun kalimat…</p>' : isType ? '' : `<button class="btn lg flipbtn" data-act="flip">${ic('flip')} Balik kartu</button>`}</div>
    <div class="skiprow"><button class="btn ghost sm" data-act="skip" title="Lewati kartu ini (muncul lagi di akhir sesi)">Lewati kartu ${ic('play')}</button></div>
    <div class="keys">${(isCloze || isType) ? 'Enter: periksa · 1–4: nilai · S: dengarkan · N: lewati' : 'Spasi: balik · 1–4: jawab atau nilai · S: dengarkan · H: clue · N: lewati'}</div>
  </div>`;
  bindTilt();
  if (Q && Q.sid) api.presence(Q.sid, PRES.state === 'away' ? 'away' : 'active', c.id); // mirror kartu ke guru
  if (m === 'han' && S.auto) speak(c.h);
  if (canQuiz) loadQuiz(c, m);
  if (isCloze) setupCloze(c, d);
  if (isType) setupType(c);
}
/* ---- lewati kartu: pindah ke akhir antrean, tidak dinilai ---- */
function skipCard() {
  const cur = Q && Q.cur; if (!cur || cur.rated || cur.busy) return;
  cur.rated = true;
  const c = Q.queue.shift();
  if (Q.queue.length) { Q.queue.push(c); toast('Kartu dilewati. Nanti muncul lagi di akhir.'); }
  else { Q.total = Math.max(Q.done, Q.total - 1); toast('Kartu terakhir dilewati.'); }
  Q.skipped = (Q.skipped || 0) + 1; saveRun();
  const tilt = $('#tilt'); if (tilt) { tilt.style.transition = 'transform .25s, opacity .25s'; tilt.style.transform = 'translateX(-40px) rotate(-4deg)'; tilt.style.opacity = '0'; }
  setTimeout(renderStudy, 220);
}

/* ---- clue: huruf depan jawaban; jatah 2, tambah 1 tiap 3 benar berturut-turut ---- */
const CLUE_START = 2, CLUE_STREAK = 3, CLUE_MAX = 5;
const plain = (p) => String(p || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/ü/g, 'v');
function clueText(c, m) {
  if (m === 'mw') { const y = plain((MW[c.mw] || [''])[0]); return { lbl: 'Kata satuannya diawali', t: (y[0] || '?').toUpperCase() + '…' }; }
  if (m === 'han') { const w = meanAns(c); return { lbl: 'Artinya diawali huruf', t: w[0].toUpperCase() + ' ' + [...w.slice(1)].map((x) => (x === ' ' ? '  ' : '_')).join(' ') }; }
  const syl = plain(c.p).replace(/'/g, ' ').trim().split(/\s+/);
  const first = (syl[0] || '?')[0] || '?';
  return { lbl: `${[...c.h].length} huruf hanzi · pinyin diawali`, t: first.toUpperCase() + '…' };
}
function useClue() {
  const cur = Q && Q.cur; if (!cur || cur.flipped || cur.clue) return;
  if (Q.clues <= 0) { toast(`Clue habis. Jawab benar ${CLUE_STREAK}× berturut-turut untuk dapat clue baru.`); return; }
  Q.clues--; cur.clue = true; saveRun();
  const k = clueText(cur.c, cur.m), box = $('#clueBox');
  box.hidden = false; box.innerHTML = `${ic('bulb')}<span>${esc(k.lbl)}</span><b>${esc(k.t)}</b>`; fx(box, 'fx-lift');
  const btn = document.querySelector('[data-act="clue"]'); if (btn) { btn.disabled = true; btn.querySelector('b').textContent = Q.clues; }
}
function gainStreak(ok) {
  if (!ok) { Q.streak = 0; return; }
  Q.streak++;
  if (Q.streak % CLUE_STREAK === 0 && Q.clues < CLUE_MAX) {
    Q.clues++; saveRun(); toast(`💡 +1 clue! ${Q.streak} jawaban benar berturut-turut`);
    const btn = document.querySelector('[data-act="clue"]'); if (btn) { btn.disabled = !!(Q.cur && (Q.cur.clue || Q.cur.flipped)); btn.querySelector('b').textContent = Q.clues; fx(btn, 'fx-right'); }
  }
}
/* ---- deteksi asal tekan (dinilai server dari jeda antar jawaban) ---- */
function onRush(r) {
  if (!r || !r.rush || !Q) return;
  Q.rushCount = r.rush_count || (Q.rushCount || 0) + 1;
  Q.rushRecent = (Q.rushRecent || []).filter((t) => Date.now() - t < 30000).concat(Date.now());
  const el = $('#rushBanner');
  if (el) { el.hidden = false; el.innerHTML = `${ic('bolt')}<span>Terlalu cepat! Baca kartunya dulu, jangan asal tekan. (${Q.rushCount}× · gurumu bisa melihatnya)</span>`; fx(el, 'fx-wrong'); }
  try { if (navigator.vibrate) navigator.vibrate(80); } catch (_) { /* tidak didukung */ }
  if (Q.rushRecent.length >= 3) { Q.lockUntil = Date.now() + 3000; Q.rushRecent = []; lockCtrl(); }
}
function lockCtrl() {
  const ctrl = $('#ctrl'); if (!ctrl || !Q) return;
  const tick = () => {
    if (!Q || !$('#ctrl')) return;
    const left = Math.ceil((Q.lockUntil - Date.now()) / 1000);
    let o = $('#lockMask');
    if (left <= 0) { if (o) o.remove(); return; }
    if (!o) { o = document.createElement('div'); o.id = 'lockMask'; o.className = 'lock-mask'; $('#ctrl').appendChild(o); }
    o.innerHTML = `${ic('bolt')} Pelan-pelan dulu… ${left}`;
    setTimeout(tick, 250);
  };
  tick();
}
const locked = () => Q && Q.lockUntil && Date.now() < Q.lockUntil;

async function loadQuiz(c, m) {
  const cur = Q.cur;
  try {
    await Q.chain;
    const opts = await withRetry(() => api.quizOptions(Q.sid, c.id, m === 'mw' ? 'mw' : undefined));
    if (!Q || Q.cur !== cur) return;
    if (opts && opts.answered) { cur.answered = true; cur.sug = opts.correct ? 3 : 1; flip(true); return; } // sudah dijawab sebelum refresh
    const showArti = m === 'han';
    const optHTML = (o) => (m === 'mw' ? `<span class="z">${esc(o.w)}</span><span class="y">${esc(o.y)}</span>`
      : showArti ? `<span class="t">${esc(S.lang === 'en' ? o.en || o.m : S.lang === 'both' && o.en ? o.m + ' · ' + o.en : o.m)}</span>` : `<span class="z">${esc(o.h)}</span>${o.p ? `<span class="y">${esc(o.p)}</span>` : ''}`);
    $('#ctrl').innerHTML = `<div class="quiz ${m === 'mw' ? 'mw' : ''}">${opts.map((o) => `<button class="qo" data-t="${esc(o.t)}">${optHTML(o)}</button>`).join('')}</div>`;
  } catch (e) {
    if (!Q || Q.cur !== cur) return;
    cur.answered = true;
    $('#ctrl').innerHTML = `<p class="note" style="margin-top:12px">${esc(e.message)} Tebakan dilewati untuk kartu ini.</p><button class="btn lg flipbtn" data-act="flip">${ic('flip')} Balik kartu</button>`;
  }
}
async function answerQuiz(btn) {
  const cur = Q.cur; if (cur.answered || cur.busy) return;
  if (locked()) { lockCtrl(); return; }
  cur.busy = true;
  document.querySelectorAll('.qo').forEach((b) => { b.disabled = true; });
  let res;
  try { res = await withRetry(() => api.answerQuiz(Q.sid, cur.c.id, btn.dataset.t)); }
  catch (e) { toast(e.message); cur.answered = true; cur.busy = false; flip(true); return; }
  cur.answered = true; cur.busy = false; cur.quizOk = !!res.correct;
  onRush(res);
  document.querySelectorAll('.qo').forEach((b) => { if (b.dataset.t === res.correct_token) b.classList.add('right'); });
  const blank = document.querySelector('.mwq .blank'); if (blank) { blank.textContent = cur.c.mw; blank.style.color = res.correct ? 'var(--good)' : 'var(--bad)'; }
  const tilt = $('#tilt');
  badgeFx(res.correct);
  gainStreak(res.correct);
  if (res.correct) {
    SFX.right(); fx(tilt, 'fx-right'); tilt.classList.add('glow-good'); cur.sug = 3;
    if (Q.streak % 5 === 0) { burst(28); toast(`${Q.streak} jawaban benar berturut-turut!`); }
  } else {
    btn.classList.add('wrong'); SFX.wrong(); fx(tilt, 'fx-wrong'); tilt.classList.add('glow-bad'); cur.sug = 1;
    try { if (navigator.vibrate) navigator.vibrate(120); } catch (_) { /* tidak didukung */ }
  }
  setTimeout(() => { if (Q && Q.cur === cur) { tilt.classList.remove('glow-good', 'glow-bad'); flip(true); } }, res.correct ? 600 : 1050);
}
function flip(force) {
  const cur = Q && Q.cur; if (!cur || !$('#fc')) return;
  if (!cur.answered && force !== true) return;
  cur.flipped = force === true ? true : !cur.flipped;
  $('#fc').classList.toggle('flip', cur.flipped); SFX.flip();
  { const cb = document.querySelector('[data-act="clue"]'); if (cb) cb.disabled = true; }
  if (cur.flipped) {
    if (S.auto) speak(sayText(cur.c));
    $('#ctrl').innerHTML = `<div class="rate">${[1, 2, 3, 4].map((n) => `<button class="rb r${n} ${cur.sug === n ? 'sug' : ''}" data-rate="${n}"><span class="k">${n}</span><span class="l">${RATE[n].l}</span><span class="w">${RATE[n].w}</span></button>`).join('')}</div>`;
  } else $('#ctrl').innerHTML = `<button class="btn lg flipbtn" data-act="flip">${ic('flip')} Balik kartu</button>`;
}
function rate(n) {
  const cur = Q && Q.cur; if (!cur) return; if (!cur.flipped) { flip(); return; }
  if (cur.rated) return;
  if (locked()) { lockCtrl(); return; }
  cur.rated = true;
  if (cur.quizOk === undefined) gainStreak(n >= 3); // tanpa tebakan: nilai 3–4 dihitung benar
  const ms = Math.max(0, performance.now() - cur.t0 - cur.hidden - (hiddenAt ? performance.now() - hiddenAt : 0));
  const c = Q.queue.shift(); const sid = Q.sid;
  const clue = !!cur.clue;
  Q.chain = Q.chain.then(() => withRetry(() => api.rateCard(sid, c.id, n, ms, clue))).then(onRush).catch(() => { Q.failed++; toast('Satu jawaban gagal tersimpan. Periksa koneksi.'); });
  if (n <= 2) { Q.queue.splice(Math.min(RATE[n].gap, Q.queue.length), 0, c); SRS[c.id] = { due: Date.now(), last: n }; }
  else { SRS[c.id] = { due: Date.now() + RATE[n].days * 864e5, last: n }; Q.done++; }
  saveRun();
  const btn = document.querySelector(`.rb[data-rate="${n}"]`); if (btn) btn.classList.add('press');
  const tilt = $('#tilt');
  ({ 1: () => { SFX.r1(); fx(tilt, 'fx-wrong'); }, 2: () => { SFX.r2(); fx(tilt, 'fx-lift'); }, 3: () => { SFX.r3(); fx(tilt, 'fx-right'); }, 4: () => { SFX.r4(); fx(tilt, 'fx-right'); burst(24); } })[n]();
  setTimeout(renderStudy, n === 1 ? 460 : 360);
}
/* ---- Isi rumpang (cloze) ---- */
const CLOZE = new Map();
const normPy = (t) => String(t || '').toLowerCase().replace(/[āáǎà]/g, 'a').replace(/[ēéěè]/g, 'e').replace(/[īíǐì]/g, 'i').replace(/[ōóǒò]/g, 'o').replace(/[ūúǔù]/g, 'u').replace(/[ǖǘǚǜ]/g, 'v').replace(/[^a-z0-9一-鿿]/g, '');
const pyToneless = (h) => { try { return pyPro(h, { toneType: 'none', type: 'array' }).join(''); } catch (_) { return ''; } };
function clozeSentence(s, answer) {
  const i = s.indexOf(answer);
  if (i < 0) return esc(s) + ' <span class="blankbox" id="blankBox">____</span>';
  return esc(s.slice(0, i)) + `<span class="blankbox" id="blankBox">____</span>` + esc(s.slice(i + answer.length));
}
async function setupCloze(c, d) {
  const cur = Q.cur;
  let data = CLOZE.get(c.id);
  if (!data) {
    try { const r = await api.cloze(c.id); data = { s: r.s, si: r.si, answer: r.answer || c.h }; CLOZE.set(c.id, data); }
    catch (e) { data = { s: '', si: mean(c), answer: c.h, fallback: true, err: e.message }; }
  }
  if (!Q || Q.cur !== cur) return;
  cur.cloze = data;
  const front = document.getElementById('clozeFront'); if (!front) return;
  const lowpy = !isTeacher() && (ME && ME.level || 0) <= 1;
  const sentHtml = data.s ? clozeSentence(data.s, data.answer) : `<span class="blankbox" id="blankBox">____</span>`;
  const py = (data.s && lowpy) ? `<div class="cloze-py">${[...data.s].map((ch) => data.answer.includes(ch) ? '' : `<i class="t${toneOf(ch)}">${esc(pyOf(ch))}</i>`).join(' ')}</div>` : '';
  front.innerHTML = `<div class="cloze-sent">${sentHtml}</div>${py}
    ${!data.fallback && data.si ? `<div class="cloze-mean">${esc(data.si)}</div>` : ''}
    ${data.fallback ? `<div class="q">Ketik kata Mandarin untuk: <b>${esc(mean(c))}</b></div>` : '<div class="q">Lengkapi kalimat di atas</div>'}`;
  const ctrl = document.getElementById('ctrl'); if (!ctrl) return;
  ctrl.innerHTML = `<div class="cloze-ctrl"><input id="clozeIn" type="text" autocomplete="off" autocapitalize="none" spellcheck="false" placeholder="ketik pinyin / hanzi…" aria-label="Jawaban">
      <button class="btn" data-clozecheck>${ic('check')} Periksa</button></div>
    <button class="btn ghost sm" data-clozemc style="margin-top:8px">${ic('list')} Lihat pilihan</button>
    <div class="cloze-mc" id="clozeMC" hidden></div>`;
  const inp = document.getElementById('clozeIn'); if (inp) inp.focus();
  if (inp) inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); checkCloze(inp.value); } });
}
function clozeOptions(c, d) {
  const pool = (d && d.cards || []).map((x) => x.h).filter((h) => h && h !== c.cloze.answer);
  const uniq = [...new Set(pool)];
  const sameLen = uniq.filter((h) => [...h].length === [...c.cloze.answer].length);
  const pick = shuffle(sameLen.length >= 3 ? sameLen : uniq).slice(0, 3);
  return shuffle([c.cloze.answer, ...pick]);
}
function showClozeMC() {
  const cur = Q && Q.cur; if (!cur || !cur.cloze) return;
  const box = document.getElementById('clozeMC'); if (!box) return;
  if (!box.hidden) { box.hidden = true; return; }
  const d = deckOf(cur.c.deck_id);
  box.innerHTML = clozeOptions(cur.c, d).map((o) => `<button class="qo" data-clozepick="${esc(o)}"><span class="z">${esc(o)}</span></button>`).join('');
  box.hidden = false;
}
function checkCloze(val) {
  const cur = Q && Q.cur; if (!cur || !cur.cloze || cur.answered) return;
  if (locked && locked()) { lockCtrl(); return; }
  const ans = cur.cloze.answer;
  const v = String(val || '').trim(); if (!v) return;
  const correct = normPy(v) === normPy(ans) || normPy(v) === normPy(pyToneless(ans)) || v === ans;
  revealCloze(correct);
}
function revealCloze(correct) {
  const cur = Q.cur; cur.answered = true; cur.quizOk = correct; cur.sug = correct ? 3 : 1;
  const blank = document.getElementById('blankBox'); if (blank) { blank.textContent = cur.cloze.answer; blank.classList.add(correct ? 'ok' : 'no'); }
  const inp = document.getElementById('clozeIn'); if (inp) inp.disabled = true;
  document.querySelectorAll('#clozeMC .qo').forEach((b) => { b.disabled = true; if (b.dataset.clozepick === cur.cloze.answer) b.classList.add('right'); });
  const tilt = $('#tilt');
  badgeFx(correct); gainStreak(correct);
  if (correct) { SFX.right(); fx(tilt, 'fx-right'); if (Q.streak % 5 === 0) { burst(24); toast(`${Q.streak} benar berturut-turut!`); } }
  else { SFX.wrong(); fx(tilt, 'fx-wrong'); try { if (navigator.vibrate) navigator.vibrate(120); } catch (_) { /* - */ } }
  // tampilkan arti kata + rating
  cur.flipped = true;
  const info = `<div class="cloze-reveal"><span class="han">${esc(cur.cloze.answer)}</span> <span class="rp">${esc(cur.c.p || pyOf(cur.cloze.answer))}</span> · ${esc(mean(cur.c))}${correct ? '' : ' <span class="pill bad">belum tepat</span>'}</div>`;
  $('#ctrl').innerHTML = info + `<div class="rate">${[1, 2, 3, 4].map((n) => `<button class="rb r${n} ${cur.sug === n ? 'sug' : ''}" data-rate="${n}"><span class="k">${n}</span><span class="l">${RATE[n].l}</span><span class="w">${RATE[n].w}</span></button>`).join('')}</div>`;
  if (S.auto) speak(cur.cloze.s || cur.c.h);
}
/* ---- Latihan ketik (type pinyin) ---- */
function setupType(c) {
  const ctrl = document.getElementById('ctrl'); if (!ctrl) return;
  ctrl.innerHTML = `<div class="cloze-ctrl"><input id="typeIn" type="text" autocomplete="off" autocapitalize="none" spellcheck="false" placeholder="ketik pinyin… (mis. ni hao)" aria-label="Pinyin">
      <button class="btn" data-typecheck>${ic('check')} Periksa</button></div>
    <p class="note" style="text-align:center;margin-top:8px">Nada boleh diabaikan — yang penting bacaannya benar.</p>`;
  const inp = document.getElementById('typeIn'); if (inp) { inp.focus(); inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); checkType(inp.value); } }); }
}
function checkType(val) {
  const cur = Q && Q.cur; if (!cur || cur.answered) return;
  if (locked && locked()) { lockCtrl(); return; }
  const v = String(val || '').trim(); if (!v) return;
  const c = cur.c;
  const targets = [normPy(c.p), normPy(pyToneless(c.h)), normPy(c.h)].filter(Boolean);
  const correct = targets.includes(normPy(v));
  revealType(correct);
}
function revealType(correct) {
  const cur = Q.cur; cur.answered = true; cur.quizOk = correct; cur.sug = correct ? 3 : 1; cur.flipped = true;
  const inp = document.getElementById('typeIn'); if (inp) inp.disabled = true;
  const tilt = $('#tilt');
  badgeFx(correct); gainStreak(correct);
  if (correct) { SFX.right(); fx(tilt, 'fx-right'); if (Q.streak % 5 === 0) { burst(24); toast(`${Q.streak} benar berturut-turut!`); } }
  else { SFX.wrong(); fx(tilt, 'fx-wrong'); try { if (navigator.vibrate) navigator.vibrate(120); } catch (_) { /* - */ } }
  const info = `<div class="cloze-reveal"><span class="han">${esc(cur.c.h)}</span> <span class="rp">${esc(cur.c.p || pyOf(cur.c.h))}</span> · ${esc(mean(cur.c))} ${correct ? '<span class="pill good">benar</span>' : '<span class="pill bad">belum tepat</span>'}</div>`;
  $('#ctrl').innerHTML = info + `<div class="rate">${[1, 2, 3, 4].map((n) => `<button class="rb r${n} ${cur.sug === n ? 'sug' : ''}" data-rate="${n}"><span class="k">${n}</span><span class="l">${RATE[n].l}</span><span class="w">${RATE[n].w}</span></button>`).join('')}</div>`;
  if (S.auto) speak(cur.c.h);
}
function bindTilt() {
  const tilt = $('#tilt'); if (!tilt || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  tilt.addEventListener('pointermove', (e) => {
    if (e.pointerType === 'touch') return;
    const r = tilt.getBoundingClientRect(), px = (e.clientX - r.left) / r.width - 0.5, py = (e.clientY - r.top) / r.height - 0.5;
    tilt.style.transition = 'none'; tilt.style.transform = `rotateX(${(-py * 5).toFixed(2)}deg) rotateY(${(px * 5).toFixed(2)}deg)`;
  });
  tilt.addEventListener('pointerleave', () => { tilt.style.transition = ''; tilt.style.transform = ''; });
}
async function renderDone(early) {
  if (early === true) Q.early = true;
  S.view = 'done'; stopBeat();
  $('#view').innerHTML = '<div class="study"><div class="panel done"><p class="note">Menyimpan hasil dan menghitung skor…</p></div></div>';
  await Q.chain;
  let s;
  try { s = await withRetry(() => api.finishSession(Q.sid, Q.early)); clearRun(); if (Q.part && !Q.early) markPart(Q.part.key, Q.part.idx); try { store.set('lastsess', { decks: Q.decks, kind: Q.kind, at: Date.now() }); } catch (_) { /* abaikan */ } }
  catch (e) { $('#view').innerHTML = `<div class="study"><div class="panel done"><h2 class="h2">Skor belum tersimpan</h2><p class="sub">${esc(e.message)}</p><button class="btn" data-act="retryfinish">Coba simpan lagi</button></div></div>`; return; }
  const pct = s.score ?? 0;
  if (pct >= 75) burst(48);
  const mins = Math.max(1, Math.round((s.seconds || 0) / 60));
  $('#view').innerHTML = `<div class="study"><div class="panel done">
    <div class="ring" style="--p:${pct}"><div>${pct}</div></div>
    <h2 class="h1"><span class="han">${pct >= 85 ? '太棒了！' : pct >= 60 ? '很好！' : '加油！'}</span> ${Q.early ? 'Sesi diakhiri' : 'Sesi selesai'}${Q.part ? ` · Sesi ${Q.part.idx + 1}/${Q.part.of}` : ''}</h2>
    <p class="sub">${s.total} kartu dalam ${mins} menit${s.quiz_total ? ` · tebakan benar ${s.quiz_right}/${s.quiz_total}` : ''}. Skor dihitung dari nilai pertama tiap kartu.</p>
    <div class="stats">${[1, 2, 3, 4].map((n) => `<div class="r${n}"><b>${s['c' + n]}</b>${RATE[n].l}</div>`).join('')}</div>
    ${s.rush ? `<span class="pill warn"><span class="d"></span>Asal tekan ${s.rush}× · ${s.clues || 0} clue dipakai</span>` : s.clues ? `<span class="pill mute">${s.clues} clue dipakai</span>` : ''}
    ${s.away_count ? `<span class="pill bad"><span class="d"></span>Keluar aplikasi ${s.away_count}× · ${dur(s.away_ms)}</span>` : '<span class="pill good"><span class="d"></span>Fokus penuh, tidak pernah keluar aplikasi</span>'}
    <span class="ok-line">${ic('check')} Skor tersimpan dan bisa dilihat gurumu</span>
    ${Q.failed ? `<p class="note">${Q.failed} jawaban gagal tersimpan karena koneksi.</p>` : ''}
    <div class="row" style="justify-content:center">${Q.part && !Q.early && Q.part.idx + 1 < Q.part.of && S.split.on && partKey() === Q.part.key
      ? `<button class="btn secondary" data-act="quit">Pilih kategori lain</button><button class="btn" data-act="nextpart">${ic('play')} Lanjut sesi ${Q.part.idx + 2}</button>`
      : `<button class="btn secondary" data-act="again">${ic('play')} Ulangi</button><button class="btn" data-act="quit">Pilih kategori lain</button>`}</div>
  </div></div>`;
}

/* ================= layar penuh: pesan guru & kiriman ================= */
const OVQ = []; let ovOpen = false;
function showOverlay(o) { OVQ.push(o); if (!ovOpen) nextOverlay(); }
function nextOverlay() {
  const o = OVQ.shift(); if (!o) { ovOpen = false; return; }
  ovOpen = true;
  const el = document.createElement('div'); el.className = 'overlay ' + (o.cls || ''); el.id = 'overlay';
  el.setAttribute('role', 'alertdialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-labelledby', 'ovTitle');
  el.innerHTML = `<div class="box"><div class="big-ic">${ic(o.icon || 'chat')}</div><h2 id="ovTitle">${esc(o.title)}</h2>${o.from ? `<div class="from">${esc(o.from)}</div>` : ''}${o.body || ''}
    <div class="row">${(o.buttons || [['ok', 'Mengerti']]).map(([k, l], i, a) => `<button class="btn ${i < a.length - 1 ? 'secondary' : ''} lg" data-ov="${k}">${esc(l)}</button>`).join('')}</div></div>`;
  document.body.appendChild(el);
  const btns = [...el.querySelectorAll('[data-ov]')];
  // pesan guru wajib dibaca: tombol baru aktif setelah jeda
  const until = Date.now() + (o.delay || 0);
  if (o.delay) {
    const labels = btns.map((b) => b.textContent);
    const tick = () => {
      const left = Math.ceil((until - Date.now()) / 1000);
      btns.forEach((b, i) => { b.disabled = left > 0; b.textContent = left > 0 ? `${labels[i]} (${left})` : labels[i]; });
      if (left > 0) setTimeout(tick, 200); else btns[btns.length - 1].focus();
    };
    tick();
  } else btns[btns.length - 1].focus();
  el.addEventListener('click', (e) => {
    const b = e.target.closest('[data-ov]'); if (!b || b.disabled || Date.now() < until) return;
    el.remove(); try { if (o.onClose) o.onClose(b.dataset.ov); } catch (_) { /* abaikan */ }
    setTimeout(nextOverlay, 150);
  });
}
let inboxT = 0, inboxBusy = false;
async function pollInbox() {
  if (!ME || isTeacher() || document.hidden || inboxBusy) return;
  inboxBusy = true;
  try {
    const r = await api.inbox();
    const mIds = r.messages.map((m) => m.id), dIds = r.deliveries.map((d) => d.id);
    if (mIds.length || dIds.length) await api.inboxSeen(mIds, dIds);
    for (const m of r.messages) {
      const warn = m.kind === 'warn';
      if (warn) { SFX.wrong(); try { if (navigator.vibrate) navigator.vibrate([200, 100, 200]); } catch (_) { /* tidak didukung */ } } else SFX.flip();
      showOverlay({ cls: warn ? 'warn' : '', icon: warn ? 'alert' : 'chat', title: warn ? 'Peringatan dari guru' : 'Pesan dari guru', from: fmtDate(m.created_at, { timeStyle: 'short' }), body: `<p class="msg">${esc(m.text)}</p>`, buttons: [['ok', warn ? 'Mengerti, aku fokus' : 'Oke']], delay: 2000 });
    }
    if (r.deliveries.length) {
      await reloadContent().catch(() => {});
      if (S.view === 'learn') renderLearn();
      const ids = r.deliveries.map((d) => d.deck_id);
      SFX.r4(); burst(30);
      const studying = S.view === 'study';
      showOverlay({ cls: 'gift', icon: 'gift', title: r.deliveries.length > 1 ? `${r.deliveries.length} kategori baru untukmu!` : `Kartu baru dari ${r.deliveries[0].from_name || 'guru'}!`,
        body: `<div>${r.deliveries.map((d) => `<div class="deckchip" style="border-left:5px solid ${/^#[0-9a-f]{6}$/i.test(d.color) ? d.color : '#1f3fbf'}"><span class="han">${esc(d.zh)}</span><span>${esc(d.idn)} · ${d.n} kartu${d.from_name ? ' · dari ' + esc(d.from_name) : ''}</span></div>`).join('')}</div>
          <p class="note" style="margin-bottom:18px">Sudah ada di daftar kategorimu, paling atas dengan tanda <b>Pribadi</b>.</p>`,
        buttons: studying ? [['ok', 'Oke, nanti']] : [['later', 'Nanti'], ['go', 'Belajar sekarang']],
        onClose: (k) => { if (k === 'go' && S.view !== 'study') { S.sel = ids.filter((id) => deckOf(id)); S.kind = 'card'; S.split.on = false; S.all = true; savePrefs(); S.view = 'learn'; shell(); renderLearn(); startStudy(); } } });
    }
  } catch (e) { if (e.status === 401) { ME = null; renderLogin('Silakan masuk lagi.'); } }
  inboxBusy = false;
}
function startInbox() { clearInterval(inboxT); if (ME && !isTeacher()) { inboxT = setInterval(pollInbox, 8000); pollInbox(); } }

/* ================= Progres ================= */
// level kartu dari nilai terakhir: baru · dipelajari (1–2) · bisa (3) · dikuasai (4)
const LV = [['m4', 'Dikuasai', 'var(--good)'], ['m3', 'Bisa', '#2fa3d6'], ['m12', 'Masih belajar', '#e0b51b'], ['n0', 'Belum dipelajari', 'var(--line-2)']];
function pbar(c, total) {
  const t = Math.max(1, total);
  return `<div class="pbar" role="img" aria-label="${LV.map(([k, l]) => `${l} ${c[k] || 0}`).join(', ')}">${LV.map(([k, l, col]) => (c[k] ? `<i style="width:${(c[k] / t) * 100}%;background:${col}" title="${l}: ${c[k]}"></i>` : '')).join('')}</div>`;
}
const pct = (c, total) => (total ? Math.round(((c.m4 || 0) + (c.m3 || 0)) / total * 100) : 0);
const legend = () => `<div class="plegend">${LV.map(([, l, col]) => `<span><i style="background:${col}"></i>${l}</span>`).join('')}</div>`;
function myProgress() {
  const ds = studyDecks(); const rows = ds.map((d) => {
    const c = { m4: 0, m3: 0, m12: 0, n0: 0 };
    for (const k of d.cards) { const r = SRS[k.id]; if (!r) c.n0++; else if (r.last >= 4) c.m4++; else if (r.last === 3) c.m3++; else c.m12++; }
    return { d, c, total: d.cards.length };
  });
  const tot = rows.reduce((a, r) => { for (const k of ['m4', 'm3', 'm12', 'n0']) a[k] += r.c[k]; a.total += r.total; return a; }, { m4: 0, m3: 0, m12: 0, n0: 0, total: 0 });
  const started = rows.filter((r) => r.c.n0 < r.total).sort((a, b) => pct(b.c, b.total) - pct(a.c, a.total));
  const fresh = rows.filter((r) => r.c.n0 === r.total);
  return `<div class="panel"><div class="panel-head"><h2 class="h3">${ic('flag')} Sudah sampai mana?</h2><b class="bigpct">${pct(tot, tot.total)}%</b></div>
    <p class="sub" style="margin:-6px 0 10px">${tot.m4 + tot.m3} dari ${tot.total} kartu sudah kamu bisa · ${tot.m12} masih dipelajari · ${tot.n0} belum dibuka</p>
    ${pbar(tot, tot.total)}${legend()}
    <div class="prows">${started.map((r) => `<div class="prow" style="--dc:${r.d.color}"><div class="pname"><span class="dotc"></span><span class="han">${esc(r.d.zh)}</span><span class="note">${esc(r.d.idn)}</span></div>${pbar(r.c, r.total)}<b>${pct(r.c, r.total)}%</b></div>`).join('') || '<p class="note">Belum ada kategori yang dimulai.</p>'}
    ${fresh.length ? `<p class="note" style="margin-top:6px">Belum dimulai: <span class="han">${fresh.map((r) => esc(r.d.zh)).join('、')}</span></p>` : ''}</div></div>`;
}

/* ================= kirim kartu ke orang lain ================= */
let MATES = null;
async function openSendSheet(deckId) {
  const mine = isTeacher() ? DECKS.filter((d) => d.cards.length) : DECKS.filter((d) => d.mine && d.cards.length);
  if (!mine.length) { toast(isTeacher() ? 'Belum ada kategori yang berisi kartu.' : 'Buat kategori sendiri dulu lewat tombol Custom, lalu kirim ke temanmu.'); return; }
  try { if (isTeacher()) { if (!STUDENTS.length) STUDENTS = await api.students(); } else if (!MATES) MATES = await api.classmates(); } catch (e) { toast(e.message); return; }
  const sel = deckId && mine.some((d) => d.id === deckId) ? deckId : (S.sel.find((id) => mine.some((d) => d.id === id)) || mine[0].id);
  const people = isTeacher() ? STUDENTS.filter((x) => x.active) : MATES;
  PICK.mode = isTeacher() ? PICK.mode : 'pick'; PICK.ids = [];
  const el = document.createElement('div'); el.className = 'overlay sheet'; el.id = 'sendSheet'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true');
  el.innerHTML = `<form class="box" novalidate style="text-align:left">
    <div class="row" style="justify-content:space-between;margin-bottom:12px"><h2 style="margin:0">${ic('send')} Kirim kartu</h2><button type="button" class="icon-btn" data-close="1" aria-label="Tutup">${ic('x')}</button></div>
    <label class="field" for="ssDeck">Kategori yang dikirim<select id="ssDeck">${mine.map((d) => `<option value="${esc(d.id)}" ${d.id === sel ? 'selected' : ''}>${esc(d.zh)} · ${esc(d.idn)} (${d.cards.length} kartu)</option>`).join('')}</select></label>
    ${isTeacher() ? `<div style="margin-top:12px">${toHTML('s')}</div>` : `<div class="field" style="margin-top:12px">Kirim ke teman<input id="ssFind" placeholder="Cari nama…" autocomplete="off"></div>
      <div class="stu-picks" id="sPicks" style="margin-top:8px">${people.map((x) => `<button type="button" class="chip" data-pickstu="${esc(x.id)}" data-nm="${esc((x.display_name + ' ' + (x.class_name || '')).toLowerCase())}" aria-pressed="false">${esc(x.display_name)}${x.class_name ? ` <span class="note">${esc(x.class_name)}</span>` : ''}</button>`).join('') || '<span class="note">Belum ada teman lain.</span>'}</div>`}
    <p class="note" id="ssNote" style="margin:12px 0">${isTeacher() ? 'Kartu langsung muncul memenuhi layar murid dan masuk ke daftar Pribadi mereka.' : 'Temanmu langsung mendapat pemberitahuan dan kategori ini masuk ke daftar Pribadi mereka. Mereka hanya bisa memakai, tidak bisa mengubah.'}</p>
    <div class="row" style="justify-content:flex-end"><button type="button" class="btn secondary" data-close="1">Batal</button><button class="btn" type="submit">${ic('send')} Kirim</button></div>
  </form>`;
  document.body.appendChild(el);
  if (isTeacher()) bindTo('s');
  const find = el.querySelector('#ssFind');
  if (find) find.addEventListener('input', () => { const q = find.value.trim().toLowerCase(); el.querySelectorAll('[data-nm]').forEach((b) => { b.hidden = q && !b.dataset.nm.includes(q); }); });
  el.addEventListener('click', (e) => { if (e.target === el || e.target.closest('[data-close]')) el.remove(); });
  el.querySelector('form').addEventListener('submit', async (e) => {
    e.preventDefault(); const n = el.querySelector('#ssNote'), btn = el.querySelector('button[type=submit]');
    let to; try { to = readTo(); } catch (err) { n.textContent = err.message; n.style.color = 'var(--bad)'; return; }
    btn.disabled = true;
    try {
      const deck = el.querySelector('#ssDeck').value;
      const r = isTeacher() ? await api.deliver(deck, to) : await api.deliverMine(deck, to);
      el.remove(); burst(24); toast(`Terkirim ke ${r.sent} ${isTeacher() ? 'murid' : 'teman'}.`);
    } catch (err) { n.textContent = err.message; n.style.color = 'var(--bad)'; btn.disabled = false; }
  });
}

/* ================= AI Laoshi (tanya-jawab) ================= */
const MONKEY = `<svg viewBox="0 0 48 48" class="monkey" aria-hidden="true">
<circle cx="10" cy="19" r="6.5" fill="#8b5e3c"/><circle cx="10" cy="19" r="3.2" fill="#d2a06f"/>
<circle cx="38" cy="19" r="6.5" fill="#8b5e3c"/><circle cx="38" cy="19" r="3.2" fill="#d2a06f"/>
<path d="M24 6c9.5 0 15.5 6.5 15.5 15.5S33.5 38 24 38 8.5 30.5 8.5 21.5 14.5 6 24 6z" fill="#8b5e3c"/>
<path d="M24 15.5c6.3 0 10.5 4.2 10.5 9.3S30.3 34 24 34s-10.5-4.1-10.5-9.2S17.7 15.5 24 15.5z" fill="#ead3b5"/>
<ellipse cx="18.3" cy="20.5" rx="4.6" ry="5.2" fill="#fff"/><ellipse cx="29.7" cy="20.5" rx="4.6" ry="5.2" fill="#fff"/>
<circle cx="18.9" cy="21.4" r="2.3" fill="#2f2015"/><circle cx="29.1" cy="21.4" r="2.3" fill="#2f2015"/>
<circle cx="19.7" cy="20.6" r=".7" fill="#fff"/><circle cx="29.9" cy="20.6" r=".7" fill="#fff"/>
<ellipse cx="24" cy="27.5" rx="6.2" ry="4.6" fill="#dcb088"/>
<ellipse cx="21.6" cy="27.3" rx="1" ry="1.5" fill="#5a3a22"/><ellipse cx="26.4" cy="27.3" rx="1" ry="1.5" fill="#5a3a22"/>
<path d="M20.8 31.2c1.7 1.5 4.7 1.5 6.4 0" stroke="#5a3a22" stroke-width="1.5" fill="none" stroke-linecap="round"/></svg>`;
const monkey = () => `<span class="mk">${MONKEY}</span>`;
// efek ngetik: ungkap teks bertahap lalu render rapi
function typeInto(el, text, done) {
  if (!el) { done && done(); return; }
  const scroller = el.closest('.ai-msgs');
  let i = 0; el.classList.add('typing-on');
  const step = () => {
    if (!document.body.contains(el)) return;
    i = Math.min(text.length, i + 3);
    el.innerHTML = esc(text.slice(0, i)).replace(/\n/g, '<br>') + '<span class="cur"></span>';
    if (scroller) scroller.scrollTop = scroller.scrollHeight;
    if (i < text.length) setTimeout(step, 12);
    else { el.innerHTML = aiMd(text); el.classList.remove('typing-on'); if (scroller) scroller.scrollTop = scroller.scrollHeight; done && done(); }
  };
  step();
}
let AICHAT = [];
let aiBusy = false;
const AI_TIPS = [
  'Apa arti dan contoh kalimat 把?',
  'Apa beda 会, 能, dan 可以?',
  'Kapan pakai 了? Beri contoh.',
  'Buatkan 3 contoh kalimat dengan 虽然…但是…',
  'Apa beda 二 dan 两?',
];
function aiMd(t) {
  let h = esc(t);
  h = h.replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>');
  h = h.replace(/^###?\s*(.+)$/gm, '<b>$1</b>');
  const lines = h.split(/\r?\n/).map((l) => {
    const m = /^\s*[-*•]\s+(.*)$/.exec(l);
    if (m) return '<li>' + m[1] + '</li>';
    return l;
  });
  let out = '', inList = false;
  for (const l of lines) {
    if (l.startsWith('<li>')) { if (!inList) { out += '<ul>'; inList = true; } out += l; }
    else { if (inList) { out += '</ul>'; inList = false; } out += (l.trim() ? '<p>' + l + '</p>' : ''); }
  }
  if (inList) out += '</ul>';
  return out || '<p></p>';
}
function aiRender() {
  const box = $('#aiMsgs'); if (!box) return;
  if (!AICHAT.length) {
    box.innerHTML = `<div class="ai-intro"><div class="ai-ava big">${monkey()}</div>
      <h2 class="h2">Halo! Aku ${esc(aiName())} 👋</h2>
      <p class="sub">Tanya apa saja tentang bahasa Mandarin — arti kata, contoh kalimat, cara pakai, atau perbedaan dua kata. Aku jawab dalam Bahasa Indonesia.</p>
      <div class="ai-tips">${AI_TIPS.map((t) => `<button class="chip" data-aitip="${esc(t)}">${esc(t)}</button>`).join('')}</div></div>`;
    return;
  }
  box.innerHTML = AICHAT.map((m) => m.role === 'user'
    ? `<div class="ai-msg me"><div class="bub">${esc(m.content).replace(/\n/g, '<br>')}</div></div>`
    : `<div class="ai-msg ai"><div class="ava">${monkey()}</div><div class="bub">${m.pending ? '<span class="typing"><i></i><i></i><i></i></span>' : m.anim ? '' : aiMd(m.content)}</div></div>`).join('');
  box.scrollTop = box.scrollHeight;
}
async function aiSend(text) {
  text = (text || '').trim(); if (!text || aiBusy) return;
  if (text.length > 600) text = text.slice(0, 600);
  aiBusy = true;
  AICHAT.push({ role: 'user', content: text });
  AICHAT.push({ role: 'assistant', content: '', pending: true });
  aiRender();
  const ta = $('#aiInput'); if (ta) { ta.value = ''; ta.style.height = 'auto'; }
  const btn = $('#aiSend'); if (btn) btn.disabled = true;
  try {
    const hist = AICHAT.filter((m) => !m.pending).map((m) => ({ role: m.role, content: m.content }));
    const r = await api.aiAsk(hist);
    AICHAT = AICHAT.filter((m) => !m.pending);
    const msg = { role: 'assistant', content: r.reply || '(kosong)', anim: true }; AICHAT.push(msg);
    aiRender(); typeInto(document.querySelector('#aiMsgs .ai-msg.ai:last-child .bub'), msg.content, () => { msg.anim = false; });
  } catch (e) {
    AICHAT = AICHAT.filter((m) => !m.pending);
    AICHAT.push({ role: 'assistant', content: 'Maaf, ' + (e.message || 'ada gangguan') + ' 🙏' });
    aiRender();
  }
  aiBusy = false; if (btn) btn.disabled = false;
}
/* ---- chat kecil "Tanya Laoshi" saat belajar ---- */
let SHEET = { ctx: '', msgs: [], busy: false, first: true };
function aiSheetRender() {
  const box = document.getElementById('shMsgs'); if (!box) return;
  const quick = SHEET.msgs.length ? '' : `<div class="sh-tips">${['Beri 2 contoh kalimat', 'Kapan dan bagaimana dipakai?', 'Kata yang mirip atau lawannya?', 'Jelaskan karakternya'].map((q) => `<button class="chip" data-sheetq="${esc(q)}">${esc(q)}</button>`).join('')}</div>`;
  box.innerHTML = SHEET.msgs.map((m) => m.role === 'user'
    ? `<div class="ai-msg me"><div class="bub">${esc(m.content).replace(/\n/g, '<br>')}</div></div>`
    : `<div class="ai-msg ai"><div class="ava">${monkey()}</div><div class="bub">${m.pending ? '<span class="typing"><i></i><i></i><i></i></span>' : m.anim ? '' : aiMd(m.content)}</div></div>`).join('') + quick;
  box.scrollTop = box.scrollHeight;
}
function openAiSheet(c) {
  SHEET = { ctx: `Pertanyaan ini tentang kata yang sedang dipelajari murid: ${c.h}${c.p ? ' (' + c.p + ')' : ''}${c.m ? ' = ' + c.m : ''}. Jawab singkat.`, msgs: [], busy: false, first: true };
  closeAiSheet();
  const el = document.createElement('div'); el.className = 'overlay sheet ai-sheet'; el.id = 'aiSheet'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true');
  el.innerHTML = `<div class="box">
    <div class="sh-head"><div class="row" style="gap:8px;align-items:center"><span class="sh-ava">${monkey()}</span><div><b>Tanya ${esc(aiName())}</b><div class="note">tentang <span class="han">${esc(c.h)}</span> ${c.p ? '· ' + esc(c.p) : ''} ${c.m ? '· ' + esc(c.m) : ''}</div></div></div><button class="icon-btn" data-act="closeai" aria-label="Tutup">${ic('x')}</button></div>
    <div id="shMsgs" class="ai-msgs sh-msgs"></div>
    <form id="shForm" class="ai-bar"><textarea id="shInput" rows="1" maxlength="600" placeholder="Tanya soal kata ini…"></textarea><button class="btn" type="submit" aria-label="Kirim">${ic('send')}</button></form></div>`;
  document.body.appendChild(el);
  aiSheetRender();
  el.addEventListener('click', (e) => { if (e.target === el) closeAiSheet(); });
  const ta = document.getElementById('shInput');
  ta.addEventListener('input', () => { ta.style.height = 'auto'; ta.style.height = Math.min(ta.scrollHeight, 120) + 'px'; });
  ta.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); aiSheetSend(ta.value); } });
  document.getElementById('shForm').addEventListener('submit', (e) => { e.preventDefault(); aiSheetSend(ta.value); });
}
function closeAiSheet() { const el = document.getElementById('aiSheet'); if (el) el.remove(); }
async function aiSheetSend(text) {
  text = (text || '').trim(); if (!text || SHEET.busy) return;
  SHEET.busy = true;
  SHEET.msgs.push({ role: 'user', content: text.slice(0, 600) });
  SHEET.msgs.push({ role: 'assistant', content: '', pending: true });
  aiSheetRender();
  const ta = document.getElementById('shInput'); if (ta) { ta.value = ''; ta.style.height = 'auto'; }
  try {
    const hist = SHEET.msgs.filter((m) => !m.pending).map((m, i) => ({ role: m.role, content: i === 0 ? SHEET.ctx + '\n' + m.content : m.content }));
    const r = await api.aiAsk(hist);
    SHEET.msgs = SHEET.msgs.filter((m) => !m.pending); const msg = { role: 'assistant', content: r.reply || '(kosong)', anim: true }; SHEET.msgs.push(msg);
    SHEET.busy = false; aiSheetRender(); typeInto(document.querySelector('#shMsgs .ai-msg.ai:last-child .bub'), msg.content, () => { msg.anim = false; }); return;
  } catch (e) {
    SHEET.msgs = SHEET.msgs.filter((m) => !m.pending); SHEET.msgs.push({ role: 'assistant', content: 'Maaf, ' + (e.message || 'ada gangguan') + ' 🙏' });
  }
  SHEET.busy = false; aiSheetRender();
}
function renderAI() {
  $('#actionbar').hidden = true; document.documentElement.style.setProperty('--c', 'var(--brand)');
  $('#view').innerHTML = `<div class="ai-wrap">
    <div class="page-head" style="margin-bottom:10px"><div><p class="eyebrow">Tanya-jawab Mandarin</p><h1 class="h1">AI ${esc(aiName())}</h1></div>${AICHAT.length ? `<button class="chip" data-act="ainew">${ic('plus')} Obrolan baru</button>` : ''}</div>
    <div id="aiMsgs" class="ai-msgs"></div>
    <form id="aiForm" class="ai-bar"><textarea id="aiInput" rows="1" maxlength="600" placeholder="Tulis pertanyaanmu…" ${aiBusy ? 'disabled' : ''}></textarea>
      <button id="aiSend" class="btn" type="submit" aria-label="Kirim" ${aiBusy ? 'disabled' : ''}>${ic('send')}</button></form>
    <p class="note" style="text-align:center;margin-top:8px">AI bisa keliru — untuk soal penting, pastikan ke gurumu.</p></div>`;
  aiRender();
  const ta = $('#aiInput');
  ta.addEventListener('input', () => { ta.style.height = 'auto'; ta.style.height = Math.min(ta.scrollHeight, 140) + 'px'; });
  ta.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); aiSend(ta.value); } });
  $('#aiForm').addEventListener('submit', (e) => { e.preventDefault(); aiSend(ta.value); });
  if (!aiBusy) ta.focus();
}

/* ================= Sosial (feed flashcard) ================= */
let FEED = null, feedUser = null;
const sampleHTML = (arr) => (arr && arr.length ? `<div class="post-samp">${arr.map((h) => `<span class="han">${esc(h)}</span>`).join('')}</div>` : '');
function postCard(p, showAuthor) {
  const pend = p.status && p.status !== 'public';
  return `<article class="post" style="--pc:${p.color}">
    ${showAuthor ? `<button class="post-top" data-profile="${esc(p.owner_id)}">${avaHTML(p.author, p.author_photo, 'sm')}<b>${esc(p.author)}</b>${p.mine ? '<span class="post-me">kamu</span>' : ''}</button>` : ''}
    <div class="post-body">
      <div class="post-deck han">${esc(p.zh)}</div>
      ${p.idn ? `<div class="post-sub">${esc(p.idn)}</div>` : ''}
      ${sampleHTML(p.sample)}
      <div class="post-foot">
        <span class="post-n">${p.n} kartu</span>
        ${pend ? `<span class="pill warn" style="margin-left:auto"><span class="d"></span>${p.status === 'pending' ? 'Menunggu guru' : 'Pribadi'}</span>`
          : `<button class="likebtn ${p.liked ? 'on' : ''}" data-like="${esc(p.id)}" aria-pressed="${!!p.liked}" aria-label="Suka">${ic('heart')}<b>${p.likes || 0}</b></button>
             <button class="btn sm" data-studypost="${esc(p.id)}">${ic('play')} Belajar</button>`}
      </div>
    </div>
  </article>`;
}
async function renderFeed() {
  feedUser = null;
  $('#actionbar').hidden = true; document.documentElement.style.setProperty('--c', 'var(--brand)');
  const head = `<div class="page-head"><div><p class="eyebrow">Sosial</p><h1 class="h1">Beranda flashcard</h1><p class="sub">Postingan kartu dari teman-teman sekelas.</p></div>
    ${isTeacher() ? '' : `<button class="chip" data-profile="${esc(ME.id)}">${ic('social')} Profilku</button>`}</div>`;
  $('#view').innerHTML = head + '<div class="panel"><p class="note">Memuat beranda…</p></div>';
  try { FEED = await api.feed(); } catch (e) { toast(e.message); FEED = FEED || []; }
  if (S.view !== 'social' || feedUser) return;
  const canPost = !isTeacher() && canCreate();
  const tip = canPost
    ? 'Mau memposting? Buat kartu di menu <b>Kartu saya</b>, lalu jadikan <b>publik</b>. Postingan tampil di sini setelah disetujui guru.'
    : 'Postingan muncul dari kartu murid yang sudah disetujui guru.';
  $('#view').innerHTML = head
    + (FEED.length ? `<div class="feed">${FEED.map((p) => postCard(p, true)).join('')}</div>`
      : `<div class="panel empty"><b>Belum ada postingan</b>${tip}</div>`)
    + (FEED.length ? `<p class="note" style="text-align:center;margin:14px 0 4px">${tip}</p>` : '')
    + `<p class="ver">Versi ${APP_VERSION}</p>`;
}
async function renderProfile(id) {
  feedUser = id; S.view = 'social';
  $('#actionbar').hidden = true; window.scrollTo(0, 0);
  $('#view').innerHTML = '<div class="panel"><p class="note">Memuat profil…</p></div>';
  let u;
  try { u = await api.userProfile(id); } catch (e) { toast(e.message); return renderFeed(); }
  if (S.view !== 'social' || feedUser !== id) return;
  $('#view').innerHTML = `<div class="prof-head"><button class="btn ghost sm" data-backfeed>${ic('back')} Beranda</button></div>
    <div class="prof-card"><div class="avatar lg">${u.photo ? `<img src="${esc(u.photo)}" alt="">` : initial(u.name)}</div>
      <div class="prof-meta"><h1 class="h1">${esc(u.name)}${u.mine ? ' <span class="post-me">kamu</span>' : ''}</h1>
        <p class="sub">${esc(u.class_name || 'Tanpa kelas')}</p>
        <div class="prof-stats"><span><b>${u.total_posts}</b> postingan</span><span>${ic('heart')} <b>${u.total_likes}</b> suka</span></div></div></div>
    ${u.mine ? '<p class="note" style="margin:2px 0 12px">Postingan publik tampil untuk semua. Yang menunggu/pribadi hanya kamu dan guru yang lihat.</p>' : ''}
    ${u.posts.length ? `<div class="feed">${u.posts.map((p) => postCard({ ...p, owner_id: id }, false)).join('')}</div>`
      : `<div class="panel empty"><b>Belum ada postingan</b>${u.mine ? 'Buat kartu lalu jadikan publik untuk memposting.' : 'Murid ini belum punya postingan publik.'}</div>`}`;
}
async function studyPost(id) {
  let cs = CARDS.filter((c) => c.deck_id === id);
  if (!cs.length) { await reloadContent(); cs = CARDS.filter((c) => c.deck_id === id); }
  if (!cs.length) { toast('Kartu belum tersedia. Coba lagi sebentar.'); return; }
  S.view = 'study'; await startStudy(cs);
}
async function togglePin(cardId, btn) {
  const want = !PINS.has(cardId);
  if (want) PINS.add(cardId); else PINS.delete(cardId);
  if (btn) { btn.classList.toggle('on', want); btn.setAttribute('aria-pressed', want); if (want) fx(btn, 'fx-right'); }
  toast(want ? 'Kartu disematkan.' : 'Sematan dilepas.');
  try { await api.pin(cardId, want); } catch (e) { if (want) PINS.delete(cardId); else PINS.add(cardId); if (btn) { btn.classList.toggle('on', !want); btn.setAttribute('aria-pressed', !want); } toast(e.message); }
}
async function freezeDeck(id, freeze) {
  if (freeze) FRZ_DECKS.add(id); else FRZ_DECKS.delete(id);
  if (freeze) S.sel = S.sel.filter((x) => x !== id);
  savePrefs(); renderLearn();
  toast(freeze ? 'Kategori dibekukan. Pecahkan untuk memakainya lagi.' : 'Kategori dicairkan.');
  try { await api.freeze('deck', id, freeze); } catch (e) { if (freeze) FRZ_DECKS.delete(id); else FRZ_DECKS.add(id); toast(e.message); renderLearn(); }
}
async function freezeCard(id, freeze) {
  if (freeze) FRZ_CARDS.add(id); else FRZ_CARDS.delete(id);
  toast(freeze ? 'Kata dibekukan — tidak muncul lagi di belajar.' : 'Kata dicairkan.');
  try { await api.freeze('card', id, freeze); } catch (e) { if (freeze) FRZ_CARDS.delete(id); else FRZ_CARDS.add(id); toast(e.message); }
}
/* ================= Petunjuk pengguna baru ================= */
const GUIDE = [
  ['play', 'Pilih & belajar', 'Ketuk sebuah kategori untuk memilih, lalu <b>ketuk 2× cepat</b> untuk membuka tombol Mulai. Nilai 1–2 diulang, 3 muncul besok, 4 tiga hari lagi.'],
  ['speak', 'Percakapan harian', 'Buka kategori <b>Speaking</b> untuk melatih ungkapan sehari-hari lengkap dengan cara meresponnya. Tekan tombol suara untuk mendengar pengucapan.'],
  ['pin', 'Sematkan kartu', 'Saat belajar, ketuk <b>Sematkan</b> untuk menandai kartu sulit. Kartu tersematkan muncul di atas halaman Belajar untuk kamu ulang kapan saja.'],
  ['edit', 'Isi rumpang', 'Di halaman Belajar pilih mode <b>Isi rumpang</b>: lengkapi kalimat dengan kata yang tepat (ketik pinyin/hanzi atau pilih). Arti kalimat ada di depan, dan kalimat dibuat otomatis.'],
  ['book2', 'Cerita', 'Buka <b>Cerita</b> untuk membaca teks Mandarin. Ketuk kata mana pun untuk melihat arti & pinyin, dengar audionya, atau tambahkan ke kartumu.'],
  ['social', 'Sosial', 'Di tab <b>Sosial</b> kamu bisa melihat kartu buatan teman, menyukainya, dan membuka profil mereka. Kartumu bisa tampil setelah disetujui guru.'],
  ['laoshi', 'Tanya AI', 'Punya pertanyaan Mandarin? Buka tab AI atau tekan tombol AI saat belajar untuk minta contoh kalimat dan penjelasan perbedaan kata.'],
  ['hist', 'Riwayat', 'Lihat perkembanganmu dan lanjutkan kartu kemarin dari tab Riwayat dan halaman Belajar.'],
];
function openGuide() {
  if (document.getElementById('guideSheet')) return;
  const steps = GUIDE.map(([i, t, d]) => `<li><span class="g-ic">${ic(i)}</span><div><b>${t}</b><p>${d}</p></div></li>`).join('');
  const el = document.createElement('div'); el.id = 'guideSheet'; el.className = 'overlay sheet';
  el.innerHTML = `<div class="box guide-sheet" role="dialog" aria-modal="true" aria-label="Petunjuk">
    <div class="sh-head"><div><p class="eyebrow">Selamat datang 👋</p><b>Cara memakai aplikasi</b></div><button class="icon-btn" data-guideclose aria-label="Tutup">${ic('x')}</button></div>
    <ul class="guide-list">${steps}</ul>
    <button class="btn lg" data-guideclose>${ic('check')} Mengerti, mulai belajar</button></div>`;
  document.body.appendChild(el);
  el.addEventListener('click', (e) => { if (e.target === el || e.target.closest('[data-guideclose]')) closeGuide(); });
  if (ME) store.set('guide_' + ME.id, true);
}
function closeGuide() { const el = document.getElementById('guideSheet'); if (el) el.remove(); }
/* ================= Cerita ================= */
const STORY_LVL = { 1: 'Pemula', 2: 'HSK 2', 3: 'HSK 3', 4: 'HSK 4', 5: 'HSK 5', 6: 'HSK 6' };
const lvlName = (n) => STORY_LVL[n] || ('Level ' + n);
const STORY_COLORS = { 1: '#0ea5a4', 2: '#8b5cf6', 3: '#2f6df0', 4: '#e8513f', 5: '#f08a24', 6: '#db2777' };
function storyTile(s) {
  const col = STORY_COLORS[s.level] || '#1f3fbf';
  return `<button class="story-tile" data-story="${esc(s.id)}" style="--sc:${col}">
    <span class="story-lvl">${esc(lvlName(s.level))}</span>
    <span class="story-title han">${esc(s.title)}</span>
    <span class="story-meta">${ic('book2')} ${s.len} karakter${s.author ? ` · oleh ${esc(s.author)}` : ''}</span></button>`;
}
let LOWPY = false; // tampilkan pinyin ber-warna
async function openStory(id) {
  stopLive(); S.view = 'story'; shell(); window.scrollTo(0, 0);
  $('#actionbar').hidden = true;
  $('#view').innerHTML = '<div class="panel"><p class="note">Memuat cerita…</p></div>';
  let s; try { s = await api.story(id); } catch (e) { toast(e.message); return go('learn'); }
  if (S.view !== 'story') return;
  STORY = s; UNKNOWN = new Set();
  if (!isTeacher() && (ME.level || 0) <= 1) LOWPY = true; // pemula: pinyin otomatis nyala
  renderStory();
}
function sentencesOf(body) {
  const out = []; let cur = '';
  for (const ch of [...body]) { cur += ch; if ('。！？\n'.includes(ch)) { if (cur.trim()) out.push(cur.trim()); cur = ''; } }
  if (cur.trim()) out.push(cur.trim());
  return out;
}
let UNKNOWN = new Set();
function sentHTML(sent, si) {
  const toks = segHan(sent).map((tk) => {
    if (tk.t !== 'w') return `<span class="px">${esc(tk.s)}</span>`;
    const chars = [...tk.s];
    const ruby = LOWPY ? `<span class="rt">${chars.map((c) => `<i class="t${toneOf(c)}">${esc(pyOf(c))}</i>`).join('')}</span>` : '';
    return `<span class="w ${UNKNOWN.has(tk.s) ? 'unknown' : ''}" data-word="${esc(tk.s)}">${ruby}<span class="rb">${esc(tk.s)}</span></span>`;
  }).join('');
  return `<div class="sent" data-si="${si}"><div class="sent-h ${LOWPY ? 'withpy' : ''}">${toks}</div>
    <div class="sent-tools"><button class="icon-btn sm" data-saysent="${si}" aria-label="Dengar kalimat">${ic('sound')}</button><button class="icon-btn sm" data-trsent="${si}" aria-label="Terjemahkan">${ic('globe')}</button></div>
    <div class="sent-tr" id="tr${si}" hidden></div></div>`;
}
// glosa per kata (offline) — selalu tersedia walau AI mati
function glossOf(sent) {
  const parts = segHan(sent).filter((t) => t.t === 'w').map((t) => { const m = (LEX.get(t.s) || {}).m; return m ? `${t.s}=${m}` : ''; }).filter(Boolean);
  return parts.length ? parts.join(' · ') : '';
}
function renderStory() {
  const s = STORY; if (!s) return go('learn');
  const col = STORY_COLORS[s.level] || '#1f3fbf';
  document.documentElement.style.setProperty('--c', col);
  const sents = sentencesOf(s.body);
  $('#view').innerHTML = `<div class="reader" style="--sc:${col}">
    <div class="reader-top"><button class="btn ghost sm" data-backlearn>${ic('back')} Belajar</button>
      <button class="chip ${LOWPY ? 'on' : ''}" data-togpy aria-pressed="${LOWPY}">拼 Pinyin</button>
      <button class="chip" data-sayall>${ic('sound')} Dengar semua</button></div>
    ${UNKNOWN.size ? `<div class="unknown-bar">${ic('snow')} <b>${UNKNOWN.size}</b> kata ditandai belum tahu${canCreate() ? ` <button class="btn sm" data-addunknown>${ic('plus')} Masukkan ke deck…</button>` : ''}<button class="chip sm" data-clearunknown>${ic('x')} Bersihkan</button></div>` : ''}
    <div class="reader-head"><span class="story-lvl" style="--sc:${col}">${esc(lvlName(s.level))}</span><h1 class="h1 han">${esc(s.title)}</h1></div>
    <div class="reader-body">${sents.map(sentHTML).join('')}</div>
    <p class="note" style="text-align:center;margin-top:12px">Ketuk kata untuk arti, audio, tandai "belum tahu", atau tambah ke deck. Ikon 🌐 untuk terjemahan kalimat.</p>
  </div>`;
}
function openWordSheet(word) {
  closeWordSheet();
  const info = LEX.get(word) || {};
  const p = info.p || pyOf(word);
  const m = info.m || '';
  const unk = UNKNOWN.has(word);
  const el = document.createElement('div'); el.id = 'wordSheet'; el.className = 'overlay sheet';
  el.innerHTML = `<div class="box word-sheet" role="dialog" aria-modal="true">
    <div class="sh-head"><div><div class="word-h han">${esc(word)}</div><div class="word-p">${esc(p)}</div></div><button class="icon-btn" data-wordclose aria-label="Tutup">${ic('x')}</button></div>
    <div class="word-m" id="wordM">${m ? esc(m) : '<span class="note">Arti belum diketahui.</span>'}</div>
    <div class="word-acts"><button class="btn secondary sm" data-wordsay>${ic('sound')} Dengar</button>
      <button class="btn ${unk ? '' : 'secondary'} sm" data-wordunknown="${esc(word)}">${ic('snow')} ${unk ? 'Belum tahu ✓' : 'Tandai belum tahu'}</button>
      ${canCreate() ? `<button class="btn sm" data-wordadd="${esc(word)}">${ic('plus')} Tambah ke deck…</button>` : ''}</div></div>`;
  document.body.appendChild(el);
  el.addEventListener('click', (e) => {
    if (e.target === el || e.target.closest('[data-wordclose]')) { closeWordSheet(); return; }
    if (e.target.closest('[data-wordsay]')) speak(word);
    if (e.target.closest('[data-wordunknown]')) { toggleUnknown(word); closeWordSheet(); }
    if (e.target.closest('[data-wordadd]')) { closeWordSheet(); openDeckPicker([word]); }
  });
  if (!m && AI_ON && canCreate()) api.translate([word]).then((r) => { const it = (r.items || [])[0]; const mm = it && (it.m || it.idn || it.translation); if (mm) { const box = document.getElementById('wordM'); if (box) box.textContent = mm; LEX.set(word, { p, m: mm }); } }).catch(() => {});
}
function closeWordSheet() { const el = document.getElementById('wordSheet'); if (el) el.remove(); }
function reRenderReader() { if (S.view === 'story') renderStory(); else if (S.view === 'lesson') renderLesson(); }
function toggleUnknown(word) { if (UNKNOWN.has(word)) UNKNOWN.delete(word); else UNKNOWN.add(word); reRenderReader(); }
async function wordInfo(word) {
  const p = (LEX.get(word) || {}).p || pyOf(word);
  let m = (LEX.get(word) || {}).m || '';
  if (!m && AI_ON) { try { const r = await api.translate([word]); const it = (r.items || [])[0]; m = (it && (it.m || it.idn || it.translation)) || ''; } catch (_) { /* - */ } }
  return { h: word, p, m: m || p };
}
// pemilih deck untuk menambahkan kata
function openDeckPicker(words) {
  if (!canCreate()) { toast('Gurumu belum mengizinkan membuat kartu.'); return; }
  const owned = editableDecks();
  const el = document.createElement('div'); el.id = 'deckPicker'; el.className = 'overlay sheet';
  el.innerHTML = `<div class="box" role="dialog" aria-modal="true">
    <div class="sh-head"><b>Masukkan ${words.length} kata ke deck</b><button class="icon-btn" data-dpclose aria-label="Tutup">${ic('x')}</button></div>
    <div class="dp-list">
      ${owned.map((d) => `<button class="dp-item" data-pickdeck="${esc(d.id)}" style="--dc:${d.color}"><span class="dotc"></span><b>${esc(d.zh)}</b><small>${d.cards.length} kartu</small></button>`).join('')}
      <button class="dp-item new" data-pickdeck="__new">${ic('plus')} Buat deck baru "Dari cerita"</button>
    </div></div>`;
  document.body.appendChild(el);
  el.addEventListener('click', async (e) => {
    if (e.target === el || e.target.closest('[data-dpclose]')) { el.remove(); return; }
    const pk = e.target.closest('[data-pickdeck]'); if (!pk) return;
    el.remove(); await addWordsToDeck(pk.dataset.pickdeck, words);
  });
}
async function addWordsToDeck(deckId, words) {
  try {
    let deck;
    if (deckId === '__new') {
      deck = DECKS.find((d) => d.mine && d.zh === 'Dari cerita');
      if (!deck) { const r = await api.createDeck({ zh: 'Dari cerita', idn: 'Kata dari cerita', color: '#0ea5a4', public: false }); await reloadContent(); deck = DECKS.find((d) => d.id === r.id) || DECKS.find((d) => d.mine && d.zh === 'Dari cerita'); }
    } else deck = DECKS.find((d) => d.id === deckId);
    if (!deck) { toast('Deck tidak ditemukan.'); return; }
    toast('Menyiapkan kartu…');
    const have = new Set(deck.cards.map((c) => c.h));
    const fresh = words.filter((w) => !have.has(w));
    if (!fresh.length) { toast('Semua kata itu sudah ada di deck.'); return; }
    const cards = [];
    for (const w of fresh) cards.push(await wordInfo(w));
    await api.bulkCards(deck.id, cards);
    await reloadContent();
    for (const w of fresh) UNKNOWN.delete(w);
    toast(`${fresh.length} kata ditambahkan ke "${deck.zh}".`);
    reRenderReader();
  } catch (e) { toast(e.message); }
}
async function translateSent(si) {
  const box = document.getElementById('tr' + si); if (!box) return;
  if (!box.hidden) { box.hidden = true; return; }
  const sent = sentencesOf(STORY.body)[si]; if (!sent) return;
  box.hidden = false;
  if (AI_ON && canCreate()) {
    box.textContent = 'Menerjemahkan…';
    try { const r = await api.translate([sent]); const it = (r.items || [])[0]; const t = it && (it.m || it.idn || it.translation); if (t) { box.textContent = t; return; } } catch (_) { /* pakai glosa */ }
  }
  const g = glossOf(sent);
  box.innerHTML = g ? `<span class="gloss">${esc(g)}</span><span class="note" style="display:block;margin-top:4px">Arti per kata.</span>` : '<span class="note">Terjemahan belum tersedia.</span>';
}
/* ================= Materi (kursus) ================= */
let CURLESSON = null;
function lessonTile(l) {
  return `<button class="lesson-tile" data-lesson="${esc(l.id)}" style="--sc:${l.color || '#1f3fbf'}">
    <span class="lesson-emoji">${esc(l.emoji || '📚')}</span>
    <span class="lesson-meta"><b>${esc(l.title)}</b><small>${esc(l.subtitle || '')}</small></span></button>`;
}
function openLesson(id) {
  const l = LESSONS.lessons.find((x) => x.id === id); if (!l) return;
  stopLive(); CURLESSON = l; S.view = 'lesson'; UNKNOWN = new Set(); shell(); window.scrollTo(0, 0); $('#actionbar').hidden = true;
  if (!isTeacher() && (ME.level || 0) <= 1) LOWPY = true;
  renderLesson();
}
// baris hanzi yang bisa diketuk kata-katanya (+ pinyin ber-nada opsional)
function hanLine(zh) {
  return segHan(zh).map((tk) => {
    if (tk.t !== 'w') return `<span class="px">${esc(tk.s)}</span>`;
    const ruby = LOWPY ? `<span class="rt">${[...tk.s].map((c) => `<i class="t${toneOf(c)}">${esc(pyOf(c))}</i>`).join('')}</span>` : '';
    return `<span class="w ${UNKNOWN.has(tk.s) ? 'unknown' : ''}" data-word="${esc(tk.s)}">${ruby}<span class="rb">${esc(tk.s)}</span></span>`;
  }).join('');
}
function exampleHTML(ex, i) {
  return `<div class="lex-ex">
    <div class="lex-top"><div class="sent-h ${LOWPY ? 'withpy' : ''}">${hanLine(ex.zh)}</div><button class="icon-btn sm" data-saytext="${esc(ex.zh)}" aria-label="Dengar">${ic('sound')}</button></div>
    <div class="lex-id">${esc(ex.id || '')}</div>
    ${ex.note ? `<div class="lex-note">${esc(ex.note)}</div>` : ''}</div>`;
}
function radicalHTML(r) {
  return `<div class="rad-card">
    <div class="rad-top"><span class="rad-r han">${esc(r.r)}</span>${r.base && r.base !== r.r ? `<span class="rad-base">(${esc(r.base)})</span>` : ''}<button class="icon-btn sm" data-saytext="${esc(r.r)}" aria-label="Dengar">${ic('sound')}</button></div>
    <div class="rad-m">${esc(r.m)}</div>
    <div class="rad-ex">${(r.ex || '').split(/\s+/).filter(Boolean).map((c) => `<span class="w" data-word="${esc(c)}"><span class="rb">${esc(c)}</span></span>`).join('')}</div></div>`;
}
function sectionHTML(sec) {
  let inner = sec.body ? `<p class="lex-body">${esc(sec.body)}</p>` : '';
  if (sec.examples) inner += `<div class="lex-exs">${sec.examples.map(exampleHTML).join('')}</div>`;
  if (sec.radicals) inner += `<div class="rad-grid">${sec.radicals.map(radicalHTML).join('')}</div>`;
  return `<section class="lex-sec"><h2 class="lex-h">${esc(sec.h)}</h2>${inner}</section>`;
}
function renderLesson() {
  const l = CURLESSON; if (!l) return go('learn');
  const col = l.color || '#1f3fbf';
  document.documentElement.style.setProperty('--c', col);
  $('#view').innerHTML = `<div class="reader lesson" style="--sc:${col}">
    <div class="reader-top"><button class="btn ghost sm" data-backlearn>${ic('back')} Belajar</button>
      <button class="chip ${LOWPY ? 'on' : ''}" data-togpy aria-pressed="${LOWPY}">拼 Pinyin</button></div>
    ${UNKNOWN.size ? `<div class="unknown-bar">${ic('snow')} <b>${UNKNOWN.size}</b> kata ditandai belum tahu${canCreate() ? ` <button class="btn sm" data-addunknown>${ic('plus')} Masukkan ke deck…</button>` : ''}<button class="chip sm" data-clearunknown>${ic('x')} Bersihkan</button></div>` : ''}
    <div class="reader-head"><span class="lesson-emoji big">${esc(l.emoji || '📚')}</span><div><h1 class="h1">${esc(l.title)}</h1><p class="sub">${esc(l.subtitle || '')}</p></div></div>
    ${l.sections.map(sectionHTML).join('')}
    <p class="note" style="text-align:center;margin:14px 0">Ketuk hanzi untuk arti, audio, atau tambah ke deck.</p>
  </div>`;
}
async function toggleLike(id, btn) {
  const want = !btn.classList.contains('on');
  btn.disabled = true;
  try {
    const r = await api.like(id, want);
    const setOne = (b) => { b.classList.toggle('on', r.liked); b.setAttribute('aria-pressed', r.liked); b.querySelector('b').textContent = r.likes; if (r.liked) fx(b, 'fx-right'); };
    document.querySelectorAll(`[data-like="${CSS.escape(id)}"]`).forEach(setOne);
    if (FEED) { const p = FEED.find((x) => x.id === id); if (p) { p.liked = r.liked; p.likes = r.likes; } }
  } catch (e) { toast(e.message); }
  btn.disabled = false;
}

/* ================= Riwayat ================= */
async function renderHist() {
  $('#actionbar').hidden = true; document.documentElement.style.setProperty('--c', 'var(--brand)');
  const head = (n) => `<div class="page-head"><div><p class="eyebrow">Riwayat</p><h1 class="h1">Perkembanganmu</h1>${n !== undefined ? `<p class="sub">${n} sesi selesai.</p>` : ''}</div></div>`;
  $('#view').innerHTML = head() + '<div class="panel"><p class="note">Memuat…</p></div>';
  let rows = [];
  try { [rows, SRS] = await Promise.all([api.mySessions(), api.srs()]); } catch (e) { toast(e.message); }
  if (S.view !== 'hist') return;
  const nm = (id) => deckOf(id)?.zh || 'Kategori terhapus';
  const pts = rows.slice().reverse().map((r) => ({ x: Date.parse(r.started_at), y: r.score ?? 0 }));
  $('#view').innerHTML = `${head(rows.length)}
    ${myProgress()}
    ${rows.length > 1 ? `<div class="panel"><div class="panel-head"><h2 class="h3">Skor dari waktu ke waktu</h2></div>${lineChart(pts)}</div>` : ''}
    <div class="panel">${rows.length ? `<div class="tablewrap"><table class="table"><thead><tr><th>Tanggal</th><th>Kategori</th><th>Kartu</th><th>Keluar app</th><th>Skor</th></tr></thead><tbody>
    ${rows.map((r) => `<tr><td>${esc(fmtDate(r.started_at))}</td><td class="han">${esc(r.decks.map(nm).join('、'))}</td><td>${r.total}</td><td>${r.away_count ? `${r.away_count}×` : '–'}${r.rush ? ` · <span class="pill warn">asal ${r.rush}×</span>` : ''}</td><td>${scoreTag(r.score)}</td></tr>`).join('')}</tbody></table></div>`
    : '<div class="empty"><b>Belum ada sesi</b>Pilih kategori di menu Belajar untuk mulai.</div>'}</div>`;
}

/* ================= Kartu (editor) ================= */
const ED = { shared: true, deliverOpen: false, deck: null, tab: 'add', text: '', rows: [], cache: {}, note: '', newOpen: false, newColor: COLORS[0], list: [], armDeck: false, armCard: null, renameColor: null };
const EMOJIS = '🍎🍌🍊🍇🍉🍓🍒🍑🥭🍍🥥🥝🥑🍋🥕🌽🥦🥬🥒🍆🍅🥔🧅🧄🍄🥜🍚🍜🍞🥟🍗🍔🍕🍟🍰🍪🍫🍬🍦🥛☕🍵🧃💧🐶🐱🐭🐰🐼🐻🐨🐯🦁🐮🐷🐵🐔🐦🐧🦆🐟🐬🐳🦋🐝🐞🐍🐢🦒🐘🦓🐴🦄📚✏️🖊️📏✂️📎🎒💻📱⌚🔑🚪🪑🛏️💡📺🚗🚌🚲✈️🚢🚀⚽🏀🎸🎹🎨🎁🎈☀️🌙⭐☁️🌧️❄️🌈🔥🌳🌸🏠🏫🏥👨👩👦👧👶👴👵🙂😄😢😠😮😴🤒😋❤️👍👋🙏👀👂👃👄✋🦶'.match(/\p{Extended_Pictographic}️?(?:‍\p{Extended_Pictographic}️?)*/gu);
const editableDecks = () => DECKS.filter((d) => d.editable);
function statusPill(d) {
  if (!d.owner_id) return d.status === 'private' ? '<span class="pill priv"><span class="d"></span>Hanya untuk penerima kiriman</span>' : '<span class="pill good"><span class="d"></span>Tampil untuk semua murid</span>';
  return { public: '<span class="pill good"><span class="d"></span>Disetujui · tampil untuk murid</span>', pending: '<span class="pill warn"><span class="d"></span>Menunggu persetujuan guru</span>', private: '<span class="pill mute"><span class="d"></span>Pribadi · hanya kamu</span>' }[d.status] || '';
}
function renderCards() {
  $('#actionbar').hidden = true; document.documentElement.style.setProperty('--c', 'var(--brand)');
  const ds = editableDecks();
  if (ED.deck && !ds.some((d) => d.id === ED.deck)) ED.deck = null;
  if (!ED.deck && ds.length && !isTeacher()) ED.deck = ds[0].id;
  const d = deckOf(ED.deck);
  $('#view').innerHTML = `<div class="page-head"><div><p class="eyebrow">${isTeacher() ? 'Kelola kartu' : 'Kartu saya'}</p><h1 class="h1">Buat & atur kartu</h1>
      <p class="sub">${isTeacher() ? 'Tulis satu kata per baris, terjemahan muncul otomatis. Semuanya bisa diedit sebelum disimpan.' : 'Buat kategori sendiri. Setelah selesai, minta persetujuan guru supaya teman sekelas juga bisa memakainya.'}</p></div></div>
  <div class="editor">
    <aside class="panel" style="padding:12px">
      <button class="btn sm" style="width:100%;margin-bottom:10px" data-act="newdeck">${ic('plus')} Kategori baru</button>
      <form id="newDeckForm" class="stack" ${ED.newOpen ? '' : 'hidden'} style="padding:4px 4px 12px" novalidate>
        <label class="field" for="ndz">Nama Mandarin<input id="ndz" maxlength="16" placeholder="学校"></label>
        <label class="field" for="ndi">Nama Indonesia<input id="ndi" maxlength="40" placeholder="Sekolah"></label>
        <div class="swatches">${COLORS.map((c) => `<button type="button" class="sw" data-ncolor="${c}" style="background:${c}" aria-pressed="${ED.newColor === c}" aria-label="Warna ${c}"></button>`).join('')}</div>
        ${!isTeacher() ? `<div class="field">Siapa yang bisa melihat?<div class="seg vis" role="group"><button type="button" data-vis="0" aria-pressed="${!ED.wantPublic}">${ic('key')} Privat</button><button type="button" data-vis="1" aria-pressed="${!!ED.wantPublic}">${ic('users')} Publik</button></div><span class="note" id="visNote">${ED.wantPublic ? 'Semua teman bisa memakai, setelah disetujui guru.' : 'Hanya kamu dan guru.'}</span></div>` : ''}
        ${isTeacher() ? `<button type="button" class="switch" role="switch" aria-checked="${ED.shared}" data-act="newshared"><span class="track"></span>Tampil untuk semua murid</button><p class="note">Matikan kalau kategori ini hanya untuk dikirim ke murid tertentu.</p>` : ''}
        <button class="btn sm" type="submit">Buat kategori</button>
      </form>
      <nav class="decklist" aria-label="Kategori">${ds.map((k) => `<button data-edeck="${esc(k.id)}" aria-current="${ED.deck === k.id}" style="--dc:${k.color}"><span class="dotc"></span><span><span class="zh">${esc(k.zh)}</span> <span class="note">${esc(k.idn)}</span></span><span class="n">${k.status === 'pending' ? '<span class="pill warn" style="height:20px">menunggu</span>' : k.cards.length}</span></button>`).join('') || '<p class="note" style="padding:8px">Belum ada kategori. Buat yang pertama.</p>'}</nav>
    </aside>
    <section id="deckPane" style="min-width:0">${d ? deckPane(d) : '<div class="panel empty"><b>Pilih atau buat kategori</b>Kartu disimpan di dalam kategori.</div>'}</section>
  </div>`;
  if (d) bindDeckPane(d);
  $('#newDeckForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const zh = $('#ndz').value.trim(); if (!zh) { toast('Isi nama Mandarin kategori.'); return; }
    try { const r = await api.createDeck({ zh, idn: $('#ndi').value.trim(), color: ED.newColor, shared: isTeacher() ? ED.shared : undefined }); ED.deck = r.id; ED.newOpen = false; ED.tab = 'add'; if (!isTeacher() && ED.wantPublic) { const pp = store.get('wantpub', []); store.set('wantpub', [...pp, r.id].slice(-50)); } await reloadContent(); toast('Kategori dibuat. Sekarang tambahkan kartu.'); renderCards(); }
    catch (err) { toast(err.message); }
  });
}
function deckPane(d) {
  return `<div class="panel">
    <div class="panel-head"><div class="row"><span class="dotc" style="--dc:${d.color};width:12px;height:12px"></span><h2 class="h2 han">${esc(d.zh)}</h2><span class="note">${esc(d.idn)}</span></div>${statusPill(d)}</div>
    <div class="row">
      ${d.owner_id && !isTeacher() ? `<div class="seg vis" role="group" aria-label="Siapa yang bisa melihat"><button data-act="setpriv" aria-pressed="${d.status === 'private'}">${ic('key')} Privat</button><button data-act="submitdeck" aria-pressed="${d.status !== 'private'}">${ic('users')} Publik</button></div>
        <span class="note">${d.status === 'private' ? 'Hanya kamu dan guru.' : d.status === 'pending' ? 'Menunggu persetujuan guru.' : 'Tampil untuk semua teman. Perubahan perlu disetujui lagi.'}</span>` : ''}
      ${d.owner_id && !isTeacher() && d.mine ? `<button class="btn sm" data-act="senddeck" ${d.cards.length ? '' : 'disabled'}>${ic('send')} Kirim ke teman</button>` : ''}
      ${d.owner_id && isTeacher() ? `<span class="note">Buatan ${esc(d.owner_name || 'murid')} · ${d.status === 'private' ? 'privat' : d.status === 'pending' ? 'minta publik' : 'publik'}</span>` : ''}
      ${isTeacher() ? `<button class="btn sm" data-act="deliver" ${d.cards.length ? '' : 'disabled'}>${ic('gift')} Kirim ke murid</button>` : ''}
      ${isTeacher() && !d.owner_id ? `<button class="switch" role="switch" aria-checked="${d.status !== 'private'}" data-act="sharedeck"><span class="track"></span>Tampil untuk semua</button>` : ''}
      <span class="spacer"></span>
      <button class="chip" data-act="renamedeck">${ic('edit')} Ubah nama</button>
      <button class="chip danger" data-act="deldeck" data-armed="${ED.armDeck ? 1 : 0}">${ic('trash')} ${ED.armDeck ? 'Ketuk lagi untuk menghapus' : 'Hapus kategori'}</button>
    </div>
    ${isTeacher() ? `<form id="deliverForm" class="compose" style="margin-top:14px;padding-top:14px;border-top:1px solid var(--line)" ${ED.deliverOpen ? '' : 'hidden'} novalidate>
      <p class="note">Kategori <b class="han">${esc(d.zh)}</b> (${d.cards.length} kartu) langsung muncul memenuhi layar murid dan masuk ke daftar <b>Pribadi</b> mereka, paling atas.</p>
      <div id="deliverTo">${STUDENTS.length || ED.stuLoaded ? toHTML('d') : '<p class="note">Memuat murid…</p>'}</div>
      <div class="row"><span class="note" id="dlvNote"></span><span class="spacer"></span><button class="btn" type="submit">${ic('send')} Kirim sekarang</button></div>
    </form>` : ''}
    <form id="renameForm" class="formgrid" hidden style="margin-top:14px" novalidate>
      <label class="field" for="rdz">Nama Mandarin<input id="rdz" maxlength="16" value="${esc(d.zh)}"></label>
      <label class="field" for="rdi">Nama Indonesia<input id="rdi" maxlength="40" value="${esc(d.idn)}"></label>
      <div class="field">Warna<div class="swatches">${COLORS.map((c) => `<button type="button" class="sw" data-rcolor="${c}" style="background:${c}" aria-pressed="${(ED.renameColor || d.color) === c}" aria-label="Warna ${c}"></button>`).join('')}</div></div>
      <div class="field" style="justify-content:flex-end"><button class="btn sm" type="submit">Simpan nama</button></div>
    </form>
  </div>
  <div class="tabs" role="tablist" style="margin-top:16px">
    <button role="tab" data-etab="add" aria-selected="${ED.tab === 'add'}">${ic('plus')} Tambah kartu</button>
    <button role="tab" data-etab="list" aria-selected="${ED.tab === 'list'}">${ic('list')} Daftar kartu <span class="note">${d.cards.length}</span></button>
  </div>
  <div id="etab">${ED.tab === 'add' ? bulkHTML() : listHTML(d)}</div>`;
}
const HEAD = '<div class="rows-head"><span></span><span>汉字</span><span>Pinyin</span><span>Arti</span><span>English</span><span>量词</span><span></span></div>';
function bulkHTML() {
  return `<div class="bulk">
    <div class="stack">
      <label class="field" for="bulkText">Satu kata per baris<textarea id="bulkText" spellcheck="false" placeholder="我&#10;他&#10;你&#10;骄傲&#10;apel">${esc(ED.text)}</textarea></label>
      <p class="note">Boleh hanzi, bahasa Indonesia, atau bahasa Inggris. Pinyin, arti, dan English terisi otomatis, dan semuanya bisa kamu ubah.</p>
      <button class="switch" role="switch" aria-checked="${S.hints}" data-act="hints"><span class="track"></span>Pakai saran gambar & emoji</button>
    </div>
    <div class="stack" style="min-width:0">${HEAD}
      <div class="rows" id="rows">${rowsHTML()}</div>
      <div class="row"><span class="note" id="bulkNote">${esc(ED.note)}</span><span class="spacer"></span><button class="btn" data-act="savebulk" ${ED.rows.length ? '' : 'disabled'}>${ic('check')} Simpan ${ED.rows.length || ''} kartu</button></div>
    </div>
  </div>`;
}
const rowPic = (r) => (r.picSet !== undefined ? r.picSet : S.hints ? r.pic || r.emoji || '' : '');
function rowHTML(r, i, kind) {
  const p = kind === 'new' ? rowPic(r) : r.pic || '';
  const ph = p ? picHTML({ pic: p }) || ic('smile') : ic('smile');
  const src = kind === 'new' ? ({ kamus: 'Dari kamus Alvaro', ai: 'Terjemahan otomatis · periksa lagi', manual: r.m ? 'Diisi manual' : 'Arti belum ditemukan, isi sendiri' }[r.from] || '') : '';
  const armed = kind === 'old' && ED.armCard === r.id;
  return `<div class="crow" data-row="${i}" data-kind="${kind}">
    <button class="emo-btn" data-emo="${i}" aria-label="Pilih gambar atau emoji (opsional)" title="Gambar/emoji (opsional)">${ph}</button>
    <input class="hz ${r.h ? '' : 'miss'}" data-f="h" value="${esc(r.h)}" maxlength="12" aria-label="Hanzi">
    <input class="py" data-f="p" value="${esc(r.p)}" maxlength="60" aria-label="Pinyin" placeholder="pinyin">
    <input class="mean ${r.m ? '' : 'miss'}" data-f="m" value="${esc(r.m)}" maxlength="60" aria-label="Arti" placeholder="arti">
    <input class="eni" data-f="en" value="${esc(r.en || '')}" maxlength="60" aria-label="Arti bahasa Inggris" placeholder="english">
    <input class="mwi" data-f="mw" value="${esc(r.mw)}" maxlength="2" aria-label="Kata satuan" placeholder="–">
    <button class="x" data-rm="${i}" aria-label="${kind === 'new' ? 'Hapus baris' : armed ? 'Ketuk lagi untuk menghapus kartu' : 'Hapus kartu'}" ${armed ? 'style="background:var(--bad);color:#fff"' : ''}>${ic(armed ? 'trash' : 'x')}</button>
    ${src ? `<span class="src">${src}</span>` : ''}
  </div>`;
}
function rowsHTML() {
  if (!ED.rows.length) return '<div class="empty" style="border:1px dashed var(--line-2);border-radius:16px"><b>Belum ada kata</b>Ketik di kotak sebelah, satu kata per baris.</div>';
  return ED.rows.map((r, i) => rowHTML(r, i, 'new')).join('');
}
function listHTML(d) {
  ED.list = d.cards.map((c) => ({ ...c }));
  if (!ED.list.length) return '<div class="panel empty"><b>Kategori ini masih kosong</b>Buka "Tambah kartu" untuk mulai.</div>';
  return `<div class="stack">${HEAD}<div class="rows" id="listRows">${ED.list.map((r, i) => rowHTML(r, i, 'old')).join('')}</div><p class="note">Perubahan tersimpan otomatis saat kamu pindah kolom.</p></div>`;
}
let trT = 0;
function bindDeckPane(d) {
  const df = $('#deliverForm');
  if (df) {
    bindTo('d');
    df.addEventListener('submit', async (e) => {
      e.preventDefault(); const n = $('#dlvNote');
      try { const to = readTo(); const r = await api.deliver(d.id, to); n.textContent = `Terkirim ke ${r.sent} murid (${toLabel(to)}).`; toast('Kartu terkirim ke layar murid.'); burst(20); }
      catch (err) { n.textContent = err.message; }
    });
  }
  const ta = $('#bulkText');
  if (ta) ta.addEventListener('input', () => { ED.text = ta.value; clearTimeout(trT); trT = setTimeout(syncRows, 650); });
  $('#renameForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    try { await api.updateDeck({ id: d.id, zh: $('#rdz').value, idn: $('#rdi').value, color: ED.renameColor || d.color }); ED.renameColor = null; await reloadContent(); toast('Nama kategori disimpan.'); renderCards(); }
    catch (err) { toast(err.message); }
  });
}
async function syncRows() {
  const lines = [...new Set(ED.text.split(/\r?\n/).map((s) => s.trim()).filter(Boolean))].slice(0, 100);
  const missing = lines.filter((l) => !ED.cache[l]);
  if (missing.length) {
    const note = $('#bulkNote'); if (note) note.textContent = `Menerjemahkan ${missing.length} kata…`;
    try {
      for (let i = 0; i < missing.length; i += 60) {
        const part = missing.slice(i, i + 60);
        const r = await api.translate(part);
        part.forEach((line, k) => { const it = r.items[k]; if (it) ED.cache[line] = { ...it, line }; });
        ED.note = !r.ai && r.items.some((x) => x.from === 'manual') ? 'Terjemahan otomatis (AI) belum aktif. Kata di luar kamus perlu diisi artinya.'
          : r.aiError ? 'Terjemahan otomatis sedang gangguan. Isi arti yang kosong secara manual.' : '';
      }
    } catch (e) { ED.note = e.message; }
  }
  ED.rows = lines.map((l) => ED.cache[l]).filter(Boolean);
  if (S.view !== 'cards' || ED.tab !== 'add' || !$('#rows')) return;
  $('#rows').innerHTML = rowsHTML();
  $('#bulkNote').textContent = ED.note || '';
  const sb = document.querySelector('[data-act="savebulk"]');
  sb.disabled = !ED.rows.length; sb.innerHTML = `${ic('check')} Simpan ${ED.rows.length || ''} kartu`;
}
async function saveBulk() {
  const bad = ED.rows.findIndex((r) => !r.h || !r.m);
  if (bad >= 0) { toast(`Baris ${bad + 1} belum lengkap. 汉字 dan arti wajib diisi.`); const el = document.querySelector(`.crow[data-row="${bad}"] input.miss`); if (el) el.focus(); return; }
  const btn = document.querySelector('[data-act="savebulk"]'); btn.disabled = true;
  try {
    let added = 0, skipped = [];
    for (let i = 0; i < ED.rows.length; i += 100) {
      const r = await api.bulkCards(ED.deck, ED.rows.slice(i, i + 100).map((x) => ({ h: x.h, p: x.p, m: x.m, en: x.en || '', mw: x.mw, pic: rowPic(x) })));
      added += r.added; skipped = skipped.concat(r.skipped);
    }
    ED.text = ''; ED.rows = []; ED.cache = {}; ED.note = '';
    const wp = store.get('wantpub', []);
    if (wp.includes(ED.deck)) { store.set('wantpub', wp.filter((x) => x !== ED.deck)); try { await api.submitDeck(ED.deck); } catch (_) { /* coba manual */ } }
    await reloadContent(); renderCards();
    toast(`${added} kartu tersimpan.${skipped.length ? ` ${skipped.length} dilewati karena sudah ada (${skipped.slice(0, 3).join('、')}${skipped.length > 3 ? '…' : ''}).` : ''}`);
  } catch (err) { toast(err.message); btn.disabled = false; }
}
document.addEventListener('change', async (e) => {
  const inp = e.target.closest('.crow input'); if (!inp) return;
  const rowEl = inp.closest('.crow'), i = +rowEl.dataset.row, f = inp.dataset.f, kind = rowEl.dataset.kind;
  const r = kind === 'new' ? ED.rows[i] : ED.list[i]; if (!r) return;
  r[f] = inp.value.trim();
  inp.classList.toggle('miss', (f === 'h' || f === 'm') && !r[f]);
  if (kind === 'new') return;
  try { await api.updateCard({ id: r.id, h: r.h, p: r.p, m: r.m, en: r.en || '', mw: r.mw, pic: r.pic || '' }); rowEl.classList.add('saved'); setTimeout(() => rowEl.classList.remove('saved'), 900); reloadContent().catch(() => {}); }
  catch (err) { toast(err.message); }
});

/* ---- pemilih gambar/emoji (opsional) ---- */
let EMO_TARGET = null;
function openEmoji(btn) {
  closeEmoji();
  const rowEl = btn.closest('.crow'); EMO_TARGET = { i: +rowEl.dataset.row, kind: rowEl.dataset.kind };
  const pop = document.createElement('div'); pop.className = 'emoji-pop'; pop.id = 'emojiPop'; pop.setAttribute('role', 'dialog'); pop.setAttribute('aria-label', 'Pilih gambar atau emoji');
  pop.innerHTML = `<div class="grid">${EMOJIS.map((x) => `<button type="button" data-pick-emo="${x}">${x}</button>`).join('')}</div>
    <div class="bar2"><input id="emoIn" maxlength="8" placeholder="Emoji lain" aria-label="Emoji lain"><label class="btn sm secondary" for="emoFile" style="cursor:pointer">${ic('image')} Foto</label><input id="emoFile" type="file" accept="image/png,image/jpeg,image/webp,image/gif" hidden><button type="button" class="btn sm ghost" data-pick-emo="">Tanpa</button></div>`;
  document.body.appendChild(pop);
  const r = btn.getBoundingClientRect();
  pop.style.left = Math.max(8, Math.min(window.innerWidth - 298, r.left)) + 'px';
  pop.style.top = (r.bottom + 266 > window.innerHeight ? Math.max(8, r.top - 266) : r.bottom + 6) + 'px';
  $('#emoIn').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); setPic($('#emoIn').value.trim()); } });
  $('#emoFile').addEventListener('change', async (e) => {
    const f = e.target.files && e.target.files[0]; if (!f) return;
    toast('Mengunggah foto…');
    try { setPic(await api.uploadImage(f)); toast('Foto dipakai.'); } catch (err) { toast(err.message); }
  });
}
function closeEmoji() { const p = $('#emojiPop'); if (p) p.remove(); }
async function setPic(v) {
  const t = EMO_TARGET; closeEmoji(); if (!t) return;
  if (v && !/^\/api\/img\/[a-f0-9]{32}$/.test(v) && !/^\p{Extended_Pictographic}/u.test(v)) { toast('Pakai satu emoji saja.'); return; }
  if (t.kind === 'new') { const r = ED.rows[t.i]; if (!r) return; r.picSet = v; $('#rows').innerHTML = rowsHTML(); return; }
  const r = ED.list[t.i]; if (!r) return; r.pic = v;
  try { await api.updateCard({ id: r.id, h: r.h, p: r.p, m: r.m, en: r.en || '', mw: r.mw, pic: v }); await reloadContent(); $('#etab').innerHTML = listHTML(deckOf(ED.deck)); toast('Gambar kartu diganti.'); }
  catch (err) { toast(err.message); }
}

/* ================= Guru ================= */
const TF = Object.assign({ days: 30, cls: '', student: '' }, store.get('tf', {}));
let armed = null, lastCred = null, SESS = [], liveT = 0, DRAFT = null;
function stopLive() { clearInterval(liveT); liveT = 0; }
const TTABS = [['live', 'eye', 'Pantau langsung'], ['students', 'users', 'Murid'], ['scores', 'chart', 'Skor'], ['progress', 'flag', 'Progres'], ['time', 'clock', 'Grafik waktu'], ['approve', 'inbox', 'Persetujuan'], ['stories', 'book2', 'Cerita'], ['cloze', 'edit', 'Isi rumpang'], ['settings', 'gear', 'Pengaturan']];
async function renderTeach() {
  $('#actionbar').hidden = true; document.documentElement.style.setProperty('--c', 'var(--brand)');
  if (!TTABS.some(([k]) => k === S.ttab)) S.ttab = 'live';
  const pend = pendingCount();
  $('#view').innerHTML = `<div class="page-head"><div><p class="eyebrow">Panel guru</p><h1 class="h1">Halo, ${esc(ME.display_name)}</h1><p class="sub">Pengaturan dan kartu yang kamu ubah langsung berlaku untuk semua murid.</p></div></div>
    <div class="tabs" role="tablist">${TTABS.map(([k, i, l]) => `<button role="tab" data-ttab="${k}" aria-selected="${S.ttab === k}">${ic(i)} ${l}${k === 'approve' && pend ? `<span class="n">${pend}</span>` : ''}</button>`).join('')}</div><div id="tview"><p class="note">Memuat…</p></div>`;
  armed = null;
  const tab = S.ttab, draw = () => ({ live: tLive, students: tStudents, scores: tScores, progress: tProgress, time: tTime, approve: tApprove, stories: tStories, cloze: tCloze, settings: tSettings })[tab]();
  if (['settings', 'approve', 'stories', 'cloze'].includes(tab)) { draw(); return; }
  try { STUDENTS = await api.students(); } catch (e) { toast(e.message); }
  if (S.view === 'teach' && S.ttab === tab) draw();
}
const classes = () => [...new Set(STUDENTS.map((s) => s.class_name).filter(Boolean))].sort();
const sName = (id) => STUDENTS.find((s) => s.id === id)?.display_name || 'Murid terhapus';

/* ---- penerima (semua / kelas / murid tertentu) ---- */
const PICK = { mode: 'all', cls: '', ids: [] };
function toHTML(px) {
  const cl = classes();
  return `<div class="to-row"><label class="field" for="${px}Mode" style="flex-direction:row;align-items:center;gap:8px;white-space:nowrap">Kirim ke
    <select id="${px}Mode">
      <option value="all" ${PICK.mode === 'all' ? 'selected' : ''}>Semua murid (${STUDENTS.filter((x) => x.active).length})</option>
      ${cl.map((c) => `<option value="class:${esc(c)}" ${PICK.mode === 'class' && PICK.cls === c ? 'selected' : ''}>Kelas ${esc(c)}</option>`).join('')}
      <option value="pick" ${PICK.mode === 'pick' ? 'selected' : ''}>Pilih murid…</option>
    </select></label></div>
    <div class="stu-picks" id="${px}Picks" ${PICK.mode === 'pick' ? '' : 'hidden'}>${STUDENTS.filter((x) => x.active).map((x) => `<button type="button" class="chip" data-pickstu="${esc(x.id)}" aria-pressed="${PICK.ids.includes(x.id)}">${esc(x.display_name)}${x.class_name ? ` <span class="note">${esc(x.class_name)}</span>` : ''}</button>`).join('') || '<span class="note">Belum ada murid aktif.</span>'}</div>`;
}
function bindTo(px) {
  const sel = $('#' + px + 'Mode'); if (!sel) return;
  sel.addEventListener('change', () => {
    const v = sel.value;
    if (v.startsWith('class:')) { PICK.mode = 'class'; PICK.cls = v.slice(6); } else PICK.mode = v;
    $('#' + px + 'Picks').hidden = PICK.mode !== 'pick';
  });
}
function readTo() {
  if (PICK.mode === 'class') return { class: PICK.cls };
  if (PICK.mode === 'pick') { if (!PICK.ids.length) throw new Error('Pilih minimal satu murid.'); return { users: PICK.ids.slice() }; }
  return { all: true };
}
const toLabel = (to) => (to.all ? 'semua murid' : to.class ? 'kelas ' + to.class : `${to.users.length} murid`);
const WARN_PRESET = 'Jangan keluar-keluar aplikasi ya! Fokus belajar dulu sampai sesi selesai.';

/* ---- Pantau langsung ---- */
let LIVE_ARM = null;
async function tLive() {
  $('#tview').innerHTML = `<form class="panel compose" id="msgForm" novalidate>
      <div class="panel-head" style="margin:0"><h2 class="h3">${ic('chat')} Kirim pesan ke layar murid</h2>
        <div class="seg" role="group" aria-label="Jenis pesan"><button type="button" data-mkind="chat" aria-pressed="true">Pesan</button><button type="button" data-mkind="warn" aria-pressed="false">Peringatan</button></div></div>
      <textarea id="msgText" maxlength="300" placeholder="Tulis pesan… (muncul memenuhi layar murid)"></textarea>
      <div class="row"><button type="button" class="chip" data-act="preset">${ic('alert')} Isi: “Jangan keluar-keluar aplikasi”</button></div>
      ${toHTML('m')}
      <div class="row"><span class="note" id="msgNote"></span><span class="spacer"></span><button class="btn" type="submit">${ic('send')} Kirim sekarang</button></div>
    </form>
    <div id="liveArea" style="margin-top:16px"><p class="note">Memuat…</p></div>`;
  bindTo('m');
  $('#msgForm').addEventListener('submit', async (e) => {
    e.preventDefault(); const n = $('#msgNote');
    const kind = document.querySelector('[data-mkind="warn"]').getAttribute('aria-pressed') === 'true' ? 'warn' : 'chat';
    try { const to = readTo(); const r = await api.message($('#msgText').value, kind, to); n.textContent = `Terkirim ke ${r.sent} murid (${toLabel(to)}).`; $('#msgText').value = ''; toast('Pesan terkirim.'); }
    catch (err) { n.textContent = err.message; }
  });
  const draw = async () => {
    if (S.view !== 'teach' || S.ttab !== 'live') { stopLive(); return; }
    let d; try { d = await api.live(); } catch (_) { return; }
    const v = $('#liveArea'); if (!v || S.ttab !== 'live' || S.view !== 'teach') return;
    const now = d.now, nm = (id) => deckOf(id)?.zh || id;
    const active = d.runs.filter((r) => !r.finished_at), done = d.runs.filter((r) => r.finished_at);
    const awayNow = (r) => r.state === 'away' && now - r.last_seen <= 60000;
    const status = (r) => {
      if (awayNow(r)) return `<span class="pill bad pulse"><span class="d"></span>Keluar aplikasi · ${dur(now - (r.state_since || now))}</span>`;
      if (now - r.last_seen > 60000) return `<span class="pill mute"><span class="d"></span>Tidak aktif · ${dur(now - r.last_seen)}</span>`;
      return '<span class="pill good pulse"><span class="d"></span>Sedang belajar</span>';
    };
    const msgInfo = (r) => (r.msg_at && now - r.msg_at < 3600e3 ? `<span class="seen">Pesan ${new Date(r.msg_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} · ${r.msg_seen ? '✓ sudah tampil' : 'belum tampil'}</span>` : '');
    v.innerHTML = `<div class="kpis"><div class="kpi"><b>${active.length}</b><span>sesi berjalan</span></div><div class="kpi"><b style="color:${active.some(awayNow) ? 'var(--bad)' : 'inherit'}">${active.filter(awayNow).length}</b><span>keluar aplikasi sekarang</span></div><div class="kpi"><b>${done.length}</b><span>selesai 30 menit terakhir</span></div></div>
      <div class="panel-head"><h2 class="h3">Sesi berjalan</h2><div class="row"><span class="note">Diperbarui ${new Date(now).toLocaleTimeString('id-ID')} · tiap 5 detik</span>
        ${active.length ? `<button class="chip danger" data-endall="1" data-armed="${LIVE_ARM === 'all' ? 1 : 0}">${ic('stop')} ${LIVE_ARM === 'all' ? 'Ketuk lagi: akhiri semua' : 'Akhiri semua sesi'}</button>` : ''}</div></div>
      ${active.length ? `<div class="live">${active.map((r) => `<div class="lv ${awayNow(r) ? 'away' : ''}">
        <div class="who">${avaHTML(r.name, r.photo, '')}<div><b>${esc(r.name)}</b><span>${esc(r.class_name || 'Tanpa kelas')} · <span class="han">${esc(r.decks.map(nm).join('、'))}</span>${r.mode === 'mw' ? ' · 量词' : ''}</span></div></div>
        <div>${status(r)}</div>
        ${r.cur ? `<div class="mirror" title="Kartu yang sedang dilihat murid"><span class="han">${esc(r.cur.h)}</span><span class="py">${esc(r.cur.p)}</span><span class="mn">${esc(r.cur.m)}</span></div>` : ''}
        <div class="prog"><i style="width:${r.planned ? Math.min(100, (r.done / r.planned) * 100) : 0}%"></i></div>
        <div class="foot"><span>${r.done}${r.planned ? `/${r.planned}` : ''} kartu · mulai ${new Date(r.started_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}</span><span style="color:${r.away_count ? 'var(--bad)' : 'inherit'}">Keluar ${r.away_count}× · ${dur(r.away_ms + (r.state === 'away' ? now - (r.state_since || now) : 0))}</span><span style="color:${r.rush ? 'var(--warn, #b8860b)' : 'inherit'}">Asal tekan ${r.rush}× · clue ${r.clues}</span></div>
        <div class="acts"><button class="chip" data-warn="${esc(r.student_id)}">${ic('alert')} Peringatkan</button><button class="chip" data-chatto="${esc(r.student_id)}">${ic('chat')} Pesan</button><button class="chip danger" data-endrun="${esc(r.id)}" data-armed="${LIVE_ARM === r.id ? 1 : 0}">${ic('stop')} ${LIVE_ARM === r.id ? 'Ketuk lagi' : 'Akhiri sesi'}</button></div>
        ${msgInfo(r)}
      </div>`).join('')}</div>` : '<div class="panel empty"><b>Belum ada yang belajar</b>Sesi murid muncul di sini begitu mereka menekan Mulai.</div>'}
      ${done.length ? `<div class="panel" style="margin-top:16px"><div class="panel-head"><h2 class="h3">Baru selesai</h2></div><div class="tablewrap"><table class="table"><thead><tr><th>Murid</th><th>Selesai</th><th>Kartu</th><th>Keluar app</th><th>Skor</th></tr></thead><tbody>
        ${done.map((r) => `<tr><td><b>${esc(r.name)}</b>${r.ended_by === 'teacher' ? ' <span class="pill warn">diakhiri guru</span>' : r.ended_by === 'self' ? ' <span class="pill mute">diakhiri murid</span>' : ''}</td><td>${new Date(r.finished_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}</td><td>${r.total}</td><td>${r.away_count ? `<span class="pill bad">${r.away_count}× · ${dur(r.away_ms)}</span>` : '<span class="pill good">0×</span>'}</td><td>${scoreTag(r.score)}</td></tr>`).join('')}</tbody></table></div></div>` : ''}`;
  };
  LIVE_DRAW = draw;
  stopLive(); await draw(); if (S.view === 'teach' && S.ttab === 'live') liveT = setInterval(draw, 5000);
}
let LIVE_DRAW = null;

/* ---- Murid ---- */
function tStudents() {
  $('#tview').innerHTML = `<div class="grid2">
    <form class="panel stack" id="newStu" novalidate><h2 class="h3">Buat akun murid</h2>
      <div class="formgrid">
        <label class="field" for="sn">Nama murid<input id="sn" maxlength="40" required placeholder="Budi Santoso"></label>
        <label class="field" for="su">Username<input id="su" maxlength="24" autocapitalize="none" spellcheck="false" required placeholder="budi.s"></label>
        <label class="field" for="sc">Kelas<input id="sc" maxlength="30" list="clslist" placeholder="3A"></label>
      </div><datalist id="clslist">${classes().map((c) => `<option value="${esc(c)}">`).join('')}</datalist>
      <p class="note">Password dibuat acak oleh server dan hanya tampil sekali.</p>
      <div><button class="btn" type="submit">${ic('plus')} Buat akun</button></div></form>
    <div class="panel"><h2 class="h3" style="margin-bottom:12px">Akun baru / password baru</h2><div id="credBox">${lastCred ? credHTML(lastCred) : '<p class="note">Username dan password muncul di sini. Salin lalu kirim ke murid.</p>'}</div></div>
  </div>
  <div class="panel"><div class="panel-head"><h2 class="h3">${STUDENTS.length} murid</h2><span class="note">"Boleh buat kartu" mengizinkan murid membuat kategori sendiri.</span></div>
  ${STUDENTS.length ? `<div class="tablewrap"><table class="table"><thead><tr><th>Nama</th><th>Username</th><th>Kelas</th><th>Status</th><th>Boleh buat kartu</th><th>Aksi</th></tr></thead><tbody>
  ${STUDENTS.map((s) => `<tr><td><b>${esc(s.display_name)}</b></td><td><code>${esc(s.username)}</code></td><td>${esc(s.class_name || '–')}</td>
    <td>${s.active ? '<span class="pill good">Aktif</span>' : '<span class="pill mute">Nonaktif</span>'}</td>
    <td><button class="switch" role="switch" aria-checked="${!!s.can_create}" data-sact="create" data-id="${esc(s.id)}" aria-label="Izinkan ${esc(s.display_name)} membuat kartu"><span class="track"></span></button></td>
    <td><div class="row" style="flex-wrap:nowrap">
      <button class="chip" data-sact="reset" data-id="${esc(s.id)}">${ic('key')} Password baru</button>
      <button class="chip" data-sact="${s.active ? 'off' : 'on'}" data-id="${esc(s.id)}">${s.active ? 'Nonaktifkan' : 'Aktifkan'}</button>
      <button class="chip" data-sact="rename" data-id="${esc(s.id)}">Ubah</button>
      <button class="chip danger" data-sact="delete" data-id="${esc(s.id)}" data-armed="${armed === 'del:' + s.id ? 1 : 0}">${ic('trash')} ${armed === 'del:' + s.id ? 'Ketuk lagi' : 'Hapus'}</button>
    </div></td></tr>`).join('')}</tbody></table></div>` : '<div class="empty"><b>Belum ada murid</b>Buat akun pertama di atas.</div>'}</div>`;
  $('#sn').addEventListener('input', (e) => { const u = $('#su'); if (!u.dataset.touched) u.value = e.target.value.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '.').replace(/^\.|\.$/g, '').slice(0, 24); });
  $('#su').addEventListener('input', (e) => { e.target.dataset.touched = '1'; });
  $('#newStu').addEventListener('submit', async (e) => {
    e.preventDefault(); const btn = e.target.querySelector('button[type=submit]'); btn.disabled = true;
    try { const r = await api.manage('create', { display_name: $('#sn').value, username: $('#su').value, class_name: $('#sc').value }); lastCred = { name: $('#sn').value.trim(), username: r.username, password: r.password }; STUDENTS = await api.students(); toast('Akun dibuat.'); tStudents(); }
    catch (err) { toast(err.message); btn.disabled = false; }
  });
}
function credHTML(c) {
  return `<div class="cred"><div><b>${esc(c.name)}</b><div>Username <code>${esc(c.username)}</code></div><div style="margin-top:4px">Password <code>${esc(c.password)}</code></div></div>
    <button class="btn sm secondary" data-act="copycred">${ic('copy')} Salin</button></div><p class="note" style="margin-top:8px">Password ini tidak akan tampil lagi. Kalau lupa, buat password baru.</p>`;
}
function renameStudent(s) {
  const box = $('#credBox');
  box.innerHTML = `<form id="renForm" class="stack" novalidate><div class="formgrid"><label class="field" for="rn">Nama<input id="rn" maxlength="40" value="${esc(s.display_name)}"></label><label class="field" for="rc">Kelas<input id="rc" maxlength="30" value="${esc(s.class_name || '')}"></label></div><div><button class="btn sm" type="submit">${ic('check')} Simpan</button></div></form>`;
  box.scrollIntoView({ behavior: 'smooth', block: 'center' });
  $('#renForm').addEventListener('submit', async (e) => { e.preventDefault(); try { await api.manage('rename', { id: s.id, display_name: $('#rn').value, class_name: $('#rc').value }); STUDENTS = await api.students(); toast('Data murid disimpan.'); tStudents(); } catch (err) { toast(err.message); } });
}

/* ---- filter ---- */
function filtersHTML() {
  return `<div class="filters">
    <label class="field" for="fdays">Periode<select id="fdays">${[7, 30, 90, 365].map((d) => `<option value="${d}" ${TF.days === d ? 'selected' : ''}>${d === 365 ? '1 tahun' : d + ' hari'}</option>`).join('')}</select></label>
    <label class="field" for="fcls">Kelas<select id="fcls"><option value="">Semua kelas</option>${classes().map((c) => `<option ${TF.cls === c ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select></label>
    <label class="field" for="fstu">Murid<select id="fstu"><option value="">Semua murid</option>${STUDENTS.filter((s) => !TF.cls || s.class_name === TF.cls).map((s) => `<option value="${esc(s.id)}" ${TF.student === s.id ? 'selected' : ''}>${esc(s.display_name)}</option>`).join('')}</select></label>
  </div>`;
}
function bindFilters(redraw) {
  ['fdays', 'fcls', 'fstu'].forEach((id) => { const el = $('#' + id); if (el) el.addEventListener('change', () => { TF.days = +$('#fdays').value; TF.cls = $('#fcls').value; TF.student = $('#fstu').value; if (TF.student && TF.cls && STUDENTS.find((s) => s.id === TF.student)?.class_name !== TF.cls) TF.student = ''; store.set('tf', TF); redraw(); }); });
}

/* ---- Skor ---- */
async function tScores() {
  $('#tview').innerHTML = filtersHTML() + '<div id="sbody"><p class="note">Memuat…</p></div>';
  bindFilters(tScores);
  try { SESS = await api.sessions(TF.days); } catch (e) { toast(e.message); SESS = []; }
  const inScope = SESS.filter((s) => (!TF.student || s.student_id === TF.student) && (!TF.cls || STUDENTS.find((x) => x.id === s.student_id)?.class_name === TF.cls));
  const avg = (a) => (a.length ? Math.round(a.reduce((t, s) => t + (s.score || 0), 0) / a.length) : 0);
  const per = {};
  for (const s of inScope) (per[s.student_id] ||= []).push(s);
  const rows = Object.entries(per).map(([id, list]) => ({ id, list, avg: avg(list), last: list[0], away: list.reduce((t, s) => t + (s.away_count || 0), 0) })).sort((a, b) => b.last.started_at.localeCompare(a.last.started_at));
  const totalMin = Math.round(inScope.reduce((t, s) => t + (s.seconds || 0), 0) / 60);
  const nm = (id) => deckOf(id)?.zh || id;
  const body = $('#sbody'); if (!body) return;
  body.innerHTML = `<div class="kpis"><div class="kpi"><b>${inScope.length}</b><span>sesi selesai</span></div><div class="kpi"><b>${rows.length}</b><span>murid aktif</span></div><div class="kpi"><b>${avg(inScope)}</b><span>rata-rata skor</span></div><div class="kpi"><b>${totalMin}</b><span>menit belajar</span></div></div>
    ${TF.student && per[TF.student] ? `<div class="panel"><div class="panel-head"><h2 class="h3">Perkembangan skor ${esc(sName(TF.student))}</h2></div>${lineChart(per[TF.student].slice().reverse().map((s) => ({ x: Date.parse(s.started_at), y: s.score || 0 })))}</div>` : ''}
    <div class="panel"><div class="panel-head"><h2 class="h3">Ringkasan per murid</h2><span class="note">Klik baris untuk melihat grafik murid itu</span></div>${rows.length ? `<div class="tablewrap"><table class="table"><thead><tr><th>Murid</th><th>Sesi</th><th>Rata-rata</th><th>Keluar app</th><th>Terakhir</th><th>Skor terakhir</th></tr></thead><tbody>
    ${rows.map((r) => `<tr class="clk" data-stu="${esc(r.id)}"><td><b>${esc(sName(r.id))}</b><div class="note">${esc(STUDENTS.find((s) => s.id === r.id)?.class_name || '')}</div></td><td>${r.list.length}</td><td>${r.avg}</td><td>${r.away ? `<span class="pill bad">${r.away}×</span>` : '–'}</td><td>${esc(fmtDate(r.last.started_at))}</td><td>${scoreTag(r.last.score)}</td></tr>`).join('')}</tbody></table></div>` : '<div class="empty"><b>Belum ada sesi</b>Sesi yang selesai di periode ini muncul di sini.</div>'}</div>
    <div class="panel"><div class="panel-head"><h2 class="h3">Sesi terbaru</h2></div>${inScope.length ? `<div class="tablewrap"><table class="table"><thead><tr><th>Waktu</th><th>Murid</th><th>Kategori</th><th>Kartu</th><th>1/2/3/4</th><th>Tebak</th><th>Keluar app</th><th>Asal tekan</th><th>Skor</th></tr></thead><tbody>
    ${inScope.slice(0, 100).map((s) => `<tr><td>${esc(fmtDate(s.started_at))}</td><td>${esc(sName(s.student_id))}</td><td class="han">${esc(s.decks.map(nm).join('、'))}</td><td>${s.total}</td><td>${s.c1}/${s.c2}/${s.c3}/${s.c4}</td><td>${s.quiz_total ? `${s.quiz_right}/${s.quiz_total}` : '–'}</td><td>${s.away_count ? `${s.away_count}× · ${dur(s.away_ms)}` : '–'}</td><td>${s.rush ? `<span class="pill warn">${s.rush}×</span>` : '–'}</td><td>${scoreTag(s.score)}</td></tr>`).join('')}</tbody></table></div>` : '<p class="note">Belum ada sesi.</p>'}</div>`;
}

/* ---- Progres murid ---- */
async function tProgress() {
  $('#tview').innerHTML = filtersHTML().replace(/<label class="field" for="fdays">[\s\S]*?<\/label>/, '') + '<div id="pbody"><p class="note">Memuat…</p></div>';
  bindFilters(tProgress);
  let d; try { d = await api.progress(); } catch (e) { toast(e.message); return; }
  const body = $('#pbody'); if (!body) return;
  const ds = DECKS.filter((x) => x.cards.length && !x.owner_id && x.status !== 'private' && !SET.hidden_decks.includes(x.id));
  const deckTotal = Object.fromEntries(ds.map((x) => [x.id, x.cards.length])), allTotal = ds.reduce((t, x) => t + x.cards.length, 0);
  const per = {};
  for (const r of d.rows) { if (!deckTotal[r.deck_id]) continue; const u = (per[r.user_id] ||= {}); u[r.deck_id] = { m4: r.m4 || 0, m3: r.m3 || 0, m12: r.m12 || 0 }; }
  const sum = (u) => { const c = { m4: 0, m3: 0, m12: 0 }; for (const v of Object.values(u || {})) { c.m4 += v.m4; c.m3 += v.m3; c.m12 += v.m12; } c.n0 = Math.max(0, allTotal - c.m4 - c.m3 - c.m12); return c; };
  const list = STUDENTS.filter((x) => (!TF.cls || x.class_name === TF.cls) && (!TF.student || x.id === TF.student)).map((x) => ({ x, c: sum(per[x.id]) })).sort((a, b) => pct(b.c, allTotal) - pct(a.c, allTotal));
  const one = TF.student && STUDENTS.find((x) => x.id === TF.student);
  body.innerHTML = `${one ? (() => {
      const u = per[one.id] || {};
      return `<div class="panel"><div class="panel-head"><h2 class="h3">Progres ${esc(one.display_name)} per kategori</h2><b class="bigpct">${pct(sum(u), allTotal)}%</b></div>${legend()}
        <div class="prows">${ds.map((k) => { const c = { m4: 0, m3: 0, m12: 0, ...(u[k.id] || {}) }; c.n0 = k.cards.length - c.m4 - c.m3 - c.m12; return { k, c }; }).sort((a, b) => pct(b.c, b.k.cards.length) - pct(a.c, a.k.cards.length)).map(({ k, c }) => `<div class="prow" style="--dc:${k.color}"><div class="pname"><span class="dotc"></span><span class="han">${esc(k.zh)}</span><span class="note">${esc(k.idn)}</span></div>${pbar(c, k.cards.length)}<b>${pct(c, k.cards.length)}%</b></div>`).join('')}</div></div>`;
    })() : ''}
    <div class="panel"><div class="panel-head"><h2 class="h3">Sudah sampai mana tiap murid?</h2><span class="note">Dari ${allTotal} kartu kelas · klik nama untuk rincian</span></div>${legend()}
    ${list.length ? `<div class="prows">${list.map(({ x, c }) => `<div class="prow clk" data-pstu="${esc(x.id)}"><div class="pname"><b>${esc(x.display_name)}</b><span class="note">${esc(x.class_name || '')}${d.last[x.id] ? ' · terakhir ' + esc(fmtDate(d.last[x.id], { dateStyle: 'short' })) : ' · belum pernah belajar'}</span></div>${pbar(c, allTotal)}<b>${pct(c, allTotal)}%</b></div>`).join('')}</div>` : '<div class="empty"><b>Belum ada murid</b></div>'}</div>`;
}

/* ---- Grafik waktu ---- */
async function tTime() {
  $('#tview').innerHTML = filtersHTML() + '<div id="tbody"><p class="note">Memuat…</p></div>';
  bindFilters(tTime);
  const f = { days: TF.days, cls: TF.cls || null, student: TF.student || null };
  let cards = [], decks = [];
  try { [cards, decks] = await Promise.all([api.cardTime(f), api.deckTime(f)]); } catch (e) { toast(e.message); }
  const body = $('#tbody'); if (!body) return;
  const who = TF.student ? esc(sName(TF.student)) : TF.cls ? 'kelas ' + esc(TF.cls) : 'semua murid';
  const deckRows = decks.map((d) => { const dk = deckOf(d.deck_id); return { label: esc(dk?.zh || d.deck_id), sub: `${esc(dk?.idn || '')} · ${d.n} jawaban`, value: Number(d.avg_ms), color: dk?.color }; });
  const cardRows = cards.slice(0, 15).map((c) => { const dk = deckOf(c.deck_id); const card = CARDS.find((x) => x.id === c.card_id); return { label: esc(c.card_h), sub: `${esc(card?.m || '')} · ${esc(dk?.zh || '')} · ${c.n}×`, value: Number(c.avg_ms), color: dk?.color, extra: Number(c.wrong_rate) > 0 ? Math.round(Number(c.wrong_rate) * 100) + '% sulit' : '' }; });
  body.innerHTML = `<p class="sub" style="margin:0 0 14px">Rata-rata lama melihat satu kartu sebelum menilainya, untuk ${who}. Waktu saat keluar aplikasi tidak dihitung.</p>
    <div class="grid2"><div class="panel"><div class="panel-head"><h2 class="h3">Kategori paling lama</h2></div>${hbars(deckRows, { fmt: secs, empty: 'Belum ada jawaban di periode ini.' })}</div>
    <div class="panel"><div class="panel-head"><h2 class="h3">15 kartu paling lama</h2></div>${hbars(cardRows, { fmt: secs, empty: 'Belum ada jawaban di periode ini.' })}<p class="note" style="margin-top:10px">"% sulit" = seberapa sering kartu itu dinilai 1–2 atau tebakannya salah.</p></div></div>`;
}

/* ---- Persetujuan ---- */
function tApprove() {
  const list = DECKS.filter((d) => d.status === 'pending');
  const pub = DECKS.filter((d) => d.owner_id && d.status === 'public');
  const card = (d, pending) => `<div class="panel approve" style="--dc:${d.color}">
      <div class="panel-head" style="margin:0"><div class="row"><span class="dotc"></span><h3 class="h3 han">${esc(d.zh)}</h3><span class="note">${esc(d.idn)} · dibuat ${esc(d.owner_name || 'murid')} · ${d.cards.length} kartu</span></div>
      <div class="row">${pending ? `<button class="btn sm secondary" data-approve="${esc(d.id)}" data-ok="0">Tolak</button><button class="btn sm" data-approve="${esc(d.id)}" data-ok="1">${ic('check')} Setujui & tampilkan</button>` : `<button class="btn sm secondary" data-approve="${esc(d.id)}" data-ok="0">Sembunyikan lagi</button>`}</div></div>
      <div class="cards-mini">${d.cards.slice(0, 40).map((c) => `<span><b>${esc(c.h)}</b> ${esc(c.p)} · ${esc(c.m)}</span>`).join('')}${d.cards.length > 40 ? `<span>+${d.cards.length - 40} lagi</span>` : ''}</div>
    </div>`;
  $('#tview').innerHTML = `${list.length ? list.map((d) => card(d, true)).join('') : '<div class="panel empty"><b>Tidak ada yang menunggu</b>Kategori buatan murid yang minta persetujuan muncul di sini.</div>'}
    ${pub.length ? `<h2 class="h3" style="margin:24px 0 12px">Sudah disetujui</h2>${pub.map((d) => card(d, false)).join('')}` : ''}`;
}

/* ---- Pengaturan ---- */
const CLZ = { deck: '', rows: [], filter: '' };
function clozeDeckOptions() {
  return DECKS.filter((d) => d.cards.length && !(d.hskLevel && !d.hskLesson)).map((d) => `<option value="${esc(d.id)}" ${CLZ.deck === d.id ? 'selected' : ''}>${esc(d.zh)} (${d.cards.length})</option>`).join('');
}
async function tCloze() {
  const v = $('#tview');
  if (!CLZ.deck) { const first = DECKS.find((d) => d.cards.length && !(d.hskLevel && !d.hskLesson)); CLZ.deck = first ? first.id : ''; }
  v.innerHTML = `<div class="panel">
    <div class="panel-head"><h2 class="h3">Pembuat kalimat isian (rumpang)</h2></div>
    <p class="note">Tulis satu kalimat untuk tiap kata; kalimat <b>harus memuat kata itu</b>. Saat murid belajar mode "Isi rumpang", kata itu dikosongkan jadi isian. Beri arti kalimat agar tampil di depan.</p>
    <div class="row" style="gap:10px;flex-wrap:wrap;margin-top:10px">
      <label class="field" style="flex:1;min-width:180px">Kategori<select id="clzDeck">${clozeDeckOptions()}</select></label>
      <label class="field" style="flex:1;min-width:140px">Cari kata<input id="clzFilter" value="${esc(CLZ.filter)}" placeholder="hanzi / arti"></label>
    </div></div>
    <div class="panel quickadd">
      <div class="panel-head"><h2 class="h3">${ic('plus')} Tambah cepat</h2><button class="chip sm" data-clzqhelp>Contoh</button></div>
      <p class="note">Tempel banyak kalimat sekaligus — satu kalimat per baris. Sistem otomatis mencocokkan tiap kalimat ke kata di dalamnya. Beri arti setelah tanda <b>|</b>. Contoh: <span class="han">我在看书。</span> | Saya sedang membaca buku.</p>
      <textarea id="clzBulk" rows="5" placeholder="我在看书。 | Saya sedang membaca buku.&#10;今天天气很好。 | Cuaca hari ini bagus."></textarea>
      <div class="row" style="margin-top:8px"><button class="btn" data-clzbulk>${ic('check')} Tambahkan cepat</button><span id="clzBulkNote" class="note"></span></div>
    </div>
    <div class="panel"><div id="clzList"><p class="note">Memuat…</p></div></div>`;
  $('#clzDeck').value = CLZ.deck;
  $('#clzDeck').addEventListener('change', (e) => { CLZ.deck = e.target.value; CLZ.filter = ''; tCloze(); });
  $('#clzFilter').addEventListener('input', (e) => { CLZ.filter = e.target.value; drawClozeList(); });
  try { CLZ.rows = await api.deckCloze(CLZ.deck); } catch (e) { toast(e.message); CLZ.rows = []; }
  if (!(S.view === 'teach' && S.ttab === 'cloze')) return;
  drawClozeList();
}
function drawClozeList() {
  const box = $('#clzList'); if (!box) return;
  const f = CLZ.filter.trim().toLowerCase();
  const rows = CLZ.rows.filter((r) => !f || r.h.includes(f) || (r.m || '').toLowerCase().includes(f) || (r.p || '').toLowerCase().includes(f));
  const done = CLZ.rows.filter((r) => r.s).length;
  box.innerHTML = `<p class="note" style="margin-bottom:10px">${done}/${CLZ.rows.length} kata sudah punya kalimat.</p>` + (rows.length ? rows.map((r) => `
    <div class="clz-row" data-clzid="${esc(r.id)}">
      <div class="clz-word"><b class="han">${esc(r.h)}</b><span>${esc(r.p || '')}${r.m ? ' · ' + esc(r.m) : ''}</span>${r.s ? `<span class="pill good">${r.source === 'ai' ? 'AI' : r.source === 'card' ? 'contoh' : r.source === 'builtin' ? 'bawaan' : 'manual'}</span>` : '<span class="pill mute">belum ada</span>'}</div>
      <input class="clz-s" value="${esc(r.s)}" placeholder="kalimat yang memuat ${esc(r.h)}" maxlength="200">
      <input class="clz-si" value="${esc(r.si)}" placeholder="arti kalimat (opsional)" maxlength="200">
      <div class="row" style="gap:6px"><button class="btn sm" data-clzsave="${esc(r.id)}">${ic('check')} Simpan</button>${r.s ? `<button class="btn ghost sm" data-clzdel="${esc(r.id)}">${ic('trash')} Hapus</button>` : ''}</div>
    </div>`).join('') : '<p class="note">Tidak ada kata yang cocok.</p>');
  box.querySelectorAll('.clz-s, .clz-si').forEach((inp) => inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); const sv = inp.closest('.clz-row').querySelector('[data-clzsave]'); if (sv) sv.click(); } }));
}
async function runClozeBulk() {
  const ta = $('#clzBulk'); const note = $('#clzBulkNote'); if (!ta) return;
  const lines = ta.value.split('\n').map((l) => l.trim()).filter(Boolean);
  if (!lines.length) { note.textContent = 'Tempel kalimat dulu.'; return; }
  // kata terpanjang dulu agar pencocokan paling spesifik
  const words = CLZ.rows.map((r) => ({ id: r.id, h: r.h })).sort((a, b) => [...b.h].length - [...a.h].length);
  const items = []; const unmatched = [];
  for (const line of lines) {
    const bar = line.indexOf('|');
    const s = (bar >= 0 ? line.slice(0, bar) : line).trim();
    const si = bar >= 0 ? line.slice(bar + 1).trim() : '';
    const w = words.find((x) => s.includes(x.h));
    if (w) items.push({ card_id: w.id, s, si }); else unmatched.push(line);
  }
  if (!items.length) { note.textContent = 'Tidak ada kalimat yang memuat kata di kategori ini.'; return; }
  note.textContent = 'Menyimpan…';
  try {
    const r = await api.bulkCloze(items);
    for (const it of items) CLOZE.delete(it.card_id);
    CLZ.rows = await api.deckCloze(CLZ.deck);
    const skipped = (r.skipped || []).length;
    ta.value = unmatched.join('\n');
    note.textContent = `${r.saved} kalimat ditambahkan.` + (unmatched.length ? ` ${unmatched.length} baris tak cocok (tetap di kotak).` : '') + (skipped ? ` ${skipped} dilewati.` : '');
    toast(`${r.saved} kalimat rumpang ditambahkan.`);
    drawClozeList();
  } catch (e) { note.textContent = e.message; }
}
let STEDIT = null;
async function tStories() {
  const v = $('#tview');
  v.innerHTML = '<p class="note">Memuat…</p>';
  try { STORIES = await api.stories(); } catch (e) { toast(e.message); }
  if (!(S.view === 'teach' && S.ttab === 'stories')) return;
  const ed = STEDIT || { id: '', title: '', level: 1, body: '' };
  const lvOpts = [1, 2, 3, 4, 5, 6].map((n) => `<option value="${n}" ${ed.level === n ? 'selected' : ''}>${lvlName(n)}</option>`).join('');
  v.innerHTML = `<div class="panel">
    <div class="panel-head"><h2 class="h3">${ed.id ? 'Edit cerita' : 'Tambah cerita'}</h2>${ed.id ? `<button class="btn ghost sm" data-stnew>${ic('plus')} Cerita baru</button>` : ''}</div>
    <form id="stForm" class="stform">
      <label class="field">Judul<input id="stTitle" maxlength="80" value="${esc(ed.title)}" placeholder="我的一天" required></label>
      <label class="field">Level<select id="stLevel">${lvOpts}</select></label>
      <label class="field">Isi cerita (teks Mandarin)<textarea id="stBody" rows="6" maxlength="8000" placeholder="Tempel teks cerita di sini…" required>${esc(ed.body)}</textarea></label>
      <p class="note">Hanzi otomatis bisa ditekan murid untuk melihat arti, mendengar audio, dan menambahkannya ke kartu. Pilih level agar muncul di kelompok yang tepat.</p>
      <div class="row"><button class="btn" type="submit">${ic('check')} ${ed.id ? 'Simpan perubahan' : 'Tambah cerita'}</button><span id="stNote" class="note"></span></div>
    </form></div>
    <div class="panel"><div class="panel-head"><h2 class="h3">Daftar cerita · ${STORIES.length}</h2></div>
    ${STORIES.length ? `<div class="stlist">${STORIES.map((s) => `<div class="strow"><div><b class="han">${esc(s.title)}</b><span class="note"> ${esc(lvlName(s.level))} · ${s.len} karakter${s.builtin ? ' · bawaan' : s.author ? ' · ' + esc(s.author) : ''}</span></div>
      <div class="row" style="gap:6px"><button class="btn ghost sm" data-stedit="${esc(s.id)}">${ic('edit')} Edit</button><button class="btn ghost sm" data-stdel="${esc(s.id)}">${ic('trash')} Hapus</button></div></div>`).join('')}</div>`
      : '<p class="note">Belum ada cerita.</p>'}</div>`;
  $('#stLevel').value = ed.level;
  $('#stForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = { title: $('#stTitle').value.trim(), level: +$('#stLevel').value, body: $('#stBody').value.trim() };
    if (ed.id) payload.id = ed.id;
    if (!payload.title || !payload.body) { $('#stNote').textContent = 'Judul dan isi wajib diisi.'; return; }
    $('#stNote').textContent = 'Menyimpan…';
    try { await api.saveStory(payload); STEDIT = null; toast(ed.id ? 'Cerita diperbarui.' : 'Cerita ditambahkan.'); tStories(); }
    catch (err) { $('#stNote').textContent = err.message; }
  });
}
function tSettings() {
  DRAFT = JSON.parse(JSON.stringify(SET));
  const shared = DECKS.filter((d) => !d.owner_id || d.status === 'public');
  $('#tview').innerHTML = `<div class="grid2">
    <div class="panel stack"><h2 class="h3">Sisi depan kartu</h2><p class="note">Tampilan yang boleh dipakai murid.</p>
      <div class="row">${MODES.map((m) => `<button class="chip" data-cfgmode="${m}" aria-pressed="${DRAFT.modes.includes(m)}">${MODE_LABEL[m]}</button>`).join('')}</div>
      <label class="field" for="defmode">Tampilan awal<select id="defmode">${DRAFT.modes.map((m) => `<option value="${m}" ${DRAFT.default_mode === m ? 'selected' : ''}>${MODE_LABEL[m]}</option>`).join('')}</select></label>
      <button class="switch" role="switch" aria-checked="${DRAFT.student_can_choose}" data-cfgtog="student_can_choose"><span class="track"></span>Murid boleh mengganti tampilan</button>
      <button class="switch" role="switch" aria-checked="${DRAFT.quiz_enabled}" data-cfgtog="quiz_enabled"><span class="track"></span>Aktifkan mode tebak</button>
      <button class="switch" role="switch" aria-checked="${DRAFT.mw_quiz}" data-cfgtog="mw_quiz"><span class="track"></span>Aktifkan kuis kata satuan (量词)</button>
      <button class="switch" role="switch" aria-checked="${DRAFT.all_can_create}" data-cfgtog="all_can_create"><span class="track"></span>Semua murid boleh membuat kartu sendiri</button>
      <button class="switch" role="switch" aria-checked="${DRAFT.ai_laoshi}" data-cfgtog="ai_laoshi"><span class="track"></span>Aktifkan AI Laoshi (tanya-jawab Mandarin)</button>
      <label class="field" for="aiName">Nama AI<input id="aiName" maxlength="20" value="${esc(DRAFT.ai_name || 'Laoshi')}" placeholder="Laoshi"></label>
      <p class="note">Kartu buatan murid hanya terlihat oleh pembuatnya, sampai kamu setujui di menu Persetujuan. AI Laoshi butuh Workers AI terpasang di Cloudflare (gratis); kalau belum, menunya tidak muncul.</p></div>
    <div class="panel stack"><h2 class="h3">Kategori untuk murid</h2><p class="note">Matikan kategori yang belum diajarkan.</p>
      <div class="row">${shared.map((d) => `<button class="chip" data-cfgdeck="${esc(d.id)}" aria-pressed="${!DRAFT.hidden_decks.includes(d.id)}"><span class="han">${esc(d.zh)}</span> ${esc(d.idn)}</button>`).join('')}</div></div>
  </div>
  <div class="row" style="margin-top:16px"><button class="btn" data-act="savecfg">${ic('check')} Simpan pengaturan</button><span class="note" id="cfgnote"></span></div>
  <form class="panel stack" id="acctForm" style="margin-top:20px;max-width:560px" novalidate><h2 class="h3">Akun guru & admin</h2>
    <div class="formgrid"><label class="field" for="gname">Nama guru<input id="gname" maxlength="40" value="${esc(ME.display_name)}"></label>
    <label class="field" for="gadmin">Nomor admin (WhatsApp)<input id="gadmin" inputmode="tel" maxlength="20" value="${esc(DRAFT.admin_phone || '')}" placeholder="08xxxxxxxxxx"></label></div>
    <p class="note">Nomor admin muncul di halaman masuk murid sebagai tombol "Hubungi admin" (lupa password, dll). Kosongkan untuk menyembunyikan.</p>
    <div><button class="btn" type="submit">${ic('check')} Simpan nama & admin</button></div><p class="note" id="acctnote"></p></form>
  <form class="panel stack" id="pwForm" style="margin-top:20px;max-width:560px" novalidate><h2 class="h3">Ganti password guru</h2>
    <div class="formgrid"><label class="field" for="po">Password lama<input id="po" type="password" autocomplete="current-password" maxlength="128"></label>
    <label class="field" for="pn">Password baru (min. 10)<input id="pn" type="password" autocomplete="new-password" maxlength="128"></label></div>
    <div><button class="btn secondary" type="submit">${ic('key')} Ganti password</button></div><p class="note" id="pwnote"></p></form>`;
  $('#acctForm').addEventListener('submit', async (e) => {
    e.preventDefault(); const n = $('#acctnote'); const nm = $('#gname').value.trim(); const ph = $('#gadmin').value.replace(/[^0-9+]/g, '').slice(0, 20);
    if (!nm) { n.textContent = 'Nama tidak boleh kosong.'; return; }
    n.textContent = 'Menyimpan…';
    try {
      if (nm !== ME.display_name) { const u = await api.setName(nm); ME = u; }
      DRAFT.admin_phone = ph; const c = cleanSettings(DRAFT); await api.saveSettings(c); SET = c;
      n.textContent = 'Tersimpan.'; toast('Nama & nomor admin disimpan.'); shell();
    } catch (err) { n.textContent = err.message; }
  });
  $('#pwForm').addEventListener('submit', async (e) => {
    e.preventDefault(); const n = $('#pwnote');
    if ($('#pn').value.length < 10) { n.textContent = 'Password baru minimal 10 karakter.'; return; }
    try { await api.changePassword($('#po').value, $('#pn').value); n.textContent = 'Password diganti. Perangkat lain otomatis keluar.'; $('#po').value = ''; $('#pn').value = ''; }
    catch (err) { n.textContent = err.message; }
  });
}

/* ================= event klik ================= */
// Keluar dari layar belajar: sesi disimpan supaya bisa dilanjutkan
function leaveStudy() {
  if (S.view === 'study' && Q && Q.sid) { saveRun(); RESUME_OK = true; if (PRES.state !== 'away') { PRES.state = 'away'; api.presence(Q.sid, 'away'); } toast('Sesi disimpan. Tekan Lanjutkan kapan saja.'); }
  stopBeat();
}
let endArmed = 0, LAST_TAP = { id: null, t: 0 };
document.addEventListener('click', async (e) => {
  if (!e.target.closest('#emojiPop') && !e.target.closest('[data-emo]')) closeEmoji();
  const b = e.target.closest('[data-startsel],[data-lesson],[data-saytext],[data-addunknown],[data-clearunknown],[data-clzbulk],[data-clzqhelp],[data-unselect],[data-clearsel],[data-typecheck],[data-clzsave],[data-clzdel],[data-freezecard],[data-freezedeck],[data-unfreezedeck],[data-unfreezecard],[data-clozecheck],[data-clozemc],[data-clozepick],[data-stedit],[data-stdel],[data-stnew],[data-story],[data-backlearn],[data-togpy],[data-sayall],[data-saysent],[data-trsent],[data-word],[data-pincard],[data-sayresp],[data-studypinned],[data-guide],[data-profile],[data-like],[data-studypost],[data-backfeed],[data-onb],[data-onbans],[data-sheetq],[data-aitip],[data-dl],[data-hsk],[data-studyhsk],[data-babpick],[data-babgo],[data-vis],[data-pstu],[data-lkind],[data-part],[data-pickstu],[data-mkind],[data-warn],[data-chatto],[data-endrun],[data-endall],[data-nav],[data-pick],[data-act],[data-mode],[data-rate],[data-t],[data-ttab],[data-sact],[data-stu],[data-cfgmode],[data-cfgtog],[data-cfgdeck],[data-edeck],[data-etab],[data-ncolor],[data-rcolor],[data-emo],[data-pick-emo],[data-rm],[data-approve]');
  if (!b) { const fc = e.target.closest('#fc'); if (fc && Q && Q.cur && Q.cur.answered) flip(); return; }
  const ds = b.dataset;
  if (ds.nav) { leaveStudy(); go(ds.nav); return; }
  if (ds.vis !== undefined) { ED.wantPublic = ds.vis === '1'; document.querySelectorAll('[data-vis]').forEach((x) => x.setAttribute('aria-pressed', x === b)); $('#visNote').textContent = ED.wantPublic ? 'Semua teman bisa memakai, setelah disetujui guru.' : 'Hanya kamu dan guru.'; return; }
  if (ds.pstu) { TF.student = ds.pstu; store.set('tf', TF); tProgress(); return; }
  if (ds.lkind) { S.kind = ds.lkind; S.split.part = 0; savePrefs(); renderLearn(); return; }
  if (ds.part !== undefined) { S.split.part = +ds.part; savePrefs(); document.querySelectorAll('[data-part]').forEach((x) => x.setAttribute('aria-pressed', x.dataset.part === ds.part)); updateStartFab(); return; }
  if (ds.pickstu) { const id = ds.pickstu; PICK.ids = PICK.ids.includes(id) ? PICK.ids.filter((x) => x !== id) : [...PICK.ids, id]; b.setAttribute('aria-pressed', PICK.ids.includes(id)); return; }
  if (ds.mkind) { document.querySelectorAll('[data-mkind]').forEach((x) => x.setAttribute('aria-pressed', x === b)); return; }
  if (ds.warn || ds.chatto) {
    const id = ds.warn || ds.chatto; PICK.mode = 'pick'; PICK.ids = [id];
    const sel = $('#mMode'); if (sel) { sel.value = 'pick'; $('#mPicks').hidden = false; document.querySelectorAll('[data-pickstu]').forEach((x) => x.setAttribute('aria-pressed', x.dataset.pickstu === id)); }
    if (ds.warn) { try { await api.message(WARN_PRESET, 'warn', { users: [id] }); toast('Peringatan muncul di layar murid.'); } catch (err) { toast(err.message); } return; }
    document.querySelector('[data-mkind="chat"]').click(); const t = $('#msgText'); t.scrollIntoView({ behavior: 'smooth', block: 'center' }); t.focus(); return;
  }
  if (ds.endrun || ds.endall) {
    const key = ds.endall ? 'all' : ds.endrun;
    if (LIVE_ARM !== key) { LIVE_ARM = key; b.dataset.armed = '1'; b.innerHTML = `${ic('stop')} ${ds.endall ? 'Ketuk lagi: akhiri semua' : 'Ketuk lagi'}`; setTimeout(() => { if (LIVE_ARM === key) LIVE_ARM = null; }, 4000); return; }
    LIVE_ARM = null;
    try { const r = await api.endRun(ds.endall ? { all: true } : { sid: ds.endrun }); toast(`${r.ended} sesi diakhiri. Murid langsung melihat pemberitahuan.`); if (LIVE_DRAW) LIVE_DRAW(); } catch (err) { toast(err.message); }
    return;
  }
  if (ds.clzbulk !== undefined) { runClozeBulk(); return; }
  if (ds.clzqhelp !== undefined) { const ta = $('#clzBulk'); if (ta) { ta.value = (ta.value ? ta.value + '\n' : '') + '我在看书。 | Saya sedang membaca buku.'; ta.focus(); } return; }
  if (ds.clzsave) {
    const row = b.closest('.clz-row'); if (!row) return;
    const s = row.querySelector('.clz-s').value.trim(), si = row.querySelector('.clz-si').value.trim();
    if (!s) { toast('Isi kalimatnya dulu.'); return; }
    b.disabled = true;
    try { const r = await api.setCloze(ds.clzsave, s, si); const row2 = CLZ.rows.find((x) => x.id === ds.clzsave); if (row2) { row2.s = r.s; row2.si = r.si; row2.source = 'manual'; } CLOZE.delete(ds.clzsave); toast('Kalimat disimpan.'); drawClozeList(); }
    catch (err) { toast(err.message); b.disabled = false; }
    return;
  }
  if (ds.clzdel) {
    try { await api.clearCloze(ds.clzdel); const row2 = CLZ.rows.find((x) => x.id === ds.clzdel); if (row2) { row2.s = ''; row2.si = ''; row2.source = ''; } CLOZE.delete(ds.clzdel); toast('Kalimat dihapus.'); drawClozeList(); }
    catch (err) { toast(err.message); }
    return;
  }
  if (ds.freezedeck !== undefined) { e.stopPropagation(); freezeDeck(ds.freezedeck, true); return; }
  if (ds.unfreezedeck !== undefined) { freezeDeck(ds.unfreezedeck, false); return; }
  if (ds.unfreezecard !== undefined) { freezeCard(ds.unfreezecard, false); renderLearn(); return; }
  if (ds.freezecard !== undefined) {
    if (!Q || !Q.cur) return; const id = Q.cur.c.id; freezeCard(id, true);
    if (Q.queue[0] && Q.queue[0].id === id) { Q.queue.shift(); Q.total = Math.max(Q.done, Q.total - 1); }
    renderStudy(); return;
  }
  if (ds.unselect) { S.sel = S.sel.filter((x) => x !== ds.unselect); savePrefs(); renderLearn(); return; }
  if (ds.clearsel !== undefined) { S.sel = []; S.split.part = 0; savePrefs(); renderLearn(); return; }
  if (ds.typecheck !== undefined) { const inp = document.getElementById('typeIn'); if (inp) checkType(inp.value); return; }
  if (ds.clozecheck !== undefined) { const inp = document.getElementById('clozeIn'); if (inp) checkCloze(inp.value); return; }
  if (ds.clozemc !== undefined) { showClozeMC(); return; }
  if (ds.clozepick) { checkCloze(ds.clozepick); return; }
  if (ds.stnew !== undefined) { STEDIT = null; tStories(); return; }
  if (ds.stedit) { try { STEDIT = await api.story(ds.stedit); window.scrollTo(0, 0); tStories(); } catch (err) { toast(err.message); } return; }
  if (ds.stdel) { if (armed !== 'st:' + ds.stdel) { armed = 'st:' + ds.stdel; b.innerHTML = `${ic('trash')} Yakin?`; setTimeout(() => { if (armed === 'st:' + ds.stdel) { armed = null; tStories(); } }, 3000); return; } armed = null; try { await api.deleteStory(ds.stdel); if (STEDIT && STEDIT.id === ds.stdel) STEDIT = null; toast('Cerita dihapus.'); tStories(); } catch (err) { toast(err.message); } return; }
  if (ds.lesson) { openLesson(ds.lesson); return; }
  if (ds.saytext) { speak(ds.saytext); return; }
  if (ds.addunknown !== undefined) { if (UNKNOWN.size) openDeckPicker([...UNKNOWN]); return; }
  if (ds.clearunknown !== undefined) { UNKNOWN = new Set(); reRenderReader(); return; }
  if (ds.story) { openStory(ds.story); return; }
  if (ds.backlearn !== undefined) { go('learn'); return; }
  if (ds.togpy !== undefined) { LOWPY = !LOWPY; renderStory(); return; }
  if (ds.sayall !== undefined) { if (STORY) speak(STORY.body.replace(/\n/g, '，')); return; }
  if (ds.saysent !== undefined) { const st = sentencesOf(STORY.body)[+ds.saysent]; if (st) speak(st); return; }
  if (ds.trsent !== undefined) { translateSent(+ds.trsent); return; }
  if (ds.word) { openWordSheet(ds.word); return; }
  if (ds.pincard !== undefined) { e.stopPropagation(); if (Q && Q.cur) togglePin(Q.cur.c.id, b); return; }
  if (ds.sayresp !== undefined) { e.stopPropagation(); if (Q && Q.cur && Q.cur.c.s) speak(Q.cur.c.s); return; }
  if (ds.studypinned !== undefined) { const cs = pinnedCards(); if (!cs.length) { toast('Belum ada kartu disematkan.'); return; } S.split.on = false; S.kind = 'card'; savePrefs(); startStudy(cs); return; }
  if (ds.guide !== undefined) { openGuide(); return; }
  if (ds.profile) { stopLive(); S.view = 'social'; savePrefs(); shell(); renderProfile(ds.profile); return; }
  if (ds.backfeed !== undefined) { renderFeed(); return; }
  if (ds.like) { toggleLike(ds.like, b); return; }
  if (ds.studypost) { studyPost(ds.studypost); return; }
  if (ds.aitip !== undefined) { aiSend(ds.aitip); return; }
  if (ds.dl !== undefined) { e.preventDefault(); e.stopPropagation(); downloadTable(ds.dl); return; }
  if (ds.hsk !== undefined) { const lv = +ds.hsk; HSK_OPEN = HSK_OPEN === lv ? 0 : lv; renderLearn(); if (HSK_OPEN) setTimeout(() => { const o = document.querySelector('.hsk-open'); if (o) o.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 60); return; }
  if (ds.studyhsk !== undefined) { S.sel = ['hsk' + ds.studyhsk]; S.split.on = false; S.kind = 'card'; savePrefs(); startStudy(); return; }
  if (ds.babpick !== undefined) { openBabPick(+ds.babpick); return; }
  if (ds.babgo !== undefined) { closeBabPick(); S.sel = [ds.babgo]; S.split.on = false; S.kind = 'card'; savePrefs(); startStudy(); return; }
  if (ds.pick) {
    const id = ds.pick;
    S.sel = S.sel.includes(id) ? S.sel.filter((x) => x !== id) : [...S.sel, id];
    savePrefs(); b.setAttribute('aria-pressed', S.sel.includes(id)); updateBucket(); updateStartFab(); return;
  }
  if (ds.startsel !== undefined) { if (!poolCards().length) { toast('Pilih kategori dulu.'); return; } if (!planCards().length) { toast('Semua kartu sudah terjadwal. Nyalakan "Latih semua" untuk mengulang.'); return; } startStudy(); return; }
  if (ds.mode) { S.mode = ds.mode; savePrefs(); if (Q && Q.queue.length) renderStudy(); return; }
  if (ds.t !== undefined && b.classList.contains('qo')) { answerQuiz(b); return; }
  if (ds.rate) { rate(+ds.rate); return; }
  if (ds.ttab) { S.ttab = ds.ttab; savePrefs(); stopLive(); renderTeach(); return; }
  if (ds.stu) { TF.student = ds.stu; store.set('tf', TF); tScores(); return; }
  if (ds.cfgmode) { const m = ds.cfgmode; DRAFT.modes = DRAFT.modes.includes(m) ? DRAFT.modes.filter((x) => x !== m) : MODES.filter((x) => DRAFT.modes.includes(x) || x === m); if (!DRAFT.modes.length) DRAFT.modes = [m]; if (!DRAFT.modes.includes(DRAFT.default_mode)) DRAFT.default_mode = DRAFT.modes[0]; b.setAttribute('aria-pressed', DRAFT.modes.includes(m)); $('#defmode').innerHTML = DRAFT.modes.map((x) => `<option value="${x}" ${DRAFT.default_mode === x ? 'selected' : ''}>${MODE_LABEL[x]}</option>`).join(''); return; }
  if (ds.cfgtog) { DRAFT[ds.cfgtog] = !DRAFT[ds.cfgtog]; b.setAttribute('aria-checked', DRAFT[ds.cfgtog]); return; }
  if (ds.cfgdeck) { const id = ds.cfgdeck; DRAFT.hidden_decks = DRAFT.hidden_decks.includes(id) ? DRAFT.hidden_decks.filter((x) => x !== id) : [...DRAFT.hidden_decks, id]; b.setAttribute('aria-pressed', !DRAFT.hidden_decks.includes(id)); return; }
  if (ds.edeck) { ED.deck = ds.edeck; ED.armDeck = false; ED.armCard = null; ED.renameColor = null; renderCards(); return; }
  if (ds.etab) { ED.tab = ds.etab; ED.armCard = null; renderCards(); return; }
  if (ds.ncolor) { ED.newColor = ds.ncolor; document.querySelectorAll('[data-ncolor]').forEach((x) => x.setAttribute('aria-pressed', x.dataset.ncolor === ED.newColor)); return; }
  if (ds.rcolor) { ED.renameColor = ds.rcolor; document.querySelectorAll('[data-rcolor]').forEach((x) => x.setAttribute('aria-pressed', x.dataset.rcolor === ED.renameColor)); return; }
  if (ds.emo !== undefined) { if ($('#emojiPop')) closeEmoji(); else openEmoji(b); return; }
  if (ds.pickEmo !== undefined) { setPic(ds.pickEmo); return; }
  if (ds.rm !== undefined) {
    const rowEl = b.closest('.crow'), i = +ds.rm;
    if (rowEl.dataset.kind === 'new') { const r = ED.rows[i]; if (!r) return; ED.text = ED.text.split(/\r?\n/).filter((l) => l.trim() !== r.line).join('\n'); $('#bulkText').value = ED.text; syncRows(); return; }
    const r = ED.list[i]; if (!r) return;
    if (ED.armCard !== r.id) { ED.armCard = r.id; $('#etab').innerHTML = listHTML(deckOf(ED.deck)); return; }
    ED.armCard = null; try { await api.deleteCard(r.id); await reloadContent(); toast(`Kartu ${r.h} dihapus.`); renderCards(); } catch (err) { toast(err.message); }
    return;
  }
  if (ds.approve) { try { await api.approve(ds.approve, ds.ok === '1'); await reloadContent(); shell(); toast(ds.ok === '1' ? 'Disetujui. Kategori ini sekarang tampil untuk murid.' : 'Kategori dikembalikan ke pembuatnya.'); renderTeach(); } catch (err) { toast(err.message); } return; }
  if (ds.sact) {
    const id = ds.id, s = STUDENTS.find((x) => x.id === id); if (!s) return;
    try {
      if (ds.sact === 'reset') { const r = await api.manage('reset_password', { id }); lastCred = { name: s.display_name, username: s.username, password: r.password }; toast('Password baru dibuat.'); }
      else if (ds.sact === 'off' || ds.sact === 'on') { await api.manage('set_active', { id, active: ds.sact === 'on' }); toast(ds.sact === 'on' ? 'Akun diaktifkan.' : 'Akun dinonaktifkan dan langsung keluar dari semua perangkat.'); }
      else if (ds.sact === 'create') { await api.manage('set_create', { id, allow: !s.can_create }); toast(!s.can_create ? `${s.display_name} sekarang boleh membuat kartu.` : `Izin membuat kartu ${s.display_name} dicabut.`); }
      else if (ds.sact === 'rename') { renameStudent(s); return; }
      else if (ds.sact === 'delete') { if (armed !== 'del:' + id) { armed = 'del:' + id; tStudents(); return; } armed = null; await api.manage('delete', { id }); toast('Akun dihapus.'); }
      STUDENTS = await api.students(); tStudents();
    } catch (err) { toast(err.message); }
    return;
  }
  const a = ds.act;
  if (a === 'logout') { stopBeat(); stopLive(); clearInterval(inboxT); await api.logout(); ME = null; Q = null; renderLogin(); }
  else if (a === 'selall') { const d2 = studyDecks(); S.sel = S.sel.length === d2.length ? [] : d2.map((d) => d.id); savePrefs(); renderLearn(); }
  else if (a === 'togall') { S.all = !S.all; savePrefs(); renderLearn(); }
  else if (a === 'start' || a === 'again') startStudy();
  else if (a === 'quit') { if (S.view === 'study') leaveStudy(); else stopBeat(); S.view = 'learn'; savePrefs(); shell(); renderLearn(); }
  else if (a === 'endrun') {
    if (!Q || S.view !== 'study') return;
    if (Date.now() - endArmed > 3000) { endArmed = Date.now(); b.innerHTML = `${ic('stop')} <span>Ketuk lagi</span>`; toast('Ketuk "Akhiri" sekali lagi untuk mengakhiri sesi. Skor dihitung dari kartu yang sudah dinilai.'); return; }
    endArmed = 0; renderDone(true);
  }
  else if (a === 'resume') resumeRun();
  else if (ds.onb !== undefined) { finishOnboard(+ds.onb); return; }
  else if (ds.onbans !== undefined) { onbAnswer(ds.onbans); return; }
  else if (a === 'onbtest') { startOnbTest(); }
  else if (a === 'onbskip') { store.set('onb_' + ME.id, true); go('learn'); }
  else if (a === 'reminder') { toggleReminder(); }
  else if (a === 'studylast') { const r = store.get('lastsess', null); if (!r) return; const ids = (r.decks || []).filter((id) => studyDecks().some((x) => x.id === id)); if (!ids.length) { toast('Kategorinya sudah tidak ada.'); return; } S.sel = ids; S.kind = r.kind === 'mw' && mwOn() ? 'mw' : 'card'; S.split.on = false; savePrefs(); startStudy(); }
  else if (a === 'clue') useClue();
  else if (a === 'install' && installEvt) { installEvt.prompt(); try { await installEvt.userChoice; } catch (_) { /* batal */ } installEvt = null; renderLearn(); }
  else if (a === 'noinstall') { store.set('noinstall', true); renderLearn(); }
  else if (a === 'sendsheet') openSendSheet();
  else if (a === 'senddeck') openSendSheet(ED.deck);
  else if (a === 'skip') skipCard();
  else if (a === 'closebar') { BAR_OPEN = false; renderActionbar(); }
  else if (a === 'closebab') closeBabPick();
  else if (a === 'custom') { if (!canCreate()) { toast('Gurumu belum mengizinkan membuat kartu sendiri.'); return; } ED.deck = null; ED.newOpen = true; ED.wantPublic = false; go('cards'); setTimeout(() => { const z = $('#ndz'); if (z) z.focus(); }, 50); }
  else if (a === 'lang') { S.lang = { id: 'en', en: 'both', both: 'id' }[S.lang] || 'id'; savePrefs(); b.textContent = LANG_LABEL[S.lang]; if (Q && Q.cur) { const cur = Q.cur; const f = document.querySelector('.face.front'), bk = document.querySelector('.face.bface'); if (bk) { bk.querySelectorAll('.m').forEach((x) => { x.textContent = mean(cur.c); }); } if (f && cur.m === 'arti') { const bi = f.querySelector('.bigid'); if (bi) bi.textContent = mean(cur.c); } } toast('Arti: ' + { id: 'bahasa Indonesia', en: 'English', both: 'Indonesia + English' }[S.lang]); }
  else if (a === 'ainew') { AICHAT = []; renderAI(); }
  else if (a === 'setphoto') { pickImage(async (f) => { toast('Mengunggah foto…'); try { const url = await api.setPhoto(f); ME.photo = url; toast('Foto profil diganti.'); if (S.view === 'learn') renderLearn(); shell(); } catch (err) { toast(err.message); } }); }
  else if (a === 'rmphoto') { try { await api.clearPhoto(); ME.photo = ''; toast('Foto dihapus.'); renderLearn(); } catch (err) { toast(err.message); } }
  else if (a === 'asklaoshi') { if (Q && Q.cur) openAiSheet(Q.cur.c); }
  else if (a === 'closeai') closeAiSheet();
  else if (ds.sheetq !== undefined) aiSheetSend(ds.sheetq);
  else if (a === 'mycards') { ED.newOpen = !editableDecks().length; go('cards'); }
  else if (a === 'endsaved') { await endSaved(); toast('Sesi lama diakhiri.'); }
  else if (a === 'nextpart') { S.split.part = Q.part.idx + 1; savePrefs(); S.view = 'learn'; shell(); renderLearn(); startStudy(); }
  else if (a === 'partprev' || a === 'partnext') { const ps = parts(); S.split.part = Math.max(0, Math.min(ps.length - 1, S.split.part + (a === 'partnext' ? 1 : -1))); savePrefs(); document.querySelectorAll('[data-part]').forEach((x) => x.setAttribute('aria-pressed', +x.dataset.part === S.split.part)); updateStartFab(); }
  else if (a === 'split') { S.split.on = !S.split.on; S.split.part = 0; savePrefs(); renderLearn(); }
  else if (a === 'preset') { $('#msgText').value = WARN_PRESET; document.querySelector('[data-mkind="warn"]').click(); }
  else if (a === 'newshared') { ED.shared = !ED.shared; b.setAttribute('aria-checked', ED.shared); }
  else if (a === 'deliver') {
    ED.deliverOpen = !ED.deliverOpen; const f = $('#deliverForm'); f.hidden = !ED.deliverOpen;
    if (ED.deliverOpen && !ED.stuLoaded) { try { STUDENTS = await api.students(); } catch (err) { toast(err.message); } ED.stuLoaded = true; const box = $('#deliverTo'); if (box) { box.innerHTML = toHTML('d'); bindTo('d'); } }
  }
  else if (a === 'sharedeck') { const d = deckOf(ED.deck); if (!d) return; const on = d.status === 'private'; try { await api.updateDeck({ id: d.id, shared: on }); await reloadContent(); toast(on ? 'Kategori tampil untuk semua murid.' : 'Kategori sekarang hanya untuk murid yang dikirimi.'); renderCards(); } catch (err) { toast(err.message); } }
  else if (a === 'flip') flip();
  else if (a === 'quiz') { S.quiz = !S.quiz; savePrefs(); renderStudy(); }
  else if (a === 'auto') { S.auto = !S.auto; savePrefs(); b.setAttribute('aria-pressed', S.auto); }
  else if (a === 'sfx') { S.sfx = !S.sfx; savePrefs(); b.setAttribute('aria-pressed', S.sfx); b.innerHTML = ic(S.sfx ? 'sparkle' : 'mute'); }
  else if (a === 'say') { e.stopPropagation(); if (Q && Q.cur) speak(sayText(Q.cur.c)); }
  else if (a === 'retryfinish') renderDone();
  else if (a === 'copycred' && lastCred) copyText(`${APP}\nNama: ${lastCred.name}\nUsername: ${lastCred.username}\nPassword: ${lastCred.password}\nLink: ${location.origin}`);
  else if (a === 'savecfg') { DRAFT.default_mode = $('#defmode').value; const _an = $('#aiName'); if (_an) DRAFT.ai_name = _an.value.trim() || 'Laoshi'; const c = cleanSettings(DRAFT); $('#cfgnote').textContent = 'Menyimpan…'; try { await api.saveSettings(c); SET = c; $('#cfgnote').textContent = 'Tersimpan. Berlaku untuk semua murid.'; toast('Pengaturan disimpan.'); } catch (err) { $('#cfgnote').textContent = err.message; } }
  else if (a === 'newdeck') { ED.newOpen = !ED.newOpen; $('#newDeckForm').hidden = !ED.newOpen; if (ED.newOpen) $('#ndz').focus(); }
  else if (a === 'renamedeck') { const f = $('#renameForm'); f.hidden = !f.hidden; }
  else if (a === 'deldeck') { if (!ED.armDeck) { ED.armDeck = true; b.dataset.armed = '1'; b.innerHTML = `${ic('trash')} Ketuk lagi untuk menghapus`; return; } ED.armDeck = false; try { await api.deleteDeck(ED.deck); ED.deck = null; await reloadContent(); toast('Kategori dan semua kartunya dihapus.'); renderCards(); } catch (err) { toast(err.message); } }
  else if (a === 'setpriv') { try { await api.submitDeck(ED.deck, false); await reloadContent(); toast('Kategori jadi privat: hanya kamu dan guru.'); renderCards(); } catch (err) { toast(err.message); } }
  else if (a === 'submitdeck') { if (deckOf(ED.deck)?.status !== 'private') return; try { await api.submitDeck(ED.deck); await reloadContent(); toast('Terkirim. Kategori tampil untuk teman setelah guru menyetujuinya.'); renderCards(); } catch (err) { toast(err.message); } }
  else if (a === 'hints') { S.hints = !S.hints; savePrefs(); b.setAttribute('aria-checked', S.hints); $('#rows').innerHTML = rowsHTML(); }
  else if (a === 'savebulk') saveBulk();
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') { closeEmoji(); closeAiSheet(); closeWordSheet(); closeGuide(); const dp = document.getElementById('deckPicker'); if (dp) dp.remove(); }
  if (S.view !== 'study' || !Q || !Q.cur || !$('#fc')) return;
  if (e.target.matches('input,select,textarea')) return;
  if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); if (Q.cur.answered) flip(); }
  else if (/^[1-4]$/.test(e.key)) { if (Q.cur.flipped) rate(+e.key); else if (!Q.cur.answered) { const o = document.querySelectorAll('.qo:not([disabled])')[+e.key - 1]; if (o) answerQuiz(o); } }
  else if (e.key.toLowerCase() === 's') speak(sayText(Q.cur.c));
  else if (e.key.toLowerCase() === 'h') useClue();
  else if (e.key.toLowerCase() === 'n' || e.key === 'ArrowRight') skipCard();
});

/* ---- efek sentuh di HP (sama seperti hover di PC) ---- */
document.addEventListener('pointerdown', (e) => {
  if (e.pointerType === 'mouse') return;
  const el = e.target.closest('.deck, .btn, .qo, .rb, .lv, .chip, .part'); if (!el || el.disabled) return;
  el.classList.remove('tap'); void el.offsetWidth; el.classList.add('tap');
  clearTimeout(el._tapT); el._tapT = setTimeout(() => el.classList.remove('tap'), 900);
}, { passive: true });

/* ================= pembaruan otomatis ================= */
async function checkVersion() {
  if (BUILD === 'dev') return;
  try {
    const r = await fetch('/version.json?t=' + Date.now(), { cache: 'no-store' }); const j = await r.json();
    if (j.build && j.build !== BUILD && !$('#update')) {
      const el = document.createElement('div'); el.className = 'toast on'; el.id = 'update'; el.setAttribute('role', 'status');
      Object.assign(el.style, { pointerEvents: 'auto', top: 'calc(76px + env(safe-area-inset-top, 0px))', bottom: 'auto' });
      el.innerHTML = 'Versi baru aplikasi tersedia. <button type="button" class="btn sm" style="margin-left:10px">Muat ulang</button>';
      el.querySelector('button').addEventListener('click', () => location.reload());
      document.body.appendChild(el);
    }
  } catch (_) { /* offline */ }
}
async function refreshContent() {
  if (!ME || ['study', 'done', 'cards'].includes(S.view)) return;
  try { await reloadContent(); shell(); if (S.view === 'learn') renderLearn(); } catch (_) { /* coba lagi nanti */ }
}
document.addEventListener('visibilitychange', () => { if (!document.hidden) { checkVersion(); refreshContent(); } });
setInterval(() => { checkVersion(); refreshContent(); }, 5 * 60 * 1000);

/* ================= web app (bisa dipasang di HP) ================= */
let installEvt = null;
if ('serviceWorker' in navigator && location.protocol === 'https:') window.addEventListener('load', () => { navigator.serviceWorker.register('/sw.js').catch(() => {}); });
const standalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); installEvt = e; if (S.view === 'learn' && ME) renderLearn(); });
window.addEventListener('appinstalled', () => { installEvt = null; toast('Aplikasi terpasang di layar utama.'); if (S.view === 'learn' && ME) renderLearn(); });
const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent);
function installHTML() {
  if (standalone() || store.get('noinstall', false)) return '';
  if (!installEvt && !isIOS()) return '';
  return `<div class="install"><img src="/icon-192.png" alt=""><div><b>Pasang di HP</b><span>${installEvt ? 'Buka seperti aplikasi, langsung dari layar utama.' : 'Ketuk tombol Bagikan lalu “Tambahkan ke Layar Utama”.'}</span></div>
    <div class="row">${installEvt ? `<button class="btn sm" data-act="install">Pasang</button>` : ''}<button class="icon-btn" data-act="noinstall" aria-label="Tutup">${ic('x')}</button></div></div>`;
}

/* ================= onboarding: tentukan level ================= */
const needsOnboard = () => !isTeacher() && (ME.level || 0) === 0 && !store.get('onb_' + ME.id, false);
const maybeGuide = () => { if (ME && !isTeacher() && !store.get('guide_' + ME.id, false)) setTimeout(openGuide, 500); };
function enterApp() {
  if (needsOnboard()) renderOnboard(); else { go(S.view); maybeGuide(); }
  startInbox(); startReminders();
}
function finishOnboard(lv) {
  store.set('onb_' + ME.id, true);
  if (lv) { ME.level = lv; api.setLevel(lv).catch(() => {}); S.sel = ['hsk' + lv]; HSK_OPEN = lv; S.kind = 'card'; S.split.on = false; savePrefs(); }
  go('learn'); maybeGuide();
  if (lv) setTimeout(() => { const o = document.querySelector('.hsk-open'); if (o) o.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 120);
}
let ONB = null;
const LVL_DESC = { 1: 'Pemula · sapaan, angka, keluarga, benda sehari-hari', 2: 'Dasar+ · kegiatan, waktu, tempat, perasaan', 3: 'Menengah · cerita, pendapat, kalimat panjang' };
function renderOnboard() {
  hideShell();
  $('#view').innerHTML = `<div class="onb"><div class="onb-box">
    <h1 class="h1">Selamat datang, ${esc(ME.display_name)}! 🎉</h1>
    <p class="sub">Mau mulai dari mana? Kamu bisa ganti kapan saja nanti.</p>
    <div class="onb-opts">
      <button class="onb-card zero" data-onb="1"><span class="t">Dari nol</span><span class="d">Belum pernah belajar — mulai HSK 级1</span></button>
      ${[1, 2, 3].map((lv) => `<button class="onb-card lv${lv}" data-onb="${lv}"><span class="badge">HSK 级${lv}</span><span class="t">Saya di level ini</span><span class="d">${LVL_DESC[lv]}</span></button>`).join('')}
    </div>
    <div class="row" style="justify-content:center;margin-top:16px"><button class="btn" data-act="onbtest">${ic('sparkle')} Tes singkat (6 soal)</button><button class="btn ghost" data-act="onbskip">Lewati</button></div>
    <p class="note" style="text-align:center;margin-top:10px">Tes singkat opsional — menebak level dari 6 pertanyaan.</p>
  </div></div>`;
}
function startOnbTest() {
  const pool = (lv) => DECKS.filter((d) => d.hskLevel === lv && !d.hskLesson).flatMap((d) => d.cards).filter((c) => c.m);
  const pick = (arr, n) => shuffle(arr).slice(0, n);
  const qs = [];
  for (const lv of [1, 2, 3]) {
    for (const c of pick(pool(lv), 2)) {
      const others = shuffle(pool(lv).filter((x) => x.m !== c.m)).slice(0, 3).map((x) => x.m);
      qs.push({ lv, h: c.h, p: c.p, answer: c.m, opts: shuffle([c.m, ...others]) });
    }
  }
  ONB = { qs, idx: 0, correct: 0, byLv: { 1: 0, 2: 0, 3: 0 } };
  renderOnbTest();
}
function renderOnbTest() {
  if (ONB.idx >= ONB.qs.length) { onbResult(); return; }
  const q = ONB.qs[ONB.idx];
  hideShell();
  $('#view').innerHTML = `<div class="onb"><div class="onb-box">
    <div class="onb-prog"><i style="width:${(ONB.idx / ONB.qs.length) * 100}%"></i></div>
    <p class="eyebrow" style="text-align:center">Soal ${ONB.idx + 1} dari ${ONB.qs.length}</p>
    <div class="onb-q"><div class="han">${esc(q.h)}</div><div class="py">${esc(q.p)}</div><div class="ask">Apa artinya?</div></div>
    <div class="onb-ans">${q.opts.map((o) => `<button class="onb-o" data-onbans="${esc(o)}">${esc(o)}</button>`).join('')}</div>
    <div class="row" style="justify-content:center;margin-top:10px"><button class="btn ghost sm" data-act="onbskip">Lewati tes</button></div>
  </div></div>`;
}
function onbAnswer(ans) {
  const q = ONB.qs[ONB.idx];
  const ok = ans === q.answer;
  if (ok) { ONB.correct++; ONB.byLv[q.lv]++; }
  const btns = document.querySelectorAll('.onb-o');
  btns.forEach((b) => { b.disabled = true; if (b.dataset.onbans === q.answer) b.classList.add('right'); else if (b.dataset.onbans === ans) b.classList.add('wrong'); });
  if (ok) SFX.right(); else SFX.wrong();
  setTimeout(() => { ONB.idx++; renderOnbTest(); }, 750);
}
function onbResult() {
  let lv = 1;
  if (ONB.correct >= 5) lv = 3; else if (ONB.correct >= 3) lv = 2; else lv = 1;
  if (ONB.byLv[3] >= 1 && ONB.correct >= 4) lv = 3;
  hideShell();
  $('#view').innerHTML = `<div class="onb"><div class="onb-box" style="text-align:center">
    <div class="ring" style="--p:${Math.round(ONB.correct / ONB.qs.length * 100)}"><div>${ONB.correct}/${ONB.qs.length}</div></div>
    <h1 class="h1">Rekomendasi: <span class="han">HSK 级${lv}</span></h1>
    <p class="sub">Dari ${ONB.qs.length} soal, kamu benar ${ONB.correct}. Mulai dari 级${lv} ya — bisa diganti kapan saja.</p>
    <div class="row" style="justify-content:center;margin-top:14px"><button class="btn lg" data-onb="${lv}">${ic('play')} Mulai HSK 级${lv}</button></div>
    <div class="row" style="justify-content:center;margin-top:8px">${[1, 2, 3].filter((x) => x !== lv).map((x) => `<button class="chip" data-onb="${x}">Pilih 级${x} saja</button>`).join('')}</div>
  </div></div>`;
}

/* ================= pengingat (notifikasi) ================= */
const REMIND_MSGS = [
  '📚 Laoshi kangen! Yuk latihan 5 kartu Mandarin hari ini 加油!',
  '🐼 Si panda nunggu kamu belajar hanzi. Buka Flashcard Tamer yuk!',
  '✍️ 今天学了吗? Sudah belajar hari ini belum? Ketuk untuk mulai.',
  '🔥 Jaga api semangatmu! Belajar 1 pelajaran biar makin jago.',
  '⭐ Sedikit tiap hari = pintar selamanya. Ayo buka kartumu!',
  '🎯 Target hari ini: kalahkan kartu kemarin. Bisa!',
  '🍜 Istirahat sebentar, lalu santap 5 kosakata baru. 好吃!',
  '🚀 10 menit sekarang > 2 jam besok. Mulai belajar yuk!',
];
function remindOn() { return store.get('remind', false) && 'Notification' in window && Notification.permission === 'granted'; }
async function toggleReminder() {
  if (!('Notification' in window)) { toast('HP/browser ini tidak mendukung notifikasi.'); return; }
  if (store.get('remind', false)) { store.set('remind', false); toast('Pengingat dimatikan.'); if (S.view === 'learn') renderLearn(); return; }
  let perm = Notification.permission;
  if (perm !== 'granted') perm = await Notification.requestPermission();
  if (perm !== 'granted') { toast('Izin notifikasi belum diberikan.'); return; }
  store.set('remind', true); store.set('remindAt', store.get('remindAt', 19));
  toast('Pengingat dinyalakan. Kami ingatkan kalau kamu belum belajar.');
  notify(REMIND_MSGS[0], true); // contoh langsung
  if (S.view === 'learn') renderLearn();
}
async function notify(msg, force) {
  if (!remindOn()) return;
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    const body = msg || REMIND_MSGS[(Math.random() * REMIND_MSGS.length) | 0];
    if (reg && reg.showNotification) await reg.showNotification('Flashcard Tamer', { body, icon: '/icon-192.png', badge: '/icon-192.png', tag: 'reminder', renotify: true });
    else new Notification('Flashcard Tamer', { body, icon: '/icon-192.png' });
    if (!force) store.set('lastNotif', Date.now());
  } catch (_) { /* abaikan */ }
}
const studiedToday = () => { const r = store.get('lastsess', null); return r && new Date(r.at).toDateString() === new Date().toDateString(); };
let remindT = 0;
function startReminders() {
  clearInterval(remindT);
  if (isTeacher()) return;
  const check = () => {
    if (!remindOn()) return;
    const at = store.get('remindAt', 19); const now = new Date();
    const last = store.get('lastNotif', 0);
    const sameDay = new Date(last).toDateString() === now.toDateString();
    if (now.getHours() >= at && !studiedToday() && !sameDay) notify();
  };
  remindT = setInterval(check, 5 * 60 * 1000); setTimeout(check, 8000);
  // saat app ditinggal, jadwalkan pengingat ringan (best-effort)
  window.addEventListener('visibilitychange', () => { if (document.hidden && remindOn() && !studiedToday()) { /* best-effort: beberapa HP tetap jalankan timer sebentar */ setTimeout(() => notify(), 60 * 60 * 1000); } });
}

/* ================= mulai ================= */
(async function boot() {
  document.title = APP;
  $('#view').innerHTML = '<div class="auth"><p class="note">Memuat…</p></div>';
  try { ME = await api.profile(); } catch (_) { ME = null; }
  if (!ME) {
    try { const st = await api.setupStatus(); if (st) ADMIN_PHONE = st.admin_phone || ''; if (st && st.needsSetup) { renderSetup(st.configured); return; } } catch (_) { /* tampilkan login */ }
    renderLogin(); return;
  }
  try { await loadAll(); } catch (e) { renderLogin(e.message); return; }
  enterApp();
  checkVersion();
})();
