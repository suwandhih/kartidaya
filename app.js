"use strict";
/* ============================================================
   KARTIDAYA — Kelola Surat & Email Donor
   Model: setiap ID donor punya BUKU sendiri (thread keluar + masuk)
   ============================================================ */

/* ---------- 1. KONSTANTA ---------- */
const LS = {
  donors:'kartidaya.v2.donors',
  categories:'kartidaya.v2.categories',
  templates:'kartidaya.v2.templates',
  messages:'kartidaya.v2.messages',
  settings:'kartidaya.v2.settings',
  programs:'kartidaya.v2.programs',
  finance:'kartidaya.v2.finance',
  isian:'kartidaya.v2.isian',
  uji:'kartidaya.v2.uji'
};
/* Penanda perubahan yang belum sampai ke server. Disimpan di browser supaya
   kalau halaman dimuat ulang sebelum internet kembali, perubahan itu dikirim
   lebih dulu — bukan ditimpa oleh data server. */
const LS_TERTUNDA = 'kartidaya.v2.tertunda';
/* Penanda bahwa browser ini sudah pernah berhasil menyinkron dengan server.
   Dipakai sekali saja: pada pemakaian pertama, data di browser tidak boleh
   ditimpa oleh server yang masih kosong. */
const LS_PERNAH_SINKRON = 'kartidaya.v2.pernahSinkron';
/* Daftar id yang sudah dihapus di komputer ini tetapi belum terhapus di server.
   Bentuk: { donors:['L00001R'], messages:['MSG-1'] }.
   Kenapa perlu? Kalau penghapusan dilakukan dengan cara "bandingkan daftar
   lokal dengan daftar server", maka setiap kali menyimpan, semua baris yang
   ada di server tetapi tidak ada di komputer ini akan ikut terhapus — termasuk
   pekerjaan rekan yang baru saja ditambahkan. Dengan daftar ini, yang terhapus
   hanya baris yang memang sengaja dihapus di sini. */
const LS_HAPUS = 'kartidaya.v2.hapus';

/* OAuth Client ID project `kartidaya-513714` (nomor 531116872278).
   Dipakai sebagai nilai awal supaya browser yang masih menyimpan Client ID
   lama tidak terus gagal dengan `access_denied`. */
const DEFAULT_CLIENT_ID = '531116872278-hep5meju0djk30qrsee5ec4np2t895qo.apps.googleusercontent.com';

/* Alamat Worker Cloudflare milik Kartidaya. Dipakai sebagai nilai awal supaya
   pengguna tidak perlu mengetik alamat panjang ini — dan supaya alamatnya tidak
   hilang kalau tombol "Hapus kunci" pernah ditekan. Alamat ini bukan rahasia:
   hanya URL publik. Yang rahasia adalah Kunci aplikasi (APP_KEY). */
const DEFAULT_WORKER = 'https://kartidaya-wa.suwandhih.workers.dev';

const PANGGILAN = ['','Ibu','Bapak','Saudara','Saudari'];
const PENGIRIMAN = ['','Email','WhatsApp','POS','Kurir','Lainnya'];
const STATUS_KELUAR = ['Draft','Terkirim','Gagal'];
const STATUS_MASUK = ['Belum dibaca','Dibaca','Dibalas'];
/* Kanal surat. Email lewat Gmail API, WhatsApp lewat Cloudflare Worker. */
const KANAL = ['email','whatsapp'];
const LABEL_KANAL = { email:'Email', whatsapp:'WhatsApp' };
const ICO_KANAL = { email:'✉', whatsapp:'✆' };
/* WhatsApp ditunda sampai nomor resmi Kartidaya ada — pengiriman tidak boleh
   memakai akun Facebook pribadi. Selama ditunda, kanal WhatsApp disembunyikan
   dari pemilih kanal supaya tidak ada yang salah pilih. Fitur email tetap
   jalan penuh. Ubah ke false kalau nomor resmi sudah siap. */
const WA_DITUNDA = true;
const ARTI_STATUS_MASUK = {
  'Belum dibaca': 'pesan baru, belum dibuka',
  'Dibaca': 'sudah dibuka',
  'Dibalas': 'sudah dikirimi balasan'
};

/* Warna chip status surat. Surat masuk dibedakan tegas supaya sekilas pun
   langsung terbaca: kuning = belum dibaca, biru = sudah dibaca, hijau = sudah
   dibalas. Surat keluar: abu-abu draft, hijau muda terkirim, kuning gagal. */
function statusChipClass(s){
  if(s === 'Gagal') return 'warn';
  if(s === 'Belum dibaca') return 'st-baru';
  if(s === 'Dibaca') return 'st-dibaca';
  if(s === 'Dibalas') return 'st-dibalas';
  if(s === 'Draft') return 'plain';
  return 'plain';
}

/* Chip kecil penanda kanal surat (Email / WhatsApp). */
function kanalChip(m){
  const k = m && m.kanal === 'whatsapp' ? 'whatsapp' : 'email';
  return '<span class="chip kanal-' + k + '">' + ICO_KANAL[k] + ' ' + LABEL_KANAL[k] + '</span>';
}

/* Sisa waktu token Gmail dalam bentuk yang mudah dibaca. */
function sisaWaktu(ms){
  if(!ms || ms <= 0) return 'habis';
  const mnt = Math.floor(ms / 60000);
  if(mnt < 1) return 'kurang dari 1 menit';
  if(mnt < 60) return mnt + ' menit';
  return Math.floor(mnt / 60) + ' jam ' + (mnt % 60) + ' menit';
}

const DEFAULT_CATEGORIES = [
  'Member Support','Church Local','Individual - Local','Funder - Foreign','Organization'
];

/* 18 donor dari data.xlsx sheet "Utama" (19 baris termasuk header) */
const SEED_DONORS = [
  ['L00024R','Member Support','Linda Lau','','','lindalau_T1@yahoo.co.id','0896-8888-1899',''],
  ['I00017U','Church Local','Kamlesh','','International English','volta@iesjakarta.org','0813-9022-78629',''],
  ['G00009R','Member Support','Rany','','GKKK Permatry','rany.parapat@gmail.com','0877-6736-6888',''],
  ['Y00002R','Member Support','Setiyani','','Yay Misi Parousia','mesiaparousiaindonesia@gmail.com','0821-1000-8058','0819-3140-7040'],
  ['G00008R','Member Support','Yadi Sakti','','GKJ Kartini','gkikartini@yahoo.com','0816-7239-5203',''],
  ['S00052R','Member Support','Susanti','','','susantigle16@gmail.com','0815-6409-0403',''],
  ['S00041U','Individual - Local','Samsudin Tjandra','','','sjamsudintjandra@yahoo.com','0895-2693-1295',''],
  ['R00013R','Individual - Local','Rommel Sianipar','','','rommelsianipar@gmail.com','0812-8402-1251',''],
  ['G00035R','Church Local','Jonny Djunaedi','','GRI Kristen Batu Hijau','bpkur@yahoo.com','0888-1029-390',''],
  ['G00037U','Church Local','Melie','','GKI Perniagaan','perniagas@gkiperniagaan.org','0812-1903-827',''],
  ['F00004R','Member Support','Ferry Kangsadjaja','','','ferryk@indo.net.id','0811-8862-345',''],
  ['A00023R','Member Support','Anor Sinombing','','','dessy_pello@wycliffe.sg','0659-1000-793',''],
  ['P00003U','Individual - Local','Paulina Tjandra','','','paulinatj@gmail.com','',''],
  ['P00001U','Individual - Local','Pandapotan Candra/Christian','','','panpan_blue@yahoo.com','0852-2296-4423',''],
  ['M00003R','Individual - Local','Margiman','','','jmoernefang@gmail.com','',''],
  ['M00015U','Individual - Local','Mutiara Febriani','','','mutiarastomput@gmail.com','',''],
  ['G00015R','Church Local','','','GKY Singapura','mission.gkysg@gmail.com','',''],
  ['H00030R','Organization','','','Hope Special Need','ingkanmangundap@gmail.com','','']
].map(function(r){
  return {
    id:r[0], kategori:r[1], pic:r[2], namaLengkap:r[3], instansi:r[4],
    email:r[5], email2:'', emailUtama:1,
    hp1:r[6], hp2:r[7], hpUtama:1,
    panggilan:'', dateStart:'', asalGereja:'', alamat:'', tglLahir:'',
    pengiriman:'', catatan:'', createdAt:new Date().toISOString()
  };
});

const DEFAULT_TEMPLATES = [
  { id:'tpl-umum', nama:'Surat Umum',
    subjek:'Surat dari Kartidaya untuk {/PIC}',
    isi:'Kepada Yth.\n{/PIC}\n{/INST}\n\nDengan hormat,\n\nSalam sejahtera. Kami dari Kartidaya menyampaikan terima kasih atas perhatian dan dukungan {/PIC} selama ini.\n\nBersama surat ini kami sampaikan beberapa informasi yang kiranya dapat menjadi bahan pertimbangan.\n\nDemikian surat ini kami sampaikan. Atas perhatian {/PIC} kami ucapkan terima kasih.\n\nHormat kami,\nKartidaya\n\n{/TANGGAL}' },
  { id:'tpl-ucapan', nama:'Ucapan Terima Kasih',
    subjek:'Terima kasih — {/NAMA}',
    isi:'Kepada Yth.\n{/PIC}\n{/INST}\n\nDengan hormat,\n\nKami mengucapkan terima kasih yang sebesar-besarnya atas dukungan yang diberikan. Kontribusi {/PIC} sangat berarti bagi pelayanan kami.\n\nTuhan memberkati.\n\nHormat kami,\nKartidaya\n\n{/TANGGAL}' },
  { id:'tpl-undangan', nama:'Undangan Kegiatan',
    subjek:'Undangan Kegiatan — {/NAMA}',
    isi:'Kepada Yth.\n{/PIC}\n{/INST}\n\nDengan hormat,\n\nDengan ini kami mengundang {/PIC} untuk hadir dalam kegiatan yang akan kami selenggarakan.\n\nHari/Tanggal : {/ISI1}\nWaktu        : {/ISI2}\nTempat       : {/ISI3}\nPembicara    : {/ISI4}\n\n{/ISI5}\n\nMerupakan suatu kehormatan apabila {/PIC} dapat hadir.\n\nHormat kami,\nKartidaya\n\n{/TANGGAL}' }
];

/* Isi template undangan versi lama — dipakai sekali untuk memindahkan template
   yang belum memakai token isian ke versi baru. Template yang sudah diubah
   user tidak ikut diganti. */
const TPL_UNDANGAN_LAMA =
  'Kepada Yth.\n{/PIC}\n{/INST}\n\nDengan hormat,\n\nDengan ini kami mengundang {/PIC} untuk hadir dalam kegiatan yang akan kami selenggarakan.\n\nHari/Tanggal : \nWaktu        : \nTempat       : \n\nMerupakan suatu kehormatan apabila {/PIC} dapat hadir.\n\nHormat kami,\nKartidaya\n\n{/TANGGAL}';

const TOKENS = [
  ['{/PIC}','Panggilan + nama PIC'],
  ['{/PANGGILAN}','Ibu / Bapak / Saudara / Saudari'],
  ['{/NAMA}','Nama PIC saja'],
  ['{/INST}','Nama instansi'],
  ['{/NAMA_LENGKAP}','Nama lengkap'],
  ['{/ID}','ID-DONOR'],
  ['{/KATEGORI}','Kategori donor'],
  ['{/EMAIL}','Email utama penerima'],
  ['{/EMAIL2}','Email kedua penerima'],
  ['{/HP}','No HP utama'],
  ['{/HP2}','No HP kedua'],
  ['{/ALAMAT}','Alamat lengkap'],
  ['{/TANGGAL}','Tanggal hari ini'],
  ['{/ISI1}','Isian serba guna 1'],
  ['{/ISI2}','Isian serba guna 2'],
  ['{/ISI3}','Isian serba guna 3'],
  ['{/ISI4}','Isian serba guna 4'],
  ['{/ISI5}','Isian serba guna 5']
];

/* ---------- ISIAN SERBA GUNA ----------
   Lima isian bebas yang diisi SEKALI di halaman Tulis, lalu dipakai di semua
   surat lewat token {/ISI1}…{/ISI5}. Gunanya untuk hal yang tidak ada di data
   donor — misalnya hari/tanggal, waktu, tempat, dan pembicara sebuah undangan.
   Nilainya disimpan terpisah dari template supaya tidak perlu diketik ulang
   setiap kali mengirim surat. */
const ISIAN_FIELD = [
  { n:1, label:'Isian 1', contoh:'Sabtu, 22 November 2026' },
  { n:2, label:'Isian 2', contoh:'09.00 – 12.00 WIB' },
  { n:3, label:'Isian 3', contoh:'Aula Kartidaya, Jakarta' },
  { n:4, label:'Isian 4', contoh:'Pdt. Nama Pembicara' },
  { n:5, label:'Isian 5', contoh:'Catatan tambahan…' }
];
const ISIAN_MAKS = ISIAN_FIELD.length;

/* ---------- KEUANGAN ---------- */
/* Mata uang yang didukung. `locale` dipakai untuk format ribuan, `kode` untuk
   tampilan singkat di tabel. */
const MATA_UANG = [
  { kode:'IDR', nama:'Rupiah',        locale:'id-ID', simbol:'Rp' },
  { kode:'USD', nama:'Dolar AS',      locale:'en-US', simbol:'$'  },
  { kode:'SGD', nama:'Dolar Singapura', locale:'en-SG', simbol:'S$' },
  { kode:'EUR', nama:'Euro',          locale:'de-DE', simbol:'€'  },
  { kode:'AUD', nama:'Dolar Australia', locale:'en-AU', simbol:'A$' },
  { kode:'MYR', nama:'Ringgit',       locale:'ms-MY', simbol:'RM' }
];
const KODE_UANG = MATA_UANG.map(function(m){ return m.kode; });

/* ---------- KWITANSI ---------- */
/* Kwitansi tampil di badan email (HTML), bukan lampiran PDF. Dua bahasa:
   `id` (KWITANSI) dan `en` (FUND RECEIPT). Label diambil dari tabel di bawah
   supaya penambahan bahasa lain cukup menambah satu baris. */
const KWITANSI_LABEL = {
  id: { judul:'KWITANSI', dari:'Telah terima dari', jumlah:'Uang sejumlah',
        untuk:'Untuk', terbilang:'Terbilang', kota:'Jakarta' },
  en: { judul:'FUND RECEIPT', dari:'Received from', jumlah:'The sum of',
        untuk:'On account of', terbilang:'Amount', kota:'Jakarta' }
};
const KWITANSI_BAHASA = ['id','en'];
const KWITANSI_NAMA_BAHASA = { id:'Indonesia', en:'Inggris' };

/* Ubah angka jadi kata untuk baris "Terbilang".
   Contoh: 14088444 → "Empat belas juta delapan puluh delapan ribu empat ratus
   empat puluh empat rupiah". */
const TERBILANG_SATUAN = ['','satu','dua','tiga','empat','lima','enam','tujuh','delapan','sembilan',
  'sepuluh','sebelas'];
function terbilangInt(n){
  n = Math.floor(Math.abs(Number(n) || 0));
  if(n === 0) return 'nol';
  if(n < 12) return TERBILANG_SATUAN[n];
  if(n < 20) return terbilangInt(n - 10) + ' belas';
  if(n < 100) return terbilangInt(Math.floor(n / 10)) + ' puluh' + (n % 10 ? ' ' + terbilangInt(n % 10) : '');
  if(n < 200) return 'seratus' + (n % 100 ? ' ' + terbilangInt(n % 100) : '');
  if(n < 1000) return terbilangInt(Math.floor(n / 100)) + ' ratus' + (n % 100 ? ' ' + terbilangInt(n % 100) : '');
  if(n < 2000) return 'seribu' + (n % 1000 ? ' ' + terbilangInt(n % 1000) : '');
  if(n < 1000000) return terbilangInt(Math.floor(n / 1000)) + ' ribu' + (n % 1000 ? ' ' + terbilangInt(n % 1000) : '');
  if(n < 1000000000) return terbilangInt(Math.floor(n / 1000000)) + ' juta' + (n % 1000000 ? ' ' + terbilangInt(n % 1000000) : '');
  if(n < 1000000000000) return terbilangInt(Math.floor(n / 1000000000)) + ' miliar' + (n % 1000000000 ? ' ' + terbilangInt(n % 1000000000) : '');
  return terbilangInt(Math.floor(n / 1000000000000)) + ' triliun' + (n % 1000000000000 ? ' ' + terbilangInt(n % 1000000000000) : '');
}
function terbilang(n, mataUang){
  const m = uangInfo(mataUang || 'IDR');
  const v = Math.abs(Number(n) || 0);
  const bulat = Math.floor(v);
  const sen = Math.round((v - bulat) * 100);
  let t = terbilangInt(bulat);
  if(sen) t += ' koma ' + terbilangInt(sen);
  t = t.charAt(0).toUpperCase() + t.slice(1);
  const namaUang = { IDR:'rupiah', USD:'dolar Amerika', SGD:'dolar Singapura',
    EUR:'euro', AUD:'dolar Australia', MYR:'ringgit' }[m.kode] || m.nama.toLowerCase();
  return t + ' ' + namaUang;
}
/* Tanggal gaya kwitansi: "14 Oktober 2026". */
function tanggalKwitansi(iso){
  const d = iso ? new Date(iso) : new Date();
  if(isNaN(d)) return '';
  return d.toLocaleDateString('id-ID', { day:'numeric', month:'long', year:'numeric' });
}
/* Ambil transaksi keuangan milik donor. Kalau `finId` diisi, pakai itu saja.
   Kalau `finId` ternyata milik donor LAIN (mis. penerima diganti setelah
   transaksi dipilih), jangan kembalikan kosong: kwitansinya akan tercetak
   Rp 0 tanpa sebab yang bisa dilihat pengguna. Pakai transaksi terbaru donor
   yang sedang dipilih — sama dengan yang ditampilkan kotak pilihan. */
function kwitansiDonor(donorId, finId){
  const milik = state.finance.filter(function(f){
    return f.donorId === donorId;
  }).sort(function(a,b){ return String(b.tanggal).localeCompare(String(a.tanggal)); });
  if(!milik.length) return null;
  if(finId){
    const pilih = milik.filter(function(f){ return f.id === finId; })[0];
    if(pilih) return pilih;
  }
  return milik[0];
}
/* Nomor kwitansi dibuat dari tanggal + ID donor supaya stabil dan mudah dicari:
   KWT/20261111/F00004R */
function nomorKwitansi(f, donorId){
  const tgl = String((f && f.tanggal) || new Date().toISOString().slice(0,10)).replace(/-/g,'');
  return 'KWT/' + tgl + '/' + (donorId || '');
}

/* ---------- KODE KWITANSI UNIK ---------- */
/* Kode ini yang membedakan satu transaksi dari transaksi lain, walau donornya
   sama dan tanggalnya sama. Dipakai user untuk mencocokkan kwitansi yang
   dikirim dengan catatannya sendiri.

   Bentuk: KWT-20261112-0007
           └┬─┘ └──┬───┘ └┬─┘
            │      │      └── nomor urut, 4 digit
            │      └───────── tanggal transaksi
            └──────────────── penanda kwitansi

   Nomor urut dihitung dari transaksi yang sudah ada pada tanggal itu, jadi
   tidak pernah sama. */
function kodeKwitansi(f){
  if(!f) return '';
  if(f.kode) return f.kode;
  return 'KWT-' + String(f.tanggal || '').replace(/-/g,'') + '-????';
}

/* Beri kode pada transaksi yang belum punya. Dipanggil sekali saat aplikasi
   dibuka, supaya transaksi lama ikut punya kode tanpa perlu diubah manual. */
function lengkapiKodeKwitansi(){
  let n = 0;
  const perTanggal = {};
  /* Hitung dulu kode yang sudah ada supaya nomor urut tidak bertabrakan. */
  state.finance.forEach(function(f){
    if(f.kode){
      const tgl = String(f.tanggal || '').replace(/-/g,'');
      const urut = parseInt(String(f.kode).slice(-4), 10);
      if(!isNaN(urut)) perTanggal[tgl] = Math.max(perTanggal[tgl] || 0, urut);
    }
  });
  /* Urutkan supaya pemberian kode mengikuti urutan tanggal & waktu dibuat. */
  state.finance.slice().sort(function(a, b){
    const t = String(a.tanggal || '').localeCompare(String(b.tanggal || ''));
    if(t) return t;
    return String(a.createdAt || '').localeCompare(String(b.createdAt || ''));
  }).forEach(function(f){
    if(f.kode) return;
    const tgl = String(f.tanggal || '').replace(/-/g,'');
    perTanggal[tgl] = (perTanggal[tgl] || 0) + 1;
    f.kode = 'KWT-' + tgl + '-' + String(perTanggal[tgl]).padStart(4, '0');
    n++;
  });
  if(n) save('finance');
  return n;
}

/* Kode kiriman: dibuat sekali setiap kali surat benar-benar dikirim. Berbeda
   dari kode kwitansi (milik transaksi), kode kiriman menandai SATU pengiriman
   ke SATU donor. Jadi kalau kwitansi yang sama dikirim dua kali, kode
   kirimannya berbeda — inilah yang mencegah tertukar. */
function kodeKiriman(){
  const d = new Date();
  const tgl = d.getFullYear() + String(d.getMonth() + 1).padStart(2,'0') + String(d.getDate()).padStart(2,'0');
  const acak = Math.random().toString(36).slice(2, 6).toUpperCase();
  return 'KRM-' + tgl + '-' + acak;
}

/* Tanggal & jam kirim dalam bentuk yang enak dibaca. */
function waktuKirim(iso){
  const d = iso ? new Date(iso) : new Date();
  if(isNaN(d)) return '';
  return d.toLocaleString('id-ID', {
    day:'numeric', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit'
  }) + ' WIB';
}
/* Data kwitansi siap pakai untuk satu donor. */
function dataKwitansi(d, finId){
  const f = kwitansiDonor(d.id, finId);
  const program = f ? (f.program || []).map(function(x){ return programNama(x.id); }).join(', ') : '';
  /* Total dipisah per mata uang — kalau satu transaksi memuat beberapa mata
     uang, kwitansi menampilkan semuanya, tidak dijumlahkan jadi satu angka. */
  const perUang = f ? totalPerUangTransaksi(f) : {};
  const kode = Object.keys(perUang).sort();
  return {
    ada: !!f,
    finId: f ? f.id : '',
    nomor: nomorKwitansi(f, d.id),
    kode: kodeKwitansi(f),
    tanggal: f ? f.tanggal : '',
    jumlah: kode.length ? perUang[kode[0]] : 0,
    mataUang: kode.length ? kode[0] : 'IDR',
    perUang: perUang,
    kodeUang: kode,
    program: program,
    catatan: f ? (f.catatan || '') : ''
  };
}
/* HTML kwitansi. Semua gaya ditulis inline karena klien email membuang <style>.
   `opsi` boleh memuat { kodeKiriman, waktuKirim } — dua hal ini dicetak di
   kwitansi supaya user bisa mencocokkan dengan catatannya sendiri. */
function kwitansiHTML(d, bahasa, finId, opsi){
  opsi = opsi || {};
  const L = KWITANSI_LABEL[bahasa] || KWITANSI_LABEL.id;
  const k = dataKwitansi(d, finId);
  const logo = state.settings.logoUrl || 'vendor/kartidaya-logo.png';
  const logoAbs = /^https?:/i.test(logo) ? logo : new URL(logo, location.href).href;
  const garis = 'border-bottom:1px solid #333;';
  const label = 'width:150px;vertical-align:top;padding:7px 0;font-weight:bold;font-size:13px;';
  const titik = 'width:14px;vertical-align:top;padding:7px 0;font-size:13px;';
  const isi = 'vertical-align:top;padding:7px 0;font-size:13px;' + garis;
  const baris = function(l, v){
    return '<tr><td style="' + label + '">' + esc(l) + '</td>' +
      '<td style="' + titik + '">:</td>' +
      '<td style="' + isi + '">' + (v || '&nbsp;') + '</td></tr>';
  };
  const kosong = '<tr><td style="' + label + '">&nbsp;</td><td style="' + titik + '">&nbsp;</td>' +
    '<td style="' + isi + '">&nbsp;</td></tr>';
  /* Nama penerima: pakai PIC kalau ada, kalau tidak instansi. Jangan
     menggabungkan keduanya kalau isinya sama — donorName() sudah memakai
     instansi sebagai cadangan, jadi bisa muncul dua kali. */
  const namaPenerima = donorName(d);
  const instansi = (d.instansi && d.instansi !== namaPenerima) ? ' — ' + esc(d.instansi) : '';

  /* Baris "Uang sejumlah" & "Terbilang". Kalau transaksinya memuat lebih dari
     satu mata uang, tampilkan satu baris per mata uang — tidak digabung,
     karena kursnya berbeda. */
  const kode = k.kodeUang.length ? k.kodeUang : ['IDR'];
  const barisJumlah = kode.map(function(u){
    return baris(L.jumlah, '<b>' + esc(terbilang(k.perUang[u] || 0, u)) + '</b>');
  }).join('');
  const barisTerbilang = kode.map(function(u){
    return '<tr><td style="width:150px;padding:10px 0 0;font-weight:bold;font-size:13px">' +
        esc(L.terbilang) + (kode.length > 1 ? ' (' + esc(u) + ')' : '') + '</td>' +
      '<td style="width:14px;padding:10px 0 0;font-size:13px">:</td>' +
      '<td style="padding:10px 0 0">' +
        '<span style="display:inline-block;border-bottom:1px solid #333;padding:0 6px 3px;' +
          'font-size:13px;font-weight:bold">' + esc(uangInfo(u).simbol) + '</span>' +
        '<span style="display:inline-block;border-bottom:1px solid #333;padding:0 10px 3px;' +
          'font-size:13px;font-weight:bold;min-width:150px">' +
          esc(angkaUang(k.perUang[u] || 0, u)) + '</span>' +
      '</td></tr>';
  }).join('');

  return '' +
  '<table cellpadding="0" cellspacing="0" border="0" width="100%" ' +
    'style="max-width:720px;margin:22px 0 0;border:2px solid #222;border-collapse:collapse;' +
    'font-family:Arial,Helvetica,sans-serif;color:#111;background:#fff">' +
    '<tr><td style="padding:16px 18px 6px">' +
      '<table cellpadding="0" cellspacing="0" border="0" width="100%"><tr>' +
        '<td style="width:150px;vertical-align:middle">' +
          '<img src="' + esc(logoAbs) + '" alt="Kartidaya" width="140" style="display:block;border:0;max-width:140px">' +
        '</td>' +
        '<td style="vertical-align:middle;text-align:center">' +
          '<div style="font-family:Georgia,\'Times New Roman\',serif;font-size:21px;font-weight:bold;' +
            'letter-spacing:.5px">KARTIDAYA SAHABAT INDONESIA</div>' +
          '<div style="font-size:15px;font-weight:bold;margin-top:4px;letter-spacing:1px">' + esc(L.judul) + '</div>' +
        '</td>' +
      '</tr></table>' +
    '</td></tr>' +
    '<tr><td style="padding:6px 18px 18px">' +
      '<table cellpadding="0" cellspacing="0" border="0" width="100%">' +
        baris(L.dari, esc(namaPenerima) + instansi) +
        barisJumlah +
        kosong +
        baris(L.untuk, esc(k.program || 'Pelayanan Kartidaya Sahabat')) +
        kosong +
        '<tr><td colspan="3" style="padding:14px 0 0;text-align:right;font-size:13px">' +
          esc(L.kota) + ', ' + esc(tanggalKwitansi(k.tanggal)) + '</td></tr>' +
        '<tr><td colspan="3" style="padding:6px 0 0;text-align:right">' +
          '<div style="font-family:Georgia,serif;font-size:19px;color:#2f6f9f;font-weight:bold">kartidaya</div>' +
          '<div style="font-size:12px;font-weight:bold;margin-top:2px">Lidya Tambunan</div>' +
          '<div style="font-size:11px;color:#444">Head of Finance, Accounting &amp; Tax</div>' +
        '</td></tr>' +
        barisTerbilang +
        '<tr><td colspan="3" style="padding:8px 0 0;font-size:10.5px;color:#666">' +
          'No. ' + esc(k.nomor) + (k.ada ? '' : ' — belum ada transaksi keuangan untuk donor ini') +
        '</td></tr>' +
        (k.kode ? '<tr><td colspan="3" style="padding:2px 0 0;font-size:10.5px;color:#666">' +
          'Kode kwitansi: <b style="color:#111;letter-spacing:.5px">' + esc(k.kode) + '</b>' +
        '</td></tr>' : '') +
        (opsi.kodeKiriman ? '<tr><td colspan="3" style="padding:2px 0 0;font-size:10.5px;color:#666">' +
          'Kode kiriman: <b style="color:#111;letter-spacing:.5px">' + esc(opsi.kodeKiriman) + '</b>' +
          (opsi.waktuKirim ? ' &middot; dikirim ' + esc(opsi.waktuKirim) : '') +
        '</td></tr>' : '') +
        '<tr><td colspan="3" style="padding:6px 0 0;font-size:10.5px;color:#666">' +
          'Ada yang perlu diperbaiki? Balas email ini atau hubungi kami di ' +
          esc(state.settings.kontakKoreksi || 'finance@kartidaya.org') +
          ' dengan menyebut kode di atas.' +
        '</td></tr>' +
      '</table>' +
    '</td></tr>' +
  '</table>';
}

/* ---------- KWITANSI SEBAGAI GAMBAR (PNG) ----------
   WhatsApp tidak bisa menampilkan tabel HTML, jadi kwitansi digambar sebagai
   gambar. Digambar langsung di browser dengan Canvas — tidak perlu aplikasi
   atau layanan tambahan. Email tetap memakai HTML karena lebih tajam dan
   teksnya bisa disalin penerima. */

const PNG_LEBAR = 720;

function muatGambar(src){
  return new Promise(function(resolve){
    const img = new Image();
    img.onload = function(){ resolve(img); };
    img.onerror = function(){ resolve(null); };
    img.src = src;
  });
}

/* Menggambar kwitansi ke canvas. Dipanggil dua kali: sekali dengan `ukurSaja`
   untuk menghitung tinggi, sekali untuk menggambar sungguhan. */
function gambarKwitansi(ctx, d, bahasa, finId, opsi, ukurSaja){
  const L = KWITANSI_LABEL[bahasa] || KWITANSI_LABEL.id;
  const k = dataKwitansi(d, finId);
  const W = PNG_LEBAR, pad = 26;
  const x0 = pad, x1 = W - pad;
  const xNilai = x0 + 164;
  const lebarNilai = x1 - xNilai;
  const GARIS = '#333';
  let y = pad;

  const font = function(size, tebal, serif){
    ctx.font = (tebal ? 'bold ' : '') + size + 'px ' +
      (serif ? 'Georgia,"Times New Roman",serif' : 'Arial,Helvetica,sans-serif');
  };
  const teks = function(t, x, yy, size, tebal, warna, align, serif){
    font(size, tebal, serif);
    if(ukurSaja) return;
    ctx.fillStyle = warna || '#111';
    ctx.textAlign = align || 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(t, x, yy);
  };
  const garis = function(xa, ya, xb, yb, warna, lebar){
    if(ukurSaja) return;
    ctx.strokeStyle = warna || GARIS;
    ctx.lineWidth = lebar || 1;
    ctx.beginPath(); ctx.moveTo(xa, ya); ctx.lineTo(xb, yb); ctx.stroke();
  };
  /* Bungkus teks panjang jadi beberapa baris sesuai lebar kolom nilai. */
  const bungkus = function(t, lebar, size, tebal){
    font(size, tebal);
    const kata = String(t || '').split(/\s+/).filter(Boolean);
    const baris = [];
    let kini = '';
    kata.forEach(function(w){
      const coba = kini ? kini + ' ' + w : w;
      if(ctx.measureText(coba).width > lebar && kini){ baris.push(kini); kini = w; }
      else kini = coba;
    });
    if(kini) baris.push(kini);
    return baris.length ? baris : [''];
  };

  /* --- Kepala: logo kiri, nama lembaga & judul di tengah --- */
  const logoW = 140;
  const logoH = (opsi.logo && opsi.logo.width)
    ? Math.round(logoW * opsi.logo.height / opsi.logo.width) : 0;
  if(opsi.logo && !ukurSaja) ctx.drawImage(opsi.logo, x0, y, logoW, logoH);
  teks('KARTIDAYA SAHABAT INDONESIA', W / 2, y + 22, 19, true, '#111', 'center', true);
  teks(L.judul, W / 2, y + 44, 15, true, '#111', 'center');
  y += Math.max(logoH, 48) + 16;

  /* --- Baris isi: label · titik dua · nilai, dengan garis bawah --- */
  const barisIsi = function(label, nilai, tebal){
    const baris = bungkus(nilai, lebarNilai, 13, tebal);
    const tinggi = Math.max(30, baris.length * 19 + 12);
    teks(label, x0, y + 19, 13, true);
    teks(':', x0 + 150, y + 19, 13, false);
    baris.forEach(function(b, i){ teks(b, xNilai, y + 19 + i * 19, 13, tebal); });
    garis(x0, y + tinggi - 1, x1, y + tinggi - 1, GARIS, 1);
    y += tinggi;
  };
  const barisKosong = function(){ y += 30; };

  const namaPenerima = donorName(d);
  const instansi = (d.instansi && d.instansi !== namaPenerima) ? ' — ' + d.instansi : '';
  barisIsi(L.dari, namaPenerima + instansi);
  /* Satu baris per mata uang — tidak digabung, karena kursnya berbeda. */
  const kode = k.kodeUang.length ? k.kodeUang : ['IDR'];
  kode.forEach(function(u){ barisIsi(L.jumlah, terbilang(k.perUang[u] || 0, u), true); });
  barisKosong();
  barisIsi(L.untuk, k.program || 'Pelayanan Kartidaya Sahabat');
  barisKosong();

  /* --- Tempat & tanggal, lalu tanda tangan --- */
  teks(L.kota + ', ' + tanggalKwitansi(k.tanggal), x1, y + 16, 13, false, '#111', 'right');
  y += 30;
  teks('kartidaya', x1, y + 20, 19, true, '#2f6f9f', 'right', true);
  teks('Lidya Tambunan', x1, y + 38, 12, true, '#111', 'right');
  teks('Head of Finance, Accounting & Tax', x1, y + 53, 11, false, '#444', 'right');
  y += 66;

  /* --- Terbilang: satu baris per mata uang, angka di dalam kotak garis --- */
  kode.forEach(function(u){
    teks(L.terbilang + (kode.length > 1 ? ' (' + u + ')' : ''), x0, y + 18, 13, true);
    teks(':', x0 + 150, y + 18, 13, false);
    const simbol = uangInfo(u).simbol;
    const angka = angkaUang(k.perUang[u] || 0, u);
    font(13, true);
    const wSimbol = ctx.measureText(simbol).width + 12;
    const wAngka = Math.max(ctx.measureText(angka).width + 20, 150);
    if(!ukurSaja){
      ctx.fillStyle = '#111';
      ctx.textAlign = 'left';
      ctx.fillText(simbol, xNilai + 6, y + 18);
      ctx.fillText(angka, xNilai + wSimbol + 10, y + 18);
    }
    garis(xNilai, y + 24, xNilai + wSimbol, y + 24, GARIS, 1);
    garis(xNilai + wSimbol, y + 24, xNilai + wSimbol + wAngka, y + 24, GARIS, 1);
    y += 30;
  });

  /* --- Kaki: nomor, kode, dan cara menghubungi kalau ada kekeliruan --- */
  y += 4;
  const kaki = [];
  kaki.push('No. ' + k.nomor + (k.ada ? '' : ' — belum ada transaksi keuangan untuk donor ini'));
  if(k.kode) kaki.push('Kode kwitansi: ' + k.kode);
  if(opsi.kodeKiriman){
    kaki.push('Kode kiriman: ' + opsi.kodeKiriman +
      (opsi.waktuKirim ? ' · dikirim ' + opsi.waktuKirim : ''));
  }
  kaki.push('Ada yang perlu diperbaiki? Hubungi ' +
    (state.settings.kontakKoreksi || 'finance@kartidaya.org') + ' dengan menyebut kode di atas.');
  kaki.forEach(function(t){
    bungkus(t, x1 - x0, 10.5, false).forEach(function(b){
      teks(b, x0, y + 12, 10.5, false, '#666');
      y += 14;
    });
  });

  y += pad - 6;
  /* Bingkai luar digambar paling akhir karena tingginya baru diketahui kini. */
  if(!ukurSaja){
    ctx.strokeStyle = '#222';
    ctx.lineWidth = 2;
    ctx.strokeRect(1, 1, W - 2, y - 2);
  }
  return y;
}

/* Hasilkan canvas kwitansi. `skala` 2 membuat gambar tajam di layar HP. */
async function kwitansiCanvas(d, bahasa, finId, opsi){
  opsi = opsi || {};
  const logo = state.settings.logoUrl || 'vendor/kartidaya-logo.png';
  const logoAbs = /^https?:/i.test(logo) ? logo : new URL(logo, location.href).href;
  const img = await muatGambar(logoAbs);
  const S = opsi.skala || 2;
  const ukur = document.createElement('canvas').getContext('2d');
  const tinggi = Math.ceil(gambarKwitansi(ukur, d, bahasa, finId, { logo:img }, true));
  const cv = document.createElement('canvas');
  cv.width = PNG_LEBAR * S;
  cv.height = tinggi * S;
  const ctx = cv.getContext('2d');
  ctx.scale(S, S);
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, PNG_LEBAR, tinggi);
  gambarKwitansi(ctx, d, bahasa, finId, { logo:img }, false);
  return cv;
}

/* Data URL PNG — dipakai untuk pratinjau di layar dan untuk diunduh. */
async function kwitansiPNG(d, bahasa, finId, opsi){
  const cv = await kwitansiCanvas(d, bahasa, finId, opsi);
  return cv.toDataURL('image/png');
}

/* Blob PNG — dipakai kalau nanti dikirim lewat WhatsApp. */
async function kwitansiPNGBlob(d, bahasa, finId, opsi){
  const cv = await kwitansiCanvas(d, bahasa, finId, opsi);
  return new Promise(function(resolve){ cv.toBlob(resolve, 'image/png'); });
}

/* Pratinjau gambar kwitansi + tombol unduh. */
async function openKwitansiPNG(donorId){
  const d = findDonor(donorId) || findDonor(suratState.previewId) ||
    findDonor(Object.keys(suratState.selected).filter(function(k){ return suratState.selected[k]; })[0]);
  if(!d){ toast('Pilih penerima dulu', true); return; }
  const bahasa = suratState.kwitansiBahasa;
  const finId = suratState.kwitansiFinId;
  const kodeKrm = kodeKiriman();
  const waktuKrm = waktuKirim();

  openModal({
    title:'Kwitansi sebagai gambar (PNG)',
    body:'<div id="png-root"><p class="muted small">Menggambar…</p></div>',
    footer:'<span class="tiny muted" style="margin-right:auto">' +
        'Gambar ini yang dipakai untuk WhatsApp. Email tetap memakai versi HTML.</span>' +
      '<button class="btn" data-close>Tutup</button>' +
      '<button class="btn primary" id="png-unduh" disabled>⤓ Unduh PNG</button>',
    wide:true
  });

  const root = document.getElementById('png-root');
  try{
    const url = await kwitansiPNG(d, bahasa, finId, { kodeKiriman:kodeKrm, waktuKirim:waktuKrm });
    const kb = Math.round((url.length - 'data:image/png;base64,'.length) * 3 / 4 / 1024);
    root.innerHTML =
      '<p class="small muted" style="margin:0 0 8px">' + esc(donorName(d)) + ' · ' +
        esc(KWITANSI_NAMA_BAHASA[bahasa] || 'Indonesia') + ' · ' +
        '<b>' + kb + ' KB</b> · lebar ' + PNG_LEBAR + ' px</p>' +
      '<div class="png-preview"><img src="' + url + '" alt="Kwitansi"></div>' +
      '<p class="tiny muted" style="margin:8px 0 0">Kode kiriman <b>' + esc(kodeKrm) +
        '</b> · dikirim ' + esc(waktuKrm) + '</p>';
    const btn = document.getElementById('png-unduh');
    if(btn){
      btn.disabled = false;
      btn.addEventListener('click', function(){
        const a = document.createElement('a');
        a.href = url;
        a.download = 'kwitansi-' + d.id + '-' + kodeKrm + '.png';
        a.click();
        toast('Gambar kwitansi diunduh');
      });
    }
  }catch(e){
    root.innerHTML = '<div class="warnbox">Gagal menggambar kwitansi: ' + esc(e.message || e) + '</div>';
  }
}

/* ---------- MAJALAH ---------- */
/* Halaman majalah disimpan sekali di Worker, lalu ditampilkan di badan email
   lewat alamat publik. Jadi penerima langsung melihat halamannya tanpa perlu
   membuka lampiran. */
function majalahInfo(){
  const m = state.settings.majalah;
  if(!m || !m.id || !m.halaman) return null;
  return m;
}

/* ---------- DAFTAR EDISI MAJALAH ----------
   Satu edisi aktif disimpan di `settings.majalah` (dipakai saat mengirim).
   Daftar seluruh edisi disimpan di `settings.majalahDaftar` supaya edisi lama
   tidak hilang saat edisi baru diunggah — jadi bisa mengirim edisi Oktober ke
   sebagian donor dan edisi November ke donor lain. */
function daftarMajalah(){
  if(!Array.isArray(state.settings.majalahDaftar)) state.settings.majalahDaftar = [];
  return state.settings.majalahDaftar;
}

/* Tambahkan/perbarui satu edisi di daftar. Edisi terbaru ditaruh paling atas. */
function simpanKeDaftarMajalah(info){
  if(!info || !info.id) return;
  const daftar = daftarMajalah().filter(function(x){ return x.id !== info.id; });
  daftar.unshift({
    id: info.id, judul: info.judul || 'Majalah Kartidaya',
    halaman: info.halaman || 0, pdf: !!info.pdf,
    dariPdf: !!info.dariPdf, diunggah: info.diunggah || new Date().toISOString()
  });
  state.settings.majalahDaftar = daftar.slice(0, 24);
  save('majalahDaftar');
}

/* Pakai satu edisi dari daftar sebagai edisi aktif. */
function pakaiEdisiMajalah(id){
  const e = daftarMajalah().filter(function(x){ return x.id === id; })[0];
  if(!e) return false;
  state.settings.majalah = {
    id: e.id, judul: e.judul, halaman: e.halaman,
    pdf: !!e.pdf, dariPdf: !!e.dariPdf, diunggah: e.diunggah
  };
  save('majalah');
  return true;
}
function workerBase(){
  return String(WhatsApp.endpoint || state.settings.waEndpoint || DEFAULT_WORKER).replace(/\/+$/, '');
}
function majalahURL(n){
  const m = majalahInfo();
  const base = workerBase();
  if(!m || !base) return '';
  return base + '/majalah/' + m.id + '/' + n;
}
/* Alamat halaman pembaca — satu halaman per layar, tinggal digeser. */
function majalahBacaURL(){
  const m = majalahInfo();
  const base = workerBase();
  if(!m || !base) return '';
  return base + '/baca/' + m.id;
}
/* Alamat PDF majalah — dipakai untuk lampiran WhatsApp. */
function majalahPDFURL(){
  const m = majalahInfo();
  const base = workerBase();
  if(!m || !base || !m.pdf) return '';
  return base + '/majalah-pdf/' + m.id + '.pdf';
}
/* Majalah di badan email: hanya SAMPUL + tombol "Baca majalah".
   Kenapa bukan semua halaman? Mengirim 10 gambar sekaligus membuat email
   berat dan sering dianggap spam. Dengan cara ini email tetap ringan, dan
   penerima membuka halamannya di halaman pembaca yang tampil rapi di HP. */
function majalahHTML(opts){
  opts = opts || {};
  const m = majalahInfo();
  if(!m) return '';
  const sampul = majalahURL(1);
  const baca = majalahBacaURL();
  if(!sampul) return '';
  const tombol = baca
    ? '<div style="margin:14px 0 0">' +
        '<a href="' + esc(baca) + '" style="display:inline-block;background:#2f6f9f;color:#fff;' +
          'text-decoration:none;font-size:14px;font-weight:bold;padding:11px 22px;border-radius:6px">' +
          'Baca majalah (' + m.halaman + ' halaman) →</a>' +
      '</div>' +
      '<div style="font-size:11.5px;color:#666;margin:8px 0 0">' +
        'Terbuka di layar HP — satu halaman per layar, tinggal digeser ke bawah.' +
      '</div>'
    : '';
  return '<div style="margin:22px 0 0;font-family:Arial,Helvetica,sans-serif;color:#111">' +
      '<div style="font-size:15px;font-weight:bold;margin-bottom:10px">' +
        esc(m.judul || 'Majalah Kartidaya') + '</div>' +
      '<div style="margin:0 0 4px">' +
        '<img src="' + esc(sampul) + '" alt="' + esc(m.judul || 'Majalah Kartidaya') + '" ' +
          'width="700" style="display:block;width:100%;max-width:700px;height:auto;border:0">' +
      '</div>' +
      tombol +
      (opts.tautan && baca
        ? '<div style="font-size:11.5px;color:#666;margin:10px 0 0">' +
            'Tombol tidak bisa diklik? Salin tautan ini ke browser:<br>' +
            '<a href="' + esc(baca) + '" style="color:#2f6f9f;word-break:break-all">' + esc(baca) + '</a>' +
          '</div>'
        : '') +
    '</div>';
}

/* ---------- TANDA DIBACA ---------- */
/* Gambar 1×1 yang dimuat klien email saat surat dibuka. Alamatnya mencatat
   pembukaan itu di Worker, jadi aplikasi bisa menandai "sudah dibaca". */
function pixelURL(id){
  const base = workerBase();
  if(!base || !id) return '';
  return base + '/pixel/' + id;
}
function pixelHTML(id){
  const src = pixelURL(id);
  if(!src) return '';
  return '<img src="' + esc(src) + '" width="1" height="1" alt="" ' +
    'style="display:block;width:1px;height:1px;border:0;outline:none">';
}
/* Alamat halaman konfirmasi penerimaan. Info surat ikut di query supaya
   halaman itu bisa menampilkan ringkasan tanpa perlu kunci aplikasi. */
function terimaURL(id, info){
  const base = workerBase();
  if(!base || !id) return '';
  const q = [];
  const t = function(k, v){ if(v) q.push(k + '=' + encodeURIComponent(String(v).slice(0, 120))); };
  t('j', info && info.judul);
  t('k', info && info.kwitansi);
  t('n', info && info.jumlah);
  t('d', info && info.donor);
  t('w', info && info.dikirim);
  return base + '/terima/' + id + (q.length ? '?' + q.join('&') : '');
}
/* Tombol "Konfirmasi sudah menerima" di badan email. Tanda dibaca (pixel)
   hanya petunjuk — kalau penerima memakai Gmail yang memblokir gambar, kita
   tidak tahu apa-apa. Tombol ini memberi kepastian. */
function terimaHTML(id, info, opts){
  opts = opts || {};
  const u = terimaURL(id, info);
  if(!u) return '';
  const gayaTombol = 'display:inline-block;background:#2f6f9f;color:#fff;' +
    'text-decoration:none;font-size:14px;font-weight:bold;padding:11px 22px;border-radius:6px';
  /* Di layar periksa tombolnya sengaja tidak bisa ditekan — kalau bisa, satu
     klik tidak sengaja akan tercatat sebagai konfirmasi penerima. */
  const tombol = opts.pratinjau
    ? '<span style="' + gayaTombol + '">✓ Konfirmasi sudah menerima</span>'
    : '<a href="' + esc(u) + '" style="' + gayaTombol + '">✓ Konfirmasi sudah menerima</a>';
  return '<div style="margin:22px 0 0;padding:16px 18px;border:1px solid #d8d8d0;' +
      'border-radius:8px;background:#fafaf6;font-family:Arial,Helvetica,sans-serif;max-width:720px">' +
      '<div style="font-size:13.5px;color:#333;margin:0 0 12px">' +
        'Sudah menerima surat dan kwitansi ini? Tekan tombol di bawah supaya kami tahu ' +
        'kiriman ini sampai dengan benar.' +
      '</div>' +
      tombol +
      '<div style="font-size:11px;color:#888;margin:10px 0 0">' +
        'Satu tekanan saja — tidak perlu menulis apa pun.' +
      '</div>' +
    '</div>';
}
/* Ringkasan jumlah kwitansi dalam satu baris teks — dipakai di halaman
   konfirmasi penerimaan supaya penerima bisa memastikan angkanya benar. */
function totalTransaksiRingkas(d, finId){
  const k = dataKwitansi(d, finId);
  if(!k.ada) return '';
  const kode = k.kodeUang.length ? k.kodeUang : ['IDR'];
  return kode.map(function(u){ return fmtUang(k.perUang[u] || 0, u); }).join(' + ');
}

/* Tanya Worker surat mana yang sudah dibuka penerima.
   `manual` = true kalau user menekan tombol sendiri, supaya ada kabar
   walau tidak ada perubahan (kalau tidak, tombolnya terasa "tidak bekerja"). */
async function cekTandaDibaca(manual){
  if(!WhatsApp.isConfigured()){
    if(manual) toast('Alamat Worker / kunci aplikasi belum diisi di Setelan', true);
    return;
  }
  const pending = state.messages.filter(function(m){
    return m.arah === 'keluar' && m.pixelId && !m.dibacaPenerima;
  }).slice(0, 200);
  if(!pending.length){
    if(manual) toast('Tidak ada surat yang menunggu kabar dibaca');
    return;
  }
  try{
    const r = await WhatsApp.api('/pixel/status', {
      method:'POST',
      body:{ ids: pending.map(function(m){ return m.pixelId; }) }
    });
    const map = (r && r.dibaca) || {};
    let n = 0;
    pending.forEach(function(m){
      const rec = map[m.pixelId];
      if(rec && rec.pertama){ m.dibacaPenerima = rec.pertama; n++; }
    });
    if(n){ save('messages'); render(); }
    if(manual) toast(n
      ? n + ' surat baru saja terbaca — tanda ✓✓ Dibaca diperbarui'
      : 'Diperiksa ' + pending.length + ' surat — belum ada yang dibuka penerima');
  }catch(e){
    if(manual) toast('Gagal memeriksa: ' + (e.message || e), true);
  }
}

/* Tanya Worker surat mana yang sudah DIKONFIRMASI penerima. Ini yang memberi
   kepastian — berbeda dari tanda dibaca yang bisa gagal kalau gambar diblokir. */
async function cekKonfirmasiTerima(manual){
  if(!WhatsApp.isConfigured()){
    if(manual) toast('Alamat Worker / kunci aplikasi belum diisi di Setelan', true);
    return;
  }
  const pending = state.messages.filter(function(m){
    return m.arah === 'keluar' && m.terimaId && !m.terimaPenerima;
  }).slice(0, 200);
  if(!pending.length){
    if(manual) toast('Tidak ada surat yang menunggu konfirmasi');
    return;
  }
  try{
    const r = await WhatsApp.api('/terima/status', {
      method:'POST',
      body:{ ids: pending.map(function(m){ return m.terimaId; }) }
    });
    const map = (r && r.terima) || {};
    let n = 0;
    pending.forEach(function(m){
      const rec = map[m.terimaId];
      if(rec && rec.waktu){ m.terimaPenerima = rec.waktu; n++; }
    });
    if(n){ save('messages'); render(); }
    if(manual) toast(n
      ? n + ' donor baru saja mengonfirmasi penerimaan'
      : 'Diperiksa ' + pending.length + ' surat — belum ada konfirmasi baru');
  }catch(e){
    if(manual) toast('Gagal memeriksa: ' + (e.message || e), true);
  }
}

/* Program dukungan contoh. Bisa ditambah/ubah/hapus dari halaman Keuangan. */
const DEFAULT_PROGRAMS = [
  { id:'PRG-01', nama:'Beasiswa Anak Pelayan', aktif:true },
  { id:'PRG-02', nama:'Pembangunan Gedung',    aktif:true },
  { id:'PRG-03', nama:'Operasional Pelayanan', aktif:true },
  { id:'PRG-04', nama:'Bantuan Bencana',       aktif:true },
  { id:'PRG-05', nama:'Pelatihan & Seminar',   aktif:true }
];

function uangInfo(kode){
  return MATA_UANG.filter(function(m){ return m.kode === kode; })[0] || MATA_UANG[0];
}
/* Format angka jadi "Rp 1.500.000" / "$1,500.00". */
function fmtUang(n, kode){
  const m = uangInfo(kode);
  const v = Number(n) || 0;
  const desimal = m.kode === 'IDR' ? 0 : 2;
  const angka = v.toLocaleString(m.locale, { minimumFractionDigits:desimal, maximumFractionDigits:desimal });
  return m.kode === 'IDR' ? m.simbol + ' ' + angka : m.simbol + angka;
}
/* Angka saja tanpa simbol — dipakai kwitansi yang menaruh simbol terpisah. */
function angkaUang(n, kode){
  const m = uangInfo(kode);
  const desimal = m.kode === 'IDR' ? 0 : 2;
  return (Number(n) || 0).toLocaleString(m.locale,
    { minimumFractionDigits:desimal, maximumFractionDigits:desimal });
}
/* Total per mata uang — tidak dijumlahkan lintas mata uang karena kursnya
   berbeda dan bisa berubah. Menerima record keuangan (dijumlahkan dari
   programnya) maupun objek ringkas { mataUang, jumlah }. */
function totalPerUang(list){
  const map = {};
  list.forEach(function(f){
    if(Array.isArray(f.program)){
      /* Tiap baris program boleh punya mata uang sendiri. */
      const t = totalPerUangTransaksi(f);
      Object.keys(t).forEach(function(k){ map[k] = (map[k] || 0) + t[k]; });
    }else{
      const k = f.mataUang || 'IDR';
      map[k] = (map[k] || 0) + (Number(f.jumlah) || 0);
    }
  });
  return map;
}
function programById(id){
  return state.programs.filter(function(p){ return p.id === id; })[0] || null;
}
function programNama(id){
  const p = programById(id);
  return p ? p.nama : id;
}
/* Mata uang satu baris program. Baris lama (sebelum ada pilihan per baris)
   tidak punya `mataUang` sendiri, jadi jatuh ke mata uang transaksinya. */
function mataUangBaris(x, f){
  return (x && x.mataUang) || (f && f.mataUang) || 'IDR';
}
/* Nominal satu baris program di dalam satu transaksi. */
function nominalProgram(f, programId){
  const baris = (f.program || []).filter(function(x){ return x.id === programId; })[0];
  return baris ? Number(baris.jumlah) || 0 : 0;
}
/* Total satu transaksi, dipisah per mata uang.
   Transaksi lama (sebelum ada pilihan program per baris) hanya punya
   `mataUang` + `jumlah` di tingkat transaksi, tanpa array `program`. Tanpa
   cabang di bawah, transaksi seperti itu dihitung Rp 0 — kwitansinya tercetak
   nol padahal catatannya ada. */
function totalPerUangTransaksi(f){
  const map = {};
  if(!Array.isArray(f.program) || !f.program.length){
    const k = f.mataUang || 'IDR';
    const jml = Number(f.jumlah) || 0;
    if(jml) map[k] = jml;
    return map;
  }
  f.program.forEach(function(x){
    const k = mataUangBaris(x, f);
    map[k] = (map[k] || 0) + (Number(x.jumlah) || 0);
  });
  return map;
}
/* Total satu transaksi kalau semua barisnya sejenis. Kalau campur, kembalikan
   angka baris pertama saja — dipakai hanya untuk pengurutan/tampilan ringkas. */
function totalTransaksi(f){
  const t = totalPerUangTransaksi(f);
  const kode = Object.keys(t);
  if(kode.length === 1) return t[kode[0]];
  return kode.length ? t[kode[0]] : 0;
}
/* Mata uang utama transaksi: kalau semua baris sama, pakai itu; kalau campur,
   pakai baris pertama. Dipakai untuk label ringkas di daftar. */
function mataUangTransaksi(f){
  const kode = Object.keys(totalPerUangTransaksi(f));
  if(kode.length === 1) return kode[0];
  return (f.program && f.program[0] && mataUangBaris(f.program[0], f)) || f.mataUang || 'IDR';
}
/* Tampilan total transaksi: satu angka kalau sejenis, beberapa baris kalau
   mata uangnya campur. */
function totalTransaksiHTML(f){
  const t = totalPerUangTransaksi(f);
  const kode = Object.keys(t).sort();
  if(!kode.length) return esc(fmtUang(0, 'IDR'));
  return kode.map(function(k){ return esc(fmtUang(t[k], k)); }).join('<br>');
}

/* ---------- 2. STATE ---------- */
let state = { donors:[], categories:[], templates:[], messages:[], settings:{}, programs:[], finance:[], isian:[] };

function readLS(key, fallback){
  try{
    const raw = localStorage.getItem(key);
    if(raw === null) return fallback;
    const v = JSON.parse(raw);
    return (v === null || v === undefined) ? fallback : v;
  }catch(e){ return fallback; }
}
function writeLS(key, val){
  try{ localStorage.setItem(key, JSON.stringify(val)); }
  catch(e){ toast('Gagal menyimpan — penyimpanan browser penuh', true); }
}
function save(what){
  /* Selama aplikasi terkunci (server tidak bisa dihubungi), data bersama tidak
     boleh disimpan. Kalau disimpan, perubahan akan tampak "berhasil" padahal
     tidak pernah sampai ke server — dan hilang saat halaman dimuat ulang.
     Pengecualian: `settings` & `uji` memang milik komputer ini sendiri, dan
     Setelan harus tetap bisa disimpan supaya alamat/kunci bisa diperbaiki.
     `majalah` & `majalahDaftar` ikut dikecualikan karena keduanya data
     bersama — lihat catatan di bawah. */
  if(terkunciServer && what && what !== 'settings' && what !== 'uji' &&
     what !== 'majalah' && what !== 'majalahDaftar') return;
  /* Catat penghapusan SEBELUM data dikirim. Pembandingnya `Server.diketahui`
     (id yang kita tahu ada di server), bukan localStorage — lihat catatHapus. */
  const namaKoleksi = what ? [what] : Server.koleksi;
  namaKoleksi.forEach(function(nama){
    if(Server.koleksi.indexOf(nama) < 0) return;
    Server.catatHapus(nama);
  });
  if(!what || what === 'donors')     writeLS(LS.donors, state.donors);
  if(!what || what === 'categories') writeLS(LS.categories, state.categories);
  if(!what || what === 'templates')  writeLS(LS.templates, state.templates);
  if(!what || what === 'messages')   writeLS(LS.messages, state.messages);
  if(!what || what === 'settings')   writeLS(LS.settings, state.settings);
  if(!what || what === 'majalah')    writeLS(LS.settings, state.settings);
  if(!what || what === 'majalahDaftar') writeLS(LS.settings, state.settings);
  if(!what || what === 'programs')   writeLS(LS.programs, state.programs);
  if(!what || what === 'finance')    writeLS(LS.finance, state.finance);
  if(!what || what === 'isian')      writeLS(LS.isian, state.isian);
  if(!what || what === 'uji')        writeLS(LS.uji, state.uji);
  /* Kirim ke server juga, supaya pengguna lain melihat perubahannya.
     `settings` & `uji` tidak dikirim: keduanya milik komputer ini sendiri
     (tema, alamat email uji, catatan uji) — bukan data bersama.
     `majalah` & `majalahDaftar` DIKIRIM: edisi majalah yang aktif dipakai
     bersama, jadi pengguna lain harus melihat edisi yang sama. */
  if(what && what !== 'settings' && what !== 'uji') Server.kirim(what);
}

/* ============================================================
   DATA BERSAMA (Cloudflare D1 lewat Worker)

   Kenapa perlu? Aplikasi ini dipakai lebih dari satu orang. Kalau data hanya
   disimpan di browser (localStorage), tiap orang punya salinannya sendiri dan
   tidak ada pertukaran data. Jadi data disimpan di server, dan browser hanya
   menyimpan salinan sementara supaya tampilan tetap cepat.

   Cara kerja singkat:
   - Saat aplikasi dibuka  → ambil semua data dari server (Server.muat)
   - Setiap kali menyimpan → kirim perubahannya ke server (Server.kirim)
   - Kalau gagal           → beri tahu, dan data tetap aman di browser
   ============================================================ */
const Server = {
  siap: false,        /* apakah alamat & kunci sudah ada */
  online: false,      /* apakah server terakhir kali bisa dihubungi */
  sibuk: 0,           /* berapa pengiriman sedang berjalan */
  gagal: 0,           /* berapa pengiriman gagal sejak terakhir berhasil */
  tertunda: {},       /* koleksi yang gagal terkirim, menunggu dikirim ulang */
  hapus: {},          /* id yang sudah dihapus di sini, belum dihapus di server */
  diketahui: {},      /* id yang kita tahu ADA di server (dari muat/kirim sukses) */
  terakhir: '',       /* waktu sinkron terakhir berhasil */
  pesan: '',          /* pesan galat terakhir */

  /* Baca/tulis daftar perubahan tertunda dari browser. */
  bacaTertunda(){
    try{ this.tertunda = JSON.parse(localStorage.getItem(LS_TERTUNDA) || '{}') || {}; }
    catch(e){ this.tertunda = {}; }
    try{ this.hapus = JSON.parse(localStorage.getItem(LS_HAPUS) || '{}') || {}; }
    catch(e){ this.hapus = {}; }
    return this.tertunda;
  },
  simpanTertunda(){
    try{ localStorage.setItem(LS_TERTUNDA, JSON.stringify(this.tertunda)); }catch(e){ /* penuh — abaikan */ }
    try{ localStorage.setItem(LS_HAPUS, JSON.stringify(this.hapus)); }catch(e){ /* penuh — abaikan */ }
  },
  /* Daftar id dari sebuah koleksi. Dipakai untuk membandingkan. */
  idDari(daftar){
    return (daftar || []).map(function(b){
      return String(b && (b.id !== undefined ? b.id : b.kode));
    }).filter(function(id){ return id && id !== 'undefined' && id !== 'null'; });
  },
  /* Catat bahwa satu baris sengaja dihapus di komputer ini.
     Pembandingnya adalah `diketahui` — daftar id yang kita TAHU ada di server
     (hasil muat terakhir atau kirim yang berhasil), BUKAN isi localStorage.
     Alasannya penting: localStorage dipakai bersama oleh semua tab di komputer
     ini. Kalau pembandingnya localStorage, perubahan yang ditulis tab lain
     akan terlihat seperti penghapusan — dan pekerjaan rekan ikut terhapus. */
  catatHapus(nama){
    const adaSekarang = {};
    this.idDari(state[nama]).forEach(function(id){ adaSekarang[id] = true; });
    const daftar = this.hapus[nama] || (this.hapus[nama] = []);
    (this.diketahui[nama] || []).forEach(function(id){
      if(!adaSekarang[id] && daftar.indexOf(id) < 0) daftar.push(id);
    });
    /* Kalau id yang pernah dihapus muncul lagi (mis. dibatalkan atau diimpor
       ulang), jangan dihapus dari server. */
    for(let i = daftar.length - 1; i >= 0; i--){
      if(adaSekarang[daftar[i]]) daftar.splice(i, 1);
    }
  },

  /* Koleksi yang disimpan di server. `settings` & `uji` TIDAK termasuk —
     keduanya milik komputer masing-masing. */
  koleksi: ['donors','categories','templates','messages','programs','finance'],

  /* Data bersama cukup butuh alamat server. Kunci aplikasi TIDAK wajib:
       server juga menerima token login. Kunci hanya diperlukan untuk mengatur
       WhatsApp & majalah di Setelan. */
    bisa(){
      return !!workerBase();
  },

  async panggil(path, opsi){
    const base = workerBase();
      const headers = { 'Content-Type': 'application/json' };
      if(WhatsApp.appKey) headers['X-App-Key'] = WhatsApp.appKey;
      if(typeof Akun !== 'undefined' && Akun.token) headers['Authorization'] = 'Bearer ' + Akun.token;
          const res = await fetch(base + path, Object.assign({ headers: headers }, opsi || {}));
    const teks = await res.text();
    let data = null;
    try{ data = JSON.parse(teks); }catch(e){ data = null; }
    if(!res.ok){
      const pesan = (data && (data.error || data.petunjuk)) || ('HTTP ' + res.status);
            /* Simpan statusnya: kalau 401 karena belum masuk, yang perlu dilakukan
               adalah masuk — bukan mengisi kunci aplikasi. */
            const err = new Error(pesan);
            err.status = res.status;
            throw err;
    }
    return data || {};
  },

  /* Ambil semua data dari server lalu pasang ke state. */
  async muat(){
    if(!this.bisa()){ this.tandai('mati', 'Data bersama belum diatur'); return false; }
    this.tandai('muat', 'Memuat data…');
    try{
      const r = await this.panggil('/data');
      const k = r.koleksi || {};
      /* Jaring pengaman untuk pemakaian PERTAMA KALI: kalau server masih
         KOSONG untuk sebuah koleksi padahal di browser ini ada isinya, jangan
         timpa. Kalau ditimpa, data yang belum pernah diunggah akan hilang
         tanpa jejak. Data browser dipertahankan dan ditandai perlu diunggah.
         Hanya berlaku sebelum browser ini pernah berhasil sinkron — sesudah
         itu, server selalu dianggap yang benar (mis. semua donor memang
         sengaja dihapus).
         Catatan: server TIDAK mengirim kunci untuk koleksi yang masih kosong,
         jadi "tidak ada kunci" harus dibaca sebagai "kosong". */
      const pertamaKali = !localStorage.getItem(LS_PERNAH_SINKRON);
      const perluUnggah = [];
      this.koleksi.forEach(function(nama){
        const dariServer = Array.isArray(k[nama]) ? k[nama] : null;
        const diBrowser = state[nama] || [];
        if(pertamaKali && diBrowser.length > 0 && (!dariServer || dariServer.length === 0)){
          perluUnggah.push(nama);
          return;                       /* pertahankan data browser */
        }
        if(dariServer) state[nama] = dariServer;
      });
      if(r.meta && Array.isArray(r.meta.isian)) state.isian = r.meta.isian;
      if(r.meta && r.meta.majalah) state.settings.majalah = r.meta.majalah;
      if(r.meta && Array.isArray(r.meta.majalahDaftar)) state.settings.majalahDaftar = r.meta.majalahDaftar;
      /* Pemulihan: kalau catatan edisi aktif tidak ada di server tetapi daftar
         edisi memuatnya, pakai edisi teratas dari daftar. Tanpa ini, pengguna
         kedua yang membuka aplikasi melihat "majalah belum disiapkan" padahal
         edisinya sudah diunggah rekan kerjanya. */
      let pulihkanMajalah = false;
      if(!state.settings.majalah && Array.isArray(state.settings.majalahDaftar) &&
         state.settings.majalahDaftar.length){
        const e = state.settings.majalahDaftar[0];
        if(e && e.id){
          state.settings.majalah = {
            id: e.id, judul: e.judul, halaman: e.halaman,
            pdf: !!e.pdf, dariPdf: !!e.dariPdf, diunggah: e.diunggah
          };
          pulihkanMajalah = true;
        }
      }
      /* Perbarui daftar id yang kita tahu ada di server. Ini pembanding untuk
         mendeteksi penghapusan — lihat catatHapus. */
      const ini = this;
      this.koleksi.forEach(function(nama){
        ini.diketahui[nama] = ini.idDari(k[nama]);
      });
      /* Tulis salinan ke browser supaya tampilan berikutnya cepat. */
      this.koleksi.forEach(function(nama){ writeLS(LS[nama], state[nama]); });
      writeLS(LS.isian, state.isian);
      writeLS(LS.settings, state.settings);
      this.siap = true;
      this.online = true;
      this.gagal = 0;
      this.terakhir = new Date().toISOString();
      try{ localStorage.setItem(LS_PERNAH_SINKRON, '1'); }catch(e){ /* abaikan */ }
      /* Edisi majalah dipulihkan dari daftar — kirim ke server supaya pengguna
         lain juga melihatnya sebagai edisi aktif. Tidak dihitung sebagai
         "server masih kosong", jadi tidak ikut pesan peringatan di bawah. */
      if(pulihkanMajalah){
        Server.tertunda.majalah = true;
        this.simpanTertunda();
      }
      /* Transaksi yang datang dari server bisa belum punya kode kwitansi:
         lengkapiKodeKwitansi() di loadState() berjalan SEBELUM data server
         dimuat, jadi yang diberi kode saat itu hanya data di browser. Tanpa
         panggilan di sini, kwitansi transaksi dari server tercetak
         "KWT-20261101-????". Dijalankan setelah `siap` & `diketahui` benar,
         supaya save() mengirim kode barunya ke server. */
      lengkapiKodeKwitansi();
      if(perluUnggah.length){
        /* Tandai supaya dikirim ke server — bukan dibuang. */
        perluUnggah.forEach(function(nama){ Server.tertunda[nama] = true; });
        this.simpanTertunda();
        this.tandai('gagal', 'Ada data di komputer ini yang belum ada di server');
        toast('Server masih kosong untuk ' + perluUnggah.length + ' jenis data. ' +
          'Data di komputer ini dipertahankan dan akan dikirim ke server.', true);
      }else{
        this.tandai('ok', 'Data bersama tersambung');
      }
      return true;
    }catch(e){
      this.online = false;
      this.pesan = e.message || String(e);
      this.tandai('gagal', 'Gagal memuat data bersama: ' + this.pesan);
      return false;
    }
  },

  /* Kirim satu koleksi ke server. Dipanggil dari save(). */
  async kirim(nama){
    if(!this.bisa() || !this.siap) return;
    if(this.koleksi.indexOf(nama) < 0 && nama !== 'isian' && nama !== 'majalah' && nama !== 'majalahDaftar') return;
    this.sibuk++;
    this.tandai('simpan', 'Menyimpan…');
    try{
      if(nama === 'isian'){
        await this.panggil('/data/meta/isian', { method:'POST', body: JSON.stringify({ data: state.isian }) });
      }else if(nama === 'majalah'){
        await this.panggil('/data/meta/majalah', { method:'POST', body: JSON.stringify({ data: state.settings.majalah || null }) });
      }else if(nama === 'majalahDaftar'){
        await this.panggil('/data/meta/majalahDaftar', { method:'POST', body: JSON.stringify({ data: daftarMajalah() }) });
      }else{
        /* Kirim seluruh koleksi: yang sudah ada diganti, yang baru ditambah.
           Cara ini sederhana dan aman untuk jumlah data sekecil ini
           (18 donor, ratusan surat) — tidak perlu melacak mana yang berubah. */
        const daftar = state[nama] || [];
        for(const baris of daftar){
          const id = baris && (baris.id !== undefined ? baris.id : baris.kode);
          if(id === undefined || id === null || String(id) === '') continue;
          await this.panggil('/data/' + nama, {
            method:'POST', body: JSON.stringify({ id: String(id), data: baris })
          });
        }
        /* Hapus di server HANYA baris yang memang sengaja dihapus di komputer
           ini (lihat catatHapus). Sengaja tidak membandingkan daftar lokal
           dengan daftar server: kalau dibandingkan, pekerjaan rekan yang baru
           ditambahkan akan ikut terhapus setiap kali kita menyimpan. */
        const akanDihapus = (this.hapus[nama] || []).slice();
        for(const id of akanDihapus){
          await this.panggil('/data/' + nama + '/' + encodeURIComponent(id) + '/hapus', { method:'POST' });
        }
        if(akanDihapus.length){
          this.hapus[nama] = [];
          this.simpanTertunda();
        }
        /* Perbarui daftar id yang kita tahu ada di server: semua yang baru
           saja dikirim, dikurangi yang baru saja dihapus. */
        const masihAda = {};
        this.idDari(daftar).forEach(function(id){ masihAda[id] = true; });
        akanDihapus.forEach(function(id){ delete masihAda[id]; });
        this.diketahui[nama] = Object.keys(masihAda);
      }
      this.online = true;
      this.gagal = 0;
      delete this.tertunda[nama];
      this.simpanTertunda();
      this.terakhir = new Date().toISOString();
      this.tandai('ok', 'Tersimpan di server');
    }catch(e){
      this.online = false;
      this.gagal++;
      /* Catat supaya bisa dicoba lagi otomatis — perubahan tidak boleh hilang
         hanya karena internet sempat putus. */
      this.tertunda[nama] = true;
      this.simpanTertunda();
      this.pesan = e.message || String(e);
      this.tandai('gagal', 'Gagal menyimpan ke server: ' + this.pesan);
    }finally{
      this.sibuk--;
    }
  },

  /* Kirim ulang semua yang tertunda. Dipanggil berkala dan saat tab aktif lagi. */
  async kirimTertunda(){
    if(!this.bisa()) return;
    if(this.sibuk) return;
    const daftar = Object.keys(this.tertunda);
    if(!daftar.length) return;
    this.siap = true;
    for(const nama of daftar){
      await this.kirim(nama);
      if(!this.online) return;   /* masih putus — jangan buang waktu */
    }
  },

  /* Tampilkan keadaan di chip header. */
  tandai(keadaan, pesan){
    const el = document.getElementById('simpan-status');
    if(el){
      const peta = {
        mati:   ['plain', '☁ Belum diatur'],
        muat:   ['plain', '☁ Memuat…'],
        simpan: ['plain', '☁ Menyimpan…'],
        ok:     ['ok',    '☁ Tersimpan'],
        gagal:  ['warn',  '☁ Gagal']
      };
      const p = peta[keadaan] || peta.mati;
      el.className = 'chip ' + p[0];
      el.textContent = p[1];
      el.title = pesan || '';
    }
    /* Banner peringatan: hanya untuk keadaan yang benar-benar bermasalah.
       `mati` (belum diatur) tidak perlu banner — layar Setelan sudah jelas. */
    const b = document.getElementById('banner-offline');
    if(b){
      const perlu = (keadaan === 'gagal');
      b.hidden = !perlu;
      if(perlu){
        const t = document.getElementById('banner-offline-teks');
        if(t) t.textContent = pesan || 'Perubahan tidak tersimpan. Periksa sambungan internet.';
      }
    }
  }
};
function loadState(){
  const firstRun = localStorage.getItem(LS.donors) === null;
  state.donors     = readLS(LS.donors, null) || SEED_DONORS.slice();
  state.categories = readLS(LS.categories, null) || DEFAULT_CATEGORIES.slice();
  state.templates  = readLS(LS.templates, null) || DEFAULT_TEMPLATES.slice();
  state.messages   = readLS(LS.messages, null) || [];
  state.settings   = readLS(LS.settings, null) || {};
  state.programs   = readLS(LS.programs, null) || DEFAULT_PROGRAMS.slice();
  state.finance    = readLS(LS.finance, null) || [];
  state.isian      = readLS(LS.isian, null) || [];
  state.uji        = readLS(LS.uji, null) || [];
  if(!state.settings.theme) state.settings.theme = 'light';
  if(!state.settings.gmailClientId) state.settings.gmailClientId = DEFAULT_CLIENT_ID;
  /* Client ID lama milik project yang tidak bisa diakses akun ini — sumber
     error `access_denied`. Ganti otomatis supaya tidak perlu reset manual. */
  if(state.settings.gmailClientId.indexOf('205859365311-') === 0){
    state.settings.gmailClientId = DEFAULT_CLIENT_ID;
    save('settings');
  }
  if(!state.settings.signature) state.settings.signature = 'Hormat kami,\nKartidaya';
  /* Sinkron otomatis: tarik surat masuk sendiri di latar belakang supaya
     pengguna tidak perlu bolak-balik ke Setelan. */
  if(state.settings.autoSync === undefined) state.settings.autoSync = true;
  if(!state.settings.syncMinutes) state.settings.syncMinutes = 10;
  if(!state.settings.lastSync) state.settings.lastSync = '';
  /* WhatsApp — alamat Worker & kunci aplikasi disimpan di localStorage
     (lihat whatsapp.js), sisanya di sini. Alamat Worker diisi nilai bawaan
     supaya tidak pernah kosong: alamat itu juga dipakai fitur EMAIL (majalah
     di email, tanda dibaca), jadi tidak boleh hilang. */
  if(!state.settings.waEndpoint) state.settings.waEndpoint = DEFAULT_WORKER;
  if(state.settings.waAutoSync === undefined) state.settings.waAutoSync = true;
  if(!state.settings.waSyncMinutes) state.settings.waSyncMinutes = 10;
  if(!state.settings.waLastSync) state.settings.waLastSync = '';
  /* Alamat untuk koreksi kwitansi — dicetak di kwitansi supaya donor tahu
     harus menghubungi ke mana kalau ada yang salah. */
  if(!state.settings.kontakKoreksi) state.settings.kontakKoreksi = 'finance@kartidaya.org';
  /* Alamat email uji — tujuan tombol "Kirim ke saya sendiri dulu". Dikosongkan
     berarti pakai alamat Gmail yang sedang tersambung. Diisi kalau ingin
     salinan uji dikirim ke alamat lain (mis. email kantor). */
  if(state.settings.emailUji === undefined) state.settings.emailUji = '';
  /* Pratinjau wajib: sebelum benar-benar mengirim, layar "Periksa sebelum
     kirim" muncul lebih dulu. Aktif secara bawaan karena ini pengaman utama
     terhadap salah kirim — bisa dimatikan di Setelan kalau dirasa mengganggu. */
  if(state.settings.wajibPeriksa === undefined) state.settings.wajibPeriksa = true;
  /* Pengingat mencadangkan data. `cadanganTerakhir` diisi setiap kali Ekspor
     JSON ditekan; `cadanganTunda` diisi kalau pengingat ditunda. Keduanya
     disimpan di settings supaya tidak muncul lagi setelah ditunda. */
  if(state.settings.cadanganTerakhir === undefined) state.settings.cadanganTerakhir = '';
  if(state.settings.cadanganTunda === undefined) state.settings.cadanganTunda = '';
  /* Lima isian serba guna — selalu ada 5 baris supaya token {/ISI1}…{/ISI5}
     tidak pernah kosong tanpa penjelasan. */
  while(state.isian.length < ISIAN_MAKS) state.isian.push('');
  state.isian = state.isian.slice(0, ISIAN_MAKS).map(function(v){ return String(v || ''); });
  /* Template undangan bawaan versi lama belum memakai token isian — pindahkan
     ke versi baru supaya kolom Hari/Waktu/Tempat langsung terisi. */
  let tplBerubah = false;
  state.templates.forEach(function(t){
    if(t.id === 'tpl-undangan' && t.isi === TPL_UNDANGAN_LAMA){
      t.isi = DEFAULT_TEMPLATES[2].isi;
      tplBerubah = true;
    }
  });
  if(tplBerubah) save('templates');
  /* Transaksi lama belum punya kode kwitansi — lengkapi sekali di sini. */
  lengkapiKodeKwitansi();
  if(firstRun) save();
}

/* ---------- 3. UTILITAS ---------- */
function esc(s){
  return String(s === null || s === undefined ? '' : s)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}
function uid(p){ return (p || 'id') + '-' + Date.now().toString(36) + Math.random().toString(36).slice(2,7); }
function todayID(){
  return new Date().toLocaleDateString('id-ID',{day:'numeric',month:'long',year:'numeric'});
}
function fmtDate(iso){
  if(!iso) return '—';
  const d = new Date(iso);
  return isNaN(d) ? iso : d.toLocaleDateString('id-ID',{day:'2-digit',month:'short',year:'numeric'});
}
function fmtDateTime(iso){
  if(!iso) return '—';
  const d = new Date(iso);
  return isNaN(d) ? iso : d.toLocaleDateString('id-ID',{day:'2-digit',month:'short',year:'numeric'}) +
    ' ' + d.toLocaleTimeString('id-ID',{hour:'2-digit',minute:'2-digit'});
}
function relTime(iso){
  const d = new Date(iso);
  if(isNaN(d)) return '';
  const diff = Date.now() - d.getTime();
  const m = Math.floor(diff / 60000);
  if(m < 1) return 'baru saja';
  if(m < 60) return m + ' menit lalu';
  const h = Math.floor(m / 60);
  if(h < 24) return h + ' jam lalu';
  const dd = Math.floor(h / 24);
  if(dd < 7) return dd + ' hari lalu';
  return fmtDate(iso);
}
function toast(msg, isErr){
  const root = document.getElementById('toast');
  const el = document.createElement('div');
  el.className = 'toast' + (isErr ? ' err' : '');
  el.textContent = msg;
  if(isErr){
    el.title = 'Klik untuk menutup';
    el.addEventListener('click', function(){ el.remove(); });
  }
  root.appendChild(el);
  setTimeout(function(){ el.remove(); }, isErr ? 12000 : 3000);
}
function donorName(d){ return d.pic || d.namaLengkap || d.instansi || '(tanpa nama)'; }
/* Nomor project Google Cloud tersembunyi di depan Client ID:
   `531116872278-xxxx.apps.googleusercontent.com` → `531116872278`.
   Dipakai untuk memastikan user membuka project yang benar saat mengurus
   Test users — penyebab paling umum error `access_denied`. */
function projectNumber(clientId){
  const m = String(clientId || '').match(/^(\d{6,})-/);
  return m ? m[1] : '';
}
async function copyText(t){
  try{
    await navigator.clipboard.writeText(t);
    toast('Disalin: ' + t);
  }catch(e){
    toast('Gagal menyalin — salin manual: ' + t, true);
  }
}
function donorLabel(d){ return (d.panggilan ? d.panggilan + ' ' : '') + donorName(d); }
function findDonor(id){
  for(let i = 0; i < state.donors.length; i++) if(state.donors[i].id === id) return state.donors[i];
  return null;
}

/* ---------- EMAIL & HP UTAMA ----------
   Setiap donor punya dua email dan dua nomor HP. Salah satu dari masing-masing
   pasangan ditandai UTAMA lewat centang di form donor; yang utama itulah yang
   dipakai sistem: alamat tujuan surat, nomor WhatsApp, dan yang ditampilkan di
   daftar donor.

   Penandanya disimpan sebagai `emailUtama` / `hpUtama` berisi 1 atau 2. Data
   lama tidak punya penanda ini, jadi dianggap 1 (perilaku sebelumnya: email dan
   HP 1 yang dipakai). Kalau yang ditandai utama ternyata kosong sedangkan yang
   lain terisi, yang terisi itulah yang dipakai — supaya surat tidak gagal
   terkirim hanya karena centangnya tertinggal di kolom kosong. */
function pilihUtama(nomor, a, b){
  const satu = String(a || '').trim();
  const dua = String(b || '').trim();
  if(Number(nomor) === 2) return dua || satu;
  return satu || dua;
}
function emailUtama(d){
  if(!d) return '';
  return pilihUtama(d.emailUtama, d.email, d.email2);
}
/* Email kedua — yaitu kolom yang TIDAK dipakai sebagai utama. Kalau kolom
   utama kosong, `emailUtama()` meminjam kolom satunya; dalam keadaan itu tidak
   ada email kedua, jadi kembalikan kosong. Tanpa ini alamat yang sama tampil
   dua kali ("a@x.id / a@x.id"). */
function emailLain(d){
  if(!d) return '';
  const utama = emailUtama(d);
  const satu = String(d.email || '').trim();
  const lain = utama === satu ? String(d.email2 || '').trim() : satu;
  return lain === utama ? '' : lain;
}
function hpUtama(d){
  if(!d) return '';
  return pilihUtama(d.hpUtama, d.hp1, d.hp2);
}
/* Nomor HP kedua — sama alasannya dengan `emailLain()`. */
function hpLain(d){
  if(!d) return '';
  const utama = hpUtama(d);
  const satu = String(d.hp1 || '').trim();
  const lain = utama === satu ? String(d.hp2 || '').trim() : satu;
  return lain === utama ? '' : lain;
}
/* Semua alamat email donor, untuk pencocokan surat masuk. */
function emailDonor(d){
  if(!d) return [];
  return [d.email, d.email2].map(function(e){ return String(e || '').trim().toLowerCase(); })
    .filter(Boolean);
}

/* Cocokkan pengirim ke donor lewat email 1 ATAU email 2. */
function donorByEmail(addr){
  const e = String(addr || '').trim().toLowerCase();
  if(!e) return null;
  for(let i = 0; i < state.donors.length; i++){
    if(emailDonor(state.donors[i]).indexOf(e) >= 0) return state.donors[i];
  }
  return null;
}
/* Cocokkan pengirim WhatsApp ke donor lewat nomor HP 1 atau HP 2. Nomor
   dinormalkan dulu (0811… → 62811…) supaya format penulisan tidak penting. */
function donorByPhone(num){
  const n = waPhone(num);
  if(!n) return null;
  for(let i = 0; i < state.donors.length; i++){
    const d = state.donors[i];
    if(waPhone(d.hp1) === n || waPhone(d.hp2) === n) return d;
  }
  return null;
}
/* Nomor WhatsApp donor: pakai HP utama, kalau kosong baru yang lain. */
function donorWa(d){
  if(!d) return '';
  return waPhone(hpUtama(d));
}

/* ---------- 4. GENERATOR ID [X]99999[Z] ---------- */
function idLetter(pic, instansi){
  const src = String(instansi || '').trim() || String(pic || '').trim();
  const m = src.match(/[A-Za-z]/);
  return m ? m[0].toUpperCase() : 'X';
}
function nextDonorId(pic, instansi, suffix){
  const letter = idLetter(pic, instansi);
  let max = 0;
  state.donors.forEach(function(d){
    const id = String(d.id || '').toUpperCase();
    if(id.charAt(0) !== letter) return;
    const n = parseInt(id.slice(1, -1), 10);
    if(!isNaN(n) && n > max) max = n;
  });
  const sfx = String(suffix || 'R').trim().toUpperCase().charAt(0) || 'R';
  return letter + String(max + 1).padStart(5,'0') + sfx;
}
function idParts(id){
  const s = String(id || '');
  return { letter:s.charAt(0) || '?', num:s.slice(1,-1) || '—', suffix:s.slice(-1) || '?' };
}

/* ---------- 5. TEMPLATE ---------- */
function fillTemplate(text, d){
  const map = {
    '/PIC': donorLabel(d),
    '/PANGGILAN': d.panggilan || '',
    '/NAMA': d.pic || d.namaLengkap || '',
    '/INST': d.instansi || '',
    '/NAMA_LENGKAP': d.namaLengkap || d.pic || '',
    '/ID': d.id || '',
    '/KATEGORI': d.kategori || '',
    '/EMAIL': emailUtama(d),
    '/EMAIL2': emailLain(d),
    '/HP': hpUtama(d),
    '/HP2': hpLain(d),
    '/ALAMAT': d.alamat || '',
    '/TANGGAL': todayID()
  };
  /* Isian serba guna — diisi sekali di halaman Tulis, dipakai di semua surat. */
  ISIAN_FIELD.forEach(function(f){
    map['/ISI' + f.n] = state.isian[f.n - 1] || '';
  });
  return String(text || '').replace(/\{\/([A-Z_0-9]+)\}/g, function(m, k){
    const key = '/' + k;
    return Object.prototype.hasOwnProperty.call(map, key) ? map[key] : m;
  });
}

/* ---------- 6. BUKU (MESSAGES) ---------- */
function bookOf(donorId){
  return state.messages.filter(function(m){ return m.donorId === donorId; })
    .sort(function(a,b){ return String(a.tanggal).localeCompare(String(b.tanggal)); });
}
function addMessage(m){
  state.messages.push(Object.assign({
    id:uid('msg'), donorId:'', arah:'keluar', tanggal:new Date().toISOString(),
    subjek:'', isi:'', status:'Terkirim', from:'', to:'', cc:'',
    gmailId:'', threadId:'', lampiran:'', lampiranBerkas:[], catatan:'', dibaca:true,
    kanal:'email', waId:'', waNama:''
  }, m));
  save('messages');
}
function countMsg(donorId, arah){
  return state.messages.filter(function(m){ return m.donorId === donorId && m.arah === arah; }).length;
}
function lastMsg(donorId){
  const b = bookOf(donorId);
  return b.length ? b[b.length - 1] : null;
}
function unreadCount(){
  return state.messages.filter(function(m){ return m.arah === 'masuk' && !m.dibaca; }).length;
}
function inboxList(){
  return state.messages.filter(function(m){ return m.arah === 'masuk'; })
    .sort(function(a,b){ return String(b.tanggal).localeCompare(String(a.tanggal)); });
}
function outboxList(){
  return state.messages.filter(function(m){ return m.arah === 'keluar'; })
    .sort(function(a,b){ return String(b.tanggal).localeCompare(String(a.tanggal)); });
}

/* ---------- 7. ROUTER ---------- */
const PAGES = [
  { id:'beranda',    label:'Beranda',    ico:'◈' },
  { id:'masuk',      label:'Masuk',      ico:'↓' },
  { id:'keluar',     label:'Keluar',     ico:'↑' },
  { id:'donor',      label:'Donor',      ico:'☰' },
  { id:'surat',      label:'Tulis',      ico:'✎' },
  { id:'keuangan',   label:'Keuangan',   ico:'◫' },
  { id:'kategori',   label:'Kategori',   ico:'▤' },
    { id:'akun',       label:'Akun',       ico:'⚿' },
  { id:'pengaturan', label:'Setelan',    ico:'⚙' }
];
let currentPage = 'beranda';
let pageParams = {};
/* Diisi kalau data bersama tidak bisa dimuat dari server. Selama terisi,
   halaman selain Setelan dikunci (lihat render()). */
let terkunciServer = null;
/* Diisi kalau belum ada pengguna yang masuk. Selama terisi, seluruh aplikasi
   diganti layar masuk — data donor tidak boleh tampil sebelum jelas siapa
   yang melihatnya (lihat render()). */
let terkunciLogin = null;

function go(page, params){
  currentPage = page;
  pageParams = params || {};
  /* Halaman Akun butuh data dari server — diambil saat dibuka, bukan saat
     aplikasi dimuat, supaya tidak memperlambat pemakaian sehari-hari. */
  if(page === 'akun') muatAkun();
  render();
  window.scrollTo(0,0);
}
function renderNav(){
  const unread = unreadCount();
  /* Halaman Akun hanya ditampilkan untuk admin — di sanalah akun dibuat
     dan catatan aktivitas dibaca. */
  const daftar = PAGES.filter(function(p){ return p.id !== 'akun' || Akun.admin(); });
  const html = daftar.map(function(p){
    const active = p.id === currentPage ? ' active' : '';
    let badge = '';
    if(p.id === 'donor') badge = '<span class="badge">' + state.donors.length + '</span>';
    if(p.id === 'masuk' && unread) badge = '<span class="badge hot">' + unread + '</span>';
    if(p.id === 'keluar') badge = '<span class="badge">' + outboxList().length + '</span>';
    return '<button class="navitem' + active + '" data-go="' + p.id + '">' +
      '<span class="ico">' + p.ico + '</span><span>' + p.label + '</span>' + badge + '</button>';
  }).join('');
  document.getElementById('nav-desktop').innerHTML = html;

    /* Siapa yang sedang masuk — diletakkan di kaki sidebar, di atas tombol tema. */
    const siapa = document.getElementById('side-siapa');
    if(siapa){
      siapa.innerHTML = Akun.masuk()
        ? '<div class="who"><b>' + esc(Akun.nama()) + '</b>' +
            '<span class="tiny muted">' + esc(Akun.labelPeran()) + '</span></div>' +
          '<button class="btn sm ghost" data-action="keluar-akun" title="Keluar dari aplikasi">Keluar</button>'
        : '<button class="btn sm" data-action="masuk">Masuk</button>';
    }

              /* Kategori, Akun & Setelan tetap di sidebar; sisanya jadi tab bawah. */
              const tabs = PAGES.filter(function(p){
                return p.id !== 'kategori' && p.id !== 'pengaturan' && (p.id !== 'akun' || Akun.admin());
              });
  document.getElementById('nav-mobile').innerHTML = tabs.map(function(p){
    const active = p.id === currentPage ? ' active' : '';
    let dot = '';
    if(p.id === 'masuk' && unread) dot = '<span class="dot"></span>';
    return '<button class="tab' + active + '" data-go="' + p.id + '">' +
      '<span class="ico">' + p.ico + dot + '</span><span>' + p.label + '</span></button>';
  }).join('');
}
function setTitle(t, s){
  document.getElementById('page-title').textContent = t;
  document.getElementById('page-sub').textContent = s || '';
}

/* ---------- 7b. LAYAR MASUK ---------- */
/* Dipakai selama belum ada pengguna yang masuk. Bentuknya sengaja sederhana:
   email + password + tombol Masuk. */
function layarMasuk(){
  const salah = (window._loginGalat || '');
  const alamatDaftar = Akun.alamatDaftar();
    /* Alamat server hanya dibuka kalau diminta — login tidak butuh kunci
       aplikasi lagi. */
    const perluServer = !!window._loginServer;
  return '<div class="masuk">' +
    '<div class="masuk-kotak">' +
      '<div class="masuk-merek">' +
        '<img src="vendor/kartidaya-logo.png" alt="Kartidaya">' +
      '</div>' +
      '<h1>Masuk</h1>' +
      '<p class="small muted">Aplikasi ini dipakai bersama. Masuk dengan akun Anda ' +
        'supaya setiap perubahan tercatat atas nama Anda.</p>' +
      (window._loginTerkunci ? '<div class="warnbox">' + esc(window._loginTerkunci) + '</div>' : '') +
      (salah ? '<div class="warnbox">' + esc(salah) + '</div>' : '') +
      '<div class="field"><label>Email</label>' +
        '<input type="email" id="login-email" class="mono" autocomplete="username" ' +
          'placeholder="nama@kartidaya.org" value="' + esc(window._loginEmail || '') + '"></div>' +
      '<div class="field"><label>Password</label>' +
        '<input type="password" id="login-password" autocomplete="current-password" ' +
          'placeholder="password"></div>' +
      '<button class="btn primary" style="width:100%" data-action="masuk">Masuk</button>' +
      '<p class="tiny muted" style="margin-top:12px;text-align:center">' +
        'Belum punya akun? ' +
        (alamatDaftar
                ? '<a href="' + esc(alamatDaftar) + '" target="_blank" rel="noopener">Buat akun di halaman akun</a>'
          : 'Minta admin membuatkan akun') +
      '</p>' +
            (perluServer
              ? '<div class="sep"></div>' +
                '<p class="tiny muted">Alamat server aplikasi ini. Hanya perlu diubah kalau ' +
                  'alamat Worker berubah atau baru dipasang.</p>' +
                '<div class="field"><label>Alamat Worker</label>' +
                  '<input type="text" id="login-endpoint" class="mono" value="' +
                    esc(WhatsApp.endpoint || state.settings.waEndpoint || DEFAULT_WORKER) + '"></div>' +
                '<div class="field"><label>Kunci aplikasi <span class="hint">— opsional</span></label>' +
                  '<input type="password" id="login-key" class="mono" value="' +
                    esc(WhatsApp.appKey || '') + '"></div>' +
                '<div class="btn-row">' +
                  '<button class="btn sm primary" data-action="masuk-server-simpan">Simpan</button>' +
                  '<button class="btn sm ghost" data-action="masuk-server-batal">Batal</button>' +
                '</div>'
              : '<p class="tiny muted" style="margin-top:10px;text-align:center">' +
                  'Server: <span class="mono">' + esc(workerBase() || 'belum diisi') + '</span> · ' +
                  '<a href="#" data-action="masuk-server">ubah</a></p>') +
    '</div>' +
  '</div>';
}

      /* Alamat server harus bisa diperbaiki dari layar masuk. Kalau tidak, alamat
         yang salah membuat pengguna tidak bisa masuk sama sekali — padahal Setelan
         baru bisa dibuka setelah masuk. */
      function simpanServerDariLogin(){
        const eEl = document.getElementById('login-endpoint');
        const kEl = document.getElementById('login-key');
        const endpoint = (eEl ? eEl.value : '').trim().replace(/\/+$/, '');
        const appKey = (kEl ? kEl.value : '').trim();
        if(!endpoint){ toast('Isi alamat Worker dulu', true); return; }
        if(!/^https:\/\//i.test(endpoint) && !/^http:\/\/(localhost|127\.0\.0\.1)/i.test(endpoint)){
          /* Origin http:// selain localhost ditolak browser untuk sebagian fitur,
             dan Google menolak origin file://. Pesannya dibuat jelas. */
          toast('Alamat harus diawali https:// (atau http://localhost untuk uji)', true);
          return;
        }
        WhatsApp.endpoint = endpoint;
        WhatsApp.appKey = appKey;
        state.settings.waEndpoint = endpoint;
        save('settings');
        WhatsApp.saveSession();
        window._loginServer = false;
        toast('Alamat server disimpan');
        render();
      }

/* Enter di kolom email/password langsung mengirim, tanpa harus klik. */
function bindLogin(){
  const kirim = function(e){
    if(e.key !== 'Enter') return;
    e.preventDefault();
    loginKirim();
  };
  const em = document.getElementById('login-email');
  const pw = document.getElementById('login-password');
  if(em) em.addEventListener('keydown', kirim);
  if(pw) pw.addEventListener('keydown', kirim);
  if(pw && !(em && !em.value)) pw.focus();
  else if(em) em.focus();
}

async function loginKirim(){
  const em = document.getElementById('login-email');
  const pw = document.getElementById('login-password');
  const email = (em ? em.value : '').trim();
  const password = (pw ? pw.value : '');
  window._loginEmail = email;
  window._loginGalat = '';
  window._loginTerkunci = '';
  if(!email || !password){
    window._loginGalat = 'Isi email dan password dulu';
    render();
    return;
  }
  const tombol = document.querySelector('[data-action="masuk"]');
  if(tombol){ tombol.disabled = true; tombol.textContent = 'Memeriksa…'; }
  try{
    await Akun.login(email, password);
    window._loginGalat = '';
    window._loginEmail = '';
    terkunciLogin = null;
    /* Setelah masuk, data bersama dimuat. Kalau server tidak terjangkau,
       layar "tidak tersambung" yang tampil — bukan layar masuk lagi. */
    const ok = await sambungDanMuat();
    if(ok) bukaKunciServer();
    else kunciServer('Tidak tersambung ke server',
      'Aplikasi ini bekerja <b>online</b> — data disimpan di server supaya bisa ' +
      'dipakai bersama. Periksa sambungan internet, lalu coba lagi.');
    render();
    toast('Selamat datang, ' + (Akun.nama() || email));
  }catch(e){
    window._loginGalat = e.message || 'Gagal masuk';
      /* Kalau alamat server yang bermasalah, buka blok servernya supaya bisa
         langsung diperbaiki di layar ini. */
      if(/alamat server|failed to fetch|network|load failed/i.test(e.message || '')) window._loginServer = true;
    render();
  }
}

async function logout(){
  if(!confirm('Keluar dari aplikasi?\n\nAnda harus masuk lagi untuk membukanya.')) return;
  /* Email diambil sebelum Akun.keluar() — keluar mengosongkan data pengguna. */
  const email = (Akun.pengguna && Akun.pengguna.email) || '';
  await Akun.keluar();
  window._loginGalat = '';
  window._loginEmail = email;
  window._loginTerkunci = '';
  terkunciLogin = 'masuk';
  terkunciServer = null;
  go('beranda');
}

/* Ganti password sendiri. Setelah berhasil, server mencabut semua sesi —
   jadi pengguna langsung diminta masuk lagi dengan password baru. */
function openGantiPassword(){
  openModal({
    title: 'Ganti password',
    body:
      '<p class="small muted">Password baru minimal 8 huruf. Setelah diganti, Anda ' +
        'perlu masuk lagi dengan password baru.</p>' +
      '<div class="field"><label>Password sekarang</label>' +
        '<input type="password" id="gp-lama" autocomplete="current-password"></div>' +
      '<div class="field"><label>Password baru <span class="hint">— minimal 8 huruf</span></label>' +
        '<input type="password" id="gp-baru" autocomplete="new-password"></div>' +
      '<div class="field"><label>Ulangi password baru</label>' +
        '<input type="password" id="gp-ulang" autocomplete="new-password"></div>' +
      '<p class="tiny muted">Password disimpan dalam bentuk acakan (PBKDF2), ' +
        'bukan sebagai tulisan biasa.</p>',
    footer: '<button class="btn" data-close>Batal</button>' +
      '<button class="btn primary" data-action="akun-password-simpan">Simpan password</button>'
  });
}

async function simpanGantiPassword(){
  const lama = (document.getElementById('gp-lama') || {}).value || '';
  const baru = (document.getElementById('gp-baru') || {}).value || '';
  const ulang = (document.getElementById('gp-ulang') || {}).value || '';
  if(baru.length < 8){ toast('Password baru minimal 8 huruf', true); return; }
  if(baru !== ulang){ toast('Ulangan password tidak sama', true); return; }
  /* Email diambil SEBELUM gantiPassword — fungsi itu mengosongkan sesi,
     termasuk data pengguna. */
  const email = (Akun.pengguna && Akun.pengguna.email) || '';
  try{
    await Akun.gantiPassword(lama, baru);
    closeModal();
    terkunciLogin = 'masuk';
    window._loginEmail = email;
    window._loginGalat = '';
    toast('Password diganti — silakan masuk lagi');
    render();
  }catch(e){
    toast('Gagal: ' + (e.message || e), true);
  }
}

/* ---------- 8. RENDER ---------- */
function render(){
  renderNav();
  const v = document.getElementById('view');
  /* Saat layar masuk yang tampil, sidebar, navigasi, dan bilah judul
     disembunyikan lewat kelas ini (lihat app.css). */
  document.body.classList.toggle('login-aktif', !!terkunciLogin);
  /* Belum masuk → seluruh aplikasi diganti layar masuk. Tanpa ini, data donor
       sudah tampil sebelum jelas siapa yang membukanya.
       Server tidak tersambung → halaman dikunci, kecuali Setelan (supaya alamat
       & kunci aplikasi bisa diperbaiki). */
  if(terkunciLogin){ v.innerHTML = layarMasuk(); bindLogin(); return; }
    if(terkunciServer && currentPage !== 'pengaturan'){ v.innerHTML = layarTidakTersambung(); afterRender(); return; }
  if(currentPage === 'beranda')         v.innerHTML = viewBeranda();
  else if(currentPage === 'masuk')      v.innerHTML = viewKotak('masuk');
  else if(currentPage === 'keluar')     v.innerHTML = viewKotak('keluar');
  else if(currentPage === 'donor')      v.innerHTML = viewDonor();
  else if(currentPage === 'buku')       v.innerHTML = viewBuku(pageParams.id);
  else if(currentPage === 'surat')      v.innerHTML = viewSurat();
  else if(currentPage === 'keuangan')   v.innerHTML = viewKeuangan();
  else if(currentPage === 'kategori')   v.innerHTML = viewKategori();
    else if(currentPage === 'akun')       v.innerHTML = viewAkun();
  else if(currentPage === 'pengaturan') v.innerHTML = viewPengaturan();
  else v.innerHTML = '<div class="empty">Halaman tidak ditemukan</div>';
  afterRender();
}
function afterRender(){
  if(currentPage === 'surat') bindSurat();
  if(currentPage === 'keuangan') bindKeuangan();
  if(currentPage === 'akun') bindAkun();
}
/* Filter halaman Keuangan — dipasang ulang setiap halaman digambar. */
function bindKeuangan(){
  const q = document.getElementById('f-q');
  if(q) q.addEventListener('input', function(){ finFilter.q = this.value; refreshKeuangan(); });
  const pr = document.getElementById('f-program');
  if(pr) pr.addEventListener('change', function(){ finFilter.program = this.value; refreshKeuangan(); });
  const u = document.getElementById('f-uang');
  if(u) u.addEventListener('change', function(){ finFilter.uang = this.value; refreshKeuangan(); });
  const d1 = document.getElementById('f-dari');
  if(d1) d1.addEventListener('change', function(){ finFilter.dari = this.value; refreshKeuangan(); });
  const d2 = document.getElementById('f-sampai');
  if(d2) d2.addEventListener('change', function(){ finFilter.sampai = this.value; refreshKeuangan(); });
  const k = document.getElementById('f-kirim');
  if(k) k.addEventListener('change', function(){ finFilter.kirim = this.value; refreshKeuangan(); });
}
/* Gambar ulang hanya daftar & ringkasan, lalu pasang ulang pendengar filter —
   kalau seluruh halaman digambar ulang, fokus di kotak cari akan hilang. */
function refreshKeuangan(){
  const v = document.getElementById('view');
  if(!v || currentPage !== 'keuangan') return;
  v.innerHTML = viewKeuangan();
  bindKeuangan();
}

/* ---------- BERANDA ---------- */
function viewBeranda(){
  setTitle('Beranda','Ringkasan surat & email donor');
  const unread = unreadCount();
  const keluar = outboxList().length;
  const masuk = inboxList().length;
  const bulanIni = new Date().toISOString().slice(0,7);
  const keluarBulan = state.messages.filter(function(m){
    return m.arah === 'keluar' && String(m.tanggal).slice(0,7) === bulanIni;
  }).length;

  const perKat = state.categories.map(function(c){
    return { nama:c, n: state.donors.filter(function(d){ return d.kategori === c; }).length };
  }).sort(function(a,b){ return b.n - a.n; });
  const maxKat = Math.max(1, perKat.reduce(function(m,x){ return Math.max(m,x.n); }, 0));

  const recent = state.messages.slice().sort(function(a,b){
    return String(b.tanggal).localeCompare(String(a.tanggal));
  }).slice(0, 6);

  const gmailState = Gmail.status();
  const gmailText = gmailState === 'connected'
    ? 'Terhubung sebagai ' + (Gmail.email || 'akun Gmail')
    : (Gmail.isConfigured() ? 'Client ID terisi — belum terhubung' : 'Belum diatur');
  const syncText = state.settings.autoSync
    ? (state.settings.lastSync ? 'Sinkron otomatis · ' + relTime(state.settings.lastSync) : 'Sinkron otomatis aktif')
    : 'Sinkron otomatis mati';
  const waState = WhatsApp.status();
  const waText = waState === 'connected'
    ? (WhatsApp.phone ? 'Nomor ' + WhatsApp.phone : 'Worker tersambung')
    : (WhatsApp.isConfigured() ? 'Worker terisi — belum diuji' : 'Belum diatur');
  const waSyncText = state.settings.waAutoSync
    ? (state.settings.waLastSync ? 'Sinkron otomatis · ' + relTime(state.settings.waLastSync) : 'Sinkron otomatis aktif')
    : 'Sinkron otomatis mati';

  return '' +
  kartuCadangan() +
  '<div class="grid stats" style="margin-bottom:14px">' +
    stat('Total Donor', state.donors.length, state.categories.length + ' kategori') +
    stat('Belum Dibaca', unread, masuk + ' surat masuk') +
    stat('Surat Keluar', keluar, keluarBulan + ' bulan ini') +
    stat('Status Gmail', gmailState === 'connected' ? 'Aktif' : '—', gmailText) +
    (WA_DITUNDA
      ? stat('Status WhatsApp', 'Ditunda', 'Menunggu nomor resmi Kartidaya')
      : stat('Status WhatsApp', waState === 'connected' ? 'Aktif' : '—', waText)) +
  '</div>' +

  ((gmailState === 'connected' || (!WA_DITUNDA && waState === 'connected')) ?
    '<div class="card" style="margin-bottom:14px"><div class="row" style="justify-content:space-between;flex-wrap:wrap;gap:8px">' +
      '<span class="small muted">' + esc(syncText) + (WA_DITUNDA ? '' : ' · ' + esc(waSyncText)) + '</span>' +
      '<span class="row" style="gap:8px">' +
        '<button class="btn sm" data-action="sync">⟳ Sinkron Gmail</button>' +
        (WA_DITUNDA ? '' : '<button class="btn sm" data-action="wa-sync">⟳ Sinkron WhatsApp</button>') +
      '</span>' +
    '</div></div>' : '') +

  '<div class="card">' +
    '<div class="card-head"><h2>Kotak Masuk Terbaru</h2>' +
      '<button class="btn sm ghost" data-go="masuk">Semua</button></div>' +
    (inboxList().length ? '<div class="timeline">' + inboxList().slice(0,5).map(function(m){
      const d = findDonor(m.donorId);
      return '<div class="tl-item" data-open-msg="' + esc(m.id) + '" style="cursor:pointer">' +
        '<div class="tl-dot in' + (m.dibaca ? '' : ' unread') + '"></div>' +
        '<div class="tl-body">' +
          '<div class="t">' + esc(m.subjek) + '</div>' +
          '<div class="m">' + esc(d ? donorName(d) : (m.from || 'Pengirim tidak dikenal')) +
            ' · ' + relTime(m.tanggal) + '</div>' +
        '</div></div>';
    }).join('') + '</div>'
      : '<p class="muted small">Belum ada surat masuk. Hubungkan Gmail lalu tekan <b>Sinkron</b>.</p>') +
  '</div>' +

  '<div class="card">' +
    '<div class="card-head"><h2>Donor per Kategori</h2>' +
      '<button class="btn sm ghost" data-go="kategori">Kelola</button></div>' +
    (perKat.length ? perKat.map(function(k){
      const pct = Math.round(k.n / maxKat * 100);
      return '<div style="margin-bottom:10px">' +
        '<div class="row" style="justify-content:space-between;font-size:13px">' +
          '<span>' + esc(k.nama) + '</span><span class="mono muted">' + k.n + '</span></div>' +
        '<div class="bar"><div style="width:' + pct + '%"></div></div></div>';
    }).join('') : '<p class="muted small">Belum ada kategori.</p>') +
  '</div>' +

  '<div class="card">' +
    '<div class="card-head"><h2>Aktivitas Terbaru</h2></div>' +
    (recent.length ? '<div class="timeline">' + recent.map(function(m){
      const d = findDonor(m.donorId);
      return '<div class="tl-item">' +
        '<div class="tl-dot' + (m.arah === 'masuk' ? ' in' : '') + '"></div>' +
        '<div class="tl-body"><div class="t">' + esc(m.subjek) + '</div>' +
        '<div class="m">' + (m.arah === 'masuk' ? 'Masuk' : 'Keluar') + ' · ' +
          esc(d ? donorName(d) : '—') + ' · ' + fmtDateTime(m.tanggal) + '</div></div></div>';
    }).join('') + '</div>' : '<p class="muted small">Belum ada aktivitas.</p>') +
  '</div>' +

  '<div class="card">' +
    '<div class="card-head"><h2>Aksi Cepat</h2></div>' +
    '<div class="btn-row">' +
      '<button class="btn primary" data-action="donor-baru">+ Tambah Donor</button>' +
      '<button class="btn" data-go="surat">✎ Tulis Surat</button>' +
      '<button class="btn" data-action="sync">⟳ Sinkron Gmail</button>' +
      '<button class="btn" data-go="pengaturan">⚙ Setelan</button>' +
    '</div>' +
  '</div>';
}
function stat(k,v,d){
  return '<div class="stat"><div class="k">' + esc(k) + '</div>' +
    '<div class="v">' + esc(v) + '</div><div class="d">' + esc(d) + '</div></div>';
}

/* ---------- KOTAK MASUK / KELUAR ---------- */
let kotakFilter = { q:'', donorId:'', status:'', kanal:'', dibaca:'' };

/* Ringkasan tanda dibaca untuk surat keluar: berapa yang sudah dibuka,
   berapa yang sudah dikonfirmasi, dan berapa yang belum ada kabar. */
function ringkasDibaca(){
  const keluar = outboxList().filter(function(m){ return m.status === 'Terkirim'; });
  if(!keluar.length) return '';
  const berPixel = keluar.filter(function(m){ return m.pixelId; });
  const dibaca = berPixel.filter(function(m){ return m.dibacaPenerima; }).length;
  const konfirmasi = keluar.filter(function(m){ return m.terimaPenerima; }).length;
  const belum = berPixel.length - dibaca;
  const tanpaPixel = keluar.length - berPixel.length;
  const kotak = function(n, label, kelas, saring){
    return '<button class="stat-mini' + (kelas ? ' ' + kelas : '') + '" data-action="k-dibaca" ' +
      'data-nilai="' + saring + '" title="Klik untuk menyaring">' +
      '<span class="n">' + n + '</span><span class="l">' + label + '</span></button>';
  };
  return '<div class="stat-row">' +
    kotak(keluar.length, 'surat terkirim', '', '') +
    kotak(dibaca, 'sudah dibaca', 'ok', 'sudah') +
    kotak(belum, 'belum dibaca', belum ? 'warn' : '', 'belum') +
    kotak(konfirmasi, 'sudah dikonfirmasi', 'ok', 'konfirmasi') +
    (tanpaPixel
      ? '<span class="tiny muted" style="align-self:center">' + tanpaPixel +
        ' surat lama belum punya tanda dibaca</span>'
      : '') +
  '</div>';
}

function viewKotak(arah){
  const isMasuk = arah === 'masuk';
  setTitle(isMasuk ? 'Kotak Masuk' : 'Kotak Keluar',
    isMasuk ? 'Semua surat yang diterima' : 'Semua surat yang dikirim');

  const q = kotakFilter.q.toLowerCase();
  let list = (isMasuk ? inboxList() : outboxList()).filter(function(m){
    if(kotakFilter.donorId === '__unknown__'){
      if(m.donorId) return false;
    }else if(kotakFilter.donorId && m.donorId !== kotakFilter.donorId) return false;
    if(kotakFilter.status && m.status !== kotakFilter.status) return false;
    if(kotakFilter.kanal && (m.kanal === 'whatsapp' ? 'whatsapp' : 'email') !== kotakFilter.kanal) return false;
    /* Saringan tanda dibaca — hanya berlaku untuk surat keluar. */
    if(!isMasuk && kotakFilter.dibaca){
      if(kotakFilter.dibaca === 'belum' && m.dibacaPenerima) return false;
      if(kotakFilter.dibaca === 'sudah' && !m.dibacaPenerima) return false;
      if(kotakFilter.dibaca === 'konfirmasi' && !m.terimaPenerima) return false;
    }
    if(!q) return true;
    const d = findDonor(m.donorId);
    return [m.subjek, m.isi, m.from, m.to, d ? donorName(d) : '', d ? d.id : '']
      .join(' ').toLowerCase().indexOf(q) >= 0;
  });

  const unknownCount = isMasuk ? state.messages.filter(function(m){
    return m.arah === 'masuk' && !m.donorId;
  }).length : 0;

  const donorOpts = '<option value="">Semua donor</option>' +
    (isMasuk && unknownCount
      ? '<option value="__unknown__"' + (kotakFilter.donorId === '__unknown__' ? ' selected' : '') +
        '>⚠ Belum dikenal (' + unknownCount + ')</option>'
      : '') +
    state.donors.map(function(d){
      return '<option value="' + esc(d.id) + '"' + (kotakFilter.donorId === d.id ? ' selected' : '') + '>' +
        esc(d.id + ' — ' + donorName(d)) + '</option>';
    }).join('');
  const statusList = isMasuk ? STATUS_MASUK : STATUS_KELUAR;

  return '' +
  '<div class="toolbar">' +
    '<input type="search" class="grow" id="k-q" placeholder="Cari subjek / isi / pengirim…" value="' + esc(kotakFilter.q) + '">' +
    '<select id="k-status" style="max-width:160px"><option value="">Semua status</option>' +
      statusList.map(function(s){
        return '<option value="' + esc(s) + '"' + (kotakFilter.status === s ? ' selected' : '') + '>' + esc(s) + '</option>';
      }).join('') + '</select>' +
    '<select id="k-donor" style="max-width:230px">' + donorOpts + '</select>' +
    '<select id="k-kanal" style="max-width:150px">' +
      '<option value="">Semua kanal</option>' +
      KANAL.filter(function(k){ return !(WA_DITUNDA && k === 'whatsapp'); }).map(function(k){
        return '<option value="' + k + '"' + (kotakFilter.kanal === k ? ' selected' : '') + '>' +
          ICO_KANAL[k] + ' ' + LABEL_KANAL[k] + '</option>';
      }).join('') + '</select>' +
    (isMasuk
      ? '<button class="btn" data-action="cocokkan">⇄ Cocokkan ulang</button>' +
        '<button class="btn primary" data-action="sync">⟳ Sinkron Gmail</button>' +
        (WA_DITUNDA ? '' : '<button class="btn" data-action="wa-sync">⟳ Sinkron WhatsApp</button>')
      : '<select id="k-dibaca" style="max-width:190px">' +
          '<option value="">Semua tanda dibaca</option>' +
          '<option value="belum"' + (kotakFilter.dibaca === 'belum' ? ' selected' : '') + '>✓✓ Belum dibaca</option>' +
          '<option value="sudah"' + (kotakFilter.dibaca === 'sudah' ? ' selected' : '') + '>✓✓ Sudah dibaca</option>' +
          '<option value="konfirmasi"' + (kotakFilter.dibaca === 'konfirmasi' ? ' selected' : '') + '>✓ Sudah dikonfirmasi</option>' +
        '</select>' +
        '<button class="btn" data-action="cek-dibaca">✓✓ Cek tanda dibaca</button>' +
        '<button class="btn" data-action="cek-terima">✓ Cek konfirmasi</button>' +
        '<button class="btn primary" data-go="surat">✎ Tulis Surat</button>') +
  '</div>' +
  (isMasuk ? '' : ringkasDibaca()) +
  '<p class="tiny muted" style="margin:-6px 0 12px">' + list.length + ' surat' +
    (kotakFilter.dibaca || kotakFilter.status || kotakFilter.kanal || kotakFilter.donorId || kotakFilter.q
      ? ' <button class="btn sm" data-action="k-reset">× Bersihkan saringan</button>' : '') + '</p>' +
  (list.length ? '<div class="maillist">' + list.map(function(m){
    const d = findDonor(m.donorId);
    const who = isMasuk ? (d ? donorName(d) : (m.from || 'Tidak dikenal')) : (d ? donorName(d) : (m.to || '—'));
    return '<article class="mail' + (isMasuk && !m.dibaca ? ' unread' : '') + '" data-open-msg="' + esc(m.id) + '">' +
      '<div class="mail-top">' +
        '<span class="mail-who">' + esc(who) + '</span>' +
        '<span class="mail-time">' + relTime(m.tanggal) + '</span>' +
      '</div>' +
      '<div class="mail-subj">' + esc(m.subjek) + '</div>' +
      '<div class="mail-prev">' + esc(String(m.arah === 'keluar' ? formatTeksPolos(m.isi) : (m.isi || '')).replace(/\s+/g,' ').slice(0, 130)) + '</div>' +
      '<div class="mail-foot">' +
        kanalChip(m) +
        '<span class="chip ' + statusChipClass(m.status) + '">' + esc(m.status) + '</span>' +
        chipLampiranSurat(m) +
        (!isMasuk && m.pixelId
          ? (m.dibacaPenerima
              ? '<span class="chip st-dibaca" title="Dibuka ' + esc(fmtDateTime(m.dibacaPenerima)) + '">✓✓ Dibaca</span>'
              : '<span class="chip plain" title="Belum ada kabar dibuka">✓✓ Belum dibaca</span>')
          : '') +
        (!isMasuk && m.terimaPenerima
          ? '<span class="chip ok" title="Dikonfirmasi ' + esc(fmtDateTime(m.terimaPenerima)) +
            '">✓ Dikonfirmasi</span>'
          : '') +
        (d ? '<span class="chip plain mono">' + esc(d.id) + '</span>'
           : '<span class="chip warn">belum dikenal</span>') +
      '</div>' +
    '</article>';
  }).join('') + '</div>'
    : '<div class="empty"><span class="big">' + (isMasuk ? '↓' : '↑') + '</span>' +
      (isMasuk ? 'Belum ada surat masuk.' : 'Belum ada surat keluar.') + '</div>');
}

/* ---------- DONOR ---------- */
let donorFilter = { q:'', kategori:'', sort:'id' };

function viewDonor(){
  setTitle('Donor','Setiap donor punya riwayat surat sendiri');
  const q = donorFilter.q.toLowerCase();
  let list = state.donors.filter(function(d){
    if(donorFilter.kategori && d.kategori !== donorFilter.kategori) return false;
    if(!q) return true;
    return [d.id,d.pic,d.namaLengkap,d.instansi,d.email,d.email2,d.hp1,d.hp2,d.kategori,d.alamat]
      .join(' ').toLowerCase().indexOf(q) >= 0;
  });
  const sorters = {
    id:      function(a,b){ return String(a.id).localeCompare(String(b.id)); },
    nama:    function(a,b){ return donorName(a).localeCompare(donorName(b)); },
    kategori:function(a,b){ return String(a.kategori).localeCompare(String(b.kategori)); },
    aktivitas:function(a,b){
      const la = lastMsg(a.id), lb = lastMsg(b.id);
      return String(lb ? lb.tanggal : '').localeCompare(String(la ? la.tanggal : ''));
    }
  };
  list.sort(sorters[donorFilter.sort] || sorters.id);

  const katOpts = '<option value="">Semua kategori</option>' + state.categories.map(function(c){
    return '<option value="' + esc(c) + '"' + (donorFilter.kategori === c ? ' selected' : '') + '>' + esc(c) + '</option>';
  }).join('');

  return '' +
  '<div class="toolbar">' +
    '<input type="search" class="grow" id="f-q" placeholder="Cari nama, instansi, email, alamat, ID…" value="' + esc(donorFilter.q) + '">' +
    '<select id="f-kat" style="max-width:190px">' + katOpts + '</select>' +
    '<select id="f-sort" style="max-width:160px">' +
      '<option value="id"' + (donorFilter.sort==='id'?' selected':'') + '>Urut ID</option>' +
      '<option value="nama"' + (donorFilter.sort==='nama'?' selected':'') + '>Urut Nama</option>' +
      '<option value="kategori"' + (donorFilter.sort==='kategori'?' selected':'') + '>Urut Kategori</option>' +
      '<option value="aktivitas"' + (donorFilter.sort==='aktivitas'?' selected':'') + '>Aktivitas Terbaru</option>' +
    '</select>' +
    '<button class="btn primary" data-action="donor-baru">+ Tambah</button>' +
  '</div>' +
  '<p class="tiny muted" style="margin:-6px 0 12px">' + list.length + ' dari ' + state.donors.length + ' donor</p>' +
  (list.length ? '<div class="grid cols">' + list.map(donorCard).join('') + '</div>'
    : '<div class="empty"><span class="big">☰</span>Belum ada donor yang cocok.<br>' +
      '<button class="btn primary" style="margin-top:12px" data-action="donor-baru">+ Tambah Donor</button></div>');
}
function donorCard(d){
  const keluar = countMsg(d.id,'keluar');
  const masuk  = countMsg(d.id,'masuk');
  const unread = state.messages.filter(function(m){
    return m.donorId === d.id && m.arah === 'masuk' && !m.dibaca;
  }).length;
  const last = lastMsg(d.id);
  return '<article class="donor" data-donor="' + esc(d.id) + '">' +
    '<div class="top">' +
      '<div style="flex:1;min-width:0">' +
        '<div class="id">' + esc(d.id) + '</div>' +
        '<div class="name">' + esc(donorName(d)) + '</div>' +
        (d.instansi ? '<div class="inst">' + esc(d.instansi) + '</div>' : '') +
      '</div>' +
      (unread ? '<span class="chip hot">' + unread + ' baru</span>'
              : (d.panggilan ? '<span class="chip plain">' + esc(d.panggilan) + '</span>' : '')) +
    '</div>' +
    '<div class="meta">' +
      (emailUtama(d)
        ? '<span>✉ ' + esc(emailUtama(d)) + (emailLain(d) ? ' <span class="muted">/ ' + esc(emailLain(d)) + '</span>' : '') + '</span>'
        : '<span class="chip warn">tanpa email</span>') +
      (hpUtama(d)
        ? '<span>☎ ' + esc(hpUtama(d)) + (hpLain(d) ? ' <span class="muted">/ ' + esc(hpLain(d)) + '</span>' : '') + '</span>'
        : '') +
      (d.alamat ? '<span>⌂ ' + esc(String(d.alamat).replace(/\s+/g, ' ').slice(0, 70)) + '</span>' : '') +
    '</div>' +
    (last ? '<div class="last">' + esc(String(last.subjek || '').slice(0,60)) + ' · ' + relTime(last.tanggal) + '</div>' : '') +
    '<div class="foot">' +
      '<span class="chip">' + esc(d.kategori || 'tanpa kategori') + '</span>' +
      '<span class="counts">↑' + keluar + ' ↓' + masuk + '</span>' +
    '</div>' +
  '</article>';
}

/* ---------- BUKU DONOR (thread) ---------- */
/* Penanda lampiran untuk daftar/gelembung riwayat surat. Tanpa ini, surat yang
   dikirim dengan kwitansi atau majalah terlihat sama saja dengan surat biasa —
   padahal isinya berbeda. Ditampilkan ringkas sebagai chip supaya bisa dilihat
   sekilas tanpa harus membuka suratnya. */
function chipLampiranSurat(m){
  if(!m || m.arah !== 'keluar') return '';
  const out = [];
  if(m.kwitansiHTML || m.kwitansiFinId){
    out.push('<span class="chip ok" title="Kwitansi ikut tercetak di dalam email">🧾 Kwitansi</span>');
  }
  if(m.majalah && m.majalah.halaman){
    out.push('<span class="chip ok" title="' + esc(m.majalah.judul || 'Majalah') + '">📖 Majalah ' +
      m.majalah.halaman + ' hal</span>');
  }
  if(Array.isArray(m.lampiranBerkas) && m.lampiranBerkas.length){
    out.push('<span class="chip plain" title="' +
      esc(m.lampiranBerkas.map(function(l){ return l.nama; }).join(', ')) + '">📎 ' +
      m.lampiranBerkas.length + ' berkas</span>');
  }
  return out.join('');
}

/* Ringkasan lampiran di dalam gelembung riwayat donor. Chip saja sering tidak
   cukup — user ingin melihat APA yang ikut terkirim tanpa harus membuka
   suratnya. Jadi ditampilkan satu baris ringkas: nomor kwitansi + jumlahnya,
   judul majalah + sampul kecil, dan nama berkas.

   Setiap baris BISA DIKLIK untuk langsung membuka isinya — kwitansi dibuka
   sebagai salinan yang terkirim, majalah dibuka di halaman pembaca, berkas
   dibuka di tab baru. Tanpa ini, satu-satunya jalan adalah membuka suratnya
   dulu, dan itu tidak jelas bagi pengguna. */
function ringkasLampiranSurat(m, d){
  if(!m || m.arah !== 'keluar') return '';
  const baris = [];

  if(m.kwitansiHTML || m.kwitansiFinId){
    const fin = state.finance.filter(function(f){ return f.id === m.kwitansiFinId; })[0];
    const kode = fin ? (fin.kode || '') : '';
    const jumlah = d ? totalTransaksiRingkas(d, m.kwitansiFinId) : '';
    baris.push('<button type="button" class="b-lampiran-baris bisa-klik" ' +
      'data-action="lihat-kwitansi" data-msg="' + esc(m.id) + '" ' +
      'title="Klik untuk membuka kwitansi">' +
      '<span class="b-lampiran-ikon">🧾</span>' +
      '<span class="b-lampiran-teks"><b>Kwitansi</b>' +
        (kode ? ' <span class="mono">' + esc(kode) + '</span>' : '') +
        (jumlah ? ' · <b>' + esc(jumlah) + '</b>' : '') + '</span>' +
      '<span class="b-lampiran-buka">Buka →</span></button>');
  }

  if(m.majalah && m.majalah.halaman){
    const simpan = state.settings.majalah;
    const pakai = (simpan && simpan.id === m.majalah.id) ? simpan : m.majalah;
    const sampul = workerBase() ? workerBase() + '/majalah/' + pakai.id + '/1' : '';
    /* Sampul hanya hiasan. Kalau gambarnya tidak ada (majalah sudah dihapus
       dari Worker), gambarnya disembunyikan — jangan sampai yang tampil ikon
       gambar rusak, karena itu terlihat seperti aplikasi yang rusak.
       `loading="lazy"` sengaja tidak dipakai: gambar 34px ini terlalu kecil
       untuk ditunda, dan kalau ditunda `onerror` baru jalan setelah digulir. */
    baris.push('<button type="button" class="b-lampiran-baris bisa-klik" ' +
      'data-action="lihat-majalah" data-msg="' + esc(m.id) + '" ' +
      'title="Klik untuk membaca majalah">' +
      '<span class="b-lampiran-ikon">📖</span>' +
      '<span class="b-lampiran-teks"><b>' + esc(pakai.judul || 'Majalah') + '</b> · ' +
        pakai.halaman + ' halaman</span>' +
      (sampul ? '<img class="b-sampul" src="' + esc(sampul) + '" alt="" ' +
        'onerror="this.style.display=\'none\'">' : '') +
      '<span class="b-lampiran-buka">Baca →</span></button>');
  }

  if(Array.isArray(m.lampiranBerkas) && m.lampiranBerkas.length){
    baris.push('<button type="button" class="b-lampiran-baris bisa-klik" ' +
      'data-action="lihat-berkas" data-msg="' + esc(m.id) + '" ' +
      'title="Klik untuk membuka berkas">' +
      '<span class="b-lampiran-ikon">📎</span>' +
      '<span class="b-lampiran-teks">' + m.lampiranBerkas.map(function(l){
        return esc(l.nama);
      }).join(', ') + '</span>' +
      '<span class="b-lampiran-buka">Buka →</span></button>');
  }

  if(!baris.length) return '';
  return '<div class="b-lampiran">' + baris.join('') + '</div>';
}

/* ---------- PENAMPIL LAMPIRAN SURAT ----------
   Dibuka dari baris ringkasan di riwayat surat. Tujuannya supaya isi yang
   pernah dikirim bisa dilihat lagi tanpa harus mencari suratnya dulu.

   Kwitansi memakai salinan yang tersimpan saat surat dikirim (persis seperti
   yang diterima donor). Kalau surat lama belum punya salinan, kwitansi dibuat
   ulang dari data keuangan sekarang dan diberi keterangan jelas — supaya tidak
   ada yang mengira itu salinan asli. */
function bukaKwitansiSurat(msgId){
  const m = state.messages.filter(function(x){ return x.id === msgId; })[0];
  if(!m){ toast('Surat tidak ditemukan', true); return; }
  const d = findDonor(m.donorId);
  const fin = state.finance.filter(function(f){ return f.id === m.kwitansiFinId; })[0];
  const kode = fin ? (fin.kode || '') : '';
  const jumlah = d ? totalTransaksiRingkas(d, m.kwitansiFinId) : '';

  let isi, catatan;
  if(m.kwitansiHTML){
    isi = '<div class="kwitansi-preview">' + m.kwitansiHTML + '</div>';
    catatan = '<p class="tiny muted" style="margin:8px 0 0">Salinan tersimpan — persis seperti ' +
      'yang diterima donor saat surat dikirim.</p>';
  }else if(d){
    isi = '<div class="kwitansi-preview">' + kwitansiHTML(d, m.kwitansiBahasa || 'id', m.kwitansiFinId) + '</div>';
    catatan = '<div class="warnbox" style="margin-top:10px">Surat ini dikirim sebelum salinan kwitansi ' +
      'disimpan, jadi kwitansi di atas <b>dibuat ulang</b> dari data keuangan sekarang. ' +
      'Isinya bisa berbeda kalau data keuangan sudah diubah.</div>';
  }else{
    isi = '<div class="warnbox">Kwitansi tidak bisa ditampilkan — donor surat ini sudah dihapus.</div>';
    catatan = '';
  }

  openModal({
    title: 'Kwitansi — ' + (m.subjek || '(tanpa subjek)'),
    body: '<div class="kv" style="margin-bottom:12px">' +
        kv('Donor', d ? donorName(d) + ' (' + d.id + ')' : '—') +
        kv('Kode kwitansi', kode) +
        kv('Jumlah', jumlah) +
        kv('Dikirim', fmtDateTime(m.tanggal)) +
      '</div>' + isi + catatan,
    footer: '<button class="btn" data-close>Tutup</button>' +
      (d ? '<button class="btn" data-action="buku" data-id="' + esc(d.id) + '">Buka Riwayat</button>' : ''),
    wide: true
  });
}

/* Buka majalah yang pernah dikirim. Halaman pembaca dibuka di tab baru —
   tampilannya sudah dibuat untuk HP (satu halaman per layar). Kalau majalahnya
   sudah tidak ada di Worker, pengguna diberi tahu dan diberi jalan untuk
   mengunggah ulang, bukan sekadar halaman kosong. */
function bukaMajalahSurat(msgId){
  const m = state.messages.filter(function(x){ return x.id === msgId; })[0];
  if(!m || !m.majalah){ toast('Surat ini tidak memuat majalah', true); return; }
  const simpan = state.settings.majalah;
  const pakai = (simpan && simpan.id === m.majalah.id) ? simpan : m.majalah;
  const base = workerBase();
  if(!base){ toast('Alamat Worker belum diisi — majalah tidak bisa dibuka', true); return; }

  const urlBaca = base + '/baca/' + pakai.id;
  const halaman = [];
  for(let i = 1; i <= (pakai.halaman || 0); i++){
    /* Tanpa `loading="lazy"`: di dalam kotak bergulir, browser menunda gambar
       yang belum terlihat dan sering tidak pernah memuatnya — akibatnya
       halaman 2 dan seterusnya tampak kosong. Jumlah halaman majalah kecil
       (puluhan), jadi memuat semuanya sekaligus tidak berat. */
    halaman.push('<img src="' + esc(base + '/majalah/' + pakai.id + '/' + i) + '" ' +
      'alt="Halaman ' + i + '" ' +
      'onerror="this.parentNode.classList.add(\'mj-hilang\')">');
  }

  openModal({
    title: 'Majalah — ' + (pakai.judul || 'Majalah Kartidaya'),
    body: '<div class="kv" style="margin-bottom:12px">' +
        kv('Edisi', pakai.judul || 'Majalah Kartidaya') +
        kv('Halaman', String(pakai.halaman || 0)) +
        kv('Dikirim', fmtDateTime(m.tanggal)) +
      '</div>' +
      '<div class="btn-row" style="margin-bottom:12px">' +
        '<a class="btn primary" href="' + esc(urlBaca) + '" target="_blank" rel="noopener">' +
          '👁 Baca di halaman pembaca</a>' +
        '<button class="btn" data-action="lihat-majalah-stat" data-id="' + esc(pakai.id) + '" ' +
          'data-judul="' + esc(pakai.judul || 'Majalah Kartidaya') + '" ' +
          'data-halaman="' + (pakai.halaman || 1) + '">' +
          '📊 Statistik pembaca</button>' +
      '</div>' +
      (halaman.length
        ? '<div class="mj-preview">' + halaman.join('') + '</div>' +
          '<p class="tiny muted" style="margin:8px 0 0">Halaman yang tidak bisa dimuat akan ' +
          'disembunyikan. Kalau semuanya kosong, majalahnya sudah tidak ada di Worker — ' +
          'unggah ulang lewat <b>Tulis Surat → Kelola majalah</b>.</p>'
        : '<div class="warnbox">Catatan majalah ini tidak menyimpan jumlah halaman.</div>'),
    footer: '<button class="btn" data-close>Tutup</button>',
    wide: true
  });
}

/* Buka berkas lampiran yang pernah dikirim. Satu berkas → langsung dibuka di
   tab baru. Lebih dari satu → daftar dulu supaya pengguna memilih. */
function bukaBerkasSurat(msgId){
  const m = state.messages.filter(function(x){ return x.id === msgId; })[0];
  if(!m || !Array.isArray(m.lampiranBerkas) || !m.lampiranBerkas.length){
    toast('Surat ini tidak memuat berkas', true);
    return;
  }
  const daftar = m.lampiranBerkas.map(function(l){
    return { nama: l.nama, ukuran: l.ukuran, url: l.url || WhatsApp.lampiranURL(l.id) };
  });
  if(daftar.length === 1 && daftar[0].url){
    window.open(daftar[0].url, '_blank', 'noopener');
    return;
  }
  openModal({
    title: 'Berkas yang ikut terkirim',
    body: '<div class="lampiran-daftar">' + daftar.map(function(l){
      return '<div class="lampiran-baris">' +
        '<span class="lampiran-ikon">' + ikonBerkas(l.nama) + '</span>' +
        '<span class="lampiran-nama">' + esc(l.nama) + '</span>' +
        '<span class="tiny muted mono">' + ukuranBerkas(l.ukuran) + '</span>' +
        (l.url ? '<a class="btn sm" href="' + esc(l.url) + '" target="_blank" rel="noopener">Buka</a>' : '') +
      '</div>';
    }).join('') + '</div>',
    footer: '<button class="btn" data-close>Tutup</button>'
  });
}

function viewBuku(donorId){
  const d = findDonor(donorId);
  if(!d){ go('donor'); return ''; }
  setTitle(donorName(d), 'Riwayat surat — ' + d.id);
  const book = bookOf(donorId);
  const p = idParts(d.id);

  return '' +
  '<div class="toolbar">' +
    '<button class="btn sm ghost" data-go="donor">← Daftar Donor</button>' +
    '<button class="btn sm" data-action="donor-ubah" data-id="' + esc(d.id) + '">Ubah Data</button>' +
    '<button class="btn sm primary" data-action="balas" data-id="' + esc(d.id) + '">✎ Tulis ke Donor</button>' +
    '<button class="btn sm" data-action="catat-masuk" data-id="' + esc(d.id) + '">↓ Catat Surat Masuk</button>' +
    (d.alamat ? '<button class="btn sm" data-action="cetak-alamat" data-id="' + esc(d.id) + '">⎙ Cetak Alamat</button>' : '') +
    (d.alamat ? '<button class="btn sm" data-action="cetak-label-donor" data-id="' + esc(d.id) + '">⎙ Cetak Label</button>' : '') +
  '</div>' +

  '<div class="card">' +
    '<div class="row" style="margin-bottom:10px">' +
      '<span class="chip">' + esc(d.kategori || 'tanpa kategori') + '</span>' +
      (d.panggilan ? '<span class="chip plain">' + esc(d.panggilan) + '</span>' : '') +
      '<span class="chip plain mono">' + esc(d.id) + '</span>' +
      '<span class="chip plain mono">' + p.letter + ' · ' + p.num + ' · ' + p.suffix + '</span>' +
    '</div>' +
    '<div class="kv">' +
      kv('PIC', d.pic) + kv('Nama Lengkap', d.namaLengkap) + kv('Instansi', d.instansi) +
      kv('Email', emailUtama(d) + (emailLain(d) ? ' / ' + emailLain(d) : '')) +
      kv('HP', hpUtama(d) + (hpLain(d) ? ' / ' + hpLain(d) : '')) +
      kv('Pengiriman', d.pengiriman) + kv('Asal Gereja', d.asalGereja) +
      kv('Alamat Lengkap', d.alamat) + kv('Catatan', d.catatan) +
    '</div>' +
  '</div>' +

  '<div class="card">' +
    '<div class="card-head"><h2>Riwayat Surat</h2>' +
      '<span class="chip plain">↑' + countMsg(donorId,'keluar') + ' keluar</span>' +
      '<span class="chip plain">↓' + countMsg(donorId,'masuk') + ' masuk</span></div>' +
    (book.length ? '<div class="thread">' + book.map(function(m){
      const isIn = m.arah === 'masuk';
      return '<div class="bubble ' + (isIn ? 'in' : 'out') + (isIn && !m.dibaca ? ' unread' : '') +
        '" data-open-msg="' + esc(m.id) + '">' +
        '<div class="b-head">' +
          '<span class="b-dir">' + (isIn ? '↓ Masuk' : '↑ Keluar') + '</span>' +
          kanalChip(m) +
          '<span class="chip ' + statusChipClass(m.status) + '">' + esc(m.status) + '</span>' +
          '<span class="b-time">' + fmtDateTime(m.tanggal) + '</span>' +
        '</div>' +
        '<div class="b-subj">' + esc(m.subjek) + '</div>' +
        '<div class="b-body">' + esc(String(m.arah === 'keluar' ? formatTeksPolos(m.isi) : (m.isi || '')).slice(0, 220)) + '</div>' +
        ringkasLampiranSurat(m, d) +
      '</div>';
    }).join('') + '</div>'
      : '<div class="empty"><span class="big">✉</span>Belum ada surat untuk donor ini.<br>' +
        '<button class="btn primary" style="margin-top:12px" data-action="balas" data-id="' + esc(d.id) + '">Tulis surat pertama</button></div>') +
  '</div>';
}
function kv(k,v){
  return '<div class="kv-row"><span class="kv-k">' + esc(k) + '</span>' +
    '<span class="kv-v">' + (v ? esc(v) : '<span class="muted">—</span>') + '</span></div>';
}

/* ---------- TULIS SURAT ---------- */
let suratState = { tplId:'', subjek:'', isi:'', selected:{}, previewId:'', q:'', replyTo:'', kanal:'email',
  cc:'', lampiran:[], kwitansi:false, kwitansiBahasa:'id', kwitansiFinId:'', majalah:false, kirimSendiri:false, dariPeriksa:false };

/* ---------- TOOLBAR FORMAT ISI SURAT ----------
   Tombol yang menyisipkan penanda di sekitar teks yang sedang dipilih (atau di
   posisi kursor kalau tidak ada yang dipilih). Semuanya bekerja pada <textarea>
   biasa — isi surat tetap teks, bukan HTML. Lihat catatan di formatTeksHTML
   untuk alasan pilihan ini.

   `buka`/`tutup` adalah penanda pembungkus. Untuk daftar, `awalan` disisipkan
   di awal setiap baris yang tersentuh pilihan. */
const TOOLBAR_SURAT = [
  { aksi:'tebal',    label:'B',   judul:'Tebal',            buka:'**', tutup:'**', kelas:'tb-tebal' },
  { aksi:'miring',   label:'I',   judul:'Miring',           buka:'*',  tutup:'*',  kelas:'tb-miring' },
  { aksi:'stabilo',  label:'🖍',  judul:'Stabilo (sorot kuning)', buka:'==', tutup:'==', kelas:'tb-stabilo' },
  { aksi:'poin',     label:'•',   judul:'Daftar berpoin',   awalan:'- ',  kelas:'tb-poin' },
  { aksi:'nomor',    label:'1.',  judul:'Daftar bernomor',  awalan:'1. ', kelas:'tb-nomor' }
];

function toolbarSurat(){
  return '<div class="toolbar-surat">' +
    TOOLBAR_SURAT.map(function(t){
      return '<button type="button" class="tb ' + t.kelas + '" data-action="format-surat" ' +
        'data-format="' + t.aksi + '" title="' + esc(t.judul) + '">' + t.label + '</button>';
    }).join('') +
    '<span class="tb-pisah"></span>' +
    '<button type="button" class="tb" data-action="format-surat" data-format="bersihkan" ' +
      'title="Hapus semua penanda format di bagian yang dipilih">Hapus format</button>' +
  '</div>';
}

/* Terapkan satu penanda ke <textarea> isi surat. Mengembalikan fokus ke kotak
   tulis pada posisi yang masuk akal supaya bisa langsung lanjut mengetik. */
function terapkanFormatSurat(aksi){
  const ta = document.getElementById('s-isi');
  if(!ta) return;
  const t = TOOLBAR_SURAT.filter(function(x){ return x.aksi === aksi; })[0];
  const awal = ta.selectionStart;
  const akhir = ta.selectionEnd;
  const nilai = ta.value;
  const terpilih = nilai.slice(awal, akhir);
  let hasil = nilai;
  let posAwal = awal;
  let posAkhir = akhir;

  if(aksi === 'bersihkan'){
    /* Buang penanda di bagian yang dipilih saja — sisanya tidak disentuh.
       Awalan daftar (`- `, `1. `) ikut dibuang supaya hasilnya benar-benar
       teks biasa. */
    if(!terpilih){ toast('Pilih dulu bagian yang mau dibersihkan', true); ta.focus(); return; }
    const bersih = terpilih
      .replace(/\*\*([^*]+)\*\*/g, '$1')
      .replace(/(^|[^*])\*([^*\n]+)\*/g, '$1$2')
      .replace(/==([^=\n]+)==/g, '$1')
      .replace(/^[ \t]*(?:[-•]|\d+[.)])[ \t]+/gm, '');
    hasil = nilai.slice(0, awal) + bersih + nilai.slice(akhir);
    posAkhir = awal + bersih.length;
  }else if(t.awalan){
    /* Daftar: beri awalan pada setiap baris yang tersentuh pilihan. Kalau
       tidak ada yang dipilih, kerjakan baris tempat kursor berada. */
    const dariBaris = nilai.lastIndexOf('\n', awal - 1) + 1;
    let sampaiBaris = nilai.indexOf('\n', akhir);
    if(sampaiBaris < 0) sampaiBaris = nilai.length;
    const blok = nilai.slice(dariBaris, sampaiBaris);
    let urut = 0;
    const barisBaru = blok.split('\n').map(function(b){
      /* Baris kosong tidak diberi awalan — kalau diberi, muncul poin kosong. */
      if(!b.trim()) return b;
      /* Ganti awalan daftar yang sudah ada supaya tidak menumpuk. */
      const isi = b.replace(/^\s*(?:[-•]|\d+[.)])\s+/, '');
      /* Nomor dibuat berurutan (1, 2, 3, …). Kalau semua baris ditandai "1.",
         versi teks biasa — yang dipakai WhatsApp — akan tampil "1. 1. 1.". */
      if(t.aksi === 'nomor'){ urut++; return urut + '. ' + isi; }
      return t.awalan + isi;
    }).join('\n');
    hasil = nilai.slice(0, dariBaris) + barisBaru + nilai.slice(sampaiBaris);
    posAwal = dariBaris;
    posAkhir = dariBaris + barisBaru.length;
  }else{
    /* Pembungkus: kalau sudah terbungkus, lepaskan (tombol jadi sakelar). */
    const sebelum = nilai.slice(Math.max(0, awal - t.buka.length), awal);
    const sesudah = nilai.slice(akhir, akhir + t.tutup.length);
    if(sebelum === t.buka && sesudah === t.tutup){
      hasil = nilai.slice(0, awal - t.buka.length) + terpilih + nilai.slice(akhir + t.tutup.length);
      posAwal = awal - t.buka.length;
      posAkhir = posAwal + terpilih.length;
    }else{
      hasil = nilai.slice(0, awal) + t.buka + terpilih + t.tutup + nilai.slice(akhir);
      posAwal = awal + t.buka.length;
      posAkhir = posAwal + terpilih.length;
    }
  }

  ta.value = hasil;
  suratState.isi = hasil;
  ta.focus();
  ta.setSelectionRange(posAwal, posAkhir);
  segarkanPratinjauIsi();
  refreshPreview();
}

/* Pratinjau langsung di bawah kotak tulis. Memakai donor yang sama dengan
   panel "3 · Pratinjau" supaya yang terlihat konsisten. */
function segarkanPratinjauIsi(){
  const el = document.getElementById('s-isi-pratinjau');
  if(!el) return;
  const ids = Object.keys(suratState.selected).filter(function(k){ return suratState.selected[k]; });
  const d = findDonor(suratState.previewId) || (ids.length ? findDonor(ids[0]) : null) || state.donors[0] || null;
  const isi = fillTemplate(suratState.isi, d || {});
  if(!String(isi).trim()){
    el.innerHTML = '<span class="muted">Belum ada isi. Mulai menulis di kotak di atas — ' +
      'hasilnya muncul di sini.</span>';
    return;
  }
  el.innerHTML = formatTeksHTML(isi);
}

function viewSurat(){
  setTitle('Tulis Surat','Susun surat dengan template, kirim ke banyak penerima');
  if(!suratState.tplId && state.templates.length) suratState.tplId = state.templates[0].id;
  const tpl = state.templates.filter(function(t){ return t.id === suratState.tplId; })[0];
  if(tpl && !suratState.isi && !suratState.subjek){
    suratState.subjek = tpl.subjek;
    suratState.isi = tpl.isi;
  }

  const tplOpts = state.templates.map(function(t){
    return '<option value="' + esc(t.id) + '"' + (t.id === suratState.tplId ? ' selected' : '') + '>' + esc(t.nama) + '</option>';
  }).join('');

  const q = suratState.q.toLowerCase();
  const recips = state.donors.filter(function(d){
    if(!q) return true;
    return [d.id,d.pic,d.namaLengkap,d.instansi,d.email,d.email2,d.hp1,d.hp2].join(' ').toLowerCase().indexOf(q) >= 0;
  });
  const ids = Object.keys(suratState.selected).filter(function(k){ return suratState.selected[k]; });
  const nSel = ids.length;
  const previewDonor = findDonor(suratState.previewId) || (nSel ? findDonor(ids[0]) : null) || state.donors[0] || null;
  const gmailOk = Gmail.isConnected();
  const waOk = WhatsApp.isConfigured() && WhatsApp.status() === 'connected';
  const kanal = suratState.kanal === 'whatsapp' ? 'whatsapp' : 'email';
  const siap = kanal === 'whatsapp' ? waOk : gmailOk;
  const nTanpaAlamat = ids.filter(function(id){
    const d = findDonor(id);
    return d && !(kanal === 'whatsapp' ? donorWa(d) : emailUtama(d));
  }).length;

  return '' +
  '<div class="grid" style="grid-template-columns:minmax(0,1fr);gap:14px">' +

    '<div class="card">' +
      '<div class="card-head"><h2>1 · Template</h2>' +
        '<button class="btn sm ghost" data-action="tpl-kelola">Kelola template</button></div>' +
      '<div class="field"><label>Kanal pengiriman</label>' +
        '<div class="row" style="gap:8px">' +
          KANAL.filter(function(k){ return !(WA_DITUNDA && k === 'whatsapp'); }).map(function(k){
            return '<button type="button" class="btn sm' + (kanal === k ? ' primary' : '') +
              '" data-action="kanal-pilih" data-kanal="' + k + '">' +
              ICO_KANAL[k] + ' ' + LABEL_KANAL[k] + '</button>';
          }).join('') +
        '</div></div>' +
      '<p class="tiny muted" style="margin:-4px 0 12px">' +
        (kanal === 'whatsapp'
          ? 'Pesan dikirim lewat WhatsApp Cloud API. Subjek tidak ikut terkirim — hanya isi pesan.'
          : 'Surat dikirim lewat Gmail API.') +
        (WA_DITUNDA
          ? ' <b>WhatsApp ditunda</b> sampai nomor resmi Kartidaya tersedia — ' +
            'pengiriman tidak boleh memakai akun Facebook pribadi.'
          : '') + '</p>' +
      '<div class="form-grid">' +
        '<div class="field"><label>Template</label><select id="s-tpl">' +
          (tplOpts || '<option value="">(belum ada template)</option>') + '</select></div>' +
        '<div class="field"><label>Subjek' + (kanal === 'whatsapp' ? ' <span class="hint">— hanya untuk catatan</span>' : '') +
          '</label>' +
          '<input type="text" id="s-subjek" value="' + esc(suratState.subjek) + '" placeholder="Subjek surat…"></div>' +
      '</div>' +
      (kanal === 'email'
        ? '<div class="field"><label>Cc <span class="hint">— opsional, pisahkan dengan koma</span></label>' +
            '<input type="text" id="s-cc" value="' + esc(suratState.cc) + '" ' +
              'placeholder="mis. bendahara@kartidaya.org, pimpinan@kartidaya.org"></div>'
        : '') +
      '<div class="field"><label>Isi Surat <span class="hint">— klik token untuk menyisipkan</span></label>' +
        '<div class="tokenbar">' + TOKENS.map(function(t){
          return '<button type="button" class="token" data-token="' + esc(t[0]) + '" title="' + esc(t[1]) + '">' + esc(t[0]) + '</button>';
        }).join('') + '</div>' +
        toolbarSurat() +
        '<textarea id="s-isi" style="min-height:230px" placeholder="Tulis isi surat di sini…">' + esc(suratState.isi) + '</textarea>' +
        '<p class="tiny muted" style="margin:6px 0 0">Boleh diberi format: ' +
          '<b class="mono">**tebal**</b> · <i class="mono">*miring*</i> · ' +
          '<span class="mono">==stabilo==</span> · ' +
          '<span class="mono">- poin</span> di awal baris · ' +
          '<span class="mono">1. nomor</span> di awal baris.</p>' +
        '<div class="pratinjau-langsung">' +
          '<div class="pl-kepala">Hasil yang dilihat penerima ' +
            '<span class="hint">— diperbarui sambil Anda mengetik</span></div>' +
          '<div class="letter" id="s-isi-pratinjau"></div>' +
        '</div>' +
      '</div>' +
      (kanal === 'email' ? '<div id="kw-blok">' + blokKwitansi() + '</div>' + blokMajalah() + blokLampiran() : '') +
      blokIsian() +
    '</div>' +

    '<div class="card">' +
      '<div class="card-head"><h2>2 · Penerima</h2>' +
        '<span class="chip" id="sel-count">' + nSel + ' dipilih</span></div>' +
      '<div class="toolbar" style="margin-bottom:10px">' +
        '<input type="search" class="grow" id="s-q" placeholder="Cari penerima…" value="' + esc(suratState.q) + '">' +
        '<button class="btn sm" data-action="sel-all">Pilih semua</button>' +
        '<button class="btn sm" data-action="sel-none">Kosongkan</button>' +
      '</div>' +
      (recips.length ? '<div class="scroll">' + recips.map(function(d){
        const on = !!suratState.selected[d.id];
        const alamat = kanal === 'whatsapp'
          ? (donorWa(d) ? waPhonePretty(donorWa(d)) : 'tanpa nomor HP')
          : (emailUtama(d) || 'tanpa email');
        /* Kalau kwitansi ikut dikirim, tampilkan kode + jumlah besar di
           sebelah nama. Tujuannya supaya user bisa membandingkan angka
           sebelum mencentang — inilah pencegah salah kirim yang utama. */
        const k = (kanal === 'email' && suratState.kwitansi) ? dataKwitansi(d, suratState.kwitansiFinId) : null;
        const uang = k ? k.kodeUang.map(function(u){
          return '<span class="rp">' + esc(fmtUang(k.perUang[u] || 0, u)) + '</span>';
        }).join(' ') : '';
        return '<label class="recipient' + (on ? ' on' : '') + '">' +
          '<input type="checkbox" data-recip="' + esc(d.id) + '"' + (on ? ' checked' : '') + '>' +
          '<span class="txt"><b>' + esc(donorName(d)) + '</b>' +
          '<span>' + esc(d.id) + ' · ' + esc(alamat) + '</span>' +
          (k ? '<span class="rc-kwt">' +
            (k.kode ? '<span class="mono kode">' + esc(k.kode) + '</span>' : '') +
            (k.ada ? uang : '<span class="chip warn">belum ada data keuangan</span>') +
          '</span>' : '') +
          '</span></label>';
      }).join('') + '</div>' : '<p class="muted small">Tidak ada donor.</p>') +
    '</div>' +

    '<div class="card" id="preview-card">' + previewHTML(previewDonor) + '</div>' +

    '<div class="card">' +
      '<div class="card-head"><h2>4 · Kirim</h2>' +
        '<span class="chip' + (siap ? '' : ' plain') + '">' +
          (kanal === 'whatsapp'
            ? (waOk ? 'WhatsApp aktif' : 'WhatsApp belum siap')
            : (gmailOk ? 'Gmail aktif' : 'Mode simulasi')) + '</span></div>' +
      '<p class="small muted">' + (siap
        ? (kanal === 'whatsapp'
            ? 'Pesan akan dikirim lewat WhatsApp Cloud API dan otomatis tercatat di riwayat surat masing-masing donor.'
            : 'Surat akan dikirim lewat Gmail API dan otomatis tercatat di riwayat surat masing-masing donor.')
        : (kanal === 'whatsapp'
            ? 'WhatsApp belum siap. Isi alamat Worker dan kunci aplikasi di <b>Setelan</b> untuk kirim sungguhan. ' +
              'Tanpa itu pesan hanya dicatat sebagai <b>Terkirim</b> (mode simulasi).'
            : 'Gmail belum terhubung. Surat akan dicatat sebagai <b>Terkirim</b> di riwayat surat donor (mode simulasi). ' +
              'Hubungkan Gmail di <b>Setelan</b> untuk kirim sungguhan.')) + '</p>' +
      (nTanpaAlamat
        ? '<div class="warnbox">' + nTanpaAlamat + ' penerima belum punya ' +
          (kanal === 'whatsapp' ? 'nomor HP' : 'alamat email') +
          ' — pengirimannya akan ditandai <b>Gagal</b>.</div>'
        : '') +
      '<div class="btn-row">' +
        '<button class="btn primary" id="kirim-btn" data-action="kirim"' + (nSel ? '' : ' disabled') + '>' +
          (state.settings.wajibPeriksa ? '🔍 Periksa &amp; Kirim (' + nSel + ')' : '➤ Kirim (' + nSel + ')') +
        '</button>' +
        '<button class="btn" id="draft-btn" data-action="simpan-draft"' + (nSel ? '' : ' disabled') + '>Simpan Draft</button>' +
        '<button class="btn ghost" data-action="tpl-simpan-baru">Simpan sebagai template</button>' +
      '</div>' +
      (state.settings.wajibPeriksa
        ? '<p class="tiny muted" style="margin:8px 0 0">Pratinjau wajib aktif — surat diperiksa dulu ' +
          'sebelum dikirim. Bisa dimatikan di <b>Setelan → Pengaman pengiriman</b>.</p>'
        : '') +
      (kanal === 'email'
        ? '<div class="btn-row" style="margin-top:8px">' +
            '<button class="btn" data-action="kirim-sendiri"' + (nSel ? '' : ' disabled') + '>' +
              '✉ Kirim ke saya sendiri dulu</button>' +
            '<button class="btn" data-action="cetak-label-dipilih"' + (nSel ? '' : ' disabled') + '>' +
              '⎙ Cetak label alamat (' + nSel + ')</button>' +
            '<span class="tiny muted" style="align-self:center">' +
              'Salinan dikirim ke <b>' + esc(emailUji() || 'alamat email uji (belum diisi)') + '</b>' +
              ' — atur di <b>Setelan → Pengaman pengiriman</b>. ' +
              'Isinya memakai penerima pertama sebagai contoh, dan <b>tidak masuk riwayat surat donor</b>.' +
            '</span>' +
          '</div>' +
          '<div id="wadah-uji">' + barisUji() + '</div>'
        : '') +
    '</div>' +

  '</div>';
}
function previewHTML(d){
  if(!d) return '<div class="card-head"><h2>3 · Pratinjau</h2></div>' +
    '<p class="muted small">Belum ada donor untuk dipratinjau.</p>';
  const wa = suratState.kanal === 'whatsapp';
  const alamat = wa ? (donorWa(d) ? waPhonePretty(donorWa(d)) : 'belum ada nomor HP') : (emailUtama(d) || 'belum ada email');
  const pakaiKwitansi = suratState.kwitansi;
  return '<div class="card-head"><h2>3 · Pratinjau</h2>' +
      '<span class="chip plain">' + esc(donorName(d)) + '</span>' +
      '<span class="chip kanal-' + (wa ? 'whatsapp' : 'email') + '">' +
        ICO_KANAL[wa ? 'whatsapp' : 'email'] + ' ' + LABEL_KANAL[wa ? 'whatsapp' : 'email'] + '</span></div>' +
    '<div class="small muted" style="margin-bottom:8px">Kepada: <b>' + esc(donorLabel(d)) + '</b>' +
      (d.instansi ? ' — ' + esc(d.instansi) : '') + ' · <span class="mono">' + esc(alamat) + '</span></div>' +
    (wa
      ? '<div class="wa-preview"><div class="wa-bubble">' + esc(fillTemplate(suratState.isi, d)) + '</div></div>'
      : '<div class="letter">' + esc(fillTemplate(suratState.isi, d)) + '</div>') +
    /* Email: kwitansi ikut sebagai tabel HTML di badan email.
       WhatsApp: tidak bisa tabel — dikirim sebagai gambar, jadi yang
       ditampilkan di sini pun harus gambarnya. */
    (!wa && pakaiKwitansi
      ? '<p class="tiny muted" style="margin:14px 0 0">Kwitansi yang tercetak di dalam email:</p>' +
        '<div class="kwitansi-preview">' + kwitansiHTML(d, suratState.kwitansiBahasa, suratState.kwitansiFinId) + '</div>'
      : '') +
    (wa && pakaiKwitansi
      ? '<p class="tiny muted" style="margin:14px 0 0">Kwitansi dikirim sebagai gambar — tekan tombol di bawah untuk melihatnya:</p>'
      : '') +
    (!wa && suratState.majalah && majalahInfo()
      ? '<p class="tiny muted" style="margin:14px 0 0">Majalah yang ikut terkirim — sampul + tombol baca:</p>' +
        '<div class="mj-preview">' + majalahHTML() + '</div>'
      : '') +
    '<div class="btn-row" style="margin-top:12px">' +
      '<button class="btn primary" data-action="pratinjau-email" data-id="' + esc(d.id) + '">👁 Pratinjau email</button>' +
      '<button class="btn" data-action="periksa-kirim">🔍 Periksa sebelum kirim</button>' +
      (pakaiKwitansi
        ? '<button class="btn' + (wa ? ' primary' : '') + '" data-action="kwitansi-png" data-id="' + esc(d.id) + '">' +
          '🖼 Kwitansi PNG' + (wa ? ' (yang dikirim)' : '') + '</button>'
        : '') +
      '<button class="btn" data-action="print-one" data-id="' + esc(d.id) + '">⎙ Cetak</button>' +
    '</div>';
}

/* ============================================================
   PRATINJAU EMAIL — seperti klien email sungguhan
   ------------------------------------------------------------
   Menampilkan HTML yang PERSIS sama dengan yang dikirim, di dalam
   iframe. Jadi yang dilihat user = yang diterima donor. Tidak perlu
   kirim percobaan ke email sendiri.

   Ada pilihan tampilan:
   - Lebar layar: komputer / HP
   - Blokir gambar: meniru Gmail yang memblokir gambar
   - Versi teks: yang dilihat penerima mode teks
   ============================================================ */

let pratinjauOpsi = { lebar:'desktop', blokirGambar:false, tab:'html' };

/* Ganti warna tema terang/gelap untuk iframe (iframe tidak mewarisi CSS induk). */
function temaIframe(){
  const gelap = document.documentElement.getAttribute('data-theme') === 'dark';
  return gelap
    ? { bg:'#1a1d1c', teks:'#e6e6e1', garis:'#2f3432', panel:'#222624' }
    : { bg:'#ffffff', teks:'#111111', garis:'#e0e0d8', panel:'#f7f7f2' };
}

/* HTML email apa adanya — memakai fungsi yang sama dengan pengirim. */
function htmlEmailUntuk(d, pixelId, pratinjau){
  const isi = fillTemplate(suratState.isi, d);
  const pakaiKwitansi = suratState.kwitansi;
  const pakaiMajalah = suratState.majalah && majalahInfo();
  if(!pakaiKwitansi && !pakaiMajalah && !pixelId && !pratinjau) return '';
  return isiHTML(d, isi, suratState.kwitansiBahasa, suratState.kwitansiFinId, {
    kwitansi: !!pakaiKwitansi,
    majalah: !!pakaiMajalah,
    pixelId: pixelId || '',
    /* Di pratinjau tombol konfirmasi ditampilkan tapi tidak bisa ditekan —
       kalau bisa, satu klik tidak sengaja akan tercatat sebagai konfirmasi. */
    terimaId: pratinjau ? 'pratinjau' : '',
    terimaPratinjau: !!pratinjau,
    terimaInfo: {
      judul: 'Kartidaya Sahabat Indonesia',
      kwitansi: pakaiKwitansi ? dataKwitansi(d, suratState.kwitansiFinId).kode : '',
      jumlah: pakaiKwitansi ? totalTransaksiRingkas(d, suratState.kwitansiFinId) : '',
      donor: donorName(d),
      dikirim: waktuKirim()
    }
  });
}

function openPratinjauEmail(donorId){
  const d = findDonor(donorId) || findDonor(suratState.previewId) ||
    findDonor(Object.keys(suratState.selected).filter(function(k){ return suratState.selected[k]; })[0]);
  if(!d){ toast('Pilih penerima dulu untuk melihat pratinjau', true); return; }
  pratinjauOpsi = { lebar:'desktop', blokirGambar:false, tab:'html' };
  gambarPratinjauEmail(d);
  openModal({
    title:'Pratinjau email — seperti yang diterima donor',
    body:'<div id="pratinjau-email-root"></div>',
    wide:true,
    footer:'<span class="tiny muted" style="margin-right:auto">Ini pratinjau. Tidak ada email yang dikirim.</span>' +
      '<button class="btn" data-close>Tutup</button>' +
      '<button class="btn" data-action="kirim-sendiri-dari-pratinjau">✉ Kirim ke saya sendiri dulu</button>' +
      '<button class="btn primary" data-action="periksa-kirim">🔍 Periksa sebelum kirim</button>',
    onOpen:function(){ gambarPratinjauEmail(d); }
  });
}

function gambarPratinjauEmail(d){
  const root = document.getElementById('pratinjau-email-root');
  if(!root || !d) return;
  const t = temaIframe();
  const subjek = fillTemplate(suratState.subjek, d);
  const isi = fillTemplate(suratState.isi, d);
  const html = htmlEmailUntuk(d, '', true);
  const pengirim = Gmail.email || 'kartidaya@contoh.org';
  const namaPengirim = 'Kartidaya Sahabat Indonesia';
  const waktu = new Date().toLocaleString('id-ID',
    { weekday:'long', day:'numeric', month:'long', year:'numeric', hour:'2-digit', minute:'2-digit' });

  /* Tab: HTML (yang dilihat mayoritas) atau teks biasa. */
  const tab = function(kode, label){
    return '<button class="btn sm' + (pratinjauOpsi.tab === kode ? ' primary' : '') +
      '" data-action="pj-tab" data-tab="' + kode + '">' + label + '</button>';
  };

  /* Isi iframe. Kalau "blokir gambar" aktif, semua <img> diganti kotak abu-abu
     — meniru Gmail yang menahan gambar sampai penerima mengizinkannya. */
  let isiIframe = html;
  if(!html){
    isiIframe = '<div style="font-family:Arial,sans-serif;font-size:14px;line-height:1.65;color:' + t.teks +
      '">' + esc(isi).replace(/\n/g, '<br>') + '</div>';
  }
  if(pratinjauOpsi.blokirGambar){
    isiIframe = isiIframe.replace(/<img\b[^>]*>/gi,
      '<span style="display:inline-block;padding:10px 14px;border:1px dashed #b8b8b0;' +
      'background:#f0f0ea;color:#8a8a80;font:12px Arial,sans-serif;border-radius:4px">' +
      'gambar diblokir</span>');
  }

  const doc = '<!DOCTYPE html><html><head><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<style>' +
      'html,body{margin:0;padding:0;background:' + t.bg + ';color:' + t.teks + '}' +
      'body{padding:18px 20px;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.6;' +
        'overflow-wrap:anywhere}' +
      'img{max-width:100%;height:auto}' +
      'a{color:#2f6f9f}' +
    '</style></head><body>' + isiIframe + '</body></html>';

  /* Versi teks: yang dilihat penerima mode teks — surat + ringkasan kwitansi.
     Isinya melewati formatTeksPolos() supaya penanda **tebal** / *miring*
     dibuang, sama seperti yang benar-benar dikirim (lihat kirimSurat). */
  const k = dataKwitansi(d, suratState.kwitansiFinId);
  const teksPolos = formatTeksPolos(isi) + '\n\n' +
    (suratState.kwitansi
      ? '--- KWITANSI ---\n' +
        'No. ' + k.nomor + '\n' +
        'Telah terima dari: ' + donorName(d) + '\n' +
        (k.kodeUang.length ? k.kodeUang : ['IDR']).map(function(u){
          return 'Jumlah: ' + terbilang(k.perUang[u] || 0, u) + ' (' +
            fmtUang(k.perUang[u] || 0, u) + ')\n';
        }).join('') +
        'Untuk: ' + (k.program || 'Pelayanan Kartidaya Sahabat') + '\n' +
        'Tanggal: ' + tanggalKwitansi(k.tanggal) + '\n'
      : '') +
    (suratState.majalah && majalahInfo() ? '\nMajalah: ' + majalahInfo().halaman + ' halaman\n' : '');

  const lebarKotak = pratinjauOpsi.lebar === 'hp' ? '360px' : '100%';

  root.innerHTML =
    /* Bilah kendali */
    '<div class="pj-bilah">' +
      '<div class="row" style="gap:6px">' + tab('html','Tampilan email') + tab('teks','Versi teks') + '</div>' +
      '<div class="row" style="gap:6px">' +
        '<button class="btn sm' + (pratinjauOpsi.lebar === 'desktop' ? ' primary' : '') +
          '" data-action="pj-lebar" data-lebar="desktop">🖥 Komputer</button>' +
        '<button class="btn sm' + (pratinjauOpsi.lebar === 'hp' ? ' primary' : '') +
          '" data-action="pj-lebar" data-lebar="hp">📱 HP</button>' +
        '<button class="btn sm' + (pratinjauOpsi.blokirGambar ? ' primary' : '') +
          '" data-action="pj-blokir" title="Meniru Gmail yang memblokir gambar">' +
          (pratinjauOpsi.blokirGambar ? '🚫 Gambar diblokir' : '🖼 Gambar tampil') + '</button>' +
      '</div>' +
    '</div>' +

    '<div class="pj-pilihan">Pratinjau untuk: <b>' + esc(donorLabel(d)) + '</b>' +
      (d.instansi && d.instansi !== donorName(d) ? ' — ' + esc(d.instansi) : '') +
      ' <span class="mono">' + esc(emailUtama(d) || 'belum ada email') + '</span>' +
      '<span class="chip plain" style="margin-left:6px">' + esc(d.id) + '</span></div>' +

    /* Kerangka klien email */
    '<div class="pj-klien" style="max-width:' + lebarKotak + '">' +
      '<div class="pj-kepala">' +
        '<div class="pj-avatar">K</div>' +
        '<div class="pj-dari">' +
          '<div class="pj-subjek">' + esc(subjek || '(tanpa subjek)') + '</div>' +
          '<div class="pj-meta"><b>' + esc(namaPengirim) + '</b> &lt;' + esc(pengirim) + '&gt;</div>' +
          '<div class="pj-meta">kepada <b>' + esc(donorLabel(d)) + '</b> &lt;' + esc(emailUtama(d) || '—') + '&gt;</div>' +
        '</div>' +
        '<div class="pj-waktu">' + esc(waktu) + '</div>' +
      '</div>' +
      (pratinjauOpsi.blokirGambar
        ? '<div class="pj-peringatan">Gambar diblokir — ini yang dilihat penerima sebelum menekan ' +
          '&ldquo;Tampilkan gambar&rdquo;. Pastikan isi surat tetap terbaca tanpa gambar.</div>'
        : '') +
      (pratinjauOpsi.tab === 'teks'
        ? '<div class="pj-badan pj-teks">' + esc(teksPolos) + '</div>'
        : '<iframe class="pj-iframe" id="pj-iframe" sandbox="allow-same-origin" ' +
          'title="Pratinjau email"></iframe>') +
    '</div>' +

    '<p class="tiny muted" style="margin:10px 0 0">' +
      'Isi di atas dibuat dengan fungsi yang <b>sama persis</b> dengan yang dipakai saat mengirim. ' +
      'Tampilan bisa sedikit berbeda di aplikasi email lain (Outlook, Yahoo) — terutama pada tabel yang rumit.' +
    '</p>';

  const ifr = document.getElementById('pj-iframe');
  if(ifr) ifr.srcdoc = doc;
}

/* Periksa sebelum kirim: tampilkan surat + kwitansi + majalah persis seperti
   yang akan diterima donor, plus daftar penerima dan hal yang perlu
   diperhatikan. Tujuannya supaya tidak salah kirim. */
function openPeriksaKirim(){
  const ids = Object.keys(suratState.selected).filter(function(k){ return suratState.selected[k]; });
  if(!ids.length){ toast('Pilih penerima dulu', true); return; }
  if(!suratState.isi.trim()){ toast('Isi surat masih kosong', true); return; }

  const kanal = suratState.kanal === 'whatsapp' ? 'whatsapp' : 'email';
  const wa = kanal === 'whatsapp';
  const pakaiKwitansi = !wa && suratState.kwitansi;
  const pakaiMajalah = !wa && suratState.majalah && majalahInfo();

  /* Penerima yang belum punya alamat akan gagal terkirim — ditandai di sini
     supaya bisa dibetulkan sebelum menekan Kirim. */
  const tanpaAlamat = ids.filter(function(id){
    const d = findDonor(id);
    return d && !(wa ? donorWa(d) : emailUtama(d));
  });
  const tanpaKwitansi = pakaiKwitansi ? ids.filter(function(id){
    return !state.finance.some(function(f){ return f.donorId === id; });
  }) : [];

  const perhatian = [];
  if(tanpaAlamat.length) perhatian.push('<b>' + tanpaAlamat.length + ' penerima</b> belum punya ' +
    (wa ? 'nomor HP' : 'alamat email') + ' — pengirimannya akan ditandai <b>Gagal</b>.');
  if(tanpaKwitansi.length) perhatian.push('<b>' + tanpaKwitansi.length + ' penerima</b> belum punya ' +
    'transaksi di halaman Keuangan — kwitansinya berjumlah <b>Rp 0</b>.');
  if(pakaiKwitansi && !state.finance.length) perhatian.push('Belum ada data keuangan sama sekali. ' +
    'Catat dulu di halaman <b>Keuangan</b> supaya kwitansi berisi jumlah yang benar.');
  if(!wa && !Gmail.isConnected()) perhatian.push('Gmail belum terhubung — surat hanya akan ' +
    '<b>dicatat</b> sebagai Terkirim, tidak benar-benar dikirim.');
  if(wa && !(WhatsApp.isConfigured() && WhatsApp.status() === 'connected')) perhatian.push('WhatsApp belum ' +
    'tersambung — pesan hanya akan <b>dicatat</b>, tidak benar-benar dikirim.');

  /* Contoh yang ditampilkan: penerima pertama yang dipilih. */
  const contoh = findDonor(ids[0]);
  const subjek = contoh ? fillTemplate(suratState.subjek, contoh) : suratState.subjek;
  const isi = contoh ? fillTemplate(suratState.isi, contoh) : suratState.isi;

  const daftarPenerima = ids.map(function(id){
    const d = findDonor(id);
    if(!d) return '';
    const alamat = wa ? (donorWa(d) ? waPhonePretty(donorWa(d)) : '') : (emailUtama(d) || '');
    /* Jumlah yang ditampilkan harus jumlah kwitansi yang AKAN DIKIRIM, bukan
       total semua transaksi donor. Kalau donor punya beberapa transaksi dan
       hanya satu yang dipilih, total semua membuat angkanya tidak cocok
       dengan kwitansi di bawahnya — dan itu membuat layar periksa ini justru
       menyesatkan. */
    const k = pakaiKwitansi ? dataKwitansi(d, suratState.kwitansiFinId) : null;
    const total = (k && k.ada)
      ? k.kodeUang.map(function(u){ return fmtUang(k.perUang[u] || 0, u); }).join(' + ')
      : '';
    return '<tr>' +
      '<td class="mono nowrap">' + esc(d.id) + '</td>' +
      '<td><b>' + esc(donorName(d)) + '</b></td>' +
      '<td class="small mono">' + (alamat ? esc(alamat) : '<span class="chip warn">belum ada</span>') + '</td>' +
      (pakaiKwitansi
        ? '<td class="small mono right nowrap">' + (total ? esc(total) : '<span class="chip warn">Rp 0</span>') + '</td>'
        : '') +
    '</tr>';
  }).join('');

  const body =
    (perhatian.length
      ? '<div class="warnbox"><b>Perlu diperhatikan</b><ul style="margin:8px 0 0;padding-left:20px">' +
          perhatian.map(function(x){ return '<li>' + x + '</li>'; }).join('') + '</ul></div>'
      : '<div class="okbox">✓ Tidak ada hal yang perlu diperhatikan. Siap dikirim.</div>') +

    '<div class="sep"></div>' +
    '<p class="small" style="margin:0 0 8px"><b>Penerima (' + ids.length + ')</b> ' +
      '<span class="hint">— contoh di bawah memakai penerima pertama</span></p>' +
    '<div class="table-wrap"><table><thead><tr>' +
      '<th>ID</th><th>Nama</th><th>' + (wa ? 'Nomor' : 'Email') + '</th>' +
      (pakaiKwitansi ? '<th class="right">Jumlah kwitansi</th>' : '') +
    '</tr></thead><tbody>' + daftarPenerima + '</tbody></table></div>' +

    '<div class="sep"></div>' +
    '<p class="small" style="margin:0 0 8px"><b>Isi surat yang akan diterima</b></p>' +
    '<div class="kv">' +
      kv('Subjek', subjek) +
      kv('Kepada', contoh ? donorLabel(contoh) + ' · ' + (wa ? waPhonePretty(donorWa(contoh)) : emailUtama(contoh)) : '—') +
      (!wa && rapikanCc(suratState.cc) ? kv('Cc', rapikanCc(suratState.cc)) : '') +
    '</div>' +
    (wa
      ? '<div class="wa-preview"><div class="wa-bubble">' + esc(formatTeksPolos(isi)) + '</div></div>'
      : '<div class="letter">' + formatTeksHTML(isi) + '</div>') +

    (pakaiKwitansi && contoh
      ? '<div class="sep"></div>' +
        '<p class="small" style="margin:0 0 8px"><b>Kwitansi yang akan diterima</b> ' +
          '<span class="hint">— ' + esc(KWITANSI_NAMA_BAHASA[suratState.kwitansiBahasa] || 'Indonesia') + '</span></p>' +
        '<div class="kwitansi-preview">' +
          kwitansiHTML(contoh, suratState.kwitansiBahasa, suratState.kwitansiFinId) + '</div>'
      : '') +

    /* WhatsApp tidak bisa menampilkan tabel HTML — kwitansinya dikirim sebagai
       GAMBAR. Jadi yang diperiksa di sini harus gambarnya, bukan tabelnya. */
    (wa && suratState.kwitansi && contoh
      ? '<div class="sep"></div>' +
        '<p class="small" style="margin:0 0 8px"><b>Kwitansi yang akan diterima</b> ' +
          '<span class="hint">— dikirim sebagai gambar PNG, bukan tabel</span></p>' +
        '<div class="png-preview" id="png-periksa">' +
          '<p class="muted small">Menggambar kwitansi…</p></div>'
      : '') +

    (pakaiMajalah
      ? '<div class="sep"></div>' +
        '<p class="small" style="margin:0 0 8px"><b>Majalah yang akan diterima</b> ' +
          '<span class="hint">— ' + majalahInfo().halaman + ' halaman</span></p>' +
        '<div class="mj-preview">' + majalahHTML() + '</div>'
      : '') +

    /* Tombol konfirmasi ikut diperlihatkan supaya user tahu donor akan
       menerima tombol ini, dan bisa memastikan sendiri tampilannya. */
    (!wa && workerBase()
      ? '<div class="sep"></div>' +
        '<p class="small" style="margin:0 0 8px"><b>Tombol konfirmasi di email donor</b> ' +
          '<span class="hint">— donor menekannya kalau surat sudah sampai</span></p>' +
        '<div class="kwitansi-preview">' +
          terimaHTML('pratinjau', {
            judul: 'Kartidaya Sahabat Indonesia',
            kwitansi: pakaiKwitansi && contoh ? dataKwitansi(contoh, suratState.kwitansiFinId).kode : '',
            jumlah: pakaiKwitansi && contoh ? totalTransaksiRingkas(contoh, suratState.kwitansiFinId) : '',
            donor: contoh ? donorName(contoh) : '',
            dikirim: waktuKirim()
          }, { pratinjau: true }) +
        '</div>'
      : '');

  const footer = '<button class="btn" data-close>Kembali periksa</button>' +
    (wa ? '' : '<button class="btn" data-action="kirim-sendiri-dari-periksa">✉ Kirim ke saya sendiri dulu</button>') +
    '<button class="btn primary" data-action="kirim-dari-periksa">➤ Kirim sekarang (' + ids.length + ')</button>';

  openModal({
    title:'Periksa sebelum kirim', body:body, footer:footer, wide:true,
    gambarKwitansi: (wa && suratState.kwitansi && contoh)
      ? { d:contoh, bahasa:suratState.kwitansiBahasa, finId:suratState.kwitansiFinId,
          kodeKiriman:kodeKiriman(), waktuKirim:waktuKirim() }
      : null
  });
}

/* ---------- SALINAN UJI ---------- */

/* Tombol "✉ Kirim ke saya sendiri dulu" mengirim satu salinan ke email sendiri
   supaya bisa diperiksa di kotak masuk sungguhan. Salinan itu memakai tanda
   dibaca & tombol konfirmasi yang sama seperti surat sungguhan, tetapi TIDAK
   masuk riwayat surat donor.

   Hasilnya ditampilkan sebagai SATU BARIS kecil di halaman Tulis — bukan
   halaman/menu tersendiri. Alasannya: Pratinjau email & Periksa sebelum kirim
   sudah cukup untuk memeriksa tampilan; yang tidak bisa dibuktikan keduanya
   hanyalah apakah tanda dibaca & tombol konfirmasi benar-benar bekerja. Jadi
   hanya itu yang perlu ditampilkan, sesingkat mungkin. */
const UJI_MAKS = 5;

function catatUji(rec){
  if(!state.uji) state.uji = [];
  state.uji.unshift(rec);
  if(state.uji.length > UJI_MAKS) state.uji.length = UJI_MAKS;
  save('uji');
}

/* Tanya Worker kabar salinan uji. Dipanggil bersama pemeriksaan surat biasa. */
async function cekUji(){
  if(!WhatsApp.isConfigured()) return;
  const menunggu = (state.uji || []).filter(function(u){
    return (u.pixelId && !u.dibaca) || (u.terimaId && !u.dikonfirmasi);
  });
  if(!menunggu.length) return;
  try{
    const px = menunggu.filter(function(u){ return u.pixelId && !u.dibaca; });
    if(px.length){
      const r = await WhatsApp.api('/pixel/status', {
        method:'POST', body:{ ids: px.map(function(u){ return u.pixelId; }) }
      });
      const map = (r && r.dibaca) || {};
      px.forEach(function(u){
        const rec = map[u.pixelId];
        if(rec && rec.pertama) u.dibaca = rec.pertama;
      });
    }
    const tr = menunggu.filter(function(u){ return u.terimaId && !u.dikonfirmasi; });
    if(tr.length){
      const r2 = await WhatsApp.api('/terima/status', {
        method:'POST', body:{ ids: tr.map(function(u){ return u.terimaId; }) }
      });
      const map2 = (r2 && r2.terima) || {};
      tr.forEach(function(u){
        const rec = map2[u.terimaId];
        if(rec && rec.waktu) u.dikonfirmasi = rec.waktu;
      });
    }
    save('uji');
    segarkanBarisUji();
  }catch(e){ /* diamkan — ini hanya alat bantu uji */ }
}

function hapusSemuaUji(){
  state.uji = [];
  save('uji');
  segarkanBarisUji();
}

/* Satu baris ringkas di halaman Tulis: salinan uji terakhir + hasilnya.
   Sengaja hanya menampilkan yang TERAKHIR supaya tidak jadi daftar panjang. */
function barisUji(){
  const u = (state.uji || [])[0];
  if(!u) return '';
  const chipDibaca = u.pixelId
    ? (u.dibaca
        ? '<span class="chip st-dibaca" title="Dibuka ' + esc(fmtDateTime(u.dibaca)) + '">✓✓ Dibaca</span>'
        : '<span class="chip plain">✓✓ Belum dibaca</span>')
    : '';
  const chipTerima = u.terimaId
    ? (u.dikonfirmasi
        ? '<span class="chip ok" title="Dikonfirmasi ' + esc(fmtDateTime(u.dikonfirmasi)) + '">✓ Dikonfirmasi</span>'
        : '<span class="chip plain">belum dikonfirmasi</span>')
    : '';
  return '<div class="row" style="margin-top:8px;align-items:center;gap:8px">' +
    '<span class="tiny muted">Salinan terakhir ' + relTime(u.tanggal) + ' ke <b>' +
      esc(u.tujuan) + '</b>:</span>' +
    chipDibaca + chipTerima +
    '<button class="btn sm ghost" data-action="uji-bersihkan">Bersihkan</button>' +
  '</div>';
}

/* Perbarui HANYA baris uji, tanpa menggambar ulang seluruh halaman Tulis.
   Kalau memakai render(), isi surat yang sedang diketik ikut terhapus. */
function segarkanBarisUji(){
  const wadah = document.getElementById('wadah-uji');
  if(!wadah) return;
  wadah.innerHTML = barisUji();
}

/* Kotak 5 isian serba guna di halaman Tulis. Diisi SEKALI, lalu dipakai di
   semua surat lewat token {/ISI1}…{/ISI5}. Gunanya untuk hal yang tidak ada di
   data donor — misalnya hari/tanggal, waktu, tempat, dan pembicara undangan.
   Nilainya ikut tersimpan, jadi surat berikutnya tidak perlu diketik ulang. */
function blokIsian(){
  const terisi = state.isian.filter(function(v){ return String(v || '').trim(); }).length;
  return '<div class="sep"></div>' +
    '<div class="row" style="justify-content:space-between">' +
      '<span class="small"><b>Isian serba guna</b> ' +
        '<span class="hint">— diisi sekali, dipakai di semua surat</span></span>' +
      '<span class="chip' + (terisi ? '' : ' plain') + '">' + terisi + ' dari ' + ISIAN_MAKS + ' terisi</span>' +
    '</div>' +
    '<p class="tiny muted" style="margin:6px 0 10px">Untuk hal yang tidak ada di data donor — ' +
      'misalnya hari/tanggal, waktu, tempat, dan pembicara sebuah undangan. ' +
      'Klik token <span class="mono">{/ISI1}</span>…<span class="mono">{/ISI5}</span> di atas untuk ' +
      'menyisipkannya ke isi surat. Isian ini juga dipakai di template.</p>' +
    '<div class="form-grid">' + ISIAN_FIELD.map(function(f){
      return '<div class="field"><label>' + esc(f.label) + '</label>' +
        '<input type="text" class="isian" data-isian="' + f.n + '" ' +
          'placeholder="' + esc(f.contoh) + '" value="' + esc(state.isian[f.n - 1] || '') + '"></div>';
    }).join('') + '</div>' +
    '<div class="btn-row">' +
      '<button class="btn sm" data-action="isian-simpan">Simpan isian</button>' +
      '<button class="btn sm ghost" data-action="isian-kosongkan">Kosongkan semua</button>' +
    '</div>';
}

/* Ambil nilai 5 isian dari form (dipakai tombol "Simpan isian"). */
function bacaIsianDariForm(){
  document.querySelectorAll('.isian').forEach(function(el){
    const n = parseInt(el.getAttribute('data-isian'), 10);
    if(n >= 1 && n <= ISIAN_MAKS) state.isian[n - 1] = el.value;
  });
}

/* Kotak pilihan kwitansi di halaman Tulis. Hanya untuk kanal email — WhatsApp
   tidak bisa menampilkan tabel HTML. */
function blokKwitansi(){
  const on = !!suratState.kwitansi;
  const bhs = KWITANSI_BAHASA.map(function(b){
    return '<button type="button" class="btn sm' + (suratState.kwitansiBahasa === b ? ' primary' : '') +
      '" data-action="kw-bahasa" data-bahasa="' + b + '">' + esc(KWITANSI_NAMA_BAHASA[b]) + '</button>';
  }).join('');
  /* Daftar transaksi donor yang sedang dipratinjau, supaya bisa memilih
     kwitansi mana yang dikirim kalau donornya punya beberapa transaksi. */
  const d = findDonor(suratState.previewId) || findDonor(Object.keys(suratState.selected).filter(function(k){ return suratState.selected[k]; })[0]);
  const finDonor = d ? state.finance.filter(function(f){ return f.donorId === d.id; })
    .sort(function(a,b){ return String(b.tanggal).localeCompare(String(a.tanggal)); }) : [];
  /* Kalau transaksi yang tadi dipilih milik donor lain (penerima diganti),
     lupakan pilihannya. Tanpa ini kotak pilihan menampilkan transaksi donor
     sebelumnya sementara kwitansinya sudah memakai transaksi donor yang baru —
     dua hal berbeda di satu layar. */
  if(suratState.kwitansiFinId && !finDonor.some(function(f){ return f.id === suratState.kwitansiFinId; })){
    suratState.kwitansiFinId = '';
  }
  const finOpts = '<option value="">Transaksi terbaru</option>' + finDonor.map(function(f){
    return '<option value="' + esc(f.id) + '"' + (suratState.kwitansiFinId === f.id ? ' selected' : '') + '>' +
      esc(f.tanggal + ' · ' + Object.keys(totalPerUangTransaksi(f)).sort().map(function(k){
        return fmtUang(totalPerUangTransaksi(f)[k], k);
      }).join(' + ')) + '</option>';
  }).join('');

  return '<div class="sep"></div>' +
    '<div class="row" style="justify-content:space-between">' +
      '<span class="small"><b>Lampirkan kwitansi</b> <span class="hint">— tercetak di dalam email</span></span>' +
      '<button class="btn sm' + (on ? ' primary' : '') + '" data-action="kw-toggle">' + (on ? 'Aktif' : 'Mati') + '</button>' +
    '</div>' +
    (on
      ? '<div class="field" style="margin-top:10px"><label>Bahasa kwitansi</label>' +
          '<div class="row" style="gap:8px">' + bhs + '</div></div>' +
        (d
          ? '<div class="field"><label>Transaksi <span class="hint">— ' + esc(donorName(d)) + '</span></label>' +
              '<select id="s-kw-fin">' + finOpts + '</select></div>' +
            (finDonor.length ? '' :
              '<div class="warnbox">Donor ini belum punya transaksi di halaman <b>Keuangan</b>. ' +
              'Kwitansi tetap terkirim, tapi jumlahnya Rp 0. Catat dulu transaksinya di menu Keuangan.</div>')
          : '<p class="tiny muted">Pilih penerima dulu untuk melihat transaksinya.</p>') +
        '<p class="tiny muted">Kwitansi dikirim sebagai bagian dari email (HTML), bukan lampiran PDF — ' +
          'jadi penerima langsung melihatnya tanpa perlu membuka berkas.</p>'
      : '<p class="tiny muted" style="margin-top:6px">Kalau aktif, setiap penerima menerima kwitansi ' +
        'dengan nama &amp; jumlah sesuai data Keuangan miliknya.</p>');
}
/* ---------- LAMPIRAN BERKAS ----------
   Berkas sungguhan (PDF, foto, dokumen) yang ikut terkirim bersama surat.
   Berkasnya disimpan di Worker, bukan di browser: supaya bisa dibuka lagi
   dari riwayat surat kapan saja, dan supaya penerima bisa mengunduhnya. */
function lampiranSurat(){
  if(!Array.isArray(suratState.lampiran)) suratState.lampiran = [];
  return suratState.lampiran;
}

function ukuranBerkas(n){
  const b = Number(n) || 0;
  if(b < 1024) return b + ' B';
  if(b < 1024 * 1024) return (b / 1024).toFixed(0) + ' KB';
  return (b / 1024 / 1024).toFixed(1) + ' MB';
}

function blokLampiran(){
  const daftar = lampiranSurat();
  const siap = WhatsApp.isConfigured();
  return '<div class="sep"></div>' +
    '<div class="row" style="justify-content:space-between">' +
      '<span class="small"><b>Lampiran berkas</b> ' +
        '<span class="hint">— PDF, foto, atau dokumen (maks. 10 MB per berkas)</span></span>' +
      '<button class="btn sm" data-action="lampiran-pilih"' + (siap ? '' : ' disabled') + '>' +
        '+ Pilih berkas</button>' +
    '</div>' +
    (siap ? '' :
      '<div class="warnbox" style="margin-top:8px">Alamat Worker belum diisi, jadi lampiran ' +
      'belum bisa disimpan. Isi dulu di <b>Setelan → Worker Cloudflare</b>.</div>') +
    (daftar.length
      ? '<div class="lampiran-daftar">' + daftar.map(function(l, i){
          return '<div class="lampiran-baris">' +
            '<span class="lampiran-ikon">' + ikonBerkas(l.nama) + '</span>' +
            '<span class="lampiran-nama">' + esc(l.nama) + '</span>' +
            '<span class="tiny muted mono">' + ukuranBerkas(l.ukuran) + '</span>' +
            (l.naik
              ? '<span class="chip ok">tersimpan</span>'
              : '<span class="chip warn">belum terunggah</span>') +
            '<button class="btn sm ghost" data-action="lampiran-hapus" data-i="' + i + '">Hapus</button>' +
          '</div>';
        }).join('') + '</div>'
      : '<p class="tiny muted" style="margin-top:6px">Belum ada lampiran. Surat tanpa lampiran ' +
        'tetap bisa dikirim seperti biasa.</p>') +
    '<input type="file" id="s-lampiran-file" class="hidden" multiple>';
}

/* Ikon sederhana menurut jenis berkas — supaya daftar lampiran cepat dibaca. */
function ikonBerkas(nama){
  const ext = String(nama || '').split('.').pop().toLowerCase();
  if(ext === 'pdf') return '📕';
  if(['jpg','jpeg','png','webp','gif'].indexOf(ext) >= 0) return '🖼';
  if(['doc','docx'].indexOf(ext) >= 0) return '📄';
  if(['xls','xlsx','csv'].indexOf(ext) >= 0) return '📊';
  if(['ppt','pptx'].indexOf(ext) >= 0) return '📽';
  if(['zip','rar','7z'].indexOf(ext) >= 0) return '🗜';
  return '📎';
}

/* Unggah semua lampiran yang belum tersimpan. Dipanggil sebelum surat
   dikirim — kalau ada yang gagal, surat tetap dikirim tanpa berkas itu dan
   pengguna diberi tahu, bukan digagalkan seluruhnya. */
async function unggahLampiranSurat(){
  const daftar = lampiranSurat();
  const belum = daftar.filter(function(l){ return !l.naik && l.berkas; });
  if(!belum.length) return { ok: 0, gagal: 0, pesan: '' };
  let ok = 0, gagal = 0, pesan = '';
  for(const l of belum){
    try{
      const r = await WhatsApp.unggahLampiran(l.id, l.berkas);
      l.naik = true;
      l.url = r.url || WhatsApp.lampiranURL(l.id);
      l.ukuran = r.ukuran || l.ukuran;
      delete l.berkas;          /* berkas tidak disimpan di localStorage */
      ok++;
    }catch(e){
      gagal++;
      pesan = e.message || String(e);
    }
  }
  return { ok: ok, gagal: gagal, pesan: pesan };
}

/* Kotak pilihan majalah di halaman Tulis. Halaman majalah disimpan sekali di
   Worker, lalu dipakai ulang untuk semua penerima. */
/* Periksa apakah majalah yang dicatat di browser benar-benar masih ada di
   Worker. Majalah disimpan di KV Cloudflare, bukan di browser — jadi catatan
   lokal bisa tertinggal kalau berkasnya sudah tidak ada di sana. Kalau tidak
   diperiksa, email akan memuat gambar yang tidak bisa dibuka penerima. */
async function cekMajalahAda(){
  const m = majalahInfo();
  if(!m || !WhatsApp.isConfigured()) return;
  try{
    await WhatsApp.api('/majalah/' + m.id);
    if(state.settings.majalah && state.settings.majalah.hilang){
      delete state.settings.majalah.hilang;
      save('majalah');
      render();
    }
  }catch(e){
    /* 404 = berkasnya memang tidak ada. Galat lain (jaringan, kunci salah)
       diabaikan — jangan menuduh majalah hilang hanya karena tidak bisa
       menghubungi Worker. */
    if(e && e.status === 404){
      state.settings.majalah.hilang = true;
      suratState.majalah = false;
      save('majalah');
      render();
      toast('Majalah "' + (m.judul || 'Majalah') + '" sudah tidak ada di Worker — unggah ulang', true);
    }
  }
}

/* Pemilih edisi majalah — hanya muncul kalau ada lebih dari satu edisi.
   Dengan ini edisi Oktober bisa dikirim ke sebagian donor dan edisi November
   ke donor lain, tanpa perlu mengunggah ulang. */
function pemilihEdisiMajalah(){
  const daftar = daftarMajalah();
  if(daftar.length < 2) return '';
  const aktif = (state.settings.majalah || {}).id || '';
  return '<div class="field" style="margin:10px 0 0;max-width:420px">' +
    '<label>Edisi yang dilampirkan</label>' +
    '<select id="s-mj-edisi">' + daftar.map(function(e){
      return '<option value="' + esc(e.id) + '"' + (e.id === aktif ? ' selected' : '') + '>' +
        esc(e.judul) + ' · ' + e.halaman + ' hal' +
        (e.diunggah ? ' · ' + esc(fmtDate(e.diunggah)) : '') + '</option>';
    }).join('') + '</select>' +
    '<p class="tiny muted" style="margin:4px 0 0">' + daftar.length +
      ' edisi tersimpan. Edisi lama tetap bisa dipakai kapan saja.</p>' +
  '</div>';
}

function blokMajalah(){
  const m = majalahInfo();
  const on = !!suratState.majalah;
  const hilang = !!(m && m.hilang);
  const s = waSiapInfo();
  const siap = !!(m && s.siap && !hilang);
  /* Daftar apa yang masih kurang — sama seperti di form majalah, supaya user
     tidak menebak-nebak kenapa tombolnya tidak bisa dipakai. */
  const kurang = '<ul style="margin:8px 0 0;padding-left:20px">' +
    '<li>' + (s.adaEndpoint ? '✅' : '❌') + ' <b>Alamat Worker</b> — ' +
      (s.adaEndpoint ? esc(s.endpoint) : '<b>belum diisi</b>') + '</li>' +
    '<li>' + (s.adaKey ? '✅' : '❌') + ' <b>Kunci aplikasi</b> — ' +
      (s.adaKey ? 'terisi' : '<b>belum diisi</b>') + '</li>' +
    '</ul>';

  return '<div class="sep"></div>' +
    '<div class="row" style="justify-content:space-between">' +
      '<span class="small"><b>Lampirkan majalah</b> <span class="hint">— sampul + tautan baca di email</span></span>' +
      '<button class="btn sm' + (on ? ' primary' : '') + '" data-action="mj-toggle"' +
        (siap ? '' : ' disabled') + '>' + (on ? 'Aktif' : 'Mati') + '</button>' +
    '</div>' +
    (siap
      ? '<p class="tiny muted" style="margin:6px 0 0">' + esc(m.judul || 'Majalah') + ' · ' +
          m.halaman + ' halaman · disimpan sekali, dipakai untuk semua penerima.' +
          (m.diunggah ? ' · diunggah ' + esc(fmtDate(m.diunggah)) : '') + '</p>' +
        pemilihEdisiMajalah() +
        (on ? '<div class="mj-preview">' + majalahHTML() + '</div>' : '')
      : '<div class="warnbox" style="margin-top:8px">' +
        (hilang
          ? 'Majalah <b>' + esc(m.judul || 'Majalah') + '</b> sudah tidak ada di Worker — ' +
            'berkasnya terhapus atau tersimpan di tempat lain. <b>Unggah ulang</b> berkas PDF-nya ' +
            'supaya email tidak memuat gambar yang tidak bisa dibuka penerima.'
          : (s.siap
              ? 'Majalah belum disiapkan. Unggah berkas PDF majalah dulu lewat tombol di bawah — ' +
                'halamannya diubah jadi gambar otomatis.'
              : '<b>Majalah belum bisa disiapkan.</b> Lengkapi dulu di halaman ' +
                '<b>Setelan → Worker Cloudflare</b>:' + kurang +
                '<p style="margin:8px 0 0">Majalah disimpan di Worker supaya bisa tampil di email ' +
                'penerima.</p>')) +
        '</div>') +
    '<div class="btn-row" style="margin-top:10px">' +
      '<button class="btn sm' + (hilang ? ' primary' : '') + '" data-action="mj-kelola">' +
        (siap ? 'Kelola majalah' : 'Unggah majalah') + '</button>' +
      (siap ? '<button class="btn sm" data-action="mj-baca">👁 Buka halaman pembaca</button>' : '') +
      (siap ? '<button class="btn sm" data-action="mj-statistik">📊 Statistik pembaca</button>' : '') +
      (siap ? '<button class="btn sm ghost" data-action="mj-hapus">Hapus majalah</button>' : '') +
      (hilang ? '<button class="btn sm ghost" data-action="mj-lupakan">Lupakan catatan ini</button>' : '') +
      (!siap && !hilang && !s.siap
        ? '<button class="btn sm primary" data-action="mj-ke-setelan">⚙ Buka Setelan</button>' : '') +
    '</div>';
}

function bindSurat(){
  const tplSel = document.getElementById('s-tpl');
  if(tplSel) tplSel.addEventListener('change', function(){
    suratState.tplId = this.value;
    const t = state.templates.filter(function(x){ return x.id === suratState.tplId; })[0];
    if(t){ suratState.subjek = t.subjek; suratState.isi = t.isi; }
    render();
  });
  const subj = document.getElementById('s-subjek');
  if(subj) subj.addEventListener('input', function(){ suratState.subjek = this.value; });
  const cc = document.getElementById('s-cc');
  if(cc) cc.addEventListener('input', function(){ suratState.cc = this.value; });
  const mjEd = document.getElementById('s-mj-edisi');
  if(mjEd) mjEd.addEventListener('change', function(){
    if(pakaiEdisiMajalah(this.value)){
      toast('Edisi majalah diganti');
      render();
    }
  });
  const fileLamp = document.getElementById('s-lampiran-file');
  if(fileLamp) fileLamp.addEventListener('change', function(){
    const daftar = lampiranSurat();
    Array.prototype.forEach.call(this.files || [], function(f){
      if(f.size > 10 * 1024 * 1024){ toast(f.name + ' lebih dari 10 MB — dilewati', true); return; }
      daftar.push({
        id: 'lp-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
        nama: f.name, tipe: f.type, ukuran: f.size, naik: false, berkas: f
      });
    });
    this.value = '';
    render();
  });
  const isi = document.getElementById('s-isi');
  if(isi) isi.addEventListener('input', function(){
    suratState.isi = this.value;
    segarkanPratinjauIsi();
    refreshPreview();
  });
  segarkanPratinjauIsi();
  const kwFin = document.getElementById('s-kw-fin');
  if(kwFin) kwFin.addEventListener('change', function(){
    suratState.kwitansiFinId = this.value;
    refreshPreview();
  });
  const q = document.getElementById('s-q');
  if(q) q.addEventListener('input', function(){
    suratState.q = this.value;
    const pos = this.selectionStart;
    render();
    const el = document.getElementById('s-q');
    if(el){ el.focus(); el.setSelectionRange(pos,pos); }
  });
  /* Isian serba guna: diperbarui saat diketik supaya pratinjau langsung ikut
     berubah, tanpa render ulang seluruh halaman (kursor tidak melompat). */
  document.querySelectorAll('.isian').forEach(function(el){
    el.addEventListener('input', function(){
      const n = parseInt(this.getAttribute('data-isian'), 10);
      if(!(n >= 1 && n <= ISIAN_MAKS)) return;
      state.isian[n - 1] = this.value;
      refreshPreview();
    });
  });
}
function refreshPreview(){
  const card = document.getElementById('preview-card');
  if(!card) return;
  const ids = Object.keys(suratState.selected).filter(function(k){ return suratState.selected[k]; });
  const d = findDonor(suratState.previewId) || (ids.length ? findDonor(ids[0]) : null) || state.donors[0] || null;
  card.innerHTML = previewHTML(d);
}
function refreshRecipients(){
  const ids = Object.keys(suratState.selected).filter(function(k){ return suratState.selected[k]; });
  document.querySelectorAll('[data-recip]').forEach(function(cb){
    const on = !!suratState.selected[cb.getAttribute('data-recip')];
    cb.checked = on;
    const w = cb.closest('.recipient');
    if(w) w.classList.toggle('on', on);
  });
  const c = document.getElementById('sel-count');
  if(c) c.textContent = ids.length + ' dipilih';
  const kb = document.getElementById('kirim-btn');
  if(kb){
    kb.disabled = !ids.length;
    kb.textContent = (state.settings.wajibPeriksa ? '🔍 Periksa & Kirim (' : '➤ Kirim (') + ids.length + ')';
  }
  const db = document.getElementById('draft-btn');
  if(db) db.disabled = !ids.length;
}

/* ---------- KATEGORI ---------- */
function viewKategori(){
  setTitle('Kategori','Kelola kategori donor');
  return '<div class="card">' +
    '<div class="card-head"><h2>Daftar Kategori</h2>' +
      '<button class="btn sm primary" data-action="kat-baru">+ Tambah</button></div>' +
    '<div class="table-wrap"><table><thead><tr><th>Nama</th><th>Jumlah Donor</th><th></th></tr></thead><tbody>' +
    state.categories.map(function(c){
      const n = state.donors.filter(function(d){ return d.kategori === c; }).length;
      return '<tr><td><b>' + esc(c) + '</b></td><td class="mono">' + n + '</td>' +
        '<td class="right nowrap">' +
        '<button class="btn sm ghost" data-action="kat-ubah" data-kat="' + esc(c) + '">Ubah</button>' +
        '<button class="btn sm ghost" data-action="kat-hapus" data-kat="' + esc(c) + '">Hapus</button>' +
        '</td></tr>';
    }).join('') + '</tbody></table></div>' +
    '<p class="tiny muted" style="margin-top:10px">Menghapus kategori tidak menghapus donor — donornya menjadi “tanpa kategori”.</p>' +
  '</div>';
}

/* ---------- AKUN (admin) ---------- */
/* Satu halaman berisi dua hal: daftar akun (buat, matikan/hidupkan) dan
   catatan aktivitas — "CCTV" supaya kalau ada data yang berubah bisa
   ditelusuri siapa pelakunya. */
let akunState = { pengguna:[], aktivitas:[], muat:false, galat:'', bagian:'', aksi:'' };

function viewAkun(){
  setTitle('Akun','Pengguna aplikasi & catatan aktivitas');
  if(!Akun.admin()){
    return '<div class="empty">Halaman ini hanya untuk admin.</div>';
  }
  const list = akunState.pengguna;
  const semua = akunState.aktivitas;
  /* Penyaring sederhana: bagian (donor/keuangan/surat/…) dan jenis aksi.
     Tanpa ini, catatan aktivitas cepat menumpuk dan sulit dibaca. */
  const cctv = semua.filter(function(a){
    if(akunState.bagian && (a.bagian || '') !== akunState.bagian) return false;
    if(akunState.aksi && (a.aksi || '') !== akunState.aksi) return false;
    return true;
  });
  const daftarBagian = [];
  const daftarAksi = [];
  semua.forEach(function(a){
    if(a.bagian && daftarBagian.indexOf(a.bagian) < 0) daftarBagian.push(a.bagian);
    if(a.aksi && daftarAksi.indexOf(a.aksi) < 0) daftarAksi.push(a.aksi);
  });
  daftarBagian.sort(); daftarAksi.sort();

  const barisAkun = list.map(function(u){
    return '<tr>' +
      '<td><b>' + esc(u.nama) + '</b><br><span class="tiny muted mono">' + esc(u.email) + '</span><br>' +
        '<span class="chip' + (u.aktif ? '' : ' plain') + '">' + esc(Akun.labelPeran(u.peran)) +
        (u.aktif ? '' : ' · dimatikan') + '</span></td>' +
      '<td class="tiny muted">' + (u.masuk_terakhir ? fmtDateTime(u.masuk_terakhir) : 'belum pernah') + '</td>' +
      '<td class="right nowrap">' +
        '<button class="btn sm ' + (u.aktif ? 'ghost' : 'primary') + '" data-action="akun-set-aktif" ' +
          'data-email="' + esc(u.email) + '" data-aktif="' + (u.aktif ? '0' : '1') + '">' +
          (u.aktif ? 'Matikan' : 'Aktifkan') + '</button>' +
      '</td>' +
    '</tr>';
  }).join('');

  const barisCctv = cctv.map(function(a){
    return '<tr>' +
      '<td class="tiny muted nowrap">' + esc(a.waktu ? fmtDateTime(a.waktu) : '') + '</td>' +
      '<td><b>' + esc(a.nama || a.email) + '</b>' +
        (a.nama && a.email ? '<br><span class="tiny muted mono">' + esc(a.email) + '</span>' : '') + '</td>' +
      '<td><span class="chip plain">' + esc(a.aksi) + '</span> <span class="small">' + esc(a.bagian || '') + '</span></td>' +
      '<td class="small">' + esc(a.sasaran || '') +
        (a.ket ? '<br><span class="tiny muted">' + esc(a.ket) + '</span>' : '') + '</td>' +
    '</tr>';
  }).join('');

  return '<div class="card">' +
      '<div class="card-head"><h2>Akun pengguna</h2>' +
        '<span class="chip plain">' + list.length + ' akun</span></div>' +
      (akunState.galat ? '<div class="warnbox">' + esc(akunState.galat) + '</div>' : '') +
      '<p class="small muted">Akun dibuat di <b>halaman akun</b> — halaman terpisah, supaya pintu ' +
        'membuat akun tidak menempel di aplikasi sehari-hari. Halaman itu juga dipakai membuat ' +
        'akun pertama, yang otomatis menjadi admin.</p>' +
      '<div class="btn-row">' +
        '<button class="btn primary" data-action="akun-buka-daftar">⚿ Buka halaman buat akun</button>' +
        '<button class="btn" data-action="akun-muat">⟳ Muat ulang</button>' +
      '</div>' +
      '<p class="tiny muted" style="margin-top:8px">Alamat: <span class="mono">' +
        esc(Akun.alamatDaftar() || '—') + '</span></p>' +
      (list.length
        ? '<div class="sep"></div><div class="table-wrap"><table>' +
            '<thead><tr><th>Nama / email</th><th>Terakhir masuk</th><th></th></tr></thead>' +
            '<tbody>' + barisAkun + '</tbody></table></div>'
        : '<p class="small muted">Belum ada akun.</p>') +
    '</div>' +

    '<div class="card">' +
      '<div class="card-head"><h2>Catatan aktivitas</h2>' +
        '<span class="chip plain">' + cctv.length + ' dari ' + semua.length + ' kejadian</span></div>' +
      '<p class="small muted">Setiap masuk, keluar, tambah, ubah, dan hapus dicatat — supaya kalau ' +
        'ada data yang berubah, bisa dilihat siapa pelakunya dan kapan.</p>' +
      (semua.length
        ? '<div class="toolbar" style="margin-bottom:10px">' +
            '<select id="akun-f-bagian" class="grow">' +
              '<option value="">Semua bagian</option>' +
              daftarBagian.map(function(b){
                return '<option value="' + esc(b) + '"' + (akunState.bagian === b ? ' selected' : '') + '>' +
                  esc(b) + '</option>';
              }).join('') + '</select>' +
            '<select id="akun-f-aksi">' +
              '<option value="">Semua aksi</option>' +
              daftarAksi.map(function(x){
                return '<option value="' + esc(x) + '"' + (akunState.aksi === x ? ' selected' : '') + '>' +
                  esc(x) + '</option>';
              }).join('') + '</select>' +
            (akunState.bagian || akunState.aksi
              ? '<button class="btn sm ghost" data-action="akun-f-reset">Kosongkan</button>' : '') +
          '</div>' : '') +
      (cctv.length
        ? '<div class="table-wrap" style="max-height:520px;overflow:auto"><table>' +
            '<thead><tr><th>Waktu</th><th>Siapa</th><th>Aksi</th><th>Data</th></tr></thead>' +
            '<tbody>' + barisCctv + '</tbody></table></div>'
        : '<p class="small muted">' + (semua.length
            ? 'Tidak ada catatan yang cocok dengan penyaring ini.'
            : 'Belum ada catatan.') + '</p>') +
    '</div>';
}

function muatAkun(){
  if(!Akun.admin()) return;
  akunState.galat = '';
  Promise.all([Akun.daftarPengguna(), Akun.aktivitas(200)])
    .then(function(hasil){
      akunState.pengguna = hasil[0];
      akunState.aktivitas = hasil[1];
      if(currentPage === 'akun') render();
    })
    .catch(function(e){
      akunState.galat = e.message || String(e);
      if(currentPage === 'akun') render();
    });
}

/* Penyaring catatan aktivitas dipasang setelah halaman digambar — supaya
   memilih bagian/aksi tidak perlu memuat ulang data dari server. */
function bindAkun(){
  const fb = document.getElementById('akun-f-bagian');
  if(fb) fb.addEventListener('change', function(){ akunState.bagian = this.value; render(); });
  const fa = document.getElementById('akun-f-aksi');
  if(fa) fa.addEventListener('change', function(){ akunState.aksi = this.value; render(); });
}

/* ---------- KEUANGAN ---------- */
let finFilter = { q:'', program:'', uang:'', dari:'', sampai:'', kirim:'' };

function finList(){
  const q = finFilter.q.toLowerCase();
  return state.finance.filter(function(f){
    /* Transaksi lama tidak punya array `program` — hanya `mataUang` + `jumlah`.
       Tanpa cabang di bawah, transaksi seperti itu hilang dari daftar begitu
       filter program atau mata uang dipakai. */
    const baris = Array.isArray(f.program) ? f.program : [];
    if(finFilter.program && !baris.some(function(x){ return x.id === finFilter.program; })) return false;
    /* Filter mata uang mencocokkan baris program, bukan hanya label transaksi. */
    if(finFilter.uang && !Object.prototype.hasOwnProperty.call(totalPerUangTransaksi(f), finFilter.uang)) return false;
    if(finFilter.dari && String(f.tanggal || '') < finFilter.dari) return false;
    if(finFilter.sampai && String(f.tanggal || '') > finFilter.sampai) return false;
    /* Filter status kirim: memisahkan kwitansi yang sudah pernah dikirim dari
       yang belum, supaya tidak ada yang terlewat. */
    if(finFilter.kirim){
      const sudah = kirimanUntukFin(f.id).length > 0;
      if(finFilter.kirim === 'sudah' && !sudah) return false;
      if(finFilter.kirim === 'belum' && sudah) return false;
    }
    if(!q) return true;
    const d = findDonor(f.donorId);
    const teks = [f.donorId, f.kode, d ? donorName(d) : '', d ? d.kategori : '',
      baris.map(function(x){ return programNama(x.id); }).join(' '),
      f.catatan, f.mataUang,
      Object.keys(totalPerUangTransaksi(f)).join(' ')].join(' ').toLowerCase();
    return teks.indexOf(q) >= 0;
  }).sort(function(a,b){ return String(b.tanggal || '').localeCompare(String(a.tanggal || '')); });
}

function viewKeuangan(){
  setTitle('Keuangan','Catatan donor masuk per program');
  const list = finList();
  const total = totalPerUang(list);
  const kodeUang = Object.keys(total).sort();

  /* Total per program, dipisah per mata uang supaya tidak salah jumlah. */
  const perProgram = state.programs.map(function(p){
    const pakai = list.filter(function(f){
      return (f.program || []).some(function(x){ return x.id === p.id; });
    });
    return { p:p, n:pakai.length, total:totalPerUang(pakai.map(function(f){
      const baris = (f.program || []).filter(function(x){ return x.id === p.id; })[0];
      return { mataUang:mataUangBaris(baris, f), jumlah:nominalProgram(f, p.id) };
    })) };
  }).filter(function(x){ return x.n > 0; });

  const progOpts = '<option value="">Semua program</option>' + state.programs.map(function(p){
    return '<option value="' + esc(p.id) + '"' + (finFilter.program === p.id ? ' selected' : '') + '>' +
      esc(p.nama) + '</option>';
  }).join('');
  const uangOpts = '<option value="">Semua mata uang</option>' + KODE_UANG.map(function(k){
    return '<option value="' + esc(k) + '"' + (finFilter.uang === k ? ' selected' : '') + '>' + esc(k) + '</option>';
  }).join('');

  return '' +
  '<div class="card">' +
    '<div class="card-head"><h2>Ringkasan</h2>' +
      '<button class="btn sm primary" data-action="fin-baru">+ Tambah</button>' +
      '<button class="btn sm" data-action="riwayat-kirim">🕘 Riwayat kirim</button>' +
      '<button class="btn sm ghost" data-action="prg-kelola">Kelola program</button></div>' +
    (kodeUang.length
      ? '<div class="grid stats">' + kodeUang.map(function(k){
          return stat('Total ' + k, fmtUang(total[k], k),
            /* Dihitung dari totalPerUangTransaksi(), bukan dari `f.program`:
               transaksi lama tidak punya array program, jadi kalau dihitung
               dari situ jumlahnya kurang dari yang sebenarnya. */
            list.filter(function(f){
              return Object.prototype.hasOwnProperty.call(totalPerUangTransaksi(f), k);
            }).length + ' transaksi');
        }).join('') + '</div>'
      : '<p class="small muted">Belum ada transaksi. Klik <b>+ Tambah</b> untuk mencatat donor masuk.</p>') +
    (perProgram.length
      ? '<div class="sep"></div><div class="table-wrap"><table><thead><tr>' +
          '<th>Program</th><th class="right">Transaksi</th><th class="right">Total</th></tr></thead><tbody>' +
          perProgram.map(function(x){
            return '<tr><td><b>' + esc(x.p.nama) + '</b></td><td class="mono right">' + x.n + '</td>' +
              '<td class="mono right">' + Object.keys(x.total).sort().map(function(k){
                return esc(fmtUang(x.total[k], k));
              }).join('<br>') + '</td></tr>';
          }).join('') + '</tbody></table></div>'
      : '') +
  '</div>' +

  '<div class="card">' +
    '<div class="card-head"><h2>Transaksi</h2>' +
      '<span class="chip plain">' + list.length + ' baris</span></div>' +
    '<div class="toolbar" style="margin-bottom:10px">' +
      '<input type="search" class="grow" id="f-q" placeholder="Cari donor / program / catatan…" value="' + esc(finFilter.q) + '">' +
      '<select id="f-program">' + progOpts + '</select>' +
      '<select id="f-uang">' + uangOpts + '</select>' +
    '</div>' +
    '<div class="toolbar" style="margin-bottom:10px">' +
      '<label class="tiny muted">Dari <input type="date" id="f-dari" value="' + esc(finFilter.dari) + '"></label>' +
      '<label class="tiny muted">Sampai <input type="date" id="f-sampai" value="' + esc(finFilter.sampai) + '"></label>' +
      '<select id="f-kirim">' +
        '<option value="">Semua status kirim</option>' +
        '<option value="belum"' + (finFilter.kirim === 'belum' ? ' selected' : '') + '>Belum pernah dikirim</option>' +
        '<option value="sudah"' + (finFilter.kirim === 'sudah' ? ' selected' : '') + '>Sudah pernah dikirim</option>' +
      '</select>' +
      '<button class="btn sm ghost" data-action="fin-reset">Bersihkan filter</button>' +
    '</div>' +
    (list.length
      ? '<div class="table-wrap"><table><thead><tr>' +
          '<th>Kode</th><th>Tanggal</th><th>Donor</th><th>Kategori</th><th>Program</th>' +
          '<th class="right">Jumlah</th><th>Terakhir dikirim</th><th></th></tr></thead><tbody>' +
          list.map(function(f){
            const d = findDonor(f.donorId);
            /* Transaksi lama tidak punya array program — tampilkan "—" apa
               adanya, jangan mengarang nama program. */
            const prog = (Array.isArray(f.program) ? f.program : []).map(function(x){
              return '<div>' + esc(programNama(x.id)) +
                '<span class="mono muted"> · ' + esc(fmtUang(x.jumlah, mataUangBaris(x, f))) + '</span></div>';
            }).join('') || '<span class="muted">—</span>';
            const kirim = kirimanUntukFin(f.id);
            return '<tr>' +
              '<td class="mono nowrap"><b>' + esc(f.kode || '—') + '</b></td>' +
              '<td class="mono nowrap">' + esc(f.tanggal || '—') + '</td>' +
              '<td><b>' + esc(d ? donorName(d) : (f.donorId || '—')) + '</b>' +
                '<div class="tiny muted mono">' + esc(f.donorId || '') + '</div></td>' +
              '<td class="small">' + esc(d ? (d.kategori || '—') : '—') + '</td>' +
              '<td class="small">' + prog + '</td>' +
              '<td class="mono right nowrap"><b>' + totalTransaksiHTML(f) + '</b></td>' +
              '<td class="small nowrap">' + (kirim.length
                ? '<span class="chip ok">' + kirim.length + '×</span>' +
                  '<div class="tiny muted">' + esc(waktuKirim(kirim[kirim.length - 1].tanggal)) + '</div>'
                : '<span class="chip plain">belum</span>') + '</td>' +
              '<td class="right nowrap">' +
                '<button class="btn sm ghost" data-action="fin-ubah" data-id="' + esc(f.id) + '">Ubah</button>' +
                '<button class="btn sm ghost" data-action="fin-hapus" data-id="' + esc(f.id) + '">Hapus</button>' +
              '</td></tr>';
          }).join('') + '</tbody></table></div>'
      : '<div class="empty"><span class="big">◫</span>Belum ada transaksi yang cocok.</div>') +
  '</div>';
}

/* Surat keluar yang memuat kwitansi dari satu transaksi keuangan. Dipakai
   untuk menjawab "kwitansi ini sudah dikirim kapan saja?". */
function kirimanUntukFin(finId){
  if(!finId) return [];
  return state.messages.filter(function(m){
    return m.arah === 'keluar' && m.kwitansiFinId === finId;
  }).sort(function(a,b){ return String(a.tanggal).localeCompare(String(b.tanggal)); });
}

/* ---------- RIWAYAT KIRIM ----------
   Daftar semua kwitansi yang pernah dikirim, dikelompokkan per tanggal kirim.
   Gunanya: kalau ada donor yang mengaku belum menerima, atau ada angka yang
   salah, user bisa menelusuri kapan & apa yang dikirim tanpa membuka satu per
   satu buku donor. */
function openRiwayatKirim(){
  const keluar = state.messages.filter(function(m){
    return m.arah === 'keluar' && m.kwitansiHTML;
  }).sort(function(a,b){ return String(b.tanggal).localeCompare(String(a.tanggal)); });

  if(!keluar.length){
    openModal({
      title:'Riwayat kirim kwitansi',
      body:'<div class="empty"><span class="big">🕘</span>Belum ada kwitansi yang pernah dikirim.</div>',
      footer:'<button class="btn" data-close>Tutup</button>'
    });
    return;
  }

  /* Kelompokkan per hari kirim. */
  const perHari = {};
  keluar.forEach(function(m){
    const hari = String(m.tanggal || '').slice(0, 10);
    (perHari[hari] = perHari[hari] || []).push(m);
  });

  const body = Object.keys(perHari).sort().reverse().map(function(hari){
    const baris = perHari[hari];
    return '<div class="sep"></div>' +
      '<p class="small" style="margin:0 0 8px"><b>' + esc(fmtDate(hari)) + '</b> ' +
        '<span class="chip plain">' + baris.length + ' kiriman</span></p>' +
      '<div class="table-wrap"><table><thead><tr>' +
        '<th>Kode kiriman</th><th>Jam</th><th>Donor</th><th>Kode kwitansi</th>' +
        '<th class="right">Jumlah</th><th>Status</th><th></th></tr></thead><tbody>' +
        baris.map(function(m){
          const d = findDonor(m.donorId);
          const f = state.finance.filter(function(x){ return x.id === m.kwitansiFinId; })[0];
          const total = f ? totalTransaksiHTML(f) : '<span class="muted">—</span>';
          return '<tr>' +
            '<td class="mono nowrap"><b>' + esc(m.kodeKiriman || '—') + '</b></td>' +
            '<td class="mono nowrap">' + esc(waktuKirim(m.tanggal).replace(/^.*?(\d{2}[.:]\d{2}).*$/, '$1')) + '</td>' +
            '<td><b>' + esc(d ? donorName(d) : m.donorId) + '</b>' +
              '<div class="tiny muted mono">' + esc(m.donorId || '') + '</div></td>' +
            '<td class="mono nowrap">' + esc(f ? (f.kode || '—') : '—') + '</td>' +
            '<td class="mono right nowrap"><b>' + total + '</b></td>' +
            '<td class="small nowrap">' + esc(m.status || '') +
              (m.dibacaPenerima ? ' <span class="chip ok">✓✓ Dibaca</span>' : '') + '</td>' +
            '<td class="right nowrap">' +
              '<button class="btn sm ghost" data-action="buka-pesan" data-id="' + esc(m.id) + '">Lihat</button>' +
            '</td></tr>';
        }).join('') + '</tbody></table></div>';
  }).join('');

  openModal({
    title:'Riwayat kirim kwitansi',
    body:'<p class="small muted" style="margin:0 0 4px">Semua kwitansi yang pernah dikirim, ' +
        'diurutkan dari yang terbaru. Pakai <b>kode kiriman</b> untuk menelusuri satu pengiriman tertentu.</p>' +
      body,
    footer:'<button class="btn" data-close>Tutup</button>',
    wide:true
  });
}

/* ---------- PEMILIH DONOR (ketik nama, lompat abjad) ---------- */
/* Kolom Donor di form Keuangan. Bisa diketik langsung — daftar menyaring
   sambil mengetik, dan huruf pertama nama jadi penanda abjad supaya mata
   cepat menemukan nama yang dituju. */

/* Huruf pertama nama untuk pengelompokan abjad. Nama yang diawali angka atau
   tanda baca masuk ke grup '#'. */
function abjadDari(nama){
  const c = String(nama || '').trim().charAt(0).toUpperCase();
  return /[A-Z]/.test(c) ? c : '#';
}

/* Daftar donor diurutkan per abjad nama, lalu dikelompokkan. */
function donorPerAbjad(q){
  const kata = String(q || '').trim().toLowerCase();
  const list = state.donors.filter(function(d){
    if(!kata) return true;
    return [d.id, d.pic, d.namaLengkap, d.instansi, donorName(d)]
      .join(' ').toLowerCase().indexOf(kata) >= 0;
  }).sort(function(a, b){
    return donorName(a).localeCompare(donorName(b), 'id', { sensitivity:'base' });
  });

  const grup = [];
  list.forEach(function(d){
    const huruf = abjadDari(donorName(d));
    const akhir = grup[grup.length - 1];
    if(akhir && akhir.huruf === huruf) akhir.items.push(d);
    else grup.push({ huruf: huruf, items: [d] });
  });
  return grup;
}

/* Baris daftar donor: ID di depan, nama di belakang — sama seperti yang
   diminta: "ID -- nama". */
function donorOpsiHTML(d, terpilih){
  return '<button type="button" class="dp-item' + (terpilih ? ' on' : '') + '" ' +
      'data-dp-pilih="' + esc(d.id) + '" role="option" aria-selected="' + (terpilih ? 'true' : 'false') + '">' +
      '<span class="dp-id mono">' + esc(d.id) + '</span>' +
      '<span class="dp-nama">' + esc(donorName(d)) + '</span>' +
      (d.kategori ? '<span class="dp-kat">' + esc(d.kategori) + '</span>' : '') +
    '</button>';
}

function donorPickerHTML(donorId){
  const d = donorId ? findDonor(donorId) : null;
  const grup = donorPerAbjad('');
  const adaAbjad = grup.filter(function(g){ return g.huruf !== '#'; }).map(function(g){ return g.huruf; });

  return '<div class="dp" id="dp">' +
    '<div class="dp-kotak">' +
      '<input type="text" id="dp-cari" class="dp-cari" autocomplete="off" ' +
        'placeholder="Ketik nama atau ID donor…" value="' + esc(d ? donorName(d) : '') + '" ' +
        'role="combobox" aria-expanded="false" aria-controls="dp-daftar">' +
      '<button type="button" class="dp-buka" data-dp-buka title="Lihat semua donor">▾</button>' +
    '</div>' +
    '<input type="hidden" id="k-donor-id" value="' + esc(donorId || '') + '">' +
    '<div class="dp-panel" id="dp-panel" hidden>' +
      '<div class="dp-abjad" id="dp-abjad">' +
        adaAbjad.map(function(h){
          return '<button type="button" class="dp-huruf" data-dp-huruf="' + esc(h) + '">' + esc(h) + '</button>';
        }).join('') +
      '</div>' +
      '<div class="dp-daftar" id="dp-daftar" role="listbox">' +
        grup.map(function(g){
          return '<div class="dp-grup" data-dp-grup="' + esc(g.huruf) + '">' +
            '<div class="dp-judul">' + esc(g.huruf) + '</div>' +
            g.items.map(function(x){ return donorOpsiHTML(x, donorId === x.id); }).join('') +
          '</div>';
        }).join('') +
      '</div>' +
      '<div class="dp-kosong" id="dp-kosong" hidden>Tidak ada donor yang cocok.</div>' +
    '</div>' +
  '</div>';
}

/* Pasang perilaku pemilih donor: menyaring, lompat abjad, pilih, tutup. */
function bindDonorPicker(root){
  const dp = root.querySelector('#dp');
  if(!dp) return;
  const cari = dp.querySelector('#dp-cari');
  const panel = dp.querySelector('#dp-panel');
  const daftar = dp.querySelector('#dp-daftar');
  const kosong = dp.querySelector('#dp-kosong');
  const hidden = dp.querySelector('#k-donor-id');
  const abjadBar = dp.querySelector('#dp-abjad');

  const buka = function(ya){
    panel.hidden = !ya;
    cari.setAttribute('aria-expanded', ya ? 'true' : 'false');
    dp.classList.toggle('terbuka', ya);
  };

  /* Gambar ulang daftar sesuai kata kunci. */
  const saring = function(kata){
    const grup = donorPerAbjad(kata);
    daftar.innerHTML = grup.map(function(g){
      return '<div class="dp-grup" data-dp-grup="' + esc(g.huruf) + '">' +
        '<div class="dp-judul">' + esc(g.huruf) + '</div>' +
        g.items.map(function(x){ return donorOpsiHTML(x, hidden.value === x.id); }).join('') +
      '</div>';
    }).join('');
    kosong.hidden = grup.length > 0;
    /* Huruf yang tidak punya hasil disembunyikan supaya tidak menyesatkan. */
    const ada = {};
    grup.forEach(function(g){ ada[g.huruf] = true; });
    abjadBar.querySelectorAll('[data-dp-huruf]').forEach(function(b){
      b.classList.toggle('mati', !ada[b.getAttribute('data-dp-huruf')]);
    });
  };

  /* Pilih donor: isi kotak, simpan ID, kabari form. */
  const pilih = function(id){
    const d = findDonor(id);
    if(!d) return;
    hidden.value = d.id;
    cari.value = donorName(d);
    daftar.querySelectorAll('.dp-item').forEach(function(b){
      const on = b.getAttribute('data-dp-pilih') === d.id;
      b.classList.toggle('on', on);
      b.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    buka(false);
    dp.dispatchEvent(new CustomEvent('donor-pilih', { detail: d, bubbles: true }));
  };

  cari.addEventListener('focus', function(){ buka(true); });
  /* Klik juga membuka panel — sebagian browser tidak mengirim event `focus`
     saat halaman belum aktif, jadi klik dijadikan pemicu utama. */
  cari.addEventListener('click', function(){ buka(true); });
  cari.addEventListener('input', function(){
    hidden.value = '';
    buka(true);
    saring(this.value);
    /* Kalau tinggal satu hasil, langsung dipakai — hemat satu klik. */
    const sisa = daftar.querySelectorAll('.dp-item');
    if(sisa.length === 1) pilih(sisa[0].getAttribute('data-dp-pilih'));
  });
  cari.addEventListener('keydown', function(e){
    if(e.key === 'Escape'){ buka(false); cari.blur(); return; }
    if(e.key === 'Enter'){
      e.preventDefault();
      const pertama = daftar.querySelector('.dp-item');
      if(pertama) pilih(pertama.getAttribute('data-dp-pilih'));
    }
  });

  dp.querySelector('[data-dp-buka]').addEventListener('click', function(){
    if(panel.hidden){ saring(''); cari.focus(); buka(true); }
    else buka(false);
  });

  /* Klik huruf → lompat ke grup abjad itu. */
  abjadBar.addEventListener('click', function(e){
    const b = e.target.closest('[data-dp-huruf]');
    if(!b || b.classList.contains('mati')) return;
    const g = daftar.querySelector('[data-dp-grup="' + b.getAttribute('data-dp-huruf') + '"]');
    if(g) g.scrollIntoView({ block:'start' });
    abjadBar.querySelectorAll('.dp-huruf').forEach(function(x){ x.classList.remove('aktif'); });
    b.classList.add('aktif');
  });

  daftar.addEventListener('click', function(e){
    const b = e.target.closest('[data-dp-pilih]');
    if(b) pilih(b.getAttribute('data-dp-pilih'));
  });

  /* Klik di luar menutup panel. */
  const luar = function(e){ if(!dp.contains(e.target)) buka(false); };
  document.addEventListener('mousedown', luar);
  /* Modal ditutup → lepaskan pendengar supaya tidak menumpuk. */
  dp.addEventListener('donor-pilih', function(){ /* penanda untuk uji */ });

  return { tutup: function(){ document.removeEventListener('mousedown', luar); } };
}

/* Form transaksi. Nama & kategori donor hanya tampil (read-only) — diambil
   dari data donor supaya tidak ada dua sumber kebenaran. */
function openFinForm(id){
  const f = id ? state.finance.filter(function(x){ return x.id === id; })[0] : null;
  if(id && !f){ toast('Transaksi tidak ditemukan', true); return; }
  const isNew = !f;
  const barisProgram = (f && f.program && f.program.length ? f.program : [{ id:'', jumlah:'', mataUang:'' }]);
  const uangAwal = (f && f.mataUang) || 'IDR';

  const body =
    '<div class="form-grid">' +
      '<div class="field"><label>Donor <span class="hint">— ketik nama, atau klik huruf untuk lompat</span></label>' +
        donorPickerHTML(f ? f.donorId : '') + '</div>' +
      '<div class="field"><label>Tanggal donor</label>' +
        '<input type="date" id="k-tanggal" value="' + esc(f ? (f.tanggal || '') : new Date().toISOString().slice(0,10)) + '"></div>' +
    '</div>' +
    '<div class="form-grid">' +
      '<div class="field"><label>Nama <span class="hint">— otomatis dari donor</span></label>' +
        '<input type="text" id="k-nama" class="mono" readonly value=""></div>' +
      '<div class="field"><label>Kategori <span class="hint">— otomatis dari donor</span></label>' +
        '<input type="text" id="k-kategori" class="mono" readonly value=""></div>' +
    '</div>' +
    '<div class="field"><label>Dukung untuk program <span class="hint">— satu donor boleh beberapa program, tiap baris punya mata uang sendiri</span></label>' +
      '<div id="k-program">' + barisProgram.map(function(x){ return barisProgramHTML(x, uangAwal); }).join('') + '</div>' +
      '<button type="button" class="btn sm" data-action="fin-baris-tambah" style="margin-top:8px">+ Tambah program</button>' +
      '<p class="tiny muted" style="margin:8px 0 0">Isi nominal <b>per program</b>. Total dihitung otomatis per mata uang.</p>' +
      '<p class="small" style="margin:6px 0 0">Total: <b class="mono" id="k-total">—</b></p></div>' +
    '<div class="field"><label>Catatan</label>' +
      '<input type="text" id="k-catatan" value="' + esc(f ? (f.catatan || '') : '') + '" placeholder="opsional"></div>';

  openModal({
    title: isNew ? 'Tambah Transaksi Keuangan' : 'Ubah Transaksi Keuangan',
    body: body,
    wide: true,
    footer: '<button class="btn primary" data-action="fin-simpan" data-id="' + esc(id || '') + '">Simpan</button>' +
            '<button class="btn" data-close>Batal</button>',
    onOpen: function(root){
      const isiDonor = function(d){
        document.getElementById('k-nama').value = d ? donorName(d) : '';
        document.getElementById('k-kategori').value = d ? (d.kategori || '') : '';
      };
      /* Pemilih donor mengabari lewat event supaya Nama & Kategori ikut
         terisi begitu donor dipilih. */
      root.addEventListener('donor-pilih', function(e){ isiDonor(e.detail); });
      isiDonor(findDonor((document.getElementById('k-donor-id') || {}).value));
      bindDonorPicker(root);
      bindFinForm(root);
    }
  });
}

function barisProgramHTML(x, mataUangTransaksi){
  const opts = '<option value="">— pilih program —</option>' + state.programs.map(function(p){
    return '<option value="' + esc(p.id) + '"' + (x && x.id === p.id ? ' selected' : '') + '>' +
      esc(p.nama) + (p.aktif === false ? ' (nonaktif)' : '') + '</option>';
  }).join('');
  const uang = (x && x.mataUang) || mataUangTransaksi || 'IDR';
  const uangOpts = KODE_UANG.map(function(k){
    return '<option value="' + esc(k) + '"' + (uang === k ? ' selected' : '') + '>' + esc(k) + '</option>';
  }).join('');
  /* Satu baris: program · mata uang · jumlah. Mata uang per baris supaya satu
     transaksi boleh memuat program dengan mata uang berbeda. */
  return '<div class="row fin-baris" style="gap:8px;margin-bottom:6px;flex-wrap:nowrap">' +
    '<select class="grow k-prog">' + opts + '</select>' +
    '<select class="k-uang-baris" style="width:96px" title="Mata uang baris ini">' + uangOpts + '</select>' +
    '<input type="number" class="k-jml mono" style="width:150px" min="0" step="any" placeholder="Jumlah" value="' +
      esc(x && x.jumlah !== undefined && x.jumlah !== '' ? x.jumlah : '') + '">' +
    '<button type="button" class="btn sm ghost" data-action="fin-baris-hapus" title="Hapus baris">×</button>' +
  '</div>';
}

function bindFinForm(root){
  /* Total ditampilkan per mata uang — tidak digabung lintas mata uang. */
  const hitung = function(){
    const map = {};
    root.querySelectorAll('.fin-baris').forEach(function(b){
      const k = (b.querySelector('.k-uang-baris') || {}).value || 'IDR';
      const jml = Number((b.querySelector('.k-jml') || {}).value) || 0;
      map[k] = (map[k] || 0) + jml;
    });
    const kode = Object.keys(map).sort();
    const el = document.getElementById('k-total');
    if(el){
      el.innerHTML = kode.length
        ? kode.map(function(k){ return esc(fmtUang(map[k], k)); }).join(' + ')
        : esc(fmtUang(0, 'IDR'));
    }
  };
  root.querySelectorAll('.k-jml').forEach(function(i){ i.addEventListener('input', hitung); });
  root.querySelectorAll('.k-uang-baris').forEach(function(s){ s.addEventListener('change', hitung); });
  hitung();
}

function simpanFinForm(id){
  const donorId = (document.getElementById('k-donor-id') || {}).value || '';
  const tanggal = (document.getElementById('k-tanggal') || {}).value || '';
  const catatan = (document.getElementById('k-catatan') || {}).value || '';
  if(!donorId){ toast('Pilih donor dulu', true); return; }
  if(!tanggal){ toast('Tanggal donor belum diisi', true); return; }

  const program = [];
  const root = document.getElementById('modal-root');
  root.querySelectorAll('.fin-baris').forEach(function(b){
    const pid = (b.querySelector('.k-prog') || {}).value || '';
    const uang = (b.querySelector('.k-uang-baris') || {}).value || 'IDR';
    const jml = Number((b.querySelector('.k-jml') || {}).value) || 0;
    if(pid) program.push({ id:pid, jumlah:jml, mataUang:uang });
  });
  if(!program.length){ toast('Pilih minimal satu program', true); return; }
  const dobel = program.map(function(x){ return x.id; }).filter(function(v,i,a){ return a.indexOf(v) !== i; });
  if(dobel.length){ toast('Program yang sama dipilih dua kali', true); return; }
  if(program.some(function(x){ return !x.jumlah; })){ toast('Jumlah tiap program belum diisi', true); return; }

  /* `mataUang` di tingkat transaksi disimpan sebagai ringkasan (mata uang
     baris pertama) supaya data lama & ekspor tetap punya satu nilai. */
  const mataUang = program[0].mataUang || 'IDR';

  if(id){
    const f = state.finance.filter(function(x){ return x.id === id; })[0];
    if(!f){ toast('Transaksi tidak ditemukan', true); return; }
    f.donorId = donorId; f.tanggal = tanggal; f.mataUang = mataUang;
    f.program = program; f.catatan = catatan;
      catatAksi('ubah', 'keuangan', f.kode || id,
        (findDonor(donorId) ? donorName(findDonor(donorId)) : donorId) + ' · ' + tanggal);
    toast('Transaksi diperbarui');
  }else{
      const baru = {
      id:uid('fin'), donorId:donorId, tanggal:tanggal, mataUang:mataUang,
      program:program, catatan:catatan, createdAt:new Date().toISOString()
      };
      state.finance.push(baru);
      /* Beri kode kwitansi sekarang juga. Tanpa ini, kwitansi yang dikirim
         tepat setelah transaksi dicatat tercetak "KWT-20261113-????" —
         lengkapiKodeKwitansi() hanya berjalan saat aplikasi dibuka. */
      lengkapiKodeKwitansi();
      catatAksi('tambah', 'keuangan', baru.kode || baru.id,
        (findDonor(donorId) ? donorName(findDonor(donorId)) : donorId) + ' · ' + tanggal);
    toast('Transaksi ditambahkan');
  }
  save('finance');
  closeModal();
  render();
}

function hapusFin(id){
  const f = state.finance.filter(function(x){ return x.id === id; })[0];
  if(!f) return;
  const d = findDonor(f.donorId);
  if(!confirm('Hapus transaksi ' + (d ? donorName(d) : f.donorId) + ' tanggal ' + f.tanggal + '?')) return;
  state.finance = state.finance.filter(function(x){ return x.id !== id; });
  save('finance');
    catatAksi('hapus', 'keuangan', f.kode || id,
      (d ? donorName(d) : f.donorId) + ' · ' + (f.tanggal || ''));
  toast('Transaksi dihapus');
  render();
}

/* ---------- Master Program ---------- */
function openPrgKelola(){
  const body = (state.programs.length
    ? '<div class="stack">' + state.programs.map(function(p){
        const n = state.finance.filter(function(f){
          return (f.program || []).some(function(x){ return x.id === p.id; });
        }).length;
        return '<div class="card" style="padding:12px">' +
          '<div class="row"><b style="flex:1">' + esc(p.nama) + '</b>' +
            '<span class="chip plain mono">' + esc(p.id) + '</span>' +
            '<button class="btn sm ghost" data-action="prg-ubah" data-id="' + esc(p.id) + '">Ubah</button>' +
            '<button class="btn sm ghost" data-action="prg-hapus" data-id="' + esc(p.id) + '">Hapus</button></div>' +
          '<div class="tiny muted" style="margin-top:4px">' + n + ' transaksi' +
            (p.aktif === false ? ' · <b>nonaktif</b>' : '') + '</div></div>';
      }).join('') + '</div>'
    : '<div class="empty"><span class="big">◫</span>Belum ada program.</div>');
  openModal({
    title:'Program Dukungan',
    body:body,
    footer:'<button class="btn primary" data-action="prg-baru">+ Tambah</button>' +
           '<button class="btn" data-close>Tutup</button>'
  });
}

function openPrgForm(id){
  const p = id ? programById(id) : null;
  if(id && !p){ toast('Program tidak ditemukan', true); return; }
  const isNew = !p;
  const body =
    '<div class="field"><label>Nama program</label>' +
      '<input type="text" id="p-nama" value="' + esc(isNew ? '' : p.nama) + '" placeholder="Contoh: Beasiswa Anak Pelayan"></div>' +
    '<div class="field"><label>Status</label>' +
      '<select id="p-aktif">' +
        '<option value="1"' + (!isNew && p.aktif === false ? '' : ' selected') + '>Aktif — bisa dipilih di transaksi</option>' +
        '<option value="0"' + (!isNew && p.aktif === false ? ' selected' : '') + '>Nonaktif — tidak muncul di pilihan baru</option>' +
      '</select></div>';
  openModal({
    title: isNew ? 'Tambah Program' : 'Ubah Program',
    body: body,
    footer: '<button class="btn primary" data-action="prg-form-simpan" data-id="' + esc(id || '') + '">Simpan</button>' +
            '<button class="btn" data-action="prg-kelola">Batal</button>'
  });
}

function simpanPrgForm(id){
  const nama = ((document.getElementById('p-nama') || {}).value || '').trim();
  const aktif = ((document.getElementById('p-aktif') || {}).value || '1') === '1';
  if(!nama){ toast('Nama program belum diisi', true); return; }
  const kembar = state.programs.filter(function(p){
    return p.nama.toLowerCase() === nama.toLowerCase() && p.id !== id;
  });
  if(kembar.length){ toast('Program dengan nama itu sudah ada', true); return; }

  if(id){
    const p = programById(id);
    if(!p){ toast('Program tidak ditemukan', true); return; }
    p.nama = nama; p.aktif = aktif;
    toast('Program "' + nama + '" diperbarui');
  }else{
    /* Nomor urut berikutnya dari id yang sudah ada, supaya tidak bentrok. */
    let n = 1;
    const dipakai = {};
    state.programs.forEach(function(p){ dipakai[p.id] = true; });
    while(dipakai['PRG-' + String(n).padStart(2,'0')]) n++;
    state.programs.push({ id:'PRG-' + String(n).padStart(2,'0'), nama:nama, aktif:aktif });
    toast('Program "' + nama + '" ditambahkan');
  }
  save('programs');
  openPrgKelola();
  render();
}

function hapusPrg(id){
  const p = programById(id);
  if(!p) return;
  const n = state.finance.filter(function(f){
    return (f.program || []).some(function(x){ return x.id === id; });
  }).length;
  if(n){
    toast('Program ini dipakai di ' + n + ' transaksi — nonaktifkan saja', true);
    return;
  }
  if(!confirm('Hapus program "' + p.nama + '"?')) return;
  state.programs = state.programs.filter(function(x){ return x.id !== id; });
  save('programs');
  toast('Program dihapus');
  openPrgKelola();
  render();
}

/* ---------- PENGATURAN ---------- */
function viewPengaturan(){
  setTitle('Setelan','Gmail, Worker Cloudflare, data, dan tampilan');
  const st = Gmail.status();
  const bytes = new Blob([JSON.stringify(state)]).size;
  const label = { unconfigured:'Belum diatur', disconnected:'Siap dihubungkan', connected:'Terhubung' }[st];
  const wst = WhatsApp.status();
  const wlabel = { unconfigured:'Belum diatur', disconnected:'Belum tersambung', connected:'Tersambung' }[wst];
  /* Alamat Worker punya nilai bawaan, jadi hampir selalu terisi. Yang sering
     kosong adalah kuncinya — itu yang membuat majalah & tanda dibaca gagal. */
  const adaAlamat = !!workerBase();
  const adaKunci = !!String(WhatsApp.appKey || '');
  const waPending = state.messages.filter(function(m){
    return m.arah === 'masuk' && m.kanal === 'whatsapp' && !m.donorId;
  }).length;

  return '' +
  '<div class="card">' +
    '<div class="card-head"><h2>Gmail</h2>' +
      '<span class="chip' + (st === 'connected' ? '' : ' plain') + '">' + label + '</span></div>' +
    (Gmail.isSecureOrigin() ? '' :
      '<div class="warnbox">Google menolak origin <b class="mono">' + esc(Gmail.origin()) +
      '</b>. Buka aplikasi lewat <b class="mono">https://</b> (GitHub Pages) atau ' +
      '<b class="mono">http://localhost:8080</b> (jalankan <b class="mono">serve.bat</b>).</div>') +
    '<div class="field"><label>OAuth Client ID <span class="hint">— dari Google Cloud Console</span></label>' +
      '<input type="text" id="g-client" class="mono" placeholder="xxxxxxxx.apps.googleusercontent.com" value="' +
        esc(state.settings.gmailClientId) + '"></div>' +
    '<p class="tiny muted">Client ID yang <b>benar-benar dipakai</b> saat ini:<br>' +
      '<b class="mono">' + esc(Gmail.clientId || '(kosong)') + '</b></p>' +
    (Gmail.clientId && Gmail.clientId !== DEFAULT_CLIENT_ID ?
      '<div class="warnbox">Client ID ini <b>bukan</b> milik project Kartidaya. ' +
      'Ini penyebab <b>access_denied</b>. Klik <b>Pakai Client ID bawaan</b> di bawah.</div>' : '') +
    '<p class="tiny muted">Daftarkan origin ini di Google Cloud Console → Credentials → ' +
      'Authorized JavaScript origins:<br><b class="mono">' + esc(Gmail.origin()) + '</b></p>' +
    '<div class="btn-row" style="margin:-6px 0 10px">' +
      '<button class="btn sm" data-action="g-copy-origin">Salin origin</button>' +
      '<a class="btn sm primary" target="_blank" rel="noopener" href="' +
        'https://console.cloud.google.com/auth/clients?project=' +
        esc(projectNumber(state.settings.gmailClientId)) + '">Buka Clients project ini ↗</a>' +
    '</div>' +
    '<div class="warnbox">' +
      '<b>Kalau muncul “Error 400: origin_mismatch”</b><br>' +
      'Origin <b class="mono">' + esc(Gmail.origin()) + '</b> belum terdaftar di project ' +
      '<b class="mono">' + esc(projectNumber(state.settings.gmailClientId) || '—') + '</b>. ' +
      'Buka <b>Clients</b> → klik Client ID → <b>Authorized JavaScript origins</b> → ' +
      '<b>Add URI</b> → tempel origin di atas → <b>Save</b>. ' +
      'Perubahan berlaku ±1 menit.' +
      '<div class="btn-row" style="margin-top:10px">' +
        '<button class="btn sm" data-action="g-copy-origin">Salin origin</button>' +
      '</div>' +
      '<p class="tiny" style="margin:8px 0 0">Origin harus <b>sama persis</b> — termasuk ' +
      '<b class="mono">http</b>/<b class="mono">https</b>, nama host, dan nomor port. ' +
      '<b class="mono">http://localhost:8080</b> dan <b class="mono">https://suwandhih.github.io</b> ' +
      'adalah dua origin berbeda; daftarkan keduanya kalau keduanya dipakai.</p>' +
    '</div>' +
    (projectNumber(state.settings.gmailClientId) ?
      '<div class="warnbox">' +
        '<b>Kalau muncul “Access blocked / Error 403: access_denied”</b><br>' +
        'Client ID ini milik <b>project nomor ' + esc(projectNumber(state.settings.gmailClientId)) + '</b>. ' +
        'Buka <b>project itu</b> di Google Cloud Console — bukan project lain — lalu ' +
        '<b>Audience → Test users → Add users</b> → masukkan <b class="mono">fotohotono03@gmail.com</b> → <b>Save</b>.' +
        '<div class="btn-row" style="margin-top:10px">' +
          '<a class="btn sm primary" target="_blank" rel="noopener" href="' +
            'https://console.cloud.google.com/auth/audience?project=' +
            esc(projectNumber(state.settings.gmailClientId)) + '">Buka Test users project ini ↗</a>' +
          '<button class="btn sm" data-action="g-copy-cid">Salin Client ID</button>' +
          '<button class="btn sm" data-action="g-copy-prefix">Salin nomor project</button>' +
        '</div>' +
        '<p class="tiny" style="margin:8px 0 0">Cara memastikan project yang benar: di halaman ' +
        '<b>Credentials</b>, Client ID yang sama harus terlihat di daftar. Kalau tidak ada, ' +
        'Anda sedang membuka project yang salah.</p>' +
      '</div>' : '') +
    '<div class="btn-row">' +
      '<button class="btn primary" data-action="g-save">Simpan Client ID</button>' +
      '<button class="btn" data-action="g-default">Pakai Client ID bawaan</button>' +
      '<button class="btn" data-action="g-connect">' + (st === 'connected' ? 'Hubungkan ulang' : 'Hubungkan Gmail') + '</button>' +
      '<button class="btn" data-action="sync">⟳ Sinkron sekarang</button>' +
      '<button class="btn danger" data-action="g-disconnect">Putuskan</button>' +
    '</div>' +
    (Gmail.email ? '<p class="small muted" style="margin-top:10px">Akun: <b class="mono">' + esc(Gmail.email) + '</b></p>' : '') +
    (st === 'connected'
      ? '<p class="tiny muted" style="margin-top:6px">Sesi diperbarui otomatis di latar belakang. ' +
        'Sisa waktu token: <b class="mono" id="g-sisa">' + sisaWaktu(Gmail.msLeft()) + '</b></p>'
      : '') +
    '<div class="sep"></div>' +
    '<div class="row" style="justify-content:space-between">' +
      '<span class="small">Sinkron otomatis</span>' +
      '<button class="btn sm' + (state.settings.autoSync ? ' primary' : '') + '" data-action="auto-sync-toggle">' +
        (state.settings.autoSync ? 'Aktif' : 'Mati') + '</button></div>' +
    '<p class="tiny muted">Surat masuk ditarik sendiri saat aplikasi dibuka, saat tab kembali aktif, ' +
      'dan berkala — jadi tidak perlu membuka Setelan untuk menekan Sinkron.</p>' +
    (state.settings.autoSync ?
      '<div class="field" style="margin-top:10px"><label>Jarak antar sinkron otomatis ' +
        '<span class="hint">— menit</span></label>' +
        '<input type="number" id="set-syncmin" min="1" max="240" value="' +
          esc(state.settings.syncMinutes) + '"></div>' +
      '<button class="btn sm" data-action="sync-min-save">Simpan jarak</button>' +
      '<p class="tiny muted" style="margin-top:8px">Terakhir sinkron: <b class="mono">' +
        (state.settings.lastSync ? fmtDateTime(state.settings.lastSync) : 'belum pernah') + '</b></p>'
      : '') +
    '<div class="sep"></div>' +
    '<p class="small muted">Panduan lengkap: <b class="mono">PANDUAN-GMAIL.md</b></p>' +
  '</div>' +

  '<div class="card">' +
    '<div class="card-head"><h2>Worker Cloudflare</h2>' +
      '<span class="chip' + (wst === 'connected' ? '' : ' plain') + '">' + wlabel + '</span></div>' +
    '<p class="small muted">Bagian ini bukan untuk WhatsApp saja. Worker ini dipakai untuk <b>tiga hal</b>:</p>' +
    '<ul class="small muted" style="margin:6px 0 10px;padding-left:20px">' +
      '<li><b>Majalah di email</b> — halaman majalah disimpan di sini supaya bisa tampil ' +
        'di email penerima. <b>Sudah dipakai sekarang.</b></li>' +
      '<li><b>Tanda dibaca &amp; konfirmasi</b> — mencatat kapan email dibuka dan kapan ' +
        'donor menekan tombol konfirmasi. <b>Sudah dipakai sekarang.</b></li>' +
      '<li><b>Kirim WhatsApp</b> — <b>ditunda</b> sampai nomor resmi Kartidaya tersedia. ' +
        'Pengiriman tidak boleh memakai akun Facebook pribadi.</li>' +
    '</ul>' +
    '<p class="small muted">Jadi <b>dua kolom di bawah tetap harus diisi</b> walaupun WhatsApp ' +
      'sedang ditunda — kalau kosong, majalah dan tanda dibaca tidak jalan.</p>' +
    '<div class="field"><label>Alamat Worker <span class="hint">— ' +
      (adaAlamat ? 'sudah terisi, jangan diubah' : 'belum diisi') + '</span></label>' +
      '<input type="text" id="w-endpoint" class="mono" placeholder="' + DEFAULT_WORKER + '" value="' +
        esc(WhatsApp.endpoint || state.settings.waEndpoint || '') + '"></div>' +
    '<div class="field"><label>Kunci aplikasi <span class="hint">— kata sandi rahasia, minta ke pembuat aplikasi</span></label>' +
      '<input type="password" id="w-key" class="mono" placeholder="tempel kunci rahasia di sini" value="' +
        esc(WhatsApp.appKey || '') + '"></div>' +
    '<p class="tiny muted">Kedua isian ini disimpan di browser ini saja, jadi tidak perlu diisi ulang ' +
      'setiap membuka aplikasi. Kunci tidak ikut ter-ekspor ke berkas cadangan.</p>' +
    '<div class="btn-row">' +
      '<button class="btn primary" data-action="w-save">Simpan &amp; uji sambungan</button>' +
      (WA_DITUNDA ? '' : '<button class="btn" data-action="wa-sync">⟳ Sinkron WhatsApp</button>') +
      (WA_DITUNDA ? '' : '<button class="btn" data-action="wa-cocokkan">⇄ Cocokkan ulang</button>') +
      (adaKunci ? '<button class="btn danger" data-action="w-disconnect">Hapus kunci</button>' : '') +
    '</div>' +
    (WhatsApp.phone ? '<p class="small muted" style="margin-top:10px">Nomor WhatsApp Business: <b class="mono">' +
      esc(WhatsApp.phone) + '</b></p>' : '') +
    (waPending && !WA_DITUNDA ? '<div class="warnbox">' + waPending + ' pesan WhatsApp belum terhubung ke donor. ' +
      'Isi nomor HP donor (HP 1 / HP 2) lalu klik <b>Cocokkan ulang</b>.</div>' : '') +
    (WA_DITUNDA ? '' :
    '<div class="sep"></div>' +
    '<div class="row" style="justify-content:space-between">' +
      '<span class="small">Sinkron WhatsApp otomatis</span>' +
      '<button class="btn sm' + (state.settings.waAutoSync ? ' primary' : '') + '" data-action="wa-auto-toggle">' +
        (state.settings.waAutoSync ? 'Aktif' : 'Mati') + '</button></div>' +
    '<p class="tiny muted">Pesan masuk ditarik sendiri saat aplikasi dibuka, saat tab kembali aktif, ' +
      'dan berkala — sama seperti Gmail.</p>' +
    (state.settings.waAutoSync ?
      '<div class="field" style="margin-top:10px"><label>Jarak antar sinkron WhatsApp ' +
        '<span class="hint">— menit</span></label>' +
        '<input type="number" id="set-wamin" min="1" max="240" value="' +
          esc(state.settings.waSyncMinutes) + '"></div>' +
      '<button class="btn sm" data-action="wa-min-save">Simpan jarak</button>' +
      '<p class="tiny muted" style="margin-top:8px">Terakhir sinkron: <b class="mono">' +
        (state.settings.waLastSync ? fmtDateTime(state.settings.waLastSync) : 'belum pernah') + '</b></p>'
      : '')) +
  '</div>' +

  '<div class="card">' +
    '<div class="card-head"><h2>Tanda Tangan</h2></div>' +
    '<div class="field"><label>Ditambahkan di akhir surat baru</label>' +
      '<textarea id="set-sign" style="min-height:80px">' + esc(state.settings.signature) + '</textarea></div>' +
    '<button class="btn" data-action="sign-save">Simpan</button>' +
  '</div>' +

  '<div class="card">' +
    '<div class="card-head"><h2>Pengaman pengiriman</h2></div>' +
    '<div class="row" style="justify-content:space-between">' +
      '<span class="small"><b>Wajib periksa sebelum kirim</b>' +
        '<div class="tiny muted">Setiap kali menekan <b>Kirim</b>, layar periksa muncul dulu — ' +
        'daftar penerima, jumlah kwitansi, isi surat, dan pratinjau. Baru setelah itu bisa dikirim.</div></span>' +
      '<button class="btn sm' + (state.settings.wajibPeriksa ? ' primary' : '') +
        '" data-action="wajib-periksa-toggle">' +
        (state.settings.wajibPeriksa ? 'Aktif' : 'Mati') + '</button>' +
    '</div>' +
    '<div class="sep"></div>' +
    '<div class="field"><label>Alamat email uji ' +
      '<span class="hint">— tujuan tombol “Kirim ke saya sendiri dulu”</span></label>' +
      '<input type="text" id="set-email-uji" value="' + esc(state.settings.emailUji || '') + '" ' +
        'placeholder="' + esc(Gmail.email || 'kosongkan = pakai email Gmail yang tersambung') + '"></div>' +
    '<button class="btn" data-action="email-uji-save">Simpan</button>' +
    '<p class="tiny muted" style="margin-top:8px">' +
      (state.settings.emailUji
        ? 'Salinan uji dikirim ke <b>' + esc(state.settings.emailUji) + '</b>.'
        : 'Dikosongkan berarti salinan uji dikirim ke <b>' +
          esc(Gmail.email || 'email Gmail yang tersambung') + '</b>.') +
      ' Salinan uji <b>tidak masuk riwayat surat donor</b>.</p>' +
    '<div class="sep"></div>' +
    '<div class="field"><label>Alamat untuk koreksi kwitansi ' +
      '<span class="hint">— dicetak di kwitansi</span></label>' +
      '<input type="text" id="set-koreksi" value="' + esc(state.settings.kontakKoreksi) + '" ' +
        'placeholder="finance@kartidaya.org"></div>' +
    '<button class="btn" data-action="koreksi-save">Simpan</button>' +
    '<p class="tiny muted" style="margin-top:8px">Kwitansi memuat baris: ' +
      '“Ada yang perlu diperbaiki? Hubungi <b>alamat di atas</b> dengan menyebut kode di atas.” ' +
      'Ini memudahkan donor melaporkan kekeliruan tanpa harus mencari kontak.</p>' +
  '</div>' +

  '<div class="card">' +
    '<div class="card-head"><h2>Tampilan</h2></div>' +
    '<div class="row"><span class="small">Tema</span>' +
      '<button class="btn sm" data-action="tema-light">Terang</button>' +
      '<button class="btn sm" data-action="tema-dark">Gelap</button>' +
      '<button class="btn sm" data-action="tema-auto">Ikut sistem</button></div>' +
  '</div>' +

  '<div class="card">' +
      '<div class="card-head"><h2>Akun saya</h2>' +
        '<span class="chip ' + (Akun.masuk() ? 'ok' : 'plain') + '">' +
          (Akun.masuk() ? esc(Akun.peran()) : 'belum masuk') + '</span></div>' +
      (Akun.masuk()
        ? '<p class="small muted">Masuk sebagai <b>' + esc(Akun.nama()) + '</b>' +
            '<br><span class="mono tiny">' + esc((Akun.pengguna || {}).email || '') + '</span></p>' +
          '<p class="tiny muted">Sesi berlaku sampai <b>' +
            esc(Akun.kedaluwarsa ? fmtDateTime(Akun.kedaluwarsa) : '—') + '</b> ' +
            '(' + Akun.sisaMenit() + ' menit lagi). Setelah itu perlu masuk ulang.</p>' +
          '<div class="btn-row">' +
            '<button class="btn" data-action="akun-ganti-password">🔑 Ganti password</button>' +
            '<button class="btn" data-action="keluar-akun">Keluar</button>' +
          '</div>'
        : '<p class="small muted">Belum masuk.</p>') +
      '<div class="sep"></div>' +
      '<p class="small muted">Menambah pengguna baru dilakukan di <b>halaman akun</b> ' +
        'yang terpisah dari aplikasi. Halaman itu hanya bisa dipakai <b>admin</b> — ' +
        'setelah masuk, admin membuat akun untuk staf donor dan staf keuangan.</p>' +
      (Akun.alamatDaftar()
        ? '<p class="tiny muted">Alamat: <a href="' + esc(Akun.alamatDaftar()) + '" target="_blank" rel="noopener" ' +
            'class="mono">' + esc(Akun.alamatDaftar()) + '</a></p>'
        : '<p class="tiny muted">Alamat Worker belum diisi, jadi alamat pendaftaran belum bisa ditampilkan.</p>') +
      '<div class="btn-row">' +
        '<button class="btn sm" data-action="akun-cek-daftar">Cek pintu pendaftaran</button>' +
        '<button class="btn sm" data-action="akun-daftar-buka">Buka halaman pendaftaran</button>' +
      '</div>' +
      '<p class="tiny muted" id="akun-daftar-info" style="margin-top:8px"></p>' +
    '</div>' +

    '<div class="card">' +
    '<div class="card-head"><h2>Data bersama</h2>' +
      '<span class="chip ' + (Server.online ? 'ok' : (Server.bisa() ? 'warn' : 'plain')) + '">' +
        (Server.online ? 'Tersambung' : (Server.bisa() ? 'Tidak tersambung' : 'Belum diatur')) + '</span></div>' +
    '<p class="small muted">Data donor, surat, keuangan, dan template disimpan di <b>server</b> ' +
      '(Cloudflare), bukan di browser ini. Jadi kalau ada rekan yang membuka aplikasi ini, ' +
      'dia melihat data yang sama.</p>' +
    '<p class="small muted">Aplikasi ini bekerja <b>online</b>. Kalau internet mati, ' +
      'aplikasi tidak bisa dipakai sampai sambungan kembali — ini disengaja supaya ' +
      'tidak ada perubahan yang tampak tersimpan padahal hilang.</p>' +
    '<p class="tiny muted">' +
      (Server.terakhir
        ? 'Terakhir tersimpan: <b>' + esc(fmtDateTime(Server.terakhir)) + '</b>.'
        : 'Belum pernah tersimpan ke server dari komputer ini.') +
      (Object.keys(Server.tertunda || {}).length
        ? ' <b style="color:#a33">Ada ' + Object.keys(Server.tertunda).length +
          ' perubahan belum terkirim — akan dicoba lagi otomatis.</b>'
        : '') +
      (Server.pesan ? ' <span style="color:#a33">Galat terakhir: ' + esc(Server.pesan) + '</span>' : '') +
    '</p>' +
    '<div class="btn-row">' +
      '<button class="btn" data-action="server-muat">⟳ Muat ulang dari server</button>' +
      '<button class="btn" data-action="server-unggah">↑ Unggah data browser ini ke server</button>' +
    '</div>' +
    '<p class="tiny muted" style="margin-top:8px"><b>Unggah</b> dipakai sekali saja: kalau data di ' +
      'komputer ini lebih lengkap daripada di server, tekan tombol itu untuk mengirimnya. ' +
      'Hati-hati — data di server akan <b>ditimpa</b>.</p>' +
  '</div>' +

  '<div class="card">' +
    '<div class="card-head"><h2>Data</h2></div>' +
    '<p class="small muted">Salinan di browser ini (localStorage). Ukuran: <b class="mono">' +
      (bytes/1024).toFixed(1) + ' KB</b> · ' + state.donors.length + ' donor · ' +
      state.messages.length + ' surat · ' + state.templates.length + ' template.</p>' +
    '<div class="btn-row">' +
      '<button class="btn primary" data-action="ekspor-xlsx">↓ Ekspor Excel (.xlsx)</button>' +
      '<button class="btn" data-action="ekspor-json">↓ Ekspor JSON</button>' +
      '<button class="btn" data-action="ekspor-csv">↓ Ekspor CSV Donor</button>' +
      '<button class="btn" data-action="impor-json">↑ Impor JSON</button>' +
      '<button class="btn" data-action="muat-contoh">Muat data contoh</button>' +
      '<button class="btn danger" data-action="reset">Hapus semua data</button>' +
    '</div>' +
    '<p class="tiny muted" style="margin-top:8px">Excel berisi 6 lembar: ' +
      '<b>Donor</b>, <b>Surat</b>, <b>Kategori</b>, <b>Template</b>, <b>Keuangan</b>, <b>Program</b>. ' +
      'Pustaka pembuat Excel sudah ada di dalam aplikasi (<b class="mono">vendor/xlsx.full.min.js</b>) — ' +
      'tidak perlu aplikasi atau internet tambahan.</p>' +
    '<input type="file" id="file-import" accept=".json,application/json" class="hidden">' +
  '</div>' +

  '<div class="card">' +
    '<div class="card-head"><h2>Aturan ID-DONOR</h2></div>' +
    '<p class="small">Format <b class="mono">[X]99999[Z]</b></p>' +
    '<ul class="small muted" style="margin:0;padding-left:20px">' +
      '<li><b class="mono">X</b> — huruf pertama <b>Instansi</b>; jika kosong pakai huruf pertama <b>PIC</b>.</li>' +
      '<li><b class="mono">99999</b> — counter 5 digit, dihitung per huruf X.</li>' +
      '<li><b class="mono">Z</b> — suffix huruf, bisa diisi manual (default <b class="mono">R</b>).</li>' +
    '</ul>' +
    '<div class="sep"></div>' +
    '<div class="field" style="max-width:360px"><label>Uji coba generator</label>' +
      '<div class="row"><input type="text" id="test-pic" placeholder="PIC" style="flex:1">' +
      '<input type="text" id="test-inst" placeholder="Instansi" style="flex:1">' +
      '<input type="text" id="test-sfx" placeholder="Z" maxlength="1" style="width:56px"></div>' +
      '<div class="row" style="margin-top:8px"><button class="btn sm" data-action="test-id">Buat ID</button>' +
      '<span class="mono" id="test-out" style="font-size:15px"></span></div></div>' +
  '</div>';
}

/* ---------- 9. MODAL ---------- */
function openModal(o){
  const root = document.getElementById('modal-root');
  root.innerHTML =
    '<div class="modal-back" data-close-back><div class="modal' + (o.wide ? ' wide' : '') +
      (o.kelas ? ' ' + o.kelas : '') + '" role="dialog" aria-modal="true">' +
      '<div class="modal-head"><h2>' + esc(o.title) + '</h2><button class="x" data-close>&times;</button></div>' +
      '<div class="modal-body">' + o.body + '</div>' +
      (o.footer ? '<div class="modal-foot">' + o.footer + '</div>' : '') +
    '</div></div>';
  document.body.style.overflow = 'hidden';
  const back = root.querySelector('[data-close-back]');
  back.addEventListener('mousedown', function(e){ if(e.target === back) closeModal(); });
  root.querySelectorAll('[data-close]').forEach(function(b){ b.addEventListener('click', closeModal); });
  if(o.onOpen) o.onOpen(root);
  /* Gambar kwitansi (PNG) digambar setelah modal tampil — menggambar butuh
     waktu, jadi jangan menahan tampilnya modal. */
  if(o.gambarKwitansi){
    const wadah = root.querySelector('#png-periksa');
    if(wadah){
      kwitansiPNG(o.gambarKwitansi.d, o.gambarKwitansi.bahasa, o.gambarKwitansi.finId,
        { kodeKiriman: o.gambarKwitansi.kodeKiriman, waktuKirim: o.gambarKwitansi.waktuKirim })
        .then(function(url){
          const kb = Math.round((url.length - 'data:image/png;base64,'.length) * 3 / 4 / 1024);
          wadah.innerHTML = '<img src="' + url + '" alt="Kwitansi" style="max-width:100%;display:block">' +
            '<p class="tiny muted" style="margin:8px 0 0">Gambar ' + kb + ' KB — inilah yang diterima donor di WhatsApp.</p>';
        })
        .catch(function(e){
          wadah.innerHTML = '<div class="warnbox">Gagal menggambar kwitansi: ' + esc(e.message || e) + '</div>';
        });
    }
  }
}
function closeModal(){
  document.getElementById('modal-root').innerHTML = '';
  document.body.style.overflow = '';
}
document.addEventListener('keydown', function(e){ if(e.key === 'Escape') closeModal(); });

/* ---------- Form Donor ---------- */
/* Dua kolom isian berdampingan (email 1 & 2, HP 1 & 2) dengan centang
   "Utama" di masing-masing. Radio dipakai, bukan checkbox, karena hanya satu
   yang boleh jadi utama — jadi tidak ada kemungkinan dua-duanya tercentang.
   Kalau kolomnya kosong, centangnya dimatikan supaya tidak bisa dipilih. */
function pasanganField(judul, nama, id1, v1, id2, v2, ph1, ph2, utama){
  const u = Number(utama) === 2 ? 2 : 1;
  const tipe = String(nama).toLowerCase() === 'email' ? 'email' : 'tel';
  function baris(n, id, nilai, ph){
    const kosong = !String(nilai || '').trim();
    return '<div class="pasangan-baris">' +
      '<input type="' + tipe + '" id="' + id + '" value="' + esc(nilai) + '" placeholder="' + esc(ph) + '">' +
      '<label class="utama-pilih' + (kosong ? ' mati' : '') + '" title="Pakai ' + judul + ' ini sebagai utama">' +
        '<input type="radio" name="' + nama + '-utama" value="' + n + '"' +
          (u === n ? ' checked' : '') + (kosong ? ' disabled' : '') + '>' +
        '<span>Utama</span></label>' +
    '</div>';
  }
  return '<div class="field span2"><label>' + esc(judul) +
      ' <span class="hint">— centang mana yang dipakai sistem</span></label>' +
    '<div class="pasangan">' +
      baris(1, id1, v1, ph1) +
      baris(2, id2, v2, ph2) +
    '</div></div>';
}
function openDonorForm(id){
  const isNew = !id;
  const found = isNew ? null : findDonor(id);
  if(!isNew && !found){ toast('Donor ' + id + ' tidak ditemukan', true); return; }
  const d = isNew ? {
    id:'', kategori: state.categories[0] || '', pic:'', namaLengkap:'', instansi:'',
    email:'', email2:'', emailUtama:1, hp1:'', hp2:'', hpUtama:1,
    panggilan:'', dateStart:'', asalGereja:'', alamat:'',
    tglLahir:'', pengiriman:'', catatan:''
  } : Object.assign({ email2:'', emailUtama:1, hpUtama:1 }, found);

  const katOpts = state.categories.map(function(c){
    return '<option value="' + esc(c) + '"' + (d.kategori === c ? ' selected' : '') + '>' + esc(c) + '</option>';
  }).join('');
  const pgOpts = PANGGILAN.map(function(p){
    return '<option value="' + esc(p) + '"' + (d.panggilan === p ? ' selected' : '') + '>' + (p || '—') + '</option>';
  }).join('');
  const krOpts = PENGIRIMAN.map(function(p){
    return '<option value="' + esc(p) + '"' + (d.pengiriman === p ? ' selected' : '') + '>' + (p || '—') + '</option>';
  }).join('');

  const body = '<div class="form-grid">' +
    '<div class="field"><label>ID-DONOR <span class="hint">— otomatis, bisa diubah</span></label>' +
      '<div class="row"><input type="text" id="d-id" class="mono" value="' + esc(d.id) + '" placeholder="otomatis">' +
      '<button type="button" class="btn sm" data-action="gen-id">Buat ID</button></div></div>' +
    '<div class="field"><label>Kategori</label><select id="d-kategori">' + katOpts + '</select></div>' +
    '<div class="field"><label>Panggilan</label><select id="d-panggilan">' + pgOpts + '</select></div>' +
    '<div class="field"><label>PIC</label><input type="text" id="d-pic" value="' + esc(d.pic) + '" placeholder="Nama PIC"></div>' +
    '<div class="field"><label>Nama Lengkap</label><input type="text" id="d-namaLengkap" value="' + esc(d.namaLengkap) + '"></div>' +
    '<div class="field"><label>Instansi <span class="hint">— boleh kosong</span></label><input type="text" id="d-instansi" value="' + esc(d.instansi) + '"></div>' +
    pasanganField('Email', 'email', 'd-email', d.email, 'd-email2', d.email2,
      'nama@contoh.com', 'email kedua (boleh kosong)', d.emailUtama) +
    '<div class="field"><label>Pengiriman melalui</label><select id="d-pengiriman">' + krOpts + '</select></div>' +
    pasanganField('Nomor HP', 'hp', 'd-hp1', d.hp1, 'd-hp2', d.hp2,
      '0811…', 'nomor kedua (boleh kosong)', d.hpUtama) +
    '<div class="field"><label>Date Start</label><input type="date" id="d-dateStart" value="' + esc(d.dateStart) + '"></div>' +
    '<div class="field"><label>Tgl Lahir</label><input type="date" id="d-tglLahir" value="' + esc(d.tglLahir) + '"></div>' +
    '<div class="field"><label>Asal Gereja</label><input type="text" id="d-asalGereja" value="' + esc(d.asalGereja) + '"></div>' +
    '<div class="field span2"><label>Alamat Lengkap <span class="hint">— untuk kiriman manual (POS/kurir)</span></label>' +
      '<textarea id="d-alamat" style="min-height:70px" placeholder="Jalan, nomor, RT/RW&#10;Kelurahan, Kecamatan&#10;Kota, Kode Pos">' +
        esc(d.alamat) + '</textarea></div>' +
    '<div class="field span2"><label>Catatan</label><textarea id="d-catatan" style="min-height:70px">' + esc(d.catatan) + '</textarea></div>' +
  '</div><p class="tiny muted">Minimal salah satu dari <b>PIC</b> atau <b>Instansi</b> harus terisi. ' +
    'Yang dicentang <b>Utama</b> itulah yang dipakai saat mengirim surat dan yang tampil di daftar donor.</p>';

  const footer = (isNew ? '' :
      '<button class="btn danger" data-action="donor-hapus" data-id="' + esc(d.id) + '">Hapus</button>') +
    '<button class="btn" data-close>Batal</button>' +
    '<button class="btn primary" data-action="donor-simpan" data-new="' + (isNew ? '1' : '0') +
      '" data-oldid="' + esc(d.id) + '">Simpan</button>';

  openModal({ title: isNew ? 'Tambah Donor' : 'Ubah Donor', body:body, footer:footer, wide:true });
}
/* Aktif/matikan centang "Utama" mengikuti isi kolomnya. Dipanggil setiap kali
   salah satu kolom email/HP diketik. Kalau kolom yang tadinya kosong sekarang
   terisi dan belum ada yang utama, kolom itu otomatis jadi utama — supaya
   pengguna tidak perlu mencentang manual untuk kasus yang paling umum. */
function segarkanUtama(id){
  const peta = { 'd-email':'email', 'd-email2':'email', 'd-hp1':'hp', 'd-hp2':'hp' };
  const nama = peta[id];
  if(!nama) return;
  const pasangan = { 'email':['d-email','d-email2'], 'hp':['d-hp1','d-hp2'] }[nama];
  const radio = document.querySelectorAll('input[name="' + nama + '-utama"]');
  if(!radio.length) return;
  let adaTerpilih = false;
  radio.forEach(function(r){
    const el = document.getElementById(pasangan[Number(r.value) - 1]);
    const kosong = !el || !el.value.trim();
    r.disabled = kosong;
    const label = r.closest('.utama-pilih');
    if(label) label.classList.toggle('mati', kosong);
    if(r.checked && !kosong) adaTerpilih = true;
    if(r.checked && kosong) r.checked = false;
  });
  if(!adaTerpilih){
    for(let i = 0; i < radio.length; i++){
      const el = document.getElementById(pasangan[i]);
      if(el && el.value.trim()){ radio[i].checked = true; break; }
    }
  }
}
function readDonorForm(){  function v(id){ const el = document.getElementById(id); return el ? el.value.trim() : ''; }
  /* Radio "Utama" bisa saja tidak tercentang sama sekali (misalnya kedua kolom
     kosong). Dalam hal itu dipakai 1 sebagai nilai awal — bukan 0 — supaya
     penandanya tetap sah dan tidak membuat emailUtama()/hpUtama() bingung. */
  function utama(nama){
    const el = document.querySelector('input[name="' + nama + '-utama"]:checked');
    return el && Number(el.value) === 2 ? 2 : 1;
  }
  return {
    id:v('d-id'), kategori:v('d-kategori'), panggilan:v('d-panggilan'),
    pic:v('d-pic'), namaLengkap:v('d-namaLengkap'), instansi:v('d-instansi'),
    email:v('d-email'), email2:v('d-email2'), emailUtama:utama('email'),
    pengiriman:v('d-pengiriman'), hp1:v('d-hp1'), hp2:v('d-hp2'), hpUtama:utama('hp'),
    dateStart:v('d-dateStart'), tglLahir:v('d-tglLahir'),
    asalGereja:v('d-asalGereja'), alamat:v('d-alamat'), catatan:v('d-catatan')
  };
}

/* ---------- Lihat Pesan ---------- */
function openMessage(msgId){
  const m = state.messages.filter(function(x){ return x.id === msgId; })[0];
  if(!m) return;
  const d = findDonor(m.donorId);
  /* Membuka surat masuk berarti surat itu sudah dibaca — statusnya ikut naik
     dari "Belum dibaca" ke "Dibaca" supaya tidak tertinggal sebagai baru. */
  if(m.arah === 'masuk' && !m.dibaca){
    m.dibaca = true;
    if(m.status === 'Belum dibaca') m.status = 'Dibaca';
    save('messages');
  }

  const statusRow = m.arah === 'masuk'
    ? '<div class="field" style="max-width:280px"><label>Status surat</label>' +
        '<select data-msg-status="' + esc(m.id) + '">' +
          STATUS_MASUK.map(function(s){
            return '<option value="' + esc(s) + '"' + (m.status === s ? ' selected' : '') + '>' +
              esc(s) + ' — ' + esc(ARTI_STATUS_MASUK[s]) + '</option>';
          }).join('') + '</select></div>' +
        '<p class="tiny muted" style="margin:-4px 0 12px">' +
          '<b>Belum dibaca</b> = pesan baru (dihitung di badge menu Masuk) · ' +
          '<b>Dibaca</b> = sudah dibuka · <b>Dibalas</b> = sudah dikirimi balasan.</p>'
    : '';

  const body = '<div class="row" style="margin-bottom:12px">' +
      '<span class="chip' + (m.arah === 'masuk' ? ' plain' : '') + '">' +
        (m.arah === 'masuk' ? '↓ Masuk' : '↑ Keluar') + '</span>' +
      kanalChip(m) +
      '<span class="chip ' + statusChipClass(m.status) + '" id="m-status-chip">' + esc(m.status) + '</span>' +
      '<span class="tiny muted mono">' + fmtDateTime(m.tanggal) + '</span></div>' +
    statusRow +
    '<div class="kv">' +
      kv('Donor', d ? donorName(d) + ' (' + d.id + ')' : '—') +
      kv(m.kanal === 'whatsapp' ? 'Dari (nomor)' : 'Dari', m.kanal === 'whatsapp' ? waPhonePretty(m.from) : m.from) +
      kv(m.kanal === 'whatsapp' ? 'Kepada (nomor)' : 'Kepada', m.kanal === 'whatsapp' ? waPhonePretty(m.to) : m.to) +
      (m.cc ? kv('Cc', m.cc) : '') +
      kv('Subjek', m.subjek) +
      (m.arah === 'keluar' && m.pixelId
        ? kv('Dibaca penerima', m.dibacaPenerima
            ? '✓✓ ' + fmtDateTime(m.dibacaPenerima)
            : 'belum ada kabar (penerima mungkin memblokir gambar)')
        : '') +
      (m.arah === 'keluar' && m.terimaId
        ? kv('Konfirmasi penerimaan', m.terimaPenerima
            ? '✓ Dikonfirmasi ' + fmtDateTime(m.terimaPenerima)
            : 'belum dikonfirmasi penerima')
        : '') +
      kv('Lampiran', m.lampiran) + kv('Catatan', m.catatan) +      (m.kodeKiriman ? kv('Kode kiriman', m.kodeKiriman) : '') +
      (m.waktuKirim ? kv('Waktu kirim', m.waktuKirim) : '') +
      (m.kwitansiFinId ? kv('Kode kwitansi', (state.finance.filter(function(x){
        return x.id === m.kwitansiFinId;
      })[0] || {}).kode || '—') : '') +
      (m.waError ? kv('Alasan gagal', m.waError + (m.waKode ? ' (kode ' + m.waKode + ')' : '')) : '') +
    '</div>' +
    '<div class="sep"></div>' +
    /* Isi surat ditampilkan dengan format yang sama seperti saat dikirim, jadi
       **tebal** / *miring* tampil sebagai huruf tebal & miring — bukan tanda
       bintang mentah. Surat masuk dari donor tetap apa adanya (teks biasa). */
    (m.kanal === 'whatsapp'
      ? '<div class="wa-preview"><div class="wa-bubble">' + esc(formatTeksPolos(m.isi)) + '</div></div>'
      : (m.arah === 'keluar'
          ? '<div class="letter">' + formatTeksHTML(m.isi) + '</div>'
          : '<div class="letter">' + esc(m.isi) + '</div>')) +
    pratinjauLampiran(m, d);

  const footer = '<button class="btn danger" data-action="msg-hapus" data-id="' + esc(m.id) + '">Hapus</button>' +
    '<button class="btn" data-close>Tutup</button>' +
    (d ? '<button class="btn" data-action="buku" data-id="' + esc(d.id) + '">Buka Riwayat</button>' +
         '<button class="btn primary" data-action="balas" data-id="' + esc(d.id) + '">✎ Balas</button>' +
         (m.arah === 'masuk' && m.cc
           ? '<button class="btn" data-action="balas-semua" data-id="' + esc(d.id) + '" data-msg="' + esc(m.id) + '">↩ Balas semua</button>'
           : '') +
         '<button class="btn" data-action="teruskan" data-id="' + esc(d.id) + '" data-msg="' + esc(m.id) + '">↪ Teruskan</button>'
       : '<button class="btn primary" data-action="tautkan" data-id="' + esc(m.id) + '">Tautkan ke Donor</button>');

  openModal({ title: m.subjek || '(tanpa subjek)', body:body, footer:footer, wide:true });
  renderNav();
}

/* Pratinjau lampiran surat keluar: kwitansi & majalah seperti yang dilihat
   penerima. Dipakai supaya bisa diperiksa sebelum maupun sesudah kirim.
   Kwitansi diambil dari salinan yang disimpan saat surat dikirim; kalau surat
   lama belum punya salinan, dibuat ulang dari data keuangan sekarang. */
function pratinjauLampiran(m, d){
  if(!m || m.arah !== 'keluar' || m.kanal === 'whatsapp') return '';
  const bagian = [];

  /* Berkas sungguhan yang ikut terkirim — bisa dibuka atau diunduh lagi. */
  if(Array.isArray(m.lampiranBerkas) && m.lampiranBerkas.length){
    bagian.push('<div class="lampiran-blok">' +
      '<div class="lampiran-head"><b>Berkas yang ikut terkirim</b>' +
        '<span class="chip plain">' + m.lampiranBerkas.length + ' berkas</span></div>' +
      '<div class="lampiran-daftar">' + m.lampiranBerkas.map(function(l){
        const u = l.url || WhatsApp.lampiranURL(l.id);
        return '<div class="lampiran-baris">' +
          '<span class="lampiran-ikon">' + ikonBerkas(l.nama) + '</span>' +
          '<span class="lampiran-nama">' + esc(l.nama) + '</span>' +
          '<span class="tiny muted mono">' + ukuranBerkas(l.ukuran) + '</span>' +
          (u ? '<a class="btn sm" href="' + esc(u) + '" target="_blank" rel="noopener">Buka</a>' : '') +
        '</div>';
      }).join('') + '</div></div>');
  }

  if(m.kwitansiHTML){
    bagian.push('<div class="lampiran-blok">' +
      '<div class="lampiran-head"><b>Kwitansi yang terkirim</b>' +
        '<span class="chip plain">' + esc(KWITANSI_NAMA_BAHASA[m.kwitansiBahasa] || 'Indonesia') + '</span>' +
        '<span class="chip plain">salinan tersimpan</span></div>' +
      '<div class="kwitansi-preview">' + m.kwitansiHTML + '</div></div>');
  }else if(d && state.finance.some(function(f){ return f.donorId === d.id; })){
    bagian.push('<div class="lampiran-blok">' +
      '<div class="lampiran-head"><b>Kwitansi</b>' +
        '<span class="chip warn">dibuat ulang dari data keuangan sekarang</span></div>' +
      '<div class="kwitansi-preview">' + kwitansiHTML(d, 'id', '') + '</div>' +
      '<p class="tiny muted" style="margin:8px 0 0">Surat ini dikirim sebelum salinan kwitansi ' +
        'disimpan, jadi isinya bisa berbeda kalau data keuangan sudah diubah.</p></div>');
  }

  if(m.majalah && m.majalah.halaman){
    const simpan = state.settings.majalah;
    const pakai = (simpan && simpan.id === m.majalah.id) ? simpan : m.majalah;
    const halaman = [];
    for(let i = 1; i <= pakai.halaman; i++){
      const src = workerBase() ? workerBase() + '/majalah/' + pakai.id + '/' + i : '';
      if(!src) break;
      halaman.push('<img src="' + esc(src) + '" alt="Halaman ' + i + '">');
    }
    bagian.push('<div class="lampiran-blok">' +
      '<div class="lampiran-head"><b>Majalah yang terkirim</b>' +
        '<span class="chip plain">' + pakai.halaman + ' halaman</span></div>' +
      (halaman.length
        ? '<div class="mj-preview">' + halaman.join('') + '</div>'
        : '<p class="tiny muted">Gambar majalah tidak bisa ditampilkan — alamat Worker belum diisi.</p>') +
      '</div>');
  }

  if(!bagian.length) return '';
  return '<div class="sep"></div>' +
    '<p class="small" style="margin:0 0 4px"><b>Lampiran di dalam email</b> ' +
      '<span class="hint">— inilah yang dilihat penerima</span></p>' +
    bagian.join('');
}

/* ---------- Tautkan surat tak dikenal ke donor ---------- */
function openTautkan(msgId){
  const m = state.messages.filter(function(x){ return x.id === msgId; })[0];
  if(!m) return;
  const wa = m.kanal === 'whatsapp';
  const guess = wa ? waPhonePretty(m.from) : emailOf(m.from);
  const donorOpts = '<option value="">— pilih donor —</option>' + state.donors.map(function(d){
    return '<option value="' + esc(d.id) + '">' + esc(d.id + ' — ' + donorName(d) +
      (wa ? (donorWa(d) ? ' · ' + waPhonePretty(donorWa(d)) : '') : (emailUtama(d) ? ' · ' + emailUtama(d) : ''))) + '</option>';
  }).join('');
  const body = '<p class="small muted">Pengirim <b class="mono">' + esc(guess || '—') +
      '</b> belum terhubung ke donor mana pun.</p>' +
    '<div class="field"><label>Pilih donor</label><select id="t-donor">' + donorOpts + '</select></div>' +
    '<label class="row small" style="gap:6px"><input type="checkbox" id="t-email" checked>' +
      (wa ? 'Simpan nomor pengirim ke data donor (jika donor belum punya nomor HP)'
          : 'Simpan email pengirim ke data donor (jika donor belum punya email)') + '</label>';
  openModal({ title:'Tautkan Surat ke Donor', body:body,
    footer:'<button class="btn" data-close>Batal</button>' +
      '<button class="btn primary" data-action="tautkan-simpan" data-id="' + esc(msgId) + '">Tautkan</button>' });
}

/* ---------- Catat Surat Masuk Manual ---------- */
function openCatatMasuk(donorId){
  const donorOpts = '<option value="">— pilih donor —</option>' + state.donors.map(function(d){
    return '<option value="' + esc(d.id) + '"' + (donorId === d.id ? ' selected' : '') + '>' +
      esc(d.id + ' — ' + donorName(d)) + '</option>';
  }).join('');
  const body = '<div class="field"><label>Donor</label><select id="l-donor">' + donorOpts + '</select></div>' +
    '<div class="form-grid">' +
      '<div class="field"><label>Tanggal</label><input type="date" id="l-tanggal" value="' +
        new Date().toISOString().slice(0,10) + '"></div>' +
      '<div class="field"><label>Kanal</label><select id="l-kanal">' +
        KANAL.filter(function(k){ return !(WA_DITUNDA && k === 'whatsapp'); }).map(function(k){
          return '<option value="' + k + '">' + ICO_KANAL[k] + ' ' + LABEL_KANAL[k] + '</option>';
        }).join('') + '</select></div>' +
      '<div class="field"><label>Status</label><select id="l-status">' +
        STATUS_MASUK.map(function(s){
          return '<option value="' + esc(s) + '">' + esc(s) + ' — ' + esc(ARTI_STATUS_MASUK[s]) + '</option>';
        }).join('') + '</select></div>' +
    '</div>' +
    '<p class="tiny muted" style="margin:-4px 0 12px">Status menentukan apakah surat ini dihitung ' +
      'sebagai <b>belum dibaca</b> di menu Masuk. Pilih <b>Dibaca</b> kalau surat ini sudah Anda ' +
      'baca lebih dulu (mis. surat lama yang baru dicatat).</p>' +
    '<div class="field"><label>Subjek</label><input type="text" id="l-subjek" placeholder="Subjek surat masuk"></div>' +
    '<div class="field"><label>Dari <span class="hint">— email atau nomor pengirim</span></label>' +
      '<input type="text" id="l-dari" class="mono" placeholder="nama@contoh.com / 0811-8862-345"></div>' +
    '<div class="field"><label>Isi / Ringkasan</label><textarea id="l-isi" style="min-height:120px"></textarea></div>' +
    '<div class="field"><label>Catatan</label><input type="text" id="l-catatan"></div>';
  openModal({ title:'Catat Surat Masuk', body:body,
    footer:'<button class="btn" data-close>Batal</button>' +
      '<button class="btn primary" data-action="catat-masuk-simpan">Simpan</button>' });

  /* Isi otomatis alamat pengirim dari data donor supaya tidak perlu diketik
     ulang; tetap bisa diubah kalau surat datang dari alamat lain. */
  const sel = document.getElementById('l-donor');
  const dari = document.getElementById('l-dari');
  const kanalSel = document.getElementById('l-kanal');
  if(sel && dari){
    const isiDari = function(){
      const d = findDonor(sel.value);
      const wa = kanalSel && kanalSel.value === 'whatsapp';
      dari.value = d ? (wa ? (donorWa(d) ? waPhonePretty(donorWa(d)) : '') : (emailUtama(d) || '')) : '';
    };
    sel.addEventListener('change', isiDari);
    if(kanalSel) kanalSel.addEventListener('change', isiDari);
    isiDari();
  }
}

/* ---------- Kelola Template ---------- */
function openTplKelola(){
  const body = (state.templates.length
    ? '<div class="stack">' + state.templates.map(function(t){
        return '<div class="card" style="padding:12px">' +
          '<div class="row"><b style="flex:1">' + esc(t.nama) + '</b>' +
            '<button class="btn sm ghost" data-action="tpl-pakai" data-id="' + esc(t.id) + '">Pakai</button>' +
            '<button class="btn sm ghost" data-action="tpl-ubah" data-id="' + esc(t.id) + '">Ubah</button>' +
            '<button class="btn sm ghost" data-action="tpl-hapus" data-id="' + esc(t.id) + '">Hapus</button></div>' +
          '<div class="tiny muted mono" style="margin-top:4px">' + esc(t.subjek) + '</div></div>';
      }).join('') + '</div>'
    : '<div class="empty"><span class="big">✎</span>Belum ada template.<br>' +
      'Klik <b>+ Tambah</b> untuk membuat template pertama.</div>');
  openModal({
    title:'Template Surat',
    body:body,
    footer:'<button class="btn primary" data-action="tpl-baru">+ Tambah</button>' +
           '<button class="btn" data-close>Tutup</button>'
  });
}

/* Form tambah/ubah template. `id` kosong berarti template baru. */
function openTplForm(id){
  const t = id ? state.templates.filter(function(x){ return x.id === id; })[0] : null;
  if(id && !t){ toast('Template tidak ditemukan', true); return; }
  const isNew = !t;
  const body =
    '<div class="field"><label>Nama template</label>' +
      '<input type="text" id="t-nama" value="' + esc(isNew ? '' : t.nama) + '" placeholder="Contoh: Ucapan Terima Kasih"></div>' +
    '<div class="field"><label>Subjek</label>' +
      '<input type="text" id="t-subjek" value="' + esc(isNew ? '' : t.subjek) + '" placeholder="Subjek surat…"></div>' +
    '<div class="field"><label>Isi Surat <span class="hint">— klik token untuk menyisipkan</span></label>' +
      '<div class="tokenbar">' + TOKENS.map(function(x){
        return '<button type="button" class="token" data-token="' + esc(x[0]) + '" title="' + esc(x[1]) + '">' + esc(x[0]) + '</button>';
      }).join('') + '</div>' +
      '<textarea id="t-isi" style="min-height:220px" placeholder="Tulis isi template di sini…">' + esc(isNew ? '' : t.isi) + '</textarea></div>';
  openModal({
    title: isNew ? 'Tambah Template' : 'Ubah Template',
    body: body,
    wide: true,
    footer: '<button class="btn primary" data-action="tpl-form-simpan" data-id="' + esc(id || '') + '">Simpan</button>' +
            '<button class="btn" data-action="tpl-kelola">Batal</button>',
    onOpen: function(root){
      /* Token disisipkan di posisi kursor, sama seperti di halaman Tulis. */
      root.querySelectorAll('.token').forEach(function(b){
        b.addEventListener('click', function(){
          const ta = document.getElementById('t-isi');
          if(!ta) return;
          const tok = b.getAttribute('data-token');
          const s = ta.selectionStart, e = ta.selectionEnd;
          ta.value = ta.value.slice(0, s) + tok + ta.value.slice(e);
          ta.focus();
          ta.selectionStart = ta.selectionEnd = s + tok.length;
        });
      });
    }
  });
}

function simpanTplForm(id){
  const nama = (document.getElementById('t-nama') || {}).value || '';
  const subjek = (document.getElementById('t-subjek') || {}).value || '';
  const isi = (document.getElementById('t-isi') || {}).value || '';
  if(!nama.trim()){ toast('Nama template belum diisi', true); return; }
  if(!isi.trim()){ toast('Isi template masih kosong', true); return; }

  if(id){
    const t = state.templates.filter(function(x){ return x.id === id; })[0];
    if(!t){ toast('Template tidak ditemukan', true); return; }
    t.nama = nama.trim(); t.subjek = subjek; t.isi = isi;
    toast('Template "' + t.nama + '" diperbarui');
  }else{
    state.templates.push({ id:uid('tpl'), nama:nama.trim(), subjek:subjek, isi:isi });
    toast('Template "' + nama.trim() + '" ditambahkan');
  }
  save('templates');
  openTplKelola();
  render();
}

/* ---------- Kelola Majalah ---------- */
/* Halaman majalah diunggah satu per satu ke Worker. Setelah tersimpan,
   alamatnya dipakai lagi di setiap email — jadi tidak perlu unggah ulang. */
/* Apa saja yang masih kurang untuk menyimpan majalah ke Worker. Dipakai di
   form majalah supaya user tahu persis apa yang harus diisi — bukan sekadar
   tombol mati tanpa penjelasan. */
function waSiapInfo(){
  const endpoint = workerBase();
  const key = String(WhatsApp.appKey || '');
  return {
    endpoint: endpoint,
    adaEndpoint: !!endpoint,
    adaKey: !!key,
    siap: !!(endpoint && key)
  };
}

function openMajalahForm(){
  const m = majalahInfo();
  const s = waSiapInfo();
  const baris = function(ok, label, nilai){
    return '<li>' + (ok ? '✅' : '❌') + ' <b>' + esc(label) + '</b> — ' +
      (ok ? esc(nilai) : '<b>belum diisi</b>') + '</li>';
  };
  const body =
    (s.siap ? '' :
      '<div class="warnbox"><b>Belum bisa mengunggah.</b> Lengkapi dulu di halaman ' +
      '<b>Setelan → Worker Cloudflare</b>:<ul style="margin:8px 0 0;padding-left:20px">' +
        baris(s.adaEndpoint, 'Alamat Worker', s.endpoint) +
        baris(s.adaKey, 'Kunci aplikasi', 'terisi') +
      '</ul>' +
      '<p style="margin:8px 0 0">Majalah disimpan di Worker supaya bisa tampil di email ' +
      'penerima.</p>' +
      '<div class="btn-row" style="margin-top:10px">' +
        '<button class="btn sm primary" data-action="mj-ke-setelan">⚙ Buka Setelan</button>' +
      '</div></div>') +
    '<div class="field"><label>Judul majalah</label>' +
      '<input type="text" id="mj-judul" placeholder="Majalah Kartidaya — Edisi …" value="' +
        esc(m ? (m.judul || '') : '') + '"></div>' +
    '<div class="field"><label>Berkas majalah</label>' +
      '<div class="row" style="gap:8px;margin-bottom:8px">' +
        '<button type="button" class="btn sm primary" data-action="mj-mode" data-mode="pdf">PDF</button>' +
        '<button type="button" class="btn sm" data-action="mj-mode" data-mode="gambar">Gambar per halaman</button>' +
      '</div>' +
      '<div id="mj-pdf-blok">' +
        '<input type="file" id="mj-pdf" accept="application/pdf">' +
        '<p class="tiny muted" style="margin:6px 0 0">Pilih <b>satu berkas PDF</b> — aplikasi akan ' +
          'mengubah setiap halaman jadi gambar secara otomatis. Tidak perlu aplikasi lain. ' +
          'Maksimal ' + MJ_MAX_HALAMAN + ' halaman, berkas maksimal 100 MB.</p>' +
      '</div>' +
      '<div id="mj-img-blok" hidden>' +
        '<input type="file" id="mj-file" accept="image/jpeg,image/png,image/webp" multiple>' +
        '<p class="tiny muted" style="margin:6px 0 0">Pilih semua gambar halaman sekaligus. ' +
          'Urutan halaman mengikuti urutan berkas. Maksimal ' + MJ_MAX_HALAMAN +
          ' halaman, tiap halaman maksimal 4 MB. Format JPG/PNG/WebP.</p>' +
      '</div>' +
    '</div>' +
    (m
      ? '<div class="warnbox">Sudah tersimpan: <b>' + esc(m.judul || 'Majalah') + '</b> — ' +
          m.halaman + ' halaman. Mengunggah lagi akan <b>mengganti</b> seluruh halaman.</div>'
      : '') +
    '<div id="mj-progress" class="small muted"></div>';

  /* Tombol sengaja TIDAK dimatikan. Tombol mati membuat user bingung karena
     tidak ada penjelasan; lebih baik bisa ditekan lalu diberi tahu apa yang
     kurang. */
  const footer = '<button class="btn" data-close>Tutup</button>' +
    '<button class="btn primary" data-action="mj-unggah">↑ Unggah</button>';

  openModal({ title:'Kelola Majalah', body:body, footer:footer, wide:true });
}

/* ---------- PDF → GAMBAR ----------
   Pustaka pdf.js dimuat hanya saat benar-benar dipakai, supaya aplikasi
   sehari-hari tidak ikut berat. Berkasnya ada di dalam aplikasi sendiri
   (vendor/), jadi tidak butuh internet ke layanan luar. */
let pdfjsSiap = null;
function muatPdfJs(){
  if(pdfjsSiap) return pdfjsSiap;
  pdfjsSiap = import('./vendor/pdf.min.mjs').then(function(mod){
    mod.GlobalWorkerOptions.workerSrc = new URL('vendor/pdf.worker.min.mjs', location.href).href;
    return mod;
  });
  return pdfjsSiap;
}

/* Batas majalah. 74 halaman dipilih karena majalah sungguhan bisa setebal itu
   (contoh: 74 halaman). Batas 40 halaman sebelumnya terlalu ketat. */
const MJ_MAX_HALAMAN = 80;
const MJ_LEBAR = 1240;          /* setara 150 dpi untuk halaman A4 */
const MJ_MUTU_JPEG = 0.82;

/* Ubah satu halaman PDF jadi gambar.

   PENTING — kenapa JPEG, bukan PNG? Tergantung isi halamannya:
   - Halaman berisi TEKS & garis (kwitansi, surat) → PNG lebih kecil
   - Halaman berisi FOTO (majalah) → JPEG jauh lebih kecil
     Hasil ukur majalah sungguhan 74 halaman: PNG 462–2390 KB per halaman
     (total ±100 MB), JPEG q82 hanya 228–322 KB per halaman (total ±23 MB).
   Jadi JPEG yang dipakai — 4× lebih kecil, dan mata tidak bisa membedakan
   pada foto.

   `cv` boleh dipakai ulang antar halaman. Kalau setiap halaman membuat canvas
   baru, 74 canvas sekaligus menghabiskan memori dan prosesnya makin lambat
   (terukur: 2,3 detik/halaman di awal, 6 detik/halaman di halaman ke-30).
   Dengan satu canvas yang dipakai ulang, kecepatannya tetap. */
async function halamanPdfKeGambar(pdf, nomor, cv, lebarTarget){
  const page = await pdf.getPage(nomor);
  const dasar = page.getViewport({ scale: 1 });
  const skala = (lebarTarget || MJ_LEBAR) / dasar.width;
  const vp = page.getViewport({ scale: skala });
  const kanvas = cv || document.createElement('canvas');
  kanvas.width = Math.round(vp.width);
  kanvas.height = Math.round(vp.height);
  const ctx = kanvas.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, kanvas.width, kanvas.height);
  await page.render({ canvasContext: ctx, viewport: vp }).promise;
  /* Halaman dilepas supaya memori tidak menumpuk — pdf.js menyimpan cache
     halaman yang sudah dibuka. */
  const hasil = await new Promise(function(resolve){
    kanvas.toBlob(function(b){ resolve(b); }, 'image/jpeg', MJ_MUTU_JPEG);
  });
  page.cleanup();
  return hasil;
}

/* Baca PDF, kembalikan daftar Blob JPEG — satu per halaman. */
async function pdfKeGambar(file, lapor){
  const pdfjs = await muatPdfJs();
  const buf = await file.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data: new Uint8Array(buf) }).promise;
  const total = pdf.numPages;
  if(total > MJ_MAX_HALAMAN){
    throw new Error('PDF ini ' + total + ' halaman — maksimal ' + MJ_MAX_HALAMAN + ' halaman');
  }
  const hasil = [];
  const cv = document.createElement('canvas');
  for(let i = 1; i <= total; i++){
    if(lapor) lapor(i, total);
    hasil.push(await halamanPdfKeGambar(pdf, i, cv));
  }
  return hasil;
}

/* Baca berkas jadi base64 tanpa awalan data:. */
function fileKeBase64(file){
  return new Promise(function(resolve, reject){
    const fr = new FileReader();
    fr.onload = function(){
      const s = String(fr.result || '');
      resolve(s.slice(s.indexOf(',') + 1));
    };
    fr.onerror = function(){ reject(new Error('Gagal membaca berkas ' + file.name)); };
    fr.readAsDataURL(file);
  });
}

/* Blob → base64 tanpa awalan data:. */
function blobKeBase64(blob){
  return new Promise(function(resolve, reject){
    const fr = new FileReader();
    fr.onload = function(){
      const s = String(fr.result || '');
      resolve(s.slice(s.indexOf(',') + 1));
    };
    fr.onerror = function(){ reject(new Error('Gagal membaca gambar')); };
    fr.readAsDataURL(blob);
  });
}

async function unggahMajalah(){
  const prog = document.getElementById('mj-progress');
  const judulEl = document.getElementById('mj-judul');
  const pdfEl = document.getElementById('mj-pdf');
  const imgEl = document.getElementById('mj-file');
  const pakaiPdf = pdfEl && pdfEl.files && pdfEl.files.length;
  const files = imgEl && imgEl.files ? Array.prototype.slice.call(imgEl.files) : [];

  if(!pakaiPdf && !files.length){ toast('Pilih berkas PDF atau gambar halaman dulu', true); return; }
  const siap = waSiapInfo();
  if(!siap.siap){
    toast('Belum bisa mengunggah — ' + (siap.adaEndpoint ? '' : 'Alamat Worker belum diisi. ') +
      (siap.adaKey ? '' : 'Kunci aplikasi belum diisi. ') + 'Isi dulu di Setelan → Worker Cloudflare', true);
    return;
  }

  const id = 'mj-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  const judul = judulEl ? judulEl.value.trim() : '';

  /* Siapkan daftar halaman: dari PDF (diubah dulu) atau dari gambar langsung. */
  let halaman = [];
  let pdfBase64 = '';
  try{
    if(pakaiPdf){
      const f = pdfEl.files[0];
      if(f.size > 100 * 1024 * 1024){ toast('Berkas PDF lebih dari 100 MB', true); return; }
      if(prog) prog.textContent = 'Membaca PDF…';
      /* PDF aslinya disimpan juga — dipakai untuk lampiran WhatsApp. */
      pdfBase64 = await fileKeBase64(f);
      const t0 = Date.now();
      const gambar = await pdfKeGambar(f, function(i, total){
        if(!prog) return;
        const lewat = (Date.now() - t0) / 1000;
        const perHal = i > 1 ? lewat / (i - 1) : 0;
        const sisa = Math.max(0, Math.round(perHal * (total - i)));
        prog.textContent = 'Mengubah halaman ' + i + ' dari ' + total + ' jadi gambar… ' +
          Math.round(i / total * 100) + '%' +
          (i > 1 ? ' · sisa ±' + (sisa >= 60
            ? Math.round(sisa / 60) + ' menit'
            : sisa + ' detik') : '');
      });
      halaman = gambar.map(function(b){ return { blob:b, tipe:'image/jpeg' }; });
    }else{
      if(files.length > MJ_MAX_HALAMAN){ toast('Maksimal ' + MJ_MAX_HALAMAN + ' halaman', true); return; }
      for(const f of files){
        if(f.size > 4 * 1024 * 1024){
          toast('Halaman ' + f.name + ' lebih dari 4 MB — perkecil dulu', true);
          return;
        }
      }
      halaman = files.map(function(f){
        const tipe = /\.png$/i.test(f.name) ? 'image/png'
          : (/\.webp$/i.test(f.name) ? 'image/webp' : 'image/jpeg');
        return { file:f, tipe:tipe };
      });
    }
  }catch(e){
    if(prog) prog.textContent = '';
    toast('Gagal membaca berkas: ' + (e.message || e), true);
    return;
  }

  if(!halaman.length){ if(prog) prog.textContent = ''; toast('Tidak ada halaman yang terbaca', true); return; }

  for(let i = 0; i < halaman.length; i++){
    if(prog) prog.textContent = 'Mengunggah halaman ' + (i + 1) + ' dari ' + halaman.length +
      '… ' + Math.round((i + 1) / halaman.length * 100) + '%';
    try{
      const h = halaman[i];
      const data = h.blob ? await blobKeBase64(h.blob) : await fileKeBase64(h.file);
      await WhatsApp.api('/majalah', {
        method:'POST',
        body:{ id:id, halaman:i + 1, total:halaman.length, tipe:h.tipe,
          judul:judul || 'Majalah Kartidaya', data:data }
      });
    }catch(e){
      if(prog) prog.textContent = '';
      toast('Gagal mengunggah halaman ' + (i + 1) + ': ' + (e.message || e), true);
      return;
    }
  }

  state.settings.majalah = { id:id, halaman:halaman.length, judul:judul || 'Majalah Kartidaya',
    dariPdf: !!pakaiPdf, pdf: !!pdfBase64, diunggah: new Date().toISOString() };
  /* Edisi baru dicatat ke daftar edisi supaya edisi lama tetap bisa dipakai. */
  simpanKeDaftarMajalah(state.settings.majalah);
  save('majalah');

  /* Simpan PDF aslinya di Worker — dipakai untuk lampiran WhatsApp.
     Dikirim bertahap karena KV Cloudflare hanya menerima 25 MiB per key,
     sedangkan PDF majalah bisa 60 MB. Kalau gagal, majalah tetap tersimpan;
     hanya lampiran WhatsApp yang tidak tersedia, dan itu diberitahukan. */
  if(pdfBase64){
    try{
      const ukuran = Math.round(pdfBase64.length * 3 / 4);
      const perBagian = 18 * 1024 * 1024;
      const totalBagian = Math.max(1, Math.ceil(ukuran / perBagian));
      if(totalBagian > 8) throw new Error('PDF lebih dari 100 MB');
      for(let i = 1; i <= totalBagian; i++){
        if(prog) prog.textContent = 'Menyimpan PDF untuk WhatsApp — bagian ' + i +
          ' dari ' + totalBagian + '…';
        const potong = pdfBase64.slice((i - 1) * perBagian * 4 / 3, i * perBagian * 4 / 3);
        await WhatsApp.api('/majalah-pdf', {
          method:'POST',
          body:{ id:id, judul:judul || 'Majalah Kartidaya',
            bagian:i, totalBagian:totalBagian, data:potong }
        });
      }
    }catch(e){
      state.settings.majalah.pdf = false;
      save('majalah');
      toast('Halaman majalah tersimpan, tapi PDF untuk WhatsApp gagal disimpan: ' + (e.message || e), true);
    }
  }

  if(prog) prog.textContent = '';
  closeModal();
  toast(halaman.length + ' halaman majalah tersimpan');
  render();
}

/* Statistik pembaca majalah — berapa kali halaman pembaca dibuka dan halaman
   mana yang paling sering dilihat. Angkanya datang dari Worker; kalau Worker
   belum bisa dihubungi, ditampilkan pesan apa adanya, bukan angka nol yang
   menyesatkan. */
async function bukaStatistikMajalah(){
  const m = majalahInfo();
  if(!m){ toast('Majalah belum disiapkan', true); return; }
  openModal({
    title: 'Statistik pembaca majalah',
    body: '<p class="small muted">Memuat…</p>',
    footer: '<button class="btn" data-close>Tutup</button>'
  });
  let data = null, galat = '';
  try{
    data = await WhatsApp.api('/majalah/' + m.id + '/baca', { method:'GET' });
  }catch(e){
    galat = e.message || String(e);
  }
  const isi = function(){
    if(galat){
      return '<div class="warnbox"><b>Statistik belum bisa dibaca</b>' +
        '<p class="small" style="margin:6px 0 0">' + esc(galat) + '</p>' +
        '<p class="tiny muted" style="margin:6px 0 0">Angka dicatat di Worker. ' +
        'Pastikan alamat Worker dan kunci aplikasi sudah benar di Setelan.</p></div>';
    }
    const buka = (data && data.buka) || 0;
    const perHal = (data && data.halaman) || {};
    const nomor = Object.keys(perHal).map(Number).sort(function(a,b){ return a - b; });
    const total = nomor.reduce(function(s,n){ return s + (perHal[n] || 0); }, 0);
    const max = nomor.reduce(function(s,n){ return Math.max(s, perHal[n] || 0); }, 0);
    return '<div class="grid stats" style="margin-bottom:14px">' +
        stat('Halaman dibuka', buka, 'kali halaman pembaca dibuka') +
        stat('Halaman dilihat', total, nomor.length + ' halaman pernah terlihat') +
      '</div>' +
      (nomor.length
        ? '<div class="table-wrap"><table><thead><tr>' +
            '<th>Halaman</th><th class="right">Dilihat</th><th style="width:45%">Perbandingan</th>' +
          '</tr></thead><tbody>' + nomor.map(function(n){
            const v = perHal[n] || 0;
            const pct = max ? Math.round(v / max * 100) : 0;
            return '<tr><td class="mono">Hal. ' + n + '</td>' +
              '<td class="right mono">' + v + '</td>' +
              '<td><div class="bar"><div style="width:' + pct + '%"></div></div></td></tr>';
          }).join('') + '</tbody></table></div>'
        : '<p class="muted small">Belum ada yang membuka majalah ini. Angka muncul setelah ' +
          'penerima email menekan tombol <b>Baca majalah</b>.</p>') +
      (data && data.terakhir
        ? '<p class="tiny muted" style="margin-top:10px">Terakhir dibuka: ' +
          esc(fmtDateTime(data.terakhir)) + '</p>'
        : '') +
      '<p class="tiny muted" style="margin-top:10px">Yang dicatat hanya <b>jumlah</b> — ' +
        'tidak ada nama, alamat email, atau lokasi pembaca yang disimpan.</p>';
  };
  openModal({
    title: 'Statistik pembaca — ' + (m.judul || 'Majalah'),
    body: isi(),
    footer: '<button class="btn" data-close>Tutup</button>',
    wide:true
  });
}

async function hapusMajalah(){
  const m = majalahInfo();
  if(!m) return;
  if(!confirm('Hapus majalah yang tersimpan?\nEmail berikutnya tidak lagi memuat majalah.')) return;
  try{
    if(WhatsApp.isConfigured()) await WhatsApp.api('/majalah/' + m.id, { method:'DELETE' });
  }catch(e){ /* tetap hapus catatan lokal supaya tidak menggantung */ }
  delete state.settings.majalah;
  suratState.majalah = false;
  save('majalah');
  toast('Majalah dihapus');
  render();
}

/* ---------- 10. AKSI ---------- */
/* Cari donor lain yang memakai email, nomor HP, atau nama PIC yang sama.
   Hasilnya dipakai untuk MEMPERINGATKAN, bukan menolak: data tes boleh kembar,
   tapi pengguna perlu tahu akibatnya — surat masuk hanya masuk ke satu donor
   saja, yaitu donor pertama yang cocok (lihat donorByEmail / donorByPhone).
   Nama PIC dibandingkan karena satu orang bisa terdaftar dua kali dengan email
   berbeda; itu juga membuat suratnya terbelah ke dua riwayat. */
function namaSama(a, b){
  const rapi = function(s){ return String(s || '').toLowerCase().replace(/\s+/g, ' ').trim(); };
  const x = rapi(a), y = rapi(b);
  return !!x && x === y;
}
function donorKembar(f, oldId){
  const email = [f.email, f.email2].map(function(e){ return String(e || '').trim().toLowerCase(); })
    .filter(Boolean);
  const nomor = [waPhone(f.hp1), waPhone(f.hp2)].filter(Boolean);
  const hasil = [];
  state.donors.forEach(function(d){
    if(d.id === oldId) return;
    const emailDia = emailDonor(d);
    const samaEmail = email.filter(function(e){ return emailDia.indexOf(e) >= 0; });
    if(samaEmail.length) hasil.push({ donor:d, jenis:'Email', nilai:samaEmail[0] });
    const punyaDia = [waPhone(d.hp1), waPhone(d.hp2)].filter(Boolean);
    const sama = nomor.filter(function(n){ return punyaDia.indexOf(n) >= 0; });
    if(sama.length) hasil.push({ donor:d, jenis:'Nomor HP', nilai:waPhonePretty(sama[0]) });
    if(namaSama(f.pic, d.pic)){
      hasil.push({ donor:d, jenis:'Nama PIC', nilai:f.pic });
    }
  });
  return hasil;
}

function saveDonorFromForm(isNew, oldId){
  const f = readDonorForm();
  if(!f.pic && !f.instansi){ toast('Isi minimal PIC atau Instansi', true); return; }
  if(!f.id) f.id = nextDonorId(f.pic, f.instansi, 'R');
  const dup = state.donors.filter(function(d){ return d.id === f.id && d.id !== oldId; });
  if(dup.length){ toast('ID ' + f.id + ' sudah dipakai', true); return; }

  const kembar = donorKembar(f, oldId);
  if(kembar.length){
    const daftar = kembar.map(function(k){
      return '• ' + k.jenis + ' "' + k.nilai + '" sudah dipakai ' +
        k.donor.id + ' — ' + donorName(k.donor);
    }).join('\n');
    const adaAlamat = kembar.some(function(k){ return k.jenis !== 'Nama PIC'; });
    const akibat = (adaAlamat
        ? 'Surat masuk ke alamat itu hanya akan masuk ke SATU donor (yang pertama ' +
          'cocok), donor lainnya tidak menerima suratnya.'
        : 'Nama PIC yang sama membuat dua donor mudah tertukar saat memilih penerima.') +
      (kembar.some(function(k){ return k.jenis === 'Nama PIC'; }) && adaAlamat
        ? '\nNama PIC yang sama juga membuat dua donor mudah tertukar.'
        : '');
    if(!confirm('Perhatian — data ini sudah dipakai donor lain:\n\n' + daftar +
        '\n\n' + akibat + '\n\nTetap simpan?')) return;
  }

  if(isNew){
    f.createdAt = new Date().toISOString();
    state.donors.push(f);
      catatAksi('tambah', 'donor', f.id, donorName(f));
    toast('Donor ' + f.id + ' ditambahkan');
  }else{
    const i = state.donors.findIndex(function(d){ return d.id === oldId; });
    if(i < 0) return;
    f.createdAt = state.donors[i].createdAt || new Date().toISOString();
    state.donors[i] = f;
    if(oldId !== f.id){
      state.messages.forEach(function(m){ if(m.donorId === oldId) m.donorId = f.id; });
      save('messages');
        catatAksi('ubah', 'donor', f.id, 'ID diubah dari ' + oldId);
      }else{
        catatAksi('ubah', 'donor', f.id, donorName(f));
    }
    toast('Donor ' + f.id + ' diperbarui');
  }
  save('donors');
  closeModal();
  render();
}
function deleteDonor(id){
  const d = findDonor(id);
  if(!d) return;
  const n = state.messages.filter(function(m){ return m.donorId === id; }).length;
  if(!confirm('Hapus donor ' + donorName(d) + ' (' + id + ')?' +
      (n ? '\n' + n + ' surat di riwayatnya juga akan dihapus.' : ''))) return;
  state.donors = state.donors.filter(function(x){ return x.id !== id; });
  state.messages = state.messages.filter(function(m){ return m.donorId !== id; });
  save('donors'); save('messages');
  catatAksi('hapus', 'donor', id, donorName(d) + (n ? ' (+' + n + ' surat)' : ''));
  closeModal();
  toast('Donor dihapus');
  render();
}

  /* ---------- CATATAN AKTIVITAS ---------- */
  /* Catatan "CCTV" dikirim ke server dalam satu permintaan per aksi. Kegagalan
     mencatat tidak mengganggu pekerjaan pengguna — jadi tidak pernah melempar
     galat dan tidak menampilkan pesan apa pun. */
function catatAksi(aksi, bagian, sasaran, ket){
  if(typeof Akun === 'undefined' || !Akun.masuk()) return;
  Akun.catat([{ aksi:aksi, bagian:bagian, sasaran:sasaran, ket:ket || '' }]);
}

/* Bungkus isi surat + kwitansi jadi satu HTML untuk badan email. Gaya ditulis
   inline karena klien email membuang <style>. */
/* ---------- FORMAT SEDERHANA DI ISI SURAT ----------
   Isi surat tetap teks biasa — bukan editor HTML. Penanda yang dipakai
   sengaja yang sudah lazim di WhatsApp & email, jadi tidak perlu dipelajari:

     **tebal**      → huruf tebal
     *miring*       → huruf miring
     ==stabilo==    → huruf disorot kuning
     - awal baris   → daftar berpoin
     1. awal baris  → daftar bernomor

   Garis bawah (`_`) SENGAJA tidak dipakai sebagai penanda miring: nama berkas
   seperti `laporan_2026_final.pdf` akan berubah jadi "laporan2026final.pdf"
   karena garis bawahnya dianggap penanda. Huruf miring cukup dengan `*`.

   Cara ini dipilih supaya tidak perlu editor berformat + penyaring HTML:
   teksnya tetap bisa dibaca apa adanya, dan tidak ada risiko HTML asing
   masuk ke email penerima. */
function formatTeksHTML(teks){
  const baris = String(teks || '').split(/\r?\n/);
  const out = [];
  let mode = '';   /* '' | 'ul' | 'ol' */

  const tutup = function(){
    if(mode){ out.push('</' + mode + '>'); mode = ''; }
  };
  const sebaris = function(s){
    return esc(s)
      .replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>')
      .replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<i>$2</i>')
      .replace(/==([^=\n]+)==/g, '<span style="background:#fff3a3">$1</span>');
  };

  baris.forEach(function(b){
    const poin = b.match(/^\s*[-•]\s+(.*)$/);
    const nomor = b.match(/^\s*\d+[.)]\s+(.*)$/);
    if(poin){
      if(mode !== 'ul'){ tutup(); out.push('<ul style="margin:8px 0;padding-left:22px">'); mode = 'ul'; }
      out.push('<li>' + sebaris(poin[1]) + '</li>');
      return;
    }
    if(nomor){
      if(mode !== 'ol'){ tutup(); out.push('<ol style="margin:8px 0;padding-left:22px">'); mode = 'ol'; }
      out.push('<li>' + sebaris(nomor[1]) + '</li>');
      return;
    }
    tutup();
    out.push(sebaris(b) + '<br>');
  });
  tutup();
  return out.join('');
}

/* Versi teks biasa untuk penerima yang memblokir HTML: penandanya dibuang
   supaya tidak terlihat sebagai tanda baca aneh. Garis bawah tidak disentuh —
   lihat catatan di formatTeksHTML. */
function formatTeksPolos(teks){
  return String(teks || '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/(^|[^*])\*([^*\n]+)\*/g, '$1$2')
    .replace(/==([^=\n]+)==/g, '$1');
}

function isiHTML(d, isiTeks, bahasa, finId, opts){
  opts = opts || {};
  const teks = formatTeksHTML(isiTeks);
  return '<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.65;' +
      'color:#111;max-width:720px">' + teks + '</div>' +
    (opts.kwitansi === false ? '' : kwitansiHTML(d, bahasa, finId,
      { kodeKiriman: opts.kodeKiriman, waktuKirim: opts.waktuKirim })) +
    (opts.majalah ? majalahHTML({ tautan: true }) : '') +
    (opts.terimaId ? terimaHTML(opts.terimaId, opts.terimaInfo, { pratinjau: opts.terimaPratinjau }) : '') +
    (opts.pixelId ? pixelHTML(opts.pixelId) : '');
}

/* Alamat tujuan salinan uji. Diambil dari Setelan → Pengaman pengiriman →
   "Alamat email uji". Kalau dikosongkan, pakai alamat Gmail yang tersambung. */
function emailUji(){
  return String(state.settings.emailUji || Gmail.email || '').trim();
}

/* Kirim satu salinan ke email sendiri dulu. Tujuannya supaya user bisa
   memeriksa hasil sungguhan di kotak masuknya sendiri sebelum dikirim ke
   donor. Salinan ini TIDAK masuk riwayat surat donor — ini hanya uji coba.

   Salinan uji memakai tanda dibaca & tombol konfirmasi yang SAMA seperti surat
   sungguhan, supaya yang diuji benar-benar sama dengan yang akan diterima
   donor. Bedanya: catatannya diberi awalan `uji-` dan tidak pernah masuk buku
   donor, jadi tidak mengotori daftar surat keluar. */
async function kirimKeSendiri(){
  const ids = Object.keys(suratState.selected).filter(function(k){ return suratState.selected[k]; });
  if(!ids.length){ toast('Pilih penerima dulu', true); return; }
  if(!suratState.isi.trim()){ toast('Isi surat masih kosong', true); return; }
  if(!Gmail.isConnected()){
    toast('Hubungkan Gmail dulu di halaman Setelan', true);
    return;
  }
  const tujuan = emailUji();
  if(!tujuan){
    toast('Alamat email uji belum ada — isi di Setelan → Pengaman pengiriman', true);
    return;
  }

  /* Pakai penerima pertama sebagai contoh, supaya isi surat & kwitansinya
     benar-benar terisi seperti yang akan diterima donor. */
  const d = findDonor(ids[0]);
  if(!d){ toast('Penerima tidak ditemukan', true); return; }

  const subjek = '[UJI] ' + fillTemplate(suratState.subjek, d);
  const isi = fillTemplate(suratState.isi, d);
  const kode = kodeKiriman();
  const waktu = waktuKirim();
  /* Awalan `uji-` menandai bahwa ini salinan percobaan, bukan surat donor. */
  const pixelId = workerBase() ? ('uji-px-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8)) : '';
  const terimaId = workerBase() ? ('uji-tr-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8)) : '';
  const html = isiHTML(d, isi, suratState.kwitansiBahasa, suratState.kwitansiFinId, {
    kwitansi: !!suratState.kwitansi,
    majalah: !!suratState.majalah,
    kodeKiriman: kode, waktuKirim: waktu,
    pixelId: pixelId,
    terimaId: terimaId,
    terimaInfo: {
      judul: 'Kartidaya Sahabat Indonesia',
      kwitansi: suratState.kwitansi ? dataKwitansi(d, suratState.kwitansiFinId).kode : '',
      jumlah: suratState.kwitansi ? totalTransaksiRingkas(d, suratState.kwitansiFinId) : '',
      donor: donorName(d),
      dikirim: waktu
    }
  });

  const btn = document.querySelector('[data-action="kirim-sendiri"]');
  if(btn){ btn.disabled = true; btn.textContent = 'Mengirim…'; }
  try{
    await Gmail.send({ from: Gmail.email || '', to: tujuan, subject: subjek,
      body: formatTeksPolos(isi), html: html });
    /* Catat supaya hasilnya bisa dilihat di halaman Uji — termasuk apakah
       salinannya sudah dibuka dan apakah tombol konfirmasinya bekerja. */
    catatUji({
      id: 'uji-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      tanggal: new Date().toISOString(),
      tujuan: tujuan, subjek: subjek, donorId: d.id,
      pixelId: pixelId, terimaId: terimaId,
      dibaca: '', dikonfirmasi: '',
      /* Isi HTML disimpan supaya bisa dibuka lagi dari halaman Uji. Dibatasi
         panjangnya supaya localStorage tidak cepat penuh. */
      html: html.length > 400000 ? '' : html
    });
    toast('Salinan uji terkirim ke ' + tujuan + ' — periksa kotak masuk Anda');
    segarkanBarisUji();
  }catch(e){
    toast('Gagal kirim salinan uji: ' + (e.message || e), true);
  }finally{
    if(btn){ btn.disabled = false; btn.textContent = '✉ Kirim ke saya sendiri dulu'; }
  }
}

async function kirimSurat(asDraft){
  const ids = Object.keys(suratState.selected).filter(function(k){ return suratState.selected[k]; });
  if(!ids.length){ toast('Pilih penerima dulu', true); return; }
  if(!suratState.isi.trim()){ toast('Isi surat masih kosong', true); return; }

  /* Pratinjau wajib: kalau aktif, tombol Kirim membuka layar periksa dulu.
     Dari layar itu user menekan "Kirim sekarang" — dan panggilan itu memakai
     penanda `dariPeriksa` supaya tidak berputar tanpa henti. */
  if(!asDraft && !suratState.dariPeriksa && state.settings.wajibPeriksa){
    openPeriksaKirim();
    return;
  }
  suratState.dariPeriksa = false;

  const kanal = suratState.kanal === 'whatsapp' ? 'whatsapp' : 'email';

  /* Perbarui token dulu kalau tinggal sedikit — supaya kirim tidak gagal di
     tengah jalan hanya karena sesi hampir habis. */
  if(!asDraft && kanal === 'email' && Gmail.isConfigured()) await Gmail.ensureConnected();

  const useGmail = kanal === 'email' && Gmail.isConnected() && !asDraft;
  const useWa = kanal === 'whatsapp' && WhatsApp.isConfigured() && WhatsApp.status() === 'connected' && !asDraft;

  /* Jangan pernah mencatat "Terkirim" secara diam-diam saat kanal belum
     terhubung — pesan tidak benar-benar terkirim dan pengguna tidak tahu.
     Minta konfirmasi eksplisit dulu. */
  if(!asDraft && !useGmail && !useWa){
    const apa = kanal === 'whatsapp' ? 'WhatsApp' : 'Gmail';
    const lanjut = confirm(
      apa + ' belum terhubung, jadi pesan TIDAK akan benar-benar terkirim.\n\n' +
      'Pesan hanya akan dicatat sebagai "Terkirim" di riwayat surat donor (mode simulasi).\n\n' +
      'Hubungkan ' + apa + ' di halaman Setelan kalau ingin kirim sungguhan.\n\n' +
      'Lanjutkan mencatat sebagai simulasi?');
    if(!lanjut) return;
  }

  let ok = 0, gagal = 0, errMsg = '';

  /* Cc hanya untuk email. Daftar alamat dirapikan sekali di luar perulangan
     supaya tidak dihitung ulang untuk setiap penerima. */
  const ccBersih = kanal === 'email' ? rapikanCc(suratState.cc) : '';

  /* Lampiran diunggah dulu sebelum surat dikirim. Kalau ada yang gagal,
     surat tetap dikirim tanpa berkas itu — pengguna diberi tahu, bukan
     digagalkan seluruhnya. */
  let lampiranSiap = [];
  if(kanal === 'email' && lampiranSurat().length){
    const hasil = await unggahLampiranSurat();
    if(hasil.gagal){
      toast(hasil.gagal + ' lampiran gagal diunggah: ' + hasil.pesan, true);
    }
    lampiranSiap = lampiranSurat().filter(function(l){ return l.naik && l.url; });
  }

  for(const id of ids){
    const d = findDonor(id);
    if(!d) continue;
    const subjek = fillTemplate(suratState.subjek, d);
    const isi = fillTemplate(suratState.isi, d);
    let status = asDraft ? 'Draft' : 'Terkirim';
    let gmailId = '', threadId = '', waId = '';
    let kwitansiSalinan = '', kwitansiBahasaSalinan = '';
    /* Kode kiriman dibuat per penerima, bukan per surat — supaya kalau ada
       yang perlu ditanyakan, kode di kwitansi donor menunjuk tepat ke satu
       pengiriman. */
    const kodeKrm = asDraft ? '' : kodeKiriman();
    const waktuKrm = asDraft ? '' : waktuKirim();
    const tujuan = kanal === 'whatsapp' ? donorWa(d) : emailUtama(d);
    /* ID pixel dibuat per surat supaya pembukaan oleh satu penerima tidak
       dianggap pembukaan oleh penerima lain. */
    const pixelId = (kanal === 'email' && !asDraft && workerBase())
      ? ('px-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10))
      : '';
    /* ID konfirmasi juga per surat — supaya tombol di email satu penerima
       tidak bisa mengonfirmasi surat penerima lain. */
    const terimaId = (kanal === 'email' && !asDraft && workerBase())
      ? ('tr-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10))
      : '';

    /* Salinan kwitansi dibuat SEBELUM pengiriman, bukan di dalam cabang Gmail.
       Kalau dibuat di dalam cabang Gmail, kwitansi tidak pernah tersimpan saat
       aplikasi berjalan dalam mode simulasi (Gmail belum terhubung) — akibatnya
       riwayat surat tampak "tanpa kwitansi" padahal kwitansinya ikut dicetak. */
    if(suratState.kwitansi){
      kwitansiSalinan = kwitansiHTML(d, suratState.kwitansiBahasa, suratState.kwitansiFinId,
        { kodeKiriman: kodeKrm, waktuKirim: waktuKrm });
      kwitansiBahasaSalinan = suratState.kwitansiBahasa;
    }

    if(useGmail){
      if(!emailUtama(d)){
        status = 'Gagal';
        errMsg = 'Donor ' + d.id + ' belum punya alamat email';
        gagal++;
      }else{
        try{
          /* Kwitansi & majalah dikirim sebagai bagian HTML email, bukan
             lampiran, supaya penerima langsung melihatnya di badan surat. */
          const pakaiHTML = suratState.kwitansi || suratState.majalah || pixelId || terimaId;
          const html = pakaiHTML
            ? isiHTML(d, isi, suratState.kwitansiBahasa, suratState.kwitansiFinId, {
                kwitansi: !!suratState.kwitansi,
                majalah: !!suratState.majalah,
                pixelId: pixelId,
                kodeKiriman: kodeKrm,
                waktuKirim: waktuKrm,
                terimaId: terimaId,
                terimaInfo: {
                  judul: 'Kartidaya Sahabat Indonesia',
                  kwitansi: suratState.kwitansi ? dataKwitansi(d, suratState.kwitansiFinId).kode : '',
                  jumlah: suratState.kwitansi ? totalTransaksiRingkas(d, suratState.kwitansiFinId) : '',
                  donor: donorName(d),
                  dikirim: waktuKrm
                }
              })
            : '';
          const r = await Gmail.send({
            from: Gmail.email || '', to: emailUtama(d), cc: ccBersih, subject: subjek,
            body: formatTeksPolos(isi), html: html
          });
          gmailId = (r && r.id) || '';
          threadId = (r && r.threadId) || '';
          ok++;
        }catch(e){
          status = 'Gagal';
          errMsg = e.message || String(e);
          gagal++;
        }
      }
    }else if(useWa){
      if(!tujuan){
        status = 'Gagal';
        errMsg = 'Donor ' + d.id + ' belum punya nomor HP';
        gagal++;
      }else{
        try{
          /* WhatsApp tidak bisa menampilkan tabel HTML, jadi kwitansi dikirim
             sebagai GAMBAR. Gambar disimpan dulu di Worker supaya WhatsApp
             bisa mengambilnya dari alamat publik. */
          let kwitansiTerkirim = false;
          if(suratState.kwitansi){
            const png = await kwitansiPNG(d, suratState.kwitansiBahasa, suratState.kwitansiFinId,
              { kodeKiriman: kodeKrm, waktuKirim: waktuKrm });
            const kwId = 'kw-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
            const urlKw = await WhatsApp.simpanKwitansi(kwId, png);
            if(urlKw){
              const rk = await WhatsApp.sendMedia({
                to: tujuan, jenis:'image', link: urlKw,
                caption: 'Kwitansi ' + donorName(d) + ' — ' + kodeKrm
              });
              waId = (rk && rk.id) || waId;
              kwitansiTerkirim = true;
            }
          }
          /* Majalah dikirim sebagai lampiran PDF — sesuai keputusan Anda. */
          let majalahTerkirim = false;
          if(suratState.majalah && majalahInfo()){
            const urlPdf = majalahPDFURL();
            if(urlPdf){
              const rm = await WhatsApp.sendMedia({
                to: tujuan, jenis:'document', link: urlPdf,
                filename: (majalahInfo().judul || 'Majalah Kartidaya') + '.pdf',
                caption: majalahInfo().judul || 'Majalah Kartidaya'
              });
              waId = (rm && rm.id) || waId;
              majalahTerkirim = true;
            }
          }
          /* Teks surat selalu dikirim — supaya penerima tetap bisa membaca
             dan menyalin isinya walau gambarnya tidak dibuka. */
          const r = await WhatsApp.send({ to: tujuan, text: isi });
          waId = (r && r.id) || waId;
          if(suratState.kwitansi && !kwitansiTerkirim){
            errMsg = 'Kwitansi tidak ikut terkirim (gambar gagal disimpan)';
          }
          if(suratState.majalah && !majalahTerkirim){
            errMsg = 'Majalah tidak ikut terkirim (PDF belum tersedia)';
          }
          ok++;
        }catch(e){
          status = 'Gagal';
          errMsg = e.message || String(e);
          gagal++;
        }
      }
    }else if(!asDraft){
      ok++;
    }

    addMessage({
      donorId:id, arah:'keluar', tanggal:new Date().toISOString(),
      subjek:subjek, isi:isi, status:status, kanal:kanal,
      from: kanal === 'whatsapp' ? (WhatsApp.phone || '') : (Gmail.email || ''),
      to: tujuan, cc: ccBersih,
      gmailId:gmailId, threadId:threadId, waId:waId, dibaca:true,
      pixelId: pixelId, dibacaPenerima: '',
      terimaId: terimaId, terimaPenerima: '',
      kodeKiriman: kodeKrm, waktuKirim: waktuKrm,
      kwitansiHTML: kwitansiSalinan, kwitansiBahasa: kwitansiBahasaSalinan,
      kwitansiFinId: suratState.kwitansi ? (dataKwitansi(d, suratState.kwitansiFinId).finId || '') : '',
      lampiranBerkas: lampiranSiap.map(function(l){
        return { id:l.id, nama:l.nama, tipe:l.tipe, ukuran:l.ukuran, url:l.url };
      }),
      majalah: (kanal === 'email' && suratState.majalah) ? majalahInfo() : null
    });

    /* Surat masuk terakhir dari donor ini ditandai "Dibalas" begitu balasan
       benar-benar terkirim, supaya statusnya tidak tertinggal "Dibaca". */
    if(status === 'Terkirim'){
      const masuk = state.messages.filter(function(m){
        return m.arah === 'masuk' && m.donorId === id && m.status !== 'Dibalas';
      }).sort(function(a,b){ return String(a.tanggal).localeCompare(String(b.tanggal)); });
      if(masuk.length){
        masuk[masuk.length - 1].status = 'Dibalas';
        save('messages');
      }
    }
  }

  const namaKanal = LABEL_KANAL[kanal];
  /* Catat pengiriman ke CCTV — supaya kalau ada surat yang salah kirim,
     bisa ditelusuri siapa yang mengirim dan kapan. */
  catatAksi(asDraft ? 'simpan' : 'kirim', 'surat',
    (suratState.subjek || '(tanpa subjek)').slice(0, 120),
    ids.length + ' penerima · ' + namaKanal +
    (lampiranSiap.length ? ' · ' + lampiranSiap.length + ' lampiran' : '') +
    (gagal ? ' · ' + gagal + ' gagal' : ''));
  if(asDraft) toast(ids.length + ' surat disimpan sebagai Draft');
  else if(useGmail || useWa) toast(ok + ' terkirim lewat ' + namaKanal + (gagal ? ', ' + gagal + ' gagal: ' + errMsg : ''), gagal > 0);
  else toast(ids.length + ' surat dicatat sebagai Terkirim (mode simulasi)');

  suratState.selected = {};
  suratState.lampiran = [];
  render();
}

/* Rapikan daftar Cc: buang spasi & alamat kosong, buang alamat yang tidak
   berbentuk email, dan hilangkan duplikat. Hasilnya satu baris dipisah koma
   seperti yang diminta header email. */
function rapikanCc(teks){
  const lihat = {};
  return String(teks || '')
    .split(/[,;\s]+/)
    .map(function(s){ return s.trim(); })
    .filter(function(s){
      if(!s || s.indexOf('@') < 1) return false;
      const k = s.toLowerCase();
      if(lihat[k]) return false;
      lihat[k] = true;
      return true;
    })
    .join(', ');
}

/* Ambil alamat Cc dari surat asal, tanpa alamat donor sendiri dan tanpa
   alamat kita — supaya "Balas semua" tidak mengirim salinan ke diri sendiri. */
function ccUntukBalasSemua(m, d){
  const sendiri = [emailOf(m.to || ''), emailOf(Gmail.email || '')];
  const punyaDonor = d ? emailDonor(d) : [];
  return rapikanCc(m.cc || '')
    .split(', ')
    .filter(function(a){
      if(!a) return false;
      const k = a.toLowerCase();
      if(punyaDonor.indexOf(k) >= 0) return false;
      return sendiri.indexOf(k) < 0;
    })
    .join(', ');
}

/* Kepala surat untuk "Teruskan" — memberi tahu penerima baru siapa penulis
   aslinya, kapan, dan kepada siapa surat itu dulu dikirim. */
function kepalaTeruskan(m){
  const baris = [
    '---------- Surat yang diteruskan ----------',
    'Dari: ' + (m.from || '—'),
    'Kepada: ' + (m.to || '—')
  ];
  if(m.cc) baris.push('Cc: ' + m.cc);
  baris.push('Tanggal: ' + fmtDateTime(m.tanggal));
  baris.push('Subjek: ' + (m.subjek || '—'));
  baris.push('');
  return baris.join('\n');
}

function printLetter(d){
  const w = window.open('', '_blank');
  if(!w){ toast('Popup diblokir browser', true); return; }
  const subjek = fillTemplate(suratState.subjek, d);
  const isi = fillTemplate(suratState.isi, d);
  w.document.write('<!DOCTYPE html><html><head><meta charset="utf-8"><title>' + esc(subjek) +
    '</title><style>body{font-family:Georgia,serif;max-width:720px;margin:48px auto;padding:0 24px;' +
    'line-height:1.8;color:#111;white-space:pre-wrap;font-size:15px}' +
    'h1{font-size:16px;font-weight:600;border-bottom:1px solid #ccc;padding-bottom:8px;margin-bottom:24px}' +
    '</style></head><body><h1>' + esc(subjek) + '</h1>' + esc(isi) + '</body></html>');
  w.document.close();
  w.focus();
  setTimeout(function(){ w.print(); }, 300);
}

/* Cetak label alamat untuk kiriman manual (POS / kurir). Ukuran & tata letak
   dibuat sederhana supaya bisa ditempel di amplop atau diserahkan ke kurir. */
function printAlamat(d){
  if(!d) return;
  if(!d.alamat){ toast('Donor ini belum punya alamat lengkap', true); return; }
  const w = window.open('', '_blank');
  if(!w){ toast('Popup diblokir browser', true); return; }
  const baris = String(d.alamat).split(/\r?\n/).map(function(s){ return esc(s); }).join('<br>');
  w.document.write('<!DOCTYPE html><html><head><meta charset="utf-8"><title>Alamat — ' +
    esc(donorName(d)) + '</title><style>' +
    '@page{margin:14mm}' +
    'body{font-family:Arial,Helvetica,sans-serif;color:#111;margin:0}' +
    '.label{border:2px solid #222;border-radius:6px;padding:18px 20px;max-width:520px}' +
    '.kepada{font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:#666;margin-bottom:6px}' +
    '.nama{font-size:20px;font-weight:bold;line-height:1.3}' +
    '.inst{font-size:14px;color:#333;margin-top:2px}' +
    '.alamat{font-size:15px;line-height:1.7;margin-top:12px;white-space:normal}' +
    '.id{font-size:11px;color:#666;margin-top:14px;font-family:monospace}' +
    '.hp{font-size:13px;margin-top:8px}' +
    '</style></head><body><div class="label">' +
      '<div class="kepada">Kepada</div>' +
      '<div class="nama">' + esc(donorLabel(d)) + '</div>' +
      (d.instansi && d.instansi !== donorName(d) ? '<div class="inst">' + esc(d.instansi) + '</div>' : '') +
      '<div class="alamat">' + baris + '</div>' +
      (hpUtama(d) ? '<div class="hp">☎ ' + esc(hpUtama(d)) + (hpLain(d) ? ' / ' + esc(hpLain(d)) : '') + '</div>' : '') +
      '<div class="id">' + esc(d.id) + '</div>' +
    '</div></body></html>');
  w.document.close();
  w.focus();
  setTimeout(function(){ w.print(); }, 300);
}

/* ---------- CETAK LABEL ALAMAT (kiriman POS / kurir) ----------
   Kenapa ukuran ini yang dipakai?
   Untuk kirim surat lewat pos, yang dibutuhkan adalah label stiker A4 yang
   tinggal ditempel. Ukuran yang paling mudah dicari di toko/market adalah
   label alamat A4 standar Avery:

     L7163 — 2 kolom × 7 baris = 14 label, tiap label 99,1 × 38,1 mm
     L7160 — 3 kolom × 7 baris = 21 label, tiap label 63,5 × 38,1 mm

   Keduanya memakai lembar A4 yang sama dan tinggi label yang sama, jadi
   pengaturan printer tidak berubah. L7163 dipakai sebagai bawaan karena
   labelnya lebih lebar — alamat panjang tidak cepat terpotong.

   Angka margin di bawah BUKAN perkiraan: dengan lebar A4 210 mm dan tinggi
   297 mm, sisa ruangnya pas:
     L7163: 2 × 99,1 + 2,54 (jarak kolom) + 4,65 (margin kiri) ≈ 205,3 mm
     L7160: 3 × 63,5 + 2 × 2,5 (jarak kolom) + 7,25 (margin kiri) ≈ 202,8 mm
   Kalau angka ini salah sedikit saja, label akan bergeser dan tidak pas
   dengan potongan stikernya. */
const LABEL_PRESET = [
  { id:'l7163', nama:'2 kolom · 14 label per lembar (Avery L7163)', kolom:2, baris:7,
    lebar:99.06, tinggi:38.1, kiri:4.65, atas:12.7, jarakX:2.54, jarakY:0 },
  { id:'l7160', nama:'3 kolom · 21 label per lembar (Avery L7160)', kolom:3, baris:7,
    lebar:63.5, tinggi:38.1, kiri:7.25, atas:12.7, jarakX:2.5, jarakY:0 }
];
function labelPreset(id){
  return LABEL_PRESET.filter(function(p){ return p.id === id; })[0] || LABEL_PRESET[0];
}
function labelPerLembar(p){ return p.kolom * p.baris; }

/* Isi satu label. Ukuran huruf memakai satuan em, bukan pt, supaya seluruh
   isi bisa dikecilkan bersamaan kalau ternyata tidak muat — lihat
   labelAutoFit() di bawah. Ukuran dasarnya mengikuti lebar label: label
   3 kolom lebih sempit, jadi dasarnya lebih kecil. */
function labelIsiHTML(d, p, opsi){
  opsi = opsi || {};
  const dasar = p.lebar < 80 ? 8.2 : 9.5;
  const baris = String(d.alamat || '')
    .split(/\r?\n/)
    .map(function(s){ return s.trim(); })
    .filter(function(s){ return !!s; })
    .map(function(s){ return esc(s); })
    .join('<br>');
  const hp = hpUtama(d)
    ? '<span class="lb-hp">&#9742; ' + esc(hpUtama(d)) +
      (hpLain(d) ? ' / ' + esc(hpLain(d)) : '') + '</span>'
    : '';
  return '<div class="lb-isi" style="font-size:' + dasar + 'pt">' +
      '<div class="lb-kepada">Kepada</div>' +
      '<div class="lb-nama">' + esc(donorLabel(d)) + '</div>' +
      (d.instansi && d.instansi !== donorName(d)
        ? '<div class="lb-inst">' + esc(d.instansi) + '</div>' : '') +
      (baris ? '<div class="lb-alamat">' + baris + '</div>' : '') +
      /* Nomor HP dan ID ditaruh sebaris: menghemat satu baris tinggi, yang
         penting karena tinggi label hanya 38,1 mm. */
      ((hp || opsi.idTampil !== false)
        ? '<div class="lb-kaki">' + hp +
          (opsi.idTampil === false ? '' : '<span class="lb-id">' + esc(d.id) + '</span>') +
          '</div>'
        : '') +
    '</div>';
}

/* Kalau isi label lebih tinggi dari labelnya, huruf dikecilkan sedikit demi
   sedikit sampai muat. Ini penting karena alamat donor tidak seragam: ada yang
   satu baris, ada yang tiga baris dengan nama instansi panjang. Tanpa ini,
   alamat panjang akan terpotong tanpa pemberitahuan — dan surat tidak sampai.
   Batas bawah 5 pt supaya tidak menjadi tidak terbaca; kalau masih tidak muat
   pada ukuran itu, lebih baik terpotong daripada tidak tercetak sama sekali. */
function labelAutoFitScript(){
  return '<scr' + 'ipt>(function(){' +
    'function fit(){' +
      'var isi=document.querySelectorAll(".lb-isi");' +
      'for(var i=0;i<isi.length;i++){' +
        'var el=isi[i],box=el.parentNode;' +
        'var cs=window.getComputedStyle(box);' +
        'var avail=box.clientHeight-parseFloat(cs.paddingTop||0)-parseFloat(cs.paddingBottom||0);' +
        'var size=parseFloat(el.style.fontSize)||9;' +
        'var n=0;' +
        'while(el.scrollHeight>avail+0.5&&size>5&&n<80){' +
          'size-=0.25;el.style.fontSize=size+"pt";n++;' +
        '}' +
      '}' +
    '}' +
    'fit();' +
    'window.addEventListener("load",fit);' +
    'if(document.fonts&&document.fonts.ready){document.fonts.ready.then(fit);}' +
  '})();</scr' + 'ipt>';
}

/* CSS satu-satunya untuk label — dipakai baik oleh jendela cetak maupun
   pratinjau, supaya yang dilihat sama dengan yang tercetak. */
function labelCSS(){
  return '@page{size:A4;margin:0}' +
    'html,body{margin:0;padding:0;background:#fff}' +
    'body{font-family:Arial,Helvetica,sans-serif;color:#111}' +
    '.lb-lembar{width:210mm;height:297mm;box-sizing:border-box;overflow:hidden;' +
      'display:grid;page-break-after:always;break-after:page}' +
    '.lb-lembar:last-child{page-break-after:auto;break-after:auto}' +
    '.lb-sel{box-sizing:border-box;overflow:hidden;padding:2mm 3mm;' +
      'display:flex;flex-direction:column;justify-content:center}' +
    '.lb-sel.potong{outline:1px dashed #b7b7b0;outline-offset:-0.5px}' +
    '.lb-isi{line-height:1.28;overflow-wrap:anywhere}' +
    '.lb-kepada{font-size:.68em;letter-spacing:.09em;text-transform:uppercase;' +
      'color:#666;margin-bottom:.6mm}' +
    '.lb-nama{font-size:1.2em;font-weight:700;line-height:1.2}' +
    '.lb-inst{font-size:1em;margin-top:.3mm}' +
    '.lb-alamat{font-size:1em;line-height:1.3;margin-top:.9mm}' +
    '.lb-kaki{display:flex;gap:3mm;align-items:baseline;flex-wrap:wrap;margin-top:1mm}' +
    '.lb-hp{font-size:.86em}' +
    '.lb-id{font-size:.72em;color:#777;' +
          'font-family:ui-monospace,Consolas,monospace;letter-spacing:.02em}';
}

/* Satu atau beberapa lembar label. `mulai` = label ke berapa pada lembar
   pertama yang dipakai — berguna kalau lembar stiker sudah terpakai
   sebagian: label yang sudah hilang tidak perlu dicetak ulang. */
function labelLembarHTML(p, daftar, opsi){
  opsi = opsi || {};
  const per = labelPerLembar(p);
  const mulai = Math.min(Math.max(1, Number(opsi.mulai) || 1), per);
  const slot = [];
  for(let i = 1; i < mulai; i++) slot.push(null);
  daftar.forEach(function(d){ slot.push(d); });
  while(slot.length % per) slot.push(null);

  const gayaLembar = 'grid-template-columns:repeat(' + p.kolom + ',' + p.lebar + 'mm);' +
    'grid-auto-rows:' + p.tinggi + 'mm;column-gap:' + p.jarakX + 'mm;row-gap:' + p.jarakY + 'mm;' +
    'padding:' + p.atas + 'mm 0 0 ' + p.kiri + 'mm';
  const kelasSel = 'lb-sel' + (opsi.potong ? ' potong' : '');

  let html = '';
  for(let i = 0; i < slot.length; i += per){
    const isi = slot.slice(i, i + per).map(function(d){
      return d
        ? '<div class="' + kelasSel + '">' + labelIsiHTML(d, p, opsi) + '</div>'
        : '<div class="lb-sel"></div>';
    }).join('');
    html += '<div class="lb-lembar" style="' + gayaLembar + '">' + isi + '</div>';
  }
  return html;
}

/* Buka jendela cetak label. Nomor halaman & catatan tidak ikut dicetak —
   hanya lembarnya, supaya tidak ada teks nyasar di area stiker. */
function cetakLabelHTML(p, daftar, opsi){
  const w = window.open('', '_blank');
  if(!w){ toast('Popup diblokir browser', true); return; }
  w.document.write('<!DOCTYPE html><html lang="id"><head><meta charset="utf-8">' +
    '<title>Label alamat</title><style>' + labelCSS() + '</style></head><body>' +
      labelLembarHTML(p, daftar, opsi) + labelAutoFitScript() +
    '</body></html>');
  w.document.close();
  w.focus();
    /* Jangan menunggu auto-fit selesai baru mencetak: kalau lama, pengguna
       melihat halaman kosong dan menekan Ctrl+P sendiri. Jeda 600 ms cukup
       untuk skrip mengecilkan huruf pada 14–21 label. */
    setTimeout(function(){ w.print(); }, 600);
}

/* Keadaan kotak "Cetak label" — disimpan di sini, bukan di state aplikasi,
   karena hanya berlaku selama kotak terbuka. */
let labelState = { preset:'l7163', mulai:1, potong:false, idTampil:true, ids:[] };

/* Pratinjau dihitung dari lebar kotak saat itu. Kalau jendela browser
   dikecilkan (mis. dibuka di HP setelah disiapkan di komputer), ukuran iframe
   yang sudah terlanjur dihitung akan melebar keluar kotak. Jadi dihitung ulang
   setiap kali layar berubah ukuran. Pendengar dilepas sendiri begitu kotak
   labelnya ditutup. */
function labelIkutUkuranLayar(){
  if(!document.getElementById('label-preview')){
    window.removeEventListener('resize', labelIkutUkuranLayar);
    return;
  }
  segarkanLabel();
}

function openCetakLabel(ids, judul){
  const daftar = (ids || []).map(findDonor).filter(Boolean);
  const ada = daftar.filter(function(d){ return String(d.alamat || '').trim(); });
  if(!daftar.length){ toast('Pilih donor dulu', true); return; }
  if(!ada.length){
    toast('Tidak ada donor dengan alamat lengkap — isi Alamat Lengkap di data donor', true);
    return;
  }
  labelState.ids = ids;
  labelState.preset = state.settings.labelPreset || 'l7163';
  labelState.mulai = 1;
  labelState.potong = false;
  labelState.idTampil = true;

  const kurang = daftar.length - ada.length;
  const presetOpts = LABEL_PRESET.map(function(p){
    return '<option value="' + p.id + '"' + (p.id === labelState.preset ? ' selected' : '') + '>' +
      esc(p.nama) + '</option>';
  }).join('');

  const body =
    (kurang
      ? '<div class="warnbox">' + kurang + ' dari ' + daftar.length + ' donor <b>belum punya alamat ' +
        'lengkap</b>, jadi tidak ikut dicetak. Isi <b>Alamat Lengkap</b> di data donor kalau ' +
        'suratnya dikirim lewat pos.</div>'
      : '') +
    '<div class="field"><label>Ukuran label <span class="hint">— stiker A4 yang dijual umum</span></label>' +
      '<select id="lb-preset">' + presetOpts + '</select></div>' +
    '<div class="form-grid">' +
      '<div class="field"><label>Mulai dari label ke- <span class="hint">— kalau lembar sudah terpakai</span></label>' +
        '<input type="number" id="lb-mulai" min="1" step="1" value="1"></div>' +
      '<div class="field"><label>Tampilan</label>' +
        '<label class="row" style="gap:6px;font-size:13px;font-weight:400;color:var(--text)">' +
          '<input type="checkbox" id="lb-potong"> Garis putus-putus untuk potong sendiri</label>' +
        '<label class="row" style="gap:6px;font-size:13px;font-weight:400;color:var(--text)">' +
          '<input type="checkbox" id="lb-id" checked> Tulis ID-DONOR di label</label>' +
      '</div>' +
    '</div>' +
    '<div class="okbox" id="label-info"></div>' +
    '<div class="sep"></div>' +
    '<p class="small" style="margin:0 0 8px"><b>Contoh lembar pertama</b> ' +
      '<span class="hint">— ukuran dan letaknya sama dengan yang tercetak</span></p>' +
    '<div id="label-preview" class="label-preview"></div>' +
    '<p class="tiny muted" style="margin:10px 0 0">' +
      'Di jendela cetak, pilih <b>Ukuran / Scale: 100%</b> (bukan &ldquo;Fit to page&rdquo;), ' +
      'dan matikan <b>Header and footer</b>. Kalau tidak, label akan bergeser dari potongannya. ' +
      'Kertas harus A4.</p>';

  openModal({
    title: judul || 'Cetak label alamat',
    body: body,
    wide: true,
    kelas: 'label-modal',
    footer: '<button class="btn" data-close>Batal</button>' +
      '<button class="btn primary" data-action="label-cetak">&#9113; Cetak label</button>',
    onOpen: function(root){
          segarkanLabel();
          window.addEventListener('resize', labelIkutUkuranLayar);
          const p = root.querySelector('#lb-preset');
          if(p) p.addEventListener('change', function(){
            labelState.preset = this.value;
            /* Ukuran stiker yang dipakai disimpan sebagai pilihan komputer ini
               (bukan data bersama) — supaya tidak perlu dipilih ulang tiap kali
               mencetak. Yang menyimpan biasanya hanya satu ukuran yang dibeli. */
            state.settings.labelPreset = labelState.preset;
            save('settings');
            /* Nomor "mulai" dibatasi ulang mengikuti jumlah label per lembar
               ukuran yang baru. */
            labelState.mulai = 1;
            const m = root.querySelector('#lb-mulai');
            if(m) m.value = '1';
            segarkanLabel();
          });
          const m = root.querySelector('#lb-mulai');
          if(m) m.addEventListener('input', function(){
            labelState.mulai = Number(this.value) || 1;
            segarkanLabel();
          });
          const pot = root.querySelector('#lb-potong');
          if(pot) pot.addEventListener('change', function(){
            labelState.potong = this.checked; segarkanLabel();
          });
          const idl = root.querySelector('#lb-id');
          if(idl) idl.addEventListener('change', function(){
            labelState.idTampil = this.checked; segarkanLabel();
          });
        }
  });
}

/* Hitung ulang keterangan + pratinjau tanpa menggambar ulang seluruh kotak,
   supaya pilihan yang sedang diubah tidak kehilangan fokus. */
function segarkanLabel(){
  const info = document.getElementById('label-info');
  const wadah = document.getElementById('label-preview');
  if(!info || !wadah) return;

  const p = labelPreset(labelState.preset);
  const per = labelPerLembar(p);
  labelState.mulai = Math.min(Math.max(1, Number(labelState.mulai) || 1), per);
    /* Tulis balik ke kotak isian: kalau pengguna mengetik 99 pada lembar 14
       label, angkanya dibatasi ke 14 — dan kotaknya harus ikut menunjukkan itu,
       supaya tidak terlihat seolah yang dicetak mulai dari label ke-99. */
    const kotakMulai = document.getElementById('lb-mulai');
    if(kotakMulai && String(kotakMulai.value) !== String(labelState.mulai)){
      kotakMulai.value = String(labelState.mulai);
    }

  const daftar = labelState.ids.map(findDonor).filter(function(d){
    return d && String(d.alamat || '').trim();
  });
  const lembar = Math.max(1, Math.ceil((daftar.length + labelState.mulai - 1) / per));

  info.innerHTML = '<b>' + daftar.length + ' label</b> dicetak pada <b>' + lembar + ' lembar</b> · ' +
    'mulai dari label ke-' + labelState.mulai + ' · ' + per + ' label per lembar. ' +
    (daftar.length + labelState.mulai - 1 > lembar * per
      ? 'Sebagian label di lembar terakhir dibiarkan kosong.'
      : (daftar.length + labelState.mulai - 1 === lembar * per
          ? 'Lembar terakhir terisi penuh.'
          : 'Sisa ' + (lembar * per - (daftar.length + labelState.mulai - 1)) + ' label di lembar terakhir dibiarkan kosong.'));

  /* Pratinjau memakai HTML yang sama persis dengan jendela cetak — bedanya
     hanya diperkecil. Kalau pratinjau dibuat terpisah, cepat atau lambat
     keduanya akan berbeda. */
  const opsi = { mulai:labelState.mulai, potong:labelState.potong, idTampil:labelState.idTampil };
  const html = labelLembarHTML(p, daftar, opsi);

  const tersedia = Math.max(120, (wadah.clientWidth || 640) - 2);
  const lebarA4 = 210 * 96 / 25.4;      /* 793,7 px */
  const tinggiA4 = 297 * 96 / 25.4;     /* 1122,5 px */
  const k = Math.min(tersedia / lebarA4, 470 / tinggiA4);

  wadah.innerHTML = '<iframe class="label-frame" title="Pratinjau label" ' +
    'style="width:' + Math.round(lebarA4 * k) + 'px;height:' + Math.round(tinggiA4 * k) + 'px">' +
    '</iframe>';
  const f = wadah.querySelector('iframe');
  if(f){
    f.srcdoc = '<!DOCTYPE html><html><head><meta charset="utf-8"><style>' + labelCSS() +
      'body{width:210mm;height:297mm;transform:scale(' + k.toFixed(4) + ');transform-origin:top left}' +
          '</style></head><body>' + html + labelAutoFitScript() + '</body></html>';
  }
}

/* Cetak dari kotak yang sedang terbuka. */
function cetakLabelSekarang(){
  const p = labelPreset(labelState.preset);
  const daftar = labelState.ids.map(findDonor).filter(function(d){
    return d && String(d.alamat || '').trim();
  });
  if(!daftar.length){ toast('Tidak ada donor dengan alamat lengkap', true); return; }
  cetakLabelHTML(p, daftar, {
    mulai: labelState.mulai,
    potong: labelState.potong,
    idTampil: labelState.idTampil
  });
  catatAksi('cetak', 'surat', 'Label alamat',
    daftar.length + ' label · ' + p.id.toUpperCase() + ' · ' + labelPerLembar(p) + ' per lembar');
}

/* ---------- 11. GMAIL ---------- */
async function gmailConnect(){
  const el = document.getElementById('g-client');
  const cid = el ? el.value.trim() : state.settings.gmailClientId;
  if(!cid){ toast('Isi OAuth Client ID dulu', true); return; }
  state.settings.gmailClientId = cid;
  save('settings');
  try{
    toast('Membuka jendela izin Google…');
    await Gmail.connect(cid);
    toast('Terhubung ke ' + (Gmail.email || 'Gmail'));
    render();
  }catch(e){
    toast('Gagal: ' + (e.message || e), true);
  }
}
/* Cocokkan ulang surat masuk yang belum punya donor — dipakai setelah email
   atau nomor HP donor diisi/diubah, tanpa perlu menarik ulang dari Gmail. */
function cocokkanUlang(){
  let n = 0;
  state.messages.forEach(function(m){
    if(m.arah !== 'masuk' || m.donorId) return;
    const d = m.kanal === 'whatsapp' ? donorByPhone(m.from) : donorByEmail(emailOf(m.from));
    if(d){ m.donorId = d.id; n++; }
  });
  if(n){ save('messages'); toast(n + ' surat dicocokkan ke donor'); }
  else toast('Tidak ada surat yang bisa dicocokkan');
  render();
}

async function gmailSync(opts){
  opts = opts || {};
  const senyap = !!opts.silent;
  if(!Gmail.isConfigured()){ if(!senyap) toast('Isi Client ID dulu di Setelan', true); return; }
  /* Perbarui token dulu kalau hampir habis, supaya sinkron tidak gagal. */
  await Gmail.ensureConnected();
  if(!Gmail.isConnected()){ if(!senyap) toast('Hubungkan Gmail dulu di Setelan', true); return; }
  if(!senyap) toast('Menarik surat masuk…');
  try{
    const ids = await Gmail.listIds('in:inbox newer_than:90d', 40);
    const known = {};
    state.messages.forEach(function(m){ if(m.gmailId) known[m.gmailId] = true; });

    let baru = 0, takDikenal = 0;
    for(const gid of ids){
      if(known[gid]) continue;
      const raw = await Gmail.getMessage(gid);
      const p = parseGmailMessage(raw);
      const fromAddr = emailOf(p.from);
      const d = donorByEmail(fromAddr);
      if(!d) takDikenal++;
      addMessage({
        donorId: d ? d.id : '',
        arah:'masuk',
        tanggal:p.tanggal,
        subjek:p.subjek,
        isi:p.isi,
        status:'Belum dibaca',
        from:p.from,
        to:p.to,
        cc:p.cc,
        gmailId:p.gmailId,
        threadId:p.threadId,
        dibaca:false
      });
      baru++;
    }
    /* Surat yang dulu masuk sebagai "Belum Dikenal" dicocokkan ulang —
       email donor mungkin baru diisi setelah surat itu ditarik. Tanpa ini,
       surat lama tidak pernah pindah ke buku donor. */
    let cocok = 0;
    state.messages.forEach(function(m){
      if(m.arah !== 'masuk' || m.donorId || m.kanal === 'whatsapp') return;
      const d = donorByEmail(emailOf(m.from));
      if(d){ m.donorId = d.id; cocok++; }
    });
    if(cocok) save('messages');

    state.settings.lastSync = new Date().toISOString();
    save('settings');

    if(baru){
      toast(baru + ' surat masuk baru' + (takDikenal ? ' (' + takDikenal + ' belum dikenal)' : ''));
    }else if(cocok){
      toast(cocok + ' surat lama dicocokkan ke donor');
    }else if(!senyap){
      toast('Tidak ada surat baru');
    }
    render();
  }catch(e){
    if(!senyap) toast('Sinkron gagal: ' + (e.message || e), true);
  }
}

/* ---------- 17. SINKRON OTOMATIS ---------- */
/* Tarik surat masuk sendiri di latar belakang: saat aplikasi dibuka, saat tab
   kembali aktif, dan berkala sesuai interval di Setelan. Pengguna tidak perlu
   lagi membuka Setelan hanya untuk menekan Sinkron. */
let _syncJalan = false;
async function sinkronOtomatis(paksa){
  if(terkunciServer) return;                            /* aplikasi sedang dikunci */
  if(!state.settings.autoSync) return;
  if(!Gmail.isConfigured()) return;
  if(!Gmail.isConnected() && !Gmail.msLeft()) return;   /* belum pernah login */
  if(_syncJalan) return;                                /* hindari tumpang tindih */
  const jeda = Math.max(1, Number(state.settings.syncMinutes) || 10) * 60 * 1000;
  const terakhir = state.settings.lastSync ? Date.parse(state.settings.lastSync) : 0;
  if(!paksa && terakhir && Date.now() - terakhir < jeda) return;
  _syncJalan = true;
  try{
    /* Jaring pengaman: kalau jaringan menggantung, jangan biarkan penanda
       `_syncJalan` menyala selamanya — sinkron berikutnya jadi tidak jalan. */
    await Promise.race([
      gmailSync({ silent:true }),
      new Promise(function(res){ setTimeout(res, 60000); })
    ]);
  }catch(e){ /* gmailSync sudah menangani errornya sendiri */ }
  finally{ _syncJalan = false; }
}

/* ---------- 17b. SINKRON WHATSAPP OTOMATIS ---------- */
/* Sama seperti Gmail: pesan WhatsApp ditarik sendiri di latar belakang supaya
   pengguna tidak perlu bolak-balik ke Setelan. */
let _waSyncJalan = false;
async function waSinkronOtomatis(paksa){
  if(WA_DITUNDA) return;
  if(terkunciServer) return;                            /* aplikasi sedang dikunci */
  if(!state.settings.waAutoSync) return;
  if(!WhatsApp.isConfigured()) return;
  if(_waSyncJalan) return;
  const jeda = Math.max(1, Number(state.settings.waSyncMinutes) || 10) * 60 * 1000;
  const terakhir = state.settings.waLastSync ? Date.parse(state.settings.waLastSync) : 0;
  if(!paksa && terakhir && Date.now() - terakhir < jeda) return;
  _waSyncJalan = true;
  try{
    await Promise.race([
      waSync({ silent:true }),
      new Promise(function(res){ setTimeout(res, 60000); })
    ]);
  }catch(e){ /* waSync sudah menangani errornya sendiri */ }
  finally{ _waSyncJalan = false; }
}

/* ---------- 11b. WHATSAPP ---------- */
/* Simpan alamat Worker + kunci aplikasi, lalu uji sambungan. */
async function waConnect(){
  const eEl = document.getElementById('w-endpoint');
  const kEl = document.getElementById('w-key');
  const endpoint = (eEl ? eEl.value : '').trim().replace(/\/+$/, '');
  const appKey = (kEl ? kEl.value : '').trim();
  if(!endpoint){ toast('Isi alamat Worker dulu', true); return; }
  if(!/^https:\/\//i.test(endpoint) && !/^http:\/\/localhost/i.test(endpoint)){
    toast('Alamat Worker harus diawali https://', true); return;
  }
  if(!appKey){ toast('Isi kunci aplikasi dulu', true); return; }

  WhatsApp.endpoint = endpoint;
  WhatsApp.appKey = appKey;
  state.settings.waEndpoint = endpoint;
  save('settings');
  WhatsApp.saveSession();

  try{
    toast('Menguji sambungan ke Worker…');
    const r = await WhatsApp.ping();
    WhatsApp.phone = r.display || '';
    WhatsApp.saveSession();
    if(!r.configured){
      toast('Worker tersambung, tapi WA_TOKEN / WA_PHONE_ID belum diisi di Worker', true);
    }else{
      toast('WhatsApp tersambung' + (r.display ? ' — ' + r.display : ''));
    }
    render();
  }catch(e){
    toast('Gagal menyambung: ' + (e.message || e), true);
    render();
  }
}

/* Periksa kabar status pesan WhatsApp yang sudah dikirim. Meta mengabari
   lewat webhook: sent → delivered → read, atau failed. Tanpa ini, pesan yang
   ditolak Meta (mis. di luar jendela 24 jam) tetap terlihat "Terkirim". */
async function waCekStatus(){
  if(!WhatsApp.isConfigured()) return 0;
  const tertunda = state.messages.filter(function(m){
    return m.kanal === 'whatsapp' && m.arah === 'keluar' && m.waId && m.status === 'Terkirim';
  });
  if(!tertunda.length) return 0;
  let kabar;
  try{
    kabar = await WhatsApp.statusPesan(tertunda.map(function(m){ return m.waId; }));
  }catch(e){ return 0; }

  let berubah = 0;
  tertunda.forEach(function(m){
    const s = kabar[m.waId];
    if(!s) return;
    if(s.status === 'failed'){
      m.status = 'Gagal';
      m.waError = s.detail || s.pesan || 'Ditolak Meta';
      m.waKode = s.kode || null;
      berubah++;
    }else if(s.status === 'delivered' || s.status === 'read'){
      m.waTerkirim = s.status;
      berubah++;
    }
  });
  if(berubah) save('messages');
  return berubah;
}

/* Tarik pesan WhatsApp yang masuk lewat webhook Worker, cocokkan ke donor
   lewat nomor HP, lalu tandai sudah diambil supaya tidak ditarik dua kali. */
async function waSync(opts){
  opts = opts || {};
  const senyap = !!opts.silent;
  if(!WhatsApp.isConfigured()){ if(!senyap) toast('Isi alamat Worker & kunci aplikasi di Setelan', true); return; }
  if(!senyap) toast('Menarik pesan WhatsApp…');
  try{
    const pesan = await WhatsApp.fetchInbox();
    const ada = {};
    state.messages.forEach(function(m){ if(m.waId) ada[m.waId] = true; });

    let baru = 0, takDikenal = 0;
    const diambil = [];
    pesan.forEach(function(p){
      if(p.waId && ada[p.waId]){ diambil.push(p.waId); return; }
      const d = donorByPhone(p.from);
      if(!d) takDikenal++;
      addMessage({
        donorId: d ? d.id : '',
        arah:'masuk',
        kanal:'whatsapp',
        tanggal: p.waktu || new Date().toISOString(),
        subjek: 'WhatsApp dari ' + (p.nama || waPhonePretty(p.from) || p.from),
        isi: p.teks || '',
        status:'Belum dibaca',
        from: p.from,
        to: WhatsApp.phone || '',
        waId: p.waId || '',
        waNama: p.nama || '',
        dibaca:false
      });
      if(p.waId) diambil.push(p.waId);
      baru++;
    });

    /* Nomor donor mungkin baru diisi setelah pesan lama masuk — cocokkan ulang
       supaya pesan itu pindah ke buku donor yang benar. */
    let cocok = 0;
    state.messages.forEach(function(m){
      if(m.arah !== 'masuk' || m.kanal !== 'whatsapp' || m.donorId) return;
      const d = donorByPhone(m.from);
      if(d){ m.donorId = d.id; cocok++; }
    });
    if(cocok) save('messages');

    if(diambil.length){
      try{ await WhatsApp.ack(diambil); }catch(e){ /* biarkan di antrean */ }
    }

    /* Cek juga kabar status pesan keluar — pesan yang ditolak Meta harus
       berubah jadi "Gagal", bukan tetap "Terkirim". */
    let gagal = 0;
    try{ gagal = await waCekStatus(); }catch(e){ /* abaikan */ }

    state.settings.waLastSync = new Date().toISOString();
    save('settings');

    if(baru){
      toast(baru + ' pesan WhatsApp baru' + (takDikenal ? ' (' + takDikenal + ' belum dikenal)' : ''));
    }else if(gagal){
      toast(gagal + ' pesan WhatsApp gagal terkirim — cek riwayat surat donor', true);
    }else if(cocok){
      toast(cocok + ' pesan lama dicocokkan ke donor');
    }else if(!senyap){
      toast('Tidak ada pesan WhatsApp baru');
    }
    render();
  }catch(e){
    if(!senyap) toast('Sinkron WhatsApp gagal: ' + (e.message || e), true);
  }
}

/* Cocokkan ulang pesan WhatsApp yang belum punya donor. */
function cocokkanWa(){
  let n = 0;
  state.messages.forEach(function(m){
    if(m.arah !== 'masuk' || m.kanal !== 'whatsapp' || m.donorId) return;
    const d = donorByPhone(m.from);
    if(d){ m.donorId = d.id; n++; }
  });
  if(n){ save('messages'); toast(n + ' pesan WhatsApp dicocokkan ke donor'); }
  else toast('Tidak ada pesan WhatsApp yang bisa dicocokkan');
  render();
}

/* ---------- 12. EKSPOR / IMPOR ---------- */
function exportJSON(){
  download('kartidaya-backup-' + new Date().toISOString().slice(0,10) + '.json',
    JSON.stringify(state, null, 2), 'application/json');
  /* Tandai waktu cadangan supaya pengingat di Beranda berhenti muncul. */
  state.settings.cadanganTerakhir = new Date().toISOString();
  state.settings.cadanganTunda = '';
  save('settings');
  toast('Backup JSON diunduh');
  render();
}

/* ---------- PENGINGAT CADANGAN ----------
   Data hanya ada di server + salinan browser. Kalau server bermasalah atau
   data terhapus, satu-satunya jalan pulih adalah berkas JSON yang pernah
   diunduh. Karena itu Beranda mengingatkan kalau sudah lama tidak mencadangkan.
   Batasnya 7 hari; pengingat bisa ditunda 3 hari sekali. */
const CADANGAN_HARI = 7;
const CADANGAN_TUNDA_HARI = 3;

function cadanganPerlu(){
  const t = state.settings.cadanganTerakhir;
  const tunda = state.settings.cadanganTunda;
  const sekarang = Date.now();
  if(tunda){
    const d = new Date(tunda);
    if(!isNaN(d) && (sekarang - d.getTime()) < CADANGAN_TUNDA_HARI * 86400000) return false;
  }
  if(!t) return true;
  const d = new Date(t);
  if(isNaN(d)) return true;
  return (sekarang - d.getTime()) > CADANGAN_HARI * 86400000;
}

function kartuCadangan(){
  if(!cadanganPerlu()) return '';
  const t = state.settings.cadanganTerakhir;
  const pesan = t
    ? 'Terakhir mencadangkan <b>' + esc(relTime(t)) + '</b>. Sebaiknya unduh salinan terbaru sekarang.'
    : 'Data ini <b>belum pernah dicadangkan</b>. Kalau server bermasalah, tidak ada salinan untuk memulihkan.';
  return '<div class="card cadangan-ingat">' +
    '<div class="row" style="justify-content:space-between;flex-wrap:wrap;gap:10px">' +
      '<div style="flex:1;min-width:220px">' +
        '<div class="cadangan-judul">⚠ Cadangkan data</div>' +
        '<p class="small" style="margin:4px 0 0">' + pesan + '</p>' +
      '</div>' +
      '<div class="row" style="gap:8px">' +
        '<button class="btn sm primary" data-action="ekspor-json">↓ Ekspor sekarang</button>' +
        '<button class="btn sm ghost" data-action="cadangan-tunda">Nanti saja</button>' +
      '</div>' +
    '</div></div>';
}
function exportCSV(){
  const cols = ['id','kategori','panggilan','pic','namaLengkap','instansi','email','email2','emailUtama',
                'hp1','hp2','hpUtama',
                'pengiriman','dateStart','asalGereja','alamat','tglLahir','catatan'];
  const head = ['ID-DONOR','KATEGORI','PANGGILAN','PIC','NAMA LENGKAP','INSTANSI','EMAIL 1','EMAIL 2','EMAIL UTAMA',
                'HP 1','HP 2','HP UTAMA',
                'PENGIRIMAN','DATE START','ASAL GEREJA','ALAMAT','TGL LAHIR','CATATAN'];
  function cell(v){
    const s = String(v === null || v === undefined ? '' : v);
    return /[",\n;]/.test(s) ? '"' + s.replace(/"/g,'""') + '"' : s;
  }
  const rows = [head.join(',')].concat(state.donors.map(function(d){
    return cols.map(function(c){ return cell(d[c]); }).join(',');
  }));
  download('kartidaya-donor-' + new Date().toISOString().slice(0,10) + '.csv',
    '\uFEFF' + rows.join('\r\n'), 'text/csv;charset=utf-8');
  toast('CSV donor diunduh');
}
function download(filename, content, mime){
  const blob = new Blob([content], { type:mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(function(){ URL.revokeObjectURL(url); }, 1000);
}

/* ---------- EKSPOR EXCEL (.xlsx) ---------- */
/* Pustaka SheetJS disimpan di vendor/ supaya aplikasi tetap jalan tanpa
   internet dan tidak perlu aplikasi tambahan. */
function xlsxSiap(){
  return typeof XLSX !== 'undefined' && XLSX && XLSX.utils;
}
/* Ubah daftar objek jadi lembar Excel. `cols` menentukan urutan & judul kolom. */
function lembar(rows, cols){
  const head = cols.map(function(c){ return c[1]; });
  const body = rows.map(function(r){
    return cols.map(function(c){
      const v = typeof c[2] === 'function' ? c[2](r) : r[c[0]];
      return (v === null || v === undefined) ? '' : v;
    });
  });
  return XLSX.utils.aoa_to_sheet([head].concat(body));
}
/* Lebar kolom otomatis dari isi terpanjang, supaya hasilnya langsung rapi. */
function rapikanKolom(ws, cols){
  ws['!cols'] = cols.map(function(c, i){
    let max = String(c[1]).length;
    const ref = XLSX.utils.decode_range(ws['!ref'] || 'A1');
    for(let r = ref.s.r + 1; r <= ref.e.r; r++){
      const cell = ws[XLSX.utils.encode_cell({ r:r, c:i })];
      if(cell && cell.v !== undefined && cell.v !== null){
        max = Math.max(max, String(cell.v).length);
      }
    }
    return { wch: Math.min(48, Math.max(10, max + 2)) };
  });
}
function exportXLSX(){
  if(!xlsxSiap()){
    toast('Pustaka Excel belum termuat — muat ulang halaman', true);
    return;
  }
  const wb = XLSX.utils.book_new();

  /* 1. Donor */
  const kolDonor = [
    ['id','ID-DONOR'], ['kategori','KATEGORI'], ['panggilan','PANGGILAN'],
    ['pic','PIC'], ['namaLengkap','NAMA LENGKAP'], ['instansi','INSTANSI'],
    ['email','EMAIL 1'], ['email2','EMAIL 2'],
    ['emailUtama','EMAIL UTAMA', function(d){ return Number(d.emailUtama) === 2 ? 'Email 2' : 'Email 1'; }],
    ['hp1','HP 1'], ['hp2','HP 2'],
    ['hpUtama','HP UTAMA', function(d){ return Number(d.hpUtama) === 2 ? 'HP 2' : 'HP 1'; }],
    ['pengiriman','PENGIRIMAN'], ['dateStart','DATE START'],
    ['asalGereja','ASAL GEREJA'], ['alamat','ALAMAT'],
    ['tglLahir','TGL LAHIR'], ['catatan','CATATAN']
  ];
  const wsDonor = lembar(state.donors, kolDonor);
  rapikanKolom(wsDonor, kolDonor);
  XLSX.utils.book_append_sheet(wb, wsDonor, 'Donor');

  /* 2. Surat — keluar & masuk, urut waktu terbaru dulu */
  const kolSurat = [
    ['tanggal','TANGGAL', function(m){ return fmtDateTime(m.tanggal); }],
    ['arah','ARAH', function(m){ return m.arah === 'masuk' ? 'Masuk' : 'Keluar'; }],
    ['kanal','KANAL', function(m){ return LABEL_KANAL[m.kanal === 'whatsapp' ? 'whatsapp' : 'email']; }],
    ['status','STATUS'],
    ['donorId','ID-DONOR'],
    ['donor','DONOR', function(m){ const d = findDonor(m.donorId); return d ? donorName(d) : ''; }],
    ['kategori','KATEGORI', function(m){ const d = findDonor(m.donorId); return d ? (d.kategori || '') : ''; }],
    ['subjek','SUBJEK'],
    ['isi','ISI'],
    ['from','DARI'], ['to','KEPADA'], ['cc','CC'],
    ['gmailId','GMAIL ID'], ['waId','WA ID'],
    ['lampiran','LAMPIRAN'], ['catatan','CATATAN']
  ];
  const surat = state.messages.slice().sort(function(a,b){
    return String(b.tanggal).localeCompare(String(a.tanggal));
  });
  const wsSurat = lembar(surat, kolSurat);
  rapikanKolom(wsSurat, kolSurat);
  XLSX.utils.book_append_sheet(wb, wsSurat, 'Surat');

  /* 3. Kategori */
  const kolKat = [
    ['nama','KATEGORI'],
    ['jumlah','JUMLAH DONOR', function(r){ return r.jumlah; }]
  ];
  const kat = state.categories.map(function(c){
    return { nama:c, jumlah: state.donors.filter(function(d){ return d.kategori === c; }).length };
  });
  const wsKat = lembar(kat, kolKat);
  rapikanKolom(wsKat, kolKat);
  XLSX.utils.book_append_sheet(wb, wsKat, 'Kategori');

  /* 4. Template */
  const kolTpl = [['nama','NAMA TEMPLATE'], ['subjek','SUBJEK'], ['isi','ISI']];
  const wsTpl = lembar(state.templates, kolTpl);
  rapikanKolom(wsTpl, kolTpl);
  XLSX.utils.book_append_sheet(wb, wsTpl, 'Template');

  /* 5. Keuangan — satu baris per program, supaya mudah dijumlahkan di Excel */
  const kolFin = [
    ['kode','KODE KWITANSI'],
    ['tanggal','TANGGAL'],
    ['donorId','ID-DONOR'],
    ['donor','NAMA', function(f){ const d = findDonor(f.donorId); return d ? donorName(d) : ''; }],
    ['kategori','KATEGORI', function(f){ const d = findDonor(f.donorId); return d ? (d.kategori || '') : ''; }],
    ['program','PROGRAM', function(f){ return programNama(f.programId); }],
    ['jumlah','JUMLAH', function(f){ return Number(f.jumlah) || 0; }],
    ['mataUang','MATA UANG', function(f){ return f.mataUang || 'IDR'; }],
    ['kirim','TERAKHIR DIKIRIM', function(f){
      const k = kirimanUntukFin(f.id);
      return k.length ? waktuKirim(k[k.length - 1].tanggal) : 'belum pernah';
    }],
    ['catatan','CATATAN']
  ];
  const finBaris = [];
  state.finance.forEach(function(f){
    (f.program || []).forEach(function(x){
      finBaris.push({
        kode:f.kode || '', tanggal:f.tanggal, donorId:f.donorId, programId:x.id,
        jumlah:x.jumlah, mataUang:mataUangBaris(x, f), catatan:f.catatan
      });
    });
  });
  finBaris.sort(function(a,b){ return String(b.tanggal).localeCompare(String(a.tanggal)); });
  const wsFin = lembar(finBaris, kolFin);
  rapikanKolom(wsFin, kolFin);
  XLSX.utils.book_append_sheet(wb, wsFin, 'Keuangan');

  /* 6. Program */
  const kolPrg = [
    ['id','ID PROGRAM'], ['nama','NAMA PROGRAM'],
    ['aktif','STATUS', function(p){ return p.aktif === false ? 'Nonaktif' : 'Aktif'; }],
    ['transaksi','JUMLAH TRANSAKSI', function(p){
      return state.finance.filter(function(f){
        return (f.program || []).some(function(x){ return x.id === p.id; });
      }).length;
    }],
    ['total','TOTAL DITERIMA', function(p){
      const t = totalPerUang(state.finance.filter(function(f){
        return (f.program || []).some(function(x){ return x.id === p.id; });
      }).map(function(f){
        const baris = (f.program || []).filter(function(x){ return x.id === p.id; })[0];
        return { mataUang:mataUangBaris(baris, f), jumlah:nominalProgram(f, p.id) };
      }));
      return Object.keys(t).sort().map(function(k){ return fmtUang(t[k], k); }).join(' + ');
    }]
  ];
  const wsPrg = lembar(state.programs, kolPrg);
  rapikanKolom(wsPrg, kolPrg);
  XLSX.utils.book_append_sheet(wb, wsPrg, 'Program');

  const nama = 'kartidaya-' + new Date().toISOString().slice(0,10) + '.xlsx';
  XLSX.writeFile(wb, nama);
  toast('Excel diunduh: ' + nama + ' (6 lembar)');
}
function importJSON(file){
  const reader = new FileReader();
  reader.onload = function(){
    try{
      const data = JSON.parse(reader.result);
      if(!data || typeof data !== 'object') throw new Error('format');
      if(Array.isArray(data.donors))     state.donors = data.donors;
      if(Array.isArray(data.categories)) state.categories = data.categories;
      if(Array.isArray(data.templates))  state.templates = data.templates;
      if(Array.isArray(data.messages))   state.messages = data.messages;
      else if(Array.isArray(data.logs))  state.messages = data.logs;
      if(Array.isArray(data.programs))   state.programs = data.programs;
      if(Array.isArray(data.finance))    state.finance = data.finance;
      if(Array.isArray(data.isian))      state.isian = data.isian;
      /* Setelan ikut dipulihkan — tanpa ini, cadangan yang diimpor ke komputer
         baru kehilangan tanda tangan, alamat koreksi, dan pengaturan majalah.
         Yang TIDAK diambil: `waEndpoint` (alamat server milik komputer ini)
         dan `theme` (pilihan tampilan orang yang sedang memakai). */
      if(data.settings && typeof data.settings === 'object'){
        const simpanEndpoint = state.settings.waEndpoint;
        const simpanTema = state.settings.theme;
        state.settings = Object.assign({}, state.settings, data.settings);
        if(simpanEndpoint) state.settings.waEndpoint = simpanEndpoint;
        if(simpanTema) state.settings.theme = simpanTema;
      }
      /* `uji` (catatan uji pengiriman) hanya milik komputer ini — tidak diimpor
         supaya catatan uji komputer lain tidak tercampur. */
      /* Kirim SEMUA koleksi ke server. `save()` tanpa argumen hanya menulis ke
         browser dan tidak pernah memanggil Server.kirim(), jadi tanpa langkah
         di bawah ini hasil impor tidak pernah sampai ke pengguna lain.
         Ditandai "tertunda" dulu supaya tetap terkirim walau sambungan sedang
         bermasalah — Server.kirimTertunda() mencoba lagi nanti. */
      save();
      Server.koleksi.forEach(function(nama){ Server.tertunda[nama] = true; });
      Server.tertunda.isian = true;
      Server.tertunda.majalah = true;
      Server.tertunda.majalahDaftar = true;
      Server.simpanTertunda();
      Server.kirimTertunda();
      toast('Data berhasil diimpor');
      render();
    }catch(e){ toast('File JSON tidak valid', true); }
  };
  reader.readAsText(file);
}

/* ---------- 13. EVENT ---------- */
document.addEventListener('click', function(e){
  const goEl = e.target.closest('[data-go]');
  if(goEl){ go(goEl.getAttribute('data-go')); return; }

  const msgEl = e.target.closest('[data-open-msg]');
  if(msgEl && !e.target.closest('[data-action]')){
    openMessage(msgEl.getAttribute('data-open-msg'));
    return;
  }

  const donorEl = e.target.closest('[data-donor]');
  if(donorEl && !e.target.closest('[data-action]')){
    go('buku', { id: donorEl.getAttribute('data-donor') });
    return;
  }

  const tokEl = e.target.closest('[data-token]');
  if(tokEl){
    const ta = document.getElementById('s-isi');
    if(ta){
      const t = tokEl.getAttribute('data-token');
      const s = ta.selectionStart, en = ta.selectionEnd;
      ta.value = ta.value.slice(0,s) + t + ta.value.slice(en);
      ta.focus();
      ta.setSelectionRange(s + t.length, s + t.length);
      suratState.isi = ta.value;
      segarkanPratinjauIsi();
      refreshPreview();
    }
    return;
  }

  const act = e.target.closest('[data-action]');
  if(!act) return;
  const a = act.getAttribute('data-action');
  const id = act.getAttribute('data-id');

  switch(a){
    case 'masuk': loginKirim(); break;
        case 'masuk-server': window._loginServer = true; render(); break;
        case 'masuk-server-batal': window._loginServer = false; render(); break;
        case 'masuk-server-simpan': simpanServerDariLogin(); break;
    case 'keluar-akun': logout(); break;
        case 'akun-cek-daftar': {
          const info = document.getElementById('akun-daftar-info');
          if(info) info.textContent = 'Memeriksa…';
          Akun.daftarTerbuka().then(function(adaAdmin){
            if(info) info.innerHTML = adaAdmin
              ? '✅ Halaman akun <b>siap dipakai</b> — masuk sebagai admin untuk membuat akun staf.'
              : '🔓 Belum ada akun sama sekali. Halaman akun akan meminta Anda membuat <b>akun admin pertama</b>.';
          }).catch(function(e){
            if(info) info.textContent = 'Gagal memeriksa: ' + (e.message || e);
          });
          break;
        }
        case 'akun-daftar-buka': {
          const a = Akun.alamatDaftar();
          if(!a){ toast('Alamat Worker belum diisi', true); break; }
          window.open(a, '_blank', 'noopener');
          break;
        }
        case 'akun-ganti-password': openGantiPassword(); break;
        case 'akun-password-simpan': simpanGantiPassword(); break;
        case 'akun-buka-daftar': {
          const a = Akun.alamatDaftar();
          if(!a){ toast('Alamat Worker belum diisi', true); break; }
          window.open(a, '_blank', 'noopener');
          break;
        }
        case 'akun-muat': muatAkun(); break;
    case 'akun-f-reset': akunState.bagian = ''; akunState.aksi = ''; render(); break;
        case 'akun-set-aktif': {
          const email = act.getAttribute('data-email');
          const jadi = act.getAttribute('data-aktif') === '1';
          if(!jadi && !confirm('Matikan akun ' + email + '?\n\nAkun itu tidak bisa masuk lagi sampai diaktifkan.')) break;
          Akun.setAktif(email, jadi)
            .then(function(){ toast(jadi ? 'Akun diaktifkan' : 'Akun dimatikan'); muatAkun(); })
            .catch(function(e){ toast('Gagal: ' + (e.message || e), true); });
          break;
        }
    case 'donor-baru': openDonorForm(null); break;
    case 'donor-ubah': closeModal(); openDonorForm(id); break;
    case 'donor-hapus': deleteDonor(id); break;
    case 'donor-simpan':
      saveDonorFromForm(act.getAttribute('data-new') === '1', act.getAttribute('data-oldid'));
      break;
    case 'gen-id': {
      const pic = (document.getElementById('d-pic')||{}).value || '';
      const inst = (document.getElementById('d-instansi')||{}).value || '';
      const cur = (document.getElementById('d-id')||{}).value || '';
      document.getElementById('d-id').value = nextDonorId(pic, inst, cur ? cur.slice(-1) : 'R');
      break;
    }
    case 'buku': closeModal(); go('buku', { id:id }); break;
    case 'balas': {
      closeModal();
      const d = findDonor(id);
      if(!d) break;
      const terakhir = lastMsg(id);
      suratState.selected = {}; suratState.selected[id] = true;
      suratState.previewId = id;
      /* Balasan mengikuti kanal surat terakhir — kalau donor terakhir menulis
         lewat WhatsApp, balasannya juga lewat WhatsApp. */
      suratState.kanal = terakhir && terakhir.kanal === 'whatsapp' ? 'whatsapp' : 'email';
      suratState.subjek = 'Re: ' + (terakhir ? terakhir.subjek : 'Surat dari Kartidaya');
      suratState.isi = state.templates.length ? state.templates[0].isi : '';
      suratState.tplId = state.templates.length ? state.templates[0].id : '';
      suratState.cc = '';
      go('surat');
      break;
    }
    case 'balas-semua': {
      closeModal();
      const d = findDonor(id);
      const m = state.messages.filter(function(x){ return x.id === (act.getAttribute('data-msg') || ''); })[0];
      if(!d || !m) break;
      suratState.selected = {}; suratState.selected[id] = true;
      suratState.previewId = id;
      suratState.kanal = 'email';
      suratState.subjek = 'Re: ' + (m.subjek || 'Surat dari Kartidaya');
      suratState.isi = state.templates.length ? state.templates[0].isi : '';
      suratState.tplId = state.templates.length ? state.templates[0].id : '';
      /* Semua penerima Cc surat asal ikut dibalas, kecuali alamat donor
         sendiri dan alamat kita. */
      suratState.cc = ccUntukBalasSemua(m, d);
      go('surat');
      if(suratState.cc) toast('Cc diisi: ' + suratState.cc);
      break;
    }
    case 'teruskan': {
      closeModal();
      const d = findDonor(id);
      const m = state.messages.filter(function(x){ return x.id === (act.getAttribute('data-msg') || ''); })[0];
      if(!m) break;
      /* Teruskan tidak memilih penerima apa pun: penerimanya bisa siapa saja,
         bukan hanya donor. Penerima dipilih sendiri oleh pengguna. */
      suratState.selected = {};
      suratState.previewId = d ? d.id : '';
      suratState.kanal = 'email';
      suratState.subjek = /^fwd:/i.test(m.subjek || '') ? m.subjek : 'Fwd: ' + (m.subjek || '(tanpa subjek)');
      suratState.isi = kepalaTeruskan(m) + (m.isi || '');
      suratState.tplId = '';
      suratState.cc = '';
      go('surat');
      toast('Isi surat disalin — pilih penerima lalu kirim');
      break;
    }
    case 'catat-masuk': closeModal(); openCatatMasuk(id || ''); break;
    case 'catat-masuk-simpan': {
      const g = function(x){ const el = document.getElementById(x); return el ? el.value.trim() : ''; };
      if(!g('l-donor')){ toast('Pilih donor dulu', true); break; }
      const d = findDonor(g('l-donor'));
      const st = g('l-status') || 'Belum dibaca';
      const kanal = g('l-kanal') === 'whatsapp' ? 'whatsapp' : 'email';
      const dari = g('l-dari') || (d ? (kanal === 'whatsapp' ? donorWa(d) : emailUtama(d)) : '');
      addMessage({
        donorId:g('l-donor'), arah:'masuk', kanal:kanal,
        tanggal: g('l-tanggal') ? new Date(g('l-tanggal') + 'T09:00:00').toISOString() : new Date().toISOString(),
        subjek:g('l-subjek'), isi:g('l-isi'), status:st,
        from: dari,
        to: kanal === 'whatsapp' ? (WhatsApp.phone || '') : (Gmail.email || ''),
        catatan:g('l-catatan'),
        /* `dibaca` harus mengikuti status — kalau tidak, surat berstatus
           "Belum dibaca" tidak ikut dihitung di badge menu Masuk. */
        dibaca: st !== 'Belum dibaca'
      });
      closeModal(); toast('Surat masuk dicatat'); render();
      break;
    }
    case 'msg-hapus':
      if(confirm('Hapus surat ini dari riwayat?')){
        const mHapus = state.messages.filter(function(m){ return m.id === id; })[0];
        state.messages = state.messages.filter(function(m){ return m.id !== id; });
        save('messages');
        catatAksi('hapus', 'surat', (mHapus && mHapus.subjek) || id,
          (mHapus ? (mHapus.arah === 'masuk' ? 'surat masuk' : 'surat keluar') : '') +
          (mHapus && mHapus.donorId ? ' · donor ' + mHapus.donorId : ''));
        closeModal(); toast('Surat dihapus'); render();
      }
      break;
    case 'tautkan': closeModal(); openTautkan(id); break;
    case 'tautkan-simpan': {
      const sel = document.getElementById('t-donor');
      const donorId = sel ? sel.value : '';
      if(!donorId){ toast('Pilih donor dulu', true); break; }
      const m = state.messages.filter(function(x){ return x.id === id; })[0];
      if(!m) break;
      m.donorId = donorId;
      const cb = document.getElementById('t-email');
      const d = findDonor(donorId);
      if(cb && cb.checked && d && m.from){
        /* Isi kolom yang masih kosong saja — jangan menimpa data yang sudah ada.
           Email/nomor baru masuk ke kolom 2 kalau kolom 1 sudah terisi. */
        if(m.kanal === 'whatsapp'){
          const nomor = waPhonePretty(m.from);
          if(!String(d.hp1 || '').trim()){ d.hp1 = nomor; save('donors'); }
          else if(!String(d.hp2 || '').trim()){ d.hp2 = nomor; save('donors'); }
        }else{
          const alamat = emailOf(m.from);
          if(!String(d.email || '').trim()){ d.email = alamat; save('donors'); }
          else if(!String(d.email2 || '').trim()){ d.email2 = alamat; save('donors'); }
        }
      }
      save('messages');
      closeModal(); toast('Surat ditautkan ke ' + donorId); render();
      break;
    }
    case 'kirim': kirimSurat(false); break;
    case 'kirim-sendiri': kirimKeSendiri(); break;
    case 'kirim-sendiri-dari-pratinjau': closeModal(); kirimKeSendiri(); break;
    case 'uji-bersihkan': hapusSemuaUji(); break;
    case 'kirim-sendiri-dari-periksa': closeModal(); kirimKeSendiri(); break;
    case 'simpan-draft': kirimSurat(true); break;
    case 'sel-all':
      state.donors.forEach(function(d){ suratState.selected[d.id] = true; });
      refreshRecipients(); refreshPreview(); break;
    case 'sel-none':
      suratState.selected = {}; suratState.previewId = '';
      refreshRecipients(); refreshPreview(); break;
    case 'tpl-kelola': openTplKelola(); break;
    case 'tpl-baru': openTplForm(''); break;
    case 'tpl-ubah': openTplForm(id); break;
    case 'tpl-form-simpan': simpanTplForm(id); break;
    case 'tpl-pakai':
      suratState.tplId = id; suratState.subjek = ''; suratState.isi = '';
      closeModal(); render(); toast('Template dipakai');
      break;
    case 'tpl-hapus':
      if(confirm('Hapus template ini?')){
        const tHapus = state.templates.filter(function(t){ return t.id === id; })[0];
        state.templates = state.templates.filter(function(t){ return t.id !== id; });
        save('templates');
        catatAksi('hapus', 'template', (tHapus && tHapus.nama) || id, '');
        closeModal(); openTplKelola(); render();
      }
      break;
    case 'tpl-simpan': {
      const nama = prompt('Nama template baru:', 'Template ' + (state.templates.length + 1));
      if(!nama) break;
      state.templates.push({ id:uid('tpl'), nama:nama, subjek:suratState.subjek, isi:suratState.isi });
      save('templates');
      catatAksi('tambah', 'template', nama, 'dari isi surat yang sedang ditulis');
      toast('Template disimpan'); render();
      break;
    }
    case 'tpl-simpan-baru': {
      /* Simpan isi surat yang sedang ditulis sebagai template baru, lalu buka
         form supaya nama/subjek bisa dirapikan sebelum disimpan. */
      openTplForm('');
      const nEl = document.getElementById('t-nama');
      const sEl = document.getElementById('t-subjek');
      const iEl = document.getElementById('t-isi');
      if(nEl) nEl.value = 'Template ' + (state.templates.length + 1);
      if(sEl) sEl.value = suratState.subjek;
      if(iEl) iEl.value = suratState.isi;
      break;
    }
    case 'periksa-kirim': openPeriksaKirim(); break;
    case 'riwayat-kirim': openRiwayatKirim(); break;
    case 'kwitansi-png': openKwitansiPNG(id); break;
    case 'buka-pesan': closeModal(); openMessage(id); break;
    case 'pratinjau-email': openPratinjauEmail(id); break;
    case 'pj-lebar':
      pratinjauOpsi.lebar = act.getAttribute('data-lebar') === 'hp' ? 'hp' : 'desktop';
      gambarPratinjauEmail(findDonor(suratState.previewId));
      break;
    case 'pj-blokir':
      pratinjauOpsi.blokirGambar = !pratinjauOpsi.blokirGambar;
      gambarPratinjauEmail(findDonor(suratState.previewId));
      break;
    case 'pj-tab':
      pratinjauOpsi.tab = act.getAttribute('data-tab') === 'teks' ? 'teks' : 'html';
      gambarPratinjauEmail(findDonor(suratState.previewId));
      break;
    case 'kirim-dari-periksa': closeModal(); suratState.dariPeriksa = true; kirimSurat(false); break;
    case 'print-one': { const d = findDonor(id); if(d) printLetter(d); break; }
    case 'cetak-alamat': { const d = findDonor(id); if(d) printAlamat(d); break; }
        case 'cetak-label-donor': if(id) openCetakLabel([id], 'Cetak label — ' + donorName(findDonor(id) || {pic:id})); break;
        case 'cetak-label-dipilih': {
          const ids = Object.keys(suratState.selected).filter(function(k){ return suratState.selected[k]; });
          openCetakLabel(ids, 'Cetak label alamat (' + ids.length + ' penerima)');
          break;
        }
        case 'label-cetak': cetakLabelSekarang(); break;
    case 'fin-baru': openFinForm(''); break;
    case 'fin-ubah': openFinForm(id); break;
    case 'fin-hapus': hapusFin(id); break;
    case 'fin-simpan': simpanFinForm(id); break;
    case 'fin-reset':
      finFilter = { q:'', program:'', uang:'', dari:'', sampai:'', kirim:'' };
      render(); break;
    case 'fin-baris-tambah': {
      const box = document.getElementById('k-program');
      if(box){
        /* Baris baru mewarisi mata uang baris terakhir supaya tidak perlu
           memilih ulang kalau memang sama. */
        const terakhir = box.querySelector('.fin-baris:last-child .k-uang-baris');
        const uang = terakhir ? terakhir.value : 'IDR';
        const tmp = document.createElement('div');
        tmp.innerHTML = barisProgramHTML({ id:'', jumlah:'', mataUang:uang }, uang);
        box.appendChild(tmp.firstChild);
        bindFinForm(document.getElementById('modal-root'));
      }
      break;
    }
    case 'fin-baris-hapus': {
      const baris = act.closest('.fin-baris');
      const box = document.getElementById('k-program');
      /* Sisakan minimal satu baris supaya form tidak pernah kosong. */
      if(baris && box && box.querySelectorAll('.fin-baris').length > 1){
        baris.remove();
        bindFinForm(document.getElementById('modal-root'));
      }else{
        toast('Minimal satu baris program', true);
      }
      break;
    }
    case 'prg-kelola': openPrgKelola(); break;
    case 'prg-baru': openPrgForm(''); break;
    case 'prg-ubah': openPrgForm(id); break;
    case 'prg-form-simpan': simpanPrgForm(id); break;
    case 'prg-hapus': hapusPrg(id); break;
    case 'kat-baru': {
      const nama = prompt('Nama kategori baru:');
      if(!nama) break;
      if(state.categories.indexOf(nama) >= 0){ toast('Kategori sudah ada', true); break; }
      state.categories.push(nama); save('categories');
      catatAksi('tambah', 'kategori', nama, '');
      toast('Kategori ditambahkan'); render();
      break;
    }
    case 'kat-ubah': {
      const lama = act.getAttribute('data-kat');
      const baru = prompt('Ubah nama kategori:', lama);
      if(!baru || baru === lama) break;
      state.categories = state.categories.map(function(c){ return c === lama ? baru : c; });
      state.donors.forEach(function(d){ if(d.kategori === lama) d.kategori = baru; });
      save('categories'); save('donors');
      catatAksi('ubah', 'kategori', baru, 'dari "' + lama + '"');
      toast('Kategori diubah'); render();
      break;
    }
    case 'kat-hapus': {
      const k = act.getAttribute('data-kat');
      const n = state.donors.filter(function(d){ return d.kategori === k; }).length;
      if(!confirm('Hapus kategori "' + k + '"?' + (n ? '\n' + n + ' donor menjadi tanpa kategori.' : ''))) break;
      state.categories = state.categories.filter(function(c){ return c !== k; });
      state.donors.forEach(function(d){ if(d.kategori === k) d.kategori = ''; });
      save('categories'); save('donors');
      catatAksi('hapus', 'kategori', k, n ? n + ' donor jadi tanpa kategori' : '');
      toast('Kategori dihapus'); render();
      break;
    }
    case 'g-save': {
      const el = document.getElementById('g-client');
      state.settings.gmailClientId = el ? el.value.trim() : '';
      Gmail.clientId = state.settings.gmailClientId;
      save('settings'); toast('Client ID disimpan'); render();
      break;
    }
    case 'g-connect': gmailConnect(); break;
    case 'g-default':
      state.settings.gmailClientId = DEFAULT_CLIENT_ID;
      Gmail.clientId = DEFAULT_CLIENT_ID;
      save('settings'); toast('Client ID bawaan dipakai'); render();
      break;
    case 'g-copy-cid': copyText(state.settings.gmailClientId); break;
    case 'g-copy-prefix': copyText(projectNumber(state.settings.gmailClientId)); break;
    case 'g-copy-origin': copyText(Gmail.origin()); break;
    case 'g-disconnect': Gmail.disconnect(); toast('Gmail diputuskan'); render(); break;
    case 'sync': gmailSync(); break;
    case 'wa-sync': waSync(); break;
    case 'wa-cocokkan': cocokkanWa(); break;
    case 'w-save': waConnect(); break;
    case 'w-disconnect':
      WhatsApp.disconnect();
      /* Alamat Worker dikembalikan ke nilai bawaan, bukan dikosongkan —
         alamat itu juga dipakai fitur email (majalah, tanda dibaca). */
      state.settings.waEndpoint = DEFAULT_WORKER;
      save('settings');
      toast('Kunci aplikasi dihapus dari browser ini');
      render();
      break;
    case 'wa-auto-toggle':
      state.settings.waAutoSync = !state.settings.waAutoSync;
      save('settings');
      toast(state.settings.waAutoSync ? 'Sinkron WhatsApp otomatis aktif' : 'Sinkron WhatsApp otomatis dimatikan');
      render();
      if(state.settings.waAutoSync) waSinkronOtomatis(true);
      break;
    case 'wa-min-save': {
      const el = document.getElementById('set-wamin');
      const n = Math.min(240, Math.max(1, Number(el ? el.value : 10) || 10));
      state.settings.waSyncMinutes = n;
      save('settings'); toast('Jarak sinkron WhatsApp: ' + n + ' menit'); render();
      break;
    }
    case 'kanal-pilih':
      suratState.kanal = act.getAttribute('data-kanal') === 'whatsapp' ? 'whatsapp' : 'email';
      /* WhatsApp ditunda — jangan biarkan kanal itu terpilih. */
      if(WA_DITUNDA && suratState.kanal === 'whatsapp') suratState.kanal = 'email';
      /* WhatsApp tidak bisa menampilkan tabel HTML, jadi kwitansi dimatikan. */
      if(suratState.kanal === 'whatsapp') suratState.kwitansi = false;
      render();
      break;
    case 'format-surat':
      terapkanFormatSurat(act.getAttribute('data-format'));
      break;
    case 'kw-toggle':
      suratState.kwitansi = !suratState.kwitansi;
      render();
      break;
    case 'kw-bahasa':
      suratState.kwitansiBahasa = act.getAttribute('data-bahasa') === 'en' ? 'en' : 'id';
      render();
      break;
    case 'isian-simpan':
      bacaIsianDariForm();
      save('isian');
      toast('Isian serba guna disimpan');
      render();
      break;
    case 'isian-kosongkan':
      state.isian = ISIAN_FIELD.map(function(){ return ''; });
      save('isian');
      toast('Isian serba guna dikosongkan');
      render();
      break;
    case 'mj-toggle':
      suratState.majalah = !suratState.majalah;
      render();
      break;
    case 'mj-kelola': openMajalahForm(); break;
    case 'mj-hapus': hapusMajalah(); break;
    case 'mj-ke-setelan': closeModal(); go('pengaturan'); break;
    case 'mj-lupakan':
      delete state.settings.majalah;
      suratState.majalah = false;
      save('majalah');
      toast('Catatan majalah dibersihkan');
      render();
      break;
    case 'mj-pilih-file': {
      const el = document.getElementById('mj-file');
      if(el) el.click();
      break;
    }
    case 'mj-unggah': unggahMajalah(); break;
    case 'mj-baca': {
      const u = majalahBacaURL();
      if(!u){ toast('Majalah belum disiapkan', true); break; }
      window.open(u, '_blank', 'noopener');
      break;
    }
    case 'mj-statistik': bukaStatistikMajalah(); break;
    case 'lihat-kwitansi': bukaKwitansiSurat(act.getAttribute('data-msg') || ''); break;
    case 'lihat-majalah': bukaMajalahSurat(act.getAttribute('data-msg') || ''); break;
    case 'lihat-berkas': bukaBerkasSurat(act.getAttribute('data-msg') || ''); break;
    case 'lihat-majalah-stat': {
      const idMj = act.getAttribute('data-id') || '';
      const judulMj = act.getAttribute('data-judul') || 'Majalah Kartidaya';
      const halMj = parseInt(act.getAttribute('data-halaman'), 10) || 1;
      const simpanMj = state.settings.majalah;
      if(simpanMj && simpanMj.id !== idMj){
        /* Statistik dibaca per edisi. Kalau yang dibuka bukan edisi aktif,
           jadikan dulu edisi aktif supaya fungsi statistik yang sudah ada
           bisa dipakai — lalu kembalikan setelah selesai. Judul & jumlah
           halaman diambil dari tombolnya, jadi modal tidak berjudul generik. */
        const asli = JSON.parse(JSON.stringify(simpanMj));
        state.settings.majalah = { id: idMj, judul: judulMj, halaman: halMj };
        bukaStatistikMajalah().then(function(){ state.settings.majalah = asli; });
      }else{
        bukaStatistikMajalah();
      }
      break;
    }
    case 'lampiran-pilih': {
      const el = document.getElementById('s-lampiran-file');
      if(el) el.click();
      break;
    }
    case 'lampiran-hapus': {
      const i = parseInt(act.getAttribute('data-i'), 10);
      const daftar = lampiranSurat();
      if(!(i >= 0 && i < daftar.length)) break;
      const l = daftar[i];
      daftar.splice(i, 1);
      /* Berkas di Worker ikut dihapus supaya tidak menumpuk jadi sampah. */
      if(l && l.naik && l.id){
        WhatsApp.hapusLampiran(l.id).catch(function(){ /* abaikan */ });
      }
      render();
      break;
    }
    case 'mj-mode': {
      const mode = act.getAttribute('data-mode') === 'gambar' ? 'gambar' : 'pdf';
      const pdfBlok = document.getElementById('mj-pdf-blok');
      const imgBlok = document.getElementById('mj-img-blok');
      if(pdfBlok) pdfBlok.hidden = mode !== 'pdf';
      if(imgBlok) imgBlok.hidden = mode !== 'gambar';
      document.querySelectorAll('[data-action="mj-mode"]').forEach(function(b){
        b.classList.toggle('primary', b.getAttribute('data-mode') === mode);
      });
      break;
    }
    case 'cek-dibaca': cekTandaDibaca(true); break;
    case 'cek-terima': cekKonfirmasiTerima(true); break;
    case 'k-dibaca': kotakFilter.dibaca = act.getAttribute('data-nilai') || ''; render(); break;
    case 'k-reset':
      kotakFilter = { q:'', donorId:'', status:'', kanal:'', dibaca:'' };
      render();
      break;
    case 'auto-sync-toggle':
      state.settings.autoSync = !state.settings.autoSync;
      save('settings');
      toast(state.settings.autoSync ? 'Sinkron otomatis aktif' : 'Sinkron otomatis dimatikan');
      render();
      if(state.settings.autoSync) sinkronOtomatis(true);
      break;
    case 'cocokkan': cocokkanUlang(); break;
    case 'sign-save': {
      const el = document.getElementById('set-sign');
      state.settings.signature = el ? el.value : '';
      save('settings'); toast('Tanda tangan disimpan');
      break;
    }
    case 'sync-min-save': {
      const el = document.getElementById('set-syncmin');
      const n = Math.min(240, Math.max(1, Number(el ? el.value : 10) || 10));
      state.settings.syncMinutes = n;
      save('settings'); toast('Jarak sinkron otomatis: ' + n + ' menit'); render();
      break;
    }
    case 'ekspor-json': exportJSON(); break;
    case 'cadangan-tunda':
      state.settings.cadanganTunda = new Date().toISOString();
      save('settings');
      toast('Pengingat ditunda ' + CADANGAN_TUNDA_HARI + ' hari');
      render();
      break;
    case 'ekspor-xlsx': exportXLSX(); break;
    case 'ekspor-csv': exportCSV(); break;
    case 'impor-json': document.getElementById('file-import').click(); break;
    case 'server-coba-lagi': cobaSambungLagi(); break;
    case 'server-muat': {
      sambungDanMuat().then(function(ok){
        if(ok){ bukaKunciServer(); render(); toast('Data dimuat ulang dari server'); }
        else toast('Gagal memuat dari server: ' + (Server.pesan || 'tidak diketahui'), true);
      });
      break;
    }
    case 'server-unggah': {
      if(!Server.bisa()){ toast('Isi alamat Worker & kunci aplikasi dulu di Setelan', true); break; }
      if(!confirm('Kirim data dari browser ini ke server?\n\n' +
        'Data yang ada di server akan DITIMPA dengan data dari komputer ini.\n' +
        'Pakai ini hanya kalau data di komputer ini yang paling lengkap.')) break;
      Server.siap = true;
      (async function(){
        for(const nama of Server.koleksi){ await Server.kirim(nama); }
        await Server.kirim('isian');
        await Server.kirim('majalah');
        if(!Server.gagal) bukaKunciServer();
        render();
        toast(Server.gagal ? 'Sebagian gagal dikirim — lihat pesan galat' : 'Semua data terkirim ke server',
          !!Server.gagal);
      })();
      break;
    }
    case 'muat-contoh':
      if(confirm('Muat ulang 18 donor contoh dari data.xlsx?\nData donor & surat saat ini akan diganti.')){
        state.donors = SEED_DONORS.slice();
        state.categories = DEFAULT_CATEGORIES.slice();
        state.messages = [];
        save('donors'); save('categories'); save('messages');
        toast('Data contoh dimuat'); render();
      }
      break;
    case 'reset':
      if(confirm('Hapus SEMUA data (donor, surat, template, kategori)?')){
        state.donors = []; state.messages = [];
        state.templates = DEFAULT_TEMPLATES.slice();
        state.categories = DEFAULT_CATEGORIES.slice();
        save(); toast('Semua data dihapus'); render();
      }
      break;
    case 'tema-light': setTheme('light'); break;
    case 'tema-dark':  setTheme('dark'); break;
    case 'tema-auto':  setTheme('auto'); break;
    case 'wajib-periksa-toggle':
      state.settings.wajibPeriksa = !state.settings.wajibPeriksa;
      save('settings'); render();
      toast(state.settings.wajibPeriksa
        ? 'Pratinjau wajib diaktifkan — kirim akan lewat layar periksa dulu'
        : 'Pratinjau wajib dimatikan — kirim langsung tanpa periksa');
      break;
    case 'koreksi-save': {
      const el = document.getElementById('set-koreksi');
      state.settings.kontakKoreksi = (el ? el.value.trim() : '') || 'finance@kartidaya.org';
      save('settings'); render(); toast('Alamat koreksi disimpan');
      break;
    }
    case 'email-uji-save': {
      const el = document.getElementById('set-email-uji');
      const v = (el ? el.value.trim() : '');
      if(v && v.indexOf('@') < 1){
        toast('Alamat email uji tidak sah — harus memuat @', true);
        break;
      }
      state.settings.emailUji = v;
      save('settings'); render();
      toast(v ? 'Salinan uji akan dikirim ke ' + v : 'Salinan uji dikirim ke email Gmail yang tersambung');
      break;
    }
    case 'test-id': {
      const pic = (document.getElementById('test-pic')||{}).value || '';
      const inst = (document.getElementById('test-inst')||{}).value || '';
      const sfx = (document.getElementById('test-sfx')||{}).value || 'R';
      document.getElementById('test-out').textContent = nextDonorId(pic, inst, sfx);
      break;
    }
  }
});

document.addEventListener('change', function(e){
  const st = e.target.closest('[data-msg-status]');
  if(st){
    const m = state.messages.filter(function(x){ return x.id === st.getAttribute('data-msg-status'); })[0];
    if(m){
      m.status = st.value;
      if(m.arah === 'masuk') m.dibaca = st.value !== 'Belum dibaca';
      save('messages');
      const chip = document.getElementById('m-status-chip');
      if(chip){ chip.className = 'chip ' + statusChipClass(m.status); chip.textContent = m.status; }
      toast('Status diubah ke "' + m.status + '"');
      /* Daftar di belakang modal harus ikut berubah — kalau tidak, chip di
         Kotak Masuk / buku donor masih menampilkan status lama sampai halaman
         digambar ulang, dan pengguna mengira perubahannya tidak tersimpan. */
      render();
    }
    return;
  }
  const r = e.target.closest('[data-recip]');
  if(r){
    const id = r.getAttribute('data-recip');
    suratState.selected[id] = r.checked;
    if(r.checked) suratState.previewId = id;
    /* Kotak pilihan transaksi kwitansi harus ikut digambar ulang: daftarnya
       milik donor yang sedang dipratinjau. Tanpa ini, setelah penerima
       diganti kotak itu masih menampilkan transaksi donor sebelumnya. */
    const kw = document.getElementById('kw-blok');
    if(kw) kw.innerHTML = blokKwitansi();
    refreshRecipients(); refreshPreview();
    return;
  }
  if(e.target.id === 'file-import' && e.target.files && e.target.files[0]){
    importJSON(e.target.files[0]);
    e.target.value = '';
    return;
  }
  if(e.target.id === 'f-kat'){ donorFilter.kategori = e.target.value; render(); }
  if(e.target.id === 'f-sort'){ donorFilter.sort = e.target.value; render(); }
  if(e.target.id === 'k-status'){ kotakFilter.status = e.target.value; render(); }
  if(e.target.id === 'k-donor'){ kotakFilter.donorId = e.target.value; render(); }
  if(e.target.id === 'k-kanal'){ kotakFilter.kanal = e.target.value; render(); }
  if(e.target.id === 'k-dibaca'){ kotakFilter.dibaca = e.target.value; render(); }
});

document.addEventListener('input', function(e){
  if(e.target.id === 'f-q'){
    donorFilter.q = e.target.value;
    const pos = e.target.selectionStart;
    render();
    const el = document.getElementById('f-q');
    if(el){ el.focus(); el.setSelectionRange(pos,pos); }
  }
  if(e.target.id === 'k-q'){
    kotakFilter.q = e.target.value;
    const pos = e.target.selectionStart;
    render();
    const el = document.getElementById('k-q');
    if(el){ el.focus(); el.setSelectionRange(pos,pos); }
  }
  /* Di form donor: centang "Utama" hanya bisa dipilih kalau kolomnya terisi.
     Tanpa ini, pengguna bisa mencentang kolom kosong lalu bingung kenapa
     suratnya tidak terkirim. */
  if(e.target.id === 'd-email' || e.target.id === 'd-email2' ||
     e.target.id === 'd-hp1' || e.target.id === 'd-hp2'){
    segarkanUtama(e.target.id);
  }
});

/* ---------- 14. TEMA ---------- */
function setTheme(mode){
  state.settings.theme = mode;
  save('settings');
  applyTheme();
  toast('Tema: ' + (mode === 'auto' ? 'ikut sistem' : mode === 'dark' ? 'gelap' : 'terang'));
}
function applyTheme(){
  const mode = state.settings.theme || 'light';
  let dark = mode === 'dark';
  if(mode === 'auto' && window.matchMedia){
    dark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  }
  document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
  const meta = document.querySelector('meta[name=theme-color]');
  if(meta) meta.setAttribute('content', dark ? '#111312' : '#f5f5f0');
}

/* ---------- 15. MULAI ---------- */
loadState();
Server.bacaTertunda();
applyTheme();
Gmail.clientId = state.settings.gmailClientId || '';
Gmail.onStatus = function(){ renderNav(); };
/* Pulihkan token Gmail dari sessionStorage supaya memuat ulang halaman tidak
   memutus koneksi — kalau tidak, surat berikutnya diam-diam jadi mode simulasi. */
Gmail.restoreSession();

/* WhatsApp: alamat Worker & kunci aplikasi dipulihkan dari localStorage supaya
   pengguna tidak perlu mengisi ulang setiap membuka aplikasi. Kunci sengaja
   TIDAK disimpan di state.settings, karena state ikut ter-ekspor ke berkas
   cadangan JSON. */
WhatsApp.onStatus = function(){ renderNav(); };
WhatsApp.restoreSession();
if(state.settings.waEndpoint) WhatsApp.endpoint = state.settings.waEndpoint;

/* Akun: sesi login dipulihkan dari localStorage. Kalau belum ada, aplikasi
   langsung menampilkan layar masuk dan TIDAK memuat data apa pun — lihat
   bagian 15b di bawah. */
Akun.restore();
terkunciLogin = Akun.masuk() ? null : 'masuk';

/* ---------- 16. PENJAGA SESI GMAIL ---------- */
/* Perbarui token di latar belakang sebelum kedaluwarsa, supaya pengguna tidak
   perlu klik "Hubungkan Gmail" berulang kali. Kalau Google menolak (sesi login
   Google sudah berakhir), tampilkan peringatan sekali saja. */
let _gmailPeringatan = false;
async function jagaSesiGmail(){
  if(!Gmail.isConfigured()) return;
  if(!Gmail.isConnected() && !Gmail.msLeft()) return;   /* belum pernah login */
  if(Gmail.msLeft() > 10 * 60 * 1000) return;           /* masih longgar */
  const ok = await Gmail.renew();
  if(ok){
    _gmailPeringatan = false;
    if(currentPage === 'pengaturan') render();
    return;
  }
  if(!_gmailPeringatan){
    _gmailPeringatan = true;
    toast('Sesi Gmail perlu diperbarui — buka Setelan lalu klik Hubungkan Gmail', true);
  }
}
setInterval(jagaSesiGmail, 5 * 60 * 1000);
document.addEventListener('visibilitychange', function(){
  if(!document.hidden) jagaSesiGmail();
});
jagaSesiGmail();

/* ---------- 17. SINKRON OTOMATIS — pemicu ---------- */
/* Fungsi sinkronOtomatis() ada di bagian 11 bersama gmailSync(). */
setInterval(sinkronOtomatis, 60 * 1000);
if(!WA_DITUNDA) setInterval(waSinkronOtomatis, 60 * 1000);
/* Tanda dibaca & konfirmasi penerimaan ikut diperiksa berkala — tidak perlu
   menekan tombol. */
setInterval(function(){ cekTandaDibaca(); cekKonfirmasiTerima(); cekUji(); }, 3 * 60 * 1000);
/* Coba kirim ulang perubahan yang gagal tersimpan — tiap 20 detik. Kalau
   internet kembali, perubahan langsung menyusul tanpa perlu diapa-apakan. */
setInterval(function(){ Server.kirimTertunda(); }, 20 * 1000);
document.addEventListener('visibilitychange', function(){
  if(!document.hidden){
    sinkronOtomatis(); waSinkronOtomatis(); cekTandaDibaca(); cekKonfirmasiTerima(); cekUji();
    Server.kirimTertunda();
    /* Sesi akun diperiksa lagi saat tab kembali aktif: bisa saja akun
       dimatikan atau password diganti dari komputer lain. */
    if(Akun.masuk()){
      Akun.periksa().then(function(sah){
        if(!sah){ terkunciLogin = 'masuk'; window._loginGalat = 'Sesi sudah berakhir — silakan masuk lagi'; render(); }
      });
    }
  }
});
/* Beri jeda sedikit supaya token sempat dipulihkan lebih dulu. */
setTimeout(sinkronOtomatis, 3000);
if(!WA_DITUNDA) setTimeout(waSinkronOtomatis, 4000);
setTimeout(function(){ cekTandaDibaca(); cekKonfirmasiTerima(); cekUji(); }, 6000);
/* Majalah disimpan di Worker, bukan di browser. Kalau berkasnya sudah tidak
   ada di sana (mis. KV dibersihkan atau namespace diganti), aplikasi harus
   tahu — kalau tidak, email akan memuat gambar yang tidak bisa dibuka. */
setTimeout(cekMajalahAda, 5000);

function cycleTheme(){
  const order = ['light','dark','auto'];
  const cur = state.settings.theme || 'light';
  setTheme(order[(order.indexOf(cur) + 1) % order.length]);
}
document.getElementById('theme-btn').addEventListener('click', cycleTheme);
document.getElementById('theme-btn-m').addEventListener('click', cycleTheme);

render();

/* ---------- 15b. MULAI — periksa akun lebih dulu ---------- */
/* Urutannya penting:
     1. Pulihkan sesi akun dari browser.
     2. Kalau belum masuk → layar masuk, data TIDAK dimuat sama sekali.
     3. Kalau sudah masuk → baru ambil data bersama dari server.

   Tanpa urutan ini, data donor sempat tampil sebelum jelas siapa yang
   membuka aplikasi. */
(async function(){
  const pulih = Akun.restore();
  if(!pulih){
    terkunciLogin = 'masuk';
    terkunciServer = null;
    window._loginGalat = '';
    document.getElementById('simpan-status').textContent = '';
    render();
    return;
  }

  /* Token ada, tapi belum tentu masih berlaku (mis. akun dimatikan, atau
     password baru saja diganti sehingga semua sesi dicabut). */
  render();
  const sah = await Akun.periksa();
  if(!sah){
      /* Email diambil sebelum Akun.clear() — clear() mengosongkan data pengguna. */
      window._loginEmail = (Akun.pengguna && Akun.pengguna.email) || '';
    terkunciLogin = 'masuk';
    window._loginGalat = 'Sesi sudah berakhir — silakan masuk lagi';
    Akun.clear();
    render();
    return;
  }
  terkunciLogin = null;
  render();

  /* Ambil data bersama. Dijalankan SETELAH render() supaya aplikasi langsung
     tampil (memakai salinan di browser) dan tidak menunggu jaringan.

     PENTING: kalau gagal, aplikasi dikunci. Tanpa kunci, pengguna bisa
     mengedit data yang sebenarnya sudah tidak terhubung ke server — dan
     editannya hilang begitu halaman dimuat ulang. */
  if(!Server.bisa()){
      Server.tandai('mati', 'Alamat server belum diisi');
      kunciServer('Alamat server belum diisi',
        'Isi <b>Alamat Worker</b> di halaman Setelan, lalu coba lagi.');
    return;
  }
  /* Kalau ada perubahan yang belum sempat terkirim (mis. internet putus saat
     mengedit), kirim itu DULU sebelum mengambil data server. Kalau tidak,
     data server akan menimpa perubahan tadi dan pekerjaan itu hilang. */
  const berhasil = await sambungDanMuat();
  if(berhasil){
    bukaKunciServer();
    render();
    toast('Data bersama dimuat dari server');
  }else{
    kunciServer('Tidak tersambung ke server',
      'Aplikasi ini bekerja <b>online</b> — data disimpan di server supaya bisa ' +
      'dipakai bersama. Periksa sambungan internet, lalu coba lagi.');
  }
})();

/* Layar pengganti kalau data bersama tidak bisa dimuat. Aplikasi sengaja tidak
   bisa dipakai supaya tidak ada perubahan yang hilang tanpa disadari. */
function layarTidakTersambung(){
  const k = terkunciServer || {};
  return '<div class="card" style="max-width:560px;margin:40px auto">' +
    '<div class="card-head"><h2>' + esc(k.judul || 'Tidak tersambung') + '</h2></div>' +
    '<p class="small">' + (k.pesan || '') + '</p>' +
    (Server.pesan ? '<p class="tiny muted">Pesan dari server: <b>' + esc(Server.pesan) + '</b></p>' : '') +
    '<div class="btn-row">' +
      '<button class="btn primary" data-action="server-coba-lagi">⟳ Coba lagi</button>' +
      '<button class="btn" data-go="pengaturan">⚙ Buka Setelan</button>' +
    '</div>' +
    '<p class="tiny muted" style="margin-top:10px">Data yang sudah ada di server <b>tidak terpengaruh</b> — ' +
      'ini hanya soal sambungan dari komputer ini.</p>' +
  '</div>';
}
function kunciServer(judul, pesan){
  terkunciServer = { judul: judul, pesan: pesan };
  /* Banner bawah tidak perlu lagi — layar kunci sudah menjelaskan semuanya. */
  const b = document.getElementById('banner-offline');
  if(b) b.hidden = true;
  render();
}
function bukaKunciServer(){
  terkunciServer = null;
}

/* Kirim dulu semua perubahan yang belum sempat terkirim, baru ambil data
   server. Urutannya penting: kalau `muat()` dijalankan lebih dulu, data server
   akan menimpa perubahan tadi dan pekerjaan pengguna hilang. */
async function sambungDanMuat(){
  const tertunda = Object.keys(Server.bacaTertunda());
  if(tertunda.length){
    Server.siap = true;
    for(const nama of tertunda){
      await Server.kirim(nama);
      if(!Server.online) break;
    }
  }
  const ok = await Server.muat();
  /* Kalau muat() menemukan data di browser yang belum ada di server (pemakaian
     pertama kali), kirim sekarang — jangan tunggu 20 detik. */
  if(ok && Object.keys(Server.tertunda).length) await Server.kirimTertunda();
  return ok;
}

/* Coba sambung ulang dari layar "tidak tersambung" atau dari banner. */
async function cobaSambungLagi(){
  const v = document.getElementById('view');
  if(terkunciServer && v){
    v.innerHTML = '<div class="card" style="max-width:560px;margin:40px auto">' +
      '<p class="small">Menghubungi server…</p></div>';
  }
  const ok = await sambungDanMuat();
  if(ok){
    bukaKunciServer();
    render();
    toast('Tersambung — data dimuat dari server');
  }else if(terkunciServer){
    render();
  }else{
    toast('Masih tidak tersambung ke server', true);
  }
}
