#![cfg(all(feature="private-native-v1",not(target_arch="wasm32")))]
use ddv_save_core::{BuildIdentity,BuildKind,Platform,ProductSession,WorkerAction,WorkerEnvelope,PRODUCT_WORKER_CONTRACT,IndexedDomain};
use serde_json::json;
fn open()->ProductSession{
    let v=json!({"GameInfo":{"Version":626},"World":{},"Player":{"AvatarIsMale":true,"FemaleAvatar":{"HairColorIndex":0},"MaleAvatar":{"HairColorIndex":89,"HairHighlightColor":0}}});
    ProductSession::open_decoded_readonly(serde_json::to_vec(&v).unwrap(),BuildIdentity{platform:Platform::SteamWindows,build_kind:BuildKind::SteamFullVersion,build_id:"releases_1.25-v1.25.3-44-g0b41250d9ac0-incremental-22".into(),schema:626,externally_attested:true}).unwrap()
}
#[test]
fn avatar_scope_and_cursor_are_same_session_and_fail_closed(){
    let s=open();let r=s.receipt().unwrap();
    let e=WorkerEnvelope{contract:PRODUCT_WORKER_CONTRACT,session_id:r.session_id,expected_revision:r.revision,expected_index_generation:r.index_generation,expected_decoded_sha256:r.decoded_sha256,action:WorkerAction::ReadDomain};
    let token=s.issue_indexed_cursor(e,IndexedDomain::Player).unwrap().cursor;
    let v=s.read_private_active_avatar(e).unwrap().to_private_receipt_json();assert_eq!(v["activeBranch"],"MaleAvatar");
    assert_eq!(s.receipt().unwrap(),r);
    let page=s.read_indexed_page(e,token).unwrap();assert_eq!(page.fields.len(),3);assert!(page.next_cursor.is_none());assert!(s.read_indexed_page(e,token).is_err());
    let mut stale=e;stale.expected_index_generation+=1;assert!(s.read_private_active_avatar(stale).is_err());
    let mut bad=e;bad.expected_decoded_sha256[0]^=1;assert!(s.read_private_active_avatar(bad).is_err());
    let mut rev=e;rev.expected_revision+=1;assert!(s.read_private_active_avatar(rev).is_err());
    let mut wrong=e;wrong.action=WorkerAction::Stage;assert!(s.read_private_active_avatar(wrong).is_err());
    assert!(open().read_private_active_avatar(e).is_err());assert_eq!(s.receipt().unwrap(),r);s.close().unwrap();assert!(s.read_private_active_avatar(e).is_err());
}
