import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createSteam626MakeupColor1Transport,STEAM626_MAKEUP_COLOR1_CONTRACT} from '../src/lib/ddv/core/save/product-steam626-makeup-color1-transport.mjs';

const sha=c=>c.repeat(64),session='a'.repeat(32),original=sha('b');
const bytes=new TextEncoder().encode('synthetic-Steam626-Makeup-ColorIndex1-53-to-60');
const projected=createHash('sha256').update(bytes).digest('hex');
const build={platform:'steam-windows',buildKind:'steam-full-version',buildId:'releases_1.25-v1.25.3-44-g0b41250d9ac0-incremental-22',schema:626};
const initial={contract:'wand.product.single-save-session.boundary@1',schema:626,sessionId:session,
 revision:0,indexGeneration:1,decodedSha256:original,productWorkerBound:true,
 fullDocumentJsonValidated:true,writerAuthorized:false,editedCopyAuthorized:false,applyAuthorized:false};
const contract=STEAM626_MAKEUP_COLOR1_CONTRACT,output='wand.worker.steam626.makeup-color1-exact1-output@1';
const hashes={tokenSha256:sha('1'),entrySha256:sha('2'),femaleSha256:sha('3'),maleSha256:sha('4'),routesSha256:sha('5')};
function setup(patch={},stagePatch={}){
 let active=true,revision=0,offset=0;
 const calls=[];
 const preview={contract,makeupItemId:140100014,slot:1,field:'ColorIndex1',
  oldColorIndex:53,newColorIndex:60,sessionId:session,revision:0,indexGeneration:1,
  decodedSha256:original,...hashes,projectedDecodedSha256:projected,
  exactFieldChangedCount:1,inventoryDelta:0,scopedCandidate:true,writerAuthorized:false,
  editedCopyAuthorized:false,originalOverwriteAuthorized:false,...patch};
 const receipt=applied=>JSON.stringify({contract,sessionId:session,revision:++revision,
  indexGeneration:revision+1,decodedSha256:original,stagedDecodedSha256:projected,
  operationCount:1,exactFieldChangedCount:1,applied,writerAuthorized:false,
  originalOverwriteAuthorized:false,...stagePatch});
 const wasm={
  preview_steam626_makeup_color1(...args){calls.push(['preview',...args]);return JSON.stringify(preview)},
  stage_steam626_makeup_color1(...args){calls.push(['stage',...args]);return receipt(true)},
  toggle_steam626_makeup_color1(redo,...args){calls.push(['toggle',redo,...args]);return receipt(redo)},
  begin_steam626_makeup_color1_output(...args){calls.push(['begin',...args]);return JSON.stringify({
   contract:output,decodedBytes:bytes.length,decodedSha256:projected,
   writerAuthorized:false,originalOverwriteAuthorized:false})},
  next_steam626_makeup_color1_output_chunk(){const chunk=bytes.slice(offset,offset+9);offset+=chunk.length;return chunk}
 };
 const options={parse:JSON.parse,current:()=>active,revoke:()=>{active=false},maxBytes:4096,chunkBytes:9};
 const transport=createSteam626MakeupColor1Transport(wasm,initial,build,options);
 return {transport,wasm,options,active:()=>active,calls};
}
test('Steam626 exact1 Makeup fixed Rust preview and six Stage hashes, Undo/Redo, one-time decoded output',async()=>{
 const {transport:t,calls,active}=setup();
 const preview=t.previewTarget();
 assert.deepEqual(calls[0],['preview',session,0n,1n,original]);
 assert.deepEqual(preview,{makeupItemId:140100014,slot:1,field:'ColorIndex1',
  oldColorIndex:53,newColorIndex:60,inventoryDelta:0,exactFieldChangedCount:1,
  scopedCandidate:true,writerAuthorized:false,editedCopyAuthorized:false,originalOverwriteAuthorized:false});
 assert.equal('projectedDecodedSha256' in preview,false);
 assert.equal('routesSha256' in preview,false);
 assert.equal(t.stage().applied,true);
 assert.deepEqual(calls[1],['stage',sha('1'),sha('2'),sha('3'),sha('4'),sha('5'),projected,session,0n,1n,original]);
 assert.equal(t.toggle(false).applied,false);
 assert.equal(t.toggle(true).applied,true);
 assert.deepEqual((await t.takeOutput()).decodedBytes,bytes);
 assert.equal(active(),false);
 await assert.rejects(t.takeOutput());
});
test('Steam626 Makeup exact Build/ABI/preview rejects foreign, changed scalar, changed token, extra grants and UI selection',()=>{
 const base=setup();
 for(const bad of [{...build,schema:624},{...build,platform:'switch'},
  {...build,buildKind:'switch-bid'}, {...build,buildId:'9A239D3DB569756D'},
  {...build,extra:true}]){
  assert.throws(()=>createSteam626MakeupColor1Transport(base.wasm,initial,bad,base.options));
 }
 for(const bad of [{...initial,schema:624},{...initial,revision:1},{...initial,writerAuthorized:true},
  {...initial,fullDocumentJsonValidated:false},{...initial,sessionId:'0'.repeat(32)}]){
  assert.throws(()=>createSteam626MakeupColor1Transport(base.wasm,bad,build,base.options));
 }
 const inputs=[{contract:'foreign'}, {slot:2},{makeupItemId:140100011},{field:'ColorIndex2'},
  {oldColorIndex:52},{newColorIndex:61},{inventoryDelta:1},{exactFieldChangedCount:2},
  {scopedCandidate:false},{writerAuthorized:true},{editedCopyAuthorized:true},
  {originalOverwriteAuthorized:true},{tokenSha256:'bad'}, {entrySha256:'bad'},
  {femaleSha256:'bad'},{maleSha256:'bad'},{routesSha256:'bad'},
  {projectedDecodedSha256:original},{decodedSha256:sha('f')},
  {sessionId:'f'.repeat(32)},{indexGeneration:2},{revision:1},{unexpected:1}];
 for(const patch of inputs){
  const x=setup(patch);
  assert.throws(()=>x.transport.previewTarget());
  assert.equal(x.active(),false);
  assert.equal(x.calls.some(c=>c[0]==='stage'),false);
 }
 const extra=setup();assert.throws(()=>extra.transport.previewTarget({slot:1}));assert.equal(extra.calls.length,0);
 const stage=setup({},{stagedDecodedSha256:original});stage.transport.previewTarget();
 assert.throws(()=>stage.transport.stage());assert.equal(stage.active(),false);
});
