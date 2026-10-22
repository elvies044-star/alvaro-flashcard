// =====================================================================
//  Flashcard Alvaro — server (Cloudflare Pages Functions + D1)
//  Semua aturan keamanan dijalankan di sini, bukan di browser:
//   * Login username + password (PBKDF2), sesi lewat cookie HttpOnly.
//   * Batas percobaan login per username & per alamat IP.
//   * Skor dihitung server dari jawaban yang tercatat; murid tidak bisa
//     menulis skor, mengubah, atau menghapus jawaban.
//   * Kunci jawaban tebakan tidak pernah dikirim ke browser.
//   * Kartu, kategori, pengaturan, dan akun hanya bisa diubah guru;
//     murid yang diberi izin hanya bisa mengubah kategori miliknya sendiri,
//     dan kategorinya baru tampil untuk murid lain setelah disetujui guru.
//   * Kehadiran saat belajar (keluar/kembali ke aplikasi) dicatat per sesi.
// =====================================================================
import builtin from '../../src/data/builtin.json';
import { translateLines, cleanEmoji, CJK, toPinyin, enOf } from '../../server/translate.js';

const DAY = 864e5;
const PBKDF2_ITER = 10000; // aman untuk batas CPU paket gratis Cloudflare (10 ms). Naikkan jika pakai paket berbayar.
const COOKIE = '__Host-afsid';
const MODES = ['pic', 'han', 'arti', 'mix', 'mw'];
const FRONT_MODES = ['pic', 'han', 'arti', 'mix'];
const COMMON_MW = ['个', '本', '支', '张', '把', '只', '条', '头', '辆', '件', '双', '块', '朵', '棵', '杯', '瓶', '碗', '台', '座', '片', '颗', '根', '匹', '架', '艘', '盏', '扇', '部', '顶', '副', '枚', '位', '家', '所'];
const USERNAME_RE = /^[a-z0-9._]{3,24}$/;
const HEX32 = /^[a-f0-9]{32}$/;
const BUILTIN_VERSION = `en1-v${builtin.decks.length}-${builtin.cards.length}-${builtin.cards.reduce((t, c) => (t + c.id.length * 7 + c.m.length) % 1e9, 0)}`;
const enc = new TextEncoder();
const now = () => Date.now();

class HttpError extends Error { constructor(status, msg) { super(msg); this.status = status; } }
const fail = (status, msg) => { throw new HttpError(status, msg); };

function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...headers },
  });
}

/* ---------------- crypto helpers ---------------- */
const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
const b64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf)));
const unb64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
const randHex = (n = 16) => hex(crypto.getRandomValues(new Uint8Array(n)));
const sha256 = async (s) => hex(await crypto.subtle.digest('SHA-256', enc.encode(s)));
function sameBytes(a, b) {
  if (a.length !== b.length) return false;
  let d = 0; for (let i = 0; i < a.length; i++) d |= a[i] ^ b[i];
  return d === 0;
}
async function pbkdf2(pw, salt, iter) {
  const key = await crypto.subtle.importKey('raw', enc.encode(pw), 'PBKDF2', false, ['deriveBits']);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: iter }, key, 256));
}
async function hashPassword(pw) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  return `pbkdf2$${PBKDF2_ITER}$${b64(salt)}$${b64(await pbkdf2(pw, salt, PBKDF2_ITER))}`;
}
const DUMMY = 'pbkdf2$10000$AAAAAAAAAAAAAAAAAAAAAA==$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=';
async function verifyPassword(pw, stored) {
  const [alg, it, s, h] = String(stored || DUMMY).split('$');
  if (alg !== 'pbkdf2') return false;
  const out = await pbkdf2(pw, unb64(s), Math.min(Math.max(+it || PBKDF2_ITER, 1000), 100000));
  return sameBytes(out, unb64(h));
}
// Password murid: mudah dibaca anak, tanpa huruf/angka yang mirip
function makePassword() {
  const cons = 'bcdfghjkmnprstvwz', vow = 'aeiu', dig = '23456789';
  const r = crypto.getRandomValues(new Uint32Array(12));
  let p = '';
  for (let i = 0; i < 4; i++) p += cons[r[i * 2] % cons.length] + vow[r[i * 2 + 1] % vow.length];
  for (let i = 8; i < 11; i++) p += dig[r[i] % dig.length];
  return p;
}

/* ---------------- validation ---------------- */
function str(v, max, { required = false, label = 'Isian' } = {}) {
  if (v === undefined || v === null) v = '';
  if (typeof v !== 'string') fail(400, `${label} tidak valid.`);
  v = v.replace(/[\u0000-\u001f\u007f<>]/g, '').trim();
  if (required && !v) fail(400, `${label} wajib diisi.`);
  if ([...v].length > max) fail(400, `${label} terlalu panjang (maks ${max}).`);
  return v;
}
const int = (v, lo, hi, label = 'Angka') => { const n = Number(v); if (!Number.isInteger(n) || n < lo || n > hi) fail(400, `${label} tidak valid.`); return n; };

