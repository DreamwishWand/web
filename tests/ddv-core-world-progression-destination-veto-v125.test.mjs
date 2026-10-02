import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const veto=require('../static/ddv/core/world/v1.25/progression-destination-veto-v125.cjs');

function refIndex(references){
 const byGridObjectAddress={};
 for(const r of references){if(r.gridId!=null&&r.gridObjectId!=null)(byGridObjectAddress[String(r.gridId)+':'+String(r.gridObjectId)]??=[]).push(r.referenceId);}
 return {contract:'ddv.progression-reference-index@1',references,indexes:{byGridObjectAddress,byItemId:{}}};
}
const src={gameVersion:'1.25.0',profileSchemaVersion:624};
const scope={
  40001074:{isMissionItem:true,forPuzzleOnly:false,explicitGridEditRestriction:true,progressionOperationSignals:{MOVE:{kind:'CONDITIONAL'},ROTATE:{kind:'CONDITIONAL'},REMOVE:{kind:'CONSTANT',value:false}}},
  777:{isMissionItem:false,forPuzzleOnly:true,explicitGridEditRestriction:true},
  888:{isMissionItem:false,forPuzzleOnly:false,explicitGridEditRestriction:true}
};

test('active exact address produces a protected destination conflict without positive permission',()=>{
 const idx=refIndex([{referenceId:'PR1',gridId:7,gridObjectId:9,itemId:40001060,activity:'ACTIVE',activeOwnershipVeto:true,evidenceStatus:'CONFIRMED'}]);
 const out=veto.projectDestinationProgressionVeto({objects:[{itemId:40001060,source:{gridId:7,gridObjectId:9}}],progressionReferenceIndex:idx,scopeIndex:{},source:src});
 const r=out.records[0];
 assert.equal(r.activeReferenceDisposition,'ACTIVE_EXACT_ADDRESS');
 assert.equal(r.destinationProtected,true);
 assert.ok(r.operationVetoes.DESTINATION_OVERWRITE.includes('PROTECTED_PROGRESSION_OBJECT_CONFLICT'));
 assert.ok(r.operationVetoes.REMOVE.includes('REFERENCE_SENSITIVE_OBJECT_IDENTITY_CHANGE_FORBIDDEN'));
 assert.equal(r.positivePermission,false);
 assert.equal(out.writerBoundary.persistentWriteAuthorized,false);
});

test('unknown system reference fails closed while historical-only reference does not become active ownership',()=>{
 const idx=refIndex([
  {referenceId:'PRU',gridId:1,gridObjectId:2,itemId:123,activity:'UNKNOWN',activeOwnershipVeto:true,evidenceStatus:'HIGH_CONFIDENCE'},
  {referenceId:'PRH',gridId:3,gridObjectId:4,itemId:124,activity:'HISTORICAL',activeOwnershipVeto:false,evidenceStatus:'CONFIRMED'}
 ]);
 const out=veto.projectDestinationProgressionVeto({objects:[{itemId:123,source:{gridId:1,gridObjectId:2}},{itemId:124,source:{gridId:3,gridObjectId:4}}],progressionReferenceIndex:idx,scopeIndex:{},source:src});
 assert.equal(out.records[0].activeReferenceDisposition,'UNKNOWN_SYSTEM_REFERENCE');
 assert.ok(out.records[0].operationVetoes.DESTINATION_OVERWRITE.includes('PROTECTED_PROGRESSION_OBJECT_CONFLICT'));
 assert.equal(out.records[1].activeReferenceDisposition,'HISTORICAL_ONLY');
 assert.equal(out.records[1].destinationProtected,false);
 assert.equal(out.records[1].positivePermission,false);
 assert.equal(out.records[1].noVetoMeaning,'NO_VETO_FOUND_NOT_AUTHORIZED');
});

