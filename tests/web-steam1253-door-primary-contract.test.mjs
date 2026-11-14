import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {STEAM1253_FURNITURE146_PINS as batch} from '../src/lib/item-media/steam1253-furniture146-pins.mjs';
import {STEAM1253_HOLD10_PINS as held} from '../src/lib/item-media/steam1253-hold10-pins.mjs';
import {STEAM1253_OTHER36_PINS as other} from '../src/lib/item-media/steam1253-other36-pins.mjs';
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
 assert.deepEqual(Object.keys(pins).sort(),[...ids,'40000047','40006096',...Object.keys(batch),...Object.keys(other),...Object.keys(held)].sort());
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

test('ACT676 Steam512 exact two pins and no old Switch Tree fallback',async()=>{
 const mod=await import('../src/lib/item-media/switch1253-public-item-images.mjs');
 const ids=['40000047','40006096'],pins=mod.STEAM1253_NATIVE_PINS;
 const {release}=fixture(),m=mod.prepareSteam1253ItemImageManifest(ids);
 for(const k of ids){
  m.items[k].publicationDecision='OWNER_SCOPED_PUBLICATION_ACCEPTED';
  release.items[k]=Object.fromEntries(['originalNativeStreamSha256','sourcePngSha256','webpSha256','rightsStatus','publicationDecision','visibility'].map(key=>[key,m.items[k][key]]));
 }
 const {mediaPublic,items,...publication}=release;m.publication={gate:'MEDIA_PUBLIC_SCOPED_ON',...publication};
 assert.equal(pins[ids[0]].fallbackPolicy,'EXPLICIT_FALLBACK_ONLY');
 assert.equal(pins[ids[1]].fallbackPolicy,'NO_FALLBACK_SWITCH_VISUAL_QUARANTINED');
 for(const k of ['fallbackPlatform','fallbackBuildID','fallbackBundleSha256','fallbackNativeStreamSha256'])assert.equal(pins[ids[1]][k],null);
 assert.equal(pins[ids[0]].webpSha256,'30ab4e9c59d87e2796a56a2bdda2b87bfc03bb39364b3d2267d31db2804865e0');
 assert.equal(pins[ids[1]].webpSha256,'75292936edd3ed82fd97e69f7e8e09771ce4c9ec36d867c7703b066a95b1854c');
 const cat=validateSteam1253ItemImageCatalog(m,release);assert.equal(cat.count,2);
 for(const k of ids){
  const p=pins[k],url='/web/ddv/item-images/steam-1.25.3-schema626-lossless160-v1/'+p.webpSha256.slice(0,2)+'/'+p.webpSha256+'.webp';
  assert.equal(scopedSwitch1253ItemImageHref('/web',k,cat),url);
  for(const field of Object.keys(p)){
   const x=structuredClone(m);x.items[k][field]=p[field]===null?'FORGED':null;
   assert.throws(()=>validateSteam1253ItemImageCatalog(x,release));
  }
 }
 assert.equal(scopedSwitch1253ItemImageHref('/web','40002422',cat),null);
 assert.throws(()=>mod.prepareSteam1253ItemImageManifest(['40002422']));
 const legacy=mod.prepareSwitch1253ItemImageManifest(),legacyReview={...mod.SWITCH1253_REVIEWED_RELEASE,mediaPublic:true,rightsReview:'OPERATOR_ACCEPTED',receivingContact:'MANAGED_VERIFIED',takedown:'MANAGED_TESTED',managedHttps:'MANAGED_VERIFIED',attribution:'EIGHT_LOCALES_REVIEWED',oldUrlAndCache:'MANAGED_TESTED',rollback:'MANAGED_TESTED',operatorReceiptSha256:'b'.repeat(64),items:{}};
 // Model an old reviewed legacy manifest containing both historical rows.
 for(const k of ids){
  const p=mod.SWITCH1253_NATIVE_PINS[k];legacy.items[k]={...p,pixelStatus:'SWITCH_RGBA_EXACT_VERIFIED',visibility:'RELEASED_PLAYER_FACING',rightsStatus:'UNKNOWN',publicationDecision:'OWNER_SCOPED_PUBLICATION_ACCEPTED',assetStatus:'WEBP_LOSSLESS_VERIFIED_160'};
  legacyReview.items[k]=Object.fromEntries(['originalNativeStreamSha256','sourcePngSha256','webpSha256','rightsStatus','publicationDecision','visibility'].map(key=>[key,legacy.items[k][key]]));
 }
 const {mediaPublic:legacyOn,items:legacyItems,...legacyPub}=legacyReview;legacy.publication={gate:'MEDIA_PUBLIC_SCOPED_ON',...legacyPub};
 const old=mod.validateSwitch1253ItemImageCatalog(legacy,legacyReview);assert.equal(old.count,1);assert.ok(mod.scopedSwitch1253ItemImageHref('/web',ids[0],old));assert.equal(mod.scopedSwitch1253ItemImageHref('/web',ids[1],old),null);
 const mixed={...m,switch:legacy},c=validateSteam1253ItemImageCatalog(mixed,release,legacyReview);assert.equal(c.count,2);
 assert.equal(scopedSwitch1253ItemImageHref('/web',ids[1],c),scopedSwitch1253ItemImageHref('/web',ids[1],cat));
 assert.equal(scopedSwitch1253ItemImageHref('/web',ids[0],c),scopedSwitch1253ItemImageHref('/web',ids[0],cat));
 const withdrawn=structuredClone(mixed);delete withdrawn.items[ids[1]];
 const d=validateSteam1253ItemImageCatalog(withdrawn,release,legacyReview);assert.equal(d.count,1);assert.equal(scopedSwitch1253ItemImageHref('/web',ids[1],d),null);
 const x=structuredClone(m);x.items[ids[1]].fallbackPolicy='EXPLICIT_FALLBACK_ONLY';x.items[ids[1]].fallbackPlatform='Nintendo Switch';assert.throws(()=>validateSteam1253ItemImageCatalog(x,release));
 assert.equal(off.mediaPublic,false);assert.throws(()=>validateSteam1253ItemImageCatalog(m),/GATE_OFF/);
});

