//! 05 QR-C: independent changed-only PR807 Area→GridID Rust Native slice QA.
//! PUBLIC SYNTHETIC ONLY. Exercises existing ProductSession (not another reader).
#![cfg(feature="private-native-v1")]
use ddv_save_core::{
    BuildIdentity, BuildKind, Platform, ProductSession, WorkerAction,
    WorkerEnvelope, PRODUCT_WORKER_CONTRACT,
};
use serde_json::{json, Value};
use sha2::{Digest,Sha256};
use std::sync::Arc;
const FULL_VERSION:&str="releases_1.25-v1.25.3-44-g0b41250d9ac0-incremental-22";
fn build()->BuildIdentity{
    BuildIdentity{platform:Platform::SteamWindows,build_kind:BuildKind::SteamFullVersion,
        build_id:FULL_VERSION.to_string(),schema:626,externally_attested:true}
}
fn fixture()->Value{
    json!({
       "GameInfo":{"Version":626},
       "Player":{"synthetic":true,"preserve":"🪴"},
       "World":{
         "Villages":[
           {"Areas":{"1":{"GridIDs":[7,8],"unknown":{"Group":"not validated"}},
                     "3":{"GridIDs":[]}}},
           {"Areas":{"2":{"GridIDs":[8]}}}
         ],
         "GridCollection":{"Grids":{
            "7":{"ID":7,"Objects":{"4":{"ID":4,"ItemID":99}}},
            "8":{"ID":8,"Objects":{"4":{"ID":4,"UnknownFuture":["preserve",null]},
                                 "5":{"ID":5}}}
         }},
         "Opaque":{"unknownNested":[{"future":"untouched"}]}
       },
       "Extra":{"opaque":["🍃",null,{"j":200}]}
    })
}
fn open(value:&Value)->ProductSession{
    ProductSession::open_decoded_readonly(
      serde_json::to_vec(value).unwrap(),build()).expect("valid public synthetic JSON")
}
fn scope(s:&ProductSession)->WorkerEnvelope{
    let r=s.receipt().unwrap();
    WorkerEnvelope{contract:PRODUCT_WORKER_CONTRACT,session_id:r.session_id,
      expected_revision:r.revision,expected_index_generation:r.index_generation,
      expected_decoded_sha256:r.decoded_sha256,action:WorkerAction::ReadDomain}
}
#[test]
fn qrc807_positive_only_direct_links_and_per_grid_object_scope(){
    let value=fixture();
    let raw=serde_json::to_vec(&value).unwrap();
    let orig_sha: [u8;32]=Sha256::digest(&raw).into();
    let s=open(&value);
    let e=scope(&s);
    let receipt=s.verify_native_area_grid_slice(e).unwrap();
    assert_eq!((receipt.village_records,receipt.area_records,receipt.grid_records,
       receipt.direct_area_grid_links,receipt.grid_object_identity_records),(2,3,2,3,3));
    assert_eq!(receipt.session_id,e.session_id);
    assert_eq!(receipt.decoded_sha256,orig_sha);
    assert_eq!((receipt.revision,receipt.index_generation),(0,1));
    assert!(!receipt.full_native_reference_closure_verified);
    assert!(!receipt.area_group_footprint_verified);
    assert!(!receipt.native_v3_verified && !receipt.product_read_accepted && !receipt.writer_authorized);
    let now=s.receipt().unwrap();
    assert_eq!((now.revision,now.index_generation),(0,1),"read must not mutate revision");
    assert_eq!(now.decoded_sha256,orig_sha,"no unknown field rewrite");
    assert!(!now.writer_authorized && !now.edited_copy_authorized && !now.apply_authorized);
    assert!(s.dispatch(WorkerEnvelope{action:WorkerAction::Stage,..e}).is_err(),"product Writer stays disabled");
    assert!(s.dispatch(WorkerEnvelope{action:WorkerAction::Apply,..e}).is_err(),"product Apply stays disabled");
}
#[test]
fn qrc807_negative_structural_orphans_duplicate_and_canonical_numeric_bounds(){
    let mut cases:Vec<(&str,Value)>=Vec::new();
    let mut v=fixture();v["World"]["Villages"][0]["Areas"]["1"]["GridIDs"]=json!([7,999]);
    cases.push(("orphan reference",v));
    let mut v=fixture();v["World"]["Villages"][0]["Areas"]["1"]["GridIDs"]=json!([7,7]);
    cases.push(("duplicate link within Area",v));
    let mut v=fixture();v["World"]["Villages"]=json!({});
    cases.push(("invalid village collection",v));
    let mut v=fixture();v["World"]["Villages"][0]["Areas"]=json!([]);
    cases.push(("invalid Areas shape",v));
    let mut v=fixture();v["World"]["Villages"][0]["Areas"]["1"]["GridIDs"]=json!(null);
    cases.push(("null GridIDs",v));
    let mut v=fixture();v["World"]["Villages"][0]["Areas"]["1"]["GridIDs"]=json!(["7",8]);
    cases.push(("string ID",v));
    let mut v=fixture();v["World"]["Villages"][0]["Areas"]["1"]["GridIDs"]=json!([7,-1]);
    cases.push(("negative ID",v));
    let mut v=fixture();v["World"]["Villages"][0]["Areas"]["1"]["GridIDs"]=json!([7,9007199254740992u64]);
    cases.push(("unsafe JS integer",v));
    let mut v=fixture();v["World"]["GridCollection"]["Grids"]["7"]["ID"]=json!(8);
    cases.push(("grid ID-key mismatch",v));
    let mut v=fixture();v["World"]["GridCollection"]["Grids"]["7"]["ID"]=json!("7");
    cases.push(("grid ID string invalid",v));
    let mut v=fixture();v["World"]["GridCollection"]["Grids"]["7"]["Objects"]["4"]["ID"]=json!(100);
    cases.push(("ObjectID-key mismatch",v));
    let mut v=fixture();v["World"]["GridCollection"]["Grids"]["7"]["Objects"]["4"]["ID"]=json!("4");
    cases.push(("ObjectID string invalid",v));
    let mut v=fixture();v["World"]["GridCollection"]["Grids"]["07"]=json!({"ID":7});
    cases.push(("noncanonical leading zero grid key",v));
    let mut v=fixture();v["World"]["GridCollection"]["Grids"]["7"]["Objects"]["04"]=json!({"ID":4});
    cases.push(("noncanonical ObjectID alias",v));
    let mut v=fixture();v["World"]["Villages"][0]["Areas"]["01"]=json!({"GridIDs":[7]});
    cases.push(("noncanonical Area key",v));
    let mut v=fixture();v["World"]["GridCollection"]["Grids"]=json!([]);
    cases.push(("wrong Grid collection shape",v));
    let mut v=fixture();v["World"]["GridCollection"]=json!(null);
    cases.push(("missing Grid collection map",v));
    for (name,value) in cases {
      let s=open(&value);let e=scope(&s);
      assert!(s.verify_native_area_grid_slice(e).is_err(),"must fail closed {name}");
      let r=s.receipt().unwrap();
      assert_eq!((r.revision,r.index_generation),(0,1),"{name}: failed scan not mutate");
      assert!(!r.writer_authorized && !r.product_read_accepted,"{name}: no product authority");
    }
}
#[test]
fn qrc807_negative_session_revision_generation_sha_action_and_close(){
    let s=open(&fixture());let e=scope(&s);
    let mut bad=e;bad.session_id[0]^=0x80;
    assert!(s.verify_native_area_grid_slice(bad).is_err(),"forged SessionID");
    let mut bad=e;bad.expected_decoded_sha256[7]^=1;
    assert!(s.verify_native_area_grid_slice(bad).is_err(),"source SHA mismatch");
    assert!(s.verify_native_area_grid_slice(WorkerEnvelope{
       expected_revision:e.expected_revision+1,..e}).is_err(),"stale revision");
    assert!(s.verify_native_area_grid_slice(WorkerEnvelope{
       expected_index_generation:e.expected_index_generation+1,..e}).is_err(),"wrong generation");
    assert!(s.verify_native_area_grid_slice(WorkerEnvelope{
       action:WorkerAction::Stage,..e}).is_err(),"Writer action");
    assert!(s.verify_native_area_grid_slice(WorkerEnvelope{
       action:WorkerAction::ExportEditedCopy,..e}).is_err(),"Export action");
    assert!(s.verify_native_area_grid_slice(WorkerEnvelope{
       contract:"forged.product.session.contract",..e}).is_err(),"forged ABI contract");
    let other=open(&fixture());assert_ne!(scope(&other).session_id,e.session_id);
    assert!(other.verify_native_area_grid_slice(e).is_err(),"cross-session replay");
    assert_eq!((s.receipt().unwrap().revision,s.receipt().unwrap().index_generation),(0,1));
    s.close().unwrap();
    assert!(s.verify_native_area_grid_slice(e).is_err(),"closed session rejects read");
    assert!(s.receipt().is_err());
}
#[test]
fn qrc807_concurrent_reads_use_one_product_session_and_close_revoke(){
    let source=Arc::new(open(&fixture()));
    let e=scope(&source);
    let handles=(0..8).map(|_|{
       let cloned=Arc::clone(&source);
       std::thread::spawn(move || cloned.verify_native_area_grid_slice(e)
                              .map(|r|(r.grid_records,r.direct_area_grid_links)))
    }).collect::<Vec<_>>();
    for job in handles{assert_eq!(job.join().unwrap().unwrap(),(2,3));}
    assert_eq!(source.receipt().unwrap().revision,0);
    source.close().unwrap();
    assert!(source.verify_native_area_grid_slice(e).is_err());
}
#[test]
fn qrc807_exact_build_and_duplicate_json_source_fail_without_read_proof(){
    let value=fixture();let bytes=serde_json::to_vec(&value).unwrap();
    for mut build in [
      BuildIdentity{externally_attested:false,..build()},
      BuildIdentity{schema:624,..build()},
      BuildIdentity{platform:Platform::Switch,..build()},
      BuildIdentity{build_id:"9A239D3DB569756D".into(),..build()},
    ]{
       build.externally_attested=build.externally_attested;
       assert!(ProductSession::open_decoded_readonly(bytes.clone(),build).is_err(),
         "Steam registry cannot infer Switch BID or unattested version");
    }
    let duplicate=br#"{"GameInfo":{"Version":626},"Player":{},"World":{"Villages":[],"GridCollection":{"Grids":{"7":{"ID":7},"7":{"ID":7}}}}}"#.to_vec();
    assert!(ProductSession::open_decoded_readonly(duplicate,build()).is_err(),
        "duplicate JSON map keys must reject during already accepted full-document scan");
}
