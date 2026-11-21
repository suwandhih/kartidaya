# PROMPT INDUK — APLIKASI KARTIDAYA

## WAJIB DIBACA SEBELUM MEMBUAT ATAU MEREVISI

Anda adalah pengembang yang diminta membangun atau melanjutkan aplikasi Kartidaya. Ikuti spesifikasi aktif di bawah serta aturan proyek di `AGENTS.md`. Tulis penjelasan dan antarmuka dalam bahasa Indonesia yang sederhana, terutama untuk pengguna nonteknis. Jangan meminta pengguna memasukkan alamat teknis jika ada cara yang lebih mudah.

### Aturan revisi dan kebersihan — berlaku pada setiap perubahan

1. **Setiap revisi aplikasi wajib diikuti revisi `prompt.md`.** Ubah bagian spesifikasi yang terkait agar selalu menggambarkan aplikasi yang benar-benar berlaku. Perbarui panduan di aplikasi bila langkah, nama tombol, atau perilaku berubah.
2. **Jangan menyisakan prompt atau kode mati.** Hapus instruksi, contoh, cabang, fungsi, impor, aset, konfigurasi, serta kode yang benar-benar tidak dipakai akibat revisi; jangan sekadar diberi label lama, tidak aktif, TODO, atau dinonaktifkan. Jangan menyisakan dua spesifikasi yang saling bertentangan. Periksa pemakaian dan dependensinya sebelum menghapus.
3. **Jangan menyamakan kode mati dengan kompatibilitas.** Kode yang masih digunakan untuk membaca data lama, fitur yang sengaja ditunda, atau integrasi yang masih dipakai bukan otomatis kode mati. Pertahankan sampai pengganti dan pemindahan data terbukti aman. Jangan hapus data pengguna atau fitur aktif demi kerapian.
4. **Uji secara selektif sebelum menyatakan selesai.** Jalankan pemeriksaan terkecil yang relevan dengan bagian yang diubah dan bagian lain yang benar-benar terdampak; jangan menjalankan seluruh rangkaian atau menambah uji yang tidak berkaitan hanya karena tersedia. Bagian yang tidak diedit langsung belum tentu aman jika bergantung pada fungsi, data, atau penyimpanan yang berubah. Perluas pengujian hanya jika risiko atau hasil pemeriksaan mengharuskannya. Buat uji seperlunya; **skrip uji baru yang dibuat untuk suatu revisi wajib dihapus setelah selesai digunakan**, termasuk tes otomatis, bersama berkas sementara yang dibuat untuk uji. Pemilik memutuskan bahwa skrip uji yang sudah ada sebelum aturan ini tetap dipertahankan untuk saat ini. Jangan hapus foto, dokumen, data pengguna, atau berkas yang tidak terkait tanpa izin.
5. Jangan menyimpan atau membagikan kata sandi, token, APP_KEY, kredensial, ataupun data donor asli di kode, log, prompt, atau layanan lain. Gunakan data contoh yang dibuat-buat untuk pengujian.
6. Periksa hasil dan perilaku lama, risiko terhadap data, serta perbedaan lingkungan lokal dan produksi. Laporkan apa yang diuji, keterbatasan, dan apakah sudah diterbitkan. **Jangan mengirim email nyata, menghapus data nyata, menjalankan migrasi, commit, push, atau deploy tanpa persetujuan pemilik.**

## 1. Tugas dan tujuan

Bangun aplikasi web **Kartidaya — Kelola Surat & Email Donor** yang mengikuti spesifikasi ini. Aplikasi digunakan beberapa staf dari HP dan komputer untuk mengelola donor, korespondensi, keuangan, kwitansi, majalah, dan buletin. Setiap donor mempunyai riwayat surat sendiri. Aplikasi dan Buletin diakses dari satu situs; kode Buletin dipisahkan dari kode halaman Tulis.

