#![cfg(all(feature="private-native-v1",not(target_arch="wasm32")))]
use ddv_save_core::{BuildIdentity,BuildKind,Platform,ProductSession,WorkerAction,WorkerEnvelope,PRODUCT_WORKER_CONTRACT};
use serde_json::{json,Value};
use sha2::{Digest,Sha256};
const BUILD:&str="releases_1.25-v1.25.3-44-g0b41250d9ac0-incremental-22";
const C:i32=10000053;const NEW:i32=170000007;const OLD:i32=170000009;const FLAG:i32=50000017;
const RAW:&str=r#"{"GameInfo":{"Version":626},"World":{"Characters":[{"Base":{"id":10000002}},{"Base":{"id":10000053},"SkinID":170000009,"Opaque":"雪"},{"Base":{"id":10000054},"SkinID":0}],"DialogueFlags":[ -2147483648, 50000017,0,2147483647,50000017 ],"DialogueFlagsOverride":{"50000017":false},"QuestInfo":{"Unknown":true},"MissionSlots":{"3":{"Slots":[{"SlotId":2,"MissionId":2070000004,"State":"MissionSlotState_OnGoing","CurrentStepIndex":1,"MissionSteps":[{"SubSteps":[{"Objectives":[{"CurAmount":2,"TargetAmount":9,"ProgressKeys":{"K":"雪"}}]}]}]}]}}},"Player":{"ListInventories":{"0":{"ID":0,"CompatibleItemType":"ItemType_Furniture","Inventory":{}},"42":{"ID":42,"CompatibleItemType":"ItemType_Skin","Inventory":{"170000007":{ "Amount":3,"Marker":"ItemMarker_None","Unknown":null },"170000009":{ "Amount":2,"Opaque":[null,true] }}}},"AchievementsData":[{"AchievementID":2110000004,"State":"AchievementState_InProgress","CurAmount":2,"MaxAmount":9}],"EvolveStatesProfile":{"EvolveProgressState":{"30000011":{"ItemID":30000011,"Level":2,"Objective":{"CurAmount":1,"TargetAmount":4}}}}},"ConditionalEventHistory":{"ActiveEvents":{"1520000002":{"SpawnState":{"X":null},"Other":true},"1520000003":{"Unknown":0}},"InboxSpawnCount":{ "17":2 },"Inbox":{"ignored":true}},"Unknown":[null,"🌿"]}"#;
fn sha(v:&str)->String{format!("{:x}",Sha256::digest(v.as_bytes()))}
fn open(raw:&str)->Result<ProductSession,ddv_save_core::CoreError>{ProductSession::open_decoded_readonly(raw.as_bytes().to_vec(),BuildIdentity{platform:Platform::SteamWindows,build_kind:BuildKind::SteamFullVersion,build_id:BUILD.into(),schema:626,externally_attested:true})}
fn env(s:&ProductSession)->WorkerEnvelope{let r=s.receipt().unwrap();WorkerEnvelope{contract:PRODUCT_WORKER_CONTRACT,session_id:r.session_id,expected_revision:r.revision,expected_index_generation:r.index_generation,expected_decoded_sha256:r.decoded_sha256,action:WorkerAction::ReadDomain}}
fn read(s:&ProductSession)->Result<Value,ddv_save_core::CoreError>{Ok(s.read_private_character_skin_dependencies(env(s),C,NEW,FLAG)?.to_private_receipt_json())}
fn doc()->Value{serde_json::from_str(RAW).unwrap()}
fn from(v:&Value)->ProductSession{open(&v.to_string()).unwrap()}
#[test]
fn qac1045_exact_physical_witnesses(){
 let s=open(RAW).unwrap();let before=s.receipt().unwrap();let v=read(&s).unwrap();
 let selected=s.read_private_character_skin(env(&s),C,NEW).unwrap().to_private_receipt_json();
 assert_eq!(v["selectedSkin"],selected);assert_eq!(v["sessionId"],selected["sessionId"]);assert_eq!(v["decodedSha256"],sha(RAW));
 assert_eq!(v["oldSkinInventory"]["itemId"],OLD);assert_eq!(v["oldSkinInventory"]["savedAmount"],2);assert_eq!(v["oldSkinInventory"]["entrySha256"],sha(r#"{ "Amount":2,"Opaque":[null,true] }"#));assert_eq!(v["oldSkinInventory"]["markerPresent"],false);
 assert_eq!(selected["skinInventory"]["entrySha256"],sha(r#"{ "Amount":3,"Marker":"ItemMarker_None","Unknown":null }"#));assert_eq!(selected["skinInventory"]["savedAmount"],3);
 let f=&v["dialogueFlag"];assert_eq!(f["persistedList"]["sha256"],sha("[ -2147483648, 50000017,0,2147483647,50000017 ]"));assert_eq!(f["targetPositions"],json!([1,4]));assert_eq!(f["persistedMembership"],true);
 for (i,n) in [-2147483648i32,FLAG,0,2147483647,FLAG].iter().enumerate(){assert_eq!(f["entries"][i],json!({"position":i,"flagId":n,"tokenSha256":sha(&n.to_string())}));}
 for k in ["runtimeOverrideInitialized","runtimeOverrideKeyPresent","runtimeOverrideValue","effectiveFlagValue"]{assert!(f[k].is_null(),"{k}");}
 let ss=&v["savedCharacterSelections"];assert_eq!(ss[0]["skinId"]["present"],false);assert_eq!(ss[1]["skinId"]["value"],OLD);assert_eq!(ss[2]["skinId"]["value"],0);
 let r=&v["subscriberReadSet"];let h=&r["conditionalEventHistory"];assert_eq!(h["inboxSpawnCount"]["sha256"],sha(r#"{ "17":2 }"#));assert_eq!(h["activeEvents"]["entries"][0]["eventId"],1520000002);assert_eq!(h["activeEvents"]["entries"][0]["spawnState"]["sha256"],sha(r#"{"X":null}"#));assert_eq!(h["activeEvents"]["entries"][1]["spawnState"]["present"],false);
 assert_eq!(r["missionSlots"]["groups"][0]["slots"][0]["steps"][0]["subSteps"][0]["objectives"][0]["witness"]["curAmount"]["value"],2);
 assert_eq!(r["achievementsData"]["entries"][0]["curAmount"]["value"],2);assert_eq!(r["evolveStatesProfile"]["entries"][0]["objective"]["targetAmount"]["value"],4);
 for k in ["selectedConditionFlagJoinVerified","effectiveItemDbVerified","rightsVerified","writerAuthorized","productReadAccepted","editedCopyAuthorized","applyAuthorized","nativeV3Verified"]{assert_eq!(v[k],false,"{k}");}
 for k in ["activeAutoSelectionVerified","nativeSubscriberClosureVerified","effectiveActiveSubscriberSetVerified"]{assert_eq!(r[k],false,"{k}");}
 assert_eq!(s.receipt().unwrap(),before);
}
#[test]
fn qac1045_absence_alias_and_rejections(){
 let mut v=doc();v["World"].as_object_mut().unwrap().remove("DialogueFlags");v["ConditionalEventHistory"].as_object_mut().unwrap().remove("InboxSpawnCount");
 let x=read(&from(&v)).unwrap();assert!(x["dialogueFlag"]["persistedMembership"].is_null());assert_eq!(x["subscriberReadSet"]["conditionalEventHistory"]["inboxSpawnCount"]["present"],false);
 v["World"]["DialogueFlags"]=json!([]);let x=read(&from(&v)).unwrap();assert_eq!(x["dialogueFlag"]["persistedMembership"],false);assert!(x["dialogueFlag"]["effectiveFlagValue"].is_null());
 for bad in ["[-0]","[1e0]","[1.0]","[2147483648]","[-2147483649]","[true]","null"]{let raw=RAW.replace("[ -2147483648, 50000017,0,2147483647,50000017 ]",bad);assert!(read(&open(&raw).unwrap()).is_err(),"{bad}");}
 for (key,value) in [("1520000000",json!(null)),("2147483648",json!({})),("01520000002",json!({})),("0",json!({}))]{let mut d=doc();d["ConditionalEventHistory"]["ActiveEvents"]=json!({(key):value});assert!(read(&from(&d)).is_err(),"{key}");}
 for old in [0,-1,NEW,170100001]{let mut d=doc();d["World"]["Characters"][1]["SkinID"]=json!(old);assert!(read(&from(&d)).is_err());}
 for amount in [0,-1]{let mut d=doc();d["Player"]["ListInventories"]["42"]["Inventory"]["170000009"]["Amount"]=json!(amount);assert!(read(&from(&d)).is_err());}
 let mut d=doc();d["World"]["Characters"][2]["SkinID"]=json!("0");assert!(read(&from(&d)).is_err());
 let mut d=doc();d["Player"]["EvolveStatesProfile"]["EvolveProgressState"]["30000011"]["ItemID"]=json!(30000012);assert!(read(&from(&d)).is_err());
 assert!(open(&RAW.replace("\"DialogueFlagsOverride\":","\"\\u0044ialogueFlags\":[],\"DialogueFlagsOverride\":")).is_err());
}
#[test]
fn qac1045_bounds_and_epoch(){
 let mut v=doc();v["World"]["DialogueFlags"]=json!(vec![FLAG;16384]);let s=from(&v);let x=read(&s).unwrap();assert_eq!(x["dialogueFlag"]["entries"].as_array().unwrap().len(),16384);assert_eq!(x["dialogueFlag"]["targetPositions"][16383],16383);
 v["World"]["DialogueFlags"]=json!(vec![FLAG;16385]);assert!(read(&from(&v)).is_err());
 let s=open(RAW).unwrap();let e=env(&s);let before=s.receipt().unwrap();let mut stale=e;stale.expected_index_generation+=1;assert!(s.read_private_character_skin_dependencies(stale,C,NEW,FLAG).is_err());
 let mut bad=e;bad.expected_decoded_sha256[0]^=1;assert!(s.read_private_character_skin_dependencies(bad,C,NEW,FLAG).is_err());
 let mut bad=e;bad.action=WorkerAction::Stage;assert!(s.read_private_character_skin_dependencies(bad,C,NEW,FLAG).is_err());
 assert!(open(RAW).unwrap().read_private_character_skin_dependencies(e,C,NEW,FLAG).is_err());assert_eq!(s.receipt().unwrap(),before);s.close().unwrap();assert!(s.read_private_character_skin_dependencies(e,C,NEW,FLAG).is_err());
}
