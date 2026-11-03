//! W-CORE-004 / 05 QR: independent source-only QA for PR348 pinned 52e6bf44.
 //! Native Rust/Cursor/strict-index scope ONLY. No real save/secret/production Worker.
use ddv_save_core::{sha256, index_direct_children,DirectIndexKind};
use ddv_save_core::p1g::encode_synthetic_fixture;
use ddv_save_core::trusted_read::{TrustedReadCore,PageQuery,ReadCapabilities,READ_ONLY};
const BID:&str="9A239D3DB569756D";
const REGISTRY:&[u8]=b"independent-only-qr348-registry-fixture";
const KEY:[u8;32]=[0x39;32];
const JSON:&str=r#"{"GameInfo":{"Version":626},"World":{"RecurringEvents":{"155":{"ItemSpawning":{"RecurringEventItemID":2010000021,"NextOccurrence":"2126-08-20T00:00:00Z","Unverified":{"a":true}}},"2":{"UnknownFutureW2":{"RecurringEventItemID":123,"Other":42}},"9":{"FlowerSpawningInVillage":{"RecurringEventItemID":2010500008,"NextOccurrence":"2022-09-06T00:00:00Z"}}}},"Unrelated":{"escape":"\u00e9","decimal":1.00}}"#;
fn p1g(s:&str)->Vec<u8>{encode_synthetic_fixture(s.as_bytes(),&KEY,8).unwrap()}
fn open(s:&str)->TrustedReadCore{
 let p=p1g(s);
 TrustedReadCore::open_p1g_readonly(p.clone(),&KEY,sha256(&p),sha256(s.as_bytes()),REGISTRY,
    sha256(REGISTRY),BID,626,1024*1024).unwrap()
}
fn q<'a>(session:&'a str,cursor:Option<&'a str>,limit:usize)->PageQuery<'a>{
 PageQuery{session_id:session,revision:0,generation:0,
  domain:"RecurringEvents",sort:"savedIndex",filter:"",limit,cursor}
}
#[test]
fn core_minted_fresh_session_and_single_use_scope_cannot_cross_open(){
 let mut a=open(JSON);let mut b=open(JSON);
 let am=a.receipt().unwrap(),bm=b.receipt().unwrap();
 assert_ne!(am.session_id,bm.session_id);
 assert_eq!(am.roots.encrypted_source_sha256,bm.roots.encrypted_source_sha256);
 assert!(!am.roots.external_bid_cryptographically_bound);
 assert_eq!(am.capabilities,READ_ONLY);
 assert_eq!(am.indexed_count,3);
 assert!(!am.complete_all_domains && !am.semantic_reference_closure_verified);
 let ap=a.query_indexed_page(q(&am.session_id,None,1)).unwrap();
 let at=ap.next_cursor.unwrap();
 let bp=b.query_indexed_page(q(&bm.session_id,None,1)).unwrap();
 let bt=bp.next_cursor.unwrap();
 assert_ne!(at,bt);
 assert_eq!(b.query_indexed_page(q(&bm.session_id,Some(&at),1)).unwrap_err(),"READ_CURSOR_UNKNOWN_OR_REPLAY");
 assert_eq!(a.query_indexed_page(q("UI-forged",Some(&at),1)).unwrap_err(),"READ_SESSION_MISMATCH");
 let mut wrong=q(&am.session_id,Some(&at),1);wrong.revision=10;
 assert_eq!(a.query_indexed_page(wrong).unwrap_err(),"READ_STALE_REVISION");
 let mut wrong=q(&am.session_id,Some(&at),1);wrong.generation=9;
 assert_eq!(a.query_indexed_page(wrong).unwrap_err(),"READ_STALE_GENERATION");
 let forged=format!("{}{}", &at[..at.len()-1], if at.ends_with('a') {"b"} else {"a"});
 assert_eq!(a.query_indexed_page(q(&am.session_id,Some(&forged),1)).unwrap_err(),"READ_CURSOR_UNKNOWN_OR_REPLAY");
 let second=a.query_indexed_page(q(&am.session_id,Some(&at),1)).unwrap();
 assert_eq!(second.rows[0].saved_index,9);
 assert_eq!(a.query_indexed_page(q(&am.session_id,Some(&at),1)).unwrap_err(),"READ_CURSOR_UNKNOWN_OR_REPLAY");
 a.close();
 assert_eq!(a.query_indexed_page(q(&am.session_id,None,1)).unwrap_err(),"READ_SESSION_CLOSED");
}
#[test]
fn source_registry_sha_version_bids_and_full_source_errors_refuse_before_exposure(){
 let source=p1g(JSON);
 for (cipher_sha,decoded_sha,registry_sha,bid,schema,expected) in [
  ([0;32],sha256(JSON.as_bytes()),sha256(REGISTRY),BID,626,"READ_SOURCE_SHA_CAS_FAILED"),
  (sha256(&source),[0;32],sha256(REGISTRY),BID,626,"READ_DECODED_SHA_CAS_FAILED"),
  (sha256(&source),sha256(JSON.as_bytes()),[0;32],BID,626,"READ_REGISTRY_SHA_CAS_FAILED"),
  (sha256(&source),sha256(JSON.as_bytes()),sha256(REGISTRY),"UNKNOWN_BID",626,"READ_EXTERNAL_BUILD_OR_SCHEMA_UNSUPPORTED"),
  (sha256(&source),sha256(JSON.as_bytes()),sha256(REGISTRY),BID,624,"READ_EXTERNAL_BUILD_OR_SCHEMA_UNSUPPORTED")
 ] {
  let res=TrustedReadCore::open_p1g_readonly(source.clone(),&KEY,cipher_sha,decoded_sha,
   REGISTRY,registry_sha,bid,schema,1024*1024);
  assert_eq!(res.err(),Some(expected));
 }
 for s in [
  r#"{"GameInfo":{"Version":626},"World":{"RecurringEvents":[]},"Other":{"a":1,"a":2}}"#,
  r#"{"GameInfo":{"Version":626},"World":{"RecurringEvents":[]},"Other":"\uD800"}"#,
  r#"{"GameInfo":{"Version":626},"World":{"RecurringEvents":[]},"Other":true} junk"#,
  r#"{"GameInfo":{"Version":624},"World":{"RecurringEvents":[]}}"#
 ] {
  let p=p1g(s);
  assert!(TrustedReadCore::open_p1g_readonly(p.clone(),&KEY,sha256(&p),sha256(s.as_bytes()),
   REGISTRY,sha256(REGISTRY),BID,626,1024*1024).is_err());
 }
}
#[test]
fn direct_index_and_complete_are_w1_only_never_full_domains(){
 let ix=index_direct_children(JSON.as_bytes(),"/World/RecurringEvents").unwrap();
 assert_eq!(ix.kind,DirectIndexKind::Object);
 assert_eq!(ix.items.len(),3);
 let mut core=open(JSON);let m=core.receipt().unwrap();
 let p=core.query_indexed_page(q(&m.session_id,None,200)).unwrap();
 assert!(p.complete);
 assert_eq!(p.indexed_total,3);
 assert_eq!(p.rows.iter().map(|r|r.saved_index).collect::<Vec<_>>(),vec![2,9,155]);
 assert_eq!(p.rows[0].oneof,"UnknownFutureW2");
 assert!(!p.rows[0].semantic_eligibility_verified);
 assert!(!p.complete_all_domains && !p.source_reference_semantics_verified);
 assert_eq!(core.query_indexed_page(q(&m.session_id,None,0)).unwrap_err(),"READ_PAGE_LIMIT");
 assert_eq!(core.query_indexed_page(q(&m.session_id,None,201)).unwrap_err(),"READ_PAGE_LIMIT");
 let mut unsupported=q(&m.session_id,None,1);unsupported.domain="ALL";
 assert_eq!(core.query_indexed_page(unsupported).unwrap_err(),"READ_QUERY_NOT_INDEXED");
 let alias=r#"{"GameInfo":{"Version":626},"World":{"RecurringEvents":{"01":{},"1":{}}}}"#;
 let p=p1g(alias);
 assert!(TrustedReadCore::open_p1g_readonly(p.clone(),&KEY,sha256(&p),sha256(alias.as_bytes()),
  REGISTRY,sha256(REGISTRY),BID,626,1024*1024).is_err());
 core.original_unchanged().unwrap();
}
#[test]
fn overlong_record_fails_closed_and_writer_flags_cannot_be_forged(){
 let huge="x".repeat(66*1024);
 let data=format!(r#"{{"GameInfo":{{"Version":626}},"World":{{"RecurringEvents":[{{"ItemSpawning":{{"RecurringEventItemID":1,"NextOccurrence":"2126-08-20T00:00:00Z","Opaque":"{}"}}}}]}}}}"#,huge);
 let mut core=open(&data);let receipt=core.receipt().unwrap();
 assert_eq!(core.query_indexed_page(q(&receipt.session_id,None,1)).unwrap_err(),"READ_RECORD_TOO_LARGE");
 assert_eq!(core.export_p1g_copy().unwrap_err(),"PRODUCT_ENCODE_COPY_NOT_AUTHORIZED");
 assert_eq!(core.stage_w1_transaction(&ddv_save_core::trusted_read::W1PreflightReceipt{
  exact_source_and_revision_cas:true,event_identity_and_old_raw_cas:true,
  source_read_set_cas_matched:true,required_registry_semantics_verified:true,
  complete_operation_references_verified:true,native_consumer_semantics_verified:true,
  transaction_stage_authorized:true,encode_copy_authorized:true
 }).unwrap_err(),"W1_OPERATION_REFERENCE_AND_NATIVE_CAPABILITY_NOT_ACCEPTED");
 let no:ReadCapabilities=receipt.capabilities;
 assert!(!no.encode_copy&&!no.apply&&!no.persistent_replace&&!no.original_overwrite);
}
