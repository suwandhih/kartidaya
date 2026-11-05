# Rencana Kerja — Aplikasi Kelola Surat & Email Donor (Kartidaya)

> Dokumen ini adalah rencana kerja sebelum pembuatan aplikasi.
> Sumber data: **`data.xlsx`** (sheet `Utama` + `Detail`).
> `data excel.jpeg` **tidak dipakai** karena banyak data ganda dan penempatan tidak konsisten.

---

## 1. Tujuan Aplikasi

Aplikasi demo berbasis **HTML + CSS + JS** (tanpa build, tanpa framework) untuk:

1. **Menyimpan data donor** (form isi seperti di Excel).
2. **Mengelola kategori** donor (5 kategori awal, bisa ditambah).
3. **Membuat & mengirim surat/email** ke banyak penerima sekaligus memakai template.
4. **Buku terima & kirim per donor** — setiap ID punya buku sendiri berisi surat
   keluar dan masuk, mirip Outlook tetapi disesuaikan kebutuhan perusahaan.
5. **Kirim & terima email sungguhan** lewat akun `@gmail.com` (Gmail API + OAuth).

Target jalan: **HP Android** dan **PC** (Chrome/Edge/Firefox).
Penyimpanan data: **localStorage** browser (demo, tanpa database).

### Dua mode operasi

| Mode | Syarat | Kemampuan |
|---|---|---|
| **Simulasi** | Tidak ada | Surat dicatat sebagai *Terkirim* di buku donor; surat masuk dicatat manual |
| **Gmail aktif** | Client ID + login Google | Kirim email sungguhan; tarik surat masuk dari inbox Gmail |

Mode simulasi membuat aplikasi **langsung bisa didemokan** tanpa menyiapkan apa pun.

---

## 2. Data yang Sudah Ada (`data.xlsx`)

### Sheet `Utama` — 18 baris data, 7 kolom

| Kolom | Isi |
|---|---|
| ID-DONOR | `L00024R`, `I00017U`, `G00009R`, … |
| KATEGORI | Member Support, Church Local, Indvidual - Local, Organization |
| PIC | Linda Lau, Kamlesh, Rany, … (bisa kosong) |
| INSTANSI | International English, GKKK Permatry, … (bisa kosong) |
| email | lindalau_T1@yahoo.co.id, … |
| HP 1 | 0896-8888-1899, … |
| HP 2 | 0819-3140-7040, … (hanya 1 baris terisi) |

### Sheet `Detail` — 5 baris, 3 kolom
`ID Donor | Email | HP` — hanya 2 baris terisi, dan isinya **duplikat** dari sheet `Utama`
(contoh: `Lindalau_T1@yahoo.co.id` vs `lindalau_T1@yahoo.co.id`, `volta@iesjakarta` vs `volta@iesjakarta.org`).

**Keputusan:** sheet `Detail` **tidak dipakai** sebagai sumber data. Cukup `Utama`.
Sheet `Detail` hanya berguna sebagai catatan bahwa pernah ada input email/HP terpisah.

### Kolom lengkap dari file Excel asli (terlihat di `_hdr*.png`)

`ID Donor | Kategori Donor | PIC | Nama Lengkap | Nama Instansi | Email | No HP | Date Start | Asal Gereja | Alamat Lengkap | Tgl Lahir | Pengiriman melalui POS/WA/…`

Kolom di atas dipakai sebagai **daftar field form**, tetapi hanya kolom yang ada di `data.xlsx`
yang diisi data awal. Sisanya kosong dan siap diisi user.

---

## 3. Kategori

Dari filter Excel (`Kategori.jpeg`) ditemukan: `Church - Local`, `Church Local`,
`Funder - Foreign`, `Individual - Local`, `Member Support`, `Organization`, `(Blanks)`.

`Church - Local` dan `Church Local` adalah **duplikat penulisan** → digabung.

**5 kategori awal (final):**

1. `Member Support`
2. `Church Local`
3. `Individual - Local`
4. `Funder - Foreign`
5. `Organization`

Kategori disimpan di localStorage sebagai **daftar terpisah** sehingga user bisa
**tambah / ubah nama / hapus** tanpa mengubah kode.

