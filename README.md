# Flashcard Alvaro — panduan pasang (Cloudflare, gratis)

Web app flashcard Mandarin untuk Alvaro Education Centre:
- Akun murid dibuat guru, lalu muncul sapaan "Halo, nama murid!".
- Skor dihitung oleh server.
- Ada grafik waktu belajar.
- Kartu bisa ditambah langsung oleh guru.

**Butuh:** akun **GitHub** dan **Cloudflare** (gratis, tanpa kartu kredit). Waktu ± 15 menit. Tidak perlu menulis SQL sama sekali.

---

## 1. Buat akun Cloudflare
Daftar di **dash.cloudflare.com** (gratis).

## 2. Buat database D1
1. Menu kiri: **Storage & Databases → D1 SQL Database → Create**.
2. Nama: `alvaro-flashcard`. Lokasi bebas (pilih *Asia-Pacific* bila ada). Klik **Create**.

Tabel dan 568 kartu bawaan akan dibuat otomatis saat app pertama kali dibuka.

## 3. Unggah kode ke GitHub
1. GitHub → *New repository* → nama `alvaro-flashcard` → **Private** → *Create*.
2. Klik *uploading an existing file*, seret **semua isi** folder ini, lalu *Commit changes*.
   (Kalau repo versi Supabase sebelumnya sudah ada, hapus repo itu atau buat repo baru.)

## 4. Buat proyek Pages
1. Menu kiri: **Workers & Pages → Create**. Pilih tab **Pages**, lalu **Connect to Git**.
2. Hubungkan GitHub, pilih repo `alvaro-flashcard` → **Begin setup**.
3. Isi pengaturan build:
   - Framework preset: **None**
   - Build command: `npm run build`
   - Build output directory: `dist`
4. Klik **Save and Deploy**. Build pertama akan berhasil, tapi app belum tersambung ke database. Itu wajar, lanjut ke langkah 5.

## 5. Sambungkan database & kode setup
Buka proyek Pages → **Settings**:
1. **Bindings → Add → D1 database**
   - Variable name: `DB` (huruf besar, persis)
   - D1 database: `alvaro-flashcard`
   - Save
2. **Variables and Secrets → Add**
   - Type: **Secret**
   - Name: `SETUP_CODE`
   - Value: kode rahasia buatanmu, minimal 8 karakter, misalnya `AlvaroSetup!2026`
   - Save
3. Buka **Deployments** → titik tiga pada deployment terakhir → **Retry deployment**. Pengaturan baru hanya berlaku setelah deploy ulang.

## 6. Buat akun guru (sekali saja)
1. Buka alamat web kamu, misalnya `https://alvaro-flashcard.pages.dev`.
2. Muncul halaman **Buat akun guru**. Isi `SETUP_CODE` dari langkah 5, nama, username, dan password guru (minimal 10 karakter).
3. Selesai. Halaman ini tidak akan muncul lagi, dan tidak ada orang lain yang bisa menjadi guru.

## 7. Buat akun murid
**Guru → Murid** → isi nama, username, dan kelas → **Buat akun**. Password muncul sekali. Klik **Salin**, lalu kirim ke murid (misalnya lewat WhatsApp) bersama link web-nya.

---

## Cara memperbarui

| Ingin mengubah | Caranya | Murid dapat perubahan |
|---|---|---|
| Kartu, kategori, pengaturan | Panel **Guru** di app | Langsung (saat membuka app atau kembali ke tab) |
| Tampilan atau fitur app | Ganti file di GitHub (atau minta Claude), Cloudflare otomatis deploy ulang | Otomatis. App yang sedang terbuka menampilkan **"Versi baru aplikasi tersedia → Muat ulang"** |

## Keamanan yang sudah dipasang

Diuji dengan **60 percobaan** di `tests/test_keamanan.py`, dan semuanya lulus.

- **Skor tidak bisa diubah murid.** Murid hanya mengirim jawaban. Server memeriksa tebakan dan menghitung skor sendiri. Tidak ada jalan bagi murid untuk menulis, mengubah, atau menghapus skor.
- **Kunci jawaban tebakan tidak dikirim ke browser.** Pilihan jawaban memakai kode acak sekali pakai.
- **Login aman:**
  - password di-hash (PBKDF2), tidak pernah disimpan apa adanya;
  - sesi memakai cookie *HttpOnly + Secure + SameSite=Strict*, jadi tidak bisa dicuri lewat skrip;
  - akun dikunci 15 menit setelah 5 kali salah password, dan ada batas 30 percobaan per alamat IP;
  - permintaan dari situs lain ditolak (anti-CSRF).
- **Hak akses dicek di server:**
  - murid hanya melihat datanya sendiri;
  - kartu, kategori, pengaturan, dan akun hanya bisa diubah guru;
  - kategori yang disembunyikan guru tidak pernah dikirim ke murid.
- **Akun guru tunggal**, dilindungi `SETUP_CODE`. Pendaftaran umum tidak ada.
- **Mengganti password atau menonaktifkan murid** langsung mengeluarkannya dari semua perangkat.
- **Foto** diperiksa isi filenya (harus benar-benar gambar) dan hanya bisa dilihat oleh pengguna yang sudah login.
- **Header keamanan web:** CSP, HSTS, anti-iframe (`public/_headers`).

**Batas yang perlu diketahui:**
- Nilai 1–4 adalah penilaian diri murid.
- Murid yang paham teknologi secara teori bisa mencocokkan gambar dengan jawaban lewat kode halaman. Untuk ujian penting, tetap awasi.
- Karena batas waktu proses di paket gratis Cloudflare, hashing password memakai 10.000 putaran. Ini aman dipakai bersama penguncian login dan password acak, tapi jauh lebih kuat kalau dinaikkan di paket berbayar (ubah `PBKDF2_ITER`).

## Batas paket gratis Cloudflare
- 100.000 permintaan per hari, 5 GB database, 5 juta baris dibaca per hari. Ini sangat cukup untuk ratusan murid.
- Tidak ada "tidur" otomatis seperti Supabase gratis.

## Untuk pengembang
- `npm run dev` → mode demo tanpa server (guru: `guru` / `guru123`, murid: `budi` / `budi123`).
- Uji dengan server lokal:
  ```
  npm run build
  npx wrangler pages dev dist --d1 DB=alvaro-test --binding SETUP_CODE=rahasia-setup-123
  python3 tests/test_keamanan.py
  ```
- Kode server: `functions/api/[[path]].js`. Kode app: `src/main.js`.
