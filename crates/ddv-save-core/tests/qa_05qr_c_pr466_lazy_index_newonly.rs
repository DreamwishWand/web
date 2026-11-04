//! 05 QR-C independent changed-only tests of PR466 source-bound Rust lazy W1.
 //! All Save-shaped JSON is generated synthetic, no real profile or game key.
use ddv_save_core::{sha256,index_direct_children_with_sparse_witness};
use ddv_save_core::indexed_w1_read::{W1LazySource,W1LazyLease};

const BID:&str="9A239D3DB569756D";
const BASE:&str=r#"{"GameInfo":{"Version":626},"Player":{},"World":{"RecurringEvents":{"155":{"ItemSpawning":{"RecurringEventItemID":2010000021,"NextOccurrence":"2126-08-20T00:00:00Z","LastOccurrence":"2026-11-01T00:00:00Z","EndDate":null}}},"GridCollection":{"Grids":{},"DiffGrids":{}},"Villages":[]},"Unknown":{"marker":"x","float":1.00}}"#;
const RAW_EVENT:&str=r#"{"ItemSpawning":{"RecurringEventItemID":2010000021,"NextOccurrence":"2126-08-20T00:00:00Z","LastOccurrence":"2026-11-01T00:00:00Z","EndDate":null}}"#;
fn open(s:&str)->W1LazySource{
 W1LazySource::open_decoded_research(s.as_bytes().to_vec(),sha256(s.as_bytes()),
  "switch","1.25.3",BID,626).expect("synthetic 626 source")
}
fn assert_read_gate(source:&W1LazySource,lease:&W1LazyLease){
 let row=source.read_supported_w1(lease,155,2010000021).unwrap();
 assert_eq!(row.next_occurrence_utc,"2126-08-20T00:00:00Z");
 assert!(row.end_date_is_null);
 assert_eq!(row.lexical_event_sha256,sha256(RAW_EVENT.as_bytes()));
 assert_eq!(row.source_sha256,lease.decoded_source_sha256);
 assert_eq!(row.index_generation,1);
 assert_eq!(row.revision,0);
 assert!(!row.native_v3_verified);
 assert!(!row.product_writer_authorized);
 assert_eq!(source.export_edited_copy().err(),
  Some("PRODUCT_W1_LAZY_EDITED_COPY_NOT_AUTHORIZED"));
}

