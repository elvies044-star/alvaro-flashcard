// Mode demo: berjalan tanpa Supabase, data disimpan di browser ini saja.
// Aturan skornya sama persis dengan fungsi server di database.
import builtin from '../data/builtin.json';

const KEY = 'alvaro_demo_v1';
const wait = (ms = 120) => new Promise((r) => setTimeout(r, ms));
const rnd = () => Math.random().toString(16).slice(2, 12);
const shuffle = (a) => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; };

function fresh() {
  const t = { id: 'demo-guru', role: 'teacher', username: 'guru', display_name: 'Guru Alvaro', class_name: null, active: true, created_at: new Date().toISOString(), pw: 'guru123' };
  const s = { id: 'demo-budi', role: 'student', username: 'budi', display_name: 'Budi', class_name: '3A', active: true, created_at: new Date().toISOString(), pw: 'budi123' };
  return {
    users: [t, s], me: null,
    settings: { id: 1, modes: ['pic', 'han', 'arti', 'mix'], default_mode: 'pic', student_can_choose: true, quiz_enabled: true, hidden_decks: [] },
    customDecks: [], customCards: [], deleted: [], srs: {}, sessions: [], answers: [], pending: {},
  };
}
function load() { try { return JSON.parse(localStorage.getItem(KEY)) || fresh(); } catch (_) { return fresh(); } }
let db = load();
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(db)); } catch (_) { /* penyimpanan penuh */ } };
const pub = (u) => { const { pw, ...rest } = u; return rest; };
const me = () => db.users.find((u) => u.id === db.me && u.active) || null;
function need(role) { const u = me(); if (!u || (role && u.role !== role)) throw new Error('Akses ditolak. Coba masuk ulang.'); return u; }
function allCards() { return builtin.cards.filter((c) => !db.deleted.includes(c.id)).concat(db.customCards); }
function allDecks() { return builtin.decks.filter((d) => !db.deleted.includes('deck:' + d.id)).concat(db.customDecks); }
function openSession(sid) { const u = need(); const s = db.sessions.find((x) => x.id === sid && x.student_id === u.id); if (!s) throw new Error('Sesi tidak ditemukan.'); if (s.finished_at) throw new Error('Sesi ini sudah selesai.'); return s; }
function makePassword() { const c = 'bcdfghjkmnprstvwz', v = 'aeiu', d = '23456789'; let p = ''; for (let i = 0; i < 4; i++) p += c[(Math.random() * c.length) | 0] + v[(Math.random() * v.length) | 0]; for (let i = 0; i < 3; i++) p += d[(Math.random() * d.length) | 0]; return p; }

