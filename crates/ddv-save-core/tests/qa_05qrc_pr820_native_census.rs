//! 05 QR-C independent changed-only QA for Source PR820 candidate/native census.
//! Public synthetic only. Uses the ONE accepted ProductSession and its 01A scanner.
#![cfg(feature="private-native-v1")]
use ddv_save_core::{
    BuildIdentity,BuildKind,Platform,ProductSession,SpatialAreaRef,SpatialCandidateIndex,
    SpatialExtent,SpatialGridRef,SpatialObjectKey,SpatialObjectRef,SpatialScope,
};
use std::sync::Arc;
const RAW:&str=r#"{"GameInfo":{"Version":626},"Player":{"opaque":"leave-untouched"},"World":{"Villages":[{"Areas":{"5":{"GridIDs":[42]}}}],"GridCollection":{"Grids":{"42":{"ID":42,"Objects":{"7":{"ID":7,"ItemID":31700014}}}}},"UnknownFuture":{"sentinel":"no second JSON reader"}}}"#;
fn switch_build()->BuildIdentity{
    BuildIdentity{platform:Platform::Switch,build_kind:BuildKind::SwitchBid,
        build_id:"9A239D3DB569756D".into(),schema:626,externally_attested:true}
}
fn steam_build()->BuildIdentity{
    BuildIdentity{platform:Platform::SteamWindows,build_kind:BuildKind::SteamFullVersion,
        build_id:"releases_1.25-v1.25.3-44-g0b41250d9ac0-incremental-22".into(),
        schema:626,externally_attested:true}
}
fn session(raw:&str,build:BuildIdentity)->ProductSession{
    ProductSession::open_decoded_readonly(raw.as_bytes().to_vec(),build).unwrap()
}
fn scope(s:&ProductSession)->SpatialScope{
    let r=s.receipt().unwrap();
    SpatialScope{session_id:r.session_id,revision:r.revision,
        index_generation:r.index_generation,decoded_sha256:r.decoded_sha256}
}
fn k(g:u64,o:u64)->SpatialObjectKey{SpatialObjectKey{grid_id:g,object_id:o}}
fn area(grid:u64)->SpatialAreaRef{SpatialAreaRef{village_index:0,area_key:5,root_grid_ids:vec![grid]}}
fn grid(id:u64,parent:Option<SpatialObjectKey>)->SpatialGridRef{
    SpatialGridRef{grid_id:id,parent_object:parent,
        proposed_bounds:Some(SpatialExtent{width:10,height:10})}
}
fn object(grid_id:u64,object_id:u64)->SpatialObjectRef{
    SpatialObjectRef{key:k(grid_id,object_id),item_id:31700014,
        serialized_x:1,serialized_y:2,orientation:0,
        proposed_footprint:Some(SpatialExtent{width:2,height:2}),child_grid_id:None}
}
fn candidate(
    s:&ProductSession,areas:&[SpatialAreaRef],grids:&[SpatialGridRef],
    objects:&[SpatialObjectRef]
)->SpatialCandidateIndex{
    SpatialCandidateIndex::validate(&switch_build(),scope(s),areas,grids,objects).unwrap()
}
fn base(s:&ProductSession)->SpatialCandidateIndex{
    candidate(s,&[area(42)],&[grid(42,None)],&[object(42,7)])
}
fn all_six_flags_false(r:&ddv_save_core::SpatialNativeCensusReceipt){
    assert!(!r.candidate_native_ids_authenticated,"count match cannot prove native IDs");
    assert!(!r.source_platform_provenance_verified,"count match cannot prove exact Build");
    assert!(!r.native_footprint_bounds_verified,"candidate footprint is not a Native measurement");
    assert!(!r.full_native_reference_closure_verified,"many Native domains remain unknown");
    assert!(!r.product_read_accepted,"no product read authority");
    assert!(!r.writer_authorized,"no Writer authority");
}
#[test]
fn qrc820_single_product_session_native_census_counts_match_but_all_authority_false(){
    let s=session(RAW,switch_build());
    let start=s.receipt().unwrap();
    let r=base(&s).compare_core_native_area_grid_census(&s,scope(&s)).unwrap();
    assert!(r.same_session_census_counts_match);
    all_six_flags_false(&r);
    let now=s.receipt().unwrap();
    assert_eq!(now.decoded_sha256,start.decoded_sha256,"raw JSON untouched");
    assert_eq!((now.revision,now.index_generation),(0,1),"count-only read not a transaction");
    assert!(!now.all_domain_references_verified && !now.product_read_accepted &&
        !now.writer_authorized && !now.edited_copy_authorized && !now.apply_authorized);
}
#[test]
fn qrc820_critical_forged_objectid_equal_count_true_but_six_authority_fields_false(){
    let s=session(RAW,switch_build());
    let i=candidate(&s,&[area(42)],&[grid(42,None)],&[object(42,9999)]);
    // Real source contains ObjectID7; candidate has only 9999. Both contain ONE object.
    assert!(i.inspect(scope(&s),k(42,7)).is_err());
    assert_eq!(i.inspect(scope(&s),k(42,9999)).unwrap().object.key,k(42,9999));
    let r=i.compare_core_native_area_grid_census(&s,scope(&s)).unwrap();
    assert!(r.same_session_census_counts_match,"cardinality diagnostic is allowed to be true");
    all_six_flags_false(&r);
    // Same-count GridID replacement must similarly grant no authority.
    let j=candidate(&s,&[area(99)],&[grid(99,None)],&[object(99,7)]);
    let rr=j.compare_core_native_area_grid_census(&s,scope(&s)).unwrap();
    assert!(rr.same_session_census_counts_match);
    all_six_flags_false(&rr);
}
#[test]
fn qrc820_extra_candidate_area_grid_object_or_area_link_is_rejected_by_native_count(){
    let s=session(RAW,switch_build());
    let more_areas=[area(42),SpatialAreaRef{village_index:0,area_key:6,root_grid_ids:vec![]}];
    let i=candidate(&s,&more_areas,&[grid(42,None)],&[object(42,7)]);
    assert_eq!(i.compare_core_native_area_grid_census(&s,scope(&s)).unwrap_err().0,
        "SPATIAL_NATIVE_CENSUS_MISMATCH");
    let i=candidate(&s,&[area(42),SpatialAreaRef{village_index:0,area_key:6,root_grid_ids:vec![43]}],
        &[grid(42,None),grid(43,None)],&[object(42,7)]);
    assert_eq!(i.compare_core_native_area_grid_census(&s,scope(&s)).unwrap_err().0,
        "SPATIAL_NATIVE_CENSUS_MISMATCH");
    let i=candidate(&s,&[area(42)],&[grid(42,None)],&[object(42,7),object(42,8)]);
    assert_eq!(i.compare_core_native_area_grid_census(&s,scope(&s)).unwrap_err().0,
        "SPATIAL_NATIVE_CENSUS_MISMATCH");
}
#[test]
fn qrc820_wrong_village_index_and_malformed_native_source_are_denied_without_rewrite(){
    let s=session(RAW,switch_build());
    let i=candidate(&s,
      &[SpatialAreaRef{village_index:1,area_key:5,root_grid_ids:vec![42]}],
      &[grid(42,None)],&[object(42,7)]);
    assert_eq!(i.compare_core_native_area_grid_census(&s,scope(&s)).unwrap_err().0,
        "SPATIAL_NATIVE_CENSUS_MISMATCH");
    let orphan=RAW.replace(r#""GridIDs":[42]"#,r#""GridIDs":[999]"#);
    assert_ne!(orphan,RAW);
    let malformed=session(&orphan,switch_build());
    let i=base(&malformed);
    assert!(i.compare_core_native_area_grid_census(&malformed,scope(&malformed)).is_err());
    assert_eq!(malformed.receipt().unwrap().revision,0);
}
#[test]
fn qrc820_forged_scope_revision_sha_indexgen_foreign_session_and_close_denied(){
    let s=Arc::new(session(RAW,switch_build()));let i=base(&s);
    let mut fake=scope(&s);fake.session_id[0]^=0x33;
    assert_eq!(i.compare_core_native_area_grid_census(&s,fake).unwrap_err().0,"SPATIAL_NATIVE_SCOPE_STALE");
    let mut fake=scope(&s);fake.revision+=1;
    assert_eq!(i.compare_core_native_area_grid_census(&s,fake).unwrap_err().0,"SPATIAL_NATIVE_SCOPE_STALE");
    let mut fake=scope(&s);fake.index_generation+=1;
    assert_eq!(i.compare_core_native_area_grid_census(&s,fake).unwrap_err().0,"SPATIAL_NATIVE_SCOPE_STALE");
    let mut fake=scope(&s);fake.decoded_sha256[0]^=0x55;
    assert_eq!(i.compare_core_native_area_grid_census(&s,fake).unwrap_err().0,"SPATIAL_NATIVE_SCOPE_STALE");
    let foreign=session(RAW,switch_build());
    assert!(i.compare_core_native_area_grid_census(&foreign,scope(&s)).is_err(),
        "real Core SessionID must not be replayed on a different ProductSession");
    let concurrent=(0..4).map(|_|{
        let own=Arc::clone(&s);let t=scope(&s);
        // A new candidate is derived from the SAME ProductSession.
        std::thread::spawn(move || {
            let local=base(&own);
            local.compare_core_native_area_grid_census(&own,t)
        })
    }).collect::<Vec<_>>();
    for j in concurrent{all_six_flags_false(&j.join().unwrap().unwrap());}
    s.close().unwrap();
    assert!(i.compare_core_native_area_grid_census(&s,scope(&foreign)).is_err());
}
#[test]
fn qrc820_forged_external_build_and_cross_platform_source_census_do_not_become_provenance(){
    let switch=session(RAW,switch_build());
    let mut altered=switch_build();altered.schema=624;
    assert!(SpatialCandidateIndex::validate(&altered,scope(&switch),&[area(42)],
       &[grid(42,None)],&[object(42,7)]).is_err());
    let mut altered=switch_build();altered.build_id="releases_1.25-v1.25.3-44-g0b41250d9ac0-incremental-22".into();
    assert!(SpatialCandidateIndex::validate(&altered,scope(&switch),&[area(42)],
       &[grid(42,None)],&[object(42,7)]).is_err());
    // A real source Session can be externally Steam but the typed candidate claims Switch.
    // This NEW API should REJECT crossing actual Session Build, not only set a false flag.
    let steam=session(RAW,steam_build());
    let candidate_switch=candidate(&steam,&[area(42)],&[grid(42,None)],&[object(42,7)]);
    assert!(candidate_switch.compare_core_native_area_grid_census(&steam,scope(&steam)).is_err(),
       "cross-platform Steam-Source versus Switch Candidate must fail closed even if counts match");
}