Spesifikasi ini merupakan potret fitur yang ada pada 20 November 2026. Jika diminta membangun ulang **sama persis**, salinan kode sumber, aset berlisensi/yang dimiliki pemilik, contoh data sintetis, detail tata letak visual, dan konfigurasi layanan harus disediakan atau diperiksa dari proyek sumber. Dokumen ini merangkum perilaku utama, bukan pengganti setiap detail kode; jangan mengklaim hasil identik sebelum dibandingkan dan diuji. Jika kebutuhan bertentangan atau tidak cukup lengkap, tanyakan kepada pemilik. Dokumen ini tidak berisi data donor asli atau kunci; jangan mengarang data tersebut. Koneksi dan pengiriman nyata harus diuji oleh pemilik dengan akun dan data uji yang disetujui.

## 2. Teknologi, tampilan dan susunan berkas

- Situs statis HTML, CSS, JavaScript tanpa framework atau langkah build; bahasa tampilan Indonesia. Desktop memakai menu samping, HP memakai navigasi bawah yang dapat digulir. Tampilan responsif, tema terang/gelap/ikut sistem, kartu, dialog, chip status, notifikasi dan pratinjau.
- Halaman: **Beranda, Masuk, Keluar, Donor, Tulis, Buletin, Keuangan, Kategori, Akun, Setelan**. Menu Akun hanya tampil untuk admin. Ada tombol tema dan tombol **[?]**.
- Pisahkan sesuai tanggung jawab: `index.html`, `app.css`, `app.js`, `gmail.js`, `whatsapp.js`, `akun.js`, `panduan.js`; Buletin di `buletin.js`, `buletin-format.js`, `buletin-render.js`, `buletin-kirim.js`, `buletin-foto.js`, `buletin-foto.css`; Worker di `worker/index.js`, `worker/buletin-foto.js`, `worker/schema.sql`, `worker/wrangler.toml`.
- Aset lokal yang dibutuhkan: logo dan ikon Kartidaya milik pemilik, tiga gambar ikon sosial, PDF.js serta PDF.js worker untuk membaca PDF dan SheetJS untuk Excel. Sertakan versi yang sah dan sesuai lisensi; jangan bergantung pada berkas contoh pengguna. Naikkan versi URL aset ketika aset berubah agar cache browser tidak memakai versi lama.
- Jalankan lokal dengan server HTTP (`serve.bat`/`serve.py`); OAuth Google tidak bekerja dengan `file://`. Produksi saat ini: situs di GitHub Pages dan API di Cloudflare Worker, D1 dan KV. Gunakan alamat dan ID layanan dari konfigurasi pemilik, bukan menyalin rahasia ke dokumen.

## 3. Pengguna, akses dan data bersama

- Login aplikasi dengan email dan kata sandi. Akun pertama menjadi admin jika belum ada admin aktif; admin membuat dan mengaktifkan/menonaktifkan akun berikutnya. Peran `admin`, `donor`, `keuangan`; sesi server 12 jam. Password di-hash dengan salt PBKDF2-SHA256 (100.000 putaran pada implementasi saat ini). Catat aktivitas akun dan perubahan data yang didukung.
- Saat belum login, jangan tampilkan data donor. Jika data server gagal dimuat, kunci halaman kerja dan sediakan Setelan untuk memperbaiki sambungan. Tampilkan status penyimpanan, galat, dan percobaan ulang; jangan mengatakan data tersimpan ketika gagal.
- Data bersama D1: `records` menyimpan JSON per `(collection,id)` dengan `updated_at`; `meta` menyimpan nilai tunggal. Koleksi `donors`, `categories`, `templates`, `messages`, `programs`, `finance`, `buletin`. Metadata bersama `isian`, `majalah`, `majalahDaftar`. Pengaturan perangkat seperti tema, Client ID Gmail, dan catatan uji disimpan lokal; token sesi Gmail berada di `sessionStorage` dan bukan data bersama.
- Browser menyimpan salinan lokal, daftar perubahan tertunda, dan penghapusan sengaja. Saat sambungan pulih, kirim perubahan tertunda sebelum memuat data server. Jangan menghapus data rekan hanya karena tidak ada di salinan suatu tab. Foto/majalah dan berkas disimpan pada KV, bukan di cadangan JSON.
- **Batas saat ini:** data bersama bukan kolaborasi langsung; pengguna lain mungkin perlu memuat ulang. Jika dua pengguna mengubah record yang sama, perubahan terakhir dapat menimpa sebelumnya. KV dapat memerlukan waktu propagasi. Jangan menjanjikan pembaruan seketika atau penguncian edit yang belum ada.
- Server menerima kunci aplikasi atau token sesi untuk endpoint data yang dilindungi; halaman/berkas yang memang perlu publik dapat diakses lewat URL. Peran admin membatasi pengelolaan akun; jangan mengklaim seluruh endpoint sudah menerapkan pembatasan per peran. Keterbatasan saat ini: login belum memiliki pembatasan percobaan, CORS mencerminkan origin permintaan, dan webhook WhatsApp belum memeriksa tanda tangan. Perlakukan sebagai risiko, bukan jaminan keamanan; perbaikan memerlukan rancangan dan uji kompatibilitas. Jangan membuat perubahan keamanan yang memutus pengguna tanpa rencana migrasi.

