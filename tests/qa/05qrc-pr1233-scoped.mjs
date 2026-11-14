import test from 'node:test';
import assert from 'node:assert/strict';
import { SafeProfileEditSession } from '../../src/lib/ddv/core/save/safe-edit-session.js';
import { evaluateSavePreflight } from '../../src/lib/ddv/core/save/save-preflight.js';
import { p1gPackagedProfileCodec as codec } from '../../src/lib/ddv/core/save/p1g-packaged-profile-codec.js';
import { createVerifiedWriteCandidate, verifyWriteCandidate } from '../../src/lib/ddv/core/save/transaction-foundation.js';
import { buildMinimumTransformTransactionPlan, minimumPersistentTransformAdapter, ADMISSIBILITY_SCHEMA } from '../../src/lib/ddv/core/world/min-transform-write-v125.js';
import { makeSyntheticP1gProfile } from '../helpers/p1g-fixture.mjs';
const target={platform:'switch',kind:'switch-bid',value:'9A239D3DB569756D'};
const contract={id:'private-switch626-exact-transform-candidate-only',platform:'switch',gameVersion:'1.25.3',profileGameInfoVersion:626,buildIdentity:target,codecContract:'p1g-v0',persistentWriteAuthorized:false};
const profile={GameInfo:{Version:626,InitialVersion:624,LastSaveDeviceInfo:{deviceType:'DeviceType_Switch'}},Player:{Opaque:[1,2]},World:{Villages:[{Areas:{'2':{GridIDs:[7],Unlocked:true}}}],GridCollection:{Grids:{'7':{ID:7,GridDataPath:'GridData/Synthetic.json',GridDefaultLayoutPath:'',TessellationFactor:2,NextGridObjectID:100,Objects:{'42':{ID:42,ItemID:40000048,X:10,Y:20,Orientation:'GridOrientation_Right',State:null}}}},DiffGrids:{}},Opaque:{keep:true}}};
const source=Uint8Array.from(makeSyntheticP1gProfile(profile));
const op={id:'WORLD_EXISTING_ROOT_STATELESS_FURNITURE_TRANSFORM_V125',owner:'01B CORE - World / Grid / Buildings',kind:'MOVE',runtimeGate:'PENDING',structuralCapabilitiesSupported:true,planSupported:true,validationPassed:true};
const open=(contracts=[contract],platform='switch',bytes=source)=>SafeProfileEditSession.open({sourceBytes:bytes,codec,sourcePlatform:platform,contracts});
const pre=(session,operation=op,targetBuild=target)=>evaluateSavePreflight({session,operation,targetBuild,persistence:{backupReady:true,atomicReplaceReady:true,postCommitVerifyReady:true}});

import { evaluateSavePreflight as oldPre } from '../../src/lib/ddv/core/save/.qa1233-parent.mjs';
import { mkdtemp,writeFile,readFile,rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
const sha=b=>createHash('sha256').update(b).digest('hex');
const d=await mkdtemp(join(tmpdir(),'qa1233-'));
let pos=0,neg=0,oldDenied=0;
try{
 for(const kind of ['MOVE','ROTATE']){
  const session=await open(),ctx=session.getPreflightContext();
  const operation={...op,kind};
  assert.equal(oldPre({session,operation,targetBuild:target,persistence:{backupReady:true,atomicReplaceReady:true,postCommitVerifyReady:true}}).capabilities.encodeCopy,false);oldDenied++;
  const p=pre(session,operation);assert.equal(p.capabilities.encodeCopy,true);assert.equal(p.persistentWriteAuthorized,false);
  const b={x:10,y:20,orientation:'GridOrientation_Right'},a=kind==='MOVE'?{...b,y:22}:{...b,orientation:'GridOrientation_Up'};
  const plan=buildMinimumTransformTransactionPlan({admissibility:{schema:ADMISSIBILITY_SCHEMA,status:'ADMISSIBLE',operation:kind,target:{gridId:7,gridObjectId:42,itemId:40000048,objectMapKey:'42'},serializedBeforeTransform:b,serializedFinalTransform:a,finalTransform:{x:a.x,y:a.y,orientation:kind==='MOVE'?4:0}},transactionInput:{platform:'switch',gameVersion:'1.25.3',profileGameInfoVersion:626,originalFileLength:source.length,originalSha256:ctx.saveIdentity.sourceRawSha256,codecContract:ctx.codecContract,targetBuild:target},nextGridObjectId:100,planId:'independent-'+kind});
  const c=await createVerifiedWriteCandidate({session,plan,adapter:minimumPersistentTransformAdapter,contracts:[contract]});
  assert.equal((await verifyWriteCandidate({candidate:c,codec,contracts:[contract]})).status,'PASS');assert.equal(c.manifest.persistentWriteAuthorized,false);
  const o=join(d,kind+'-original'),bak=join(d,kind+'-backup'),out=join(d,kind+'-edited');
  for(const [path,bytes] of [[o,source],[bak,c.backupOriginalBytes],[out,c.candidateBytes]])await writeFile(path,bytes,{flag:'wx',mode:0o600});
  const expected=structuredClone(profile);Object.assign(expected.World.GridCollection.Grids[7].Objects[42],{X:a.x,Y:a.y,Orientation:a.orientation});
  const child=spawnSync(process.execPath,['--input-type=module','-e',"import {readFile} from 'node:fs/promises';import assert from 'node:assert/strict';const {p1gPackagedProfileCodec:c}=await import(process.argv[1]);const d=await c.loadProfile(await readFile(process.argv[2]));assert.deepEqual(JSON.parse(d.jsonText),JSON.parse(process.argv[3]));",new URL('../../src/lib/ddv/core/save/p1g-packaged-profile-codec.js',import.meta.url).href,out,JSON.stringify(expected)],{encoding:'utf8',timeout:15000});
  assert.equal(child.status,0,child.stderr);assert.equal(sha(await readFile(o)),sha(source));assert.equal(sha(await readFile(bak)),sha(source));assert.deepEqual(session.getSnapshot(),profile);pos++;
  for(const change of [{id:'other'},{owner:'01B CORE'},{kind:'DELETE'},{runtimeGate:'PASSED'},{validationPassed:false},{planSupported:false},{structuralCapabilitiesSupported:false}]){assert.equal(pre(session,{...operation,...change}).capabilities.encodeCopy,false);neg++;}
  for(const c of [{...contract,id:'other'},{...contract,persistentWriteAuthorized:true},{...contract,gameVersion:'1.25.0'},{...contract,buildIdentity:{...target,value:'52BD625D9B4E0053'}},{...contract,codecContract:'wrong'}]){assert.equal(pre(await open([c]),operation).capabilities.encodeCopy,false);neg++;}
  for(const s of [await open([]),await open([contract,contract]),await open([contract],'steam-windows'),await SafeProfileEditSession.open({sourceBytes:source,codec,sourcePlatform:'switch'})]){assert.equal(pre(s,operation).capabilities.encodeCopy,false);neg++;}
  assert.equal(pre(session,operation,{...target,value:'52BD625D9B4E0053'}).capabilities.encodeCopy,false);neg++;
 }
 assert.deepEqual([pos,neg,oldDenied],[2,34,2]);console.log('QA1233',pos,'EXACT_ENCRYPTED_REOPEN',neg,'DENIED',oldDenied,'OLD_DENIED');
}finally{await rm(d,{recursive:true,force:true})}