test('Core scope disposition protects Menhir definition and exposes operation-specific native vetoes',()=>{
 const out=veto.projectDestinationProgressionVeto({objects:[{itemId:40001074,source:{gridId:5,gridObjectId:6}}],progressionReferenceIndex:refIndex([]),scopeIndex:scope,source:src});
 const r=out.records[0];
 assert.equal(r.ownershipClass,'QUEST_OWNED');
 assert.ok(r.operationVetoes.REMOVE.includes('NATIVE_GRID_EDIT_RESTRICTION_FALSE'));
 assert.ok(r.operationVetoes.MOVE.includes('NATIVE_GRID_EDIT_RESTRICTION_CONDITION_UNRESOLVED'));
 assert.ok(r.operationVetoes.PRESET_CAPTURE.includes('PROTECTED_PROGRESSION_SOURCE_CAPTURE_EXCLUDED'));
 assert.ok(r.operationVetoes.DESTINATION_OVERWRITE.includes('PROTECTED_PROGRESSION_OBJECT_CONFLICT'));
 assert.equal(r.phaseClass,'UNKNOWN');
 assert.equal(r.positivePermission,false);
});

test('puzzle and restriction-only Core scope records fail closed without claiming USER_CONTROLLED',()=>{
 const out=veto.projectDestinationProgressionVeto({objects:[{itemId:777,source:{gridId:1,gridObjectId:7}},{itemId:888,source:{gridId:1,gridObjectId:8}}],progressionReferenceIndex:refIndex([]),scopeIndex:scope,source:src});
 assert.equal(out.records[0].ownershipClass,'PUZZLE_OWNED');
 assert.equal(out.records[0].destinationProtected,true);
 assert.equal(out.records[1].ownershipClass,'UNKNOWN_OWNERSHIP');
 assert.equal(out.records[1].destinationProtected,true);
 assert.equal(out.records[1].positivePermission,false);
});

test('missing definition risk and no references remains neutral-not-authorized rather than USER_CONTROLLED',()=>{
 const out=veto.projectDestinationProgressionVeto({objects:[{itemId:99999999,source:{gridId:8,gridObjectId:10}}],progressionReferenceIndex:refIndex([]),scopeIndex:scope,source:src});
 const r=out.records[0];
 assert.equal(r.ownershipClass,'UNCLASSIFIED_NO_POSITIVE_INFERENCE');
 assert.equal(r.destinationProtected,false);
 assert.equal(r.negativeVetoFound,false);
 assert.equal(r.positivePermission,false);
 assert.equal(r.noVetoMeaning,'NO_VETO_FOUND_NOT_AUTHORIZED');
 assert.equal(out.semantics.absenceOfVetoIsPermission,false);
});

test('pre-resolved Core definition dispositions are accepted without WEP reinterpreting source flags',()=>{
 const defs={42:{schema:'ddv.progression-definition-disposition-record@1',ownershipClass:'GLOBAL_SHARED_STATE',evidenceStatus:'CONFIRMED',reasonCodes:['CORE_RESOLVED_GLOBAL_BINDING'],nativeOperationVetoes:{REMOVE:['CORE_RESOLVED_REMOVE_VETO']}}};
 const out=veto.projectDestinationProgressionVeto({objects:[{itemId:42,source:{gridId:2,gridObjectId:4}}],progressionReferenceIndex:refIndex([]),definitionDispositionByItemId:defs,source:src});
 const r=out.records[0];
 assert.equal(r.ownershipClass,'GLOBAL_SHARED_STATE');
 assert.ok(r.operationVetoes.REMOVE.includes('CORE_RESOLVED_REMOVE_VETO'));
 assert.ok(r.operationVetoes.DESTINATION_OVERWRITE.includes('PROTECTED_PROGRESSION_OBJECT_CONFLICT'));
 assert.equal(r.positivePermission,false);
});

test('wrong version/schema fail closed before projection',()=>{
 assert.throws(()=>veto.projectDestinationProgressionVeto({objects:[],progressionReferenceIndex:refIndex([]),scopeIndex:scope,source:{gameVersion:'1.24.13',profileSchemaVersion:624}}),/VERSION_UNSUPPORTED/);
 assert.throws(()=>veto.projectDestinationProgressionVeto({objects:[],progressionReferenceIndex:refIndex([]),scopeIndex:scope,source:{gameVersion:'1.25.0',profileSchemaVersion:623}}),/SCHEMA_UNSUPPORTED/);
});
