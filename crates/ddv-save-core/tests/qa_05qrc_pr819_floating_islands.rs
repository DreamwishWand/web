//! 05 QR-C independent changed-only QA for 01A PR819 FloatingIslands root links.
//! Public synthetic JSON ONLY. Reuses the single accepted Rust ProductSession.
#![cfg(feature="private-native-v1")]
use ddv_save_core::{
    BuildIdentity,BuildKind,Platform,ProductSession,WorkerAction,WorkerEnvelope,
    PRODUCT_WORKER_CONTRACT,
};
use serde_json::{json,Value};
use sha2::{Digest,Sha256};
use std::sync::Arc;
const FULL_VERSION:&str="releases_1.25-v1.25.3-44-g0b41250d9ac0-incremental-22";
const ISLAND1:&str="1540000147";
const ISLAND2:&str="1540000148";
fn build()->BuildIdentity{
    BuildIdentity{platform:Platform::SteamWindows,build_kind:BuildKind::SteamFullVersion,
      build_id:FULL_VERSION.into(),schema:626,externally_attested:true}
}
fn fixture()->Value{
    json!({
      "GameInfo":{"Version":626},
      "Player":{"future":"private-but-synthetic","value":100},
      "World":{
        "Villages":[
          {"Areas":{"1":{"GridIDs":[7],"unknownAreaFlag":{"preserve":true}}}},
          {"Areas":{"2":{"GridIDs":[10]}}}
        ],
        "FloatingIslands":{
          "1540000147":{"SceneItemId":1540000147u64,"GridIDs":[8],"unknownIslandFuture":["unchanged"]},
          "1540000148":{"SceneItemId":1540000148u64,"GridIDs":[9]}
        },
        "GridCollection":{"Grids":{
          "7":{"ID":7,"Objects":{"4":{"ID":4}}},
          "8":{"ID":8,"Objects":{"4":{"ID":4}}},
          "9":{"ID":9,"Objects":{}},
          "10":{"ID":10,"Objects":{"5":{"ID":5}}}
        }},
        "Opaque":{"untypedNested":{"keep":["🌱",null]}}
      },
      "UnknownRoot":{"future":1}
    })
}
fn session(v:&Value)->ProductSession{
    ProductSession::open_decoded_readonly(serde_json::to_vec(v).unwrap(),build())
      .expect("public synthetic source should open")
}
fn scope(s:&ProductSession)->WorkerEnvelope{
    let r=s.receipt().expect("session receipt");
    WorkerEnvelope{contract:PRODUCT_WORKER_CONTRACT,session_id:r.session_id,
      expected_revision:r.revision,expected_index_generation:r.index_generation,
      expected_decoded_sha256:r.decoded_sha256,action:WorkerAction::ReadDomain}
}
fn deny(v:Value,code:&str){
    let s=session(&v);let before=s.receipt().unwrap();let e=scope(&s);
    let err=s.verify_native_area_grid_slice(e).err()
      .expect("adversarial FloatingIsland ref must fail closed");
    assert_eq!(err.0,code);
    let after=s.receipt().unwrap();
    assert_eq!(after.decoded_sha256,before.decoded_sha256,"no source rewrite");
    assert_eq!((after.revision,after.index_generation),(before.revision,before.index_generation));
    assert!(!after.writer_authorized&&!after.product_read_accepted&&!after.apply_authorized);
}
#[test]
fn qrc819_two_islands_two_areas_exact_direct_roots_and_opaque_bytes_preserved(){
    let v=fixture();let raw=serde_json::to_vec(&v).unwrap();
    let sha:[u8;32]=Sha256::digest(&raw).into();
    let s=session(&v);let e=scope(&s);let got=s.verify_native_area_grid_slice(e).unwrap();
    assert_eq!(got.session_id,e.session_id);
    assert_eq!(got.decoded_sha256,sha);
    assert_eq!((got.revision,got.index_generation),(0,1));
    assert_eq!((got.village_records,got.area_records,got.grid_records,got.direct_area_grid_links,
        got.grid_object_identity_records),(2,2,4,2,3));
    assert!(got.floating_island_map_present && got.direct_root_ownership_unique);
    assert_eq!((got.floating_island_records,got.floating_island_direct_grid_links),(2,2));
    assert!(!got.full_native_reference_closure_verified);
    assert!(!got.area_group_footprint_verified && !got.native_v3_verified);
    assert!(!got.product_read_accepted && !got.writer_authorized);
    let now=s.receipt().unwrap();
    assert_eq!(now.decoded_sha256,sha,"opaque unknown fields must remain byte-identical");
    assert_eq!((now.revision,now.index_generation),(0,1),"read-only index must not bump CAS");
    assert!(!now.edited_copy_authorized&&!now.apply_authorized);
}
#[test]
fn qrc819_absent_map_is_unknown_present_empty_map_and_locked_island_not_native_proof(){
    let mut absent=fixture();
    absent["World"].as_object_mut().unwrap().remove("FloatingIslands");
    let s=session(&absent);
    let r=s.verify_native_area_grid_slice(scope(&s)).unwrap();
    assert!(!r.floating_island_map_present&&!r.direct_root_ownership_unique);
    assert_eq!((r.floating_island_records,r.floating_island_direct_grid_links),(0,0));
    assert!(!r.full_native_reference_closure_verified&&!r.product_read_accepted&&!r.writer_authorized);
    let mut empty=fixture();
    empty["World"]["FloatingIslands"]=json!({});
    let s=session(&empty);
    let r=s.verify_native_area_grid_slice(scope(&s)).unwrap();
    assert!(r.floating_island_map_present&&r.direct_root_ownership_unique);
    assert_eq!((r.floating_island_records,r.floating_island_direct_grid_links),(0,0));
    assert!(!r.full_native_reference_closure_verified);
    let mut locked=fixture();
    locked["World"]["FloatingIslands"]=json!({
       "1540000147":{"SceneItemId":1540000147u64,"GridIDs":[]}
    });
    let s=session(&locked);
    let r=s.verify_native_area_grid_slice(scope(&s)).unwrap();
    assert_eq!((r.floating_island_records,r.floating_island_direct_grid_links),(1,0));
    assert!(r.floating_island_map_present&&!r.writer_authorized);
}
#[test]
fn qrc819_orphan_duplicates_root_alias_across_island_and_area_are_denied(){
    let mut v=fixture();v["World"]["FloatingIslands"][ISLAND1]["GridIDs"]=json!([333]);
    deny(v,"NATIVE_REF_ORPHAN_FLOATING_GRID");
    let mut v=fixture();v["World"]["FloatingIslands"][ISLAND1]["GridIDs"]=json!([8,8]);
    deny(v,"NATIVE_REF_DUPLICATE_FLOATING_GRID_LINK");
    let mut v=fixture();v["World"]["FloatingIslands"][ISLAND2]["GridIDs"]=json!([8]);
    deny(v,"NATIVE_REF_CROSS_LOCATION_ROOT_ALIAS");
    let mut v=fixture();v["World"]["FloatingIslands"][ISLAND1]["GridIDs"]=json!([7]);
    deny(v,"NATIVE_REF_CROSS_LOCATION_ROOT_ALIAS");
    let mut v=fixture();v["World"]["FloatingIslands"][ISLAND1]["GridIDs"]=json!([10]);
    deny(v,"NATIVE_REF_CROSS_LOCATION_ROOT_ALIAS");
    let mut v=fixture();v["World"]["Villages"][1]["Areas"]["2"]["GridIDs"]=json!([7]);
    deny(v,"NATIVE_REF_CROSS_LOCATION_ROOT_ALIAS");
}
#[test]
fn qrc819_island_scene_key_map_and_gridids_typed_required_fail_closed(){
    let mut v=fixture();v["World"]["FloatingIslands"][ISLAND1]["SceneItemId"]=json!(1540000148u64);
    deny(v,"NATIVE_REF_ISLAND_SCENE_KEY_ID_MISMATCH");
    let mut v=fixture();v["World"]["FloatingIslands"][ISLAND1]["SceneItemId"]=json!("1540000147");
    deny(v,"NATIVE_REF_TYPED_INTEGER_REQUIRED");
    let mut v=fixture();v["World"]["FloatingIslands"][ISLAND1]["SceneItemId"]=json!(null);
    deny(v,"NATIVE_REF_TYPED_INTEGER_REQUIRED");
    let mut v=fixture();v["World"]["FloatingIslands"][ISLAND1].as_object_mut().unwrap().remove("SceneItemId");
    deny(v,"NATIVE_REF_REQUIRED_FIELD_MISSING");
    let mut v=fixture();v["World"]["FloatingIslands"][ISLAND1].as_object_mut().unwrap().remove("GridIDs");
    deny(v,"NATIVE_REF_REQUIRED_FIELD_MISSING");
    let mut v=fixture();v["World"]["FloatingIslands"][ISLAND1]["GridIDs"]=json!(null);
    deny(v,"NATIVE_REF_ARRAY_REQUIRED");
    let mut v=fixture();v["World"]["FloatingIslands"][ISLAND1]["GridIDs"]=json!({"8":true});
    deny(v,"NATIVE_REF_ARRAY_REQUIRED");
    let mut v=fixture();v["World"]["FloatingIslands"][ISLAND1]["GridIDs"]=json!(["8"]);
    deny(v,"NATIVE_REF_TYPED_INTEGER_REQUIRED");
    let mut v=fixture();v["World"]["FloatingIslands"][ISLAND1]["GridIDs"]=json!([-1]);
    deny(v,"NATIVE_REF_TYPED_INTEGER_REQUIRED");
    let mut v=fixture();v["World"]["FloatingIslands"][ISLAND1]["GridIDs"]=json!([9007199254740992_u64]);
    deny(v,"NATIVE_REF_INTEGER_BOUNDS");
    let mut v=fixture();v["World"]["FloatingIslands"]=json!([]);
    deny(v,"NATIVE_REF_OBJECT_REQUIRED");
    let mut v=fixture();v["World"]["FloatingIslands"]=json!(null);
    deny(v,"NATIVE_REF_OBJECT_REQUIRED");
    let mut v=fixture();v["World"]["FloatingIslands"]["0"]=json!({"SceneItemId":0,"GridIDs":[]});
    deny(v,"NATIVE_REF_ISLAND_SCENE_ID_ZERO");
    let mut v=fixture();v["World"]["FloatingIslands"]["01540000147"]=json!({"SceneItemId":1540000147u64,"GridIDs":[]});
    deny(v,"NATIVE_REF_NONCANONICAL_KEY");
}
#[test]
fn qrc819_single_save_session_cas_fake_session_stale_scope_close_and_read_domain_only(){
    let s=Arc::new(session(&fixture()));let e=scope(&s);
    let mut forged=e;forged.session_id[0]^=0x40;
    assert_eq!(s.verify_native_area_grid_slice(forged).unwrap_err().0,"SESSION_SOURCE_SCOPE_MISMATCH");
    let mut forged=e;forged.expected_decoded_sha256[0]^=1;
    assert_eq!(s.verify_native_area_grid_slice(forged).unwrap_err().0,"SESSION_SOURCE_SCOPE_MISMATCH");
    let mut stale=e;stale.expected_revision+=1;
    assert_eq!(s.verify_native_area_grid_slice(stale).unwrap_err().0,"SESSION_REVISION_GENERATION_CAS");
    let mut stale=e;stale.expected_index_generation+=1;
    assert_eq!(s.verify_native_area_grid_slice(stale).unwrap_err().0,"SESSION_REVISION_GENERATION_CAS");
    for action in [WorkerAction::Stage,WorkerAction::Apply,WorkerAction::ExportEditedCopy]{
        assert!(s.verify_native_area_grid_slice(WorkerEnvelope{action,..e}).is_err());
    }
    let other=session(&fixture());
    assert!(s.verify_native_area_grid_slice(scope(&other)).is_err());
    let jobs=(0..4).map(|_|{
        let s=Arc::clone(&s);
        std::thread::spawn(move || s.verify_native_area_grid_slice(e)
            .map(|r|(r.floating_island_records,r.floating_island_direct_grid_links)))
    }).collect::<Vec<_>>();
    for task in jobs{assert_eq!(task.join().unwrap().unwrap(),(2,2));}
    assert_eq!(s.receipt().unwrap().revision,0);
    s.close().unwrap();
    assert!(s.verify_native_area_grid_slice(e).is_err());
}
#[test]
fn qrc819_exact_steam_build_and_schema_reject_without_promoting_switch_bid(){
    let data=serde_json::to_vec(&fixture()).unwrap();
    for bad in [
        BuildIdentity{schema:624,..build()},
        BuildIdentity{externally_attested:false,..build()},
        BuildIdentity{build_id:"9A239D3DB569756D".into(),..build()},
        BuildIdentity{platform:Platform::Switch,..build()},
        BuildIdentity{build_kind:BuildKind::SwitchBid,..build()},
    ]{
        assert!(ProductSession::open_decoded_readonly(data.clone(),bad).is_err(),
           "Steam FullVersion proof cannot be derived from a Switch BID/schema");
    }
    let mut bad=fixture();bad["GameInfo"]["Version"]=json!(624);
    assert!(ProductSession::open_decoded_readonly(serde_json::to_vec(&bad).unwrap(),build()).is_err());
}
