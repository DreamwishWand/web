#![cfg(feature="semantic-writer-dev")]
use ddv_save_core::{BuildIdentity,BuildKind,Platform,ProductSession,WorkerEnvelope,WorkerAction,PRODUCT_WORKER_CONTRACT,ExistingAmountSelection,TypedSemanticCommand};
use ddv_save_core::portable_backup::{decode_inventory_amount_backup as decode,encode_inventory_amount_backup as encode,InventoryRestoreDisposition as D};
use serde_json::json;
const ITEM:u32=30000001;
fn open(amount:u32,kind:&str)->ProductSession{
 let doc=json!({"GameInfo":{"Version":626},"World":{},"Player":{"ListInventories":{"4":{"ID":4,"CompatibleItemType":kind,"Inventory":{"30000001":{"Amount":amount,"Unknown":{"Keep":[1,"雪",null]}},"30000002":{"Amount":12,"Marker":"neighbor"}}}}}});
 ProductSession::open_decoded_readonly(serde_json::to_vec(&doc).unwrap(),BuildIdentity{platform:Platform::SteamWindows,build_kind:BuildKind::SteamFullVersion,build_id:"releases_1.25-v1.25.3-44-g0b41250d9ac0-incremental-22".into(),schema:626,externally_attested:true}).unwrap()
}
fn scope(s:&ProductSession,action:WorkerAction)->WorkerEnvelope{let r=s.receipt().unwrap();WorkerEnvelope{contract:PRODUCT_WORKER_CONTRACT,session_id:r.session_id,expected_revision:r.revision,expected_index_generation:r.index_generation,expected_decoded_sha256:r.decoded_sha256,action}}
fn hex(b:&[u8])->String{b.iter().map(|x|format!("{x:02x}")).collect::<Vec<_>>().concat()}
fn capture(s:&ProductSession)->Vec<u8>{s.capture_inventory_amount_backup(scope(s,WorkerAction::ReadDomain),4,ITEM).unwrap()}
#[test]
fn exact_capture_witness_and_review_is_nonmutating(){
 let source=open(2,"ItemType_ActivityItem");let before=source.receipt().unwrap();let bytes=capture(&source);let backup=decode(&bytes).unwrap();
 let w=source.read_existing_amount_target(scope(&source,WorkerAction::ReadDomain),ExistingAmountSelection::Inventory{inventory_id:4,item_id:ITEM}).unwrap();
 assert_eq!(backup.amount,2);assert_eq!(backup.source_decoded_sha256,hex(&w.view().decoded_sha256));assert_eq!(backup.payload["entrySha256"],hex(&w.view().entry_sha256));assert_eq!(backup.payload["itemType"],"ItemType_ActivityItem");assert_eq!(backup.payload.as_object().unwrap().len(),3);assert_eq!(capture(&source),bytes);
 for (n,expected) in [(2,D::AlreadyMatches),(9999,D::PositiveDecreaseCandidate)]{let current=open(n,"ItemType_ActivityItem");let e=scope(&current,WorkerAction::ReadDomain);let review=current.review_inventory_amount_restore(e,&bytes,4,ITEM).unwrap();assert_eq!(review.disposition,expected);assert_eq!((review.current_amount,review.backup_amount),(n,2));assert_eq!(review.session_id,e.session_id);assert_eq!(review.current_decoded_sha256,e.expected_decoded_sha256);assert_eq!(scope(&current,WorkerAction::ReadDomain).expected_decoded_sha256,e.expected_decoded_sha256);assert_eq!(capture(&current),capture(&current));assert_eq!(current.receipt().unwrap().revision,0);}
 let upper=open(9999,"ItemType_ActivityItem");let big=capture(&upper);assert_eq!(source.review_inventory_amount_restore(scope(&source,WorkerAction::ReadDomain),&big,4,ITEM).unwrap().disposition,D::IncreaseUnsupported);
 assert_eq!(source.receipt().unwrap().decoded_sha256,before.decoded_sha256);assert_eq!(source.receipt().unwrap().revision,before.revision);
 println!("QA1139_CAPTURE_EXACT_3_DISPOSITIONS_NONMUTATING");
}
#[test]
fn forged_current_epoch_target_and_opaque_payload_fail_closed(){
 let s=open(50,"ItemType_ActivityItem");let e=scope(&s,WorkerAction::ReadDomain);let bytes=capture(&s);let backup=decode(&bytes).unwrap();let mut n=0;
 for mut bad in [e]{bad.expected_decoded_sha256[0]^=1;assert!(s.review_inventory_amount_restore(bad,&bytes,4,ITEM).is_err());n+=1;}
 let mut variants=vec![e;3];variants[0].expected_revision+=1;variants[1].expected_index_generation+=1;variants[2].action=WorkerAction::Stage;
 for bad in variants{assert!(s.capture_inventory_amount_backup(bad,4,ITEM).is_err());assert!(s.review_inventory_amount_restore(bad,&bytes,4,ITEM).is_err());n+=2;}
 let foreign=open(50,"ItemType_ActivityItem");assert!(foreign.review_inventory_amount_restore(e,&bytes,4,ITEM).is_err());n+=1;
 for (i,item) in [(0,ITEM),(4,ITEM+1),(5,ITEM)]{assert!(s.review_inventory_amount_restore(e,&bytes,i,item).is_err());n+=1;}
 for (key,value) in [("entrySha256",json!("A".repeat(64))),("entrySha256",json!(["a"])),("itemType",json!(["ItemType_ActivityItem"])),("itemType",json!("ItemType_Furniture")),("restoreAuthorized",json!(true)),("opaque",json!({"amount":49}))]{let mut payload=backup.payload.clone();payload[key]=value;let raw=encode(4,ITEM,&backup.source_decoded_sha256,&serde_json::to_vec(&payload).unwrap()).unwrap();assert!(decode(&raw).is_ok());assert!(s.review_inventory_amount_restore(e,&raw,4,ITEM).is_err());n+=1;}
 // Untrusted but syntactically valid historic hashes are metadata, not authority.
 let mut payload=backup.payload.clone();payload["entrySha256"]=json!("b".repeat(64));payload["amount"]=json!(49);let raw=encode(4,ITEM,&"c".repeat(64),&serde_json::to_vec(&payload).unwrap()).unwrap();let review=s.review_inventory_amount_restore(e,&raw,4,ITEM).unwrap();assert_eq!(review.disposition,D::PositiveDecreaseCandidate);assert_eq!(review.backup_entry_sha256,"b".repeat(64));assert_eq!(review.current_decoded_sha256,e.expected_decoded_sha256);assert_eq!(capture(&s),bytes);assert_eq!(s.receipt().unwrap().revision,0);
 println!("QA1139_{n}_NEG_ADVISORY_HASH_NOT_AUTHORITY");
}
#[test]
fn stage_undo_stale_close_never_restore(){
 let s=open(50,"ItemType_ActivityItem");let e=scope(&s,WorkerAction::ReadDomain);let raw=capture(&s);
 s.stage_typed_semantic_batch(scope(&s,WorkerAction::Stage),&[TypedSemanticCommand::InventoryExistingAmountDecrease{inventory_id:4,canonical_item_id:ITEM,expected_compatible_item_type:"ItemType_ActivityItem".into(),expected_old_amount:50,new_amount:49}]).unwrap();
 assert!(s.review_inventory_amount_restore(e,&raw,4,ITEM).is_err());assert!(s.capture_inventory_amount_backup(scope(&s,WorkerAction::ReadDomain),4,ITEM).is_err());
 s.undo_typed_semantic_batch(scope(&s,WorkerAction::Stage)).unwrap();assert!(s.review_inventory_amount_restore(e,&raw,4,ITEM).is_err());assert!(s.review_inventory_amount_restore(scope(&s,WorkerAction::ReadDomain),&raw,4,ITEM).is_err());
 s.close().unwrap();assert!(s.review_inventory_amount_restore(e,&raw,4,ITEM).is_err());
 println!("QA1139_STAGE_UNDO_CLOSE_DENIAL_PASS");
}
