// 09 INT: shared signed Pages game-art batch technical gate. No keys, private media or Save bytes.
import {readFileSync, readdirSync, lstatSync, existsSync} from 'node:fs';
import {resolve, relative, join, sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
export const ROOT=fileURLToPath(new URL('../',import.meta.url));
export const BATCH=new URL('../ops/ddv-steam-public-media-signed-batch.json',import.meta.url);
export const VARIANT='steam-1.25.3-schema626-lossless160-v1';
const HEX=/^[0-9a-f]{64}$/;
const ID=/^[1-9][0-9]{0,15}$/;
const OWNER='OWNER_GO_FOR_DDV_GAME_IMAGES_20261105';
const exactly=(v,keys)=>v&&typeof v==='object'&&!Array.isArray(v)&&
  Object.keys(v).length===keys.length&&keys.every(k=>Object.prototype.hasOwnProperty.call(v,k));
export const digest=b=>createHash('sha256').update(b).digest('hex');
export function pathFor(sha){assert.match(sha,HEX);return 'ddv/item-images/'+VARIANT+'/'+sha.slice(0,2)+'/'+sha+'.webp';}
export function readBatch(){return validateBatch(JSON.parse(readFileSync(BATCH,'utf8')));}
export function validateBatch(raw){
  assert.ok(exactly(raw,['schema','ownerDecision','platform','variant','consumer','rightsHolderLicense','rollback','items','withdrawn']),'BATCH_SCHEMA');
  assert.equal(raw.schema,'wand.steam-public-media-signed-batch@1');
  assert.equal(raw.ownerDecision,OWNER);
  assert.equal(raw.platform,'Steam Windows');assert.equal(raw.variant,VARIANT);
  assert.equal(raw.consumer,'OFF');assert.equal(raw.rightsHolderLicense,'UNKNOWN');
  assert.equal(raw.rollback,'SCOPED_REMOVE_AND_HOSTED_404_OR_410');
  assert.ok(Array.isArray(raw.items)&&raw.items.length<=25,'BATCH_ITEM_BOUND');
  assert.ok(Array.isArray(raw.withdrawn)&&raw.withdrawn.length<=25,'BATCH_WITHDRAW_BOUND');
  const seen=new Set();
  for(const item of raw.items){
    assert.ok(exactly(item,['itemId','sha256','rgba160Sha256','bytes','width','height','visibility']),'BATCH_ITEM_FIELDS');
    assert.match(item.itemId,ID);assert.match(item.sha256,HEX);assert.match(item.rgba160Sha256,HEX);
    assert.equal(item.width,160);assert.equal(item.height,160);
    assert.ok(Number.isSafeInteger(item.bytes)&&item.bytes>0&&item.bytes<=200000,'BATCH_BYTES');
    assert.equal(item.visibility,'RELEASED_PLAYER_FACING');
    assert.ok(!seen.has(item.itemId)&&!seen.has(item.sha256),'BATCH_DUPLICATE');
    seen.add(item.itemId);seen.add(item.sha256);
  }
  for(const item of raw.withdrawn){
    assert.ok(exactly(item,['itemId','sha256']),'WITHDRAW_ITEM_FIELDS');
    assert.match(item.itemId,ID);assert.match(item.sha256,HEX);
    assert.ok(!seen.has(item.itemId)&&!seen.has(item.sha256),'WITHDRAW_DUPLICATE');
    seen.add(item.itemId);seen.add(item.sha256);
  }
  return raw;
}
function filesIn(root){
  if(!existsSync(root))return [];
  const all=[];const visit=(dir)=>{
    assert.equal(lstatSync(dir).isSymbolicLink(),false,'MEDIA_SYMLINK_PARENT');
    for(const d of readdirSync(dir,{withFileTypes:true})){
      const p=join(dir,d.name),st=lstatSync(p);
      assert.equal(st.isSymbolicLink(),false,'MEDIA_SYMLINK');
      if(st.isDirectory())visit(p);
      else {assert.ok(st.isFile(),'MEDIA_NON_FILE');all.push(p);}
    }
  };
  visit(root);return all;
}
export async function verifyLocal(raw,{kind='source',root=ROOT,pins}={}){
  const batch=validateBatch(raw);
  assert.ok(['source','built'].includes(kind),'MEDIA_MODE');
  const base=resolve(root,kind==='source'?'static':'build');
  const imageRoot=join(base,'ddv','item-images');
  const expected=batch.items.map(item=>pathFor(item.sha256)).sort();
  const actual=filesIn(imageRoot).map(p=>relative(base,p).split(sep).join('/')).sort();
  assert.deepEqual(actual,expected,'MEDIA_EXACT_BATCH_ONLY');
  if(!pins){
    const m=await import('../src/lib/item-media/switch1253-public-item-images.mjs');
    pins=m.STEAM1253_NATIVE_PINS;
    assert.equal(m.STEAM1253_REVIEWED_RELEASE.mediaPublic,false,'PUBLIC_CONSUMER_MUST_REMAIN_OFF');
    assert.deepEqual(Object.keys(m.STEAM1253_REVIEWED_RELEASE.items),[],'PUBLIC_ITEMS_MUST_REMAIN_OFF');
    assert.equal(m.STEAM1253_ITEM_IMAGE_VARIANT,VARIANT);
  }
  for(const item of batch.items){
    const pin=pins[item.itemId];
    assert.ok(pin,'MEDIA_NATIVE_ID_NOT_PINNED');
    for(const [a,b] of [['webpSha256','sha256'],['rgba160Sha256','rgba160Sha256'],['bytes','bytes'],['width','width'],['height','height']])
      assert.equal(pin[a],item[b],'MEDIA_NATIVE_PIN_'+a);
    assert.equal(pin.visibility,'RELEASED_PLAYER_FACING','MEDIA_NATIVE_VISIBILITY');
    const buf=readFileSync(join(base,pathFor(item.sha256)));
    assert.equal(buf.length,item.bytes,'MEDIA_REAL_LENGTH');
    assert.equal(buf.toString('ascii',0,4),'RIFF');assert.equal(buf.toString('ascii',8,12),'WEBP');
    assert.equal(buf.toString('ascii',12,16),'VP8L');
    assert.equal(digest(buf),item.sha256,'MEDIA_REAL_SHA256');
  }
  assert.ok(!existsSync(join(base,'ddv','item-images',VARIANT,'manifest.json')),'MEDIA_MANIFEST_MUST_REMAIN_OFF');
  return {count:batch.items.length,hashes:batch.items.map(x=>x.sha256)};
}
async function response(fetcher,url,method,extra={}){
  const res=await fetcher(url,{method,redirect:'manual',headers:extra,signal:AbortSignal.timeout(20000)});
  assert.ok(res.status<300&&res.status>=200,'MEDIA_PUBLIC_NOT_OK_'+res.status);
  assert.equal(res.status,200,'MEDIA_PUBLIC_NOT_200');
  assert.ok(/^image\/webp(?:\s*;|$)/i.test(res.headers.get('content-type')||''),'MEDIA_PUBLIC_WRONG_MIME');
  return res;
}
export async function verifyLive(raw,root,fetcher=fetch){
  const batch=validateBatch(raw);
  const url=new URL(root);
  assert.equal(url.protocol,'https:');assert.equal(url.host,'dreamwishwand.github.io');
  assert.equal(url.pathname,'/web/');assert.equal(url.search,'');assert.equal(url.hash,'');
  for(const item of batch.items){
    const target=new URL(pathFor(item.sha256),url).href;
    const get=await response(fetcher,target,'GET'),b=Buffer.from(await get.arrayBuffer());
    assert.equal(b.length,item.bytes,'LIVE_IMAGE_BYTES');
    assert.equal(digest(b),item.sha256,'LIVE_IMAGE_SHA256');
    const head=await response(fetcher,target,'HEAD');
    for(const h of [get,head])if(h.headers.has('content-length'))
      assert.equal(Number(h.headers.get('content-length')),item.bytes,'LIVE_LENGTH_HEADER');
  }
  for(const item of batch.withdrawn){
    const target=new URL(pathFor(item.sha256),url).href;
    for(const [method,headers] of [['GET',{}],['HEAD',{}],['GET',{'If-None-Match':'"stale"'}],['GET',{'If-Modified-Since':'Wed, 18 Nov 2026 00:00:00 GMT'}]]){
      const res=await fetcher(target,{method,redirect:'manual',headers,signal:AbortSignal.timeout(20000)});
      assert.ok([404,410].includes(res.status),'WITHDRAWAL_PUBLIC_CACHE_NOT_DENIED_'+res.status);
    }
  }
  return {publicItems:batch.items.length,withdrawn:batch.withdrawn.length};
}
const called=process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url);
if(called){
  const [mode]=process.argv.slice(2),batch=readBatch();
  if(mode==='count')process.stdout.write(String(batch.items.length)+'\n');
  else if(mode==='source'||mode==='built'){await verifyLocal(batch,{kind:mode});console.log('SIGNED_IMAGE_BATCH_EXACT_SOURCE_AND_PIXELS_PINNED '+mode+' '+batch.items.length);}
  else if(mode==='live'){
    assert.equal(process.env.WAND_DEPLOYED_BASE_URL?.replace(/\/?$/,'/'),process.env.WAND_EXPECTED_BASE_URL?.replace(/\/?$/,'/'),'LIVE_SOURCE_RELEASE_TUPLE');
    const proof=await verifyLive(batch,process.env.WAND_DEPLOYED_BASE_URL.replace(/\/?$/,'/'));
    console.log('SIGNED_IMAGE_BATCH_LIVE_HTTPS_GET_HEAD_SHA_MIME_PASS '+JSON.stringify(proof));
  }else throw Error('UNKNOWN_SIGNED_MEDIA_MODE');
}