#![cfg(all(feature="private-native-v2",feature="semantic-writer-dev",not(target_arch="wasm32")))]
use ddv_save_core::{BuildIdentity,BuildKind,Platform,ProductSession,WorkerAction,WorkerEnvelope,PRODUCT_WORKER_CONTRACT};
use serde_json::{json,Value};
use sha2::{Digest,Sha256};
use std::{sync::{Arc,Barrier},thread};
const DEF:i32=2120000059;const ITEM:i32=40000071;
const BID:&str="9A239D3DB569756D";
const MAP:&str=r#"{ "40000073":true, "40000071" : false, "40000072":false }"#;
const STATE:&str=r#""SetState_NotComplete""#;
const STOCK:&str=r#"{ "Amount": 3, "Marker":null, "Opaque":[false,7] }"#;
fn h(b:impl AsRef<[u8]>)->String{format!("{:x}",Sha256::digest(b.as_ref()))}
fn fixture()->(Vec<u8>,Value){
 let group=format!(r#"{{"GroupIndex":1,"State":{STATE},"GroupsCollectionItems":{MAP},"Unknown":{{"keep":false,"unicode":"星"}}}}"#);
 let sets=format!(r#"[{{"CollectionDefinitionID":{DEF},"GroupData":[{{"GroupIndex":0,"State":0,"GroupsCollectionItems":{{"40000099":false}}}},{group}]}},{{"CollectionDefinitionID":2120000060,"GroupData":[{{"GroupsCollectionItems":{{"40000098":false}}}}]}}]"#);
 let route=format!(r#"{{"ID":0,"CompatibleItemType":"ItemType_Furniture","CompatibleFurnitureTypes":{{"List":["FurnitureItemType_Fence"]}},"Inventory":{{"40000071":{STOCK}}}}}"#);
 let raw=format!(r#"{{ "GameInfo":{{"Version":626}},"World":{{"Other":false}},"Player":{{"CollectionSets":{sets},"ListInventories":{{"0":{route},"4":{{"ID":4,"CompatibleItemType":"ItemType_ActivityItem","Inventory":{{"30000001":{{"Amount":9}}}}}}}},"Unknown":{{"x":false}}}} }}"#).into_bytes();
 let p=json!({"contract":"wand.private.switch626.collection-existing-bool-exact1@1","definitionId":DEF,"groupIndex":1,"itemId":ITEM,"sourceDecodedSha256":h(&raw),"collectionSetsSha256":h(&sets),"groupSha256":h(&group),"mapSha256":h(MAP),"entrySha256":h("false"),"stateSha256":h(STATE),"stockEntrySha256":h(STOCK),"stockRouteSha256":h(&route)});
 (raw,p)
}
fn open(raw:Vec<u8>,bid:&str)->ProductSession{ProductSession::open_decoded_readonly(raw,BuildIdentity{platform:Platform::Switch,build_kind:BuildKind::SwitchBid,build_id:bid.into(),schema:626,externally_attested:true}).unwrap()}
fn env(s:&ProductSession,a:WorkerAction)->WorkerEnvelope{let r=s.receipt().unwrap();WorkerEnvelope{contract:PRODUCT_WORKER_CONTRACT,session_id:r.session_id,expected_revision:r.revision,expected_index_generation:r.index_generation,expected_decoded_sha256:r.decoded_sha256,action:a}}
fn bytes(p:&Value)->Vec<u8>{serde_json::to_vec(p).unwrap()}
#[test]
fn exact_lexical_plan_and_single_token_output(){
 let (raw,p)=fixture();let s=open(raw.clone(),BID);let e=env(&s,WorkerAction::ReadDomain);let before=s.receipt().unwrap();
 let r=s.read_private_collection_group(e,DEF,1,ITEM).unwrap().to_private_receipt_json();
 assert_eq!(r["selectedGroup"]["groupSha256"],p["groupSha256"]);assert_eq!(r["selectedGroup"]["mapSha256"],p["mapSha256"]);
 assert_eq!(r["storedStock"]["routeSha256"],p["stockRouteSha256"]);assert_eq!(r["storedStock"]["entry"]["entrySha256"],p["stockEntrySha256"]);
 for k in ["sourceDecodedSha256","collectionSetsSha256","groupSha256","mapSha256","entrySha256","stateSha256","stockEntrySha256","stockRouteSha256","contract"]{let mut q=p.clone();q[k]=json!("wrong");assert!(s.mint_private_switch626_collection_target(e,&bytes(&q)).is_err(),"{k}");}
 for (k,v) in [("groupIndex",json!(0)),("groupIndex",json!(1.0)),("itemId",json!(40000072)),("itemId",json!(30000071)),("definitionId",json!(2120000060)),("definitionId",json!("2120000059"))]{let mut q=p.clone();q[k]=v;assert!(s.mint_private_switch626_collection_target(e,&bytes(&q)).is_err(),"{k}");}
 let mut q=p.clone();q["rightsVerified"]=json!(true);assert!(s.mint_private_switch626_collection_target(e,&bytes(&q)).is_err());
 let mut q=bytes(&p);q.insert(0,b' ');assert!(s.mint_private_switch626_collection_target(e,&q).is_err());
 let q=String::from_utf8(bytes(&p)).unwrap().replacen("{","{\"groupIndex\":1,",1);assert!(s.mint_private_switch626_collection_target(e,q.as_bytes()).is_err());
 assert_eq!(s.receipt().unwrap(),before);
 let t=s.mint_private_switch626_collection_target(e,&bytes(&p)).unwrap();
 let a=env(&s,WorkerAction::Stage);let mut wrong=a;wrong.expected_index_generation+=1;assert!(s.stage_private_switch626_collection_bool(wrong,&t).is_err());
 let other=open(raw.clone(),BID);assert!(other.stage_private_switch626_collection_bool(env(&other,WorkerAction::Stage),&t).is_err());
 assert!(s.stage_private_switch626_collection_bool(e,&t).is_err());
 let stage=s.stage_private_switch626_collection_bool(a,&t).unwrap();assert_eq!(stage.operation_count,1);assert_eq!(stage.exact_field_changed_count,1);assert!(!stage.product_writer_authorized&&!stage.native_v3_verified&&!stage.original_overwrite_authorized);
 let expected=String::from_utf8(raw).unwrap().replacen("\"40000071\" : false","\"40000071\" : true",1).into_bytes();
 assert_eq!(stage.staged_decoded_sha256.as_slice(),Sha256::digest(&expected).as_slice());
 assert!(s.stage_private_switch626_collection_bool(a,&t).is_err());
 s.undo_typed_semantic_batch(env(&s,WorkerAction::Stage)).unwrap();assert!(s.take_typed_semantic_decoded_once(env(&s,WorkerAction::ExportEditedCopy)).is_err());
 assert!(s.stage_private_switch626_collection_bool(env(&s,WorkerAction::Stage),&t).is_err());
 s.redo_typed_semantic_batch(env(&s,WorkerAction::Stage)).unwrap();
 let exp=env(&s,WorkerAction::ExportEditedCopy);assert_eq!(s.take_typed_semantic_decoded_once(exp).unwrap(),expected);assert!(s.take_typed_semantic_decoded_once(exp).is_err());
}
#[test]
fn shape_build_and_resealed_source_denials(){
 let(raw,p)=fixture();let text=String::from_utf8(raw.clone()).unwrap();
 for (old,new) in [(STATE,"\"SetState_Complete\""),(STATE,"0"),("\"40000072\":false","\"40000072\":true"),("\"40000071\" : false","\"40000071\" : true"),("\"Amount\": 3","\"Amount\": 0"),("\"40000099\":false","\"40000071\":false"),("\"GroupIndex\":1","\"GroupIndex\":0"),("\"ID\":0","\"ID\":1")]{
  let b=text.replacen(old,new,1).into_bytes();let s=open(b.clone(),BID);let mut q=p.clone();q["sourceDecodedSha256"]=json!(h(&b));let e=env(&s,WorkerAction::ReadDomain);assert!(s.read_private_collection_group(e,DEF,1,ITEM).is_err(),"{old}");assert!(s.mint_private_switch626_collection_target(e,&bytes(&q)).is_err());assert_eq!(s.receipt().unwrap().revision,0);
 }
 let s=open(raw.clone(),"52BD625D9B4E0053");assert!(s.mint_private_switch626_collection_target(env(&s,WorkerAction::ReadDomain),&bytes(&p)).is_err());
 let s=ProductSession::open_decoded_readonly(raw,BuildIdentity{platform:Platform::SteamWindows,build_kind:BuildKind::SteamFullVersion,build_id:"releases_1.25-v1.25.3-44-g0b41250d9ac0-incremental-22".into(),schema:626,externally_attested:true}).unwrap();assert!(s.mint_private_switch626_collection_target(env(&s,WorkerAction::ReadDomain),&bytes(&p)).is_err());
}
#[test]
fn concurrent_stage_and_export_one_winner(){
 let(raw,p)=fixture();let s=Arc::new(open(raw,BID));let e=env(&s,WorkerAction::ReadDomain);let a=env(&s,WorkerAction::Stage);let gate=Arc::new(Barrier::new(3));
 let handles=(0..2).map(|_|{let s=s.clone();let g=gate.clone();let p=bytes(&p);thread::spawn(move||{let t=s.mint_private_switch626_collection_target(e,&p).unwrap();g.wait();s.stage_private_switch626_collection_bool(a,&t).is_ok()})}).collect::<Vec<_>>();
 gate.wait();assert_eq!(handles.into_iter().map(|x|x.join().unwrap() as u8).sum::<u8>(),1);
 let exp=env(&s,WorkerAction::ExportEditedCopy);let gate=Arc::new(Barrier::new(3));
 let handles=(0..2).map(|_|{let s=s.clone();let g=gate.clone();thread::spawn(move||{g.wait();s.take_typed_semantic_decoded_once(exp).is_ok()})}).collect::<Vec<_>>();
 gate.wait();assert_eq!(handles.into_iter().map(|x|x.join().unwrap() as u8).sum::<u8>(),1);assert!(s.receipt().is_err());
}
