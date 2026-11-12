/* ============================================================
   Kartidaya — Cloudflare Worker untuk WhatsApp Cloud API (Meta)

   Kenapa perlu Worker?
   - API token Meta TIDAK BOLEH ada di browser (bisa dicuri lewat F12).
   - Pesan masuk dikirim Meta ke sebuah URL publik (webhook). GitHub Pages
     hanya menyajikan file statis, tidak bisa menerima kiriman data.

   Endpoint:
     GET  /wa/status   → cek konfigurasi
     POST /wa/send     → kirim pesan teks
     GET  /wa/webhook  → verifikasi webhook oleh Meta
     POST /wa/webhook  → terima pesan masuk dari Meta
     GET  /wa/inbox    → ambil pesan masuk yang belum diambil aplikasi
     POST /wa/ack      → tandai pesan sudah diambil aplikasi
     POST /wa/status-pesan → kabar status pesan keluar (terkirim/gagal)

   Endpoint majalah (halaman majalah tampil di badan email):
     POST   /majalah          → unggah satu halaman
     GET    /majalah/<id>     → info majalah
     DELETE /majalah/<id>     → hapus majalah
     GET    /majalah/<id>/<n> → gambar halaman ke-n (publik)

   Endpoint tanda dibaca:
     GET  /pixel/<id>         → gambar 1×1, sekaligus mencatat email dibuka
     POST /pixel/status       → cek ID mana yang sudah dibuka

   Endpoint data bersama (database D1) — supaya beberapa orang bisa bekerja
   pada data yang sama:
     GET    /data                 → ambil semua data sekaligus
     POST   /data/<koleksi>       → simpan satu baris { id, data }
     DELETE /data/<koleksi>/<id>  → hapus satu baris
     POST   /data/meta/<kunci>    → simpan data berbentuk satu nilai

   Endpoint akun (login aplikasi):
        POST /akun/login          → email + password → token 12 jam
        POST /akun/saya           → cek token & data pengguna
        POST /akun/keluar         → cabut token
        POST /akun/daftar         → buat akun (butuh kode undangan)
        GET  /akun/daftar-terbuka → apakah pintu pendaftaran terbuka
        GET  /akun/pengguna       → daftar akun (butuh token)
        POST /akun/ganti-password → ganti password sendiri / oleh admin

      Semua endpoint butuh header X-App-Key, KECUALI:
        /daftar (halaman pendaftaran terpisah), /wa/webhook, /pixel/<id>,
        /majalah/<id>/<n> — sisanya dipanggil Meta dan klien email yang tidak
        punya kunci.
   ============================================================ */

const GRAPH = 'https://graph.facebook.com/v21.0';

/* ---------- utilitas ---------- */

function json(data, status) {
  return new Response(JSON.stringify(data), {
    status: status || 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store'
    }
  });
}

/* CORS: aplikasi berjalan di origin berbeda (GitHub Pages / localhost). */
function corsHeaders(req) {
  const origin = req.headers.get('Origin') || '*';
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-App-Key, Authorization',
    'Access-Control-Max-Age': '600',
    'Vary': 'Origin'
  };
}

function withCors(res, req) {
  const h = new Headers(res.headers);
  const c = corsHeaders(req);
  for (const k in c) h.set(k, c[k]);
  return new Response(res.body, { status: res.status, headers: h });
}

/* Bandingkan kunci tanpa membocorkan panjang/isi lewat waktu eksekusi. */
function sameKey(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function authorized(req, env) {
  if (!env.APP_KEY) return false;
  return sameKey(req.headers.get('X-App-Key') || '', env.APP_KEY);
}

/* Nomor WhatsApp selalu format internasional tanpa tanda: 62811xxxxxxx */
function normalizePhone(v) {
  let s = String(v == null ? '' : v).replace(/[^0-9]/g, '');
  if (!s) return '';
  if (s.startsWith('0')) s = '62' + s.slice(1);
  else if (s.startsWith('620')) s = '62' + s.slice(3);
  else if (s.startsWith('8')) s = '62' + s;
  return s;
}

/* ---------- Meta Graph API ---------- */

/* Kirim pesan WhatsApp berisi teks saja. */
async function waSend(env, to, text) {
  return waPost(env, {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: to,
    type: 'text',
    text: { preview_url: false, body: text }
  });
}

/* Kirim pesan WhatsApp berisi gambar atau dokumen.
   WhatsApp Cloud API bisa mengambil berkas langsung dari alamat publik
   (`link`), jadi tidak perlu langkah unggah terpisah. Ini lebih sederhana
   dan lebih cepat daripada Media API. */
async function waSendMedia(env, to, media) {
  const jenis = media.jenis === 'document' ? 'document' : 'image';
  const link = String(media.link || '');
  if (!/^https:\/\//i.test(link)) {
    const e = new Error('Alamat berkas harus https://');
    e.code = 'LINK_TIDAK_SAH';
    throw e;
  }
  const isi = { link: link };
  if (media.caption) isi.caption = String(media.caption).slice(0, 1000);
  if (jenis === 'document') {
    isi.filename = String(media.filename || 'berkas.pdf').slice(0, 120);
  }
  const body = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: to,
    type: jenis
  };
  body[jenis] = isi;
  return waPost(env, body);
}

/* Satu tempat untuk memanggil Graph API supaya penanganan galat seragam. */
async function waPost(env, body) {
  const url = GRAPH + '/' + env.WA_PHONE_ID + '/messages';
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + env.WA_TOKEN,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });
  const data = await res.json().catch(function () { return {}; });
  if (!res.ok) {
    const err = (data && data.error) || {};
    const msg = err.message || ('HTTP ' + res.status);
    const e = new Error(msg);
    e.code = err.code;
    e.subcode = err.error_subcode;
    throw e;
  }
  const m = (data.messages && data.messages[0]) || {};
  return { id: m.id || '', raw: data };
}

/* Ambil info nomor WhatsApp Business (display phone number + nama). */
async function waProfile(env) {
  if (!env.WA_TOKEN || !env.WA_PHONE_ID) return {};
  try {
    const res = await fetch(
      GRAPH + '/' + env.WA_PHONE_ID + '?fields=display_phone_number,verified_name',
      { headers: { 'Authorization': 'Bearer ' + env.WA_TOKEN } }
    );
    const data = await res.json().catch(function () { return {}; });
    if (!res.ok) return {};
    return { display: data.display_phone_number || '', name: data.verified_name || '' };
  } catch (e) {
    return {};
  }
}

/* ---------- antrean pesan masuk (KV) ---------- */
const INBOX_KEY = 'inbox';
const MAX_QUEUE = 500;

/* Status pengiriman pesan keluar, dikunci per wamid. Meta mengirim kabar
   terakhir lewat webhook field `messages` dengan bentuk `statuses`. */
const STATUS_KEY = 'status';
const MAX_STATUS = 500;

