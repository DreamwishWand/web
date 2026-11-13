#![cfg(all(feature="private-native-v1",not(target_arch="wasm32")))]
use ddv_save_core::{BuildIdentity,BuildKind,Platform,ProductSession,WorkerAction,WorkerEnvelope,PRODUCT_WORKER_CONTRACT};
use serde_json::{json,Value};
use sha2::{Digest,Sha256};
const DEF:i32=2120000041;
const ITEM:i32=30000011;
const BUILD:&str="releases_1.25-v1.25.3-44-g0b41250d9ac0-incremental-22";
fn hash(v:&str)->String{format!("{:x}",Sha256::digest(v.as_bytes()))}
fn open(raw:&str)->Result<ProductSession,ddv_save_core::CoreError>{
 ProductSession::open_decoded_readonly(raw.as_bytes().to_vec(),BuildIdentity{platform:Platform::SteamWindows,build_kind:BuildKind::SteamFullVersion,build_id:BUILD.into(),schema:626,externally_attested:true})
}
fn env(s:&ProductSession)->WorkerEnvelope{let r=s.receipt().unwrap();WorkerEnvelope{contract:PRODUCT_WORKER_CONTRACT,session_id:r.session_id,expected_revision:r.revision,expected_index_generation:r.index_generation,expected_decoded_sha256:r.decoded_sha256,action:WorkerAction::ReadDomain}}
fn read(s:&ProductSession,d:i32,g:usize,t:i32)->Result<Value,ddv_save_core::CoreError>{Ok(s.read_private_collection_group(env(s),d,g,t)?.to_private_receipt_json())}
fn document(sets:Value,stock:Option<Value>)->String{let mut p=json!({"CollectionSets":sets});if let Some(v)=stock{p["ListInventories"]=v;}json!({"GameInfo":{"Version":626},"World":{},"Player":p,"Opaque":[null,{"keep":"🌿"}]}).to_string()}
fn group(i:usize,map:Value)->Value{json!({"GroupIndex":i,"State":0,"GroupsCollectionItems":map})}
fn set(d:i32,groups:Vec<Value>)->Value{json!({"CollectionDefinitionID":d,"GroupData":groups})}
const MAP:&str=r#"{ "30000013" : true, "30000011":false, "30000012" : false }"#;
const GROUP:&str=r#"{ "GroupIndex":0, "State":0,"GroupsCollectionItems":{ "30000013" : true, "30000011":false, "30000012" : false },"Extra":{"ignored":true} }"#;
const RAW:&str=r#"{"GameInfo":{"Version":626},"World":{},"Player":{"CollectionSets":[{ "CollectionDefinitionID":2120000041,"GroupData":[{ "GroupIndex":0, "State":0,"GroupsCollectionItems":{ "30000013" : true, "30000011":false, "30000012" : false },"Extra":{"ignored":true} },{"GroupIndex":1,"State":"Not\u0043omplete","GroupsCollectionItems":{"30000011":true}}]},{"CollectionDefinitionID":2120000042,"GroupData":[{"GroupsCollectionItems":{"30000011":false}}]}],"ListInventories":{"0":{"ID":0,"CompatibleItemType":"ItemType_Furniture","Inventory":{}},"9":{"ID":9,"CompatibleItemType":"ItemType_ActivityItem","Inventory":{"30000011":{ "Amount":0, "Marker": {"m":"🌿"},"Other":null },"30000012":{"Amount":2}}}}}}"#;
#[test]
fn qac1039_exact_lexical_map_membership_stock(){
 let s=open(RAW).unwrap();let before=s.receipt().unwrap();let x=read(&s,DEF,0,ITEM).unwrap();let g=&x["selectedGroup"];
 assert_eq!(g["mapSha256"],hash(MAP));assert_eq!(g["groupSha256"],hash(GROUP));assert_eq!(g["falseCount"],2);
 assert_eq!(g["entries"],json!([{"itemId":30000013,"collected":true,"tokenSha256":hash("true")},{"itemId":ITEM,"collected":false,"tokenSha256":hash("false")},{"itemId":30000012,"collected":false,"tokenSha256":hash("false")}]));
 assert_eq!(g["numericNotCompleteMultiFalseShape"],true);assert_eq!(g["state"]["sha256"],hash("0"));
 let ms=x["storedMemberships"].as_array().unwrap();assert_eq!(ms.len(),3);
 assert_eq!(ms[0]["groupPosition"],0);assert_eq!(ms[1]["groupPosition"],1);assert_eq!(ms[2]["setPosition"],1);
 let token=r#""Not\u0043omplete""#;assert_eq!(ms[1]["state"]["token"],token);assert_eq!(ms[1]["state"]["sha256"],hash(token));assert!(ms[1]["state"]["numericCode"].is_null());assert_eq!(ms[2]["state"]["present"],false);assert!(ms[2]["storedGroupIndex"].is_null());
 let stock=&x["storedStock"];assert_eq!(stock["inventoryId"],9);assert_eq!(stock["entry"]["amount"],0);assert_eq!(stock["entry"]["entrySha256"],hash(r#"{ "Amount":0, "Marker": {"m":"🌿"},"Other":null }"#));assert_eq!(stock["entry"]["markerSha256"],hash(r#"{"m":"🌿"}"#));assert_eq!(stock["ownershipVerified"],false);
 for k in ["packagedMembershipVerified","effectiveEligibilityVerified","ownershipVerified","rightsVerified","subscriberClosureVerified","nativeV3Verified","productReadAccepted","writerAuthorized","editedCopyAuthorized","applyAuthorized"]{assert_eq!(x[k],false,"{k}");}
 assert_eq!(x["scannedEntryCount"],5);assert_eq!(x["groupCount"],3);assert_eq!(s.receipt().unwrap(),before);
 let absent=read(&s,DEF,1,30000012).unwrap();assert!(absent["selectedGroup"]["targetEntry"].is_null());assert_eq!(absent["storedMemberships"].as_array().unwrap().len(),1);assert_eq!(absent["selectedGroup"]["numericNotCompleteMultiFalseShape"],false);
}
#[test]
fn qac1039_unrelated_paths_and_scope(){
 let mut root:Value=serde_json::from_str(RAW).unwrap();
 let before=root.clone();
 // Malformed unrelated map/group index still denies the complete membership scan.
 for bad in [json!({"30000099":null}),json!({"030000099":true}),json!({"-1":false}),json!({"2147483648":true})]{
  root=before.clone();root["Player"]["CollectionSets"][1]["GroupData"][0]["GroupsCollectionItems"]=bad;let s=open(&root.to_string()).unwrap();assert!(read(&s,DEF,0,ITEM).is_err());
 }
 root=before.clone();root["Player"]["CollectionSets"][1]["GroupData"][0]["GroupIndex"]=json!(1);assert!(read(&open(&root.to_string()).unwrap(),DEF,0,ITEM).is_err());
 root=before.clone();root["Player"]["ListInventories"]["0"]["ID"]=json!(2);assert!(read(&open(&root.to_string()).unwrap(),DEF,0,ITEM).is_err());
 for (from,to) in [(r#""30000011":false"#,r#""30000011":false,"\u00330000011":true"#),(r#""State":0"#,r#""State":0,"\u0053tate":1"#)]{
  assert!(open(&RAW.replacen(from,to,1)).is_err());
 }
 let s=open(RAW).unwrap();let e=env(&s);let r=s.receipt().unwrap();
 let mut stale=e;stale.expected_index_generation+=1;assert!(s.read_private_collection_group(stale,DEF,0,ITEM).is_err());
 let mut foreign=e;foreign.expected_decoded_sha256[0]^=1;assert!(s.read_private_collection_group(foreign,DEF,0,ITEM).is_err());
 let mut wrong=e;wrong.action=WorkerAction::Stage;assert!(s.read_private_collection_group(wrong,DEF,0,ITEM).is_err());
 assert!(open(RAW).unwrap().read_private_collection_group(e,DEF,0,ITEM).is_err());
 assert!(read(&s,DEF,257,ITEM).is_err());assert!(read(&s,DEF,0,40000001).is_err());assert_eq!(s.receipt().unwrap(),r);s.close().unwrap();assert!(s.read_private_collection_group(e,DEF,0,ITEM).is_err());
}
#[test]
fn qac1039_bounded_group_and_map(){
 let groups=(0..257).map(|i|group(i,json!({"30000011":false}))).collect::<Vec<_>>();
 let s=open(&document(json!([set(DEF,groups.clone())]),None)).unwrap();let x=read(&s,DEF,256,ITEM).unwrap();assert_eq!(x["groupCount"],257);assert_eq!(x["storedMemberships"].as_array().unwrap().len(),257);assert_eq!(x["storedStock"]["listPresent"],false);
 let mut too=groups;too.push(group(257,json!({"30000011":false})));assert!(read(&open(&document(json!([set(DEF,too)]),None)).unwrap(),DEF,0,ITEM).is_err());
 let mut m=serde_json::Map::new();for i in 0..16384{m.insert((30000000+i).to_string(),json!(false));}
 let s=open(&document(json!([set(DEF,vec![group(0,Value::Object(m.clone()))])]),None)).unwrap();let x=read(&s,DEF,0,ITEM).unwrap();assert_eq!(x["scannedEntryCount"],16384);assert_eq!(x["selectedGroup"]["entries"].as_array().unwrap().len(),16384);
 m.insert("30020000".into(),json!(true));assert!(read(&open(&document(json!([set(DEF,vec![group(0,Value::Object(m))])]),None)).unwrap(),DEF,0,ITEM).is_err());
}
