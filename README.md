# Kartidaya — Kelola Surat & Email Donor

Aplikasi web untuk mengelola korespondensi donor: data donor, kategori, template
surat, dan **buku terima & kirim per ID donor** — mirip Outlook tetapi disesuaikan
kebutuhan perusahaan.

Setiap donor punya **buku sendiri** berisi surat keluar dan masuk yang tercampur
urut waktu. Surat bisa dikirim dan diterima sungguhan lewat **email** (Gmail API +
OAuth 2.0) maupun **WhatsApp** (Meta WhatsApp Cloud API lewat Cloudflare Worker).

## Coba langsung

**https://suwandhih.github.io/kartidaya/**

Aplikasi langsung jalan dalam **mode simulasi** — tanpa perlu menyiapkan apa pun.
Surat yang "dikirim" tercatat di buku donor, surat masuk bisa dicatat manual.

## Fitur

| Fitur | Keterangan |
|---|---|
| Data donor | Form isi seperti Excel, 18 donor contoh sudah terisi |
| **Peringatan data kembar** | Saat menyimpan donor, diberi tahu kalau email / nomor HP / nama PIC sudah dipakai donor lain |
| Kategori | 5 kategori awal, bisa ditambah/ubah/hapus |
| ID-DONOR otomatis | Format `[X]99999[Z]` — X dari Instansi (atau PIC bila kosong) |
| Template surat | Token `{/PIC}`, `{/INST}`, `{/TANGGAL}`, dll. |
| **Format sederhana** | `**tebal**`, `*miring*`, `- poin`, `1. nomor` di isi surat |
| Kirim massal | Pilih banyak penerima, kirim sekaligus |
| **Cc** | Kirim salinan ke alamat lain, ikut tersimpan di riwayat |
| **Balas semua / Teruskan** | Balas semua mengisi Cc otomatis; Teruskan menyalin isi + kepala surat |
| **Lampiran berkas** | PDF/foto/dokumen maks. 10 MB, tersimpan di Worker, bisa dibuka lagi |
| **Dua kanal** | Email dan WhatsApp, dipilih per pengiriman |
| **Buku per donor** | Surat keluar + masuk urut waktu, bubble masuk/keluar |
| **Kotak Masuk / Keluar** | Tampilan global semua donor, bisa dicari & difilter per kanal |
| **Status surat** | Belum dibaca (kuning) / Dibaca (biru) / Dibalas (hijau) |
| **Belum dikenal** | Surat dari alamat/nomor tak dikenal → bisa ditautkan ke donor |
| **Sinkron Gmail** | Tarik inbox, cocokkan otomatis lewat alamat email |
| **Sinkron WhatsApp** | Tarik pesan masuk lewat webhook, cocokkan lewat nomor HP |
| **Sinkron otomatis** | Kedua kanal ditarik sendiri di latar belakang |
| **Majalah** | Unggah PDF → jadi halaman gambar; banyak edisi bisa disimpan |
| **Statistik pembaca majalah** | Berapa kali dibuka & halaman mana yang paling dilihat |
| Cetak surat | `window.print()` per penerima |
| Ekspor | JSON (backup/restore) + CSV (buka di Excel) |
| **Pengingat cadangan** | Muncul di Beranda kalau >7 hari belum ekspor JSON |
| Tema | Terang / gelap / ikut sistem |
| **Akun & login** | Email + password per pengguna. Akun pertama otomatis admin; akun berikutnya dibuat admin di halaman akun |
| **Catatan aktivitas** | Siapa masuk/keluar, siapa menambah/mengubah/menghapus donor, keuangan, surat, template & kategori — bisa disaring |
| Responsif | HP Android dan PC |

## Menjalankan di komputer

Aplikasi butuh server lokal karena **Google menolak origin `file://`** untuk OAuth.

```bat
serve.bat
```

Browser otomatis terbuka di `http://localhost:8080/index.html`.
Server juga mendengarkan di alamat LAN sehingga bisa dibuka dari HP Android
yang tersambung ke Wi-Fi yang sama.

Butuh Python 3 di PATH. Kalau port 8080 dipakai, jalankan dengan port lain:

```bat
set PORT=8081 && python serve.py
```

## Menghubungkan Gmail

Ikuti **[PANDUAN-GMAIL.md](PANDUAN-GMAIL.md)** — panduan langkah demi langkah
membuat Google Cloud project + OAuth Client ID (±10 menit, sekali saja).

Ringkasnya:

1. Buat project di <https://console.cloud.google.com/>
2. Aktifkan **Gmail API** (APIs & Services → Library)
3. Buka **OAuth consent screen** → klik **Get started** → isi App name, pilih
   **External**, isi email, setujui kebijakan
4. **Data Access** → *opsional untuk uji coba*. Kalau diisi, tambahkan **hanya**
   scope `gmail.send` dan `gmail.readonly` (pakai kotak *Manually add scopes*
   agar tidak salah centang dari 38 pilihan). **Jangan centang semua** — lihat
   peringatan di [PANDUAN-GMAIL.md](PANDUAN-GMAIL.md)
5. **Audience** → **Test users** → tambahkan alamat Gmail Anda
6. **Clients** → **Create client** → Web application → tambahkan origin:
   - `https://suwandhih.github.io` (untuk GitHub Pages)
   - `http://localhost:8080` (untuk lokal)
7. Di aplikasi → **Setelan** → tempel Client ID → **Simpan** → **Hubungkan Gmail**

Halaman **Setelan** selalu menampilkan origin yang sedang dipakai, jadi Anda bisa
menyalinnya langsung ke Google Cloud Console.

