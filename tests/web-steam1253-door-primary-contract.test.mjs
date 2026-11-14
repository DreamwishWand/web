import test from 'node:test';
import assert from 'node:assert/strict';
import {STEAM1253_DOOR_PIN as pin,STEAM1253_DOOR_ID as id,STEAM1253_REVIEWED_RELEASE as off,
 STEAM1253_MANIFEST_PATH,prepareSteam1253ItemImageManifest,validateSteam1253ItemImageCatalog,
 scopedSwitch1253ItemImageHref,createSteam1253ManifestController,SWITCH1253_REVIEWED_RELEASE} from '../src/lib/item-media/switch1253-public-item-images.mjs';
function fixture(){
 const m=prepareSteam1253ItemImageManifest();
 const release={...off,mediaPublic:true,rightsReview:'OPERATOR_ACCEPTED',receivingContact:'MANAGED_VERIFIED',
  takedown:'MANAGED_TESTED',managedHttps:'MANAGED_VERIFIED',attribution:'EIGHT_LOCALES_REVIEWED',
  oldUrlAndCache:'MANAGED_TESTED',rollback:'MANAGED_TESTED',operatorReceiptSha256:'b'.repeat(64),items:{}};
 m.items[id].publicationDecision='OWNER_SCOPED_PUBLICATION_ACCEPTED';
 release.items[id]=Object.fromEntries(['originalNativeStreamSha256','sourcePngSha256','webpSha256','rightsStatus','publicationDecision','visibility'].map(k=>[k,m.items[id][k]]));
 const {mediaPublic,items,...publication}=release;m.publication={gate:'MEDIA_PUBLIC_SCOPED_ON',...publication};return {m,release};
}
test('exact Steam Door primary provenance, immutable shared path, OFF and hidden negatives',async()=>{
 const {m,release}=fixture();assert.equal(off.mediaPublic,false);
 assert.throws(()=>validateSteam1253ItemImageCatalog(m),/GATE_OFF/);
 const cat=validateSteam1253ItemImageCatalog(m,release);
 assert.equal(cat.count,1);
 const href='/web/ddv/item-images/steam-1.25.3-schema626-lossless160-v1/be/'+pin.webpSha256+'.webp';
 assert.equal(scopedSwitch1253ItemImageHref('/web',id,cat),href);
 for(const bad of ['40300001','40002422','00040300045','40000047','__proto__'])assert.equal(scopedSwitch1253ItemImageHref('/web',bad,cat),null);
 assert.equal(scopedSwitch1253ItemImageHref('/../',id,cat),null);
 assert.equal(scopedSwitch1253ItemImageHref('/web',id,structuredClone(cat)),null);
 for(const k of Object.keys(pin)){const x=structuredClone(m);x.items[id][k]=null;assert.throws(()=>validateSteam1253ItemImageCatalog(x,release));}
 for(const k of ['40300001','40000047']){const x=structuredClone(m);x.items[k]=x.items[id];assert.throws(()=>validateSteam1253ItemImageCatalog(x,release));}
 const x=structuredClone(m);x.items[id].url='https://bad.invalid';assert.throws(()=>validateSteam1253ItemImageCatalog(x,release));
 assert.throws(()=>validateSteam1253ItemImageCatalog({...m,switch:{}},release));
 const states=[],ctl=createSteam1253ManifestController(off,SWITCH1253_REVIEWED_RELEASE,v=>states.push(v));
 assert.equal(await ctl.load('/web',()=>{throw Error('OFF fetch');}),null);
});
test('one neutral no-store manifest, withdrawal clears, refresh never uses Switch fallback fetch',async()=>{
 const {m,release}=fixture(),states=[],calls=[];
 let raw=m;const c=createSteam1253ManifestController(release,SWITCH1253_REVIEWED_RELEASE,v=>states.push(v));
 const fetcher=async(url,init)=>{calls.push([url,init.cache,init.credentials,init.redirect]);return new Response(JSON.stringify(raw),{headers:{'content-type':'application/json'}});};
 assert.equal((await c.load('/web',fetcher)).count,1);
 assert.deepEqual(calls,[['/web/'+STEAM1253_MANIFEST_PATH,'no-store','omit','error']]);
 raw={...m,items:{}};
 const p=c.load('/web',fetcher,true);assert.equal(states.at(-1).catalog,null);
 assert.equal((await p).count,0);assert.equal(scopedSwitch1253ItemImageHref('/web',id,states.at(-1).catalog),null);c.clear();
});

