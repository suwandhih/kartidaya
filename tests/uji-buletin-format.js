const assert = require('node:assert/strict');
const f = require('../buletin-format.js');
const render = require('../buletin-render.js');
function wrap(action, marker){
  const a=f.ubah('Halo dunia!',5,10,action);
  assert.equal(a.nilai,'Halo '+marker+'dunia'+marker+'!');
  assert.equal(f.ubah(a.nilai,a.awal,a.akhir,action).nilai,'Halo dunia!');
  const empty=f.ubah('Halo ',5,5,action);
  assert.equal(empty.nilai,'Halo '+marker+marker); assert.equal(empty.awal,5+marker.length);
}
wrap('tebal','**'); wrap('miring','*'); wrap('stabilo','==');
let a=f.ubah('satu\ndua\ntiga',0,8,'poin'); assert.equal(a.nilai,'- satu\n- dua\ntiga');
a=f.ubah('- satu\n- dua\ntiga',0,12,'nomor'); assert.equal(a.nilai,'1. satu\n2. dua\ntiga');
a=f.ubah('',0,0,'poin'); assert.equal(a.nilai,'- '); assert.equal(a.awal,2);
a=f.lanjut('- satu',6); assert.equal(a.nilai,'- satu\n- '); assert.equal(a.awal,9);
a=f.lanjut('1. satu',7); assert.equal(a.nilai,'1. satu\n2. ');
a=f.lanjut('1. satu\n2. ',11); assert.equal(a.nilai,'1. satu\n');
assert.equal(f.lanjut('teks biasa',4),null);
a=f.ubah('**tebal** dan *miring*',0,22,'bersihkan'); assert.equal(a.nilai,'tebal dan miring');
a=f.ubah('baris satu\nbaris dua',0,20,'tebal');
let html=render({blok:[{tipe:'teks',isi:a.nilai}]}).html;
assert.match(html,/<b>baris satu<\/b><br><b>baris dua<\/b>/);
console.log('uji-buletin-format: OK');
