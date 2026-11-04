//! 05 QR-C independent PR530 NEW-ONLY native Close/Stage serialization tests.
//! CI injects this QA-only crate-private module into lib.rs temporarily.
//! Original encrypted owner P1G, device Native behavior and product Writer NOT_RUN.
use crate::{sha256,p1g::encode_synthetic_fixture};
use crate::trusted_read::TrustedReadCore;
use crate::session::{SaveSession,ReferenceIndex,LogicalIdentity,Domain,TransactionPlan};
use std::{sync::mpsc,thread,time::Duration};

const JSON:&str=r#"{"GameInfo":{"Version":626},"World":{"RecurringEvents":{"155":{"ItemSpawning":{"RecurringEventItemID":2010000021,"NextOccurrence":"2126-08-20T00:00:00Z","LastOccurrence":"2026-11-05T00:00:00Z","EndDate":null}}},"GridCollection":{"Grids":{},"DiffGrids":{}},"Villages":[]}}"#;
const KEY:[u8;32]=[0x62;32];
const REG:&[u8]=b"05qr-c-independent-PR530-mutex-source";
fn owner()->TrustedReadCore{
  let p=encode_synthetic_fixture(JSON.as_bytes(),&KEY,8).unwrap();
  TrustedReadCore::open_p1g_readonly(p.clone(),&KEY,
    sha256(&p),sha256(JSON.as_bytes()),REG,sha256(REG),
    "9A239D3DB569756D",626,1024*1024).unwrap()
}
fn bound(core:&TrustedReadCore,id:u64)->SaveSession{
  let decoded=core.borrow_decoded_snapshot_research().unwrap();
  let mut session=SaveSession::open_decoded_shared_research(
    id,decoded,626,ReferenceIndex::default()).unwrap();
  session.bind_trusted_core_research(core).unwrap();
  session
}
fn event_identity()->LogicalIdentity{
  LogicalIdentity{domain:Domain::RecurringEvent,key:"155".to_owned()}
}
fn paths()->Vec<(LogicalIdentity,String)>{
  vec![(event_identity(),"/GameInfo/Version".to_owned()),
    (event_identity(),"/World/RecurringEvents/155/ItemSpawning/EndDate".to_owned())]
}
fn empty_plan(id:u64)->TransactionPlan{
  TransactionPlan{session_id:id,expected_revision:0,
    expected_source_sha256:sha256(JSON.as_bytes()),commands:vec![],
    postconditions:vec![],post_references:ReferenceIndex::default()}
}
const WAIT:Duration=Duration::from_millis(60);
const DEADLINE:Duration=Duration::from_secs(6);

