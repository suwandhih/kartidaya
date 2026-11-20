"use strict";

/* Buka dengan BuletinKirim.open(id, options)
   atau data-buletin-kirim-id="ID". options.getEdisi(buletin) dapat mengembalikan
   {bacaUrl, sampulUrl} secara sinkron. Tidak mengirim saat dibuka. */
const BuletinKirim = (function(){
  let sesi = null;
  let sibuk = false;
  let nomor = 0;

  function pesan(e){ return String(e && e.message ? e.message : e || 'Kesalahan tidak diketahui'); }
  function amanURL(v){
    if(!v) return '';
    try{
      const raw = String(v);
      if(!/^https:\/\//i.test(raw) || /[\u0000-\u0020\u007f\\]/.test(raw)) return '';
      const u = new URL(raw);
      return u.protocol === 'https:' && u.hostname && !u.username && !u.password ? u.href : '';
    }
    catch(e){ return ''; }
  }
  function idUnik(prefix){
    if(window.crypto && typeof window.crypto.randomUUID === 'function') return prefix + window.crypto.randomUUID();
    if(window.crypto && typeof window.crypto.getRandomValues === 'function'){
      const a = new Uint32Array(4); window.crypto.getRandomValues(a);
      return prefix + Array.from(a, function(n){ return n.toString(36); }).join('-');
    }
    return prefix + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2) + '-' + (++nomor);
  }
  function terkunci(){ return !!terkunciLogin || !!terkunciServer; }
  function renderer(){
    if(typeof BuletinRender !== 'function'){
      throw new Error('Perender BuletinRender belum tersedia. Muat perender sebelum mengirim.');
    }
    return BuletinRender;
  }
  function isiPribadi(v, d, key){
    if(typeof v === 'string') return key === 'tipe' ? v : fillTemplate(v, d);
    if(Array.isArray(v)) return v.map(function(x){ return isiPribadi(x, d, ''); });
    if(v && typeof v === 'object'){
      const out = {};
      Object.keys(v).forEach(function(k){
        if(k !== '__proto__' && k !== 'constructor' && k !== 'prototype') out[k] = isiPribadi(v[k], d, k);
      });
      return out;
    }
    return v;
  }
  function validasiBlok(buletin, opts){
    buletin.blok.forEach(function(b, i){
      if(!b || typeof b !== 'object') throw new Error('Blok ' + (i + 1) + ' tidak valid.');
      if(['gambar','teks','tautan','gelap','krem','kaki'].indexOf(b.tipe) < 0) throw new Error('Jenis blok ' + (i + 1) + ' tidak dikenal.');
      const gambar = String(b.gambar || '').trim();
      const url = String(b.url || '').trim();
      if(b.tipe === 'tautan' && !opts.bacaUrl) throw new Error('Blok ' + (i + 1) + ' membutuhkan URL baca majalah HTTPS.');
      if(b.tipe === 'gambar' && !(b.sampul ? opts.sampulUrl : amanURL(gambar))){
        throw new Error('Blok ' + (i + 1) + ' membutuhkan URL gambar atau sampul HTTPS yang valid.');
      }
      if(b.tipe === 'kaki'){
        if(Array.isArray(b.tautan)){
          if(b.tautan.length > 3) throw new Error('Blok ' + (i + 1) + ': maksimal tiga tautan.');
          b.tautan.forEach(function(t,n){
            if(!t || !String(t.teks || '').trim()) throw new Error('Blok ' + (i+1) + ': isi teks tautan ' + (n+1) + '.');
            if(t.tujuan === 'majalah' && !opts.bacaUrl) throw new Error('Blok ' + (i+1) + ': pilih edisi majalah untuk tautan ' + (n+1) + '.');
            if(t.tujuan === 'website' && !amanURL(t.url)) throw new Error('Blok ' + (i+1) + ': isi alamat HTTPS tautan ' + (n+1) + '.');
            if(t.tujuan !== 'majalah' && t.tujuan !== 'website') throw new Error('Tujuan tautan tidak dikenal.');
          });
        }else if(!(url ? amanURL(url) : opts.bacaUrl)){
          throw new Error('Blok ' + (i + 1) + ' membutuhkan URL tombol atau URL baca majalah HTTPS yang valid.');
        }
      }
      if(['teks','gelap','krem'].indexOf(b.tipe) >= 0){
        const isi = [b.isi].concat((Array.isArray(b.bagian) ? b.bagian : []).map(function(p){return p && p.isi;}));
        if(isi.some(function(s){return /\]\(\{\/MAJALAH\}\)/.test(String(s || ''));}) && !opts.bacaUrl)
          throw new Error('Blok ' + (i+1) + ': pilih edisi majalah untuk tautan di teks.');
      }
      if(b.tipe === 'kaki'){
        const links = BuletinRender.sosial(b);
        for(const k of ['instagram','facebook','website']){
          if(!amanURL(links[k])) throw new Error('Blok ' + (i + 1) + ': alamat ' + k + ' harus diisi dengan alamat HTTPS yang benar.');
        }
      }
    });
  }
  function renderPribadi(s, d){
    const buletin = isiPribadi(s.buletin, d, '');
    validasiBlok(buletin, s.edisi);
    const hasil = renderer()(buletin, s.edisi);
    if(!hasil || typeof hasil.html !== 'string' || typeof hasil.teks !== 'string') throw new Error('Perender harus menghasilkan HTML dan teks.');
    return hasil;
  }
  function subjekPribadi(s, d){
    const subjek = fillTemplate(s.buletin.judul, d).replace(/[\r\n]+/g, ' ').trim();
    if(!subjek) throw new Error('Subjek buletin kosong.');
    return subjek;
  }
  function konfirmasiHTML(url){
    return url ? '<div style="margin:22px auto;padding:16px 18px;font-family:Arial,Helvetica,sans-serif;max-width:600px">' +
      '<p>Sudah menerima buletin ini? Beri tahu kami dengan menekan tombol berikut.</p>' +
      '<a href="' + esc(url) + '" style="display:inline-block;background:#2f6f9f;color:#fff;text-decoration:none;padding:11px 22px;border-radius:6px">Konfirmasi sudah menerima buletin</a></div>' : '';
  }
  function tambahHTML(html, tambahan){
    return /<\/body\s*>/i.test(html) ? html.replace(/<\/body\s*>/i, function(m){ return tambahan + m; }) : html + tambahan;
  }
  function alamat(d){ return String(emailUtama(d) || '').trim(); }
  function alamatValid(s){ return /^[^\s@,;<>\r\n]+@[^\s@,;<>\r\n]+\.[^\s@,;<>\r\n]+$/.test(s); }
  function tampil(s, tahap){
    if(s !== sesi) return;
    s.tahap = tahap;
    let body = '', footer = '';
    if(tahap === 'pilih'){
      body = '<p>Pilih penerima untuk <b>' + esc(s.buletin.judul) + '</b>. Email dikirim sungguhan melalui Gmail.</p>' +
        '<p><button type="button" class="btn sm" data-buletin-kirim-action="semua">Pilih semua</button> ' +
        '<button type="button" class="btn sm" data-buletin-kirim-action="kosong">Kosongkan</button></p>' +
        '<div style="max-height:45vh;overflow:auto">' + (s.donors.length ? s.donors.map(function(d, i){
          return '<label style="display:block;padding:6px"><input type="checkbox" data-buletin-kirim-pilih="' + i + '"' +
            (s.pilih.has(i) ? ' checked' : '') + '> ' + esc(donorName(d)) + ' (' + esc(d.id) + ') — ' +
            esc(alamat(d) || 'email belum diisi') + '</label>';
        }).join('') : '<p>Tidak ada donor.</p>') + '</div><p id="buletin-kirim-pesan" role="alert"></p>';
      footer = '<button class="btn primary" data-buletin-kirim-action="periksa">Periksa pengiriman</button><button class="btn" data-close>Batal</button>';
    }else if(tahap === 'periksa'){
      const daftar = Array.from(s.pilih).sort(function(a,b){ return a-b; });
      const contoh = s.donors[daftar[0]];
      const preview = renderPribadi(s, contoh);
      const info = {judul:subjekPribadi(s, contoh), donor:donorName(contoh), dikirim:new Date().toISOString()};
      const tautan = workerBase() ? terimaURL('pratinjau', info) : '';
      const previewHTML = BuletinRender.pratinjau(tambahHTML(preview.html, konfirmasiHTML(tautan)));
      body = '<p><b>Konfirmasi pengiriman Gmail sungguhan</b></p><p>Buletin: ' + esc(s.buletin.judul) +
        '<br>Jumlah penerima: ' + daftar.length + '</p><div style="max-height:40vh;overflow:auto"><ul>' + daftar.map(function(i){
          const d = s.donors[i]; return '<li>' + esc(donorName(d)) + ' (' + esc(d.id) + ') — ' + esc(alamat(d) || 'email belum diisi; akan gagal') + '</li>';
        }).join('') + '</ul></div><h3>Pratinjau untuk ' + esc(donorName(contoh)) + '</h3>' +
        '<p class="tiny muted">Tautan dinonaktifkan dalam pratinjau.</p>' +
        '<div class="buletin-pratinjau-gulir" role="region" aria-label="Pratinjau buletin" tabindex="0">' + previewHTML + '</div>' +
        '<p id="buletin-kirim-pesan" role="alert"></p>';
      footer = '<button class="btn primary" data-buletin-kirim-action="kirim">Kirim sekarang</button>' +
        '<button class="btn" data-buletin-kirim-action="kembali">Kembali</button><button class="btn" data-close>Batal</button>';
    }else{
      const ok = s.hasil.filter(function(x){ return x.status === 'Terkirim'; }).length;
      body = '<p>' + (sibuk ? 'Pengiriman sedang berlangsung…' : 'Pengiriman selesai.') + ' Terkirim: <b>' + ok +
        '</b>; gagal: <b>' + (s.hasil.length - ok) + '</b>; diproses: ' + s.hasil.length + '/' + s.total + '.</p>' +
        (s.pesan ? '<p role="alert">' + esc(s.pesan) + '</p>' : '') +
        '<div style="max-height:45vh;overflow:auto"><ul>' + s.hasil.map(function(h){
          return '<li><b>' + esc(h.status) + '</b> — ' + esc(h.nama) + ' (' + esc(h.id) + ') — ' + esc(h.to || 'tanpa email') +
            (h.pesan ? ': ' + esc(h.pesan) : '') + '</li>';
        }).join('') + '</ul></div>';
      footer = sibuk ? '<span>Jangan kirim ulang saat proses berlangsung.</span>' : '<button class="btn" data-close>Tutup</button>';
    }
    body = '<div data-buletin-kirim-owner="' + s.nomor + '">' + body + '</div>';
    openModal({title:'Kirim buletin', body:body, footer:footer, wide:true});
    const root = document.getElementById('modal-root');
    if(root) root.setAttribute('data-buletin-kirim-sesi', String(s.nomor));
  }
  function tampilJikaAktif(s, tahap){
    const root = document.getElementById('modal-root');
    if(root && root.getAttribute('data-buletin-kirim-sesi') === String(s.nomor) &&
       root.querySelector('[data-buletin-kirim-owner="' + s.nomor + '"]')) tampil(s, tahap);
  }
  function beriPesan(text){
    const el = document.getElementById('buletin-kirim-pesan');
    if(el) el.textContent = text;
  }
  function open(id, options){
    if(terkunci()){ toast('Aplikasi terkunci; pengiriman tidak tersedia.', true); return false; }
    if(sibuk){ if(sesi) tampil(sesi, 'hasil'); return false; }
    const b = state.buletin.find(function(x){ return x.id === id; });
    if(!b){ toast('Buletin tidak ditemukan.', true); return false; }
    try{ renderer(); }catch(e){ toast(pesan(e), true); return false; }
    if(!Array.isArray(b.blok) || !b.blok.length){ toast('Buletin belum memiliki blok.', true); return false; }
    let snapshot, edisi;
    try{
      snapshot = JSON.parse(JSON.stringify(b));
      const data = options && typeof options.getEdisi === 'function' ? options.getEdisi(JSON.parse(JSON.stringify(snapshot))) : {};
      if(data && typeof data.then === 'function') throw new Error('getEdisi harus mengembalikan data secara sinkron.');
      edisi = {bacaUrl:amanURL(data && data.bacaUrl), sampulUrl:amanURL(data && data.sampulUrl)};
      validasiBlok(snapshot, edisi);
    }catch(e){ toast(pesan(e), true); return false; }
    sesi = {nomor:++nomor, buletin:snapshot, donors:state.donors.slice(), edisi:edisi,
      pilih:new Set(), hasil:[], total:0, pesan:'', tahap:'pilih'};
    tampil(sesi, 'pilih');
    return true;
  }
  async function kirim(s){
    if(sibuk || s !== sesi || s.tahap !== 'periksa' || !s.pilih.size) return;
    sibuk = true;
    s.total = s.pilih.size;
    tampil(s, 'hasil');
    try{
      if(terkunci()) throw new Error('Aplikasi terkunci; tidak ada email dikirim.');
      renderer();
      if(!Gmail.isConnected()) throw new Error('Gmail belum terhubung. Hubungkan Gmail di Setelan; tidak ada email dikirim.');
      if(typeof Gmail.ensureConnected === 'function') await Gmail.ensureConnected();
      if(terkunci() || !Gmail.isConnected()) throw new Error('Gmail tidak terhubung atau aplikasi terkunci; tidak ada email dikirim.');
      const indexes = Array.from(s.pilih).sort(function(a,b){ return a-b; });
      indexes.forEach(function(i){ renderPribadi(s, s.donors[i]); subjekPribadi(s, s.donors[i]); });
      for(const i of indexes){
        if(terkunci()){
          s.pesan = 'Aplikasi terkunci; penerima yang belum diproses tidak dikirim.';
          break;
        }
        const d = s.donors[i], to = alamat(d), tanggal = new Date().toISOString();
        let subjek = '', isi = '', pixelId = '', terimaId = '', gmailId = '', threadId = '', error = '';
        let status = 'Gagal';
        try{
          if(terkunci()) throw new Error('Aplikasi terkunci; email tidak dikirim.');
          if(!Gmail.isConnected()) throw new Error('Gmail terputus; email tidak dikirim.');
          if(!alamatValid(to)) throw new Error('Alamat email kosong atau tidak valid.');
          subjek = subjekPribadi(s, d);
          const hasilRender = renderPribadi(s, d);
          const html = hasilRender.html;
          isi = formatTeksPolos(hasilRender.teks);
          const base = workerBase();
          if(base){ pixelId = idUnik('px-'); terimaId = idUnik('tr-'); }
          const info = {judul:subjek, donor:donorName(d), dikirim:tanggal};
          const tautanTerima = terimaId ? terimaURL(terimaId, info) : '';
          const tambahan = konfirmasiHTML(tautanTerima) + (pixelId ? pixelHTML(pixelId) : '');
          const htmlKirim = tambahHTML(html, tambahan);
          const r = await Gmail.send({from:Gmail.email || '', to:to, subject:subjek,
            body:isi + (tautanTerima ? '\n\nKonfirmasi sudah menerima: ' + tautanTerima : ''), html:htmlKirim});
          gmailId = (r && r.id) || ''; threadId = (r && r.threadId) || '';
          status = 'Terkirim';
        }catch(e){ error = pesan(e); pixelId = ''; terimaId = ''; }
        const hasil = {id:d.id, nama:donorName(d), to:to, status:status, pesan:error};
        s.hasil.push(hasil);
        try{
          addMessage({id:idUnik('msg-'), donorId:d.id, arah:'keluar', tanggal:tanggal, subjek:subjek,
            isi:isi, status:status, kanal:'email', jenis:'buletin', buletinId:s.buletin.id,
            from:Gmail.email || '', to:to, gmailId:gmailId, threadId:threadId, dibaca:true,
            pixelId:pixelId, dibacaPenerima:'', terimaId:terimaId, terimaPenerima:'', catatan:error});
        }catch(e){ hasil.pesan += (hasil.pesan ? '; ' : '') + 'Riwayat gagal disimpan: ' + pesan(e); }
        tampilJikaAktif(s, 'hasil');
      }
    }catch(e){ s.pesan = pesan(e); }
    finally{
      const sukses = s.hasil.filter(function(x){ return x.status === 'Terkirim'; }).length;
      if(sukses){
        const b = state.buletin.find(function(x){ return x.id === s.buletin.id; });
        if(!b || terkunci()) s.pesan += (s.pesan ? ' ' : '') + 'Ringkasan buletin tidak dapat disimpan; periksa riwayat donor.';
        else{
          try{
            b.jumlahPenerimaTerakhir = sukses;
            b.terakhirKirim = new Date().toISOString();
            save('buletin');
          }catch(e){ s.pesan += (s.pesan ? ' ' : '') + 'Ringkasan buletin gagal disimpan: ' + pesan(e); }
        }
      }
      sibuk = false; tampilJikaAktif(s, 'hasil');
    }
  }
  window.addEventListener('beforeunload', function(e){
    if(sibuk){ e.preventDefault(); e.returnValue = ''; }
  });
  document.addEventListener('change', function(e){
    if(!sesi || sesi.tahap !== 'pilih' || sibuk || terkunci()) return;
    const el = e.target, value = el.getAttribute('data-buletin-kirim-pilih');
    if(value === null || !/^\d+$/.test(value)) return;
    const i = Number(value);
    if(!sesi.donors[i]) return;
    if(el.checked) sesi.pilih.add(i); else sesi.pilih.delete(i);
  });
  document.addEventListener('click', function(e){
    const pembuka = e.target.closest('[data-buletin-kirim-id]');
    if(pembuka){ open(pembuka.getAttribute('data-buletin-kirim-id')); return; }
    const el = e.target.closest('[data-buletin-kirim-action]');
    if(!el || !sesi || sibuk || terkunci()) return;
    const root = document.getElementById('modal-root');
    if(!root || root.getAttribute('data-buletin-kirim-sesi') !== String(sesi.nomor) ||
       !root.querySelector('[data-buletin-kirim-owner="' + sesi.nomor + '"]') || !root.contains(el)) return;
    const aksi = el.getAttribute('data-buletin-kirim-action');
    if(sesi.tahap === 'pilih' && aksi === 'semua'){
      sesi.donors.forEach(function(d, i){ sesi.pilih.add(i); }); tampil(sesi, 'pilih');
    }else if(sesi.tahap === 'pilih' && aksi === 'kosong'){
      sesi.pilih.clear(); tampil(sesi, 'pilih');
    }else if(sesi.tahap === 'pilih' && aksi === 'periksa'){
      if(!sesi.pilih.size) beriPesan('Pilih sedikitnya satu donor.');
      else{
        try{
          Array.from(sesi.pilih).forEach(function(i){ renderPribadi(sesi, sesi.donors[i]); subjekPribadi(sesi, sesi.donors[i]); });
          tampil(sesi, 'periksa');
        }catch(err){ beriPesan(pesan(err)); }
      }
    }else if(sesi.tahap === 'periksa' && aksi === 'kembali') tampil(sesi, 'pilih');
    else if(sesi.tahap === 'periksa' && aksi === 'kirim') kirim(sesi);
  });
  return {open:open};
})();
window.BuletinKirim = BuletinKirim;
