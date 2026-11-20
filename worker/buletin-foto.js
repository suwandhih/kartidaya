/* Perpustakaan foto buletin bersama; satu kunci KV per foto agar penghapusan
   menghapus metadata dan gambar sekaligus. URL publik tidak berisi kredensial. */
const PREFIX = 'buletin:foto:';
const MAX_BYTES = 5 * 1024 * 1024;
const MAX_BODY = Math.ceil(MAX_BYTES / 3) * 4 + 8192;
const ID = '[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}';
const gambarPath = new RegExp('^/buletin-foto/(' + ID + ')$');
const hapusPath = new RegExp('^/buletin-foto/(' + ID + ')/hapus$');

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: {
    'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store'
  } });
}
function galat(message, status) { return json({ ok: false, error: message }, status); }
function fotoInfo(id, metadata, origin) {
  return { id, nama: metadata.nama, tipe: metadata.tipe, ukuran: metadata.ukuran,
    dibuat: metadata.dibuat, url: origin + '/buletin-foto/' + id };
}
function validMeta(m) {
  return m && typeof m.nama === 'string' && ['image/jpeg', 'image/png', 'image/webp'].includes(m.tipe) &&
    Number.isInteger(m.ukuran) && m.ukuran > 0 && m.ukuran <= MAX_BYTES && typeof m.dibuat === 'string';
}

async function bodyTerbatas(req) {
  const length = req.headers.get('Content-Length');
  if (length && Number(length) > MAX_BODY) throw 413;
  if (!req.body) throw 400;
  const reader = req.body.getReader();
  const chunks = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BODY) { await reader.cancel(); throw 413; }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  try { return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)); }
  catch (_) { throw 400; }
}

function tipeGambar(bytes) {
  const ascii = (start, end) => String.fromCharCode(...bytes.subarray(start, end));
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (bytes.length >= 12 && bytes[0] === 0xff && bytes[1] === 0xd8 &&
      bytes[bytes.length - 2] === 0xff && bytes[bytes.length - 1] === 0xd9) {
    let pos = 2, frame = false;
    while (pos + 4 <= bytes.length - 2 && bytes[pos] === 0xff) {
      while (bytes[pos] === 0xff) pos++;
      const marker = bytes[pos++];
      if (marker === 0xda) return frame && pos + 2 <= bytes.length &&
        view.getUint16(pos) >= 2 && pos + view.getUint16(pos) <= bytes.length - 2 ? 'image/jpeg' : '';
      if (marker === 0 || marker === 0xd8 || marker === 0xd9 || pos + 2 > bytes.length) return '';
      if (marker === 1 || (marker >= 0xd0 && marker <= 0xd7)) continue;
      const size = view.getUint16(pos);
      if (size < 2 || pos + size > bytes.length - 2) return '';
      if ((marker >= 0xc0 && marker <= 0xc3) || (marker >= 0xc5 && marker <= 0xc7) ||
          (marker >= 0xc9 && marker <= 0xcb) || (marker >= 0xcd && marker <= 0xcf)) frame = size >= 8;
      pos += size;
    }
  }
  if (bytes.length >= 45 && [137,80,78,71,13,10,26,10].every((v, i) => bytes[i] === v)) {
    let pos = 8, header = false, pixels = false;
    while (pos + 12 <= bytes.length) {
      const size = view.getUint32(pos), type = ascii(pos + 4, pos + 8);
      if (size > bytes.length - pos - 12) return '';
      if (pos === 8) {
        if (type !== 'IHDR' || size !== 13 || !view.getUint32(pos + 8) || !view.getUint32(pos + 12)) return '';
        header = true;
      } else if (type === 'IDAT') pixels = true;
      else if (type === 'IEND') return header && pixels && size === 0 && pos + 12 === bytes.length ? 'image/png' : '';
      pos += size + 12;
    }
  }
  if (bytes.length >= 20 && ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP' &&
      view.getUint32(4, true) + 8 === bytes.length) {
    let pos = 12, pixels = false;
    while (pos + 8 <= bytes.length) {
      const type = ascii(pos, pos + 4), size = view.getUint32(pos + 4, true);
      if (size > bytes.length - pos - 8) return '';
      if ((type === 'VP8 ' && size >= 10 && bytes[pos + 11] === 0x9d && bytes[pos + 12] === 1 && bytes[pos + 13] === 0x2a) ||
          (type === 'VP8L' && size >= 5 && bytes[pos + 8] === 0x2f) || (type === 'ANMF' && size >= 24)) pixels = true;
      pos += 8 + size + (size % 2);
    }
    if (pixels && pos === bytes.length) return 'image/webp';
  }
  return '';
}

