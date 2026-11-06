// 05 QR-C / R02-R03: independent new-only SOURCE_ONLY+SYNTHETIC.
 // Frozen 01A PR689 source b5ad89dc64baaec849fb0284546898b058ed0513.
 // No private Steam Save, keys, P1G, JWT, or actual product Writer.
use ddv_save_core::{
    BuildIdentity, BuildKind, Platform, ProductSession, WorkerAction, WorkerEnvelope,
    PRODUCT_WORKER_CONTRACT,
};
use sha2::{Digest, Sha256};
use std::sync::{Arc, Barrier};
use std::thread;

const STEAM_FULL: &str = "releases_1.25-v1.25.3-44-g0b41250d9ac0-incremental-22";
const SWITCH_BID: &str = "9A239D3DB569756D";
fn steam() -> BuildIdentity {
    BuildIdentity { platform: Platform::SteamWindows, build_kind: BuildKind::SteamFullVersion,
        build_id: STEAM_FULL.into(), schema: 626, externally_attested: true }
}
fn switch() -> BuildIdentity {
    BuildIdentity { platform: Platform::Switch, build_kind: BuildKind::SwitchBid,
        build_id: SWITCH_BID.into(), schema: 626, externally_attested: true }
}
fn synthetic() -> Vec<u8> {
    br#"{"GameInfo":{"Version":626},"Player":{"nested":{"keep":0,"false":false,"null":null}},"World":{"GridCollection":{"Grids":[]}},"UnknownOpaque":[{"a":1}]}"#.to_vec()
}
fn open() -> ProductSession { ProductSession::open_decoded_readonly(synthetic(), steam()).unwrap() }
fn token(s: &ProductSession, action: WorkerAction) -> WorkerEnvelope {
    let r=s.receipt().unwrap();
    WorkerEnvelope {
        contract: PRODUCT_WORKER_CONTRACT, session_id:r.session_id,
        expected_revision:r.revision, expected_index_generation:r.index_generation,
        expected_decoded_sha256:r.decoded_sha256,action
    }
}
fn denied(raw: Vec<u8>) {
    assert!(ProductSession::open_decoded_readonly(raw,steam()).is_err());
}

#[test]
fn q01_product_session_mints_own_nonzero_id_and_reuses_same_id_for_all_receipts() {
    let first=open(); let second=open();
    let a=first.receipt().unwrap(); let b=first.receipt().unwrap(); let c=second.receipt().unwrap();
    assert_eq!(a.session_id,b.session_id);
    assert_ne!(a.session_id,[0u8;16]);
    assert_ne!(a.session_id,c.session_id,"separate SaveSession should not reuse token");
    assert_eq!(a.revision,0); assert_eq!(a.index_generation,1);
    assert!(!a.product_worker_bound && !a.product_read_accepted);
    assert!(!a.all_domain_references_verified && !a.writer_authorized);
}

#[test]
fn q02_duplicate_root_and_escaped_equivalent_nested_keys_rejected() {
    for raw in [
        br#"{"GameInfo":{"Version":626},"Player":{},"World":{},"Player":{}}"#.as_slice(),
        br#"{"GameInfo":{"Version":626,"Version":626},"Player":{},"World":{}}"#.as_slice(),
        br#"{"GameInfo":{"Version":626},"Player":{"x":1,"\u0078":2},"World":{}}"#.as_slice(),
        br#"{"GameInfo":{"Version":626},"Player":{},"World":{"n":[{"a":1,"a":2}]}}"#.as_slice(),
        br#"{"GameInfo":{"Version":626},"Player":{},"World":{},"Unknown":{"x":1,"x":2}}"#.as_slice(),
    ] { denied(raw.to_vec()); }
}

#[test]
fn q03_invalid_document_type_schema_missing_roots_or_trailing_json_rejected() {
    for raw in [
        br#"[]"#.as_slice(),
        br#"{"GameInfo":{"Version":626},"Player":{},"World":[]}"#.as_slice(),
        br#"{"GameInfo":{"Version":626},"Player":[],"World":{}}"#.as_slice(),
        br#"{"GameInfo":{"Version":"626"},"Player":{},"World":{}}"#.as_slice(),
        br#"{"GameInfo":{"Version":626.0},"Player":{},"World":{}}"#.as_slice(),
        br#"{"GameInfo":{"Version":626},"Player":{},"World":{}} true"#.as_slice(),
        br#"{"GameInfo":{},"Player":{},"World":{}}"#.as_slice(),
        br#"{"GameInfo":{"Version":626},"Player":{}}"#.as_slice(),
    ] { denied(raw.to_vec()); }
}

