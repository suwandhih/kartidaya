# Panduan Menghubungkan Gmail ke Aplikasi Kartidaya

Aplikasi ini bisa **kirim dan terima email sungguhan** lewat akun `@gmail.com`.
Supaya bisa, ada 3 hal yang harus disiapkan:

1. **Alamat aplikasi yang aman** — `https://` (GitHub Pages) atau `http://localhost:8080`.
2. **Google Cloud project + OAuth Client ID** — dibuat sekali oleh pemilik akun Gmail.
3. **Hubungkan** di halaman Setelan aplikasi.

> **Penting:** Google **menolak** aplikasi yang dibuka dengan `file:///C:/...`.
> Pakai salah satu:
>
> | Cara | Alamat | Perlu apa |
> |---|---|---|
> | **GitHub Pages** (paling mudah) | `https://suwandhih.github.io/kartidaya/` | tidak ada |
> | **Server lokal** | `http://localhost:8080/index.html` | jalankan `serve.bat` |

---

## Langkah 1 — Buka aplikasi

### Cara A — GitHub Pages (disarankan)

Buka **<https://suwandhih.github.io/kartidaya/>** di browser. Selesai.
Bisa juga dibuka dari HP Android tanpa perlu PC menyala.

### Cara B — Server lokal

1. Buka folder `C:\data\Kartidaya`
2. Dobel-klik **`serve.bat`**
3. Browser otomatis terbuka di `http://localhost:8080/index.html`
4. Biarkan jendela hitam itu **tetap terbuka** selama memakai aplikasi

Kalau muncul pesan *"Python tidak ditemukan"*, install Python 3 dari
<https://www.python.org/downloads/> (centang **Add Python to PATH**), lalu ulangi.

Server lokal juga mendengarkan di alamat LAN, jadi bisa dibuka dari HP Android
yang tersambung ke Wi-Fi yang sama (alamatnya ditampilkan saat `serve.bat` jalan).

> **Data terpisah per alamat.** Data yang diisi di GitHub Pages **tidak** muncul di
> localhost, dan sebaliknya. Untuk memindahkan: **Setelan → Ekspor JSON** di satu
> alamat, lalu **Impor JSON** di alamat lain.

---

## Langkah 2 — Buat OAuth Client ID (sekali saja, ±10 menit)

Semua langkah di bawah dilakukan **oleh pemilik akun Gmail**, di browser yang
sudah login ke akun tersebut.

### 2.1 Buat project

1. Buka <https://console.cloud.google.com/>
2. Setujui syarat layanan bila diminta
3. Klik dropdown project di kiri atas → **New Project**
4. Nama: `Kartidaya` → **Create**
5. Tunggu ±10 detik, lalu pilih project `Kartidaya` di dropdown

### 2.2 Aktifkan Gmail API

1. Menu ☰ → **APIs & Services** → **Library**
2. Cari `Gmail API` → klik → **Enable**

### 2.3 Konfigurasi Google Auth Platform