Client Secret **tidak diperlukan** — aplikasi memakai alur token
(Google Identity Services) yang seluruhnya jalan di browser.

> **Catatan:** OAuth Google hanya menerima origin `https://` atau
> `http://localhost`. Membuka `index.html` dengan dobel-klik (`file://`) akan
> ditolak — pakai GitHub Pages atau `serve.bat`.

## Menghubungkan WhatsApp

Ikuti **[PANDUAN-WHATSAPP.md](PANDUAN-WHATSAPP.md)** — panduan langkah demi
langkah menyiapkan Meta WhatsApp Cloud API + Cloudflare Worker (±20 menit,
sekali saja).

Ringkasnya:

1. Buat aplikasi Meta di <https://developers.facebook.com/apps> → tambahkan
   produk **WhatsApp** → catat **Phone number ID** dan buat **permanent token**
2. Deploy Worker:
   ```powershell
   cd worker
   npx wrangler login
   npx wrangler kv namespace create WA_INBOX   # salin id ke wrangler.toml
   npx wrangler secret put WA_TOKEN
   npx wrangler secret put WA_PHONE_ID
   npx wrangler secret put WA_VERIFY_TOKEN
   npx wrangler secret put APP_KEY
   npx wrangler deploy
   ```
3. Daftarkan webhook di Meta → **Configuration** → **Webhook**:
   `https://<worker-anda>.workers.dev/wa/webhook`, verify token sama dengan
   `WA_VERIFY_TOKEN`, lalu subscribe ke field **messages**
4. Di aplikasi → **Setelan** → kartu **WhatsApp** → isi alamat Worker + kunci
   aplikasi → **Simpan & uji sambungan**

> **Sudah terpasang untuk Kartidaya:** Worker
> `https://kartidaya-wa.suwandhih.workers.dev`, KV `WA_INBOX`
> `f92cebc2b7724490a76c18be3f3559a1`, nomor uji `+1 (555) 173-4967`.
> Alamat & kunci disimpan di `localStorage` browser, jadi tidak perlu diisi
> ulang setiap membuka aplikasi.

> ⚠️ **Status 5 Nov 2026 — kirim ke nomor Indonesia masih diblokir Meta**
> (kode `130497`). Akun bisnis belum lulus verifikasi (`141010`), profil bisnis
> belum lengkap (`131000`), dan metode pembayaran bermasalah (`141006`).
> Ini kebijakan Meta, bukan bug aplikasi. Arah **terima** pesan sudah bisa
> diuji; arah **kirim** menunggu ketiga hal itu beres. Rincian:
> [rencanakerja.md](rencanakerja.md) bagian 14 & 16.

**Kenapa perlu Worker?** Token Meta tidak boleh ada di browser (bisa dicuri lewat
F12), dan pesan masuk butuh URL publik untuk webhook — dua hal yang tidak bisa
dilakukan halaman statis. Worker menyimpan token dan menerima webhook; browser
hanya tahu alamat Worker dan kunci aplikasi.

## Struktur file

```
index.html          Kerangka halaman
app.css             Gaya (1 warna aksen, sisanya netral)
app.js              Logika aplikasi + data contoh 18 donor
gmail.js            Gmail API + OAuth 2.0
whatsapp.js         Pembungkus WhatsApp Cloud API (lewat Worker)
worker/index.js     Cloudflare Worker — kirim, webhook, antrean pesan masuk
worker/wrangler.toml  Konfigurasi deploy Worker
serve.py            Server statis lokal (threaded, port 8080)
serve.bat           Peluncur Windows
rencanakerja.md     Rencana kerja & keputusan desain
PANDUAN-GMAIL.md    Panduan Google Cloud Console
PANDUAN-WHATSAPP.md Panduan Meta + Cloudflare Worker
PANDUAN-AKUN.md     Panduan akun: buat akun, login, catatan aktivitas
akun.js             Login pengguna (sesi, kelola akun, ganti password)
worker/schema.sql   Skema database D1 (data bersama + akun + aktivitas)
```

## Penyimpanan data

Data donor, surat, keuangan, dan template disimpan di **Cloudflare D1** lewat
Worker, supaya beberapa orang bisa bekerja pada data yang sama. Browser hanya
menyimpan salinan sementara agar tampilan cepat.

Aplikasi **butuh login** (email + password). Layar masuk menutup seluruh
aplikasi — data donor tidak ditampilkan sebelum jelas siapa yang membukanya.
Panduan akun: **[PANDUAN-AKUN.md](PANDUAN-AKUN.md)**.

Hal yang perlu diketahui:

- Data **per akun**, bukan per perangkat — masuk dari komputer mana pun
  melihat data yang sama
- Aplikasi bekerja **online**. Kalau internet mati, aplikasi dikunci sampai
  sambungan kembali — supaya tidak ada perubahan yang tampak tersimpan
  padahal hilang
- **Rutin ekspor JSON** lewat Setelan sebagai cadangan. Beranda mengingatkan
  sendiri kalau sudah lebih dari 7 hari tidak mencadangkan
- **Lampiran berkas & majalah** disimpan di Cloudflare KV (bukan di D1),
  karena isinya berkas, bukan data tabel

## Teknologi

Vanilla HTML + CSS + JavaScript. Tanpa framework, tanpa build step, tanpa
dependensi npm. Hanya butuh Python 3 untuk server lokal.

WhatsApp memakai **Cloudflare Worker** (JavaScript, gratis sampai 100.000
permintaan/hari) sebagai perantara ke Meta Graph API.

## Lisensi

MIT
