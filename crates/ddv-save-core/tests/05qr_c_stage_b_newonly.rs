//! 05 QR-C independent NEW-ONLY changed-risk tests for PR724 StageB.
//! Synthetic fixture ONLY, no owner Steam Save/P1G, no product Writer proof.
#![cfg(feature = "synthetic-stage-b")]
use ddv_save_core::{
    BuildIdentity,BuildKind,Platform,ProductSession,WorkerAction,WorkerEnvelope,
    SyntheticChangeSet,PRODUCT_WORKER_CONTRACT,
};
use serde_json::{json,Value};
use std::{
    fs,env,path::PathBuf,process::Command,sync::{Arc,Barrier},
    sync::atomic::{AtomicU64,Ordering},thread,
};
static COUNTER:AtomicU64=AtomicU64::new(1);
const MARKER:&str="WAND_SYNTHETIC_ONLY_NOT_A_REAL_SAVE";
const LIMIT:usize=1024*1024;

fn source()->Vec<u8>{
    serde_json::to_vec(&json!({
        "__WandSyntheticStageBOnly":MARKER,
        "GameInfo":{"Version":626,"Unknown":"q\u{00f1}"},
        "Player":{"__wandPlayerCounter":11,"Opaque":{"literal":"exact\\u0020text","nested":[null,false,{"n":1}]}},
        "World":{"__wandWorldCounter":22,"Opaque":{"preserve":[true,0,{"z":"unchanged"}]}},
        "ExtraOpaque":{"quotes":"\"escaped\"","array":[1,2,3]}
    })).unwrap()
}
fn build()->BuildIdentity{
    BuildIdentity{
        platform:Platform::Switch,build_kind:BuildKind::SwitchBid,
        build_id:"9A239D3DB569756D".to_owned(),
        schema:626,externally_attested:true
    }
}
fn opened(bytes:Vec<u8>)->ProductSession{
    ProductSession::open_decoded_readonly(bytes,build()).unwrap()
}
fn scope(s:&ProductSession,action:WorkerAction)->WorkerEnvelope{
    let r=s.receipt().unwrap();
    WorkerEnvelope{
        contract:PRODUCT_WORKER_CONTRACT,session_id:r.session_id,
        expected_revision:r.revision,expected_index_generation:r.index_generation,
        expected_decoded_sha256:r.decoded_sha256,action,
    }
}
fn change(s:&ProductSession,p:i64,w:i64)->SyntheticChangeSet{
    SyntheticChangeSet{
        scope:scope(s,WorkerAction::Stage),
        expected_player:11,new_player:p,
        expected_world:22,new_world:w
    }
}
struct Temp(PathBuf);
impl Temp {
    fn new()->Self{
        let n=COUNTER.fetch_add(1,Ordering::SeqCst);
        let p=env::temp_dir().join(format!("wand-05qrc-pr724-synthetic-{}-{}",std::process::id(),n));
        fs::create_dir(&p).unwrap();
        Self(p)
    }
    fn file(&self,name:&str)->PathBuf{self.0.join(name)}
    fn original(&self)->PathBuf{self.file("wand-stageb-original.json")}
    fn backup(&self)->PathBuf{self.file("wand-stageb-original.backup.json")}
    fn edited(&self)->PathBuf{self.file("wand-stageb-edited-copy.json")}
}
impl Drop for Temp{fn drop(&mut self){let _=fs::remove_dir_all(&self.0);}}

#[test]
fn qr_b01_two_parallel_identical_old_value_cas_have_exactly_one_commit(){
    let shared=Arc::new(opened(source()));
    let baseline=shared.receipt().unwrap();
    let c=change(&shared,101,203);
    let barrier=Arc::new(Barrier::new(3));
    let mut jobs=Vec::new();
    for _ in 0..2 {
        let s=Arc::clone(&shared);let b=Arc::clone(&barrier);
        jobs.push(thread::spawn(move||{b.wait();s.synthetic_stage(c)}));
    }
    barrier.wait();
    let results:Vec<_>=jobs.into_iter().map(|h|h.join().unwrap()).collect();
    assert_eq!(results.iter().filter(|r|r.is_ok()).count(),1);
    assert_eq!(results.iter().filter(|r|r.is_err()).count(),1);
    let now=shared.receipt().unwrap();
    assert_eq!((now.revision,now.index_generation),(1,2));
    assert_eq!(now.session_id,baseline.session_id);
    assert_eq!(now.decoded_sha256,baseline.decoded_sha256);
    assert_eq!(shared.synthetic_fixture_counters().unwrap(),(11,22),
        "synthetic ledger may not modify original decoded bytes");
    assert!(!now.writer_authorized && !now.product_read_accepted);
}

#[test]
fn qr_b02_exact_two_numeric_token_replacements_preserve_every_other_opaque_byte(){
    let original=source();
    let s=opened(original.clone());let t=Temp::new();
    fs::write(t.original(),&original).unwrap();
    s.synthetic_stage(change(&s,101,3)).unwrap();
    let export=s.synthetic_export_to_dir(
        scope(&s,WorkerAction::ExportEditedCopy),&t.0).unwrap();
    assert!(export.original_unchanged && export.distinct_backup_verified && export.distinct_edited_verified);
    assert!(!export.writer_authorized && !export.fresh_process_reopen_validated);
    assert_eq!(fs::read(t.original()).unwrap(),original);
    assert_eq!(fs::read(t.backup()).unwrap(),original);
    let before=String::from_utf8(original).unwrap();
    assert_eq!(before.matches("\"__wandPlayerCounter\":11").count(),1);
    assert_eq!(before.matches("\"__wandWorldCounter\":22").count(),1);
    let exact=before.replace("\"__wandPlayerCounter\":11","\"__wandPlayerCounter\":101")
                    .replace("\"__wandWorldCounter\":22","\"__wandWorldCounter\":3");
    assert_eq!(fs::read(t.edited()).unwrap(),exact.into_bytes(),
        "no normalization of unrelated raw keys/escaped chars permitted");
    assert!(s.receipt().is_err());
}

