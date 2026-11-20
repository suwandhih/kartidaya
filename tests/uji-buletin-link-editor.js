const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),path=require('node:path');
const root=path.join(__dirname,'..'),events={},els={}; const noop=()=>{};
function el(){return {innerHTML:'',value:'',hidden:false,style:{},dataset:{},classList:{add:noop,remove:noop,toggle:noop,contains:()=>false},addEventListener:noop,setAttribute:noop,querySelector:()=>el(),querySelectorAll:()=>[],focus:noop,setSelectionRange:noop,appendChild:noop};}
const document={getElementById:id=>(els[id] ||= el()),querySelector:()=>el(),querySelectorAll:()=>[],createElement:()=>el(),addEventListener:(e,fn)=>(events[e] ||= []).push(fn),body:el(),documentElement:el()};
const state={buletin:[{id:'uji',judul:'Uji',blok:[{tipe:'kaki',tombol:'Lama',url:'https://lama.example/',hakcipta:'© Uji'}]}],settings:{}};
const ctx={console,document,URL,state,currentPage:'buletin',terkunciLogin:null,terkunciServer:null,window:{addEventListener:noop},Server:{tertunda:{},hapus:{},simpanTertunda:noop,kirim:async()=>{},sibuk:0},esc:s=>String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'),setTitle:noop,toast:noop,confirm:()=>true,closeModal:noop,openModal:noop,save:noop,daftarMajalah:()=>[],majalahInfo:()=>null,workerBase:()=> 'https://worker.example',uid:()=> 'new',setTimeout:noop};
ctx.render=()=>{els.view ||= el();els.view.innerHTML=ctx.Buletin.view();}; vm.createContext(ctx);
for(const f of ['buletin-render.js','buletin-format.js','buletin.js']) vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),ctx);
vm.runInContext('globalThis.Buletin=Buletin',ctx);
function click(action,n){const b={getAttribute:k=>({'data-buletin-action':action,'data-id':action==='editor'?'uji':null,'data-index':'0','data-tautan':n}[k]??null)};events.click.forEach(fn=>fn({target:{closest:s=>s==='[data-buletin-action]'?b:null}}));}
function input(n,key,value){const e={value,type:'text',getAttribute:k=>({'data-buletin-field':key,'data-tautan':String(n)}[k]??null),closest:()=>({getAttribute:()=> '0'})};events.input.forEach(fn=>fn({target:e}));}
click('editor');assert.match(els.view.innerHTML,/Lama/);assert.match(els.view.innerHTML,/lama\.example/);
click('tambah-tautan-kaki');input(1,'teks','Berita');input(1,'tujuan','website');input(1,'url','https://contoh.example/');
click('tambah-tautan-kaki');assert.doesNotMatch(els.view.innerHTML,/\+ Tambah tautan/);
click('hapus-tautan-kaki','2');assert.match(els.view.innerHTML,/\+ Tambah tautan/);
click('simpan-blok');assert.equal(state.buletin[0].blok[0].tautan.length,2);assert.equal(state.buletin[0].blok[0].tautan[0].url,'https://lama.example/');assert.equal(state.buletin[0].blok[0].tautan[1].url,'https://contoh.example/');
console.log('uji-buletin-link-editor: OK');
