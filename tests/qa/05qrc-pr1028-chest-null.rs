// Independent test-only module, included in temporary test checkout only.
use super::*;
use crate::{BuildIdentity,SessionReceipt};
const RAW:&str=r#"{"GameInfo":{"Version":626},"World":{},"Player":{"ListInventories":{"4":{"ID":4,"CompatibleItemType":"ItemType_ActivityItem","Inventory":{"30000001":{"Amount":9}}}},"ContainerInventories":{"12":{"ID":12,"ParentItemID":40000047,"BelongsToPlayer":true,"BlockMoveTo":false,"Size":2,"ExtraSize":0,"Inventory":[{"ItemID":30000002, "State" : null, "Amount":12,"Unknown":[null,{"X":"🌿"}]},{"ItemID":30000003,"Amount":7,"State":{}}]}}},"Unknown":{"Keep":true}}"#;
const ENTRY:&str=r#"{"ItemID":30000002, "State" : null, "Amount":12,"Unknown":[null,{"X":"🌿"}]}"#;
fn open(raw:&str)->CoreResult<ProductSession>{ProductSession::open_decoded_readonly(raw.as_bytes().to_vec(),BuildIdentity{platform:Platform::SteamWindows,build_kind:BuildKind::SteamFullVersion,build_id:EXACT_STEAM.into(),schema:626,externally_attested:true})}
fn e(s:&ProductSession,a:WorkerAction)->WorkerEnvelope{let r:SessionReceipt=s.receipt().unwrap();WorkerEnvelope{contract:PRODUCT_WORKER_CONTRACT,session_id:r.session_id,expected_revision:r.revision,expected_index_generation:r.index_generation,expected_decoded_sha256:r.decoded_sha256,action:a}}
fn sel(n:usize)->ExistingAmountSelection{ExistingAmountSelection::Chest{container_id:12,slot_index:n}}
fn read(s:&ProductSession,n:usize)->CoreResult<CoreExistingAmountTarget>{s.read_existing_amount_target(e(s,WorkerAction::ReadDomain),sel(n))}
fn grant(s:&ProductSession,n:usize,new_amount:u32)->AuthorizedExistingAmountTarget{AuthorizedExistingAmountTarget{target:read(s,n).unwrap(),new_amount}}
#[test]
fn qac1028_old_new_state_causal(){
 let s=open(RAW).unwrap();let old=std::env::var("QA1028_EXPECT_OLD").is_ok();
 let empty=open(&RAW.replace(" : null"," : { \n }")).unwrap();let t=read(&empty,0).unwrap();assert_eq!(t.view().chest.as_ref().unwrap().state_sha256,sha(b"{ \n }"));
 if old{assert_eq!(read(&s,0).unwrap_err().0,"AMOUNT_CHEST_STATE_UNRESOLVED");return}
 let t=read(&s,0).unwrap();assert_eq!(t.view().entry_sha256,sha(ENTRY.as_bytes()));assert_eq!(t.view().chest.as_ref().unwrap().state_sha256,sha(b"null"));assert_ne!(t.view().chest.as_ref().unwrap().state_sha256,read(&empty,0).unwrap().view().chest.as_ref().unwrap().state_sha256);
 assert_eq!(t.view().old_amount,12);assert_eq!(read(&s,1).unwrap().view().old_amount,7);
 assert_eq!(s.authorize_existing_amount_target(e(&s,WorkerAction::ReadDomain),&t,11).unwrap_err().0,"AMOUNT_TARGET_NATIVE_AUTHORITY_UNAVAILABLE");
}
#[test]
fn qac1028_state_shape_and_native_bounds(){
 let states=["\"null\"","[]","false","0","{\"Unknown\":null}","{\"State\":{}}","{\"Case\":0}"];
 for state in states{let raw=RAW.replace(" : null",&format!(" : {state}"));let s=open(&raw).unwrap();let before=s.receipt().unwrap();assert!(read(&s,0).is_err(),"{state}");assert!(read(&s,1).is_ok());assert_eq!(s.receipt().unwrap(),before);}
 let variants=[RAW.replace("\"State\" : null, ",""),RAW.replace("\"State\" : null","\"State\" : null, \"\\u0053tate\":{}"),RAW.replace("\"State\" : null","\"State\" : {}, \"State\":null"),RAW.replace("\"BelongsToPlayer\":true","\"BelongsToPlayer\":false"),RAW.replace("\"BlockMoveTo\":false","\"BlockMoveTo\":true"),RAW.replace("\"ParentItemID\":40000047","\"ParentItemID\":30000047"),RAW.replace("\"Size\":2","\"Size\":3"),RAW.replace("\"ExtraSize\":0","\"ExtraSize\":2"),RAW.replace("\"Amount\":12","\"Amount\":51"),RAW.replace("\"Amount\":12","\"Amount\":1"),RAW.replace("\"ItemID\":30000002","\"ItemID\":31300001"),RAW.replace("\"ID\":12","\"ID\":13")];
 for (i,raw) in variants.iter().enumerate(){if let Ok(s)=open(raw){assert!(read(&s,0).is_err(),"variant {i}");}}
}
#[test]
fn qac1028_sealed_minted_atomic_exact_bytes(){
 let s=open(RAW).unwrap();let before=s.receipt().unwrap();let stage=e(&s,WorkerAction::Stage);let re=e(&s,WorkerAction::ReadDomain);let t=read(&s,0).unwrap();
 let mut forged=t.clone();forged.view.chest.as_mut().unwrap().state_sha256=sha(b"{}");assert_eq!(s.authorize_existing_amount_target(re,&forged,11).unwrap_err().0,"AMOUNT_TARGET_SCOPE_OR_WITNESS_CAS");
 let mut bad=t.clone();bad.view.entry_sha256[0]^=1;
 let bad_grant=AuthorizedExistingAmountTarget{target:bad,new_amount:11};
 assert!(s.stage_core_minted_amount_batch(stage,&[grant(&s,1,6),bad_grant]).is_err());
 let other=open(RAW).unwrap();assert!(s.stage_core_minted_amount_batch(stage,&[grant(&s,0,11),grant(&other,1,6)]).is_err());
 for n in [0,12,13]{assert!(s.stage_core_minted_amount_batch(stage,&[grant(&s,0,n)]).is_err());}
 assert!(s.stage_core_minted_amount_batch(stage,&[grant(&s,0,11),grant(&s,0,10)]).is_err());
 let mut stale=stage;stale.expected_index_generation+=1;assert!(s.stage_core_minted_amount_batch(stale,&[grant(&s,0,11)]).is_err());
 assert_eq!(s.receipt().unwrap(),before);
 let r=s.stage_core_minted_amount_batch(stage,&[grant(&s,0,11)]).unwrap();assert_eq!(r.exact_field_changed_count,1);assert!(!r.product_writer_authorized&&!r.native_v3_verified&&!r.original_overwrite_authorized);
 assert!(s.read_existing_amount_target(re,sel(0)).is_err());
 s.undo_typed_semantic_batch(e(&s,WorkerAction::Stage)).unwrap();assert!(s.take_typed_semantic_decoded_once(e(&s,WorkerAction::ExportEditedCopy)).is_err());s.redo_typed_semantic_batch(e(&s,WorkerAction::Stage)).unwrap();
 let export=e(&s,WorkerAction::ExportEditedCopy);let bytes=s.take_typed_semantic_decoded_once(export).unwrap();assert_eq!(bytes,RAW.replace("\"Amount\":12","\"Amount\":11").as_bytes());assert!(s.take_typed_semantic_decoded_once(export).is_err());
 let fresh=open(std::str::from_utf8(&bytes).unwrap()).unwrap();let rt=read(&fresh,0).unwrap();assert_eq!(rt.view().old_amount,11);assert_eq!(rt.view().chest.as_ref().unwrap().state_sha256,sha(b"null"));assert_eq!(read(&fresh,1).unwrap().view().old_amount,7);assert!(fresh.authorize_existing_amount_target(e(&fresh,WorkerAction::ReadDomain),&t,10).is_err());
}
