const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

class KV {
  constructor() { this.map = new Map(); }
  async put(key, value, options) { this.map.set(key, { value: Uint8Array.from(value), metadata: options.metadata }); }
  async getWithMetadata(key) {
    const item = this.map.get(key);
    return item ? { value: item.value.slice().buffer, metadata: item.metadata } : { value: null, metadata: null };
  }
  async delete(key) { this.map.delete(key); }
  async list({ prefix, limit, cursor }) {
    const keys = [...this.map.entries()].filter(([key]) => key.startsWith(prefix)).sort(([a], [b]) => a.localeCompare(b));
    const start = cursor ? Number(cursor) : 0;
    const page = keys.slice(start, start + limit);
    return { keys: page.map(([name, item]) => ({ name, metadata: item.metadata })),
      list_complete: start + limit >= keys.length, cursor: String(start + limit) };
  }
}

async function main() {
  const worker = (await import(pathToFileURL(path.join(__dirname, '..', 'worker', 'index.js')).href)).default;
  const env = { APP_KEY: 'secret', WA_INBOX: new KV(), DB: { prepare() { return { bind(token) { return {
    async first() { return token === 'valid-session' ? { token, kedaluwarsa: '2999-01-01T00:00:00Z' } : null; }
  }; } }; } } };
  const request = (route, options = {}) => worker.fetch(new Request('https://worker.example' + route, options), env);
  const auth = { 'X-App-Key': 'secret', 'Content-Type': 'application/json', Origin: 'https://app.example' };
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a++sAAAAASUVORK5CYII=', 'base64');
  const upload = (body, headers = auth) => request('/buletin-foto', { method: 'POST', headers, body: JSON.stringify(body) });
  const body = { nama: 'Foto.png', tipe: 'image/png', data: png.toString('base64') };

  let r = await request('/buletin-foto');
  assert.equal(r.status, 401);
  r = await request('/buletin-foto', { headers: auth });
  assert.deepEqual(await r.json(), { ok: true, foto: [], cursor: null });
  assert.equal(r.headers.get('access-control-allow-origin'), 'https://app.example');
  r = await upload(body, { Authorization: 'Bearer valid-session', 'Content-Type': 'application/json' });
  assert.equal(r.status, 200);
  const { foto } = await r.json();
  assert.equal(foto.nama, body.nama);
  assert.equal(foto.tipe, body.tipe);
  assert.equal(foto.ukuran, png.length);
  assert.equal(foto.url, 'https://worker.example/buletin-foto/' + foto.id);
  assert.ok(!foto.url.includes('secret'));
  r = await request('/buletin-foto/' + foto.id);
  assert.equal(r.status, 200);
  assert.equal(r.headers.get('content-type'), 'image/png');
  assert.equal(r.headers.get('x-content-type-options'), 'nosniff');
  assert.deepEqual(Buffer.from(await r.arrayBuffer()), png);
  r = await request('/buletin-foto', { headers: auth });
  assert.deepEqual((await r.json()).foto, [foto]);

  assert.equal((await upload({ ...body, tipe: 'image/jpeg' })).status, 400);
  assert.equal((await upload({ ...body, data: Buffer.from('<svg/>').toString('base64'), tipe: 'image/svg+xml' })).status, 400);
  assert.equal((await upload({ ...body, data: '%%%=' })).status, 400);
  assert.equal((await upload({ ...body, data: 'data:image/jpeg;base64,' + body.data })).status, 400);
  assert.equal((await upload({ ...body, data: png.subarray(0, 33).toString('base64') })).status, 400);
  assert.equal((await upload({ nama: 'fake.jpg', tipe: 'image/jpeg', data: Buffer.from('ffd8ffe0000000000000ffd9', 'hex').toString('base64') })).status, 400);
  assert.equal((await upload({ nama: 'fake.webp', tipe: 'image/webp', data: Buffer.from('524946460c000000574542505650384c00000000', 'hex').toString('base64') })).status, 400);
  assert.equal((await upload({ ...body, data: Buffer.alloc(5 * 1024 * 1024 + 1).toString('base64') })).status, 413);
  assert.equal((await request('/buletin-foto', { method: 'POST', headers: auth, body: '{' })).status, 400);
  r = await upload({ ...body, data: 'data:image/png;base64,' + body.data });
  assert.equal(r.status, 200);

  const webp = Buffer.from('5249464612000000574542505650384c050000002f0000000000', 'hex');
  assert.equal((await upload({ nama: 'x.webp', tipe: 'image/webp', data: webp.toString('base64') })).status, 200);
  const jpg = Buffer.from('ffd8ffc00008080001000101ffda000201ffd9', 'hex');
  assert.equal((await upload({ nama: 'x.jpg', tipe: 'image/jpeg', data: jpg.toString('base64') })).status, 200);

  for (let i = 0; i < 100; i++) await env.WA_INBOX.put('buletin:foto:' + (i.toString(16).padStart(8, '0') + '-0000-4000-8000-000000000000'), png, { metadata: { nama: 'x', tipe: 'image/png', ukuran: png.length, dibuat: '2026-01-01' } });
  r = await request('/buletin-foto', { headers: auth });
  const page = await r.json();
  assert.equal(page.foto.length, 100);
  assert.ok(page.cursor);
  r = await request('/buletin-foto?cursor=' + page.cursor, { headers: auth });
  assert.equal((await r.json()).foto.length, 4);
  assert.equal((await request('/buletin-foto/' + foto.id + '/hapus', { method: 'POST' })).status, 401);
  r = await request('/buletin-foto/' + foto.id + '/hapus', { method: 'POST', headers: auth });
  assert.deepEqual(await r.json(), { ok: true, id: foto.id });
  assert.equal((await request('/buletin-foto/' + foto.id)).status, 404);
  assert.equal((await request('/buletin-foto/' + foto.id + '/hapus', { method: 'POST', headers: auth })).status, 404);
  env.WA_INBOX = { async list() { throw new Error('private KV failure'); }, async getWithMetadata() { throw new Error('private KV failure'); } };
  r = await request('/buletin-foto', { headers: auth });
  assert.equal(r.status, 503);
  assert.ok(!(await r.text()).includes('private KV failure'));
  assert.equal((await request('/buletin-foto/' + foto.id)).status, 503);
  env.WA_INBOX = null;
  assert.equal((await request('/buletin-foto', { headers: auth })).status, 503);
  console.log('uji-buletin-foto: OK');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
