// Same actual Chrome distribution harness, scoped artifact bytes only. No
// product seal or signature claimed; the production anchor remains null.
import {loadPinnedScopedCollectionBytes,loadProtectedScopedCollectionRustWasm,SCOPED_COLLECTION_METHODS}
 from '../../src/lib/ddv/core/save/product-scoped-collection-release.mjs';
import {RELEASE_TUPLES} from '../../src/lib/ddv/core/save/product-rust-wasm-release-trust.mjs';
const need=(v,k)=>{if(!v)throw Error('SCOPED_DIST_'+k)};
async function run(){
 const pins=await (await fetch('./fixtures/scoped-collection-pins.json')).json(),basePath=self.location.pathname.startsWith('/web/')?'/web':'';
 const tuple=RELEASE_TUPLES.find(t=>t.basePath===basePath),observed=[];let positive=0,negative=0;
 const deny=async f=>{try{await f()}catch{negative++;return}throw Error('SCOPED_DIST_FALSE_ACCEPT')};
 const make=(p=pins,fetcher=fetch)=>loadPinnedScopedCollectionBytes({basePath,trustedPins:p,releaseTuple:tuple,fetcher});
 const loaded=await make(pins,async(u,o)=>{observed.push({u,o});return fetch(u,o)});
 need(loaded.checkedBothJsAndWasm&&loaded.sameOriginFetchOnly&&loaded.sourceHead===pins.sourceHead&&!loaded.writerAuthorized&&!loaded.productConsumerEnabled,'RECEIPT');
 need(observed.length===3&&observed.every(({u,o})=>u.startsWith(self.location.origin+basePath+'/worker-wasm-scoped-collection/')&&o.cache==='no-store'&&o.redirect==='error'&&o.mode==='same-origin'),'ONE_FETCH');
 const p=loaded.WorkerWasmSource.prototype;
 need(SCOPED_COLLECTION_METHODS.every(n=>typeof p[n]==='function')&&typeof p.stage_scoped_amount==='undefined'&&typeof p.dev_stage_typed_amounts==='undefined','EXACT_ABI');positive++;
 const raw=new TextEncoder().encode(JSON.stringify({GameInfo:{Version:626},World:{},Player:{},Unknown:{future:true}}));
 const w=new loaded.WorkerWasmSource('steam-windows','steam-full-version','releases_1.25-v1.25.3-44-g0b41250d9ac0-incremental-22',626,true,crypto.getRandomValues(new Uint8Array(32)));
 try{w.append_chunk(raw);const r=JSON.parse(w.finish());need(r.schema===626&&!r.writerAuthorized&&r.fullDocumentJsonValidated,'REAL_OWNER');positive++}finally{w.close()}
 await deny(()=>loadProtectedScopedCollectionRustWasm());
 await deny(()=>loadProtectedScopedCollectionRustWasm({pins}));
 for(const n of ['manifest.json','ddv_save_core.js','ddv_save_core_bg.wasm'])await deny(()=>make(pins,async(u,o)=>{
  const r=await fetch(u,o);if(!u.endsWith(n))return r;const b=new Uint8Array(await r.arrayBuffer());b[b.length-1]^=1;
  return {ok:r.ok,status:r.status,redirected:r.redirected,url:r.url,type:r.type,headers:r.headers,arrayBuffer:async()=>b.buffer};
 }));
 await deny(()=>make({...pins,sourceHead:'f'.repeat(40)}));
 await deny(()=>loadPinnedScopedCollectionBytes({basePath:'/external',trustedPins:pins,releaseTuple:tuple}));
 await deny(()=>make(pins,async(u,o)=>{const r=await fetch(u,o);return u.endsWith('.js')?{ok:true,status:200,redirected:true,url:'https://unapproved.invalid/a.js',type:'cors',headers:r.headers,arrayBuffer:()=>r.arrayBuffer()}:r}));
 await deny(()=>make(pins,async(u,o)=>{const r=await fetch(u,o);return u.endsWith('.wasm')?{ok:true,status:200,redirected:false,url:u,type:'basic',headers:{get:()=> 'text/html'},arrayBuffer:()=>r.arrayBuffer()}:r}));
 return {result:'SCOPED_COLLECTION_SIGNED_RUNTIME_CANDIDATE_CHROME_PASS',sourceHead:pins.sourceHead,basePath,positive,negative,actualChrome:true,writerAuthorized:false,productEnabled:false};
}
self.onmessage=async({data})=>{if(data?.kind!=='SCOPED_COLLECTION_CANDIDATE_TEST')return;try{self.postMessage({ok:true,result:await run()})}catch(e){self.postMessage({ok:false,error:String(e?.stack||e).slice(0,850)})}};
