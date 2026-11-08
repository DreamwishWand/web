#![cfg(feature="private-native-v1")]
// Independent of any private P1G: synthetically exercises the REAL 01A
// single-ProductSession native lexical scanner + the 01B candidate index.
use ddv_save_core::{
    BuildIdentity, BuildKind, Platform, ProductSession, SpatialAreaRef,
    SpatialCandidateIndex, SpatialExtent, SpatialGridRef, SpatialObjectKey,
    SpatialObjectRef, SpatialScope,
};
const VALID: &str = r#"{"GameInfo":{"Version":626},"Player":{},"World":{"Villages":[{"Areas":{"5":{"GridIDs":[42]}}}],"GridCollection":{"Grids":{"42":{"ID":42,"Objects":{"7":{"ID":7,"ItemID":31700014,"X":1,"Y":2,"Orientation":0}}}}}}}"#;

fn build() -> BuildIdentity {
    BuildIdentity {
        platform: Platform::Switch, build_kind: BuildKind::SwitchBid,
        build_id: "9A239D3DB569756D".into(),
        schema: 626, externally_attested: true,
    }
}
fn session(json: &str) -> ProductSession {
    ProductSession::open_decoded_readonly(json.as_bytes().to_vec(), build()).unwrap()
}
fn scope(s: &ProductSession) -> SpatialScope {
    let r=s.receipt().unwrap();
    SpatialScope {
        session_id:r.session_id,revision:r.revision,
        index_generation:r.index_generation,decoded_sha256:r.decoded_sha256,
    }
}
fn key(grid_id:u64,object_id:u64) -> SpatialObjectKey {
    SpatialObjectKey {grid_id,object_id}
}
fn candidate(s: &ProductSession) -> (
    SpatialCandidateIndex,Vec<SpatialAreaRef>,Vec<SpatialGridRef>,Vec<SpatialObjectRef>
) {
    let areas=vec![SpatialAreaRef {village_index:0,area_key:5,root_grid_ids:vec![42]}];
    let grids=vec![SpatialGridRef {
        grid_id:42,proposed_bounds:Some(SpatialExtent {width:10,height:10}),
        parent_object:None,
    }];
    let objects=vec![SpatialObjectRef {
        key:key(42,7),item_id:31700014,
        serialized_x:1,serialized_y:2,orientation:0,
        proposed_footprint:Some(SpatialExtent {width:2,height:2}),
        child_grid_id:None,
    }];
    let index=SpatialCandidateIndex::validate(&build(),scope(s),&areas,&grids,&objects).unwrap();
    (index,areas,grids,objects)
}
#[test]
fn native_single_session_direct_area_grid_census_matches_without_authenticating_candidate(){
    let s=session(VALID);
    let (index,..)=candidate(&s);
    let r=index.compare_core_native_area_grid_census(&s,scope(&s)).unwrap();
    assert!(r.same_session_census_counts_match);
    assert!(!r.candidate_native_ids_authenticated);
    assert!(!r.source_platform_provenance_verified);
    assert!(!r.native_footprint_bounds_verified);
    assert!(!r.full_native_reference_closure_verified);
    assert!(!r.product_read_accepted && !r.writer_authorized);
    assert!(!s.receipt().unwrap().all_domain_references_verified);
}
#[test]
fn source_census_rejects_added_candidate_object_area_grid_or_village(){
    let s=session(VALID);
    let (_,mut areas,mut grids,mut objects)=candidate(&s);
    objects.push(SpatialObjectRef {key:key(42,8),..objects[0]});
    let index=SpatialCandidateIndex::validate(&build(),scope(&s),&areas,&grids,&objects).unwrap();
    assert_eq!(index.compare_core_native_area_grid_census(&s,scope(&s)).unwrap_err().0,
        "SPATIAL_NATIVE_CENSUS_MISMATCH");
    objects.pop();
    areas.push(SpatialAreaRef{village_index:0,area_key:6,root_grid_ids:vec![]});
    let index=SpatialCandidateIndex::validate(&build(),scope(&s),&areas,&grids,&objects).unwrap();
    assert_eq!(index.compare_core_native_area_grid_census(&s,scope(&s)).unwrap_err().0,
        "SPATIAL_NATIVE_CENSUS_MISMATCH");
    areas.pop();
    areas[0].village_index=1; // valid candidate, but only village[0] exists in actual scanner.
    let index=SpatialCandidateIndex::validate(&build(),scope(&s),&areas,&grids,&objects).unwrap();
    assert_eq!(index.compare_core_native_area_grid_census(&s,scope(&s)).unwrap_err().0,
        "SPATIAL_NATIVE_CENSUS_MISMATCH");
    areas[0].village_index=0;
    grids.push(SpatialGridRef {grid_id:43,
        proposed_bounds:Some(SpatialExtent {width:5,height:5}),
        parent_object:Some(key(42,7))});
    objects[0].child_grid_id=Some(43);
    let index=SpatialCandidateIndex::validate(&build(),scope(&s),&areas,&grids,&objects).unwrap();
    assert_eq!(index.compare_core_native_area_grid_census(&s,scope(&s)).unwrap_err().0,
        "SPATIAL_NATIVE_CENSUS_MISMATCH");
}
#[test]
fn same_count_forged_native_ids_are_never_mistaken_for_true_native_references(){
    let s=session(VALID);
    let (_,areas,grids,mut objects)=candidate(&s);
    objects[0].key=key(42,9999); // Native scanner observed ObjectID=7, equal count.
    let index=SpatialCandidateIndex::validate(&build(),scope(&s),&areas,&grids,&objects).unwrap();
    let r=index.compare_core_native_area_grid_census(&s,scope(&s)).unwrap();
    assert!(r.same_session_census_counts_match);
    // Count concordance alone cannot catch the forgery: NEVER report ID verification.
    assert!(!r.candidate_native_ids_authenticated);
    assert!(!r.product_read_accepted && !r.writer_authorized);
}
#[test]
fn stale_replay_cross_session_close_and_native_orphan_fail_closed(){
    let s=session(VALID);
    let (index,..)=candidate(&s);
    let mut stale=scope(&s);stale.revision+=1;
    assert_eq!(index.compare_core_native_area_grid_census(&s,stale).unwrap_err().0,
        "SPATIAL_NATIVE_SCOPE_STALE");
    let mut stale=scope(&s);stale.index_generation+=1;
    assert_eq!(index.compare_core_native_area_grid_census(&s,stale).unwrap_err().0,
        "SPATIAL_NATIVE_SCOPE_STALE");
    let mut stale=scope(&s);stale.decoded_sha256=[3;32];
    assert_eq!(index.compare_core_native_area_grid_census(&s,stale).unwrap_err().0,
        "SPATIAL_NATIVE_SCOPE_STALE");
    let mut stale=scope(&s);stale.session_id=[4;16];
    assert_eq!(index.compare_core_native_area_grid_census(&s,stale).unwrap_err().0,
        "SPATIAL_NATIVE_SCOPE_STALE");
    let other=session(VALID);
    assert!(index.compare_core_native_area_grid_census(&other,scope(&s)).is_err());
    s.close().unwrap();
    assert!(index.compare_core_native_area_grid_census(&s,scope(&other)).is_err());
    let invalid=session(&VALID.replace("\"GridIDs\":[42]","\"GridIDs\":[99]"));
    let (index,..)=candidate(&invalid);
    assert!(index.compare_core_native_area_grid_census(&invalid,scope(&invalid)).is_err());
}
#[test]
fn candidate_cannot_prove_native_build_or_checked_ids_and_rejects_wrong_build(){
    let s=session(VALID);
    let (_,areas,grids,objects)=candidate(&s);
    let mut other=build();
    other.platform=Platform::SteamWindows;
    other.build_kind=BuildKind::SteamFullVersion;
    other.build_id="releases_1.25-v1.25.3-44-g0b41250d9ac0-incremental-22".into();
    assert!(SpatialCandidateIndex::validate(&other,scope(&s),&areas,&grids,&objects).is_err());
    let index=SpatialCandidateIndex::validate(&build(),scope(&s),&areas,&grids,&objects).unwrap();
    let r=index.compare_core_native_area_grid_census(&s,scope(&s)).unwrap();
    assert!(!r.source_platform_provenance_verified);
}

