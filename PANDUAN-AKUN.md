# Panduan Akun & Login

Aplikasi Kartidaya sekarang memakai **akun per orang** (email + password).
Ada **dua aplikasi** yang bekerja sama:

| Aplikasi | Alamat | Gunanya | Dipakai kapan |
|---|---|---|---|
| **Aplikasi Kartidaya** | `https://suwandhih.github.io/kartidaya/` | kerja sehari-hari: donor, surat, keuangan | setiap hari |
| **Halaman pendaftaran** | `https://kartidaya-wa.suwandhih.workers.dev/daftar` | membuat akun baru | 2–3 kali seumur aplikasi |

Halaman pendaftaran **sengaja dipisah**: kalau pintunya menempel di aplikasi
utama, pintu itu terbuka terus. Dipisah, lalu ditutup = pintunya hilang.

---

## 1. Kenapa dipisah, dan kenapa "ditutup" bukan sekadar halaman dihapus

Menghapus halaman pendaftaran **tidak cukup**. Kalau pintu di server masih
terbuka, siapa pun yang tahu alamatnya tetap bisa membuat akun.

Yang dipakai di sini: pintu pendaftaran hanya terbuka kalau ada **kode
undangan** di database (tabel `invites`).

```
Ada kode undangan  →  /daftar menampilkan formulir
Tidak ada kode     →  /daftar hanya menampilkan "Pendaftaran sedang ditutup"
```

Menutup pintu = menghapus baris kode undangan itu. **Seketika**, tanpa
mengubah kode program dan tanpa deploy ulang.

---

## 2. Membuat akun pertama (admin)

Akun pertama otomatis menjadi **admin**. Urutannya:

```powershell
cd worker

# 1. Pasang tabel akun di database (sekali saja)
npx wrangler d1 execute kartidaya --remote --file=schema.sql

# 2. Buka pintu pendaftaran dengan kode undangan pilihan Anda
npx wrangler d1 execute kartidaya --remote --command "INSERT INTO invites (kode, dibuat, catatan) VALUES ('kartidaya-2026', datetime('now'), 'akun pertama')"
```

3. Buka `https://kartidaya-wa.suwandhih.workers.dev/daftar`
4. Isi: kode undangan, nama, email, password (minimal 8 huruf)
5. Akun pertama otomatis **admin**

**Setelah akun Anda jadi, tutup pintunya:**

```powershell
npx wrangler d1 execute kartidaya --remote --command "DELETE FROM invites"
```

Sekarang `/daftar` hanya menampilkan "Pendaftaran sedang ditutup".

---

## 3. Menambah pengguna kedua

Buka pintunya lagi, buat akunnya, tutup lagi:

```powershell
cd worker
npx wrangler d1 execute kartidaya --remote --command "INSERT INTO invites (kode, dibuat, catatan) VALUES ('tambah-kamlesh', datetime('now'), 'user kedua')"
```

Berikan kode itu ke orangnya, minta dia membuka
`https://kartidaya-wa.suwandhih.workers.dev/daftar` dan membuat akunnya
sendiri — **Anda tidak perlu tahu password-nya**.

Setelah itu:

```powershell
npx wrangler d1 execute kartidaya --remote --command "DELETE FROM invites"
```

> **Cek kapan saja:** di aplikasi → **Setelan** → kartu **Akun saya** →
> tombol **Cek pintu pendaftaran**. Jawabannya "terbuka" atau "tertutup".

---

## 4. Masuk ke aplikasi

1. Buka `https://suwandhih.github.io/kartidaya/`
2. Isi **email** dan **password**
3. Tekan **Masuk**

Yang perlu diketahui:

| Hal | Keterangan |
|---|---|
| **Berlaku 12 jam** | setelah itu perlu masuk lagi. Ini disengaja: kalau komputer ditinggal, data donor tidak terbuka selamanya |
| **Tidak ada data sebelum masuk** | layar masuk menutup seluruh aplikasi. Data donor tidak tampil sekejap pun |
| **Sesi tersimpan di browser** | memuat ulang halaman atau menutup tab tidak memutus sesi |
| **Tombol Keluar** | di sidebar (PC) dan di **Setelan → Akun saya**. Sesi langsung dicabut di server, bukan hanya di browser |

---

## 5. Kalau lupa password

