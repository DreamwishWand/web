//! W-CORE-004 isolated, synthetic-only trusted READ lease and memory cases.
use ddv_save_core::{sha256, trusted_read::TrustedReadBoundary};
const ENTROPY:[u8;32]=[0x94;32];
fn small()->Vec<u8>{
 br#"{"GameInfo":{"Version":626},"Player":{},"World":{"RecurringEvents":[{"ItemSpawning":{"RecurringEventItemID":2010000021,"NextOccurrence":"2126-08-20T00:00:00Z","UnknownNested":{"keep":true}}},{"FlowerSpawningInVillage":{"RecurringEventItemID":2010500008,"NextOccurrence":"2022-09-06T00:00:00Z"}}]},"opaque":{"e":"\u00e9","number":1.00}}"#.to_vec()
}
fn host()->TrustedReadBoundary{
 TrustedReadBoundary::new_for_trusted_host_research(ENTROPY).unwrap()
}
#[test]
fn core_mints_scope_epoch_revision_and_single_use_cursors(){
 let mut core=host();
 let ticket=core.open_decoded_research(small()).unwrap();
 assert_ne!(ticket.session_id,0);
 assert_eq!(ticket.source_epoch,1);
 assert_eq!(ticket.revision,0);
 assert_eq!(ticket.index_generation,1);
 assert!(!ticket.product_read_worker_accepted&&!ticket.product_writer_authorized);
 let first=core.query_page(&ticket,None,1).unwrap();
 assert_eq!(first.index_generation,1);
 assert_eq!(first.total_w1_rows,2);
 assert_eq!(first.rows.len(),1);
 assert_eq!(first.rows[0].event_id,2010000021);
 assert!(first.w1_source_index_complete);
 assert!(!first.full_domain_reference_closure_complete);
 assert!(!first.product_read_worker_accepted&&!first.product_writer_authorized);
 let next=first.next_cursor.as_deref().unwrap();
 assert_eq!(core.query_page(&ticket,None,1).err(),Some("READ_CURSOR_REPLAY_OR_SCOPE_MISMATCH"));
 assert_eq!(core.query_page(&ticket,Some("w1r1.forger"),1).err(),Some("READ_CURSOR_REPLAY_OR_SCOPE_MISMATCH"));
 let end=core.query_page(&ticket,Some(next),1).unwrap();
 assert!(end.complete);
 assert_eq!(end.rows[0].event_id,2010500008);
 assert_eq!(core.query_page(&ticket,Some(next),1).err(),Some("READ_CURSOR_EXHAUSTED"));
 assert_eq!(core.deny_writer_or_unknown_operation().err(),Some("PRODUCT_SAVE_WRITE_NOT_AUTHORIZED"));
}
#[test]
fn forged_ui_ticket_capability_hash_revision_or_id_cannot_advance_cursor(){
 let mut core=host();let ticket=core.open_decoded_research(small()).unwrap();
 let first=core.query_page(&ticket,None,1).unwrap();
 let cursor=first.next_cursor.unwrap();
 let mut t=ticket.clone();t.session_id^=1;
 assert_eq!(core.query_page(&t,Some(&cursor),1).err(),Some("READ_UNTRUSTED_OR_STALE_TICKET"));
 let mut t=ticket.clone();t.revision+=1;
 assert_eq!(core.query_page(&t,Some(&cursor),1).err(),Some("READ_UNTRUSTED_OR_STALE_TICKET"));
 let mut t=ticket.clone();t.index_generation+=1;
 assert_eq!(core.query_page(&t,Some(&cursor),1).err(),Some("READ_UNTRUSTED_OR_STALE_TICKET"));
 let mut t=ticket.clone();t.decoded_sha256=[0;32];
 assert_eq!(core.query_page(&t,Some(&cursor),1).err(),Some("READ_UNTRUSTED_OR_STALE_TICKET"));
 let mut t=ticket.clone();t.product_read_worker_accepted=true;
 assert_eq!(core.query_page(&t,Some(&cursor),1).err(),Some("READ_UNTRUSTED_OR_STALE_TICKET"));
 let mut t=ticket.clone();t.product_writer_authorized=true;
 assert_eq!(core.query_page(&t,Some(&cursor),1).err(),Some("READ_UNTRUSTED_OR_STALE_TICKET"));
 let mut t=ticket.clone();t.source_epoch+=1;
 assert_eq!(core.query_page(&t,Some(&cursor),1).err(),Some("READ_UNTRUSTED_OR_STALE_TICKET"));
 let second=core.query_page(&ticket,Some(&cursor),1).unwrap();
 assert!(second.complete);
}
#[test]
fn navigation_a_to_b_closes_prior_ticket_and_cursor_without_data_leak(){
 let mut core=host();
 let a=core.open_decoded_research(small()).unwrap();
 let old_cursor=core.query_page(&a,None,1).unwrap().next_cursor.unwrap();
 let b=core.open_decoded_research(small()).unwrap();
 assert_ne!(a.session_id,b.session_id);
 assert_ne!(a.source_epoch,b.source_epoch);
 assert_ne!(a.index_generation,b.index_generation);
 assert_eq!(core.query_page(&a,Some(&old_cursor),1).err(),Some("READ_UNTRUSTED_OR_STALE_TICKET"));
 assert_eq!(core.close(&a).err(),Some("READ_UNTRUSTED_OR_STALE_TICKET"));
 assert_eq!(core.query_page(&b,Some(&old_cursor),1).err(),Some("READ_FIRST_CURSOR_NOT_ALLOWED"));
 assert_eq!(core.query_page(&b,None,1).unwrap().rows.len(),1);
 core.revoke_on_navigation().unwrap();
 assert_eq!(core.query_page(&b,None,1).err(),Some("READ_NO_ACTIVE_SESSION"));
}
#[test]
fn corrupted_b_open_revokes_a_even_if_b_validation_fails(){
 let mut core=host();
 let old=core.open_decoded_research(small()).unwrap();
 let result=core.open_decoded_research(
  br#"{"GameInfo":{"Version":626},"World":{"RecurringEvents":[]},"Bad":{"same":1,"same":2}}"#.to_vec()
 );
 assert_eq!(result.err(),Some("JSON_DUPLICATE_KEY"));
 assert_eq!(core.query_page(&old,None,1).err(),Some("READ_NO_ACTIVE_SESSION"));
 assert!(core.current_ticket().is_none());
 let fresh=core.open_decoded_research(small()).unwrap();
 assert_eq!(fresh.source_epoch,3);
}
#[test]
fn close_revokes_and_zero_entropy_denied(){
 assert_eq!(TrustedReadBoundary::new_for_trusted_host_research([0;32]).err(),Some("READ_CORE_ENTROPY_REQUIRED"));
 let mut core=host();let ticket=core.open_decoded_research(small()).unwrap();
 core.close(&ticket).unwrap();
 assert_eq!(core.close(&ticket).err(),Some("READ_UNTRUSTED_OR_STALE_TICKET"));
 assert_eq!(core.query_page(&ticket,None,1).err(),Some("READ_NO_ACTIVE_SESSION"));
 assert_eq!(core.retained_index_bytes(),0);
}
#[test]
fn two_root_sha_p1g_research_wrapper_is_fail_closed(){
 use ddv_save_core::p1g::encode_synthetic_fixture;
 let decoded=small();let json_sha=sha256(&decoded);let key=[0x42;32];
 let cipher=encode_synthetic_fixture(&decoded,&key,8).unwrap();
 let cipher_sha=sha256(&cipher);
 let mut core=host();
 let ticket=core.open_p1g_research(&cipher,&key,cipher_sha,json_sha).unwrap();
 let page=core.query_page(&ticket,None,1).unwrap();
 assert_eq!(page.encrypted_p1g_sha256,Some(cipher_sha));
 assert_eq!(page.decoded_json_sha256,json_sha);
 assert!(!page.product_read_worker_accepted);
 assert_eq!(core.open_p1g_research(&cipher,&key,cipher_sha,[0;32]).err(),Some("READ_P1G_DECODED_SHA_CAS_FAILED"));
 assert!(core.current_ticket().is_none());
 assert_eq!(core.open_p1g_research(&cipher,&key,[0;32],json_sha).err(),Some("READ_ENCRYPTED_SOURCE_SHA_CAS_FAILED"));
}
#[test]
fn synthetic_100_and_200_mib_full_strict_source_scan_without_retaining_full_document(){
 for mb in [100usize,200usize] {
  let n=mb*1024*1024;
  let prefix=br#"{"GameInfo":{"Version":626},"Player":{},"World":{"RecurringEvents":[{"ItemSpawning":{"RecurringEventItemID":2010000021,"NextOccurrence":"2126-08-20T00:00:00Z"}}]},"UnknownHuge":"#;
  let mut bytes=Vec::with_capacity(n+prefix.len()+8);
  bytes.extend_from_slice(prefix);
  bytes.push(b'"');
  bytes.resize(bytes.len()+n,b'x');
  bytes.extend_from_slice(br#""}"#);
  let expected_size=bytes.len();
  let mut core=host();
  let t=core.open_decoded_research(bytes).unwrap();
  assert_eq!(core.total_validated_source_bytes(),expected_size);
  assert!(core.retained_index_bytes()<1024);
  let p=core.query_page(&t,None,64).unwrap();
  assert_eq!(p.rows.len(),1);
  assert!(p.complete);
  assert!(!p.full_domain_reference_closure_complete);
  assert!(!p.product_read_worker_accepted);
  println!("SYNTHETIC_W1_OPEN_FULL_VALIDATED_MIB={} RETAINED_SUBTREE_BYTES={} PRODUCT_WRITER=OFF",
   mb,core.retained_index_bytes());
  core.close(&t).unwrap();
 }
}
