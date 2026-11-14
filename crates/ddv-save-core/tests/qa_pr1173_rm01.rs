#![cfg(feature="semantic-writer-dev")]
use ddv_save_core::{ProductSession,BuildIdentity,BuildKind,Platform,WorkerEnvelope,WorkerAction,PRODUCT_WORKER_CONTRACT};
use serde_json::{json,Value};use sha2::{Digest,Sha256};
fn wire(v:&Value)->Vec<u8>{serde_json::to_vec(v).unwrap()}
fn hash(b:&[u8])->[u8;32]{Sha256::digest(b).into()}
fn hex(b:&[u8])->String{b.iter().map(|x|format!("{x:02x}")).collect::<Vec<_>>().join("")}
fn obj(id:u32,x:u32,y:u32,d:bool)->Value{json!({"ID":id,"ItemID":40100068,"X":x,"Y":y,"Orientation":"GridOrientation_Down","State":if d{json!({"FenceMode":{"Diagonal":true}})}else{Value::Null}})}
fn build()->BuildIdentity{BuildIdentity{platform:Platform::Switch,build_kind:BuildKind::SwitchBid,build_id:"52BD625D9B4E0053".into(),schema:624,externally_attested:true}}
fn data()->(Vec<u8>,Vec<u8>){let d=json!({"GameInfo":{"Version":624},"World":{"GridCollection":{"DiffGrids":{},"Grids":{"77":{"ID":77,"TessellationFactor":2,"GridDefaultLayoutPath":"","NextGridObjectID":900,"Objects":{"101":obj(101,16,8,false),"103":obj(103,20,8,false)}}}}},"Player":{"ListInventories":{"0":{"ID":0,"CompatibleItemType":"ItemType_Furniture","CompatibleFurnitureTypes":{"List":["FurnitureItemType_GroundAlteration"]},"Inventory":{"40100068":{"Amount":4,"Unknown":7}}}}}});
let b=wire(&d);let p=json!({"contract":"wand.private.switch624.road-rm01-archive@1","sourceDecodedSha256":hex(&hash(&b)),"gridId":77,"retainedId":101,"movedId":103,"expectedNextId":900,"expectedAmount":4,"gridSha256":hex(&hash(&wire(&d["World"]["GridCollection"]["Grids"]["77"]))),"inventoryEntrySha256":hex(&hash(&wire(&d["Player"]["ListInventories"]["0"]["Inventory"]["40100068"]))),"objects":[obj(101,16,8,false),obj(103,24,12,true),obj(900,20,8,true),obj(901,20,12,true),obj(902,24,8,true)]});(b,wire(&p))}
fn scope(s:&ProductSession,a:WorkerAction)->WorkerEnvelope{let r=s.receipt().unwrap();WorkerEnvelope{contract:PRODUCT_WORKER_CONTRACT,session_id:r.session_id,expected_revision:r.revision,expected_index_generation:r.index_generation,expected_decoded_sha256:r.decoded_sha256,action:a}}
#[test]fn concurrent_cas_and_aba(){
 let(b,p)=data();let h=hash(&b);let s=ProductSession::open_switch624_rm01_private(b.clone(),build(),h).unwrap();
 assert!(ProductSession::open_decoded_readonly(b.clone(),build()).is_err());
 let e=scope(&s,WorkerAction::Stage);let f=ProductSession::open_switch624_rm01_private(b,build(),h).unwrap();assert!(f.stage_switch624_road_rm01_archive(e,&p).is_err());
 let mut bad=e;bad.expected_index_generation+=1;assert!(s.stage_switch624_road_rm01_archive(bad,&p).is_err());bad=e;bad.action=WorkerAction::ReadDomain;assert!(s.stage_switch624_road_rm01_archive(bad,&p).is_err());
 let (a,b)=std::thread::scope(|t|{let a=t.spawn(||s.stage_switch624_road_rm01_archive(e,&p));let b=t.spawn(||s.stage_switch624_road_rm01_archive(e,&p));(a.join().unwrap(),b.join().unwrap())});
 assert_eq!(usize::from(a.is_ok())+usize::from(b.is_ok()),1);let receipt=a.or(b).unwrap();assert_eq!(receipt.operation_count,8);assert_eq!(s.receipt().unwrap().revision,1);
 s.undo_typed_semantic_batch(scope(&s,WorkerAction::Stage)).unwrap();assert!(s.stage_switch624_road_rm01_archive(e,&p).is_err());assert!(s.take_typed_semantic_decoded_once(scope(&s,WorkerAction::ExportEditedCopy)).is_err());
 s.redo_typed_semantic_batch(scope(&s,WorkerAction::Stage)).unwrap();let e2=scope(&s,WorkerAction::ExportEditedCopy);let out=s.take_typed_semantic_decoded_once(e2).unwrap();assert_eq!(hash(&out),receipt.staged_decoded_sha256);assert!(s.take_typed_semantic_decoded_once(e2).is_err());println!("QA1173_CONCURRENT_CAS_ABA_ONE_TIME_PASS");
}
