//! Independent 05 QR-C, PR500 changed-only Rust research QA.
 //! All P1G data and key below are manufactured for this test. Genuine owner
 //! encrypted Save and productive Writer V2/Native V3 are NOT_RUN/OFF.
use ddv_save_core::{sha256,offline_w1_v2::{execute_private_w1_v2_research,PrivateW1V2Input}};
use ddv_save_core::p1g::{encode_synthetic_fixture,decode_p1g_research};
use ddv_save_core::session::{SaveSession,ReferenceIndex};
use std::{fs,path::PathBuf,io::Write};

const KEY:[u8;32]=[0x35;32];
const REGISTRY:&[u8]=b"independent-05qr-c-synthetic-w1-registry";
const OLD:&str="2126-08-20T00:00:00Z";
const NEW:&str="2026-11-05T02:00:00Z";
const BASE:&str=r#"{"GameInfo":{"Version":626},"Player":{},"World":{"RecurringEvents":{"155":{"ItemSpawning":{"RecurringEventItemID":2010000021,"NextOccurrence":"2126-08-20T00:00:00Z","LastOccurrence":"2026-08-20T00:00:00Z","EndDate":null}}},"GridCollection":{"Grids":{"10":{"Objects":{}}},"DiffGrids":{}},"Villages":[{"Areas":{"0":{"GridIDs":[10]}}}]},"Unknown":{"persistentTimestamp":"2126-08-20T00:00:00Z","float":1.00,"payload":"seed"}}"#;
struct Fixture{dir:PathBuf,original:PathBuf,backup:PathBuf,edited:PathBuf,bytes:Vec<u8>,json:String}
impl Fixture{
 fn new(json:&str)->Self{
  let mut rand=[0u8;8];getrandom::getrandom(&mut rand).unwrap();
  let dir=std::env::temp_dir().join(format!("qa-05qr-c-pr500-{}-{}",std::process::id(),u64::from_le_bytes(rand)));
  fs::create_dir(&dir).unwrap();
  let original=dir.join("original.p1g");
  let backup=dir.join("original-backup.p1g");
  let edited=dir.join("edited-copy.p1g");
  let bytes=encode_synthetic_fixture(json.as_bytes(),&KEY,8).unwrap();
  let mut f=fs::OpenOptions::new().write(true).create_new(true).open(&original).unwrap();
  f.write_all(&bytes).unwrap();f.sync_all().unwrap();
  Self{dir,original,backup,edited,bytes,json:json.into()}
 }
 fn request(&self)->PrivateW1V2Input<'_>{
  PrivateW1V2Input{
   source_path:&self.original,backup_path:&self.backup,edited_path:&self.edited,
   key:&KEY,registry:REGISTRY,source_sha:sha256(&self.bytes),
   decoded_sha:sha256(self.json.as_bytes()),registry_sha:sha256(REGISTRY),
   platform:"switch",full_version:"1.25.3",bid:"9A239D3DB569756D",
   schema:626,expected_revision:0,old_utc:OLD,proposed_utc:NEW
  }
 }
}
impl Drop for Fixture{fn drop(&mut self){let _=fs::remove_dir_all(&self.dir);}}

