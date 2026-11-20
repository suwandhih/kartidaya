"use strict";

/* Format teks biasa yang dipakai perender buletin. */
const BuletinFormat = (function(){
  function ubah(teks, awal, akhir, aksi){
    teks = String(teks || '');
    awal = Math.max(0, Math.min(teks.length, awal));
    akhir = Math.max(awal, Math.min(teks.length, akhir));
    const tanda = {tebal:'**', miring:'*', stabilo:'=='}[aksi];
    if(aksi === 'bersihkan'){
      if(awal === akhir) return {nilai:teks, awal:awal, akhir:akhir};
      const bersih = teks.slice(awal,akhir).replace(/\*\*([^*\n]+)\*\*/g,'$1')
        .replace(/(^|[^*])\*([^*\n]+)\*/g,'$1$2').replace(/==([^=\n]+)==/g,'$1')
        .replace(/\[([^\]\n]+)\]\((?:\{\/MAJALAH\}|https:\/\/[^\s)]+)\)/g,'$1')
        .replace(/^[ \t]*(?:[-•]|\d+[.)])[ \t]+/gm,'');
      return {nilai:teks.slice(0,awal)+bersih+teks.slice(akhir),awal:awal,akhir:awal+bersih.length};
    }
    if(tanda){
      const bagian = teks.slice(awal, akhir);
      const panjang = tanda.length;
      if(awal >= panjang && teks.slice(awal - panjang, awal) === tanda && teks.slice(akhir, akhir + panjang) === tanda){
        return {nilai:teks.slice(0, awal-panjang) + bagian + teks.slice(akhir+panjang), awal:awal-panjang, akhir:akhir-panjang};
      }
      if(bagian && bagian.startsWith(tanda) && bagian.endsWith(tanda) && bagian.length >= panjang * 2){
        const bersih = bagian.slice(panjang, -panjang);
        return {nilai:teks.slice(0, awal) + bersih + teks.slice(akhir), awal:awal, akhir:awal+bersih.length};
      }
      const isi = bagian.split('\n').map(function(baris){ return baris ? tanda + baris + tanda : baris; }).join('\n');
      if(!bagian) return {nilai:teks.slice(0, awal)+tanda+tanda+teks.slice(akhir), awal:awal+panjang, akhir:awal+panjang};
      return {nilai:teks.slice(0, awal)+isi+teks.slice(akhir), awal:awal, akhir:awal+isi.length};
    }
    if(aksi === 'poin' || aksi === 'nomor'){
      const dari = teks.lastIndexOf('\n', awal-1) + 1;
      const batas = akhir > awal && teks[akhir-1] === '\n' ? akhir-1 : akhir;
      let sampai = teks.indexOf('\n', batas);
      if(sampai < 0) sampai = teks.length;
      let nomor = 0;
      const baris = teks.slice(dari,sampai).split('\n').map(function(s){
        const isi = s.replace(/^[ \t]*(?:[-•]|\d+[.)])[ \t]+/, '');
        if(!isi.trim() && awal !== akhir) return s;
        return (aksi === 'poin' ? '- ' : (++nomor) + '. ') + isi;
      }).join('\n');
      const nilai = teks.slice(0,dari) + baris + teks.slice(sampai);
      if(awal === akhir){
        const lama = teks.slice(dari,sampai);
        const prefixLama = (lama.match(/^[ \t]*(?:[-•]|\d+[.)])[ \t]+/) || [''])[0].length;
        const prefixBaru = (baris.match(/^(?:- |\d+\. )/) || [''])[0].length;
        const posisi = Math.min(dari+baris.length, dari+prefixBaru+Math.max(0,awal-dari-prefixLama));
        return {nilai:nilai, awal:posisi, akhir:posisi};
      }
      return {nilai:nilai, awal:dari, akhir:dari+baris.length};
    }
    return {nilai:teks, awal:awal, akhir:akhir};
  }
  function lanjut(teks, posisi){
    const awal = teks.lastIndexOf('\n',posisi-1)+1;
    let akhir = teks.indexOf('\n',posisi); if(akhir < 0) akhir=teks.length;
    const baris = teks.slice(awal,akhir);
    const cocok = baris.match(/^([ \t]*)(- |(\d+)\. )(.*)$/);
    if(!cocok || posisi < awal+cocok[1].length+cocok[2].length) return null;
    if(!cocok[4].trim()) return {nilai:teks.slice(0,awal)+teks.slice(akhir),awal:awal,akhir:awal};
    const awalan = cocok[1] + (cocok[3] ? (Number(cocok[3])+1)+'. ' : '- ');
    const nilai = teks.slice(0,posisi)+'\n'+awalan+teks.slice(posisi);
    const kursor = posisi+1+awalan.length;
    return {nilai:nilai,awal:kursor,akhir:kursor};
  }
  return {ubah:ubah, lanjut:lanjut};
})();
if(typeof module !== 'undefined' && module.exports) module.exports = BuletinFormat;
