import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
const require=createRequire(import.meta.url);
const api=require('../static/ddv/core/world/v1.25/progression-destination-veto-v125.cjs');
const contract=JSON.parse(readFileSync(new URL('../static/ddv/core/world/v1.25/progression-destination-veto-contract-v125.json',import.meta.url),'utf8'));
const source={gameVersion:'1.25.0',profileSchemaVersion:624};
const refIndex=(refs=[])=>{
 const byGridObjectAddress={},byItemId={};
 for(const r of refs){
  if(r.gridId!=null&&r.gridObjectId!=null)(byGridObjectAddress[`${r.gridId}:${r.gridObjectId}`]??=[]).push(r.referenceId);
  if(r.itemId!=null)(byItemId[String(r.itemId)]??=[]).push(r.referenceId);
 }
 return {contract:'ddv.progression-reference-index@1',references:refs,indexes:{byGridObjectAddress,byItemId}};
};
const obj=(itemId=40000001)=>({editorId:'g10:o20',itemId,source:{gridId:10,gridObjectId:20}});
function project({refs=[],scopeIndex={},itemId=40000001}={}){
 return api.projectDestinationProgressionVeto({objects:[obj(itemId)],progressionReferenceIndex:refIndex(refs),scopeIndex,source}).records[0];
}
test('candidate contract is read/preflight only and never grants positive permission',()=>{
 assert.equal(contract.status,'IMPLEMENTATION_READY_CANDIDATE');
 assert.equal(contract.wepContract.requiredRepresentativeBlocker,'PROTECTED_PROGRESSION_OBJECT_CONFLICT');
 assert.equal(contract.noPositiveInference.absenceOfReferenceVetoIsPermission,false);
 assert.equal(contract.writerBoundary.persistentWriteAuthorized,false);
 assert.equal(contract.writerBoundary.WORLD_PERSISTENT_WRITE_V125,false);
 assert.equal(contract.writerBoundary.applyAuthorized,false);
});
test('active exact address preserves v1.14 identity-change boundary',()=>{
 const r=project({refs:[{referenceId:'PR1',gridId:10,gridObjectId:20,itemId:40000001,activity:'ACTIVE',activeOwnershipVeto:true,evidenceStatus:'CONFIRMED'}]});
 assert.equal(r.activeReferenceDisposition,'ACTIVE_EXACT_ADDRESS');
 assert.ok(r.operationVetoes.REMOVE.includes('REFERENCE_SENSITIVE_OBJECT_IDENTITY_CHANGE_FORBIDDEN'));
 assert.ok(r.operationVetoes.DUPLICATE.includes('REFERENCE_SENSITIVE_OBJECT_IDENTITY_CHANGE_FORBIDDEN'));
 assert.ok(r.operationVetoes.REPLACE.includes('REFERENCE_SENSITIVE_OBJECT_IDENTITY_CHANGE_FORBIDDEN'));
 assert.equal(r.operationVetoes.MOVE.length,0);
 assert.equal(r.operationVetoes.ROTATE.length,0);
 assert.ok(r.operationVetoes.DESTINATION_OVERWRITE.includes('PROTECTED_PROGRESSION_OBJECT_CONFLICT'));
 assert.equal(r.positivePermission,false);
});
test('unknown system reference fails closed for every operation',()=>{
 const r=project({refs:[{referenceId:'PR2',gridId:10,gridObjectId:20,itemId:40000001,activity:'UNKNOWN',activeOwnershipVeto:true,evidenceStatus:'HIGH_CONFIDENCE'}]});
 for(const op of api.OPS)assert.ok(r.operationVetoes[op].includes('PROGRESSION_OWNERSHIP_UNKNOWN'));
 assert.equal(r.ownershipClass,'UNKNOWN_OWNERSHIP');
 assert.equal(r.evidenceStatus,'HIGH_CONFIDENCE');
});
test('historical address alone creates no active ownership veto and no permission',()=>{
 const r=project({refs:[{referenceId:'PR3',gridId:10,gridObjectId:20,itemId:40000001,activity:'HISTORICAL',activeOwnershipVeto:false,evidenceStatus:'CONFIRMED'}]});
 assert.equal(r.activeReferenceDisposition,'HISTORICAL_ONLY');
 assert.equal(r.negativeVetoFound,false);
 assert.equal(r.positivePermission,false);
 assert.equal(r.noVetoMeaning,'NO_VETO_FOUND_NOT_AUTHORIZED');
});
test('mission-item definition produces operation-complete negative vetoes',()=>{
 const r=project({scopeIndex:{40000001:{isMissionItem:true,forPuzzleOnly:false,explicitGridEditRestriction:false}}});
 assert.equal(r.ownershipClass,'QUEST_OWNED');
 for(const op of ['MOVE','ROTATE','REMOVE','DUPLICATE','REPLACE','STATE_EDIT'])assert.ok(r.operationVetoes[op].includes('QUEST_OWNED_OBJECT_MUTATION_FORBIDDEN'));
 assert.ok(r.operationVetoes.PRESET_CAPTURE.includes('PROTECTED_PROGRESSION_SOURCE_CAPTURE_EXCLUDED'));
 assert.ok(r.operationVetoes.DESTINATION_OVERWRITE.includes('PROTECTED_PROGRESSION_OBJECT_CONFLICT'));
});
test('puzzle-only and unknown restriction definition dispositions fail closed',()=>{
 const puzzle=project({scopeIndex:{40000001:{forPuzzleOnly:true}}});
 assert.equal(puzzle.ownershipClass,'PUZZLE_OWNED');
 assert.ok(puzzle.operationVetoes.MOVE.includes('PUZZLE_OWNED_OBJECT_MUTATION_FORBIDDEN'));
 const unknown=project({scopeIndex:{40000001:{explicitGridEditRestriction:true}}});
 assert.equal(unknown.ownershipClass,'UNKNOWN_OWNERSHIP');
 assert.ok(unknown.operationVetoes.ROTATE.includes('PROGRESSION_OWNERSHIP_UNKNOWN'));
});
test('absence of reference and definition risk remains unclassified, not user-controlled',()=>{
 const r=project();
 assert.equal(r.ownershipClass,'UNCLASSIFIED_NO_POSITIVE_INFERENCE');
 assert.equal(r.evidenceStatus,'UNKNOWN');
 assert.equal(r.negativeVetoFound,false);
 assert.equal(r.positivePermission,false);
});
test('projection rejects unsupported version/schema and preserves writer boundary',()=>{
 const index=refIndex();
 assert.throws(()=>api.projectDestinationProgressionVeto({objects:[obj()],progressionReferenceIndex:index,scopeIndex:{},source:{gameVersion:'1.24.13',profileSchemaVersion:624}}),/VERSION_UNSUPPORTED/);
 assert.throws(()=>api.projectDestinationProgressionVeto({objects:[obj()],progressionReferenceIndex:index,scopeIndex:{},source:{gameVersion:'1.25.0',profileSchemaVersion:623}}),/SCHEMA_UNSUPPORTED/);
 const out=api.projectDestinationProgressionVeto({objects:[obj()],progressionReferenceIndex:index,scopeIndex:{},source});
 assert.equal(out.semantics.absenceOfVetoIsPermission,false);
 assert.equal(out.writerBoundary.persistentWriteAuthorized,false);
 assert.equal(out.writerBoundary.WORLD_PERSISTENT_WRITE_V125,false);
 assert.equal(out.writerBoundary.applyAuthorized,false);
});
