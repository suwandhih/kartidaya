"use strict";

/* BuletinFoto.buka({onSelect: function(foto){...}}); foto.url adalah alamat HTTPS publik. */
const BuletinFoto = (function(){
  const batasSumber = 20 * 1024 * 1024, batasUnggah = 5 * 1024 * 1024, batasPiksel = 40000000;
  let sesi = null, nomor = 0;
  function escFoto(v){ return String(v == null ? '' : v).replace(/[&<>"']/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }
  function urlAman(v){
    try{ const s = String(v || ''); if(!/^https:\/\//i.test(s) || /[\u0000-\u0020\u007f\\]/.test(s)) return ''; const u = new URL(s); return u.protocol === 'https:' && u.hostname && !u.username && !u.password ? u.href : ''; }catch(e){ return ''; }
  }
  function aktif(s){ return sesi === s && s.root && s.root.isConnected; }
  function pesan(s, text, error){ if(!aktif(s)) return; const p = s.root.querySelector('[data-foto-pesan]'); p.textContent = text; p.className = error ? 'bf-pesan bf-error' : 'bf-pesan'; }
  function lepas(s){
    if(s.observer) s.observer.disconnect();
    if(s.preview) URL.revokeObjectURL(s.preview);
    s.preview = ''; s.file = null;
    if(sesi === s) sesi = null;
  }
  function online(){ if(typeof navigator !== 'undefined' && navigator.onLine === false) throw new Error('Tidak ada koneksi internet. Coba lagi setelah tersambung.'); }
  function panggil(path, opsi){ online(); if(typeof Server === 'undefined' || typeof Server.panggil !== 'function' || (typeof Server.bisa === 'function' && !Server.bisa())) throw new Error('Server belum diatur. Atur server terlebih dahulu.'); return Server.panggil(path, opsi); }
  function galeri(s){
    if(!aktif(s)) return;
    const area = s.root.querySelector('[data-foto-galeri]');
    area.innerHTML = s.foto.length ? s.foto.map(function(f, i){
      const url = urlAman(f.url);
      return '<div class="bf-item">' + (url ? '<img loading="lazy" src="' + escFoto(url) + '" alt="' + escFoto(f.nama || 'Foto') + '">' : '<div class="bf-tidak-tersedia">Alamat foto tidak tersedia</div>') +
        '<div class="bf-nama">' + escFoto(f.nama || 'Foto') + '</div><div class="bf-aksi">' +
        (url && s.onSelect ? '<button type="button" class="btn sm primary" data-foto-action="pakai" data-index="' + i + '">Gunakan foto</button>' : '') +
        '<button type="button" class="btn sm" data-foto-action="hapus" data-index="' + i + '">Hapus</button></div></div>';
    }).join('') : '<p>Belum ada foto di koleksi bersama.</p>';
    s.root.querySelector('[data-foto-lagi]').hidden = !s.cursor;
  }
  async function muat(s, lanjut){
    if(s.sibuk) return;
    s.sibuk = true; tombol(s); pesan(s, 'Memuat koleksi foto…');
    try{
      const r = await panggil('/buletin-foto' + (lanjut && s.cursor ? '?cursor=' + encodeURIComponent(s.cursor) : ''));
      if(!aktif(s)) return;
      if(!r || !Array.isArray(r.foto)) throw new Error('Jawaban server tidak valid.');
      s.foto = lanjut ? s.foto.concat(r.foto) : r.foto; s.cursor = typeof r.cursor === 'string' && r.cursor ? r.cursor : null;
      galeri(s); pesan(s, '');
    }catch(e){ pesan(s, 'Koleksi foto belum dapat dimuat: ' + (e.message || e), true); }
    finally{ s.sibuk = false; tombol(s); }
  }
  function tombol(s){ if(!aktif(s)) return; s.root.querySelectorAll('[data-foto-action], [data-foto-file], input[name="bf-ukuran"]').forEach(function(b){ b.disabled = s.sibuk; }); }
  async function jenisFile(file){
    const b = new Uint8Array(await file.slice(0, 12).arrayBuffer());
    if(b.length >= 3 && b[0] === 255 && b[1] === 216 && b[2] === 255) return 'image/jpeg';
    if(b.length >= 8 && [137,80,78,71,13,10,26,10].every(function(x, i){ return b[i] === x; })) return 'image/png';
    if(b.length >= 12 && String.fromCharCode.apply(null, b.slice(0, 4)) === 'RIFF' && String.fromCharCode.apply(null, b.slice(8, 12)) === 'WEBP') return 'image/webp';
    return '';
  }
  function bacaGambar(url){ return new Promise(function(resolve, reject){ const img = new Image(); img.onload = function(){ resolve(img); }; img.onerror = function(){ reject(new Error('Foto tidak dapat dibaca. Pilih file lain.')); }; img.src = url; }); }
  function blobCanvas(canvas, tipe, kualitas){ return new Promise(function(resolve, reject){ canvas.toBlob(function(b){ if(!b || b.type !== tipe) reject(new Error('Peramban tidak dapat menyimpan foto dalam format yang diperlukan.')); else resolve(b); }, tipe, kualitas); }); }
  async function olah(s, file, mode){
    const jenis = await jenisFile(file);
    if(!jenis || (file.type && file.type !== jenis)) throw new Error('Format tidak didukung. Pilih foto JPEG, PNG, atau WebP.');
    const img = await bacaGambar(s.preview);
    const w = img.naturalWidth, h = img.naturalHeight;
    if(!w || !h || w * h > batasPiksel) throw new Error('Dimensi foto terlalu besar. Pilih foto yang lebih kecil.');
    const sisiPanjang = Math.max(w, h);
    const skala = mode === 'otomatis' && sisiPanjang > 1200 ? 1200 / sisiPanjang : 1;
    let transparan = false;
    if(jenis !== 'image/jpeg'){
      const sumber = document.createElement('canvas'); sumber.width = w; sumber.height = h;
      const konteks = sumber.getContext('2d'); if(!konteks) throw new Error('Peramban tidak dapat memproses foto.');
      konteks.drawImage(img, 0, 0);
      const pixels = konteks.getImageData(0, 0, w, h).data;
      for(let i = 3; i < pixels.length; i += 4) if(pixels[i] !== 255){ transparan = true; break; }
      sumber.width = 0; sumber.height = 0;
    }
    const canvas = document.createElement('canvas'); canvas.width = Math.max(1, Math.round(w * skala)); canvas.height = Math.max(1, Math.round(h * skala));
    const ctx = canvas.getContext('2d'); if(!ctx) throw new Error('Peramban tidak dapat memproses foto.');
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const output = transparan ? 'image/png' : (jenis === 'image/webp' ? 'image/webp' : 'image/jpeg');
    let blob = await blobCanvas(canvas, output, mode === 'otomatis' ? 0.82 : 0.9);
    if(blob.size > batasUnggah && !transparan) blob = await blobCanvas(canvas, output, 0.72);
    if(blob.size > batasUnggah) throw new Error('Hasil foto lebih dari 5 MB. Pilih foto lebih kecil atau gunakan Otomatis.');
    return blob;
  }
  function dataURL(blob){ return new Promise(function(resolve, reject){ const r = new FileReader(); r.onload = function(){ resolve(r.result); }; r.onerror = function(){ reject(new Error('Foto tidak dapat dibaca.')); }; r.readAsDataURL(blob); }); }
  async function unggah(s){
    if(s.sibuk || !s.file) { if(!s.file) pesan(s, 'Pilih foto terlebih dahulu.', true); return; }
    const file = s.file, pilihan = s.root.querySelector('input[name="bf-ukuran"]:checked');
    s.sibuk = true; tombol(s); pesan(s, 'Menyiapkan foto…');
    try{
      online(); const blob = await olah(s, file, pilihan ? pilihan.value : 'otomatis');
      const data = await dataURL(blob); if(!aktif(s)) return;
      pesan(s, 'Mengunggah foto…');
      const r = await panggil('/buletin-foto', {method:'POST', body:JSON.stringify({nama:file.name, tipe:blob.type, data:data})});
      if(!aktif(s)) return;
      if(!r || !r.foto || !urlAman(r.foto.url)) throw new Error('Server tidak memberikan alamat foto HTTPS yang valid. Periksa koleksi sebelum mengunggah lagi.');
      const foto = Object.assign({}, r.foto, {url:urlAman(r.foto.url)});
      s.foto.unshift(foto); galeri(s);
      URL.revokeObjectURL(s.preview); s.preview = ''; s.file = null;
      s.root.querySelector('[data-foto-preview]').hidden = true; s.root.querySelector('[data-foto-preview]').removeAttribute('src'); s.root.querySelector('[data-foto-file]').value = '';
      pesan(s, s.onSelect
        ? 'Foto berhasil diunggah. Untuk mengganti gambar, tekan Gunakan foto di bawah foto yang dipilih.'
        : 'Foto berhasil diunggah ke koleksi bersama.');
    }catch(e){ pesan(s, 'Foto belum diunggah: ' + (e.message || e), true); }
    finally{ s.sibuk = false; tombol(s); }
  }
  async function hapus(s, index){
    const f = s.foto[index]; if(!f || !f.id || s.sibuk) return;
    if(!confirm('Hapus foto ini dari koleksi bersama? Foto yang sudah digunakan dalam email atau buletin dapat hilang atau rusak. Tindakan ini tidak dapat dibatalkan.')) return;
    s.sibuk = true; tombol(s); pesan(s, 'Menghapus foto…');
    try{ await panggil('/buletin-foto/' + encodeURIComponent(f.id) + '/hapus', {method:'POST'}); if(!aktif(s)) return; s.foto.splice(index, 1); galeri(s); pesan(s, 'Foto dihapus dari koleksi bersama.'); }
    catch(e){ pesan(s, 'Foto belum dapat dihapus: ' + (e.message || e), true); }
    finally{ s.sibuk = false; tombol(s); }
  }
  function buka(opts){
    opts = opts || {}; if(sesi) lepas(sesi);
    const s = {nomor:++nomor, onSelect:typeof opts.onSelect === 'function' ? opts.onSelect : null, foto:[], cursor:null, file:null, preview:'', sibuk:false, root:null, observer:null}; sesi = s;
    openModal({title:'Koleksi foto bersama', wide:true, body:
      '<div class="buletin-foto" data-buletin-foto="' + s.nomor + '">' +
      '<p>Foto di koleksi dapat dipakai bersama. Pilih foto dari perangkat untuk menambahkannya.</p>' +
      '<label class="bf-file">Pilih foto dari perangkat <input type="file" accept="image/jpeg,image/png,image/webp" data-foto-file></label>' +
      '<p class="small">JPEG, PNG, atau WebP; maksimal 20 MB. Hasil unggahan maksimal 5 MB.</p>' +
      '<img class="bf-preview" data-foto-preview alt="Pratinjau foto yang dipilih" hidden>' +
      '<fieldset class="bf-ukuran"><legend>Ukuran foto</legend><label><input type="radio" name="bf-ukuran" value="otomatis" checked> Otomatis — foto lebih ringan untuk email (disarankan)</label><label><input type="radio" name="bf-ukuran" value="asli"> Ukuran asli — lebar dan tinggi tetap, tetapi ukuran file dapat berubah</label></fieldset>' +
      '<button type="button" class="btn primary" data-foto-action="unggah">Unggah foto</button>' +
      '<p class="bf-pesan" data-foto-pesan role="status" aria-live="polite"></p>' +
      '<h3>Koleksi bersama</h3><button type="button" class="btn sm" data-foto-action="muat">Muat ulang koleksi</button><div class="bf-grid" data-foto-galeri></div><button type="button" class="btn" data-foto-action="lagi" data-foto-lagi hidden>Muat foto lainnya</button></div>',
      footer:'<button type="button" class="btn" data-close>Tutup</button>',
      onOpen:function(root){
        s.root = root.querySelector('[data-buletin-foto="' + s.nomor + '"]');
        s.observer = new MutationObserver(function(){ if(!s.root.isConnected) lepas(s); }); s.observer.observe(root, {childList:true, subtree:true});
      }});
    muat(s, false);
  }
  document.addEventListener('change', function(e){
    const s = sesi; if(!s || !aktif(s) || !s.root.contains(e.target) || !e.target.matches('[data-foto-file]') || s.sibuk) return;
    if(s.preview) URL.revokeObjectURL(s.preview); s.preview = ''; s.file = null;
    const img = s.root.querySelector('[data-foto-preview]'); img.hidden = true; img.removeAttribute('src');
    const file = e.target.files && e.target.files[0]; if(!file) return;
    if(file.size > batasSumber || !file.size){ e.target.value = ''; pesan(s, 'Ukuran file harus lebih dari 0 dan maksimal 20 MB.', true); return; }
    if(file.type && ['image/jpeg','image/png','image/webp'].indexOf(file.type) < 0){ e.target.value = ''; pesan(s, 'Format tidak didukung. Pilih JPEG, PNG, atau WebP.', true); return; }
    try{ s.preview = URL.createObjectURL(file); s.file = file; img.src = s.preview; img.hidden = false; pesan(s, 'Foto sudah dipilih, tetapi belum diunggah. Tekan Unggah foto.'); }
    catch(err){ e.target.value = ''; pesan(s, 'Foto tidak dapat dibuka. Pilih file lain.', true); }
  });
  document.addEventListener('click', function(e){
    const b = e.target.closest('[data-foto-action]'), s = sesi;
    if(!b || !s || !aktif(s) || !s.root.contains(b) || s.sibuk) return;
    const action = b.getAttribute('data-foto-action'), index = Number(b.getAttribute('data-index'));
    if(action === 'unggah') unggah(s); else if(action === 'lagi') muat(s, true); else if(action === 'muat') muat(s, false); else if(action === 'hapus') hapus(s, index);
    else if(action === 'pakai' && s.onSelect && s.foto[index]){
      const url = urlAman(s.foto[index].url); if(!url){ pesan(s, 'Alamat foto tidak valid.', true); return; }
      try{ s.onSelect(Object.assign({}, s.foto[index], {url:url})); if(aktif(s)){ lepas(s); closeModal(); } }
      catch(err){ pesan(s, 'Foto belum dapat digunakan: ' + (err.message || err), true); }
    }
  });
  return {buka:buka};
})();
window.BuletinFoto = BuletinFoto;
