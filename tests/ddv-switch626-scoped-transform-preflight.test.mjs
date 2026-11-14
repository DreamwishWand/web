import test from 'node:test';
import assert from 'node:assert/strict';
import { SafeProfileEditSession } from '../src/lib/ddv/core/save/safe-edit-session.js';
import { evaluateSavePreflight } from '../src/lib/ddv/core/save/save-preflight.js';
import { p1gPackagedProfileCodec as codec } from '../src/lib/ddv/core/save/p1g-packaged-profile-codec.js';
import { createVerifiedWriteCandidate, verifyWriteCandidate } from '../src/lib/ddv/core/save/transaction-foundation.js';
import { buildMinimumTransformTransactionPlan, minimumPersistentTransformAdapter, ADMISSIBILITY_SCHEMA } from '../src/lib/ddv/core/world/min-transform-write-v125.js';
import { makeSyntheticP1gProfile } from './helpers/p1g-fixture.mjs';
const target={platform:'switch',kind:'switch-bid',value:'9A239D3DB569756D'};
const contract={id:'private-switch626-exact-transform-candidate-only',platform:'switch',gameVersion:'1.25.3',profileGameInfoVersion:626,buildIdentity:target,codecContract:'p1g-v0',persistentWriteAuthorized:false};
const profile={GameInfo:{Version:626,InitialVersion:624,LastSaveDeviceInfo:{deviceType:'DeviceType_Switch'}},Player:{Opaque:[1,2]},World:{Villages:[{Areas:{'2':{GridIDs:[7],Unlocked:true}}}],GridCollection:{Grids:{'7':{ID:7,GridDataPath:'GridData/Synthetic.json',GridDefaultLayoutPath:'',TessellationFactor:2,NextGridObjectID:100,Objects:{'42':{ID:42,ItemID:40000048,X:10,Y:20,Orientation:'GridOrientation_Right',State:null}}}},DiffGrids:{}},Opaque:{keep:true}}};
const source=Uint8Array.from(makeSyntheticP1gProfile(profile));
const op={id:'WORLD_EXISTING_ROOT_STATELESS_FURNITURE_TRANSFORM_V125',owner:'01B CORE - World / Grid / Buildings',kind:'MOVE',runtimeGate:'PENDING',structuralCapabilitiesSupported:true,planSupported:true,validationPassed:true};
const open=(contracts=[contract],platform='switch',bytes=source)=>SafeProfileEditSession.open({sourceBytes:bytes,codec,sourcePlatform:platform,contracts});
const pre=(session,operation=op,targetBuild=target)=>evaluateSavePreflight({session,operation,targetBuild,persistence:{backupReady:true,atomicReplaceReady:true,postCommitVerifyReady:true}});
test('Switch626 explicit scoped preflight propagates the existing candidate-only contract',async()=>{
 const session=await open();
 for(const kind of ['MOVE','ROTATE']){
  const p=pre(session,{...op,kind});assert.equal(p.build.contract.id,contract.id);assert.equal(p.capabilities.encodeCopy,true);assert.equal(p.capabilities.persistentReplace,false);assert.equal(p.persistentWriteAuthorized,false);
 }
});
test('Switch626 scope does not accept other operations, builds, registries or persistent authority',async()=>{
 const s=await open();
 for(const change of [{id:'other'},{owner:'01A'},{kind:'DELETE'},{kind:undefined},{runtimeGate:'PASSED'},{runtimeGate:'NOT_REQUIRED'},{validationPassed:false},{planSupported:false},{structuralCapabilitiesSupported:false}]) assert.equal(pre(s,{...op,...change}).capabilities.encodeCopy,false);
 for(const c of [{...contract,id:'arbitrary'},{...contract,persistentWriteAuthorized:true},{...contract,gameVersion:'1.25.0'},{...contract,profileGameInfoVersion:624},{...contract,codecContract:'other'}]) assert.equal(pre(await open([c])).capabilities.encodeCopy,false);
 for(const x of [await open([]),await open([contract,contract]),await open([contract],'steam-windows'),await open([contract],'switch',Uint8Array.from(makeSyntheticP1gProfile({...profile,GameInfo:{...profile.GameInfo,Version:624}})))]) assert.equal(pre(x).capabilities.encodeCopy,false);
 assert.equal(pre(s,op,{...target,value:'UNKNOWN'}).capabilities.encodeCopy,false);
 const defaultSession=await SafeProfileEditSession.open({sourceBytes:source,codec,sourcePlatform:'switch'});
 assert.equal(pre(defaultSession).capabilities.encodeCopy,false);
 assert.equal(pre({getPreflightContext:()=>s.getPreflightContext(),contracts:[contract]}).capabilities.encodeCopy,false);
});
test('Switch626 exact synthetic MOVE/ROTATE encrypted candidate and independent verification',async()=>{
 for(const kind of ['MOVE','ROTATE']){
  const session=await open(),ctx=session.getPreflightContext();
  const b={x:10,y:20,orientation:'GridOrientation_Right'},a=kind==='MOVE'?{...b,x:11}:{...b,orientation:'GridOrientation_Up'};
  const plan=buildMinimumTransformTransactionPlan({admissibility:{schema:ADMISSIBILITY_SCHEMA,status:'ADMISSIBLE',operation:kind,target:{gridId:7,gridObjectId:42,itemId:40000048,objectMapKey:'42'},serializedBeforeTransform:b,serializedFinalTransform:a,finalTransform:{x:a.x,y:a.y,orientation:kind==='MOVE'?4:0}},transactionInput:{platform:'switch',gameVersion:'1.25.3',profileGameInfoVersion:626,originalFileLength:source.length,originalSha256:ctx.saveIdentity.sourceRawSha256,codecContract:ctx.codecContract,targetBuild:target},nextGridObjectId:100,planId:'synthetic-switch626-'+kind});
  const candidate=await createVerifiedWriteCandidate({session,plan,adapter:minimumPersistentTransformAdapter,contracts:[contract]});
  const verified=await verifyWriteCandidate({candidate,codec,contracts:[contract]});
  assert.equal(verified.status,'PASS');assert.equal(candidate.manifest.persistentWriteAuthorized,false);
  assert.deepEqual(candidate.backupOriginalBytes,source);
  const loaded=await codec.loadProfile(candidate.candidateBytes);
  const after=JSON.parse(loaded.jsonText),expected=structuredClone(profile);
  const item=expected.World.GridCollection.Grids['7'].Objects['42']; item.X=a.x;item.Y=a.y;item.Orientation=a.orientation;
  assert.deepEqual(after,expected);
 }
});
