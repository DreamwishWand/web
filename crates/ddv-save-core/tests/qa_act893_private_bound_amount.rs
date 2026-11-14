#![cfg(all(feature="private-native-v2",feature="semantic-writer-dev",not(target_arch="wasm32")))]
use ddv_save_core::{BuildIdentity,BuildKind,Platform,ProductSession,WorkerAction,WorkerEnvelope,PRODUCT_WORKER_CONTRACT,ExistingAmountSelection};
use serde_json::{json,Value};
use sha2::{Digest,Sha256};
use std::{sync::{Arc,Barrier},thread};
const STEAM:&str="releases_1.25-v1.25.3-44-g0b41250d9ac0-incremental-22";
const ORIGINAL:[u8;32]=[21;32];
const C:u32=30200071;const F:u32=40000077;
fn h(b:impl AsRef<[u8]>)->String{format!("{:x}",Sha256::digest(b.as_ref()))}
fn hx(b:&[u8])->String{b.iter().map(|x|format!("{x:02x}")).collect()}
fn doc()->Value{
 let mut a=vec![json!({"ItemID":0,"Amount":0,"State":null});48];
 a[0]=json!({"ItemID":C,"Amount":50,"State":null,"tag":"other"});
 a[47]=json!({"ItemID":C,"Amount":50,"State":null,"tag":"selected","Unknown":[false,7]});
 json!({"GameInfo":{"Version":626},"World":{},"Player":{"ContainerInventories":{"29":{"ID":29,"ParentItemID":40000047,"BelongsToPlayer":true,"BlockMoveTo":false,"Size":48,"ExtraSize":0,"Inventory":a}},
 "ListInventories":{"0":{"ID":0,"CompatibleItemType":"ItemType_Furniture","CompatibleFurnitureTypes":{"List":["FurnitureItemType_Default"]},"Inventory":{"40000077":{"Amount":2,"Marker":null,"Unknown":{"x":false}}}},"4":{"ID":4,"CompatibleItemType":"ItemType_ActivityItem","Inventory":{"30200071":{"Amount":50}}}}},"Unknown":{"preserve":"星"}})
}
fn open(d:&Value)->ProductSession{ProductSession::open_decoded_readonly(serde_json::to_vec(d).unwrap(),BuildIdentity{platform:Platform::SteamWindows,build_kind:BuildKind::SteamFullVersion,build_id:STEAM.into(),schema:626,externally_attested:true}).unwrap()}
fn env(s:&ProductSession,a:WorkerAction)->WorkerEnvelope{let r=s.receipt().unwrap();WorkerEnvelope{contract:PRODUCT_WORKER_CONTRACT,session_id:r.session_id,expected_revision:r.revision,expected_index_generation:r.index_generation,expected_decoded_sha256:r.decoded_sha256,action:a}}
fn plan(d:&Value,chest:bool)->Value{
 let entry=if chest{&d["Player"]["ContainerInventories"]["29"]["Inventory"][47]}else{&d["Player"]["ListInventories"]["0"]["Inventory"]["40000077"]};
 json!({"contract":if chest{"wand.private.steam626.chest-crop-existing-50-to-49@1"}else{"wand.private.steam626.catalog0-ordinary-existing-decrease-one@1"},"fullVersion":STEAM,"sourceDecodedSha256":h(serde_json::to_vec(d).unwrap()),"originalSha256":hx(&ORIGINAL),"originalSizeBytes":987,"backupSha256":hx(&ORIGINAL),"backupSizeBytes":987,"revision":0,"indexGeneration":1,
 "selector":if chest{json!({"containerId":29,"slotIndex":47})}else{json!({"inventoryId":0,"itemId":F})},
 "target":{"itemId":if chest{C}else{F},"oldAmount":if chest{50}else{2},"newAmount":if chest{49}else{1},"compatibleItemType":if chest{"ItemType_ActivityItem"}else{"ItemType_Furniture"},"entrySha256":h(serde_json::to_vec(entry).unwrap()),"chest":if chest{json!({"parentItemId":40000047,"belongsToPlayer":true,"blockMoveTo":false,"size":48,"extraSize":0,"physicalSlotCount":48,"stateSha256":h("null"),"packagedStackBound":50})}else{Value::Null}}})
}
fn bytes(v:&Value)->Vec<u8>{serde_json::to_vec(v).unwrap()}
#[test]
fn independently_minted_chest_and_catalog0_same_session_exclusive(){
 let d=doc();let s=Arc::new(open(&d));let r=env(&s,WorkerAction::ReadDomain);let stage=env(&s,WorkerAction::Stage);
 let c=plan(&d,true);let f=plan(&d,false);
 let tc=s.mint_private_bound_amount_candidate(r,&bytes(&c),ORIGINAL,987,ORIGINAL,987,true).unwrap();
 let tf=s.mint_private_bound_amount_candidate(r,&bytes(&f),ORIGINAL,987,ORIGINAL,987,false).unwrap();
 let w=s.read_existing_amount_target(r,ExistingAmountSelection::Chest{container_id:29,slot_index:47}).unwrap();
 assert_eq!(w.view().entry_sha256.as_slice(),Sha256::digest(bytes(&d["Player"]["ContainerInventories"]["29"]["Inventory"][47])).as_slice());
 assert!(s.authorize_existing_amount_target(r,&w,49).is_err());
 let other=open(&d);assert!(other.stage_private_bound_amount_candidate(env(&other,WorkerAction::Stage),&tc).is_err());
 assert!(s.stage_private_bound_amount_candidate(r,&tc).is_err());
 let g=Arc::new(Barrier::new(3));
 let a={let s=s.clone();let g=g.clone();thread::spawn(move||{g.wait();s.stage_private_bound_amount_candidate(stage,&tc).ok()})};
 let b={let s=s.clone();let g=g.clone();thread::spawn(move||{g.wait();s.stage_private_bound_amount_candidate(stage,&tf).ok()})};
 g.wait();let a=a.join().unwrap();let b=b.join().unwrap();assert_ne!(a.is_some(),b.is_some());
 let won_chest=a.is_some();let receipt=a.or(b).unwrap();assert_eq!(receipt.exact_field_changed_count,1);assert!(!receipt.product_writer_authorized&&!receipt.native_v3_verified&&!receipt.original_overwrite_authorized);
 s.undo_typed_semantic_batch(env(&s,WorkerAction::Stage)).unwrap();
 assert!(s.take_typed_semantic_decoded_once(env(&s,WorkerAction::ExportEditedCopy)).is_err());
 assert!(s.mint_private_bound_amount_candidate(env(&s,WorkerAction::ReadDomain),&bytes(&c),ORIGINAL,987,ORIGINAL,987,true).is_err());
 s.redo_typed_semantic_batch(env(&s,WorkerAction::Stage)).unwrap();
 let e=env(&s,WorkerAction::ExportEditedCopy);let out=s.take_typed_semantic_decoded_once(e).unwrap();
 let mut want=d.clone();if won_chest{want["Player"]["ContainerInventories"]["29"]["Inventory"][47]["Amount"]=json!(49)}else{want["Player"]["ListInventories"]["0"]["Inventory"]["40000077"]["Amount"]=json!(1)}
 assert_eq!(out,bytes(&want));assert!(s.take_typed_semantic_decoded_once(e).is_err());
}
#[test]
fn exact_plan_external_binding_and_no_shape_relaxation(){
 let d=doc();let s=open(&d);let e=env(&s,WorkerAction::ReadDomain);let before=s.receipt().unwrap();
 for chest in [true,false]{
  let p=plan(&d,chest);let good=bytes(&p);
  for (o,os,b,bs) in [([0;32],987,[0;32],987),(ORIGINAL,0,ORIGINAL,0),(ORIGINAL,987,[22;32],987),(ORIGINAL,987,ORIGINAL,988),(ORIGINAL,128*1024*1024+1,ORIGINAL,128*1024*1024+1)]{
   assert!(s.mint_private_bound_amount_candidate(e,&good,o,os,b,bs,chest).is_err());
  }
  assert!(s.mint_private_bound_amount_candidate(e,&good,ORIGINAL,987,ORIGINAL,987,!chest).is_err());
  let mut wrong=e;wrong.expected_index_generation+=1;assert!(s.mint_private_bound_amount_candidate(wrong,&good,ORIGINAL,987,ORIGINAL,987,chest).is_err());
  let mut extra=p.clone();extra["target"]["authority"]=json!(true);assert!(s.mint_private_bound_amount_candidate(e,&bytes(&extra),ORIGINAL,987,ORIGINAL,987,chest).is_err());
  let duplicate=String::from_utf8(good.clone()).unwrap().replacen("{","{\"revision\":0,",1);assert!(s.mint_private_bound_amount_candidate(e,duplicate.as_bytes(),ORIGINAL,987,ORIGINAL,987,chest).is_err());
 }
 assert_eq!(s.receipt().unwrap(),before);
}