#[test]
fn qrc822_red_cross_platform_same_schema_same_document_must_reject() {
    // QA #822 TRUE_RED: the exact same JSON and count must NOT fuse builds.
    let steam_build=BuildIdentity{
        platform:Platform::SteamWindows,build_kind:BuildKind::SteamFullVersion,
        build_id:"releases_1.25-v1.25.3-44-g0b41250d9ac0-incremental-22".into(),
        schema:626,externally_attested:true
    };
    let steam=ProductSession::open_decoded_readonly(
        VALID.as_bytes().to_vec(),steam_build
    ).unwrap();
    let (index,..)=candidate(&steam); // candidate declares Switch v1.25.3.
    assert_eq!(
        index.compare_core_native_area_grid_census(&steam,scope(&steam))
            .unwrap_err().0,
        "SPATIAL_NATIVE_BUILD_IDENTITY_MISMATCH"
    );
    // A same Build + same Session + revision/gen/hash still yields only a
    // cardinality diagnostic, never source ID or product authorization.
    let switch=session(VALID);
    let (index,..)=candidate(&switch);
    let receipt=index.compare_core_native_area_grid_census(
        &switch,scope(&switch)
    ).unwrap();
    assert!(receipt.same_session_census_counts_match);
    assert!(!receipt.candidate_native_ids_authenticated);
    assert!(!receipt.source_platform_provenance_verified);
    assert!(!receipt.native_footprint_bounds_verified);
    assert!(!receipt.full_native_reference_closure_verified);
    assert!(!receipt.product_read_accepted);
    assert!(!receipt.writer_authorized);
}
#[test]
fn qrc822_same_schema_wrong_bid_fullversion_at_open_denied_not_assumed_equal() {
    let mut wrong=build();
    wrong.build_id="52BD625D9B4E0053".into();
    assert!(ProductSession::open_decoded_readonly(
        VALID.as_bytes().to_vec(),wrong
    ).is_err());
    let wrong=BuildIdentity{
        platform:Platform::SteamWindows,build_kind:BuildKind::SteamFullVersion,
        build_id:"releases_1.25-v1.25.3-OTHER".into(),
        schema:626,externally_attested:true
    };
    assert!(ProductSession::open_decoded_readonly(
        VALID.as_bytes().to_vec(),wrong
    ).is_err());
}
