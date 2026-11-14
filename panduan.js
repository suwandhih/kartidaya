/* ============================================================
   KARTIDAYA — panduan.js
   Panduan pemakaian yang dibuka dari tombol [?] di bilah atas.

   Kenapa dipisah dari app.js?
   Isinya hanya teks panduan — tidak menyentuh data donor, surat, atau
   pengiriman. Dengan berkas sendiri, teks panduan bisa diubah tanpa
   membaca 7.000 baris app.js, dan tidak ada risiko mengubah logika.

   Bentuknya:
     PANDUAN   daftar bab (judul, ikon, kata kunci, isi HTML)
     cariPanduan(q)   pencarian — fungsi murni, tanpa DOM, supaya bisa diuji
     panduanBuka()    membuka jendela panduan
     panduanPilih()   pindah bab tanpa menutup jendela
     panduanCari()    menampilkan hasil pencarian

   Semua teks memakai bahasa sehari-hari: yang membaca panduan ini adalah
   staf, bukan programmer.
   ============================================================ */

var PANDUAN = [

  /* ---------------- 1. MULAI ---------------- */
  {
    id: 'mulai',
    judul: 'Mulai memakai aplikasi',
    ico: '◈',
    kata: ['masuk', 'login', 'menu', 'halaman', 'online', 'internet', 'password',
           'keluar akun', 'sesi', '12 jam', 'tampilan', 'tema'],
    isi: '' +
      '<p class="pd-lead">Kartidaya mencatat data donor dan seluruh surat yang ' +
        'keluar maupun masuk untuk tiap donor.</p>' +

      '<h4>Masuk</h4>' +
      '<ol class="pd-langkah">' +
        '<li>Buka alamat aplikasi, lalu isi <b>email</b> dan <b>password</b> yang ' +
          'diberikan admin. Kalau belum punya akun, minta admin membuatkannya.</li>' +
        '<li>Setelah masuk, menu ada di sisi kiri (komputer) atau di deretan tab ' +
          'bawah (HP).</li>' +
        '<li>Kalau lupa menutup aplikasi, sesi tetap berlaku <b>12 jam</b>. ' +
          'Setelah itu diminta masuk lagi.</li>' +
      '</ol>' +

      '<h4>Menu yang ada</h4>' +
      '<div class="table-wrap"><table><tbody>' +
        '<tr><td><b>Beranda</b></td><td>Ringkasan jumlah donor, surat belum dibaca, ' +
          'dan pengingat mencadangkan data</td></tr>' +
        '<tr><td><b>Masuk</b></td><td>Semua surat/pesan yang diterima dari donor</td></tr>' +
        '<tr><td><b>Keluar</b></td><td>Semua surat yang sudah kita kirim</td></tr>' +
        '<tr><td><b>Donor</b></td><td>Daftar donor; klik satu donor untuk membuka ' +
          '<b>riwayat surat</b>nya</td></tr>' +
        '<tr><td><b>Tulis</b></td><td>Menyusun dan mengirim surat</td></tr>' +
        '<tr><td><b>Keuangan</b></td><td>Catatan donor masuk; menjadi sumber angka kwitansi</td></tr>' +
        '<tr><td><b>Kategori</b></td><td>Pengelompokan donor</td></tr>' +
        '<tr><td><b>Akun</b></td><td>Hanya untuk admin: daftar akun dan catatan aktivitas</td></tr>' +
        '<tr><td><b>Setelan</b></td><td>Gmail, pengaman pengiriman, cadangan data, tampilan</td></tr>' +
      '</tbody></table></div>' +

      '<h4>Dua hal yang perlu diingat</h4>' +
      '<ul>' +
        '<li><b>Butuh internet.</b> Data disimpan di server supaya bisa dipakai ' +
          'bersama. Kalau internet mati, aplikasi mengunci diri — ini disengaja ' +
          'supaya tidak ada perubahan yang tampak tersimpan padahal hilang.</li>' +
        '<li><b>Data dipakai bersama.</b> Semua akun melihat data yang sama, bukan ' +
          'data masing-masing. Yang berbeda hanya catatan siapa melakukan apa.</li>' +
      '</ul>' +

      '<p><button class="btn sm" data-panduan-halaman="pengaturan">Buka halaman Setelan</button></p>'
  },

  /* ---------------- 2. ISTILAH ---------------- */
  {
    id: 'istilah',
    judul: 'Istilah yang dipakai',
    ico: '▤',
    kata: ['istilah', 'arti', 'kamus', 'donor', 'pic', 'instansi', 'utama', 'kategori',
           'program', 'kwitansi', 'kode', 'template', 'token', 'kanal', 'status',
           'draft', 'simulasi', 'riwayat surat', 'majalah', 'lampiran', 'cc'],
    isi: '' +
      '<p class="pd-lead">Istilah di aplikasi ini sengaja dibuat pendek. ' +
        'Kalau ada kata yang membingungkan, kemungkinan besar ada di daftar ini.</p>' +

      '<h4>Data donor</h4>' +
      '<div class="table-wrap"><table><tbody>' +
        '<tr><td><b>Donor</b></td><td>Orang atau lembaga yang didukung. ' +
          'Satu donor = satu baris di menu Donor.</td></tr>' +
        '<tr><td><b>ID-DONOR</b></td><td>Kode unik donor, bentuknya ' +
          '<span class="mono">[X]99999[Z]</span> — misalnya <span class="mono">F00004R</span>. ' +
          'Dibuat otomatis, boleh diubah.</td></tr>' +
        '<tr><td><b>PIC</b></td><td>Orang yang dituju (penanggung jawab) di donor itu.</td></tr>' +
        '<tr><td><b>Instansi</b></td><td>Lembaga, gereja, atau yayasan donor. Boleh kosong.</td></tr>' +
        '<tr><td><b>Panggilan</b></td><td>Ibu / Bapak / Saudara / Saudari. Dipakai di depan nama ' +
          'saat surat ditulis.</td></tr>' +
        '<tr><td><b>Utama</b></td><td>Centang penentu <b>email atau HP mana yang dipakai ' +
          'saat mengirim</b>. Kolom lain tetap tersimpan dan tetap dipakai untuk ' +
          'mengenali surat yang masuk.</td></tr>' +
        '<tr><td><b>Kategori</b></td><td>Pengelompokan donor, misalnya Member Support, ' +
          'Church Local, Organization. Bisa ditambah sendiri.</td></tr>' +
        '<tr><td><b>Program</b></td><td>Tujuan pemberian donor, misalnya Beasiswa Anak ' +
          'Pelayan. Dipakai di menu Keuangan.</td></tr>' +
      '</tbody></table></div>' +

      '<h4>Surat</h4>' +
      '<div class="table-wrap"><table><tbody>' +
        '<tr><td><b>Riwayat surat</b></td><td>Semua surat satu donor, keluar dan masuk, ' +
          'diurutkan menurut waktu. Dulu disebut &ldquo;buku donor&rdquo;.</td></tr>' +
        '<tr><td><b>Kotak Masuk / Keluar</b></td><td>Daftar surat dari/per <b>semua</b> donor, ' +
          'bukan satu donor.</td></tr>' +
        '<tr><td><b>Surat keluar</b></td><td>Surat yang kita kirim. ' +
          '<b>Surat masuk</b> = surat atau pesan yang donor kirim.</td></tr>' +
        '<tr><td><b>Status surat keluar</b></td><td><b>Draft</b> = baru dicatat, belum ' +
          'dikirim · <b>Terkirim</b> = sudah dikirim · <b>Gagal</b> = gagal, alasannya ' +
          'tertulis di surat.</td></tr>' +
        '<tr><td><b>Status surat masuk</b></td><td><b>Belum dibaca</b> (kuning), ' +
          '<b>Dibaca</b> (biru), <b>Dibalas</b> (hijau).</td></tr>' +
        '<tr><td><b>Template</b></td><td>Contoh surat siap pakai. Bisa dipilih, diubah, ' +
          'atau ditambah sendiri.</td></tr>' +
        '<tr><td><b>Token</b></td><td>Kode berkurawal seperti <span class="mono">{/PIC}</span> ' +
          'yang otomatis diganti data donor saat surat dikirim. Jadi satu surat bisa ' +
          'dikirim ke banyak donor tanpa mengetik nama satu per satu.</td></tr>' +
        '<tr><td><b>Isian serba guna</b></td><td>Lima kotak isian bebas untuk hal yang ' +
          'tidak ada di data donor — tanggal acara, waktu, tempat, pembicara.</td></tr>' +
        '<tr><td><b>Cc</b></td><td>Alamat tambahan yang menerima salinan surat.</td></tr>' +
        '<tr><td><b>Lampiran</b></td><td>Berkas PDF, foto, atau dokumen yang ikut terkirim. ' +
          'Maksimal 10 MB per berkas.</td></tr>' +
        '<tr><td><b>Kanal</b></td><td>Jalur pengiriman. Saat ini <b>Email</b>; WhatsApp ' +
          'ditunda sampai nomor resmi tersedia.</td></tr>' +
      '</tbody></table></div>' +

      '<h4>Kwitansi &amp; majalah</h4>' +
      '<div class="table-wrap"><table><tbody>' +
        '<tr><td><b>Kwitansi</b></td><td>Tanda terima yang <b>tercetak di dalam email</b>, ' +
          'bukan lampiran. Angkanya diambil dari menu Keuangan.</td></tr>' +
        '<tr><td><b>Kode kwitansi</b></td><td><span class="mono">KWT-20261113-0001</span> — ' +
          'menandai satu transaksi keuangan.</td></tr>' +
        '<tr><td><b>Kode kiriman</b></td><td><span class="mono">KRM-20261113-A1B2</span> — ' +
          'menandai satu pengiriman ke satu donor. Berbeda setiap kali kirim, jadi bisa ' +
          'dipakai saat donor bertanya.</td></tr>' +
        '<tr><td><b>Majalah</b></td><td>Berkas PDF yang diubah jadi halaman gambar. ' +
          'Email memuat sampul dan tombol baca, bukan seluruh halamannya.</td></tr>' +
      '</tbody></table></div>' +

      '<h4>Keadaan pengiriman</h4>' +
      '<div class="table-wrap"><table><tbody>' +
        '<tr><td><b>Mode simulasi</b></td><td>Gmail belum terhubung. Surat hanya ' +
          '<b>dicatat</b> sebagai Terkirim, tidak benar-benar dikirim. Aplikasi selalu ' +
          'meminta persetujuan sebelum melakukan ini.</td></tr>' +
        '<tr><td><b>Tanda dibaca (✓✓)</b></td><td>Perkiraan apakah email dibuka, dibaca dari ' +
          'gambar kecil di dalam email. Bisa salah: penerima yang memblokir gambar tetap ' +
          'tertulis belum dibaca.</td></tr>' +
        '<tr><td><b>Konfirmasi penerimaan (✓)</b></td><td>Penerima menekan tombol ' +
          '&ldquo;Konfirmasi sudah menerima&rdquo; di email. Ini bukti nyata, bukan perkiraan.</td></tr>' +
        '<tr><td><b>Data bersama</b></td><td>Data disimpan di server Cloudflare dan dipakai ' +
          'bersama semua akun. Browser hanya menyimpan salinan sementara.</td></tr>' +
      '</tbody></table></div>' +

      '<p class="tiny muted">Istilah teknis yang tidak perlu diketahui sehari-hari ' +
        'sengaja tidak dimasukkan ke daftar ini.</p>'
  },

  /* ---------------- 3. ENTRY DATA DONOR ---------------- */
  {
    id: 'data-donor',
    judul: 'Mengisi data donor',
    ico: '☰',
    kata: ['tambah donor', 'entry', 'isi data', 'ubah donor', 'hapus donor', 'email 2',
           'hp 2', 'utama', 'id donor', 'buat id', 'kembar', 'dobel', 'ganda',
           'wajib', 'alamat', 'kategori'],
    isi: '' +
      '<p class="pd-lead">Data donor adalah sumber semua isi surat. Kalau data di sini ' +
        'benar, surat akan terisi sendiri dengan benar.</p>' +

      '<h4>Menambah donor</h4>' +
      '<ol class="pd-langkah">' +
        '<li>Buka menu <b>Donor</b>, tekan <b>+ Tambah</b>.</li>' +
        '<li>Isi <b>PIC</b> atau <b>Instansi</b> — minimal salah satu. Kalau keduanya ' +
          'kosong, data tidak bisa disimpan.</li>' +
        '<li>Isi <b>email</b> (dan <b>email kedua</b> kalau ada). Untuk pengiriman surat, ' +
          'email hampir selalu diperlukan.</li>' +
        '<li>ID-DONOR boleh dibiarkan kosong. Kalau ingin melihat bentuknya lebih dulu, ' +
          'tekan <b>Buat ID</b>.</li>' +
        '<li>Tekan <b>Simpan</b>.</li>' +
      '</ol>' +

      '<h4>Arti kolom di form donor</h4>' +
      '<div class="table-wrap"><table><tbody>' +
        '<tr><td><b>ID-DONOR</b></td><td>Kode unik. Huruf pertama diambil dari Instansi; ' +
          'kalau Instansi kosong, dari PIC. Angka 5 digit berurutan per huruf. ' +
          'Huruf terakhir bisa diubah (bawaan <span class="mono">R</span>).</td></tr>' +
        '<tr><td><b>Kategori</b></td><td>Pilih dari daftar yang ada di menu Kategori.</td></tr>' +
        '<tr><td><b>Panggilan</b></td><td>Ibu / Bapak / Saudara / Saudari. Muncul di depan ' +
          'nama pada surat.</td></tr>' +
        '<tr><td><b>PIC / Nama Lengkap</b></td><td>PIC dipakai sebagai nama utama di daftar ' +
          'dan surat. Nama Lengkap untuk keterangan tambahan.</td></tr>' +
        '<tr><td><b>Instansi</b></td><td>Nama lembaga/gereja/yayasan. Boleh kosong.</td></tr>' +
        '<tr><td><b>Email &amp; Email 2</b></td><td>Dua alamat. Yang dicentang <b>Utama</b> ' +
          'itulah tujuan pengiriman; yang satunya tetap dipakai untuk mengenali surat masuk.</td></tr>' +
        '<tr><td><b>Nomor HP &amp; HP 2</b></td><td>Sama seperti email: yang dicentang ' +
          '<b>Utama</b> yang dipakai.</td></tr>' +
        '<tr><td><b>Pengiriman melalui</b></td><td>Catatan saja: Email / WhatsApp / POS / ' +
          'Kurir / Lainnya.</td></tr>' +
        '<tr><td><b>Date Start, Tgl Lahir, Asal Gereja</b></td><td>Keterangan tambahan, ' +
          'boleh dikosongkan.</td></tr>' +
        '<tr><td><b>Alamat Lengkap</b></td><td>Dipakai tombol <b>Cetak Alamat</b> untuk ' +
          'kiriman lewat POS atau kurir.</td></tr>' +
        '<tr><td><b>Catatan</b></td><td>Catatan bebas, tidak ikut tercetak di surat.</td></tr>' +
      '</tbody></table></div>' +

      '<h4>Tentang centang &ldquo;Utama&rdquo;</h4>' +
      '<ul>' +
        '<li>Hanya <b>satu</b> yang bisa jadi utama — memilih yang kedua otomatis ' +
          'melepas yang pertama.</li>' +
        '<li>Kolom yang kosong tidak bisa dicentang.</li>' +
        '<li>Kalau yang dicentang utama ternyata kosong, aplikasi memakai kolom lain ' +
          'yang terisi. Ini supaya surat tidak gagal terkirim hanya karena salah centang.</li>' +
        '<li>Token <span class="mono">{/EMAIL}</span> dan <span class="mono">{/HP}</span> ' +
          'berisi yang utama; <span class="mono">{/EMAIL2}</span> dan ' +
          '<span class="mono">{/HP2}</span> berisi yang satunya.</li>' +
      '</ul>' +

      '<h4>Peringatan &ldquo;data sudah dipakai donor lain&rdquo;</h4>' +
      '<p>Aplikasi memeriksa email, nomor HP, dan nama PIC. Kalau sudah dipakai donor ' +
        'lain, muncul peringatan. Ini bukan larangan — data tetap bisa disimpan — tetapi ' +
        'akibatnya perlu diketahui: <b>surat masuk ke alamat itu hanya masuk ke satu ' +
        'donor saja</b> (yang pertama cocok), sehingga donor kedua riwayatnya kosong.</p>' +

      '<h4>Mengubah dan menghapus</h4>' +
      '<ul>' +
        '<li><b>Ubah:</b> klik kartu donor untuk membuka riwayatnya, lalu tekan ' +
          '<b>Ubah Data</b>.</li>' +
        '<li><b>Hapus:</b> di dalam form ubah, tombol <b>Hapus</b> berwarna merah. ' +
          '<b>Seluruh surat donor itu ikut terhapus</b> dan tidak bisa dibatalkan.</li>' +
      '</ul>' +

      '<p><button class="btn sm" data-panduan-halaman="donor">Buka halaman Donor</button></p>'
  },

  /* ---------------- 4. KATEGORI & PROGRAM ---------------- */
  {
    id: 'kategori-program',
    judul: 'Kategori &amp; program',
    ico: '▦',
    kata: ['kategori', 'program', 'kelola', 'tambah kategori', 'nonaktif'],
    isi: '' +
      '<p class="pd-lead">Dua hal berbeda: <b>kategori</b> mengelompokkan donor, ' +
        '<b>program</b> menjelaskan tujuan pemberian.</p>' +

      '<h4>Kategori</h4>' +
      '<ul>' +
        '<li>Buka menu <b>Kategori</b> untuk melihat daftar, menambah, mengubah nama, ' +
          'atau menghapus.</li>' +
        '<li>Mengubah nama kategori otomatis ikut mengubah kategori semua donor ' +
          'yang memakainya.</li>' +
        '<li>Menghapus kategori membuat donor di dalamnya menjadi <b>tanpa kategori</b>. ' +
          'Donornya tidak hilang.</li>' +
      '</ul>' +

      '<h4>Program</h4>' +
      '<ul>' +
        '<li>Dikelola dari menu <b>Keuangan</b> → <b>Kelola program</b>.</li>' +
        '<li>Program dipakai saat mencatat transaksi, dan namanya ikut tercetak di ' +
          'kwitansi sebagai keterangan &ldquo;Untuk&rdquo;.</li>' +
        '<li>Program yang tidak dipakai lagi bisa dinonaktifkan — transaksi lama ' +
          'tetap aman.</li>' +
      '</ul>' +

      '<p><button class="btn sm" data-panduan-halaman="kategori">Buka halaman Kategori</button></p>'
  },

  /* ---------------- 5. KEUANGAN ---------------- */
  {
    id: 'keuangan',
    judul: 'Mencatat keuangan (untuk kwitansi)',
    ico: '◫',
    kata: ['keuangan', 'kwitansi', 'rp 0', 'nol', 'transaksi', 'jumlah', 'program',
           'mata uang', 'riwayat kirim', 'kode kwitansi', 'donor masuk'],
    isi: '' +
      '<p class="pd-lead">Kwitansi yang dikirim ke donor <b>mengambil angkanya dari ' +
        'menu Keuangan</b>. Tanpa catatan di sini, kwitansi akan berisi Rp 0.</p>' +

      '<h4>Mencatat satu transaksi</h4>' +
      '<ol class="pd-langkah">' +
        '<li>Buka menu <b>Keuangan</b>, tekan <b>+ Tambah</b>.</li>' +
        '<li>Pilih donor: ketik namanya, atau klik huruf awal untuk melompat.</li>' +
        '<li>Isi <b>Tanggal donor</b>.</li>' +
        '<li>Pada baris <b>program · mata uang · jumlah</b>, pilih program dan isi nominal. ' +
          'Butuh baris lain? Tekan <b>+ Tambah program</b>.</li>' +
        '<li>Periksa <b>Total</b> di bawah baris — angkanya dipisah per mata uang, ' +
          'tidak digabung.</li>' +
        '<li>Tekan <b>Simpan</b>.</li>' +
      '</ol>' +

      '<h4>Yang perlu diketahui</h4>' +
      '<ul>' +
        '<li>Satu donor boleh punya beberapa transaksi. Kwitansi memakai <b>transaksi ' +
          'terbaru</b>, kecuali Anda memilih transaksi lain di halaman Tulis.</li>' +
        '<li>Mata uang dipilih <b>per baris</b>, jadi satu transaksi boleh memuat rupiah ' +
          'dan dolar sekaligus.</li>' +
        '<li>Kode kwitansi <span class="mono">KWT-…</span> diberikan otomatis dan dipakai ' +
          'donor saat menghubungi bagian keuangan.</li>' +
        '<li>Saringan <b>Belum pernah dikirim</b> membantu mencari transaksi yang ' +
          'kwitansinya belum pernah dikirim.</li>' +
        '<li>Tombol <b>🕘 Riwayat kirim</b> menampilkan semua kwitansi yang pernah ' +
          'dikirim, urut tanggal.</li>' +
      '</ul>' +

      '<div class="warnbox"><b>Kalau kwitansi berisi Rp 0:</b> periksa tiga hal — ' +
        '(1) donor itu sudah punya transaksi di Keuangan, (2) penerima yang dipilih ' +
        'memang donor yang punya transaksi itu, (3) transaksi yang dipilih di halaman ' +
        'Tulis cocok dengan donornya.</div>' +

      '<p><button class="btn sm" data-panduan-halaman="keuangan">Buka halaman Keuangan</button></p>'
  },

  /* ---------------- 6. MENULIS SURAT ---------------- */
  {
    id: 'tulis',
    judul: 'Menulis surat',
    ico: '✎',
    kata: ['tulis surat', 'template', 'token', 'format', 'tebal', 'miring', 'stabilo',
           'poin', 'nomor', 'isian serba guna', 'subjek', 'cc', 'pratinjau langsung'],
    isi: '' +
      '<p class="pd-lead">Halaman <b>Tulis</b> berisi empat bagian berurutan: ' +
        'Template · Penerima · Pratinjau · Kirim.</p>' +

      '<h4>Langkah menulis</h4>' +
      '<ol class="pd-langkah">' +
        '<li>Pilih <b>Template</b>. Isi surat dan subjeknya langsung terisi dan bisa ' +
          'diubah sesukanya.</li>' +
        '<li>Periksa <b>Subjek</b>. Token di subjek juga ikut diganti.</li>' +
        '<li>Isi <b>Cc</b> kalau perlu salinan ke alamat lain (boleh beberapa, ' +
          'pisahkan dengan koma).</li>' +
        '<li>Tulis isi surat. Klik tombol token untuk menyisipkan data donor.</li>' +
        '<li>Kalau perlu, aktifkan <b>Lampirkan kwitansi</b>, <b>Lampirkan majalah</b>, ' +
          'atau <b>Lampiran berkas</b>.</li>' +
      '</ol>' +

      '<h4>Token yang tersedia</h4>' +
      '<div class="table-wrap"><table><tbody>' +
        '<tr><td class="mono">{/PIC}</td><td>Panggilan + nama PIC — mis. &ldquo;Bapak Ferry&rdquo;</td></tr>' +
        '<tr><td class="mono">{/NAMA}</td><td>Nama PIC saja</td></tr>' +
        '<tr><td class="mono">{/PANGGILAN}</td><td>Ibu / Bapak / Saudara / Saudari</td></tr>' +
        '<tr><td class="mono">{/INST}</td><td>Nama instansi</td></tr>' +
        '<tr><td class="mono">{/NAMA_LENGKAP}</td><td>Nama lengkap</td></tr>' +
        '<tr><td class="mono">{/ID}</td><td>ID-DONOR</td></tr>' +
        '<tr><td class="mono">{/KATEGORI}</td><td>Kategori donor</td></tr>' +
        '<tr><td class="mono">{/EMAIL} &middot; {/EMAIL2}</td><td>Email utama dan email kedua</td></tr>' +
        '<tr><td class="mono">{/HP} &middot; {/HP2}</td><td>Nomor HP utama dan kedua</td></tr>' +
        '<tr><td class="mono">{/ALAMAT}</td><td>Alamat lengkap</td></tr>' +
        '<tr><td class="mono">{/TANGGAL}</td><td>Tanggal hari ini</td></tr>' +
        '<tr><td class="mono">{/ISI1} … {/ISI5}</td><td>Lima isian serba guna</td></tr>' +
      '</tbody></table></div>' +
      '<p class="tiny muted">Token yang tidak dikenal dibiarkan apa adanya, jadi salah ' +
        'ketik akan terlihat di pratinjau — bukan hilang diam-diam.</p>' +

      '<h4>Format sederhana di isi surat</h4>' +
      '<div class="table-wrap"><table><tbody>' +
        '<tr><td class="mono">**tebal**</td><td><b>tebal</b></td></tr>' +
        '<tr><td class="mono">*miring*</td><td><i>miring</i></td></tr>' +
        '<tr><td class="mono">==stabilo==</td><td>huruf disorot kuning</td></tr>' +
        '<tr><td class="mono">- teks</td><td>daftar berpoin (awal baris)</td></tr>' +
        '<tr><td class="mono">1. teks</td><td>daftar bernomor (awal baris)</td></tr>' +
      '</tbody></table></div>' +
      '<p>Tombol <b>B</b>, <i>I</i>, 🖍, •, dan 1. di atas kotak tulis menuliskan ' +
        'penanda itu untuk Anda: blok dulu teksnya, lalu tekan tombol. ' +
        '<b>Hapus format</b> membuang semua penanda pada bagian yang diblok.</p>' +
      '<p class="tiny muted">Garis bawah (<span class="mono">_</span>) sengaja tidak ' +
        'dijadikan penanda, supaya nama berkas seperti ' +
        '<span class="mono">laporan_2026.pdf</span> tidak berubah.</p>' +

      '<h4>Isian serba guna</h4>' +
      '<p>Lima kotak di bawah kotak tulis untuk hal yang tidak ada di data donor: ' +
        'hari/tanggal acara, waktu, tempat, pembicara, catatan tambahan. Isi sekali, ' +
        'lalu pakai di surat mana pun lewat token <span class="mono">{/ISI1}</span>…' +
        '<span class="mono">{/ISI5}</span>. Nilainya tersimpan, jadi tidak perlu ' +
        'diketik ulang besok.</p>' +

      '<h4>Pratinjau langsung</h4>' +
      '<p>Di bawah kotak tulis ada kotak <b>Hasil yang dilihat penerima</b> yang ' +
        'diperbarui sambil Anda mengetik. Fungsinya hanya memastikan format sudah benar; ' +
        'untuk melihat bentuk email yang sesungguhnya, pakai <b>👁 Pratinjau email</b> ' +
        '(lihat bab <button class="pd-tautan" data-pd-pilih="tes">Tes sebelum kirim</button>).</p>' +

      '<p><button class="btn sm" data-panduan-halaman="surat">Buka halaman Tulis</button></p>'
  },

  /* ---------------- 7. KIRIM EMAIL ---------------- */
  {
    id: 'kirim-email',
    judul: 'Mengirim email',
    ico: '✉',
    kata: ['kirim', 'mengirim email', 'gmail', 'hubungkan', 'simulasi', 'gagal',
           'penerima', 'kirim massal', 'draft', 'kwitansi', 'majalah', 'lampiran'],
    isi: '' +
      '<p class="pd-lead">Surat dikirim lewat akun Gmail yang terhubung. Setiap ' +
        'penerima menerima surat sendiri — bukan satu email dengan banyak alamat.</p>' +

      '<h4>Sebelum kirim pertama kali</h4>' +
      '<ol class="pd-langkah">' +
        '<li>Buka <b>Setelan</b> → kartu <b>Gmail</b>.</li>' +
        '<li>Tekan <b>Hubungkan Gmail</b>, lalu pilih akun dan setujui izinnya.</li>' +
        '<li>Kembali ke menu <b>Tulis</b>. Di bagian <b>4 · Kirim</b> harus tertulis ' +
          '<b>Gmail aktif</b>.</li>' +
      '</ol>' +
      '<p class="tiny muted">Kalau tertulis <b>Mode simulasi</b>, surat tetap tercatat ' +
        'tetapi <b>tidak benar-benar terkirim</b>. Aplikasi akan meminta persetujuan ' +
        'sebelum mencatatnya.</p>' +

      '<h4>Mengirim</h4>' +
      '<ol class="pd-langkah">' +
        '<li>Susun surat di halaman Tulis (lihat bab ' +
          '<button class="pd-tautan" data-pd-pilih="tulis">Menulis surat</button>).</li>' +
        '<li>Di bagian <b>2 · Penerima</b>, centang donor yang dituju. Gunakan kotak cari ' +
          'kalau daftarnya panjang; <b>Pilih semua</b> hanya untuk pengiriman massal.</li>' +
        '<li>Perhatikan tanda peringatan: penerima tanpa alamat email tidak akan terkirim ' +
          'dan akan bertanda <b>Gagal</b>.</li>' +
        '<li>Periksa dulu — lihat bab ' +
          '<button class="pd-tautan" data-pd-pilih="tes">Tes sebelum kirim</button>. ' +
          'Kalau pengaman wajib-periksa aktif (bawaan), tombol kirim membuka layar ' +
          'periksa lebih dulu.</li>' +
        '<li>Tekan <b>➤ Kirim sekarang</b>. Tunggu sampai muncul pesan hasil.</li>' +
      '</ol>' +

      '<h4>Hasil pengiriman</h4>' +
      '<ul>' +
        '<li>Pesan di bawah layar menyebut jumlah berhasil dan gagal, beserta alasannya.</li>' +
        '<li>Setiap penerima mendapat satu baris di riwayat surat donornya, dengan status ' +
          '<b>Terkirim</b> atau <b>Gagal</b>.</li>' +
        '<li>Kalau ada yang gagal, perbaiki penyebabnya (biasanya email kosong) lalu ' +
          'kirim ulang ke penerima itu saja.</li>' +
        '<li><b>Simpan Draft</b> hanya mencatat surat sebagai Draft di riwayat. ' +
          'Belum ada tombol untuk melanjutkan draft — untuk sekarang, tulis ulang ' +
          'suratnya.</li>' +
      '</ul>' +

      '<h4>Kwitansi, majalah, dan lampiran</h4>' +
      '<ul>' +
        '<li><b>Kwitansi</b> tercetak di dalam email, angkanya per donor dari menu Keuangan.</li>' +
        '<li><b>Majalah</b> dikirim sebagai sampul + tombol baca, supaya email tetap ringan.</li>' +
        '<li><b>Lampiran berkas</b> diunggah lebih dulu. Kalau unggahan gagal, surat tetap ' +
          'dikirim tanpa berkas itu dan Anda diberi tahu.</li>' +
      '</ul>' +

      '<p><button class="btn sm" data-panduan-halaman="surat">Buka halaman Tulis</button> ' +
        '<button class="btn sm" data-panduan-halaman="pengaturan">Buka Setelan</button></p>'
  },

  /* ---------------- 8. TES SEBELUM KIRIM ---------------- */
  {
    id: 'tes',
    judul: 'Tes sebelum kirim',
    ico: '🔍',
    kata: ['tes', 'uji', 'pratinjau', 'periksa', 'sebelum kirim', 'kirim ke saya sendiri',
           'email uji', 'gambar diblokir', 'versi teks', 'salah kirim', 'checklist'],
    isi: '' +
      '<p class="pd-lead">Ada tiga cara memeriksa, dari yang paling cepat sampai yang ' +
        'paling meyakinkan. Lakukan minimal cara 2 sebelum mengirim ke donor sungguhan.</p>' +

      '<h4>Cara 1 — 👁 Pratinjau email (paling cepat)</h4>' +
      '<p>Di bagian <b>3 · Pratinjau</b>, tekan <b>👁 Pratinjau email</b>. Muncul tampilan ' +
        'seperti klien email, dengan tiga pilihan:</p>' +
      '<div class="table-wrap"><table><tbody>' +
        '<tr><td><b>🖥 Komputer / 📱 HP</b></td><td>Melihat lebar tampilan di layar besar ' +
          'dan di HP.</td></tr>' +
        '<tr><td><b>🖼 Gambar tampil / 🚫 Gambar diblokir</b></td><td>Banyak penerima ' +
          'membuka email sebelum gambar diizinkan. Coba mode <b>diblokir</b>: apakah isi ' +
          'surat masih terbaca?</td></tr>' +
        '<tr><td><b>Tampilan email / Versi teks</b></td><td>Versi teks adalah yang dilihat ' +
          'penerima mode teks. Pastikan tidak ada penanda seperti <span class="mono">**</span> ' +
          'yang tertinggal.</td></tr>' +
      '</tbody></table></div>' +
      '<p class="tiny muted">Pratinjau dibuat dengan fungsi yang sama dengan pengirim, ' +
        'tetapi tampilan bisa sedikit berbeda di Outlook atau Yahoo.</p>' +

      '<h4>Cara 2 — 🔍 Periksa sebelum kirim (paling penting)</h4>' +
      '<p>Tekan <b>🔍 Periksa sebelum kirim</b>, atau langsung tombol kirim kalau ' +
        'pengaman wajib-periksa aktif. Yang ditampilkan:</p>' +
      '<ul>' +
        '<li><b>Daftar penerima</b> beserta alamat emailnya — di sinilah salah pilih ' +
          'penerima terlihat.</li>' +
        '<li><b>Jumlah kwitansi per penerima</b> — pastikan angkanya sama dengan catatan ' +
          'Anda, bukan Rp 0.</li>' +
        '<li><b>Isi surat</b> seperti yang akan diterima, termasuk Cc.</li>' +
        '<li><b>Kwitansi &amp; majalah</b> yang ikut terkirim.</li>' +
        '<li><b>Tombol konfirmasi</b> yang akan dilihat donor di emailnya.</li>' +
        '<li>Kotak <b>Perlu diperhatikan</b> berisi hal yang bisa membuat pengiriman gagal.</li>' +
      '</ul>' +
      '<p>Kalau daftar itu sudah benar, tekan <b>➤ Kirim sekarang</b> dari layar periksa. ' +
        'Kalau ada yang salah, tekan <b>Kembali periksa</b> — belum ada yang terkirim.</p>' +

      '<h4>Cara 3 — ✉ Kirim ke saya sendiri dulu (paling meyakinkan)</h4>' +
      '<p>Tombol ini mengirim <b>satu salinan</b> ke alamat uji Anda. Salinan memakai ' +
        'tanda dibaca dan tombol konfirmasi yang sama seperti surat sungguhan, jadi ' +
        'Anda bisa membuktikan keduanya bekerja.</p>' +
      '<ul>' +
        '<li>Subjeknya diberi awalan <span class="mono">[UJI]</span> supaya mudah dikenali.</li>' +
        '<li>Salinan ini <b>tidak masuk riwayat surat donor</b>.</li>' +
        '<li>Alamat tujuan diatur di <b>Setelan</b> → <b>Pengaman pengiriman</b> → ' +
          '<b>Alamat email uji</b>. Dikosongkan berarti memakai akun Gmail yang terhubung.</li>' +
        '<li>Hasilnya tampil sebagai satu baris kecil di halaman Tulis: status ' +
          '<b>✓✓ Dibaca</b> dan <b>✓ Dikonfirmasi</b>.</li>' +
      '</ul>' +

      '<h4>Daftar periksa sebelum kirim sungguhan</h4>' +
      '<ol class="pd-langkah">' +
        '<li>Penerima benar — bukan donor yang mirip namanya.</li>' +
        '<li>Jumlah kwitansi benar dan bukan Rp 0.</li>' +
        '<li>Isi surat tidak menyisakan token mentah seperti <span class="mono">{/PIC}</span>.</li>' +
        '<li>Cc hanya berisi alamat yang memang seharusnya menerima salinan.</li>' +
        '<li>Lampiran yang terpasang memang yang dimaksud.</li>' +
      '</ol>' +

      '<p class="tiny muted">Pengaman <b>Wajib periksa sebelum kirim</b> aktif secara ' +
        'bawaan dan bisa dimatikan di Setelan → Pengaman pengiriman. Sebaiknya dibiarkan ' +
        'aktif selama masih tahap uji.</p>'
  },

  /* ---------------- 9. SETELAH TERKIRIM ---------------- */
  {
    id: 'sesudah',
    judul: 'Setelah surat terkirim',
    ico: '↑',
    kata: ['kotak keluar', 'riwayat', 'dibaca', 'konfirmasi', 'balas', 'balas semua',
           'teruskan', 'hapus surat', 'kode kiriman', 'sinkron'],
    isi: '' +
      '<p class="pd-lead">Setelah terkirim, surat bisa dipantau dan dijawab dari dua ' +
        'tempat: Kotak Keluar dan riwayat surat donor.</p>' +

      '<h4>Kotak Keluar</h4>' +
      '<ul>' +
        '<li>Menampilkan semua surat keluar. Di atas daftar ada ringkasan: berapa ' +
          'terkirim, sudah dibaca, belum dibaca, dan sudah dikonfirmasi. Kotak angka itu ' +
          'bisa diklik untuk menyaring.</li>' +
        '<li>Chip <b>✓✓ Dibaca</b> biru berarti penerima kemungkinan besar sudah membuka ' +
          'email. Abu-abu berarti belum ada kabar — bisa juga karena gambarnya diblokir.</li>' +
        '<li>Chip <b>✓ Dikonfirmasi</b> hijau berarti penerima menekan tombol konfirmasi. ' +
          'Ini bukti nyata.</li>' +
        '<li>Untuk memperbarui tanda dibaca tanpa menunggu, tekan <b>✓✓ Cek tanda dibaca</b> ' +
          'atau <b>✓ Cek konfirmasi</b>. Aplikasi juga memeriksanya sendiri tiap 3 menit.</li>' +
      '</ul>' +

      '<h4>Riwayat surat donor</h4>' +
      '<ul>' +
        '<li>Buka menu <b>Donor</b> → klik kartunya. Semua surat donor itu tampil urut waktu.</li>' +
        '<li>Kwitansi, majalah, dan berkas yang pernah dikirim bisa dibuka lagi dari sini.</li>' +
        '<li><b>Kode kiriman</b> (<span class="mono">KRM-…</span>) tertulis di detail surat — ' +
          'pakai kode ini kalau donor bertanya.</li>' +
      '</ul>' +

      '<h4>Menjawab</h4>' +
      '<ul>' +
        '<li><b>✎ Balas</b> membuka halaman Tulis dengan penerima dan subjek <b>Re:</b> ' +
          'sudah terisi.</li>' +
        '<li><b>↩ Balas semua</b> (muncul kalau surat punya Cc) ikut mengisi kolom Cc, ' +
          'tanpa alamat donor sendiri dan tanpa alamat kita.</li>' +
        '<li><b>↪ Teruskan</b> menyalin isi surat beserta keterangan asalnya, dan ' +
          'mengosongkan penerima supaya dipilih sendiri.</li>' +
        '<li>Setelah balasan terkirim, status surat masuk terakhir berubah menjadi ' +
          '<b>Dibalas</b> (hijau).</li>' +
      '</ul>' +

      '<h4>Menghapus surat</h4>' +
      '<p>Hapus dilakukan dari detail surat (tombol merah). Surat hilang dari riwayat dan ' +
        'tidak bisa dikembalikan. Data donor tidak ikut terhapus.</p>' +

      '<p><button class="btn sm" data-panduan-halaman="keluar">Buka Kotak Keluar</button></p>'
  },

  /* ---------------- 10. MASALAH ---------------- */
  {
    id: 'masalah',
    judul: 'Kalau ada masalah',
    ico: '⚠',
    kata: ['masalah', 'solusi', 'galat', 'error', 'gagal', 'tidak bisa', 'access_denied',
           'origin_mismatch', 'kwitansi rp 0', 'tidak terkirim', 'simulasi', 'terkunci',
           'offline', 'tidak muncul', 'data hilang', 'lampiran', 'majalah', 'spam',
           'belum dibaca', 'draft'],
    isi: '' +
      '<p class="pd-lead">Cari gejalanya di bawah. Kalau tidak ada yang cocok, gunakan ' +
        'kotak pencarian di atas panduan ini.</p>' +

      '<h4>Aplikasi bilang &ldquo;Gmail belum terhubung&rdquo; atau surat hanya simulasi</h4>' +
      '<ul>' +
        '<li>Buka <b>Setelan</b> → kartu <b>Gmail</b> → <b>Hubungkan Gmail</b>.</li>' +
        '<li>Pastikan aplikasi dibuka dari alamat <span class="mono">https://</span> atau ' +
          '<span class="mono">http://localhost:8080</span>. Google menolak alamat ' +
          '<span class="mono">file://</span> maupun IP jaringan lokal.</li>' +
      '</ul>' +

      '<h4>Muncul &ldquo;Error 400: origin_mismatch&rdquo;</h4>' +
      '<p>Alamat aplikasi yang sedang dipakai belum terdaftar di Google Cloud Console. ' +
        'Buka <b>Setelan</b> → Gmail: di sana tertulis origin yang sedang dipakai, dengan ' +
        'tombol <b>Salin origin</b>. Tempel di <b>Authorized JavaScript origins</b> pada ' +
        'Client ID yang sama, lalu <b>Save</b>. Berlaku sekitar satu menit.</p>' +

      '<h4>Muncul &ldquo;Access blocked / access_denied&rdquo;</h4>' +
      '<p>Alamat Gmail yang dipakai belum terdaftar sebagai <b>Test user</b> di project ' +
        'Google yang benar. Di halaman Setelan ada nomor project dan tombol menuju ' +
        '<b>Test users</b> project itu. Tambahkan alamatnya, simpan, lalu coba lagi.</p>' +

      '<h4>Kwitansi berisi Rp 0</h4>' +
      '<ul>' +
        '<li>Donor itu belum punya transaksi di menu <b>Keuangan</b>.</li>' +
        '<li>Transaksi yang dipilih di halaman Tulis bukan milik penerima yang dipilih.</li>' +
        '<li>Sudah ada transaksi tetapi tanggal/jumlahnya kosong.</li>' +
      '</ul>' +

      '<h4>Ada penerima yang gagal terkirim</h4>' +
      '<ul>' +
        '<li>Alamat emailnya kosong. Isi <b>Email</b> atau <b>Email 2</b> di data donor.</li>' +
        '<li>Centang <b>Utama</b> tertinggal di kolom yang kosong — aplikasi memakai kolom ' +
          'lain yang terisi, tetapi data sebaiknya dirapikan.</li>' +
        '<li>Alasan pastinya tertulis di detail surat, pada baris <b>Alasan gagal</b>.</li>' +
      '</ul>' +

      '<h4>Tanda ✓✓ tidak berubah jadi Dibaca</h4>' +
      '<p>Penerima kemungkinan memblokir gambar otomatis — hal biasa di Gmail dan Outlook. ' +
        'Ini bukan tanda surat tidak sampai. Untuk kepastian, minta penerima menekan tombol ' +
        '<b>Konfirmasi sudah menerima</b>, atau lihat chip <b>✓ Dikonfirmasi</b>.</p>' +

      '<h4>Konfirmasi penerimaan belum muncul di aplikasi</h4>' +
      '<ul>' +
        '<li>Tekan <b>✓ Cek konfirmasi</b> di Kotak Keluar (pemeriksaan otomatis tiap 3 menit).</li>' +
        '<li>Pastikan <b>Alamat Worker</b> di Setelan terisi — tanpa itu email tidak memuat ' +
          'tombol konfirmasi.</li>' +
      '</ul>' +

      '<h4>Surat masuk tidak masuk ke donor yang benar</h4>' +
      '<p>Biasanya karena dua donor memakai email atau nomor HP yang sama. Surat hanya ' +
        'masuk ke donor pertama yang cocok. Perbaiki datanya (satu alamat untuk satu donor), ' +
        'lalu tekan <b>⇄ Cocokkan ulang</b> di Kotak Masuk.</p>' +

      '<h4>Aplikasi terkunci / &ldquo;Tidak tersambung ke server&rdquo;</h4>' +
      '<ul>' +
        '<li>Aplikasi butuh internet. Periksa sambungan, lalu tekan <b>⟳ Coba lagi</b>.</li>' +
        '<li>Halaman <b>Setelan</b> tetap bisa dibuka saat terkunci, supaya alamat server ' +
          'bisa diperiksa.</li>' +
        '<li>Perubahan yang belum terkirim tidak hilang — dikirim ulang otomatis tiap ' +
          '20 detik.</li>' +
      '</ul>' +

      '<h4>Data yang saya ubah tidak terlihat di komputer rekan</h4>' +
      '<ul>' +
        '<li>Lihat chip di kanan atas: <b>☁ Tersimpan</b> berarti sudah sampai ke server.</li>' +
        '<li>Kalau tertulis <b>Gagal</b>, tunggu sebentar — pengiriman diulang otomatis. ' +
          'Setelah tersambung, minta rekan menekan <b>⟳ Muat ulang dari server</b> di Setelan.</li>' +
        '<li>Kalau dua orang mengubah donor yang sama hampir bersamaan, perubahan terakhir ' +
          'yang menang.</li>' +
      '</ul>' +

      '<h4>Lampiran gagal diunggah</h4>' +
      '<p>Batasnya 10 MB per berkas. Perkecil berkasnya, atau kirim tautan unduhan ' +
        'di isi surat. Surat tetap terkirim walau lampirannya gagal — Anda akan diberi tahu.</p>' +

      '<h4>Majalah hilang atau tidak bisa dilampirkan</h4>' +
      '<p>Berkas majalah disimpan di server, bukan di browser. Kalau catatannya tertinggal ' +
        'tetapi berkasnya sudah tidak ada, aplikasi memperingatkan. Unggah ulang PDF-nya.</p>' +

      '<h4>Draft tidak bisa dilanjutkan</h4>' +
      '<p>Benar — untuk sekarang Draft hanya tercatat di riwayat, belum bisa dibuka lagi ' +
        'untuk dilanjutkan. Tulis ulang suratnya, atau gunakan <b>Simpan sebagai template</b> ' +
        'kalau isinya akan dipakai lagi.</p>' +

      '<h4>Email masuk folder spam penerima</h4>' +
      '<p>Ini soal pengaturan email, bukan aplikasi. Hal yang membantu: subjek yang wajar, ' +
        'tidak mengirim ke banyak alamat sekaligus dalam satu menit, dan penerima menandai ' +
        'pengirim sebagai bukan spam sekali saja.</p>'
  },

  /* ---------------- 11. KEBIASAAN AMAN ---------------- */
  {
    id: 'kebiasaan',
    judul: 'Kebiasaan yang aman',
    ico: '🛡',
    kata: ['cadangan', 'backup', 'ekspor', 'json', 'hapus', 'aman', 'kebiasaan', 'akun'],
    isi: '' +
      '<p class="pd-lead">Beberapa kebiasaan kecil yang mencegah pekerjaan hilang.</p>' +

      '<h4>Cadangkan berkala</h4>' +
      '<ul>' +
        '<li>Di <b>Beranda</b> muncul pengingat kalau lebih dari 7 hari belum mencadangkan.</li>' +
        '<li>Cadangan dibuat lewat <b>Setelan</b> → <b>Data</b> → <b>↓ Ekspor JSON</b>. ' +
          'Simpan berkasnya di tempat yang aman.</li>' +
        '<li><b>Ekspor Excel</b> berguna untuk dilihat orang lain, tetapi bukan cadangan ' +
          'yang bisa dipulihkan. Untuk memulihkan, pakai JSON.</li>' +
      '</ul>' +

      '<h4>Hati-hati pada tombol merah</h4>' +
      '<ul>' +
        '<li><b>Hapus donor</b> ikut menghapus seluruh surat donor itu.</li>' +
        '<li><b>Hapus semua data</b> di Setelan mengosongkan donor, surat, dan kategori.</li>' +
        '<li><b>Unggah data browser ini ke server</b> menimpa data di server. Pakai hanya ' +
          'sekali saat pertama kali menyiapkan, dan hanya kalau Anda yakin.</li>' +
      '</ul>' +

      '<h4>Akun</h4>' +
      '<ul>' +
        '<li>Satu orang satu akun, supaya catatan aktivitas berguna.</li>' +
        '<li>Password bisa diganti sendiri di <b>Setelan</b> → <b>Akun saya</b> → ' +
          '<b>🔑 Ganti password</b>.</li>' +
        '<li>Akun yang tidak dipakai lagi dimatikan admin dari halaman akun — bukan dihapus, ' +
          'supaya catatan lamanya tetap ada.</li>' +
      '</ul>' +

      '<h4>Kebiasaan saat mengirim surat</h4>' +
      '<ul>' +
        '<li>Selalu lewat layar <b>Periksa sebelum kirim</b>, jangan langsung kirim.</li>' +
        '<li>Untuk surat penting atau massal, kirim dulu ke diri sendiri lewat ' +
          '<b>✉ Kirim ke saya sendiri dulu</b>.</li>' +
        '<li>Kirim massal sebaiknya tidak lebih dari beberapa puluh penerima sekaligus, ' +
          'supaya mudah diperiksa kalau ada yang salah.</li>' +
      '</ul>' +

      '<p class="tiny muted">Panduan ini membahas email saja. WhatsApp belum dipakai ' +
        'sampai nomor resmi tersedia.</p>'
  }
];

