'use strict';

const assert = require('node:assert/strict');
const render = require('../buletin-render.js');
const output = block => render({blok:[block]});

// The original isi-only output is unchanged, including its plain-text representation.
const old = output({tipe:'teks', isi:'Halo **tebal**\n- *satu*\n- ==dua=='});
assert.ok(old.html.includes('<tr><td style="padding:16px 24px;color:#222222">Halo <b>tebal</b><br><ul style="margin:8px 0;padding-left:22px"><li><i>satu</i></li><li><span style="background-color:#fff3a3;color:#111111">dua</span></li></ul></td></tr>'));
assert.equal(old.teks, 'Halo tebal\n- satu\n- dua');
assert.deepEqual(output({tipe:'teks',isi:'x',judul:'',warna:'',bagian:[]}), output({tipe:'teks',isi:'x'}));

const block = output({tipe:'teks', judul:'Judul <utama>', isi:'Isi **tebal**', warna:'#123', bagian:[
  {judul:'Bagian & satu', isi:'*miring*\n1. pertama\n2. kedua'},
  {judul:'', isi:'==penting=='}, null, 'abaikan', {judul:'Akhir', isi:''}
]});
assert.match(block.html, /<td style="padding:16px 24px;background-color:#112233;color:#ffffff">/);
assert.match(block.html, /Judul &lt;utama&gt;<\/div>Isi <b>tebal<\/b><br>/);
assert.match(block.html, /Bagian &amp; satu<\/div><div><i>miring<\/i><br><ol style="margin:8px 0;padding-left:22px"><li>pertama<\/li><li>kedua<\/li><\/ol><\/div>/);
assert.match(block.html, /<span style="background-color:#fff3a3;color:#111111">penting<\/span>/);
assert.equal(block.teks, 'Judul <utama>\nIsi tebal\nBagian & satu\nmiring\n1. pertama\n2. kedua\npenting\nAkhir');
assert.equal(output({tipe:'teks',judul:'Hanya judul'}).teks, 'Hanya judul');
assert.equal(output({tipe:'teks',bagian:[{isi:'Hanya isi'}]}).teks, 'Hanya isi');
assert.equal(output({tipe:'teks',warna:'#000'}).teks, '');
assert.doesNotMatch(output({tipe:'teks',warna:'#000'}).html, /padding:16px 24px/);

function luminance(hex){
  const values = [1,3,5].map(i => parseInt(hex.slice(i, i+2), 16) / 255)
    .map(c => c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return values[0] * 0.2126 + values[1] * 0.7152 + values[2] * 0.0722;
}
for(const color of ['#000000','#ffffff','#ff0000','#00ff00','#0000ff','#777777','#808080','#ABCDEF','#ffff00','#00ffff','#ff00ff']){
  const html = output({tipe:'teks',isi:'Uji',warna:color}).html;
  const match = html.match(/padding:16px 24px;background-color:(#[0-9a-f]{6});color:(#[0-9a-f]{6})/);
  assert.ok(match, color);
  assert.equal(match[1], color.toLowerCase());
  const l = luminance(match[1]);
  const contrast = match[2] === '#000000' ? (l + 0.05) / 0.05 : 1.05 / (l + 0.05);
  assert.ok(contrast >= 4.5, color + ' ' + match[2] + ' ' + contrast);
}
for(const color of ['','red','#abcd','#12345678','#12','#xyzxyz','#123; color:red','#fff" onmouseover="x','url(javascript:alert(1))',null,{},123]){
  const html = output({tipe:'teks',isi:'Uji',warna:color}).html;
  assert.ok(html.includes('<td style="padding:16px 24px;color:#222222">Uji<br></td>'));
  assert.doesNotMatch(html, /onmouseover|javascript|color:red/);
}
assert.match(output({tipe:'teks',isi:'Uji',warna:' #ABC '}).html, /background-color:#aabbcc;color:#000000/);

const legacy = render({blok:[
  {tipe:'gelap',judul:'Gelap',isi:'diabaikan',bagian:[{judul:'Sub',isi:'**isi**'}]},
  {tipe:'krem',judul:'Krem',isi:'*isi*',bagian:[{judul:'diabaikan'}]}
]});
assert.ok(legacy.html.includes('<tr><td style="padding:24px;background-color:#272727;color:#ffffff"><div style="font-size:20px;font-weight:bold;color:#ff984f;padding-bottom:12px">Gelap</div><div style="font-size:16px;font-weight:bold;padding:8px 0">Sub</div><div><b>isi</b><br></div></td></tr>'));
assert.ok(legacy.html.includes('<tr><td style="padding:24px;background-color:#f5ead6;color:#222222"><div style="font-size:20px;font-weight:bold;padding-bottom:12px">Krem</div><i>isi</i><br></td></tr>'));
assert.equal(legacy.teks, 'Gelap\nSub\nisi\n\nKrem\nisi');
console.log('uji-buletin-teks-render: OK');