> **Catatan UI:** Google sudah mengganti halaman *OAuth consent screen* menjadi
> **Google Auth Platform**. Kalau sidebar Anda menampilkan *Overview, Branding,
> Audience, Clients, Data Access, Verification Center, Settings* — ikuti langkah
> di bawah. Kalau masih menampilkan *OAuth consent screen* lama, lihat
> [Lampiran: UI lama](#lampiran-ui-lama).

1. Menu ☰ → **APIs & Services** → **OAuth consent screen**
   (akan terbuka halaman **Google Auth Platform → Overview**)
2. Klik **Get started** → wizard 4 langkah:

   **a. App Information**
   - App name: `Kartidaya`
   - User support email: pilih email Anda

   **b. Audience**
   - Pilih **External** → **Next**

   **c. Contact Information**
   - Email addresses: email Anda

   **d. Finish**
   - Centang **I agree to the Google API Services: User Data Policy**
   - **Create**

3. **Data Access** (sidebar kiri) → **Add or remove scopes**

   > **Langkah ini opsional untuk uji coba.** Yang menentukan izin yang diminta
   > saat login adalah kode di `gmail.js`, bukan tabel di halaman ini. Tabel
   > Data Access hanya dipakai Google saat proses **verifikasi** kalau aplikasi
   > nanti dipublikasikan. Kalau hanya mau mencoba, lewati saja langkah ini.

   **Cara tercepat & paling aman** — cari kotak **Manually add scopes**, tempel
   satu per satu, lalu **Add to table**:
   ```
   https://www.googleapis.com/auth/gmail.send
   ```
   ```
   https://www.googleapis.com/auth/gmail.readonly
   ```

   **Cara alternatif** — kalau memakai daftar checkbox: klik kotak centang di
   **header kolom** untuk uncheck semua, lalu centang **hanya dua** baris ini:
   - `.../auth/gmail.readonly` — *View your email messages and settings*
   - `.../auth/gmail.send` — *Send email on your behalf*

   → **Update** → **Save**

   #### Hasil akhir yang benar

   Google menggolongkan kedua scope ini berbeda, jadi tabelnya **tidak** akan
   kosong semua:

   | Tabel | Isi yang benar |
   |---|---|
   | Your non-sensitive scopes | **kosong** |
   | Your sensitive scopes | `.../auth/gmail.send` — 1 baris |
   | Your restricted scopes | `.../auth/gmail.readonly` — 1 baris |

   Jadi kalau tabel *sensitive* berisi 1 baris dan *restricted* berisi 1 baris,
   itu **sudah benar**. Yang salah adalah kalau isinya lebih dari itu.

   #### ⚠️ Jangan centang semua

   Daftar itu berisi 38 scope. Aplikasi ini hanya butuh **dua**. Centang semua
   bukan "lebih aman untuk coba-coba" — akibatnya:

   | Akibat | Penjelasan |
   |---|---|
   | Layar izin jadi menakutkan | Saat login, Google menampilkan daftar izin panjang. Anda sendiri akan ragu klik *Allow* |
   | Izin menempel permanen | Sekali diberikan, izin itu tersimpan di akun. Tidak hilang setelah selesai coba-coba |
   | Risiko kalau akun jadi akun resmi | Izin "hapus permanen semua email", "ubah setelan & filter", "kelola delegate" itu bahaya nyata |

   Scope paling berbahaya di daftar itu:

   | Scope | Bahayanya |
   |---|---|
   | `https://mail.google.com/` | Akses penuh + hapus permanen semua email |
   | `gmail.messages.delete` | Hapus permanen semua email |
   | `gmail.messages` | Baca, ubah, hapus permanen semua email |
   | `gmail.settings.sharing` | Kelola siapa saja yang boleh mengakses email Anda |
   | `gmail.settings.delegates` | Baca, buat, hapus delegate email Anda |
   | `gmail.settings.forwarding` | Baca, buat, hapus alamat forward |
   | `gmail.settings.filters` | Baca, buat, hapus filter email |

   Hati-hati juga nama yang **mirip**:

   | Salah | Benar |
   |---|---|
   | `gmail.send.self` | `gmail.send` |
   | `gmail.messages.readonly` | `gmail.readonly` |
   | `gmail.drafts.readonly` | `gmail.readonly` |

   #### Kalau muncul peringatan "restricted scope"

   `gmail.readonly` termasuk **restricted scope** menurut Google. Saat menekan
   **Save**, mungkin muncul peringatan bahwa aplikasi perlu verifikasi.

   **Abaikan saja.** Selama status aplikasi masih **Testing** dan Anda hanya
   login dengan akun yang terdaftar di **Test users**, verifikasi tidak
   diperlukan. Verifikasi baru wajib kalau aplikasi dipublikasikan ke publik.

   Kalau peringatan itu terasa mengganggu, `gmail.readonly` boleh dihapus dari
   Data Access — aplikasi tetap bisa **kirim** email. Yang hilang hanya fitur
   **Sinkron** (tarik surat masuk otomatis).

   #### Cara menghapus scope yang sudah terlanjur dicentang

   1. Buka **Data Access**
   2. Klik **Add or remove scopes**
   3. Di tabel, **uncheck** semua baris yang tidak dipakai
      (atau klik kotak centang di **header kolom** untuk uncheck semua sekaligus)
   4. Sisakan hanya `gmail.send` dan `gmail.readonly`
   5. **Update** → **Save**

   Kalau tabel tetap tidak berubah setelah **Update**, refresh halaman lalu ulangi.

   #### ⚠️ Kalau muncul tombol "Save" dan "Discard changes"

   Tombol **Save** / **Discard changes** di bagian bawah halaman berarti ada
   perubahan yang **belum tersimpan**. Periksa dulu isi tabelnya:

   | Isi tabel | Tindakan |
   |---|---|
   | Hanya `gmail.send` + `gmail.readonly` | Klik **Save** |
   | Ada scope lain (mis. `gmail.settings.*`, `gmail.modify`, `mail.google.com`) | Klik **Discard changes** |

   **Discard changes** membatalkan perubahan dan mengembalikan tabel ke kondisi
   terakhir yang tersimpan. Ini aman — tidak menghapus apa pun yang sudah benar.

   > **Jangan klik Save hanya karena tombolnya ada.** Kalau tabel berisi 18 scope
   > termasuk `gmail.settings.sharing`, `gmail.settings.delegates`, dan
   > `gmail.settings.forwarding`, menekan Save akan mendaftarkan semuanya.

4. **Audience** (sidebar kiri) → bagian **Test users** → **Add users** →
   masukkan **alamat Gmail yang akan dipakai** (misal `kartidaya@gmail.com`) → **Save**

5. **Branding** (sidebar kiri, opsional) → bagian **Authorized domains** →
   **Add domain** → `suwandhih.github.io`

> Karena statusnya masih *Testing*, hanya email yang didaftarkan di **Test users**
> yang bisa login. Ini cukup untuk demo. Token akan kedaluwarsa setelah 7 hari —
> tinggal klik *Hubungkan Gmail* lagi.

### 2.4 Buat OAuth Client ID

1. **Clients** (sidebar kiri) → **Create client**
   (atau: Menu ☰ → **APIs & Services** → **Credentials** → **+ Create Credentials** → **OAuth client ID**)
2. Application type: **Web application**
3. Name: `Kartidaya Web`
4. Bagian **Authorized JavaScript origins** → **+ Add URI** → tambahkan **keduanya**:
   ```
   https://suwandhih.github.io
   http://localhost:8080
   ```
   (tanpa garis miring di akhir, tanpa `/index.html`, tanpa `/kartidaya`)
5. **Create**
6. Muncul kotak berisi **Client ID** — bentuknya seperti:
   ```
   123456789012-abcdefghijklmnop.apps.googleusercontent.com
   ```
7. **Copy** Client ID tersebut

> **Client Secret tidak diperlukan.** Aplikasi ini memakai alur token
> (Google Identity Services) yang tidak butuh secret, jadi aman disimpan di
> browser.

> **Origin mana yang perlu didaftarkan?** Buka halaman **Setelan** di aplikasi —
> di bawah kolom Client ID tertulis origin yang sedang dipakai. Salin nilai itu.

### 2.5 Aktifkan 2-Step Verification

1. Buka <https://myaccount.google.com/security>
2. Aktifkan **2-Step Verification** bila belum

---

## Langkah 3 — Hubungkan di aplikasi

1. Buka aplikasi → menu **Setelan**
2. Tempel **Client ID** ke kolom *OAuth Client ID*
3. Klik **Simpan Client ID** → status berubah jadi *Siap dihubungkan*
4. Klik **Hubungkan Gmail**
5. Jendela Google muncul → pilih akun → klik **Continue / Allow**
   - Bila muncul *"Google hasn't verified this app"* → klik **Advanced** →
     **Go to Kartidaya (unsafe)** — ini normal untuk aplikasi Testing milik sendiri
6. Status berubah jadi **Terhubung** dan nama akun muncul di bawah tombol

Selesai. Sekarang:

- **Kirim** — menu *Tulis* → pilih penerima → **Kirim**. Surat benar-benar
  terkirim lewat Gmail dan tercatat di buku donor.
- **Terima** — menu *Masuk* → **⟳ Sinkron Gmail**. Surat masuk 90 hari terakhir
  ditarik dan otomatis dicocokkan ke donor berdasarkan alamat email.

---

## Cara kerja pencocokan surat masuk

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
    J --> K[Email pengirim bisa disimpan ke data donor]
```

---

## Kalau ada masalah

| Gejala | Penyebab | Solusi |
|---|---|---|
| `Google menolak origin file://` | Aplikasi dibuka dobel-klik | Pakai GitHub Pages atau `serve.bat` |
| `Popup window closed` | Jendela izin ditutup sebelum selesai | Klik *Hubungkan Gmail* lagi, jangan tutup jendelanya |
| `origin_mismatch` | Origin belum terdaftar | Salin origin dari halaman **Setelan** ke *Authorized JavaScript origins* |
| `access_denied` | Email belum jadi Test user | Tambahkan email di **Test users** (langkah 2.3 no. 4) |
| `Error 403: access_denied` — *"has not completed the Google verification process"* | Email yang dipakai login belum terdaftar sebagai Test user | Lihat bagian di bawah |
| `Sesi Gmail kedaluwarsa` | Token habis (1 jam / 7 hari) | Klik *Hubungkan Gmail* lagi |
| `Gagal memuat Google Identity Services` | Tidak ada internet | Cek koneksi internet |
| Tombol Sinkron bilang *Hubungkan Gmail dulu* | Belum login | Selesaikan Langkah 3 |
| Data tidak muncul setelah pindah alamat | localStorage terpisah per alamat | Ekspor JSON di alamat lama → Impor di alamat baru |

### Error 403: access_denied — "has not completed the Google verification process"

Pesan lengkapnya:

> *suwandhih.github.io has not completed the Google verification process. The app
> is currently being tested, and can only be accessed by developer-approved
> testers.*

Artinya: **email yang Anda pakai login belum terdaftar sebagai Test user.**
Ini bukan masalah kode, bukan masalah scope, dan bukan masalah origin.

**Perbaikan:**

1. Buka <https://console.cloud.google.com/auth/audience>
   (atau: **Google Auth Platform** → **Audience**)
2. Cari bagian **Test users** → klik **Add users**
3. Masukkan **alamat Gmail yang tadi dipakai login** — pada kasus ini:
   ```
   fotohotono03@gmail.com
   ```
4. **Save**
5. Tunggu ±1 menit, lalu klik **Hubungkan Gmail** lagi di aplikasi

> **Penting:** alamatnya harus **sama persis** dengan yang dipakai login. Kalau
> Anda login dengan `fotohotono03@gmail.com`, daftarkan alamat itu — bukan alamat
> lain. Satu akun Google bisa punya beberapa alamat; pakai yang muncul di layar
> error.

**Kalau tetap gagal**, cek juga:

| Cek | Di mana |
|---|---|
| Publishing status = **Testing** | Audience → bagian *Publishing status* |
| Email sudah muncul di tabel Test users | Audience → *Test users* |
| Sudah klik **Save** (bukan hanya Add users) | Audience |

> Selama status masih **Testing**, hanya email di daftar Test users yang bisa
> login. Ini normal dan cukup untuk demo — tidak perlu mengajukan verifikasi
> Google.

---

## Mode simulasi (tanpa Gmail)

Aplikasi tetap **bisa dipakai penuh tanpa Gmail**:

- Surat yang "dikirim" dicatat sebagai **Terkirim** di buku donor
- Surat masuk bisa dicatat manual lewat tombol **↓ Catat Surat Masuk**
- Semua fitur lain (donor, kategori, template, ekspor, cetak) berjalan normal

Ini berguna untuk demo dan pelatihan tanpa menyentuh email sungguhan.

---

## Lampiran: UI lama

Kalau Google Cloud Console Anda masih menampilkan halaman **OAuth consent screen**
versi lama (bukan *Google Auth Platform*), langkahnya:

1. Menu ☰ → **APIs & Services** → **OAuth consent screen**
2. User Type: **External** → **Create**
3. Isi App name `Kartidaya`, User support email, Developer contact information
4. **Save and Continue**
5. Halaman **Scopes** → **Add or remove scopes** → tempel kedua scope → **Update** → **Save and Continue**
6. Halaman **Test users** → **Add users** → masukkan alamat Gmail → **Save and Continue**
7. **Back to Dashboard**
8. Menu ☰ → **APIs & Services** → **Credentials** → **+ Create Credentials** → **OAuth client ID**
9. Application type **Web application** → tambahkan kedua origin → **Create**