## 4. Donor dan riwayat

- Data donor: ID, kategori, panggilan, PIC, nama lengkap, instansi, dua email dan dua HP dengan pilihan utama, cara pengiriman, tanggal mulai, tanggal lahir, asal gereja, alamat lengkap, dan catatan. PIC atau instansi wajib diisi. Jika pilihan utama kosong, gunakan alamat/nomor lainnya yang tersedia.
- ID baru: huruf awal instansi, atau PIC jika instansi kosong, lalu nomor urut lima digit per huruf, kemudian satu huruf akhiran yang dapat diubah (bawaan `R`). ID dapat diubah; referensi terkait harus ikut berpindah. Peringatkan saat PIC, email atau nomor sudah dipakai donor lain, dengan pilihan melanjutkan.
- Setiap donor mempunyai buku berisi surat masuk dan keluar urut waktu. Ada pencarian, saringan, status, buka rincian, balas/balas semua/teruskan, catat surat masuk manual, tautkan pengirim belum dikenal, cetak dan label alamat. Menghapus donor meminta konfirmasi dan juga menghapus pesan dan transaksi terkait sesuai implementasi.
- **Masuk** dan **Keluar** menampilkan surat lintas donor, mencari isi dan kontak, dan menyaring status/kanal. Status masuk: Belum dibaca, Dibaca, Dibalas. Status keluar: Draft, Terkirim, Gagal. Beranda menampilkan ringkasan dan pengingat cadangan.

## 5. Surat dan email

- Halaman Tulis: pilih template, isi subjek dan pesan, pilih penerima, CC bila perlu, lampiran, format, dan pratinjau. Token meliputi `{/PIC}`, `{/PANGGILAN}`, `{/NAMA}`, `{/INST}`, `{/NAMA_LENGKAP}`, `{/ID}`, `{/KATEGORI}`, `{/EMAIL}`, `{/EMAIL2}`, `{/HP}`, `{/HP2}`, `{/ALAMAT}`, `{/TANGGAL}`, `{/ISI1}` sampai `{/ISI5}`. Isi disesuaikan per donor.
- Format teks berupa penanda `**tebal**`, `*miring*`, `==stabilo==`, `- poin`, dan `1. nomor`; toolbar membantu menyisipkannya. Sebelum kirim tampilkan pemeriksaan penerima dan pratinjau; pilihan pemeriksaan wajib aktif secara bawaan. Dapat simpan draft, cetak, kirim percobaan ke diri sendiri menggunakan donor terpilih, dan mencatat riwayat.
- Gmail API menggunakan OAuth Google Identity Services dengan izin kirim dan baca. Hubungkan lewat Setelan; token sesi Gmail ada di `sessionStorage`. Email HTML dibuat `multipart/alternative` dengan teks biasa dan HTML. Sinkron inbox membaca hingga 40 pesan dari 90 hari terakhir dan mencocokkan kedua email donor.
- Jika Gmail belum tersambung, pengiriman surat biasa meminta persetujuan jelas untuk **simulasi**; simulasi tidak sungguh mengirim email walau riwayat mencatat terkirim. Jalur saat ini bahkan dapat mencatat donor tanpa email sebagai terkirim dalam simulasi: ini bukan bukti pengiriman. Buletin tidak memakai simulasi. Jangan menjelaskan simulasi sebagai pengiriman nyata.
- Lampiran umum disimpan di Worker maksimal 10 MB per berkas. **Batas implementasi saat ini:** pembangun MIME Gmail yang diperiksa tidak menambahkan berkas umum ke email sebagai lampiran. Jangan menyatakan fitur ini terkirim sebagai lampiran sampai dibuktikan/diimplementasikan dan diuji.
- WhatsApp tersedia di kode Worker/klien tetapi pilihan kanal dan sinkron otomatis ditunda sampai nomor resmi siap. Jangan mengaktifkannya diam-diam. Surat elektronik dan majalah tetap memakai Worker.