#[test]
fn new_owner_gate_serializes_two_separate_bound_read_and_source_witness_requests(){
  let core=owner();
  let decoded=core.borrow_decoded_snapshot_research().unwrap();
  let gate=core.borrow_source_liveness_research(&decoded).unwrap();
  let held=gate.hold().unwrap();
  let mut page=bound(&core,6301);
  let source=bound(&core,6302);
  let source_sha=source.source_sha256();
  let (started_tx,started_rx)=mpsc::channel();
  let (done_tx,done_rx)=mpsc::channel();
  let a_started=started_tx.clone();
  let a_done=done_tx.clone();
  let a=thread::spawn(move||{
    a_started.send("page").unwrap();
    let result=page.query_paged(&["/GameInfo/Version".to_owned()],0,1);
    a_done.send(("page",result.map(|v|v.len()==1))).unwrap();
  });
  let b=thread::spawn(move||{
    started_tx.send("witness").unwrap();
    let result=source.inspect_source_reference_paths(&paths());
    done_tx.send(("witness",result.map(|r|
      r.witnessed.len()==2 &&
      r.original_decoded_sha256==source_sha &&
      !r.usable_for_product_writer
    ))).unwrap();
  });
  assert!(started_rx.recv_timeout(DEADLINE).is_ok());
  assert!(started_rx.recv_timeout(DEADLINE).is_ok());
  assert!(done_rx.recv_timeout(WAIT).is_err(),"both independent Stage reads must block on held Core mutex");
  drop(held);
  for _ in 0..2{
    let (kind,result)=done_rx.recv_timeout(DEADLINE).unwrap();
    assert!(result.unwrap(),"new-only serialized Stage {kind} must succeed before Close");
  }
  a.join().unwrap();
  b.join().unwrap();
  assert!(gate.is_alive());
}
#[test]
fn new_mutating_stage_command_waits_for_lifetime_lease_even_if_input_plan_is_invalid(){
  let core=owner();
  let decoded=core.borrow_decoded_snapshot_research().unwrap();
  let gate=core.borrow_source_liveness_research(&decoded).unwrap();
  let held=gate.hold().unwrap();
  let mut tx=bound(&core,6303);
  let before=tx.source_sha256();
  let (started_tx,started_rx)=mpsc::channel();
  let (done_tx,done_rx)=mpsc::channel();
  let worker=thread::spawn(move||{
    started_tx.send(()).unwrap();
    let rejected=tx.stage_command(empty_plan(6303)).unwrap_err();
    done_tx.send((rejected,tx.revision(),tx.index_generation(),tx.source_sha256())).unwrap();
  });
  started_rx.recv_timeout(DEADLINE).unwrap();
  assert!(done_rx.recv_timeout(WAIT).is_err(),
    "atomic no-op/invalid write cannot escape owner's lifetime barrier");
  drop(held);
  let (reason,revision,generation,sha)=done_rx.recv_timeout(DEADLINE).unwrap();
  assert_eq!(reason,"TX_COMMAND_COUNT");
  assert_eq!((revision,generation),(0,0));
  assert_eq!(sha,before);
  worker.join().unwrap();
  assert!(gate.is_alive());
}
#[test]
fn new_trusted_owner_drop_waits_for_outstanding_stage_lease_then_denies_every_future_bound_entry(){
  let core=owner();
  let decoded=core.borrow_decoded_snapshot_research().unwrap();
  let gate=core.borrow_source_liveness_research(&decoded).unwrap();
  let held=gate.hold().unwrap();
  let mut tx=bound(&core,6304);
  let original_sha=tx.source_sha256();
  let (started_tx,started_rx)=mpsc::channel();
  let (done_tx,done_rx)=mpsc::channel();
  let worker=thread::spawn(move||{
    started_tx.send(()).unwrap();
    drop(core); // core Drop must acquire EXACT held lease mutex
    done_tx.send(()).unwrap();
  });
  started_rx.recv_timeout(DEADLINE).unwrap();
  assert!(done_rx.recv_timeout(WAIT).is_err(),"owner Drop must not finish inside an active Stage lease");
  assert!(gate.is_alive());
  drop(held);
  done_rx.recv_timeout(DEADLINE).unwrap();
  worker.join().unwrap();
  assert!(!gate.is_alive());
  assert_eq!(gate.hold().err(),Some("CORE_STAGE_SOURCE_REVOKED"));
  assert_eq!(tx.validate_transaction().unwrap_err(),"CORE_STAGE_SOURCE_REVOKED");
  assert_eq!(tx.stage_command(empty_plan(6304)).unwrap_err(),"CORE_STAGE_SOURCE_REVOKED");
  assert_eq!(tx.undo(0).unwrap_err(),"CORE_STAGE_SOURCE_REVOKED");
  assert_eq!(tx.redo(0).unwrap_err(),"CORE_STAGE_SOURCE_REVOKED");
  assert_eq!(tx.query_paged(&["/GameInfo/Version".to_owned()],0,1).unwrap_err(),"CORE_STAGE_SOURCE_REVOKED");
  assert_eq!(tx.inspect_source_reference_paths(&paths()).unwrap_err(),"CORE_STAGE_SOURCE_REVOKED");
  assert_eq!(tx.inspect_references(&event_identity()).unwrap_err(),"CORE_STAGE_SOURCE_REVOKED");
  assert_eq!((tx.revision(),tx.index_generation()),(0,0));
  assert_eq!(tx.source_sha256(),original_sha);
  assert_eq!(tx.export_verified_copy().unwrap_err(),"PRODUCT_P1G_ENCODE_COPY_NOT_AUTHORIZED");
}
#[test]
fn new_poisoned_native_lifetime_mutex_denies_every_stage_even_before_and_after_core_close(){
  let mut core=owner();
  let decoded=core.borrow_decoded_snapshot_research().unwrap();
  let gate=core.borrow_source_liveness_research(&decoded).unwrap();
  let mut tx=bound(&core,6305);
  let original_sha=tx.source_sha256();
  let poison=gate.clone();
  let panicked=thread::spawn(move||{
    let _lease=poison.hold().unwrap();
    panic!("05 QR-C deliberate mutex poison under live research Stage lease");
  });
  assert!(panicked.join().is_err(),"induced poison must be caught by caller");
  assert!(gate.is_alive(),"poison does not itself authorize a false positive Stage");
  assert_eq!(gate.hold().err(),Some("CORE_STAGE_SOURCE_REVOKED"));
  assert_eq!(tx.validate_transaction().unwrap_err(),"CORE_STAGE_SOURCE_REVOKED");
  assert_eq!(tx.stage_command(empty_plan(6305)).unwrap_err(),"CORE_STAGE_SOURCE_REVOKED");
  // Owner recovers poisoned Mutex only to set one-way REVOKED bit.
  core.close();
  assert!(!gate.is_alive());
  assert_eq!(tx.query_paged(&["/GameInfo/Version".to_owned()],0,1).unwrap_err(),"CORE_STAGE_SOURCE_REVOKED");
  assert_eq!(tx.inspect_source_reference_paths(&paths()).unwrap_err(),"CORE_STAGE_SOURCE_REVOKED");
  assert_eq!((tx.revision(),tx.index_generation()),(0,0));
  assert_eq!(tx.source_sha256(),original_sha);
  assert_eq!(tx.export_verified_copy().unwrap_err(),"PRODUCT_P1G_ENCODE_COPY_NOT_AUTHORIZED");
}
