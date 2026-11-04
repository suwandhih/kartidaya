"use strict";
/* ============================================================
   Gmail API — OAuth 2.0 (Google Identity Services) + REST
   Tanpa backend. WAJIB dibuka via http://localhost (bukan file://)
   karena Google menolak origin file://.
   ============================================================ */

const GMAIL_SCOPES = [
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/userinfo.email'
].join(' ');

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
  const head = ['From: ' + o.from, 'To: ' + o.to];
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
  isLocalhost(){
    return location.protocol === 'http:' &&
      (location.hostname === 'localhost' || location.hostname === '127.0.0.1');
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
    if(!this.isLocalhost()){
      throw new Error('Google menolak origin ' + location.protocol + '//' + location.host +
        '. Jalankan serve.bat lalu buka http://localhost:8080/index.html');
    }
    await this.loadScript();
    const self = this;
    return new Promise(function(resolve, reject){
      self.tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: self.clientId,
        scope: GMAIL_SCOPES,
        callback: async function(resp){
          if(resp.error){ reject(new Error(resp.error_description || resp.error)); return; }
          self.token = resp.access_token;
          self.expiresAt = Date.now() + ((resp.expires_in || 3600) - 60) * 1000;
          try{ await self.fetchProfile(); }catch(e){ /* profil opsional */ }
          if(self.onStatus) self.onStatus();
          resolve(resp);
        },
        error_callback: function(err){ reject(new Error((err && err.message) || 'OAuth gagal')); }
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
    if(this.onStatus) this.onStatus();
  },

  async fetchProfile(){
    const r = await this.api('/oauth2/v2/userinfo', { base: 'https://www.googleapis.com' });
    if(r && r.email) this.email = r.email;
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
