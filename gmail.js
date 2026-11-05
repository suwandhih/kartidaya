"use strict";
/* ============================================================
   Gmail API — OAuth 2.0 (Google Identity Services) + REST
   Tanpa backend. WAJIB dibuka via http://localhost (bukan file://)
   karena Google menolak origin file://.
   ============================================================ */

const GMAIL_SCOPES = [
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/gmail.readonly'
].join(' ');

/* Token disimpan di sessionStorage supaya tidak hilang saat halaman dimuat
   ulang. Tanpa ini, setiap refresh membuat Gmail "belum terhubung" dan surat
   diam-diam tercatat sebagai mode simulasi. sessionStorage (bukan
   localStorage) dipilih agar token hilang saat tab ditutup. */
const GMAIL_SESSION_KEY = 'kartidaya.gmail.session';

/* ---------- pesan error OAuth yang bisa ditindaklanjuti ---------- */
function describeOAuthError(resp){
  const code = String((resp && resp.error) || '');
  const desc = String((resp && resp.error_description) || '');
  if(code === 'access_denied'){
    const pn = (String(Gmail.clientId || '').match(/^(\d{6,})-/)) || [];
    return 'Akses ditolak (access_denied). Alamat yang dipakai login belum ' +
      'terdaftar sebagai Test user di project pemilik Client ID ini' +
      (pn[1] ? ' (project nomor ' + pn[1] + ')' : '') + '. ' +
      'Buka Google Cloud Console → pastikan project yang dibuka adalah project ' +
      'yang sama dengan Client ID di halaman Setelan → Audience → Test users → ' +
      'Add users → masukkan alamat Gmail yang tadi dipakai login → Save. ' +
      'Tunggu ±1 menit lalu coba lagi.';
  }
  if(code === 'origin_mismatch'){
    return 'Origin belum terdaftar (origin_mismatch). Salin origin dari halaman ' +
      'Setelan ke Authorized JavaScript origins di Google Cloud Console.';
  }
  if(code === 'invalid_client'){
    return 'Client ID tidak dikenali (invalid_client). Periksa kembali Client ID ' +
      'di halaman Setelan.';
  }
  if(code === 'popup_closed' || code === 'popup_closed_by_user'){
    return 'Jendela izin ditutup sebelum selesai. Klik Hubungkan Gmail lagi dan ' +
      'jangan tutup jendelanya.';
  }
  return desc || code || 'OAuth gagal';
}

