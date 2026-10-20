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
check('Pilihan tebak: 4 opsi tanpa kunci jawaban', st == 200 and len(opts) == 4 and all(set(o) == {'t', 'h', 'p', 'm'} for o in opts), opts)
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
                   ('/api/t/card', {'deck_id': 'buah', 'h': '假', 'm': 'palsu'}), ('/api/t/card/delete', {'id': 'buah:苹果'}),
                   ('/api/t/deck/delete', {'id': 'buah'}), ('/api/password', {'old': 'x', 'new': 'yyyyyyyyyyyy'})]:
    check(f'Murid tidak bisa {path}', S1.req('POST', path, body)[0] == 403)
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
check('Guru tambah kartu', T.req('POST', '/api/t/card', {'deck_id': 'buah', 'h': '榴莲糖', 'm': 'permen durian', 'mw': '颗', 'pic': '🍬'})[0] == 200)
check('Gambar berbahaya di kartu ditolak', T.req('POST', '/api/t/card', {'deck_id': 'buah', 'h': '坏', 'm': 'x', 'pic': 'javascript:alert(1)'})[0] == 400)
png = bytes.fromhex('89504e470d0a1a0a0000000d4948445200000001000000010806000000') + b'\0' * 40
st, up, _ = T.req('POST', '/api/t/image', raw=png, ctype='image/png'); check('Guru unggah foto', st == 200 and up['url'].startswith('/api/img/'))
check('File bukan gambar ditolak', T.req('POST', '/api/t/image', raw=b'<script>alert(1)</script>' * 3, ctype='image/png')[0] == 415)
st, _, h = S1.req('GET', up['url']); check('Foto dilayani dengan nosniff', st == 200 and h.get('X-Content-Type-Options') == 'nosniff')
check('Foto tak bisa dibuka tanpa login', X.req('GET', up['url'])[0] == 401)
check('Guru hapus kartu bawaan', T.req('POST', '/api/t/card/delete', {'id': 'buah:梨'})[0] == 200)
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
