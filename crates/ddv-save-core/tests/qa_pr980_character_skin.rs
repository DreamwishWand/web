#![cfg(all(feature="private-native-v1",not(target_arch="wasm32")))]
use ddv_save_core::{BuildIdentity,BuildKind,Platform,ProductSession,WorkerAction,WorkerEnvelope,PRODUCT_WORKER_CONTRACT,IndexedDomain};
use serde_json::json;
fn open()->ProductSession{
 let v=json!({"GameInfo":{"Version":626},"World":{"Characters":[{"Base":{"id":10000053},"SkinID":0}]},"Player":{"ListInventories":{"42":{"ID":42,"CompatibleItemType":"ItemType_Skin","Inventory":{"170000000":{"Amount":1}}}},"AvatarIsMale":false,"FemaleAvatar":{},"MaleAvatar":{}}});
 ProductSession::open_decoded_readonly(serde_json::to_vec(&v).unwrap(),BuildIdentity{platform:Platform::SteamWindows,build_kind:BuildKind::SteamFullVersion,build_id:"releases_1.25-v1.25.3-44-g0b41250d9ac0-incremental-22".into(),schema:626,externally_attested:true}).unwrap()
}
#[test]
fn skin_scope_cursor_and_avatar_share_immutable_epoch(){
 let s=open();let r=s.receipt().unwrap();
 let e=WorkerEnvelope{contract:PRODUCT_WORKER_CONTRACT,session_id:r.session_id,expected_revision:r.revision,expected_index_generation:r.index_generation,expected_decoded_sha256:r.decoded_sha256,action:WorkerAction::ReadDomain};
 let token=s.issue_indexed_cursor(e,IndexedDomain::World).unwrap().cursor;
 let v=s.read_private_character_skin(e,10000053,170000000).unwrap().to_private_receipt_json();assert_eq!(v["character"]["currentSkinId"],0);assert_eq!(v["writerAuthorized"],false);
 assert_eq!(s.read_private_active_avatar(e).unwrap().to_private_receipt_json()["activeBranch"],"FemaleAvatar");assert_eq!(s.receipt().unwrap(),r);
 let p=s.read_indexed_page(e,token).unwrap();assert_eq!(p.fields.len(),1);assert!(s.read_indexed_page(e,token).is_err());
 let mut bad=e;bad.expected_index_generation+=1;assert!(s.read_private_character_skin(bad,10000053,170000000).is_err());
 bad=e;bad.expected_decoded_sha256[0]^=1;assert!(s.read_private_character_skin(bad,10000053,170000000).is_err());
 bad=e;bad.expected_revision+=1;assert!(s.read_private_character_skin(bad,10000053,170000000).is_err());
 bad=e;bad.action=WorkerAction::Stage;assert!(s.read_private_character_skin(bad,10000053,170000000).is_err());
 assert!(open().read_private_character_skin(e,10000053,170000000).is_err());assert_eq!(s.receipt().unwrap(),r);s.close().unwrap();assert!(s.read_private_character_skin(e,10000053,170000000).is_err());
}
