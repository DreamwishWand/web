import test from 'node:test';
import assert from 'node:assert/strict';
import {readCollectionCandidate} from '../src/lib/collection/collection-candidate-read.mjs';
const H='a'.repeat(64),S='b'.repeat(32),STEAM='releases_1.25-v1.25.3-44-g0b41250d9ac0-incremental-22',SWITCH='9A239D3DB569756D';
const selector={definitionId:2120000001,groupIndex:0,itemId:40000001};
const denial=/COLLECTION_CANDIDATE_READ_DENIED/;
function fixture(steam=true){
 const b={platform:steam?'steam-windows':'switch',buildKind:steam?'steam-full-version':'switch-bid',buildId:steam?STEAM:SWITCH,schema:626};
 const r={contract:'wand.product.single-save-session.boundary@1',sessionId:S,revision:0,indexGeneration:1,decodedSha256:H,schema:626,productWorkerBound:true,fullDocumentJsonValidated:true,writerAuthorized:false,editedCopyAuthorized:false,applyAuthorized:false};
 const x={contract:'wand.worker.collection-scoped-candidate@1',platform:steam?'SteamWindows':'Switch',buildKind:steam?'SteamFullVersion':'SwitchBid',buildId:b.buildId,sessionId:S,revision:0,indexGeneration:1,decodedSha256:H,...selector,old:false,new:true,falseCount:steam?3:2,positiveStock:1,
 itemDefinitionSha256:H,collectionDefinitionSha256:H,groupDefinitionSha256:H,entrySha256:H,groupSha256:H,mapSha256:H,stockEntrySha256:H,packagedCandidateVerified:true,sourcePhysicalVerified:true,effectiveEligibilityVerified:false,writerAuthorized:false,editedCopyAuthorized:false,applyAuthorized:false};
 let active=true,calls=0,revokes=0;
 const owner={identity:b,receipt:r,current:()=>active,revoke:()=>{active=false;revokes++},parse:JSON.parse,
 wasm:{preview_scoped_collection_candidate(...args){calls++;assert.deepEqual(args,[selector.definitionId,0,selector.itemId,S,0n,1n,H]);return JSON.stringify(x)}}};
 return {owner,x,r,b,counts:()=>({calls,revokes}),invalidate:()=>{active=false}};
}
test('dual Build read-only candidate projection; no grant, scope token or raw hashes',()=>{
 for(const steam of [true,false]){const f=fixture(steam),p=readCollectionCandidate(f.owner,selector);
 assert.equal(p.kind,'COLLECTION_CANDIDATE_READ_ONLY');assert.equal(p.falseCount,steam?3:2);
 assert.deepEqual(Object.keys(p).sort(),['kind','definitionId','groupIndex','itemId','platform','falseCount','positiveStock','packagedCandidateVerified','sourcePhysicalVerified','effectiveEligibilityVerified','writerAuthorized','editedCopyAuthorized','applyAuthorized'].sort());
 for(const k of ['effectiveEligibilityVerified','writerAuthorized','editedCopyAuthorized','applyAuthorized'])assert.equal(p[k],false);
 assert.equal(Object.isFrozen(p),true);assert.deepEqual(f.counts(),{calls:1,revokes:0});}
});
test('malformed, substituted or authority-bearing receipt revokes exact session',()=>{
 for(const [k,v] of [['platform','Switch'],['buildKind','SwitchBid'],['buildId',SWITCH],['sessionId','c'.repeat(32)],['revision',1],['indexGeneration',2],['decodedSha256','b'.repeat(64)],['definitionId',2120000002],['groupIndex',1],['itemId',40000002],['old',true],['new',false],['falseCount',2],['positiveStock',0],['entrySha256','bad'],['packagedCandidateVerified',false],['sourcePhysicalVerified',false],['effectiveEligibilityVerified',true],['writerAuthorized',true],['editedCopyAuthorized',true],['applyAuthorized',true],['coreMinted',true]]){
  const f=fixture();f.x[k]=v;assert.throws(()=>readCollectionCandidate(f.owner,selector),denial);assert.deepEqual(f.counts(),{calls:1,revokes:1});
 }
 const f=fixture(false);f.x.falseCount=1;assert.throws(()=>readCollectionCandidate(f.owner,selector),denial);
});
test('untrusted selector, stale epoch and unsupported ABI cannot read or grant',()=>{
 for(const s of [{...selector,sessionId:S},{...selector,itemId:1},{...selector,groupIndex:-1}]){
  const f=fixture();assert.throws(()=>readCollectionCandidate(f.owner,s),denial);assert.equal(f.counts().calls,0);
 }
 const f=fixture();f.r.revision=1;assert.throws(()=>readCollectionCandidate(f.owner,selector),denial);assert.equal(f.counts().calls,0);
 const g=fixture();delete g.owner.wasm.preview_scoped_collection_candidate;assert.throws(()=>readCollectionCandidate(g.owner,selector),denial);
 const h=fixture();h.invalidate();assert.throws(()=>readCollectionCandidate(h.owner,selector),denial);assert.equal(h.counts().calls,0);
 const j=fixture();const orig=j.owner.wasm.preview_scoped_collection_candidate;j.owner.wasm.preview_scoped_collection_candidate=(...a)=>{const raw=orig(...a);j.invalidate();return raw};assert.throws(()=>readCollectionCandidate(j.owner,selector),denial);assert.equal(j.counts().revokes,0);
});
test('Core denial remains a denial; malformed raw data or strict parser rejection revokes',()=>{
 const f=fixture();f.owner.wasm.preview_scoped_collection_candidate=()=>{throw Error('CORE_DENIED')};assert.throws(()=>readCollectionCandidate(f.owner,selector),denial);assert.equal(f.counts().revokes,0);
 for(const value of ['x'.repeat(4097),'invalid JSON']){const g=fixture();g.owner.wasm.preview_scoped_collection_candidate=()=>value;assert.throws(()=>readCollectionCandidate(g.owner,selector),denial);assert.equal(g.counts().revokes,1)}
 const h=fixture();h.owner.parse=()=>{throw Error('DUPLICATE_JSON_KEY')};assert.throws(()=>readCollectionCandidate(h.owner,selector),denial);assert.equal(h.counts().revokes,1);
});
