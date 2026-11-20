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
      '<button class="btn" data-buletin-action="koleksi-foto">Koleksi foto</button>' +
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
    gambar: 'Gambar utama', teks: 'Teks', tautan: 'Tautan baca', kaki: 'Kaki'
  };
  function blokBaru(tipe){
    if(tipe === 'gambar') return {tipe:tipe, gambar:'', judul:''};
    if(tipe === 'teks') return {tipe:tipe, judul:'', isi:'', warna:'#ffffff', bagian:[]};
    if(tipe === 'tautan') return {tipe:tipe, teks:'Baca di sini!', posisi:'kiri'};
    if(tipe === 'kaki') return {tipe:tipe, tautan:[], sosial:'', hakcipta:'© 2026 Kartidaya Sahabat Indonesia. All Rights Reserved'};
    return null;
  }
  function bukaEditor(id){
    const b = cari(id);
    if(!b){ toast('Buletin tidak ditemukan', true); return; }
    draft = JSON.parse(JSON.stringify(b));
    if(!Array.isArray(draft.blok)) draft.blok = [];
    let hakciptaDilengkapi = false;
    draft.blok.forEach(function(b){
      if(b && b.tipe === 'kaki' && !String(b.hakcipta || '').trim()){
        b.hakcipta = '© 2026 Kartidaya Sahabat Indonesia. All Rights Reserved';
        hakciptaDilengkapi = true;
      }
      if(b && b.tipe === 'kaki' && !Array.isArray(b.tautan)){
        aktifkanTautanKaki(b);
        hakciptaDilengkapi = true;
      }
    });
    berubah = hakciptaDilengkapi;
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
  function fotoAman(url){
    try { const u = new URL(url); return u.protocol === 'https:' && !u.username && !u.password ? u.href : ''; }
    catch(e){ return ''; }
  }
  function toolbarTeks(i, bagian){
    const indexBagian = bagian === undefined ? '' : ' data-bagian="' + bagian + '"';
    const tombol = [
      ['tebal','B','Tebal','tb-tebal'], ['miring','I','Miring','tb-miring'],
      ['stabilo','🖍','Stabilo','tb-stabilo'], ['poin','•','Daftar berpoin','tb-poin'],
      ['nomor','1.','Daftar bernomor','tb-nomor'], ['tautan','🔗','Tambah tautan',''], ['bersihkan','Hapus format','Hapus format','']
    ];
    return '<div class="toolbar-surat" role="toolbar" aria-label="Format teks">' + tombol.map(function(t){
      return '<button type="button" class="tb ' + t[3] + '" data-buletin-action="format-teks" data-index="' + i +
        '"' + indexBagian + ' data-format="' + t[0] + '" title="' + t[2] + '" aria-label="' + t[2] + '">' + t[1] + '</button>';
    }).join('') + '</div>';
  }
  function editorBlok(b, i){
    let isi = '';
    if(b.tipe === 'gambar') isi = '<label><input type="checkbox" data-buletin-field="sampul"' + (b.sampul ? ' checked' : '') + '> Gunakan sampul edisi majalah yang dipilih</label>' +
      '<div class="buletin-foto-pilihan">' + (fotoAman(b.gambar) ? '<img src="' + esc(fotoAman(b.gambar)) + '" alt="Foto yang dipilih">' : '<p class="tiny muted">Belum ada foto dipilih.</p>') +
      '<button class="btn sm" data-buletin-action="pilih-foto" data-index="' + i + '">Pilih atau unggah foto</button></div>' +
      field('Judul gambar', 'judul', b.judul) + '<p class="tiny muted">Judul ditampilkan sebelum gambar agar lebih kompatibel dengan aplikasi email.</p>';
    if(b.tipe === 'teks' || b.tipe === 'gelap' || b.tipe === 'krem'){
      const rawWarna = b.warna || '';
      const warna = b.tipe === 'gelap' ? '#272727' : b.tipe === 'krem' ? '#f5ead6' :
        (/^#[0-9a-f]{6}$/i.test(rawWarna) ? rawWarna : (/^#[0-9a-f]{3}$/i.test(rawWarna) ? '#' + rawWarna.slice(1).split('').map(function(c){ return c+c; }).join('') : '#ffffff'));
      isi = field('Judul (boleh dikosongkan)', 'judul', b.judul) +
        '<div class="field"><label>Warna latar <input type="color" data-buletin-field="warna" value="' + warna + '"></label>' +
        '<span class="tiny muted">Putih untuk latar biasa. Warna tulisan menyesuaikan latar.</span></div>' +
        '<div class="field"><label for="buletin-teks-' + i + '">Isi teks</label>' +
        toolbarTeks(i) + '<textarea id="buletin-teks-' + i + '" data-buletin-field="isi" rows="5">' + esc(b.isi || '') + '</textarea>' +
        '<span class="tiny muted">Pilih teks lalu tekan tombol format. Hasil terlihat di pratinjau.</span></div>';
      const bagian = Array.isArray(b.bagian) ? b.bagian : [];
      isi += bagian.map(function(p,n){
        const attr = ' data-bagian="' + n + '"';
        const id = 'buletin-teks-' + i + '-' + n;
        return '<div class="buletin-bagian"><div class="row"><b>Sub-bagian ' + (n+1) + '</b>' +
          '<button class="btn sm ghost" data-buletin-action="hapus-bagian" data-index="' + i + '" data-bagian="' + n + '">Hapus sub-bagian</button></div>' +
          field('Judul kecil (boleh dikosongkan)', 'judul', p.judul, false, attr) +
          '<div class="field"><label for="' + id + '">Isi sub-bagian</label>' + toolbarTeks(i,n) +
          '<textarea id="' + id + '" data-buletin-field="isi"' + attr + ' rows="4">' + esc(p.isi || '') + '</textarea></div></div>';
      }).join('') + '<button class="btn sm" data-buletin-action="tambah-bagian" data-index="' + i + '">+ Tambah sub-bagian</button>';
    }
    if(b.tipe === 'tautan') isi = field('Teks tautan', 'teks', b.teks) +
      '<div class="field"><label>Posisi tautan<select data-buletin-field="posisi">' +
      [['kiri','Kiri'],['tengah','Tengah'],['kanan','Kanan']].map(function(p){
        return '<option value="' + p[0] + '"' + ((b.posisi || 'kiri') === p[0] ? ' selected' : '') + '>' + p[1] + '</option>';
      }).join('') + '</select></label></div>' +
      '<p class="tiny muted">' + (edisiPilihan(draft) ? 'Terhubung ke: ' + esc(edisiPilihan(draft).judul || 'majalah terpilih') : 'Belum ada majalah yang dipilih.') + '</p>' +
      '<div class="row"><button class="btn sm" data-buletin-action="unggah-majalah">+ Unggah majalah</button>' +
      (edisiPilihan(draft) ? '<button class="btn sm" data-buletin-action="baca-majalah">Buka majalah</button>' : '') + '</div>';
    if(b.tipe === 'kaki'){
      const sosial = BuletinRender.sosial(b);
      const daftar = Array.isArray(b.tautan) ? b.tautan : (b.tombol ? [{teks:b.tombol, tujuan:b.url ? 'website' : 'majalah', url:b.url || ''}] : []);
      isi = '<h4>Tautan kaki</h4><p class="tiny muted">Boleh tanpa tautan atau sampai tiga tautan. Pilih tujuan majalah atau website.</p>' +
        daftar.slice(0,3).map(function(t,n){
          const tujuan = t.tujuan === 'website' ? 'website' : 'majalah';
          return '<div class="buletin-bagian"><div class="row"><b>Tautan ' + (n+1) + '</b>' +
            '<button class="btn sm ghost" data-buletin-action="hapus-tautan-kaki" data-index="' + i + '" data-tautan="' + n + '">Hapus tautan</button></div>' +
            field('Teks tautan', 'teks', t.teks, false, ' data-tautan="' + n + '"') +
            '<div class="field"><label>Tujuan<select data-buletin-field="tujuan" data-tautan="' + n + '">' +
            '<option value="majalah"' + (tujuan === 'majalah' ? ' selected' : '') + '>Majalah yang dipilih</option>' +
            '<option value="website"' + (tujuan === 'website' ? ' selected' : '') + '>Website lain</option></select></label></div>' +
            (tujuan === 'website' ? field('Alamat website (https)', 'url', t.url, false, ' data-tautan="' + n + '"') : '<p class="tiny muted">Menggunakan majalah yang dipilih di atas.</p>') + '</div>';
        }).join('') +
        (daftar.length < 3 ? '<button class="btn sm" data-buletin-action="tambah-tautan-kaki" data-index="' + i + '">+ Tambah tautan</button>' : '') +
        '<h4>Tautan sosial</h4><p class="tiny muted">Tiga ikon tetap ditampilkan. Alamatnya dapat diubah.</p>' +
        ['instagram','facebook','website'].map(function(k){
          const nama = {instagram:'Instagram',facebook:'Facebook',website:'Website'}[k];
          return '<div class="buletin-sosial"><img src="vendor/buletin-' + k + '.png" alt="">' + field(nama, 'sosial-' + k, sosial[k]) + '</div>';
        }).join('') +
        ((typeof b.sosial === 'string' && b.sosial.trim()) || b.sosialLama ? '<div class="field"><label>Teks sosial lama<textarea readonly rows="3">' + esc(b.sosialLama || b.sosial) + '</textarea></label><span class="tiny muted">Teks lama tetap disimpan. Salin alamatnya ke kolom yang sesuai bila ingin mengubahnya.</span></div>' : '') +
        field('Hak cipta (wajib diisi)', 'hakcipta', b.hakcipta);
    }
    return '<div class="card buletin-blok" data-blok="' + i + '"><div class="row"><b style="flex:1">' + (i+1) + '. ' + esc(jenis[b.tipe] || (b.tipe === 'gelap' || b.tipe === 'krem' ? 'Teks (versi lama)' : 'Blok tidak dikenal')) + '</b>' +
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
      '<p class="small muted">Gunakan tombol format pada blok Teks. Pratinjau menunjukkan isi email; tampilan dapat berbeda di setiap aplikasi email.</p>' +
      '<div class="card field"><label for="buletin-majalah">Edisi majalah untuk tautan baca dan sampul</label>' +
      '<select id="buletin-majalah"><option value="">— Tidak dipilih —</option>' +
      edisiTersedia().map(function(e){ return '<option value="' + esc(e.id) + '"' + (draft.majalahId === e.id ? ' selected' : '') + '>' + esc(e.judul || e.id) + '</option>'; }).join('') +
      (draft.majalahId && !edisiPilihan(draft) ? '<option value="' + esc(draft.majalahId) + '" selected>Edisi tidak ditemukan</option>' : '') + '</select>' +
      '<div class="row" style="margin-top:8px"><button class="btn sm primary" data-buletin-action="unggah-majalah">+ Unggah majalah PDF</button>' +
      '<span class="tiny muted">Unggah majalah atau pilih edisi yang sudah ada. Tautan “Baca di sini!” akan menuju edisi ini.</span></div></div>' +
      '<div class="buletin-editor"><div><div class="card"><div class="row"><label for="buletin-jenis">Tambah blok</label>' +
      '<select id="buletin-jenis">' + Object.keys(jenis).map(function(k){ return '<option value="' + k + '">' + jenis[k] + '</option>'; }).join('') +
      '</select><button class="btn" data-buletin-action="tambah-blok">+ Tambah</button></div></div>' +
      '<div class="stack">' + draft.blok.map(editorBlok).join('') + '</div></div>' +
      '<div><h3>Pratinjau langsung</h3><div class="buletin-preview" id="buletin-preview" inert>' + preview() + '</div></div></div>';
  }
  function aktifkanTautanKaki(b){
    if(!Array.isArray(b.tautan)) b.tautan = b.tombol ? [{teks:b.tombol, tujuan:b.url ? 'website' : 'majalah', url:b.url || ''}] : [];
    return b.tautan;
  }
  function aktifkanTeks(b){
    if(b.tipe === 'gelap' || b.tipe === 'krem'){
      b.warna = b.tipe === 'gelap' ? '#272727' : '#f5ead6';
      b.tipe = 'teks';
    }
  }
  function pasangHasilTeks(ta, b, hasil){
    ta.value = hasil.nilai; aktifkanTeks(b);
    const n = ta.getAttribute('data-bagian');
    if(n !== null){ if(!b.bagian || !b.bagian[Number(n)]) return; b.bagian[Number(n)].isi = hasil.nilai; }
    else b.isi = hasil.nilai;
    berubah = true;
    ta.focus(); ta.setSelectionRange(hasil.awal, hasil.akhir);
    const p = document.getElementById('buletin-preview');
    if(p) p.innerHTML = preview();
  }
  document.addEventListener('mousedown', function(e){
    if(e.target.closest('[data-buletin-action="format-teks"]')) e.preventDefault();
  });
  function formTautan(ta, b){
    const awal = ta.selectionStart, akhir = ta.selectionEnd;
    const dipilih = ta.value.slice(awal,akhir);
    const asal = ta.value, editor = draft;
    openModal({title:'Tambah tautan', body:
      '<div class="field"><label>Teks yang ditampilkan<input type="text" id="buletin-link-teks" value="' + esc(dipilih) + '"></label></div>' +
      '<div class="field"><label>Tujuan<select id="buletin-link-tujuan"><option value="majalah">Majalah yang dipilih</option><option value="website">Website lain</option></select></label></div>' +
      '<div class="field" id="buletin-link-url-field" hidden><label>Alamat website (https)<input type="url" id="buletin-link-url" placeholder="https://..."></label></div>' +
      '<p class="tiny muted">Tautan majalah mengikuti edisi yang dipilih pada buletin.</p><p id="buletin-link-error" role="alert"></p>',
      footer:'<button class="btn primary" id="buletin-link-pasang">Pasang tautan</button><button class="btn" data-close>Batal</button>',
      onOpen:function(root){
        const jenis = root.querySelector('#buletin-link-tujuan');
        const alamat = root.querySelector('#buletin-link-url-field');
        jenis.addEventListener('change', function(){ alamat.hidden = jenis.value !== 'website'; });
        root.querySelector('#buletin-link-pasang').addEventListener('click', function(){
          const teks = root.querySelector('#buletin-link-teks').value.trim();
          const input = root.querySelector('#buletin-link-url').value.trim();
          const tujuan = jenis.value === 'majalah' ? '{/MAJALAH}' : BuletinRender.urlAman(input);
          const error = root.querySelector('#buletin-link-error');
          if(!teks || /[\[\]\r\n]/.test(teks)){ error.textContent = 'Isi teks tautan tanpa tanda [ atau ] dan tanpa baris baru.'; return; }
          if(jenis.value === 'majalah' && !opsiMajalah(draft).bacaUrl){ error.textContent = 'Pilih edisi majalah terlebih dahulu di bagian atas editor.'; return; }
          if(!tujuan){ error.textContent = 'Isi alamat website HTTPS yang benar.'; return; }
          if(draft !== editor || terkunciLogin || terkunciServer || currentPage !== 'buletin' || draft.blok.indexOf(b) < 0 || ta.value !== asal){ error.textContent = 'Teks berubah. Tutup dan pilih teks kembali.'; return; }
          const amanTujuan = jenis.value === 'website' ? tujuan.replace(/\(/g,'%28').replace(/\)/g,'%29') : tujuan;
          const sisip = '[' + teks + '](' + amanTujuan + ')';
          closeModal();
          pasangHasilTeks(ta, b, {nilai:asal.slice(0,awal)+sisip+asal.slice(akhir), awal:awal, akhir:awal+sisip.length});
        });
      }});
  }
  document.addEventListener('keydown', function(e){
    if(!draft || terkunciLogin || terkunciServer || currentPage !== 'buletin' || e.key !== 'Enter' || e.isComposing || e.ctrlKey || e.altKey || e.metaKey || e.shiftKey) return;
    const ta = e.target;
    const match = (ta.id || '').match(/^buletin-teks-(\d+)(?:-(\d+))?$/);
    if(!match || ta.selectionStart !== ta.selectionEnd) return;
    const b = draft.blok[Number(match[1])];
    if(!b || ['teks','gelap','krem'].indexOf(b.tipe) < 0) return;
    const hasil = BuletinFormat.lanjut(ta.value, ta.selectionStart);
    if(hasil){ e.preventDefault(); pasangHasilTeks(ta, b, hasil); }
  });

  document.addEventListener('input', function(e){
    if(!draft || terkunciLogin || terkunciServer || currentPage !== 'buletin') return;
    const el = e.target;
    if(el.id === 'buletin-majalah'){
      draft.majalahId = el.value; berubah = true;
      render();
      return;
    }
    const key = el.getAttribute('data-buletin-field');
    if(!key) return;
    const container = el.closest('[data-blok]');
    const b = container && draft.blok[Number(container.getAttribute('data-blok'))];
    if(!b) return;
    const n = el.getAttribute('data-bagian');
    const nt = el.getAttribute('data-tautan');
    if(nt !== null && nt !== undefined && b.tipe === 'kaki'){
      const list = aktifkanTautanKaki(b);
      if(!list[Number(nt)] || ['teks','url','tujuan'].indexOf(key) < 0) return;
      list[Number(nt)][key] = el.value; berubah = true;
      if(key === 'tujuan') render();
      else { const p = document.getElementById('buletin-preview'); if(p) p.innerHTML = preview(); }
      return;
    }
    if(['gelap','krem'].indexOf(b.tipe) >= 0) aktifkanTeks(b);
    if(n !== null){ if(!b.bagian || !b.bagian[Number(n)]) return; b.bagian[Number(n)][key] = el.value; }
    else if(key.indexOf('sosial-') === 0){
      const k = key.slice(7);
      if(['instagram','facebook','website'].indexOf(k) < 0) return;
      if(typeof b.sosial === 'string' && b.sosial.trim()) b.sosialLama = b.sosial;
      b.sosial = BuletinRender.sosial(b);
      b.sosial[k] = el.value;
    } else b[key] = el.type === 'checkbox' ? el.checked : el.value;
    berubah = true;
    const p = document.getElementById('buletin-preview');
    if(p) p.innerHTML = preview();
  });

  document.addEventListener('click', function(e){
    const el = e.target.closest('[data-buletin-action]');
    if(!el || terkunciLogin || terkunciServer || currentPage !== 'buletin') return;
    const action = el.getAttribute('data-buletin-action');
    const id = el.getAttribute('data-id');
    if(action === 'format-teks' && draft){
      const i = Number(el.getAttribute('data-index'));
      const b = draft.blok[i];
      const bagian = el.getAttribute('data-bagian');
      const ta = document.getElementById('buletin-teks-' + i + (bagian === null ? '' : '-' + bagian));
      if(!b || ['teks','gelap','krem'].indexOf(b.tipe) < 0 || !ta) return;
      if(el.getAttribute('data-format') === 'tautan'){ formTautan(ta,b); return; }
      if(el.getAttribute('data-format') === 'bersihkan' && ta.selectionStart === ta.selectionEnd){
        toast('Pilih dulu teks yang ingin dibersihkan', true); ta.focus(); return;
      }
      const hasil = BuletinFormat.ubah(ta.value, ta.selectionStart, ta.selectionEnd, el.getAttribute('data-format'));
      pasangHasilTeks(ta, b, hasil);
    }
    else if((action === 'tambah-tautan-kaki' || action === 'hapus-tautan-kaki') && draft){
      const b = draft.blok[Number(el.getAttribute('data-index'))];
      if(!b || b.tipe !== 'kaki') return;
      const list = aktifkanTautanKaki(b);
      if(action === 'tambah-tautan-kaki'){
        if(list.length >= 3) return;
        list.push({teks:'', tujuan:'majalah', url:''});
      }else{
        const n = Number(el.getAttribute('data-tautan'));
        if(!Number.isInteger(n) || !list[n]) return;
        list.splice(n,1);
      }
      berubah = true; render();
    }
    else if(action === 'baru') form('');
    else if(action === 'koleksi-foto') BuletinFoto.buka();
    else if(action === 'pilih-foto' && draft){
      const b = draft.blok[Number(el.getAttribute('data-index'))];
      const editor = draft;
      if(!b || b.tipe !== 'gambar') return;
      BuletinFoto.buka({onSelect:function(foto){
        if(draft !== editor || draft.blok.indexOf(b) < 0 || terkunciLogin || terkunciServer || currentPage !== 'buletin') return;
        b.gambar = foto.url; b.sampul = false; berubah = true; render();
      }});
    }
    else if(action === 'baca-majalah' && draft){
      const url = opsiMajalah(draft).bacaUrl;
      if(url) window.open(url, '_blank', 'noopener');
    }
    else if(action === 'unggah-majalah' && draft){
      const editor = draft;
      openMajalahForm(function(majalah){
        if(draft !== editor || terkunciLogin || terkunciServer || currentPage !== 'buletin') return;
        draft.majalahId = majalah.id; berubah = true;
      });
    }
    else if(action === 'editor') bukaEditor(id);
    else if(action === 'pratinjau'){
      const b = cari(id);
      if(!b){ toast('Buletin tidak ditemukan', true); return; }
      const html = BuletinRender.pratinjau(BuletinRender(b, opsiMajalah(b)).html);
      openModal({title:'Pratinjau: ' + b.judul, wide:true,
        body:'<p class="small muted">Token penerima ditampilkan apa adanya; tampilan dapat berbeda di aplikasi email. Tautan dinonaktifkan.</p><div class="buletin-pratinjau-gulir" role="region" aria-label="Pratinjau buletin" tabindex="0">' + html + '</div>',
        footer:'<button class="btn" data-close>Tutup</button>'});
    }
    else if(action === 'kirim'){
      const b = cari(id);
      if(!b){ toast('Buletin tidak ditemukan', true); return; }
      BuletinKirim.open(id, {getEdisi:opsiMajalah});
    }
    else if(action === 'kembali'){ if(keluar()) render(); }
    else if(action === 'simpan-blok' && draft){
      const kosong = draft.blok.findIndex(function(x){ return x.tipe === 'kaki' && !String(x.hakcipta || '').trim(); });
      if(kosong >= 0){ toast('Hak cipta pada blok ' + (kosong+1) + ' harus diisi', true); return; }
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
      }else if(action === 'tambah-bagian' && ['teks','gelap','krem'].indexOf(b.tipe) >= 0){
        aktifkanTeks(b);
        if(!Array.isArray(b.bagian)) b.bagian = [];
        b.bagian.push({judul:'', isi:''});
      }else if(action === 'hapus-bagian' && ['teks','gelap','krem'].indexOf(b.tipe) >= 0){
        const n = Number(el.getAttribute('data-bagian'));
        if(!Array.isArray(b.bagian) || !Number.isInteger(n) || !b.bagian[n]) return;
        if(!confirm('Hapus sub-bagian ini?')) return;
        aktifkanTeks(b);
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
