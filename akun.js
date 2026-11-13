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

  /* Peran pengguna: 'admin' | 'donor' | 'keuangan'.
       Dipakai untuk menampilkan label & membuka halaman Akun (CCTV). */
    peran(){
      return (this.pengguna && this.pengguna.peran) || 'donor';
    },
    admin(){
      return this.peran() === 'admin';
    },
    labelPeran(p){
      const v = p || this.peran();
      return v === 'admin' ? 'Admin' : v === 'keuangan' ? 'User keuangan' : 'User donor';
  },

  sisaMenit(){
    if(!this.kedaluwarsa) return 0;
    return Math.max(0, Math.round((Date.parse(this.kedaluwarsa) - Date.now()) / 60000));
  },

  /* ---------- panggilan ke Worker ---------- */

    /* Endpoint /akun/* di Worker sengaja TIDAK memakai kunci aplikasi (fase tes):
       halaman akun berdiri sendiri dan tidak memegang kunci. Kalau kuncinya ada,
       tetap dikirim — tidak ada ruginya, dan bisa dipakai lagi nanti. */
  async panggil(path, opsi){
    const base = workerBase();
      if(!base) throw new Error('Alamat server belum diisi');
      const headers = {};
      if(WhatsApp.appKey) headers['X-App-Key'] = WhatsApp.appKey;
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

  /* ---------- kelola akun (hanya admin) ---------- */

    async daftarPengguna(){
      const r = await this.panggil('/akun/pengguna');
      return Array.isArray(r.pengguna) ? r.pengguna : [];
    },

    async tambahAkun(o){
      return this.panggil('/akun/tambah', {
        method:'POST',
        body: { nama:o.nama, email:o.email, password:o.password, ulangi:o.ulangi, peran:o.peran }
      });
    },

    async setAktif(email, aktif){
      return this.panggil('/akun/aktif', { method:'POST', body:{ email:email, aktif:!!aktif } });
    },

    async aktivitas(batas){
      const r = await this.panggil('/akun/aktivitas?batas=' + (batas || 200));
      return Array.isArray(r.aktivitas) ? r.aktivitas : [];
    },

    /* Catatan aktivitas dikirim dari aplikasi, supaya aturan "apa yang dicatat"
       tetap di satu tempat. Kegagalan mencatat tidak boleh mengganggu pekerjaan
       utama — jadi tidak pernah melempar galat. */
    async catat(baris){
      if(!this.masuk() || !Array.isArray(baris) || !baris.length) return;
      try{ await this.panggil('/akun/catat', { method:'POST', body:{ baris:baris } }); }
      catch(e){ /* abaikan */ }
  },

  alamatDaftar(){
    const base = workerBase();
    return base ? base + '/daftar' : '';
  }
};