/* ---------------- database setup (otomatis) ---------------- */
const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS meta (k TEXT PRIMARY KEY, v TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, role TEXT NOT NULL CHECK (role IN ('teacher','student')), username TEXT NOT NULL UNIQUE, display_name TEXT NOT NULL, class_name TEXT, active INTEGER NOT NULL DEFAULT 1, pw TEXT NOT NULL, created_at INTEGER NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS auth_sessions (token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, expires INTEGER NOT NULL, created_at INTEGER NOT NULL)`,
  `CREATE INDEX IF NOT EXISTS auth_sessions_user ON auth_sessions(user_id)`,
  `CREATE TABLE IF NOT EXISTS login_attempts (k TEXT NOT NULL, ts INTEGER NOT NULL)`,
  `CREATE INDEX IF NOT EXISTS login_attempts_k ON login_attempts(k, ts)`,
  `CREATE TABLE IF NOT EXISTS settings (id INTEGER PRIMARY KEY CHECK (id = 1), data TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS decks (id TEXT PRIMARY KEY, zh TEXT NOT NULL, py TEXT NOT NULL DEFAULT '', idn TEXT NOT NULL DEFAULT '', color TEXT NOT NULL, kind TEXT NOT NULL DEFAULT 'noun', builtin INTEGER NOT NULL DEFAULT 0, sort INTEGER NOT NULL DEFAULT 100, created_at INTEGER NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS cards (id TEXT PRIMARY KEY, deck_id TEXT NOT NULL REFERENCES decks(id) ON DELETE CASCADE, h TEXT NOT NULL, p TEXT NOT NULL DEFAULT '', m TEXT NOT NULL, mw TEXT NOT NULL DEFAULT '', alt TEXT NOT NULL DEFAULT '[]', opp TEXT NOT NULL DEFAULT '', s TEXT NOT NULL DEFAULT '', sp TEXT NOT NULL DEFAULT '', si TEXT NOT NULL DEFAULT '', pic TEXT NOT NULL DEFAULT '', builtin INTEGER NOT NULL DEFAULT 0, sort INTEGER NOT NULL DEFAULT 0, created_at INTEGER NOT NULL)`,
  `CREATE INDEX IF NOT EXISTS cards_deck ON cards(deck_id)`,
  `CREATE TABLE IF NOT EXISTS deleted_builtin (id TEXT PRIMARY KEY)`,
  `CREATE TABLE IF NOT EXISTS srs (user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, card_id TEXT NOT NULL REFERENCES cards(id) ON DELETE CASCADE, due INTEGER NOT NULL, last INTEGER NOT NULL, PRIMARY KEY (user_id, card_id))`,
  `CREATE TABLE IF NOT EXISTS runs (id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, decks TEXT NOT NULL, mode TEXT NOT NULL, started_at INTEGER NOT NULL, finished_at INTEGER, total INTEGER NOT NULL DEFAULT 0, score INTEGER, c1 INTEGER NOT NULL DEFAULT 0, c2 INTEGER NOT NULL DEFAULT 0, c3 INTEGER NOT NULL DEFAULT 0, c4 INTEGER NOT NULL DEFAULT 0, quiz_right INTEGER NOT NULL DEFAULT 0, quiz_total INTEGER NOT NULL DEFAULT 0, seconds INTEGER NOT NULL DEFAULT 0)`,
  `CREATE INDEX IF NOT EXISTS runs_user ON runs(user_id, started_at)`,
  `CREATE INDEX IF NOT EXISTS runs_started ON runs(started_at)`,
  `CREATE TABLE IF NOT EXISTS answers (id INTEGER PRIMARY KEY AUTOINCREMENT, run_id TEXT NOT NULL REFERENCES runs(id) ON DELETE CASCADE, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, card_id TEXT NOT NULL, deck_id TEXT NOT NULL, card_h TEXT NOT NULL, rating INTEGER NOT NULL, quiz_correct INTEGER, ms INTEGER NOT NULL, first_try INTEGER NOT NULL, created_at INTEGER NOT NULL)`,
  `CREATE INDEX IF NOT EXISTS answers_run ON answers(run_id, card_id)`,
  `CREATE INDEX IF NOT EXISTS answers_time ON answers(created_at)`,
  `CREATE TABLE IF NOT EXISTS quiz_pending (run_id TEXT NOT NULL REFERENCES runs(id) ON DELETE CASCADE, card_id TEXT NOT NULL, correct TEXT NOT NULL, tokens TEXT NOT NULL, answered INTEGER NOT NULL DEFAULT 0, result INTEGER, PRIMARY KEY (run_id, card_id))`,
  `CREATE TABLE IF NOT EXISTS images (id TEXT PRIMARY KEY, type TEXT NOT NULL, data BLOB NOT NULL, created_at INTEGER NOT NULL)`,
];
const MIGRATIONS = [
  `ALTER TABLE users ADD COLUMN can_create INTEGER NOT NULL DEFAULT 0`,
  `ALTER TABLE decks ADD COLUMN owner_id TEXT`,
  `ALTER TABLE decks ADD COLUMN status TEXT NOT NULL DEFAULT 'public'`,
  `ALTER TABLE runs ADD COLUMN planned INTEGER NOT NULL DEFAULT 0`,
  `ALTER TABLE runs ADD COLUMN away_count INTEGER NOT NULL DEFAULT 0`,
  `ALTER TABLE runs ADD COLUMN away_ms INTEGER NOT NULL DEFAULT 0`,
  `ALTER TABLE runs ADD COLUMN last_seen INTEGER`,
  `ALTER TABLE runs ADD COLUMN state TEXT NOT NULL DEFAULT 'active'`,
  `ALTER TABLE runs ADD COLUMN state_since INTEGER`,
  `ALTER TABLE runs ADD COLUMN ended_by TEXT`,
  `ALTER TABLE cards ADD COLUMN en TEXT NOT NULL DEFAULT ''`,
  `ALTER TABLE answers ADD COLUMN clue INTEGER NOT NULL DEFAULT 0`,
  `ALTER TABLE answers ADD COLUMN rush INTEGER NOT NULL DEFAULT 0`,
  `ALTER TABLE runs ADD COLUMN rush INTEGER NOT NULL DEFAULT 0`,
  `ALTER TABLE runs ADD COLUMN clues INTEGER NOT NULL DEFAULT 0`,
  `ALTER TABLE quiz_pending ADD COLUMN issued_at INTEGER`,
  `CREATE INDEX IF NOT EXISTS decks_owner ON decks(owner_id)`,
  `CREATE INDEX IF NOT EXISTS runs_seen ON runs(last_seen)`,
  `CREATE TABLE IF NOT EXISTS usage (k TEXT NOT NULL, ts INTEGER NOT NULL)`,
  `CREATE INDEX IF NOT EXISTS usage_k ON usage(k, ts)`,
  `CREATE TABLE IF NOT EXISTS deliveries (id TEXT PRIMARY KEY, deck_id TEXT NOT NULL REFERENCES decks(id) ON DELETE CASCADE, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, created_at INTEGER NOT NULL, seen_at INTEGER, UNIQUE (deck_id, user_id))`,
  `CREATE INDEX IF NOT EXISTS deliveries_user ON deliveries(user_id)`,
  `CREATE TABLE IF NOT EXISTS messages (id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, kind TEXT NOT NULL, text TEXT NOT NULL, created_at INTEGER NOT NULL, seen_at INTEGER)`,
  `CREATE INDEX IF NOT EXISTS messages_user ON messages(user_id, seen_at)`,
  `ALTER TABLE deliveries ADD COLUMN sender_id TEXT`,
];
const SCHEMA_VERSION = '5';
const RUSH_RATE_MS = 1200, RUSH_QUIZ_MS = 700;
const DEFAULT_SETTINGS = { modes: ['pic', 'han', 'arti', 'mix'], default_mode: 'pic', student_can_choose: true, quiz_enabled: true, hidden_decks: [] };
let ready = null;
function ensureReady(db) {
  if (!ready) ready = (async () => {
    await db.batch(SCHEMA.map((s) => db.prepare(s)));
    if ((await db.prepare("SELECT v FROM meta WHERE k = 'schema'").first('v')) !== SCHEMA_VERSION) {
      for (const m of MIGRATIONS) { try { await db.prepare(m).run(); } catch (e) { if (!/duplicate column/i.test(String(e && e.message))) throw e; } }
      await db.prepare("INSERT INTO meta (k, v) VALUES ('schema', ?1) ON CONFLICT(k) DO UPDATE SET v = excluded.v").bind(SCHEMA_VERSION).run();
    }
    await db.prepare('INSERT OR IGNORE INTO settings (id, data) VALUES (1, ?)').bind(JSON.stringify(DEFAULT_SETTINGS)).run();
    const v = await db.prepare("SELECT v FROM meta WHERE k = 'builtin'").first('v');
    if (v !== BUILTIN_VERSION) await seedBuiltin(db);
  })().catch((e) => { ready = null; throw e; });
  return ready;
}
async function seedBuiltin(db) {
  const del = new Set((await db.prepare('SELECT id FROM deleted_builtin').all()).results.map((r) => r.id));
  const t = now();
  const stmts = [];
  for (const d of builtin.decks) {
    if (del.has('deck:' + d.id)) continue;
    stmts.push(db.prepare(`INSERT INTO decks (id, zh, py, idn, color, kind, builtin, sort, created_at) VALUES (?1,?2,?3,?4,?5,?6,1,?7,?8)
      ON CONFLICT(id) DO UPDATE SET zh=excluded.zh, py=excluded.py, idn=excluded.idn, color=excluded.color, kind=excluded.kind, sort=excluded.sort`)
      .bind(d.id, d.zh, d.py, d.idn, d.color, d.kind, d.sort, t));
  }
  for (const c of builtin.cards) {
    if (del.has(c.id) || del.has('deck:' + c.deck_id)) continue;
    stmts.push(db.prepare(`INSERT INTO cards (id, deck_id, h, p, m, mw, alt, opp, s, sp, si, pic, builtin, sort, created_at, en) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,1,?13,?14,?15)
      ON CONFLICT(id) DO UPDATE SET h=excluded.h, p=excluded.p, m=excluded.m, mw=excluded.mw, alt=excluded.alt, opp=excluded.opp, s=excluded.s, sp=excluded.sp, si=excluded.si, pic=excluded.pic, sort=excluded.sort, en=excluded.en`)
      .bind(c.id, c.deck_id, c.h, c.p, c.m, c.mw, JSON.stringify(c.alt || []), c.opp, c.s, c.sp, c.si, c.pic, c.sort, t, enOf(c.h)));
  }
  for (let i = 0; i < stmts.length; i += 50) await db.batch(stmts.slice(i, i + 50));
  await db.prepare("INSERT INTO meta (k, v) VALUES ('builtin', ?1) ON CONFLICT(k) DO UPDATE SET v = excluded.v").bind(BUILTIN_VERSION).run();
}

/* ---------------- settings ---------------- */
function cleanSettings(s) {
  s = s && typeof s === 'object' ? s : {};
  const modes = Array.isArray(s.modes) ? FRONT_MODES.filter((m) => s.modes.includes(m)) : FRONT_MODES.slice();
  const ms = modes.length ? modes : ['pic'];
  const hidden = Array.isArray(s.hidden_decks) ? [...new Set(s.hidden_decks.filter((x) => typeof x === 'string' && /^[a-z0-9_]{2,32}$/.test(x)))].slice(0, 300) : [];
  return { modes: ms, default_mode: ms.includes(s.default_mode) ? s.default_mode : ms[0], student_can_choose: s.student_can_choose !== false, quiz_enabled: s.quiz_enabled !== false, mw_quiz: s.mw_quiz !== false, all_can_create: s.all_can_create !== false, hidden_decks: hidden };
}
async function getSettings(db) {
  const row = await db.prepare('SELECT data FROM settings WHERE id = 1').first('data');
  try { return cleanSettings(JSON.parse(row)); } catch (_) { return cleanSettings(DEFAULT_SETTINGS); }
}

/* ---------------- auth ---------------- */
const pubUser = (u) => ({ id: u.id, role: u.role, username: u.username, display_name: u.display_name, class_name: u.class_name, active: !!u.active, can_create: u.role === 'teacher' || !!u.can_create });
const isTeacher = (u) => u.role === 'teacher';
function deckVisible(u, d, settings, delivered) {
  if (isTeacher(u) || (d.owner_id && d.owner_id === u.id)) return true;
  if (delivered && delivered.has(d.id)) return true;
  return d.status === 'public' && !settings.hidden_decks.includes(d.id);
}
async function deliveredMap(db, u) {
  const rows = (await db.prepare(`SELECT l.deck_id, l.created_at, s.display_name AS from_name, s.role AS from_role FROM deliveries l LEFT JOIN users s ON s.id = l.sender_id WHERE l.user_id = ?1`).bind(u.id).all()).results;
  const m = new Map(rows.map((r) => [r.deck_id, r.created_at]));
  m.from = new Map(rows.map((r) => [r.deck_id, r.from_role === 'student' ? r.from_name || 'Teman' : null]));
  return m;
}
// Penerima: semua murid, satu kelas, atau daftar murid tertentu
async function targets(db, to) {
  if (!to || typeof to !== 'object') fail(400, 'Pilih penerima.');
  let rows;
  if (to.all === true) rows = (await db.prepare("SELECT id FROM users WHERE role = 'student' AND active = 1").all()).results;
  else if (typeof to.class === 'string' && to.class) rows = (await db.prepare("SELECT id FROM users WHERE role = 'student' AND active = 1 AND class_name = ?1").bind(to.class.slice(0, 30)).all()).results;
  else if (Array.isArray(to.users)) {
    const ids = to.users.filter((x) => typeof x === 'string' && HEX32.test(x)).slice(0, 500);
    rows = [];
    for (let i = 0; i < ids.length; i += 50) {
      const part = ids.slice(i, i + 50);
      rows.push(...(await db.prepare(`SELECT id FROM users WHERE role = 'student' AND id IN (${part.map((_, k) => '?' + (k + 1)).join(',')})`).bind(...part).all()).results);
    }
  } else fail(400, 'Pilih penerima.');
  if (!rows.length) fail(400, 'Tidak ada murid penerima.');
  return rows.map((r) => r.id);
}
const canEditDeck = (u, d) => isTeacher(u) || (!!u.can_create && !!d.owner_id && d.owner_id === u.id);
async function usageOk(db, key, limit, windowMs) {
  const n = await db.prepare('SELECT COUNT(*) AS n FROM usage WHERE k = ?1 AND ts > ?2').bind(key, now() - windowMs).first('n');
  if (n >= limit) return false;
  await db.prepare('INSERT INTO usage (k, ts) VALUES (?1, ?2)').bind(key, now()).run();
  return true;
}
function cardFields(b, { partial = false } = {}) {
  const h = str(b.h, 12, { required: !partial, label: '汉字' });
  if (h && !CJK.test(h)) fail(400, `"${h}" bukan hanzi.`);
  return { h, p: str(b.p, 60, { label: 'Pinyin' }), m: str(b.m, 60, { required: !partial, label: 'Arti' }), en: str(b.en, 60, { label: 'English' }), mw: str(b.mw, 2, { label: '量词' }), pic: picOk(b.pic) };
}
function readCookie(req, name) {
  const c = req.headers.get('Cookie') || '';
  for (const part of c.split(';')) { const [k, ...v] = part.trim().split('='); if (k === name) return v.join('='); }
  return null;
}
async function currentUser(req, db) {
  const tok = readCookie(req, COOKIE);
  if (!tok || !/^[a-f0-9]{64}$/.test(tok)) return null;
  return db.prepare(`SELECT u.* FROM auth_sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ?1 AND s.expires > ?2 AND u.active = 1`)
    .bind(await sha256(tok), now()).first();
}
async function newSession(db, user) {
  const tok = randHex(32);
  const ttl = user.role === 'teacher' ? 7 * DAY : 30 * DAY;
  await db.prepare('INSERT INTO auth_sessions (token_hash, user_id, expires, created_at) VALUES (?1,?2,?3,?4)').bind(await sha256(tok), user.id, now() + ttl, now()).run();
  return `${COOKIE}=${tok}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${Math.floor(ttl / 1000)}`;
}
const clearCookie = `${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`;
async function limited(db, keys, limits) {
  const since = now() - 15 * 60e3;
  for (let i = 0; i < keys.length; i++) {
    const n = await db.prepare('SELECT COUNT(*) AS n FROM login_attempts WHERE k = ?1 AND ts > ?2').bind(keys[i], since).first('n');
    if (n >= limits[i]) return true;
  }
  return false;
}
const recordFail = (db, keys) => db.batch(keys.map((k) => db.prepare('INSERT INTO login_attempts (k, ts) VALUES (?1, ?2)').bind(k, now())));

/* ---------------- study helpers ---------------- */
function fmtRun(r) {
  if (!r) return null;
  let decks = []; try { decks = JSON.parse(r.decks); } catch (_) { /* rusak */ }
  return { id: r.id, student_id: r.user_id, decks, mode: r.mode, started_at: new Date(r.started_at).toISOString(), finished_at: r.finished_at ? new Date(r.finished_at).toISOString() : null, total: r.total, score: r.score, c1: r.c1, c2: r.c2, c3: r.c3, c4: r.c4, quiz_right: r.quiz_right, quiz_total: r.quiz_total, seconds: r.seconds, away_count: r.away_count || 0, away_ms: r.away_ms || 0, ended_by: r.ended_by || null, rush: r.rush || 0, clues: r.clues || 0 };
}
async function openRun(db, user, id) {
  if (typeof id !== 'string' || !HEX32.test(id)) fail(400, 'Sesi tidak valid.');
  const r = await db.prepare('SELECT * FROM runs WHERE id = ?1 AND user_id = ?2').bind(id, user.id).first();
  if (!r) fail(404, 'Sesi tidak ditemukan.');
  if (r.finished_at) fail(409, 'Sesi ini sudah selesai.');
  if (r.started_at < now() - 6 * 3600e3) fail(409, 'Sesi terlalu lama dibiarkan. Mulai sesi baru.');
  r.deckList = JSON.parse(r.decks);
  return r;
}
async function finishRun(db, run, by) {
  const a = await db.prepare(`SELECT COUNT(*) AS total, SUM(rating = 1) AS c1, SUM(rating = 2) AS c2, SUM(rating = 3) AS c3, SUM(rating = 4) AS c4,
      SUM(quiz_correct IS NOT NULL) AS qt, SUM(quiz_correct = 1) AS qr, AVG(rating * 25.0) AS sc FROM answers WHERE run_id = ?1 AND first_try = 1`).bind(run.id).first();
  const t = now();
  await db.batch([
    db.prepare(`UPDATE runs SET finished_at = ?2, total = ?3, c1 = ?4, c2 = ?5, c3 = ?6, c4 = ?7, quiz_total = ?8, quiz_right = ?9, score = ?10, seconds = ?11,
        away_ms = away_ms + CASE WHEN state = 'away' THEN MIN(MAX(0, ?2 - COALESCE(state_since, ?2)), 21600000) ELSE 0 END, state = 'done', last_seen = ?2, ended_by = ?12 WHERE id = ?1 AND finished_at IS NULL`)
      .bind(run.id, t, a.total || 0, a.c1 || 0, a.c2 || 0, a.c3 || 0, a.c4 || 0, a.qt || 0, a.qr || 0, a.total ? Math.round(a.sc) : null, Math.min(21600, Math.round((t - run.started_at) / 1000)), by),
    db.prepare('DELETE FROM quiz_pending WHERE run_id = ?1').bind(run.id),
  ]);
}
async function runCard(db, run, cardId) {
  if (typeof cardId !== 'string' || cardId.length > 64) fail(400, 'Kartu tidak valid.');
  const c = await db.prepare('SELECT * FROM cards WHERE id = ?1').bind(cardId).first();
  if (!c || !run.deckList.includes(c.deck_id)) fail(400, 'Kartu tidak ada di sesi ini.');
  return c;
}
function picOk(p) {
  if (!p) return '';
  if (typeof p !== 'string') fail(400, 'Gambar tidak valid.');
  if (/^\/api\/img\/[a-f0-9]{32}$/.test(p)) return p;
  if (/^i\d{1,4}$/.test(p)) return p;
  if (cleanEmoji(p)) return p;
  fail(400, 'Gambar tidak valid.');
}
function sniffImage(b) {
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return 'image/png';
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg';
  if (b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46) return 'image/gif';
  if (b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return 'image/webp';
  return null;
}

/* ---------------- router ---------------- */
export async function onRequest(ctx) {
  const { request: req, env } = ctx;
  try {
    if (!env.DB) fail(500, 'Database belum disambungkan. Ikuti langkah "Bindings" di panduan.');
    const db = env.DB;
    const url = new URL(req.url);
    const path = url.pathname.replace(/^\/api/, '').replace(/\/+$/, '') || '/';
    const method = req.method;
    if (method !== 'GET' && method !== 'HEAD') {
      const origin = req.headers.get('Origin');
      if (!origin || origin !== url.origin) fail(403, 'Permintaan ditolak.');
    }
    await ensureReady(db);

    const len = Number(req.headers.get('Content-Length') || 0);
    const body = async (max = 64 * 1024) => {
      if (len > max) fail(413, 'Data terlalu besar.');
      if (!(req.headers.get('Content-Type') || '').startsWith('application/json')) fail(415, 'Format tidak didukung.');
      const t = await req.text(); if (t.length > max) fail(413, 'Data terlalu besar.');
      try { const j = JSON.parse(t); if (!j || typeof j !== 'object' || Array.isArray(j)) throw 0; return j; } catch (_) { fail(400, 'Data tidak valid.'); }
    };
    const ip = req.headers.get('CF-Connecting-IP') || 'local';

    /* ----- tanpa login ----- */
    if (path === '/setup' && method === 'GET') {
      const has = await db.prepare("SELECT 1 FROM users WHERE role = 'teacher' LIMIT 1").first();
      return json({ needsSetup: !has, configured: !!env.SETUP_CODE });
    }
    if (path === '/setup' && method === 'POST') {
      if (!env.SETUP_CODE || String(env.SETUP_CODE).length < 8) fail(500, 'SETUP_CODE belum diatur di Cloudflare (minimal 8 karakter).');
      if (await limited(db, ['setup:' + ip], [10])) fail(429, 'Terlalu banyak percobaan. Tunggu 15 menit.');
      const b = await body();
      const ok = sameBytes(enc.encode(await sha256(String(b.code || ''))), enc.encode(await sha256(String(env.SETUP_CODE))));
      if (!ok) { await recordFail(db, ['setup:' + ip]); fail(403, 'Kode setup salah.'); }
      const username = str(b.username, 24, { required: true, label: 'Username' }).toLowerCase();
      if (!USERNAME_RE.test(username)) fail(400, 'Username 3–24 karakter: huruf kecil, angka, titik, atau garis bawah.');
      const display_name = str(b.display_name, 40, { required: true, label: 'Nama' });
      const pw = typeof b.password === 'string' ? b.password : '';
      if (pw.length < 10 || pw.length > 128) fail(400, 'Password guru minimal 10 karakter.');
      const id = randHex(16);
      const res = await db.prepare(`INSERT INTO users (id, role, username, display_name, active, pw, created_at)
        SELECT ?1, 'teacher', ?2, ?3, 1, ?4, ?5 WHERE NOT EXISTS (SELECT 1 FROM users WHERE role = 'teacher')`).bind(id, username, display_name, await hashPassword(pw), now()).run();
      if (!res.meta.changes) fail(409, 'Akun guru sudah dibuat sebelumnya.');
      const user = await db.prepare('SELECT * FROM users WHERE id = ?1').bind(id).first();
      return json(pubUser(user), 200, { 'Set-Cookie': await newSession(db, user) });
    }
    if (path === '/login' && method === 'POST') {
      const b = await body(4096);
      const username = String(b.username || '').trim().toLowerCase().slice(0, 64);
      const pw = typeof b.password === 'string' ? b.password.slice(0, 128) : '';
      const keys = ['u:' + username, 'ip:' + ip];
      if (await limited(db, keys, [5, 30])) fail(429, 'Terlalu banyak percobaan. Tunggu 15 menit lalu coba lagi.');
      const user = USERNAME_RE.test(username) ? await db.prepare('SELECT * FROM users WHERE username = ?1').bind(username).first() : null;
      const ok = await verifyPassword(pw, user ? user.pw : DUMMY);
      if (!user || !ok) { await recordFail(db, keys); fail(401, 'Username atau password salah.'); }
      if (!user.active) fail(403, 'Akun ini tidak aktif. Hubungi gurumu.');
      await db.batch([
        db.prepare('DELETE FROM login_attempts WHERE k = ?1').bind('u:' + username),
        db.prepare('DELETE FROM login_attempts WHERE ts < ?1').bind(now() - DAY),
        db.prepare('DELETE FROM auth_sessions WHERE expires < ?1').bind(now()),
      ]);
      return json(pubUser(user), 200, { 'Set-Cookie': await newSession(db, user) });
    }
    if (path === '/logout' && method === 'POST') {
      const tok = readCookie(req, COOKIE);
      if (tok && /^[a-f0-9]{64}$/.test(tok)) await db.prepare('DELETE FROM auth_sessions WHERE token_hash = ?1').bind(await sha256(tok)).run();
      return json({ ok: true }, 200, { 'Set-Cookie': clearCookie });
    }

    /* ----- wajib login ----- */
    const user = await currentUser(req, db);
    if (!user) return json({ error: 'Silakan masuk lagi.' }, 401, { 'Set-Cookie': clearCookie });
    const teacher = user.role === 'teacher';
    // izin buat kartu: per murid, atau untuk semua murid lewat pengaturan guru
    if (!teacher && !user.can_create && (await getSettings(db)).all_can_create) user.can_create = 1;
    const needTeacher = () => { if (!teacher) fail(403, 'Khusus guru.'); };

    if (path === '/me' && method === 'GET') return json(pubUser(user));

    if (path.startsWith('/img/') && method === 'GET') {
      const id = path.slice(5);
      if (!HEX32.test(id)) fail(404, 'Tidak ditemukan.');
      const img = await db.prepare('SELECT type, data FROM images WHERE id = ?1').bind(id).first();
      if (!img) fail(404, 'Tidak ditemukan.');
      return new Response(new Uint8Array(img.data), { headers: { 'Content-Type': img.type, 'Cache-Control': 'private, max-age=86400', 'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "default-src 'none'" } });
    }

    if (path === '/content' && method === 'GET') {
      const settings = await getSettings(db);
      const dmap = await deliveredMap(db, user);
      const decks = (await db.prepare('SELECT d.*, u.display_name AS owner_name FROM decks d LEFT JOIN users u ON u.id = d.owner_id ORDER BY d.sort, d.created_at').all()).results.filter((d) => deckVisible(user, d, settings, dmap));
      const ok = new Set(decks.map((d) => d.id));
      const cards = (await db.prepare('SELECT id, deck_id, h, p, m, en, mw, alt, opp, s, sp, si, pic, builtin, sort FROM cards ORDER BY deck_id, sort, created_at').all()).results
        .filter((c) => ok.has(c.deck_id)).map((c) => ({ ...c, en: c.en || enOf(c.h), alt: (() => { try { return JSON.parse(c.alt); } catch (_) { return []; } })(), builtin: !!c.builtin }));
      return json({ settings, decks: decks.map((d) => ({ ...d, builtin: !!d.builtin, mine: d.owner_id === user.id, editable: canEditDeck(user, d), owner_name: d.owner_id ? d.owner_name || 'Murid' : null, delivered_at: dmap.get(d.id) || null, delivered_from: dmap.from.get(d.id) || null })), cards, me: pubUser(user) });
    }
    if (path === '/srs' && method === 'GET') {
      const rows = (await db.prepare('SELECT card_id, due, last FROM srs WHERE user_id = ?1').bind(user.id).all()).results;
      return json(Object.fromEntries(rows.map((r) => [r.card_id, { due: r.due, last: r.last }])));
    }

    /* ----- sesi belajar ----- */
    if (path === '/run/start' && method === 'POST') {
      const b = await body();
      if (!MODES.includes(b.mode)) fail(400, 'Mode tidak valid.');
      if (b.mode === 'mw' && (await getSettings(db)).mw_quiz === false) fail(403, 'Kuis kata satuan sedang dimatikan guru.');
      if (!Array.isArray(b.decks) || b.decks.length < 1 || b.decks.length > 60) fail(400, 'Pilih kategori dulu.');
      const decks = [...new Set(b.decks.filter((d) => typeof d === 'string'))];
      const settings = await getSettings(db);
      const dmap = await deliveredMap(db, user);
      for (const d of decks) {
        const row = await db.prepare('SELECT * FROM decks WHERE id = ?1').bind(d).first();
        if (!row || !deckVisible(user, row, settings, dmap)) fail(400, 'Kategori tidak tersedia.');
      }
      const recent = await db.prepare('SELECT COUNT(*) AS n FROM runs WHERE user_id = ?1 AND started_at > ?2').bind(user.id, now() - 3600e3).first('n');
      if (recent >= 60) fail(429, 'Terlalu banyak sesi dalam satu jam. Istirahat dulu ya.');
      const id = randHex(16);
      const planned = Math.max(0, Math.min(5000, Math.round(Number(b.planned) || 0)));
      await db.prepare("INSERT INTO runs (id, user_id, decks, mode, started_at, planned, last_seen, state, state_since) VALUES (?1,?2,?3,?4,?5,?6,?5,'active',?5)").bind(id, user.id, JSON.stringify(decks), b.mode, now(), planned).run();
      return json({ id });
    }
    if (path === '/run/status' && method === 'GET') {
      const sid = url.searchParams.get('sid') || '';
      if (!HEX32.test(sid)) return json({ open: false });
      const r = await db.prepare('SELECT finished_at, started_at, ended_by FROM runs WHERE id = ?1 AND user_id = ?2').bind(sid, user.id).first();
      return json({ open: !!r && !r.finished_at && r.started_at > now() - 6 * 3600e3, ended_by: r ? r.ended_by : null });
    }
    if (path === '/classmates' && method === 'GET') {
      const rows = (await db.prepare("SELECT id, display_name, class_name FROM users WHERE role = 'student' AND active = 1 AND id <> ?1 ORDER BY class_name, display_name LIMIT 500").bind(user.id).all()).results;
      return json(rows);
    }
    if (path === '/inbox' && method === 'GET') {
      const msgs = (await db.prepare('SELECT id, kind, text, created_at FROM messages WHERE user_id = ?1 AND seen_at IS NULL ORDER BY created_at LIMIT 20').bind(user.id).all()).results;
      const dels = (await db.prepare(`SELECT l.id, l.deck_id, l.created_at, d.zh, d.idn, d.color, (SELECT COUNT(*) FROM cards c WHERE c.deck_id = d.id) AS n,
          CASE WHEN s.role = 'student' THEN s.display_name ELSE NULL END AS from_name
        FROM deliveries l JOIN decks d ON d.id = l.deck_id LEFT JOIN users s ON s.id = l.sender_id WHERE l.user_id = ?1 AND l.seen_at IS NULL ORDER BY l.created_at LIMIT 20`).bind(user.id).all()).results;
      return json({ messages: msgs, deliveries: dels });
    }
    if (path === '/inbox/seen' && method === 'POST') {
      const b = await body(8192); const t = now(); const st = [];
      for (const id of (Array.isArray(b.messages) ? b.messages : []).slice(0, 50)) if (typeof id === 'string' && HEX32.test(id)) st.push(db.prepare('UPDATE messages SET seen_at = ?3 WHERE id = ?1 AND user_id = ?2 AND seen_at IS NULL').bind(id, user.id, t));
      for (const id of (Array.isArray(b.deliveries) ? b.deliveries : []).slice(0, 50)) if (typeof id === 'string' && HEX32.test(id)) st.push(db.prepare('UPDATE deliveries SET seen_at = ?3 WHERE id = ?1 AND user_id = ?2 AND seen_at IS NULL').bind(id, user.id, t));
      if (st.length) await db.batch(st);
      return json({ ok: true });
    }
    if (path === '/run/presence' && method === 'POST') {
      const b = await body(1024);
      if (typeof b.sid !== 'string' || !HEX32.test(b.sid)) fail(400, 'Sesi tidak valid.');
      const r = await db.prepare('SELECT * FROM runs WHERE id = ?1 AND user_id = ?2').bind(b.sid, user.id).first();
      if (!r || r.finished_at || r.started_at < now() - 6 * 3600e3) return json({ ok: false, ended_by: r ? r.ended_by : null });
      const st = b.state === 'away' ? 'away' : 'active', t = now();
      if (st === 'away' && r.state !== 'away' && r.away_count < 1000) {
        await db.prepare("UPDATE runs SET state = 'away', state_since = ?2, away_count = away_count + 1, last_seen = ?2 WHERE id = ?1").bind(r.id, t).run();
      } else if (st === 'active' && r.state === 'away') {
        await db.prepare("UPDATE runs SET state = 'active', away_ms = away_ms + ?3, state_since = ?2, last_seen = ?2 WHERE id = ?1").bind(r.id, t, Math.min(Math.max(0, t - (r.state_since || t)), 6 * 3600e3)).run();
      } else {
        await db.prepare('UPDATE runs SET last_seen = ?2 WHERE id = ?1').bind(r.id, t).run();
      }
      return json({ ok: true, away_count: st === 'away' && r.state !== 'away' ? r.away_count + 1 : r.away_count });
    }
    if (path === '/run/quiz' && method === 'POST') {
      const b = await body();
      const run = await openRun(db, user, b.sid);
      const c = await runCard(db, run, b.card);
      const prev = await db.prepare('SELECT answered, result FROM quiz_pending WHERE run_id = ?1 AND card_id = ?2').bind(run.id, c.id).first();
      if (prev && prev.answered) return json({ answered: true, correct: !!prev.result });
      const pend = await db.prepare('SELECT COUNT(*) AS n FROM quiz_pending WHERE run_id = ?1').bind(run.id).first('n');
      if (pend > 3000) fail(429, 'Batas sesi tercapai.');
      const shuffleIn = (all) => { for (let i = all.length - 1; i > 0; i--) { const j = crypto.getRandomValues(new Uint32Array(1))[0] % (i + 1); [all[i], all[j]] = [all[j], all[i]]; } return all; };
      let opts;
      if (b.kind === 'mw') {
        if (!c.mw) fail(400, 'Kartu ini tidak punya kata satuan.');
        let alt = []; try { alt = JSON.parse(c.alt || '[]'); } catch (_) { /* kosong */ }
        const used = (await db.prepare("SELECT DISTINCT mw FROM cards WHERE mw <> ''").all()).results.map((r) => r.mw);
        const pool = shuffleIn([...new Set([...COMMON_MW, ...used])].filter((w) => w !== c.mw && !alt.includes(w))).slice(0, 3);
        opts = shuffleIn([c.mw, ...pool]).map((w) => ({ t: randHex(9), w, y: toPinyin(w), _ok: w === c.mw }));
      } else {
        const others = (await db.prepare('SELECT id, h, p, m, en FROM cards WHERE deck_id = ?1 AND id <> ?2 AND h <> ?3 AND m <> ?4 ORDER BY RANDOM() LIMIT 3').bind(c.deck_id, c.id, c.h, c.m).all()).results;
        opts = shuffleIn([{ id: c.id, h: c.h, p: c.p, m: c.m, en: c.en }, ...others]).map((o) => ({ t: randHex(9), h: o.h, p: o.p, m: o.m, en: o.en || enOf(o.h), _ok: o.id === c.id }));
      }
      const correct = opts.find((o) => o._ok).t;
      await db.prepare(`INSERT INTO quiz_pending (run_id, card_id, correct, tokens, answered, result, issued_at) VALUES (?1,?2,?3,?4,0,NULL,?5)
        ON CONFLICT(run_id, card_id) DO UPDATE SET correct = excluded.correct, tokens = excluded.tokens, answered = 0, result = NULL, issued_at = excluded.issued_at`).bind(run.id, c.id, correct, JSON.stringify(opts.map((o) => o.t)), now()).run();
      return json(opts.map(({ _ok, ...o }) => o));
    }
    if (path === '/run/answer' && method === 'POST') {
      const b = await body();
      const run = await openRun(db, user, b.sid);
      if (typeof b.card !== 'string' || typeof b.token !== 'string') fail(400, 'Jawaban tidak valid.');
      const q = await db.prepare('SELECT * FROM quiz_pending WHERE run_id = ?1 AND card_id = ?2').bind(run.id, b.card).first();
      if (!q || q.answered) fail(409, 'Pertanyaan tidak valid.');
      if (!JSON.parse(q.tokens).includes(b.token)) fail(400, 'Jawaban tidak valid.');
      const ok = b.token === q.correct;
      const upd = await db.prepare('UPDATE quiz_pending SET answered = 1, result = ?3 WHERE run_id = ?1 AND card_id = ?2 AND answered = 0').bind(run.id, b.card, ok ? 1 : 0).run();
      if (!upd.meta.changes) fail(409, 'Pertanyaan sudah dijawab.');
      // dijawab kurang dari 0,7 detik setelah pilihan muncul = asal tekan
      const rush = !!q.issued_at && now() - q.issued_at < RUSH_QUIZ_MS;
      if (rush) await db.prepare('UPDATE runs SET rush = rush + 1 WHERE id = ?1').bind(run.id).run();
      return json({ correct: ok, correct_token: q.correct, rush, rush_count: run.rush + (rush ? 1 : 0) });
    }
    if (path === '/run/rate' && method === 'POST') {
      const b = await body();
      const run = await openRun(db, user, b.sid);
      const rating = int(b.rating, 1, 4, 'Nilai');
      const ms = Math.max(0, Math.min(600000, Math.round(Number(b.ms) || 0)));
      const c = await runCard(db, run, b.card);
      const n = await db.prepare('SELECT COUNT(*) AS n FROM answers WHERE run_id = ?1').bind(run.id).first('n');
      if (n >= 3000) fail(429, 'Batas jawaban sesi tercapai.');
      const first = !(await db.prepare('SELECT 1 FROM answers WHERE run_id = ?1 AND card_id = ?2').bind(run.id, c.id).first());
      const q = await db.prepare('SELECT answered, result FROM quiz_pending WHERE run_id = ?1 AND card_id = ?2').bind(run.id, c.id).first();
      const due = now() + (rating === 3 ? DAY : rating === 4 ? 3 * DAY : 0);
      // asal tekan: jarak dari jawaban sebelumnya terlalu singkat (dihitung server, tidak bisa dipalsukan)
      const prevAt = await db.prepare('SELECT MAX(created_at) AS t FROM answers WHERE run_id = ?1').bind(run.id).first('t');
      const rush = now() - Math.max(prevAt || 0, run.started_at) < RUSH_RATE_MS ? 1 : 0;
      const clue = b.clue === true ? 1 : 0;
      await db.batch([
        db.prepare('INSERT INTO answers (run_id, user_id, card_id, deck_id, card_h, rating, quiz_correct, ms, first_try, created_at, clue, rush) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12)')
          .bind(run.id, user.id, c.id, c.deck_id, c.h, rating, q && q.answered ? q.result : null, ms, first ? 1 : 0, now(), clue, rush),
        db.prepare('UPDATE runs SET rush = rush + ?2, clues = clues + ?3 WHERE id = ?1').bind(run.id, rush, clue),
        db.prepare('DELETE FROM quiz_pending WHERE run_id = ?1 AND card_id = ?2').bind(run.id, c.id),
        db.prepare('INSERT INTO srs (user_id, card_id, due, last) VALUES (?1,?2,?3,?4) ON CONFLICT(user_id, card_id) DO UPDATE SET due = excluded.due, last = excluded.last').bind(user.id, c.id, due, rating),
      ]);
      return json({ ok: true, rush: !!rush, rush_count: (run.rush || 0) + rush });
    }
    if (path === '/run/finish' && method === 'POST') {
      const b = await body();
      const run = await openRun(db, user, b.sid);
      await finishRun(db, run, b.early === true ? 'self' : null);
      return json(fmtRun(await db.prepare('SELECT * FROM runs WHERE id = ?1').bind(run.id).first()));
    }
    if (path === '/runs/mine' && method === 'GET') {
      const rows = (await db.prepare('SELECT * FROM runs WHERE user_id = ?1 AND finished_at IS NOT NULL ORDER BY started_at DESC LIMIT 60').bind(user.id).all()).results;
      return json(rows.map(fmtRun));
    }

    /* ----- guru ----- */
    if (path === '/password' && method === 'POST') {
      needTeacher();
      const b = await body(4096);
      if (!(await verifyPassword(String(b.old || ''), user.pw))) fail(403, 'Password lama salah.');
      const pw = typeof b.new === 'string' ? b.new : '';
      if (pw.length < 10 || pw.length > 128) fail(400, 'Password baru minimal 10 karakter.');
      await db.batch([
        db.prepare('UPDATE users SET pw = ?2 WHERE id = ?1').bind(user.id, await hashPassword(pw)),
        db.prepare('DELETE FROM auth_sessions WHERE user_id = ?1').bind(user.id),
      ]);
      return json({ ok: true }, 200, { 'Set-Cookie': await newSession(db, user) });
    }
    if (path === '/t/students' && method === 'GET') {
      needTeacher();
      const rows = (await db.prepare("SELECT * FROM users WHERE role = 'student' ORDER BY class_name, display_name").all()).results;
      return json(rows.map(pubUser));
    }
    if (path === '/t/students' && method === 'POST') {
      needTeacher();
      const b = await body();
      const target = async () => {
        if (typeof b.id !== 'string' || !HEX32.test(b.id)) fail(404, 'Murid tidak ditemukan.');
        const s = await db.prepare("SELECT * FROM users WHERE id = ?1 AND role = 'student'").bind(b.id).first();
        if (!s) fail(404, 'Murid tidak ditemukan.');
        return s;
      };
      if (b.action === 'create') {
        const username = str(b.username, 24, { required: true, label: 'Username' }).toLowerCase();
        if (!USERNAME_RE.test(username)) fail(400, 'Username 3–24 karakter: huruf kecil, angka, titik, atau garis bawah.');
        const display_name = str(b.display_name, 40, { required: true, label: 'Nama murid' });
        const class_name = str(b.class_name, 30, { label: 'Kelas' }) || null;
        if ((await db.prepare('SELECT COUNT(*) AS n FROM users').first('n')) >= 3000) fail(400, 'Batas 3000 akun tercapai.');
        if (await db.prepare('SELECT 1 FROM users WHERE username = ?1').bind(username).first()) fail(409, 'Username sudah dipakai.');
        const password = makePassword(), id = randHex(16);
        await db.prepare("INSERT INTO users (id, role, username, display_name, class_name, active, pw, created_at) VALUES (?1,'student',?2,?3,?4,1,?5,?6)").bind(id, username, display_name, class_name, await hashPassword(password), now()).run();
        return json({ id, username, password });
      }
      if (b.action === 'reset_password') {
        const s = await target(); const password = makePassword();
        await db.batch([db.prepare('UPDATE users SET pw = ?2 WHERE id = ?1').bind(s.id, await hashPassword(password)), db.prepare('DELETE FROM auth_sessions WHERE user_id = ?1').bind(s.id), db.prepare('DELETE FROM login_attempts WHERE k = ?1').bind('u:' + s.username)]);
        return json({ password });
      }
      if (b.action === 'set_active') {
        const s = await target(); const active = b.active === true ? 1 : 0;
        const st = [db.prepare('UPDATE users SET active = ?2 WHERE id = ?1').bind(s.id, active)];
        if (!active) st.push(db.prepare('DELETE FROM auth_sessions WHERE user_id = ?1').bind(s.id));
        await db.batch(st); return json({ ok: true });
      }
      if (b.action === 'rename') {
        const s = await target();
        const display_name = str(b.display_name, 40, { required: true, label: 'Nama murid' });
        const class_name = str(b.class_name, 30, { label: 'Kelas' }) || null;
        await db.prepare('UPDATE users SET display_name = ?2, class_name = ?3 WHERE id = ?1').bind(s.id, display_name, class_name).run();
        return json({ ok: true });
      }
      if (b.action === 'set_create') {
        const s = await target();
        await db.prepare('UPDATE users SET can_create = ?2 WHERE id = ?1').bind(s.id, b.allow === true ? 1 : 0).run();
        return json({ ok: true });
      }
      if (b.action === 'delete') { const s = await target(); await db.prepare('DELETE FROM users WHERE id = ?1').bind(s.id).run(); return json({ ok: true }); }
      fail(400, 'Aksi tidak dikenal.');
    }
    if (path === '/t/runs' && method === 'GET') {
      needTeacher();
      const days = int(url.searchParams.get('days') || 30, 1, 365, 'Periode');
      const rows = (await db.prepare('SELECT * FROM runs WHERE finished_at IS NOT NULL AND started_at >= ?1 ORDER BY started_at DESC LIMIT 3000').bind(now() - days * DAY).all()).results;
      return json(rows.map(fmtRun));
    }
    if ((path === '/t/card-time' || path === '/t/deck-time') && method === 'GET') {
      needTeacher();
      const days = int(url.searchParams.get('days') || 30, 1, 365, 'Periode');
      const student = url.searchParams.get('student') || '';
      const cls = (url.searchParams.get('class') || '').slice(0, 30);
      if (student && !HEX32.test(student)) fail(400, 'Murid tidak valid.');
      const where = `a.created_at >= ?1 AND (?2 = '' OR a.user_id = ?2) AND (?3 = '' OR u.class_name = ?3)`;
      const sql = path === '/t/card-time'
        ? `SELECT a.card_id, MAX(a.card_h) AS card_h, MAX(a.deck_id) AS deck_id, COUNT(*) AS n, ROUND(AVG(a.ms)) AS avg_ms,
             ROUND(AVG(CASE WHEN a.rating <= 2 OR a.quiz_correct = 0 THEN 1.0 ELSE 0 END), 3) AS wrong_rate
           FROM answers a JOIN users u ON u.id = a.user_id WHERE ${where} GROUP BY a.card_id ORDER BY AVG(a.ms) DESC LIMIT 200`
        : `SELECT a.deck_id, COUNT(*) AS n, ROUND(AVG(a.ms)) AS avg_ms, SUM(a.ms) AS total_ms
           FROM answers a JOIN users u ON u.id = a.user_id WHERE ${where} GROUP BY a.deck_id ORDER BY AVG(a.ms) DESC`;
      return json((await db.prepare(sql).bind(now() - days * DAY, student, cls).all()).results);
    }
    if (path === '/t/settings' && method === 'POST') {
      needTeacher();
      const b = await body(); const s = cleanSettings({ ...(await getSettings(db)), ...(b && typeof b === 'object' ? b : {}) }); // kunci yang tidak dikirim tetap
      await db.prepare('UPDATE settings SET data = ?1 WHERE id = 1').bind(JSON.stringify(s)).run();
      return json(s);
    }
    /* ----- pembuat kartu: guru, atau murid yang diberi izin ----- */
    const needCreator = () => { if (!teacher && !user.can_create) fail(403, 'Kamu belum diberi izin membuat kartu. Minta izin ke gurumu.'); };
    const editableDeck = async (id) => {
      const d = await db.prepare('SELECT * FROM decks WHERE id = ?1').bind(String(id || '')).first();
      if (!d || !canEditDeck(user, d)) fail(404, 'Kategori tidak ditemukan.');
      return d;
    };
    // Perubahan oleh murid pada kategori yang sudah tampil harus disetujui ulang
    const touch = (d) => (!teacher && d.status === 'public' ? [db.prepare("UPDATE decks SET status = 'pending' WHERE id = ?1").bind(d.id)] : []);

    if (path === '/translate' && method === 'POST') {
      needCreator();
      const b = await body(16 * 1024);
      if (!Array.isArray(b.lines)) fail(400, 'Daftar kata tidak valid.');
      const lines = b.lines.filter((x) => typeof x === 'string' && x.trim()).slice(0, 60);
      if (!lines.length) return json({ items: [], ai: !!env.AI });
      if (!(await usageOk(db, 'tr:' + user.id, teacher ? 200 : 60, 3600e3))) fail(429, 'Batas terjemahan per jam tercapai. Coba lagi nanti.');
      return json(await translateLines(env, lines));
    }
    if (path === '/deck' && method === 'POST') {
      needCreator();
      const b = await body();
      const color = /^#[0-9a-fA-F]{6}$/.test(b.color || '') ? b.color : '#1f3fbf';
      if ((await db.prepare('SELECT COUNT(*) AS n FROM decks').first('n')) >= 500) fail(400, 'Batas 500 kategori tercapai.');
      if (!teacher && (await db.prepare('SELECT COUNT(*) AS n FROM decks WHERE owner_id = ?1').bind(user.id).first('n')) >= 30) fail(400, 'Kamu sudah punya 30 kategori. Hapus yang tidak dipakai dulu.');
      const id = 'd_' + randHex(6);
      await db.prepare("INSERT INTO decks (id, zh, py, idn, color, kind, builtin, sort, created_at, owner_id, status) VALUES (?1,?2,'',?3,?4,'noun',0,?5,?6,?7,?8)")
        .bind(id, str(b.zh, 16, { required: true, label: 'Nama Mandarin' }), str(b.idn, 40, { label: 'Nama Indonesia' }), color, 1000, now(), teacher ? null : user.id, teacher ? (b.shared === false ? 'private' : 'public') : 'private').run();
      return json({ id });
    }
    if (path === '/deck/update' && method === 'POST') {
      const b = await body(); const d = await editableDeck(b.id);
      const color = /^#[0-9a-fA-F]{6}$/.test(b.color || '') ? b.color : d.color;
      const st = [db.prepare('UPDATE decks SET zh = ?2, idn = ?3, color = ?4 WHERE id = ?1').bind(d.id, str(b.zh ?? d.zh, 16, { required: true, label: 'Nama Mandarin' }), str(b.idn ?? d.idn, 40, { label: 'Nama Indonesia' }), color), ...touch(d)];
      if (teacher && !d.owner_id && typeof b.shared === 'boolean') st.push(db.prepare('UPDATE decks SET status = ?2 WHERE id = ?1').bind(d.id, b.shared ? 'public' : 'private'));
      await db.batch(st);
      return json({ ok: true });
    }
    if (path === '/deck/delete' && method === 'POST') {
      const b = await body(); const d = await editableDeck(b.id);
      const st = [db.prepare('DELETE FROM decks WHERE id = ?1').bind(d.id)];
      if (d.builtin) st.unshift(db.prepare('INSERT OR IGNORE INTO deleted_builtin (id) VALUES (?1)').bind('deck:' + d.id));
      await db.batch(st); return json({ ok: true });
    }
    if (path === '/deck/submit' && method === 'POST') {
      const b = await body(); const d = await editableDeck(b.id);
      if (teacher) fail(400, 'Kategori guru langsung tampil untuk murid.');
      if (b.public === false) { await db.prepare("UPDATE decks SET status = 'private' WHERE id = ?1").bind(d.id).run(); return json({ ok: true }); }
      if ((await db.prepare('SELECT COUNT(*) AS n FROM cards WHERE deck_id = ?1').bind(d.id).first('n')) < 1) fail(400, 'Tambahkan minimal 1 kartu sebelum minta persetujuan.');
      await db.prepare("UPDATE decks SET status = 'pending' WHERE id = ?1").bind(d.id).run();
      return json({ ok: true });
    }
    if (path === '/cards/bulk' && method === 'POST') {
      const b = await body(128 * 1024); const d = await editableDeck(b.deck_id);
      if (!Array.isArray(b.cards) || !b.cards.length) fail(400, 'Belum ada kartu untuk disimpan.');
      if (b.cards.length > 100) fail(400, 'Maksimal 100 kartu sekali simpan.');
      const total = await db.prepare('SELECT COUNT(*) AS n FROM cards').first('n');
      if (total + b.cards.length > 20000) fail(400, 'Batas 20.000 kartu tercapai.');
      const have = new Set((await db.prepare('SELECT h FROM cards WHERE deck_id = ?1').bind(d.id).all()).results.map((r) => r.h));
      const base = await db.prepare('SELECT COALESCE(MAX(sort), 0) AS m FROM cards WHERE deck_id = ?1').bind(d.id).first('m');
      const st = [], skipped = [];
      b.cards.forEach((raw, i) => {
        if (!raw || typeof raw !== 'object') fail(400, `Kartu baris ${i + 1} tidak valid.`);
        let f; try { f = cardFields(raw); } catch (e) { throw new HttpError(400, `Baris ${i + 1}: ${e.message}`); }
        if (have.has(f.h)) { skipped.push(f.h); return; }
        have.add(f.h);
        st.push(db.prepare("INSERT INTO cards (id, deck_id, h, p, m, mw, alt, pic, builtin, sort, created_at, en) VALUES (?1,?2,?3,?4,?5,?6,'[]',?7,0,?8,?9,?10)")
          .bind('c_' + randHex(8), d.id, f.h, f.p, f.m, f.mw, f.pic, base + st.length + 1, now(), f.en || enOf(f.h)));
      });
      for (let i = 0; i < st.length; i += 50) await db.batch(st.slice(i, i + 50));
      const t2 = st.length ? touch(d) : []; if (t2.length) await db.batch(t2);
      return json({ added: st.length, skipped });
    }
    if (path === '/card/update' && method === 'POST') {
      const b = await body();
      const c = await db.prepare('SELECT * FROM cards WHERE id = ?1').bind(String(b.id || '')).first();
      if (!c) fail(404, 'Kartu tidak ditemukan.');
      const d = await editableDeck(c.deck_id);
      const f = cardFields(b);
      if (f.h !== c.h && (await db.prepare('SELECT 1 FROM cards WHERE deck_id = ?1 AND h = ?2').bind(d.id, f.h).first())) fail(409, `Kartu ${f.h} sudah ada di kategori ini.`);
      await db.batch([db.prepare('UPDATE cards SET h = ?2, p = ?3, m = ?4, mw = ?5, pic = ?6, en = ?7 WHERE id = ?1').bind(c.id, f.h, f.p, f.m, f.mw, f.pic, b.en === undefined ? c.en : f.en), ...touch(d)]);
      return json({ ok: true });
    }
    if (path === '/card/delete' && method === 'POST') {
      const b = await body();
      const c = await db.prepare('SELECT * FROM cards WHERE id = ?1').bind(String(b.id || '')).first();
      if (!c) fail(404, 'Kartu tidak ditemukan.');
      await editableDeck(c.deck_id);
      const st = [db.prepare('DELETE FROM cards WHERE id = ?1').bind(c.id)];
      if (c.builtin) st.unshift(db.prepare('INSERT OR IGNORE INTO deleted_builtin (id) VALUES (?1)').bind(c.id));
      await db.batch(st); return json({ ok: true });
    }
    if (path === '/image' && method === 'POST') {
      needCreator();
      if (len > 512 * 1024) fail(413, 'Foto maksimal 500 KB.');
      if (!(await usageOk(db, 'img:' + user.id, teacher ? 300 : 40, DAY))) fail(429, 'Batas unggah foto hari ini tercapai.');
      const buf = new Uint8Array(await req.arrayBuffer());
      if (buf.length > 512 * 1024 || buf.length < 16) fail(413, 'Foto tidak valid atau terlalu besar.');
      const type = sniffImage(buf);
      if (!type) fail(415, 'Pakai foto PNG, JPG, WEBP, atau GIF.');
      if ((await db.prepare('SELECT COUNT(*) AS n FROM images').first('n')) >= 5000) fail(400, 'Batas 5000 foto tercapai.');
      const id = randHex(16);
      await db.prepare('INSERT INTO images (id, type, data, created_at) VALUES (?1,?2,?3,?4)').bind(id, type, buf, now()).run();
      return json({ url: '/api/img/' + id });
    }

    /* ----- khusus guru: persetujuan & pantauan ----- */
    if (path === '/t/progress' && method === 'GET') {
      needTeacher();
      const rows = (await db.prepare(`SELECT s.user_id, c.deck_id, SUM(s.last = 4) AS m4, SUM(s.last = 3) AS m3, SUM(s.last <= 2) AS m12, MAX(s.due) AS due
        FROM srs s JOIN cards c ON c.id = s.card_id JOIN users u ON u.id = s.user_id WHERE u.role = 'student' GROUP BY s.user_id, c.deck_id`).all()).results;
      const last = (await db.prepare(`SELECT user_id, MAX(started_at) AS t FROM runs GROUP BY user_id`).all()).results;
      return json({ rows, last: Object.fromEntries(last.map((r) => [r.user_id, r.t])) });
    }
    if (path === '/t/end-run' && method === 'POST') {
      needTeacher();
      const b = await body(4096);
      let rows;
      if (b.all === true) rows = (await db.prepare('SELECT * FROM runs WHERE finished_at IS NULL AND started_at > ?1').bind(now() - 6 * 3600e3).all()).results;
      else {
        if (typeof b.sid !== 'string' || !HEX32.test(b.sid)) fail(400, 'Sesi tidak valid.');
        rows = (await db.prepare('SELECT * FROM runs WHERE id = ?1 AND finished_at IS NULL').bind(b.sid).all()).results;
        if (!rows.length) fail(404, 'Sesi sudah selesai atau tidak ditemukan.');
      }
      for (const r of rows.slice(0, 300)) await finishRun(db, r, 'teacher');
      return json({ ended: Math.min(rows.length, 300) });
    }
    if ((path === '/t/deliver' || path === '/deliver') && method === 'POST') {
      if (path === '/t/deliver') needTeacher();
      const b = await body();
      const d = await db.prepare('SELECT * FROM decks WHERE id = ?1').bind(String(b.deck_id || '')).first();
      if (!d) fail(404, 'Kategori tidak ditemukan.');
      // murid hanya boleh mengirim kategori buatannya sendiri, ke teman tertentu
      if (!teacher && d.owner_id !== user.id) fail(404, 'Kategori tidak ditemukan.');
      if (!teacher && (!b.to || !Array.isArray(b.to.users))) fail(400, 'Pilih teman yang mau dikirimi.');
      if (!teacher && b.to.users.length > 30) fail(400, 'Maksimal 30 teman sekali kirim.');
      if (!teacher && !(await usageOk(db, 'dlv:' + user.id, 60, 3600e3))) fail(429, 'Terlalu sering mengirim. Coba lagi nanti.');
      if ((await db.prepare('SELECT COUNT(*) AS n FROM cards WHERE deck_id = ?1').bind(d.id).first('n')) < 1) fail(400, 'Kategori ini masih kosong.');
      const ids = (await targets(db, b.to)).filter((uid) => uid !== user.id);
      if (!ids.length) fail(400, 'Tidak ada penerima.');
      const t = now();
      const st = ids.map((uid) => db.prepare('INSERT INTO deliveries (id, deck_id, user_id, created_at, seen_at, sender_id) VALUES (?1,?2,?3,?4,NULL,?5) ON CONFLICT(deck_id, user_id) DO UPDATE SET created_at = excluded.created_at, seen_at = NULL, sender_id = excluded.sender_id').bind(randHex(16), d.id, uid, t, user.id));
      for (let i = 0; i < st.length; i += 50) await db.batch(st.slice(i, i + 50));
      return json({ sent: ids.length });
    }
    if (path === '/t/message' && method === 'POST') {
      needTeacher();
      const b = await body();
      const text = str(b.text, 300, { required: true, label: 'Pesan' });
      const kind = b.kind === 'warn' ? 'warn' : 'chat';
      if (!(await usageOk(db, 'msg:' + user.id, 300, 3600e3))) fail(429, 'Terlalu banyak pesan dalam satu jam.');
      const ids = await targets(db, b.to); const t = now();
      const st = ids.map((uid) => db.prepare('INSERT INTO messages (id, user_id, kind, text, created_at) VALUES (?1,?2,?3,?4,?5)').bind(randHex(16), uid, kind, text, t));
      for (let i = 0; i < st.length; i += 50) await db.batch(st.slice(i, i + 50));
      return json({ sent: ids.length });
    }
    if (path === '/t/approve' && method === 'POST') {
      needTeacher();
      const b = await body();
      const d = await db.prepare('SELECT * FROM decks WHERE id = ?1 AND owner_id IS NOT NULL').bind(String(b.id || '')).first();
      if (!d) fail(404, 'Kategori tidak ditemukan.');
      await db.prepare('UPDATE decks SET status = ?2 WHERE id = ?1').bind(d.id, b.approve === true ? 'public' : 'private').run();
      return json({ ok: true });
    }
    if (path === '/t/live' && method === 'GET') {
      needTeacher();
      const t = now();
      const rows = (await db.prepare(`SELECT r.*, u.display_name, u.class_name,
          (SELECT COUNT(*) FROM answers a WHERE a.run_id = r.id AND a.first_try = 1) AS done,
          (SELECT created_at FROM messages m WHERE m.user_id = r.user_id ORDER BY created_at DESC LIMIT 1) AS msg_at,
          (SELECT seen_at FROM messages m WHERE m.user_id = r.user_id ORDER BY created_at DESC LIMIT 1) AS msg_seen
        FROM runs r JOIN users u ON u.id = r.user_id
        WHERE (r.finished_at IS NULL AND r.last_seen > ?1) OR r.finished_at > ?2
        ORDER BY r.started_at DESC LIMIT 200`).bind(t - 15 * 60e3, t - 30 * 60e3).all()).results;
      return json({ now: t, runs: rows.map((r) => ({ ...fmtRun(r), name: r.display_name, class_name: r.class_name, planned: r.planned, done: r.done,
        state: r.state, state_since: r.state_since, last_seen: r.last_seen, msg_at: r.msg_at, msg_seen: r.msg_seen })) });
    }

    fail(404, 'Tidak ditemukan.');
  } catch (e) {
    if (e instanceof HttpError) return json({ error: e.message }, e.status);
    console.error(e);
    return json({ error: 'Terjadi kesalahan di server. Coba lagi.' }, 500);
  }
}