export function makeDemoApi() {
  return {
    demo: true,
    publicImagePrefix: 'data:image/',
    async login(username, password) {
      await wait(250);
      const u = db.users.find((x) => x.username === String(username).trim().toLowerCase() && x.pw === password);
      if (!u) throw new Error('Username atau password salah.');
      if (!u.active) throw new Error('Akun ini tidak aktif. Hubungi gurumu.');
      db.me = u.id; save(); return pub(u);
    },
    async logout() { db.me = null; save(); },
    async setupStatus() { return { needsSetup: false, configured: true }; },
    async setup() { throw new Error('Tidak dipakai di mode demo.'); },
    async changePassword(o, n) { const u = need('teacher'); if (u.pw !== o) throw new Error('Password lama salah.'); u.pw = n; save(); },
    async profile() { const u = me(); return u ? pub(u) : null; },
    async content() { need(); await wait(); return { settings: db.settings, decks: allDecks(), cards: allCards() }; },
    async srs() { const u = need(); return db.srs[u.id] || {}; },
    async startSession(decks, mode) {
      const u = need(); await wait(80);
      const s = { id: rnd(), student_id: u.id, decks, mode, started_at: new Date().toISOString(), finished_at: null, total: 0, score: null, c1: 0, c2: 0, c3: 0, c4: 0, quiz_right: 0, quiz_total: 0, seconds: 0 };
      db.sessions.push(s); save(); return s.id;
    },
    async quizOptions(sid, cardId) {
      const s = openSession(sid); await wait(90);
      const cards = allCards(); const c = cards.find((x) => x.id === cardId && s.decks.includes(x.deck_id));
      if (!c) throw new Error('Kartu tidak ada di sesi ini.');
      const others = shuffle(cards.filter((x) => x.deck_id === c.deck_id && x.id !== c.id && x.h !== c.h && x.m !== c.m)).slice(0, 3);
      const opts = shuffle([c, ...others]).map((x) => ({ t: rnd(), h: x.h, p: x.p, m: x.m, _id: x.id }));
      db.pending[sid + '|' + cardId] = { correct: opts.find((o) => o._id === c.id).t, tokens: opts.map((o) => o.t), answered: false, result: null };
      save(); return opts.map(({ _id, ...o }) => o);
    },
    async answerQuiz(sid, cardId, token) {
      openSession(sid); await wait(90);
      const q = db.pending[sid + '|' + cardId];
      if (!q || q.answered || !q.tokens.includes(token)) throw new Error('Pertanyaan tidak valid.');
      q.answered = true; q.result = token === q.correct; save();
      return { correct: q.result, correct_token: q.correct };
    },
    async rateCard(sid, cardId, rating, ms) {
      const s = openSession(sid); await wait(60);
      if (!(rating >= 1 && rating <= 4)) throw new Error('Nilai tidak valid.');
      const c = allCards().find((x) => x.id === cardId && s.decks.includes(x.deck_id)); if (!c) throw new Error('Kartu tidak ada di sesi ini.');
      const first = !db.answers.some((a) => a.session_id === sid && a.card_id === cardId);
      const q = db.pending[sid + '|' + cardId];
      db.answers.push({ session_id: sid, student_id: s.student_id, card_id: c.id, deck_id: c.deck_id, card_h: c.h, rating, quiz_correct: q && q.answered ? q.result : null, ms: Math.max(0, Math.min(600000, Math.round(ms || 0))), first_try: first, created_at: new Date().toISOString() });
      delete db.pending[sid + '|' + cardId];
      (db.srs[s.student_id] ||= {})[c.id] = { due: Date.now() + (rating === 3 ? 864e5 : rating === 4 ? 3 * 864e5 : 0), last: rating };
      save();
    },
    async finishSession(sid) {
      const s = openSession(sid); await wait(120);
      const a = db.answers.filter((x) => x.session_id === sid && x.first_try);
      Object.assign(s, {
        finished_at: new Date().toISOString(), total: a.length,
        c1: a.filter((x) => x.rating === 1).length, c2: a.filter((x) => x.rating === 2).length, c3: a.filter((x) => x.rating === 3).length, c4: a.filter((x) => x.rating === 4).length,
        quiz_total: a.filter((x) => x.quiz_correct !== null).length, quiz_right: a.filter((x) => x.quiz_correct === true).length,
        score: a.length ? Math.round(a.reduce((t, x) => t + x.rating * 25, 0) / a.length) : null,
        seconds: Math.min(21600, Math.round((Date.now() - Date.parse(s.started_at)) / 1000)),
      });
      save(); return s;
    },
    async mySessions() { const u = need(); return db.sessions.filter((s) => s.student_id === u.id && s.finished_at).sort((a, b) => b.started_at.localeCompare(a.started_at)).slice(0, 60); },

    // ---- guru ----
    async students() { need('teacher'); return db.users.filter((u) => u.role === 'student').map(pub); },
    async manage(action, p = {}) {
      need('teacher'); await wait(200);
      const target = () => { const u = db.users.find((x) => x.id === p.id && x.role === 'student'); if (!u) throw new Error('Murid tidak ditemukan.'); return u; };
      if (action === 'create') {
        const username = String(p.username || '').trim().toLowerCase();
        if (!/^[a-z0-9._]{3,24}$/.test(username)) throw new Error('Username 3–24 karakter: huruf kecil, angka, titik, atau garis bawah.');
        if (!String(p.display_name || '').trim()) throw new Error('Nama murid wajib diisi.');
        if (db.users.some((u) => u.username === username)) throw new Error('Username sudah dipakai.');
        const password = makePassword();
        const u = { id: 'demo-' + rnd(), role: 'student', username, display_name: String(p.display_name).trim().slice(0, 40), class_name: String(p.class_name || '').trim().slice(0, 30) || null, active: true, created_at: new Date().toISOString(), pw: password };
        db.users.push(u); save(); return { id: u.id, username, password };
      }
      if (action === 'reset_password') { const u = target(); u.pw = makePassword(); save(); return { password: u.pw }; }
      if (action === 'set_active') { const u = target(); u.active = p.active === true; save(); return { ok: true }; }
      if (action === 'rename') { const u = target(); u.display_name = String(p.display_name || '').trim().slice(0, 40) || u.display_name; u.class_name = String(p.class_name || '').trim().slice(0, 30) || null; save(); return { ok: true }; }
      if (action === 'delete') { const u = target(); db.users = db.users.filter((x) => x !== u); db.sessions = db.sessions.filter((s) => s.student_id !== u.id); db.answers = db.answers.filter((a) => a.student_id !== u.id); save(); return { ok: true }; }
      throw new Error('Aksi tidak dikenal.');
    },
    async sessions(days) { need('teacher'); const since = Date.now() - days * 864e5; return db.sessions.filter((s) => s.finished_at && Date.parse(s.started_at) >= since).sort((a, b) => b.started_at.localeCompare(a.started_at)); },
    async cardTime(f) { return stats(f, 'card'); },
    async deckTime(f) { return stats(f, 'deck'); },
    async saveSettings(s) { need('teacher'); if (!s.modes.length || !s.modes.includes(s.default_mode)) throw new Error('Pengaturan tidak valid.'); Object.assign(db.settings, s); save(); },
    async createDeck(d) { need('teacher'); if (allDecks().some((x) => x.id === d.id)) throw new Error('Kategori sudah ada.'); db.customDecks.push({ ...d, builtin: false, sort: 100 + db.customDecks.length }); save(); },
    async deleteDeck(id) { need('teacher'); if (builtin.decks.some((d) => d.id === id)) db.deleted.push('deck:' + id); db.customDecks = db.customDecks.filter((d) => d.id !== id); db.customCards = db.customCards.filter((c) => c.deck_id !== id); save(); },
    async createCard(c) { need('teacher'); if (allCards().some((x) => x.id === c.id)) throw new Error('Kartu sudah ada.'); db.customCards.push({ ...c, builtin: false }); save(); },
    async deleteCard(id) { need('teacher'); if (builtin.cards.some((c) => c.id === id)) db.deleted.push(id); db.customCards = db.customCards.filter((c) => c.id !== id); save(); },
    async uploadImage(file) {
      if (!/^image\/(png|jpeg|webp|gif)$/.test(file.type)) throw new Error('Pakai foto PNG, JPG, WEBP, atau GIF.');
      if (file.size > 300 * 1024) throw new Error('Di mode demo foto maksimal 300 KB.');
      return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = () => rej(new Error('Foto gagal dibaca.')); r.readAsDataURL(file); });
    },
  };
}

function stats(f, by) {
  need('teacher');
  const since = Date.now() - f.days * 864e5;
  const users = Object.fromEntries(db.users.map((u) => [u.id, u]));
  const rows = db.answers.filter((a) => Date.parse(a.created_at) >= since && (!f.student || a.student_id === f.student) && (!f.cls || users[a.student_id]?.class_name === f.cls));
  const g = {};
  for (const a of rows) {
    const k = by === 'card' ? a.card_id : a.deck_id;
    const x = (g[k] ||= { card_id: a.card_id, card_h: a.card_h, deck_id: a.deck_id, n: 0, sum: 0, wrong: 0 });
    x.n++; x.sum += a.ms; if (a.rating <= 2 || a.quiz_correct === false) x.wrong++;
  }
  return Object.values(g).map((x) => ({ ...x, avg_ms: Math.round(x.sum / x.n), total_ms: x.sum, wrong_rate: x.wrong / x.n })).sort((a, b) => b.avg_ms - a.avg_ms).slice(0, 200);
}
