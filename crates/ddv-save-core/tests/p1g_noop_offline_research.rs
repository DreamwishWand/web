//! No-op P1G rebuilt copy is an isolated research function, never a Writer grant.
use ddv_save_core::p1g::{create_p1g_noop_rebuild_research,decode_p1g_research,encode_synthetic_fixture};
use ddv_save_core::sha256;
const KEY:[u8;32]=[0x42;32];
const JSON:&[u8]=br#"{"GameInfo":{"Version":626},"Player":{"ContainerInventories":{}},"World":{"RecurringEvents":{"155":{"ItemSpawning":{"RecurringEventItemID":2010000021,"NextOccurrence":"2126-08-20T00:00:00Z"}}}},"Unknown":{"nested":{"opaque":"\\u00e9","number":1.00,"arr":[1,2,3]}}}"#;
#[test]
fn noop_p1g_decode_reencode_selfreopen_preserves_every_decoded_byte_and_known_headers(){
 for method in [0u16,8u16]{
  let source=encode_synthetic_fixture(JSON,&KEY,method).unwrap();
  let before=decode_p1g_research(&source,&KEY,2_000_000).unwrap();
  let result=create_p1g_noop_rebuild_research(&source,sha256(&source),&KEY,2_000_000).unwrap();
  let reopened=decode_p1g_research(&result.edited_ciphertext,&KEY,2_000_000).unwrap();
  assert_eq!(reopened.json,JSON);
  assert_eq!(reopened.metadata.method,before.metadata.method);
  assert_eq!(reopened.metadata.local_header[4..14],before.metadata.local_header[4..14]);
  assert_eq!(reopened.metadata.central_header[4..16],before.metadata.central_header[4..16]);
  assert_eq!(reopened.metadata.central_header[34..42],before.metadata.central_header[34..42]);
  assert_eq!(result.source_cipher_sha256,sha256(&source));
  assert_eq!(result.decoded_before_sha256,sha256(JSON));
  assert_eq!(result.decoded_after_sha256,sha256(JSON));
  assert_eq!(result.verified_changed_pointers.len(),0);
  assert!(!result.product_encode_copy_authorized && !result.persistent_replace_authorized);
  assert_eq!(source,encode_synthetic_fixture(JSON,&KEY,method).unwrap(),"original immutable");
 }
}
#[test]
fn noop_reencode_source_sha_wrong_key_and_budget_rejected(){
 let source=encode_synthetic_fixture(JSON,&KEY,8).unwrap();
 assert_eq!(create_p1g_noop_rebuild_research(&source,[0;32],&KEY,2_000_000).unwrap_err(),
            "ENCRYPTED_SOURCE_SHA_CAS_FAILED");
 assert!(create_p1g_noop_rebuild_research(&source,sha256(&source),&[0;32],2_000_000).is_err());
 assert_eq!(create_p1g_noop_rebuild_research(&source,sha256(&source),&KEY,JSON.len()-1).unwrap_err(),
            "ZIP_EXPANDED_PROFILE_TOO_LARGE");
}
