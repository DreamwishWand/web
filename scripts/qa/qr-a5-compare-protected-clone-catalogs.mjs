#!/usr/bin/env node
// Offline catalog comparison only. Requires two *approved protected clone* snapshots.
// Does not connect to a database, approve Operator #130, or authorize SQL migration.
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
function stop(m){process.stderr.write('QR_A5_NO_GO: '+m+'\n');process.exit(2)}
const paths=process.argv.slice(2);
if(paths.length!==2)stop('NEED_TWO_PROTECTED_HISTORICAL116_CLONE_SNAPSHOTS; not live Staging');
const read=path=>{
 const s=readFileSync(path,'utf8'),x=JSON.parse(s);
 if(x.contract!=='ddvre.qr.a5-semantic-catalog@1'||x.source!=='PROTECTED_CLONE_CATALOG_NOT_STAGING')stop('UNTRUSTED_CLONE_CATALOG_PROVENANCE:'+path);
 for(const k of ['routines','relations','triggers','policies'])
  if(!Array.isArray(x[k]))stop('MISSING_CATALOG_SECTION:'+k);
 return {catalog:x,sha256:createHash('sha256').update(s).digest('hex')};
};
const a=read(paths[0]),b=read(paths[1]);
function diff(key,type,fields){
 const old=new Map(a.catalog[type].map(o=>[fields.map(k=>String(o[k])).join('|'),o]));
 const current=new Map(b.catalog[type].map(o=>[fields.map(k=>String(o[k])).join('|'),o]));
 const added=[...current.keys()].filter(x=>!old.has(x));
 const missing=[...old.keys()].filter(x=>!current.has(x));
 const changed=[...current.keys()].filter(x=>old.has(x)&&JSON.stringify(current.get(x))!==JSON.stringify(old.get(x)));
 return {key,added,missing,changed};
}
const changes=[
 diff('function_identity_and_acl','routines',['schema_name','function_name','arguments']),
 diff('RLS_and_table_privileges','relations',['schema_name','relation_name']),
 diff('trigger_topology','triggers',['schema_name','table_name','trigger_name']),
 diff('RLS_policy_topology','policies',['schema_name','table_name','policy_name'])
];
const after=b.catalog;
const fn=(name)=>after.routines.filter(x=>x.schema_name==='public'&&x.function_name===name);
const risky=['community_publish_preset_envelope','community_publish_scene_preset_product_v1','community_unpublish_scene_preset_v1','community_delete_scene_preset_v1'];
const exposed=risky.flatMap(n=>fn(n).filter(x=>x.service_role_execute||x.anon_execute||x.authenticated_execute||x.public_execute).map(x=>n+'('+x.arguments+')'));
const needed=['private.preset_storage_reservations_r18','private.preset_storage_release_gate_r18','private.preset_storage_work_read_suppressions_r19'];
const missingRelations=needed.filter(q=>!after.relations.some(r=>r.schema_name+'.'+r.relation_name===q));
const oldSceneRead=fn('community_get_scene_preset_public_v1').filter(x=>x.service_role_execute||x.anon_execute||x.authenticated_execute||x.public_execute);
const issues=[
 ...exposed.map(x=>'UNSAFE_LEGACY_RPC_EXECUTE:'+x),
 ...missingRelations.map(x=>'MISSING_SOURCE142_AUTHORITY:'+x),
 ...oldSceneRead.map(x=>'STAGE_ONLY_SCENE_READER_STILL_EXPOSED:'+x.arguments)
];
const result={
 marker:'QR_A5_PROTECTED_CLONE_SEMANTIC_REVIEW_REQUIRED_NOT_OPERATOR_APPROVAL',
 sourceAHash:a.sha256,sourceBHash:b.sha256,
 changes,
 unsafeKnownFunctions:issues,
 allCallerGraphReviewed:false,
 actualStorageObjectBytesRestored:false,
 privacyAndLegalApproval:false,
 signedHumanOperatorApproval:false,
 fullHistorical116DataParityProved:false,
 gateA5Approved:false,
 verdict:issues.length?'NO_GO_KNOWN_CATALOG_GAPS':'NO_GO_REQUIRES_HUMAN_SEMANTIC_AND_DATA_REVIEW'
};
process.stdout.write(JSON.stringify(result,null,2)+'\n');
process.exit(issues.length?1:0);