/* ---------------- PENCARIAN ----------------
   Fungsi murni (tanpa DOM) supaya bisa diuji terpisah: diberi teks pencarian,
   mengembalikan daftar bab yang cocok beserta cuplikan. Semua kata yang
   diketik harus ada (AND), jadi menambah kata mempersempit hasil — sama
   seperti yang diharapkan orang saat mencari solusi. */
function pdPolos(html){
  return String(html || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, ' dan ')
    .replace(/&ldquo;|&rdquo;|&quot;/g, '"')
    .replace(/&[a-z]+;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
function pdEsc(s){
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
function pdKata(k){
  return String(k || '').toLowerCase().split(/\s+/).filter(function(x){ return !!x; });
}
/* Teks lengkap satu bab — dihitung sekali lalu disimpan, bukan tiap ketikan. */
function pdTeksBab(b){
  if(!b._teks){
    b._teks = pdPolos(b.judul + ' ' + (b.kata || []).join(' ') + ' ' + b.isi).toLowerCase();
  }
  return b._teks;
}
function cariPanduan(q){
  const cari = String(q || '').trim().toLowerCase();
  if(!cari) return [];
  const kueri = cari.split(/\s+/).filter(function(x){ return !!x; });
  const hasil = [];
  PANDUAN.forEach(function(b){
    const teks = pdTeksBab(b);
    for(let i = 0; i < kueri.length; i++){
      if(teks.indexOf(kueri[i]) < 0) return;      /* semua kata harus ada */
    }
    /* Cuplikan diambil dari sekitar kata pertama yang ditemukan. */
    const pos = teks.indexOf(kueri[0]);
    const mulai = Math.max(0, pos - 70);
    const potong = pdPolos(b.judul + ' ' + (b.kata || []).join(' ') + ' ' + b.isi)
      .slice(mulai, mulai + 190);
    hasil.push({
      id: b.id, judul: b.judul, ico: b.ico,
      cuplikan: (mulai > 0 ? '… ' : '') + potong + ' …'
    });
  });
  return hasil;
}
/* Beri tanda <mark> pada kata yang dicari di dalam cuplikan. */
function pdSorot(teks, q){
  let out = pdEsc(teks);
  pdKata(q).forEach(function(k){
    const aman = k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    out = out.replace(new RegExp('(' + aman + ')', 'gi'), '<mark>$1</mark>');
  });
  return out;
}

/* ---------------- TAMPILAN ---------------- */
function pdBab(id){
  return PANDUAN.filter(function(b){ return b.id === id; })[0] || PANDUAN[0];
}
function panduanIndexHTML(aktif){
  return PANDUAN.map(function(b){
    return '<button type="button" class="pd-item' + (b.id === aktif ? ' on' : '') +
      '" data-pd-pilih="' + pdEsc(b.id) + '">' +
      '<span class="ico">' + b.ico + '</span><span>' + b.judul + '</span></button>';
  }).join('');
}
function panduanIsiHTML(id){
  const b = pdBab(id);
  return '<article class="pd-artikel">' +
    '<h3>' + b.ico + ' ' + b.judul + '</h3>' + b.isi + '</article>';
}
function panduanKerangkaHTML(id){
  return '<div class="pd">' +
    '<div class="pd-cari-baris">' +
      '<input type="search" id="pd-cari" autocomplete="off" ' +
        'placeholder="Cari solusi — misalnya: kwitansi Rp 0, gagal kirim, tanda dibaca">' +
    '</div>' +
    '<div class="pd-grid">' +
      '<nav class="pd-index" id="pd-index">' + panduanIndexHTML(id) + '</nav>' +
      '<div class="pd-isi" id="pd-isi">' + panduanIsiHTML(id) + '</div>' +
    '</div>' +
  '</div>';
}

function panduanBuka(id){
  const mulai = pdBab(id || 'mulai').id;
  openModal({
    title: 'Panduan pemakaian',
    body: panduanKerangkaHTML(mulai),
    wide: true,
        kelas: 'pd-modal',
    footer: '<span class="tiny muted" style="margin-right:auto">' +
        'Panduan email. WhatsApp belum dipakai.</span>' +
      '<button class="btn" data-close>Tutup</button>',
    onOpen: function(root){ panduanBind(root); }
  });
}

function panduanPilih(id){
  const b = pdBab(id);
  const isi = document.getElementById('pd-isi');
  if(!isi){ panduanBuka(b.id); return; }
  isi.innerHTML = panduanIsiHTML(b.id);
  const nav = document.getElementById('pd-index');
  if(nav){
    nav.innerHTML = panduanIndexHTML(b.id);
  }
  const cari = document.getElementById('pd-cari');
  if(cari) cari.value = '';
  isi.scrollTop = 0;
  const badan = document.querySelector('#modal-root .modal-body');
  if(badan) badan.scrollTop = 0;
}

function panduanCari(q){
  const isi = document.getElementById('pd-isi');
  if(!isi) return;
  const teks = String(q || '').trim();
  if(!teks){
      const aktif = document.querySelector('.pd-item.on');
      isi.innerHTML = panduanIsiHTML(aktif ? aktif.getAttribute('data-pd-pilih') : 'mulai');
    return;
  }
  const hasil = cariPanduan(teks);
  if(!hasil.length){
    isi.innerHTML = '<div class="empty" style="padding:32px 18px">' +
      '<span class="big">🔍</span>Tidak ada panduan yang cocok dengan ' +
      '<b>' + pdEsc(teks) + '</b>.<br>' +
      '<span class="tiny">Coba kata lain yang lebih singkat — misalnya ' +
      '&ldquo;kwitansi&rdquo;, &ldquo;gagal&rdquo;, atau &ldquo;dibaca&rdquo;.</span></div>';
    return;
  }
  isi.innerHTML =
    '<p class="tiny muted" style="margin:0 0 10px">' + hasil.length +
      ' bab cocok dengan <b>' + pdEsc(teks) + '</b>:</p>' +
    hasil.map(function(h){
      return '<button type="button" class="pd-hasil" data-pd-pilih="' + pdEsc(h.id) + '">' +
        '<b>' + h.ico + ' ' + h.judul + '</b>' +
        '<span>' + pdSorot(h.cuplikan, teks) + '</span></button>';
    }).join('');
}

function panduanBind(root){
  const cari = root.querySelector('#pd-cari');
  if(cari){
    cari.addEventListener('input', function(){ panduanCari(this.value); });
    /* Di layar sentuh, memfokuskan kotak cari langsung memunculkan papan
       ketik dan menutupi separuh panduan. Jadi fokus hanya diberikan di
       layar lebar. */
    const sentuh = window.matchMedia && window.matchMedia('(pointer:coarse)').matches;
    if(!sentuh && window.innerWidth > 700){
      setTimeout(function(){
        try{ cari.focus({ preventScroll:true }); }catch(e){ /* abaikan */ }
      }, 60);
    }
  }
}

/* ---------------- PENDENGAR KLIK ----------------
   Dipasang sendiri, terpisah dari pendengar besar di app.js, supaya
   menambah panduan tidak perlu menyentuh logika aplikasi. */
document.addEventListener('click', function(e){
  /* Buka panduan dari tombol [?], atau langsung ke satu bab. */
  const buka = e.target.closest('[data-panduan]');
  if(buka){
    e.preventDefault();
    panduanBuka(buka.getAttribute('data-panduan') || 'mulai');
    return;
  }
  /* Pindah bab / hasil pencarian, tanpa menutup jendela. */
  const pilih = e.target.closest('[data-pd-pilih]');
  if(pilih){
    e.preventDefault();
    panduanPilih(pilih.getAttribute('data-pd-pilih'));
    return;
  }
  /* Tautan dari panduan ke halaman aplikasi. */
  const hal = e.target.closest('[data-panduan-halaman]');
  if(hal){
    const tujuan = hal.getAttribute('data-panduan-halaman');
    closeModal();
    if(typeof go === 'function') go(tujuan);
    return;
  }
});

/* Tombol Esc sudah ditangani app.js (closeModal), jadi tidak diduplikasi. */