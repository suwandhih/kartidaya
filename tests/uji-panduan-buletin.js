const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const handlers={}; let modal=null;
const ctx={document:{addEventListener:(name,fn)=>{handlers[name]=fn;}},window:{},currentPage:'buletin',
  openModal:o=>{modal=o;},closeModal:()=>{},setTimeout:()=>{}};
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname,'..','panduan.js'),'utf8') + '\nglobalThis.test={pdBab,cariPanduan};',ctx);
const bab=ctx.test.pdBab('buletin');
for(const kata of ['+ Buat buletin','Susun blok','Simpan blok','Pilih atau unggah foto','Unggah majalah PDF','Tautan baca','Tambah tautan','Periksa pengiriman','Kirim sekarang']) assert.ok(bab.isi.includes(kata),kata);
for(const query of ['buletin','unggah majalah','buletin gagal']) assert.ok(ctx.test.cariPanduan(query).some(x=>x.id==='buletin'),query);
function click(id){const el={getAttribute:()=>id};handlers.click({preventDefault:()=>{},target:{closest:s=>s==='[data-panduan]'?el:null}});}
click('mulai');assert.match(modal.body,/Membuat dan mengirim buletin/);
ctx.currentPage='donor';click('mulai');assert.match(modal.body,/Mulai memakai aplikasi/);
click('buletin');assert.match(modal.body,/Membuat dan mengirim buletin/);
console.log('uji-panduan-buletin: OK');
