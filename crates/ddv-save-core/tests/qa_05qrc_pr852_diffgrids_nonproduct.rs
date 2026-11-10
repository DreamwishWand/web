//! 05 QR-C changed-only independent QA / PR852: public synthetic DiffGrids diagnostic.
 //! No external P1G/Steam Save or Native ID authority; one Rust ProductSession.
#![cfg(feature="private-native-v1")]
use ddv_save_core::{
    BuildIdentity, BuildKind, Platform, ProductSession, WorkerAction, WorkerEnvelope,
    PRODUCT_WORKER_CONTRACT
};
use serde_json::{json, Value};
use std::sync::Arc;

const FULL:&str="releases_1.25-v1.25.3-44-g0b41250d9ac0-incremental-22";
fn steam()->BuildIdentity{
    BuildIdentity{platform:Platform::SteamWindows,build_kind:BuildKind::SteamFullVersion,
        build_id:FULL.into(),schema:626,externally_attested:true}
}
fn switch()->BuildIdentity{
    BuildIdentity{platform:Platform::Switch,build_kind:BuildKind::SwitchBid,
        build_id:"9A239D3DB569756D".into(),schema:626,externally_attested:true}
}
fn base()->Value{
    json!({"GameInfo":{"Version":626},"Player":{"unknown_nested":{"retain":[1,true,{"key":"OPAQUE_NO_EDIT"}]}},
        "World":{"Villages":[{"Areas":{"1":{"GridIDs":[7]}}}],
        "GridCollection":{"Grids":{"7":{"ID":7,"Objects":{"4":{"ID":4,"ItemID":100}}}}},
        "UnrelatedUnknown":{"opaque":"DO_NOT_TOUCH_OR_EXPOSE"}}})
}
fn sample()->Value{
    let mut v=base();
    v["World"]["GridCollection"]["DiffGrids"]=json!({
        "7":{"ID":7,"DefaultLayoutGridID":0,"GridDefaultLayoutPath":"secret_source/layout-never-output.json",
            "ModifiedObjects":{"4":{"ID":4,"unknown_extension":{"x":[1,2]}},"5":{"ID":5}},
            "RemovedObjects":[4,4,5,6],"MysteryFutureField":{"keep":true}},
        "8":{"ID":8,"ModifiedObjects":{"4":{"ID":4}},
            "RemovedObjects":{"anonymous":4},"Unknown":"retain"}
    });
    v
}
fn session(v:&Value,build:BuildIdentity)->ProductSession{
    ProductSession::open_decoded_readonly(serde_json::to_vec(v).unwrap(),build).unwrap()
}
fn envelope(s:&ProductSession)->WorkerEnvelope{
    let r=s.receipt().unwrap();
    WorkerEnvelope{contract:PRODUCT_WORKER_CONTRACT,session_id:r.session_id,
        expected_revision:r.revision,expected_index_generation:r.index_generation,
        expected_decoded_sha256:r.decoded_sha256,action:WorkerAction::ReadDomain}
}
#[test]
fn qrc852_only_nonproduct_same_rust_session_build_sha_counts_and_unknown_unchanged(){
    let v=sample();let original=serde_json::to_vec(&v).unwrap();
    let s=session(&v,steam());
    let before=s.receipt().unwrap();
    let r=s.inspect_native_diffgrids_nonproduct(envelope(&s)).unwrap();
    let after=s.receipt().unwrap();
    assert!(r.diff_grids_map_present);
    assert_eq!((r.diff_grid_records,r.modified_object_records,r.removed_object_records,
        r.modified_removed_id_intersections),(2,3,5,3));
    assert_eq!((r.removed_array_maps,r.removed_object_maps),(1,1));
    assert_eq!((r.default_layout_grid_id_records,r.default_layout_zero_id_records,
        r.grid_default_layout_path_records),(1,1,1));
    assert_eq!((r.session_id,r.revision,r.index_generation,r.decoded_sha256),
        (before.session_id,before.revision,before.index_generation,before.decoded_sha256));
    assert_eq!((before.revision,before.index_generation,before.decoded_sha256),
        (after.revision,after.index_generation,after.decoded_sha256));
    assert_eq!(serde_json::to_vec(&v).unwrap(),original,"unknown fields remain opaque and immutable");
    assert!(!r.full_native_reference_closure_verified&&!r.product_read_accepted&&
        !r.native_v3_verified&&!r.writer_authorized);
    assert!(!after.all_domain_references_verified&&!after.product_read_accepted&&
        !after.writer_authorized&&!after.edited_copy_authorized&&!after.apply_authorized);
}
#[test]
fn qrc852_56_pairs_vs_14_entries_are_different_units_not_save_corruption(){
    let mut v=base();
    // Across 14 grids, each owns four overlapping IDs => 56 per-ID pairs;
    // per-Grid-entry count is 14. These synthetic counters are NOT private counts.
    let mut grids=serde_json::Map::new();
    for grid in 1u64..=14{
        let modified=(1..=4).map(|id|(id.to_string(),json!({"ID":id})))
            .collect::<serde_json::Map<String,Value>>();
        grids.insert(grid.to_string(),json!({"ID":grid,"ModifiedObjects":modified,
            "RemovedObjects":[1,2,3,4],"DefaultLayoutGridID":0}));
    }
    v["World"]["GridCollection"]["DiffGrids"]=Value::Object(grids);
    let s=session(&v,steam());
    let r=s.inspect_native_diffgrids_nonproduct(envelope(&s)).unwrap();
    assert_eq!((r.diff_grid_records,r.modified_object_records,r.removed_object_records,
        r.modified_removed_id_intersections),(14,56,56,56));
    assert_eq!(r.default_layout_zero_id_records,14);
    assert!(!r.product_read_accepted&&!r.full_native_reference_closure_verified);
}
#[test]
fn qrc852_all_targeted_invalid_grid_ids_types_paths_and_nulls_fail_closed(){
    let v=sample();
    let mut bad=Vec::new();
    let mut x=v.clone();x["World"]["GridCollection"]["DiffGrids"]["7"]["ID"]=json!(9);bad.push(x);
    let mut x=v.clone();x["World"]["GridCollection"]["DiffGrids"]["7"]["ModifiedObjects"]["4"]["ID"]=json!(99);bad.push(x);
    let mut x=v.clone();x["World"]["GridCollection"]["DiffGrids"]["7"]["RemovedObjects"]=json!(["4"]);bad.push(x);
    let mut x=v.clone();x["World"]["GridCollection"]["DiffGrids"]["7"]["RemovedObjects"]=Value::Null;bad.push(x);
    let mut x=v.clone();x["World"]["GridCollection"]["DiffGrids"]["7"]["ModifiedObjects"]=json!([]);bad.push(x);
    let mut x=v.clone();x["World"]["GridCollection"]["DiffGrids"]["7"]["DefaultLayoutGridID"]=json!("0");bad.push(x);
    let mut x=v.clone();x["World"]["GridCollection"]["DiffGrids"]["7"]["GridDefaultLayoutPath"]=json!(7);bad.push(x);
    let mut x=v.clone();x["World"]["GridCollection"]["DiffGrids"]["7"]["GridDefaultLayoutPath"]=json!("p".repeat(4098));bad.push(x);
    let mut x=v.clone();x["World"]["GridCollection"]["DiffGrids"]=Value::Null;bad.push(x);
    let mut x=v.clone();let mut map=x["World"]["GridCollection"]["DiffGrids"].as_object().unwrap().clone();
    let child=map.remove("8").unwrap();map.insert("08".into(),child);
    x["World"]["GridCollection"]["DiffGrids"]=Value::Object(map);bad.push(x);
    let mut x=v.clone();let mut map=x["World"]["GridCollection"]["DiffGrids"].as_object().unwrap().clone();
    let child=map.remove("8").unwrap();map.insert("9007199254740992".into(),child);
    x["World"]["GridCollection"]["DiffGrids"]=Value::Object(map);bad.push(x);
    for (i,doc) in bad.into_iter().enumerate(){
        let s=session(&doc,steam());
        assert!(s.inspect_native_diffgrids_nonproduct(envelope(&s)).is_err(),
            "malformed targeted DiffGrids class should fail: case {i}");
        assert!(!s.receipt().unwrap().product_read_accepted,"no partial acceptance {i}");
    }
}
#[test]
fn qrc852_absent_diffgrids_is_unknown_not_verified_or_effective_overlay(){
    let s=session(&base(),steam());
    let r=s.inspect_native_diffgrids_nonproduct(envelope(&s)).unwrap();
    assert!(!r.diff_grids_map_present);
    assert_eq!((r.diff_grid_records,r.modified_object_records,r.removed_object_records),(0,0,0));
    assert!(!r.full_native_reference_closure_verified&&!r.native_v3_verified&&
        !r.product_read_accepted&&!r.writer_authorized);
}
#[test]
fn qrc852_steam_switch_and_schema_matching_only_never_bypass_source_build_gate(){
    let v=sample();
    let sw=session(&v,switch());
    assert_eq!(sw.receipt().unwrap().schema,626);
    assert_eq!(sw.inspect_native_diffgrids_nonproduct(envelope(&sw)).unwrap_err().0,
        "DIFFGRIDS_EXACT_STEAM_FULLVERSION_REQUIRED");
    let st=session(&v,steam());
    assert_eq!(st.receipt().unwrap().decoded_sha256,sw.receipt().unwrap().decoded_sha256);
    assert!(st.inspect_native_diffgrids_nonproduct(envelope(&st)).is_ok());
    for build in [
        BuildIdentity{build_id:"releases_1.25-v1.25.3-OTHER".into(),..steam()},
        BuildIdentity{build_kind:BuildKind::SwitchBid,..steam()},
        BuildIdentity{schema:624,..steam()},
        BuildIdentity{externally_attested:false,..steam()},
        BuildIdentity{platform:Platform::Switch,..steam()},
    ]{
        assert!(ProductSession::open_decoded_readonly(serde_json::to_vec(&v).unwrap(),build).is_err(),
            "malformed externally declared source build must not open");
    }
}
#[test]
fn qrc852_stale_and_forged_scope_foreign_session_close_and_action_fail_closed(){
    let v=sample();let s=Arc::new(session(&v,steam()));let scope=envelope(&s);
    let other=session(&v,steam());
    assert_ne!(s.receipt().unwrap().session_id,other.receipt().unwrap().session_id);
    let mut bad=scope;bad.expected_revision+=1;
    assert!(s.inspect_native_diffgrids_nonproduct(bad).is_err());
    let mut bad=scope;bad.expected_index_generation+=1;
    assert!(s.inspect_native_diffgrids_nonproduct(bad).is_err());
    let mut bad=scope;bad.expected_decoded_sha256=[88;32];
    assert!(s.inspect_native_diffgrids_nonproduct(bad).is_err());
    let mut bad=scope;bad.session_id=[44;16];
    assert!(s.inspect_native_diffgrids_nonproduct(bad).is_err());
    let mut bad=scope;bad.action=WorkerAction::Stage;
    assert!(s.inspect_native_diffgrids_nonproduct(bad).is_err());
    assert!(s.inspect_native_diffgrids_nonproduct(envelope(&other)).is_err());
    let concurrent=(0..4).map(|_|{
        let a=Arc::clone(&s);
        std::thread::spawn(move||a.inspect_native_diffgrids_nonproduct(scope))
    }).collect::<Vec<_>>();
    for t in concurrent{
        let r=t.join().unwrap().unwrap();
        assert!(!r.writer_authorized&&!r.product_read_accepted);
        assert_eq!(r.modified_removed_id_intersections,3);
    }
    s.close().unwrap();
    assert!(s.inspect_native_diffgrids_nonproduct(scope).is_err());
}
