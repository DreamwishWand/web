// 04 QR-W ACT-20261118-04QRW-PR2211-COLLECTION-CURRENT-EPOCH-READ-L2
// Independent changed-only boundary refutation of the real 01D adapter.
// Synthetic owner/Worker witnesses are NOT genuine encrypted Save V2 or real Rust QA.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readCollectionCandidate} from '../src/lib/collection/collection-candidate-read.mjs';

const DENY=/COLLECTION_CANDIDATE_READ_DENIED/;
const SHA='a'.repeat(64), SESSION='b'.repeat(32);
const STEAM='releases_1.25-v1.25.3-44-g0b41250d9ac0-incremental-22';
const SWITCH='9A239D3DB569756D';
const target=Object.freeze({definitionId:2120000001,groupIndex:0,itemId:40000001});
const hashes=['itemDefinitionSha256','collectionDefinitionSha256','groupDefinitionSha256','entrySha256','groupSha256','mapSha256','stockEntrySha256'];
const projected=['kind','definitionId','groupIndex','itemId','platform','falseCount','positiveStock','packagedCandidateVerified','sourcePhysicalVerified','effectiveEligibilityVerified','writerAuthorized','editedCopyAuthorized','applyAuthorized'];

function harness({steam=true,revision=1,indexGeneration=2}={}){
 const identity={schema:626,platform:steam?'steam-windows':'switch',buildKind:steam?'steam-full-version':'switch-bid',buildId:steam?STEAM:SWITCH};
 const receipt={contract:'wand.product.single-save-session.boundary@1',schema:626,sessionId:SESSION,
  revision,indexGeneration,decodedSha256:SHA,productWorkerBound:true,fullDocumentJsonValidated:true,
  writerAuthorized:false,editedCopyAuthorized:false,applyAuthorized:false};
 const candidate={contract:'wand.worker.collection-scoped-candidate@1',
  platform:steam?'SteamWindows':'Switch',buildKind:steam?'SteamFullVersion':'SwitchBid',
  buildId:identity.buildId,sessionId:SESSION,revision,indexGeneration,decodedSha256:SHA,
  ...target,old:false,new:true,falseCount:steam?3:2,positiveStock:1,
  packagedCandidateVerified:true,sourcePhysicalVerified:true,effectiveEligibilityVerified:false,
  writerAuthorized:false,editedCopyAuthorized:false,applyAuthorized:false};
 for(const key of hashes) candidate[key]=SHA;
 let active=true,revokes=0;
 const calls=[];
 const wasm={preview_scoped_collection_candidate(...args){calls.push(args);return JSON.stringify(candidate)}};
 const owner={wasm,receipt,identity,current:()=>active,revoke:()=>{revokes++;active=false},parse:JSON.parse};
 return {owner,receipt,identity,candidate,wasm,calls,
  inactive:()=>{active=false},stats:()=>({calls:calls.length,revokes,active})};
}

test('four real-adapter positive epochs forward exact lossless BigInt scope, never an editable target',()=>{
 for(const [steam,revision,indexGeneration] of [
  [true,1,2],[true,47,81],[false,14,99],[true,Number.MAX_SAFE_INTEGER,Number.MAX_SAFE_INTEGER]
 ]){
  const f=harness({steam,revision,indexGeneration});
  const projection=readCollectionCandidate(f.owner,target);
  assert.deepEqual(f.calls,[[target.definitionId,target.groupIndex,target.itemId,SESSION,
   BigInt(revision),BigInt(indexGeneration),SHA]]);
  assert.deepEqual(Object.keys(projection).sort(),projected.slice().sort());
  assert.equal(Object.isFrozen(projection),true);
  assert.equal(projection.kind,'COLLECTION_CANDIDATE_READ_ONLY');
  assert.equal(projection.platform,steam?'steam-windows':'switch');
  for(const flag of ['effectiveEligibilityVerified','writerAuthorized','editedCopyAuthorized','applyAuthorized'])
   assert.equal(projection[flag],false);
  assert.equal(JSON.stringify(projection).includes(SESSION),false);
  assert.equal(JSON.stringify(projection).includes(SHA),false);
  assert.equal(f.stats().revokes,0);
 }
});

