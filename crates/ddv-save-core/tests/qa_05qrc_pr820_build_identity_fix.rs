//! 05 QR-C independent changed-only QA: PR820 new private-native Build binding.
 //! PUBLIC SYNTHETIC ONLY; reuse 01A ProductSession + 01B Spatial index.
#![cfg(feature="private-native-v1")]
use ddv_save_core::{
    BuildIdentity,BuildKind,Platform,ProductSession,SpatialAreaRef,SpatialCandidateIndex,
    SpatialExtent,SpatialGridRef,SpatialObjectKey,SpatialObjectRef,SpatialScope,
};
use std::sync::Arc;

const RAW:&str=r#"{"GameInfo":{"Version":626},"Player":{"SyntheticUnknown":"retain"},"World":{"Villages":[{"Areas":{"5":{"GridIDs":[42]}}}],"GridCollection":{"Grids":{"42":{"ID":42,"Objects":{"7":{"ID":7,"ItemID":31700014}}}}},"UnknownFuture":{"field":"opaque"}}}"#;
const SWITCH_BID:&str="9A239D3DB569756D";
const STEAM_FULL:&str="releases_1.25-v1.25.3-44-g0b41250d9ac0-incremental-22";
fn switch()->BuildIdentity{
    BuildIdentity{platform:Platform::Switch,build_kind:BuildKind::SwitchBid,
        build_id:SWITCH_BID.into(),schema:626,externally_attested:true}
}
fn steam()->BuildIdentity{
    BuildIdentity{platform:Platform::SteamWindows,build_kind:BuildKind::SteamFullVersion,
        build_id:STEAM_FULL.into(),schema:626,externally_attested:true}
}
fn session(b:BuildIdentity)->ProductSession{
    ProductSession::open_decoded_readonly(RAW.as_bytes().to_vec(),b).unwrap()
}
fn scope(s:&ProductSession)->SpatialScope{
    let r=s.receipt().unwrap();
    SpatialScope{session_id:r.session_id,revision:r.revision,
        index_generation:r.index_generation,decoded_sha256:r.decoded_sha256}
}
fn candidate(s:&ProductSession, b:BuildIdentity, forged_grid:u64, forged_obj:u64)->SpatialCandidateIndex{
    let areas=[SpatialAreaRef{village_index:0,area_key:5,root_grid_ids:vec![forged_grid]}];
    let grids=[SpatialGridRef{grid_id:forged_grid,parent_object:None,
        proposed_bounds:Some(SpatialExtent{width:10,height:10})}];
    let objects=[SpatialObjectRef{
        key:SpatialObjectKey{grid_id:forged_grid,object_id:forged_obj},
        item_id:31700014,serialized_x:1,serialized_y:2,orientation:0,
        proposed_footprint:Some(SpatialExtent{width:2,height:2}),child_grid_id:None
    }];
    SpatialCandidateIndex::validate(&b,scope(s),&areas,&grids,&objects).unwrap()
}
fn six_false(r:&ddv_save_core::SpatialNativeCensusReceipt){
    assert!(!r.candidate_native_ids_authenticated,"cardinality cannot authenticate IDs");
    assert!(!r.source_platform_provenance_verified,"equal declared Build is not a cryptographic provenance proof");
    assert!(!r.native_footprint_bounds_verified,"untrusted proposed footprint cannot be Native");
    assert!(!r.full_native_reference_closure_verified,"Native full reference closure not proven");
    assert!(!r.product_read_accepted,"count check not a Product read grant");
    assert!(!r.writer_authorized,"count check not a Writer grant");
}
#[test]
fn qrc820_fix_same_build_same_session_and_cas_allow_only_count_diagnostic(){
    let s=session(switch());let before=s.receipt().unwrap();
    let r=candidate(&s,switch(),42,7).compare_core_native_area_grid_census(&s,scope(&s)).unwrap();
    assert!(r.same_session_census_counts_match);
    six_false(&r);
    let after=s.receipt().unwrap();
    assert_eq!(before.decoded_sha256,after.decoded_sha256);
    assert_eq!((before.revision,before.index_generation),(after.revision,after.index_generation));
    assert!(!after.all_domain_references_verified && !after.product_read_accepted &&
        !after.writer_authorized && !after.edited_copy_authorized && !after.apply_authorized);
}
#[test]
fn qrc820_fix_original_true_red_steam_session_switch_candidate_same_sha_counts_rejected(){
    let sw=session(switch());let st=session(steam());
    assert_eq!(scope(&sw).decoded_sha256,scope(&st).decoded_sha256,"same document, schema, count and SHA");
    assert_eq!(sw.receipt().unwrap().schema,626);
    assert_eq!(st.receipt().unwrap().schema,626);
    let bad=candidate(&st,switch(),42,7);
    let err=bad.compare_core_native_area_grid_census(&st,scope(&st)).unwrap_err();
    assert_eq!(err.0,"SPATIAL_NATIVE_BUILD_IDENTITY_MISMATCH");
    // Test also a fake equal-count object ID; Build mismatch must reject first.
    let other=candidate(&st,switch(),42,9999);
    assert_eq!(other.compare_core_native_area_grid_census(&st,scope(&st))
        .unwrap_err().0,"SPATIAL_NATIVE_BUILD_IDENTITY_MISMATCH");
    assert_eq!((st.receipt().unwrap().revision,st.receipt().unwrap().index_generation),(0,1));
}
#[test]
fn qrc820_fix_forged_equal_count_grid_and_object_never_authenticates_id_or_writer(){
    let s=session(switch());
    for (gid,oid) in [(42,9999),(99,7),(99,9999)] {
        let candidate=candidate(&s,switch(),gid,oid);
        let r=candidate.compare_core_native_area_grid_census(&s,scope(&s)).unwrap();
        assert!(r.same_session_census_counts_match,"count-only matches with fake IDs, never auth");
        six_false(&r);
        assert!(candidate.inspect(scope(&s),SpatialObjectKey{grid_id:42,object_id:7}).is_err());
    }
    assert_eq!(s.receipt().unwrap().revision,0,"no mutation");
}
#[test]
fn qrc820_fix_same_platform_wrong_buildkind_bid_fullversion_schema_and_attestation_denied(){
    let s=session(switch());
    for b in [
        BuildIdentity{build_id:"9A239D3DB569756E".into(),..switch()},
        BuildIdentity{build_id:STEAM_FULL.into(),..switch()},
        BuildIdentity{build_kind:BuildKind::SteamFullVersion,..switch()},
        BuildIdentity{schema:624,..switch()},
        BuildIdentity{externally_attested:false,..switch()},
        BuildIdentity{platform:Platform::SteamWindows,..switch()},
    ]{
        assert!(ProductSession::open_decoded_readonly(RAW.as_bytes().to_vec(),b.clone()).is_err());
        let a=[SpatialAreaRef{village_index:0,area_key:5,root_grid_ids:vec![42]}];
        let g=[SpatialGridRef{grid_id:42,parent_object:None,proposed_bounds:Some(SpatialExtent{width:5,height:5})}];
        let o=[SpatialObjectRef{key:SpatialObjectKey{grid_id:42,object_id:7},item_id:1,
            serialized_x:0,serialized_y:0,orientation:0,
            proposed_footprint:Some(SpatialExtent{width:1,height:1}),child_grid_id:None}];
        assert!(SpatialCandidateIndex::validate(&b,scope(&s),&a,&g,&o).is_err());
    }
    for b in [
        BuildIdentity{build_id:"releases_1.25-v1.25.3-OTHER".into(),..steam()},
        BuildIdentity{build_kind:BuildKind::SwitchBid,..steam()},
        BuildIdentity{externally_attested:false,..steam()},
        BuildIdentity{schema:624,..steam()},
    ]{
        assert!(ProductSession::open_decoded_readonly(RAW.as_bytes().to_vec(),b).is_err());
    }
}
#[test]
fn qrc820_fix_false_cas_session_sha_revision_generation_and_close_cannot_become_match(){
    let s=Arc::new(session(switch()));let c=candidate(&s,switch(),42,7);let correct=scope(&s);
    for fake in [
      SpatialScope{session_id:[3;16],..correct},
      SpatialScope{revision:correct.revision+1,..correct},
      SpatialScope{index_generation:correct.index_generation+1,..correct},
      SpatialScope{decoded_sha256:[4;32],..correct},
    ]{
        assert_eq!(c.compare_core_native_area_grid_census(&s,fake)
            .unwrap_err().0,"SPATIAL_NATIVE_SCOPE_STALE");
    }
    let other=session(switch());
    assert_ne!(scope(&other).session_id,correct.session_id);
    assert!(c.compare_core_native_area_grid_census(&other,correct).is_err(),"foreign ProductSession");
    let handles=(0..4).map(|_|{
        let session=Arc::clone(&s);let sc=correct;
        std::thread::spawn(move || {
            let idx=candidate(&session,switch(),42,7);
            idx.compare_core_native_area_grid_census(&session,sc)
        })
    }).collect::<Vec<_>>();
    for j in handles {six_false(&j.join().unwrap().unwrap());}
    s.close().unwrap();
    assert!(c.compare_core_native_area_grid_census(&s,correct).is_err(),"after close must fail");
}
