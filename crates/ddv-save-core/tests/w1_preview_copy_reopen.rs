//! W-CORE-004: NEW synthetic operation-specific W1 preview and independent
//! edited-copy reopen *research*, not user/production Writer. No private save.
use ddv_save_core::{sha256,TokenChange,index_selected_tokens};
use ddv_save_core::p1g::{
 encode_synthetic_fixture,decode_p1g_research,create_p1g_copy_research
};
use ddv_save_core::trusted_read::{
 TrustedReadCore,W1CommandIntent,SourceReadCondition
};
use ddv_save_core::w1_evidence::W1Kind;
const BID:&str="9A239D3DB569756D";
const OLD:&str="2126-08-20T00:00:00Z";
const NEW:&str="2026-11-03T00:00:00Z";
const REGISTRY:&[u8]=b"synthetic-versioned-508-registry-hash-witness-not-genuine";
const POINTER:&str="/World/RecurringEvents/155/ItemSpawning/NextOccurrence";
const DOC:&str=r#"{"GameInfo":{"Version":626},"Player":{"UnknownOwned":true},"World":{"RecurringEvents":{"155":{"ItemSpawning":{"RecurringEventItemID":2010000021,"NextOccurrence":"2126-08-20T00:00:00Z","LastOccurrence":"2026-10-01T00:00:00Z","UnknownNested":{"doNotTouch":[1,2,3]}}},"157":{"FlowerSpawningInVillage":{"RecurringEventItemID":2010500008,"NextOccurrence":"2026-12-02T00:00:00Z"}}},"FutureRoot":{"unknown":"stay untouched"}}}"#;
fn fixture()->(Vec<u8>,TrustedReadCore){
 let cipher=encode_synthetic_fixture(DOC.as_bytes(),&[0x46;32],8).unwrap();
 let core=TrustedReadCore::open_p1g_readonly(cipher.clone(),&[0x46;32],
   sha256(&cipher),sha256(DOC.as_bytes()),REGISTRY,sha256(REGISTRY),
   BID,626,128*1024*1024).unwrap();
 (cipher,core)
}
fn intent<'a>(sid:&'a str,sha:[u8;32],json_sha:[u8;32],
   registry_sha:[u8;32],event_id:u64,saved_index:usize,
   old:&'a str,new:&'a str,revision:u64)->W1CommandIntent<'a>{
 W1CommandIntent{
   session_id:sid,expected_revision:revision,expected_generation:0,
   expected_encrypted_sha256:sha,expected_decoded_sha256:json_sha,
   expected_registry_sha256:registry_sha,expected_external_bid:BID,
   schema:626,event_id,saved_index,oneof:W1Kind::ItemSpawning,
   pointer:POINTER,expected_old_raw_json:"\"2126-08-20T00:00:00Z\"",
   expected_old_utc:old,proposed_utc:new,
   source_read_set:vec![SourceReadCondition{
    pointer:"/World/RecurringEvents/155/ItemSpawning/RecurringEventItemID".to_owned(),
    expected_raw_token_sha256:sha256(b"2010000021")
   }]
 }
}
#[test]
fn exact_preview_original_first_backup_synthetic_edited_copy_independent_reopen(){
 let (cipher,core)=fixture();
 let owner=core.receipt().unwrap();
 assert!(owner.complete_structural_scan);
 assert!(!owner.semantic_reference_closure_verified);
 let q=intent(&owner.session_id,owner.roots.encrypted_source_sha256,
   owner.roots.decoded_json_sha256,owner.roots.registry_sha256,
   2010000021,155,OLD,NEW,0);
 let p=core.preview_w1_exact_diff(q).unwrap();
 assert_eq!(p.pointer,POINTER);
 assert_eq!(p.source_revision,0);
 assert_eq!(p.proposed_revision,1);
 assert_eq!(p.source_cipher_sha256,sha256(&cipher));
 assert_eq!(p.source_decoded_sha256,sha256(DOC.as_bytes()));
 assert_eq!(p.registry_sha256,sha256(REGISTRY));
 assert!(p.source_and_reference_cas_matched);
 assert_eq!(p.exact_changed_pointers,[POINTER]);
 assert_ne!(p.proposed_decoded_sha256,p.source_decoded_sha256);
 for authorized in [
   p.full_operation_reference_closure_verified,
   p.original_first_backup_written,
   p.atomic_changeset_committed,
   p.encode_copy_authorized,p.persistent_replace_authorized
 ]{assert!(!authorized);}
 assert_eq!(core.export_p1g_copy().err(),Some("PRODUCT_ENCODE_COPY_NOT_AUTHORIZED"));

 // Synthetic-only research: explicitly save original bytes BEFORE writing
 // any edited-copy file. These paths are disposable CI test fixtures, not
 // source Save paths or a product filesystem export API.
 let dir=std::env::temp_dir().join(format!("wand-w1-cas-synthetic-{}",std::process::id()));
 let _=std::fs::remove_dir_all(&dir);
 std::fs::create_dir(&dir).unwrap();
 let backup=dir.join("original-first.p1g");
 let edited=dir.join("edited-copy-not-product.p1g");
 std::fs::write(&backup,&cipher).unwrap();
 assert_eq!(sha256(&std::fs::read(&backup).unwrap()),p.source_cipher_sha256);
 assert!(!edited.exists());
 let copy=create_p1g_copy_research(&cipher,sha256(&cipher),&[0x46;32],626,
   &[TokenChange{
    pointer:POINTER.to_owned(),
    expected_old_string:OLD.to_owned(),
    replacement_string:NEW.to_owned()
   }],128*1024*1024).unwrap();
 assert!(!copy.product_encode_copy_authorized);
 assert!(!copy.persistent_replace_authorized);
 assert_eq!(copy.verified_changed_pointers,[POINTER]);
 assert_eq!(copy.decoded_after_sha256,p.proposed_decoded_sha256);
 std::fs::write(&edited,&copy.edited_ciphertext).unwrap();
 assert_eq!(sha256(&std::fs::read(&backup).unwrap()),p.source_cipher_sha256);

 // Independent reopen of saved edited ciphertext, not a copy of the
 // in-memory parsed source; every unrelated JSON byte remains unchanged.
 let reopened=decode_p1g_research(&std::fs::read(&edited).unwrap(),&[0x46;32],128*1024*1024).unwrap();
 assert_eq!(reopened.decoded_json_sha256,p.proposed_decoded_sha256);
 let actual=std::str::from_utf8(&reopened.json).unwrap();
 assert_eq!(actual,DOC.replacen(OLD,NEW,1));
 let paths=[POINTER.to_owned()];
 let hit=index_selected_tokens(&reopened.json,&paths).unwrap();
 assert_eq!(hit[0].value,format!("\"{NEW}\""));
 assert_eq!(sha256(&cipher),p.source_cipher_sha256);
 core.original_unchanged().unwrap();
 std::fs::remove_dir_all(&dir).unwrap();
}
#[test]
fn core_preview_fails_closed_for_forged_identity_stale_revision_or_wrong_old_utc(){
 let (_,core)=fixture();let m=core.receipt().unwrap();
 let make=|event_id,idx,old,new,rev,src,reg|
  intent(&m.session_id,src,m.roots.decoded_json_sha256,reg,event_id,idx,old,new,rev);
 assert_eq!(core.preview_w1_exact_diff(make(2010000000,155,OLD,NEW,0,
   m.roots.encrypted_source_sha256,m.roots.registry_sha256)).unwrap_err(),
   "W1_EVENT_ID_CAS_FAILED");
 assert_eq!(core.preview_w1_exact_diff(make(2010000021,154,OLD,NEW,0,
   m.roots.encrypted_source_sha256,m.roots.registry_sha256)).unwrap_err(),
   "W1_INTENT_POINTER_MISMATCH");
 assert_eq!(core.preview_w1_exact_diff(make(2010000021,155,"2024-01-01T00:00:00Z",NEW,0,
   m.roots.encrypted_source_sha256,m.roots.registry_sha256)).unwrap_err(),
   "W1_OLD_UTC_CAS_FAILED");
 assert_eq!(core.preview_w1_exact_diff(make(2010000021,155,OLD,NEW,1,
   m.roots.encrypted_source_sha256,m.roots.registry_sha256)).unwrap_err(),
   "READ_STALE_REVISION");
 assert_eq!(core.preview_w1_exact_diff(make(2010000021,155,OLD,NEW,0,
   [0;32],m.roots.registry_sha256)).unwrap_err(),"W1_SOURCE_CAS_FAILED");
 assert_eq!(core.preview_w1_exact_diff(make(2010000021,155,OLD,NEW,0,
   m.roots.encrypted_source_sha256,[0;32])).unwrap_err(),"W1_REGISTRY_CAS_FAILED");
 assert_eq!(core.preview_w1_exact_diff(make(2010000021,155,OLD,OLD,0,
   m.roots.encrypted_source_sha256,m.roots.registry_sha256)).unwrap_err(),"W1_NO_OP_DENIED");
 assert_eq!(core.preview_w1_exact_diff(make(2010000021,155,OLD,"2026-02-29T00:00:00Z",0,
   m.roots.encrypted_source_sha256,m.roots.registry_sha256)).unwrap_err(),"W1_NEW_UTC_INVALID");
 assert_eq!(core.export_p1g_copy().err(),Some("PRODUCT_ENCODE_COPY_NOT_AUTHORIZED"));
}
