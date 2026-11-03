//! Opt-in forward-looking decoded-JSON 256/512 decimal MB stress probes.
//! NEVER a product P1G memory budget, never a new format size cap.
//! Run: cargo test --manifest-path crates/ddv-save-core/Cargo.toml --test unified_session_stress -- --ignored --test-threads=1
use ddv_save_core::session::{SaveSession,ReferenceIndex,Domain};
use ddv_save_core::{sha256,MAX_DECODED_JSON_BYTES};
fn fixture(bytes:usize)->Vec<u8>{
 let start=br#"{"GameInfo":{"Version":626},"Player":{"ListInventories":{}},"World":{"GridCollection":{}},"Unknown":{"Pad":""#;
 let end=br#""}}"#;
 assert!(bytes>start.len()+end.len());
 let mut v=Vec::with_capacity(bytes);
 v.extend_from_slice(start);
 v.resize(bytes-end.len(),b'Z');
 v.extend_from_slice(end);
 assert_eq!(v.len(),bytes);
 v
}
#[test]
#[ignore = "large allocation; explicit stress run only; no P1G codec"]
fn decoded_256_decimal_mb_full_strict_scan_one_session_and_paged_projection(){
 let bytes=fixture(256_000_000);
 let hash=sha256(&bytes);
 let mut s=SaveSession::open_decoded_research(256,bytes,626,ReferenceIndex::default()).unwrap();
 assert_eq!(s.original_len(),256_000_000);
 assert_eq!(s.source_sha256(),hash);
 // No full UI JSON projection; one bounded identity/token result.
 let small=s.query_paged(&["/GameInfo/Version".to_string()],0,1).unwrap();
 assert_eq!(small.len(),1);
 assert_eq!(small[0].preview_json,"626");
 assert_eq!(s.revision(),0);
 assert_eq!(s.export_verified_copy().unwrap_err(),"PRODUCT_P1G_ENCODE_COPY_NOT_AUTHORIZED");
 // Empty index graph is not a semantic pass and does not permit a writer.
 let read=s.validate_transaction().unwrap();
 assert!(!read.semantic_domain_guards_accepted);
 assert!(!read.encode_copy_authorized);
 let _=Domain::RecurringEvent;
}
#[test]
#[ignore = "512 MB allocation; explicit denial stress only"]
fn decoded_512_decimal_mb_rejects_current_research_parser_limit_without_writer_promotion(){
 let bytes=fixture(512_000_000);
 assert!(bytes.len()>MAX_DECODED_JSON_BYTES);
 let result=SaveSession::open_decoded_research(512,bytes,626,ReferenceIndex::default());
 assert_eq!(result.err(),Some("JSON_TOO_LARGE"));
 // Current research parser's 256MiB guard is not a permanent product format limit.
}
