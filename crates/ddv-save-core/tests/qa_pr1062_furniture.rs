#![cfg(all(feature="private-native-v1",feature="semantic-writer-dev",not(target_arch="wasm32")))]
use ddv_save_core::{BuildIdentity,BuildKind,Platform,ProductSession,WorkerAction,WorkerEnvelope,PRODUCT_WORKER_CONTRACT};
use serde_json::{json,Value};
use sha2::{Digest,Sha256};
const BUILD:&str="releases_1.25-v1.25.3-44-g0b41250d9ac0-incremental-22";
const ITEM:u32=40000001;
fn doc()->Value{json!({"GameInfo":{"Version":626},"Player":{"ListInventories":{"0":{"ID":0,"CompatibleItemType":"ItemType_Furniture","CompatibleFurnitureTypes":{"List":["FurnitureItemType_Default"]},"Inventory":{"40000001":{"Amount":4,"Marker":"ItemMarker_None"}}}},"AchievementsData":[{"AchievementID":2110000001,"CurAmount":1,"TypesCollected":[4],"ItemsUsed":[40000001],"GridObjectsCollected":{"GridObjectAddresses":[{"GridID":7,"GridObjectID":4}]}}]},"World":{"MissionSlots":{"0":{"Slots":[{"SlotId":0,"MissionId":2070000001,"State":"MissionSlotState_OnGoing","MissionSteps":[{"SubSteps":[{"Objectives":[{"TargetAmount":125.0,"ItemAmount":-0.25,"CurAmount":999,"ProgressKeys":{"Unknown":"3"},"ItemIdsCollected":[40000001,0,-1,40000001],"GridObjectIdsCollected":[{"GridId":4294967295,"GridObjectId":0},{"GridId":7}]}]}]}]}]}},"GridCollection":{"Grids":{"7":{"ID":7,"Objects":{"4":{"ID":4,"ItemID":40000001}}}},"DiffGrids":{"8":{"ID":8,"ModifiedObjects":{"5":{"ID":5}}}}}},"ConditionalEventHistory":{"ActiveEvents":{"1520000001":{"SpawnState":{"Unknown":1},"RecurringEventState":null}},"InboxSpawnCount":{"1520000001":2}}})}
fn open(b:Vec<u8>)->ProductSession{ProductSession::open_decoded_readonly(b,BuildIdentity{platform:Platform::SteamWindows,build_kind:BuildKind::SteamFullVersion,build_id:BUILD.into(),schema:626,externally_attested:true}).unwrap()}
fn env(s:&ProductSession)->WorkerEnvelope{let r=s.receipt().unwrap();WorkerEnvelope{contract:PRODUCT_WORKER_CONTRACT,session_id:r.session_id,expected_revision:r.revision,expected_index_generation:r.index_generation,expected_decoded_sha256:r.decoded_sha256,action:WorkerAction::ReadDomain}}
fn hash(d:&Value)->[u8;32]{Sha256::digest(serde_json::to_vec(&d["Player"]["ListInventories"]["0"]["Inventory"]["40000001"]).unwrap()).into()}
fn hex(b:&[u8])->String{b.iter().map(|x|format!("{x:02x}")).collect()}
fn read(d:&Value)->Result<Value,ddv_save_core::CoreError>{let s=open(serde_json::to_vec(d).unwrap());s.read_private_furniture_amount_dependencies(env(&s),ITEM,hash(d))}
#[test]
fn qac1062_raw_scope_and_unknown(){
 let d=doc();let raw=serde_json::to_string(&d).unwrap().replace("125.0","1.2500e2");let s=open(raw.as_bytes().to_vec());let before=s.receipt().unwrap();let e=env(&s);let h=hash(&d);let v=s.read_private_furniture_amount_dependencies(e,ITEM,h).unwrap();let w=&v["subscriberReadSet"]["missionSlots"]["groups"][0]["slots"][0]["steps"][0]["subSteps"][0]["objectives"][0]["witness"];
 assert_eq!(w["targetAmount"]["rawToken"],"1.2500e2");assert_eq!(w["targetAmount"]["sha256"],hex(&Sha256::digest(b"1.2500e2")));assert_eq!(w["itemAmount"]["rawToken"],"-0.25");assert!(w["curAmount"].is_null());assert!(w["effectiveCurrentAmount"].is_null());assert_eq!(w["nonNativeCurAmountField"]["sha256"],hex(&Sha256::digest(b"999")));assert_eq!(w["gridObjectIdsCollectedTyped"]["entries"][0]["gridId"],4294967295u32);assert_eq!(w["gridObjectIdsCollectedTyped"]["entries"][1]["completePhysicalAddress"],false);assert_eq!(v["placementReadSet"]["unknownItemIdCount"],1);assert_eq!(v["placementReadSet"]["allEffectiveReferencesVerified"],false);
 for k in ["writerAuthorized","rightsVerified","variationVerified","effectiveItemDbVerified","productReadAccepted","editedCopyAuthorized","applyAuthorized","nativeV3Verified"]{assert_eq!(v[k],false,"{k}");}
 assert_eq!(s.receipt().unwrap(),before);assert!(s.read_private_furniture_amount_dependencies(e,ITEM,[9;32]).is_err());let mut x=e;x.expected_index_generation+=1;assert!(s.read_private_furniture_amount_dependencies(x,ITEM,h).is_err());let mut x=e;x.action=WorkerAction::Stage;assert!(s.read_private_furniture_amount_dependencies(x,ITEM,h).is_err());assert!(open(raw.as_bytes().to_vec()).read_private_furniture_amount_dependencies(e,ITEM,h).is_err());s.close().unwrap();assert!(s.read_private_furniture_amount_dependencies(e,ITEM,h).is_err());
}
#[test]
fn qac1062_single_array_bound(){
 let mut d=doc();let o=&mut d["World"]["MissionSlots"]["0"]["Slots"][0]["MissionSteps"][0]["SubSteps"][0]["Objectives"][0];o["ItemIdsCollected"]=json!(vec![0;16384]);assert!(read(&d).is_ok());d["World"]["MissionSlots"]["0"]["Slots"][0]["MissionSteps"][0]["SubSteps"][0]["Objectives"][0]["ItemIdsCollected"]=json!(vec![0;16385]);assert!(read(&d).is_err());
}
fn aggregate(extra:usize)->Value{let mut d=doc();d["World"]["MissionSlots"]["0"]["Slots"][0]["MissionSteps"][0]["SubSteps"][0]["Objectives"]=json!([{"ItemIdsCollected":vec![0;16384]},{"ItemIdsCollected":vec![0;16384]}]);d["Player"]["AchievementsData"]=json!([{"AchievementID":2110000001,"TypesCollected":vec![0;16384],"ItemsUsed":vec![0;16384]},{"AchievementID":2110000002,"TypesCollected":vec![0;extra]}]);d}
#[test]
fn qac1062_cross_domain_reference_bound(){
 let v=read(&aggregate(0)).expect("65536 refs accepted");let s=&v["subscriberReadSet"];let m=&s["missionSlots"]["groups"][0]["slots"][0]["steps"][0]["subSteps"][0]["objectives"];let n:usize=m.as_array().unwrap().iter().map(|x|x["witness"]["itemIdsCollectedTyped"]["entries"].as_array().unwrap().len()).sum::<usize>()+s["achievementsData"]["entries"].as_array().unwrap().iter().map(|x|x["typesCollectedTyped"]["entries"].as_array().unwrap().len()+x["itemsUsedTyped"]["entries"].as_array().unwrap().len()).sum::<usize>();assert_eq!(n,65536);
 assert!(read(&aggregate(1)).is_err(),"AMOUNT_DEP_REFERENCE_BOUND: aggregate 65537 must be rejected across Mission/Evolve and Achievement, not merely per budget");
}
