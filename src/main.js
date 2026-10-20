import './style.css';
import IMG from './data/images.json';
import MW from './data/mw.json';
import { makeHttpApi } from './api/http.js';
import { makeDemoApi } from './api/demo.js';
import { hbars, lineChart } from './charts.js';

const api = import.meta.env.DEV || import.meta.env.VITE_DEMO === '1' ? makeDemoApi() : makeHttpApi();
const BUILD = typeof __BUILD_ID__ === 'string' ? __BUILD_ID__ : 'dev';

/* ================= helpers ================= */
const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"'`]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;', '`': '&#96;' }[c]));
const shuffle = (a) => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; };
const yi = (m) => (MW[m] && MW[m][1] === 4 ? 'yí' : 'yì');
const fmtDate = (t, o = { dateStyle: 'medium', timeStyle: 'short' }) => new Date(t).toLocaleString('id-ID', o);
const secs = (ms) => (ms / 1000).toFixed(ms < 10000 ? 1 : 0) + ' dtk';
const store = { get(k, d) { try { const v = localStorage.getItem('afw_' + k); return v === null ? d : JSON.parse(v); } catch (_) { return d; } }, set(k, v) { try { localStorage.setItem('afw_' + k, JSON.stringify(v)); } catch (_) { /* abaikan */ } } };
const SVGSRC = {};
const svgSrc = (k) => SVGSRC[k] || (SVGSRC[k] = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(IMG[k]));

const ICON = {
  learn: '<rect x="3" y="5" width="13" height="16" rx="2"/><path d="M8 3h11a2 2 0 0 1 2 2v13"/>',
  hist: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5M12 7v5l3 2"/>',
  teach: '<path d="M3 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2"/><circle cx="9" cy="8" r="4"/><path d="M17 11l2 2 4-4"/>',
  out: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>',
  back: '<path d="M15 18l-6-6 6-6"/>', check: '<path d="M5 12l5 5L20 7"/>', plus: '<path d="M12 5v14M5 12h14"/>',
  trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>', copy: '<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/>',
  play: '<path d="M7 4l13 8-13 8z"/>', flip: '<path d="M4 12a8 8 0 0 1 14-5.3L20 9"/><path d="M20 4v5h-5M20 12a8 8 0 0 1-14 5.3L4 15"/><path d="M4 20v-5h5"/>',
  sound: '<path d="M11 5L6 9H3v6h3l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13"/>', mute: '<path d="M11 5L6 9H3v6h3l5 4z"/><path d="M22 9l-6 6M16 9l6 6"/>',
  users: '<circle cx="9" cy="8" r="4"/><path d="M2 21v-1a6 6 0 0 1 6-6h2a6 6 0 0 1 6 6v1M16 4a4 4 0 0 1 0 8M22 21v-1a6 6 0 0 0-4-5.6"/>',
  chart: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>', clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1"/>',
  cards: '<rect x="3" y="7" width="13" height="14" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3"/>',
  key: '<circle cx="7.5" cy="15.5" r="4.5"/><path d="M11 12l9-9M17 6l3 3"/>', lock: '<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
};
const ic = (n) => `<svg class="i" viewBox="0 0 24 24" aria-hidden="true">${ICON[n]}</svg>`;
let toastT;
function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('on'), 2600); }
async function copyText(txt) { try { await navigator.clipboard.writeText(txt); toast('Disalin'); } catch (_) { toast('Tidak bisa menyalin otomatis. Pilih teksnya lalu salin manual.'); } }

