'use strict';

const assert = require('node:assert/strict');
const render = require('../buletin-render.js');
const baca = 'https://example.test/baca/edisi?x=1&y=2';
const block = {tipe:'teks', isi:'Baca [**Majalah**]({/MAJALAH}) dan [situs & <info>](https://example.test/a_(b)?x=1&y=2)',
  bagian:[{judul:'Sub', isi:'- [Halaman](https://example.test/a\u0028b\u0029)\n- [Edisi]({/MAJALAH})'}]};
const result = render({blok:[block]}, {bacaUrl:baca});
assert.ok(result.html.includes('<a href="https://example.test/baca/edisi?x=1&amp;y=2" style="color:#bc4b0b;text-decoration:underline"><b>Majalah</b></a>'));
assert.ok(result.html.includes('<a href="https://example.test/a_(b)?x=1&amp;y=2" style="color:#bc4b0b;text-decoration:underline">situs &amp; &lt;info&gt;</a>'));
assert.ok(result.html.includes('<li><a href="https://example.test/a(b)"'));
assert.equal(result.teks, 'Baca Majalah (' + baca + ') dan situs & <info> (https://example.test/a_(b)?x=1&y=2)\nSub\n- Halaman (https://example.test/a(b))\n- Edisi (' + baca + ')');

const unsafe = render({blok:[{tipe:'teks',isi:'[evil](javascript:alert(1)) [quote](https://example.test/" onmouseover="bad) [bad](http://example.test/) [broken](https://example.test/(x) [missing]({/MAJALAH})'}]}, {bacaUrl:'javascript:bad'});
assert.doesNotMatch(unsafe.html, /<a\s/i);
assert.ok(unsafe.html.includes('[evil](javascript:alert(1))'));
assert.ok(unsafe.html.includes('onmouseover=&quot;bad'));
assert.ok(unsafe.teks.endsWith('missing'));
const escaped = render({blok:[{tipe:'teks',isi:'[label\\]](https://example.test/a\\(b\\))'}]});
assert.ok(escaped.html.includes('href="https://example.test/a(b)"'));
assert.ok(escaped.teks.includes('label] (https://example.test/a(b))'));
const dark = render({blok:[{tipe:'teks',warna:'#111111',isi:'[Baca]({/MAJALAH})'}]}, {bacaUrl:baca});
assert.match(dark.html, /color:#ffffff;text-decoration:underline/);
const derived = render({blok:[{tipe:'teks',isi:'[edisi]({/MAJALAH})'}]}, {workerBase:'https://example.test',majalah:{id:'edisi123'}});
assert.ok(derived.teks.includes('edisi (https://example.test/baca/edisi123)'));

const footer = render({blok:[{tipe:'kaki',tombol:'Lama',url:'https://legacy.test/',tautan:[
  {teks:'Majalah & edisi',tujuan:'majalah',url:'https://ignored.test/'},
  {teks:'Situs <resmi>',tujuan:'website',url:'https://example.test/?a=1&b=2'},
  {teks:'Tidak aman',tujuan:'website',url:'javascript:alert(1)'},
  {teks:'Keempat',tujuan:'website',url:'https://fourth.test/'}
], hakcipta:'Hak cipta'}]}, {bacaUrl:baca});
assert.ok(footer.html.includes('<div style="padding-bottom:8px"><a href="https://example.test/baca/edisi?x=1&amp;y=2" style="color:#ff984f;text-decoration:underline">Majalah &amp; edisi</a></div>'));
assert.ok(footer.html.includes('<a href="https://example.test/?a=1&amp;b=2" style="color:#ff984f;text-decoration:underline">Situs &lt;resmi&gt;</a>'));
assert.ok(footer.html.includes('<div style="padding-bottom:8px">Tidak aman</div>'));
assert.doesNotMatch(footer.html, /Keempat|Lama|ignored\.test|javascript:|background-color:#dd641e/);
assert.ok(footer.html.includes('buletin-instagram.png'));
assert.ok(footer.html.includes('Hak cipta'));
assert.ok(footer.teks.includes('Majalah & edisi: ' + baca));
assert.ok(footer.teks.includes('Situs <resmi>: https://example.test/?a=1&b=2'));
assert.ok(footer.teks.includes('Tidak aman'));
const legacy = render({blok:[{tipe:'kaki',tombol:'Baca',url:'https://legacy.test/'}]}, {bacaUrl:baca});
assert.ok(legacy.html.includes('<a href="https://legacy.test/" style="display:inline-block;background-color:#dd641e;color:#ffffff;font-weight:bold;text-decoration:none;padding:12px 20px">Baca</a>'));
assert.ok(legacy.teks.includes('Baca: https://legacy.test/'));
assert.doesNotMatch(render({blok:[{tipe:'kaki',tombol:'Lama',tautan:[]}]}).html, /Lama/);
console.log('uji-buletin-link-render: OK');
