const fs = require('fs'), vm = require('vm'), assert = require('assert'), path = require('path');
const handlers = {}, calls = [], revoked = [], elements = {};
let selected, confirmed = false, api = async () => ({foto:[],cursor:null}), canvasSize, alpha = 255, imageWidth = 2400, imageHeight = 1200;
function el(){ return {hidden:false, disabled:false, textContent:'', innerHTML:'', value:'', isConnected:true, removeAttribute(){}, matches(){return true;}}; }
const root = el(); root.contains = () => true;
root.querySelector = selector => elements[selector] || (elements[selector] = el()); root.querySelectorAll = () => [];
const document = {addEventListener:(n,f)=>{handlers[n]=f;}, createElement:()=>({width:0,height:0,getContext:()=>({drawImage(){},getImageData:()=>({data:new Uint8Array([0,0,0,alpha])})}),toBlob:function(cb,type){ canvasSize=[this.width,this.height]; cb(new Blob(['jpg'],{type})); }})};
class TestURL extends URL {}
TestURL.createObjectURL = () => 'blob:test'; TestURL.revokeObjectURL = u => revoked.push(u);
const ctx = {document, window:{}, URL:TestURL, navigator:{onLine:true}, Uint8Array, Blob, Image:class { set src(v){ this.naturalWidth=imageWidth; this.naturalHeight=imageHeight; this.onload(); } }, FileReader:class { readAsDataURL(){ this.result='data:image/jpeg;base64,anBn'; this.onload(); } }, MutationObserver:class { observe(){} disconnect(){} }, confirm:()=>confirmed, closeModal:()=>{root.isConnected=false;}, Server:{bisa:()=>true,panggil:async (p,o)=>{calls.push([p,o]); return api(p,o);}}, openModal:o=>{ root.isConnected=true; o.onOpen({querySelector:()=>root});}};
vm.createContext(ctx); vm.runInContext(fs.readFileSync(path.join(__dirname,'..','buletin-foto.js'),'utf8'),ctx);
function click(action,index){ const button={getAttribute:k=>k==='data-foto-action'?action:k==='data-index'?String(index):null}; handlers.click({target:{closest:()=>button}}); }
const tick=()=>new Promise(resolve=>setImmediate(resolve));
async function main(){
  api=async ()=>({foto:[{id:'abc',nama:'<img>',url:'https://example.org/foto/abc'},{id:'bad',url:'javascript:alert(1)'}],cursor:'next'});
  ctx.window.BuletinFoto.buka({onSelect:f=>selected=f}); await tick();
  assert.match(root.querySelector('[data-foto-galeri]').innerHTML,/&lt;img&gt;/); assert.doesNotMatch(root.querySelector('[data-foto-galeri]').innerHTML,/src="javascript:/);
  click('hapus',0); await tick(); assert.equal(calls.length,1);
  confirmed=true; api=async ()=>({ok:true}); click('hapus',0); await tick(); assert.equal(calls[1][0],'/buletin-foto/abc/hapus');
  api=async ()=>({foto:[{id:'1',url:'https://example.org/a'}],cursor:null}); ctx.window.BuletinFoto.buka({onSelect:f=>selected=f}); await tick(); click('pakai',0); assert.equal(selected.url,'https://example.org/a');
  ctx.navigator.onLine=false; ctx.window.BuletinFoto.buka({}); await tick(); assert.match(root.querySelector('[data-foto-pesan]').textContent,/koneksi internet/i);
  ctx.navigator.onLine=true; api=async (p,o)=>o ? {foto:{id:'new',url:'https://example.org/new'}} : {foto:[],cursor:null}; ctx.window.BuletinFoto.buka({}); await tick();
  const file={name:'foto.jpg',size:100,type:'image/jpeg',slice:()=>({arrayBuffer:async()=>Uint8Array.from([255,216,255]).buffer})};
  const input={files:[file],matches:()=>true,value:'x'}; handlers.change({target:input}); root.querySelector('input[name="bf-ukuran"]:checked').value='otomatis'; click('unggah'); await tick(); await tick();
  const req=calls.find(x=>x[1] && x[1].body); assert.ok(req); assert.equal(JSON.parse(req[1].body).tipe,'image/jpeg'); assert.deepEqual(canvasSize,[1200,600]); assert.ok(revoked.includes('blob:test')); assert.match(root.querySelector('[data-foto-pesan]').textContent,/berhasil/); assert.equal(root.isConnected,true); assert.match(root.querySelector('[data-foto-galeri]').innerHTML,/example.org\/new/);
  imageWidth=800; imageHeight=2400; selected=null;
  ctx.window.BuletinFoto.buka({onSelect:f=>selected=f}); await tick();
  handlers.change({target:{files:[file],matches:()=>true,value:'x'}}); root.querySelector('input[name="bf-ukuran"]:checked').value='otomatis'; click('unggah'); await tick(); await tick();
  assert.deepEqual(canvasSize,[400,1200]); assert.equal(selected.url,'https://example.org/new'); assert.equal(root.isConnected,false);
  ctx.window.BuletinFoto.buka({onSelect:()=>{throw Error('gagal menyimpan draf');}}); await tick();
  handlers.change({target:{files:[file],matches:()=>true,value:'x'}}); click('unggah'); await tick(); await tick();
  assert.equal(root.isConnected,true); assert.match(root.querySelector('[data-foto-pesan]').textContent,/sudah diunggah.*gagal menyimpan draf/); assert.match(root.querySelector('[data-foto-galeri]').innerHTML,/example.org\/new/);
  ctx.window.BuletinFoto.buka({}); await tick(); imageWidth=2400; imageHeight=1200;
  alpha=0;
  const png={name:'transparan.png',size:100,type:'image/png',slice:()=>({arrayBuffer:async()=>Uint8Array.from([137,80,78,71,13,10,26,10]).buffer})};
  handlers.change({target:{files:[png],matches:()=>true,value:'x'}}); root.querySelector('input[name="bf-ukuran"]:checked').value='asli'; click('unggah'); await tick(); await tick();
  const last=calls.filter(x=>x[1] && x[1].body).at(-1); assert.equal(JSON.parse(last[1].body).tipe,'image/png'); assert.deepEqual(canvasSize,[2400,1200]);
  const invalid={name:'not.jpg',size:10,type:'image/jpeg',slice:()=>({arrayBuffer:async()=>Uint8Array.from([1,2,3]).buffer})};
  handlers.change({target:{files:[invalid],matches:()=>true,value:'x'}}); const count=calls.length; click('unggah'); await tick(); await tick(); assert.equal(calls.length,count); assert.match(root.querySelector('[data-foto-pesan]').textContent,/Format tidak didukung/); assert.equal(root.querySelector('[data-foto-preview]').hidden,false);
  console.log('uji-buletin-foto-ui: OK');
}
main().catch(e=>{console.error(e);process.exitCode=1;});
