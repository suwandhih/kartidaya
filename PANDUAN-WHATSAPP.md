# Panduan WhatsApp — Kartidaya

Panduan ini menjelaskan cara menghubungkan Kartidaya ke **WhatsApp Cloud API (Meta)**
supaya bisa **mengirim dan menerima pesan WhatsApp** langsung dari aplikasi —
konsepnya sama dengan email: pesan masuk muncul di **Kotak Masuk**, tercatat di
**buku donor**, punya status **Belum dibaca / Dibaca / Dibalas**, dan ditarik
otomatis di latar belakang.

---

## 1. Kenapa perlu Cloudflare Worker?

Kartidaya adalah halaman statis di GitHub Pages. Halaman statis **tidak bisa**
dipakai untuk WhatsApp API secara langsung, karena dua hal:

| Masalah | Kenapa halaman statis tidak bisa |
|---|---|
| **Token Meta** | Token akses WhatsApp adalah kunci rahasia. Kalau ditaruh di `app.js`, siapa pun bisa membukanya lewat F12 dan mengirim pesan atas nama Anda. |
| **Webhook** | Meta mengirim pesan masuk dengan **POST** ke sebuah URL publik. GitHub Pages hanya menyajikan file, tidak bisa menerima kiriman data. |

Karena itu ada satu perantara kecil: **Cloudflare Worker** (`worker/index.js`).
Worker inilah yang menyimpan token dan menerima webhook. Browser hanya tahu
**alamat Worker** dan **kunci aplikasi** — dua hal yang tidak berbahaya kalau bocor.

```
HP pengirim
    │  kirim WhatsApp
    ▼
Meta WhatsApp Cloud API
    │  POST webhook
    ▼
Cloudflare Worker  ──simpan──►  KV (antrean pesan masuk)
    ▲                                   │
    │  GET /wa/inbox                    │
    │  POST /wa/send                    │
    │                                   ▼
Browser Kartidaya  ◄──────────  Kotak Masuk + buku donor
```

---

## 2. Yang perlu disiapkan

1. **Akun Meta Business** — https://business.facebook.com
2. **Aplikasi Meta** dengan produk *WhatsApp* ditambahkan
3. **Nomor WhatsApp Business** (bisa nomor uji gratis dari Meta)
4. **Permanent access token** (System User token)
5. **Phone Number ID** — ada di WhatsApp → API Setup
6. **Akun Cloudflare** (gratis) — https://dash.cloudflare.com

---

## 3. Langkah A — Ambil data dari Meta

1. Buka https://developers.facebook.com/apps → pilih aplikasi Anda.
2. Menu kiri → **WhatsApp** → **API Setup**.
3. Catat dua nilai ini:
   - **Phone number ID** → ini `WA_PHONE_ID`
   - **Temporary access token** (berlaku 24 jam) — untuk uji cepat
4. Untuk token permanen:
   - Buka **Business Settings** → **Users** → **System Users**
   - Buat system user (role: Admin), lalu **Generate New Token**
   - Pilih aplikasi Anda, centang izin `whatsapp_business_messaging` dan
     `whatsapp_business_management`
   - Simpan token → ini `WA_TOKEN`
5. Tambahkan nomor HP Anda sebagai **test recipient** di API Setup supaya bisa
   menerima pesan saat masih mode pengembangan:
   - Di halaman **API Setup**, klik **Manage phone number list**
   - **Add a recipient phone number** → **Country** = `Indonesia (ID +62)`
   - **Phone number** = nomor Anda tanpa `0` di depan
     (contoh: `085921939585` → tulis `85921939585`)
   - **Next** → Meta mengirim **kode 5 digit lewat WhatsApp** ke nomor itu
   - Masukkan kode → **Next** → nomor muncul di daftar **Recipient**
   - Maksimal **5 nomor** per aplikasi

> **Catatan:** nomor uji gratis dari Meta hanya bisa mengirim ke nomor yang
> didaftarkan sebagai test recipient. Untuk produksi, nomor bisnis harus
> diverifikasi dan template pesan harus disetujui Meta.

---

## 4. Langkah B — Deploy Worker

### Cara 1 — lewat terminal (disarankan)

```powershell
cd C:\data\Kartidaya\worker
npx wrangler login          # buka browser, izinkan akses
npx wrangler kv namespace create WA_INBOX
```

Perintah terakhir mencetak `id = "..."`. Salin id itu ke `wrangler.toml`:

```toml
[[kv_namespaces]]
binding = "WA_INBOX"
id = "id-yang-tadi-dicetak"
```

Lalu set empat rahasia dan deploy:

```powershell
npx wrangler secret put WA_TOKEN          # token permanen dari langkah A
npx wrangler secret put WA_PHONE_ID       # Phone number ID
npx wrangler secret put WA_VERIFY_TOKEN   # kata sandi bebas, mis. kartidaya-2026
npx wrangler secret put APP_KEY           # kunci aplikasi, mis. hasil acak 32 huruf
npx wrangler deploy
```

`wrangler deploy` mencetak alamat Worker, misalnya:

```
https://kartidaya-wa.namaanda.workers.dev
```

> **Nilai yang sudah dipakai Kartidaya** (jangan diubah tanpa alasan):
> - Worker: `https://kartidaya-wa.suwandhih.workers.dev`
> - KV `WA_INBOX`: `f92cebc2b7724490a76c18be3f3559a1`
> - `WA_PHONE_ID`: `1391919354008532`
> - `WA_VERIFY_TOKEN`: `kartidaya-2026`
> - `APP_KEY`: lihat kartu **WhatsApp** di halaman **Setelan** aplikasi

### Cara 2 — lewat dashboard Cloudflare

1. Buka https://dash.cloudflare.com → **Workers & Pages** → **Create** → **Worker**
2. Nama: `kartidaya-wa` → **Deploy**
3. **Edit code** → hapus isi bawaan → tempel seluruh isi `worker/index.js` → **Deploy**
4. **Settings** → **Variables and Secrets** → tambahkan empat secret:
   `WA_TOKEN`, `WA_PHONE_ID`, `WA_VERIFY_TOKEN`, `APP_KEY`
5. **Settings** → **Bindings** → **Add** → **KV Namespace**:
   - Variable name: `WA_INBOX`
   - Buat namespace baru bernama `kartidaya-wa-inbox`
6. **Deploy** ulang.

---

## 5. Langkah C — Daftarkan webhook di Meta

1. Buka aplikasi Meta → **WhatsApp** → **Configuration** → **Webhook** → **Edit**
2. **Callback URL**:
   ```
   https://kartidaya-wa.suwandhih.workers.dev/wa/webhook
   ```
3. **Verify token**: isi sama persis dengan `WA_VERIFY_TOKEN` di Worker
4. Klik **Verify and save** — Meta akan memanggil `GET /wa/webhook`.
   Kalau token cocok, Worker membalas `hub.challenge` dan Meta menampilkan ✓.
5. Di bagian **Webhook fields**, klik **Manage** → centang **messages** → **Subscribe**.

> Kalau verifikasi gagal, cek: (a) `WA_VERIFY_TOKEN` sama persis, (b) Worker
> sudah di-deploy, (c) alamat diakhiri `/wa/webhook`.

---

## 6. Langkah D — Hubungkan aplikasi

1. Buka https://suwandhih.github.io/kartidaya/ → **Setelan**
2. Gulir ke kartu **WhatsApp**
3. Isi:
   - **Alamat Worker** → `https://kartidaya-wa.suwandhih.workers.dev`
   - **Kunci aplikasi** → sama dengan `APP_KEY` di Worker
4. Klik **Simpan & uji sambungan**
   - Berhasil → chip berubah jadi **Tersambung** dan nomor WhatsApp Business muncul
   - Gagal → pesan kesalahan muncul di kanan bawah

Alamat Worker dan kunci disimpan di `sessionStorage`, jadi hilang saat tab
ditutup. Isi ulang setelah membuka aplikasi baru.

---

## 7. Cara pakai sehari-hari

### Kirim pesan WhatsApp

1. Menu **Tulis**
2. Di bagian **1 · Template**, klik tombol **✆ WhatsApp**
3. Pilih penerima (yang punya nomor HP)
4. Tulis isi pesan — token seperti `{/PIC}` tetap berfungsi
5. Klik **➤ Kirim**

Pesan tercatat di buku donor dengan chip **✆ WhatsApp** dan status **Terkirim**.
Kalau nomor HP donor kosong, statusnya **Gagal** dan pesannya tidak dikirim.

> **Subjek tidak ikut terkirim** di WhatsApp — hanya isi pesan. Subjek tetap
> disimpan sebagai judul catatan di buku donor.

### Terima pesan WhatsApp

Pesan masuk otomatis muncul di **Kotak Masuk** kalau **Sinkron WhatsApp otomatis**
menyala (bawaan: aktif, tiap 10 menit). Bisa juga ditarik manual:

- Menu **Masuk** → **⟳ Sinkron WhatsApp**
- Menu **Setelan** → kartu WhatsApp → **⟳ Sinkron WhatsApp**

Pencocokan ke donor memakai **nomor HP 1 atau HP 2**. Nomor dinormalkan dulu,
jadi `0811-8862-345`, `08118862345`, dan `628118862345` dianggap sama.

Pesan dari nomor yang belum terdaftar masuk sebagai **belum dikenal**. Untuk
menautkannya:

- Buka pesannya → **Tautkan ke Donor**, atau
- Isi nomor HP donor dulu, lalu **⇄ Cocokkan ulang**

### Balas pesan

Buka pesan di Kotak Masuk → **✎ Balas**. Kanal balasan otomatis mengikuti kanal
pesan terakhir: pesan WhatsApp dibalas lewat WhatsApp, email dibalas lewat email.

Setelah balasan benar-benar terkirim, status pesan masuk otomatis naik ke
**Dibalas**.

### Catat pesan WhatsApp manual

Untuk pesan yang tidak lewat API (mis. WhatsApp pribadi, tangkapan layar):