test('ACT688 exact146 immutable Steam-primary data, old fallback provenance, per-item scoped acceptance',async()=>{
 const mod=await import('../src/lib/item-media/switch1253-public-item-images.mjs');
 const ids=Object.keys(batch),pins=mod.STEAM1253_NATIVE_PINS;
 assert.equal(ids.length,146);assert.equal(Object.keys(pins).length,197);
 assert.equal(createHash('sha256').update(JSON.stringify(batch)).digest('hex'),'e7f07b97375ea087bbfec2965fa6b5b3cf6ac0d50ac222bce3804a36e447beb9');
 assert.ok(Object.isFrozen(batch));assert.equal(new Set(ids.map(k=>batch[k].iconGuid)).size,146);
 assert.equal(new Set(ids.map(k=>batch[k].webpSha256)).size,146);
 assert.equal(ids.reduce((n,k)=>n+batch[k].bytes,0),2731008);
 const deny=['40002422','40006077','40002400','40003299','40300001'];
 for(const k of ['40005967','40000441','40003257'])assert.equal(batch[k],undefined);
 for(const k of deny){assert.equal(pins[k],undefined);assert.throws(()=>mod.prepareSteam1253ItemImageManifest([k]));}
 const {release}=fixture(),m=mod.prepareSteam1253ItemImageManifest(ids);
 delete release.items[id];
 for(const k of ids){
  const p=batch[k];assert.equal(pins[k],p);assert.ok(Object.isFrozen(p));assert.equal(p.platform,'Steam Windows');assert.equal(p.fallbackPolicy,'EXPLICIT_FALLBACK_ONLY');
  assert.equal(m.items[k].publicationDecision,'NOT_RUN');m.items[k].publicationDecision='OWNER_SCOPED_PUBLICATION_ACCEPTED';
  release.items[k]=Object.fromEntries(['originalNativeStreamSha256','sourcePngSha256','webpSha256','rightsStatus','publicationDecision','visibility'].map(key=>[key,m.items[k][key]]));
 }
 const {mediaPublic,items,...publication}=release;m.publication={gate:'MEDIA_PUBLIC_SCOPED_ON',...publication};
 const c=validateSteam1253ItemImageCatalog(m,release);assert.equal(c.count,146);
 for(const k of ids){
  const p=batch[k];assert.equal(scopedSwitch1253ItemImageHref('/web',k,c),'/web/ddv/item-images/steam-1.25.3-schema626-lossless160-v1/'+p.webpSha256.slice(0,2)+'/'+p.webpSha256+'.webp');
  const bad={...m,items:{...m.items,[k]:{...m.items[k],webpSha256:'0'.repeat(64)}}};assert.throws(()=>validateSteam1253ItemImageCatalog(bad,release));
 }
 for(const k of deny)assert.equal(scopedSwitch1253ItemImageHref('/web',k,c),null);
 const removed=structuredClone(m);delete removed.items[ids[0]];
 const d=validateSteam1253ItemImageCatalog(removed,release);assert.equal(d.count,145);assert.equal(scopedSwitch1253ItemImageHref('/web',ids[0],d),null);assert.ok(scopedSwitch1253ItemImageHref('/web',ids[1],d));
 const one={...m,items:{[ids[0]]:m.items[ids[0]]}},oneCat=validateSteam1253ItemImageCatalog(one,release);assert.equal(oneCat.count,1);assert.ok(scopedSwitch1253ItemImageHref('/web',ids[0],oneCat));assert.equal(scopedSwitch1253ItemImageHref('/web',ids[1],oneCat),null);
 assert.throws(()=>validateSteam1253ItemImageCatalog(m),/GATE_OFF/);assert.equal(off.mediaPublic,false);
 const all=mod.prepareSteam1253ItemImageManifest(Object.keys(pins));assert.equal(Object.keys(all.items).length,197);assert.equal(all.publication.gate,'MEDIA_PUBLIC_PREPARED_OFF');
});