test('ACT648 exact2 shared Steam pins and one combined manifest; no hidden or cross-pin fallback',async()=>{
 const mod=await import('../src/lib/item-media/switch1253-public-item-images.mjs');
 const ids=[id,'40006110','40005160'],pins=mod.STEAM1253_NATIVE_PINS;
 assert.deepEqual(Object.keys(pins).sort(),[...ids].sort());
 assert.deepEqual(pins[id],pin);assert.equal(off.mediaPublic,false);
 assert.deepEqual(Object.keys(mod.prepareSteam1253ItemImageManifest().items),[id]);
 const {release}=fixture(),m=mod.prepareSteam1253ItemImageManifest(ids);
 for(const k of ids){
  m.items[k].publicationDecision='OWNER_SCOPED_PUBLICATION_ACCEPTED';
  release.items[k]=Object.fromEntries(['originalNativeStreamSha256','sourcePngSha256','webpSha256','rightsStatus','publicationDecision','visibility'].map(key=>[key,m.items[k][key]]));
 }
 const {mediaPublic,items,...publication}=release;m.publication={gate:'MEDIA_PUBLIC_SCOPED_ON',...publication};
 const cat=validateSteam1253ItemImageCatalog(m,release);assert.equal(cat.count,3);
 for(const k of ids){
  const p=pins[k],url='/web/ddv/item-images/steam-1.25.3-schema626-lossless160-v1/'+p.webpSha256.slice(0,2)+'/'+p.webpSha256+'.webp';
  assert.equal(scopedSwitch1253ItemImageHref('/web',k,cat),url);
  assert.equal(p.platform,'Steam Windows');assert.equal(p.fallbackPolicy,'EXPLICIT_FALLBACK_ONLY');
  for(const field of Object.keys(p)){
   const x=structuredClone(m);x.items[k][field]=null;
   assert.throws(()=>validateSteam1253ItemImageCatalog(x,release));
  }
 }
 const paths=ids.map(k=>scopedSwitch1253ItemImageHref('/web',k,cat));assert.equal(new Set(paths).size,3);
 for(const bad of ['40003299','40300001','40002422','00040005160','__proto__','constructor','0280873a7ea805d4199a49df193f1c0d'])assert.equal(scopedSwitch1253ItemImageHref('/web',bad,cat),null);
 const x=structuredClone(m);x.items['40006110']=x.items['40005160'];assert.throws(()=>validateSteam1253ItemImageCatalog(x,release));
 const y=structuredClone(m);delete y.items['40006110'];const withdrawn=validateSteam1253ItemImageCatalog(y,release);
 assert.equal(withdrawn.count,2);assert.equal(scopedSwitch1253ItemImageHref('/web','40006110',withdrawn),null);
 assert.equal(scopedSwitch1253ItemImageHref('/web','40005160',withdrawn),paths[2]);
 for(const invalid of [[],[id,id],['40003299'],[40006110],null])assert.throws(()=>mod.prepareSteam1253ItemImageManifest(invalid));
 const pair=mod.prepareSteam1253ItemImageManifest(['40006110','40005160']);assert.deepEqual(Object.keys(pair.items).sort(),['40005160','40006110']);
 assert.throws(()=>validateSteam1253ItemImageCatalog(m),/GATE_OFF/);
});