test('invalid or lossy input epoch values deny before WASM dispatch, never authorize',()=>{
 const bad=[
  ['revision',-1],['revision',0.1],['revision',Number.MAX_SAFE_INTEGER+1],
  ['revision',NaN],['revision',Infinity],['revision','2'],['revision',2n],
  ['revision',null],['revision',{}],['indexGeneration',0],
  ['indexGeneration',-1],['indexGeneration',0.5],['indexGeneration',Number.MAX_SAFE_INTEGER+1],
  ['indexGeneration',NaN],['indexGeneration',Infinity],['indexGeneration','7'],
  ['indexGeneration',null],['indexGeneration',2n]
 ];
 for(const [key,value] of bad){
  const f=harness();f.receipt[key]=value;
  assert.throws(()=>readCollectionCandidate(f.owner,target),DENY,key+':'+String(value));
  assert.deepEqual(f.stats(),{calls:0,revokes:0,active:true});
 }
 for(const selector of [{...target,itemId:1},{...target,groupIndex:-1},{...target,revision:9},null]){
  const f=harness();assert.throws(()=>readCollectionCandidate(f.owner,selector),DENY);
  assert.equal(f.calls.length,0);
 }
});

test('stale/replayed Core epoch denial must fail closed without revoking an otherwise live session',()=>{
 for(const [reason,steam] of [['STALE_REVISION',true],['STALE_GENERATION',false],['STALE_SESSION',true],['STALE_DECODED_SHA',false]]){
  const f=harness({steam,revision:17,indexGeneration:29});
  f.wasm.preview_scoped_collection_candidate=(...args)=>{f.calls.push(args);throw Error(reason)};
  assert.throws(()=>readCollectionCandidate(f.owner,target),DENY,reason);
  assert.deepEqual(f.stats(),{calls:1,revokes:0,active:true});
 }
});

test('forged Core response, stale epoch, wrong Build or authority claim revoke instead of success',()=>{
 const attacks=[
  ['stale-rev',x=>x.revision=16],['future-rev',x=>x.revision=18],
  ['stale-gen',x=>x.indexGeneration=28],['future-gen',x=>x.indexGeneration=30],
  ['fraction-rev',x=>x.revision=17.5],['string-gen',x=>x.indexGeneration='29'],
  ['wrong-session',x=>x.sessionId='c'.repeat(32)],
  ['wrong-sha',x=>x.decodedSha256='c'.repeat(64)],
  ['wrong-build',x=>x.buildId=SWITCH],
  ['writer',x=>x.writerAuthorized=true],['edited-copy',x=>x.editedCopyAuthorized=true],
  ['apply',x=>x.applyAuthorized=true],['eligibility',x=>x.effectiveEligibilityVerified=true],
  ['target-mint',x=>x.coreMintedTarget='forged'],['wrong-stock',x=>x.positiveStock=0],
  ['wrong-count',x=>x.falseCount=1],['malformed-hash',x=>x.entrySha256='bad'],
  ['unverified-physical',x=>x.sourcePhysicalVerified=false]
 ];
 for(const [name,attack] of attacks){
  const f=harness({revision:17,indexGeneration:29});attack(f.candidate);
  assert.throws(()=>readCollectionCandidate(f.owner,target),DENY,name);
  assert.deepEqual(f.stats(),{calls:1,revokes:1,active:false},name);
 }
});

test('late invalidation during Worker or parser denies without false committed projection',()=>{
 const f=harness({revision:4,indexGeneration:12});
 f.wasm.preview_scoped_collection_candidate=(...args)=>{f.calls.push(args);f.inactive();return JSON.stringify(f.candidate)};
 assert.throws(()=>readCollectionCandidate(f.owner,target),DENY);
 assert.deepEqual(f.stats(),{calls:1,revokes:0,active:false});
 const g=harness({revision:4,indexGeneration:12});
 g.owner.parse=(raw)=>{g.inactive();return JSON.parse(raw)};
 assert.throws(()=>readCollectionCandidate(g.owner,target),DENY);
 assert.deepEqual(g.stats(),{calls:1,revokes:0,active:false});
});

test('malformed JSON or over-bounded response revokes, not a second editable Engine',()=>{
 for(const raw of ['not-json','x'.repeat(4097),'null','{}']){
  const f=harness({revision:2,indexGeneration:3});
  f.wasm.preview_scoped_collection_candidate=(...args)=>{f.calls.push(args);return raw};
  assert.throws(()=>readCollectionCandidate(f.owner,target),DENY);
  assert.deepEqual(f.stats(),{calls:1,revokes:1,active:false});
 }
});
