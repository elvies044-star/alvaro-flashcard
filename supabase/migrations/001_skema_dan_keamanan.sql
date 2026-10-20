-- =====================================================================
--  Flashcard Alvaro — skema database, aturan keamanan, fungsi server
--  Jalankan sekali di Supabase: SQL Editor → tempel → Run.
--  Prinsip keamanan:
--   * Semua tabel memakai Row Level Security (RLS).
--   * Murid TIDAK punya izin insert/update/delete langsung ke tabel skor.
--     Skor hanya ditulis oleh fungsi server (security definer) yang
--     memeriksa jawaban dan menghitung nilainya sendiri.
--   * Kartu, kategori, dan pengaturan hanya bisa diubah oleh guru.
--   * Akun murid hanya dibuat oleh guru lewat Edge Function.
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------- Profil pengguna ----------
create table if not exists public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  role         text not null default 'student' check (role in ('teacher','student')),
  username     text not null unique check (username ~ '^[a-z0-9._]{3,24}$'),
  display_name text not null check (char_length(display_name) between 1 and 40),
  class_name   text check (class_name is null or char_length(class_name) <= 30),
  active       boolean not null default true,
  created_at   timestamptz not null default now()
);

create or replace function public.is_teacher() returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'teacher' and active)
$$;

create or replace function public.is_active_user() returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select exists (select 1 from public.profiles where id = auth.uid() and active)
$$;

alter table public.profiles enable row level security;
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_teacher());
-- Tidak ada policy insert/update/delete: profil hanya diubah oleh Edge Function (service role).

-- ---------- Pengaturan (satu baris) ----------
create table if not exists public.settings (
  id                 int primary key default 1 check (id = 1),
  modes              text[] not null default '{pic,han,arti,mix}',
  default_mode       text not null default 'pic',
  student_can_choose boolean not null default true,
  quiz_enabled       boolean not null default true,
  hidden_decks       text[] not null default '{}',
  updated_at         timestamptz not null default now(),
  constraint modes_ok check (modes <@ array['pic','han','arti','mix'] and cardinality(modes) between 1 and 4),
  constraint default_ok check (default_mode = any(modes)),
  constraint hidden_ok check (cardinality(hidden_decks) <= 200)
);
insert into public.settings (id) values (1) on conflict (id) do nothing;
alter table public.settings enable row level security;
drop policy if exists settings_read on public.settings;
drop policy if exists settings_write on public.settings;
create policy settings_read on public.settings for select to authenticated using (public.is_active_user());
create policy settings_write on public.settings for update to authenticated using (public.is_teacher()) with check (public.is_teacher());

