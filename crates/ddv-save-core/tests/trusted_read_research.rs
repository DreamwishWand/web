//! New W-CORE-004 scope: synthetic tests only. No original/private P1G.
use ddv_save_core::{sha256,index_direct_children,DirectIndexKind};
use ddv_save_core::p1g::encode_synthetic_fixture;
use ddv_save_core::trusted_read::{
 TrustedReadCore,PageQuery,W1CommandIntent,READ_ONLY,
};
use ddv_save_core::w1_evidence::W1Kind;
const BID:&str="9A239D3DB569756D";
const OLD:&str="2126-08-20T00:00:00Z";
const NEW:&str="2022-09-06T00:00:00Z";
const REGISTRY:&[u8]=b"trusted-synthetic-registry-test-only-do-not-use-as-real-508";
const JSON:&str=r#"{"GameInfo":{"Version":626},"World":{"RecurringEvents":[{"ItemSpawning":{"RecurringEventItemID":2010000021,"NextOccurrence":"2126-08-20T00:00:00Z"}},{"FlowerSpawningInVillage":{"RecurringEventItemID":2010000022,"NextOccurrence":"2026-11-03T00:00:00Z"}},{"UnknownFutureW2":{"RecurringEventItemID":987654,"ExtraState":{"unknown":{"keep":"exact"}}}}]}}"#;
fn encrypted(src:&str)->Vec<u8>{
 encode_synthetic_fixture(src.as_bytes(),&[4u8;32],8).unwrap()
}
fn open(src:&str)->TrustedReadCore{
 let p1g=encrypted(src);
 TrustedReadCore::open_p1g_readonly(p1g.clone(),&[4u8;32],
   sha256(&p1g),sha256(src.as_bytes()),REGISTRY,sha256(REGISTRY),
   BID,626,16*1024*1024).unwrap()
}
fn query<'a>(session:&'a str,cursor:Option<&'a str>,limit:usize)->PageQuery<'a>{
 PageQuery{session_id:session,revision:0,generation:0,domain:"RecurringEvents",
  sort:"savedIndex",filter:"",limit,cursor}
}
#[test]
fn complete_index_strict_json_and_unknown_rows_preserved(){
 let mut core=open(JSON);
 let meta=core.receipt().unwrap();
 assert_eq!(meta.indexed_count,3);
 assert!(meta.complete_structural_scan);
 assert!(!meta.complete_all_domains);
 assert!(!meta.semantic_reference_closure_verified);
 assert_eq!(meta.roots.decoded_json_sha256,sha256(JSON.as_bytes()));
 assert_ne!(meta.roots.encrypted_source_sha256,meta.roots.decoded_json_sha256);
 assert!(!meta.roots.external_bid_cryptographically_bound);
 assert_eq!(meta.capabilities,READ_ONLY);
 assert!(!meta.capabilities.encode_copy);
 let a=core.query_indexed_page(query(&meta.session_id,None,2)).unwrap();
 assert!(!a.complete);assert_eq!(a.indexed_total,3);
 assert_eq!(a.rows.iter().map(|r|r.saved_index).collect::<Vec<_>>(),vec![0,1]);
 assert_eq!(a.rows[0].event_id,Some(2010000021));
 let cursor=a.next_cursor.clone().unwrap();
 assert!(cursor.len()>=64);
 let b=core.query_indexed_page(query(&meta.session_id,Some(&cursor),2)).unwrap();
 assert!(b.complete);assert!(b.next_cursor.is_none());
 assert_eq!(b.rows.len(),1);
 assert_eq!(b.rows[0].oneof,"UnknownFutureW2");
 assert!(!b.rows[0].semantic_eligibility_verified);
 core.original_unchanged().unwrap();
 assert!(core.export_p1g_copy().is_err());
}
#[test]
fn cursor_replay_and_query_scope_are_denied(){
 let mut core=open(JSON);let m=core.receipt().unwrap();
 let cursor=core.query_indexed_page(query(&m.session_id,None,1))
   .unwrap().next_cursor.unwrap();
 assert_eq!(core.query_indexed_page(query(&m.session_id,Some(&cursor),2)).unwrap_err(),
   "READ_CURSOR_SCOPE_MISMATCH");
 assert_eq!(core.query_indexed_page(query(&m.session_id,Some(&cursor),1)).unwrap_err(),
   "READ_CURSOR_UNKNOWN_OR_REPLAY");
 assert_eq!(core.query_indexed_page(query("forged-session",None,1)).unwrap_err(),
   "READ_SESSION_MISMATCH");
 let mut rev=query(&m.session_id,None,1);rev.revision=1;
 assert_eq!(core.query_indexed_page(rev).unwrap_err(),"READ_STALE_REVISION");
 let mut gen=query(&m.session_id,None,1);gen.generation=1;
 assert_eq!(core.query_indexed_page(gen).unwrap_err(),"READ_STALE_GENERATION");
 let mut filter=query(&m.session_id,None,1);filter.filter="all";
 assert_eq!(core.query_indexed_page(filter).unwrap_err(),"READ_QUERY_NOT_INDEXED");
 let mut big=query(&m.session_id,None,201);
 assert_eq!(core.query_indexed_page(big).unwrap_err(),"READ_PAGE_LIMIT");
 core.close();
 assert_eq!(core.query_indexed_page(query(&m.session_id,None,1)).unwrap_err(),
   "READ_SESSION_CLOSED");
}
#[test]
fn source_registry_build_and_index_spoof_are_denied(){
 let p1g=encrypted(JSON);
 let wrong=|src:Vec<u8>,sha:[u8;32],json_sha:[u8;32],registry_sha:[u8;32],
  bid:&str|TrustedReadCore::open_p1g_readonly(src,&[4u8;32],sha,json_sha,
   REGISTRY,registry_sha,bid,626,16*1024*1024);
 assert_eq!(wrong(p1g.clone(),[0;32],sha256(JSON.as_bytes()),sha256(REGISTRY),BID)
  .err().unwrap(),"READ_SOURCE_SHA_CAS_FAILED");
 assert_eq!(wrong(p1g.clone(),sha256(&p1g),[0;32],sha256(REGISTRY),BID)
  .err().unwrap(),"READ_DECODED_SHA_CAS_FAILED");
 assert_eq!(wrong(p1g.clone(),sha256(&p1g),sha256(JSON.as_bytes()),[0;32],BID)
  .err().unwrap(),"READ_REGISTRY_SHA_CAS_FAILED");
 assert_eq!(wrong(p1g.clone(),sha256(&p1g),sha256(JSON.as_bytes()),sha256(REGISTRY),"WRONG_BID")
  .err().unwrap(),"READ_EXTERNAL_BUILD_OR_SCHEMA_UNSUPPORTED");
 let bad=r#"{"GameInfo":{"Version":626},"World":{"OtherEvents":[]}}"#;
 let bad_p1g=encrypted(bad);
 assert_eq!(wrong(bad_p1g.clone(),sha256(&bad_p1g),sha256(bad.as_bytes()),
   sha256(REGISTRY),BID).err().unwrap(),"DIRECT_INDEX_PARENT_MISSING_OR_WRONG_TYPE");
 let duplicate=r#"{"GameInfo":{"Version":626},"World":{"RecurringEvents":[],"RecurringEvents":[]}}"#;
 // Existing strict parser rejects duplicate object keys before any READ.
 assert_eq!(ddv_save_core::validate_json(duplicate.as_bytes()).unwrap_err(),
   "JSON_DUPLICATE_KEY");
}
#[test]
fn oversized_record_is_denied_not_silently_omitted(){
 let huge="X".repeat(65_537);
 let doc=format!(r#"{{"GameInfo":{{"Version":626}},"World":{{"RecurringEvents":[{{"ItemSpawning":{{"RecurringEventItemID":1,"NextOccurrence":"{OLD}","Opaque":"{huge}"}}}}]}}}}"#);
 let mut core=open(&doc);let m=core.receipt().unwrap();
 assert_eq!(m.indexed_count,1);
 assert_eq!(core.query_indexed_page(query(&m.session_id,None,1)).unwrap_err(),
 "READ_RECORD_TOO_LARGE");
}
#[test]
fn object_map_indices_preserved_and_ambiguous_aliases_denied(){
 let doc=r#"{"GameInfo":{"Version":626},"World":{"RecurringEvents":{"9":{"Future":{"RecurringEventItemID":9}},"1":{"Future":{"RecurringEventItemID":1}}}}}"#;
 let mut core=open(doc);let m=core.receipt().unwrap();
 let page=core.query_indexed_page(query(&m.session_id,None,8)).unwrap();
 assert!(page.complete);
 assert_eq!(page.rows.iter().map(|v|v.saved_index).collect::<Vec<_>>(),vec![1,9]);
 let aliases=r#"{"GameInfo":{"Version":626},"World":{"RecurringEvents":{"1":{},"01":{}}}}"#;
 let a=encrypted(aliases);
 assert_eq!(TrustedReadCore::open_p1g_readonly(a.clone(),&[4;32],sha256(&a),
 sha256(aliases.as_bytes()),REGISTRY,sha256(REGISTRY),BID,626,1024*1024)
 .err().unwrap(),"DIRECT_INDEX_OBJECT_KEY_AMBIGUOUS");
 let idx=index_direct_children(doc.as_bytes(),"/World/RecurringEvents").unwrap();
 assert_eq!(idx.kind,DirectIndexKind::Object);
}
#[test]
fn w1_intended_id_pointer_old_raw_and_revision_cas(){
 let core=open(JSON);let m=core.receipt().unwrap();
 let make=|event_id,saved_index,oneof:W1Kind,raw:&str,rev:u64|
 W1CommandIntent{
  session_id:&m.session_id,expected_revision:rev,expected_generation:m.generation,
  expected_encrypted_sha256:m.roots.encrypted_source_sha256,
  expected_decoded_sha256:m.roots.decoded_json_sha256,
  expected_registry_sha256:m.roots.registry_sha256,
  expected_external_bid:BID,schema:626,event_id,saved_index,oneof,
  pointer:"/World/RecurringEvents/0/ItemSpawning/NextOccurrence",
  expected_old_raw_json:raw,expected_old_utc:OLD,proposed_utc:NEW
 };
 let yes=core.preflight_w1(make(2010000021,0,W1Kind::ItemSpawning,
   "\"2126-08-20T00:00:00Z\"",0)).unwrap();
 assert!(yes.exact_source_and_revision_cas);
 assert!(yes.event_identity_and_old_raw_cas);
 assert!(!yes.transaction_stage_authorized);
 assert!(!yes.complete_operation_references_verified);
 assert!(!yes.encode_copy_authorized);
 assert_eq!(core.preflight_w1(make(2010000022,0,W1Kind::ItemSpawning,
   "\"2126-08-20T00:00:00Z\"",0)).unwrap_err(),"W1_EVENT_ID_CAS_FAILED");
 assert_eq!(core.preflight_w1(make(2010000021,0,W1Kind::ItemSpawning,
   "\"stale\"",0)).unwrap_err(),"W1_RAW_OLD_VALUE_CAS_FAILED");
 assert_eq!(core.preflight_w1(make(2010000021,0,W1Kind::FlowerSpawningInVillage,
   "\"2126-08-20T00:00:00Z\"",0)).unwrap_err(),"W1_INTENT_POINTER_MISMATCH");
 assert_eq!(core.preflight_w1(make(2010000021,0,W1Kind::ItemSpawning,
   "\"2126-08-20T00:00:00Z\"",1)).unwrap_err(),"READ_STALE_REVISION");
 assert_eq!(core.export_p1g_copy().unwrap_err(),"PRODUCT_ENCODE_COPY_NOT_AUTHORIZED");
}