#[test]
fn qr_b03_preexisting_edited_destination_fails_before_any_backup_and_consumes_once(){
    let original=source();let s=opened(original.clone());let t=Temp::new();
    fs::write(t.original(),&original).unwrap();
    fs::write(t.edited(),b"EXTERNAL_SENTINEL_DO_NOT_OVERWRITE").unwrap();
    s.synthetic_stage(change(&s,14,25)).unwrap();
    let token=scope(&s,WorkerAction::ExportEditedCopy);
    assert_eq!(s.synthetic_export_to_dir(token,&t.0).unwrap_err().0,"SYNTHETIC_NO_OVERWRITE");
    assert_eq!(fs::read(t.edited()).unwrap(),b"EXTERNAL_SENTINEL_DO_NOT_OVERWRITE");
    assert_eq!(fs::read(t.original()).unwrap(),original);
    assert!(!t.backup().exists());
    assert_eq!(s.synthetic_export_to_dir(token,&t.0).unwrap_err().0,"SYNTHETIC_EXPORT_CONSUMED");
}

#[test]
fn qr_b04_bounded_source_that_grows_over_limit_never_writes_edited_or_backup(){
    let mut value:Value=serde_json::from_slice(&source()).unwrap();
    value["ExtraOpaque"]["pad"]=Value::String(String::new());
    let skeleton=serde_json::to_vec(&value).unwrap();
    assert!(skeleton.len()<LIMIT);
    value["ExtraOpaque"]["pad"]=Value::String("x".repeat(LIMIT-skeleton.len()));
    let bytes=serde_json::to_vec(&value).unwrap();
    assert_eq!(bytes.len(),LIMIT);
    let s=opened(bytes.clone());let t=Temp::new();
    fs::write(t.original(),&bytes).unwrap();
    // A typed stage can be accepted but export must reject output > 1MiB;
    // do not promote a stage receipt to a V2 export success.
    s.synthetic_stage(change(&s,999_999_999,888_888_888)).unwrap();
    let result=s.synthetic_export_to_dir(scope(&s,WorkerAction::ExportEditedCopy),&t.0);
    assert!(result.is_err());
    assert!(!t.backup().exists() && !t.edited().exists());
    assert_eq!(fs::read(t.original()).unwrap(),bytes);
}

#[test]
fn qr_b05_fresh_subprocess_reopen_rejects_tampered_values_and_alias_filename(){
    let original=source();let s=opened(original.clone());let t=Temp::new();
    fs::write(t.original(),&original).unwrap();
    s.synthetic_stage(change(&s,101,203)).unwrap();
    s.synthetic_export_to_dir(scope(&s,WorkerAction::ExportEditedCopy),&t.0).unwrap();
    let bin=env!("CARGO_BIN_EXE_wand-stageb-synthetic-reopen");
    let bad=Command::new(bin).arg(t.edited()).arg("101").arg("999").output().unwrap();
    assert!(!bad.status.success(),"changed World expected must be verified in child");
    let alias=t.file("not-a-genuine-editedcopy.json");
    fs::write(&alias,fs::read(t.edited()).unwrap()).unwrap();
    let wrong_name=Command::new(bin).arg(alias).arg("101").arg("203").output().unwrap();
    assert!(!wrong_name.status.success(),"arbitrary edited pathname denied");
    assert_eq!(fs::read(t.backup()).unwrap(),original);
}

#[test]
fn qr_b06_duplicate_typed_counter_in_unrelated_extension_fails_closed(){
    let mut value:Value=serde_json::from_slice(&source()).unwrap();
    value["ExtraOpaque"]["anotherDomain"]=json!({"__wandPlayerCounter":11});
    let bytes=serde_json::to_vec(&value).unwrap();
    let s=opened(bytes);
    let receipt=s.receipt().unwrap();
    assert_eq!(s.synthetic_stage(change(&s,101,203)).unwrap_err().0,"SYNTHETIC_REF_NOT_UNIQUE");
    assert_eq!(s.receipt().unwrap(),receipt);
    assert_eq!(s.synthetic_fixture_counters().unwrap(),(11,22));
}

#[cfg(unix)]
#[test]
fn qr_b07_preexisting_symlink_target_for_edited_copy_is_never_followed(){
    use std::os::unix::fs::symlink;
    let original=source();let s=opened(original.clone());let t=Temp::new();
    fs::write(t.original(),&original).unwrap();
    let target=t.file("unrelated-external-sentinel");
    fs::write(&target,b"PRIVATE_SENTINEL_MUST_NOT_CHANGE").unwrap();
    symlink(&target,t.edited()).unwrap();
    s.synthetic_stage(change(&s,13,24)).unwrap();
    assert_eq!(s.synthetic_export_to_dir(scope(&s,WorkerAction::ExportEditedCopy),&t.0)
       .unwrap_err().0,"SYNTHETIC_NO_OVERWRITE");
    assert_eq!(fs::read(target).unwrap(),b"PRIVATE_SENTINEL_MUST_NOT_CHANGE");
    assert_eq!(fs::read(t.original()).unwrap(),original);
    assert!(!t.backup().exists());
}