## 6. Keuangan, kwitansi dan cetak

- Catat transaksi untuk donor, tanggal, catatan dan beberapa baris program, masing-masing punya mata uang dan nominal. Pilih program dari daftar yang dapat dikelola; dukung IDR, USD, SGD, EUR, AUD, MYR. Jangan menjumlahkan mata uang berbeda.
- Buat kode kwitansi unik dengan tanggal dan nomor urut. Kwitansi bahasa Indonesia/Inggris merinci satu baris per program dan total/terbilang per mata uang. Tanggal berasal dari transaksi. Tanda tangan ditempatkan di kanan: kota/tanggal, salam, ikon Kartidaya, nama dan jabatan dari Setelan; alamat koreksi juga dari Setelan.
- Pencarian Keuangan mencakup data donor, kode, program, catatan dan mata uang. Tangani transaksi yang kehilangan kaitan donor dengan alat perbaikan yang meminta pengguna memilih donor, bukan menebak.
- Cetak surat dan label alamat A4 2 kolom/14 label atau 3 kolom/21 label, dengan pilihan memulai dari label tertentu. Beri tahu jika donor dilewati karena alamat kosong.

## 7. Majalah

- Unggah PDF satu berkas maksimal 100 MB dan 80 halaman. PDF.js mengubah halaman menjadi JPEG selebar sekitar 1.240 piksel kualitas 0,82; unggah satu per satu, maksimum 4 MB per gambar. Alternatif: pilih gambar JPG/PNG/WebP per halaman. Tampilkan kemajuan dan kesalahan; edisi baru tidak menimpa edisi lama.
- Simpan daftar edisi dan edisi aktif secara bersama; daftar edisi menyimpan hingga 24 edisi. Gambar halaman tersedia publik melalui `/majalah/{id}/{halaman}`, pembaca di `/baca/{id}`; sampul adalah halaman 1. Simpan PDF dalam beberapa bagian untuk keperluan kanal lain bila berhasil. Catat statistik pembaca/halaman.
- Buletin dapat mengunggah dan memilih majalah dari editor; setelah unggah, pilih edisi yang baru. Tombol pembaca dapat diperiksa. Simpan pilihan melalui **Simpan blok**. Jika URL majalah dipakai oleh beberapa tautan buletin, semuanya menunjuk edisi yang dipilih.

## 8. Buletin — fitur terpisah, akses dari menu aplikasi

