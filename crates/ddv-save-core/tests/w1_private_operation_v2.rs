//! Synthetic only. No private P1G, keys, or save bytes in GitHub CI.
use ddv_save_core::offline_w1_v2::{execute_private_w1_v2_research,PrivateW1V2Input};
use ddv_save_core::p1g::{encode_synthetic_fixture,decode_p1g_research};
use ddv_save_core::sha256;
use std::{path::{Path,PathBuf},fs,io::Write};
const KEY:[u8;32]=[0x42;32];
const ORIGINAL_UTC:&str="2126-08-20T00:00:00Z";
const NEW_UTC:&str="2026-11-04T12:00:00Z";
const REGISTRY:&[u8]=b"synthetic-registry-not-native";
const JSON:&str=r#"{"GameInfo":{"Version":626},"Player":{},"World":{"RecurringEvents":{"155":{"ItemSpawning":{"RecurringEventItemID":2010000021,"NextOccurrence":"2126-08-20T00:00:00Z","LastOccurrence":"2026-08-20T00:00:00Z","EndDate":"2030-12-31T00:00:00Z"}}},"GridCollection":{"Grids":{"10":{"Objects":[]}},"DiffGrids":{}},"Villages":[{"Areas":{"0":{"GridIDs":[10]}}}]},"Unknown":{"opaque":{"survives":true,"float":1.00}}}"#;
struct Fixture{
 base:PathBuf,original:PathBuf,backup:PathBuf,edited:PathBuf,
 ciphertext:Vec<u8>,json:String
}
impl Fixture{
 fn new(json:&str)->Self{
  let mut token=[0u8;8];getrandom::getrandom(&mut token).unwrap();
  let suffix=u64::from_le_bytes(token);
  let base=std::env::temp_dir().join(format!("01a-w1-private-synthetic-{}-{suffix}",std::process::id()));
  fs::create_dir(&base).unwrap();
  let original=base.join("source.p1g");
  let backup=base.join("backup.p1g");
  let edited=base.join("edited-copy.p1g");
  let ciphertext=encode_synthetic_fixture(json.as_bytes(),&KEY,8).unwrap();
  let mut file=fs::OpenOptions::new().write(true).create_new(true).open(&original).unwrap();
  file.write_all(&ciphertext).unwrap();
  file.sync_all().unwrap();
  Self{base,original,backup,edited,ciphertext,json:json.into()}
 }
 fn request<'a>(&'a self)->PrivateW1V2Input<'a>{
  PrivateW1V2Input{
   source_path:&self.original,backup_path:&self.backup,edited_path:&self.edited,
   key:&KEY,registry:REGISTRY,source_sha:sha256(&self.ciphertext),
   decoded_sha:sha256(self.json.as_bytes()),registry_sha:sha256(REGISTRY),
   platform:"switch",full_version:"1.25.3",bid:"9A239D3DB569756D",
   schema:626,expected_revision:0,old_utc:ORIGINAL_UTC,proposed_utc:NEW_UTC
  }
 }
}
impl Drop for Fixture{fn drop(&mut self){let _=fs::remove_dir_all(&self.base);}}
#[test]
fn rust_private_operation_proof_synthetic_atomic_stage_undo_redo_backup_copy(){
 let fixture=Fixture::new(JSON);
 let evidence=execute_private_w1_v2_research(fixture.request()).unwrap();
 assert!(evidence.mandatory_readset_pass);
 assert!(evidence.atomic_diff_pass);
 assert!(evidence.original_first_backup_reopened);
 assert!(evidence.edited_file_reopened);
 assert_eq!(evidence.revision_after_stage,1);
 assert_eq!(evidence.revision_after_undo_redo,3);
 assert!(!evidence.independent_process_reopen);
 assert!(!evidence.native_v3_verified);
 assert!(!evidence.product_writer_authorized);
 assert_eq!(fs::read(&fixture.original).unwrap(),fixture.ciphertext);
 assert_eq!(fs::read(&fixture.backup).unwrap(),fixture.ciphertext);
 #[cfg(unix)] {
  use std::os::unix::fs::PermissionsExt;
  assert_eq!(fs::metadata(&fixture.backup).unwrap().permissions().mode() & 0o077,0);
  assert_eq!(fs::metadata(&fixture.edited).unwrap().permissions().mode() & 0o077,0);
 }
 let reopened=decode_p1g_research(&fs::read(&fixture.edited).unwrap(),&KEY,128*1024*1024).unwrap();
 let edited_json=String::from_utf8(reopened.json).unwrap();
 assert_eq!(edited_json,JSON.replacen(ORIGINAL_UTC,NEW_UTC,1));
 assert!(edited_json.contains(r#""float":1.00"#));
 assert_eq!(evidence.edited_decoded_sha,sha256(edited_json.as_bytes()));
 // A second call cannot overwrite existing outputs: replay denied.
 assert_eq!(execute_private_w1_v2_research(fixture.request()).unwrap_err(),
  "OFFLINE_OUTPUT_ALREADY_EXISTS");
}
#[test]
fn invalid_identity_revision_sha_and_source_alias_fail_before_backup(){
 for mode in 0..5{
  let fixture=Fixture::new(JSON);
  let mut request=fixture.request();
  let code=match mode{
   0=>{request.expected_revision=1;"OFFLINE_STALE_REVISION"},
   1=>{request.bid="0000000000000000";"OFFLINE_EXTERNAL_BUILD_DENIED"},
   2=>{request.decoded_sha=[0;32];"OFFLINE_DECODED_SHA_CAS_FAILED"},
   3=>{request.source_sha=[0;32];"OFFLINE_SOURCE_SHA_CAS_FAILED"},
   _=>{request.edited_path=&fixture.original;"OFFLINE_SOURCE_REPLACEMENT_FORBIDDEN"}
  };
  assert_eq!(execute_private_w1_v2_research(request).unwrap_err(),code);
  assert!(!fixture.backup.exists());
  assert_eq!(fs::read(&fixture.original).unwrap(),fixture.ciphertext);
 }
}
#[test]
fn missing_core_native_ref_or_old_value_cas_does_not_create_backup(){
 let bad=JSON.replace(r#","EndDate":"2030-12-31T00:00:00Z""#,"");
 let fixture=Fixture::new(&bad);
 let error=execute_private_w1_v2_research(fixture.request()).unwrap_err();
 assert!(matches!(error,"W1_CORE_MANDATORY_SOURCE_READSET_INCOMPLETE"|
   "W1_REQUIRED_SOURCE_REFERENCE_MISSING"));
 assert!(!fixture.backup.exists());
 let fixture=Fixture::new(JSON);
 let mut request=fixture.request();
 request.old_utc="2126-08-21T00:00:00Z";
 assert_eq!(execute_private_w1_v2_research(request).unwrap_err(),
  "W1_RAW_OLD_VALUE_CAS_FAILED");
 assert!(!fixture.backup.exists());
}
