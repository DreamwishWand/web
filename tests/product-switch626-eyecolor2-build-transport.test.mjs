import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createSwitch626EyeColor2Transport,SWITCH626_EYECOLOR2_CONTRACT} from '../src/lib/ddv/core/save/product-steam626-eyecolor2-transport.mjs';

const sha=c=>c.repeat(64),session='a'.repeat(32),original=sha('b');
const decoded=new TextEncoder().encode('synthetic-Switch626-Eyeball-ColorIndex2-64-to-69');
const projected=createHash('sha256').update(decoded).digest('hex');
const build={platform:'switch',buildKind:'switch-bid',buildId:'9A239D3DB569756D',schema:626};
const initial={contract:'wand.product.single-save-session.boundary@1',schema:626,sessionId:session,revision:0,indexGeneration:1,decodedSha256:original,
 productWorkerBound:true,fullDocumentJsonValidated:true,writerAuthorized:false,editedCopyAuthorized:false,applyAuthorized:false};
const contract=SWITCH626_EYECOLOR2_CONTRACT,output='wand.worker.switch626.eyecolor2-exact1-output@1';
const hashes={activeEyeSha256:sha('1'),inactiveEyeSha256:sha('2'),maleSha256:sha('3'),femaleSha256:sha('4'),
 stockEntrySha256:sha('5'),routeSha256:sha('6'),selectedTokenSha256:sha('7')};
function setup(patch={},stagePatch={}){
 let active=true,revision=0,offset=0;
 const calls=[],receipt={
  contract,eyeballItemId:70000010,field:'ColorIndex2',oldColorIndex:64,newColorIndex:69,
  sessionId:session,revision:0,indexGeneration:1,decodedSha256:original,...hashes,projectedDecodedSha256:projected,
  exactFieldChangedCount:1,inventoryDelta:0,writerAuthorized:false,editedCopyAuthorized:false,
  originalOverwriteAuthorized:false,productReadAccepted:false,...patch
 };
 const makeReceipt=applied=>JSON.stringify({
  contract,sessionId:session,revision:++revision,indexGeneration:revision+1,decodedSha256:original,
  stagedDecodedSha256:projected,operationCount:1,exactFieldChangedCount:1,applied,
  writerAuthorized:false,originalOverwriteAuthorized:false,...stagePatch
 });
 const wasm={
  preview_switch626_eyecolor2(...args){calls.push(['preview',...args]);return JSON.stringify(receipt)},
  stage_switch626_eyecolor2(...args){calls.push(['stage',...args]);return makeReceipt(true)},
  toggle_switch626_eyecolor2(redo,...args){calls.push(['toggle',redo,...args]);return makeReceipt(redo)},
  begin_switch626_eyecolor2_output(...args){calls.push(['begin',...args]);return JSON.stringify({
   contract:output,decodedBytes:decoded.length,decodedSha256:projected,
   writerAuthorized:false,originalOverwriteAuthorized:false
  })},
  next_switch626_eyecolor2_output_chunk(){const part=decoded.slice(offset,offset+9);offset+=part.length;return part}
 };
 const options={parse:JSON.parse,current:()=>active,revoke:()=>{active=false},maxBytes:4096,chunkBytes:9};
 const transport=createSwitch626EyeColor2Transport(wasm,initial,build,options);
 return {transport,calls,wasm,options,active:()=>active};
}
test('Switch Eyeball Color2 exact1 uses eight Core hashes, CAS, one Rust Session, Undo/Redo and one-time bounded output',async()=>{
 const q=setup(),p=q.transport.previewTarget();
 assert.deepEqual(q.calls[0],['preview',session,0n,1n,original]);
 assert.deepEqual(p,{eyeballItemId:70000010,field:'ColorIndex2',oldColorIndex:64,newColorIndex:69,
  exactFieldChangedCount:1,inventoryDelta:0,writerAuthorized:false,editedCopyAuthorized:false,
  originalOverwriteAuthorized:false,productReadAccepted:false});
 for(const k of ['selectedTokenSha256','projectedDecodedSha256','routeSha256','activeEyeSha256','stockEntrySha256'])assert.equal(k in p,false);
 assert.equal(q.transport.stage().applied,true);
 assert.deepEqual(q.calls[1],['stage',sha('1'),sha('2'),sha('3'),sha('4'),sha('5'),sha('6'),sha('7'),projected,session,0n,1n,original]);
 assert.equal(q.transport.toggle(false).applied,false);
 assert.equal(q.transport.toggle(true).applied,true);
 assert.deepEqual((await q.transport.takeOutput()).decodedBytes,decoded);
 assert.equal(q.active(),false);
 await assert.rejects(q.transport.takeOutput());
});
test('Switch Eyeball Color2 denies wrong Build, selector input, altered old scalar, forged witness or unsafe grant',()=>{
 const base=setup();
 for(const identity of [{...build,schema:624},{...build,platform:'steam-windows'},{...build,buildKind:'steam-full-version'},
  {...build,buildId:'releases_1.25-v1.25.3-44-g0b41250d9ac0-incremental-22'},{...build,extra:true}])
  assert.throws(()=>createSwitch626EyeColor2Transport(base.wasm,initial,identity,base.options));
 for(const state of [{...initial,schema:624},{...initial,revision:1},{...initial,writerAuthorized:true},
  {...initial,fullDocumentJsonValidated:false},{...initial,sessionId:'0'.repeat(32)}])
  assert.throws(()=>createSwitch626EyeColor2Transport(base.wasm,state,build,base.options));
 for(const patch of [{contract:'foreign'},{eyeballItemId:70000011},{field:'ColorIndex1'},{oldColorIndex:65},
  {newColorIndex:70},{inventoryDelta:1},{exactFieldChangedCount:2},{writerAuthorized:true},
  {editedCopyAuthorized:true},{originalOverwriteAuthorized:true},{productReadAccepted:true},
  {activeEyeSha256:'bad'},{inactiveEyeSha256:'bad'},{maleSha256:'bad'},{femaleSha256:'bad'},
  {stockEntrySha256:'bad'},{routeSha256:'bad'},{selectedTokenSha256:'bad'},
  {projectedDecodedSha256:original},{decodedSha256:sha('f')},{sessionId:'f'.repeat(32)},
  {indexGeneration:2},{revision:1},{unexpected:1}]){
  const q=setup(patch);assert.throws(()=>q.transport.previewTarget());
  assert.equal(q.active(),false);assert.equal(q.calls.some(c=>c[0]==='stage'),false);
 }
 const x=setup();assert.throws(()=>x.transport.previewTarget({field:'ColorIndex2'}));assert.equal(x.calls.length,0);
 const y=setup({},{stagedDecodedSha256:original});y.transport.previewTarget();assert.throws(()=>y.transport.stage());assert.equal(y.active(),false);
});
