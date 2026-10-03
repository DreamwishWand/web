import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

const scopePath=new URL('../static/ddv/core/world/v1.25/min-transform-scope-pack-v125.json',import.meta.url);
const orchestratorPath=new URL('../src/lib/wep/min-verified-transform-export-v1.ts',import.meta.url);
const placementPath=new URL('../src/lib/wep/placement-legality-v19.ts',import.meta.url);

test('minimum transform browser scope pack is pinned to the canonical v1.25 CORE subset',async()=>{
  const bytes=await readFile(scopePath);
  const sha=createHash('sha256').update(bytes).digest('hex');
  assert.equal(sha,'8fb0c2ba53977eb98a63930f56ae67408f59b6c2a7e01549a3430c9b5f6c8934');
  const pack=JSON.parse(bytes.toString('utf8'));
  assert.equal(pack.schema,'dreamwish-wand-v125-furniture-write-scope-core-browser-pack');
  assert.equal(pack.version,1);
  assert.equal(pack.gameVersion,'1.25.0');
  assert.equal(pack.buildID,'52BD625D9B4E0053');
  assert.equal(pack.sourceCount,6233);
  assert.equal(pack.coreCount,3276);
  assert.equal(Object.keys(pack.items).length,3276);
  let syncOnline=0,mission=0,nativeReject=0;
  for(const row of Object.values(pack.items)){
    assert.equal(row[0],'FurnitureItemData');
    assert.equal(row[1],'CORE_STATELESS_FURNITURE');
    assert.equal(row[2],'None');
    assert.equal(typeof row[3],'boolean');
    assert.equal(row[4],false);
    assert.ok(row[5]===null||row[5]===false);
    assert.ok(Array.isArray(row[6]));
    assert.equal(typeof row[7],'boolean');
    if(row[7]) syncOnline++;
    if(row[3]) mission++;
    if(row[6].length) nativeReject++;
  }
  assert.equal(syncOnline,798);
  assert.equal(mission,466);
  assert.equal(nativeReject,492);
});

test('WEP verified export source is bound to promoted 01A/01B chain and keeps direct persistence false',async()=>{
  const source=await readFile(orchestratorPath,'utf8');
  for(const required of [
    'classifyMinimumPersistentTransform',
    'buildMinimumTransformTransactionPlan',
    'minimumPersistentTransformAdapter',
    'createVerifiedWriteCandidate',
    'verifyWriteCandidate',
    'createVerifiedCandidateExportBundle',
    'openWorldSaveBytes',
    'projectSwitchAreaGrid',
    'WEP_EXPORT_SOURCE_CHANGED_SINCE_PLAN',
    'WEP_EXPORT_UNSUPPORTED_PENDING_CHANGE',
    'persistentWriteAuthorized:false',
    'WORLD_PERSISTENT_WRITE_V125:false'
  ]) assert.ok(source.includes(required),required);
  assert.ok(!source.includes('executePersistentCommit('));
  assert.ok(!source.includes('targetPath'));
});

test('WEP placement binding exposes the exact promoted minimum-transform placement revision',async()=>{
  const source=await readFile(placementPath,'utf8');
  assert.ok(source.includes('V125_NATIVE_ORDINARY_CARDINAL_NONWALL_GROUPSET_2'));
  assert.ok(source.includes('classifyMinimumTransformPlacement'));
  assert.ok(source.includes('validateOrdinaryCardinalPlacement'));
  assert.ok(source.includes('clearArea: false'));
  assert.ok(source.includes('automaticSpawning: false'));
});