- Data buletin: ID, judul wajib, edisi/tanggal opsional, waktu dibuat/diubah, ID edisi majalah, susunan blok, dan ringkasan pengiriman terakhir. Daftar menyediakan buat, **Susun blok**, pratinjau, kirim, ubah judul/edisi/tanggal, duplikat dan hapus. Duplikat tidak mewarisi statistik kirim.
- Editor memakai salinan draf. Tambah, ubah, naik/turun, duplikat, dan hapus blok; pratinjau langsung; **Simpan blok** menyimpan. Beri peringatan sebelum membuang perubahan yang belum disimpan. Teks lama `gelap`/`krem` dan format kaki lama tetap dapat dibuka; jangan buang isi saat migrasi.
- Jenis baru: **Gambar utama**, **Teks**, **Tautan baca**, **Kaki**.
  - Gambar: foto koleksi bersama atau sampul majalah, judul opsional. Judul ditampilkan sebelum gambar untuk kompatibilitas email.
  - Teks: judul opsional, isi, pilihan warna latar; otomatis pilih warna tulisan yang terbaca. Dapat tambah sub-bagian dengan judul kecil/isi dan toolbar di tiap isi. Penanda format sama seperti surat. Tautan di paragraf dibuat dengan tombol 🔗, memilih majalah atau website HTTPS; internalnya `[teks]({/MAJALAH})` atau `[teks](https://...)`. Kursor mouse pada kotak teks berwarna hitam dengan tepian terang; kursor ketik menyesuaikan tema agar terbaca.
  - Tautan baca: teks bawaan “Baca di sini!”, tujuan majalah terpilih, posisi kiri/tengah/kanan; bawaan kiri. Pengguna bisa membuka majalah untuk memeriksa.
  - Kaki: nol sampai tiga tautan teks, masing-masing memilih majalah atau website HTTPS. Satu baris ikon tetap Instagram, Facebook, X, Website dengan alamat awal yang dapat diedit; ikon tidak dapat ditambah atau dihapus, tetapi alamatnya boleh dikosongkan dan ikon yang kosong tidak ditampilkan (`X` bawaan kosong). Nilai awal Instagram, Facebook, dan Website: `https://www.instagram.com/kartidaya?igsh=ZDAxZ3FnemEwZG82`, `https://www.facebook.com/share/19ErEsRwRL/`, `https://kartidaya.org/`. Hak cipta awal `© 2026 Kartidaya Sahabat Indonesia. All Rights Reserved`, dapat diedit dan wajib diisi saat menyimpan.
- Foto: tampilkan koleksi bersama, unggah dan pilih tanpa pengguna mengisi URL. Sumber JPEG/PNG/WebP maksimum 20 MB dan 40 juta piksel. Pilihan **Otomatis** membatasi sisi terpanjang 1.200 piksel dan mengompresi; **Ukuran asli** mempertahankan dimensi tetapi memproses ulang. Transparansi dipertahankan dalam PNG; hasil unggah maksimal 5 MB. Setelah pilih file, pengguna harus menekan **Unggah foto**; foto masuk koleksi tetapi tidak mengganti gambar sampai **Gunakan foto** ditekan. Hapus foto hanya setelah peringatan bahwa email lama dapat kehilangan gambar. Koleksi dapat dimuat ulang dan berhalaman.
- Buat HTML email menggunakan tabel, CSS sebaris, gambar HTTPS publik, serta versi teks biasa. Escape semua isi dan validasi URL HTTPS; hindari menyisipkan HTML pengguna secara langsung. Tampilkan pratinjau lengkap yang bisa digulir dan tautannya tidak aktif. Tampilan email bisa berbeda menurut aplikasi penerima.
- Kirim buletin: simpan dahulu; pilih donor, tinjau penerima dan pratinjau personal, lalu konfirmasi kirim nyata melalui Gmail yang terhubung. Validasi tautan dan majalah; kirim per donor secara berurutan; catat berhasil/gagal di riwayat donor dengan `kanal:'email'`, `jenis:'buletin'`, ID buletin. Tambahkan pixel dan konfirmasi penerimaan bila tersedia. Cegah klik ganda, tampilkan hasil, dan catat jumlah berhasil terakhir. Tidak ada pengiriman nyata tanpa konfirmasi.

## 9. Impor, ekspor dan panduan

