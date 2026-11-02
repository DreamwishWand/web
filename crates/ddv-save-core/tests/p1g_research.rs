use ddv_save_core::p1g::{
 decode_p1g_research,create_p1g_copy_research,encode_synthetic_fixture
};
use ddv_save_core::{sha256,TokenChange};
fn raw()->Vec<u8>{
 br#"{"GameInfo":{"Version":626},"Player":{},"World":{"RecurringEvents":{"0":{"ItemSpawning":{"RecurringEventItemID":2010000021,"NextOccurrence":"2126-08-20T00:00:00Z","LastOccurrence":"2126-08-20T00:00:00Z"}}}},"Unknown":{"opaque":"\u00e9","value":1.00}}"#.to_vec()
}
fn edit()->TokenChange {
 TokenChange{pointer:"/World/RecurringEvents/0/ItemSpawning/NextOccurrence".into(),
 expected_old_string:"2126-08-20T00:00:00Z".into(),
 replacement_string:"2022-09-06T00:00:00Z".into()}
}
const TEST_KEY:[u8;32]=[0x42;32];
#[test]
fn encrypted_p1g_copy_exact_one_token_and_self_reopen_method8_and_store(){
 for method in [8,0]{
  let source=raw();
  let encrypted=encode_synthetic_fixture(&source,&TEST_KEY,method).unwrap();
  let baseline=encrypted.clone();
  let opened=decode_p1g_research(&encrypted,&TEST_KEY,1_000_000).unwrap();
  assert_eq!(opened.json,source);
  assert_eq!(opened.metadata.method,method);
  let copy=create_p1g_copy_research(&encrypted,sha256(&encrypted),&TEST_KEY,626,&[edit()],1_000_000).unwrap();
  let independently_opened=decode_p1g_research(&copy.edited_ciphertext,&TEST_KEY,1_000_000).unwrap();
  assert_eq!(copy.decoded_before_sha256,sha256(&source));
  assert_eq!(copy.decoded_after_sha256,sha256(&independently_opened.json));
  assert_eq!(independently_opened.metadata.method,method);
  assert_eq!(independently_opened.json.len(),source.len());
  assert_eq!(encrypted,baseline);
  assert!(!copy.product_encode_copy_authorized&&!copy.persistent_replace_authorized);
  let txt=String::from_utf8(independently_opened.json).unwrap();
  assert!(txt.contains(r#""NextOccurrence":"2022-09-06T00:00:00Z""#));
  assert!(txt.contains(r#""LastOccurrence":"2126-08-20T00:00:00Z""#));
  assert!(txt.contains(r#""value":1.00"#));
  assert!(txt.contains(r#""opaque":"\u00e9""#));
 }
}
#[test]
fn rejects_wrong_cipher_sha_schema_old_value_and_tampered_cipher(){
 let source=encode_synthetic_fixture(&raw(),&TEST_KEY,8).unwrap();
 assert_eq!(create_p1g_copy_research(&source,[0;32],&TEST_KEY,626,&[edit()],1_000_000).unwrap_err(),"ENCRYPTED_SOURCE_SHA_CAS_FAILED");
 assert_eq!(create_p1g_copy_research(&source,sha256(&source),&TEST_KEY,608,&[edit()],1_000_000).unwrap_err(),"SAVE_SCHEMA_MISMATCH");
 let mut edit=edit();edit.expected_old_string="2024-01-01".into();
 assert_eq!(create_p1g_copy_research(&source,sha256(&source),&TEST_KEY,626,&[edit],1_000_000).unwrap_err(),"SOURCE_VALUE_CAS_FAILED");
 let mut corrupted=source.clone();corrupted[0]^=255;
 assert!(decode_p1g_research(&corrupted,&TEST_KEY,1_000_000).is_err());
}
#[test]
fn wrong_key_expanded_limit_and_unknown_zip_metadata_fail_closed(){
 let source=encode_synthetic_fixture(&raw(),&TEST_KEY,8).unwrap();
 assert!(decode_p1g_research(&source,&[0;32],1_000_000).is_err());
 assert_eq!(decode_p1g_research(&source,&TEST_KEY,raw().len()-1).unwrap_err(),"ZIP_EXPANDED_PROFILE_TOO_LARGE");
}
