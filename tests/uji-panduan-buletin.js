const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const handlers={}; let modal=null;
const elements={'pd-isi':{innerHTML:'',scrollTop:0},'pd-index':{innerHTML:''},'pd-cari':{value:''}};
const ctx={document:{addEventListener:(name,fn)=>{handlers[name]=fn;},getElementById:id=>elements[id]||null,querySelector:()=>null},window:{},currentPage:'buletin',
  openModal:o=>{modal=o;},closeModal:()=>{},setTimeout:()=>{}};
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname,'..','panduan.js'),'utf8') + '\nglobalThis.test={pdBab,cariPanduan};',ctx);
const bab=ctx.test.pdBab('buletin');
for(const kata of ['+ Buat buletin','Susun blok','Simpan blok','Pilih atau unggah foto','Unggah majalah PDF','Tautan baca','Tambah tautan','Periksa pengiriman','Kirim sekarang']) assert.ok(bab.isi.includes(kata),kata);
for(const query of ['buletin','unggah majalah','buletin gagal']) assert.ok(ctx.test.cariPanduan(query).some(x=>x.id==='buletin'),query);
function click(id){const el={getAttribute:()=>id};handlers.click({preventDefault:()=>{},target:{closest:s=>s==='[data-panduan]'?el:null}});}
for(const [halaman,bab] of [['buletin','buletin'],['donor','data-donor'],['surat','tulis'],['keuangan','keuangan'],['beranda','mulai'],['tidak-ada','mulai'],['toString','mulai']]){
  ctx.currentPage=halaman; click('mulai');
  assert.match(modal.body, new RegExp('data-pd-pilih="' + bab + '"'));
  assert.ok(modal.body.includes('pd-item on" data-pd-pilih="'+bab+'"'), halaman);
}
ctx.currentPage='donor'; click('buletin'); assert.match(modal.body,/Membuat dan mengirim buletin/);
assert.ok(modal.body.includes('data-pd-pilih="tulis"') && modal.body.includes('data-pd-pilih="keuangan"'));
const pilih={getAttribute:()=> 'keuangan'};
handlers.click({preventDefault:()=>{},target:{closest:s=>s==='[data-pd-pilih]'?pilih:null}});
assert.match(elements['pd-isi'].innerHTML,/Mencatat keuangan/);
assert.match(elements['pd-index'].innerHTML,/data-pd-pilih="buletin"/);
console.log('uji-panduan-buletin: OK');