---

## 4. Aturan ID-DONOR

Format: **`[X]99999[Z]`**

| Bagian | Aturan |
|---|---|
| `[X]` | 1 huruf. Ambil **huruf pertama INSTANSI** (kapital). Jika instansi kosong → ambil **huruf pertama PIC**. Jika keduanya kosong → `X`. |
| `99999` | **Counter 5 digit** (zero-padded). Counter dihitung **per huruf X**. Nilai baru = counter tertinggi yang sudah ada untuk huruf itu **+ 1**. |
| `[Z]` | 1 huruf **suffix**. Artinya belum diketahui pasti (di data lama muncul `R` dan `U`). **User bisa isi manual**; default `R`. |

Contoh dari data lama:

| ID | PIC | Instansi | X dari | Counter |
|---|---|---|---|---|
| `L00024R` | Linda Lau | — | **L**inda | 24 |
| `I00017U` | Kamlesh | International English | **I**nternational | 17 |
| `G00009R` | Rany | GKKK Permatry | **G**KKK | 9 |
| `Y00002R` | Setiyani | Yay Misi Parousia | **Y**ay | 2 |
| `H00030R` | — | Hope Special Need | **H**ope | 30 |

Catatan: data lama tidak konsisten (`P0003U` hanya 4 digit). Aplikasi akan
**menormalkan ke 5 digit** (`P00003U`) untuk data baru.

---

## 5. Field Form Isi Data

### Wajib
- `Kategori` (dropdown dari daftar kategori)
- `PIC` **atau** `Instansi` (minimal salah satu terisi)
- `Email`

### Opsional
- `Panggilan` — **field baru**: `Ibu` / `Bapak` / `Saudara` / `Saudari`
- `Nama Lengkap`
- `Instansi` (boleh kosong)
- `HP 1`, `HP 2`
- `Date Start`, `Asal Gereja`, `Alamat Lengkap`, `Tgl Lahir`
- `Pengiriman melalui` — `Email` / `WA` / `POS` / `Lainnya`
- `Catatan`

### Otomatis
- `ID-DONOR` — dibuat otomatis, tapi bisa **di-override manual** (tombol "Ubah ID").

---

## 6. Template Surat & Placeholder

User menulis isi surat di editor, lalu menyisipkan token. Sistem mengganti token
**per penerima** saat pratinjau/kirim.

| Token | Hasil |
|---|---|
| `{/PIC}` | Panggilan + nama PIC → `Ibu Linda Lau` |
| `{/PANGGILAN}` | `Ibu` / `Bapak` / `Saudara` / `Saudari` |
| `{/NAMA}` | Nama PIC tanpa panggilan → `Linda Lau` |
| `{/INST}` | Nama instansi → `GKKK Permatry` |
| `{/NAMA_LENGKAP}` | Nama lengkap |
| `{/ID}` | ID-DONOR |
| `{/KATEGORI}` | Kategori donor |
| `{/EMAIL}` | Email penerima |
| `{/HP}` | HP 1 |
| `{/TANGGAL}` | Tanggal hari ini (format Indonesia) |

Contoh:

```
Kepada Yth.
{/PIC}
{/INST}

Dengan hormat,
...
```

Hasil untuk Linda Lau:

```
Kepada Yth.
Ibu Linda Lau

Dengan hormat,
...
```

Fitur pendukung:
- **Tombol token** untuk menyisipkan token ke posisi kursor.
- **Pratinjau per penerima** (pilih donor → lihat hasil jadi).
- **Pilih banyak penerima** (checkbox) → kirim sekaligus.
- **Simpan template** (tambah/ubah/hapus) di localStorage.
- **Kirim**:
  - Gmail aktif → dikirim sungguhan lewat Gmail API, tercatat `Terkirim`.
  - Mode simulasi → hanya dicatat `Terkirim` di buku donor.
  - Bisa juga disimpan sebagai `Draft`.
- **Cetak** surat per penerima (`window.print()`).

---

## 7. Buku Terima & Kirim per Donor

**Inti aplikasi.** Setiap ID donor punya **buku sendiri** — daftar surat keluar dan
masuk yang tercampur urut waktu, seperti percakapan di Outlook.

