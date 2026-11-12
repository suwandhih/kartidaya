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
  isian:'kartidaya.v2.isian'
};

/* OAuth Client ID project `kartidaya-513714` (nomor 531116872278).
   Dipakai sebagai nilai awal supaya browser yang masih menyimpan Client ID
   lama tidak terus gagal dengan `access_denied`. */
const DEFAULT_CLIENT_ID = '531116872278-hep5meju0djk30qrsee5ec4np2t895qo.apps.googleusercontent.com';

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
    email:r[5], hp1:r[6], hp2:r[7],
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
  ['{/EMAIL}','Email penerima'],
  ['{/HP}','No HP'],
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
/* Ambil transaksi keuangan milik donor. Kalau `finId` diisi, pakai itu saja. */
function kwitansiDonor(donorId, finId){
  const list = state.finance.filter(function(f){
    return f.donorId === donorId && (!finId || f.id === finId);
  }).sort(function(a,b){ return String(b.tanggal).localeCompare(String(a.tanggal)); });
  return list[0] || null;
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
function workerBase(){
  return String(WhatsApp.endpoint || state.settings.waEndpoint || '').replace(/\/+$/, '');
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
/* Total satu transaksi, dipisah per mata uang. */
function totalPerUangTransaksi(f){
  const map = {};
  (f.program || []).forEach(function(x){
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
  if(!what || what === 'donors')     writeLS(LS.donors, state.donors);
  if(!what || what === 'categories') writeLS(LS.categories, state.categories);
  if(!what || what === 'templates')  writeLS(LS.templates, state.templates);
  if(!what || what === 'messages')   writeLS(LS.messages, state.messages);
  if(!what || what === 'settings')   writeLS(LS.settings, state.settings);
  if(!what || what === 'programs')   writeLS(LS.programs, state.programs);
  if(!what || what === 'finance')    writeLS(LS.finance, state.finance);
  if(!what || what === 'isian')      writeLS(LS.isian, state.isian);
}
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
  /* WhatsApp — alamat Worker & kunci aplikasi disimpan di sessionStorage
     (lihat whatsapp.js), sisanya di sini. */
  if(!state.settings.waEndpoint) state.settings.waEndpoint = '';
  if(state.settings.waAutoSync === undefined) state.settings.waAutoSync = true;
  if(!state.settings.waSyncMinutes) state.settings.waSyncMinutes = 10;
  if(!state.settings.waLastSync) state.settings.waLastSync = '';
  /* Alamat untuk koreksi kwitansi — dicetak di kwitansi supaya donor tahu
     harus menghubungi ke mana kalau ada yang salah. */
  if(!state.settings.kontakKoreksi) state.settings.kontakKoreksi = 'finance@kartidaya.org';
  /* Pratinjau wajib: sebelum benar-benar mengirim, layar "Periksa sebelum
     kirim" muncul lebih dulu. Aktif secara bawaan karena ini pengaman utama
     terhadap salah kirim — bisa dimatikan di Setelan kalau dirasa mengganggu. */
  if(state.settings.wajibPeriksa === undefined) state.settings.wajibPeriksa = true;
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
function donorByEmail(addr){
  const e = String(addr || '').trim().toLowerCase();
  if(!e) return null;
  for(let i = 0; i < state.donors.length; i++){
    if(String(state.donors[i].email || '').trim().toLowerCase() === e) return state.donors[i];
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
/* Nomor WhatsApp donor: pakai HP 1, kalau kosong baru HP 2. */
function donorWa(d){
  if(!d) return '';
  return waPhone(d.hp1) || waPhone(d.hp2);
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
    '/EMAIL': d.email || '',
    '/HP': d.hp1 || '',
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
    gmailId:'', threadId:'', lampiran:'', catatan:'', dibaca:true,
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
  { id:'pengaturan', label:'Setelan',    ico:'⚙' }
];
let currentPage = 'beranda';
let pageParams = {};

function go(page, params){
  currentPage = page;
  pageParams = params || {};
  render();
  window.scrollTo(0,0);
}
function renderNav(){
  const unread = unreadCount();
  const html = PAGES.map(function(p){
    const active = p.id === currentPage ? ' active' : '';
    let badge = '';
    if(p.id === 'donor') badge = '<span class="badge">' + state.donors.length + '</span>';
    if(p.id === 'masuk' && unread) badge = '<span class="badge hot">' + unread + '</span>';
    if(p.id === 'keluar') badge = '<span class="badge">' + outboxList().length + '</span>';
    return '<button class="navitem' + active + '" data-go="' + p.id + '">' +
      '<span class="ico">' + p.ico + '</span><span>' + p.label + '</span>' + badge + '</button>';
  }).join('');
  document.getElementById('nav-desktop').innerHTML = html;

  /* Kategori & Setelan tetap di sidebar; sisanya jadi tab bawah. */
  const tabs = PAGES.filter(function(p){ return p.id !== 'kategori' && p.id !== 'pengaturan'; });
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

/* ---------- 8. RENDER ---------- */
function render(){
  renderNav();
  const v = document.getElementById('view');
  if(currentPage === 'beranda')         v.innerHTML = viewBeranda();
  else if(currentPage === 'masuk')      v.innerHTML = viewKotak('masuk');
  else if(currentPage === 'keluar')     v.innerHTML = viewKotak('keluar');
  else if(currentPage === 'donor')      v.innerHTML = viewDonor();
  else if(currentPage === 'buku')       v.innerHTML = viewBuku(pageParams.id);
  else if(currentPage === 'surat')      v.innerHTML = viewSurat();
  else if(currentPage === 'keuangan')   v.innerHTML = viewKeuangan();
  else if(currentPage === 'kategori')   v.innerHTML = viewKategori();
  else if(currentPage === 'pengaturan') v.innerHTML = viewPengaturan();
  else v.innerHTML = '<div class="empty">Halaman tidak ditemukan</div>';
  afterRender();
}
function afterRender(){
  if(currentPage === 'surat') bindSurat();
  if(currentPage === 'keuangan') bindKeuangan();
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
  setTitle('Beranda','Ringkasan buku surat & email');
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
      '<div class="mail-prev">' + esc(String(m.isi || '').replace(/\s+/g,' ').slice(0, 130)) + '</div>' +
      '<div class="mail-foot">' +
        kanalChip(m) +
        '<span class="chip ' + statusChipClass(m.status) + '">' + esc(m.status) + '</span>' +
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
  setTitle('Donor','Setiap donor punya buku surat sendiri');
  const q = donorFilter.q.toLowerCase();
  let list = state.donors.filter(function(d){
    if(donorFilter.kategori && d.kategori !== donorFilter.kategori) return false;
    if(!q) return true;
    return [d.id,d.pic,d.namaLengkap,d.instansi,d.email,d.hp1,d.hp2,d.kategori,d.alamat]
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
      (d.email ? '<span>✉ ' + esc(d.email) + '</span>' : '<span class="chip warn">tanpa email</span>') +
      (d.hp1 ? '<span>☎ ' + esc(d.hp1) + (d.hp2 ? ' / ' + esc(d.hp2) : '') + '</span>' : '') +
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
function viewBuku(donorId){
  const d = findDonor(donorId);
  if(!d){ go('donor'); return ''; }
  setTitle(donorName(d), 'Buku surat — ' + d.id);
  const book = bookOf(donorId);
  const p = idParts(d.id);

  return '' +
  '<div class="toolbar">' +
    '<button class="btn sm ghost" data-go="donor">← Daftar Donor</button>' +
    '<button class="btn sm" data-action="donor-ubah" data-id="' + esc(d.id) + '">Ubah Data</button>' +
    '<button class="btn sm primary" data-action="balas" data-id="' + esc(d.id) + '">✎ Tulis ke Donor</button>' +
    '<button class="btn sm" data-action="catat-masuk" data-id="' + esc(d.id) + '">↓ Catat Surat Masuk</button>' +
    (d.alamat ? '<button class="btn sm" data-action="cetak-alamat" data-id="' + esc(d.id) + '">⎙ Cetak Alamat</button>' : '') +
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
      kv('Email', d.email) + kv('HP 1', d.hp1) + kv('HP 2', d.hp2) +
      kv('Pengiriman', d.pengiriman) + kv('Asal Gereja', d.asalGereja) +
      kv('Alamat Lengkap', d.alamat) + kv('Catatan', d.catatan) +
    '</div>' +
  '</div>' +

  '<div class="card">' +
    '<div class="card-head"><h2>Buku Surat</h2>' +
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
        '<div class="b-body">' + esc(String(m.isi || '').slice(0, 220)) + '</div>' +
      '</div>';
    }).join('') + '</div>'
      : '<div class="empty"><span class="big">✉</span>Buku masih kosong.<br>' +
        '<button class="btn primary" style="margin-top:12px" data-action="balas" data-id="' + esc(d.id) + '">Tulis surat pertama</button></div>') +
  '</div>';
}
function kv(k,v){
  return '<div class="kv-row"><span class="kv-k">' + esc(k) + '</span>' +
    '<span class="kv-v">' + (v ? esc(v) : '<span class="muted">—</span>') + '</span></div>';
}

/* ---------- TULIS SURAT ---------- */
let suratState = { tplId:'', subjek:'', isi:'', selected:{}, previewId:'', q:'', replyTo:'', kanal:'email',
  kwitansi:false, kwitansiBahasa:'id', kwitansiFinId:'', majalah:false, kirimSendiri:false, dariPeriksa:false };

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
    return [d.id,d.pic,d.namaLengkap,d.instansi,d.email,d.hp1,d.hp2].join(' ').toLowerCase().indexOf(q) >= 0;
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
    return d && !(kanal === 'whatsapp' ? donorWa(d) : d.email);
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
      '<div class="field"><label>Isi Surat <span class="hint">— klik token untuk menyisipkan</span></label>' +
        '<div class="tokenbar">' + TOKENS.map(function(t){
          return '<button type="button" class="token" data-token="' + esc(t[0]) + '" title="' + esc(t[1]) + '">' + esc(t[0]) + '</button>';
        }).join('') + '</div>' +
        '<textarea id="s-isi" style="min-height:230px" placeholder="Tulis isi surat di sini…">' + esc(suratState.isi) + '</textarea>' +
      '</div>' +
      (kanal === 'email' ? blokKwitansi() + blokMajalah() : '') +
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
          : (d.email || 'tanpa email');
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
            ? 'Pesan akan dikirim lewat WhatsApp Cloud API dan otomatis tercatat di buku masing-masing donor.'
            : 'Surat akan dikirim lewat Gmail API dan otomatis tercatat di buku masing-masing donor.')
        : (kanal === 'whatsapp'
            ? 'WhatsApp belum siap. Isi alamat Worker dan kunci aplikasi di <b>Setelan</b> untuk kirim sungguhan. ' +
              'Tanpa itu pesan hanya dicatat sebagai <b>Terkirim</b> (mode simulasi).'
            : 'Gmail belum terhubung. Surat akan dicatat sebagai <b>Terkirim</b> di buku donor (mode simulasi). ' +
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
            '<span class="tiny muted" style="align-self:center">' +
              'Kirim satu salinan ke ' + esc(Gmail.email || 'email Anda') +
              ' supaya bisa diperiksa dulu sebelum ke donor.</span>' +
          '</div>'
        : '') +
    '</div>' +

  '</div>';
}
function previewHTML(d){
  if(!d) return '<div class="card-head"><h2>3 · Pratinjau</h2></div>' +
    '<p class="muted small">Belum ada donor untuk dipratinjau.</p>';
  const wa = suratState.kanal === 'whatsapp';
  const alamat = wa ? (donorWa(d) ? waPhonePretty(donorWa(d)) : 'belum ada nomor HP') : (d.email || 'belum ada email');
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
      ? '<p class="tiny muted" style="margin:14px 0 0">Kwitansi yang ikut terkirim di badan email:</p>' +
        '<div class="kwitansi-preview">' + kwitansiHTML(d, suratState.kwitansiBahasa, suratState.kwitansiFinId) + '</div>'
      : '') +
    (wa && pakaiKwitansi
      ? '<p class="tiny muted" style="margin:14px 0 0">Kwitansi dikirim sebagai gambar — tekan tombol di bawah untuk melihatnya:</p>'
      : '') +
    (!wa && suratState.majalah && majalahInfo()
      ? '<p class="tiny muted" style="margin:14px 0 0">Majalah yang ikut terkirim di badan email:</p>' +
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

  /* Versi teks: yang dilihat penerima mode teks — surat + ringkasan kwitansi. */
  const k = dataKwitansi(d, suratState.kwitansiFinId);
  const teksPolos = isi + '\n\n' +
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
      ' <span class="mono">' + esc(d.email || 'belum ada email') + '</span>' +
      '<span class="chip plain" style="margin-left:6px">' + esc(d.id) + '</span></div>' +

    /* Kerangka klien email */
    '<div class="pj-klien" style="max-width:' + lebarKotak + '">' +
      '<div class="pj-kepala">' +
        '<div class="pj-avatar">K</div>' +
        '<div class="pj-dari">' +
          '<div class="pj-subjek">' + esc(subjek || '(tanpa subjek)') + '</div>' +
          '<div class="pj-meta"><b>' + esc(namaPengirim) + '</b> &lt;' + esc(pengirim) + '&gt;</div>' +
          '<div class="pj-meta">kepada <b>' + esc(donorLabel(d)) + '</b> &lt;' + esc(d.email || '—') + '&gt;</div>' +
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
    return d && !(wa ? donorWa(d) : d.email);
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
    const alamat = wa ? (donorWa(d) ? waPhonePretty(donorWa(d)) : '') : (d.email || '');
    const fin = state.finance.filter(function(f){ return f.donorId === id; });
    const total = fin.length ? Object.keys(totalPerUang(fin)).sort().map(function(k){
      return fmtUang(totalPerUang(fin)[k], k);
    }).join(' + ') : '';
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
      kv('Kepada', contoh ? donorLabel(contoh) + ' · ' + (wa ? waPhonePretty(donorWa(contoh)) : contoh.email) : '—') +
    '</div>' +
    (wa
      ? '<div class="wa-preview"><div class="wa-bubble">' + esc(isi) + '</div></div>'
      : '<div class="letter">' + esc(isi) + '</div>') +

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
  const finOpts = '<option value="">Transaksi terbaru</option>' + finDonor.map(function(f){
    return '<option value="' + esc(f.id) + '"' + (suratState.kwitansiFinId === f.id ? ' selected' : '') + '>' +
      esc(f.tanggal + ' · ' + Object.keys(totalPerUangTransaksi(f)).sort().map(function(k){
        return fmtUang(totalPerUangTransaksi(f)[k], k);
      }).join(' + ')) + '</option>';
  }).join('');

  return '<div class="sep"></div>' +
    '<div class="row" style="justify-content:space-between">' +
      '<span class="small"><b>Lampirkan kwitansi</b> <span class="hint">— tampil di badan email</span></span>' +
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
      save('settings');
      render();
    }
  }catch(e){
    /* 404 = berkasnya memang tidak ada. Galat lain (jaringan, kunci salah)
       diabaikan — jangan menuduh majalah hilang hanya karena tidak bisa
       menghubungi Worker. */
    if(e && e.status === 404){
      state.settings.majalah.hilang = true;
      suratState.majalah = false;
      save('settings');
      render();
      toast('Majalah "' + (m.judul || 'Majalah') + '" sudah tidak ada di Worker — unggah ulang', true);
    }
  }
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
                'penerima dan dikirim lewat WhatsApp.</p>')) +
        '</div>') +
    '<div class="btn-row" style="margin-top:10px">' +
      '<button class="btn sm' + (hilang ? ' primary' : '') + '" data-action="mj-kelola">' +
        (siap ? 'Kelola majalah' : 'Unggah majalah') + '</button>' +
      (siap ? '<button class="btn sm" data-action="mj-baca">👁 Buka halaman pembaca</button>' : '') +
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
  const isi = document.getElementById('s-isi');
  if(isi) isi.addEventListener('input', function(){ suratState.isi = this.value; refreshPreview(); });
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

/* ---------- KEUANGAN ---------- */
let finFilter = { q:'', program:'', uang:'', dari:'', sampai:'', kirim:'' };

function finList(){
  const q = finFilter.q.toLowerCase();
  return state.finance.filter(function(f){
    if(finFilter.program && !(f.program || []).some(function(x){ return x.id === finFilter.program; })) return false;
    /* Filter mata uang mencocokkan baris program, bukan hanya label transaksi. */
    if(finFilter.uang && !(f.program || []).some(function(x){ return mataUangBaris(x, f) === finFilter.uang; })) return false;
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
      (f.program || []).map(function(x){ return programNama(x.id); }).join(' '),
      f.catatan, f.mataUang,
      (f.program || []).map(function(x){ return mataUangBaris(x, f); }).join(' ')].join(' ').toLowerCase();
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
            list.filter(function(f){
              return (f.program || []).some(function(x){ return mataUangBaris(x, f) === k; });
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
            const prog = (f.program || []).map(function(x){
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
    toast('Transaksi diperbarui');
  }else{
    state.finance.push({
      id:uid('fin'), donorId:donorId, tanggal:tanggal, mataUang:mataUang,
      program:program, catatan:catatan, createdAt:new Date().toISOString()
    });
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
    '<p class="small muted">Worker ini dipakai untuk <b>dua hal</b>:</p>' +
    '<ul class="small muted" style="margin:6px 0 10px;padding-left:20px">' +
      '<li><b>Majalah di email</b> — halaman majalah disimpan di sini supaya bisa tampil ' +
        'di email penerima. <b>Sudah dipakai sekarang.</b></li>' +
      '<li><b>Tanda dibaca &amp; konfirmasi</b> — mencatat kapan email dibuka dan kapan ' +
        'donor menekan tombol konfirmasi. <b>Sudah dipakai sekarang.</b></li>' +
      '<li><b>Kirim WhatsApp</b> — <b>ditunda</b> sampai nomor resmi Kartidaya tersedia. ' +
        'Pengiriman tidak boleh memakai akun Facebook pribadi.</li>' +
    '</ul>' +
    '<p class="small muted">Token Meta disimpan di Worker, bukan di browser — token itu tidak ' +
      'boleh ada di halaman statis. Panduan: <b class="mono">PANDUAN-WHATSAPP.md</b></p>' +
    '<div class="field"><label>Alamat Worker <span class="hint">— hasil deploy worker/</span></label>' +
      '<input type="text" id="w-endpoint" class="mono" placeholder="https://kartidaya-wa.namaanda.workers.dev" value="' +
        esc(WhatsApp.endpoint || state.settings.waEndpoint || '') + '"></div>' +
    '<div class="field"><label>Kunci aplikasi <span class="hint">— APP_KEY di Worker</span></label>' +
      '<input type="password" id="w-key" class="mono" placeholder="kunci rahasia" value="' +
        esc(WhatsApp.appKey || '') + '"></div>' +
    '<p class="tiny muted">Alamat &amp; kunci disimpan di browser ini, jadi tidak perlu diisi ulang ' +
      'setiap membuka aplikasi. Kunci tidak ikut ter-ekspor ke berkas cadangan.</p>' +
    '<div class="btn-row">' +
      '<button class="btn primary" data-action="w-save">Simpan &amp; uji sambungan</button>' +
      (WA_DITUNDA ? '' : '<button class="btn" data-action="wa-sync">⟳ Sinkron WhatsApp</button>') +
      (WA_DITUNDA ? '' : '<button class="btn" data-action="wa-cocokkan">⇄ Cocokkan ulang</button>') +
      '<button class="btn danger" data-action="w-disconnect">Putuskan</button>' +
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
    '<div class="card-head"><h2>Data</h2></div>' +
    '<p class="small muted">Tersimpan di browser ini (localStorage). Ukuran: <b class="mono">' +
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
    '<div class="modal-back" data-close-back><div class="modal' + (o.wide ? ' wide' : '') + '" role="dialog" aria-modal="true">' +
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
function openDonorForm(id){
  const isNew = !id;
  const found = isNew ? null : findDonor(id);
  if(!isNew && !found){ toast('Donor ' + id + ' tidak ditemukan', true); return; }
  const d = isNew ? {
    id:'', kategori: state.categories[0] || '', pic:'', namaLengkap:'', instansi:'',
    email:'', hp1:'', hp2:'', panggilan:'', dateStart:'', asalGereja:'', alamat:'',
    tglLahir:'', pengiriman:'', catatan:''
  } : Object.assign({}, found);

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
    '<div class="field"><label>Email</label><input type="email" id="d-email" value="' + esc(d.email) + '" placeholder="nama@contoh.com"></div>' +
    '<div class="field"><label>Pengiriman melalui</label><select id="d-pengiriman">' + krOpts + '</select></div>' +
    '<div class="field"><label>HP 1</label><input type="tel" id="d-hp1" value="' + esc(d.hp1) + '"></div>' +
    '<div class="field"><label>HP 2</label><input type="tel" id="d-hp2" value="' + esc(d.hp2) + '"></div>' +
    '<div class="field"><label>Date Start</label><input type="date" id="d-dateStart" value="' + esc(d.dateStart) + '"></div>' +
    '<div class="field"><label>Tgl Lahir</label><input type="date" id="d-tglLahir" value="' + esc(d.tglLahir) + '"></div>' +
    '<div class="field"><label>Asal Gereja</label><input type="text" id="d-asalGereja" value="' + esc(d.asalGereja) + '"></div>' +
    '<div class="field span2"><label>Alamat Lengkap <span class="hint">— untuk kiriman manual (POS/kurir)</span></label>' +
      '<textarea id="d-alamat" style="min-height:70px" placeholder="Jalan, nomor, RT/RW&#10;Kelurahan, Kecamatan&#10;Kota, Kode Pos">' +
        esc(d.alamat) + '</textarea></div>' +
    '<div class="field span2"><label>Catatan</label><textarea id="d-catatan" style="min-height:70px">' + esc(d.catatan) + '</textarea></div>' +
  '</div><p class="tiny muted">Minimal salah satu dari <b>PIC</b> atau <b>Instansi</b> harus terisi.</p>';

  const footer = (isNew ? '' :
      '<button class="btn danger" data-action="donor-hapus" data-id="' + esc(d.id) + '">Hapus</button>') +
    '<button class="btn" data-close>Batal</button>' +
    '<button class="btn primary" data-action="donor-simpan" data-new="' + (isNew ? '1' : '0') +
      '" data-oldid="' + esc(d.id) + '">Simpan</button>';

  openModal({ title: isNew ? 'Tambah Donor' : 'Ubah Donor', body:body, footer:footer, wide:true });
}
function readDonorForm(){
  function v(id){ const el = document.getElementById(id); return el ? el.value.trim() : ''; }
  return {
    id:v('d-id'), kategori:v('d-kategori'), panggilan:v('d-panggilan'),
    pic:v('d-pic'), namaLengkap:v('d-namaLengkap'), instansi:v('d-instansi'),
    email:v('d-email'), pengiriman:v('d-pengiriman'), hp1:v('d-hp1'), hp2:v('d-hp2'),
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
      kv('Lampiran', m.lampiran) + kv('Catatan', m.catatan) +
      (m.kodeKiriman ? kv('Kode kiriman', m.kodeKiriman) : '') +
      (m.waktuKirim ? kv('Waktu kirim', m.waktuKirim) : '') +
      (m.kwitansiFinId ? kv('Kode kwitansi', (state.finance.filter(function(x){
        return x.id === m.kwitansiFinId;
      })[0] || {}).kode || '—') : '') +
      (m.waError ? kv('Alasan gagal', m.waError + (m.waKode ? ' (kode ' + m.waKode + ')' : '')) : '') +
    '</div>' +
    '<div class="sep"></div>' +
    (m.kanal === 'whatsapp'
      ? '<div class="wa-preview"><div class="wa-bubble">' + esc(m.isi) + '</div></div>'
      : '<div class="letter">' + esc(m.isi) + '</div>') +
    pratinjauLampiran(m, d);

  const footer = '<button class="btn danger" data-action="msg-hapus" data-id="' + esc(m.id) + '">Hapus</button>' +
    '<button class="btn" data-close>Tutup</button>' +
    (d ? '<button class="btn" data-action="buku" data-id="' + esc(d.id) + '">Buka Buku</button>' +
         '<button class="btn primary" data-action="balas" data-id="' + esc(d.id) + '">✎ Balas</button>'
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
      halaman.push('<img src="' + esc(src) + '" alt="Halaman ' + i + '" loading="lazy">');
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
    '<p class="small" style="margin:0 0 4px"><b>Lampiran di badan email</b> ' +
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
      (wa ? (donorWa(d) ? ' · ' + waPhonePretty(donorWa(d)) : '') : (d.email ? ' · ' + d.email : ''))) + '</option>';
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
      dari.value = d ? (wa ? (donorWa(d) ? waPhonePretty(donorWa(d)) : '') : (d.email || '')) : '';
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
      'penerima dan dikirim lewat WhatsApp.</p>' +
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
        body:{ id:id, halaman:i + 1, total:halaman.length, tipe:h.tipe, judul:judul, data:data }
      });
    }catch(e){
      if(prog) prog.textContent = '';
      toast('Gagal mengunggah halaman ' + (i + 1) + ': ' + (e.message || e), true);
      return;
    }
  }

  state.settings.majalah = { id:id, halaman:halaman.length, judul:judul || 'Majalah Kartidaya',
    dariPdf: !!pakaiPdf, pdf: !!pdfBase64, diunggah: new Date().toISOString() };
  save('settings');

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
      save('settings');
      toast('Halaman majalah tersimpan, tapi PDF untuk WhatsApp gagal disimpan: ' + (e.message || e), true);
    }
  }

  if(prog) prog.textContent = '';
  closeModal();
  toast(halaman.length + ' halaman majalah tersimpan');
  render();
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
  save('settings');
  toast('Majalah dihapus');
  render();
}

/* ---------- 10. AKSI ---------- */
function saveDonorFromForm(isNew, oldId){
  const f = readDonorForm();
  if(!f.pic && !f.instansi){ toast('Isi minimal PIC atau Instansi', true); return; }
  if(!f.id) f.id = nextDonorId(f.pic, f.instansi, 'R');
  const dup = state.donors.filter(function(d){ return d.id === f.id && d.id !== oldId; });
  if(dup.length){ toast('ID ' + f.id + ' sudah dipakai', true); return; }

  if(isNew){
    f.createdAt = new Date().toISOString();
    state.donors.push(f);
    toast('Donor ' + f.id + ' ditambahkan');
  }else{
    const i = state.donors.findIndex(function(d){ return d.id === oldId; });
    if(i < 0) return;
    f.createdAt = state.donors[i].createdAt || new Date().toISOString();
    state.donors[i] = f;
    if(oldId !== f.id){
      state.messages.forEach(function(m){ if(m.donorId === oldId) m.donorId = f.id; });
      save('messages');
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
      (n ? '\n' + n + ' surat di bukunya juga akan dihapus.' : ''))) return;
  state.donors = state.donors.filter(function(x){ return x.id !== id; });
  state.messages = state.messages.filter(function(m){ return m.donorId !== id; });
  save('donors'); save('messages');
  closeModal();
  toast('Donor dihapus');
  render();
}

/* Bungkus isi surat + kwitansi jadi satu HTML untuk badan email. Gaya ditulis
   inline karena klien email membuang <style>. */
function isiHTML(d, isiTeks, bahasa, finId, opts){
  opts = opts || {};
  const teks = esc(isiTeks).replace(/\n/g, '<br>');
  return '<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.65;' +
      'color:#111;max-width:720px">' + teks + '</div>' +
    (opts.kwitansi === false ? '' : kwitansiHTML(d, bahasa, finId,
      { kodeKiriman: opts.kodeKiriman, waktuKirim: opts.waktuKirim })) +
    (opts.majalah ? majalahHTML({ tautan: true }) : '') +
    (opts.terimaId ? terimaHTML(opts.terimaId, opts.terimaInfo, { pratinjau: opts.terimaPratinjau }) : '') +
    (opts.pixelId ? pixelHTML(opts.pixelId) : '');
}

/* Kirim satu salinan ke email sendiri dulu. Tujuannya supaya user bisa
   memeriksa hasil sungguhan di kotak masuknya sendiri sebelum dikirim ke
   donor. Salinan ini TIDAK dicatat di buku donor — ini hanya uji coba. */
async function kirimKeSendiri(){
  const ids = Object.keys(suratState.selected).filter(function(k){ return suratState.selected[k]; });
  if(!ids.length){ toast('Pilih penerima dulu', true); return; }
  if(!suratState.isi.trim()){ toast('Isi surat masih kosong', true); return; }
  if(!Gmail.isConnected()){
    toast('Hubungkan Gmail dulu di halaman Setelan', true);
    return;
  }
  const tujuan = Gmail.email || '';
  if(!tujuan){ toast('Alamat email Anda belum terbaca dari Gmail', true); return; }

  /* Pakai penerima pertama sebagai contoh, supaya isi surat & kwitansinya
     benar-benar terisi seperti yang akan diterima donor. */
  const d = findDonor(ids[0]);
  if(!d){ toast('Penerima tidak ditemukan', true); return; }

  const subjek = '[UJI] ' + fillTemplate(suratState.subjek, d);
  const isi = fillTemplate(suratState.isi, d);
  const kode = kodeKiriman();
  const waktu = waktuKirim();
  const html = isiHTML(d, isi, suratState.kwitansiBahasa, suratState.kwitansiFinId, {
    kwitansi: !!suratState.kwitansi,
    majalah: !!suratState.majalah,
    kodeKiriman: kode, waktuKirim: waktu
  });

  const btn = document.querySelector('[data-action="kirim-sendiri"]');
  if(btn){ btn.disabled = true; btn.textContent = 'Mengirim…'; }
  try{
    await Gmail.send({ from: Gmail.email || '', to: tujuan, subject: subjek, body: isi, html: html });
    toast('Salinan uji terkirim ke ' + tujuan + ' — periksa kotak masuk Anda');
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
      'Pesan hanya akan dicatat sebagai "Terkirim" di buku donor (mode simulasi).\n\n' +
      'Hubungkan ' + apa + ' di halaman Setelan kalau ingin kirim sungguhan.\n\n' +
      'Lanjutkan mencatat sebagai simulasi?');
    if(!lanjut) return;
  }

  let ok = 0, gagal = 0, errMsg = '';

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
    const tujuan = kanal === 'whatsapp' ? donorWa(d) : (d.email || '');
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

    if(useGmail){
      if(!d.email){
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
          /* Salinan kwitansi disimpan apa adanya. Kalau nanti data keuangan
             diubah, isi surat yang sudah terkirim tetap bisa diperiksa persis
             seperti yang diterima donor. */
          if(suratState.kwitansi){
            kwitansiSalinan = kwitansiHTML(d, suratState.kwitansiBahasa, suratState.kwitansiFinId,
              { kodeKiriman: kodeKrm, waktuKirim: waktuKrm });
            kwitansiBahasaSalinan = suratState.kwitansiBahasa;
          }
          const r = await Gmail.send({
            from: Gmail.email || '', to: d.email, subject: subjek, body: isi, html: html
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
      to: tujuan,
      gmailId:gmailId, threadId:threadId, waId:waId, dibaca:true,
      pixelId: pixelId, dibacaPenerima: '',
      terimaId: terimaId, terimaPenerima: '',
      kodeKiriman: kodeKrm, waktuKirim: waktuKrm,
      kwitansiHTML: kwitansiSalinan, kwitansiBahasa: kwitansiBahasaSalinan,
      kwitansiFinId: suratState.kwitansi ? (dataKwitansi(d, suratState.kwitansiFinId).finId || '') : '',
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
  if(asDraft) toast(ids.length + ' surat disimpan sebagai Draft');
  else if(useGmail || useWa) toast(ok + ' terkirim lewat ' + namaKanal + (gagal ? ', ' + gagal + ' gagal: ' + errMsg : ''), gagal > 0);
  else toast(ids.length + ' surat dicatat sebagai Terkirim (mode simulasi)');

  suratState.selected = {};
  render();
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
      (d.hp1 ? '<div class="hp">☎ ' + esc(d.hp1) + (d.hp2 ? ' / ' + esc(d.hp2) : '') + '</div>' : '') +
      '<div class="id">' + esc(d.id) + '</div>' +
    '</div></body></html>');
  w.document.close();
  w.focus();
  setTimeout(function(){ w.print(); }, 300);
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
      toast(gagal + ' pesan WhatsApp gagal terkirim — cek buku donor', true);
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
  toast('Backup JSON diunduh');
}
function exportCSV(){
  const cols = ['id','kategori','panggilan','pic','namaLengkap','instansi','email','hp1','hp2',
                'pengiriman','dateStart','asalGereja','alamat','tglLahir','catatan'];
  const head = ['ID-DONOR','KATEGORI','PANGGILAN','PIC','NAMA LENGKAP','INSTANSI','EMAIL','HP 1','HP 2',
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
    ['email','EMAIL'], ['hp1','HP 1'], ['hp2','HP 2'],
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
      save();
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
      refreshPreview();
    }
    return;
  }

  const act = e.target.closest('[data-action]');
  if(!act) return;
  const a = act.getAttribute('data-action');
  const id = act.getAttribute('data-id');

  switch(a){
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
      go('surat');
      break;
    }
    case 'catat-masuk': closeModal(); openCatatMasuk(id || ''); break;
    case 'catat-masuk-simpan': {
      const g = function(x){ const el = document.getElementById(x); return el ? el.value.trim() : ''; };
      if(!g('l-donor')){ toast('Pilih donor dulu', true); break; }
      const d = findDonor(g('l-donor'));
      const st = g('l-status') || 'Belum dibaca';
      const kanal = g('l-kanal') === 'whatsapp' ? 'whatsapp' : 'email';
      const dari = g('l-dari') || (d ? (kanal === 'whatsapp' ? donorWa(d) : d.email) : '');
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
      if(confirm('Hapus surat ini dari buku?')){
        state.messages = state.messages.filter(function(m){ return m.id !== id; });
        save('messages'); closeModal(); toast('Surat dihapus'); render();
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
        if(m.kanal === 'whatsapp'){
          if(!donorWa(d)){ d.hp1 = waPhonePretty(m.from); save('donors'); }
        }else if(!d.email){
          d.email = emailOf(m.from);
          save('donors');
        }
      }
      save('messages');
      closeModal(); toast('Surat ditautkan ke ' + donorId); render();
      break;
    }
    case 'kirim': kirimSurat(false); break;
    case 'kirim-sendiri': kirimKeSendiri(); break;
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
        state.templates = state.templates.filter(function(t){ return t.id !== id; });
        save('templates'); closeModal(); openTplKelola(); render();
      }
      break;
    case 'tpl-simpan': {
      const nama = prompt('Nama template baru:', 'Template ' + (state.templates.length + 1));
      if(!nama) break;
      state.templates.push({ id:uid('tpl'), nama:nama, subjek:suratState.subjek, isi:suratState.isi });
      save('templates'); toast('Template disimpan'); render();
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
      state.categories.push(nama); save('categories'); toast('Kategori ditambahkan'); render();
      break;
    }
    case 'kat-ubah': {
      const lama = act.getAttribute('data-kat');
      const baru = prompt('Ubah nama kategori:', lama);
      if(!baru || baru === lama) break;
      state.categories = state.categories.map(function(c){ return c === lama ? baru : c; });
      state.donors.forEach(function(d){ if(d.kategori === lama) d.kategori = baru; });
      save('categories'); save('donors'); toast('Kategori diubah'); render();
      break;
    }
    case 'kat-hapus': {
      const k = act.getAttribute('data-kat');
      const n = state.donors.filter(function(d){ return d.kategori === k; }).length;
      if(!confirm('Hapus kategori "' + k + '"?' + (n ? '\n' + n + ' donor menjadi tanpa kategori.' : ''))) break;
      state.categories = state.categories.filter(function(c){ return c !== k; });
      state.donors.forEach(function(d){ if(d.kategori === k) d.kategori = ''; });
      save('categories'); save('donors'); toast('Kategori dihapus'); render();
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
      state.settings.waEndpoint = '';
      save('settings');
      toast('WhatsApp diputuskan');
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
      save('settings');
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
    case 'ekspor-xlsx': exportXLSX(); break;
    case 'ekspor-csv': exportCSV(); break;
    case 'impor-json': document.getElementById('file-import').click(); break;
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
setInterval(function(){ cekTandaDibaca(); cekKonfirmasiTerima(); }, 3 * 60 * 1000);
document.addEventListener('visibilitychange', function(){
  if(!document.hidden){
    sinkronOtomatis(); waSinkronOtomatis(); cekTandaDibaca(); cekKonfirmasiTerima();
  }
});
/* Beri jeda sedikit supaya token sempat dipulihkan lebih dulu. */
setTimeout(sinkronOtomatis, 3000);
if(!WA_DITUNDA) setTimeout(waSinkronOtomatis, 4000);
setTimeout(function(){ cekTandaDibaca(); cekKonfirmasiTerima(); }, 6000);
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