/* ---------- base64url (aman untuk UTF-8) ---------- */
function b64encode(str){
  const bytes = new TextEncoder().encode(String(str));
  let bin = '';
  for(let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}
function b64urlEncode(str){
  return b64encode(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function b64urlDecode(s){
  let t = String(s || '').replace(/-/g, '+').replace(/_/g, '/');
  while(t.length % 4) t += '=';
  const bin = atob(t);
  const bytes = new Uint8Array(bin.length);
  for(let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}
function wrap76(s){ return String(s).replace(/(.{76})/g, '$1\r\n'); }

/* ---------- bangun pesan RFC 2822 ---------- */
function buildRawMessage(o){
  const encHeader = function(s){ return '=?UTF-8?B?' + b64encode(String(s || '')) + '?='; };
  /* `From` wajib alamat lengkap. Kalau profil Gmail belum sempat terbaca,
     header `From: me` ditolak Gmail — lebih baik dihilangkan, Gmail akan
     mengisi sendiri dari akun yang login. */
  const head = [];
  if(o.from && o.from.indexOf('@') > 0) head.push('From: ' + o.from);
  head.push('To: ' + o.to);
  if(o.cc) head.push('Cc: ' + o.cc);
  head.push(
    'Subject: ' + encHeader(o.subject),
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset="UTF-8"',
    'Content-Transfer-Encoding: base64',
    '',
    wrap76(b64encode(o.body || ''))
  );
  return b64urlEncode(head.join('\r\n'));
}

/* ---------- urai alamat ---------- */
function emailOf(s){
  const m = String(s || '').match(/<([^>]+)>/);
  const v = m ? m[1] : String(s || '');
  return v.trim().toLowerCase();
}
function nameOf(s){
  const m = String(s || '').match(/^\s*"?([^"<]*?)"?\s*</);
  if(m && m[1].trim()) return m[1].trim();
  const e = emailOf(s);
  return e ? e.split('@')[0] : '';
}

/* ---------- urai pesan Gmail ---------- */
function parseGmailMessage(m){
  const h = {};
  const headers = (m.payload && m.payload.headers) ? m.payload.headers : [];
  headers.forEach(function(x){ h[String(x.name).toLowerCase()] = x.value; });

  let body = '';
  (function walk(p){
    if(!p) return;
    if(p.mimeType === 'text/plain' && p.body && p.body.data){
      body += b64urlDecode(p.body.data);
    }else if(p.parts){
      p.parts.forEach(walk);
    }
  })(m.payload);
  if(!body && m.payload && m.payload.body && m.payload.body.data){
    body = b64urlDecode(m.payload.body.data);
  }

  const ts = h.date ? Date.parse(h.date) : parseInt(m.internalDate, 10);
  return {
    gmailId: m.id,
    threadId: m.threadId || '',
    from: h.from || '',
    to: h.to || '',
    cc: h.cc || '',
    subjek: h.subject || '(tanpa subjek)',
    tanggal: new Date(isNaN(ts) ? Date.now() : ts).toISOString(),
    isi: body,
    labelIds: m.labelIds || []
  };
}

/* ============================================================
   Objek Gmail
   ============================================================ */
const Gmail = {
  clientId: '',
  token: null,
  expiresAt: 0,
  email: '',
  onStatus: null,
  _script: null,

  isConfigured(){ return !!this.clientId; },
  isConnected(){ return !!this.token && Date.now() < this.expiresAt; },
  status(){
    if(!this.isConfigured()) return 'unconfigured';
    return this.isConnected() ? 'connected' : 'disconnected';
  },

  /* ---------- simpan / pulihkan sesi ---------- */
  saveSession(){
    try{
      if(this.token && Date.now() < this.expiresAt){
        sessionStorage.setItem(GMAIL_SESSION_KEY, JSON.stringify({
          token:this.token, expiresAt:this.expiresAt, email:this.email
        }));
      }else{
        sessionStorage.removeItem(GMAIL_SESSION_KEY);
      }
    }catch(e){ /* mode privat / storage penuh — abaikan */ }
  },
  restoreSession(){
    try{
      const raw = sessionStorage.getItem(GMAIL_SESSION_KEY);
      if(!raw) return false;
      const s = JSON.parse(raw);
      if(!s || !s.token || !s.expiresAt || Date.now() >= s.expiresAt){
        sessionStorage.removeItem(GMAIL_SESSION_KEY);
        return false;
      }
      this.token = s.token;
      this.expiresAt = s.expiresAt;
      this.email = s.email || '';
      return true;
    }catch(e){ return false; }
  },
  clearSession(){
    try{ sessionStorage.removeItem(GMAIL_SESSION_KEY); }catch(e){ /* abaikan */ }
  },

  /* ---------- perpanjangan sesi otomatis ---------- */
  /* Sisa waktu token dalam milidetik (0 kalau tidak ada token). */
  msLeft(){
    return this.token ? Math.max(0, this.expiresAt - Date.now()) : 0;
  },
  /* Perbarui token tanpa membuka jendela izin. Google mengizinkan ini selama
     pengguna masih punya sesi login di browser dan sudah pernah menyetujui
     scope-nya. Kalau gagal (mis. sesi Google sudah logout), kembalikan false
     dan pengguna perlu klik "Hubungkan Gmail" sekali lagi. */
  async renew(){
    if(!this.clientId) return false;
    if(!this.isSecureOrigin()) return false;
    try{ await this.loadScript(); }catch(e){ return false; }
    if(!window.google || !google.accounts || !google.accounts.oauth2) return false;

    const self = this;
    return new Promise(function(resolve){
      let selesai = false;
      const beres = function(ok){
        if(selesai) return;
        selesai = true;
        resolve(ok);
      };
      /* Jaring pengaman: kalau Google tidak menjawab (mis. iframe diblokir),
         jangan menggantung selamanya. */
      const timer = setTimeout(function(){ beres(false); }, 15000);
      try{
        const tc = google.accounts.oauth2.initTokenClient({
          client_id: self.clientId,
          scope: GMAIL_SCOPES,
          prompt: '',            /* tanpa jendela izin — senyap */
          callback: async function(resp){
            clearTimeout(timer);
            if(resp && resp.error){ beres(false); return; }
            if(!resp || !resp.access_token){ beres(false); return; }
            self.token = resp.access_token;
            self.expiresAt = Date.now() + ((resp.expires_in || 3600) - 60) * 1000;
            if(!self.email){
              try{ await self.fetchProfile(); }catch(e){ /* opsional */ }
            }
            self.saveSession();
            if(self.onStatus) self.onStatus();
            beres(true);
          },
          error_callback: function(){ clearTimeout(timer); beres(false); }
        });
        tc.requestAccessToken({ prompt: '' });
      }catch(e){
        clearTimeout(timer);
        beres(false);
      }
    });
  },
  /* Pastikan siap dipakai. Kalau token tinggal sedikit, perbarui dulu. */
  async ensureConnected(){
    if(this.isConnected() && this.msLeft() > 5 * 60 * 1000) return true;
    if(await this.renew()) return true;
    return this.isConnected();
  },
  /* Origin yang diterima Google: https apa pun, atau http khusus localhost.
     `file://` selalu ditolak. */
  isSecureOrigin(){
    if(location.protocol === 'https:') return true;
    return location.protocol === 'http:' &&
      (location.hostname === 'localhost' || location.hostname === '127.0.0.1');
  },
  origin(){
    return location.protocol + '//' + location.host;
  },

  loadScript(){
    if(window.google && window.google.accounts) return Promise.resolve();
    if(this._script) return this._script;
    this._script = new Promise(function(res, rej){
      const s = document.createElement('script');
      s.src = 'https://accounts.google.com/gsi/client';
      s.async = true;
      s.defer = true;
      s.onload = function(){ res(); };
      s.onerror = function(){ rej(new Error('Gagal memuat Google Identity Services — butuh internet')); };
      document.head.appendChild(s);
    });
    return this._script;
  },

  async connect(clientId){
    if(clientId) this.clientId = clientId;
    if(!this.clientId) throw new Error('Client ID belum diisi');
    if(!this.isSecureOrigin()){
      throw new Error('Google menolak origin ' + this.origin() +
        '. Buka lewat https:// atau http://localhost — bukan file://');
    }
    await this.loadScript();
    const self = this;
    return new Promise(function(resolve, reject){
      self.tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: self.clientId,
        scope: GMAIL_SCOPES,
        callback: async function(resp){
          if(resp.error){ reject(new Error(describeOAuthError(resp))); return; }
          self.token = resp.access_token;
          self.expiresAt = Date.now() + ((resp.expires_in || 3600) - 60) * 1000;
          try{ await self.fetchProfile(); }catch(e){ /* profil opsional */ }
          self.saveSession();
          if(self.onStatus) self.onStatus();
          resolve(resp);
        },
        error_callback: function(err){
          const code = (err && (err.type || err.error)) || '';
          reject(new Error(describeOAuthError({ error: code, error_description: err && err.message })));
        }
      });
      self.tokenClient.requestAccessToken();
    });
  },

  disconnect(){
    if(this.token && window.google && google.accounts && google.accounts.oauth2){
      try{ google.accounts.oauth2.revoke(this.token, function(){}); }catch(e){ /* abaikan */ }
    }
    this.token = null;
    this.expiresAt = 0;
    this.email = '';
    this.clearSession();
    if(this.onStatus) this.onStatus();
  },

  async fetchProfile(){
    const r = await this.api('/gmail/v1/users/me/profile');
    if(r && r.emailAddress) this.email = r.emailAddress;
    return r;
  },

  async api(path, opts){
    opts = opts || {};
    if(!this.isConnected()) throw new Error('Belum terhubung ke Gmail');
    const base = opts.base || 'https://gmail.googleapis.com';
    const res = await fetch(base + path, {
      method: opts.method || 'GET',
      headers: Object.assign({ Authorization: 'Bearer ' + this.token }, opts.headers || {}),
      body: opts.body
    });
    if(res.status === 401){
      this.token = null;
      this.expiresAt = 0;
      this.clearSession();
      if(this.onStatus) this.onStatus();
      throw new Error('Sesi Gmail kedaluwarsa — hubungkan ulang');
    }
    const text = await res.text();
    let data = null;
    try{ data = text ? JSON.parse(text) : null; }catch(e){ data = { raw: text }; }
    if(!res.ok){
      let msg = 'HTTP ' + res.status;
      if(data && data.error){
        msg = typeof data.error === 'string' ? data.error : (data.error.message || msg);
      }
      throw new Error(msg);
    }
    return data;
  },

  async send(o){
    const raw = buildRawMessage(o);
    return this.api('/gmail/v1/users/me/messages/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ raw: raw })
    });
  },

  async listIds(q, max){
    const r = await this.api('/gmail/v1/users/me/messages?maxResults=' + (max || 30) +
      '&q=' + encodeURIComponent(q));
    return (r && r.messages) ? r.messages.map(function(m){ return m.id; }) : [];
  },

  getMessage(id){
    return this.api('/gmail/v1/users/me/messages/' + encodeURIComponent(id) + '?format=full');
  }
};
