"use strict";

/* BuletinRender(buletin, { bacaUrl, sampulUrl, workerBase, majalah }) -> { html, teks }.
   URL eksplisit didahulukan; workerBase + majalah.id dapat membentuk URL edisi.
   Gambar dengan pilihan sampul memakai edisi terpilih; kaki tanpa URL memakai URL baca.
   URL tidak aman diabaikan. Tidak membaca state, mengirim, atau mengubah data. */
const BuletinRender = (function(){
  function str(v){ return v == null ? '' : String(v); }
  function esc(v){
    return str(v).replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function urlAman(v){
    try {
      const raw = str(v).trim();
      if(!/^https:\/\//i.test(raw) || /[\u0000-\u0020\u007f\\]/.test(raw)) return '';
      const u = new URL(raw);
      return u.protocol === 'https:' && u.hostname && !u.username && !u.password ? u.href : '';
    }catch(e){ return ''; }
  }
  function inline(s){
    return esc(s).replace(/\*\*([^*\n]+)\*\*/g, '<b>$1</b>')
      .replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<i>$2</i>')
      .replace(/==([^=\n]+)==/g, '<span style="background-color:#fff3a3;color:#111111">$1</span>');
  }
  function polos(s){
    return str(s).replace(/\*\*([^*\n]+)\*\*/g, '$1')
      .replace(/(^|[^*])\*([^*\n]+)\*/g, '$1$2')
      .replace(/==([^=\n]+)==/g, '$1');
  }
  function sosialInline(s){
    let out = '', last = 0;
    const re = /https:\/\/[^\s<>"']+/gi;
    let match;
    while((match = re.exec(s))){
      let candidate = match[0];
      while(/[.,!?;:)]$/.test(candidate)) candidate = candidate.slice(0, -1);
      const url = urlAman(candidate);
      if(!url) continue;
      out += inline(s.slice(last, match.index)) + link(candidate, url, 'color:#ffbd8f;text-decoration:underline');
      last = match.index + candidate.length;
    }
    return out + inline(s.slice(last));
  }
  function format(s, social){
    const out = [];
    const sebaris = social ? sosialInline : inline;
    let mode = '';
    function tutup(){ if(mode){ out.push('</' + mode + '>'); mode = ''; } }
    str(s).split(/\r\n|\r|\n/).forEach(function(line){
      const bullet = line.match(/^\s*[-•]\s+(.*)$/);
      const number = line.match(/^\s*\d+[.)]\s+(.*)$/);
      if(bullet || number){
        const next = bullet ? 'ul' : 'ol';
        if(mode !== next){ tutup(); mode = next; out.push('<' + mode + ' style="margin:8px 0;padding-left:22px">'); }
        out.push('<li>' + sebaris((bullet || number)[1]) + '</li>');
      }else{ tutup(); out.push(sebaris(line) + '<br>'); }
    });
    tutup();
    return out.join('');
  }
  function row(content, style){
    return '<tr><td style="' + style + '">' + content + '</td></tr>';
  }
  function link(label, url, style){
    return url ? '<a href="' + esc(url) + '" style="' + style + '">' + esc(label) + '</a>' : esc(label);
  }
  const sosialDefault = {
    instagram:'https://www.instagram.com/kartidaya?igsh=ZDAxZ3FnemEwZG82',
    facebook:'https://www.facebook.com/share/19ErEsRwRL/',
    website:'https://kartidaya.org/'
  };
  const ikonBase = 'https://suwandhih.github.io/kartidaya/vendor/';
  function sosial(b){
    b = b || {};
    const lama = typeof b.sosial === 'string' ? b.sosial : '';
    const obj = b.sosial && typeof b.sosial === 'object' && !Array.isArray(b.sosial) ? b.sosial : {};
    const links = (lama.match(/https:\/\/[^\s<>"']+/gi) || []).map(function(u){ return u.replace(/[.,!?;:)]$/, ''); });
    const hasil = {};
    Object.keys(sosialDefault).forEach(function(k){
      const found = links.find(function(u){
        try{ const host = new URL(u).hostname.toLowerCase();
          return k === 'instagram' ? /(^|\.)instagram\.com$/.test(host) :
            k === 'facebook' ? /(^|\.)facebook\.com$/.test(host) : !/(^|\.)(instagram|facebook)\.com$/.test(host);
        }catch(e){ return false; }
      });
      hasil[k] = Object.prototype.hasOwnProperty.call(obj, k) ? str(obj[k]) : (found || sosialDefault[k]);
    });
    return hasil;
  }
  function render(buletin, opts){
    buletin = buletin && typeof buletin === 'object' ? buletin : {};
    opts = opts && typeof opts === 'object' ? opts : {};
    const base = urlAman(opts.workerBase);
    const id = str(opts.majalah && opts.majalah.id);
    let root = '';
    if(base && /^[A-Za-z0-9_-]{4,64}$/.test(id)){
      const parsed = new URL(base);
      if(!parsed.search && !parsed.hash) root = base.replace(/\/+$/, '');
    }
    const baca = urlAman(opts.bacaUrl == null ? (root ? root + '/baca/' + id : '') : opts.bacaUrl);
    const sampul = urlAman(opts.sampulUrl == null ? (root ? root + '/majalah/' + id + '/1' : '') : opts.sampulUrl);
    const html = [], teks = [];
    const blok = Array.isArray(buletin.blok) ? buletin.blok : [];
    blok.forEach(function(b){
      if(!b || typeof b !== 'object') return;
      let content = '', plain = [];
      if(b.tipe === 'gambar'){
        const judul = str(b.judul);
        const gambar = urlAman(b.sampul ? sampul : b.gambar);
        if(judul){ content += '<div style="font-size:24px;font-weight:bold;line-height:1.3;padding:12px;color:#ffffff;background-color:#272727">' + esc(judul) + '</div>'; plain.push(judul); }
        if(gambar){ content += '<img src="' + esc(gambar) + '" alt="' + esc(judul) + '" width="600" style="display:block;width:100%;max-width:600px;height:auto;border:0">'; plain.push('Gambar: ' + gambar); }
        if(content) html.push(row(content, 'padding:0;color:#222222'));
      }else if(b.tipe === 'teks'){
        if(str(b.isi)){ html.push(row(format(b.isi), 'padding:16px 24px;color:#222222')); plain.push(polos(b.isi)); }
      }else if(b.tipe === 'tautan'){
        const label = str(b.teks) || 'Baca di sini!';
        html.push(row(link(label, baca, 'color:#bc4b0b;font-weight:bold;text-decoration:underline'), 'padding:16px 24px;text-align:center'));
        plain.push(label + (baca ? ': ' + baca : ''));
      }else if(b.tipe === 'gelap'){
        if(b.judul){ content += '<div style="font-size:20px;font-weight:bold;color:#ff984f;padding-bottom:12px">' + esc(b.judul) + '</div>'; plain.push(str(b.judul)); }
        (Array.isArray(b.bagian) ? b.bagian : []).forEach(function(p){
          if(!p || typeof p !== 'object') return;
          if(p.judul){ content += '<div style="font-size:16px;font-weight:bold;padding:8px 0">' + esc(p.judul) + '</div>'; plain.push(str(p.judul)); }
          if(p.isi){ content += '<div>' + format(p.isi) + '</div>'; plain.push(polos(p.isi)); }
        });
        if(content) html.push(row(content, 'padding:24px;background-color:#272727;color:#ffffff'));
      }else if(b.tipe === 'krem'){
        if(b.judul){ content += '<div style="font-size:20px;font-weight:bold;padding-bottom:12px">' + esc(b.judul) + '</div>'; plain.push(str(b.judul)); }
        if(b.isi){ content += format(b.isi); plain.push(polos(b.isi)); }
        if(content) html.push(row(content, 'padding:24px;background-color:#f5ead6;color:#222222'));
      }else if(b.tipe === 'kaki'){
        const label = str(b.tombol);
        const target = urlAman(str(b.url).trim() ? b.url : baca);
        if(label){
          content += '<div style="padding-bottom:16px">' + link(label, target, 'display:inline-block;background-color:#dd641e;color:#ffffff;font-weight:bold;text-decoration:none;padding:12px 20px') + '</div>';
          plain.push(label + (target ? ': ' + target : ''));
        }
        const links = sosial(b);
        const nama = {instagram:'Instagram', facebook:'Facebook', website:'Website'};
        let ikon = '';
        Object.keys(nama).forEach(function(k){
          const url = urlAman(links[k]);
          if(!url) return;
          ikon += '<a href="' + esc(url) + '" style="display:inline-block;margin:0 7px;text-decoration:none">' +
            '<img src="' + ikonBase + 'buletin-' + k + '.png" width="32" height="32" alt="' + nama[k] + '" style="display:inline-block;border:0;width:32px;height:32px"></a>';
          plain.push(nama[k] + ': ' + url);
        });
        if(ikon) content += '<div style="padding-bottom:12px">' + ikon + '</div>';
        const teksLama = typeof b.sosial === 'string' ? b.sosial : b.sosialLama;
        if(teksLama && str(teksLama).trim()){
          content += '<div style="padding-bottom:12px">' + format(teksLama, true) + '</div>';
          plain.push(polos(teksLama));
        }
        if(b.hakcipta){ content += '<div style="font-size:12px">' + esc(b.hakcipta) + '</div>'; plain.push(str(b.hakcipta)); }
        if(content) html.push(row(content, 'padding:24px;text-align:center;background-color:#272727;color:#ffffff'));
      }
      if(plain.length) teks.push(plain.join('\n'));
    });
    return {
      html:'<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>' +
        '<body style="margin:0;padding:0;background-color:#eeeeee"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border-collapse:collapse;background-color:#eeeeee"><tr><td align="center">' +
        '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border-collapse:collapse;max-width:600px;background-color:#ffffff;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6">' +
        html.join('') + '</table></td></tr></table></body></html>',
      teks:teks.join('\n\n')
    };
  }
  render.sosial = sosial;
  render.urlAman = urlAman;
  return render;
})();

if(typeof module !== 'undefined' && module.exports) module.exports = BuletinRender;