#[test]
fn q04_bounded_depth_and_invalid_utf8_rejected() {
    let raw=format!(r#"{{"GameInfo":{{"Version":626}},"Player":{{}},"World":{{"x":{}}}}}"#,format!("{}0{}","[".repeat(140),"]".repeat(140)));
    denied(raw.into_bytes());
    let mut broken=synthetic(); let i=broken.iter().position(|&b|b==b'k').unwrap(); broken[i]=0xff;
    denied(broken);
    denied(vec![]);
}

#[test]
fn q05_forged_external_build_candidates_never_establish_product_read() {
    let sample=synthetic();
    let mut bad=steam(); bad.externally_attested=false;
    assert!(ProductSession::open_decoded_readonly(sample.clone(),bad).is_err());
    let mut bad=steam();bad.schema=624;
    assert!(ProductSession::open_decoded_readonly(sample.clone(),bad).is_err());
    let mut bad=steam();bad.build_id="self-asserted".into();
    assert!(ProductSession::open_decoded_readonly(sample.clone(),bad).is_err());
    let mut bad=steam();bad.platform=Platform::Switch;
    assert!(ProductSession::open_decoded_readonly(sample.clone(),bad).is_err());
    let mut bad=switch();bad.build_kind=BuildKind::SteamFullVersion;
    assert!(ProductSession::open_decoded_readonly(sample.clone(),bad).is_err());
    let approved=ProductSession::open_decoded_readonly(sample,steam()).unwrap().receipt().unwrap();
    assert!(approved.full_document_json_validated);
    assert!(!approved.all_domain_references_verified);
    assert!(!approved.product_read_accepted);
}

#[test]
fn q06_decoded_sha_binds_exact_bytes_and_untrusted_envelope_cannot_switch_session() {
    let raw=synthetic();
    let a=ProductSession::open_decoded_readonly(raw.clone(),steam()).unwrap();
    let b=ProductSession::open_decoded_readonly(raw.clone(),steam()).unwrap();
    let ra=a.receipt().unwrap();
    let sha: [u8;32]=Sha256::digest(&raw).into();
    assert_eq!(ra.decoded_sha256,sha);
    let t=token(&a,WorkerAction::ReadCoreSchemaWitness);
    assert!(a.dispatch(t).is_ok());
    assert!(b.dispatch(t).is_err(),"same bytes cannot substitute a separately minted SessionID");
    let mut forged=t; forged.expected_decoded_sha256[0]^=0x01;
    assert!(a.dispatch(forged).is_err());
    forged=t; forged.session_id[0]^=0x01;
    assert!(a.dispatch(forged).is_err());
    forged=t; forged.contract="lookalike-worker-contract";
    assert!(a.dispatch(forged).is_err());
}

#[test]
fn q07_old_revision_or_index_generation_mismatch_never_changes_state() {
    let s=open();let t=token(&s,WorkerAction::ReadCoreSchemaWitness);
    let mut bad=t;bad.expected_revision=u64::MAX;
    assert!(s.dispatch(bad).is_err());
    bad=t;bad.expected_index_generation=0;
    assert!(s.dispatch(bad).is_err());
    bad=t;bad.expected_index_generation=u64::MAX;
    assert!(s.dispatch(bad).is_err());
    let r=s.receipt().unwrap();
    assert_eq!(r.revision,0);
    assert_eq!(r.index_generation,1);
    let w=s.dispatch(t).unwrap();
    assert_eq!(w.core_owned_readset,"/GameInfo/Version");
    assert!(!w.complete_all_domains);
}

#[test]
fn q08_all_non_witness_or_writer_actions_deny_and_original_witness_unchanged() {
    let s=open();let receipt=s.receipt().unwrap();
    let raw=synthetic();
    assert_eq!(s.decoded_len_for_internal_benchmark(),raw.len());
    for a in [WorkerAction::ReadDomain,WorkerAction::Stage,
              WorkerAction::ExportEditedCopy,WorkerAction::Apply,WorkerAction::OriginalOverwrite] {
        assert!(s.dispatch(token(&s,a)).is_err());
    }
    let after=s.receipt().unwrap();
    assert_eq!(receipt.decoded_sha256,after.decoded_sha256);
    assert_eq!(after.revision,0);
    assert_eq!(after.index_generation,1);
    assert!(!after.product_worker_bound && !after.product_read_accepted);
    assert!(!after.writer_authorized && !after.apply_authorized && !after.edited_copy_authorized);
}

#[test]
fn q09_close_dispatch_race_terminally_revokes_all_work() {
    let session=Arc::new(open());
    let copied=token(&session,WorkerAction::ReadCoreSchemaWitness);
    let gate=Arc::new(Barrier::new(3));
    let s=Arc::clone(&session);let g=Arc::clone(&gate);
    let reads=thread::spawn(move || {g.wait();for _ in 0..1000 { let _=s.dispatch(copied); }});
    let s=Arc::clone(&session);let g=Arc::clone(&gate);
    let closes=thread::spawn(move || {g.wait();s.close()});
    gate.wait();
    reads.join().unwrap();
    closes.join().unwrap().unwrap();
    assert_eq!(session.dispatch(copied).unwrap_err().0,"SESSION_CLOSED");
    assert_eq!(session.receipt().unwrap_err().0,"SESSION_CLOSED");
    assert!(session.close().is_err());
}