### Field satu surat

| Field | Isi |
|---|---|
| `arah` | `keluar` (terkirim) / `masuk` (terima) |
| `tanggal` | waktu kirim/terima (ISO) |
| `subjek` | judul surat (sudah disubstitusi token) |
| `isi` | isi surat lengkap |
| `status` | Keluar: `Draft` / `Terkirim` / `Gagal` · Masuk: `Belum dibaca` / `Dibaca` / `Dibalas` |
| `from` / `to` / `cc` | alamat email |
| `gmailId` / `threadId` | ID dari Gmail (untuk cegah duplikat saat sinkron) |
| `lampiran` | nama file (catatan) |
| `catatan` | keterangan tambahan |
| `dibaca` | boolean, untuk penanda belum dibaca |

### Arti status surat masuk

| Status | Arti | Kapan berubah |
|---|---|---|
| **Belum dibaca** | Email baru, belum pernah dibuka | Otomatis saat surat ditarik dari Gmail |
| **Dibaca** | Email sudah dibuka | Otomatis saat surat dibuka, atau disetel manual |
| **Dibalas** | Sudah dikirimi balasan | Otomatis setelah balasan terkirim, atau disetel manual |

Status bisa diubah manual lewat dropdown **Status surat** di dalam modal surat
masuk. Menyetel ke *Belum dibaca* membuat surat itu dihitung lagi di badge
**Belum Dibaca**.

### Tampilan

- **Buku donor** — klik kartu donor → semua suratnya urut waktu, bubble kiri (masuk)
  dan kanan (keluar). Tombol: *Tulis ke Donor*, *Catat Surat Masuk*, *Ubah Data*.
- **Kotak Masuk** (global) — semua surat masuk dari seluruh donor, bisa dicari &
  difilter status/donor. Surat belum dibaca ditandai garis aksen + badge di navigasi.
- **Kotak Keluar** (global) — semua surat keluar.
- **Belum Dikenal** — surat masuk dari alamat yang tidak cocok dengan donor mana pun.
  Bisa **ditautkan** ke donor; email pengirim sekaligus bisa disimpan ke data donor.
- **Kartu donor** menampilkan ringkasan `↑n ↓n` (jumlah keluar/masuk) dan aktivitas terakhir.

### Sinkron Gmail

```mermaid
flowchart TD
    A[Klik Sinkron Gmail] --> B[Ambil daftar pesan dari Gmail API]
    B --> C{Sudah pernah ditarik?}
    C -->|Ya| D[Lewati]
    C -->|Tidak| E[Ambil isi lengkap pesan]
    E --> F[Ambil alamat pengirim]
    F --> G{Ada donor dengan email itu?}
    G -->|Ya| H[Masuk ke buku donor tersebut]
    G -->|Tidak| I[Masuk sebagai Belum Dikenal]
    I --> J[Buka surat → Tautkan ke Donor]
```

Pencocokan memakai **alamat email** (case-insensitive). Surat yang sudah pernah
ditarik dikenali dari `gmailId` sehingga tidak dobel.

---

## 8. Struktur Halaman (UI)

Aplikasi satu halaman dengan navigasi bawah (mobile) / samping (desktop):

1. **Beranda** — total donor, belum dibaca, surat keluar, status Gmail, kotak masuk
   terbaru, donor per kategori, aktivitas terbaru, aksi cepat.
2. **Masuk** — kotak masuk global (cari, filter status, filter donor, sinkron).
3. **Keluar** — kotak keluar global.
4. **Donor** — daftar + cari + filter kategori + urut; tombol `+ Tambah`.
5. **Buku Donor** — buku terima & kirim satu donor (dibuka dari kartu donor).
6. **Tulis** — template, token, penerima (multi-pilih), pratinjau, kirim/draft/cetak.
7. **Kategori** — kelola kategori.
8. **Setelan** — Gmail (Client ID, hubungkan, sinkron, putuskan), tanda tangan,
   tema, ekspor/impor JSON, ekspor CSV, muat data contoh, reset, uji generator ID.

---

## 9. Desain UI

