//! 05 QR-C independent changed-only PR881 test. Public synthetic JSON ONLY.
 //! Contract under test is stored-field typed Indexed Read. Not Native effective Grid.
#![cfg(feature="indexed-read")]
use ddv_save_core::{
    BuildIdentity,BuildKind,Platform,ProductSession,WorkerAction,WorkerEnvelope,
    IndexedDomain,StoredRemovedShape,ExternalLayoutStatus,PRODUCT_WORKER_CONTRACT
};
use serde_json::{json,Value};
use std::sync::Arc;
const STEAM:&str="releases_1.25-v1.25.3-44-g0b41250d9ac0-incremental-22";
fn steam()->BuildIdentity {
    BuildIdentity {platform:Platform::SteamWindows,build_kind:BuildKind::SteamFullVersion,
        build_id:STEAM.into(),schema:626,externally_attested:true}
}
fn switch()->BuildIdentity {
    BuildIdentity {platform:Platform::Switch,build_kind:BuildKind::SwitchBid,
        build_id:"9A239D3DB569756D".into(),schema:626,externally_attested:true}
}
fn doc()->Value {
    json!({"GameInfo":{"Version":626,"UnknownGameMetadata":{"opaque":true}},
        "Player":{"NeverReadPrivateValues":"SYNTHETIC_UNTOUCHED_UNKNOWN"},
        "World":{"GridCollection":{"Grids":{},
          "DiffGrids":{"0":{"ID":0,"DefaultLayoutGridID":0,
            "GridDefaultLayoutPath":"SYNTHETIC_UNKNOWN_LAYOUT_NOT_NATIVE",
            "GridDefaultLayoutType":"Synthetic, UnknownAssembly",
            "DefaultGridHashCode":-2147483648,
            "DefaultGridDataHashCode":2147483647,
            "ModifiedObjects":{"3":{"ID":3,"unknownFields":{"unknown":["retain",17]}},
                               "4":{"ID":4}},
            "RemovedObjects":[3,3,4,5],
            "unfamiliarFutureField":{"canonicalUnknown":true}
          },"13":{"ID":13,"ModifiedObjects":{"99":{"ID":99}},
            "RemovedObjects":{"notAnObjectIdKey":99,"second":100},
            "anotherExtension":{"nested":{}}}
          },"unknownSibling":{"unverified":"not native"}}}})
}
fn open(v:&Value,b:BuildIdentity)->ProductSession {
    ProductSession::open_decoded_readonly(serde_json::to_vec(v).unwrap(),b).unwrap()
}
fn scope(s:&ProductSession)->WorkerEnvelope {
    let r=s.receipt().unwrap();
    WorkerEnvelope{contract:PRODUCT_WORKER_CONTRACT,session_id:r.session_id,
        expected_revision:r.revision,expected_index_generation:r.index_generation,
        expected_decoded_sha256:r.decoded_sha256,action:WorkerAction::ReadDomain}
}
#[test]
fn pr881_stored_metadata_explicit_unknown_immutability_and_hash_storage_not_native_oracle(){
    let v=doc();let before=serde_json::to_vec(&v).unwrap();
    let s=open(&v,steam());let receipt=s.receipt().unwrap();
    assert_eq!((receipt.revision,receipt.index_generation), (0,1));
    let grant=s.issue_saved_diffgrids_cursor(scope(&s)).unwrap();
    assert_eq!(grant.indexed_records,2);
    assert_eq!(grant.max_records_per_page,8);
    assert_eq!((grant.session_id,grant.revision,grant.index_generation,grant.decoded_sha256),
        (receipt.session_id,receipt.revision,receipt.index_generation,receipt.decoded_sha256));
    assert!(!grant.all_native_references_verified&&!grant.product_read_accepted&&!grant.writer_authorized);
    let page=s.read_saved_diffgrids_page(scope(&s),grant.cursor).unwrap();
    assert_eq!(page.records.len(),2);
    let g=&page.records[0];
    assert_eq!(g.grid_id,0);
    assert_eq!(g.default_layout_grid_id,Some(0));
    assert_eq!(g.default_grid_hash_code,Some(i32::MIN));
    assert_eq!(g.default_grid_data_hash_code,Some(i32::MAX));
    assert_eq!(g.grid_default_layout_path.as_deref(),Some("SYNTHETIC_UNKNOWN_LAYOUT_NOT_NATIVE"));
    assert_eq!(g.grid_default_layout_type.as_deref(),Some("Synthetic, UnknownAssembly"));
    assert_eq!(g.modified_object_ids,[3,4]);
    assert_eq!(g.removed_object_ids,[3,3,4,5],"do NOT erase saved repeated removal values");
    assert_eq!(g.modified_removed_id_pairs,2,"count distinct per-grid intersections not removal occurrences");
    assert_eq!(g.removed_shape,StoredRemovedShape::Array);
    assert_eq!(g.external_layout,ExternalLayoutStatus::UnresolvedExternalLayout);
    assert_eq!(g.external_layout.as_str(),"UNRESOLVED_EXTERNAL_LAYOUT");
    assert!(!g.native_effective_grid_verified);
    let second=&page.records[1];
    assert_eq!(second.grid_id,13);
    assert_eq!(second.removed_shape,StoredRemovedShape::ObjectMap);
    assert_eq!(second.removed_object_ids,[99,100],"removed map keys are not Native ObjectIDs");
    assert!(second.default_layout_grid_id.is_none());
    assert_eq!(second.modified_removed_id_pairs,1);
    assert_eq!(second.external_layout,ExternalLayoutStatus::UnresolvedExternalLayout);
    assert!(!second.native_effective_grid_verified);
    assert_eq!(page.next_cursor,None);
    assert!(!page.all_native_references_verified&&!page.product_read_accepted&&!page.writer_authorized);
    assert!(s.read_saved_diffgrids_page(scope(&s),grant.cursor).is_err(),"single use");
    let after=s.receipt().unwrap();
    assert_eq!((receipt.session_id,receipt.revision,receipt.index_generation,receipt.decoded_sha256),
        (after.session_id,after.revision,after.index_generation,after.decoded_sha256));
    assert_eq!(before,serde_json::to_vec(&v).unwrap());
    assert!(!after.all_domain_references_verified&&!after.product_read_accepted&&
        !after.writer_authorized&&!after.apply_authorized&&!after.edited_copy_authorized);
}
#[test]
fn pr881_cursor_8_8_1_same_cache_replay_cross_domain_foreign_bounds_cas(){
    let mut v=doc();
    let mut m=serde_json::Map::new();
    for id in 1..=17u64 {m.insert(id.to_string(),json!({"ID":id}));}
    v["World"]["GridCollection"]["DiffGrids"]=Value::Object(m);
    let a=open(&v,steam());let scope=scope(&a);
    let root=a.issue_indexed_cursor(scope,IndexedDomain::World).unwrap();
    assert!(a.issue_indexed_cursor(scope,IndexedDomain::SavedDiffGrids).is_err(),
        "regular root cursor API must not mint typed DiffGrids");
    let first=a.issue_saved_diffgrids_cursor(scope).unwrap();
    assert_ne!(first.cursor,root.cursor);
    assert_eq!(first.indexed_records,17);
    assert!(a.issue_saved_diffgrids_cursor(scope).is_err(),"same existing two active cursor limit");
    assert!(a.read_indexed_page(scope,first.cursor).is_err(),"different API cannot consume typed grant");
    assert!(a.read_saved_diffgrids_page(scope,root.cursor).is_err(),"world cursor cannot become DiffGrids");
    assert!(a.read_saved_diffgrids_page(scope,[0;16]).is_err(),"forged zero token");
    assert!(a.read_saved_diffgrids_page(scope,[0x53;16]).is_err(),"guessable UI token rejected");
    let b=open(&v,steam());assert_ne!(a.receipt().unwrap().session_id,b.receipt().unwrap().session_id);
    assert!(a.read_saved_diffgrids_page(scope(&b),first.cursor).is_err(),"cross-session cursor rejected");
    let p1=a.read_saved_diffgrids_page(scope,first.cursor).unwrap();
    assert_eq!(p1.records.len(),8);assert_eq!(p1.records[0].grid_id,1);
    assert!(a.read_saved_diffgrids_page(scope,first.cursor).is_err(),"replay token1");
    let c2=p1.next_cursor.unwrap();
    let p2=a.read_saved_diffgrids_page(scope,c2).unwrap();
    assert_eq!(p2.records.len(),8);
    assert!(a.read_saved_diffgrids_page(scope,c2).is_err(),"replay token2");
    let p3=a.read_saved_diffgrids_page(scope,p2.next_cursor.unwrap()).unwrap();
    assert_eq!(p3.records.len(),1);assert_eq!(p3.records[0].grid_id,17);
    assert!(p3.next_cursor.is_none());
    let still_root=a.read_indexed_page(scope,root.cursor).unwrap();
    assert_eq!(still_root.domain,IndexedDomain::World);
    assert!(!still_root.product_read_accepted&&!still_root.writer_authorized);
    assert!(a.read_saved_diffgrids_page(scope,first.cursor).is_err());
}
#[test]
fn pr881_exact_external_build_and_full_document_schema_not_steam_switch_alias(){
    let v=doc();let sw=open(&v,switch());let st=open(&v,steam());
    assert_eq!(sw.receipt().unwrap().decoded_sha256,st.receipt().unwrap().decoded_sha256);
    assert!(sw.issue_saved_diffgrids_cursor(scope(&sw)).is_err());
    assert!(st.issue_saved_diffgrids_cursor(scope(&st)).is_ok());
    for bad in [
        BuildIdentity{build_id:"releases_1.25-v1.25.3-OTHER".into(),..steam()},
        BuildIdentity{platform:Platform::Switch,..steam()},
        BuildIdentity{build_kind:BuildKind::SwitchBid,..steam()},
        BuildIdentity{schema:624,..steam()},
        BuildIdentity{externally_attested:false,..steam()},
    ]{
        assert!(ProductSession::open_decoded_readonly(serde_json::to_vec(&v).unwrap(),bad).is_err(),
            "schema matching without exact Build must never be accepted");
    }
}
#[test]
fn pr881_issued_and_paging_scope_must_fail_closed_when_stale_or_forged(){
    let s=open(&doc(),steam());let normal=scope(&s);
    for bad in [
        WorkerEnvelope{session_id:[0xee;16],..normal},
        WorkerEnvelope{expected_revision:normal.expected_revision+1,..normal},
        WorkerEnvelope{expected_index_generation:normal.expected_index_generation+1,..normal},
        WorkerEnvelope{expected_decoded_sha256:[0xab;32],..normal},
        WorkerEnvelope{action:WorkerAction::Stage,..normal},
        WorkerEnvelope{action:WorkerAction::Apply,..normal},
        WorkerEnvelope{contract:"UNTRUSTED_CONTRACT",..normal},
    ]{
        assert!(s.issue_saved_diffgrids_cursor(bad).is_err());
    }
    let grant=s.issue_saved_diffgrids_cursor(normal).unwrap();
    for bad in [
        WorkerEnvelope{session_id:[0xee;16],..normal},
        WorkerEnvelope{expected_revision:normal.expected_revision+1,..normal},
        WorkerEnvelope{expected_index_generation:normal.expected_index_generation+1,..normal},
        WorkerEnvelope{expected_decoded_sha256:[0xab;32],..normal},
        WorkerEnvelope{action:WorkerAction::Stage,..normal},
    ]{
        assert!(s.read_saved_diffgrids_page(bad,grant.cursor).is_err());
    }
    assert_eq!(s.read_saved_diffgrids_page(normal,grant.cursor).unwrap().records.len(),2);
    s.close().unwrap();
    assert!(s.issue_saved_diffgrids_cursor(normal).is_err());
    assert!(s.read_saved_diffgrids_page(normal,grant.cursor).is_err());
}
#[test]
fn pr881_targeted_invalid_grid_object_layout_hash_shapes_and_unknown_type_rejected(){
    let v=doc();let mut bad=Vec::new();
    let mut x=v.clone();x["World"]["GridCollection"]["DiffGrids"]["0"]["ID"]=json!(33);bad.push(x);
    let mut x=v.clone();x["World"]["GridCollection"]["DiffGrids"]["0"]["ModifiedObjects"]["3"]["ID"]=json!(99);bad.push(x);
    let mut x=v.clone();x["World"]["GridCollection"]["DiffGrids"]["0"]["ModifiedObjects"]=json!([]);bad.push(x);
    let mut x=v.clone();x["World"]["GridCollection"]["DiffGrids"]["0"]["RemovedObjects"]=json!(["3"]);bad.push(x);
    let mut x=v.clone();x["World"]["GridCollection"]["DiffGrids"]["0"]["RemovedObjects"]=Value::Null;bad.push(x);
    let mut x=v.clone();x["World"]["GridCollection"]["DiffGrids"]["0"]["DefaultLayoutGridID"]=json!("0");bad.push(x);
    let mut x=v.clone();x["World"]["GridCollection"]["DiffGrids"]["0"]["GridDefaultLayoutType"]=Value::Null;bad.push(x);
    let mut x=v.clone();x["World"]["GridCollection"]["DiffGrids"]["0"]["GridDefaultLayoutPath"]=json!("x".repeat(5000));bad.push(x);
    let mut x=v.clone();x["World"]["GridCollection"]["DiffGrids"]["0"]["DefaultGridHashCode"]=json!(2147483648i64);bad.push(x);
    let mut x=v.clone();x["World"]["GridCollection"]["DiffGrids"]["0"]["DefaultGridDataHashCode"]=json!("not-hash");bad.push(x);
    let mut x=v.clone();x["World"]["GridCollection"]["DiffGrids"]=Value::Null;bad.push(x);
    let mut x=v.clone();let mut m=x["World"]["GridCollection"]["DiffGrids"].as_object().unwrap().clone();
    let zero=m.remove("0").unwrap();m.insert("00".into(),zero);
    x["World"]["GridCollection"]["DiffGrids"]=Value::Object(m);bad.push(x);
    let mut x=v.clone();let mut m=x["World"]["GridCollection"]["DiffGrids"].as_object().unwrap().clone();
    let zero=m.remove("0").unwrap();m.insert("9007199254740992".into(),zero);
    x["World"]["GridCollection"]["DiffGrids"]=Value::Object(m);bad.push(x);
    let mut x=v.clone();x["World"]["GridCollection"]["DiffGrids"]["0"]["ModifiedObjects"]["3"]["ID"]=json!(9007199254740992u64);bad.push(x);
    for (n,doc) in bad.iter().enumerate(){
        let s=open(doc,steam());let e=scope(&s);
        let fail=match s.issue_saved_diffgrids_cursor(e){
            Err(_)=>true,
            Ok(c)=>s.read_saved_diffgrids_page(e,c.cursor).is_err()
        };
        assert!(fail,"invalid targeted stored field not denied {n}");
        assert!(!s.receipt().unwrap().product_read_accepted);
    }
}
#[test]
fn pr881_unknown_layout_and_absent_map_do_not_create_effective_grid_authority(){
    let v=doc();let mut x=v.clone();
    x["World"]["GridCollection"]["DiffGrids"]["0"]["GridDefaultLayoutPath"]=json!("C:/NO_NATIVE_ASSET/fictional.json");
    x["World"]["GridCollection"]["DiffGrids"]["0"]["DefaultLayoutGridID"]=json!(13);
    let s=open(&x,steam());let e=scope(&s);
    let c=s.issue_saved_diffgrids_cursor(e).unwrap();
    let p=s.read_saved_diffgrids_page(e,c.cursor).unwrap();
    assert_eq!(p.records[0].default_layout_grid_id,Some(13));
    assert_eq!(p.records[0].external_layout,ExternalLayoutStatus::UnresolvedExternalLayout);
    assert!(!p.records[0].native_effective_grid_verified);
    assert!(!p.all_native_references_verified&&!p.product_read_accepted&&!p.writer_authorized);
    let mut no_diff=v.clone();no_diff["World"]["GridCollection"].as_object_mut().unwrap().remove("DiffGrids");
    let missing=open(&no_diff,steam());
    assert!(missing.issue_saved_diffgrids_cursor(scope(&missing)).is_err(),
        "missing map is not a verified empty/native layout");
    let mut empty=v;empty["World"]["GridCollection"]["DiffGrids"]=json!({});
    let empty=open(&empty,steam());
    let c=empty.issue_saved_diffgrids_cursor(scope(&empty)).unwrap();
    assert_eq!(c.indexed_records,0);assert!(!c.all_native_references_verified);
    let p=empty.read_saved_diffgrids_page(scope(&empty),c.cursor).unwrap();
    assert_eq!(p.records.len(),0);assert!(!p.product_read_accepted);
}
#[test]
fn pr881_bounds_per_grid_no_partial_metadata_and_concurrent_shared_session(){
    let mut v=doc();
    v["World"]["GridCollection"]["DiffGrids"]["0"]["RemovedObjects"]=json!(
        (0..16_385u64).collect::<Vec<_>>());
    let s=open(&v,steam());let e=scope(&s);
    let grant=s.issue_saved_diffgrids_cursor(e).unwrap();
    assert!(s.read_saved_diffgrids_page(e,grant.cursor).is_err(),
        "per-grid ID limit 16384 must fail page without partial page return");
    assert!(!s.receipt().unwrap().product_read_accepted);
    let s=Arc::new(open(&doc(),steam()));let e=scope(&s);
    let a=s.issue_saved_diffgrids_cursor(e).unwrap().cursor;
    let b=s.issue_saved_diffgrids_cursor(e).unwrap().cursor;
    let threads=[a,b].into_iter().map(|token|{
        let cloned=Arc::clone(&s);
        std::thread::spawn(move ||cloned.read_saved_diffgrids_page(e,token))
    }).collect::<Vec<_>>();
    for t in threads{
        let p=t.join().unwrap().unwrap();
        assert_eq!(p.records.len(),2);
        assert!(!p.product_read_accepted&&!p.all_native_references_verified&&!p.writer_authorized);
    }
    assert_eq!(s.receipt().unwrap().revision,0);
}
