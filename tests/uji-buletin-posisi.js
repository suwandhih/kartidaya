const assert = require('node:assert/strict');
const render = require('../buletin-render.js');
const url = 'https://example.test/baca/edisi';
for(const [posisi,css] of [[undefined,'left'],['kiri','left'],['tengah','center'],['kanan','right'],['invalid','left'],['toString','left']]){
  const hasil=render({blok:[{tipe:'tautan',teks:'Baca di sini!',posisi}]},{bacaUrl:url});
  assert.match(hasil.html,new RegExp('text-align:'+css));
  assert.match(hasil.html,/href="https:\/\/example.test\/baca\/edisi"/);
  assert.equal(hasil.teks,'Baca di sini!: '+url);
  assert.match(render.pratinjau(hasil.html),new RegExp('text-align:'+css));
}
console.log('uji-buletin-posisi: OK');