function bacaGambar(data) {
  if (typeof data !== 'string') throw 400;
  let declared = null;
  if (data.startsWith('data:')) {
    const match = /^data:(image\/(?:jpeg|png|webp));base64,([\s\S]*)$/.exec(data);
    if (!match) throw 400;
    declared = match[1];
    data = match[2];
  }
  if (data.length > Math.ceil(MAX_BYTES / 3) * 4) throw 413;
  if (!data || data.length % 4 !== 0 || /[^A-Za-z0-9+/=]/.test(data) ||
      /=/.test(data.slice(0, -2)) || !/^[A-Za-z0-9+/]{2}(?:[A-Za-z0-9+/]{2}|[A-Za-z0-9+/]=|==)$/.test(data.slice(-4))) throw 400;
  let binary;
  try { binary = atob(data); } catch (_) { throw 400; }
  if (binary.length > MAX_BYTES) throw 413;
  const bytes = Uint8Array.from(binary, c => c.charCodeAt(0));
  const tipe = tipeGambar(bytes);
  if (!tipe || (declared && declared !== tipe)) throw 400;
  return { bytes, tipe };
}

export async function fotoPublik(req, env, path) {
  if (req.method !== 'GET') return null;
  const match = path.match(gambarPath);
  if (!match) return null;
  try {
    if (!env.WA_INBOX) return galat('Penyimpanan foto belum tersedia', 503);
    const result = await env.WA_INBOX.getWithMetadata(PREFIX + match[1], { type: 'arrayBuffer' });
    if (!result.value || !validMeta(result.metadata)) return galat('Foto tidak ditemukan', 404);
    return new Response(result.value, { headers: {
      'Content-Type': result.metadata.tipe,
      'Content-Length': String(result.value.byteLength),
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'no-store'
    } });
  } catch (_) { return galat('Penyimpanan foto tidak tersedia', 503); }
}

export async function fotoKelola(req, env, path, url) {
  const match = path.match(hapusPath);
  if (!(path === '/buletin-foto' && (req.method === 'GET' || req.method === 'POST')) &&
      !(match && req.method === 'POST')) return null;
  try {
    if (!env.WA_INBOX) return galat('Penyimpanan foto belum tersedia', 503);
    if (match) {
      const key = PREFIX + match[1];
      const result = await env.WA_INBOX.getWithMetadata(key, { type: 'arrayBuffer' });
      if (!result.value) return galat('Foto tidak ditemukan', 404);
      await env.WA_INBOX.delete(key);
      return json({ ok: true, id: match[1] });
    }
    if (req.method === 'GET') {
      const cursor = url.searchParams.get('cursor');
      if (cursor !== null && (!cursor || cursor.length > 2048)) return galat('Cursor tidak sah', 400);
      const opts = { prefix: PREFIX, limit: 100 };
      if (cursor) opts.cursor = cursor;
      let page;
      try { page = await env.WA_INBOX.list(opts); }
      catch (e) {
        if (cursor && /cursor/i.test(String(e && e.message))) return galat('Cursor tidak sah', 400);
        throw e;
      }
      const foto = page.keys.filter(k => new RegExp('^' + ID + '$').test(k.name.slice(PREFIX.length)) && validMeta(k.metadata))
        .map(k => fotoInfo(k.name.slice(PREFIX.length), k.metadata, url.origin));
      return json({ ok: true, foto, cursor: page.list_complete ? null : page.cursor });
    }
    let body;
    try { body = await bodyTerbatas(req); }
    catch (status) { return galat(status === 413 ? 'Foto maksimal 5 MB' : 'Body bukan JSON yang sah', status === 413 ? 413 : 400); }
    if (!body || typeof body !== 'object' || Array.isArray(body) || typeof body.nama !== 'string' ||
        !body.nama.trim() || body.nama.length > 255 || typeof body.tipe !== 'string') return galat('Nama dan tipe foto wajib diisi', 400);
    let gambar;
    try { gambar = bacaGambar(body.data); }
    catch (status) { return galat(status === 413 ? 'Foto maksimal 5 MB' : 'Data gambar tidak sah', status === 413 ? 413 : 400); }
    if (body.tipe !== gambar.tipe) return galat('Tipe gambar tidak cocok dengan isi', 400);
    const id = crypto.randomUUID();
    const metadata = { nama: body.nama.trim(), tipe: gambar.tipe, ukuran: gambar.bytes.length, dibuat: new Date().toISOString() };
    await env.WA_INBOX.put(PREFIX + id, gambar.bytes, { metadata });
    return json({ ok: true, foto: fotoInfo(id, metadata, url.origin) });
  } catch (_) { return galat('Penyimpanan foto tidak tersedia', 503); }
}
