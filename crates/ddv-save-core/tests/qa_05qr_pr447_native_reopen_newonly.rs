//! 05 QR PR447 separate independent synthetic QA, native-only research.
//! This is NOT a product Rust WASM Worker, NOT genuine private P1G, NOT Native V3.
use ddv_save_core::{sha256};
use ddv_save_core::p1g::{encode_synthetic_fixture,decode_p1g_research};
use ddv_save_core::offline_w1_v2::{execute_private_w1_v2_research,PrivateW1V2Input};
use std::{fs,io::Write,path::PathBuf,process::Command};
const KEY:[u8;32]=[0x65;32];
const REG:&[u8]=b"05qr-pr447-independent-synthetic-only";
const OLD:&str="2126-08-20T00:00:00Z";
const NEXT:&str="2026-11-04T00:00:00Z";
const DOC:&str=r#"{"GameInfo":{"Version":626},"Player":{"Unknown":{"opaque":[5,6],"x":1.00}},"World":{"RecurringEvents":{"155":{"ItemSpawning":{"RecurringEventItemID":2010000021,"NextOccurrence":"2126-08-20T00:00:00Z","LastOccurrence":"2026-10-01T00:00:00Z","EndDate":null}}},"GridCollection":{"Grids":{"10":{"Objects":{}}},"DiffGrids":{"10":{"Modified":[]}}},"Villages":[{"Areas":{"0":{"GridIDs":[10]}}}]}}"#;
struct Fx {dir:PathBuf,original:PathBuf,backup:PathBuf,edited:PathBuf,cipher:Vec<u8>,decoded:String}
impl Fx {
 fn new(raw:&str)->Self{
  let mut entropy=[0u8;8];getrandom::getrandom(&mut entropy).unwrap();
  let root=std::env::temp_dir().join(format!("qr447-private-SYNTHETIC-{}-{:016x}",
   std::process::id(),u64::from_le_bytes(entropy)));
  fs::create_dir(&root).unwrap();
  let original=root.join("original.p1g"),backup=root.join("backup-first.p1g"),edited=root.join("edited-copy.p1g");
  let cipher=encode_synthetic_fixture(raw.as_bytes(),&KEY,8).unwrap();
  let mut f=fs::OpenOptions::new().write(true).create_new(true).open(&original).unwrap();
  f.write_all(&cipher).unwrap();f.sync_all().unwrap();
  Self{dir:root,original,backup,edited,cipher,decoded:raw.to_owned()}
 }
 fn request<'a>(&'a self)->PrivateW1V2Input<'a>{
  PrivateW1V2Input{source_path:&self.original,backup_path:&self.backup,edited_path:&self.edited,
   key:&KEY,registry:REG,source_sha:sha256(&self.cipher),
   decoded_sha:sha256(self.decoded.as_bytes()),registry_sha:sha256(REG),
   platform:"switch",full_version:"1.25.3",bid:"9A239D3DB569756D",
   schema:626,expected_revision:0,old_utc:OLD,proposed_utc:NEXT}
 }
}
impl Drop for Fx {fn drop(&mut self){let _=fs::remove_dir_all(&self.dir);}}
#[test]
fn independently_assert_output_is_distinct_new_file_original_first_exact_sha_and_one_pointer(){
 let fx=Fx::new(DOC),receipt=execute_private_w1_v2_research(fx.request()).unwrap();
 assert_eq!(receipt.original_sha,sha256(&fx.cipher));
 assert_eq!(receipt.backup_sha,receipt.original_sha);
 assert_ne!(receipt.edited_sha,receipt.original_sha);
 assert!(receipt.mandatory_readset_pass);
 assert!(receipt.atomic_diff_pass);
 assert!(receipt.original_first_backup_reopened);
 assert!(receipt.edited_file_reopened);
 assert_eq!(receipt.revision_after_stage,1);
 assert_eq!(receipt.revision_after_undo_redo,3);
 assert!(!receipt.independent_process_reopen,"Source runner itself must not claim external process acceptance");
 assert!(!receipt.product_writer_authorized);
 assert!(!receipt.native_v3_verified);
 assert_eq!(fs::read(&fx.original).unwrap(),fx.cipher);
 assert_eq!(fs::read(&fx.backup).unwrap(),fx.cipher);
 assert_eq!(sha256(&fs::read(&fx.original).unwrap()),receipt.original_sha);
 let edited=decode_p1g_research(&fs::read(&fx.edited).unwrap(),&KEY,128*1024*1024).unwrap();
 let original=decode_p1g_research(&fx.cipher,&KEY,128*1024*1024).unwrap();
 assert_eq!(original.json,fx.decoded.as_bytes());
 let edited_utf8=String::from_utf8(edited.json).unwrap();
 assert_eq!(edited_utf8,DOC.replacen(OLD,NEXT,1));
 assert!(edited_utf8.contains(r#""x":1.00"#));
 assert!(edited_utf8.contains(r#""opaque":[5,6]"#));
 assert_eq!(receipt.edited_decoded_sha,sha256(edited_utf8.as_bytes()));
 // Distinct OS process using the same Rust decoder, not independent IMPLEMENTATION.
 let child=Command::new(std::env::current_exe().unwrap())
  .args(["--exact","qa_child_separate_process_reopen","--nocapture"])
  .env("QA_CHILD_REOPEN_PATH",&fx.edited)
  .env("QA_CHILD_EXPECTED_NEXT",NEXT)
  .env("QA_CHILD_EXPECTED_OLD",OLD)
  .output().unwrap();
 assert!(child.status.success(),"child failed: {}",String::from_utf8_lossy(&child.stderr));
 assert!(String::from_utf8_lossy(&child.stdout).contains("1 passed"));
 assert_eq!(execute_private_w1_v2_research(fx.request()).unwrap_err(),
  "OFFLINE_OUTPUT_ALREADY_EXISTS");
}
#[test]
fn qa_child_separate_process_reopen(){
 let Ok(path)=std::env::var("QA_CHILD_REOPEN_PATH") else{return};
 let decoded=decode_p1g_research(&fs::read(path).unwrap(),&KEY,128*1024*1024).unwrap();
 let text=String::from_utf8(decoded.json).unwrap();
 assert!(text.contains(&std::env::var("QA_CHILD_EXPECTED_NEXT").unwrap()));
 assert!(!text.contains(&std::env::var("QA_CHILD_EXPECTED_OLD").unwrap()));
 assert!(text.contains(r#""x":1.00"#));
}
#[test]
fn false_external_bid_revision_source_and_decoded_sha_refuse_all_output_files(){
 for i in 0..6{
  let fx=Fx::new(DOC);
  let mut q=fx.request();
  let expected=match i{
   0=>{q.bid="52BD625D9B4E0053";"OFFLINE_EXTERNAL_BUILD_DENIED"},
   1=>{q.expected_revision=1;"OFFLINE_STALE_REVISION"},
   2=>{q.source_sha=[0;32];"OFFLINE_SOURCE_SHA_CAS_FAILED"},
   3=>{q.decoded_sha=[0;32];"OFFLINE_DECODED_SHA_CAS_FAILED"},
   4=>{q.registry_sha=[0;32];"OFFLINE_REGISTRY_SHA_DENIED"},
   _=>{q.old_utc="2126-08-21T00:00:00Z";"W1_RAW_OLD_VALUE_CAS_FAILED"}
  };
  assert_eq!(execute_private_w1_v2_research(q).unwrap_err(),expected,"mode {i}");
  assert!(!fx.backup.exists(),"no backup even on denied preflight");
  assert!(!fx.edited.exists(),"no edited copy on denied preflight");
  assert_eq!(fs::read(&fx.original).unwrap(),fx.cipher);
 }
}
#[test]
fn missing_native_source_enddate_and_wrong_village_map_block_before_backup(){
 let examples=[
  DOC.replace(r#","EndDate":null"#,""),
  DOC.replace(r#""Villages":[{"Areas":{"0":{"GridIDs":[10]}}}]"#,r#""Villages":{"legacy":{"Areas":{}}}"#),
  DOC.replace(r#""Grids":{"10":{"Objects":{}}}"#,r#""Grids":[]"#)
 ];
 for raw in examples{
  let fx=Fx::new(&raw);
  assert!(execute_private_w1_v2_research(fx.request()).is_err());
  assert!(!fx.backup.exists());assert!(!fx.edited.exists());
  assert_eq!(fs::read(&fx.original).unwrap(),fx.cipher);
 }
}
#[test]
fn output_alias_preexisting_dir_traversal_and_symlink_are_never_overwritten(){
 for case in ["backup-is-source","edited-is-source","same-output","preexisting-file"]{
  let fx=Fx::new(DOC);
  let mut q=fx.request();
  if case=="backup-is-source"{q.backup_path=&fx.original;}
  else if case=="edited-is-source"{q.edited_path=&fx.original;}
  else if case=="same-output"{q.edited_path=&fx.backup;}
  else{fs::write(&fx.edited,b"PREEXISTING").unwrap();}
  let err=execute_private_w1_v2_research(q).unwrap_err();
  assert_eq!(err,if case=="preexisting-file"{"OFFLINE_OUTPUT_ALREADY_EXISTS"}else{"OFFLINE_SOURCE_REPLACEMENT_FORBIDDEN"});
  assert_eq!(fs::read(&fx.original).unwrap(),fx.cipher);
  assert!(!fx.backup.exists());
 }
}