#[test]
fn single_strict_full_scan_combines_version_sparse_sha_and_raw_child_span_without_raw_object_clone(){
 let watched=["/GameInfo/Version".to_owned()];
 let (index,hashes)=index_direct_children_with_sparse_witness(
   BASE.as_bytes(),"/World/RecurringEvents",&watched,32).unwrap();
 assert!(index.complete_from_strict_full_scan);
 assert_eq!(index.items.len(),1);
 assert_eq!(index.items[0].key,"155");
 assert_eq!(hashes.len(),1);
 assert_eq!(hashes[0].raw_sha256,sha256(b"626"));
 assert_eq!(hashes[0].raw_bytes,3);
 assert_eq!(hashes[0].lexical_kind,"number");
 let span=&index.items[0].span;
 assert_eq!(&BASE.as_bytes()[span.clone()],RAW_EVENT.as_bytes());
 let c=BASE.replace(r#""marker":"x""#,r#""marker":"unrelated""#);
 let (other,_)=index_direct_children_with_sparse_witness(
  c.as_bytes(),"/World/RecurringEvents",&watched,32).unwrap();
 assert_eq!(&c.as_bytes()[other.items[0].span.clone()],RAW_EVENT.as_bytes());
}

#[test]
fn two_source_leases_cannot_cross_even_when_event_token_identical_and_unknown_megabytes_present(){
 let huge="漢".repeat(390_000); // >1 MiB UTF8 unrelated source, not copied to W1 DTO.
 let doc=BASE.replace(r#""marker":"x""#,&format!(r#""marker":"{huge}""#));
 let a=open(BASE);
 let b=open(&doc);
 let al=a.lease();let bl=b.lease();
 assert_eq!(a.indexed_event_count(),1);
 assert_eq!(b.indexed_event_count(),1);
 assert_eq!(b.stored_source_bytes(),doc.len());
 assert_ne!(al.decoded_source_sha256,bl.decoded_source_sha256);
 assert_read_gate(&a,&al);
 assert_read_gate(&b,&bl);
 assert_eq!(a.read_supported_w1(&bl,155,2010000021).err(),
  Some("W1_LAZY_STALE_OR_FORGED_SCOPE"));
 assert_eq!(b.read_supported_w1(&al,155,2010000021).err(),
  Some("W1_LAZY_STALE_OR_FORGED_SCOPE"));
 assert_eq!(b.original_unchanged(sha256(doc.as_bytes())),Ok(()));
 assert_eq!(b.original_unchanged(sha256(BASE.as_bytes())),
   Err("W1_LAZY_SOURCE_MUTATED"));
}

#[test]
fn oversized_w1_event_is_bounded_at_lazy_read_even_when_complete_strict_doc_scans(){
 let payload="Q".repeat(2*1024*1024+37);
 let doc=BASE.replace(r#""EndDate":null"#,
   &format!(r#""EndDate":null,"HugeEventField":"{payload}""#));
 let source=open(&doc);
 assert_eq!(source.indexed_event_count(),1);
 assert_eq!(source.stored_source_bytes(),doc.len());
 assert_eq!(source.read_supported_w1(&source.lease(),155,2010000021).err(),
   Some("W1_LAZY_EVENT_UNBOUNDED"));
 assert_eq!(source.original_unchanged(sha256(doc.as_bytes())),Ok(()));
 assert_eq!(source.export_edited_copy().err(),
  Some("PRODUCT_W1_LAZY_EDITED_COPY_NOT_AUTHORIZED"));
}

#[test]
fn changed_event_identity_oneof_or_last_occurrence_denied_without_mutation(){
 let id=BASE.replace(r#""RecurringEventItemID":2010000021"#,
   r#""RecurringEventItemID":2010000022"#);
 let row=open(&id);
 assert_eq!(row.read_supported_w1(&row.lease(),155,2010000021).err(),
  Some("W1_LAZY_EVENT_ID_CAS_FAILED"));
 let last=BASE.replace(r#""LastOccurrence":"2026-11-01T00:00:00Z""#,
   r#""LastOccurrence":null"#);
 let row=open(&last);
 assert_eq!(row.read_supported_w1(&row.lease(),155,2010000021).err(),
  Some("W1_LAZY_LAST_UTC_INVALID"));
 let extras=BASE.replace(r#""EndDate":null}}"#,
   r#""EndDate":null},"UnexpectedOneof":{}}"#);
 let row=open(&extras);
 assert_eq!(row.read_supported_w1(&row.lease(),155,2010000021).err(),
  Some("W1_LAZY_EVENT_ONEOF_INVALID"));
 let next=BASE.replace(r#""NextOccurrence":"2126-08-20T00:00:00Z""#,
   r#""NextOccurrence":"not-a-time""#);
 let row=open(&next);
 assert_eq!(row.read_supported_w1(&row.lease(),155,2010000021).err(),
  Some("W1_LAZY_NEXT_UTC_INVALID"));
}

#[test]
fn strict_parser_and_witness_budget_never_allow_partial_source_read_or_duplicate_paths(){
 let witnessed=["/GameInfo/Version".to_owned()];
 assert_eq!(index_direct_children_with_sparse_witness(BASE.as_bytes(),
  "/World/RecurringEvents",&witnessed,2).err(),
  Some("DIRECT_INDEX_MANDATORY_WITNESS_UNBOUNDED"));
 assert_eq!(index_direct_children_with_sparse_witness(BASE.as_bytes(),
  "/World/RecurringEvents",&[witnessed[0].clone(),witnessed[0].clone()],32).err(),
  Some("DIRECT_INDEX_WITNESS_POINTER_INVALID"));
 let trailing=format!("{BASE}{{}}");
 assert!(W1LazySource::open_decoded_research(trailing.as_bytes().to_vec(),
  sha256(trailing.as_bytes()),"switch","1.25.3",BID,626).is_err());
 let dup=BASE.replace(r#""marker":"x""#,r#""marker":"x","marker":"x""#);
 assert!(W1LazySource::open_decoded_research(dup.as_bytes().to_vec(),
  sha256(dup.as_bytes()),"switch","1.25.3",BID,626).is_err());
}
