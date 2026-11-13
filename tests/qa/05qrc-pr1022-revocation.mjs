// Independent actual Node module Worker + generated Rust WASM + existing encrypted Codec.
import assert from 'node:assert/strict';
import {Worker,isMainThread,parentPort} from 'node:worker_threads';
import {readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import init,{WorkerWasmSource} from '../stage-e/pkg/ddv_save_core.js';
import {createLocalSteamP1gSavedDiffGridsFacade as create} from '../../src/lib/ddv/core/save/local-steam-p1g-saved-diffgrids-facade.mjs';
import {validateOwnerLocalSteamAttestation,OWNER_LOCAL_V1_ATTESTATION_CONTRACT,OWNER_LOCAL_STEAM_FULL_VERSION} from '../../tools/owner-local-steam-v1/attestation.mjs';
if(isMainThread){
 const w=new Worker(new URL(import.meta.url));
 const timeout=setTimeout(()=>{w.terminate();process.exitCode=1;console.error('QA1022_WORKER_DEADLINE')},30000);
 w.on('message',r=>{assert.deepEqual(r,{groups:5,realWasm:true,privateData:false});console.log('QA1022_ACTUAL_WORKER_5_GROUPS_PASS');});
 w.on('error',e=>{clearTimeout(timeout);console.error(e);process.exitCode=1;});
 w.on('exit',n=>{clearTimeout(timeout);if(n!==0)process.exitCode=1;});
}else{
 await init({module_or_path:await readFile(new URL('../stage-e/pkg/ddv_save_core_bg.wasm',import.meta.url))});
 const raw=await readFile(new URL('../stage-f/fixtures/synthetic626-diffgrids.p1g',import.meta.url));
 const expected=JSON.parse(await readFile(new URL('../stage-f/fixtures/expected-diffgrids.json',import.meta.url),'utf8'));
 const sha=createHash('sha256').update(raw).digest('hex');assert.equal(sha,expected.originalSha256);
 const blob=new Blob([raw]);
 const attestation={contract:OWNER_LOCAL_V1_ATTESTATION_CONTRACT,platform:'steam-windows',buildKind:'steam-full-version',fullVersion:OWNER_LOCAL_STEAM_FULL_VERSION,schema:626,originalSha256:sha,evidenceKind:'ci-synthetic-fixture',observedOutsideSave:false};
 const open=(requestId,extra={})=>({kind:'OPEN_LOCAL_STORED_DIFFGRIDS',requestId,file:blob,attestation,expectedEncryptedSizeBytes:blob.size,...extra});
 const cancel=(openRequestId,requestId=9001,extra={})=>({kind:'CLOSE_LOCAL_STORED_DIFFGRIDS',requestId,selection:null,openRequestId,...extra});
 const read=(selection,pageIndex=0,requestId=9002)=>({kind:'READ_LOCAL_STORED_DIFFGRIDS_NEXT',requestId,selection,pageIndex});
 const selected=(selection)=>({kind:'CLOSE_LOCAL_STORED_DIFFGRIDS',requestId:9003,selection});
 const call=async(f,m)=>{const out=[];await f.handleMessage(m,r=>out.push(r));assert.equal(out.length,1);assert.equal(out[0].requestId,m.requestId);const r=out[0];const t=JSON.stringify(r);for(const k of ['sessionId','decodedSha256','nextCursor','PRIVATE_SYNTHETIC','OPAQUE_SYNTHETIC',sha,expected.decodedSha256])assert(!t.includes(k),k);if(r.ok)assert.equal(r.summary.writerAuthorized,false);return r;};
 const good=async(f,m)=>{const r=await call(f,m);assert.equal(r.ok,true,JSON.stringify(r));return r.summary;};
 const deny=async(f,m,code)=>{const r=await call(f,m);assert.equal(r.ok,false);if(code)assert.equal(r.error,code);};
 const opts=f=>({wasmFactory:f,validateExternalAttestation:validateOwnerLocalSteamAttestation,allowSyntheticFixture:true});
 // Record the actual generated WASM instance/receipt/cursor inside test Worker only.
 const proto=WorkerWasmSource.prototype, finish=proto.finish, issue=proto.issue_saved_diffgrids_typed_cursor, close=proto.close;
 const sessions=[];let closes=0;
 proto.finish=function(...a){const r=finish.apply(this,a);sessions.push({wasm:this,r:JSON.parse(r)});return r;};
 proto.issue_saved_diffgrids_typed_cursor=function(...a){const r=issue.apply(this,a);sessions.at(-1).cursor=JSON.parse(r).cursor;return r;};
 proto.close=function(...a){closes++;return close.apply(this,a);};
 const closedRust=s=>assert.throws(()=>s.wasm.read_saved_diffgrids_typed_page(s.cursor,s.r.sessionId,BigInt(s.r.revision),BigInt(s.r.indexGeneration),s.r.decodedSha256));
 const factory=async()=>({WorkerWasmSource});
 const old=(await import(pathToFileURL(process.env.QA1022_OLD_FACADE).href)).createLocalSteamP1gSavedDiffGridsFacade;
 // 1: old actual counterexample then new actual underlying Rust closure BEFORE success.
 const a=old(opts(factory)), oa=await good(a,open(10));const os=sessions.at(-1);
 await deny(a,cancel(10),'LOCAL_DIFFGRIDS_STALE_SELECTION');assert.equal((await good(a,read(oa.selection))).records.length,8);a.close();closedRust(os);
 const f=create(opts(factory));const x=await good(f,open(10)),xs=sessions.at(-1),before=closes;
 const cancelled=await good(f,cancel(10));assert.deepEqual(cancelled,{closed:true,writerAuthorized:false});assert.equal(closes,before+1);closedRust(xs);
 await deny(f,read(x.selection),'LOCAL_DIFFGRIDS_STALE_READ_OR_REPLAY');await deny(f,cancel(10),'LOCAL_DIFFGRIDS_STALE_SELECTION');
 console.log('QA1022_GROUP1_OLD_COUNTEREXAMPLE_NEW_RUST_CLOSED');
 // 2: high correlation IDs do not advance OPEN high-water; replay cannot touch new session.
 const y=await good(f,open(11));const ys=sessions.at(-1);const cb=closes;
 for(const id of [10,11])await deny(f,open(id),'LOCAL_DIFFGRIDS_STALE_OPEN_OR_REPLAY');
 for(const id of [10,12,0,-1,1.25,'11',null,Number.MAX_SAFE_INTEGER+1])await deny(f,cancel(id),'LOCAL_DIFFGRIDS_STALE_SELECTION');
 await deny(f,cancel(11,9001,{extra:true}),'LOCAL_DIFFGRIDS_STALE_SELECTION');
 await deny(f,selected(x.selection),'LOCAL_DIFFGRIDS_STALE_SELECTION');assert.equal(closes,cb);
 const p=await good(f,read(y.selection));assert.equal(p.records.length,8);assert.equal(p.nextPageIndex,1);
 await good(f,selected(y.selection));closedRust(ys);
 await deny(f,open(11),'LOCAL_DIFFGRIDS_STALE_OPEN_OR_REPLAY');
 console.log('QA1022_GROUP2_ABA_CORRELATION_SELECTED_CLOSE');
 // 3: failed fresh OPEN consumes identity, revokes prior, cannot replay or close newer.
 const z=await good(f,open(12)),zs=sessions.at(-1);
 await deny(f,open(13,{expectedEncryptedSizeBytes:blob.size+16}),'LOCAL_DIFFGRIDS_OPEN_FAILED_CLOSED');closedRust(zs);
 await deny(f,read(z.selection),'LOCAL_DIFFGRIDS_STALE_READ_OR_REPLAY');
 const n=await good(f,open(14));await deny(f,open(13),'LOCAL_DIFFGRIDS_STALE_OPEN_OR_REPLAY');await deny(f,cancel(13),'LOCAL_DIFFGRIDS_STALE_SELECTION');
 assert.equal((await good(f,read(n.selection))).records.length,8);await good(f,cancel(14));f.close();
 console.log('QA1022_GROUP3_FAILED_OPEN_HIGH_WATER');
 // 4: deterministic delay at trusted factory (after actual Codec, before Rust creation).
 let release,entered;const gate=new Promise(r=>release=r),reached=new Promise(r=>entered=r);let calls=0;
 const g=create(opts(async()=>{if(++calls===1){entered();await gate;}return {WorkerWasmSource};}));
 const pending=call(g,open(20));await reached;
 await deny(g,cancel(19),'LOCAL_DIFFGRIDS_STALE_SELECTION');await deny(g,open(20),'LOCAL_DIFFGRIDS_STALE_OPEN_OR_REPLAY');
 await good(g,cancel(20));const fresh=await good(g,open(21)),fs=sessions.at(-1);const prev=closes;release();
 const late=await pending;assert.equal(late.ok,false);assert.equal(closes,prev);
 await deny(g,cancel(20),'LOCAL_DIFFGRIDS_STALE_SELECTION');assert.equal((await good(g,read(fresh.selection))).records.length,8);await good(g,cancel(21));closedRust(fs);
 console.log('QA1022_GROUP4_PENDING_FACTORY_LATE_NO_RESURRECTION');
 // 5: newer pending OPEN supersedes old, old cancel inert; exact max safe ID exhaustion fail closed.
 let go,arrive;const barrier=new Promise(r=>go=r),arrived=new Promise(r=>arrive=r);let count=0;
 const h=create(opts(async()=>{if(++count===1){arrive();await barrier;}return {WorkerWasmSource};}));
 const oldPending=call(h,open(30));await arrived;const last=await good(h,open(Number.MAX_SAFE_INTEGER));const ls=sessions.at(-1);
 await deny(h,cancel(30),'LOCAL_DIFFGRIDS_STALE_SELECTION');go();assert.equal((await oldPending).ok,false);
 await deny(h,open(31),'LOCAL_DIFFGRIDS_STALE_OPEN_OR_REPLAY');await good(h,read(last.selection));await good(h,cancel(Number.MAX_SAFE_INTEGER));closedRust(ls);
 await deny(h,open(Number.MAX_SAFE_INTEGER),'LOCAL_DIFFGRIDS_STALE_OPEN_OR_REPLAY');h.close();
 assert.equal(createHash('sha256').update(raw).digest('hex'),sha);
 console.log('QA1022_GROUP5_SUPERSEDE_SAFE_INTEGER_BOUNDARY');
 proto.finish=finish;proto.issue_saved_diffgrids_typed_cursor=issue;proto.close=close;
 parentPort.postMessage({groups:5,realWasm:true,privateData:false});parentPort.close();
}
