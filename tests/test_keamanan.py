"""Uji keamanan database di Postgres lokal yang meniru Supabase."""
import psycopg2, sys, uuid
DSN = "host=/var/lib/postgresql/pgtest port=5499 user=postgres dbname=postgres"
admin = psycopg2.connect(DSN); admin.autocommit = True
A = admin.cursor()
T, S1, S2, S3 = (str(uuid.uuid4()) for _ in range(4))
for uid, role, un, act in [(T,'teacher','guru',True),(S1,'student','budi',True),(S2,'student','sinta',True),(S3,'student','nonaktif',False)]:
    A.execute("insert into auth.users(id) values (%s)", (uid,))
    A.execute("insert into profiles(id,role,username,display_name,class_name,active) values (%s,%s,%s,%s,'3A',%s)", (uid, role, un, un.title(), act))

results = []
def run(name, who, sql, params=(), expect="ok", check=None):
    con = psycopg2.connect(DSN); cur = con.cursor(); rows = None
    try:
        if who == "anon":
            cur.execute("set role anon")
        else:
            cur.execute("set role authenticated"); cur.execute("select set_config('request.jwt.claim.sub', %s, false)", (who,))
        cur.execute(sql, params)
        rows = cur.fetchall() if cur.description else None
        rc = cur.rowcount
        con.commit()
        ok = expect == "ok" and (check is None or check(rows, rc))
        detail = f"rows={rows if rows is None or len(str(rows))<120 else str(rows)[:120]+'…'} rc={rc}"
    except Exception as e:
        con.rollback(); ok = expect == "error"; detail = str(e).split("\n")[0][:110]
    finally:
        con.close()
    results.append((ok, name, detail)); return rows

# --- alur normal murid ---
sid = run("Murid mulai sesi", S1, "select start_session(%s,%s)", (["buah"], "pic"))[0][0]
opts = run("Murid minta pilihan tebak", S1, "select quiz_options(%s,%s)", (sid, "buah:苹果"), check=lambda r,rc: len(r[0][0]) == 4)[0][0]
run("Token palsu ditolak", S1, "select answer_quiz(%s,%s,%s)", (sid, "buah:苹果", "deadbeef"), expect="error")
res = run("Murid menjawab tebakan", S1, "select answer_quiz(%s,%s,%s)", (sid, "buah:苹果", opts[0]["t"]))
run("Jawab dua kali ditolak", S1, "select answer_quiz(%s,%s,%s)", (sid, "buah:苹果", opts[0]["t"]), expect="error")
run("Murid memberi nilai 4", S1, "select rate_card(%s,%s,4,5200)", (sid, "buah:苹果"))
run("Nilai 9 ditolak", S1, "select rate_card(%s,%s,9,1000)", (sid, "buah:香蕉"), expect="error")
run("Kartu di luar sesi ditolak", S1, "select rate_card(%s,%s,4,1000)", (sid, "hewan:狗"), expect="error")
run("Murid memberi nilai 1", S1, "select rate_card(%s,%s,1,999999999)", (sid, "buah:香蕉"))
fin = run("Server menghitung skor", S1, "select score,total,c1,c4 from finish_session(%s)", (sid,), check=lambda r,rc: r[0] == (63, 2, 1, 1) or r[0][1] == 2)
run("Waktu dibatasi maks 10 menit", S1, "select max(ms) from answers", check=lambda r,rc: r[0][0] == 600000)
run("Sesi selesai tak bisa ditambah", S1, "select rate_card(%s,%s,4,1000)", (sid, "buah:橙子"), expect="error")
run("Selesai dua kali ditolak", S1, "select finish_session(%s)", (sid,), expect="error")

# --- upaya curang murid ---
run("Ubah skor langsung", S1, "update sessions set score=100 where id=%s", (sid,), check=lambda r,rc: rc == 0)
run("Hapus jawaban", S1, "delete from answers where session_id=%s", (sid,), check=lambda r,rc: rc == 0)
run("Ubah jawaban", S1, "update answers set rating=4", check=lambda r,rc: rc == 0)
run("Sisipkan sesi palsu", S1, "insert into sessions(student_id,decks,mode,score,finished_at) values (%s,'{buah}','pic',100,now())", (S1,), expect="error")
run("Sisipkan jawaban palsu", S1, "insert into answers(session_id,student_id,card_id,deck_id,card_h,rating,ms,first_try) values (%s,%s,'buah:梨','buah','梨',4,1,true)", (sid, S1), expect="error")
run("Baca kunci jawaban tebak", S1, "select * from quiz_pending", check=lambda r,rc: r == [])
run("Ubah jadwal ulang sendiri", S1, "update srs set last=4", check=lambda r,rc: rc == 0)
run("Lihat skor murid lain", S2, "select count(*) from sessions where student_id=%s", (S1,), check=lambda r,rc: r[0][0] == 0)
run("Lihat profil murid lain", S2, "select count(*) from profiles", check=lambda r,rc: r[0][0] == 1)
run("Jadikan diri guru", S1, "update profiles set role='teacher' where id=%s", (S1,), check=lambda r,rc: rc == 0)
run("Murid hapus kartu", S1, "delete from cards where id='buah:苹果'", check=lambda r,rc: rc == 0)
run("Murid tambah kartu", S1, "insert into cards(id,deck_id,h,m) values ('buah:x','buah','x','x')", expect="error")
run("Murid ubah pengaturan", S1, "update settings set quiz_enabled=false", check=lambda r,rc: rc == 0)
run("Murid lihat statistik guru", S1, "select * from teacher_card_time()", expect="error")
run("Murid pakai sesi orang lain", S2, "select rate_card(%s,%s,4,1)", (sid, "buah:苹果"), expect="error")
run("Akun nonaktif tidak bisa mulai", S3, "select start_session(%s,%s)", (["buah"], "pic"), expect="error")
run("Akun nonaktif tidak bisa baca kartu", S3, "select count(*) from cards", check=lambda r,rc: r[0][0] == 0)
run("Tamu tanpa login baca kartu", "anon", "select count(*) from cards", expect="error")
run("Tamu tanpa login mulai sesi", "anon", "select start_session('{buah}','pic')", expect="error")

# --- guru ---
run("Guru lihat semua sesi", T, "select count(*) from sessions", check=lambda r,rc: r[0][0] == 1)
run("Guru statistik waktu", T, "select card_h, avg_ms from teacher_card_time()", check=lambda r,rc: len(r) == 2)
run("Guru statistik kategori", T, "select * from teacher_deck_time()", check=lambda r,rc: len(r) == 1)
run("Guru tambah kartu", T, "insert into cards(id,deck_id,h,m) values ('buah:test','buah','测试','tes')")
run("Guru hapus kartu", T, "delete from cards where id='buah:test'", check=lambda r,rc: rc == 1)
run("Guru ubah pengaturan", T, "update settings set default_mode='han'", check=lambda r,rc: rc == 1)
run("Pengaturan tak valid ditolak", T, "update settings set default_mode='hack'", expect="error")
run("Guru tak bisa ubah skor", T, "update sessions set score=1", check=lambda r,rc: rc == 0)

fails = 0
for ok, name, d in results:
    print(("LULUS " if ok else "GAGAL ") + name + ("" if ok else "  → " + d)); fails += (not ok)
print(f"\n{len(results)-fails}/{len(results)} lulus")
sys.exit(1 if fails else 0)
