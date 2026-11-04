//! 05 QR independent NEW-ONLY PR368 source-fixed synthetic validation.
/// NO genuine P1G. This tests Preview CAS/exact-diff source semantics;
/// the existing QA343 real P1G codec-six mechanics and QA358 Rust READ
/// remain accepted ancestors and are NOT rerun here.
use ddv_save_core::{sha256,index_selected_tokens,validate_json,TokenChange};
use ddv_save_core::p1g::{encode_synthetic_fixture,create_p1g_copy_research,decode_p1g_research};
use ddv_save_core::trusted_read::{TrustedReadCore,W1CommandIntent,SourceReadCondition,READ_ONLY};
use ddv_save_core::w1_evidence::W1Kind;
const BID:&str="9A239D3DB569756D";
const KEY:[u8;32]=[0x71;32];
const REG:&[u8]=b"05-qr-368-independent-synthetic-registry-W1-only";
const OLD:&str="2126-08-20T00:00:00Z";
const NEW:&str="2028-02-29T13:45:59Z";
const PTR:&str="/World/RecurringEvents/155/ItemSpawning/NextOccurrence";
const IDPTR:&str="/World/RecurringEvents/155/ItemSpawning/RecurringEventItemID";
const DOC:&str=r#"{"Sentinel":"2126-08-20T00:00:00Z","GameInfo":{"Version":626},"Player":{"unk":{"float":1.00,"quoted":"\u00e9","List":[2,3,4]}},"World":{"RecurringEvents":{"155":{"ItemSpawning":{"RecurringEventItemID":2010000021,"NextOccurrence":"2126-08-20T00:00:00Z","LastOccurrence":"2026-09-01T00:00:00Z","EndDate":null,"UnknownNative":{"leave":true}}},"157":{"FutureUnknown":{"Opaque":"2126-08-20T00:00:00Z"}}},"Other":{"retain":true}}}"#;
fn fixture(doc:&str)->(Vec<u8>,TrustedReadCore){
 let p=encode_synthetic_fixture(doc.as_bytes(),&KEY,8).unwrap();
 let core=TrustedReadCore::open_p1g_readonly(p.clone(),&KEY,sha256(&p),sha256(doc.as_bytes()),
  REG,sha256(REG),BID,626,128*1024*1024).unwrap();
 (p,core)
}
fn q<'a>(s:&'a str,source:[u8;32],decoded:[u8;32],registry:[u8;32],
 old_raw:&'a str,old_utc:&'a str,new:&'a str)->W1CommandIntent<'a>{
 W1CommandIntent{
  session_id:s,expected_revision:0,expected_generation:0,
  expected_encrypted_sha256:source,expected_decoded_sha256:decoded,
  expected_registry_sha256:registry,expected_external_bid:BID,schema:626,
  event_id:2010000021,saved_index:155,oneof:W1Kind::ItemSpawning,
  pointer:PTR,expected_old_raw_json:old_raw,expected_old_utc:old_utc,proposed_utc:new,
  source_read_set:vec![SourceReadCondition{
   pointer:IDPTR.to_owned(),expected_raw_token_sha256:sha256(b"2010000021")
  }]
 }
}
#[test]
fn independent_exact_pointer_preserves_other_identical_time_and_lexical_unknowns(){
 let (orig,core)=fixture(DOC);
 let m=core.receipt().unwrap();
 let witness=q(&m.session_id,sha256(&orig),sha256(DOC.as_bytes()),sha256(REG),
   "\"2126-08-20T00:00:00Z\"",OLD,NEW);
 let preview=core.preview_w1_exact_diff(witness).unwrap();
 assert_eq!(preview.exact_changed_pointers,vec![PTR.to_owned()]);
 assert_eq!(preview.source_revision,0);
 assert_eq!(preview.proposed_revision,1);
 assert_eq!(preview.source_cipher_sha256,sha256(&orig));
 assert_eq!(preview.registry_sha256,sha256(REG));
 assert!(preview.source_and_reference_cas_matched);
 assert!(!preview.full_operation_reference_closure_verified);
 assert!(!preview.original_first_backup_written);
 assert!(!preview.atomic_changeset_committed);
 assert!(!preview.encode_copy_authorized);
 assert!(!preview.persistent_replace_authorized);
 let from=br#""NextOccurrence":"2126-08-20T00:00:00Z""#;
 let to=br#""NextOccurrence":"2028-02-29T13:45:59Z""#;
 let found=DOC.as_bytes().windows(from.len()).position(|w|w==from).unwrap();
 let mut expected=Vec::new();
 expected.extend_from_slice(&DOC.as_bytes()[..found]);
 expected.extend_from_slice(to);
 expected.extend_from_slice(&DOC.as_bytes()[found+from.len()..]);
 assert_eq!(validate_json(&expected).unwrap(),());
 assert_eq!(preview.proposed_decoded_sha256,sha256(&expected));
 assert!(expected.starts_with(b"{\"Sentinel\":\"2126-08-20T00:00:00Z\""));
 assert!(std::str::from_utf8(&expected).unwrap().contains(r#""float":1.00,"quoted":"\u00e9""#));
 // A second preview against the immutable ORIGINAL may still CAS the old
 // token: no committed Revision/Atomic ChangeSet has occurred.
 let again=q(&m.session_id,sha256(&orig),sha256(DOC.as_bytes()),sha256(REG),
  "\"2126-08-20T00:00:00Z\"",OLD,"2027-01-01T00:00:00Z");
 assert_eq!(core.preview_w1_exact_diff(again).unwrap().source_revision,0);
 assert_eq!(core.receipt().unwrap().revision,0);
 core.original_unchanged().unwrap();
 assert_eq!(core.export_p1g_copy().unwrap_err(),"PRODUCT_ENCODE_COPY_NOT_AUTHORIZED");
 assert_eq!(m.capabilities,READ_ONLY);
}
#[test]
fn synthetic_research_copy_is_independent_reopened_not_product_export(){
 let (orig,core)=fixture(DOC);
 let receipt=core.receipt().unwrap();
 let p=core.preview_w1_exact_diff(q(&receipt.session_id,sha256(&orig),sha256(DOC.as_bytes()),
  sha256(REG),"\"2126-08-20T00:00:00Z\"",OLD,NEW)).unwrap();
 let copy=create_p1g_copy_research(&orig,sha256(&orig),&KEY,626,
  &[TokenChange{pointer:PTR.to_owned(),expected_old_string:OLD.to_owned(),
    replacement_string:NEW.to_owned()}],128*1024*1024).unwrap();
 assert!(!copy.product_encode_copy_authorized);
 assert!(!copy.persistent_replace_authorized);
 assert_eq!(copy.verified_changed_pointers,[PTR]);
 assert_eq!(p.proposed_decoded_sha256,copy.decoded_after_sha256);
 assert_ne!(sha256(&orig),sha256(&copy.edited_ciphertext));
 let reopened=decode_p1g_research(&copy.edited_ciphertext,&KEY,128*1024*1024).unwrap();
 assert_eq!(sha256(&reopened.json),p.proposed_decoded_sha256);
 let paths=[PTR.to_owned(),"/Sentinel".to_owned(),
  "/Player/unk/quoted".to_owned(),"/World/RecurringEvents/155/ItemSpawning/LastOccurrence".to_owned()];
 let hit=index_selected_tokens(&reopened.json,&paths).unwrap();
 assert_eq!(hit.iter().find(|t|t.pointer==PTR).unwrap().value,format!("\"{NEW}\""));
 assert_eq!(hit.iter().find(|t|t.pointer=="/Sentinel").unwrap().value,format!("\"{OLD}\""));
 assert_eq!(hit.iter().find(|t|t.pointer=="/Player/unk/quoted").unwrap().value,r#""\u00e9""#);
 assert_eq!(hit.iter().find(|t|t.pointer.ends_with("/LastOccurrence")).unwrap().value,
  "\"2026-09-01T00:00:00Z\"");
 core.original_unchanged().unwrap();
 assert_eq!(sha256(&orig),receipt.roots.encrypted_source_sha256);
}
#[test]
fn independent_cas_negatives_are_rejected_before_any_output(){
 let (orig,core)=fixture(DOC);let m=core.receipt().unwrap();
 let make=||q(&m.session_id,sha256(&orig),sha256(DOC.as_bytes()),sha256(REG),
  "\"2126-08-20T00:00:00Z\"",OLD,NEW);
 let mut wrong=make();wrong.expected_encrypted_sha256=[0;32];
 assert_eq!(core.preview_w1_exact_diff(wrong).unwrap_err(),"W1_SOURCE_CAS_FAILED");
 let mut wrong=make();wrong.expected_decoded_sha256=[0;32];
 assert_eq!(core.preview_w1_exact_diff(wrong).unwrap_err(),"W1_SOURCE_CAS_FAILED");
 let mut wrong=make();wrong.expected_registry_sha256=[0;32];
 assert_eq!(core.preview_w1_exact_diff(wrong).unwrap_err(),"W1_REGISTRY_CAS_FAILED");
 let mut wrong=make();wrong.expected_revision=1;
 assert_eq!(core.preview_w1_exact_diff(wrong).unwrap_err(),"READ_STALE_REVISION");
 let mut wrong=make();wrong.expected_generation=1;
 assert_eq!(core.preview_w1_exact_diff(wrong).unwrap_err(),"READ_STALE_GENERATION");
 let mut wrong=make();wrong.session_id="UI-chosen-replayed-session";
 assert_eq!(core.preview_w1_exact_diff(wrong).unwrap_err(),"READ_SESSION_MISMATCH");
 let mut wrong=make();wrong.event_id=2010500008;
 assert_eq!(core.preview_w1_exact_diff(wrong).unwrap_err(),"W1_EVENT_ID_CAS_FAILED");
 let mut wrong=make();wrong.saved_index=157;
 assert_eq!(core.preview_w1_exact_diff(wrong).unwrap_err(),"W1_INTENT_POINTER_MISMATCH");
 let mut wrong=make();wrong.expected_old_raw_json="\"2126-08-20T00:00:00\\u005a\"";
 assert_eq!(core.preview_w1_exact_diff(wrong).unwrap_err(),"W1_RAW_OLD_VALUE_CAS_FAILED");
 let mut wrong=make();wrong.expected_old_utc="2025-01-01T00:00:00Z";
 assert_eq!(core.preview_w1_exact_diff(wrong).unwrap_err(),"W1_OLD_UTC_CAS_FAILED");
 let mut wrong=make();wrong.expected_external_bid="0000000000000000";
 assert_eq!(core.preview_w1_exact_diff(wrong).unwrap_err(),"W1_BUILD_CAS_FAILED");
 let mut wrong=make();wrong.schema=624;
 assert_eq!(core.preview_w1_exact_diff(wrong).unwrap_err(),"W1_BUILD_CAS_FAILED");
 let mut wrong=make();wrong.source_read_set[0].expected_raw_token_sha256=[0;32];
 assert_eq!(core.preview_w1_exact_diff(wrong).unwrap_err(),"W1_READ_SET_CAS_FAILED");
 let mut wrong=make();wrong.source_read_set[0].pointer="/Player/unk/not-present".to_owned();
 assert_eq!(core.preview_w1_exact_diff(wrong).unwrap_err(),"W1_REQUIRED_SOURCE_REFERENCE_MISSING");
 let mut wrong=make();wrong.source_read_set.push(wrong.source_read_set[0].clone());
 assert_eq!(core.preview_w1_exact_diff(wrong).unwrap_err(),"W1_READ_SET_POINTER_INVALID");
 core.original_unchanged().unwrap();
}
#[test]
fn independent_calendar_noop_and_source_version_fences(){
 let (orig,core)=fixture(DOC);let m=core.receipt().unwrap();
 for next in [OLD,"2026-02-29T00:00:00Z","2026-13-01T00:00:00Z",
    "2026-11-31T00:00:00Z","2026-11-04T24:00:00Z",
    "2026-11-04T00:60:00Z","2026-11-04T00:00:60Z","2026-11-04"]{
  let request=q(&m.session_id,sha256(&orig),sha256(DOC.as_bytes()),sha256(REG),
   "\"2126-08-20T00:00:00Z\"",OLD,next);
  assert!(core.preview_w1_exact_diff(request).is_err(),"unexpected accept: {next}");
 }
 let wrong_schema=DOC.replace("\"Version\":626","\"Version\":624");
 let cipher=encode_synthetic_fixture(wrong_schema.as_bytes(),&KEY,8).unwrap();
 assert!(TrustedReadCore::open_p1g_readonly(cipher.clone(),&KEY,sha256(&cipher),
  sha256(wrong_schema.as_bytes()),REG,sha256(REG),BID,626,128*1024*1024).is_err());
 let bad=DOC.replace("\"Version\":626","\"Version\":626,\"Version\":626");
 // The synthetic generator deliberately refuses duplicate-key malformed inputs.
 assert_eq!(validate_json(bad.as_bytes()).unwrap_err(),"JSON_DUPLICATE_KEY");
}
