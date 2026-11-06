//! W-CORE-RUST-V2-CAS-078 Stage B synthetic-only. NO genuine P1G, secrets,
//! product Writer, cloud or Native semantic evidence ever enters this CI.
#![cfg(feature = "synthetic-stage-b")]
use ddv_save_core::{
  BuildIdentity,BuildKind,Platform,ProductSession,WorkerAction,WorkerEnvelope,
  SyntheticChangeSet,PRODUCT_WORKER_CONTRACT
};
use serde_json::{json,Value};
use sha2::{Digest,Sha256};
use std::{
 fs,process::Command,env,path::PathBuf,
 sync::atomic::{AtomicU64,Ordering}
};
static NEXT:AtomicU64=AtomicU64::new(1);
const MARKER:&str="WAND_SYNTHETIC_ONLY_NOT_A_REAL_SAVE";
fn build()->BuildIdentity{
    BuildIdentity{platform:Platform::Switch,build_kind:BuildKind::SwitchBid,
      build_id:"9A239D3DB569756D".into(),schema:626,externally_attested:true}
}
fn fixture()->Vec<u8>{
 serde_json::to_vec(&json!({
  "__WandSyntheticStageBOnly":MARKER,
  "GameInfo":{"Version":626,"FutureUnknown":"preserved"},
  "Player":{"__wandPlayerCounter":11,"FutureUnknown":{"opaque":[true,null,42],"literal":"ñ"}},
  "World":{"__wandWorldCounter":22,"FutureUnknown":[{"layout":{"opaque":5}}]},
  "Extensions":{"unaltered":"exact_bytes"}
 })).unwrap()
}
fn open()->ProductSession{ProductSession::open_decoded_readonly(fixture(),build()).unwrap()}
fn scope(s:&ProductSession,action:WorkerAction)->WorkerEnvelope{
 let r=s.receipt().unwrap();
 WorkerEnvelope{contract:PRODUCT_WORKER_CONTRACT,session_id:r.session_id,
   expected_revision:r.revision,expected_index_generation:r.index_generation,
   expected_decoded_sha256:r.decoded_sha256,action}
}
fn change(s:&ProductSession,player:i64,world:i64)->SyntheticChangeSet{
 SyntheticChangeSet{scope:scope(s,WorkerAction::Stage),
   expected_player:11,new_player:player,expected_world:22,new_world:world}
}
fn digest(s:&[u8])->[u8;32]{Sha256::digest(s).into()}
struct TmpDir(PathBuf);
impl TmpDir {
 fn new()->Self{
   let n=NEXT.fetch_add(1,Ordering::SeqCst);
   let path=env::temp_dir().join(format!("wand-stageb-synthetic-{}-{}",std::process::id(),n));
   fs::create_dir(&path).unwrap();
   Self(path)
 }
 fn original(&self)->PathBuf{self.0.join("wand-stageb-original.json")}
 fn backup(&self)->PathBuf{self.0.join("wand-stageb-original.backup.json")}
 fn edited(&self)->PathBuf{self.0.join("wand-stageb-edited-copy.json")}
}
impl Drop for TmpDir{fn drop(&mut self){let _=fs::remove_dir_all(&self.0);}}
fn stage(s:&ProductSession)->() {s.synthetic_stage(change(s,12,23)).unwrap();}