test('ACT689 exact36 visible Steam pins, 3 visible-only GUID aliases, no hidden peer mapping',async()=>{
 const mod=await import('../src/lib/item-media/switch1253-public-item-images.mjs');
 const ids=Object.keys(other),pins=mod.STEAM1253_NATIVE_PINS;
 assert.equal(ids.length,36);assert.equal(Object.keys(pins).length,197);
 assert.equal(createHash('sha256').update(JSON.stringify(other)).digest('hex'),'12a2baf1ea35bcd1862bd7c730e90817aaf9e023cb418253cc0b2dd7433a78f9');
 assert.equal(new Set(ids.map(k=>other[k].iconGuid)).size,36);assert.equal(new Set(ids.map(k=>other[k].webpSha256)).size,36);assert.equal(ids.reduce((n,k)=>n+other[k].bytes,0),684558);
 const pairs=[['40005967','40006077'],['40000441','40002400'],['40003257','40003299']];
 const {release}=fixture(),m=mod.prepareSteam1253ItemImageManifest(ids);delete release.items[id];
 for(const k of ids){
  assert.equal(batch[k],undefined);assert.equal(pins[k],other[k]);assert.ok(Object.isFrozen(pins[k]));m.items[k].publicationDecision='OWNER_SCOPED_PUBLICATION_ACCEPTED';
  release.items[k]=Object.fromEntries(['originalNativeStreamSha256','sourcePngSha256','webpSha256','rightsStatus','publicationDecision','visibility'].map(key=>[key,m.items[k][key]]));
 }
 const {mediaPublic,items,...publication}=release;m.publication={gate:'MEDIA_PUBLIC_SCOPED_ON',...publication};
 const c=validateSteam1253ItemImageCatalog(m,release);assert.equal(c.count,36);
 for(const k of ids){const p=other[k];assert.equal(scopedSwitch1253ItemImageHref('/web',k,c),'/web/ddv/item-images/steam-1.25.3-schema626-lossless160-v1/'+p.webpSha256.slice(0,2)+'/'+p.webpSha256+'.webp');const bad={...m,items:{...m.items,[k]:{...m.items[k],webpSha256:'0'.repeat(64)}}};assert.throws(()=>validateSteam1253ItemImageCatalog(bad,release));}
 for(const [visible,hidden] of pairs){
  assert.ok(other[visible]);assert.equal(pins[hidden],undefined);assert.equal(scopedSwitch1253ItemImageHref('/web',hidden,c),null);assert.equal(scopedSwitch1253ItemImageHref('/web',other[visible].iconGuid,c),null);
  assert.throws(()=>mod.prepareSteam1253ItemImageManifest([hidden]));
  const forged={...m,items:{...m.items,[hidden]:m.items[visible]}};const review={...release,items:{...release.items,[hidden]:release.items[visible]}};assert.throws(()=>validateSteam1253ItemImageCatalog(forged,review));
 }
 const one={...m,items:{[ids[0]]:m.items[ids[0]]}},single=validateSteam1253ItemImageCatalog(one,release);assert.equal(single.count,1);assert.equal(scopedSwitch1253ItemImageHref('/web',ids[1],single),null);
 assert.throws(()=>validateSteam1253ItemImageCatalog(m),/GATE_OFF/);assert.equal(off.mediaPublic,false);
});

