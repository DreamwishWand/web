import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPublishEnvelope, preflightScene, validatePublishablePreset } from '../src/lib/wep/scene-preset-runtime.ts';

const scene={
 schema:'dreamwish-wand-preset',artifactVersion:1,type:'scene',
 bounds:{w:2,h:2},originPolicy:'capture-region-top-left',
 objects:[{artifactObjectId:'o0',itemId:10,localX:0,localY:0,orientation:0,footprint:[{x:0,y:0}],portableState:null,dependencyIds:[]}],
 networks:{roads:null,fences:null}
};

test('valid portable Scene builds an exact JSON envelope',()=>{
 const v=buildPublishEnvelope(scene);
 assert.equal(v.ok,true);
 assert.equal(v.envelope?.contentType,'application/json');
 assert.equal(JSON.parse(v.envelope!.json).objects[0].artifactObjectId,'o0');
});

test('save-local identity fails closed',()=>{
 const bad=structuredClone(scene) as any;
 bad.objects[0].sourceGridId=5;
 assert.equal(validatePublishablePreset(bad).ok,false);
});

test('preflight never authorizes persistent write',()=>{
 const r=preflightScene(scene,{inventory:{10:1}});
 assert.equal(r.ok,true);
 assert.equal(r.writeReady,false);
 assert.equal(r.reason,'CORE_COMMIT_ADAPTER_NOT_BOUND');
});

test('inventory shortage blocks without Mirage capability',()=>{
 const r=preflightScene(scene,{inventory:{10:0}});
 assert.equal(r.ok,false);
 assert.equal(r.issues.some((x)=>x.code==='ITEM_SHORTAGE'),true);
});