Admin bisa mengganti password siapa pun tanpa password lama. Untuk sementara
(masih fase tes) caranya lewat komputer, bukan lewat halaman:

```powershell
cd worker
npx wrangler d1 execute kartidaya --remote --command "DELETE FROM sessions WHERE email='nama@kartidaya.org'"
```

Lalu minta orang itu membuat akun baru:

1. Buat ulang baris di `users` dengan password baru — cara paling mudah:
   hapus akunnya, buka pintu pendaftaran, minta dia mendaftar lagi dengan
   email yang sama.

```powershell
npx wrangler d1 execute kartidaya --remote --command "DELETE FROM users WHERE email='nama@kartidaya.org'"
```

> Tombol "lupa password" yang mengirim email belum dibuat — itu perlu alamat
> pengirim email tersendiri (§22.x di rencanakerja). Untuk 2–3 user, cara di
> atas sudah cukup.

---

## 6. Password disimpan bagaimana

Password **tidak pernah** disimpan sebagai tulisan biasa.

| Yang disimpan | Isinya |
|---|---|
| `hash` | hasil acakan **PBKDF2-SHA256**, 100.000 putaran, 32 byte |
| `salt` | angka acak 16 byte, berbeda untuk setiap akun |
| `iter` | jumlah putaran (100.000) |

Artinya: kalau database bocor, password **tidak terbaca**. Dua orang yang
memakai password sama tetap menghasilkan hash berbeda, karena salt-nya berbeda.

Konsekuensi yang perlu Anda tahu: password **tidak bisa dikembalikan**. Kalau
hilang, harus diganti (bagian 5), bukan diingat-ingat.

---

## 7. Pengaman yang sudah terpasang

| Pengaman | Wujudnya |
|---|---|
| **Password diacak** | PBKDF2 + salt, lihat bagian 6 |
| **Batas percobaan** | 5 kali salah → email itu diblokir 15 menit. Password yang **benar** pun ditolak selama blokir |
| **Pesan galat seragam** | selalu "Email atau password salah" — tidak memberi tahu mana yang salah |
| **Waktu jawaban seragam** | hash tetap dihitung walau email tidak terdaftar, jadi tidak bisa dipakai menebak email mana yang ada |
| **Token kedaluwarsa** | 12 jam |
| **Token disimpan di server** | bisa dicabut sebelum waktunya (keluar, ganti password, akun dimatikan) |
| **Ganti password = sesi lama mati** | semua sesi akun itu dicabut |
| **Kunci aplikasi tetap wajib** | endpoint akun hanya bisa dipanggil aplikasi yang memegang `APP_KEY` |
| **Pendaftaran butuh kode undangan** | dan bisa ditutup seketika |

---

## 8. Apa yang BELUM dikerjakan (sengaja)

Sesuai arahan §25 rencanakerja — **fase tes, sederhana dulu**:

| Belum ada | Akibatnya | Kapan perlu |
|---|---|---|
| **Token dipakai untuk akses data** | `/data` masih cukup dengan kunci aplikasi. Artinya orang yang punya kunci aplikasi masih bisa membaca semua data tanpa login | saat aplikasi mandiri di perusahaan klien |
| **Hak akses per peran** | `admin` dan `user` saat ini sama-sama bisa mengubah semua data. Peran hanya tercatat, belum membatasi | kalau ada staf yang hanya boleh melihat |
| **Halaman kelola pengguna** | menambah/menonaktifkan akun masih lewat perintah di komputer | kalau sudah lebih dari 3 user |
| **"Lupa password" lewat email** | belum ada, lihat bagian 5 | saat dipakai banyak orang |
| **Verifikasi OAuth Google** | Gmail masih dibatasi 100 test user & token 7 hari | saat mandiri |

Semua ini tercatat di [rencanakerja.md](rencanakerja.md) bagian 20.

---

## 9. Ringkasan berkas

| Berkas | Isinya |
|---|---|
| [`akun.js`](../akun.js) | login, sesi, ganti password — sisi browser |
| [`worker/index.js`](../worker/index.js) | endpoint `/akun/*` + halaman `/daftar` |
| [`worker/schema.sql`](../worker/schema.sql) | tabel `users`, `sessions`, `invites`, `login_acuan` |
| [`app.js`](../app.js) | layar masuk, tombol keluar, kartu **Akun saya** di Setelan |