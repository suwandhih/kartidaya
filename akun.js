/* ============================================================
   KARTIDAYA — akun.js
   Login pengguna untuk aplikasi Kartidaya.

   Kenapa dipisah dari app.js?
   Bagian ini berdiri sendiri: satu-satunya tugasnya berbicara dengan
   endpoint /akun/* di Worker, lalu menyimpan token di browser. app.js
   tidak perlu tahu apa pun soal password.

   Yang disimpan di browser:
     - token sesi (12 jam) — dibutuhkan supaya tidak perlu masuk ulang
       setiap memuat halaman
     - email & nama pengguna — supaya bisa ditampilkan di header

   Password TIDAK PERNAH disimpan di browser. Yang tersimpan di server
   hanya hash-nya.
   ============================================================ */

const AKUN_SESI = 'kartidaya.akun.sesi';

const Akun = {
  token: '',
  kedaluwarsa: '',
  pengguna: null,      /* { email, nama, peran } */

  /* ---------- simpan & pulihkan sesi ---------- */

  restore(){
    let raw = '';
    try{ raw = localStorage.getItem(AKUN_SESI) || ''; }catch(e){ return false; }
    if(!raw) return false;
    let s = null;
    try{ s = JSON.parse(raw); }catch(e){ return false; }
    if(!s || !s.token) return false;
    /* Token yang sudah lewat waktunya tidak perlu dicoba — server juga akan
       menolaknya, tapi lebih baik langsung minta masuk lagi. */
    if(s.kedaluwarsa && Date.parse(s.kedaluwarsa) <= Date.now()){ this.clear(); return false; }
    this.token = s.token;
    this.kedaluwarsa = s.kedaluwarsa || '';
    this.pengguna = s.pengguna || null;
    return true;
  },

  save(){
    try{
      localStorage.setItem(AKUN_SESI, JSON.stringify({
        token: this.token,
        kedaluwarsa: this.kedaluwarsa,
        pengguna: this.pengguna
      }));
    }catch(e){ /* mode privat / penyimpanan penuh — sesi tetap jalan di memori */ }
  },

  clear(){
    this.token = '';
    this.kedaluwarsa = '';
    this.pengguna = null;
    try{ localStorage.removeItem(AKUN_SESI); }catch(e){ /* abaikan */ }
  },

  masuk(){
    return !!this.token;
  },

  nama(){
    return (this.pengguna && (this.pengguna.nama || this.pengguna.email)) || '';
  },

  peran(){
    return (this.pengguna && this.pengguna.peran) || 'user';
  },

  sisaMenit(){
    if(!this.kedaluwarsa) return 0;
    return Math.max(0, Math.round((Date.parse(this.kedaluwarsa) - Date.now()) / 60000));
  },

  /* ---------- panggilan ke Worker ---------- */

  /* Memakai alamat Worker & kunci aplikasi yang sama dengan data bersama,
     supaya pengguna tidak perlu mengisi apa pun lagi di layar login. */
  async panggil(path, opsi){
    const base = workerBase();
    if(!base) throw new Error('Alamat Worker belum diisi');
    const headers = { 'X-App-Key': WhatsApp.appKey || '' };
    if(this.token) headers['Authorization'] = 'Bearer ' + this.token;
    if((opsi && opsi.body) !== undefined) headers['Content-Type'] = 'application/json';
    const res = await fetch(base + path, {
      method: (opsi && opsi.method) || 'GET',
      headers: headers,
      body: (opsi && opsi.body !== undefined) ? JSON.stringify(opsi.body) : undefined
    });
    const data = await res.json().catch(function(){ return null; });
    if(!res.ok || !data || data.ok === false){
      const err = new Error((data && data.error) || ('HTTP ' + res.status));
      err.status = res.status;
      err.data = data;
      throw err;
    }
    return data;
  },

  /* ---------- masuk & keluar ---------- */

  async login(email, password){
    const r = await this.panggil('/akun/login', {
      method: 'POST',
      body: { email: email, password: password }
    });
    this.token = r.token || '';
    this.kedaluwarsa = r.kedaluwarsa || '';
    this.pengguna = r.pengguna || null;
    this.save();
    return r;
  },

        /* Periksa token masih berlaku (mis. akun dimatikan sejak terakhir masuk).

           Hanya penolakan yang benar-benar soal sesi yang membuat sesi dihapus.
           Kalau yang salah adalah kunci aplikasi — atau internet sedang mati — sesi
           DIPERTAHANKAN: pengguna tidak boleh terlempar ke layar masuk hanya karena
           kunci di Setelan belum diisi. Layar "tidak tersambung" yang menjelaskan
           hal itu. */
  async periksa(){
    if(!this.masuk()) return false;
    try{
      const r = await this.panggil('/akun/saya', { method:'POST', body:{} });
      this.pengguna = r.pengguna || this.pengguna;
      this.kedaluwarsa = r.kedaluwarsa || this.kedaluwarsa;
      this.save();
      return true;
    }catch(e){
            if(e.status === 401 && /sesi|akun tidak aktif/i.test(e.message || '')){
              this.clear();
              return false;
            }
            /* Galat lain (kunci salah, internet mati) → sesi tetap dipakai, dan
               pemuatan data bersama yang akan melaporkan masalahnya. */
            return true;
    }
  },

  async keluar(){
    try{ await this.panggil('/akun/keluar', { method:'POST', body:{} }); }
    catch(e){ /* server tidak terjangkau — sesi lokal tetap dihapus */ }
    this.clear();
  },

  async gantiPassword(passwordLama, passwordBaru){
    const r = await this.panggil('/akun/ganti-password', {
      method:'POST',
      body: { passwordLama: passwordLama, password: passwordBaru }
    });
    /* Server mencabut semua sesi setelah password berubah — termasuk sesi ini.
       Jadi pengguna harus masuk lagi dengan password baru. */
    this.clear();
    return r;
  },

  /* Keadaan pintu pendaftaran (untuk ditampilkan di Setelan). */
  async daftarTerbuka(){
    const r = await this.panggil('/akun/daftar-terbuka');
    return !!r.terbuka;
  },

  alamatDaftar(){
    const base = workerBase();
    return base ? base + '/daftar' : '';
  }
};