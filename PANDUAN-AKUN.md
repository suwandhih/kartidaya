# Panduan Akun — Kartidaya

Halaman akun: **https://kartidaya-wa.suwandhih.workers.dev/daftar**

Halaman ini **terpisah** dari aplikasi. Fungsinya hanya membuat dan mengatur
akun, jadi tidak perlu dibuka setiap hari.

---

## 1. Alur singkatnya

```
Belum ada akun
     │  buka halaman akun
     ▼
Buat akun  ──►  otomatis menjadi ADMIN
     │
     │  admin masuk di halaman yang sama
     ▼
Admin membuat akun untuk:
     • User donor     (mengurus data donor & surat)
     • User keuangan  (mengurus kwitansi & keuangan)
     │
     ▼
Setiap user membuka aplikasi, masuk dengan email + password
```

Tidak ada kode undangan, tidak ada langkah tambahan.

---

## 2. Membuat akun admin (sekali saja)

1. Buka **https://kartidaya-wa.suwandhih.workers.dev/daftar**
2. Tampilannya berbunyi *"Belum ada akun. Buat akun pertama — akun ini otomatis
   menjadi admin."*
3. Isi:
   - **Nama lengkap** — nama Anda, dipakai untuk mencatat siapa yang mengubah data
   - **Alamat email** — dipakai untuk masuk
   - **Password** — minimal 8 huruf
   - **Ulangi password** — ketik sekali lagi, harus sama
4. Tekan **Buat akun admin**

Setelah itu halaman langsung berubah menjadi tampilan admin: daftar akun + form
*buat akun baru*.

> Saran password sederhana: tiga kata yang mudah Anda ingat, misalnya
> `kartidaya2026`.

---

## 3. Admin membuat akun untuk user

Di halaman yang sama, di bagian **Buat akun baru**:

1. Isi **Nama lengkap**, **Alamat email**, **Password**, dan **Ulangi password**
2. Pilih **Jenis akun**:

   | Pilihan | Untuk siapa |
   |---|---|
   | **User donor** | mengurus data donor & surat |
   | **User keuangan** | mengurus kwitansi & keuangan |
   | **Admin** | boleh membuat akun juga |

3. Tekan **Buat akun**

Akun baru langsung muncul di daftar. Berikan email & password itu kepada
orangnya — Anda tidak perlu membuatkannya lagi.

**Kalau admin perlu masuk lagi:** buka halaman akun, masukkan email & password
admin di bagian atas, lalu tekan **Masuk**.

---

## 4. Masuk ke aplikasi

1. Buka **https://suwandhih.github.io/kartidaya/**
2. Isi **email** dan **password** yang sudah dibuat
3. Tekan **Masuk**

| Hal | Keterangan |
|---|---|
| **Berlaku 12 jam** | setelah itu perlu masuk lagi |
| **Tidak ada data sebelum masuk** | layar masuk menutup seluruh aplikasi |
| **Tombol Keluar** | di sidebar (PC) dan di **Setelan → Akun saya** |
| **Tidak ada blokir** | salah password boleh langsung coba lagi (fase tes) |

---

## 5. Mematikan akun

Di halaman akun, pada baris akun yang bersangkutan, tekan **Matikan**.
Akun itu tidak bisa masuk lagi dan sesinya langsung diputus. Untuk
mengembalikannya, tekan **Aktifkan**.

Tidak ada tombol hapus — mematikan sudah cukup, dan catatan aktivitasnya
tetap utuh.

---

## 6. Catatan aktivitas ("CCTV")

Di aplikasi, buka menu **Akun** (hanya terlihat untuk admin). Ada dua bagian:

| Bagian | Isi |
|---|---|
| **Akun pengguna** | semua akun, perannya, kapan terakhir masuk, tombol matikan/aktifkan |
| **Catatan aktivitas** | daftar kejadian terakhir: siapa, kapan, apa |

Yang dicatat:

| Aksi | Contoh isi |
|---|---|
| `masuk` / `keluar` | login dan logout aplikasi |
| `tambah` | membuat donor, transaksi keuangan, atau akun |
| `ubah` | mengubah donor (termasuk kalau ID donor diganti) atau transaksi |
| `hapus` | menghapus donor atau transaksi |

Tujuannya: kalau ada data yang berubah dan tidak jelas sebabnya, tinggal buka
menu Akun dan lihat siapa yang melakukannya, kapan, dan data mana.

**Belum ada:** catatan untuk surat yang dikirim (rencana berikutnya).

---

## 7. Kalau lupa password

Belum ada tombol "lupa password". Untuk sementara, admin membuatkan akun baru
dengan email yang sama:

1. Buka halaman akun, masuk sebagai admin
2. Matikan akun lama (tombol **Matikan**)
3. Buat akun baru dengan email yang sama dan password baru

Kalau yang lupa password adalah **admin**, akunnya perlu dibuat ulang lewat
database (minta bantuan pembuat aplikasi). Karena itu simpan password admin di
tempat aman.

---

## 8. Yang sengaja belum dibuat

Ini masih fase tes, jadi dibuat sederhana dulu:

| Belum ada | Akibatnya sekarang |
|---|---|
| Batas percobaan login | password boleh ditebak berkali-kali. Cukup untuk tes |
| Hak akses per peran | `donor` dan `keuangan` sama-sama bisa membuka semua menu |
| "Lupa password" lewat email | harus lewat admin |
| Catatan aktivitas untuk surat | baru donor, keuangan, dan akun |

Kalau nanti aplikasi dipakai dengan data sungguhan, tiga hal pertama itulah
yang perlu dinyalakan lebih dulu.

---

## 9. Berkas terkait

| Berkas | Isinya |
|---|---|
| [`akun.js`](../akun.js) | login, sesi, kelola akun — sisi browser |
| [`worker/index.js`](../worker/index.js) | halaman `/daftar` + endpoint `/akun/*` |
| [`worker/schema.sql`](../worker/schema.sql) | tabel `users`, `sessions`, `aktivitas` |
| [`app.js`](../app.js) | layar masuk, menu Akun, tombol keluar |