#[test]
fn synthetic_two_domain_atomic_stage_undo_redo_one_time_verified_export_and_fresh_process_reopen(){
 let source=fixture();let initial_sha=digest(&source);
 let s=open();let r0=s.receipt().unwrap();
 let tx=s.synthetic_stage(change(&s,12,23)).unwrap();
 assert_eq!(tx.revision,1);assert_eq!(tx.index_generation,2);
 assert!(tx.applied && tx.cross_domain_atomic && !tx.writer_authorized);
 assert_eq!(tx.decoded_source_sha256,initial_sha);
 assert!(s.synthetic_stage(change(&s,12,23)).is_err()); // stale CAS
 let un=s.synthetic_undo(scope(&s,WorkerAction::Stage)).unwrap();
 assert_eq!((un.revision,un.index_generation,un.applied),(2,3,false));
 let re=s.synthetic_redo(scope(&s,WorkerAction::Stage)).unwrap();
 assert_eq!((re.revision,re.index_generation,re.applied),(3,4,true));
 assert_ne!(r0.revision,re.revision);
 assert!(s.dispatch(scope(&s,WorkerAction::Stage)).is_err()); // product Writer remains OFF
 let temp=TmpDir::new();
 fs::write(temp.original(),&source).unwrap();
 let receipt=s.synthetic_export_to_dir(scope(&s,WorkerAction::ExportEditedCopy),&temp.0).unwrap();
 assert_eq!(receipt.decoded_source_sha256,initial_sha);
 assert_eq!(receipt.backup_sha256,initial_sha);
 assert_ne!(receipt.edited_sha256,initial_sha);
 assert!(receipt.original_unchanged && receipt.distinct_backup_verified &&
   receipt.distinct_edited_verified && receipt.same_process_reopen_validated);
 assert!(!receipt.fresh_process_reopen_validated && !receipt.writer_authorized);
 assert_eq!(fs::read(temp.original()).unwrap(),source);
 assert_eq!(fs::read(temp.backup()).unwrap(),source);
 let edited=fs::read(temp.edited()).unwrap();
 let original_json:Value=serde_json::from_slice(&source).unwrap();
 let edited_json:Value=serde_json::from_slice(&edited).unwrap();
 assert_eq!(edited_json["Player"]["__wandPlayerCounter"],12);
 assert_eq!(edited_json["World"]["__wandWorldCounter"],23);
 assert_eq!(original_json["Player"]["FutureUnknown"],edited_json["Player"]["FutureUnknown"]);
 assert_eq!(original_json["World"]["FutureUnknown"],edited_json["World"]["FutureUnknown"]);
 assert_eq!(original_json["Extensions"],edited_json["Extensions"]);
 assert!(s.receipt().is_err());
 assert!(s.synthetic_export_to_dir(r0_scope(&r0,WorkerAction::ExportEditedCopy),&temp.0).is_err());
 let result=Command::new(env!("CARGO_BIN_EXE_wand-stageb-synthetic-reopen"))
   .arg(temp.edited()).arg("12").arg("23").output().unwrap();
 assert!(result.status.success(),"synthetic child exit = {:?}",result.status.code());
 assert!(String::from_utf8_lossy(&result.stdout).contains("STAGEB_SYNTHETIC_FRESH_PROCESS_READ_ONLY_PASS"));
}
fn r0_scope(r:&ddv_save_core::SessionReceipt,action:WorkerAction)->WorkerEnvelope{
 WorkerEnvelope{contract:PRODUCT_WORKER_CONTRACT,session_id:r.session_id,
  expected_revision:r.revision,expected_index_generation:r.index_generation,
  expected_decoded_sha256:r.decoded_sha256,action}
}
#[test]
fn wrong_old_value_in_either_domain_rejects_whole_changeset_without_revision(){
 let s=open();let initial=s.receipt().unwrap();
 for bad in [
   SyntheticChangeSet{scope:scope(&s,WorkerAction::Stage),expected_player:11,
      new_player:12,expected_world:999,new_world:23},
   SyntheticChangeSet{scope:scope(&s,WorkerAction::Stage),expected_player:999,
      new_player:12,expected_world:22,new_world:23},
   SyntheticChangeSet{scope:scope(&s,WorkerAction::Stage),expected_player:11,
      new_player:11,expected_world:22,new_world:23},
   SyntheticChangeSet{scope:scope(&s,WorkerAction::Stage),expected_player:11,
      new_player:12,expected_world:22,new_world:22},
   SyntheticChangeSet{scope:scope(&s,WorkerAction::Stage),expected_player:11,
      new_player:1_000_000_001,expected_world:22,new_world:23}
 ]{assert!(s.synthetic_stage(bad).is_err());assert_eq!(s.receipt().unwrap(),initial);}
 assert!(s.dispatch(scope(&s,WorkerAction::Stage)).is_err());
 assert!(s.synthetic_export_to_dir(scope(&s,WorkerAction::ExportEditedCopy),&TmpDir::new().0).is_err());
}
#[test]
fn spoofed_session_revision_generation_source_sha_and_contract_denied(){
 let a=open();let b=open();assert_ne!(a.receipt().unwrap().session_id,b.receipt().unwrap().session_id);
 let baseline=a.receipt().unwrap();
 let mut c=change(&a,12,23);
 c.scope.session_id=b.receipt().unwrap().session_id;assert!(a.synthetic_stage(c).is_err());
 let mut c=change(&a,12,23);c.scope.expected_revision+=1;assert!(a.synthetic_stage(c).is_err());
 let mut c=change(&a,12,23);c.scope.expected_index_generation+=1;assert!(a.synthetic_stage(c).is_err());
 let mut c=change(&a,12,23);c.scope.expected_decoded_sha256[0]^=1;assert!(a.synthetic_stage(c).is_err());
 let mut c=change(&a,12,23);c.scope.contract="untrusted";assert!(a.synthetic_stage(c).is_err());
 let mut c=change(&a,12,23);c.scope.action=WorkerAction::Apply;assert!(a.synthetic_stage(c).is_err());
 assert_eq!(a.receipt().unwrap(),baseline);
}
#[test]
fn missing_unknown_marker_reference_or_noncanonical_json_is_denied(){
 let synthetic=fixture();
 let cases=[
  synthetic.windows(2).next().map(|_|{
    let mut v:Value=serde_json::from_slice(&synthetic).unwrap();
    v.as_object_mut().unwrap().remove("__WandSyntheticStageBOnly");
    serde_json::to_vec(&v).unwrap()
  }).unwrap(),
  {let mut v:Value=serde_json::from_slice(&synthetic).unwrap();
   v["World"].as_object_mut().unwrap().remove("__wandWorldCounter");serde_json::to_vec(&v).unwrap()},
  {let mut v:Value=serde_json::from_slice(&synthetic).unwrap();
   v["Player"].as_object_mut().unwrap().remove("__wandPlayerCounter");serde_json::to_vec(&v).unwrap()},
  {let mut v=synthetic.clone();v.push(b' ');v}
 ];
 for payload in cases {
  let s=ProductSession::open_decoded_readonly(payload,build()).unwrap();
  assert!(s.synthetic_stage(change(&s,12,23)).is_err());
  assert_eq!(s.receipt().unwrap().revision,0);
 }
}
#[test]
fn synthetic_fixture_over_1mib_is_not_a_product_200mib_pass(){
 let mut data:Value=serde_json::from_slice(&fixture()).unwrap();
 data["Extensions"]["padding"]=Value::String("x".repeat(1_048_576));
 let s=ProductSession::open_decoded_readonly(serde_json::to_vec(&data).unwrap(),build()).unwrap();
 assert!(s.synthetic_stage(change(&s,12,23)).is_err());
}
#[test]
fn original_file_changed_externally_denies_export_without_creating_copies(){
 let s=open();stage(&s);let dir=TmpDir::new();
 fs::write(dir.original(),b"hostile external change").unwrap();
 let result=s.synthetic_export_to_dir(scope(&s,WorkerAction::ExportEditedCopy),&dir.0);
 assert!(result.is_err());assert!(!dir.backup().exists());assert!(!dir.edited().exists());
 assert!(s.synthetic_export_to_dir(scope(&s,WorkerAction::ExportEditedCopy),&dir.0).is_err());
}
#[test]
fn preexisting_backup_denied_without_overwrite_or_partial_edited_copy(){
 let s=open();stage(&s);let dir=TmpDir::new();
 fs::write(dir.original(),fixture()).unwrap();
 fs::write(dir.backup(),b"sentinel-stays").unwrap();
 assert!(s.synthetic_export_to_dir(scope(&s,WorkerAction::ExportEditedCopy),&dir.0).is_err());
 assert_eq!(fs::read(dir.backup()).unwrap(),b"sentinel-stays");
 assert_eq!(fs::read(dir.original()).unwrap(),fixture());
 assert!(!dir.edited().exists());
}
#[test]
fn undo_without_stage_or_replay_and_export_without_redo_denied(){
 let s=open();assert!(s.synthetic_undo(scope(&s,WorkerAction::Stage)).is_err());
 stage(&s);let old=scope(&s,WorkerAction::Stage);
 let un=s.synthetic_undo(old).unwrap();
 assert!(!un.applied);
 assert!(s.synthetic_undo(old).is_err()); // stale rev
 let dir=TmpDir::new();fs::write(dir.original(),fixture()).unwrap();
 assert!(s.synthetic_export_to_dir(scope(&s,WorkerAction::ExportEditedCopy),&dir.0).is_err());
 assert!(!dir.backup().exists()&&!dir.edited().exists());
 assert!(s.synthetic_redo(scope(&s,WorkerAction::Stage)).unwrap().applied);
}
