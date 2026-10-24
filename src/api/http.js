// Penghubung ke server Cloudflare (/api/...). Login memakai cookie HttpOnly,
// jadi token tidak pernah bisa dibaca oleh JavaScript di halaman.

async function call(method, path, body, raw = false) {
  const opt = { method, credentials: 'same-origin', headers: {} };
  if (body !== undefined) {
    if (raw) { opt.body = body; opt.headers['Content-Type'] = body.type || 'application/octet-stream'; }
    else { opt.body = JSON.stringify(body); opt.headers['Content-Type'] = 'application/json'; }
  }
  let r;
  try { r = await fetch('/api' + path, opt); } catch (_) { throw new Error('Koneksi internet bermasalah. Periksa jaringan lalu coba lagi.'); }
  let j = null;
  try { j = await r.json(); } catch (_) { /* bukan JSON */ }
  if (!r.ok) {
    const e = new Error((j && typeof j.error === 'string' && j.error) || 'Terjadi kesalahan. Coba lagi.');
    e.status = r.status;
    throw e;
  }
  return j;
}

// Perkecil foto di browser sebelum diunggah (maks 480 px)
async function shrink(file) {
  if (file.size > 25 * 1024 * 1024) throw new Error('Foto terlalu besar (maks 25 MB).');
  let bmp;
  try { bmp = await createImageBitmap(file); } catch (_) { throw new Error('Format foto ini tidak didukung browser (mis. HEIC dari iPhone). Coba simpan/convert ke JPG atau PNG dulu.'); }
  const k = Math.min(1, 480 / Math.max(bmp.width, bmp.height));
  const cv = document.createElement('canvas');
  cv.width = Math.max(1, Math.round(bmp.width * k)); cv.height = Math.max(1, Math.round(bmp.height * k));
  cv.getContext('2d').drawImage(bmp, 0, 0, cv.width, cv.height);
  const blob = (t, q) => new Promise((res) => cv.toBlob(res, t, q));
  let out = await blob('image/webp', 0.84);
  if (!out || out.type !== 'image/webp') out = await blob('image/jpeg', 0.85);
  if (!out) throw new Error('Foto gagal diproses.');
  if (out.size > 500 * 1024) throw new Error('Foto masih terlalu besar setelah diperkecil.');
  return out;
}

export const api = {
  setupStatus: () => call('GET', '/setup'),
  setup: (d) => call('POST', '/setup', d),
  login: (username, password) => call('POST', '/login', { username, password }),
  logout: () => call('POST', '/logout', {}).catch(() => {}),
  async profile() { try { return await call('GET', '/me'); } catch (e) { if (e.status === 401) return null; throw e; } },
  content: () => call('GET', '/content'),
  async srs() { return (await call('GET', '/srs')) || {}; },
  startSession: async (decks, mode, planned) => (await call('POST', '/run/start', { decks, mode, planned })).id,
  presence(sid, state, card) {
    try {
      return fetch('/api/run/presence', { method: 'POST', keepalive: true, credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sid, state, card }) }).then((r) => r.json()).catch(() => null);
    } catch (_) { return Promise.resolve(null); }
  },
  quizOptions: (sid, card, kind) => call('POST', '/run/quiz', { sid, card, kind }),
  runStatus: (sid) => call('GET', `/run/status?sid=${encodeURIComponent(sid)}`),
  inbox: () => call('GET', '/inbox'),
  inboxSeen: (messages, deliveries) => call('POST', '/inbox/seen', { messages, deliveries }),
  answerQuiz: (sid, card, token) => call('POST', '/run/answer', { sid, card, token }),
  rateCard: (sid, card, rating, ms, clue) => call('POST', '/run/rate', { sid, card, rating, ms: Math.round(ms), clue: !!clue }),
  progress: () => call('GET', '/t/progress'),
  finishSession: (sid, early) => call('POST', '/run/finish', { sid, early: !!early }),
  mySessions: () => call('GET', '/runs/mine'),

  // pembuat kartu (guru atau murid yang diizinkan)
  translate: (lines) => call('POST', '/translate', { lines }),
  createDeck: (d) => call('POST', '/deck', d),
  updateDeck: (d) => call('POST', '/deck/update', d),
  deleteDeck: (id) => call('POST', '/deck/delete', { id }),
  submitDeck: (id, pub = true) => call('POST', '/deck/submit', { id, public: pub }),
  bulkCards: (deck_id, cards) => call('POST', '/cards/bulk', { deck_id, cards }),
  updateCard: (c) => call('POST', '/card/update', c),
  deleteCard: (id) => call('POST', '/card/delete', { id }),
  async uploadImage(file) { const b = await shrink(file); return (await call('POST', '/image', b, true)).url; },
  async setPhoto(file) { const b = await shrink(file); return (await call('POST', '/me/photo', b, true)).photo; },
  clearPhoto: () => call('POST', '/me/photo/clear', {}),
  setName: (display_name) => call('POST', '/me/name', { display_name }),
  setLevel: (level) => call('POST', '/me/level', { level }),

  // guru
  changePassword: (oldPw, newPw) => call('POST', '/password', { old: oldPw, new: newPw }),
  students: () => call('GET', '/t/students'),
  manage: (action, payload = {}) => call('POST', '/t/students', { action, ...payload }),
  sessions: (days) => call('GET', `/t/runs?days=${encodeURIComponent(days)}`),
  cardTime: (f) => call('GET', `/t/card-time?days=${f.days}&student=${encodeURIComponent(f.student || '')}&class=${encodeURIComponent(f.cls || '')}`),
  deckTime: (f) => call('GET', `/t/deck-time?days=${f.days}&student=${encodeURIComponent(f.student || '')}&class=${encodeURIComponent(f.cls || '')}`),
  saveSettings: (s) => call('POST', '/t/settings', s),
  approve: (id, approve) => call('POST', '/t/approve', { id, approve }),
  live: () => call('GET', '/t/live'),
  endRun: (p) => call('POST', '/t/end-run', p),
  deliverMine: (deck_id, to) => call('POST', '/deliver', { deck_id, to }),
  classmates: () => call('GET', '/classmates'),
  feed: () => call('GET', '/feed'),
  like: (deck_id, like) => call('POST', '/like', { deck_id, like }),
  userProfile: (id) => call('GET', '/u/' + encodeURIComponent(id)),
  aiAsk: (messages) => call('POST', '/ai/ask', { messages }),
  deliver: (deck_id, to) => call('POST', '/t/deliver', { deck_id, to }),
  message: (text, kind, to) => call('POST', '/t/message', { text, kind, to }),
};
