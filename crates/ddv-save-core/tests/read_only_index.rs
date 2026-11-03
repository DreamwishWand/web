//! W-CORE-004 bounded SYNTHETIC W1 read-source tests, no user save data.
use ddv_save_core::{sha256,read_only_index::{W1ReadIndex,ReadRequest}};
const BID:&str="9A239D3DB569756D";
fn source()->Vec<u8>{
 br#"{"GameInfo":{"Version":626},"Player":{},"World":{"RecurringEvents":[{"ItemSpawning":{"RecurringEventItemID":2010000021,"NextOccurrence":"2126-08-20T00:00:00Z","Opaque":{"keep":"YES"}}},{"FlowerSpawningInVillage":{"RecurringEventItemID":2010500008,"NextOccurrence":"2022-09-06T00:00:00Z"}},{"WildCropsSpawningInVillage":{"RecurringEventItemID":"2010400001","NextOccurrence":"2025-01-01T00:00:00Z"}}]},"Unknown":{"decimal":1.00,"escape":"\u00e9"}}"#.to_vec()
}
fn open(session:u64)->W1ReadIndex{
 let b=source();let h=sha256(&b);
 W1ReadIndex::open_decoded_research(session,b,h,BID,[0x42;32]).unwrap()
}
fn request<'a>(id:u64,h:[u8;32],cursor:Option<&'a str>,limit:usize)->ReadRequest<'a>{
 ReadRequest{expected_session_id:id,expected_revision:0,
  expected_index_generation:0,expected_decoded_sha256:h,cursor,limit}
}
#[test]
fn full_strict_source_scan_and_exact_w1_index_count(){
 let b=source();let h=sha256(&b);
 let mut s=open(81);
 let a=s.query_page(request(81,h,None,2)).unwrap();
 assert_eq!(a.total_w1_rows,3);
 assert_eq!(a.rows.len(),2);
 assert_eq!(a.rows[0].saved_index,0);
 assert_eq!(a.rows[0].event_id,2010000021);
 assert_eq!(a.rows[0].decoded_timestamp_utc,"2126-08-20T00:00:00Z");
 assert_eq!(a.rows[0].raw_timestamp_json,"\"2126-08-20T00:00:00Z\"");
 assert!(!a.complete);
 assert!(a.next_cursor.is_some());
 assert!(a.w1_source_index_complete);
 assert!(!a.full_domain_reference_closure_complete);
 assert!(!a.product_read_worker_accepted);
 assert!(!a.product_writer_authorized);
 assert!(a.encrypted_p1g_sha256.is_none());
 let bpage=s.query_page(request(81,h,a.next_cursor.as_deref(),2)).unwrap();
 assert_eq!(bpage.rows.len(),1);
 assert_eq!(bpage.rows[0].saved_index,2);
 assert_eq!(bpage.rows[0].event_id,2010400001);
 assert!(bpage.complete);
 assert!(bpage.next_cursor.is_none());
 assert_eq!(s.query_page(request(81,h,None,1)).err(),Some("READ_CURSOR_EXHAUSTED"));
}
#[test]
fn forged_replayed_and_cross_session_cursors_denied_without_partial_advance(){
 let h=sha256(&source());let mut s=open(82);
 assert_eq!(s.query_page(request(82,h,Some("w1r1.fake"),1)).err(),Some("READ_FIRST_CURSOR_NOT_ALLOWED"));
 let first=s.query_page(request(82,h,None,1)).unwrap();
 let cursor=first.next_cursor.unwrap();
 assert_eq!(s.query_page(request(82,h,None,1)).err(),Some("READ_CURSOR_REPLAY_OR_SCOPE_MISMATCH"));
 assert_eq!(s.query_page(request(82,h,Some("forged"),1)).err(),Some("READ_CURSOR_REPLAY_OR_SCOPE_MISMATCH"));
 assert_eq!(s.query_page(request(83,h,Some(&cursor),1)).err(),Some("READ_SESSION_MISMATCH"));
 assert_eq!(s.query_page(request(82,[0;32],Some(&cursor),1)).err(),Some("READ_SOURCE_SHA_STALE"));
 let second=s.query_page(request(82,h,Some(&cursor),1)).unwrap();
 assert_eq!(second.rows[0].saved_index,1);
 assert_eq!(s.query_page(request(82,h,Some(&cursor),1)).err(),Some("READ_CURSOR_REPLAY_OR_SCOPE_MISMATCH"));
 let third=s.query_page(request(82,h,second.next_cursor.as_deref(),1)).unwrap();
 assert_eq!(third.rows[0].saved_index,2);
 assert!(third.complete);
 let mut other=open(83);
 let q=other.query_page(request(83,h,None,1)).unwrap();
 assert_ne!(q.next_cursor,Some(cursor.clone()));
 assert_eq!(other.query_page(request(83,h,Some(&cursor),1)).err(),Some("READ_CURSOR_REPLAY_OR_SCOPE_MISMATCH"));
}
#[test]
fn stale_revision_generation_and_invalid_limit_do_not_consume_cursor(){
 let h=sha256(&source());let mut s=open(84);
 assert_eq!(s.query_page(ReadRequest{expected_revision:1,..request(84,h,None,1)}).err(),Some("READ_REVISION_STALE"));
 assert_eq!(s.query_page(ReadRequest{expected_index_generation:1,..request(84,h,None,1)}).err(),Some("READ_INDEX_GENERATION_STALE"));
 assert_eq!(s.query_page(request(84,h,None,65)).err(),Some("READ_PAGE_LIMIT"));
 assert_eq!(s.query_page(request(84,h,None,0)).err(),Some("READ_PAGE_LIMIT"));
 let first=s.query_page(request(84,h,None,1)).unwrap();
 s.close();
 assert_eq!(s.query_page(request(84,h,first.next_cursor.as_deref(),1)).err(),Some("READ_SESSION_CLOSED"));
}
#[test]
fn malformed_unrelated_json_is_denied_before_index_is_exposed(){
 let malformed=br#"{"GameInfo":{"Version":626},"Player":{},"World":{"RecurringEvents":[]},"Unknown":{"a":1,"a":2}}"#.to_vec();
 let h=sha256(&malformed);
 assert_eq!(W1ReadIndex::open_decoded_research(85,malformed,h,BID,[0x42;32]).err(),Some("JSON_DUPLICATE_KEY"));
 let malformed=br#"{"GameInfo":{"Version":626},"World":{"RecurringEvents":[]},"unrelated":"\uD800"}"#.to_vec();
 let h=sha256(&malformed);
 assert_eq!(W1ReadIndex::open_decoded_research(85,malformed,h,BID,[0x42;32]).err(),Some("JSON_BAD_SURROGATE"));
}
#[test]
fn source_schema_build_hash_and_cursor_key_fail_closed(){
 let b=source();let h=sha256(&b);
 assert_eq!(W1ReadIndex::open_decoded_research(85,b.clone(),[0;32],BID,[0x42;32]).err(),Some("READ_DECODED_SOURCE_SHA_CAS_FAILED"));
 assert_eq!(W1ReadIndex::open_decoded_research(85,b.clone(),h,"UNKNOWN",[0x42;32]).err(),Some("READ_EXTERNAL_BID_UNSUPPORTED"));
 assert_eq!(W1ReadIndex::open_decoded_research(85,b.clone(),h,BID,[0;32]).err(),Some("READ_CURSOR_SECRET_REQUIRED"));
 assert_eq!(W1ReadIndex::open_decoded_research(0,b.clone(),h,BID,[0x42;32]).err(),Some("READ_SESSION_ID_REQUIRED"));
 let altered=String::from_utf8(b).unwrap().replace("\"Version\":626","\"Version\":624").into_bytes();
 let h=sha256(&altered);
 assert_eq!(W1ReadIndex::open_decoded_research(85,altered,h,BID,[0x42;32]).err(),Some("READ_SCHEMA_UNSUPPORTED"));
}
#[test]
fn unknown_variant_or_invalid_oneof_has_no_partial_index(){
 for row in [
  r#"{"UnknownNewVariant":{"RecurringEventItemID":4,"NextOccurrence":"2025-01-01T00:00:00Z"}}"#,
  r#"{"ItemSpawning":{"RecurringEventItemID":4,"NextOccurrence":"2025-01-01T00:00:00Z"},"FishSpawningInVillage":{"RecurringEventItemID":9,"NextOccurrence":"2025-01-01T00:00:00Z"}}"#,
  r#"{"ItemSpawning":{"RecurringEventItemID":0,"NextOccurrence":"2025-01-01T00:00:00Z"}}"#,
 ] {
  let b=format!(r#"{{"GameInfo":{{"Version":626}},"World":{{"RecurringEvents":[{}]}}}}"#,row).into_bytes();
  let h=sha256(&b);
  assert!(W1ReadIndex::open_decoded_research(86,b,h,BID,[0x42;32]).is_err());
 }
}
#[test]
fn bounded_subtree_and_empty_index_are_core_owned(){
 let payload="x".repeat(2*1024*1024);
 let b=format!(r#"{{"GameInfo":{{"Version":626}},"World":{{"RecurringEvents":[{{"ItemSpawning":{{"RecurringEventItemID":4,"NextOccurrence":"2025-01-01T00:00:00Z","opaque":"{}"}}}}]}}}}"#,payload).into_bytes();
 let h=sha256(&b);
 assert_eq!(W1ReadIndex::open_decoded_research(87,b,h,BID,[0x42;32]).err(),Some("READ_W1_SUBTREE_TOO_LARGE"));
 let b=br#"{"GameInfo":{"Version":626},"World":{"RecurringEvents":[]},"opaque":{"keep":true}}"#.to_vec();
 let h=sha256(&b);let mut s=W1ReadIndex::open_decoded_research(88,b,h,BID,[0x42;32]).unwrap();
 let page=s.query_page(request(88,h,None,1)).unwrap();
 assert!(page.complete);assert_eq!(page.total_w1_rows,0);assert!(page.rows.is_empty());
}

#[test]
fn synthetic_p1g_source_and_decoded_sha_are_separate_fail_closed_gates(){
 use ddv_save_core::p1g::encode_synthetic_fixture;
 let json=source();
 let json_hash=sha256(&json);
 let key=[0x42_u8;32];
 for method in [0_u16,8_u16] {
  let ciphertext=encode_synthetic_fixture(&json,&key,method).unwrap();
  let cipher_hash=sha256(&ciphertext);
  let mut s=W1ReadIndex::open_p1g_research(
   93,&ciphertext,&key,cipher_hash,json_hash,BID,[0x43;32]
  ).unwrap();
  let p=s.query_page(request(93,json_hash,None,1)).unwrap();
  assert_eq!(p.encrypted_p1g_sha256,Some(cipher_hash));
  assert_eq!(p.decoded_json_sha256,json_hash);
  assert!(!p.product_read_worker_accepted && !p.product_writer_authorized);
  assert_eq!(W1ReadIndex::open_p1g_research(
    93,&ciphertext,&key,[0;32],json_hash,BID,[0x43;32]
   ).err(),Some("READ_ENCRYPTED_SOURCE_SHA_CAS_FAILED"));
  assert_eq!(W1ReadIndex::open_p1g_research(
    93,&ciphertext,&key,cipher_hash,[0;32],BID,[0x43;32]
   ).err(),Some("READ_P1G_DECODED_SHA_CAS_FAILED"));
  assert!(W1ReadIndex::open_p1g_research(
    93,&ciphertext,&[0;32],cipher_hash,json_hash,BID,[0x43;32]
   ).is_err());
  assert_eq!(W1ReadIndex::open_p1g_research(
    93,&ciphertext,&key,cipher_hash,json_hash,"UNVERIFIED",[0x43;32]
   ).err(),Some("READ_EXTERNAL_BID_UNSUPPORTED"));
 }
}
