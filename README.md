# Kartidaya — Kelola Surat & Email Donor

Aplikasi web untuk mengelola korespondensi donor: data donor, kategori, template
surat, dan **buku terima & kirim per ID donor** — mirip Outlook tetapi disesuaikan
kebutuhan perusahaan.

Setiap donor punya **buku sendiri** berisi surat keluar dan masuk yang tercampur
urut waktu. Surat bisa dikirim dan diterima sungguhan lewat akun `@gmail.com`
memakai Gmail API + OAuth 2.0.

## Coba langsung

**https://suwandhih.github.io/kartidaya/**

Aplikasi langsung jalan dalam **mode simulasi** — tanpa perlu menyiapkan apa pun.
Surat yang "dikirim" tercatat di buku donor, surat masuk bisa dicatat manual.

## Fitur

| Fitur | Keterangan |
|---|---|
| Data donor | Form isi seperti Excel, 18 donor contoh sudah terisi |
| Kategori | 5 kategori awal, bisa ditambah/ubah/hapus |
| ID-DONOR otomatis | Format `[X]99999[Z]` — X dari Instansi (atau PIC bila kosong) |
| Template surat | Token `{/PIC}`, `{/INST}`, `{/TANGGAL}`, dll. |
| Kirim massal | Pilih banyak penerima, kirim sekaligus |
| **Buku per donor** | Surat keluar + masuk urut waktu, bubble masuk/keluar |
| **Kotak Masuk / Keluar** | Tampilan global semua donor, bisa dicari & difilter |
| **Belum dikenal** | Surat dari alamat tak dikenal → bisa ditautkan ke donor |
| **Sinkron Gmail** | Tarik inbox, cocokkan otomatis lewat alamat email |
| Cetak surat | `window.print()` per penerima |
| Ekspor | JSON (backup/restore) + CSV (buka di Excel) |
| Tema | Terang / gelap / ikut sistem |
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
2. Aktifkan **Gmail API**
3. Isi **OAuth consent screen** (External) + tambahkan email Anda di **Test users**
4. Buat **OAuth client ID** → Web application → tambahkan origin:
   - `http://localhost:8080` (untuk lokal)
   - `https://suwandhih.github.io` (untuk GitHub Pages)
5. Di aplikasi → **Setelan** → tempel Client ID → **Simpan** → **Hubungkan Gmail**

Client Secret **tidak diperlukan** — aplikasi memakai alur token
(Google Identity Services) yang seluruhnya jalan di browser.

## Struktur file

```
index.html          Kerangka halaman
app.css             Gaya (1 warna aksen, sisanya netral)
app.js              Logika aplikasi + data contoh 18 donor
gmail.js            Gmail API + OAuth 2.0
serve.py            Server statis lokal (threaded, port 8080)
serve.bat           Peluncur Windows
rencanakerja.md     Rencana kerja & keputusan desain
PANDUAN-GMAIL.md    Panduan Google Cloud Console
```

## Penyimpanan data

Semua data disimpan di **localStorage browser** — tidak ada server, tidak ada
database. Artinya:

- Data **per alamat**, tidak ikut berpindah antar perangkat
- Ganti browser / hapus data situs = data hilang
- **Rutin ekspor JSON** lewat Setelan sebagai backup

## Teknologi

Vanilla HTML + CSS + JavaScript. Tanpa framework, tanpa build step, tanpa
dependensi npm. Hanya butuh Python 3 untuk server lokal.

## Lisensi

MIT
