/* 01B canonical storage candidate entrypoint — Switch DDV v1.25 only. */
'use strict';
import {
  buildStorageActiveReferenceIndexV125,
  selectStorageActiveReferenceEvidenceV125
} from './storage-active-reference-index-v125.js';
import {
  STORAGE_SAME_GRID_ADAPTER_ID,
  STORAGE_TRANSACTION_BINDING_CONTRACT,
  createVerifiedStorageBindingCandidateV125,
  verifyStorageBindingCandidateV125
} from './storage-transition-binding-v125.js';

function equal(a,b){return JSON.stringify(a)===JSON.stringify(b);}
function expectedBeforeCount(plan){
  const mode=plan?.intent?.mode;
  if(mode==='SAME_GRID_MOVE'||mode==='CROSS_GRID_MOVE'||mode==='PUT_AWAY_NONEMPTY')return 1;
  if(mode==='REPLACE_NONEMPTY')return 0;
  throw Error('STORAGE_BINDING_MODE_REQUIRED');
}

export async function createVerifiedStorageBindingCandidateFromCurrentSaveV125({session,plan,itemDefinitionsById}={}){
  if(!session||typeof session.getSnapshot!=='function')throw Error('STORAGE_SAFE_SESSION_REQUIRED');
  if(!plan||plan.intent?.bindingContract!==STORAGE_TRANSACTION_BINDING_CONTRACT)throw Error('STORAGE_BINDING_PLAN_REQUIRED');
  const index=buildStorageActiveReferenceIndexV125({
    source:{platform:'Nintendo Switch',gameVersion:'1.25.0',profileSchemaVersion:624,buildIdentity:'52BD625D9B4E0053'},
    profile:session.getSnapshot(),itemDefinitionsById
  });
  const evidence=selectStorageActiveReferenceEvidenceV125({
    index,
    containerInventoryId:plan.intent.containerInventoryId,
    expectedReferenceCount:expectedBeforeCount(plan)
  });
  if(!equal(evidence,plan.intent.activeReferenceEvidence))throw Error('STORAGE_ACTIVE_REFERENCE_PLAN_BINDING_MISMATCH');
  const candidate=await createVerifiedStorageBindingCandidateV125({session,plan});
  return Object.freeze({candidate,activeReferenceIndex:index,activeReferenceEvidence:evidence});
}

export async function verifyStorageBindingCandidateFromCurrentSaveV125({candidate,codec,itemDefinitionsById}={}){
  const verification=await verifyStorageBindingCandidateV125({candidate,codec});
  if(candidate?.plan?.mutationAdapter?.id===STORAGE_SAME_GRID_ADAPTER_ID){
    // SAME_GRID_MOVE uses generic GRID_OBJECT verification. Its candidate diff is X/Y-only,
    // so source COMPLETE_CURRENT_SAVE projection plus exact changed-path verification proves
    // the storage reference cannot be added, removed, or redirected by the candidate.
    if(!itemDefinitionsById)throw Error('STORAGE_ITEM_DEFINITIONS_REQUIRED_FOR_SAME_GRID_VERIFY');
  }
  return Object.freeze({contract:STORAGE_TRANSACTION_BINDING_CONTRACT,status:'PASS',verification});
}
