/* ============================================================
   KARTIDAYA — whatsapp.js
   Pembungkus WhatsApp Cloud API lewat Cloudflare Worker.

   Kenapa lewat Worker, bukan langsung ke Meta?
   - Token Meta tidak boleh ada di browser (bisa dicuri lewat F12).
   - Pesan masuk butuh webhook; GitHub Pages tidak bisa menerima kiriman.

   Yang disimpan di browser hanya:
     - alamat Worker (bukan rahasia)
     - kunci aplikasi (APP_KEY) — dipakai untuk membuktikan bahwa permintaan
       datang dari aplikasi ini, bukan orang lain

   Bentuk API sengaja dibuat mirip `Gmail` supaya kode aplikasi seragam.
   ============================================================ */

const WA_SESSION_KEY = 'kartidaya.wa.session';

/* Alamat Worker & kunci aplikasi disimpan di localStorage (bukan sessionStorage)
   supaya pengguna tidak perlu mengetik ulang setiap membuka aplikasi. Keduanya
   tidak berbahaya kalau bocor: alamat Worker hanya URL publik, dan kunci hanya
   berguna untuk Worker ini. Token Meta tetap tidak pernah menyentuh browser. */
function waStore(){
  try{ return window.localStorage; }catch(e){ return null; }
}

const WhatsApp = {
  endpoint: '',      /* contoh: https://kartidaya-wa.namaanda.workers.dev */
  appKey: '',
  phone: '',         /* nomor WhatsApp Business, diisi dari /wa/status */
  onStatus: null,

  /* ---------- konfigurasi ---------- */

  isConfigured(){
    return !!(this.endpoint && this.appKey);
  },
  status(){
    if(!this.isConfigured()) return 'unconfigured';
    return this._ok ? 'connected' : 'disconnected';
  },
  origin(){
    return location.protocol + '//' + location.host;
  },

  /* ---------- panggilan ke Worker ---------- */

  async api(path, opts){
    opts = opts || {};
    if(!this.isConfigured()) throw new Error('Alamat Worker / kunci aplikasi belum diisi');
    const base = String(this.endpoint).replace(/\/+$/, '');
    const res = await fetch(base + path, {
      method: opts.method || 'GET',
      headers: Object.assign({
        'X-App-Key': this.appKey
      }, opts.body ? { 'Content-Type': 'application/json' } : {}, opts.headers || {}),
      body: opts.body ? JSON.stringify(opts.body) : undefined
    });
    let data = null;
    try{ data = await res.json(); }catch(e){ data = null; }
    if(!res.ok || (data && data.ok === false)){
      const msg = (data && data.error) || ('HTTP ' + res.status);
      const err = new Error(msg);
      err.status = res.status;
      err.code = data && data.code;
      throw err;
    }
    this._ok = true;
    if(this.onStatus) this.onStatus();
    return data || {};
  },

  /* Cek Worker hidup dan sudah dikonfigurasi. */
  async ping(){
    try{
      const r = await this.api('/wa/status');
      this._ok = true;
      this.phone = r.display || '';
      if(this.onStatus) this.onStatus();
      return r;
    }catch(e){
      this._ok = false;
      if(this.onStatus) this.onStatus();
      throw e;
    }
  },

  /* ---------- kirim ---------- */

  /* Kirim satu pesan teks. `to` boleh format lokal (0811…) — Worker yang
     menormalkan ke format internasional. */
  async send(o){
    const r = await this.api('/wa/send', {
      method:'POST',
      body:{ to: o.to, text: o.text }
    });
    return { id: r.id || '', to: r.to || '' };
  },

  /* ---------- terima ---------- */

  async fetchInbox(){
    const r = await this.api('/wa/inbox');
    return Array.isArray(r.messages) ? r.messages : [];
  },

  /* Tandai pesan sudah diambil aplikasi supaya tidak ditarik dua kali. */
  async ack(ids){
    if(!ids || !ids.length) return { removed: 0 };
    return this.api('/wa/ack', { method:'POST', body:{ ids: ids } });
  },

  /* Kabar status pesan keluar. Meta mengabari lewat webhook: sent → delivered
     → read, atau failed beserta alasannya. Dipakai supaya pesan yang ditolak
     Meta (mis. di luar jendela 24 jam) ditandai "Gagal", bukan "Terkirim". */
  async statusPesan(ids){
    if(!ids || !ids.length) return {};
    const r = await this.api('/wa/status-pesan', { method:'POST', body:{ ids: ids } });
    return (r && r.statuses) || {};
  },

  /* ---------- sesi ---------- */

  /* Simpan alamat Worker & kunci aplikasi supaya tidak perlu diisi ulang.
     Kunci ikut disimpan karena tanpa itu pengguna harus mengetik ulang setiap
     membuka aplikasi; risikonya terbatas karena kunci hanya berguna untuk
     Worker ini. */
  saveSession(){
    const st = waStore();
    if(!st) return;
    try{
      st.setItem(WA_SESSION_KEY, JSON.stringify({
        endpoint: this.endpoint,
        appKey: this.appKey,
        ok: !!this._ok
      }));
    }catch(e){ /* mode privat — abaikan */ }
  },
  restoreSession(){
    const st = waStore();
    if(!st) return false;
    try{
      const raw = st.getItem(WA_SESSION_KEY);
      if(!raw) return false;
      const s = JSON.parse(raw);
      if(!s || !s.endpoint) return false;
      this.endpoint = s.endpoint;
      this.appKey = s.appKey || '';
      this._ok = !!s.ok;
      return true;
    }catch(e){ return false; }
  },
  clearSession(){
    const st = waStore();
    if(!st) return;
    try{ st.removeItem(WA_SESSION_KEY); }catch(e){ /* abaikan */ }
  },
  disconnect(){
    this._ok = false;
    this.phone = '';
    this.endpoint = '';
    this.appKey = '';
    this.clearSession();
    if(this.onStatus) this.onStatus();
  }
};

/* ---------- utilitas nomor (dipakai app.js) ---------- */

/* Normalkan nomor HP Indonesia ke format WhatsApp: 62811xxxxxxx */
function waPhone(v){
  let s = String(v == null ? '' : v).replace(/[^0-9]/g, '');
  if(!s) return '';
  if(s.startsWith('0')) s = '62' + s.slice(1);
  else if(s.startsWith('620')) s = '62' + s.slice(3);
  else if(s.startsWith('8')) s = '62' + s;
  return s;
}

/* Tampilkan nomor dalam bentuk yang enak dibaca: 0811-8862-345 */
function waPhonePretty(v){
  const s = waPhone(v);
  if(!s) return '';
  const lokal = s.startsWith('62') ? '0' + s.slice(2) : s;
  return lokal.replace(/^(\d{4})(\d{4})(\d+)$/, '$1-$2-$3');
}
