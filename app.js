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
  settings:'kartidaya.v2.settings'
};

const PANGGILAN = ['','Ibu','Bapak','Saudara','Saudari'];
const PENGIRIMAN = ['','Email','WhatsApp','POS','Kurir','Lainnya'];
const STATUS_KELUAR = ['Draft','Terkirim','Gagal'];
const STATUS_MASUK = ['Belum dibaca','Dibaca','Dibalas'];

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
    isi:'Kepada Yth.\n{/PIC}\n{/INST}\n\nDengan hormat,\n\nDengan ini kami mengundang {/PIC} untuk hadir dalam kegiatan yang akan kami selenggarakan.\n\nHari/Tanggal : \nWaktu        : \nTempat       : \n\nMerupakan suatu kehormatan apabila {/PIC} dapat hadir.\n\nHormat kami,\nKartidaya\n\n{/TANGGAL}' }
];

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
  ['{/TANGGAL}','Tanggal hari ini']
];

/* ---------- 2. STATE ---------- */
let state = { donors:[], categories:[], templates:[], messages:[], settings:{} };

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
}
function loadState(){
  const firstRun = localStorage.getItem(LS.donors) === null;
  state.donors     = readLS(LS.donors, null) || SEED_DONORS.slice();
  state.categories = readLS(LS.categories, null) || DEFAULT_CATEGORIES.slice();
  state.templates  = readLS(LS.templates, null) || DEFAULT_TEMPLATES.slice();
  state.messages   = readLS(LS.messages, null) || [];
  state.settings   = readLS(LS.settings, null) || {};
  if(!state.settings.theme) state.settings.theme = 'light';
  if(!state.settings.gmailClientId) state.settings.gmailClientId = '';
  if(!state.settings.signature) state.settings.signature = 'Hormat kami,\nKartidaya';
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
  root.appendChild(el);
  setTimeout(function(){ el.remove(); }, 3000);
}
function donorName(d){ return d.pic || d.namaLengkap || d.instansi || '(tanpa nama)'; }
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
    '/TANGGAL': todayID()
  };
  return String(text || '').replace(/\{\/([A-Z_]+)\}/g, function(m, k){
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
    gmailId:'', threadId:'', lampiran:'', catatan:'', dibaca:true
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
  { id:'kategori',   label:'Kategori',   ico:'◫' },
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
  else if(currentPage === 'kategori')   v.innerHTML = viewKategori();
  else if(currentPage === 'pengaturan') v.innerHTML = viewPengaturan();
  else v.innerHTML = '<div class="empty">Halaman tidak ditemukan</div>';
  afterRender();
}
function afterRender(){
  if(currentPage === 'surat') bindSurat();
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

  return '' +
  '<div class="grid stats" style="margin-bottom:14px">' +
    stat('Total Donor', state.donors.length, state.categories.length + ' kategori') +
    stat('Belum Dibaca', unread, masuk + ' surat masuk') +
    stat('Surat Keluar', keluar, keluarBulan + ' bulan ini') +
    stat('Status Gmail', gmailState === 'connected' ? 'Aktif' : '—', gmailText) +
  '</div>' +

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
let kotakFilter = { q:'', donorId:'', status:'' };

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
    (isMasuk
      ? '<button class="btn primary" data-action="sync">⟳ Sinkron Gmail</button>'
      : '<button class="btn primary" data-go="surat">✎ Tulis Surat</button>') +
  '</div>' +
  '<p class="tiny muted" style="margin:-6px 0 12px">' + list.length + ' surat</p>' +
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
        '<span class="chip' + (m.status === 'Gagal' ? ' warn' : (m.status === 'Draft' ? ' plain' : '')) + '">' + esc(m.status) + '</span>' +
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
    return [d.id,d.pic,d.namaLengkap,d.instansi,d.email,d.hp1,d.hp2,d.kategori]
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
    '<input type="search" class="grow" id="f-q" placeholder="Cari nama, instansi, email, ID…" value="' + esc(donorFilter.q) + '">' +
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
      kv('Alamat', d.alamat) + kv('Catatan', d.catatan) +
    '</div>' +
  '</div>' +

  '<div class="card">' +
    '<div class="card-head"><h2>Buku Surat</h2>' +
      '<span class="chip plain">↑' + countMsg(donorId,'keluar') + ' keluar</span>' +
      '<span class="chip plain">↓' + countMsg(donorId,'masuk') + ' masuk</span></div>' +
    (book.length ? '<div class="thread">' + book.map(function(m){
      const isIn = m.arah === 'masuk';
      return '<div class="bubble ' + (isIn ? 'in' : 'out') + '" data-open-msg="' + esc(m.id) + '">' +
        '<div class="b-head">' +
          '<span class="b-dir">' + (isIn ? '↓ Masuk' : '↑ Keluar') + '</span>' +
          '<span class="b-status">' + esc(m.status) + '</span>' +
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
let suratState = { tplId:'', subjek:'', isi:'', selected:{}, previewId:'', q:'', replyTo:'' };

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
    return [d.id,d.pic,d.namaLengkap,d.instansi,d.email].join(' ').toLowerCase().indexOf(q) >= 0;
  });
  const ids = Object.keys(suratState.selected).filter(function(k){ return suratState.selected[k]; });
  const nSel = ids.length;
  const previewDonor = findDonor(suratState.previewId) || (nSel ? findDonor(ids[0]) : null) || state.donors[0] || null;
  const gmailOk = Gmail.isConnected();

  return '' +
  '<div class="grid" style="grid-template-columns:minmax(0,1fr);gap:14px">' +

    '<div class="card">' +
      '<div class="card-head"><h2>1 · Template</h2>' +
        '<button class="btn sm ghost" data-action="tpl-kelola">Kelola template</button></div>' +
      '<div class="form-grid">' +
        '<div class="field"><label>Template</label><select id="s-tpl">' +
          (tplOpts || '<option value="">(belum ada template)</option>') + '</select></div>' +
        '<div class="field"><label>Subjek</label>' +
          '<input type="text" id="s-subjek" value="' + esc(suratState.subjek) + '" placeholder="Subjek surat…"></div>' +
      '</div>' +
      '<div class="field"><label>Isi Surat <span class="hint">— klik token untuk menyisipkan</span></label>' +
        '<div class="tokenbar">' + TOKENS.map(function(t){
          return '<button type="button" class="token" data-token="' + esc(t[0]) + '" title="' + esc(t[1]) + '">' + esc(t[0]) + '</button>';
        }).join('') + '</div>' +
        '<textarea id="s-isi" style="min-height:230px" placeholder="Tulis isi surat di sini…">' + esc(suratState.isi) + '</textarea>' +
      '</div>' +
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
        return '<label class="recipient' + (on ? ' on' : '') + '">' +
          '<input type="checkbox" data-recip="' + esc(d.id) + '"' + (on ? ' checked' : '') + '>' +
          '<span class="txt"><b>' + esc(donorName(d)) + '</b>' +
          '<span>' + esc(d.id) + (d.email ? ' · ' + esc(d.email) : ' · tanpa email') + '</span></span>' +
        '</label>';
      }).join('') + '</div>' : '<p class="muted small">Tidak ada donor.</p>') +
    '</div>' +

    '<div class="card" id="preview-card">' + previewHTML(previewDonor) + '</div>' +

    '<div class="card">' +
      '<div class="card-head"><h2>4 · Kirim</h2>' +
        '<span class="chip' + (gmailOk ? '' : ' plain') + '">' +
          (gmailOk ? 'Gmail aktif' : 'Mode simulasi') + '</span></div>' +
      '<p class="small muted">' + (gmailOk
        ? 'Surat akan dikirim lewat Gmail API dan otomatis tercatat di buku masing-masing donor.'
        : 'Gmail belum terhubung. Surat akan dicatat sebagai <b>Terkirim</b> di buku donor (mode simulasi). ' +
          'Hubungkan Gmail di <b>Setelan</b> untuk kirim sungguhan.') + '</p>' +
      '<div class="btn-row">' +
        '<button class="btn primary" id="kirim-btn" data-action="kirim"' + (nSel ? '' : ' disabled') + '>➤ Kirim (' + nSel + ')</button>' +
        '<button class="btn" id="draft-btn" data-action="simpan-draft"' + (nSel ? '' : ' disabled') + '>Simpan Draft</button>' +
        '<button class="btn ghost" data-action="tpl-simpan">Simpan sebagai template</button>' +
      '</div>' +
    '</div>' +

  '</div>';
}
function previewHTML(d){
  if(!d) return '<div class="card-head"><h2>3 · Pratinjau</h2></div>' +
    '<p class="muted small">Belum ada donor untuk dipratinjau.</p>';
  return '<div class="card-head"><h2>3 · Pratinjau</h2>' +
      '<span class="chip plain">' + esc(donorName(d)) + '</span></div>' +
    '<div class="small muted" style="margin-bottom:8px">Kepada: <b>' + esc(donorLabel(d)) + '</b>' +
      (d.instansi ? ' — ' + esc(d.instansi) : '') + '</div>' +
    '<div class="letter">' + esc(fillTemplate(suratState.isi, d)) + '</div>' +
    '<div class="btn-row" style="margin-top:12px">' +
      '<button class="btn" data-action="print-one" data-id="' + esc(d.id) + '">⎙ Cetak</button>' +
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
  const q = document.getElementById('s-q');
  if(q) q.addEventListener('input', function(){
    suratState.q = this.value;
    const pos = this.selectionStart;
    render();
    const el = document.getElementById('s-q');
    if(el){ el.focus(); el.setSelectionRange(pos,pos); }
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
  if(kb){ kb.disabled = !ids.length; kb.textContent = '➤ Kirim (' + ids.length + ')'; }
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

/* ---------- PENGATURAN ---------- */
function viewPengaturan(){
  setTitle('Setelan','Gmail, data, dan tampilan');
  const st = Gmail.status();
  const bytes = new Blob([JSON.stringify(state)]).size;
  const label = { unconfigured:'Belum diatur', disconnected:'Siap dihubungkan', connected:'Terhubung' }[st];

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
    '<p class="tiny muted">Daftarkan origin ini di Google Cloud Console → Credentials → ' +
      'Authorized JavaScript origins:<br><b class="mono">' + esc(Gmail.origin()) + '</b></p>' +
    '<div class="btn-row">' +
      '<button class="btn primary" data-action="g-save">Simpan Client ID</button>' +
      '<button class="btn" data-action="g-connect">' + (st === 'connected' ? 'Hubungkan ulang' : 'Hubungkan Gmail') + '</button>' +
      '<button class="btn" data-action="sync">⟳ Sinkron sekarang</button>' +
      '<button class="btn danger" data-action="g-disconnect">Putuskan</button>' +
    '</div>' +
    (Gmail.email ? '<p class="small muted" style="margin-top:10px">Akun: <b class="mono">' + esc(Gmail.email) + '</b></p>' : '') +
    '<div class="sep"></div>' +
    '<p class="small muted">Panduan lengkap: <b class="mono">PANDUAN-GMAIL.md</b></p>' +
  '</div>' +

  '<div class="card">' +
    '<div class="card-head"><h2>Tanda Tangan</h2></div>' +
    '<div class="field"><label>Ditambahkan di akhir surat baru</label>' +
      '<textarea id="set-sign" style="min-height:80px">' + esc(state.settings.signature) + '</textarea></div>' +
    '<button class="btn" data-action="sign-save">Simpan</button>' +
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
      '<button class="btn" data-action="ekspor-json">↓ Ekspor JSON</button>' +
      '<button class="btn" data-action="ekspor-csv">↓ Ekspor CSV Donor</button>' +
      '<button class="btn" data-action="impor-json">↑ Impor JSON</button>' +
      '<button class="btn" data-action="muat-contoh">Muat data contoh</button>' +
      '<button class="btn danger" data-action="reset">Hapus semua data</button>' +
    '</div>' +
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
    '<div class="field"><label>Alamat Lengkap</label><input type="text" id="d-alamat" value="' + esc(d.alamat) + '"></div>' +
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
  if(m.arah === 'masuk' && !m.dibaca){ m.dibaca = true; save('messages'); }

  const body = '<div class="row" style="margin-bottom:12px">' +
      '<span class="chip' + (m.arah === 'masuk' ? ' plain' : '') + '">' +
        (m.arah === 'masuk' ? '↓ Masuk' : '↑ Keluar') + '</span>' +
      '<span class="chip plain">' + esc(m.status) + '</span>' +
      '<span class="tiny muted mono">' + fmtDateTime(m.tanggal) + '</span></div>' +
    '<div class="kv">' +
      kv('Donor', d ? donorName(d) + ' (' + d.id + ')' : '—') +
      kv('Dari', m.from) + kv('Kepada', m.to) + kv('Subjek', m.subjek) +
      kv('Lampiran', m.lampiran) + kv('Catatan', m.catatan) +
    '</div>' +
    '<div class="sep"></div><div class="letter">' + esc(m.isi) + '</div>';

  const footer = '<button class="btn danger" data-action="msg-hapus" data-id="' + esc(m.id) + '">Hapus</button>' +
    '<button class="btn" data-close>Tutup</button>' +
    (d ? '<button class="btn" data-action="buku" data-id="' + esc(d.id) + '">Buka Buku</button>' +
         '<button class="btn primary" data-action="balas" data-id="' + esc(d.id) + '">✎ Balas</button>'
       : '<button class="btn primary" data-action="tautkan" data-id="' + esc(m.id) + '">Tautkan ke Donor</button>');

  openModal({ title: m.subjek || '(tanpa subjek)', body:body, footer:footer, wide:true });
  renderNav();
}

/* ---------- Tautkan surat tak dikenal ke donor ---------- */
function openTautkan(msgId){
  const m = state.messages.filter(function(x){ return x.id === msgId; })[0];
  if(!m) return;
  const guess = emailOf(m.from);
  const donorOpts = '<option value="">— pilih donor —</option>' + state.donors.map(function(d){
    return '<option value="' + esc(d.id) + '">' + esc(d.id + ' — ' + donorName(d) +
      (d.email ? ' · ' + d.email : '')) + '</option>';
  }).join('');
  const body = '<p class="small muted">Pengirim <b class="mono">' + esc(m.from || '—') +
      '</b> belum terhubung ke donor mana pun.</p>' +
    '<div class="field"><label>Pilih donor</label><select id="t-donor">' + donorOpts + '</select></div>' +
    '<label class="row small" style="gap:6px"><input type="checkbox" id="t-email" checked>' +
      'Simpan email pengirim ke data donor (jika donor belum punya email)</label>';
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
      '<div class="field"><label>Status</label><select id="l-status">' +
        STATUS_MASUK.map(function(s){ return '<option>' + s + '</option>'; }).join('') + '</select></div>' +
    '</div>' +
    '<div class="field"><label>Subjek</label><input type="text" id="l-subjek" placeholder="Subjek surat masuk"></div>' +
    '<div class="field"><label>Isi / Ringkasan</label><textarea id="l-isi" style="min-height:120px"></textarea></div>' +
    '<div class="field"><label>Catatan</label><input type="text" id="l-catatan"></div>';
  openModal({ title:'Catat Surat Masuk', body:body,
    footer:'<button class="btn" data-close>Batal</button>' +
      '<button class="btn primary" data-action="catat-masuk-simpan">Simpan</button>' });
}

/* ---------- Kelola Template ---------- */
function openTplKelola(){
  const body = '<div class="stack">' + state.templates.map(function(t){
    return '<div class="card" style="padding:12px">' +
      '<div class="row"><b style="flex:1">' + esc(t.nama) + '</b>' +
        '<button class="btn sm ghost" data-action="tpl-pakai" data-id="' + esc(t.id) + '">Pakai</button>' +
        '<button class="btn sm ghost" data-action="tpl-hapus" data-id="' + esc(t.id) + '">Hapus</button></div>' +
      '<div class="tiny muted mono" style="margin-top:4px">' + esc(t.subjek) + '</div></div>';
  }).join('') + '</div>';
  openModal({ title:'Template Surat', body:body, footer:'<button class="btn" data-close>Tutup</button>' });
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

async function kirimSurat(asDraft){
  const ids = Object.keys(suratState.selected).filter(function(k){ return suratState.selected[k]; });
  if(!ids.length){ toast('Pilih penerima dulu', true); return; }
  if(!suratState.isi.trim()){ toast('Isi surat masih kosong', true); return; }

  const useGmail = Gmail.isConnected() && !asDraft;
  let ok = 0, gagal = 0, errMsg = '';

  for(const id of ids){
    const d = findDonor(id);
    if(!d) continue;
    const subjek = fillTemplate(suratState.subjek, d);
    const isi = fillTemplate(suratState.isi, d);
    let status = asDraft ? 'Draft' : 'Terkirim';
    let gmailId = '', threadId = '';

    if(useGmail && d.email){
      try{
        const r = await Gmail.send({
          from: Gmail.email || 'me', to: d.email, subject: subjek, body: isi
        });
        gmailId = (r && r.id) || '';
        threadId = (r && r.threadId) || '';
        ok++;
      }catch(e){
        status = 'Gagal';
        errMsg = e.message || String(e);
        gagal++;
      }
    }else if(!asDraft){
      ok++;
    }

    addMessage({
      donorId:id, arah:'keluar', tanggal:new Date().toISOString(),
      subjek:subjek, isi:isi, status:status,
      from: Gmail.email || '', to: d.email || '',
      gmailId:gmailId, threadId:threadId, dibaca:true
    });
  }

  if(asDraft) toast(ids.length + ' surat disimpan sebagai Draft');
  else if(useGmail) toast(ok + ' terkirim lewat Gmail' + (gagal ? ', ' + gagal + ' gagal: ' + errMsg : ''), gagal > 0);
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
async function gmailSync(){
  if(!Gmail.isConnected()){ toast('Hubungkan Gmail dulu di Setelan', true); return; }
  toast('Menarik surat masuk…');
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
    toast(baru ? baru + ' surat masuk ditarik' + (takDikenal ? ' (' + takDikenal + ' belum dikenal)' : '')
               : 'Tidak ada surat baru');
    render();
  }catch(e){
    toast('Sinkron gagal: ' + (e.message || e), true);
  }
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
      suratState.selected = {}; suratState.selected[id] = true;
      suratState.previewId = id;
      suratState.subjek = 'Re: ' + (lastMsg(id) ? lastMsg(id).subjek : 'Surat dari Kartidaya');
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
      addMessage({
        donorId:g('l-donor'), arah:'masuk',
        tanggal: g('l-tanggal') ? new Date(g('l-tanggal') + 'T09:00:00').toISOString() : new Date().toISOString(),
        subjek:g('l-subjek'), isi:g('l-isi'), status:g('l-status'),
        from: d ? d.email : '', to: Gmail.email || '', catatan:g('l-catatan'), dibaca:true
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
      if(cb && cb.checked && d && !d.email && m.from){
        d.email = emailOf(m.from);
        save('donors');
      }
      save('messages');
      closeModal(); toast('Surat ditautkan ke ' + donorId); render();
      break;
    }
    case 'kirim': kirimSurat(false); break;
    case 'simpan-draft': kirimSurat(true); break;
    case 'sel-all':
      state.donors.forEach(function(d){ suratState.selected[d.id] = true; });
      refreshRecipients(); refreshPreview(); break;
    case 'sel-none':
      suratState.selected = {}; suratState.previewId = '';
      refreshRecipients(); refreshPreview(); break;
    case 'tpl-kelola': openTplKelola(); break;
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
    case 'print-one': { const d = findDonor(id); if(d) printLetter(d); break; }
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
    case 'g-disconnect': Gmail.disconnect(); toast('Gmail diputuskan'); render(); break;
    case 'sync': gmailSync(); break;
    case 'sign-save': {
      const el = document.getElementById('set-sign');
      state.settings.signature = el ? el.value : '';
      save('settings'); toast('Tanda tangan disimpan');
      break;
    }
    case 'ekspor-json': exportJSON(); break;
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

function cycleTheme(){
  const order = ['light','dark','auto'];
  const cur = state.settings.theme || 'light';
  setTheme(order[(order.indexOf(cur) + 1) % order.length]);
}
document.getElementById('theme-btn').addEventListener('click', cycleTheme);
document.getElementById('theme-btn-m').addEventListener('click', cycleTheme);

render();
