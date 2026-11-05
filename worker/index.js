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

   Semua endpoint kecuali /wa/webhook butuh header:
     X-App-Key: <APP_KEY>
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

async function waSend(env, to, text) {
  const url = GRAPH + '/' + env.WA_PHONE_ID + '/messages';
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + env.WA_TOKEN,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: to,
      type: 'text',
      text: { preview_url: false, body: text }
    })
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

      return withCors(json({ ok: false, error: 'Endpoint tidak dikenal: ' + path }, 404), req);
    } catch (e) {
      return withCors(json({ ok: false, error: e.message || String(e) }, 500), req);
    }
  }
};
