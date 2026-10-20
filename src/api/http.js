// Penghubung ke server Cloudflare (/api/...). Login memakai cookie HttpOnly,
// jadi token tidak pernah bisa dibaca oleh JavaScript di halaman.

async function call(method, path, body, raw = false) {
  const opt = { method, credentials: 'same-origin', headers: {} };
  if (body !== undefined) {
    if (raw) { opt.body = body; opt.headers['Content-Type'] = body.type || 'application/octet-stream'; }
    else { opt.body = JSON.stringify(body); opt.headers['Content-Type'] = 'application/json'; }
  }
  let r;
  try { r = await fetch('/api' + path, opt); } catch (_) { throw new Error('Koneksi internet bermasalah.'); }
  let j = null;
  try { j = await r.json(); } catch (_) { /* bukan JSON */ }
  if (!r.ok) {
    const e = new Error((j && typeof j.error === 'string' && j.error) || 'Terjadi kesalahan. Coba lagi.');
    e.status = r.status;
    throw e;
  }
  return j;
}

// Perkecil foto di browser sebelum diunggah (maks 480 px, ± 30–80 KB)
async function shrink(file) {
  if (!/^image\/(png|jpeg|webp|gif)$/.test(file.type)) throw new Error('Pakai foto PNG, JPG, WEBP, atau GIF.');
  if (file.size > 15 * 1024 * 1024) throw new Error('Foto terlalu besar.');
  let bmp;
  try { bmp = await createImageBitmap(file); } catch (_) { throw new Error('Foto tidak bisa dibaca.'); }
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

export function makeHttpApi() {
  return {
    demo: false,
    setupStatus: () => call('GET', '/setup'),
    setup: (d) => call('POST', '/setup', d),
    login: (username, password) => call('POST', '/login', { username, password }),
    logout: () => call('POST', '/logout', {}).catch(() => {}),
    async profile() { try { return await call('GET', '/me'); } catch (e) { if (e.status === 401) return null; throw e; } },
    content: () => call('GET', '/content'),
    async srs() { const m = await call('GET', '/srs'); return m || {}; },
    startSession: async (decks, mode) => (await call('POST', '/run/start', { decks, mode })).id,
    quizOptions: (sid, card) => call('POST', '/run/quiz', { sid, card }),
    answerQuiz: (sid, card, token) => call('POST', '/run/answer', { sid, card, token }),
    rateCard: (sid, card, rating, ms) => call('POST', '/run/rate', { sid, card, rating, ms: Math.round(ms) }),
    finishSession: (sid) => call('POST', '/run/finish', { sid }),
    mySessions: () => call('GET', '/runs/mine'),

    // ---- guru ----
    changePassword: (oldPw, newPw) => call('POST', '/password', { old: oldPw, new: newPw }),
    students: () => call('GET', '/t/students'),
    manage: (action, payload = {}) => call('POST', '/t/students', { action, ...payload }),
    sessions: (days) => call('GET', `/t/runs?days=${encodeURIComponent(days)}`),
    cardTime: (f) => call('GET', `/t/card-time?days=${f.days}&student=${encodeURIComponent(f.student || '')}&class=${encodeURIComponent(f.cls || '')}`),
    deckTime: (f) => call('GET', `/t/deck-time?days=${f.days}&student=${encodeURIComponent(f.student || '')}&class=${encodeURIComponent(f.cls || '')}`),
    saveSettings: (s) => call('POST', '/t/settings', s),
    createDeck: (d) => call('POST', '/t/deck', d),
    deleteDeck: (id) => call('POST', '/t/deck/delete', { id }),
    createCard: (c) => call('POST', '/t/card', c),
    deleteCard: (id) => call('POST', '/t/card/delete', { id }),
    async uploadImage(file) { const b = await shrink(file); return (await call('POST', '/t/image', b, true)).url; },
  };
}
