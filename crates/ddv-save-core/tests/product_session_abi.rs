use ddv_save_core::{BuildIdentity,BuildKind,Platform,ProductSession,WorkerAction,WorkerEnvelope,PRODUCT_WORKER_CONTRACT};
use std::{sync::{Arc,Barrier},thread};
const STEAM_BUILD:&str="releases_1.25-v1.25.3-44-g0b41250d9ac0-incremental-22";
fn identity()->BuildIdentity {
    BuildIdentity {platform:Platform::SteamWindows,build_kind:BuildKind::SteamFullVersion,
        build_id:STEAM_BUILD.into(),schema:626,externally_attested:true}
}
fn sample()->Vec<u8> {
    br#"{"GameInfo":{"Version":626},"Player":{},"World":{"RecurringEvents":[]},"FutureUnknown":{"nested":[{"x":0,"valid":false}]}}"#.to_vec()
}
fn open()->ProductSession { ProductSession::open_decoded_readonly(sample(),identity()).unwrap() }
fn envelope(s:&ProductSession,action:WorkerAction)->WorkerEnvelope {
    let r=s.receipt().unwrap();
    WorkerEnvelope {contract:PRODUCT_WORKER_CONTRACT,session_id:r.session_id,
        expected_revision:r.revision,expected_index_generation:r.index_generation,
        expected_decoded_sha256:r.decoded_sha256,action}
}
#[test]
fn one_product_id_and_read_only_receipt() {
    let s=open();let a=s.receipt().unwrap();let b=s.receipt().unwrap();
    assert_eq!(a.session_id,b.session_id);assert_ne!(a.session_id,[0;16]);
    assert_eq!(a.revision,0);assert_eq!(a.index_generation,1);
    assert!(a.full_document_json_validated);
    assert!(!a.all_domain_references_verified && !a.product_worker_bound && !a.product_read_accepted);
    assert!(!a.writer_authorized && !a.apply_authorized && !a.edited_copy_authorized);
    let p=s.dispatch(envelope(&s,WorkerAction::ReadCoreSchemaWitness)).unwrap();
    assert_eq!(p.session_id,a.session_id);
    assert_eq!(p.core_owned_readset,"/GameInfo/Version");
    assert!(!p.complete_all_domains && !p.writer_authorized);
}
#[test]
fn exact_build_schema_and_strict_full_document_fail_closed() {
    let mut b=identity();b.externally_attested=false;
    assert!(ProductSession::open_decoded_readonly(sample(),b).is_err());
    let mut b=identity();b.schema=624;
    assert!(ProductSession::open_decoded_readonly(sample(),b).is_err());
    let mut b=identity();b.platform=Platform::Switch;
    assert!(ProductSession::open_decoded_readonly(sample(),b).is_err());
    let mut b=identity();b.build_id="made-up".into();
    assert!(ProductSession::open_decoded_readonly(sample(),b).is_err());
    assert!(ProductSession::open_decoded_readonly(br#"{"GameInfo":{"Version":626},"World":{}}"#.to_vec(),identity()).is_err());
    assert!(ProductSession::open_decoded_readonly(br#"{"GameInfo":{"Version":626,"Version":626},"Player":{},"World":{}}"#.to_vec(),identity()).is_err());
    assert!(ProductSession::open_decoded_readonly(br#"{"GameInfo":{"Version":626},"Player":{},"World":{"arr":[{"x":1,"x":2}]}}"#.to_vec(),identity()).is_err());
    assert!(ProductSession::open_decoded_readonly(b"not json".to_vec(),identity()).is_err());
    assert!(ProductSession::open_decoded_readonly(vec![0xff,0xff],identity()).is_err());
}
#[test]
fn forged_scope_revision_and_writer_disabled() {
    let s=open();let base=envelope(&s,WorkerAction::ReadCoreSchemaWitness);
    let mut stale=base;stale.session_id[0]^=1;assert!(s.dispatch(stale).is_err());
    let mut stale=base;stale.expected_revision+=1;assert!(s.dispatch(stale).is_err());
    let mut stale=base;stale.expected_index_generation+=1;assert!(s.dispatch(stale).is_err());
    let mut stale=base;stale.expected_decoded_sha256[0]^=1;assert!(s.dispatch(stale).is_err());
    let mut stale=base;stale.contract="untrusted";assert!(s.dispatch(stale).is_err());
    for action in [WorkerAction::ReadDomain,WorkerAction::Stage,
        WorkerAction::ExportEditedCopy,WorkerAction::Apply,WorkerAction::OriginalOverwrite] {
        assert!(s.dispatch(WorkerEnvelope {action,..base}).is_err(),"{:?}",action);
    }
    assert_eq!(s.receipt().unwrap().revision,0);
    assert!(s.dispatch(base).is_ok());
}
#[test]
fn close_vs_dispatch_concurrency_revokes_existing_handle() {
    let s=Arc::new(open());let r=s.receipt().unwrap();
    let token=envelope(&s,WorkerAction::ReadCoreSchemaWitness);
    let barrier=Arc::new(Barrier::new(3));
    let first=Arc::clone(&s);let gate=Arc::clone(&barrier);
    let t1=thread::spawn(move||{gate.wait();for _ in 0..100 {let _=first.dispatch(token);}});
    let second=Arc::clone(&s);let gate=Arc::clone(&barrier);
    let t2=thread::spawn(move||{gate.wait();second.close()});
    barrier.wait();t1.join().unwrap();t2.join().unwrap().unwrap();
    assert_eq!(s.dispatch(token).unwrap_err().0,"SESSION_CLOSED");
    assert_eq!(s.receipt().unwrap_err().0,"SESSION_CLOSED");
    assert!(s.close().is_err());assert_ne!(r.session_id,[0;16]);
}
