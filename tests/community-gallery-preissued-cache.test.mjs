import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {PNG_BYTES,STAGING_URL} from '../scripts/community-gallery-signed-acceptance.mjs';
import {validatePreissuedConfig,probePreissued} from '../scripts/community-gallery-preissued-cache-acceptance.mjs';

const sha=x=>createHash('sha256').update(x).digest('hex');
const actor='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const key=actor+'/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb.png';
const issued=new Date(Date.now()-500).toISOString();
const scoped=()=>({
 DREAMWISH_SUPABASE_URL:STAGING_URL,
 DREAMWISH_GALLERY_PREISSUED_APPROVAL:'APPROVED_PREISSUED_DISPOSABLE_URL_ONLY',
 DREAMWISH_GALLERY_PREISSUED_SIGNED_URL:STAGING_URL+'/storage/v1/object/sign/community-media-staging/'+key+'?token=FAKE_TEST_TOKEN_ONLY',
 DREAMWISH_GALLERY_PREISSUED_OWNER_SUBJECT_ID:actor,
 DREAMWISH_GALLERY_PREISSUED_STORAGE_KEY_SHA256:sha(key),
 DREAMWISH_GALLERY_PREISSUED_BYTES_SHA256:sha(PNG_BYTES),
 DREAMWISH_GALLERY_PREISSUED_BYTE_SIZE:String(PNG_BYTES.length),
 DREAMWISH_GALLERY_PREISSUED_ISSUED_AT:issued
});
test('pre-issued independent runner preflight has zero real network requests',()=>{
 const script=fileURLToPath(new URL('../scripts/community-gallery-preissued-cache-acceptance.mjs',import.meta.url));
 const p=spawnSync(process.execPath,[script,'--preflight'],{encoding:'utf8',env:{PATH:process.env.PATH}});
 assert.equal(p.status,0);assert.equal(JSON.parse(p.stdout).requests,0);
});
test('old URL demands exact staging disposable origin, owner and allowlisted key',()=>{
 const e=scoped();assert.doesNotThrow(()=>validatePreissuedConfig(e,Date.parse(issued)+500));
 assert.throws(()=>validatePreissuedConfig({...e,DREAMWISH_GALLERY_PREISSUED_APPROVAL:'false'}),/APPROVED/);
 assert.throws(()=>validatePreissuedConfig({...e,DREAMWISH_GALLERY_PREISSUED_SIGNED_URL:e.DREAMWISH_GALLERY_PREISSUED_SIGNED_URL.replace('ptpdoxhrqopvczpclcij','wrong-project')}),/STORAGE_SCOPE/);
 assert.throws(()=>validatePreissuedConfig({...e,DREAMWISH_GALLERY_PREISSUED_STORAGE_KEY_SHA256:'f'.repeat(64)}),/NOT_ALLOWLISTED/);
 assert.throws(()=>validatePreissuedConfig(e,Date.parse(issued)+20000),/T0_WINDOW_EXPIRED/);
});
test('timed 0/60/300/360 probe retains same approved URL and detects expiration',async()=>{
 const e=scoped();let now=Date.parse(issued)+500,calls=0,idx=0;
 const statuses=[200,200,200,403];
 const fetcher=async (url)=>{assert.equal(url,e.DREAMWISH_GALLERY_PREISSUED_SIGNED_URL);const s=statuses[calls++];idx=calls-1;return {
  status:s, headers:{get:()=>null},arrayBuffer:async()=>Uint8Array.from(PNG_BYTES).buffer
 };};
 const browser={newPage:async()=>({goto:async()=>({status:()=>statuses[idx]}),close:async()=>{}}),close:async()=>{}};
 const result=await probePreissued(e,{now:()=>now,sleep:async ms=>{now+=ms;},fetcher,browserLauncher:async()=>browser});
 assert.equal(result.outcome,'PASS_ONLY_BEARER_TIMING');
 assert.deepEqual(result.observations.map(v=>v.elapsedTargetSeconds),[0,60,300,360]);
 assert.deepEqual(result.observations.map(v=>v.storageHttpStatus),statuses);
 assert.equal(calls,4);
});
test('fail closed when an old URL is still accepted after 360 seconds',async()=>{
 const e=scoped();let now=Date.parse(issued)+100;
 const fetcher=async()=>({status:200,headers:{get:()=>null},arrayBuffer:async()=>Uint8Array.from(PNG_BYTES).buffer});
 const browser={newPage:async()=>({goto:async()=>({status:()=>200}),close:async()=>{}}),close:async()=>{}};
 const result=await probePreissued(e,{now:()=>now,sleep:async ms=>{now+=ms;},fetcher,browserLauncher:async()=>browser});
 assert.equal(result.outcome,'FAIL_OR_INCOMPLETE');
});