#[test]
fn independent_nullable_enddate_and_large_unrelated_unknown_preserve_byte_exactness_with_shared_arc(){
 // Differs from Owner's 6MiB regression: present null EndDate, separate
 // intentional year2126 outside targeted token, escaped opaque Unicode.
 let large="雪".repeat(420_000); // ~1.26 MiB UTF-8, under 2MiB root limits.
 let json=BASE.replacen(r#""payload":"seed""#,&format!(r#""payload":"{large}""#),1);
 let f=Fixture::new(&json);
 let report=execute_private_w1_v2_research(f.request()).expect("independent synthetic research");
 assert!(report.original_ciphertext_borrowed_from_trusted_core, "trusted encrypted original also shares Arc backing");
 assert!(report.core_and_stage_share_immutable_decoded_source,
   "same immutable backing, not single Product SaveSession");
 assert_eq!(report.original_sha,sha256(&f.bytes));
 assert_eq!(report.backup_sha,sha256(&f.bytes));
 assert_eq!(fs::read(&f.original).unwrap(),f.bytes);
 assert_eq!(fs::read(&f.backup).unwrap(),f.bytes);
 let edited=fs::read(&f.edited).unwrap();
 let reopened=decode_p1g_research(&edited,&KEY,128*1024*1024).unwrap();
 let expected=json.replacen(OLD,NEW,1);
 assert_eq!(reopened.json,expected.as_bytes(),"one raw target diff, no JSON regeneration");
 assert_eq!(sha256(&reopened.json),report.edited_decoded_sha);
 assert_eq!(String::from_utf8(reopened.json).unwrap().matches(OLD).count(),1,
   "intentional 2126 unknown metadata must not be auto repaired");
 assert!(expected.contains(r#""float":1.00"#));
 assert!(expected.contains(&large));
 assert!(!report.native_v3_verified);
 assert!(!report.product_writer_authorized);
 assert!(!report.independent_process_reopen,"research receipt cannot self-attest another process");
}

#[test]
fn checksum_relabelled_corrupted_p1g_still_fails_decode_before_backup_or_edited_copy(){
 let mut f=Fixture::new(BASE);
 // A hostile source replaces encrypted bytes and recalculates only the
 // untrusted external source-hash claim. This must not mint an Arc.
 f.bytes[0]^=0x7f;
 fs::write(&f.original,&f.bytes).unwrap();
 let r=execute_private_w1_v2_research(f.request());
 assert!(r.is_err(),"corrupt encrypted container must never reach shared Arc stage");
 assert!(!f.backup.exists());
 assert!(!f.edited.exists());
 assert_eq!(fs::read(&f.original).unwrap(),f.bytes);
}

#[test]
fn separate_research_operations_never_conflate_arc_receipts_or_original_backup_paths(){
 let f1=Fixture::new(BASE);
 let f2=Fixture::new(&BASE.replace(r#""payload":"seed""#,r#""payload":"different-non-W1-source""#));
 let r1=execute_private_w1_v2_research(f1.request()).unwrap();
 let r2=execute_private_w1_v2_research(f2.request()).unwrap();
 assert!(r1.core_and_stage_share_immutable_decoded_source);
 assert!(r1.original_ciphertext_borrowed_from_trusted_core);
 assert!(r2.core_and_stage_share_immutable_decoded_source);
 assert!(r2.original_ciphertext_borrowed_from_trusted_core);
 assert_ne!(r1.original_sha,r2.original_sha);
 assert_ne!(r1.edited_decoded_sha,r2.edited_decoded_sha);
 assert_eq!(fs::read(&f1.backup).unwrap(),f1.bytes);
 assert_eq!(fs::read(&f2.backup).unwrap(),f2.bytes);
 assert_eq!(fs::read(&f1.original).unwrap(),f1.bytes);
 assert_eq!(fs::read(&f2.original).unwrap(),f2.bytes);
 assert!(!r1.product_writer_authorized&&!r2.product_writer_authorized);
 assert!(!r1.native_v3_verified&&!r2.native_v3_verified);
 assert_eq!(execute_private_w1_v2_research(f1.request()).unwrap_err(),
   "OFFLINE_OUTPUT_ALREADY_EXISTS","same-output replay must deny");
}

#[test]
fn existing_public_vec_research_session_api_unchanged_and_cannot_export_product_copy(){
 let expected=sha256(BASE.as_bytes());
 let s=SaveSession::open_decoded_research(123,BASE.as_bytes().to_vec(),626,
   ReferenceIndex::default()).expect("old Vec research API must remain compatible");
 assert_eq!(s.session_id(),123);
 assert_eq!(s.source_sha256(),expected);
 assert_eq!(s.revision(),0);
 assert_eq!(s.index_generation(),0);
 assert_eq!(s.export_verified_copy().unwrap_err(),
   "PRODUCT_P1G_ENCODE_COPY_NOT_AUTHORIZED");
 assert!(SaveSession::open_decoded_research(0,BASE.as_bytes().to_vec(),626,
   ReferenceIndex::default()).is_err(),"zero SID cannot mint session");
 assert!(SaveSession::open_decoded_research(124,BASE.as_bytes().to_vec(),624,
   ReferenceIndex::default()).is_err(),"schema624 cannot reinterpret schema626 source");
}
