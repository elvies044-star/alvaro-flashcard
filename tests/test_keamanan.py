"""Uji keamanan server Cloudflare (jalankan `wrangler pages dev` dulu)."""
import json, sys, time, urllib.request, urllib.error, os
BASE = os.environ.get('BASE', 'http://localhost:8788')
SETUP = os.environ.get('SETUP_CODE', 'rahasia-setup-123')
results = []

class Client:
    def __init__(self, origin=BASE): self.cookie = None; self.origin = origin
    def req(self, method, path, body=None, raw=None, ctype=None, headers=None):
        h = {'Origin': self.origin} if self.origin else {}
        if headers: h.update(headers)
        data = None
        if raw is not None: data = raw; h['Content-Type'] = ctype or 'application/octet-stream'
        elif body is not None: data = json.dumps(body).encode(); h['Content-Type'] = 'application/json'
        if self.cookie: h['Cookie'] = self.cookie
        r = urllib.request.Request(BASE + path, data=data, method=method, headers=h)
        try:
            with urllib.request.urlopen(r) as res: status, txt, hdr = res.status, res.read(), res.headers
        except urllib.error.HTTPError as e: status, txt, hdr = e.code, e.read(), e.headers
        sc = hdr.get('Set-Cookie')
        if sc and '__Host-afsid=' in sc:
            v = sc.split(';')[0]; self.cookie = None if v.endswith('=') else v
        try: j = json.loads(txt)
        except Exception: j = txt
        return status, j, hdr

def check(name, cond, detail=''):
    results.append((bool(cond), name, detail))

