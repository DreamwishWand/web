use ddv_save_core::{sha256};
use ddv_save_core::p1g::encode_synthetic_fixture;
use ddv_save_core::w1_evidence::{inspect_w1_source_research,W1Identity,W1Kind};
const KEY:[u8;32]=[0x42;32];
fn fixture(variant:&str,event_id:&str,raw_time:&str,extra:&str)->Vec<u8>{
 format!(r#"{{"GameInfo":{{"Version":626}},"Player":{{}},"World":{{"RecurringEvents":{{"0":{{"{variant}":{{"RecurringEventItemID":{event_id},"NextOccurrence":{raw_time}}}{extra}}}}}}}}}"#).into_bytes()
}
fn read(data:&[u8],expect_old:&str)
 ->Result<ddv_save_core::w1_evidence::W1StructuralWitness,&'static str>{
 let enc=encode_synthetic_fixture(data,&KEY,8)?;
 let registry=b"synthetic_registry_oneof_map";
 inspect_w1_source_research(&enc,&KEY,registry,sha256(&enc),sha256(registry),
  "9A239D3DB569756D",W1Identity{
   event_id:2010000021,saved_index:0,variant:W1Kind::ItemSpawning},
  expect_old,"2022-09-06T00:00:00Z")
}
#[test]
fn saved_oneof_has_separate_raw_string_and_decoded_utc_cas(){
 let source=fixture("ItemSpawning","2010000021",
  r#""\u0032126-08-20T00:00:00Z""#,"");
 let proof=read(&source,"2126-08-20T00:00:00Z").unwrap();
 assert_eq!(proof.raw_old_timestamp_json,r#""\u0032126-08-20T00:00:00Z""#);
 assert_eq!(proof.decoded_old_timestamp_utc,"2126-08-20T00:00:00Z");
 assert_ne!(proof.roots.decoded_json_sha256,proof.roots.encrypted_p1g_sha256);
 assert_ne!(proof.roots.registry_sha256,proof.roots.encrypted_p1g_sha256);
 assert!(proof.registry_digest_matched);
 assert!(proof.roots.external_build_selection_only);
 assert!(!proof.roots.build_cryptographically_bound_to_save);
 assert!(!proof.registry_event_semantics_verified);
 assert!(!proof.required_reference_closure_complete);
 assert!(!proof.encode_copy_authorized);
}
#[test]
fn rejects_forged_identity_duplicate_oneof_utc_or_sha(){
 let source=fixture("ItemSpawning","2010000021",r#""2126-08-20T00:00:00Z""#,"");
 assert_eq!(read(&source,"2024-01-01T00:00:00Z").unwrap_err(),"W1_DECODED_TIMESTAMP_CAS_FAILED");
 let wrong=fixture("FlowerSpawningInVillage","2010000021",r#""2126-08-20T00:00:00Z""#,"");
 assert_eq!(read(&wrong,"2126-08-20T00:00:00Z").unwrap_err(),"W1_POINTER_MISSING");
 let wrong_id=fixture("ItemSpawning","2010000044",r#""2126-08-20T00:00:00Z""#,"");
 assert_eq!(read(&wrong_id,"2126-08-20T00:00:00Z").unwrap_err(),"W1_SAVED_EVENT_ID_CAS_FAILED");
 let double=fixture("ItemSpawning","2010000021",r#""2126-08-20T00:00:00Z""#,
  r#","FlowerSpawningInVillage":{"RecurringEventItemID":2010500008,"NextOccurrence":"2025-01-01T00:00:00Z"}"#);
 assert_eq!(read(&double,"2126-08-20T00:00:00Z").unwrap_err(),"W1_NOT_SINGLE_SAVED_ONEOF");
 let enc=encode_synthetic_fixture(&source,&KEY,8).unwrap();
 let registry=b"registry";
 assert_eq!(inspect_w1_source_research(&enc,&KEY,registry,sha256(&enc),[0;32],
  "9A239D3DB569756D",W1Identity{
   event_id:2010000021,saved_index:0,variant:W1Kind::ItemSpawning},
  "2126-08-20T00:00:00Z","2022-09-06T00:00:00Z").unwrap_err(),"W1_REGISTRY_SHA_MISMATCH");
 assert_eq!(inspect_w1_source_research(&enc,&KEY,registry,sha256(&enc),sha256(registry),
  "WRONG_BUILD",W1Identity{
   event_id:2010000021,saved_index:0,variant:W1Kind::ItemSpawning},
  "2126-08-20T00:00:00Z","2022-09-06T00:00:00Z").unwrap_err(),"W1_EXPLICIT_BUILD_MISMATCH");
 assert_eq!(inspect_w1_source_research(&enc,&KEY,registry,[0;32],sha256(registry),
  "9A239D3DB569756D",W1Identity{
   event_id:2010000021,saved_index:0,variant:W1Kind::ItemSpawning},
  "2126-08-20T00:00:00Z","2022-09-06T00:00:00Z").unwrap_err(),"W1_ENCRYPTED_SOURCE_SHA_MISMATCH");
}
