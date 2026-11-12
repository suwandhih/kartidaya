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

   Semua endpoint butuh header X-App-Key, KECUALI:
     /wa/webhook, /pixel/<id>, /majalah/<id>/<n>
   — tiga itu dipanggil Meta dan klien email yang tidak punya kunci.
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
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-App-Key',
    'Access-Control-Max-Age': '86400',
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

      /* --- sisanya butuh kunci aplikasi --- */
      if (!authorized(req, env)) {
        return withCors(json({ ok: false, error: 'Kunci aplikasi salah atau belum diisi' }, 401), req);
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