T = Client(); S1 = Client(); S2 = Client(); X = Client()
# ---- setup ----
check('Status awal: perlu setup', T.req('GET', '/api/setup')[1].get('needsSetup') is True)
check('Kode setup salah ditolak', T.req('POST', '/api/setup', {'code': 'salah', 'username': 'guru', 'display_name': 'G', 'password': 'passwordguru1'})[0] == 403)
st, me, _ = T.req('POST', '/api/setup', {'code': SETUP, 'username': 'guru', 'display_name': 'Laoshi', 'password': 'passwordguru1'})
check('Guru dibuat dengan kode benar', st == 200 and me.get('role') == 'teacher', me)
check('Setup kedua kali ditolak', X.req('POST', '/api/setup', {'code': SETUP, 'username': 'hacker', 'display_name': 'H', 'password': 'passwordhack1'})[0] == 409)
# ---- akun murid ----
st, a, _ = T.req('POST', '/api/t/students', {'action': 'create', 'display_name': 'Budi', 'username': 'budi', 'class_name': '3A'})
check('Guru membuat akun murid', st == 200 and len(a.get('password', '')) >= 10, a)
st, b, _ = T.req('POST', '/api/t/students', {'action': 'create', 'display_name': 'Sinta', 'username': 'sinta', 'class_name': '3B'})
check('Username dobel ditolak', T.req('POST', '/api/t/students', {'action': 'create', 'display_name': 'X', 'username': 'budi'})[0] == 409)
check('Murid login', S1.req('POST', '/api/login', {'username': 'budi', 'password': a['password']})[0] == 200)
S2.req('POST', '/api/login', {'username': 'sinta', 'password': b['password']})
check('Cookie HttpOnly + Secure + SameSite', all(k in (S1.req('POST', '/api/login', {'username': 'budi', 'password': a['password']})[2].get('Set-Cookie') or '') for k in ['HttpOnly', 'Secure', 'SameSite=Strict']))
check('Tanpa login tidak bisa baca kartu', X.req('GET', '/api/content')[0] == 401)
check('Cookie palsu ditolak', Client().req('GET', '/api/me', headers={'Cookie': '__Host-afsid=' + 'a' * 64})[0] == 401)
# ---- serangan login ----
for i in range(5): X.req('POST', '/api/login', {'username': 'sinta', 'password': 'tebak%d' % i})
check('Akun dikunci setelah 5x salah', X.req('POST', '/api/login', {'username': 'sinta', 'password': b['password']})[0] == 429)
check('Pesan salah tidak membedakan username', X.req('POST', '/api/login', {'username': 'tidakada', 'password': 'x'})[1].get('error') == 'Username atau password salah.')
check('Permintaan dari situs lain ditolak (CSRF)', Client(origin='https://jahat.com').req('POST', '/api/login', {'username': 'budi', 'password': a['password']})[0] == 403)
check('Permintaan tanpa Origin ditolak', Client(origin=None).req('POST', '/api/login', {'username': 'budi', 'password': a['password']})[0] == 403)
# ---- sesi belajar normal ----
st, r, _ = S1.req('POST', '/api/run/start', {'decks': ['buah'], 'mode': 'pic'}); sid = r['id']
check('Murid mulai sesi', st == 200)
st, opts, _ = S1.req('POST', '/api/run/quiz', {'sid': sid, 'card': 'buah:苹果'})
check('Pilihan tebak: 4 opsi tanpa kunci jawaban', st == 200 and len(opts) == 4 and all(set(o) == {'t', 'h', 'p', 'm', 'en'} for o in opts), opts)
check('Token palsu ditolak', S1.req('POST', '/api/run/answer', {'sid': sid, 'card': 'buah:苹果', 'token': 'deadbeef'})[0] == 400)
right = [o for o in opts if o['h'] == '苹果'][0]['t']
st, ans, _ = S1.req('POST', '/api/run/answer', {'sid': sid, 'card': 'buah:苹果', 'token': right})
check('Jawaban benar dikenali server', st == 200 and ans['correct'] is True)
check('Jawab dua kali ditolak', S1.req('POST', '/api/run/answer', {'sid': sid, 'card': 'buah:苹果', 'token': right})[0] == 409)
check('Nilai 4', S1.req('POST', '/api/run/rate', {'sid': sid, 'card': 'buah:苹果', 'rating': 4, 'ms': 5200})[0] == 200)
check('Nilai 9 ditolak', S1.req('POST', '/api/run/rate', {'sid': sid, 'card': 'buah:香蕉', 'rating': 9, 'ms': 10})[0] == 400)
check('Kartu di luar sesi ditolak', S1.req('POST', '/api/run/rate', {'sid': sid, 'card': 'hewan:狗', 'rating': 4, 'ms': 10})[0] == 400)
check('Nilai 1 (waktu dibatasi)', S1.req('POST', '/api/run/rate', {'sid': sid, 'card': 'buah:香蕉', 'rating': 1, 'ms': 99999999})[0] == 200)
check('Murid lain tidak bisa pakai sesi ini', S2.req('POST', '/api/run/rate', {'sid': sid, 'card': 'buah:苹果', 'rating': 4, 'ms': 1})[0] == 404)
st, fin, _ = S1.req('POST', '/api/run/finish', {'sid': sid})
check('Skor dihitung server (4→100, 1→25 = 63)', st == 200 and fin['score'] == 63 and fin['total'] == 2 and fin['quiz_right'] == 1, fin)
check('Sesi selesai tak bisa ditambah', S1.req('POST', '/api/run/rate', {'sid': sid, 'card': 'buah:橙子', 'rating': 4, 'ms': 1})[0] == 409)
check('Selesai dua kali ditolak', S1.req('POST', '/api/run/finish', {'sid': sid})[0] == 409)
# ---- coba curang: endpoint guru ----
for path, body in [('/api/t/students', {'action': 'create', 'display_name': 'X', 'username': 'xx1'}), ('/api/t/settings', {'quiz_enabled': False}),
                   ('/api/t/approve', {'id': 'buah', 'approve': True}), ('/api/password', {'old': 'x', 'new': 'yyyyyyyyyyyy'}),
                   ('/api/deck', {'zh': '假'}), ('/api/translate', {'lines': ['我']})]:
    check(f'Murid tanpa izin tidak bisa {path}', S1.req('POST', path, body)[0] == 403)
for path, body in [('/api/card/delete', {'id': 'buah:苹果'}), ('/api/deck/delete', {'id': 'buah'}), ('/api/cards/bulk', {'deck_id': 'buah', 'cards': [{'h': '假', 'm': 'palsu'}]}),
                   ('/api/card/update', {'id': 'buah:苹果', 'h': '苹果', 'm': 'HACK'})]:
    check(f'Murid tidak bisa ubah kartu guru {path}', S1.req('POST', path, body)[0] in (403, 404))