-- ---------- Kategori & kartu ----------
create table if not exists public.decks (
  id         text primary key check (id ~ '^[a-z0-9_]{2,32}$'),
  zh         text not null check (char_length(zh) between 1 and 16),
  py         text not null default '' check (char_length(py) <= 60),
  idn        text not null default '' check (char_length(idn) <= 40),
  color      text not null default '#2340b8' check (color ~ '^#[0-9a-fA-F]{6}$'),
  kind       text not null default 'noun' check (kind in ('noun','adj')),
  builtin    boolean not null default false,
  sort       int not null default 100,
  created_at timestamptz not null default now()
);
create table if not exists public.cards (
  id         text primary key check (char_length(id) between 3 and 64),
  deck_id    text not null references public.decks(id) on delete cascade,
  h          text not null check (char_length(h) between 1 and 12),
  p          text not null default '' check (char_length(p) <= 60),
  m          text not null check (char_length(m) between 1 and 60),
  mw         text not null default '' check (char_length(mw) <= 2),
  alt        text[] not null default '{}' check (cardinality(alt) <= 4),
  opp        text not null default '' check (char_length(opp) <= 12),
  s          text not null default '' check (char_length(s) <= 60),
  sp         text not null default '' check (char_length(sp) <= 120),
  si         text not null default '' check (char_length(si) <= 120),
  pic        text not null default '' check (char_length(pic) <= 300),
  builtin    boolean not null default false,
  sort       int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists cards_deck_idx on public.cards(deck_id);

alter table public.decks enable row level security;
alter table public.cards enable row level security;
drop policy if exists decks_read on public.decks;   drop policy if exists decks_write on public.decks;
drop policy if exists cards_read on public.cards;   drop policy if exists cards_write on public.cards;
create policy decks_read  on public.decks for select to authenticated using (public.is_active_user());
create policy decks_write on public.decks for all    to authenticated using (public.is_teacher()) with check (public.is_teacher());
create policy cards_read  on public.cards for select to authenticated using (public.is_active_user());
create policy cards_write on public.cards for all    to authenticated using (public.is_teacher()) with check (public.is_teacher());

-- ---------- Jadwal ulang (spaced repetition) ----------
create table if not exists public.srs (
  student_id uuid not null references public.profiles(id) on delete cascade,
  card_id    text not null references public.cards(id) on delete cascade,
  due        timestamptz not null,
  last       smallint not null check (last between 1 and 4),
  primary key (student_id, card_id)
);
alter table public.srs enable row level security;
drop policy if exists srs_read on public.srs;
create policy srs_read on public.srs for select to authenticated
  using ((student_id = auth.uid() and public.is_active_user()) or public.is_teacher());
-- Ditulis hanya oleh fungsi rate_card.

-- ---------- Sesi & jawaban (skor) ----------
create table if not exists public.sessions (
  id          uuid primary key default gen_random_uuid(),
  student_id  uuid not null references public.profiles(id) on delete cascade,
  decks       text[] not null,
  mode        text not null,
  started_at  timestamptz not null default now(),
  finished_at timestamptz,
  total       int not null default 0,
  score       int,
  c1 int not null default 0, c2 int not null default 0, c3 int not null default 0, c4 int not null default 0,
  quiz_right  int not null default 0,
  quiz_total  int not null default 0,
  seconds     int not null default 0
);
create index if not exists sessions_student_idx on public.sessions(student_id, started_at desc);

create table if not exists public.answers (
  id           bigserial primary key,
  session_id   uuid not null references public.sessions(id) on delete cascade,
  student_id   uuid not null references public.profiles(id) on delete cascade,
  card_id      text references public.cards(id) on delete set null,
  deck_id      text not null,
  card_h       text not null,
  rating       smallint not null check (rating between 1 and 4),
  quiz_correct boolean,
  ms           int not null check (ms between 0 and 600000),
  first_try    boolean not null,
  created_at   timestamptz not null default now()
);
create index if not exists answers_session_idx on public.answers(session_id);
create index if not exists answers_time_idx on public.answers(created_at);

create table if not exists public.quiz_pending (
  session_id    uuid not null references public.sessions(id) on delete cascade,
  card_id       text not null,
  correct_token text not null,
  tokens        text[] not null,
  answered      boolean not null default false,
  result        boolean,
  created_at    timestamptz not null default now(),
  primary key (session_id, card_id)
);

alter table public.sessions enable row level security;
alter table public.answers enable row level security;
alter table public.quiz_pending enable row level security;
drop policy if exists sessions_read on public.sessions;
drop policy if exists answers_read on public.answers;
create policy sessions_read on public.sessions for select to authenticated using (student_id = auth.uid() or public.is_teacher());
create policy answers_read  on public.answers  for select to authenticated using (student_id = auth.uid() or public.is_teacher());
-- quiz_pending: tanpa policy sama sekali → tidak bisa dibaca/ditulis dari browser.

-- =====================================================================
--  Fungsi server (dipanggil dari app). Semua memeriksa siapa pemanggilnya.
-- =====================================================================

create or replace function public._require_active() returns uuid
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare uid uuid := auth.uid();
begin
  if uid is null or not exists (select 1 from profiles where id = uid and active) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  return uid;
end $$;

create or replace function public._own_open_session(p_session uuid) returns public.sessions
language plpgsql security definer set search_path = public, pg_temp as $$
declare s sessions; uid uuid := public._require_active();
begin
  select * into s from sessions where id = p_session and student_id = uid for update;
  if not found then raise exception 'session_not_found' using errcode = '42501'; end if;
  if s.finished_at is not null then raise exception 'session_finished' using errcode = '42501'; end if;
  if s.started_at < now() - interval '6 hours' then raise exception 'session_expired' using errcode = '42501'; end if;
  return s;
end $$;

-- Mulai sesi
create or replace function public.start_session(p_decks text[], p_mode text) returns uuid
language plpgsql security definer set search_path = public, pg_temp as $$
declare uid uuid := public._require_active(); sid uuid; recent int;
begin
  if p_mode not in ('pic','han','arti','mix') then raise exception 'bad_mode'; end if;
  if p_decks is null or cardinality(p_decks) < 1 or cardinality(p_decks) > 60 then raise exception 'bad_decks'; end if;
  if exists (select 1 from unnest(p_decks) d where not exists (select 1 from decks where id = d)) then raise exception 'bad_decks'; end if;
  select count(*) into recent from sessions where student_id = uid and started_at > now() - interval '1 hour';
  if recent >= 60 then raise exception 'too_many_sessions' using errcode = '54000'; end if;
  insert into sessions (student_id, decks, mode) values (uid, p_decks, p_mode) returning id into sid;
  return sid;
end $$;

-- Pilihan jawaban mode tebak. Token acak; jawaban benar disimpan di server saja.
create or replace function public.quiz_options(p_session uuid, p_card text) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare s sessions := public._own_open_session(p_session); c cards; opts jsonb := '[]'::jsonb; tok text; toks text[] := '{}'; correct text; r record;
begin
  select * into c from cards where id = p_card and deck_id = any(s.decks);
  if not found then raise exception 'card_not_in_session'; end if;
  if (select count(*) from quiz_pending where session_id = p_session) > 3000 then raise exception 'too_many' using errcode = '54000'; end if;
  for r in
    (select * from (select x.*, 1 as ord from cards x where x.id = c.id
      union all
      (select y.*, 0 from cards y where y.deck_id = c.deck_id and y.id <> c.id and y.h <> c.h and y.m <> c.m order by random() limit 3)) q
     order by random())
  loop
    tok := encode(gen_random_bytes(9), 'hex');
    toks := toks || tok;
    if r.id = c.id then correct := tok; end if;
    opts := opts || jsonb_build_object('t', tok, 'h', r.h, 'p', r.p, 'm', r.m);
  end loop;
  insert into quiz_pending (session_id, card_id, correct_token, tokens)
    values (p_session, c.id, correct, toks)
    on conflict (session_id, card_id) do update set correct_token = excluded.correct_token, tokens = excluded.tokens, answered = false, result = null, created_at = now();
  return opts;
end $$;

-- Jawab tebakan (satu kali per kartu per putaran)
create or replace function public.answer_quiz(p_session uuid, p_card text, p_token text) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare s sessions := public._own_open_session(p_session); q quiz_pending; ok boolean;
begin
  select * into q from quiz_pending where session_id = p_session and card_id = p_card for update;
  if not found or q.answered then raise exception 'no_pending_question'; end if;
  if not (p_token = any(q.tokens)) then raise exception 'bad_token'; end if;
  ok := (p_token = q.correct_token);
  update quiz_pending set answered = true, result = ok where session_id = p_session and card_id = p_card;
  return jsonb_build_object('correct', ok, 'correct_token', q.correct_token);
end $$;

-- Nilai kartu 1–4 + catat lama waktu melihat kartu
create or replace function public.rate_card(p_session uuid, p_card text, p_rating int, p_ms int) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare s sessions := public._own_open_session(p_session); c cards; q quiz_pending; first boolean; n int;
begin
  if p_rating not between 1 and 4 then raise exception 'bad_rating'; end if;
  select * into c from cards where id = p_card and deck_id = any(s.decks);
  if not found then raise exception 'card_not_in_session'; end if;
  select count(*) into n from answers where session_id = p_session;
  if n >= 3000 then raise exception 'too_many' using errcode = '54000'; end if;
  first := not exists (select 1 from answers where session_id = p_session and card_id = p_card);
  select * into q from quiz_pending where session_id = p_session and card_id = p_card;
  insert into answers (session_id, student_id, card_id, deck_id, card_h, rating, quiz_correct, ms, first_try)
    values (p_session, s.student_id, c.id, c.deck_id, c.h, p_rating,
            case when q.answered then q.result else null end,
            greatest(0, least(coalesce(p_ms, 0), 600000)), first);
  delete from quiz_pending where session_id = p_session and card_id = p_card;
  insert into srs (student_id, card_id, due, last)
    values (s.student_id, c.id,
            case p_rating when 3 then now() + interval '1 day' when 4 then now() + interval '3 days' else now() end,
            p_rating)
    on conflict (student_id, card_id) do update set due = excluded.due, last = excluded.last;
end $$;

-- Selesaikan sesi: skor DIHITUNG di server dari jawaban yang tercatat
create or replace function public.finish_session(p_session uuid) returns public.sessions
language plpgsql security definer set search_path = public, pg_temp as $$
declare s sessions := public._own_open_session(p_session); res sessions;
begin
  update sessions set
    finished_at = now(),
    total      = (select count(*) from answers where session_id = p_session and first_try),
    c1         = (select count(*) from answers where session_id = p_session and first_try and rating = 1),
    c2         = (select count(*) from answers where session_id = p_session and first_try and rating = 2),
    c3         = (select count(*) from answers where session_id = p_session and first_try and rating = 3),
    c4         = (select count(*) from answers where session_id = p_session and first_try and rating = 4),
    quiz_total = (select count(*) from answers where session_id = p_session and first_try and quiz_correct is not null),
    quiz_right = (select count(*) from answers where session_id = p_session and first_try and quiz_correct),
    score      = (select round(avg(rating * 25))::int from answers where session_id = p_session and first_try),
    seconds    = least(extract(epoch from now() - started_at)::int, 21600)
  where id = p_session returning * into res;
  delete from quiz_pending where session_id = p_session;
  return res;
end $$;

-- Statistik waktu per kartu (khusus guru)
create or replace function public.teacher_card_time(p_student uuid default null, p_class text default null, p_days int default 30)
returns table (card_id text, card_h text, deck_id text, n bigint, avg_ms numeric, wrong_rate numeric)
language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  if not public.is_teacher() then raise exception 'not_allowed' using errcode = '42501'; end if;
  return query
    select a.card_id, max(a.card_h), max(a.deck_id), count(*), round(avg(a.ms)),
           round(avg(case when a.rating <= 2 or a.quiz_correct = false then 1 else 0 end)::numeric, 3)
    from answers a join profiles p on p.id = a.student_id
    where a.created_at > now() - make_interval(days => greatest(1, least(coalesce(p_days, 30), 365)))
      and (p_student is null or a.student_id = p_student)
      and (p_class is null or p.class_name = p_class)
    group by a.card_id
    order by avg(a.ms) desc
    limit 200;
end $$;

create or replace function public.teacher_deck_time(p_student uuid default null, p_class text default null, p_days int default 30)
returns table (deck_id text, n bigint, avg_ms numeric, total_ms bigint)
language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  if not public.is_teacher() then raise exception 'not_allowed' using errcode = '42501'; end if;
  return query
    select a.deck_id, count(*), round(avg(a.ms)), sum(a.ms)::bigint
    from answers a join profiles p on p.id = a.student_id
    where a.created_at > now() - make_interval(days => greatest(1, least(coalesce(p_days, 30), 365)))
      and (p_student is null or a.student_id = p_student)
      and (p_class is null or p.class_name = p_class)
    group by a.deck_id
    order by avg(a.ms) desc;
end $$;

-- ---------- Hak menjalankan fungsi ----------
revoke all on function public.is_teacher(), public.is_active_user(), public._require_active(), public._own_open_session(uuid),
  public.start_session(text[], text), public.quiz_options(uuid, text), public.answer_quiz(uuid, text, text),
  public.rate_card(uuid, text, int, int), public.finish_session(uuid),
  public.teacher_card_time(uuid, text, int), public.teacher_deck_time(uuid, text, int) from public, anon;
grant execute on function public.is_teacher(), public.is_active_user(),
  public.start_session(text[], text), public.quiz_options(uuid, text), public.answer_quiz(uuid, text, text),
  public.rate_card(uuid, text, int, int), public.finish_session(uuid),
  public.teacher_card_time(uuid, text, int), public.teacher_deck_time(uuid, text, int) to authenticated;
-- Tamu (anon) tidak bisa membaca tabel apa pun:
revoke all on all tables in schema public from anon;

-- ---------- Penyimpanan foto kartu ----------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('card-images', 'card-images', true, 2097152, array['image/png','image/jpeg','image/webp','image/gif'])
on conflict (id) do update set public = true, file_size_limit = 2097152, allowed_mime_types = array['image/png','image/jpeg','image/webp','image/gif'];
drop policy if exists card_images_teacher_insert on storage.objects;
drop policy if exists card_images_teacher_delete on storage.objects;
create policy card_images_teacher_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'card-images' and public.is_teacher());
create policy card_images_teacher_delete on storage.objects for delete to authenticated
  using (bucket_id = 'card-images' and public.is_teacher());
