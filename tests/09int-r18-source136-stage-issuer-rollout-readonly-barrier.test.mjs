import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const root=new URL('../',import.meta.url);
const read=p=>fs.readFileSync(new URL(p,root),'utf8');
const inventory=JSON.parse(read('tests/fixtures/09int-r18-source136-staging21-cron7-readonly-inventory.json'));
const generic=read('supabase/functions/wep-preset-artifact/index.ts');
const scene=read('supabase/functions/wep-scene-preset-product/index.ts');
const worker=read('supabase/functions/wep-preset-retention/index.ts');
const closure=read('supabase/migrations/20261025003000_r18_scene_product_publisher_source_closure.sql');
const fencing=read('supabase/migrations/20261025002990_r18_preset_promotion_fencing_candidate.sql');

function report(name,data={}){
 console.log(JSON.stringify({case:name,evidenceType:'SOURCE_CONTRACT_PLUS_READONLY_STAGING_INVENTORY',
 actualProviderStorage:false,actualPostgreSQL:false,signedActors:false,
 operatorApproved:false,sourcePin:inventory.ownerSourcePin,...data}));
}
test('21 Edge and seven active Cron snapshot audited without claiming a real provider test',()=>{
 assert.equal(inventory.edges.length,21);
 assert.equal(inventory.cron.length,7);
 assert.equal(new Set(inventory.edges.map(e=>e.slug)).size,21);
 assert.equal(new Set(inventory.cron.map(e=>e.jobid)).size,7);
 assert.equal(inventory.stagingMigrationCount,116);
 assert.equal(inventory.sourceMigrationCount,136);
 assert.equal(inventory.stageR18FenceClaimPresent,false);
 assert.equal(inventory.stageR18ReleaseGatePresent,false);
 assert.equal(inventory.stageOldSceneServiceRpcCallable,3);
 const primary=inventory.edges.filter(e=>e.classification.startsWith('WEP_STORAGE_'));
 assert.deepEqual(primary.map(e=>e.slug).sort(),
  ['wep-preset-artifact','wep-preset-retention','wep-scene-preset-product'].sort());
 for(const edge of primary)assert.match(edge.sha256,/^[0-9a-f]{64}$/);
 const cron33=inventory.cron.find(j=>j.jobid===33),cron32=inventory.cron.find(j=>j.jobid===32);
 assert.equal(cron33.functionName,'private.community_invoke_retention_worker()');
 assert.equal(cron32.functionName,'private.community_invoke_provider_cleanup_worker()');
 assert.ok(cron33.unresolved.includes('VAULT'));
 assert.ok(cron32.unresolved.includes('VAULT'));
 report('09INT_R18_DEPLOYED_21EDGE_7CRON_READONLY_ISSUER_CENSUS', {sourceEdgePins:primary.map(e=>[e.slug,e.version,e.sha256])});
});

test('Source136 three safe WEP aliases are inert, but Staging old alias remains independently dangerous',()=>{
 assert.ok(scene.includes('R18_SCENE_PRODUCT_WRITER_NOT_ENROLLED'));
 assert.ok(scene.includes('R18_SCENE_PRODUCT_STORAGE_CLEANUP_NOT_AUTHORIZED'));
 assert.ok(generic.includes('R18_PRESET_PUBLICATION_RESERVATION_AND_BYTES_NOT_ACCEPTED'));
 assert.ok(worker.includes('PRESET_RETENTION_PHYSICAL_CLEANUP_NOT_ENROLLED') ||
   worker.includes('PHYSICAL_CLEANUP_NOT_ENROLLED') ||
   worker.includes('409'));
 for(const s of [generic,scene,worker]){
  assert.ok(!s.includes('.copy('));
  assert.ok(!s.includes('.remove('));
 }
 for(const rpc of ['community_publish_scene_preset_product_v1',
  'community_unpublish_scene_preset_v1','community_delete_scene_preset_v1'])
  assert.ok(closure.includes("'"+rpc+"'"));
 assert.ok(closure.includes("revoke all on function %s from public,anon,authenticated,service_role"));
 assert.equal(inventory.physicalSourceContract.sceneBeforeSqlCopy,true);
 assert.equal(inventory.physicalSourceContract.sceneSqlFailureCompensatesPublishedRemove,true);
 assert.equal(inventory.physicalSourceContract.retentionTokenClaimBeforePublishedRemove,true);
 report('09INT_R18_SOURCE136_NEW_EDGE_INERT_VS_STAGING_OLD_EDGE_ACTIVE', {safeSourceDoesNotEqualDeployed:true});
});

test('SQL revoke FIRST is insufficient: legacy copy already precedes RPC and permission failure invokes compensation',()=>{
 const state={ingressStopped:false,inflightDrained:false,
  safeEdgeAttested:false,workersParked:false,legacyCopyInFlight:true,
  sqlSceneServiceGrant:true,registeredWinner:true,publishedBytesPresent:true};
 function oldHandlerAfterSqlFailure() {
  if(state.legacyCopyInFlight&&inventory.physicalSourceContract.sceneSqlFailureCompensatesPublishedRemove)
   state.publishedBytesPresent=false;
 }
 state.sqlSceneServiceGrant=false;
 oldHandlerAfterSqlFailure();
 assert.equal(state.registeredWinner,true);
 assert.equal(state.publishedBytesPresent,false);
 report('09INT_R18_SQL_FIRST_ROLLOUT_DANGLING_REFERENCE_COUNTEREXAMPLE_MODEL', {
  interpretation:'MODEL_ONLY; not actual DB/provider execution',
  dbRegistered:true,providerObjectMissing:true,
  requiredOrder:'quiesce+drain+park + deploy/attest old Edge aliases failclosed BEFORE operator-approved SQL revocation'});
});

test('Guarded rollout readiness requires actual drain, 3 old WEP aliases and all destructive/indirect worker ingress attested',()=>{
 const required=['operatorApproval','backupPitrLegalHold','ingressQuiesced','inflightDrainProven',
  'oldGenericAliasAttested','oldSceneAliasAttested','oldPresetRetentionAliasAttested',
  'cron32And33TargetVerified','unownedWorkerIngressParked','sql116To136SemanticPlanApproved'];
 const otherwise=Object.fromEntries(required.map(k=>[k,false]));
 function canChangeHistoricalSql(gates){return required.every(k=>gates[k]===true);}
 assert.equal(canChangeHistoricalSql(otherwise),false);
 for(const key of required){
  assert.equal(canChangeHistoricalSql({...otherwise,...Object.fromEntries(required.map(k=>[k,true])),[key]:false}),false,key);
 }
 assert.equal(canChangeHistoricalSql(Object.fromEntries(required.map(k=>[k,true]))),true);
 assert.ok(!fencing.includes("providerCopyAuthorized',true"));
 assert.ok(fencing.includes("EDGE_READBACK_UNATTESTED"));
 assert.ok(fencing.includes("R18_PRESET_PUBLICATION_RELEASE_GATE_CLOSED"));
 report('09INT_R18_STAGE_OPERATOR_ORDER_BARRIER_NOT_SATISFIED',{
  requirements:required,readOnlyActive:7,rolloutAuthorized:false,
  providerPositiveAuthorized:false,
  warning:'Synthetic gating is a readiness model and not a verified real-world traffic drain'});
});
