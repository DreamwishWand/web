#![cfg(all(feature="semantic-writer-dev",not(target_arch="wasm32")))]
use ddv_save_core::{BuildIdentity,BuildKind,Platform,ProductSession,WorkerAction,WorkerEnvelope,PRODUCT_WORKER_CONTRACT,ExistingAmountSelection,TypedSemanticCommand};
use sha2::{Digest,Sha256};
const FULL:&str="releases_1.25-v1.25.3-44-g0b41250d9ac0-incremental-22";
const RAW:&str=r#"{"GameInfo":{"Version":626},"World":{},"Player":{"ListInventories":{"0":{"ID":0,"CompatibleItemType":"ItemType_Furniture","CompatibleFurnitureTypes":{"List":["FurnitureItemType_SnippetTrap"]},"Inventory":{"40000001":{"Amount":8},"40900001":{"Amount":12, "Marker":"Keep","Unknown":[1,null]}}},"4":{"ID":4,"CompatibleItemType":"ItemType_ActivityItem","Inventory":{"30000001":{"Amount":9}}}},"ContainerInventories":{"12":{"ID":12,"ParentItemID":40000047,"BelongsToPlayer":true,"BlockMoveTo":false,"Size":1,"ExtraSize":0,"Inventory":[{"ItemID":30000002,"Amount":9,"State":{}}]}}},"Unknown":{"Keep":true}}"#;
fn open(raw:&str)->ProductSession{ProductSession::open_decoded_readonly(raw.as_bytes().to_vec(),BuildIdentity{platform:Platform::SteamWindows,build_kind:BuildKind::SteamFullVersion,build_id:FULL.into(),schema:626,externally_attested:true}).unwrap()}
fn e(s:&ProductSession,a:WorkerAction)->WorkerEnvelope{let r=s.receipt().unwrap();WorkerEnvelope{contract:PRODUCT_WORKER_CONTRACT,session_id:r.session_id,expected_revision:r.revision,expected_index_generation:r.index_generation,expected_decoded_sha256:r.decoded_sha256,action:a}}
fn sel(i:u32,k:u32)->ExistingAmountSelection{ExistingAmountSelection::Inventory{inventory_id:i,item_id:k}}
fn cmd(k:u32,old:u32,new:u32)->TypedSemanticCommand{TypedSemanticCommand::InventoryExistingAmountDecrease{inventory_id:0,canonical_item_id:k,expected_compatible_item_type:"ItemType_Furniture".into(),expected_old_amount:old,new_amount:new}}
#[test]
fn actual_shared_guard_atomic_replay_and_exact_bytes(){
 let s=open(RAW);let before=s.receipt().unwrap();let read=e(&s,WorkerAction::ReadDomain);let stage=e(&s,WorkerAction::Stage);
 let w=s.read_existing_amount_target(read,sel(0,40900001)).unwrap();assert_eq!(w,s.find_one_existing_inventory_amount_target(read).unwrap());assert_eq!(w.view().entry_sha256,<[u8;32]>::from(Sha256::digest(br#"{"Amount":12, "Marker":"Keep","Unknown":[1,null]}"#)));
 assert_eq!(w.view().old_amount,12);assert!(s.read_existing_amount_target(read,sel(0,40000001)).is_err());assert!(s.read_existing_amount_target(read,sel(4,30000001)).is_ok());assert!(s.read_existing_amount_target(read,ExistingAmountSelection::Chest{container_id:12,slot_index:0}).is_ok());
 assert!(s.authorize_existing_amount_target(read,&w,11).is_err());assert!(open(RAW).stage_typed_semantic_batch(stage,&[cmd(40900001,12,11)]).is_err());
 for batch in [vec![cmd(40900001,11,10)],vec![cmd(40900001,12,0)],vec![cmd(40900001,12,13)],vec![cmd(40900001,12,12)],vec![cmd(40900001,12,11),cmd(40900001,12,10)],vec![cmd(40900001,12,11),cmd(40000001,8,7)],vec![cmd(0,12,11)]]{assert!(s.stage_typed_semantic_batch(stage,&batch).is_err());assert_eq!(s.receipt().unwrap(),before);}
 let r=s.stage_typed_semantic_batch(stage,&[cmd(40900001,12,11)]).unwrap();assert_eq!(r.exact_field_changed_count,1);assert!(!r.product_writer_authorized);assert!(!r.native_v3_verified);assert!(!r.original_overwrite_authorized);
 assert!(s.stage_typed_semantic_batch(stage,&[cmd(40900001,12,11)]).is_err());assert!(s.read_existing_amount_target(read,sel(0,40900001)).is_err());
 s.undo_typed_semantic_batch(e(&s,WorkerAction::Stage)).unwrap();assert!(s.take_typed_semantic_decoded_once(e(&s,WorkerAction::ExportEditedCopy)).is_err());s.redo_typed_semantic_batch(e(&s,WorkerAction::Stage)).unwrap();
 let export=e(&s,WorkerAction::ExportEditedCopy);let out=s.take_typed_semantic_decoded_once(export).unwrap();assert_eq!(out,RAW.replace("\"Amount\":12,","\"Amount\":11,").as_bytes());assert!(s.take_typed_semantic_decoded_once(export).is_err());
}
#[test]
fn restriction_denial_same_read_and_stage(){
 for list in ["[]","null","[\"FurnitureItemType_Default\"]","[\"FurnitureItemType_SnippetTrap\",\"FurnitureItemType_SnippetTrap\"]","[\"FurnitureItemType_SnippetTrap\",\"Unknown\"]","[9]"]{
  let raw=RAW.replace("[\"FurnitureItemType_SnippetTrap\"]",list);let s=open(&raw);let before=s.receipt().unwrap();assert!(s.read_existing_amount_target(e(&s,WorkerAction::ReadDomain),sel(0,40900001)).is_err());assert!(s.stage_typed_semantic_batch(e(&s,WorkerAction::Stage),&[cmd(40900001,12,11)]).is_err());assert_eq!(s.receipt().unwrap(),before);
 }
 for raw in [RAW.replace("\"ID\":0","\"ID\":1"),RAW.replace("\"CompatibleFurnitureTypes\":","\"OtherRestriction\":"),RAW.replace("\"CompatibleFurnitureTypes\":","\"CompatibleActivityItemTypes\":{},\"CompatibleFurnitureTypes\":"),RAW.replace("\"List\":[","\"Other\":{},\"List\":[")]{
  let s=open(&raw);assert!(s.read_existing_amount_target(e(&s,WorkerAction::ReadDomain),sel(0,40900001)).is_err());assert!(s.stage_typed_semantic_batch(e(&s,WorkerAction::Stage),&[cmd(40900001,12,11)]).is_err());
 }
}
