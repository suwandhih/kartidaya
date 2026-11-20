"use strict";

/* Fitur buletin terpisah dari halaman Tulis Surat. */
const Buletin = (function(){
  let pengiriman = Promise.resolve();
  let draft = null;
  let berubah = false;
  function kirim(){
    Server.tertunda.buletin = true;
    Server.simpanTertunda();
    pengiriman = pengiriman.then(async function(){
      while(Server.sibuk) await new Promise(function(resolve){ setTimeout(resolve, 50); });
      Server.tertunda.buletin = true;
      Server.simpanTertunda();
      await Server.kirim('buletin');
    });
    return pengiriman;
  }

  function cari(id){
    return state.buletin.find(function(b){ return b.id === id; });
  }

  function view(){
    if(draft) return viewEditor();
    setTitle('Buletin', 'Daftar buletin');
    const daftar = state.buletin.slice().sort(function(a, b){
      return String(b.diubah || b.dibuat || '').localeCompare(String(a.diubah || a.dibuat || ''));
    });
    return '<div class="card"><div class="card-head"><h2>Buletin tersimpan</h2>' +
      '<button class="btn primary" data-buletin-action="baru">+ Buat buletin</button></div>' +
      '<p class="small muted">Susun isi buletin, pilih edisi majalah, lalu periksa sebelum mengirim.</p>' +
      (daftar.length ? '<div class="stack">' + daftar.map(function(b){
        return '<div class="card" style="padding:12px"><div class="row"><b style="flex:1">' + esc(b.judul) + '</b>' +
          '<button class="btn sm" data-buletin-action="editor" data-id="' + esc(b.id) + '">Susun blok</button>' +
          '<button class="btn sm" data-buletin-action="pratinjau" data-id="' + esc(b.id) + '">Pratinjau</button>' +
          '<button class="btn sm primary" data-buletin-action="kirim" data-id="' + esc(b.id) + '">Kirim</button>' +
          '<button class="btn sm" data-buletin-action="ubah" data-id="' + esc(b.id) + '">Ubah data</button>' +
          '<button class="btn sm" data-buletin-action="duplikat" data-id="' + esc(b.id) + '">Duplikat</button>' +
          '<button class="btn sm ghost" data-buletin-action="hapus" data-id="' + esc(b.id) + '">Hapus</button></div>' +
          '<div class="tiny muted">Edisi: ' + esc(b.edisi || '—') + ' · Tanggal: ' + esc(b.tanggal || '—') +
          (b.terakhirKirim ? ' · Penerima terakhir: ' + esc(b.jumlahPenerimaTerakhir) : '') + '</div></div>';
      }).join('') + '</div>' : '<div class="empty">Belum ada buletin. Pilih <b>+ Buat buletin</b> untuk memulai.</div>') + '</div>';
  }

  function form(id){
    const b = id ? cari(id) : null;
    if(id && !b){ toast('Buletin tidak ditemukan', true); return; }
    openModal({
      title: b ? 'Ubah buletin' : 'Buat buletin',
      body: '<div class="field"><label for="buletin-judul">Judul</label><input id="buletin-judul" type="text" value="' + esc(b ? b.judul : '') + '"></div>' +
        '<div class="field"><label for="buletin-edisi">Edisi</label><input id="buletin-edisi" type="text" value="' + esc(b ? b.edisi || '' : '') + '" placeholder="Contoh: November 2026"></div>' +
        '<div class="field"><label for="buletin-tanggal">Tanggal</label><input id="buletin-tanggal" type="date" value="' + esc(b ? b.tanggal || '' : '') + '"></div>',
      footer: '<button class="btn primary" data-buletin-action="simpan" data-id="' + esc(id || '') + '">Simpan</button>' +
        '<button class="btn" data-close>Batal</button>'
    });
  }

  function simpan(id){
    const judul = document.getElementById('buletin-judul').value.trim();
    const edisi = document.getElementById('buletin-edisi').value.trim();
    const tanggal = document.getElementById('buletin-tanggal').value;
    if(!judul){ toast('Judul buletin belum diisi', true); return; }
    const b = id ? cari(id) : { id:uid('buletin'), dibuat:new Date().toISOString(), blok:[] };
    if(!b){ toast('Buletin tidak ditemukan', true); return; }
    b.judul = judul; b.edisi = edisi; b.tanggal = tanggal; b.diubah = new Date().toISOString();
    if(!id) state.buletin.push(b);
    save('buletin'); closeModal(); render(); toast('Buletin disimpan');
  }

  const jenis = {
    gambar: 'Gambar utama', teks: 'Teks', tautan: 'Tautan baca',
    gelap: 'Kotak gelap', krem: 'Kotak krem', kaki: 'Kaki'
  };
  function blokBaru(tipe){
    if(tipe === 'gambar') return {tipe:tipe, gambar:'', judul:''};
    if(tipe === 'teks') return {tipe:tipe, isi:''};
    if(tipe === 'tautan') return {tipe:tipe, teks:'Baca di sini!'};
    if(tipe === 'gelap') return {tipe:tipe, judul:'', bagian:[{judul:'', isi:''}]};
    if(tipe === 'krem') return {tipe:tipe, judul:'', isi:''};
    if(tipe === 'kaki') return {tipe:tipe, tombol:'Baca majalah', url:'', sosial:'', hakcipta:''};
    return null;
  }
  function bukaEditor(id){
    const b = cari(id);
    if(!b){ toast('Buletin tidak ditemukan', true); return; }
    draft = JSON.parse(JSON.stringify(b));
    if(!Array.isArray(draft.blok)) draft.blok = [];
    berubah = false;
    render();
  }
  function keluar(){
    if(draft && berubah && !confirm('Perubahan blok belum disimpan. Tinggalkan editor?')) return false;
    draft = null; berubah = false;
    return true;
  }
  function field(label, key, value, textarea, extra){
    const attrs = ' data-buletin-field="' + key + '"' + (extra || '');
    return '<div class="field"><label>' + label + (textarea
      ? '<textarea' + attrs + ' rows="3">' + esc(value || '') + '</textarea>'
      : '<input type="text"' + attrs + ' value="' + esc(value || '') + '">') + '</label></div>';
  }
  function editorBlok(b, i){
    let isi = '';
    if(b.tipe === 'gambar') isi = '<label><input type="checkbox" data-buletin-field="sampul"' + (b.sampul ? ' checked' : '') + '> Gunakan sampul edisi majalah yang dipilih</label>' + field('Alamat gambar lain (https)', 'gambar', b.gambar) + field('Judul di atas gambar', 'judul', b.judul) + '<p class="tiny muted">Judul ditampilkan sebelum gambar agar lebih kompatibel dengan aplikasi email.</p>';
    if(b.tipe === 'teks') isi = field('Isi teks', 'isi', b.isi, true);
    if(b.tipe === 'tautan') isi = field('Teks tautan', 'teks', b.teks) + '<p class="tiny muted">Tautan menuju halaman pembaca edisi majalah yang dipilih.</p>';
    if(b.tipe === 'gelap'){
      isi = field('Judul kotak', 'judul', b.judul);
      const bagian = Array.isArray(b.bagian) ? b.bagian : [];
      isi += bagian.map(function(p, n){
        const attr = ' data-bagian="' + n + '"';
        return '<div class="buletin-bagian"><div class="row"><b>Sub-bagian ' + (n+1) + '</b>' +
          '<button class="btn sm ghost" data-buletin-action="hapus-bagian" data-index="' + i + '" data-bagian="' + n + '">Hapus sub-bagian</button></div>' +
          field('Judul kecil', 'judul', p.judul, false, attr) + field('Isi', 'isi', p.isi, true, attr) + '</div>';
      }).join('') + '<button class="btn sm" data-buletin-action="tambah-bagian" data-index="' + i + '">+ Sub-bagian</button>';
    }
    if(b.tipe === 'krem') isi = field('Judul', 'judul', b.judul) + field('Isi', 'isi', b.isi, true);
    if(b.tipe === 'kaki') isi = field('Teks tombol', 'tombol', b.tombol) + field('Alamat tombol (https)', 'url', b.url) +
      field('Tautan sosial (teks)', 'sosial', b.sosial, true) + field('Hak cipta', 'hakcipta', b.hakcipta);
    return '<div class="card buletin-blok" data-blok="' + i + '"><div class="row"><b style="flex:1">' + (i+1) + '. ' + esc(jenis[b.tipe] || 'Blok tidak dikenal') + '</b>' +
      '<button class="btn sm" data-buletin-action="naik" data-index="' + i + '"' + (i===0?' disabled':'') + '>↑</button>' +
      '<button class="btn sm" data-buletin-action="turun" data-index="' + i + '"' + (i===draft.blok.length-1?' disabled':'') + '>↓</button>' +
      '<button class="btn sm" data-buletin-action="duplikat-blok" data-index="' + i + '">Duplikat</button>' +
      '<button class="btn sm ghost" data-buletin-action="hapus-blok" data-index="' + i + '">Hapus</button></div>' + isi + '</div>';
  }
  function edisiTersedia(){
    const daftar = daftarMajalah().slice();
    const aktif = majalahInfo();
    if(aktif && !daftar.some(function(e){ return e.id === aktif.id; })) daftar.unshift(aktif);
    return daftar;
  }
  function edisiPilihan(b){
    return edisiTersedia().find(function(e){ return e.id === b.majalahId; }) || null;
  }
  function opsiMajalah(b){
    const e = edisiPilihan(b);
    if(!e) return {bacaUrl:'', sampulUrl:''};
    const base = workerBase();
    return {bacaUrl:base + '/baca/' + encodeURIComponent(e.id), sampulUrl:base + '/majalah/' + encodeURIComponent(e.id) + '/1'};
  }
  function preview(){
    return draft.blok.length ? BuletinRender(draft, opsiMajalah(draft)).html : '<div class="bp-kosong">Tambahkan blok untuk melihat pratinjau.</div>';
  }
  function viewEditor(){
    setTitle('Buletin', 'Susun blok');
    return '<div class="row buletin-toolbar"><h2 style="flex:1">' + esc(draft.judul) + '</h2>' +
      '<button class="btn primary" data-buletin-action="simpan-blok">Simpan blok</button>' +
      '<button class="btn" data-buletin-action="kembali">Kembali</button></div>' +
      '<p class="small muted">Format teks: **tebal**, *miring*, ==stabilo==. Pratinjau menunjukkan isi email; tampilan dapat berbeda di setiap aplikasi email.</p>' +
      '<div class="card field"><label for="buletin-majalah">Edisi majalah untuk tautan baca dan sampul</label>' +
      '<select id="buletin-majalah"><option value="">— Tidak dipilih —</option>' +
      edisiTersedia().map(function(e){ return '<option value="' + esc(e.id) + '"' + (draft.majalahId === e.id ? ' selected' : '') + '>' + esc(e.judul || e.id) + '</option>'; }).join('') +
      (draft.majalahId && !edisiPilihan(draft) ? '<option value="' + esc(draft.majalahId) + '" selected>Edisi tidak ditemukan</option>' : '') + '</select></div>' +
      '<div class="buletin-editor"><div><div class="card"><div class="row"><label for="buletin-jenis">Tambah blok</label>' +
      '<select id="buletin-jenis">' + Object.keys(jenis).map(function(k){ return '<option value="' + k + '">' + jenis[k] + '</option>'; }).join('') +
      '</select><button class="btn" data-buletin-action="tambah-blok">+ Tambah</button></div></div>' +
      '<div class="stack">' + draft.blok.map(editorBlok).join('') + '</div></div>' +
      '<div><h3>Pratinjau langsung</h3><div class="buletin-preview" id="buletin-preview" inert>' + preview() + '</div></div></div>';
  }
  document.addEventListener('input', function(e){
    if(!draft || terkunciLogin || terkunciServer || currentPage !== 'buletin') return;
    const el = e.target;
    if(el.id === 'buletin-majalah'){
      draft.majalahId = el.value; berubah = true;
      const p = document.getElementById('buletin-preview');
      if(p) p.innerHTML = preview();
      return;
    }
    const key = el.getAttribute('data-buletin-field');
    if(!key) return;
    const container = el.closest('[data-blok]');
    const b = container && draft.blok[Number(container.getAttribute('data-blok'))];
    if(!b) return;
    const n = el.getAttribute('data-bagian');
    if(n !== null){ if(!b.bagian || !b.bagian[Number(n)]) return; b.bagian[Number(n)][key] = el.value; }
    else b[key] = el.type === 'checkbox' ? el.checked : el.value;
    berubah = true;
    const p = document.getElementById('buletin-preview');
    if(p) p.innerHTML = preview();
  });

  document.addEventListener('click', function(e){
    const el = e.target.closest('[data-buletin-action]');
    if(!el || terkunciLogin || terkunciServer || currentPage !== 'buletin') return;
    const action = el.getAttribute('data-buletin-action');
    const id = el.getAttribute('data-id');
    if(action === 'baru') form('');
    else if(action === 'editor') bukaEditor(id);
    else if(action === 'pratinjau'){
      const b = cari(id);
      if(!b){ toast('Buletin tidak ditemukan', true); return; }
      const html = BuletinRender(b, opsiMajalah(b)).html;
      openModal({title:'Pratinjau: ' + b.judul, wide:true,
        body:'<p class="small muted">Token penerima ditampilkan apa adanya; tampilan dapat berbeda di aplikasi email. Tautan dinonaktifkan.</p><iframe title="Pratinjau buletin" sandbox="" tabindex="-1" referrerpolicy="no-referrer" style="width:100%;height:500px;border:0;pointer-events:none" srcdoc="' + esc(html) + '"></iframe>',
        footer:'<button class="btn" data-close>Tutup</button>'});
    }
    else if(action === 'kirim'){
      const b = cari(id);
      if(!b){ toast('Buletin tidak ditemukan', true); return; }
      BuletinKirim.open(id, {getEdisi:opsiMajalah});
    }
    else if(action === 'kembali'){ if(keluar()) render(); }
    else if(action === 'simpan-blok' && draft){
      const b = cari(draft.id);
      if(!b){ toast('Buletin tidak ditemukan', true); return; }
      b.blok = JSON.parse(JSON.stringify(draft.blok)); b.majalahId = draft.majalahId || ''; b.diubah = new Date().toISOString();
      berubah = false; save('buletin'); toast('Blok buletin disimpan');
    }
    else if(action === 'tambah-blok' && draft){
      const pilihan = document.getElementById('buletin-jenis');
      const b = pilihan && blokBaru(pilihan.value);
      if(b){ draft.blok.push(b); berubah = true; render(); }
    }
    else if(draft && ['naik','turun','duplikat-blok','hapus-blok','tambah-bagian','hapus-bagian'].indexOf(action) >= 0){
      const i = Number(el.getAttribute('data-index'));
      const b = draft.blok[i];
      if(!Number.isInteger(i) || !b) return;
      if(action === 'naik' && i > 0) [draft.blok[i-1], draft.blok[i]] = [draft.blok[i], draft.blok[i-1]];
      else if(action === 'turun' && i < draft.blok.length-1) [draft.blok[i+1], draft.blok[i]] = [draft.blok[i], draft.blok[i+1]];
      else if(action === 'duplikat-blok') draft.blok.splice(i+1, 0, JSON.parse(JSON.stringify(b)));
      else if(action === 'hapus-blok'){
        if(!confirm('Hapus blok ini?')) return;
        draft.blok.splice(i, 1);
      }else if(action === 'tambah-bagian' && b.tipe === 'gelap'){
        if(!Array.isArray(b.bagian)) b.bagian = [];
        b.bagian.push({judul:'', isi:''});
      }else if(action === 'hapus-bagian' && b.tipe === 'gelap'){
        const n = Number(el.getAttribute('data-bagian'));
        if(!Array.isArray(b.bagian) || !Number.isInteger(n) || !b.bagian[n]) return;
        b.bagian.splice(n, 1);
      }else return;
      berubah = true; render();
    }
    else if(action === 'ubah') form(id);
    else if(action === 'simpan') simpan(id);
    else if(action === 'duplikat'){
      const b = cari(id);
      if(!b){ toast('Buletin tidak ditemukan', true); return; }
      const salinan = JSON.parse(JSON.stringify(b));
      delete salinan.jumlahPenerimaTerakhir; delete salinan.terakhirKirim;
      salinan.id = uid('buletin'); salinan.judul = b.judul + ' (salinan)';
      salinan.dibuat = salinan.diubah = new Date().toISOString();
      state.buletin.push(salinan); save('buletin'); render(); toast('Buletin diduplikat');
    }else if(action === 'hapus'){
      const b = cari(id);
      if(!b){ toast('Buletin tidak ditemukan', true); return; }
      if(!confirm('Hapus buletin "' + b.judul + '"?')) return;
      state.buletin = state.buletin.filter(function(x){ return x.id !== id; });
      const hapus = Server.hapus.buletin || (Server.hapus.buletin = []);
      if(hapus.indexOf(String(id)) < 0) hapus.push(String(id));
      save('buletin'); render(); toast('Buletin dihapus');
    }
  });

  window.addEventListener('beforeunload', function(e){
    if(draft && berubah){ e.preventDefault(); e.returnValue = ''; }
  });

  return { view:view, kirim:kirim, keluar:keluar };
})();