for path in ['/api/t/students', '/api/t/runs?days=30', '/api/t/card-time?days=30', '/api/t/deck-time?days=30']:
    check(f'Murid tidak bisa baca {path.split("?")[0]}', S1.req('GET', path)[0] == 403)
check('Murid hanya melihat riwayatnya sendiri', len(S2.req('GET', '/api/runs/mine')[1]) == 0 and len(S1.req('GET', '/api/runs/mine')[1]) == 1)
check('Endpoint penulis skor tidak ada', S1.req('POST', '/api/run/score', {'sid': sid, 'score': 100})[0] == 404)
check('Body bukan JSON ditolak', S1.req('POST', '/api/run/start', raw=b'decks=buah', ctype='application/x-www-form-urlencoded')[0] == 415)
check('Teks berbahaya dibersihkan', T.req('POST', '/api/t/students', {'action': 'create', 'display_name': '<img src=x onerror=alert(1)>Eko', 'username': 'eko'})[0] == 200
      and '<' not in json.dumps([s['display_name'] for s in T.req('GET', '/api/t/students')[1]]))
# ---- guru ----
st, runs, _ = T.req('GET', '/api/t/runs?days=30'); check('Guru melihat skor semua murid', st == 200 and len(runs) == 1)
st, ct, _ = T.req('GET', '/api/t/card-time?days=30'); check('Grafik waktu per kartu', st == 200 and ct[0]['card_h'] == '香蕉' and ct[0]['avg_ms'] == 600000, ct)
st, dt, _ = T.req('GET', '/api/t/deck-time?days=30&class=3A'); check('Grafik per kelas', st == 200 and len(dt) == 1)
check('Filter kelas lain kosong', T.req('GET', '/api/t/deck-time?days=30&class=3B')[1] == [])
check('Guru sembunyikan kategori', T.req('POST', '/api/t/settings', {'hidden_decks': ['hewan']})[0] == 200)
check('Murid tak menerima kategori tersembunyi', not any(d['id'] == 'hewan' for d in S1.req('GET', '/api/content')[1]['decks']))
check('Murid tak bisa mulai kategori tersembunyi', S1.req('POST', '/api/run/start', {'decks': ['hewan'], 'mode': 'pic'})[0] == 400)
st, r1, _ = T.req('POST', '/api/cards/bulk', {'deck_id': 'buah', 'cards': [{'h': '榴莲糖', 'm': 'permen durian', 'mw': '颗', 'pic': '🍬'}, {'h': '苹果', 'm': 'dobel'}]})
check('Guru tambah kartu massal (dobel dilewati)', st == 200 and r1['added'] == 1 and r1['skipped'] == ['苹果'], r1)
check('Gambar berbahaya di kartu ditolak', T.req('POST', '/api/cards/bulk', {'deck_id': 'buah', 'cards': [{'h': '坏', 'm': 'x', 'pic': 'javascript:alert(1)'}]})[0] == 400)
check('Bukan hanzi di kolom 汉字 ditolak', T.req('POST', '/api/cards/bulk', {'deck_id': 'buah', 'cards': [{'h': 'abc', 'm': 'x'}]})[0] == 400)
png = bytes.fromhex('89504e470d0a1a0a0000000d4948445200000001000000010806000000') + b'\0' * 40
st, up, _ = T.req('POST', '/api/image', raw=png, ctype='image/png'); check('Guru unggah foto', st == 200 and up['url'].startswith('/api/img/'))
check('File bukan gambar ditolak', T.req('POST', '/api/image', raw=b'<script>alert(1)</script>' * 3, ctype='image/png')[0] == 415)
st, _, h = S1.req('GET', up['url']); check('Foto dilayani dengan nosniff', st == 200 and h.get('X-Content-Type-Options') == 'nosniff')
check('Foto tak bisa dibuka tanpa login', X.req('GET', up['url'])[0] == 401)
check('Guru hapus kartu bawaan', T.req('POST', '/api/card/delete', {'id': 'buah:梨'})[0] == 200)
# ---- izin membuat kartu & persetujuan ----
S3 = Client(); st, c3, _ = T.req('POST', '/api/t/students', {'action': 'create', 'display_name': 'Dewi', 'username': 'dewi', 'class_name': '3A'})
S3.req('POST', '/api/login', {'username': 'dewi', 'password': c3['password']})
check('Murid tanpa izin tidak bisa unggah foto', S3.req('POST', '/api/image', raw=png, ctype='image/png')[0] == 403)
check('Guru beri izin buat kartu', T.req('POST', '/api/t/students', {'action': 'set_create', 'id': c3['id'], 'allow': True})[0] == 200)
check('Profil murid menunjukkan izin', S3.req('GET', '/api/me')[1].get('can_create') is True)
st, tr, _ = S3.req('POST', '/api/translate', {'lines': ['我', '骄傲', 'kucing', '<b>x</b>']})
check('Terjemahan: kamus + pinyin otomatis', st == 200 and tr['items'][1]['p'] == "jiāo'ào" and tr['items'][1]['m'] == 'sombong' and tr['items'][2]['h'] == '猫' and tr['items'][0]['p'] == 'wǒ', tr)
check('Terjemahan membersihkan HTML', '<' not in json.dumps(tr))
st, nd, _ = S3.req('POST', '/api/deck', {'zh': '我的词', 'idn': 'Kata saya'}); did = nd.get('id')
check('Murid berizin buat kategori (pribadi)', st == 200 and did)
check('Murid tambah kartu ke kategorinya', S3.req('POST', '/api/cards/bulk', {'deck_id': did, 'cards': [{'h': '我', 'p': 'wǒ', 'm': 'saya'}, {'h': '你', 'p': 'nǐ', 'm': 'kamu'}]})[1].get('added') == 2)
see = lambda c: any(d['id'] == did for d in c.req('GET', '/api/content')[1]['decks'])
S4 = Client(); st, c4, _ = T.req('POST', '/api/t/students', {'action': 'create', 'display_name': 'Rina', 'username': 'rina'}); S4.req('POST', '/api/login', {'username': 'rina', 'password': c4['password']})
check('Kategori pribadi tidak terlihat murid lain', not see(S4) and see(S3))
check('Murid lain tak bisa mulai kategori pribadi', S4.req('POST', '/api/run/start', {'decks': [did], 'mode': 'pic'})[0] == 400)
check('Murid lain tak bisa ubah kategori itu', S4.req('POST', '/api/deck/delete', {'id': did})[0] in (403, 404))
check('Murid tak bisa setujui kategorinya sendiri', S3.req('POST', '/api/t/approve', {'id': did, 'approve': True})[0] == 403)
check('Murid minta persetujuan', S3.req('POST', '/api/deck/submit', {'id': did})[0] == 200)
check('Menunggu persetujuan: masih tersembunyi', not see(S4))
check('Guru melihat yang menunggu', any(d['id'] == did and d['status'] == 'pending' for d in T.req('GET', '/api/content')[1]['decks']))
check('Guru menyetujui', T.req('POST', '/api/t/approve', {'id': did, 'approve': True})[0] == 200)
check('Setelah disetujui terlihat murid lain', see(S4))
cid = [c['id'] for c in S3.req('GET', '/api/content')[1]['cards'] if c['deck_id'] == did][0]
check('Pembuat ubah kartu', S3.req('POST', '/api/card/update', {'id': cid, 'h': '我', 'p': 'wǒ', 'm': 'aku'})[0] == 200)
check('Perubahan murid → perlu disetujui ulang', not see(S4))
T.req('POST', '/api/t/approve', {'id': did, 'approve': True})
check('Murid lain tak bisa ubah kartu buatan teman', S4.req('POST', '/api/card/update', {'id': cid, 'h': '我', 'm': 'HACK'})[0] in (403, 404))
check('Izin dicabut → tak bisa ubah lagi', T.req('POST', '/api/t/students', {'action': 'set_create', 'id': c3['id'], 'allow': False})[0] == 200 and S3.req('POST', '/api/card/update', {'id': cid, 'h': '我', 'm': 'x'})[0] in (403, 404))
# ---- deteksi keluar aplikasi ----
st, r4, _ = S4.req('POST', '/api/run/start', {'decks': ['buah'], 'mode': 'pic', 'planned': 5}); sid4 = r4['id']
check('Status keluar aplikasi tercatat', S4.req('POST', '/api/run/presence', {'sid': sid4, 'state': 'away'})[1].get('away_count') == 1)
lv = T.req('GET', '/api/t/live')[1]; mine = [r for r in lv['runs'] if r['id'] == sid4]
check('Guru melihat murid keluar aplikasi (live)', mine and mine[0]['state'] == 'away' and mine[0]['name'] == 'Rina' and mine[0]['planned'] == 5, lv)
check('Keluar dua kali tidak dihitung ganda', S4.req('POST', '/api/run/presence', {'sid': sid4, 'state': 'away'})[1].get('away_count') == 1)
time.sleep(1.1)
S4.req('POST', '/api/run/presence', {'sid': sid4, 'state': 'active'})
check('Murid lain tak bisa memalsukan kehadiran', S2.req('POST', '/api/run/presence', {'sid': sid4, 'state': 'active'})[1].get('ok') is False)
S4.req('POST', '/api/run/rate', {'sid': sid4, 'card': 'buah:苹果', 'rating': 3, 'ms': 1000})
fin4 = S4.req('POST', '/api/run/finish', {'sid': sid4})[1]
check('Lama keluar aplikasi tersimpan di sesi', fin4['away_count'] == 1 and fin4['away_ms'] >= 1000, fin4)
check('Murid tidak bisa baca pantauan guru', S4.req('GET', '/api/t/live')[0] == 403)
# ---- izin buat kartu untuk semua murid ----
cfg = T.req('GET', '/api/content')[1]['settings']
check('Tanpa izin: murid tak bisa buat kategori', S3.req('POST', '/api/deck', {'zh': '测试'})[0] == 403)
check('Murid tak bisa menyalakan izin global', S3.req('POST', '/api/t/settings', {**cfg, 'all_can_create': True})[0] == 403)
T.req('POST', '/api/t/settings', {**cfg, 'all_can_create': True})
st, r, _ = S3.req('POST', '/api/deck', {'zh': '测试'})
check('Izin global: murid bisa buat kategori pribadi', st == 200 and S3.req('GET', '/api/me')[1]['can_create'] is True)
check('Kategori baru murid tetap pribadi', not any(d['id'] == r['id'] for d in S4.req('GET', '/api/content')[1]['decks']))
T.req('POST', '/api/t/settings', {**cfg, 'all_can_create': False})
check('Izin global dimatikan: tak bisa lagi', S3.req('POST', '/api/deck', {'zh': '测试二'})[0] == 403)
# ---- kiriman kartu ----
rid = [u['id'] for u in T.req('GET', '/api/t/students')[1] if u['username'] == 'rina'][0]
dv = T.req('POST', '/api/deck', {'zh': '礼物', 'idn': 'Hadiah', 'shared': False})[1]['id']
T.req('POST', '/api/cards/bulk', {'deck_id': dv, 'cards': [{'h': '书', 'p': 'shū', 'm': 'buku', 'mw': '本'}, {'h': '笔', 'p': 'bǐ', 'm': 'pena', 'mw': '支'}]})
seeD = lambda S: any(d['id'] == dv for d in S.req('GET', '/api/content')[1]['decks'])
check('Kategori khusus kiriman tersembunyi sebelum dikirim', not seeD(S4) and not seeD(S3))
check('Murid tak bisa mengirim kartu', S4.req('POST', '/api/t/deliver', {'deck_id': dv, 'to': {'all': True}})[0] == 403)
check('Murid tak bisa mengirim pesan', S4.req('POST', '/api/t/message', {'text': 'hai', 'to': {'all': True}})[0] == 403)
check('Murid tak bisa mengakhiri sesi orang', S4.req('POST', '/api/t/end-run', {'all': True})[0] == 403)
st, r, _ = T.req('POST', '/api/t/deliver', {'deck_id': dv, 'to': {'users': [rid]}})
check('Guru mengirim kategori ke satu murid', st == 200 and r['sent'] == 1, r)
check('Penerima melihat kategori kiriman', seeD(S4))
check('Murid lain tidak melihat kiriman itu', not seeD(S3))
ib = S4.req('GET', '/api/inbox')[1]
check('Kiriman muncul di kotak masuk murid', len(ib['deliveries']) == 1 and ib['deliveries'][0]['deck_id'] == dv, ib)
check('Murid lain tak bisa menandai kiriman orang', S3.req('POST', '/api/inbox/seen', {'deliveries': [ib['deliveries'][0]['id']]})[0] == 200 and len(S4.req('GET', '/api/inbox')[1]['deliveries']) == 1)
S4.req('POST', '/api/inbox/seen', {'deliveries': [ib['deliveries'][0]['id']]})
check('Setelah dibaca tidak muncul lagi', len(S4.req('GET', '/api/inbox')[1]['deliveries']) == 0)
check('Penerima bisa belajar kategori kiriman', S4.req('POST', '/api/run/start', {'decks': [dv], 'mode': 'pic'})[0] == 200)
check('Bukan penerima tak bisa belajar kategori kiriman', S3.req('POST', '/api/run/start', {'decks': [dv], 'mode': 'pic'})[0] == 400)
check('Kirim ke ID asing ditolak', T.req('POST', '/api/t/deliver', {'deck_id': dv, 'to': {'users': ['x' * 32]}})[0] == 400)
# ---- pesan / peringatan ----
st, r, _ = T.req('POST', '/api/t/message', {'text': 'Jangan keluar-keluar <b>aplikasi</b>', 'kind': 'warn', 'to': {'users': [rid]}})
check('Guru mengirim peringatan', st == 200 and r['sent'] == 1)
m = S4.req('GET', '/api/inbox')[1]['messages']
check('Peringatan sampai ke murid', len(m) == 1 and m[0]['kind'] == 'warn' and m[0]['text'].startswith('Jangan'), m)
check('Pesan tidak bocor ke murid lain', len(S3.req('GET', '/api/inbox')[1]['messages']) == 0)
check('Pesan kosong ditolak', T.req('POST', '/api/t/message', {'text': '  ', 'to': {'all': True}})[0] == 400)
check('Pesan terlalu panjang ditolak', T.req('POST', '/api/t/message', {'text': 'a' * 301, 'to': {'all': True}})[0] == 400)
S4.req('POST', '/api/inbox/seen', {'messages': [m[0]['id']]})
check('Pesan yang sudah dibaca hilang', len(S4.req('GET', '/api/inbox')[1]['messages']) == 0)
# ---- kuis 量词 ----
st, r, _ = S4.req('POST', '/api/run/start', {'decks': [dv], 'mode': 'mw', 'planned': 2}); sidm = r['id']
cards = [c for c in S4.req('GET', '/api/content')[1]['cards'] if c['deck_id'] == dv]
cb = [c for c in cards if c['h'] == '书'][0]
st, opts, _ = S4.req('POST', '/api/run/quiz', {'sid': sidm, 'card': cb['id'], 'kind': 'mw'})
check('Kuis 量词: 4 pilihan, satu benar, tanpa kunci jawaban', st == 200 and len(opts) == 4 and sum(o['w'] == '本' for o in opts) == 1 and all(set(o) == {'t', 'w', 'y'} for o in opts), opts)
right = [o for o in opts if o['w'] == '本'][0]['t']
check('Jawaban 量词 dinilai server', S4.req('POST', '/api/run/answer', {'sid': sidm, 'card': cb['id'], 'token': right})[1].get('correct') is True)
check('Setelah refresh: soal yang sudah dijawab tidak bisa diulang', S4.req('POST', '/api/run/quiz', {'sid': sidm, 'card': cb['id'], 'kind': 'mw'})[1].get('answered') is True)
# ---- lanjutkan & akhiri sesi ----
check('Status sesi terbuka (untuk lanjutkan)', S4.req('GET', '/api/run/status?sid=' + sidm)[1]['open'] is True)
check('Murid lain tak bisa cek sesi orang', S3.req('GET', '/api/run/status?sid=' + sidm)[1]['open'] is False)
st, r, _ = T.req('POST', '/api/t/end-run', {'sid': sidm})
check('Guru mengakhiri sesi murid', st == 200 and r['ended'] == 1)
pr = S4.req('POST', '/api/run/presence', {'sid': sidm, 'state': 'active'})[1]
check('Murid diberi tahu sesi diakhiri guru', pr.get('ok') is False and pr.get('ended_by') == 'teacher', pr)
check('Sesi yang diakhiri tidak bisa dijawab lagi', S4.req('POST', '/api/run/rate', {'sid': sidm, 'card': cb['id'], 'rating': 4})[0] == 409)
st, r, _ = S4.req('POST', '/api/run/start', {'decks': ['buah'], 'mode': 'pic', 'planned': 3}); sidx = r['id']
fx = S4.req('POST', '/api/run/finish', {'sid': sidx, 'early': True})[1]
check('Murid bisa mengakhiri sesinya sendiri', fx.get('ended_by') == 'self' and fx.get('finished_at'), fx)
# ---- English, asal tekan, progres ----
ct = S4.req('GET', '/api/content')[1]
check('Kartu bawaan punya arti English', any(c['h'] == '苹果' and c['en'] == 'apple' for c in ct['cards']))
tr = T.req('POST', '/api/translate', {'lines': ['apple', 'kucing', '骄傲']})[1]['items']
check('Input bahasa Inggris diterjemahkan', tr[0]['h'] == '苹果' and tr[0]['m'] == 'apel' and tr[1]['en'] == 'cat' and tr[2]['en'] == 'proud', tr)
st, r, _ = S4.req('POST', '/api/run/start', {'decks': ['buah'], 'mode': 'pic', 'planned': 3}); sr = r['id']
time.sleep(1.3)
r1 = S4.req('POST', '/api/run/rate', {'sid': sr, 'card': 'buah:苹果', 'rating': 3, 'ms': 2000})[1]
r2 = S4.req('POST', '/api/run/rate', {'sid': sr, 'card': 'buah:香蕉', 'rating': 4, 'ms': 50, 'clue': True})[1]
check('Jawaban normal tidak dianggap asal', r1.get('rush') is False, r1)
check('Jawaban beruntun < 1,2 dtk terdeteksi asal tekan (server)', r2.get('rush') is True, r2)
q = S4.req('POST', '/api/run/quiz', {'sid': sr, 'card': 'buah:橙子'})[1]
qa = S4.req('POST', '/api/run/answer', {'sid': sr, 'card': 'buah:橙子', 'token': q[0]['t']})[1]
check('Tebakan dijawab instan terdeteksi asal tekan', qa.get('rush') is True, qa)
fr = S4.req('POST', '/api/run/finish', {'sid': sr})[1]
check('Jumlah asal tekan & clue tersimpan di sesi', fr['rush'] == 2 and fr['clues'] == 1, fr)
check('Murid tak bisa lihat progres kelas', S4.req('GET', '/api/t/progress')[0] == 403)
pg = T.req('GET', '/api/t/progress')[1]
check('Guru melihat progres murid per kategori', any(x['deck_id'] == 'buah' and x['m4'] >= 1 for x in pg['rows']), pg)
st, _, _ = T.req('POST', '/api/t/students', {'action': 'set_active', 'id': b['id'] if 'id' in b else '', 'active': False})
check('Guru nonaktifkan akun', st == 200)
check('Akun nonaktif langsung keluar', S2.req('GET', '/api/me')[0] == 401)
st, rp, _ = T.req('POST', '/api/t/students', {'action': 'reset_password', 'id': a['id']})
check('Ganti password murid membuat sesi lama keluar', st == 200 and S1.req('GET', '/api/me')[0] == 401)
check('Guru tidak bisa diubah lewat menu murid', T.req('POST', '/api/t/students', {'action': 'delete', 'id': me['id']})[0] == 404)
check('Header keamanan halaman (CSP)', "frame-ancestors 'none'" in (Client().req('GET', '/')[2].get('Content-Security-Policy') or ''))

fails = 0
for ok, name, d in results:
    print(('LULUS ' if ok else 'GAGAL ') + name + ('' if ok else f'  → {str(d)[:200]}')); fails += (not ok)
print(f'\n{len(results) - fails}/{len(results)} lulus')
sys.exit(1 if fails else 0)