/* ---- suara ---- */
let AC = null;
function tone(seq) {
  if (!S.sfx) return;
  try {
    AC = AC || new (window.AudioContext || window.webkitAudioContext)(); const t0 = AC.currentTime;
    seq.forEach(([f, d, st, type]) => { const o = AC.createOscillator(), g = AC.createGain(); o.type = type || 'sine'; o.frequency.value = f; g.gain.setValueAtTime(0.0001, t0 + st); g.gain.exponentialRampToValueAtTime(0.18, t0 + st + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t0 + st + d); o.connect(g).connect(AC.destination); o.start(t0 + st); o.stop(t0 + st + d + 0.02); });
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
  const b = document.createElement('div'); b.className = 'burst'; const cols = ['#ffd21f', '#2a7bd8', '#e8513f', '#1b9a5a', '#e0559b', '#7a4fd0'];
  for (let i = 0; i < n; i++) { const p = document.createElement('i'); p.style.left = Math.random() * 100 + 'vw'; p.style.background = cols[i % cols.length]; p.style.setProperty('--dx', (Math.random() * 160 - 80) + 'px'); p.style.setProperty('--r', (Math.random() * 720 - 360) + 'deg'); p.style.animationDelay = Math.random() * 0.25 + 's'; b.appendChild(p); }
  document.body.appendChild(b); setTimeout(() => b.remove(), 2000);
}
function cheer(text, color) { const c = $('#cheer'); c.textContent = text; c.style.background = color; c.classList.remove('on'); void c.offsetWidth; c.classList.add('on'); }

/* ================= state ================= */
const MODES = ['pic', 'han', 'arti', 'mix'];
const MODE_LABEL = { pic: 'Gambar', han: '汉字', arti: 'Arti', mix: 'Campur' };
const RATE = { 1: { l: 'Susah', w: 'lagi segera', gap: 2 }, 2: { l: 'Lumayan', w: 'nanti lagi', gap: 7 }, 3: { l: 'Bisa', w: 'besok', days: 1 }, 4: { l: 'Mudah', w: '3 hari', days: 3 } };
const COLORS = ['#e8513f', '#f08a24', '#e0b51b', '#3aa65b', '#2f9e8f', '#1f7fd1', '#3b4fc4', '#7a4fd0', '#e0559b', '#5b6789'];
const S = Object.assign({ mode: 'pic', quiz: true, auto: true, sfx: true, all: false, sel: [], view: 'learn', ttab: 'students' }, store.get('prefs', {}));
const savePrefs = () => store.set('prefs', { mode: S.mode, quiz: S.quiz, auto: S.auto, sfx: S.sfx, all: S.all, sel: S.sel, view: S.view === 'study' ? 'learn' : S.view, ttab: S.ttab });
let ME = null, SET = null, DECKS = [], CARDS = [], SRS = {}, Q = null, STUDENTS = [];
const isTeacher = () => ME && ME.role === 'teacher';

function cleanSettings(s) {
  s = s || {};
  const modes = Array.isArray(s.modes) ? s.modes.filter((m) => MODES.includes(m)) : MODES.slice();
  const ms = modes.length ? modes : ['pic'];
  return { modes: ms, default_mode: ms.includes(s.default_mode) ? s.default_mode : ms[0], student_can_choose: s.student_can_choose !== false, quiz_enabled: s.quiz_enabled !== false, hidden_decks: Array.isArray(s.hidden_decks) ? s.hidden_decks.filter((x) => typeof x === 'string') : [] };
}
function applyContent(c) {
  SET = cleanSettings(c.settings);
  CARDS = (c.cards || []).filter((x) => x && typeof x.id === 'string' && typeof x.h === 'string');
  const by = {};
  for (const card of CARDS) (by[card.deck_id] ||= []).push(card);
  DECKS = (c.decks || []).filter((d) => d && typeof d.id === 'string').map((d) => ({ ...d, color: /^#[0-9a-f]{6}$/i.test(d.color) ? d.color : '#2340b8', cards: by[d.id] || [] }));
}
const visibleDecks = () => DECKS.filter((d) => d.cards.length && (isTeacher() || !SET.hidden_decks.includes(d.id)));
const deckOf = (id) => DECKS.find((d) => d.id === id);
const isDue = (c) => { const r = SRS[c.id]; return !r || r.due <= Date.now(); };
const isNew = (c) => !SRS[c.id];
const effMode = () => (SET.student_can_choose && SET.modes.includes(S.mode) ? S.mode : SET.default_mode);

/* ---- gambar kartu (hanya sumber yang diizinkan) ---- */
function safeImgUrl(p) {
  if (api.demo && /^data:image\/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/=]+$/.test(p)) return p;
  return /^\/api\/img\/[a-f0-9]{32}$/.test(p) ? p : '';
}
function picHTML(c) {
  const p = c.pic || '';
  if (/^i\d+$/.test(p) && IMG[p]) return `<img src="${svgSrc(p)}" alt="">`;
  const u = safeImgUrl(p);
  if (u) return `<img src="${esc(u)}" alt="" loading="lazy" referrerpolicy="no-referrer">`;
  if (p && [...p].length <= 8 && !/[<>/\\]/.test(p)) return `<span class="emo">${esc(p)}</span>`;
  return '';
}
const hasPic = (c) => picHTML(c) !== '';

/* ================= shell ================= */
function shell() {
  const nav = [['learn', 'learn', 'Belajar'], ['hist', 'hist', 'Riwayat']];
  if (isTeacher()) nav.push(['teach', 'teach', 'Guru']);
  $('#topin').innerHTML = `<img class="logo" src="/logo.jpg" alt="Alvaro Education Centre">
    <nav class="nav" aria-label="Menu">${nav.map(([v, i, l]) => `<button data-nav="${v}" aria-label="${l}" ${S.view === v || (S.view === 'study' && v === 'learn') ? 'aria-current="page"' : ''}>${ic(i)}<span>${l}</span></button>`).join('')}</nav>
    <button class="icon-btn" data-act="logout" aria-label="Keluar" title="Keluar">${ic('out')}</button>`;
}
function go(v) {
  if (v === 'teach' && !isTeacher()) v = 'learn';
  S.view = v; savePrefs(); shell(); window.scrollTo(0, 0);
  ({ learn: renderLearn, hist: renderHist, teach: renderTeach })[v]();
}

/* ================= login ================= */
function renderLogin(msg = '') {
  $('#topin').innerHTML = ''; $('.top').hidden = true; $('#selbar').hidden = true;
  $('#view').innerHTML = `<div class="login"><form class="panel" id="loginForm" autocomplete="on" novalidate>
    <img class="logo-big" src="/logo.jpg" alt="Alvaro Education Centre">
    <h1 class="han">闪卡 Flashcard</h1>
    <label class="field" for="lu">Username<input id="lu" name="username" autocomplete="username" autocapitalize="none" spellcheck="false" maxlength="80" required></label>
    <label class="field" for="lp">Password<input id="lp" name="password" type="password" autocomplete="current-password" maxlength="72" required></label>
    <div class="err" id="lerr" role="alert">${esc(msg)}</div>
    <button class="btn" type="submit" id="lbtn">${ic('lock')} Masuk</button>
    ${api.demo ? '<div class="demo"><b>Mode demo</b> (hanya untuk uji di komputer, bukan versi online). Guru: <b>guru</b> / <b>guru123</b> · Murid: <b>budi</b> / <b>budi123</b></div>' : '<p class="note">Akun dibuatkan oleh gurumu. Lupa password? Minta guru membuatkan password baru.</p>'}
  </form></div>`;
  $('#loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = $('#lbtn'); btn.disabled = true; $('#lerr').textContent = '';
    try { ME = await api.login($('#lu').value, $('#lp').value); $('.top').hidden = false; await loadAll(); go(isTeacher() ? (S.view === 'teach' ? 'teach' : 'learn') : 'learn'); }
    catch (err) { $('#lerr').textContent = err.message; btn.disabled = false; $('#lp').value = ''; $('#lp').focus(); }
  });
}
function renderSetup(configured) {
  $('#topin').innerHTML = ''; $('.top').hidden = true; $('#selbar').hidden = true;
  $('#view').innerHTML = `<div class="login"><form class="panel" id="setupForm" novalidate>
    <img class="logo-big" src="/logo.jpg" alt="Alvaro Education Centre">
    <h1>Buat akun guru</h1>
    <p class="note">Langkah ini hanya sekali. Masukkan <b>SETUP_CODE</b> yang kamu isi di Cloudflare.</p>
    ${configured ? '' : '<div class="demo">SETUP_CODE belum diatur di Cloudflare. Ikuti langkah 5 di panduan, lalu deploy ulang.</div>'}
    <label class="field" for="xc">Kode setup<input id="xc" type="password" autocomplete="off" maxlength="128"></label>
    <label class="field" for="xn">Nama guru<input id="xn" maxlength="40" placeholder="Laoshi Elvies"></label>
    <label class="field" for="xu">Username guru<input id="xu" maxlength="24" autocapitalize="none" spellcheck="false" placeholder="guru"></label>
    <label class="field" for="xp">Password (min. 10 karakter)<input id="xp" type="password" autocomplete="new-password" maxlength="128"></label>
    <label class="field" for="xp2">Ulangi password<input id="xp2" type="password" autocomplete="new-password" maxlength="128"></label>
    <div class="err" id="xerr" role="alert"></div>
    <button class="btn" type="submit" id="xbtn">${ic('lock')} Buat akun guru</button>
  </form></div>`;
  $('#setupForm').addEventListener('submit', async (e) => {
    e.preventDefault(); const err = $('#xerr'); err.textContent = '';
    if ($('#xp').value !== $('#xp2').value) { err.textContent = 'Kedua password tidak sama.'; return; }
    if ($('#xp').value.length < 10) { err.textContent = 'Password minimal 10 karakter.'; return; }
    const btn = $('#xbtn'); btn.disabled = true;
    try {
      ME = await api.setup({ code: $('#xc').value, display_name: $('#xn').value, username: $('#xu').value, password: $('#xp').value });
      $('.top').hidden = false; await loadAll(); S.ttab = 'students'; go('teach'); toast('Akun guru dibuat. Selamat datang!');
    } catch (ex) { err.textContent = ex.message; btn.disabled = false; }
  });
}
async function loadAll() {
  applyContent(await api.content());
  try { SRS = await api.srs(); } catch (_) { SRS = {}; }
  if (!S.sel.length) S.sel = visibleDecks().slice(0, 1).map((d) => d.id);
}

/* ================= Belajar ================= */
const selCards = () => visibleDecks().filter((d) => S.sel.includes(d.id)).flatMap((d) => d.cards);
function renderLearn() {
  Q = null; document.documentElement.style.setProperty('--c', '#2340b8');
  const ds = visibleDecks(); S.sel = S.sel.filter((id) => ds.some((d) => d.id === id));
  const dueAll = ds.flatMap((d) => d.cards).filter(isDue).length;
  const first = [...(ME.display_name || ME.username)][0] || '?';
  $('#view').innerHTML = `<div class="hello"><div class="av" aria-hidden="true">${esc(first.toUpperCase())}</div><div><h2>Halo, ${esc(ME.display_name)}!</h2><p>${dueAll ? `Ada ${dueAll} kartu yang siap kamu pelajari hari ini.` : 'Semua kartu sudah terjadwal. Hebat!'}</p></div></div>
    <div class="head-row" style="margin-top:14px"><p class="sub">Pilih satu kategori atau lebih. Setelah kartu dibalik, nilai dirimu: <b>1</b> & <b>2</b> diulang di sesi ini, <b>3</b> muncul besok, <b>4</b> muncul 3 hari lagi.</p>
    <button class="chip" data-act="selall">${S.sel.length === ds.length ? 'Kosongkan pilihan' : 'Pilih semua'}</button></div>
    <div class="decks">${ds.map((d) => {
      const due = d.cards.filter(isDue).length, nw = d.cards.filter(isNew).length, sched = d.cards.length - due, on = S.sel.includes(d.id);
      const pics = d.cards.filter(hasPic).slice(0, 3).map(picHTML).join('') || `<span class="han" style="font-size:26px">${esc(d.cards[0]?.h || '')}</span>`;
      return `<button class="deck" data-pick="${esc(d.id)}" aria-pressed="${on}" style="--dc:${d.color}"><span class="chk">${ic('check')}</span><div class="pics">${pics}</div>
        ${!d.builtin ? '<span class="badge">Buatan guru</span>' : ''}${isTeacher() && SET.hidden_decks.includes(d.id) ? '<span class="tag-off">Disembunyikan dari murid</span>' : ''}
        <div class="zh">${esc(d.zh)}</div><div class="id">${esc(d.idn)}</div>
        <div class="bar"><i style="width:${(sched / d.cards.length) * 100}%"></i></div>
        <div class="due"><b>${due}</b> siap · ${nw} baru · ${sched} terjadwal</div></button>`;
    }).join('') || '<p class="note">Belum ada kategori yang bisa dipelajari.</p>'}</div>`;
  renderSelbar();
}
function renderSelbar() {
  const bar = $('#selbar'); if (S.view !== 'learn') { bar.hidden = true; return; } bar.hidden = false;
  const cs = selCards(), due = cs.filter(isDue).length, n = S.all ? cs.length : due;
  bar.innerHTML = `<div class="in"><div class="info">${S.sel.length} kategori · ${n} kartu<small>${S.all ? 'Semua kartu, jadwal diabaikan' : due + ' kartu siap (baru + jatuh tempo)'}</small></div>
    <button class="chip" data-act="togall" aria-pressed="${S.all}">Latih semua</button>
    <button class="btn" data-act="start" ${n ? '' : 'disabled'}>${ic('play')} Mulai (acak)</button></div>`;
}

/* ================= sesi belajar ================= */
let hiddenAt = 0;
document.addEventListener('visibilitychange', () => {
  if (!Q || !Q.cur) return;
  if (document.hidden) hiddenAt = performance.now();
  else if (hiddenAt) { Q.cur.hidden += performance.now() - hiddenAt; hiddenAt = 0; }
});
async function withRetry(fn, tries = 3) {
  for (let i = 0; ; i++) { try { return await fn(); } catch (e) { if (i >= tries - 1) throw e; await new Promise((r) => setTimeout(r, 600 * (i + 1))); } }
}
async function startStudy() {
  let cs = selCards(); if (!S.all) cs = cs.filter(isDue); if (!cs.length) return;
  const btn = document.querySelector('[data-act="start"]'); if (btn) btn.disabled = true;
  const mode = effMode();
  let sid;
  try { sid = await api.startSession([...new Set(cs.map((c) => c.deck_id))], mode); }
  catch (e) { toast(e.message); if (btn) btn.disabled = false; return; }
  Q = { sid, queue: shuffle(cs), total: cs.length, done: 0, mode, chain: Promise.resolve(), failed: 0, streak: 0, started: Date.now() };
  S.view = 'study'; $('#selbar').hidden = true; shell(); renderStudy();
}
function cardMode(c) { let m = effMode(); if (m === 'mix') m = ['pic', 'han', 'arti'][(Math.random() * 3) | 0]; if (m === 'pic' && !hasPic(c)) m = 'han'; return m; }
function frontHTML(c, m) {
  if (m === 'han') return `<div class="bighan">${esc(c.h)}</div><div class="q">Apa artinya?</div>`;
  if (m === 'arti') return `<div class="bigid">${esc(c.m)}</div><div class="q">Bahasa Mandarinnya apa?</div>`;
  return `<div class="big">${picHTML(c)}</div><div class="q">Ini apa dalam bahasa Mandarin?</div>`;
}
function backHTML(c) {
  const L = [...c.h].length; let extra = '';
  if (c.mw) { const d = MW[c.mw] || ['', 0, '']; extra = `<div class="extra"><div class="z">一<b>${esc(c.mw)}</b>${esc(c.h)}</div>${d[0] ? `<div class="y">${yi(c.mw)} ${esc(d[0])} ${esc(c.p)}</div>` : ''}${c.alt && c.alt.length ? `<div class="a">juga: ${c.alt.map((a) => '一' + esc(a) + esc(c.h)).join(' / ')}</div>` : ''}</div>`; }
  else if (c.s) extra = `<div class="extra">${c.opp ? `<div class="z">↔ <b>${esc(c.opp)}</b></div>` : ''}<div class="s">${esc(c.s)}</div><div class="y">${esc(c.sp)}</div><div class="a">${esc(c.si)}</div></div>`;
  return `${hasPic(c) ? `<div class="sm">${picHTML(c)}</div>` : ''}<div class="h ${L >= 5 ? 'l5' : L === 4 ? 'l4' : ''}">${esc(c.h)}</div>${c.p ? `<div class="p">${esc(c.p)}</div>` : ''}<div class="m">${esc(c.m)}</div>${extra}`;
}
const sayText = (c) => (c.mw ? c.h : c.s || c.h);
function renderStudy() {
  if (!Q.queue.length) { renderDone(); return; }
  const c = Q.queue[0], d = deckOf(c.deck_id) || { zh: '', color: '#2340b8', cards: [] }, m = cardMode(c);
  const canQuiz = SET.quiz_enabled && S.quiz && d.cards.length >= 4;
  Q.cur = { c, m, t0: performance.now(), hidden: 0, answered: !canQuiz, flipped: false, sug: 0 };
  document.documentElement.style.setProperty('--c', d.color);
  $('#view').innerHTML = `<div class="study" style="--c:${d.color}">
    <div class="shead"><button class="chip" data-act="quit">${ic('back')} Kategori</button><span class="n">${Q.done}/${Q.total} selesai</span></div>
    <div class="prog"><i style="width:${(Q.done / Q.total) * 100}%"></i></div>
    <div class="opts">
      ${SET.student_can_choose && SET.modes.length > 1 ? `<div class="seg" role="group" aria-label="Sisi depan kartu">${SET.modes.map((x) => `<button data-mode="${x}" aria-pressed="${effMode() === x}">${MODE_LABEL[x]}</button>`).join('')}</div>` : ''}
      ${SET.quiz_enabled ? `<button class="chip" data-act="quiz" aria-pressed="${S.quiz}">Mode tebak</button>` : ''}
      <button class="chip" data-act="auto" aria-pressed="${S.auto}">${ic('sound')} Ucapan</button>
      <button class="chip" data-act="sfx" aria-pressed="${S.sfx}">${ic(S.sfx ? 'sound' : 'mute')} Efek</button>
    </div>
    <div class="stage"><div class="tilt" id="tilt"><div class="fc" id="fc" tabindex="0" role="button" aria-label="Kartu. Ketuk untuk membalik">
      <div class="face front"><div class="tag">${esc(d.zh)}</div>${frontHTML(c, m)}<div class="hint">${canQuiz ? 'Pilih jawaban di bawah' : 'Ketuk untuk membalik'}</div></div>
      <div class="face bface"><div class="tag">${esc(d.zh)}</div><button class="say" data-act="say" aria-label="Dengarkan pengucapan">${ic('sound')}</button>${backHTML(c)}</div>
    </div></div></div>
    <div id="ctrl">${canQuiz ? `<div class="quiz" aria-busy="true">${'<button class="qo" disabled><span class="t">…</span></button>'.repeat(4)}</div>` : `<button class="flipbig" data-act="flip">${ic('flip')} Balik kartu</button>`}</div>
    <div class="keys">Keyboard: Spasi = balik · 1 2 3 4 = jawab/nilai · S = suara</div>
  </div>`;
  bindTilt();
  if (m === 'han' && S.auto) speak(c.h);
  if (canQuiz) loadQuiz(c, m);
}
async function loadQuiz(c, m) {
  const cur = Q.cur;
  try {
    await Q.chain; // nilai kartu sebelumnya sudah tercatat dulu
    const opts = await withRetry(() => api.quizOptions(Q.sid, c.id));
    if (Q.cur !== cur) return;
    const showArti = m === 'han';
    $('#ctrl').innerHTML = `<div class="quiz">${opts.map((o) => `<button class="qo" data-t="${esc(o.t)}">${showArti ? `<span class="t">${esc(o.m)}</span>` : `<span class="z">${esc(o.h)}</span>${o.p ? `<span class="y">${esc(o.p)}</span>` : ''}`}</button>`).join('')}</div>`;
  } catch (e) {
    if (Q.cur !== cur) return;
    cur.answered = true;
    $('#ctrl').innerHTML = `<p class="note">${esc(e.message)} Mode tebak dilewati untuk kartu ini.</p><button class="flipbig" data-act="flip">${ic('flip')} Balik kartu</button>`;
  }
}
async function answerQuiz(btn) {
  const cur = Q.cur; if (cur.answered || cur.busy) return; cur.busy = true;
  document.querySelectorAll('.qo').forEach((b) => { b.disabled = true; });
  let res;
  try { res = await withRetry(() => api.answerQuiz(Q.sid, cur.c.id, btn.dataset.t)); }
  catch (e) { toast(e.message); cur.answered = true; cur.busy = false; flip(true); return; }
  cur.answered = true; cur.busy = false;
  document.querySelectorAll('.qo').forEach((b) => { if (b.dataset.t === res.correct_token) b.classList.add('right'); });
  const tilt = $('#tilt');
  if (res.correct) {
    Q.streak++; SFX.right(); fx(tilt, 'fx-right'); tilt.classList.add('glow-good'); cur.sug = 3;
    if (Q.streak % 5 === 0) { burst(28); cheer(`${Q.streak} benar berturut-turut!`, '#1b9a5a'); }
  } else {
    Q.streak = 0; btn.classList.add('wrong'); SFX.wrong(); fx(tilt, 'fx-wrong'); tilt.classList.add('glow-bad'); cur.sug = 1;
    try { navigator.vibrate && navigator.vibrate(120); } catch (_) { /* tidak didukung */ }
  }
  setTimeout(() => { if (Q && Q.cur === cur) { tilt.classList.remove('glow-good', 'glow-bad'); flip(true); } }, res.correct ? 550 : 1000);
}
function flip(force) {
  const cur = Q && Q.cur; if (!cur || !$('#fc')) return;
  if (!cur.answered && force !== true) return;
  cur.flipped = force === true ? true : !cur.flipped;
  $('#fc').classList.toggle('flip', cur.flipped); SFX.flip();
  if (cur.flipped) {
    if (S.auto) speak(sayText(cur.c));
    $('#ctrl').innerHTML = `<div class="rate">${[1, 2, 3, 4].map((n) => `<button class="rb r${n} ${cur.sug === n ? 'sug' : ''}" data-rate="${n}"><span class="k">${n}</span><span class="l">${RATE[n].l}</span><span class="w">${RATE[n].w}</span></button>`).join('')}</div>`;
  } else $('#ctrl').innerHTML = `<button class="flipbig" data-act="flip">${ic('flip')} Balik kartu</button>`;
}
function rate(n) {
  const cur = Q && Q.cur; if (!cur) return; if (!cur.flipped) { flip(); return; }
  if (cur.rated) return; cur.rated = true;
  const ms = Math.max(0, performance.now() - cur.t0 - cur.hidden - (hiddenAt ? performance.now() - hiddenAt : 0));
  const c = Q.queue.shift(); const sid = Q.sid;
  Q.chain = Q.chain.then(() => withRetry(() => api.rateCard(sid, c.id, n, ms))).catch(() => { Q.failed++; toast('Satu jawaban gagal tersimpan. Periksa koneksi.'); });
  if (n <= 2) { Q.queue.splice(Math.min(RATE[n].gap, Q.queue.length), 0, c); SRS[c.id] = { due: Date.now(), last: n }; }
  else { SRS[c.id] = { due: Date.now() + RATE[n].days * 864e5, last: n }; Q.done++; }
  const btn = document.querySelector(`.rb[data-rate="${n}"]`); if (btn) btn.classList.add('press');
  const tilt = $('#tilt');
  ({ 1: () => { SFX.r1(); fx(tilt, 'fx-wrong'); cheer('加油！', '#d9443a'); }, 2: () => { SFX.r2(); fx(tilt, 'fx-lift'); }, 3: () => { SFX.r3(); fx(tilt, 'fx-right'); cheer('很好！', '#24917f'); }, 4: () => { SFX.r4(); fx(tilt, 'fx-right'); burst(); cheer('太棒了！', '#2a6fd0'); } })[n]();
  setTimeout(renderStudy, n === 1 ? 480 : 380);
}
function bindTilt() {
  const tilt = $('#tilt'), fc = $('#fc'); if (!tilt || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  tilt.addEventListener('pointermove', (e) => {
    if (e.pointerType === 'touch') return;
    const r = tilt.getBoundingClientRect(), px = (e.clientX - r.left) / r.width - 0.5, py = (e.clientY - r.top) / r.height - 0.5;
    tilt.style.transition = 'none'; tilt.style.transform = `rotateX(${(-py * 7).toFixed(2)}deg) rotateY(${(px * 7).toFixed(2)}deg)`;
    fc.querySelectorAll('.face').forEach((f) => { f.style.setProperty('--gx', ((px + 0.5) * 100).toFixed(0) + '%'); f.style.setProperty('--gy', ((py + 0.5) * 100).toFixed(0) + '%'); });
  });
  tilt.addEventListener('pointerleave', () => { tilt.style.transition = ''; tilt.style.transform = ''; });
}
async function renderDone() {
  S.view = 'done';
  $('#view').innerHTML = '<div class="study"><div class="panel done"><p class="note">Menyimpan hasil dan menghitung skor…</p></div></div>';
  await Q.chain;
  let s;
  try { s = await withRetry(() => api.finishSession(Q.sid)); }
  catch (e) {
    $('#view').innerHTML = `<div class="study"><div class="panel done"><h2 class="h2">Skor belum tersimpan</h2><p class="sub">${esc(e.message)}</p><button class="btn" data-act="retryfinish">Coba simpan lagi</button></div></div>`; return;
  }
  const pct = s.score ?? 0;
  if (pct >= 75) burst(48);
  const mins = Math.max(1, Math.round((s.seconds || 0) / 60));
  $('#view').innerHTML = `<div class="study"><div class="panel done">
    <div class="ring" style="--p:${pct}"><div>${pct}</div></div>
    <h2 class="h2 han">${pct >= 85 ? '太棒了！' : pct >= 60 ? '很好！' : '加油！'} Sesi selesai</h2>
    <p class="sub">${s.total} kartu dalam ${mins} menit${s.quiz_total ? ` · tebakan benar ${s.quiz_right}/${s.quiz_total}` : ''}. Skor dihitung oleh server dari nilai pertama tiap kartu (1=25, 2=50, 3=75, 4=100).</p>
    <div class="stats">${[1, 2, 3, 4].map((n) => `<div class="r${n}"><b>${s['c' + n]}</b>${RATE[n].l}</div>`).join('')}</div>
    <div class="ok-line">${ic('check')} Skor tersimpan dan bisa dilihat gurumu</div>
    ${Q.failed ? `<p class="note">${Q.failed} jawaban gagal tersimpan karena koneksi.</p>` : ''}
    <div class="rowb"><button class="btn ghost" data-act="again">${ic('play')} Ulangi kategori ini</button><button class="btn" data-act="quit">Pilih kategori lain</button></div>
  </div></div>`;
}

/* ================= Riwayat ================= */
async function renderHist() {
  $('#selbar').hidden = true; document.documentElement.style.setProperty('--c', '#2340b8');
  $('#view').innerHTML = '<h2 class="h2">Riwayat belajarmu</h2><div class="panel" style="margin-top:14px"><p class="note">Memuat…</p></div>';
  let rows = [];
  try { rows = await api.mySessions(); } catch (e) { toast(e.message); }
  if (S.view !== 'hist') return;
  const nm = (id) => deckOf(id)?.zh || id;
  const pts = rows.slice().reverse().map((r) => ({ x: Date.parse(r.started_at), y: r.score ?? 0 }));
  $('#view').innerHTML = `<h2 class="h2">Riwayat belajarmu</h2><p class="sub">${rows.length} sesi tersimpan.</p>
    ${rows.length > 1 ? `<div class="panel" style="margin-top:14px"><h3 style="margin:0 0 8px">Perkembangan skor</h3>${lineChart(pts)}</div>` : ''}
    <div class="panel" style="margin-top:14px">${rows.length ? `<div class="tablewrap"><table class="table"><thead><tr><th>Tanggal</th><th>Kategori</th><th>Kartu</th><th>Skor</th></tr></thead><tbody>
    ${rows.map((r) => `<tr><td>${esc(fmtDate(r.started_at))}</td><td class="han">${esc(r.decks.map(nm).join('、'))}</td><td>${r.total}</td><td>${scorePill(r.score)}</td></tr>`).join('')}</tbody></table></div>` : '<p class="note">Belum ada sesi. Pilih kategori di menu Belajar untuk mulai.</p>'}</div>`;
}
const scorePill = (v) => `<span class="pill" style="background:${v >= 75 ? 'var(--good)' : v >= 50 ? 'var(--warn)' : 'var(--bad)'}">${v ?? 0}</span>`;

/* ================= Guru ================= */
const TF = Object.assign({ days: 30, cls: '', student: '' }, store.get('tf', {}));
let editDeck = null, armed = null, pendingPic = '', newColor = COLORS[5], lastCred = null, SESS = [];
async function renderTeach() {
  $('#selbar').hidden = true; document.documentElement.style.setProperty('--c', '#2340b8');
  const tabs = [['students', 'users', 'Murid'], ['scores', 'chart', 'Skor'], ['time', 'clock', 'Grafik waktu'], ['settings', 'gear', 'Pengaturan'], ['cards', 'cards', 'Kartu']];
  $('#view').innerHTML = `<h2 class="h2">Panel guru</h2><p class="sub">Perubahan pengaturan dan kartu langsung berlaku untuk semua murid.</p>
    <div class="tabs">${tabs.map(([k, i, l]) => `<button class="chip" data-ttab="${k}" aria-pressed="${S.ttab === k}">${ic(i)} ${l}</button>`).join('')}</div><div id="tview"><p class="note">Memuat…</p></div>`;
  armed = null;
  const tab = S.ttab, draw = () => ({ students: tStudents, scores: tScores, time: tTime, settings: tSettings, cards: tCards })[tab]();
  if (tab === 'settings' || tab === 'cards') { draw(); return; }
  try { STUDENTS = await api.students(); } catch (e) { toast(e.message); }
  if (S.view === 'teach' && S.ttab === tab) draw();
}
const classes = () => [...new Set(STUDENTS.map((s) => s.class_name).filter(Boolean))].sort();
const sName = (id) => STUDENTS.find((s) => s.id === id)?.display_name || 'Murid terhapus';
function filtersHTML(withStudent = true) {
  return `<div class="filters">
    <label class="field" for="fdays">Periode<select id="fdays">${[7, 30, 90, 365].map((d) => `<option value="${d}" ${TF.days === d ? 'selected' : ''}>${d === 365 ? '1 tahun' : d + ' hari'}</option>`).join('')}</select></label>
    <label class="field" for="fcls">Kelas<select id="fcls"><option value="">Semua kelas</option>${classes().map((c) => `<option ${TF.cls === c ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select></label>
    ${withStudent ? `<label class="field" for="fstu">Murid<select id="fstu"><option value="">Semua murid</option>${STUDENTS.filter((s) => !TF.cls || s.class_name === TF.cls).map((s) => `<option value="${esc(s.id)}" ${TF.student === s.id ? 'selected' : ''}>${esc(s.display_name)}</option>`).join('')}</select></label>` : ''}
  </div>`;
}
function bindFilters(redraw) {
  ['fdays', 'fcls', 'fstu'].forEach((id) => { const el = $('#' + id); if (el) el.addEventListener('change', () => { TF.days = +$('#fdays').value; TF.cls = $('#fcls').value; TF.student = $('#fstu') ? $('#fstu').value : ''; if (TF.student && TF.cls && STUDENTS.find((s) => s.id === TF.student)?.class_name !== TF.cls) TF.student = ''; store.set('tf', TF); redraw(); }); });
}

/* ---- Murid ---- */
function tStudents() {
  const v = $('#tview');
  v.innerHTML = `<div class="grid2">
    <form class="panel" id="newStu" novalidate><h3 style="margin:0 0 10px">Buat akun murid</h3>
      <div class="formgrid">
        <label class="field" for="sn">Nama murid<input id="sn" maxlength="40" required placeholder="Budi Santoso"></label>
        <label class="field" for="su">Username<input id="su" maxlength="24" autocapitalize="none" spellcheck="false" required placeholder="budi.s"></label>
        <label class="field" for="sc">Kelas<input id="sc" maxlength="30" list="clslist" placeholder="3A"></label>
      </div><datalist id="clslist">${classes().map((c) => `<option value="${esc(c)}">`).join('')}</datalist>
      <p class="note">Password dibuat acak oleh server dan hanya ditampilkan sekali. Catat atau salin untuk muridmu.</p>
      <button class="btn" type="submit">${ic('plus')} Buat akun</button></form>
    <div class="panel"><h3 style="margin:0 0 10px">Akun baru / password baru</h3><div id="credBox">${lastCred ? credHTML(lastCred) : '<p class="note">Username dan password akan muncul di sini.</p>'}</div></div>
  </div>
  <div class="panel" style="margin-top:14px"><h3 style="margin:0 0 10px">${STUDENTS.length} murid</h3>
  ${STUDENTS.length ? `<div class="tablewrap"><table class="table"><thead><tr><th>Nama</th><th>Username</th><th>Kelas</th><th>Status</th><th>Aksi</th></tr></thead><tbody>
  ${STUDENTS.map((s) => `<tr><td><b>${esc(s.display_name)}</b></td><td><code>${esc(s.username)}</code></td><td>${esc(s.class_name || '-')}</td><td>${s.active ? '<span class="pill" style="background:var(--good)">Aktif</span>' : '<span class="pill" style="background:var(--muted)">Nonaktif</span>'}</td>
    <td><div class="actions">
      <button class="chip" data-sact="reset" data-id="${esc(s.id)}">${ic('key')} Password baru</button>
      <button class="chip" data-sact="${s.active ? 'off' : 'on'}" data-id="${esc(s.id)}">${s.active ? 'Nonaktifkan' : 'Aktifkan'}</button>
      <button class="chip" data-sact="rename" data-id="${esc(s.id)}">Ubah</button>
      <button class="chip danger" data-sact="delete" data-id="${esc(s.id)}" data-armed="${armed === 'del:' + s.id ? 1 : 0}">${ic('trash')} ${armed === 'del:' + s.id ? 'Yakin? Ketuk lagi' : 'Hapus'}</button>
    </div></td></tr>`).join('')}</tbody></table></div>` : '<p class="note">Belum ada murid. Buat akun pertama di atas.</p>'}</div>`;
  $('#sn').addEventListener('input', (e) => { const u = $('#su'); if (!u.dataset.touched) u.value = e.target.value.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '.').replace(/^\.|\.$/g, '').slice(0, 24); });
  $('#su').addEventListener('input', (e) => { e.target.dataset.touched = '1'; });
  $('#newStu').addEventListener('submit', async (e) => {
    e.preventDefault(); const btn = e.target.querySelector('button'); btn.disabled = true;
    try { const r = await api.manage('create', { display_name: $('#sn').value, username: $('#su').value, class_name: $('#sc').value }); lastCred = { name: $('#sn').value.trim(), username: r.username, password: r.password }; STUDENTS = await api.students(); toast('Akun dibuat'); tStudents(); }
    catch (err) { toast(err.message); btn.disabled = false; }
  });
}
function credHTML(c) {
  return `<div class="cred"><div><b>${esc(c.name)}</b><div>Username: <code>${esc(c.username)}</code></div><div>Password: <code>${esc(c.password)}</code></div></div>
    <button class="chip" data-act="copycred">${ic('copy')} Salin</button></div><p class="note" style="margin-top:8px">Password ini tidak akan ditampilkan lagi. Kalau lupa, buat password baru.</p>`;
}

/* ---- Skor ---- */
async function tScores() {
  const v = $('#tview');
  v.innerHTML = filtersHTML() + '<div id="sbody"><p class="note">Memuat…</p></div>';
  bindFilters(tScores);
  try { SESS = await api.sessions(TF.days); } catch (e) { toast(e.message); SESS = []; }
  const inScope = SESS.filter((s) => (!TF.student || s.student_id === TF.student) && (!TF.cls || STUDENTS.find((x) => x.id === s.student_id)?.class_name === TF.cls));
  const avg = (a) => (a.length ? Math.round(a.reduce((t, s) => t + (s.score || 0), 0) / a.length) : 0);
  const per = {};
  for (const s of inScope) (per[s.student_id] ||= []).push(s);
  const rows = Object.entries(per).map(([id, list]) => ({ id, list, avg: avg(list), last: list[0] })).sort((a, b) => b.last.started_at.localeCompare(a.last.started_at));
  const totalMin = Math.round(inScope.reduce((t, s) => t + (s.seconds || 0), 0) / 60);
  const nm = (id) => deckOf(id)?.zh || id;
  const body = $('#sbody'); if (!body) return;
  body.innerHTML = `<div class="kpis"><div class="kpi"><b>${inScope.length}</b><span>sesi selesai</span></div><div class="kpi"><b>${rows.length}</b><span>murid aktif</span></div><div class="kpi"><b>${avg(inScope)}</b><span>rata-rata skor</span></div><div class="kpi"><b>${totalMin}</b><span>menit belajar</span></div></div>
    ${TF.student && per[TF.student] ? `<div class="panel" style="margin-bottom:14px"><h3 style="margin:0 0 8px">Perkembangan skor ${esc(sName(TF.student))}</h3>${lineChart(per[TF.student].slice().reverse().map((s) => ({ x: Date.parse(s.started_at), y: s.score || 0 })))}</div>` : ''}
    <div class="panel"><h3 style="margin:0 0 10px">Ringkasan per murid</h3>${rows.length ? `<div class="tablewrap"><table class="table"><thead><tr><th>Murid</th><th>Sesi</th><th>Rata-rata</th><th>Terakhir</th><th>Skor terakhir</th></tr></thead><tbody>
    ${rows.map((r) => `<tr class="clk" data-stu="${esc(r.id)}"><td><b>${esc(sName(r.id))}</b><div class="note">${esc(STUDENTS.find((s) => s.id === r.id)?.class_name || '')}</div></td><td>${r.list.length}</td><td>${r.avg}</td><td>${esc(fmtDate(r.last.started_at))}</td><td>${scorePill(r.last.score)}</td></tr>`).join('')}</tbody></table></div>` : '<p class="note">Belum ada sesi di periode ini.</p>'}</div>
    <div class="panel" style="margin-top:14px"><h3 style="margin:0 0 10px">Sesi terbaru</h3>${inScope.length ? `<div class="tablewrap"><table class="table"><thead><tr><th>Waktu</th><th>Murid</th><th>Kategori</th><th>Kartu</th><th>1/2/3/4</th><th>Tebak</th><th>Skor</th></tr></thead><tbody>
    ${inScope.slice(0, 100).map((s) => `<tr><td>${esc(fmtDate(s.started_at))}</td><td>${esc(sName(s.student_id))}</td><td class="han">${esc(s.decks.map(nm).join('、'))}</td><td>${s.total}</td><td>${s.c1}/${s.c2}/${s.c3}/${s.c4}</td><td>${s.quiz_total ? `${s.quiz_right}/${s.quiz_total}` : '-'}</td><td>${scorePill(s.score)}</td></tr>`).join('')}</tbody></table></div>` : '<p class="note">Belum ada sesi.</p>'}</div>`;
}

/* ---- Grafik waktu ---- */
async function tTime() {
  const v = $('#tview');
  v.innerHTML = filtersHTML() + '<div id="tbody"><p class="note">Memuat…</p></div>';
  bindFilters(tTime);
  const f = { days: TF.days, cls: TF.cls || null, student: TF.student || null };
  let cards = [], decks = [];
  try { [cards, decks] = await Promise.all([api.cardTime(f), api.deckTime(f)]); } catch (e) { toast(e.message); }
  const body = $('#tbody'); if (!body) return;
  const who = TF.student ? esc(sName(TF.student)) : TF.cls ? 'kelas ' + esc(TF.cls) : 'semua murid';
  const deckRows = decks.map((d) => { const dk = deckOf(d.deck_id); return { label: esc(dk?.zh || d.deck_id), sub: `${esc(dk?.idn || '')} · ${d.n} jawaban`, value: Number(d.avg_ms), color: dk?.color }; });
  const cardRows = cards.slice(0, 15).map((c) => { const dk = deckOf(c.deck_id); const card = CARDS.find((x) => x.id === c.card_id); return { label: esc(c.card_h), sub: `${esc(card?.m || '')} · ${esc(dk?.zh || '')} · ${c.n}×`, value: Number(c.avg_ms), color: dk?.color, extra: Number(c.wrong_rate) > 0 ? Math.round(Number(c.wrong_rate) * 100) + '% sulit' : '' }; });
  body.innerHTML = `<p class="sub" style="margin:0 0 12px">Rata-rata lama melihat satu kartu sebelum menilainya, untuk ${who}. Waktu saat tab disembunyikan tidak dihitung.</p>
    <div class="grid2"><div class="panel"><h3 style="margin:0 0 10px">Kategori paling lama</h3>${hbars(deckRows, { fmt: secs, empty: 'Belum ada jawaban di periode ini.' })}</div>
    <div class="panel"><h3 style="margin:0 0 10px">15 kartu paling lama</h3>${hbars(cardRows, { fmt: secs, empty: 'Belum ada jawaban di periode ini.' })}<p class="note" style="margin-top:8px">"% sulit" = seberapa sering kartu itu dinilai 1–2 atau tebakannya salah.</p></div></div>`;
}

/* ---- Pengaturan ---- */
let DRAFT = null;
function tSettings() {
  DRAFT = JSON.parse(JSON.stringify(SET));
  $('#tview').innerHTML = `<div class="grid2">
    <div class="panel"><h3 style="margin:0 0 8px">Sisi depan kartu</h3><p class="note">Tampilan yang boleh dipakai murid.</p>
      <div class="checks" style="margin:10px 0">${MODES.map((m) => `<button class="chip" data-cfgmode="${m}" aria-pressed="${DRAFT.modes.includes(m)}">${MODE_LABEL[m]}</button>`).join('')}</div>
      <label class="field" for="defmode">Tampilan awal<select id="defmode">${DRAFT.modes.map((m) => `<option value="${m}" ${DRAFT.default_mode === m ? 'selected' : ''}>${MODE_LABEL[m]}</option>`).join('')}</select></label>
      <div class="checks" style="margin-top:10px"><button class="chip" data-cfgtog="student_can_choose" aria-pressed="${DRAFT.student_can_choose}">Murid boleh mengganti</button><button class="chip" data-cfgtog="quiz_enabled" aria-pressed="${DRAFT.quiz_enabled}">Aktifkan mode tebak</button></div></div>
    <div class="panel"><h3 style="margin:0 0 8px">Kategori untuk murid</h3><p class="note">Matikan kategori yang belum diajarkan.</p>
      <div class="checks" style="margin-top:10px">${DECKS.map((d) => `<button class="chip" data-cfgdeck="${esc(d.id)}" aria-pressed="${!DRAFT.hidden_decks.includes(d.id)}"><span class="han">${esc(d.zh)}</span> ${esc(d.idn)}</button>`).join('')}</div></div>
  </div><div style="margin-top:14px;display:flex;gap:10px;align-items:center;flex-wrap:wrap"><button class="btn" data-act="savecfg">${ic('check')} Simpan pengaturan</button><span class="note" id="cfgnote"></span></div>
  <form class="panel" id="pwForm" style="margin-top:18px;max-width:520px" novalidate><h3 style="margin:0 0 10px">Ganti password guru</h3>
    <div class="formgrid"><label class="field" for="po">Password lama<input id="po" type="password" autocomplete="current-password" maxlength="128"></label>
    <label class="field" for="pn">Password baru (min. 10)<input id="pn" type="password" autocomplete="new-password" maxlength="128"></label></div>
    <button class="btn ghost" style="margin-top:10px" type="submit">${ic('key')} Ganti password</button><p class="note" id="pwnote"></p></form>`;
  $('#pwForm').addEventListener('submit', async (e) => {
    e.preventDefault(); const n = $('#pwnote');
    if ($('#pn').value.length < 10) { n.textContent = 'Password baru minimal 10 karakter.'; return; }
    try { await api.changePassword($('#po').value, $('#pn').value); n.textContent = 'Password diganti. Perangkat lain otomatis keluar.'; $('#po').value = ''; $('#pn').value = ''; }
    catch (err) { n.textContent = err.message; }
  });
}

/* ---- Kartu ---- */
function tCards() {
  const d = DECKS.find((x) => x.id === editDeck);
  $('#tview').innerHTML = `<div class="grid2">
    <div class="panel"><h3 style="margin:0 0 8px">Pilih kategori</h3>
      <div class="checks">${DECKS.map((k) => `<button class="chip" data-deck="${esc(k.id)}" aria-pressed="${editDeck === k.id}"><span class="han">${esc(k.zh)}</span> · ${k.cards.length}</button>`).join('')}</div>
      <form id="newDeck" style="margin-top:16px" novalidate><h3 style="margin:0 0 8px">Kategori baru</h3><div class="formgrid">
        <label class="field" for="dzh">Nama Mandarin<input id="dzh" maxlength="16" placeholder="学校"></label>
        <label class="field" for="didn">Nama Indonesia<input id="didn" maxlength="40" placeholder="Sekolah"></label></div>
        <div class="field" style="margin-top:8px">Warna<div class="swatches">${COLORS.map((c) => `<button type="button" class="sw" data-color="${c}" style="background:${c}" aria-pressed="${newColor === c}" aria-label="Warna ${c}"></button>`).join('')}</div></div>
        <button class="btn" style="margin-top:12px" type="submit">${ic('plus')} Buat kategori</button></form></div>
    <div class="panel">${d ? `<h3 style="margin:0 0 8px">Tambah kartu ke <span class="han">${esc(d.zh)}</span></h3>
      <form id="newCard" novalidate><div class="formgrid">
        <label class="field" for="wh">汉字 *<input id="wh" maxlength="12" required placeholder="书包"></label>
        <label class="field" for="wp">Pinyin<input id="wp" maxlength="60" placeholder="shūbāo"></label>
        <label class="field" for="wm">Arti *<input id="wm" maxlength="60" required placeholder="tas sekolah"></label>
        <label class="field" for="ww">量词<input id="ww" maxlength="2" placeholder="个"></label>
        <label class="field" for="we">Emoji (opsional)<input id="we" maxlength="8" placeholder="🎒"></label>
        <label class="field" for="wimg">Foto (opsional)<input id="wimg" type="file" accept="image/png,image/jpeg,image/webp,image/gif"></label>
      </div><p class="note" id="imgnote">${pendingPic ? 'Foto siap dipakai.' : ''}</p>
      <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn" type="submit">${ic('plus')} Tambah kartu</button>
      <button class="chip danger" type="button" data-act="deldeck" data-armed="${armed === 'deck' ? 1 : 0}">${ic('trash')} ${armed === 'deck' ? 'Yakin hapus kategori & semua kartunya? Ketuk lagi' : 'Hapus kategori'}</button></div></form>`
      : '<p class="note">Pilih kategori di kiri untuk melihat, menambah, atau menghapus kartu.</p>'}</div>
  </div>
  ${d ? `<div class="panel" style="margin-top:14px"><h3 style="margin:0 0 10px">${d.cards.length} kartu</h3><div class="cards-list">${d.cards.map((c) => `<div class="ci"><div class="pic">${picHTML(c) || '<span class="note">tanpa gambar</span>'}</div><div class="h">${esc(c.h)}</div><div class="p">${esc(c.p)}</div><div class="m">${esc(c.m)}</div>
    <button class="del ${armed === c.id ? 'arm' : ''}" data-delcard="${esc(c.id)}" aria-label="${armed === c.id ? 'Ketuk lagi untuk menghapus' : 'Hapus kartu'}">${ic('trash')}</button></div>`).join('')}</div></div>` : ''}`;
  $('#newDeck').addEventListener('submit', async (e) => {
    e.preventDefault();
    const zh = $('#dzh').value.trim().slice(0, 16), idn = $('#didn').value.trim().slice(0, 40);
    if (!zh) { toast('Isi nama Mandarin kategori'); return; }
    const id = 'c' + Array.from(crypto.getRandomValues(new Uint8Array(6)), (x) => (x % 36).toString(36)).join('');
    try { await api.createDeck({ id, zh, idn, color: newColor, kind: 'noun', builtin: false, sort: 100 + DECKS.length }); editDeck = id; await reloadContent(); toast('Kategori dibuat'); tCards(); }
    catch (err) { toast(err.message); }
  });
  const nc = $('#newCard');
  if (nc) {
    $('#wimg').addEventListener('change', async (e) => {
      const f = e.target.files && e.target.files[0]; if (!f) return;
      $('#imgnote').textContent = 'Mengunggah foto…';
      try { pendingPic = await api.uploadImage(f); $('#imgnote').textContent = 'Foto siap dipakai.'; }
      catch (err) { pendingPic = ''; $('#imgnote').textContent = err.message; }
    });
    nc.addEventListener('submit', async (e) => {
      e.preventDefault();
      const h = $('#wh').value.trim(), m = $('#wm').value.trim();
      if (!h || !m) { toast('汉字 dan arti wajib diisi'); return; }
      const emoji = $('#we').value.trim();
      const card = { id: `${editDeck}:${h}`.slice(0, 64), deck_id: editDeck, h: h.slice(0, 12), p: $('#wp').value.trim().slice(0, 60), m: m.slice(0, 60), mw: $('#ww').value.trim().slice(0, 2), pic: pendingPic || ([...emoji].length <= 8 ? emoji : ''), builtin: false, sort: (d.cards.length || 0) + 1 };
      if (CARDS.some((x) => x.id === card.id)) { toast(`Kartu ${h} sudah ada di kategori ini`); return; }
      try { await api.createCard(card); pendingPic = ''; await reloadContent(); toast('Kartu ditambahkan'); tCards(); }
      catch (err) { toast(err.message); }
    });
  }
}
async function reloadContent() { applyContent(await api.content()); }

/* ================= event klik ================= */
document.addEventListener('click', async (e) => {
  const b = e.target.closest('[data-nav],[data-pick],[data-act],[data-mode],[data-rate],[data-t],[data-ttab],[data-sact],[data-stu],[data-cfgmode],[data-cfgtog],[data-cfgdeck],[data-deck],[data-color],[data-delcard]');
  if (!b) { const fc = e.target.closest('#fc'); if (fc && Q && Q.cur && Q.cur.answered) flip(); return; }
  const ds = b.dataset;
  if (ds.nav) { if (S.view === 'study' && Q && Q.done < Q.total && !confirmLeave()) return; go(ds.nav); return; }
  if (ds.pick) { const id = ds.pick; S.sel = S.sel.includes(id) ? S.sel.filter((x) => x !== id) : [...S.sel, id]; savePrefs(); b.setAttribute('aria-pressed', S.sel.includes(id)); renderSelbar(); return; }
  if (ds.mode) { S.mode = ds.mode; savePrefs(); Q.queue.length && renderStudy(); return; }
  if (ds.t !== undefined && b.classList.contains('qo')) { answerQuiz(b); return; }
  if (ds.rate) { rate(+ds.rate); return; }
  if (ds.ttab) { S.ttab = ds.ttab; savePrefs(); renderTeach(); return; }
  if (ds.stu) { TF.student = ds.stu; store.set('tf', TF); tScores(); return; }
  if (ds.cfgmode) { const m = ds.cfgmode; DRAFT.modes = DRAFT.modes.includes(m) ? DRAFT.modes.filter((x) => x !== m) : MODES.filter((x) => DRAFT.modes.includes(x) || x === m); if (!DRAFT.modes.length) DRAFT.modes = [m]; if (!DRAFT.modes.includes(DRAFT.default_mode)) DRAFT.default_mode = DRAFT.modes[0]; b.setAttribute('aria-pressed', DRAFT.modes.includes(m)); $('#defmode').innerHTML = DRAFT.modes.map((x) => `<option value="${x}" ${DRAFT.default_mode === x ? 'selected' : ''}>${MODE_LABEL[x]}</option>`).join(''); return; }
  if (ds.cfgtog) { DRAFT[ds.cfgtog] = !DRAFT[ds.cfgtog]; b.setAttribute('aria-pressed', DRAFT[ds.cfgtog]); return; }
  if (ds.cfgdeck) { const id = ds.cfgdeck; DRAFT.hidden_decks = DRAFT.hidden_decks.includes(id) ? DRAFT.hidden_decks.filter((x) => x !== id) : [...DRAFT.hidden_decks, id]; b.setAttribute('aria-pressed', !DRAFT.hidden_decks.includes(id)); return; }
  if (ds.deck) { editDeck = ds.deck; armed = null; pendingPic = ''; tCards(); return; }
  if (ds.color) { newColor = ds.color; document.querySelectorAll('.sw').forEach((x) => x.setAttribute('aria-pressed', x.dataset.color === newColor)); return; }
  if (ds.delcard) { const id = ds.delcard; if (armed !== id) { armed = id; tCards(); return; } armed = null; try { await api.deleteCard(id); await reloadContent(); toast('Kartu dihapus'); } catch (err) { toast(err.message); } tCards(); return; }
  if (ds.sact) {
    const id = ds.id, s = STUDENTS.find((x) => x.id === id); if (!s) return;
    try {
      if (ds.sact === 'reset') { const r = await api.manage('reset_password', { id }); lastCred = { name: s.display_name, username: s.username, password: r.password }; toast('Password baru dibuat'); }
      else if (ds.sact === 'off' || ds.sact === 'on') { await api.manage('set_active', { id, active: ds.sact === 'on' }); toast(ds.sact === 'on' ? 'Akun diaktifkan' : 'Akun dinonaktifkan'); }
      else if (ds.sact === 'rename') { renameStudent(s); return; }
      else if (ds.sact === 'delete') { if (armed !== 'del:' + id) { armed = 'del:' + id; tStudents(); return; } armed = null; await api.manage('delete', { id }); toast('Akun dihapus'); }
      STUDENTS = await api.students(); tStudents();
    } catch (err) { toast(err.message); }
    return;
  }
  const a = ds.act;
  if (a === 'logout') { await api.logout(); ME = null; Q = null; renderLogin(); }
  else if (a === 'selall') { const ds2 = visibleDecks(); S.sel = S.sel.length === ds2.length ? [] : ds2.map((d) => d.id); savePrefs(); renderLearn(); }
  else if (a === 'togall') { S.all = !S.all; savePrefs(); renderSelbar(); }
  else if (a === 'start' || a === 'again') startStudy();
  else if (a === 'quit') { if (S.view === 'study' && Q && Q.done < Q.total && !confirmLeave()) return; S.view = 'learn'; savePrefs(); shell(); renderLearn(); }
  else if (a === 'flip') flip();
  else if (a === 'quiz') { S.quiz = !S.quiz; savePrefs(); renderStudy(); }
  else if (a === 'auto') { S.auto = !S.auto; savePrefs(); b.setAttribute('aria-pressed', S.auto); }
  else if (a === 'sfx') { S.sfx = !S.sfx; savePrefs(); b.setAttribute('aria-pressed', S.sfx); b.innerHTML = `${ic(S.sfx ? 'sound' : 'mute')} Efek`; }
  else if (a === 'say') { e.stopPropagation(); if (Q && Q.cur) speak(sayText(Q.cur.c)); }
  else if (a === 'retryfinish') renderDone();
  else if (a === 'copycred' && lastCred) copyText(`Flashcard Alvaro\nNama: ${lastCred.name}\nUsername: ${lastCred.username}\nPassword: ${lastCred.password}\nLink: ${location.origin}`);
  else if (a === 'savecfg') { DRAFT.default_mode = $('#defmode').value; const c = cleanSettings(DRAFT); $('#cfgnote').textContent = 'Menyimpan…'; try { await api.saveSettings(c); SET = c; $('#cfgnote').textContent = 'Tersimpan. Berlaku untuk semua murid.'; toast('Pengaturan disimpan'); } catch (err) { $('#cfgnote').textContent = err.message; } }
  else if (a === 'deldeck') { if (armed !== 'deck') { armed = 'deck'; tCards(); return; } armed = null; try { await api.deleteDeck(editDeck); editDeck = null; await reloadContent(); toast('Kategori dihapus'); } catch (err) { toast(err.message); } tCards(); }
});
// Konfirmasi keluar sesi: dibuat di halaman sendiri (tanpa dialog browser)
let leaveArmed = 0;
function confirmLeave() { if (Date.now() - leaveArmed < 3000) return true; leaveArmed = Date.now(); toast('Sesi belum selesai. Ketuk sekali lagi untuk keluar.'); return false; }
function renameStudent(s) {
  const box = $('#credBox');
  box.innerHTML = `<form id="renForm" novalidate><div class="formgrid"><label class="field" for="rn">Nama<input id="rn" maxlength="40" value="${esc(s.display_name)}"></label><label class="field" for="rc">Kelas<input id="rc" maxlength="30" value="${esc(s.class_name || '')}"></label></div><button class="btn" style="margin-top:10px" type="submit">${ic('check')} Simpan</button></form>`;
  box.scrollIntoView({ behavior: 'smooth', block: 'center' });
  $('#renForm').addEventListener('submit', async (e) => { e.preventDefault(); try { await api.manage('rename', { id: s.id, display_name: $('#rn').value, class_name: $('#rc').value }); STUDENTS = await api.students(); toast('Data murid disimpan'); tStudents(); } catch (err) { toast(err.message); } });
}
document.addEventListener('keydown', (e) => {
  if (S.view !== 'study' || !Q || !Q.cur || !$('#fc')) return;
  if (e.target.matches('input,select,textarea')) return;
  if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); if (Q.cur.answered) flip(); }
  else if (/^[1-4]$/.test(e.key)) { if (Q.cur.flipped) rate(+e.key); else if (!Q.cur.answered) { const o = document.querySelectorAll('.qo:not([disabled])')[+e.key - 1]; if (o) answerQuiz(o); } }
  else if (e.key.toLowerCase() === 's') speak(sayText(Q.cur.c));
});

/* ================= pembaruan otomatis ================= */
async function checkVersion() {
  if (BUILD === 'dev') return;
  try {
    const r = await fetch('/version.json?t=' + Date.now(), { cache: 'no-store' }); const j = await r.json();
    if (j.build && j.build !== BUILD && !$('#update')) {
      const el = document.createElement('div'); el.className = 'update'; el.id = 'update'; el.setAttribute('role', 'status');
      el.innerHTML = '<span>Versi baru aplikasi tersedia</span><button type="button">Muat ulang</button>';
      el.querySelector('button').addEventListener('click', () => location.reload());
      document.body.appendChild(el);
    }
  } catch (_) { /* offline */ }
}
async function refreshContent() {
  if (!ME || S.view === 'study' || S.view === 'done') return;
  try { applyContent(await api.content()); if (S.view === 'learn') renderLearn(); } catch (_) { /* coba lagi nanti */ }
}
document.addEventListener('visibilitychange', () => { if (!document.hidden) { checkVersion(); refreshContent(); } });
setInterval(() => { checkVersion(); refreshContent(); }, 5 * 60 * 1000);

/* ================= mulai ================= */
(async function boot() {
  $('#view').innerHTML = '<div class="loading">Memuat…</div>';
  try { ME = await api.profile(); } catch (_) { ME = null; }
  if (!ME) {
    try { const st = await api.setupStatus(); if (st && st.needsSetup) { renderSetup(st.configured); return; } } catch (_) { /* tampilkan login */ }
    renderLogin(); return;
  }
  try { await loadAll(); } catch (e) { renderLogin(e.message); return; }
  go(S.view === 'study' || S.view === 'done' ? 'learn' : S.view);
  checkVersion();
})();
