//! SOURCE/SYNTHETIC ONLY. No real decrypted Save, Key or encrypted P1G in CI.
use ddv_save_core::sha256;
use ddv_save_core::indexed_w1_read::W1LazySource;
use ddv_save_core::index_direct_children_with_sparse_witness;
const BID:&str="9A239D3DB569756D";
const JSON:&str=r#"{"GameInfo":{"Version":626},"Player":{},"World":{"RecurringEvents":{"155":{"ItemSpawning":{"RecurringEventItemID":2010000021,"NextOccurrence":"2126-08-20T00:00:00Z","LastOccurrence":"2026-10-01T00:00:00Z","EndDate":null}}},"GridCollection":{"Grids":{},"DiffGrids":{}},"Villages":[]},"Unknown":{"opaque":{"float":1.00,"keep":true}}}"#;
fn open(s:&str)->W1LazySource{
 W1LazySource::open_decoded_research(
   s.as_bytes().to_vec(),sha256(s.as_bytes()),"switch","1.25.3",BID,626
 ).unwrap()
}
#[test]
fn one_full_validation_lazy_index_binds_utc_and_source_without_native_authority(){
 let mut big=JSON.to_owned();
 // A large unknown source string is never copied into a selected Event page.
 let huge="a".repeat(5*1024*1024);
 big=big.replace(r#""keep":true"#,&format!(r#""keep":"{huge}""#));
 let src_sha=sha256(big.as_bytes());
 let source=open(&big);
 let lease=source.lease();
 assert_eq!(source.indexed_event_count(),1);
 assert_eq!(source.stored_source_bytes(),big.len());
 assert_eq!(lease.decoded_source_sha256,src_sha);
 assert_eq!(lease.source_revision,0);
 assert_eq!(lease.index_generation,1);
 let event=source.read_supported_w1(&lease,155,2010000021).unwrap();
 assert_eq!(event.next_occurrence_utc,"2126-08-20T00:00:00Z");
 assert!(event.end_date_is_null);
 assert_eq!(event.event_id,2010000021);
 assert_eq!(event.source_sha256,src_sha);
 assert!(!event.native_v3_verified);
 assert!(!event.product_writer_authorized);
 assert_eq!(source.export_edited_copy().err(),Some("PRODUCT_W1_LAZY_EDITED_COPY_NOT_AUTHORIZED"));
 assert!(source.original_unchanged(src_sha).is_ok());
 assert_eq!(source.original_unchanged([0;32]),Err("W1_LAZY_SOURCE_MUTATED"));
}
#[test]
fn wrong_source_session_revision_generation_bids_and_unmodelled_event_fail(){
 let source=open(JSON);
 let mut lease=source.lease();
 lease.source_revision=1;
 assert_eq!(source.read_supported_w1(&lease,155,2010000021).err(),
   Some("W1_LAZY_STALE_OR_FORGED_SCOPE"));
 lease=source.lease();lease.index_generation=2;
 assert_eq!(source.read_supported_w1(&lease,155,2010000021).err(),
   Some("W1_LAZY_STALE_OR_FORGED_SCOPE"));
 lease=source.lease();lease.session_id^=13;
 assert_eq!(source.read_supported_w1(&lease,155,2010000021).err(),
   Some("W1_LAZY_STALE_OR_FORGED_SCOPE"));
 let lease=source.lease();
 assert_eq!(source.read_supported_w1(&lease,155,2010000022).err(),
   Some("W1_LAZY_NATIVE_OPERATION_NOT_MODELLED"));
 assert_eq!(source.read_supported_w1(&lease,156,2010000021).err(),
   Some("W1_LAZY_NATIVE_OPERATION_NOT_MODELLED"));
 assert_eq!(W1LazySource::open_decoded_research(
    JSON.as_bytes().to_vec(),sha256(JSON.as_bytes()),
    "switch","1.25.3","0000000000000000",626).err(),
   Some("W1_LAZY_BUILD_IDENTITY_UNSUPPORTED"));
 assert_eq!(W1LazySource::open_decoded_research(
    JSON.as_bytes().to_vec(),[0;32],"switch","1.25.3",BID,626).err(),
   Some("W1_LAZY_SOURCE_SHA_MISMATCH"));
}
#[test]
fn source_schema_alias_and_nullable_enddate_types_are_exact(){
 let altered=JSON.replace(r#""Version":626"#,r#""Version":625"#);
 assert_eq!(W1LazySource::open_decoded_research(altered.as_bytes().to_vec(),
    sha256(altered.as_bytes()),"switch","1.25.3",BID,626).err(),
   Some("W1_LAZY_GAME_SCHEMA_MISMATCH"));
 let alias=JSON.replace(r#""155":{"ItemSpawning""#,r#""0155":{"ItemSpawning""#);
 assert_eq!(W1LazySource::open_decoded_research(alias.as_bytes().to_vec(),
    sha256(alias.as_bytes()),"switch","1.25.3",BID,626).err(),
   Some("W1_LAZY_SAVED_KEY_NONCANONICAL"));
 let bool_date=JSON.replace(r#""EndDate":null"#,r#""EndDate":false"#);
 let src=open(&bool_date);
 assert_eq!(src.read_supported_w1(&src.lease(),155,2010000021).err(),
   Some("W1_LAZY_ENDDATE_INVALID"));
 let absent=JSON.replace(r#","EndDate":null"#,"");
 let src=open(&absent);
 assert_eq!(src.read_supported_w1(&src.lease(),155,2010000021).err(),
   Some("W1_LAZY_ENDDATE_MISSING"));
 let new_val=JSON.replace(r#""EndDate":null"#,r#""EndDate":"2030-12-31T00:00:00Z""#);
 let src=open(&new_val);
 assert!(!src.read_supported_w1(&src.lease(),155,2010000021).unwrap().end_date_is_null);
}
#[test]
fn strict_scan_does_not_silently_accept_missing_selected_schema_or_duplicate_keys(){
 let missing=br#"{"World":{"RecurringEvents":{"155":{"ItemSpawning":{}}}}}"#;
 assert_eq!(index_direct_children_with_sparse_witness(
   missing,"/World/RecurringEvents",&["/GameInfo/Version".to_owned()],32).err(),
   Some("DIRECT_INDEX_MANDATORY_WITNESS_MISSING"));
 let invalid=JSON.replace(r#""Version":626"#,r#""Version":626,"Version":626"#);
 assert_eq!(index_direct_children_with_sparse_witness(
   invalid.as_bytes(),"/World/RecurringEvents",
   &["/GameInfo/Version".to_owned()],32).err(),Some("JSON_DUPLICATE_KEY"));
 let wrong_root=JSON.replace(r#""RecurringEvents":{"155""#,r#""RecurringEvents":[{"155""#);
 assert!(index_direct_children_with_sparse_witness(
   wrong_root.as_bytes(),"/World/RecurringEvents",
   &["/GameInfo/Version".to_owned()],32).is_err());
}