Referensi: kategori **minimal** di [awwwards.com](https://www.awwwards.com/websites/minimal/).
Situs yang dipelajari: `concretaceramiche.it`, `nader.io`, `billcreates.tech`, `fastsocial.co`.

Prinsip (sesuai permintaan: **jangan terlalu banyak main warna**):

- **1 warna aksen saja**, sisanya netral.
- Banyak ruang kosong, garis tipis, sudut kecil (radius 8–10px).
- Tipografi sebagai pembawa karakter, bukan warna.
- Angka/ID memakai **monospace** agar rapi sejajar.

### Palet

| Peran | Nilai |
|---|---|
| Latar | `#f5f5f0` (off-white) |
| Permukaan / kartu | `#ffffff` |
| Teks utama | `#161616` |
| Teks sekunder | `#6b6b6b` |
| Garis | `#e3e3dc` |
| **Aksen (tunggal)** | `#1f6f5c` (hijau tua kalem) |
| Aksen lembut | `#e8f0ed` |
| Bahaya | `#a33a2c` (hanya untuk hapus/gagal) |

Mode gelap: latar `#111312`, permukaan `#191c1b`, teks `#eeeedc`, aksen tetap `#55d1c5`.

### Tipografi

- UI: system font stack (`-apple-system, Segoe UI, Roboto, …`) — **tanpa internet**, aman di Android.
- ID / angka / token: `ui-monospace, "IBM Plex Mono", Consolas, monospace`.

### Responsif

- Mobile-first. Navigasi bawah (bottom bar) di layar < 860px, sidebar di layar besar.
- Tabel donor berubah jadi kartu di layar kecil.
- Target sentuh minimal 44px.
- Grid memakai `minmax(min(230px,100%),1fr)` + `.grid > *{min-width:0}` agar tidak
  ada overflow horizontal di layar sempit (diuji 320–1440px).

---

## 10. Teknis

| Aspek | Keputusan |
|---|---|
| File | **Multi-file**: `index.html` + `app.css` + `app.js` + `gmail.js` |
| Penyimpanan | `localStorage` (key: `kartidaya.v2.*`) |
| Data awal | 18 donor dari `data.xlsx` di-embed sebagai seed |
| Framework | Tanpa framework (vanilla JS) |
| Hosting | **GitHub Pages** (`https://suwandhih.github.io/kartidaya/`) |
| Server lokal | **`serve.bat`** → `serve.py` (Python `http.server`, port 8080) |
| Ekspor | JSON (backup/restore) + CSV (buka di Excel) |
| Cetak | `window.print()` untuk cetak surat |
| Email | **Gmail API + OAuth 2.0** (Google Identity Services, alur token) |

### Kenapa perlu origin https / localhost?

Google **menolak** origin `file://` untuk OAuth. Origin yang diterima:

- `https://` apa pun — termasuk GitHub Pages
- `http://localhost` / `http://127.0.0.1`

Karena itu aplikasi di-host di GitHub Pages (juga bisa dibuka dari HP Android
tanpa PC menyala), dan `serve.bat` disediakan untuk pemakaian lokal.

### Kenapa multi-file?

`gmail.js` dipisah karena berisi integrasi pihak ketiga (Google) yang berdiri
sendiri; `app.css` dipisah agar gaya mudah ditinjau tanpa membaca logika.

### Scope OAuth

```
https://www.googleapis.com/auth/gmail.send
https://www.googleapis.com/auth/gmail.readonly
https://www.googleapis.com/auth/userinfo.email
```

Alur **token** (bukan authorization code) dipilih karena **tidak butuh Client
Secret** — aman untuk aplikasi yang seluruhnya jalan di browser.

### Kunci localStorage
- `kartidaya.v2.donors`
- `kartidaya.v2.categories`
- `kartidaya.v2.templates`
- `kartidaya.v2.messages`
- `kartidaya.v2.settings`

---

## 11. Urutan Pengerjaan

**Fase 1 — Aplikasi inti**
- [x] Baca & verifikasi `data.xlsx`
- [x] Kumpulkan referensi desain (Awwwards minimal)
- [x] Tulis `rencanakerja.md` (dokumen ini)
- [x] Struktur + CSS (palet & tipografi)
- [x] Data layer: seed 18 donor, kategori, localStorage
- [x] Halaman Donor: daftar, cari, filter, tambah/ubah/hapus
- [x] Generator ID-DONOR `[X]99999[Z]`
- [x] Halaman Kategori (tambah/ubah/hapus)
- [x] Halaman Tulis Surat: template, token, pratinjau, kirim massal
- [x] Beranda (dashboard)
- [x] Setelan: ekspor/impor JSON, ekspor CSV, reset
- [x] Uji di layar HP (320–414px) & PC (768–1440px)

**Fase 2 — Buku terima & kirim + Gmail**
- [x] Pisah jadi `index.html` + `app.css` + `app.js` + `gmail.js`
- [x] `serve.py` + `serve.bat` (server lokal, threaded, LAN)
- [x] `gmail.js`: OAuth, kirim, daftar pesan, ambil pesan, urai MIME
- [x] Model data `messages` (satu buku per donor)
- [x] Halaman **Buku Donor** (bubble masuk/keluar)
- [x] Halaman **Kotak Masuk** & **Kotak Keluar** global
- [x] **Catat Surat Masuk** manual (mode simulasi)
- [x] **Tautkan surat tak dikenal** ke donor
- [x] **Sinkron Gmail** + pencocokan otomatis lewat email
- [x] Setelan Gmail: Client ID, hubungkan, sinkron, putuskan
- [x] `PANDUAN-GMAIL.md` (panduan Google Cloud Console langkah demi langkah)
- [x] Uji: kirim simulasi, catat masuk, tautkan, ekspor, tema, responsif

**Fase 3 — Publikasi**
- [x] `.gitignore` — `data.xlsx` & screenshot data tidak ikut ter-commit
- [x] `README.md`
- [x] Repo publik `suwandhih/kartidaya`
- [x] **GitHub Pages** aktif di `https://suwandhih.github.io/kartidaya/`
- [x] Dukung origin `https://` untuk OAuth (bukan hanya localhost)
- [x] Halaman Setelan menampilkan origin yang perlu didaftarkan

---

## 12. Hal yang Masih Perlu Dikonfirmasi

1. **Arti huruf terakhir `[Z]`** pada ID-DONOR (`R` / `U`). Sementara: bisa diisi manual, default `R`.
2. Apakah **counter** ID dihitung per huruf (keputusan saat ini) atau global.
3. Apakah perlu **login / multi-user** (saat ini tidak, karena demo tanpa server).
4. **Alamat Gmail** yang akan dipakai — **`fotohotono03@gmail.com`** (ditetapkan
   5 Nov 2026). Alamat ini harus didaftarkan di **Test users**.
5. Apakah perlu **lampiran file** sungguhan (saat ini hanya catatan nama file).
6. Apakah perlu **balas semua / teruskan** (belum dibuat; saat ini hanya *Balas*).
7. Apakah perlu **template HTML** (berformat tebal/miring), bukan teks biasa.
8. **Data donor di `app.js`** — 18 nama/email/HP asli ikut ter-publish di repo
   publik. User menyetujui karena aplikasi hanya dipakai sementara di GitHub;
   nanti akan dipindah ke hosting sendiri. Kalau perlu, pindahkan ke `seed.js`
   yang di-gitignore.

---

## 13. Status Terakhir & Langkah Berikutnya

*Diperbarui: 5 November 2026, 14:45 WIB*

### Akar masalah `access_denied` — SUDAH DITEMUKAN & DIPERBAIKI

Penyebab sebenarnya **bukan** Test users. Client ID lama
(`205859365311-…`) milik **project Google Cloud lain** yang tidak bisa diakses
akun `suwandhih@gmail.com`:

| | |
|---|---|
| Client ID lama | `205859365311-…` → project **205859365311** |
| Akses akun ini | ❌ *"You need additional access to the project: 205859365311"* |
| Project `Kartidaya` milik user | `kartidaya-513714` → nomor **531116872278** |
| Kondisi project itu | ❌ *"Google Auth Platform not configured yet"* — belum ada OAuth client |

Jadi Test user selama ini ditambahkan di project yang **tidak memiliki OAuth
client**, sehingga tidak berpengaruh sama sekali.

### Yang sudah dikerjakan 5 Nov 2026 (lewat Cloud Console)

Semua di project **`kartidaya-513714`**:

- [x] Konfigurasi Google Auth Platform dibuat (App name `Kartidaya`,
      tipe **External**)
- [x] **OAuth Client ID baru** dibuat — `Kartidaya Web`, tipe *Web application*
- [x] Authorized JavaScript origin: `https://suwandhih.github.io`
- [x] **Gmail API diaktifkan**
- [x] **Data Access**: `gmail.send` (sensitive) + `gmail.readonly` (restricted)
      → *"Data access changes saved!"*
- [x] **Test users**: `fotohotono03@gmail.com` ditambahkan → **Save**
- [x] **Developer contact** diubah jadi **hanya `fotohotono03@gmail.com`**
      (`suwandhih@gmail.com` dihapus) → *"Branding changes saved!"*
- [x] **IAM**: `fotohotono03@gmail.com` diberi role **OAuth Config Editor**
      agar bisa membuka project ini sendiri
- [x] Client ID baru dipasang di halaman Setelan aplikasi
- [x] Diverifikasi: alur GIS Google menerima Client ID + origin baru
      (redirect ke halaman login, bukan `invalid_client` / `origin_mismatch`)

> **Kebijakan email:** `suwandhih@gmail.com` adalah email pribadi dan
> **tidak boleh dipakai** untuk aplikasi ini. Semua konfigurasi yang bisa
> diubah sudah dipindah ke `fotohotono03@gmail.com`.
>
> Satu pengecualian yang **tidak bisa** diubah: field **User support email**
> di halaman Branding hanya menerima akun yang sedang login di browser.
> Karena project ini dibuat dari akun `suwandhih@gmail.com`, field itu masih
> menampilkan email tersebut. Ini hanya alamat kontak yang tampil di layar
> izin Google — **tidak memengaruhi pengiriman email**, dan tidak dipakai
> aplikasi sama sekali. Untuk menggantinya sepenuhnya, project harus dibuat
> ulang dari akun `fotohotono03@gmail.com`.

**Client ID yang dipakai sekarang:**

```
531116872278-hep5meju0djk30qrsee5ec4np2t895qo.apps.googleusercontent.com
```

> Client secret `GOCSPX-…` **tidak dipakai** aplikasi ini (alur token GIS).
> Jangan pernah menaruhnya di kode.

### Perbaikan lanjutan — Client ID lama masih terpakai

Setelah konfigurasi Google selesai, error `access_denied` **masih muncul**.
Penyebabnya: browser masih menyimpan **Client ID lama** (`205859365311-…`) di
`localStorage`, dan `app.js` juga masih tersimpan di cache browser.

Perbaikan yang ditambahkan:

- [x] `DEFAULT_CLIENT_ID` — Client ID project Kartidaya dipakai sebagai nilai awal
- [x] **Migrasi otomatis** — Client ID berawalan `205859365311-` diganti otomatis
      saat aplikasi dimuat
- [x] Halaman Setelan menampilkan **Client ID yang benar-benar dipakai**
- [x] Tombol **Pakai Client ID bawaan** untuk reset manual
- [x] Peringatan di Setelan kalau Client ID bukan milik project Kartidaya
- [x] **Cache-busting** `app.js?v=3` & `gmail.js?v=3` di `index.html`

Diverifikasi: dengan `localStorage` sengaja diisi Client ID lama, aplikasi
otomatis menggantinya ke Client ID project Kartidaya saat dimuat.

### Yang belum selesai

| # | Tugas | Keterangan |
|---|---|---|
| 1 | Uji **kirim email sungguhan** | Belum pernah |
### Hubungkan Gmail — BERHASIL (5 Nov 2026, 15:28 WIB)

`fotohotono03@gmail.com` **sudah berhasil terhubung**. Akar masalahnya ada dua,
keduanya sudah diperbaiki:

1. Client ID lama milik project lain → diganti Client ID project `kartidaya-513714`
2. Browser masih memakai `app.js` dari cache + Client ID lama di localStorage
   → ditambah migrasi otomatis dan cache-busting

Perbaikan tambahan setelah terhubung:

- [x] Header `From` diperkuat — kalau profil Gmail belum terbaca, header
      dihilangkan dan Gmail mengisi sendiri (sebelumnya `From: me` ditolak Gmail)
- [x] `app.js?v=4` & `gmail.js?v=4`

### Terima surat — BERHASIL (5 Nov 2026, 15:51 WIB)

Email dari `suwandhih@gmail.com` **berhasil masuk** ke buku donor
**Ferry Kangsadjaja** (`F00004R`).

Kendala yang ditemukan & diperbaiki:

- Surat sudah ditarik sebagai **Belum Dikenal** karena email donor Ferry masih
  `ferryk@indo.net.id` (data awal Excel), bukan `suwandhih@gmail.com`
- **Bug:** surat yang sudah masuk sebagai Belum Dikenal **tidak pernah** pindah
  ke buku donor walau email donornya kemudian diisi
- **Perbaikan:** Sinkron Gmail otomatis mencocokkan ulang, plus tombol
  **⇄ Cocokkan ulang** di Kotak Masuk (`app.js?v=5`)

Diverifikasi: setelah email donor diisi, klik **Cocokkan ulang** → surat pindah
ke buku Ferry, counter jadi **↓1 masuk**.

### Status surat masuk bisa diubah — SELESAI (5 Nov 2026)

**Masalah yang dilaporkan:** status surat masuk tidak bisa diubah — tidak ada
tempat untuk mengubahnya setelah surat tersimpan.

**Akar masalah:** status hanya bisa disetel saat surat **dibuat** (Catat Surat
Masuk, atau otomatis oleh Sinkron Gmail). Di modal surat, status hanya tampil
sebagai chip read-only. Selain itu, membuka surat hanya mengubah flag `dibaca`
tetapi **tidak** menaikkan `status` dari *Belum dibaca* ke *Dibaca*, sehingga
surat yang sudah dibuka tetap terlihat "Belum dibaca".

**Perbaikan (`app.js?v=7`):**

- [x] Dropdown **Status surat** di modal surat masuk — bisa pilih
      *Belum dibaca* / *Dibaca* / *Dibalas*, langsung tersimpan
- [x] Membuka surat *Belum dibaca* otomatis menaikkan status ke *Dibaca*
- [x] Mengirim balasan otomatis menandai surat masuk terakhir donor itu sebagai
      *Dibalas*
- [x] Chip status diberi warna: hijau = *Belum dibaca*, abu-abu = *Dibaca* /
      *Dibalas*, merah = *Gagal*
- [x] Menyetel ke *Belum dibaca* ikut memperbarui badge **Belum Dibaca** di menu

Diverifikasi di browser: buka surat → status naik ke *Dibaca*; ganti ke
*Dibalas* → tersimpan; ganti ke *Belum dibaca* → badge naik; kirim balasan →
surat masuk jadi *Dibalas*.

### Kirim surat tercatat "Terkirim" tapi email tidak sampai — SELESAI (5 Nov 2026)

**Masalah yang dilaporkan:** surat untuk Ferry Kangsadjaja ditandai `00005` dan
dikirim, tetapi emailnya tidak pernah sampai.

**Akar masalah:** Gmail **belum terhubung** saat surat dikirim. Aplikasi
diam-diam beralih ke **mode simulasi** — surat hanya dicatat `Terkirim` di buku
donor, emailnya tidak pernah dikirim. Bukti dari data pengguna:

| Surat | `status` | `gmailId` | Artinya |
|---|---|---|---|
| Terima kasih — Ferry Kangsadjaja (09:24) | `Terkirim` | *(kosong)* | tidak dikirim |
| Terima kasih — Ferry Kangsadjaja (09:26) | `Terkirim` | *(kosong)* | tidak dikirim |

`gmailId` kosong = Gmail API tidak pernah dipanggil.

**Dua penyebab Gmail "belum terhubung":**

1. **Token tidak disimpan.** Token hanya ada di memori (`Gmail.token`), jadi
   setiap halaman dimuat ulang koneksi hilang. Pengguna menghubungkan Gmail,
   lalu refresh / pindah halaman → kembali ke mode simulasi tanpa sadar.
2. **Mode simulasi tidak pernah dikonfirmasi.** `kirimSurat()` langsung
   mencatat `Terkirim` tanpa memberi tahu bahwa email tidak dikirim.

**Perbaikan (`app.js?v=8` & `gmail.js?v=8`):**

- [x] Token Gmail disimpan di `sessionStorage` (`kartidaya.gmail.session`) dan
      dipulihkan otomatis saat halaman dimuat — refresh tidak lagi memutus
      koneksi. Dipilih `sessionStorage` (bukan `localStorage`) supaya token
      hilang saat tab ditutup.
- [x] Token kedaluwarsa / `401` / *Putuskan* otomatis menghapus sesi tersimpan
- [x] `kirimSurat()` menampilkan **konfirmasi** kalau Gmail belum terhubung —
      pengguna diberi tahu email tidak akan terkirim dan bisa membatalkan
- [x] Donor tanpa email saat Gmail aktif → status `Gagal` dengan pesan jelas
      (sebelumnya ikut dicatat `Terkirim`)

Diverifikasi di browser: token dipulihkan dari `sessionStorage`; token
kedaluwarsa tidak dipulihkan; *Putuskan* membersihkan sesi; kirim tanpa Gmail
menampilkan konfirmasi dan tidak mencatat apa pun bila dibatalkan; donor tanpa
email menghasilkan status `Gagal`.

### Cara menguji kirim

**Kirim (Tes 3):**

1. Menu **Donor** → **+ Tambah** → buat donor uji dengan email
   `fotohotono03@gmail.com` (kirim ke diri sendiri paling aman)
2. Menu **Tulis** → centang donor uji itu → **➤ Kirim**
3. Pesan sukses harus menyebut *"terkirim lewat Gmail"* (bukan *mode simulasi*)
4. Cek <https://mail.google.com> → **Sent** dan **Inbox**
5. Kalau status jadi **Gagal**, buka suratnya — pesan error Gmail ada di situ

**Terima (Tes 4) — sudah lolos:**

1. Kirim email **ke** `fotohotono03@gmail.com` dari akun lain
2. Menu **Masuk** → **⟳ Sinkron Gmail**
3. Surat muncul; cocok email donor → masuk buku donor, tidak cocok →
   **Belum Dikenal**
4. Klik Sinkron sekali lagi → jumlah **tidak bertambah** (anti-duplikat)

### Cara melanjutkan

1. Buka <https://suwandhih.github.io/kartidaya/> → **Setelan**
2. Pastikan baris *"Client ID yang benar-benar dipakai saat ini"* menampilkan
   `531116872278-…`. Kalau masih `205859365311-…`, klik
   **Pakai Client ID bawaan** (atau tekan `Ctrl+Shift+R` untuk buang cache)
3. Klik **Hubungkan Gmail**, lalu login dengan **`fotohotono03@gmail.com`**
4. Bila muncul *"Google hasn't verified this app"* → **Advanced** →
   **Go to Kartidaya (unsafe)** — normal untuk aplikasi Testing sendiri
5. Setelah status **Terhubung**: uji kirim email, lalu **⟳ Sinkron sekarang**
6. Cadangan lokal kalau perlu: `serve.bat` → <http://localhost:8080>

> Catatan: langkah login **tidak bisa** diotomasi — Google memblokir popup
> otomatis dan butuh kredensial akun. Sisanya sudah beres.

### Catatan penting

- **Client Secret tidak dipakai** aplikasi ini. Alur token Google Identity
  Services tidak memerlukan secret. Kalau secret pernah terlihat di screenshot,
  boleh di-reset — tidak akan memengaruhi aplikasi.
- **Token kedaluwarsa**: access token 1 jam, refresh token 7 hari (karena status
  masih *Testing*). Kalau muncul *"Sesi Gmail kedaluwarsa"*, klik
  **Hubungkan Gmail** lagi.
- **Data donor ada di `app.js`** (`SEED_DONORS`) dan ikut ter-publish. Lihat
  bagian 12 no. 8.
