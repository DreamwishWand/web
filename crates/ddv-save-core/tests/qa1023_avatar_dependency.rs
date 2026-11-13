#![cfg(all(feature="private-native-v1",not(target_arch="wasm32")))]
use ddv_save_core::{BuildIdentity,BuildKind,Platform,ProductSession,WorkerEnvelope,WorkerAction,PRODUCT_WORKER_CONTRACT};
use serde_json::{json,Value};
use sha2::{Digest,Sha256};
const EXACT:&str="releases_1.25-v1.25.3-44-g0b41250d9ac0-incremental-22";
fn build()->BuildIdentity{BuildIdentity{platform:Platform::SteamWindows,build_kind:BuildKind::SteamFullVersion,build_id:EXACT.into(),schema:626,externally_attested:true}}
fn doc()->Value{json!({"GameInfo":{"Version":626},"Player":{"AvatarIsMale":false,"FemaleAvatar":{"HairColorIndex":4,"HairHighlightColor":6,"Clothes":{"0":50000001,"1":0},"IncompatibleClothes":{"2":50000003},"ClothingCustomization":{"50000004":-1},"Makeup":{"2":{"MakeupItemID":140000001,"Opacity":0.5,"Gloss":0.0}}},"MaleAvatar":{"Clothes":{"3":50000001},"IncompatibleClothes":{},"ClothingCustomization":{},"Makeup":{"3":{"MakeupItemID":140000002}}},"ListInventories":{"0":{"ID":0,"CompatibleItemType":"ItemType_Furniture","Inventory":{}},"1":{"ID":1,"CompatibleItemType":"ItemType_Clothing","Inventory":{"50000001":{"Amount":2,"Marker":"ItemMarker_None"},"50000003":{"Amount":0},"50000004":{"Amount":-1},"50000099":{"Amount":4}}},"3":{"ID":3,"CompatibleItemType":"ItemType_Makeup","Inventory":{"140000001":{"Amount":1}}}},"AchievementsData":[{"AchievementID":2110000002,"CurAmount":3,"MaxAmount":7,"State":"AchievementState_OnGoing"}],"EvolveStatesProfile":{"EvolveProgressState":{"40000002":{"ItemID":40000002,"Level":1,"Objective":{"ProgressKeys":{"k":"v"},"CurAmount":2}}}}},"World":{"MissionSlots":{"2":{"Slots":[{"SlotId":1,"MissionId":2070000002,"MissionSteps":[{"SubSteps":[{"Objectives":[{"ProgressKeys":{"p":"x"},"TargetAmount":9}]}]}]}]}},"QuestInfo":{}}})}
fn open(v:&Value)->ProductSession{ProductSession::open_decoded_readonly(serde_json::to_vec(v).unwrap(),build()).unwrap()}
fn env(s:&ProductSession)->WorkerEnvelope{let r=s.receipt().unwrap();WorkerEnvelope{contract:PRODUCT_WORKER_CONTRACT,session_id:r.session_id,expected_revision:r.revision,expected_index_generation:r.index_generation,expected_decoded_sha256:r.decoded_sha256,action:WorkerAction::ReadDomain}}
fn read(s:&ProductSession)->Value{s.read_private_avatar_dependencies(env(s)).unwrap().to_private_receipt_json()}
fn hash(v:&Value)->String{Sha256::digest(serde_json::to_vec(v).unwrap()).iter().map(|b|format!("{b:02x}")).collect()}
fn flags(v:&Value){for k in ["rightsVerified","writerAuthorized","productReadAccepted","editedCopyAuthorized","applyAuthorized","nativeV3Verified"]{assert_eq!(v[k],false,"{k}");}assert_eq!(v["subscriberReadSet"]["nativeSubscriberClosureVerified"],false);assert_eq!(v["subscriberReadSet"]["effectiveActiveSubscriberSetVerified"],false);}
#[test]fn exact_both_branch_dedup_missing_nonpositive_and_raw_hashes(){
 let d=doc();let s=open(&d);let before=s.receipt().unwrap();let v=read(&s);flags(&v);
 assert_eq!(v["avatar"],s.read_private_active_avatar(env(&s)).unwrap().to_private_receipt_json());
 let rows=v["ownership"]["routes"][0]["entries"].as_array().unwrap();assert_eq!(rows.len(),3);
 for (i,id,amount) in [(0,50000001,2),(1,50000003,0),(2,50000004,-1)]{assert_eq!(rows[i]["itemId"],id);assert_eq!(rows[i]["savedAmount"],amount);assert_eq!(rows[i]["positiveSavedAmount"],amount>0);assert_eq!(rows[i]["rightsVerified"],false);assert_eq!(rows[i]["entrySha256"],hash(&d["Player"]["ListInventories"]["1"]["Inventory"][id.to_string()]));}
 let m=&v["ownership"]["routes"][1]["entries"];assert_eq!(m[1]["itemId"],140000002);assert_eq!(m[1]["present"],false);assert!(m[1]["entrySha256"].is_null());assert!(m[1]["savedAmount"].is_null());
 assert_eq!(v["ownership"]["observedUniqueReferenceCount"],5);assert_eq!(v["ownership"]["allObservedReferencesHavePositiveSavedAmount"],false);assert_eq!(v["ownership"]["allFourMapsPerBranchPresent"],true);
 assert_eq!(v["subscriberReadSet"]["playerSha256"],hash(&d["Player"]));assert_eq!(v["subscriberReadSet"]["worldSha256"],hash(&d["World"]));assert_eq!(s.receipt().unwrap(),before);
}
#[test]fn exact_absence_empty_null_and_lexical_numeric(){
 let mut d=doc();let raw=serde_json::to_string(&d).unwrap().replace("\"Opacity\":0.5","\"Opacity\":5e-1");
 let s=ProductSession::open_decoded_readonly(raw.into_bytes(),build()).unwrap();let v=read(&s);assert_eq!(v["femaleDependencies"]["makeup"][0]["scalars"]["Opacity"]["numericToken"],"5e-1");
 assert_eq!(v["subscriberReadSet"]["missionSlots"]["groups"][0]["slots"][0]["steps"][0]["subSteps"][0]["objectives"][0]["witness"]["progressEntries"][0]["savedValue"],"x");
 d["Player"]["FemaleAvatar"]["Eyeball"]=Value::Null;d["Player"]["AchievementsData"]=json!([]);d["World"]["MissionSlots"]=json!({});d["Player"]["EvolveStatesProfile"]=json!({});let v=read(&open(&d));assert_eq!(v["femaleDependencies"]["eyeball"]["present"],true);assert_eq!(v["subscriberReadSet"]["achievementsData"]["present"],true);assert_eq!(v["subscriberReadSet"]["missionSlots"]["groups"],json!([]));assert_eq!(v["subscriberReadSet"]["evolveStatesProfile"]["map"]["present"],false);
 d["Player"].as_object_mut().unwrap().remove("AchievementsData");d["World"].as_object_mut().unwrap().remove("MissionSlots");d["World"].as_object_mut().unwrap().remove("QuestInfo");d["Player"].as_object_mut().unwrap().remove("EvolveStatesProfile");let v=read(&open(&d));for k in ["achievementsData","missionSlots","questInfo","evolveStatesProfile"]{assert_eq!(v["subscriberReadSet"][k]["present"],false);assert!(v["subscriberReadSet"][k]["sha256"].is_null());}flags(&v);
}
#[test]fn scope_action_generation_digest_foreign_closed_wrong_build(){
 let d=doc();let s=open(&d);let e=env(&s);let mut x=e;x.expected_revision+=1;assert!(s.read_private_avatar_dependencies(x).is_err());let mut x=e;x.expected_index_generation+=1;assert!(s.read_private_avatar_dependencies(x).is_err());let mut x=e;x.expected_decoded_sha256[0]^=1;assert!(s.read_private_avatar_dependencies(x).is_err());let mut x=e;x.action=WorkerAction::Stage;assert!(s.read_private_avatar_dependencies(x).is_err());assert!(open(&d).read_private_avatar_dependencies(e).is_err());s.close().unwrap();assert!(s.read_private_avatar_dependencies(e).is_err());
 let sw=ProductSession::open_decoded_readonly(serde_json::to_vec(&d).unwrap(),BuildIdentity{platform:Platform::Switch,build_kind:BuildKind::SwitchBid,build_id:"9A239D3DB569756D".into(),schema:626,externally_attested:true}).unwrap();assert!(sw.read_private_avatar_dependencies(env(&sw)).is_err());
}
#[test]fn malformed_routes_selected_refs_and_subscribers_fail_closed(){
 let d=doc();let mut ds=vec![];let mut x=d.clone();x["Player"]["ListInventories"]["2"]=json!({"ID":2,"CompatibleItemType":"ItemType_Clothing","Inventory":{}});ds.push(x);
 let mut x=d.clone();x["Player"]["ListInventories"]["1"]["Inventory"]["050000001"]=json!({"Amount":1});ds.push(x);
 let mut x=d.clone();x["Player"]["ListInventories"]["1"]["Inventory"]["50000001"]["Marker"]=json!("ItemMarker_!");ds.push(x);
 let mut x=d.clone();x["Player"]["FemaleAvatar"]["Makeup"]["2"]["Opacity"]=json!("0.5");ds.push(x);
 let mut x=d.clone();x["Player"]["AchievementsData"][0]["AchievementID"]=json!(2070000001);ds.push(x);
 let mut x=d.clone();let a=x["Player"]["AchievementsData"][0].clone();x["Player"]["AchievementsData"].as_array_mut().unwrap().push(a);ds.push(x);
 let mut x=d.clone();let a=x["World"]["MissionSlots"]["2"]["Slots"][0].clone();x["World"]["MissionSlots"]["2"]["Slots"].as_array_mut().unwrap().push(a);ds.push(x);
 let mut x=d.clone();x["World"]["MissionSlots"]["2"]["Slots"][0]["MissionSteps"][0]["SubSteps"][0]["Objectives"][0]["ProgressKeys"]["p"]=json!(3);ds.push(x);
 let mut x=d.clone();x["Player"]["EvolveStatesProfile"]["EvolveProgressState"]["40000002"]["ItemID"]=json!(40000003);ds.push(x);
 for (i,x) in ds.iter().enumerate(){let s=open(x);let before=s.receipt().unwrap();assert!(s.read_private_avatar_dependencies(env(&s)).is_err(),"case {i}");assert_eq!(s.receipt().unwrap(),before);}
}
#[test]fn actual_nested_progress_budget_and_array_bound(){
 let mut d=doc();let obj=json!({"ProgressKeys":(0..64).map(|i|(format!("k{i}"),json!("v"))).collect::<serde_json::Map<String,Value>>()});d["World"]["MissionSlots"]["2"]["Slots"][0]["MissionSteps"][0]["SubSteps"][0]["Objectives"]=json!(vec![obj.clone();64]);let s=open(&d);assert!(s.read_private_avatar_dependencies(env(&s)).is_ok());d["World"]["MissionSlots"]["2"]["Slots"][0]["MissionSteps"][0]["SubSteps"][0]["Objectives"]=json!(vec![obj;65]);let s=open(&d);assert!(s.read_private_avatar_dependencies(env(&s)).is_err());
 let mut d=doc();d["Player"]["AchievementsData"]=json!((0..4097).map(|i|json!({"AchievementID":2110000000+i})).collect::<Vec<_>>());let s=open(&d);assert!(s.read_private_avatar_dependencies(env(&s)).is_err());
}
