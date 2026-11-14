#![cfg(all(feature="semantic-writer-dev",not(target_arch="wasm32")))]
use ddv_save_core::{BuildIdentity,BuildKind,Platform,ProductSession,WorkerAction,WorkerEnvelope,PRODUCT_WORKER_CONTRACT,ExistingAmountSelection,TypedSemanticCommand};
use ddv_save_core::portable_backup::{decode_inventory_amount_backup,encode_inventory_amount_backup,InventoryRestoreDisposition};
use serde_json::{json,Value};
use sha2::{Digest,Sha256};
const BUILD:&str="releases_1.25-v1.25.3-44-g0b41250d9ac0-incremental-22";
const F:u32=40300011;
const A:u32=30000089;
fn doc(a:u32,f:u32)->Value{json!({"GameInfo":{"Version":626},"World":{},"Player":{"ListInventories":{
"0":{"ID":0,"CompatibleItemType":"ItemType_Furniture","CompatibleFurnitureTypes":{"List":["FurnitureItemType_Door","FurnitureItemType_Default"]},"Inventory":{"40300011":{"Amount":f,"Marker":null,"Unknown":{"retain":true}}}},
"17":{"ID":17,"CompatibleItemType":"ItemType_ActivityItem","Inventory":{"30000089":{"Amount":a,"Marker":null,"Unknown":{"retain":true}}}}}}})}
fn open(v:&Value)->ProductSession{ProductSession::open_decoded_readonly(serde_json::to_vec(v).unwrap(),BuildIdentity{platform:Platform::SteamWindows,build_kind:BuildKind::SteamFullVersion,build_id:BUILD.into(),schema:626,externally_attested:true}).unwrap()}
fn env(s:&ProductSession,action:WorkerAction)->WorkerEnvelope{let r=s.receipt().unwrap();WorkerEnvelope{contract:PRODUCT_WORKER_CONTRACT,session_id:r.session_id,expected_revision:r.revision,expected_index_generation:r.index_generation,expected_decoded_sha256:r.decoded_sha256,action}}
#[test]
fn mixed_routes_qty_one_capture_review_no_authority(){
 let d=doc(1,1);let s=open(&d);let e=env(&s,WorkerAction::ReadDomain);let before=s.receipt().unwrap();
 let a=s.capture_inventory_amount_backup(e,17,A).unwrap();let z=s.capture_inventory_amount_backup(e,0,F).unwrap();
 for (bytes,route,item) in [(&a,17,A),(&z,0,F)]{
  let x=decode_inventory_amount_backup(bytes).unwrap();assert_eq!((x.inventory_id,x.item_id,x.amount),(route,item,1));
  let entry=&d["Player"]["ListInventories"][route.to_string()]["Inventory"][item.to_string()];
  assert_eq!(x.payload["entrySha256"],format!("{:x}",Sha256::digest(serde_json::to_vec(entry).unwrap())));
  assert_eq!(s.review_inventory_amount_restore(e,bytes,route,item).unwrap().disposition,InventoryRestoreDisposition::AlreadyMatches);
  assert!(s.read_existing_amount_target(e,ExistingAmountSelection::Inventory{inventory_id:route,item_id:item}).is_err());
  let cmd=TypedSemanticCommand::InventoryExistingAmountDecrease{inventory_id:route,canonical_item_id:item,expected_compatible_item_type:if route==0{"ItemType_Furniture"}else{"ItemType_ActivityItem"}.into(),expected_old_amount:1,new_amount:0};
  assert!(s.stage_typed_semantic_batch(env(&s,WorkerAction::Stage),&[cmd]).is_err());
 }
 assert_eq!(s.receipt().unwrap(),before);assert!(s.review_inventory_amount_restore(e,&z,17,A).is_err());
 let more=open(&doc(2,2));let me=env(&more,WorkerAction::ReadDomain);
 for (bytes,route,item) in [(&a,17,A),(&z,0,F)]{
  assert_eq!(more.review_inventory_amount_restore(me,bytes,route,item).unwrap().disposition,InventoryRestoreDisposition::PositiveDecreaseCandidate);
  let two=more.capture_inventory_amount_backup(me,route,item).unwrap();
  assert_eq!(s.review_inventory_amount_restore(e,&two,route,item).unwrap().disposition,InventoryRestoreDisposition::IncreaseUnsupported);
 }
 assert_eq!(more.receipt().unwrap().revision,0);assert_eq!(s.receipt().unwrap(),before);
}
#[test]
fn zero_route_wire_integrity_not_mask_or_restore_authority(){
 let s=open(&doc(1,1));let e=env(&s,WorkerAction::ReadDomain);let z=s.capture_inventory_amount_backup(e,0,F).unwrap();
 let x=decode_inventory_amount_backup(&z).unwrap();let raw=serde_json::to_vec(&x.payload).unwrap();
 assert_eq!(encode_inventory_amount_backup(0,F,&x.source_decoded_sha256,&raw).unwrap(),z);
 for (route,item,ty) in [(0,A,"ItemType_Furniture"),(0,F,"ItemType_ActivityItem"),(0,0,"ItemType_Furniture")]{
  let mut p=x.payload.clone();p["itemType"]=json!(ty);assert!(encode_inventory_amount_backup(route,item,&x.source_decoded_sha256,&serde_json::to_vec(&p).unwrap()).is_err());
 }
 for mask in [json!({"List":["FurnitureItemType_Default"]}),json!({"List":["FurnitureItemType_Door","FurnitureItemType_Door"]}),json!({"List":["FurnitureItemType_Door"],"Other":true}),json!({"List":["FurnitureItemType_Future"]})]{
  let mut d=doc(1,1);d["Player"]["ListInventories"]["0"]["CompatibleFurnitureTypes"]=mask;
  let bad=open(&d);let be=env(&bad,WorkerAction::ReadDomain);
  assert!(bad.capture_inventory_amount_backup(be,0,F).is_err());assert!(bad.review_inventory_amount_restore(be,&z,0,F).is_err());
 }
 let mut p=x.payload.clone();p["unknownRestore"]=json!(true);let extra=encode_inventory_amount_backup(0,F,&x.source_decoded_sha256,&serde_json::to_vec(&p).unwrap()).unwrap();
 assert!(decode_inventory_amount_backup(&extra).is_ok());assert!(s.review_inventory_amount_restore(e,&extra,0,F).is_err());
 let mut v:Value=serde_json::from_slice(&z).unwrap();
 for value in [json!("0"),json!(0.0),json!(-1),json!(4294967296u64)]{
  let mut a=v.clone();a["target"]["inventoryId"]=value;a.as_object_mut().unwrap().remove("sha256");
  a["sha256"]=json!(format!("{:x}",Sha256::digest(serde_json::to_vec(&a).unwrap())));
  assert!(decode_inventory_amount_backup(&serde_json::to_vec(&a).unwrap()).is_err());
 }
 v["payload"]["amount"]=json!(2);assert!(decode_inventory_amount_backup(&serde_json::to_vec(&v).unwrap()).is_err());
 let foreign=open(&doc(1,1));assert!(foreign.review_inventory_amount_restore(e,&z,0,F).is_err());
 let mut stale=e;stale.expected_index_generation+=1;assert!(s.capture_inventory_amount_backup(stale,0,F).is_err());
 let mut wrong=e;wrong.action=WorkerAction::Stage;assert!(s.review_inventory_amount_restore(wrong,&z,0,F).is_err());
 s.close().unwrap();assert!(s.capture_inventory_amount_backup(e,0,F).is_err());
}