test('ACT724 exact10 current Steam-only pins deny historical Switch fallback',async()=>{
 const mod=await import('../src/lib/item-media/switch1253-public-item-images.mjs');
 const ids=["40000074","40000162","40001327","40001755","40001771","40003776","40004576","40006509","40006540","40006573"],pins=mod.STEAM1253_NATIVE_PINS;
 assert.deepEqual(Object.keys(held),ids);assert.equal(Object.keys(pins).length,197);
 assert.equal(ids.reduce((n,k)=>n+held[k].bytes,0),229128);
 assert.equal(new Set(ids.map(k=>held[k].webpSha256)).size,10);
 const {release}=fixture(),m=mod.prepareSteam1253ItemImageManifest(ids);delete release.items[id];
 for(const k of ids){
  const p=held[k];assert.equal(pins[k],p);assert.ok(Object.isFrozen(p));assert.equal(p.platform,'Steam Windows');assert.equal(p.fallbackPolicy,'NO_FALLBACK_SWITCH_HISTORICAL_HOLD');
  for(const key of ['fallbackPlatform','fallbackBuildID','fallbackBundleSha256','fallbackNativeStreamSha256'])assert.equal(p[key],null);
  assert.equal(m.items[k].publicationDecision,'NOT_RUN');m.items[k].publicationDecision='OWNER_SCOPED_PUBLICATION_ACCEPTED';
  release.items[k]=Object.fromEntries(['originalNativeStreamSha256','sourcePngSha256','webpSha256','rightsStatus','publicationDecision','visibility'].map(key=>[key,m.items[k][key]]));
 }
 const {mediaPublic,items,...publication}=release;m.publication={gate:'MEDIA_PUBLIC_SCOPED_ON',...publication};
 const c=validateSteam1253ItemImageCatalog(m,release);assert.equal(c.count,10);
 for(const k of ids){
  const p=held[k];assert.equal(scopedSwitch1253ItemImageHref('/web',k,c),'/web/ddv/item-images/steam-1.25.3-schema626-lossless160-v1/'+p.webpSha256.slice(0,2)+'/'+p.webpSha256+'.webp');
  const bad={...m,items:{...m.items,[k]:{...m.items[k],fallbackPolicy:'EXPLICIT_FALLBACK_ONLY'}}};assert.throws(()=>validateSteam1253ItemImageCatalog(bad,release));
  const forged={...m,items:{...m.items,[k]:{...m.items[k],webpSha256:'0'.repeat(64)}}};assert.throws(()=>validateSteam1253ItemImageCatalog(forged,release));
  const withdrawn=structuredClone(m);delete withdrawn.items[k];const d=validateSteam1253ItemImageCatalog(withdrawn,release);assert.equal(d.count,9);assert.equal(scopedSwitch1253ItemImageHref('/web',k,d),null);
 }
 assert.throws(()=>validateSteam1253ItemImageCatalog(m),/GATE_OFF/);assert.equal(off.mediaPublic,false);
});
