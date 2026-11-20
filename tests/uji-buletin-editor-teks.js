const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),path=require('node:path');
const root=path.join(__dirname,'..'),events={},elements={}; const noop=()=>{};
function el(){return {innerHTML:'',value:'',hidden:false,style:{},dataset:{},classList:{add:noop,remove:noop,toggle:noop,contains:()=>false},addEventListener:noop,setAttribute:noop,querySelector:()=>el(),querySelectorAll:()=>[],focus:noop,setSelectionRange:noop,appendChild:noop};}
const document={getElementById:id=>(elements[id] ||= el()),querySelector:()=>el(),querySelectorAll:()=>[],createElement:()=>el(),addEventListener:(e,fn)=>(events[e] ||= []).push(fn),body:el(),documentElement:el()};
const state={buletin:[{id:'uji',judul:'Uji',blok:[{tipe:'gelap',judul:'Judul lama',bagian:[{judul:'Barat',isi:'Cerita'}]},{tipe:'krem',judul:'Krem',isi:'Teks lama'},{tipe:'kaki',tombol:'Baca',hakcipta:''}]}],settings:{}};
let currentPage='buletin',terkunciLogin=null,terkunciServer=null,alert='',saved=0;
const ctx={console,document,URL,state,currentPage,terkunciLogin,terkunciServer,window:{addEventListener:noop},
 Server:{tertunda:{},hapus:{},simpanTertunda:noop,kirim:async()=>{},sibuk:0},
 esc:s=>String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'),
 setTitle:noop,toast:t=>{alert=t},confirm:()=>true,closeModal:noop,openModal:noop,save:()=>{saved++},
 daftarMajalah:()=>[],majalahInfo:()=>null,workerBase:()=> 'https://worker.example',uid:()=> 'new',setTimeout:noop};
ctx.render=()=>{elements.view ||= el();elements.view.innerHTML=ctx.Buletin.view();};
vm.createContext(ctx);
for(const f of ['buletin-render.js','buletin-format.js','buletin.js']) vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),ctx);
vm.runInContext('globalThis.Buletin=Buletin',ctx);
function click(action,index,part){const button={getAttribute:k=>({'data-buletin-action':action,'data-id':action==='editor'?'uji':null,'data-index':index,'data-bagian':part,'data-format':action==='format-teks'?'tebal':null}[k]??null)}; events.click.forEach(fn=>fn({target:{closest:s=>s==='[data-buletin-action]'?button:null}}));}
function input(index,key,value,part){const target={value,type:'text',getAttribute:k=>k==='data-buletin-field'?key:k==='data-bagian'?(part??null):null,closest:()=>({getAttribute:()=>String(index)})};events.input.forEach(fn=>fn({target}));}
click('editor');
assert.match(elements.view.innerHTML,/Judul lama/); assert.match(elements.view.innerHTML,/Sub-bagian 1/);
assert.match(elements.view.innerHTML,/© 2026 Kartidaya Sahabat Indonesia/);
assert.doesNotMatch(elements.view.innerHTML,/<option value="gelap"/);
input(0,'warna','#123456'); input(0,'isi','Isi tambahan'); input(0,'isi','Baru','0');
const sub=document.getElementById('buletin-teks-0-0'); sub.value='Baru'; sub.selectionStart=0; sub.selectionEnd=4; sub.getAttribute=k=>k==='data-bagian'?'0':null;
click('format-teks','0','0');
click('tambah-bagian','1'); input(1,'judul','Timur','0'); input(1,'isi','Kabar','0');
input(2,'hakcipta','  '); click('simpan-blok'); assert.match(alert,/hak cipta/i); assert.equal(saved,0);
input(2,'hakcipta','© Contoh'); click('simpan-blok'); assert.equal(saved,1);
assert.equal(state.buletin[0].blok[0].tipe,'teks'); assert.equal(state.buletin[0].blok[0].warna,'#123456');
assert.equal(state.buletin[0].blok[0].judul,'Judul lama'); assert.equal(state.buletin[0].blok[0].bagian[0].isi,'**Baru**');
assert.equal(state.buletin[0].blok[0].isi,'Isi tambahan');
assert.equal(state.buletin[0].blok[1].warna,'#f5ead6'); assert.equal(state.buletin[0].blok[1].isi,'Teks lama');
assert.equal(state.buletin[0].blok[1].bagian[0].judul,'Timur'); assert.equal(state.buletin[0].blok[2].hakcipta,'© Contoh');
console.log('uji-buletin-editor-teks: OK');
