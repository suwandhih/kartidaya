const fs = require('node:fs'), vm = require('node:vm'), assert = require('node:assert/strict'), path = require('node:path');
const root=path.join(__dirname,'..'), handlers={}, elements={}, store={};
const noop=()=>{};
function el(){ return {value:'',files:[],innerHTML:'',textContent:'',hidden:false,isConnected:true,style:{},dataset:{},
  classList:{add:noop,remove:noop,toggle:noop,contains:()=>false}, addEventListener:noop,setAttribute:noop,
  querySelector:()=>el(),querySelectorAll:()=>[],focus:noop,remove:noop,appendChild:noop}; }
const document={getElementById:id=>(elements[id] ||= el()),querySelector:()=>el(),querySelectorAll:()=>[],
 addEventListener:(event,fn)=>(handlers[event] ||= []).push(fn),body:el(),documentElement:el(),createElement:()=>el(),hidden:false};
const storage={getItem:k=>store[k]??null,setItem:(k,v)=>store[k]=String(v),removeItem:k=>delete store[k]};
const requests=[];
const ctx={console,document,localStorage:storage,sessionStorage:storage,navigator:{},Blob,URL,
 window:{addEventListener:noop,scrollTo:noop,location:{href:'https://example.test/',origin:'https://example.test'},matchMedia:()=>({matches:false,addEventListener:noop})},
 Gmail:{restoreSession:noop,isConfigured:()=>false},WhatsApp:{endpoint:'https://worker.example',appKey:'',restoreSession:noop,api:async(p,o)=>{requests.push([p,o]);return {ok:true};}},
 Akun:{restore:()=>false,masuk:()=>false,admin:()=>false,alamatDaftar:()=>'',token:'test-session'},
 setTimeout:noop,setInterval:noop,clearTimeout:noop,clearInterval:noop,confirm:()=>true,fetch:async()=>{throw Error('offline');},
 FileReader:class{readAsDataURL(){this.result='data:image/png;base64,aW1hZ2U=';this.onload();}}};
vm.createContext(ctx);
for(const f of ['buletin-render.js','buletin.js']) vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),ctx);
vm.runInContext(fs.readFileSync(path.join(root,'app.js'),'utf8')+`\nglobalThis.api={state, Server, go, unggahMajalah, login:()=>{terkunciLogin=null;}, current:()=>currentPage};`,ctx);
const a=ctx.api;
function click(action,id){ const button={getAttribute:k=>k==='data-buletin-action'?action:k==='data-id'?id:null};
 handlers.click.forEach(fn=>fn({target:{closest:s=>s==='[data-buletin-action]'?button:null}})); }
async function main(){
 a.login(); a.state.settings.majalah={id:'lama',judul:'Edisi lama',halaman:2};
 a.state.settings.majalahDaftar=[{id:'lama',judul:'Edisi lama',halaman:2}];
 a.state.buletin=[{id:'b1',judul:'Uji',blok:[{tipe:'tautan',teks:'Baca di sini!'}]}];
 a.go('buletin'); click('editor','b1');
 assert.match(elements.view.innerHTML,/Unggah majalah PDF/);
 click('unggah-majalah'); assert.match(elements['modal-root'].innerHTML,/Berkas majalah/);
 assert.doesNotMatch(elements['modal-root'].innerHTML,/Belum bisa mengunggah/);
 document.getElementById('mj-judul').value='Majalah contoh'; document.getElementById('mj-file').files=[{name:'halaman.png',size:10}];
 await a.unggahMajalah();
 assert.equal(requests.length,1); assert.equal(requests[0][0],'/majalah');
 const uploaded=a.state.settings.majalah.id;
 assert.match(elements.view.innerHTML,new RegExp('value="'+uploaded+'" selected'));
 assert.match(elements.view.innerHTML,/Terhubung ke: Majalah contoh/);
 assert.ok(a.state.settings.majalahDaftar.some(x=>x.id==='lama'));
 assert.equal(a.state.buletin[0].majalahId,undefined);
 assert.match(elements.view.innerHTML,new RegExp('/baca/'+uploaded));
 click('simpan-blok'); assert.equal(a.state.buletin[0].majalahId,uploaded);
 assert.equal(a.current(),'buletin');
 console.log('uji-buletin-majalah: OK');
}
main().catch(e=>{console.error(e);process.exitCode=1});