#[test]
fn existing_dev_core_zero_route_decrease_two_to_one_exact_and_no_product_authority(){
 let mut expected=doc(2,2);let s=open(&expected);let e=env(&s,WorkerAction::ReadDomain);
 let w=s.read_existing_amount_target(e,ExistingAmountSelection::Inventory{inventory_id:0,item_id:F}).unwrap();
 assert_eq!(w.view().old_amount,2);
 assert!(s.authorize_existing_amount_target(e,&w,1).is_err());
 let cmd=TypedSemanticCommand::InventoryExistingAmountDecrease{inventory_id:0,canonical_item_id:F,expected_compatible_item_type:"ItemType_Furniture".into(),expected_old_amount:2,new_amount:1};
 let staged=s.stage_typed_semantic_batch(env(&s,WorkerAction::Stage),&[cmd]).unwrap();
 assert_eq!(staged.exact_field_changed_count,1);assert!(!staged.product_writer_authorized);assert!(!staged.native_v3_verified);
 let bytes=s.take_typed_semantic_decoded_once(env(&s,WorkerAction::ExportEditedCopy)).unwrap();
 expected["Player"]["ListInventories"]["0"]["Inventory"]["40300011"]["Amount"]=json!(1);
 assert_eq!(bytes,serde_json::to_vec(&expected).unwrap());
 assert!(s.capture_inventory_amount_backup(e,0,F).is_err());
}
