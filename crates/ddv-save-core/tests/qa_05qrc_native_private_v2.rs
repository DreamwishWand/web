//! 05 QR-C independent NEW_ONLY native Rust CAS/one-time-private-noop QA.
//! PUBLIC SYNTHETIC JSON only; no encrypted owner save or original SHA in CI.
//! This exercises the SAME ProductSession APIs, not an alternate Reader.
#![cfg(feature = "private-native-v2")]
use ddv_save_core::{
  BuildIdentity,BuildKind,Platform,ProductSession,SessionReceipt,WorkerAction,
  WorkerEnvelope,PRODUCT_WORKER_CONTRACT
};
use sha2::{Digest,Sha256};

fn input()->Vec<u8>{
  br#"{"GameInfo":{"Version": 626},"Player":{"Synthetic":1,"Emoji":"🌱"},"World":{"Synthetic":true},"Unknown":{"future":[42,null,{"nested":"preserved"}]}}"#.to_vec()
}
fn open(bytes:Vec<u8>)->ProductSession{
  ProductSession::open_decoded_readonly(bytes,BuildIdentity{
    platform:Platform::SteamWindows,
    build_kind:BuildKind::SteamFullVersion,
    build_id:"releases_1.25-v1.25.3-44-g0b41250d9ac0-incremental-22".into(),
    schema:626,
    externally_attested:true
  }).expect("valid new synthetic isolated ProductSession")
}
fn scope(r:SessionReceipt,rev:u64,gen:u64,action:WorkerAction)->WorkerEnvelope{
  WorkerEnvelope{
    contract:PRODUCT_WORKER_CONTRACT,
    session_id:r.session_id,
    expected_revision:rev,
    expected_index_generation:gen,
    expected_decoded_sha256:r.decoded_sha256,
    action
  }
}
#[test]
fn qrc_n1_exact_one_byte_undo_redo_export_one_time_and_closed(){
  let original=input();
  let source_hash=Sha256::digest(&original).to_vec();
  let s=open(original.clone());let r=s.receipt().unwrap();
  assert_eq!(r.revision,0);
  assert_eq!(r.index_generation,1);
  assert!(!r.writer_authorized && !r.product_read_accepted && !r.apply_authorized);
  let stage=scope(r,0,1,WorkerAction::Stage);
  // Product dispatch must NEVER accept native-only private proof as Writer.
  assert!(s.dispatch(stage).is_err());
  assert!(s.private_take_semantic_noop_bytes(scope(r,0,1,WorkerAction::ExportEditedCopy)).is_err());
  assert!(s.private_stage_semantic_noop(scope(r,0,1,WorkerAction::ReadDomain)).is_err());
  let staged=s.private_stage_semantic_noop(stage).unwrap();
  assert!(staged.applied && staged.old_value_cas_verified && staged.semantic_tokens_unchanged);
  assert!(!staged.product_writer_authorized);
  assert_eq!((staged.revision,staged.index_generation,staged.exact_diff_bytes),(1,2,1));
  assert!(s.private_stage_semantic_noop(stage).is_err(),"duplicate stage and stale CAS");
  assert!(s.private_undo_semantic_noop(stage).is_err(),"stale undo cannot race");
  let undo=s.private_undo_semantic_noop(scope(r,1,2,WorkerAction::Stage)).unwrap();
  assert!(!undo.applied);assert_eq!((undo.revision,undo.index_generation),(2,3));
  assert!(s.private_undo_semantic_noop(scope(r,2,3,WorkerAction::Stage)).is_err());
  assert!(s.private_take_semantic_noop_bytes(scope(r,2,3,WorkerAction::ExportEditedCopy)).is_err(),
          "cannot export undone candidate");
  let redo=s.private_redo_semantic_noop(scope(r,2,3,WorkerAction::Stage)).unwrap();
  assert!(redo.applied);assert_eq!((redo.revision,redo.index_generation),(3,4));
  assert!(s.private_redo_semantic_noop(scope(r,3,4,WorkerAction::Stage)).is_err());
  assert!(s.private_take_semantic_noop_bytes(scope(r,2,3,WorkerAction::ExportEditedCopy)).is_err(),
          "stale export CAS denied");
  assert!(s.private_take_semantic_noop_bytes(scope(r,3,4,WorkerAction::Apply)).is_err(),
          "wrong action cannot obtain bytes");
  let edited=s.private_take_semantic_noop_bytes(
    scope(r,3,4,WorkerAction::ExportEditedCopy)).unwrap();
  assert_eq!(edited.len(),original.len()+1);
  assert_eq!(edited,
    String::from_utf8(original.clone()).unwrap().replacen(
      "\"Version\": 626","\"Version\": 626 ",1).into_bytes());
  assert_eq!(serde_json::from_slice::<serde_json::Value>(&edited).unwrap(),
             serde_json::from_slice::<serde_json::Value>(&original).unwrap());
  assert_ne!(Sha256::digest(&edited).to_vec(),source_hash);
  assert_eq!(Sha256::digest(&original).to_vec(),source_hash,"input stays immutable");
  assert!(s.private_take_semantic_noop_bytes(scope(r,3,4,WorkerAction::ExportEditedCopy)).is_err());
  assert!(s.receipt().is_err(),"one-time private export revokes Session");
  assert!(s.private_undo_semantic_noop(scope(r,3,4,WorkerAction::Stage)).is_err());
  assert!(s.dispatch(scope(r,3,4,WorkerAction::ReadCoreSchemaWitness)).is_err());
}
#[test]
fn qrc_n2_forged_session_source_revision_generation_and_close_all_deny(){
  let s=open(input());let receipt=s.receipt().unwrap();
  let mut bad=scope(receipt,0,1,WorkerAction::Stage);
  bad.session_id[0]^=1;
  assert!(s.private_stage_semantic_noop(bad).is_err(),"foreign SessionID");
  let mut bad=scope(receipt,0,1,WorkerAction::Stage);
  bad.expected_decoded_sha256[5]^=1;
  assert!(s.private_stage_semantic_noop(bad).is_err(),"forged decoded SHA");
  assert!(s.private_stage_semantic_noop(scope(receipt,1,1,WorkerAction::Stage)).is_err());
  assert!(s.private_stage_semantic_noop(scope(receipt,0,2,WorkerAction::Stage)).is_err());
  assert_eq!(s.receipt().unwrap().revision,0,"failed CAS has no partial stage");
  s.close().unwrap();
  assert!(s.private_stage_semantic_noop(scope(receipt,0,1,WorkerAction::Stage)).is_err());
  assert!(s.private_take_semantic_noop_bytes(
    scope(receipt,0,1,WorkerAction::ExportEditedCopy)).is_err());
  let other=open(input());let other_r=other.receipt().unwrap();
  assert_ne!(receipt.session_id,other_r.session_id,"new session must not replay previous authority");
  assert!(other.private_stage_semantic_noop(scope(receipt,0,1,WorkerAction::Stage)).is_err(),
          "old session cannot use a new Core");
}
#[test]
fn qrc_n3_unique_actual_schema_literal_required_and_unknown_strings_do_not_mutate(){
  let inputs=[
    br#"{"GameInfo":{"Version":626},"Player":{},"World":{}}"#.to_vec(),
    br#"{"GameInfo":{"Version": 626},"Player":{},"World":{},"Unknown":{"Version": 626}}"#.to_vec(),
    br#"{"GameInfo":{"Version":626},"Player":{},"World":{},"Text":"\"Version\": 626"}"#.to_vec()
  ];
  for bytes in inputs {
    let s=open(bytes);let r=s.receipt().unwrap();
    assert!(s.private_stage_semantic_noop(scope(r,0,1,WorkerAction::Stage)).is_err(),
      "missing, ambiguous, or string-embedded old literal must fail closed");
    assert_eq!(s.receipt().unwrap().revision,0);
  }
}
#[test]
fn qrc_n4_bad_schema_external_build_and_malformed_document_rejected(){
  let build=BuildIdentity{
    platform:Platform::SteamWindows,build_kind:BuildKind::SteamFullVersion,
    build_id:"releases_1.25-v1.25.3-44-g0b41250d9ac0-incremental-22".into(),
    schema:626,externally_attested:false
  };
  assert!(ProductSession::open_decoded_readonly(input(),build).is_err());
  for bad in [
    br#"{"GameInfo":{"Version":624},"Player":{},"World":{}}"#.to_vec(),
    br#"{"GameInfo":{"Version":626},"Player":{"x":1,"x":2},"World":{}}"#.to_vec(),
    br#"{"GameInfo":{"Version":626},"Player":{},"World":{}"#.to_vec()
  ]{
    assert!(ProductSession::open_decoded_readonly(bad,BuildIdentity{
      platform:Platform::SteamWindows,build_kind:BuildKind::SteamFullVersion,
      build_id:"releases_1.25-v1.25.3-44-g0b41250d9ac0-incremental-22".into(),
      schema:626,externally_attested:true
    }).is_err());
  }
}
