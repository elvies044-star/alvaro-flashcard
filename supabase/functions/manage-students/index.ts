// Edge Function: kelola akun murid (khusus guru).
// Kunci service role HANYA ada di server ini, tidak pernah dikirim ke browser.
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const DOMAIN = Deno.env.get("STUDENT_EMAIL_DOMAIN") ?? "siswa.alvaro.local";
const ALLOWED_ORIGINS = (Deno.env.get("ALLOWED_ORIGINS") ?? "").split(",").map((s) => s.trim()).filter(Boolean);

const USERNAME_RE = /^[a-z0-9._]{3,24}$/;
const UUID_RE = /^[0-9a-f-]{36}$/;

function cors(origin: string | null) {
  const allow = origin && (ALLOWED_ORIGINS.length === 0 || ALLOWED_ORIGINS.includes(origin)) ? origin : (ALLOWED_ORIGINS[0] ?? "");
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

function json(body: unknown, status: number, origin: string | null) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors(origin), "Content-Type": "application/json" } });
}

// Password mudah dibaca anak (tanpa huruf/angka yang mirip: 0/O, 1/l/I)
function makePassword(): string {
  const cons = "bcdfghjkmnprstvwz", vow = "aeiu", digits = "23456789";
  const r = crypto.getRandomValues(new Uint32Array(12));
  let p = "";
  for (let i = 0; i < 4; i++) p += cons[r[i * 2] % cons.length] + vow[r[i * 2 + 1] % vow.length];
  p += digits[r[8] % digits.length] + digits[r[9] % digits.length] + digits[r[10] % digits.length];
  return p; // contoh: "bakerumi472" — 11 karakter, ±11 miliar kombinasi
}

function clean(s: unknown, max: number): string {
  return typeof s === "string" ? s.replace(/[\u0000-\u001f<>]/g, "").trim().slice(0, max) : "";
}

Deno.serve(async (req) => {
  const origin = req.headers.get("Origin");
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(origin) });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405, origin);
  if (ALLOWED_ORIGINS.length && origin && !ALLOWED_ORIGINS.includes(origin)) return json({ error: "origin_not_allowed" }, 403, origin);

  const authHeader = req.headers.get("Authorization") ?? "";
  const userClient = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: authHeader } } });
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) return json({ error: "not_signed_in" }, 401, origin);

  const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
  const { data: me } = await admin.from("profiles").select("role, active").eq("id", user.id).maybeSingle();
  if (!me || me.role !== "teacher" || !me.active) return json({ error: "teacher_only" }, 403, origin);

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return json({ error: "bad_json" }, 400, origin); }
  const action = body.action;

  // Target harus akun murid (guru tidak bisa diubah lewat sini)
  async function student(id: unknown) {
    if (typeof id !== "string" || !UUID_RE.test(id)) return null;
    const { data } = await admin.from("profiles").select("id, role").eq("id", id).maybeSingle();
    return data && data.role === "student" ? data : null;
  }

  try {
    if (action === "create") {
      const username = clean(body.username, 24).toLowerCase();
      const display_name = clean(body.display_name, 40);
      const class_name = clean(body.class_name, 30) || null;
      if (!USERNAME_RE.test(username)) return json({ error: "Username 3–24 karakter: huruf kecil, angka, titik, atau garis bawah." }, 400, origin);
      if (!display_name) return json({ error: "Nama murid wajib diisi." }, 400, origin);
      const { count } = await admin.from("profiles").select("id", { count: "exact", head: true });
      if ((count ?? 0) >= 1000) return json({ error: "Batas 1000 akun tercapai." }, 400, origin);
      const { data: taken } = await admin.from("profiles").select("id").eq("username", username).maybeSingle();
      if (taken) return json({ error: "Username sudah dipakai." }, 409, origin);
      const password = makePassword();
      const { data: created, error } = await admin.auth.admin.createUser({
        email: `${username}@${DOMAIN}`, password, email_confirm: true, user_metadata: { username },
      });
      if (error || !created.user) return json({ error: "Gagal membuat akun. Coba username lain." }, 400, origin);
      const { error: pErr } = await admin.from("profiles").insert({ id: created.user.id, role: "student", username, display_name, class_name });
      if (pErr) { await admin.auth.admin.deleteUser(created.user.id); return json({ error: "Gagal menyimpan profil." }, 400, origin); }
      return json({ id: created.user.id, username, password }, 200, origin);
    }

    if (action === "reset_password") {
      const s = await student(body.id); if (!s) return json({ error: "Murid tidak ditemukan." }, 404, origin);
      const password = makePassword();
      const { error } = await admin.auth.admin.updateUserById(s.id, { password });
      if (error) return json({ error: "Gagal mengganti password." }, 400, origin);
      return json({ password }, 200, origin);
    }

    if (action === "set_active") {
      const s = await student(body.id); if (!s) return json({ error: "Murid tidak ditemukan." }, 404, origin);
      const active = body.active === true;
      await admin.from("profiles").update({ active }).eq("id", s.id);
      await admin.auth.admin.updateUserById(s.id, { ban_duration: active ? "none" : "876000h" });
      return json({ ok: true }, 200, origin);
    }

    if (action === "rename") {
      const s = await student(body.id); if (!s) return json({ error: "Murid tidak ditemukan." }, 404, origin);
      const display_name = clean(body.display_name, 40);
      const class_name = clean(body.class_name, 30) || null;
      if (!display_name) return json({ error: "Nama murid wajib diisi." }, 400, origin);
      await admin.from("profiles").update({ display_name, class_name }).eq("id", s.id);
      return json({ ok: true }, 200, origin);
    }

    if (action === "delete") {
      const s = await student(body.id); if (!s) return json({ error: "Murid tidak ditemukan." }, 404, origin);
      const { error } = await admin.auth.admin.deleteUser(s.id);
      if (error) return json({ error: "Gagal menghapus akun." }, 400, origin);
      return json({ ok: true }, 200, origin);
    }

    return json({ error: "unknown_action" }, 400, origin);
  } catch (_e) {
    return json({ error: "Terjadi kesalahan di server." }, 500, origin);
  }
});