**Buku donor** → **↓ Catat Surat Masuk** → pilih **Kanal: ✆ WhatsApp**

Kolom **Dari** otomatis terisi nomor HP donor.

---

## 8. Status pesan

| Status | Arti | Warna chip |
|---|---|---|
| **Belum dibaca** | pesan baru, dihitung di badge menu Masuk | kuning |
| **Dibaca** | sudah dibuka | biru |
| **Dibalas** | sudah dikirimi balasan | hijau |

Status bisa diubah manual dari dropdown di dalam pesan.

---

## 9. Uji cepat (9 langkah)

| # | Yang diuji | Cara | Hasil yang diharapkan |
|---|---|---|---|
| 1 | Worker hidup | Buka `https://<worker>/wa/status` di browser | Muncul JSON, bukan error |
| 2 | Kunci aplikasi | Setelan → isi alamat + kunci → **Simpan & uji sambungan** | Chip jadi **Tersambung** |
| 3 | Kunci salah | Ubah kunci jadi ngawur → **Simpan & uji sambungan** | Muncul pesan "Kunci aplikasi salah" |
| 4 | Kirim | Tulis → **✆ WhatsApp** → pilih donor → **Kirim** | Pesan sampai di HP, buku donor bertambah |
| 5 | Nomor kosong | Pilih donor tanpa HP → **Kirim** | Status **Gagal**, ada keterangan |
| 6 | Terima | Kirim WhatsApp dari HP ke nomor bisnis | Muncul di Kotak Masuk dalam ≤10 menit |
| 7 | Cocokkan | Pesan dari nomor donor terdaftar | Chip donor ID muncul, bukan "belum dikenal" |
| 8 | Tautkan | Pesan dari nomor asing → **Tautkan ke Donor** | Pindah ke buku donor yang dipilih |
| 9 | Balas | Buka pesan → **✎ Balas** → **Kirim** | Balasan sampai, status jadi **Dibalas** |

---

## 10. Kalau ada masalah

| Gejala | Penyebab | Perbaikan |
|---|---|---|
| "Kunci aplikasi salah atau belum diisi" | `APP_KEY` di Worker ≠ kunci di Setelan | Samakan keduanya |
| "WA_TOKEN / WA_PHONE_ID belum diisi di Worker" | Secret belum di-set | `npx wrangler secret put WA_TOKEN` lalu deploy ulang |
| Verifikasi webhook gagal di Meta | `WA_VERIFY_TOKEN` beda | Samakan, deploy ulang |
| Pesan masuk tidak muncul | Webhook belum di-subscribe ke `messages` | Meta → Configuration → Webhook fields → centang **messages** |
| Pesan masuk tidak muncul | Sinkron otomatis mati | Setelan → **Sinkron WhatsApp otomatis** → **Aktif** |
| Kirim gagal, error `131030` | Nomor tujuan bukan test recipient | Tambahkan nomor itu di Meta → API Setup |
| Kirim gagal, error `131047` | Di luar jendela 24 jam | Balas dulu pesan terakhir dari pelanggan, atau pakai template disetujui |
| Kirim gagal, error `190` | Token kedaluwarsa | Buat token permanen baru, `wrangler secret put WA_TOKEN` |
| Pesan dobel | Webhook dikirim ulang Meta | Worker sudah anti-duplikat lewat `waId`; kalau tetap dobel, hapus manual |
| Chip tetap "Belum diatur" | Alamat Worker belum diisi | Isi di Setelan, klik **Simpan & uji sambungan** |

---

## 11. Batas & catatan

- **Antrean pesan masuk** disimpan di KV, maksimal **500 pesan terakhir**.
  Pesan yang sudah ditarik aplikasi dihapus dari antrean lewat `/wa/ack`.
- **Jendela 24 jam**: WhatsApp hanya mengizinkan pesan bebas dalam 24 jam
  setelah pelanggan terakhir menulis. Di luar itu harus pakai *message template*
  yang disetujui Meta.
- **Biaya**: Meta memberi kuota percakapan gratis per bulan; di atas itu
  dikenakan tarif per percakapan. Cloudflare Workers gratis sampai 100.000
  permintaan/hari.
- **Satu nomor bisnis** hanya boleh terhubung ke satu aplikasi Meta.
- **Kunci aplikasi** disimpan di `sessionStorage` — hilang saat tab ditutup.
  Ini disengaja: kunci hanya berguna untuk Worker ini, tapi lebih baik tidak
  disimpan permanen.

---

## 12. Berkas terkait

| Berkas | Isi |
|---|---|
| `worker/index.js` | Kode Cloudflare Worker (endpoint `/wa/*`) |
| `worker/wrangler.toml` | Konfigurasi deploy Worker |
| `whatsapp.js` | Pembungkus di sisi browser (objek `WhatsApp`) |
| `app.js` | Bagian **11b** (`waSync`, `waConnect`) dan **17b** (`waSinkronOtomatis`) |
| `PANDUAN-GMAIL.md` | Panduan email — konsepnya sama |