- Sediakan cadangan JSON untuk data aplikasi, impor JSON, ekspor CSV donor dan Excel enam lembar; beri pengingat cadangan. Impor tidak boleh diam-diam membuang data pengguna atau menimpa pengaturan perangkat tanpa penjelasan. Cadangan JSON bukan cadangan foto/berkas KV.
- Tombol **[?]** di Donor, Tulis, Buletin, Keuangan langsung membuka bab yang sesuai; pengguna tetap bebas memilih bab lain dan mencari. Di halaman lain buka panduan awal. Panduan Buletin menjelaskan cara buat, susun, pilih foto, format, majalah, tautan, kaki, simpan, pratinjau dan kirim dengan langkah sederhana. Jangan arahkan pengguna ke fungsi yang tidak ada.

## 10. Worker Cloudflare dan batas penyimpanan

- D1 juga menyimpan `users`, `sessions`, `aktivitas`; KV `WA_INBOX` menyimpan data foto, majalah, lampiran, tanda dibaca, konfirmasi, antrean dan status WhatsApp. Gunakan binding dan rahasia via konfigurasi Cloudflare, bukan dalam kode.
- Endpoint akun: `/akun/login`, `/akun/daftar`, `/akun/daftar-terbuka`, `/akun/saya`, `/akun/keluar`, `/akun/ganti-password`, `/akun/pengguna`, `/akun/tambah`, `/akun/aktif`, `/akun/aktivitas`, `/akun/catat`; halaman akun `/daftar`.
- Data: `GET /data`, `POST /data/{koleksi}`, `POST /data/{koleksi}/{id}/hapus` atau `DELETE /data/{koleksi}/{id}`, `POST /data/meta/{kunci}`. Batasi nama koleksi/kunci yang diterima.
- Majalah: `POST /majalah`, `POST /majalah-pdf`, `GET /majalah/{id}`, `/majalah/{id}/{halaman}`, `/majalah/{id}/baca`, `/majalah-pdf/{id}.pdf`, `/baca/{id}`, `/baca/{id}/hal/{halaman}`, dan hapus edisi. PDF dibagi maksimal 8 bagian masing-masing 18 MiB.
- Foto buletin: `GET/POST /buletin-foto`, `POST /buletin-foto/{id}/hapus`, gambar publik `GET /buletin-foto/{id}`; daftar sampai 100 per halaman. Validasi ukuran, base64, tipe dan struktur gambar; jangan terima SVG. Foto disimpan bersama metadata per UUID; cache dan propagasi dapat menunda perubahan.
- Lampiran `/lampiran`, kwitansi `/kwitansi`, pixel `/pixel/{id}` dan status, konfirmasi `/terima/{id}` dan status. Gambar kwitansi maksimal 4 MiB dan tersimpan 30 hari. Endpoint status pixel/konfirmasi memproses sampai 200 ID per permintaan. URL publik bukan tempat menyimpan rahasia.
- WhatsApp Worker memakai webhook, antrean, status dan pengiriman Meta Graph API; kanal masih ditunda di UI. Pertahankan tanpa menganggap siap produksi atau mengaktifkannya diam-diam.

## 11. Pemeriksaan penerimaan sebelum selesai

1. Login, akses sesuai halaman, dan data tidak muncul sebelum masuk; kunci saat server tidak dapat dihubungi.
2. Donor, riwayat, pencarian, transaksi, kwitansi, surat dan impor/ekspor bekerja; data sintetis saja.
3. Buat dan simpan buletin, buka ulang, ubah urutan, format dan warna, pilih/unggah foto, pilih majalah, uji tautan di teks dan kaki, serta cek pratinjau dapat digulir.
4. Pengujian pengiriman menggunakan Gmail tiruan; pastikan penerima dan status sesuai, tidak ada pengiriman nyata. Uji tampilan email sebenarnya hanya dengan persetujuan pemilik dan alamat percobaan sendiri.
5. Uji dua perangkat/akun dengan data contoh: sinkron, gagal sambungan, coba ulang, dan penghapusan sengaja; jangan mengklaim konflik serentak sudah aman jika belum ditangani.
6. Uji HP dan komputer, aksesibilitas dasar, keamanan input/URL dan panduan kontekstual. Periksa efek pada data lama. Sesuai aturan di atas, hapus skrip uji baru dan file sementara setelah digunakan; pemilik mempertahankan skrip yang sudah ada saat aturan dibuat.
