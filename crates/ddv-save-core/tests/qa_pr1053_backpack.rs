#![cfg(all(feature="semantic-writer-dev",not(target_arch="wasm32")))]
use ddv_save_core::{BuildIdentity,BuildKind,Platform,ProductSession,WorkerAction,WorkerEnvelope,PRODUCT_WORKER_CONTRACT};
use serde_json::{json,Value};
use sha2::{Digest,Sha256};
const BUILD:&str="releases_1.25-v1.25.3-44-g0b41250d9ac0-incremental-22";
const SRC:&str=r#"{ "ItemID":31100019, "Amount":50, "State" : null,"Unknown":"雪" }"#;
const DST:&str=r#"{ "ItemID":0, "Amount":0,"State":null,"Opaque":[true,null] }"#;
const RAW:&str=r#"{"GameInfo":{"Version":626},"World":{},"Player":{"ContainerInventories":{ "0" : {"ID":0,"Size":4,"ExtraSize":1,"BelongsToPlayer":true,"BlockMoveTo":false,"ParentItemID":null,"Inventory":[ {"ItemID":0,"Amount":0,"State":null}, { "ItemID":31100019, "Amount":50, "State" : null,"Unknown":"雪" }, { "ItemID":0, "Amount":0,"State":null,"Opaque":[true,null] }, {"ItemID":0,"Amount":0,"State":null} ]},"7":{"ID":7}},"ListInventories":{"0":{"ID":0,"CompatibleItemType":"ItemType_Furniture","Inventory":{}}}},"Unknown":true}"#;
fn sha(x:&str)->String{format!("{:x}",Sha256::digest(x.as_bytes()))}
fn open(raw:&str)->Result<ProductSession,ddv_save_core::CoreError>{ProductSession::open_decoded_readonly(raw.as_bytes().to_vec(),BuildIdentity{platform:Platform::SteamWindows,build_kind:BuildKind::SteamFullVersion,build_id:BUILD.into(),schema:626,externally_attested:true})}
fn env(s:&ProductSession)->WorkerEnvelope{let r=s.receipt().unwrap();WorkerEnvelope{contract:PRODUCT_WORKER_CONTRACT,session_id:r.session_id,expected_revision:r.revision,expected_index_generation:r.index_generation,expected_decoded_sha256:r.decoded_sha256,action:WorkerAction::ReadDomain}}
fn read(s:&ProductSession,a:usize,b:usize)->Result<Value,ddv_save_core::CoreError>{s.read_private_backpack_slot_pair(env(s),a,b)}
fn doc()->Value{serde_json::from_str(RAW).unwrap()}
fn from(v:&Value)->ProductSession{open(&v.to_string()).unwrap()}
#[test]
fn qac1053_exact_raw_distinct_roles(){
 let s=open(RAW).unwrap();let before=s.receipt().unwrap();let x=read(&s,1,2).unwrap();
 assert_eq!(x["source"]["entrySha256"],sha(SRC));assert_eq!(x["destination"]["entrySha256"],sha(DST));
 let slots=&RAW[RAW.find("[ {\"ItemID\"").unwrap()..RAW.find(" ]}").unwrap()+2];
 let record=&RAW[RAW.find("{\"ID\":0,\"Size\"").unwrap()..RAW.find("},\"7\"").unwrap()+1];
 let map=&RAW[RAW.find("{ \"0\"").unwrap()..RAW.find("},\"ListInventories\"").unwrap()+1];
 assert_eq!(x["container"]["slotsSha256"],sha(slots));assert_eq!(x["container"]["recordSha256"],sha(record));assert_eq!(x["container"]["mapSha256"],sha(map));assert_eq!(x["container"]["parentSha256"],sha("null"));
 assert_eq!(x["decodedSha256"],sha(RAW));assert_eq!(x["source"]["stateSha256"],sha("null"));assert_eq!(x["destination"]["stateSha256"],sha("null"));assert_eq!(x["source"]["oldAmount"],50);assert_eq!(x["destination"]["oldAmount"],0);assert_eq!(x["container"]["usableSlotCount"],3);assert_eq!(x["container"]["namespace"],"ContainerInventories");
 for k in ["writerAuthorized","rightsVerified","variationVerified","canonicalItemDbVerified","effectiveStackBoundVerified","nativeReferenceClosureVerified","subscriberClosureVerified","productReadAccepted","editedCopyAuthorized","applyAuthorized","nativeV3Verified"]{assert_eq!(x[k],false,"{k}");}
 assert!(x["effectiveStackBound"].is_null());assert_eq!(read(&s,1,0).unwrap()["source"],x["source"]);assert_eq!(s.receipt().unwrap(),before);
}
#[test]
fn qac1053_bounds_and_denial(){
 let mut d=doc();let r=&mut d["Player"]["ContainerInventories"]["0"];r["Size"]=json!(256);r["ExtraSize"]=json!(0);let mut a=vec![json!({"ItemID":0,"Amount":0,"State":null});256];a[255]=json!({"ItemID":31600019,"Amount":2,"State":null});r["Inventory"]=json!(a);let s=from(&d);assert_eq!(read(&s,255,0).unwrap()["container"]["physicalSlotCount"],256);d["Player"]["ContainerInventories"]["0"]["Size"]=json!(257);d["Player"]["ContainerInventories"]["0"]["Inventory"].as_array_mut().unwrap().push(json!({"ItemID":0,"Amount":0,"State":null}));assert!(read(&from(&d),255,0).is_err());
 for (old,new) in [("\"Amount\":50","\"Amount\":50.0"),("\"Amount\":50","\"Amount\":5e1"),("\"Amount\":50","\"Amount\":51"),("\"Amount\":50","\"Amount\":1"),("\"State\" : null","\"State\" : \"null\""),("\"7\":{\"ID\":7}","\"7\":{\"ID\":8}"),("\"7\":{\"ID\":7}","\"07\":{\"ID\":7}"),("\"7\":{\"ID\":7}","\"7\":null")]{assert!(read(&open(&RAW.replacen(old,new,1)).unwrap(),1,2).is_err(),"{new}");}
 assert!(open(&RAW.replace("\"Size\":4","\"Size\":4,\"\\u0053ize\":4")).is_err());
 let s=open(RAW).unwrap();for (a,b) in [(1,1),(1,3),(3,0),(1,256),(2,1)]{assert!(read(&s,a,b).is_err());}
 let e=env(&s);let before=s.receipt().unwrap();let mut bad=e;bad.expected_index_generation+=1;assert!(s.read_private_backpack_slot_pair(bad,1,2).is_err());let mut bad=e;bad.expected_decoded_sha256[0]^=1;assert!(s.read_private_backpack_slot_pair(bad,1,2).is_err());let mut bad=e;bad.action=WorkerAction::Stage;assert!(s.read_private_backpack_slot_pair(bad,1,2).is_err());assert!(open(RAW).unwrap().read_private_backpack_slot_pair(e,1,2).is_err());assert_eq!(s.receipt().unwrap(),before);s.close().unwrap();assert!(s.read_private_backpack_slot_pair(e,1,2).is_err());
}