async function readQueue(env) {
  try {
    const raw = await env.WA_INBOX.get(INBOX_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

async function writeQueue(env, list) {
  /* Simpan hanya yang terbaru supaya nilai KV tidak membengkak. */
  const trimmed = list.slice(-MAX_QUEUE);
  await env.WA_INBOX.put(INBOX_KEY, JSON.stringify(trimmed));
}

async function readStatuses(env) {
  try {
    const raw = await env.WA_INBOX.get(STATUS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    return {};
  }
}

async function writeStatuses(env, map) {
  const keys = Object.keys(map);
  if (keys.length > MAX_STATUS) {
    /* Buang yang paling lama supaya nilai KV tidak membengkak. */
    keys.sort(function (a, b) {
      return String(map[a].waktu || '').localeCompare(String(map[b].waktu || ''));
    });
    for (const k of keys.slice(0, keys.length - MAX_STATUS)) delete map[k];
  }
  await env.WA_INBOX.put(STATUS_KEY, JSON.stringify(map));
}

/* ---------- penanganan webhook ---------- */

/* Ubah payload Meta menjadi daftar pesan sederhana. */
function parseWebhook(body) {
  const out = [];
  const entries = (body && body.entry) || [];
  for (const entry of entries) {
    const changes = entry.changes || [];
    for (const ch of changes) {
      const v = ch.value || {};
      const contacts = v.contacts || [];
      const nameOf = {};
      for (const c of contacts) {
        if (c.wa_id) nameOf[c.wa_id] = (c.profile && c.profile.name) || '';
      }
      const messages = v.messages || [];
      for (const m of messages) {
        const from = normalizePhone(m.from);
        let text = '';
        if (m.type === 'text') text = (m.text && m.text.body) || '';
        else if (m.type === 'button') text = (m.button && m.button.text) || '';
        else if (m.type === 'interactive') {
          const i = m.interactive || {};
          text = (i.button_reply && i.button_reply.title) ||
                 (i.list_reply && i.list_reply.title) || '';
        } else if (m.type === 'image') text = (m.image && m.image.caption) || '[gambar]';
        else if (m.type === 'document') text = (m.document && m.document.filename) || '[dokumen]';
        else if (m.type === 'audio') text = '[pesan suara]';
        else if (m.type === 'video') text = (m.video && m.video.caption) || '[video]';
        else if (m.type === 'location') text = '[lokasi]';
        else if (m.type === 'sticker') text = '[stiker]';
        else text = '[' + (m.type || 'pesan') + ']';

        out.push({
          waId: m.id || '',
          from: from,
          nama: nameOf[m.from] || nameOf[from] || '',
          tipe: m.type || 'text',
          teks: text,
          waktu: m.timestamp
            ? new Date(Number(m.timestamp) * 1000).toISOString()
            : new Date().toISOString()
        });
      }
    }
  }
  return out;
}

/* Ubah payload Meta menjadi daftar kabar status pesan KELUAR.
   Meta mengirim `sent` → `delivered` → `read`, atau `failed` beserta alasannya.
   Tanpa ini, pesan yang ditolak Meta (mis. di luar jendela 24 jam) tetap
   terlihat "Terkirim" di aplikasi. */
function parseStatuses(body) {
  const out = [];
  const entries = (body && body.entry) || [];
  for (const entry of entries) {
    const changes = entry.changes || [];
    for (const ch of changes) {
      const v = ch.value || {};
      const statuses = v.statuses || [];
      for (const s of statuses) {
        const err = (s.errors && s.errors[0]) || null;
        out.push({
          waId: s.id || '',
          status: s.status || '',
          to: normalizePhone(s.recipient_id),
          waktu: s.timestamp
            ? new Date(Number(s.timestamp) * 1000).toISOString()
            : new Date().toISOString(),
          kode: err ? err.code : null,
          pesan: err ? (err.title || err.message || '') : '',
          detail: err && err.error_data ? (err.error_data.details || '') : ''
        });
      }
    }
  }
  return out;
}

/* ============================================================
   MAJALAH — halaman majalah disimpan di KV lalu ditampilkan di
   badan email lewat alamat publik.

   Kenapa tidak dilampirkan sebagai berkas? Karena lampiran tidak
   bisa tampil langsung di badan email. Dengan disimpan di sini,
   email cukup memuat <img src="…/majalah/<id>/1"> dan penerima
   langsung melihat halamannya tanpa membuka berkas apa pun.
   ============================================================ */

const MAJALAH_MAX_PAGES = 80;
const MAJALAH_MAX_BYTE = 4 * 1024 * 1024;   /* per halaman */

function majalahMetaKey(id){ return 'majalah-meta:' + id; }
function majalahPageKey(id, n){ return 'majalah:' + id + ':' + n; }

/* Batas KV Cloudflare 25 MiB per key — sisakan sedikit ruang.
   PDF majalah sungguhan bisa 60 MB, jadi berkasnya dipecah menjadi beberapa
   bagian (masing-masing di bawah 20 MB) dan disatukan lagi saat diambil. */
const MAJALAH_PDF_BAGIAN = 18 * 1024 * 1024;
const MAJALAH_PDF_MAX_BAGIAN = 8;

function majalahPdfKey(id, n){ return 'majalah-pdf:' + id + (n ? ':' + n : ''); }
function majalahPdfMetaKey(id){ return 'majalah-pdf-meta:' + id; }

/* ---------- kwitansi PNG ----------
   WhatsApp mengambil berkas dari alamat publik, jadi gambar kwitansi harus
   punya alamat yang bisa diakses tanpa kunci. Disimpan sebentar saja
   (kedaluwarsa 30 hari) karena hanya dipakai untuk satu kali kirim. */
const KWT_MAX_BYTE = 4 * 1024 * 1024;
const KWT_SIMPAN_MS = 30 * 24 * 60 * 60 * 1000;

function kwitansiKey(id){ return 'kwt:' + id; }

/* Ubah base64 (boleh berawalan data:…) menjadi byte siap simpan. */
function b64ToBytes(b64){
  const bersih = String(b64 || '').replace(/^data:[^,]*,/, '');
  const bin = atob(bersih);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/* ============================================================
   HALAMAN PEMBACA MAJALAH — /baca/<id>

   Kenapa perlu halaman ini? Mengirim 10 gambar di badan email
   membuat email berat dan sering dianggap spam. Jadi email hanya
   memuat sampul + tombol "Baca majalah"; halamannya dibuka di
   sini — satu halaman per layar, tinggal digeser naik-turun.

   Halaman ini sengaja dibuat tanpa pustaka luar sama sekali:
   hanya <img> dan CSS scroll-snap. Jadi ringan dan cepat dibuka
   di HP dengan koneksi lambat.
   ============================================================ */

function escHtml(s){
  return String(s === null || s === undefined ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function halamanBaca(meta, base, id){
  const n = meta.halaman || 0;
  const judul = meta.judul || 'Majalah Kartidaya';
  const gambar = [];
  for (let i = 1; i <= n; i++) {
    gambar.push(
      '<figure class="hal">' +
        '<img src="' + base + '/majalah/' + id + '/' + i + '" alt="Halaman ' + i + '" loading="' +
        (i <= 2 ? 'eager' : 'lazy') + '">' +
        '<figcaption>Halaman ' + i + ' dari ' + n + '</figcaption>' +
      '</figure>'
    );
  }
  return '<!DOCTYPE html><html lang="id"><head>' +
    '<meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">' +
    '<meta name="robots" content="noindex,nofollow">' +
    '<title>' + escHtml(judul) + '</title>' +
    '<style>' +
      '*{box-sizing:border-box}' +
      'html,body{margin:0;padding:0;background:#1b1e1d;color:#e8e8e3;' +
        'font-family:Arial,Helvetica,sans-serif;-webkit-text-size-adjust:100%}' +
      'header{position:sticky;top:0;z-index:5;background:rgba(27,30,29,.94);' +
        'border-bottom:1px solid #333;padding:10px 14px;' +
        '-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px)}' +
      'header h1{margin:0;font-size:14px;font-weight:700;line-height:1.35}' +
      'header p{margin:3px 0 0;font-size:11.5px;color:#9aa09d}' +
      'main{max-width:900px;margin:0 auto;padding:12px 10px 40px}' +
      '.hal{margin:0 0 14px;background:#fff;border-radius:8px;overflow:hidden;' +
        'box-shadow:0 2px 10px rgba(0,0,0,.35)}' +
      '.hal img{display:block;width:100%;height:auto}' +
      '.hal figcaption{padding:7px 10px;font-size:11px;color:#666;background:#f4f4f0;' +
        'text-align:center;border-top:1px solid #e2e2dc}' +
      '.naik{position:fixed;right:14px;bottom:18px;z-index:6;width:44px;height:44px;' +
        'border:0;border-radius:50%;background:#2f6f9f;color:#fff;font-size:19px;' +
        'cursor:pointer;box-shadow:0 3px 12px rgba(0,0,0,.4)}' +
      '.naik[hidden]{display:none}' +
      'footer{max-width:900px;margin:0 auto;padding:0 14px 34px;font-size:11.5px;' +
        'color:#8b918e;text-align:center;line-height:1.6}' +
      '@media print{header,.naik,figcaption{display:none}' +
        'html,body{background:#fff}.hal{box-shadow:none;margin:0;border-radius:0}}' +
    '</style></head><body>' +
    '<header><h1>' + escHtml(judul) + '</h1>' +
      '<p>' + n + ' halaman · geser ke bawah untuk halaman berikutnya</p></header>' +
    '<main>' + gambar.join('') + '</main>' +
    '<footer>Kartidaya Sahabat Indonesia<br>' +
      'Halaman ini hanya untuk membaca majalah. Tidak ada data pribadi yang disimpan.</footer>' +
    '<button class="naik" id="naik" hidden aria-label="Ke atas">↑</button>' +
    '<script>' +
      'var b=document.getElementById("naik");' +
      'addEventListener("scroll",function(){b.hidden=scrollY<600;},{passive:true});' +
      'b.addEventListener("click",function(){scrollTo({top:0,behavior:"smooth"});});' +
    '<\/script>' +
  '</body></html>';
}

/* ============================================================
   KONFIRMASI PENERIMAAN — /terima/<id>

   Tanda "sudah dibaca" (pixel) hanya petunjuk: kalau penerima
   memakai Gmail yang memblokir gambar, kita tidak tahu apa-apa.
   Tombol ini memberi kepastian — penerima menekannya sendiri,
   dan kita tahu suratnya benar-benar sampai.

   Halaman ini juga menampilkan ringkasan surat (nomor kwitansi,
   jumlah) supaya penerima bisa memastikan yang diterima benar.
   ============================================================ */

function halamanTerima(info, sudah){
  const judul = info.judul || 'Kartidaya Sahabat Indonesia';
  const baris = [];
  if (info.kwitansi) baris.push(['Nomor kwitansi', info.kwitansi]);
  if (info.jumlah) baris.push(['Jumlah', info.jumlah]);
  if (info.donor) baris.push(['Nama', info.donor]);
  if (info.dikirim) baris.push(['Dikirim', info.dikirim]);

  const tabel = baris.length
    ? '<table>' + baris.map(function (b) {
        return '<tr><td>' + escHtml(b[0]) + '</td><td><b>' + escHtml(b[1]) + '</b></td></tr>';
      }).join('') + '</table>'
    : '';

  return '<!DOCTYPE html><html lang="id"><head>' +
    '<meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<meta name="robots" content="noindex,nofollow">' +
    '<title>' + (sudah ? 'Sudah dikonfirmasi' : 'Konfirmasi penerimaan') + '</title>' +
    '<style>' +
      '*{box-sizing:border-box}' +
      'body{margin:0;padding:32px 18px;background:#f4f4f0;color:#111;' +
        'font-family:Arial,Helvetica,sans-serif;line-height:1.6}' +
      '.kotak{max-width:520px;margin:0 auto;background:#fff;border:1px solid #e0e0d8;' +
        'border-radius:10px;padding:26px 24px;text-align:center}' +
      '.tanda{font-size:44px;line-height:1;margin:0 0 10px}' +
      'h1{font-size:19px;margin:0 0 8px}' +
      'p{margin:0 0 14px;font-size:14px;color:#444}' +
      'table{width:100%;border-collapse:collapse;margin:16px 0 4px;text-align:left;font-size:13.5px}' +
      'td{padding:8px 0;border-bottom:1px solid #eee}' +
      'td:first-child{color:#666;width:44%}' +
      '.kaki{margin:18px 0 0;font-size:11.5px;color:#888}' +
    '</style></head><body><div class="kotak">' +
    (sudah
      ? '<div class="tanda">✓</div><h1>Sudah dikonfirmasi</h1>' +
        '<p>Terima kasih — konfirmasi Anda sudah tercatat sebelumnya.</p>'
      : '<div class="tanda">✓</div><h1>Terima kasih!</h1>' +
        '<p>Konfirmasi Anda sudah kami terima. Ini membantu kami memastikan ' +
        'surat dan kwitansi sampai dengan benar.</p>') +
    tabel +
    '<p class="kaki">' + escHtml(judul) + '<br>' +
      'Halaman ini tidak menyimpan data pribadi apa pun.</p>' +
    '</div></body></html>';
}

/* ============================================================
   HALAMAN DAFTAR AKUN — /daftar

   Sengaja TERPISAH dari aplikasi Kartidaya dan sengaja TANPA kunci
   aplikasi: yang mendaftar belum punya akun, jadi tidak mungkin
   memegang kunci. Yang menjaga halaman ini adalah KODE UNDANGAN.

   Menutup pendaftaran = hapus baris di tabel `invites`. Halamannya
   sendiri boleh tetap ada — tanpa kode yang sah, tidak ada akun
   yang bisa dibuat. Halaman ini juga bisa dimatikan total dengan
   variabel DAFTAR_MATI=1 di Worker.
   ============================================================ */

function halamanDaftar(terbuka) {
  return '<!DOCTYPE html><html lang="id"><head>' +
    '<meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<meta name="robots" content="noindex,nofollow">' +
    '<title>Buat akun Kartidaya</title>' +
    '<style>' +
      '*{box-sizing:border-box}' +
      'body{margin:0;padding:32px 18px;background:#f5f5f0;color:#161616;' +
        'font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial,sans-serif;' +
        'line-height:1.55}' +
      '.kotak{max-width:420px;margin:0 auto;background:#fff;border:1px solid #e3e3dc;' +
        'border-radius:14px;padding:26px 24px;box-shadow:0 1px 2px rgba(0,0,0,.04)}' +
      'h1{font-size:19px;margin:0 0 4px;font-weight:600}' +
      'p{font-size:13.5px;color:#6b6b6b;margin:0 0 16px}' +
      'label{display:block;font-size:12.5px;font-weight:600;color:#6b6b6b;margin:0 0 5px}' +
      'input{width:100%;padding:10px 12px;border:1px solid #d0d0c6;border-radius:9px;' +
        'font:inherit;font-size:14px;background:#fff;margin:0 0 12px}' +
      'input:focus{outline:2px solid #1f6f5c33;border-color:#1f6f5c}' +
      'button{width:100%;padding:11px;border:0;border-radius:9px;background:#1f6f5c;' +
        'color:#fff;font:inherit;font-weight:600;cursor:pointer}' +
      'button:disabled{opacity:.5;cursor:not-allowed}' +
      '.pesan{padding:10px 12px;border-radius:9px;font-size:13px;margin:0 0 14px;display:none}' +
      '.pesan.galat{display:block;background:#f7e9e6;color:#a33a2c}' +
      '.pesan.ok{display:block;background:#e8f0ed;color:#1f6f5c}' +
      '.tutup{background:#f7f1e0;color:#8a6a1f;padding:12px 14px;border-radius:9px;font-size:13px}' +
      '.kaki{margin:16px 0 0;font-size:11.5px;color:#8a8a80;text-align:center}' +
      'a{color:#1f6f5c}' +
    '</style></head><body><div class="kotak">' +
    '<h1>Buat akun Kartidaya</h1>' +
    '<p>Halaman ini hanya untuk menambah pengguna aplikasi. Perlu <b>kode undangan</b> dari admin.</p>' +
    (terbuka
      ? '<div class="pesan" id="pesan"></div>' +
        '<form id="f" autocomplete="off">' +
          '<label for="kode">Kode undangan</label>' +
          '<input id="kode" name="kode" required autocomplete="off">' +
          '<label for="nama">Nama lengkap</label>' +
          '<input id="nama" name="nama" required autocomplete="off">' +
          '<label for="email">Alamat email</label>' +
          '<input id="email" name="email" type="email" required autocomplete="off">' +
          '<label for="password">Password <span style="font-weight:400">(minimal 8 huruf)</span></label>' +
          '<input id="password" name="password" type="password" minlength="8" required autocomplete="new-password">' +
          '<button id="b" type="submit">Buat akun</button>' +
        '</form>' +
        '<p class="kaki">Sudah punya akun? Buka <a href="./">aplikasi</a> lalu masuk.</p>'
      : '<div class="tutup"><b>Pendaftaran sedang ditutup.</b><br>' +
        'Admin perlu memasang kode undangan di server untuk membuka pintu ini ' +
        'sebentar, lalu menghapusnya lagi setelah akun dibuat.</div>' +
        '<p class="kaki" style="margin-top:14px">Sudah punya akun? ' +
        '<a href="./">Buka aplikasi</a>.</p>') +
    '</div>' +
    (terbuka ?
    '<script>' +
      'var f=document.getElementById("f"),b=document.getElementById("b"),p=document.getElementById("pesan");' +
      'function kabar(teks,kelas){p.className="pesan "+kelas;p.textContent=teks;}' +
      'f.addEventListener("submit",async function(e){' +
        'e.preventDefault();b.disabled=true;kabar("Mengirim…","");' +
        'try{' +
          'var r=await fetch("/akun/daftar",{method:"POST",' +
            'headers:{"Content-Type":"application/json"},' +
            'body:JSON.stringify({kode:document.getElementById("kode").value.trim(),' +
              'nama:document.getElementById("nama").value.trim(),' +
              'email:document.getElementById("email").value.trim(),' +
              'password:document.getElementById("password").value})});' +
          'var d=await r.json().catch(function(){return null;});' +
          'if(!r.ok||!d||!d.ok){throw new Error((d&&d.error)||("HTTP "+r.status));}' +
          'kabar("Akun dibuat. Silakan masuk di aplikasi.","ok");' +
          'f.reset();' +
        '}catch(err){kabar(err.message||String(err),"galat");}' +
        'finally{b.disabled=false;}' +
      '});' +
    '<\/script>' : '') +
    '</body></html>';
}

/* ============================================================
   TANDA DIBACA — pixel 1×1 yang dicatat saat email dibuka.

   Klien email memuat gambar dari alamat publik, jadi satu
   permintaan ke sini sudah cukup untuk tahu emailnya dibuka.
   ============================================================ */

const PIXEL_GIF = 'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

function pixelKey(id){ return 'pixel:' + id; }
function terimaKey(id){ return 'terima:' + id; }

async function catatDibaca(env, id){
  try{
    const raw = await env.WA_INBOX.get(pixelKey(id));
    const now = new Date().toISOString();
    const rec = raw ? JSON.parse(raw) : { id: id, pertama: now, hit: 0 };
    rec.hit = (rec.hit || 0) + 1;
    rec.terakhir = now;
    await env.WA_INBOX.put(pixelKey(id), JSON.stringify(rec));
  }catch(e){ /* pencatatan gagal tidak boleh menggagalkan gambar */ }
}

/* Catat konfirmasi penerimaan. Kalau sudah pernah, kembalikan yang lama
   supaya waktu konfirmasi pertama tidak tertimpa. */
async function catatTerima(env, id, info){
  const raw = await env.WA_INBOX.get(terimaKey(id));
  if(raw) return JSON.parse(raw);
  const rec = {
    id: id,
    waktu: new Date().toISOString(),
    judul: String((info && info.judul) || '').slice(0, 120),
    kwitansi: String((info && info.kwitansi) || '').slice(0, 60),
    jumlah: String((info && info.jumlah) || '').slice(0, 60),
    donor: String((info && info.donor) || '').slice(0, 120),
    dikirim: String((info && info.dikirim) || '').slice(0, 60)
  };
  await env.WA_INBOX.put(terimaKey(id), JSON.stringify(rec));
  return rec;
}

/* ---------- data bersama (D1) ---------- */

/* Daftar koleksi yang boleh disimpan. Dibatasi supaya permintaan dengan nama
   koleksi sembarangan tidak bisa menulis ke tabel. */
const KOLEKSI = ['donors', 'messages', 'templates', 'categories', 'programs', 'finance'];
const META_KUNCI = ['isian', 'majalah'];

/* Baca semua data sekaligus. Aplikasi memanggil ini sekali saat dibuka, jadi
   satu permintaan cukup — tidak perlu satu permintaan per koleksi. */
async function dataBacaSemua(env) {
  const out = { ok: true, koleksi: {}, meta: {}, waktu: new Date().toISOString() };
  const r = await env.DB.prepare(
    'SELECT collection, id, data, updated_at FROM records ORDER BY collection, id'
  ).all();
  (r.results || []).forEach(function (row) {
    if (!out.koleksi[row.collection]) out.koleksi[row.collection] = [];
    let isi = null;
    try { isi = JSON.parse(row.data); } catch (e) { isi = null; }
    if (isi !== null) out.koleksi[row.collection].push(isi);
  });
  const m = await env.DB.prepare('SELECT key, data FROM meta').all();
  (m.results || []).forEach(function (row) {
    try { out.meta[row.key] = JSON.parse(row.data); } catch (e) { /* lewati */ }
  });
  return out;
}

/* Simpan satu baris. Dipakai untuk menambah maupun mengubah — kalau id-nya
   sudah ada, isinya diganti (upsert). */
async function dataSimpan(env, koleksi, id, isi) {
  const now = new Date().toISOString();
  await env.DB.prepare(
    'INSERT INTO records (collection, id, data, updated_at) VALUES (?, ?, ?, ?) ' +
    'ON CONFLICT(collection, id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at'
  ).bind(koleksi, String(id), JSON.stringify(isi), now).run();
  return now;
}

async function dataHapus(env, koleksi, id) {
  await env.DB.prepare('DELETE FROM records WHERE collection = ? AND id = ?')
    .bind(koleksi, String(id)).run();
}

async function metaSimpan(env, kunci, isi) {
  const now = new Date().toISOString();
  await env.DB.prepare(
    'INSERT INTO meta (key, data, updated_at) VALUES (?, ?, ?) ' +
    'ON CONFLICT(key) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at'
  ).bind(kunci, JSON.stringify(isi), now).run();
  return now;
}

/* ============================================================
   AKUN & LOGIN

   Prinsipnya:
   - Password TIDAK disimpan apa adanya. Yang disimpan hanya hash PBKDF2
     + salt acak. Kalau database bocor, password tidak terbaca.
   - Setiap masuk menghasilkan token acak yang berlaku 12 jam. Token
     disimpan di server sehingga bisa dicabut sebelum waktunya.
   - Email atau password yang salah dijawab dengan pesan yang SAMA, supaya
     tidak memberi petunjuk alamat mana yang terdaftar.
   - Kunci aplikasi (X-App-Key) tetap wajib, jadi endpoint ini tidak terbuka
     untuk umum. Pintu pendaftaran ditutup/dibuka lewat tabel `invites`.
   ============================================================ */

const PBKDF2_ITER = 100000;
const LOGIN_MAKS_GAGAL = 5;
const LOGIN_TUNGGU_MENIT = 15;
const SESI_JAM = 12;

function b64url(buf) {
  const bytes = new Uint8Array(buf);
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function dariB64url(s) {
  const t = String(s || '').replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(t + '='.repeat((4 - (t.length % 4)) % 4));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function acakB64(n) {
  const b = new Uint8Array(n);
  crypto.getRandomValues(b);
  return b64url(b.buffer);
}

/* Hash password. Hasilnya selalu 32 byte, jadi panjang hash tidak menunjukkan
   panjang password. */
async function hashPassword(password, saltB64, iter) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: dariB64url(saltB64), iterations: iter },
    key,
    256
  );
  return b64url(bits);
}

function emailWajar(v) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(v || ''));
}

function rapikanEmail(v) {
  return String(v == null ? '' : v).trim().toLowerCase();
}

function bearer(req) {
  const h = req.headers.get('Authorization') || '';
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m ? m[1].trim() : '';
}

/* Token yang masih berlaku → baris sesi. Kalau kedaluwarsa, barisnya dibuang
   sekalian supaya tabel tidak menumpuk. */
async function sesiDari(req, env) {
  const token = bearer(req);
  if (!token) return null;
  const row = await env.DB.prepare(
    'SELECT token, email, peran, kedaluwarsa FROM sessions WHERE token = ?'
  ).bind(token).first();
  if (!row) return null;
  if (Date.parse(row.kedaluwarsa) <= Date.now()) {
    await env.DB.prepare('DELETE FROM sessions WHERE token = ?').bind(token).run();
    return null;
  }
  return row;
}

async function penggunaAktif(env, email) {
  const row = await env.DB.prepare(
    'SELECT email, nama, peran, aktif FROM users WHERE email = ?'
  ).bind(email).first();
  if (!row || !row.aktif) return null;
  return row;
}

/* Alamat untuk menjawab galat login. Pesannya seragam dengan sengaja. */
function galatLogin() {
  return json({ ok: false, error: 'Email atau password salah' }, 401);
}

/* Batas percobaan: dihitung per email per 15 menit. Jawabannya seragam supaya
   tidak bisa dipakai menebak alamat mana yang terdaftar. */
async function cekBlokir(env, email) {
  const row = await env.DB.prepare(
    'SELECT menit, gagal, sampai FROM login_acuan WHERE email = ?'
  ).bind(email).first();
  if (!row) return { blokir: false };
  if (row.sampai && Date.parse(row.sampai) > Date.now()) {
    return { blokir: true, sampai: row.sampai };
  }
  return { blokir: false };
}

async function catatGagal(env, email) {
  const menit = Math.floor(Date.now() / 60000);
  const row = await env.DB.prepare(
    'SELECT menit, gagal FROM login_acuan WHERE email = ?'
  ).bind(email).first();
  /* Hitungan hanya berlaku 15 menit; lewat dari itu mulai dari 1 lagi. */
  let jumlah = 1;
  if (row && row.menit >= menit - LOGIN_TUNGGU_MENIT) jumlah = (row.gagal || 0) + 1;
  const sampai = jumlah >= LOGIN_MAKS_GAGAL
    ? new Date(Date.now() + LOGIN_TUNGGU_MENIT * 60000).toISOString()
    : null;
  await env.DB.prepare(
    'INSERT INTO login_acuan (email, menit, gagal, sampai) VALUES (?, ?, ?, ?) ' +
    'ON CONFLICT(email) DO UPDATE SET menit = excluded.menit, gagal = excluded.gagal, sampai = excluded.sampai'
  ).bind(email, menit, jumlah, sampai).run();
  return jumlah;
}

async function hapusHitunganGagal(env, email) {
  await env.DB.prepare('DELETE FROM login_acuan WHERE email = ?').bind(email).run();
}

async function buatSesi(env, email, peran) {
  const token = acakB64(32);
  const sekarang = new Date();
  const kedaluwarsa = new Date(sekarang.getTime() + SESI_JAM * 3600 * 1000).toISOString();
  await env.DB.prepare(
    'INSERT INTO sessions (token, email, peran, dibuat, kedaluwarsa) VALUES (?, ?, ?, ?, ?)'
  ).bind(token, email, peran, sekarang.toISOString(), kedaluwarsa).run();
  /* Buang sesi yang sudah kedaluwarsa — murah, dan menjaga tabel tetap kecil. */
  await env.DB.prepare('DELETE FROM sessions WHERE kedaluwarsa <= ?')
    .bind(sekarang.toISOString()).run();
  return { token: token, kedaluwarsa: kedaluwarsa };
}

async function akunLogin(req, env) {
  if (!env.DB) return json({ ok: false, error: 'Database D1 belum dipasang di Worker' }, 500);
  const body = await req.json().catch(function () { return null; });
  const email = rapikanEmail(body && body.email);
  const password = String((body && body.password) || '');
  if (!email || !password) return galatLogin();

  const blokir = await cekBlokir(env, email);
  if (blokir.blokir) {
    const sisa = Math.max(1, Math.ceil((Date.parse(blokir.sampai) - Date.now()) / 60000));
    return json({
      ok: false,
      error: 'Terlalu banyak percobaan. Coba lagi dalam ' + sisa + ' menit.',
      blokir: true
    }, 429);
  }

  const row = await env.DB.prepare(
    'SELECT email, nama, hash, salt, iter, peran, aktif FROM users WHERE email = ?'
  ).bind(email).first();
  /* Hash tetap dihitung walau email tidak ada, supaya waktu jawabannya tidak
     membocorkan mana email yang terdaftar. */
  const iter = (row && row.iter) || PBKDF2_ITER;
  const salt = (row && row.salt) || 'AAAAAAAAAAAAAAAAAAAAAA';
  const hash = await hashPassword(password, salt, iter);
  if (!row || !row.aktif || !row.hash || !sameKey(hash, row.hash)) {
    await catatGagal(env, email);
    return galatLogin();
  }

  await hapusHitunganGagal(env, email);
  const sesi = await buatSesi(env, email, row.peran);
  await env.DB.prepare('UPDATE users SET masuk_terakhir = ? WHERE email = ?')
    .bind(new Date().toISOString(), email).run();
  return json({
    ok: true,
    token: sesi.token,
    kedaluwarsa: sesi.kedaluwarsa,
    pengguna: { email: row.email, nama: row.nama, peran: row.peran }
  });
}

async function akunSaya(req, env) {
  const sesi = await sesiDari(req, env);
  if (!sesi) return json({ ok: false, error: 'Sesi tidak berlaku' }, 401);
  const u = await penggunaAktif(env, sesi.email);
  if (!u) return json({ ok: false, error: 'Akun tidak aktif' }, 401);
  return json({
    ok: true,
    pengguna: { email: u.email, nama: u.nama, peran: u.peran },
    kedaluwarsa: sesi.kedaluwarsa
  });
}

async function akunKeluar(req, env) {
  const token = bearer(req);
  if (token) await env.DB.prepare('DELETE FROM sessions WHERE token = ?').bind(token).run();
  return json({ ok: true });
}

async function akunDaftarTerbuka(env) {
  const r = await env.DB.prepare('SELECT COUNT(*) AS n FROM invites').first();
  return json({ ok: true, terbuka: !!(r && r.n > 0) });
}

/* Pendaftaran hanya jalan kalau kode undangannya ada di tabel `invites`.
   Kode itu TIDAK dihapus setelah dipakai — satu kode boleh dipakai untuk
   beberapa akun, dan pintunya ditutup dengan menghapus barisnya. Alasannya:
   dengan 2–3 akun, menghapus kode setelah satu pemakaian justru merepotkan. */
async function akunDaftar(req, env) {
  if (!env.DB) return json({ ok: false, error: 'Database D1 belum dipasang di Worker' }, 500);
  const r = await env.DB.prepare('SELECT COUNT(*) AS n FROM invites').first();
  if (!r || !r.n) {
    return json({ ok: false, error: 'Pendaftaran sedang ditutup' }, 403);
  }
  const body = await req.json().catch(function () { return null; });
  const kode = String((body && body.kode) || '').trim();
  const email = rapikanEmail(body && body.email);
  const nama = String((body && body.nama) || '').trim();
  const password = String((body && body.password) || '');

  const undangan = await env.DB.prepare('SELECT kode FROM invites WHERE kode = ?').bind(kode).first();
  if (!undangan) return json({ ok: false, error: 'Kode undangan salah' }, 403);
  if (!emailWajar(email)) return json({ ok: false, error: 'Alamat email belum benar' }, 400);
  if (nama.length < 2) return json({ ok: false, error: 'Nama belum diisi' }, 400);
  if (password.length < 8) return json({ ok: false, error: 'Password minimal 8 huruf' }, 400);

  const ada = await env.DB.prepare('SELECT email FROM users WHERE email = ?').bind(email).first();
  if (ada) return json({ ok: false, error: 'Email itu sudah terdaftar' }, 409);

  const salt = acakB64(16);
  const hash = await hashPassword(password, salt, PBKDF2_ITER);
  const adminPertama = await env.DB.prepare(
    "SELECT COUNT(*) AS n FROM users WHERE aktif = 1 AND peran = 'admin'"
  ).first();
  const peran = (adminPertama && adminPertama.n > 0) ? 'user' : 'admin';

  await env.DB.prepare(
    'INSERT INTO users (email, nama, hash, salt, iter, peran, aktif, dibuat, masuk_terakhir) ' +
    'VALUES (?, ?, ?, ?, ?, ?, 1, ?, NULL)'
  ).bind(email, nama, hash, salt, PBKDF2_ITER, peran, new Date().toISOString()).run();

  return json({ ok: true, pengguna: { email: email, nama: nama, peran: peran } });
}

async function akunDaftarPengguna(req, env) {
  const sesi = await sesiDari(req, env);
  if (!sesi) return json({ ok: false, error: 'Sesi tidak berlaku' }, 401);
  const daftar = await env.DB.prepare(
    'SELECT email, nama, peran, aktif, dibuat, masuk_terakhir FROM users ORDER BY dibuat'
  ).all();
  return json({ ok: true, pengguna: daftar.results || [] });
}

/* Pengguna boleh mengganti password sendiri; admin boleh mengganti milik
   siapa pun tanpa menyebut password lama (untuk kasus lupa password). */
async function akunGantiPassword(req, env) {
  const sesi = await sesiDari(req, env);
  if (!sesi) return json({ ok: false, error: 'Sesi tidak berlaku' }, 401);
  const body = await req.json().catch(function () { return null; });
  const email = rapikanEmail((body && body.email) || sesi.email);
  const password = String((body && body.password) || '');
  const passwordLama = String((body && body.passwordLama) || '');
  if (password.length < 8) return json({ ok: false, error: 'Password baru minimal 8 huruf' }, 400);

  const sendiri = email === rapikanEmail(sesi.email);
  if (!sendiri && sesi.peran !== 'admin') {
    return json({ ok: false, error: 'Hanya admin yang bisa mengganti password akun lain' }, 403);
  }

  if (sendiri) {
    const row = await env.DB.prepare(
      'SELECT hash, salt, iter, aktif FROM users WHERE email = ?'
    ).bind(email).first();
    if (!row || !row.aktif) return json({ ok: false, error: 'Akun tidak aktif' }, 401);
    const uji = await hashPassword(passwordLama, row.salt, row.iter);
    /* Salah password lama masih dihitung sebagai percobaan — kalau tidak,
       siapa pun yang menemukan sesi yang lupa ditutup bisa mengganti password. */
    if (!sameKey(uji, row.hash)) {
      await catatGagal(env, email);
      return json({ ok: false, error: 'Password lama salah' }, 401);
    }
  } else {
    const target = await penggunaAktif(env, email);
    if (!target) return json({ ok: false, error: 'Akun tidak ditemukan' }, 404);
  }

  const salt = acakB64(16);
  const hash = await hashPassword(password, salt, PBKDF2_ITER);
  await env.DB.prepare('UPDATE users SET hash = ?, salt = ?, iter = ? WHERE email = ?')
    .bind(hash, salt, PBKDF2_ITER, email).run();
  /* Password berubah → semua sesi lama akun itu dicabut. */
  await env.DB.prepare('DELETE FROM sessions WHERE email = ?').bind(email).run();
  return json({ ok: true });
}

/* ---------- router ---------- */

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    const path = url.pathname.replace(/\/+$/, '') || '/';

    if (req.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(req) });
    }

    try {
      /* --- verifikasi webhook oleh Meta (tanpa X-App-Key) --- */
      if (path === '/wa/webhook' && req.method === 'GET') {
        const mode = url.searchParams.get('hub.mode');
        const token = url.searchParams.get('hub.verify_token');
        const challenge = url.searchParams.get('hub.challenge') || '';
        if (mode === 'subscribe' && env.WA_VERIFY_TOKEN && sameKey(token || '', env.WA_VERIFY_TOKEN)) {
          return new Response(challenge, { status: 200, headers: { 'Content-Type': 'text/plain' } });
        }
        return new Response('Forbidden', { status: 403 });
      }

      /* --- terima pesan masuk dari Meta (tanpa X-App-Key) --- */
      if (path === '/wa/webhook' && req.method === 'POST') {
        const body = await req.json().catch(function () { return null; });
        if (!body) return new Response('Bad Request', { status: 400 });

        const pesan = parseWebhook(body);
        if (pesan.length) {
          const queue = await readQueue(env);
          const ada = {};
          for (const q of queue) if (q.waId) ada[q.waId] = true;
          for (const p of pesan) {
            if (p.waId && ada[p.waId]) continue;   /* anti-duplikat */
            queue.push(p);
          }
          await writeQueue(env, queue);
        }

        /* Kabar status pesan keluar (sent / delivered / read / failed). */
        const kabar = parseStatuses(body);
        if (kabar.length) {
          const map = await readStatuses(env);
          for (const s of kabar) {
            if (!s.waId) continue;
            map[s.waId] = s;
          }
          await writeStatuses(env, map);
        }

        /* Meta butuh 200 cepat, kalau tidak akan dikirim ulang terus. */
        return new Response('OK', { status: 200 });
      }

      /* --- pixel tanda dibaca (tanpa X-App-Key) ---
         Klien email memuat gambar ini dari alamat publik, jadi tidak mungkin
         menyertakan kunci aplikasi. Yang dilindungi hanya pembacaan status. */
      const px = path.match(/^\/pixel\/([A-Za-z0-9_-]{4,64})$/);
      if (px && req.method === 'GET') {
        await catatDibaca(env, px[1]);
        const gif = Uint8Array.from(atob(PIXEL_GIF), function (c) { return c.charCodeAt(0); });
        return new Response(gif, {
          status: 200,
          headers: {
            'Content-Type': 'image/gif',
            'Content-Length': String(gif.length),
            'Cache-Control': 'no-store, no-cache, must-revalidate, private',
            'Pragma': 'no-cache'
          }
        });
      }
      /* Alamat pixel yang bentuknya tidak sah dijawab 404 — bukan 401 —
         supaya tidak tertukar dengan "kunci aplikasi salah". Hanya untuk GET:
         POST /pixel/status ditangani di bagian berkunci di bawah. */
      if (req.method === 'GET' && path.indexOf('/pixel/') === 0) {
        return new Response('Not Found', { status: 404 });
      }

      /* --- konfirmasi penerimaan (tanpa X-App-Key) ---
         Penerima menekan tombol di email; halaman ini mencatatnya.
         Info surat dikirim lewat query supaya tidak perlu kunci. */
      const tr = path.match(/^\/terima\/([A-Za-z0-9_-]{4,64})$/);
      if (tr && req.method === 'GET') {
        const info = {
          judul: url.searchParams.get('j') || '',
          kwitansi: url.searchParams.get('k') || '',
          jumlah: url.searchParams.get('n') || '',
          donor: url.searchParams.get('d') || '',
          dikirim: url.searchParams.get('w') || ''
        };
        const lama = await env.WA_INBOX.get(terimaKey(tr[1]));
        const rec = await catatTerima(env, tr[1], info);
        return new Response(halamanTerima(rec, !!lama), {
          status: 200,
          headers: {
            'Content-Type': 'text/html; charset=utf-8',
            'Cache-Control': 'no-store'
          }
        });
      }

      /* --- PDF majalah (tanpa X-App-Key) ---
         WhatsApp mengambil berkas ini dari alamat publik saat mengirim
         sebagai lampiran dokumen. Bagian-bagiannya disatukan lagi di sini. */
      const mp = path.match(/^\/majalah-pdf\/([A-Za-z0-9_-]{4,64})\.pdf$/);
      if (mp && req.method === 'GET') {
        const metaRaw = await env.WA_INBOX.get(majalahPdfMetaKey(mp[1]));
        if (!metaRaw) return new Response('Not Found', { status: 404 });
        const meta = JSON.parse(metaRaw);
        const bagian = [];
        for (let i = 1; i <= (meta.bagian || 0); i++) {
          const b = await env.WA_INBOX.get(majalahPdfKey(mp[1], i), { type: 'arrayBuffer' });
          if (!b) return new Response('Not Found', { status: 404 });
          bagian.push(new Uint8Array(b));
        }
        const total = bagian.reduce(function (a, b) { return a + b.length; }, 0);
        const gabung = new Uint8Array(total);
        let pos = 0;
        for (const b of bagian) { gabung.set(b, pos); pos += b.length; }
        return new Response(gabung, {
          status: 200,
          headers: {
            'Content-Type': 'application/pdf',
            'Content-Length': String(total),
            'Content-Disposition': 'inline; filename="majalah.pdf"',
            'Cache-Control': 'public, max-age=86400'
          }
        });
      }

      /* --- gambar kwitansi (tanpa X-App-Key) ---
         WhatsApp mengambil gambar ini dari alamat publik saat mengirim. */
      const kw = path.match(/^\/kwitansi\/([A-Za-z0-9_-]{4,64})\.png$/);
      if (kw && req.method === 'GET') {
        const raw = await env.WA_INBOX.get(kwitansiKey(kw[1]), { type: 'arrayBuffer' });
        if (!raw) return new Response('Not Found', { status: 404 });
        return new Response(raw, {
          status: 200,
          headers: {
            'Content-Type': 'image/png',
            'Cache-Control': 'public, max-age=86400'
          }
        });
      }

      /* --- halaman pembaca majalah (tanpa X-App-Key) ---
         Email hanya memuat sampul + tombol; halaman penuh dibuka di sini
         supaya email tetap ringan dan tidak dianggap spam. */
      const bc = path.match(/^\/baca\/([A-Za-z0-9_-]{4,64})$/);
      if (bc && req.method === 'GET') {
        const metaRaw = await env.WA_INBOX.get(majalahMetaKey(bc[1]));
        if (!metaRaw) {
          return new Response(
            '<!DOCTYPE html><html lang="id"><head><meta charset="utf-8">' +
            '<meta name="viewport" content="width=device-width,initial-scale=1">' +
            '<title>Majalah tidak ditemukan</title></head>' +
            '<body style="font-family:Arial,sans-serif;padding:40px 20px;text-align:center;color:#333">' +
            '<h1 style="font-size:18px">Majalah tidak ditemukan</h1>' +
            '<p style="font-size:14px;color:#666">Tautan ini mungkin sudah kedaluwarsa ' +
            'atau majalahnya sudah diganti edisi baru.</p></body></html>',
            { status: 404, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
          );
        }
        const meta = JSON.parse(metaRaw);
        return new Response(halamanBaca(meta, url.origin, bc[1]), {
          status: 200,
          headers: {
            'Content-Type': 'text/html; charset=utf-8',
            'Cache-Control': 'public, max-age=300'
          }
        });
      }

      /* --- halaman majalah (tanpa X-App-Key) ---
         Sama seperti pixel: harus bisa diambil klien email tanpa kunci. */
      const mj = path.match(/^\/majalah\/([A-Za-z0-9_-]{4,64})\/(\d{1,2})$/);
      if (mj && req.method === 'GET') {
        const metaRaw = await env.WA_INBOX.get(majalahMetaKey(mj[1]));
        if (!metaRaw) return new Response('Not Found', { status: 404 });
        const meta = JSON.parse(metaRaw);
        const n = Number(mj[2]);
        if (!(n >= 1 && n <= (meta.halaman || 0))) return new Response('Not Found', { status: 404 });
        const buf = await env.WA_INBOX.get(majalahPageKey(mj[1], n), { type: 'arrayBuffer' });
        if (!buf) return new Response('Not Found', { status: 404 });
        return new Response(buf, {
          status: 200,
          headers: {
            'Content-Type': meta.tipe || 'image/jpeg',
            'Cache-Control': 'public, max-age=31536000, immutable'
          }
        });
      }

      /* --- halaman pendaftaran (tanpa kunci, dijaga kode undangan) --- */
      if ((path === '/daftar' || path === '/daftar/') && req.method === 'GET') {
        if (!env.DB) return new Response('Database belum dipasang', { status: 500 });
        const n = await env.DB.prepare('SELECT COUNT(*) AS n FROM invites').first();
        const terbuka = !!env.DAFTAR_MATI ? false : !!(n && n.n > 0);
        return new Response(halamanDaftar(terbuka), {
          status: 200,
          headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' }
        });
      }

            /* Membuat akun juga TANPA kunci aplikasi — yang mendaftar belum punya
               akun, dan halaman /daftar tidak memegang kunci. Pengamannya adalah
               kode undangan: tanpa kode yang ada di tabel `invites`, tidak ada akun
               yang bisa dibuat. Endpoint ini sengaja diletakkan SEBELUM pemeriksaan
               kunci; endpoint akun lainnya tetap butuh kunci. */
            if (path === '/akun/daftar' && req.method === 'POST') {
              return withCors(await akunDaftar(req, env), req);
            }

      /* --- sisanya butuh kunci aplikasi --- */
      if (!authorized(req, env)) {
        return withCors(json({
          ok: false,
          error: 'Kunci aplikasi salah atau belum diisi',
          petunjuk: 'Buka aplikasi → Setelan → Worker Cloudflare → isi kolom ' +
            '"Kunci aplikasi" dengan nilai APP_KEY, lalu tekan "Simpan & uji sambungan".'
        }, 401), req);
      }

      if (path === '/wa/status' && req.method === 'GET') {
        const queue = await readQueue(env);
        const info = await waProfile(env);
        return withCors(json({
          ok: true,
          configured: !!(env.WA_TOKEN && env.WA_PHONE_ID),
          phoneId: env.WA_PHONE_ID ? String(env.WA_PHONE_ID).slice(0, 6) + '…' : '',
          display: info.display || '',
          verifiedName: info.name || '',
          pending: queue.length
        }), req);
      }

      /* ---------- akun & login ---------- */

        /* Endpoint akun di bawah ini butuh kunci aplikasi (X-App-Key) — sudah
           diperiksa di atas. Kuncinya dipegang aplikasi, jadi pengguna tidak perlu
           mengetik apa pun lagi: layar login hanya meminta email + password.
           Tanpa syarat ini, siapa pun yang tahu alamat Worker bisa menebak password
           tanpa henti.
           Pengecualian: /akun/daftar sudah ditangani SEBELUM pemeriksaan kunci,
           karena halaman pendaftaran berdiri sendiri dan tidak memegang kunci. */

  if (path === '/akun/login' && req.method === 'POST') {
    return withCors(await akunLogin(req, env), req);
  }

  if (path === '/akun/saya' && req.method === 'POST') {
    return withCors(await akunSaya(req, env), req);
  }

  if (path === '/akun/keluar' && req.method === 'POST') {
    return withCors(await akunKeluar(req, env), req);
  }

        if (path === '/akun/daftar-terbuka' && req.method === 'GET') {
          return withCors(await akunDaftarTerbuka(env), req);
  }

  if (path === '/akun/pengguna' && req.method === 'GET') {
    return withCors(await akunDaftarPengguna(req, env), req);
  }

  if (path === '/akun/ganti-password' && req.method === 'POST') {
    return withCors(await akunGantiPassword(req, env), req);
  }

  /* ---------- data bersama ---------- */

      /* Ambil semua data. Aplikasi memanggil ini sekali saat dibuka. */
      if (path === '/data' && req.method === 'GET') {
        if (!env.DB) {
          return withCors(json({ ok: false, error: 'Database D1 belum dipasang di Worker' }, 500), req);
        }
        return withCors(json(await dataBacaSemua(env)), req);
      }

      /* Simpan satu baris: POST /data/<koleksi>  body: { id, data } */
      const simpan = path.match(/^\/data\/([a-z]+)$/);
      if (simpan && req.method === 'POST') {
        if (!env.DB) {
          return withCors(json({ ok: false, error: 'Database D1 belum dipasang di Worker' }, 500), req);
        }
        const koleksi = simpan[1];
        if (KOLEKSI.indexOf(koleksi) < 0) {
          return withCors(json({ ok: false, error: 'Koleksi tidak dikenal: ' + koleksi }, 400), req);
        }
        const body = await req.json().catch(function () { return null; });
        if (!body || body.id === undefined || body.id === null || String(body.id) === '') {
          return withCors(json({ ok: false, error: 'id wajib diisi' }, 400), req);
        }
        const waktu = await dataSimpan(env, koleksi, body.id, body.data);
        return withCors(json({ ok: true, koleksi: koleksi, id: String(body.id), waktu: waktu }), req);
      }

      /* Hapus satu baris: POST /data/<koleksi>/<id>/hapus
         Sengaja memakai POST, bukan DELETE. Alasannya: permintaan DELETE
         memaksa browser mengirim "preflight" lebih dulu, dan hasil preflight
         itu disimpan di cache browser sampai 24 jam. Kalau aturan CORS di
         Worker berubah, browser masih memakai jawaban lama dan penghapusan
         gagal tanpa penjelasan. POST tidak punya masalah itu. */
      const hapus = path.match(/^\/data\/([a-z]+)\/(.+)\/hapus$/);
      if (hapus && req.method === 'POST') {
        if (!env.DB) {
          return withCors(json({ ok: false, error: 'Database D1 belum dipasang di Worker' }, 500), req);
        }
        const koleksi = hapus[1];
        if (KOLEKSI.indexOf(koleksi) < 0) {
          return withCors(json({ ok: false, error: 'Koleksi tidak dikenal: ' + koleksi }, 400), req);
        }
        const id = decodeURIComponent(hapus[2]);
        await dataHapus(env, koleksi, id);
        return withCors(json({ ok: true, koleksi: koleksi, id: id }), req);
      }

      /* Hapus satu baris: DELETE /data/<koleksi>/<id> — tetap didukung untuk
         pemakaian dari alat lain (mis. curl). */
      const hapusDel = path.match(/^\/data\/([a-z]+)\/(.+)$/);
      if (hapusDel && req.method === 'DELETE') {
        if (!env.DB) {
          return withCors(json({ ok: false, error: 'Database D1 belum dipasang di Worker' }, 500), req);
        }
        const koleksi = hapusDel[1];
        if (KOLEKSI.indexOf(koleksi) < 0) {
          return withCors(json({ ok: false, error: 'Koleksi tidak dikenal: ' + koleksi }, 400), req);
        }
        const id = decodeURIComponent(hapusDel[2]);
        await dataHapus(env, koleksi, id);
        return withCors(json({ ok: true, koleksi: koleksi, id: id }), req);
      }

      /* Simpan data berbentuk satu nilai: POST /data/meta/<kunci> */
      const simpanMeta = path.match(/^\/data\/meta\/([a-z]+)$/);
      if (simpanMeta && req.method === 'POST') {
        if (!env.DB) {
          return withCors(json({ ok: false, error: 'Database D1 belum dipasang di Worker' }, 500), req);
        }
        const kunci = simpanMeta[1];
        if (META_KUNCI.indexOf(kunci) < 0) {
          return withCors(json({ ok: false, error: 'Kunci meta tidak dikenal: ' + kunci }, 400), req);
        }
        const body = await req.json().catch(function () { return null; });
        if (!body) return withCors(json({ ok: false, error: 'Body bukan JSON' }, 400), req);
        const waktu = await metaSimpan(env, kunci, body.data);
        return withCors(json({ ok: true, kunci: kunci, waktu: waktu }), req);
      }

      if (path === '/wa/send' && req.method === 'POST') {
        const body = await req.json().catch(function () { return null; });
        if (!body) return withCors(json({ ok: false, error: 'Body bukan JSON' }, 400), req);
        const to = normalizePhone(body.to);
        const text = String(body.text || '').trim();
        if (!to) return withCors(json({ ok: false, error: 'Nomor tujuan kosong' }, 400), req);
        if (!text) return withCors(json({ ok: false, error: 'Isi pesan kosong' }, 400), req);
        if (!env.WA_TOKEN || !env.WA_PHONE_ID) {
          return withCors(json({ ok: false, error: 'WA_TOKEN / WA_PHONE_ID belum diisi di Worker' }, 500), req);
        }
        try {
          const r = await waSend(env, to, text);
          return withCors(json({ ok: true, id: r.id, to: to }), req);
        } catch (e) {
          return withCors(json({ ok: false, error: e.message, code: e.code, subcode: e.subcode }, 502), req);
        }
      }

      /* Kirim gambar (kwitansi PNG) atau dokumen (majalah PDF).
         WhatsApp mengambil berkasnya sendiri dari alamat publik, jadi
         aplikasi cukup mengirim tautannya. */
      if (path === '/wa/send-media' && req.method === 'POST') {
        const body = await req.json().catch(function () { return null; });
        if (!body) return withCors(json({ ok: false, error: 'Body bukan JSON' }, 400), req);
        const to = normalizePhone(body.to);
        if (!to) return withCors(json({ ok: false, error: 'Nomor tujuan kosong' }, 400), req);
        if (!body.link) return withCors(json({ ok: false, error: 'Alamat berkas kosong' }, 400), req);
        if (!env.WA_TOKEN || !env.WA_PHONE_ID) {
          return withCors(json({ ok: false, error: 'WA_TOKEN / WA_PHONE_ID belum diisi di Worker' }, 500), req);
        }
        try {
          const r = await waSendMedia(env, to, {
            jenis: body.jenis,
            link: body.link,
            caption: body.caption,
            filename: body.filename
          });
          return withCors(json({ ok: true, id: r.id, to: to, jenis: body.jenis || 'image' }), req);
        } catch (e) {
          return withCors(json({ ok: false, error: e.message, code: e.code, subcode: e.subcode }, 502), req);
        }
      }

      if (path === '/wa/inbox' && req.method === 'GET') {
        const queue = await readQueue(env);
        return withCors(json({ ok: true, messages: queue }), req);
      }

      /* Kabar status pesan keluar. Aplikasi memanggil ini setelah mengirim
         supaya pesan yang ditolak Meta bisa ditandai "Gagal", bukan "Terkirim". */
      if (path === '/wa/status-pesan' && req.method === 'POST') {
        const body = await req.json().catch(function () { return null; });
        const ids = (body && body.ids) || [];
        if (!Array.isArray(ids) || !ids.length) {
          return withCors(json({ ok: true, statuses: {} }), req);
        }
        const map = await readStatuses(env);
        const hasil = {};
        for (const id of ids) if (map[id]) hasil[id] = map[id];
        return withCors(json({ ok: true, statuses: hasil }), req);
      }

      if (path === '/wa/ack' && req.method === 'POST') {
        const body = await req.json().catch(function () { return null; });
        const ids = (body && body.ids) || [];
        if (!Array.isArray(ids) || !ids.length) {
          return withCors(json({ ok: true, removed: 0 }), req);
        }
        const buang = {};
        for (const id of ids) buang[id] = true;
        const queue = await readQueue(env);
        const sisa = queue.filter(function (q) { return !buang[q.waId]; });
        await writeQueue(env, sisa);
        return withCors(json({ ok: true, removed: queue.length - sisa.length }), req);
      }

      /* ---------- kwitansi PNG ---------- */

      /* Simpan gambar kwitansi supaya WhatsApp bisa mengambilnya.
         Aplikasi mengirim PNG sebagai base64; Worker menyimpannya dan
         mengembalikan alamat publiknya. */
      if (path === '/kwitansi' && req.method === 'POST') {
        const body = await req.json().catch(function () { return null; });
        if (!body) return withCors(json({ ok: false, error: 'Body bukan JSON' }, 400), req);
        const id = String(body.id || '').replace(/[^A-Za-z0-9_-]/g, '');
        if (id.length < 4) return withCors(json({ ok: false, error: 'ID kwitansi tidak sah' }, 400), req);
        let bytes;
        try { bytes = b64ToBytes(body.data); }
        catch (e) { return withCors(json({ ok: false, error: 'Data gambar tidak sah' }, 400), req); }
        if (!bytes.length) return withCors(json({ ok: false, error: 'Gambar kosong' }, 400), req);
        if (bytes.length > KWT_MAX_BYTE) {
          return withCors(json({ ok: false, error: 'Gambar kwitansi maksimal 4 MB' }, 413), req);
        }
        await env.WA_INBOX.put(kwitansiKey(id), bytes, { expirationTtl: Math.floor(KWT_SIMPAN_MS / 1000) });
        return withCors(json({ ok: true, id: id, url: url.origin + '/kwitansi/' + id + '.png' }), req);
      }

      /* ---------- majalah ---------- */

      /* Unggah satu halaman majalah. Aplikasi mengirim satu permintaan per
         halaman supaya unggahan besar tidak kehabisan waktu. */
      if (path === '/majalah' && req.method === 'POST') {
        const body = await req.json().catch(function () { return null; });
        if (!body) return withCors(json({ ok: false, error: 'Body bukan JSON' }, 400), req);

        const id = String(body.id || '').replace(/[^A-Za-z0-9_-]/g, '');
        if (id.length < 4) return withCors(json({ ok: false, error: 'ID majalah tidak sah' }, 400), req);

        const total = Number(body.total) || 0;
        const n = Number(body.halaman) || 0;
        if (!(total >= 1 && total <= MAJALAH_MAX_PAGES)) {
          return withCors(json({ ok: false, error: 'Jumlah halaman harus 1–' + MAJALAH_MAX_PAGES }, 400), req);
        }
        if (!(n >= 1 && n <= total)) {
          return withCors(json({ ok: false, error: 'Nomor halaman di luar rentang' }, 400), req);
        }

        let bytes;
        try { bytes = b64ToBytes(body.data); }
        catch (e) { return withCors(json({ ok: false, error: 'Data gambar tidak sah' }, 400), req); }
        if (!bytes.length) return withCors(json({ ok: false, error: 'Gambar kosong' }, 400), req);
        if (bytes.length > MAJALAH_MAX_BYTE) {
          return withCors(json({ ok: false, error: 'Satu halaman maksimal 4 MB' }, 413), req);
        }

        const tipe = String(body.tipe || 'image/jpeg');
        if (!/^image\/(jpeg|png|webp|gif)$/.test(tipe)) {
          return withCors(json({ ok: false, error: 'Tipe gambar tidak didukung' }, 400), req);
        }

        await env.WA_INBOX.put(majalahPageKey(id, n), bytes);
        await env.WA_INBOX.put(majalahMetaKey(id), JSON.stringify({
          id: id, halaman: total, tipe: tipe,
          judul: String(body.judul || '').slice(0, 200),
          diperbarui: new Date().toISOString()
        }));

        return withCors(json({ ok: true, id: id, halaman: n, total: total }), req);
      }

      /* Simpan berkas PDF majalah — dipakai untuk lampiran WhatsApp.
         Halaman-halamannya sudah disimpan terpisah sebagai gambar.
         Dikirim bertahap (bagian per bagian) karena KV Cloudflare hanya
         menerima 25 MiB per key, sedangkan PDF majalah bisa 60 MB. */
      if (path === '/majalah-pdf' && req.method === 'POST') {
        const body = await req.json().catch(function () { return null; });
        if (!body) return withCors(json({ ok: false, error: 'Body bukan JSON' }, 400), req);
        const id = String(body.id || '').replace(/[^A-Za-z0-9_-]/g, '');
        if (id.length < 4) return withCors(json({ ok: false, error: 'ID majalah tidak sah' }, 400), req);

        const n = Number(body.bagian) || 1;
        const totalBagian = Number(body.totalBagian) || 1;
        if (!(n >= 1 && n <= MAJALAH_PDF_MAX_BAGIAN)) {
          return withCors(json({ ok: false, error: 'Nomor bagian di luar rentang' }, 400), req);
        }
        if (!(totalBagian >= 1 && totalBagian <= MAJALAH_PDF_MAX_BAGIAN)) {
          return withCors(json({ ok: false, error: 'Jumlah bagian maksimal ' + MAJALAH_PDF_MAX_BAGIAN }, 400), req);
        }

        let bytes;
        try { bytes = b64ToBytes(body.data); }
        catch (e) { return withCors(json({ ok: false, error: 'Data PDF tidak sah' }, 400), req); }
        if (!bytes.length) return withCors(json({ ok: false, error: 'Bagian PDF kosong' }, 400), req);
        if (bytes.length > MAJALAH_PDF_BAGIAN) {
          return withCors(json({ ok: false, error: 'Satu bagian maksimal 18 MB' }, 413), req);
        }

        await env.WA_INBOX.put(majalahPdfKey(id, n), bytes);
        /* Catatan bagian ditulis setiap kali supaya unggahan yang terputus
           di tengah jalan tidak meninggalkan catatan yang menyesatkan. */
        await env.WA_INBOX.put(majalahPdfMetaKey(id), JSON.stringify({
          id: id, bagian: totalBagian, diterima: n,
          judul: String(body.judul || '').slice(0, 200),
          diperbarui: new Date().toISOString()
        }));

        return withCors(json({
          ok: true, id: id, bagian: n, totalBagian: totalBagian,
          url: url.origin + '/majalah-pdf/' + id + '.pdf'
        }), req);
      }

      const mjMeta = path.match(/^\/majalah\/([A-Za-z0-9_-]{4,64})$/);      if (mjMeta && req.method === 'GET') {
        const raw = await env.WA_INBOX.get(majalahMetaKey(mjMeta[1]));
        if (!raw) return withCors(json({ ok: false, error: 'Majalah tidak ditemukan' }, 404), req);
        return withCors(json(Object.assign({ ok: true }, JSON.parse(raw))), req);
      }
      if (mjMeta && req.method === 'DELETE') {
        const raw = await env.WA_INBOX.get(majalahMetaKey(mjMeta[1]));
        if (raw) {
          const meta = JSON.parse(raw);
          for (let i = 1; i <= (meta.halaman || 0); i++) {
            await env.WA_INBOX.delete(majalahPageKey(mjMeta[1], i));
          }
          await env.WA_INBOX.delete(majalahMetaKey(mjMeta[1]));
        }
        const pdfMetaRaw = await env.WA_INBOX.get(majalahPdfMetaKey(mjMeta[1]));
        if (pdfMetaRaw) {
          const pm = JSON.parse(pdfMetaRaw);
          for (let i = 1; i <= (pm.bagian || 0); i++) {
            await env.WA_INBOX.delete(majalahPdfKey(mjMeta[1], i));
          }
          await env.WA_INBOX.delete(majalahPdfMetaKey(mjMeta[1]));
        }
        return withCors(json({ ok: true }), req);
      }

      /* ---------- tanda dibaca ---------- */

      /* Baca status "sudah dibuka" untuk sekumpulan ID pixel. */
      if (path === '/pixel/status' && req.method === 'POST') {
        const body = await req.json().catch(function () { return null; });
        const ids = (body && body.ids) || [];
        if (!Array.isArray(ids) || !ids.length) {
          return withCors(json({ ok: true, dibaca: {} }), req);
        }
        const hasil = {};
        for (const id of ids.slice(0, 200)) {
          const raw = await env.WA_INBOX.get(pixelKey(String(id)));
          if (raw) hasil[id] = JSON.parse(raw);
        }
        return withCors(json({ ok: true, dibaca: hasil }), req);
      }

      /* Baca status konfirmasi penerimaan untuk sekumpulan ID. */
      if (path === '/terima/status' && req.method === 'POST') {
        const body = await req.json().catch(function () { return null; });
        const ids = (body && body.ids) || [];
        if (!Array.isArray(ids) || !ids.length) {
          return withCors(json({ ok: true, terima: {} }), req);
        }
        const hasil = {};
        for (const id of ids.slice(0, 200)) {
          const raw = await env.WA_INBOX.get(terimaKey(String(id)));
          if (raw) hasil[id] = JSON.parse(raw);
        }
        return withCors(json({ ok: true, terima: hasil }), req);
      }

      return withCors(json({ ok: false, error: 'Endpoint tidak dikenal: ' + path }, 404), req);
    } catch (e) {
      return withCors(json({ ok: false, error: e.message || String(e) }, 500), req);
    }
  }
};
