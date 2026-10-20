// Penghubung ke Supabase. Hanya memakai "anon key" (aman untuk browser);
// semua batasan dijaga oleh aturan RLS dan fungsi server di database.
import { createClient } from '@supabase/supabase-js';

const URL = import.meta.env.VITE_SUPABASE_URL;
const KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
const DOMAIN = import.meta.env.VITE_STUDENT_EMAIL_DOMAIN || 'siswa.alvaro.local';

const FRIENDLY = {
  not_allowed: 'Akses ditolak. Coba masuk ulang.',
  session_finished: 'Sesi ini sudah selesai.',
  session_expired: 'Sesi terlalu lama dibiarkan. Mulai sesi baru.',
  too_many_sessions: 'Terlalu banyak sesi dalam satu jam. Istirahat dulu ya.',
  too_many: 'Batas jawaban sesi tercapai.',
};
function friendly(err) {
  const msg = (err && (err.message || err.error_description)) || '';
  for (const [k, v] of Object.entries(FRIENDLY)) if (msg.includes(k)) return new Error(v);
  if (/fetch|network/i.test(msg)) return new Error('Koneksi internet bermasalah.');
  return new Error('Terjadi kesalahan. Coba lagi.');
}

export function makeSupabaseApi() {
  const sb = createClient(URL, KEY, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false } });

  async function rpc(name, args) {
    const { data, error } = await sb.rpc(name, args);
    if (error) throw friendly(error);
    return data;
  }
  async function fetchAll(table, cols, build) {
    const out = [];
    for (let from = 0; ; from += 1000) {
      let q = sb.from(table).select(cols).range(from, from + 999);
      if (build) q = build(q);
      const { data, error } = await q;
      if (error) throw friendly(error);
      out.push(...data);
      if (data.length < 1000) return out;
    }
  }
  async function profile() {
    const { data: { session } } = await sb.auth.getSession();
    if (!session) return null;
    const { data } = await sb.from('profiles').select('id, role, username, display_name, class_name, active').eq('id', session.user.id).maybeSingle();
    if (!data || !data.active) { await sb.auth.signOut(); return null; }
    return data;
  }

  return {
    demo: false,
    publicImagePrefix: `${URL}/storage/v1/object/public/card-images/`,
    async login(username, password) {
      const u = String(username || '').trim();
      const email = u.includes('@') ? u : `${u.toLowerCase()}@${DOMAIN}`;
      const { error } = await sb.auth.signInWithPassword({ email, password: String(password || '') });
      if (error) throw new Error(error.status === 429 ? 'Terlalu banyak percobaan. Tunggu beberapa menit lalu coba lagi.' : 'Username atau password salah.');
      const p = await profile();
      if (!p) throw new Error('Akun ini tidak aktif. Hubungi gurumu.');
      return p;
    },
    logout: () => sb.auth.signOut(),
    profile,
    async content() {
      const [s, d, cards] = await Promise.all([
        sb.from('settings').select('*').eq('id', 1).maybeSingle(),
        sb.from('decks').select('*').order('sort').order('created_at'),
        fetchAll('cards', '*', (q) => q.order('deck_id').order('sort').order('created_at')),
      ]);
      if (s.error || d.error) throw friendly(s.error || d.error);
      return { settings: s.data, decks: d.data, cards };
    },
    async srs() {
      const rows = await fetchAll('srs', 'card_id, due, last');
      return Object.fromEntries(rows.map((r) => [r.card_id, { due: Date.parse(r.due), last: r.last }]));
    },
    startSession: (decks, mode) => rpc('start_session', { p_decks: decks, p_mode: mode }),
    quizOptions: (sid, card) => rpc('quiz_options', { p_session: sid, p_card: card }),
    answerQuiz: (sid, card, token) => rpc('answer_quiz', { p_session: sid, p_card: card, p_token: token }),
    rateCard: (sid, card, rating, ms) => rpc('rate_card', { p_session: sid, p_card: card, p_rating: rating, p_ms: Math.round(ms) }),
    finishSession: (sid) => rpc('finish_session', { p_session: sid }),
    async mySessions() {
      const { data, error } = await sb.from('sessions').select('*').not('finished_at', 'is', null).order('started_at', { ascending: false }).limit(60);
      if (error) throw friendly(error);
      return data;
    },

    // ---- guru ----
    async students() {
      const { data, error } = await sb.from('profiles').select('*').eq('role', 'student').order('class_name').order('display_name');
      if (error) throw friendly(error);
      return data;
    },
    async manage(action, payload = {}) {
      const { data, error } = await sb.functions.invoke('manage-students', { body: { action, ...payload } });
      if (error) {
        let msg = 'Gagal menghubungi server.';
        try { const j = await error.context.json(); if (j && typeof j.error === 'string') msg = j.error; } catch (_) { /* biarkan pesan umum */ }
        throw new Error(msg);
      }
      return data;
    },
    async sessions(days) {
      const since = new Date(Date.now() - days * 864e5).toISOString();
      const { data, error } = await sb.from('sessions').select('*').not('finished_at', 'is', null).gte('started_at', since).order('started_at', { ascending: false }).limit(2000);
      if (error) throw friendly(error);
      return data;
    },
    cardTime: (f) => rpc('teacher_card_time', { p_student: f.student || null, p_class: f.cls || null, p_days: f.days }),
    deckTime: (f) => rpc('teacher_deck_time', { p_student: f.student || null, p_class: f.cls || null, p_days: f.days }),
    async saveSettings(s) {
      const { error } = await sb.from('settings').update({ ...s, updated_at: new Date().toISOString() }).eq('id', 1);
      if (error) throw new Error('Pengaturan tidak valid atau gagal disimpan.');
    },
    async createDeck(d) { const { error } = await sb.from('decks').insert(d); if (error) throw new Error('Gagal membuat kategori.'); },
    async deleteDeck(id) { const { error } = await sb.from('decks').delete().eq('id', id); if (error) throw new Error('Gagal menghapus kategori.'); },
    async createCard(c) { const { error } = await sb.from('cards').insert(c); if (error) throw new Error('Gagal menambah kartu. Periksa isian.'); },
    async deleteCard(id) { const { error } = await sb.from('cards').delete().eq('id', id); if (error) throw new Error('Gagal menghapus kartu.'); },
    async uploadImage(file) {
      const ext = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/gif': 'gif' }[file.type];
      if (!ext) throw new Error('Pakai foto PNG, JPG, WEBP, atau GIF.');
      if (file.size > 2 * 1024 * 1024) throw new Error('Foto maksimal 2 MB.');
      const path = `${crypto.randomUUID()}.${ext}`;
      const { error } = await sb.storage.from('card-images').upload(path, file, { contentType: file.type, upsert: false });
      if (error) throw new Error('Foto gagal diunggah.');
      return sb.storage.from('card-images').getPublicUrl(path).data.publicUrl;
    },
  };
}
