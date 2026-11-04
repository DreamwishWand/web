//! 05 QR PR412 independent hard Core mandatory source gate negative tests.
//! Entirely synthetic decoded JSON encrypted with test-only fixture key.
use ddv_save_core::{sha256};
use ddv_save_core::p1g::encode_synthetic_fixture;
use ddv_save_core::trusted_read::{TrustedReadCore,W1CommandIntent,SourceReadCondition};
use ddv_save_core::w1_evidence::W1Kind;
const BID:&str="9A239D3DB569756D";
const OLD:&str="2126-08-20T00:00:00Z";
const BASE:&str=r#"{"GameInfo":{"Version":626},"World":{"RecurringEvents":{"155":{"ItemSpawning":{"RecurringEventItemID":2010000021,"NextOccurrence":"2126-08-20T00:00:00Z","LastOccurrence":"2026-10-01T00:00:00Z","EndDate":"2030-12-31T00:00:00Z"}}},"GridCollection":{"Grids":{"1540000000":{"Objects":[]}},"DiffGrids":{"1540000000":{"Modified":[]}}},"Villages":[{"Areas":{"1":{"GridIDs":[1540000000]}}}]}}"#;
fn open(raw:&str)->TrustedReadCore{
 let key=[0x62u8;32];let reg=b"QA412-READ-ONLY-SYNTHETIC";
 let p=encode_synthetic_fixture(raw.as_bytes(),&key,8).unwrap();
 TrustedReadCore::open_p1g_readonly(p.clone(),&key,sha256(&p),
  sha256(raw.as_bytes()),reg,sha256(reg),BID,626,128*1024*1024).unwrap()
}
fn intent<'a>(r:&'a ddv_save_core::trusted_read::OpenReadReceipt)->W1CommandIntent<'a>{
 W1CommandIntent{
  session_id:&r.session_id,expected_revision:0,expected_generation:0,
  expected_encrypted_sha256:r.roots.encrypted_source_sha256,
  expected_decoded_sha256:r.roots.decoded_json_sha256,
  expected_registry_sha256:r.roots.registry_sha256,
  expected_external_bid:BID,schema:626,event_id:2010000021,saved_index:155,
  oneof:W1Kind::ItemSpawning,
  pointer:"/World/RecurringEvents/155/ItemSpawning/NextOccurrence",
  expected_old_raw_json:"\"2126-08-20T00:00:00Z\"",
  expected_old_utc:OLD,proposed_utc:"2028-02-29T23:59:59Z",
  source_read_set:vec![]
 }
}
fn remain_off(c:&TrustedReadCore,d:&ddv_save_core::trusted_read::W1CoreNativeReadSet){
 assert!(!d.same_build_native_registry_manifest_accepted);
 assert!(!d.complete_native_dependency_closure_verified);
 assert!(!d.effective_area_grid_diffgrid_quota_verified);
 assert!(!d.clock_actualize_last_to_next_verified);
 assert!(!d.product_writer_authorized);
 assert_eq!(c.export_p1g_copy().unwrap_err(),"PRODUCT_ENCODE_COPY_NOT_AUTHORIZED");
}
#[test]
fn full_eight_source_tokens_allow_strict_diagnostic_but_not_native_or_writer(){
 let c=open(BASE);let r=c.receipt().unwrap();
 let d=c.require_w1_core_operation_source_read_set(intent(&r)).unwrap();
 assert_eq!(d.required_source_paths_count,8);
 assert_eq!(d.observed_core_refs.len(),8);
 assert!(d.all_known_source_refs_observed);
 assert_eq!(d.source_cipher_sha256,r.roots.encrypted_source_sha256);
 remain_off(&c,&d);c.original_unchanged().unwrap();
}
#[test]
fn missing_each_of_four_non_event_native_context_roots_fails_complete_operation_gate(){
 for pointer in ["EndDate","Grids","DiffGrids","Villages"] {
  let mut v:serde_json::Value=serde_json::from_str(BASE).unwrap();
  if pointer=="EndDate"{v["World"]["RecurringEvents"]["155"]["ItemSpawning"].as_object_mut().unwrap().remove("EndDate");}
  else if pointer=="Grids"||pointer=="DiffGrids"{
   v["World"]["GridCollection"].as_object_mut().unwrap().remove(pointer);
  }else{v["World"].as_object_mut().unwrap().remove("Villages");}
  let raw=v.to_string();let c=open(&raw);let r=c.receipt().unwrap();
  assert_eq!(c.require_w1_core_operation_source_read_set(intent(&r)).unwrap_err(),
   "W1_CORE_MANDATORY_SOURCE_READSET_INCOMPLETE", "{pointer}");
  assert_eq!(c.export_p1g_copy().unwrap_err(),"PRODUCT_ENCODE_COPY_NOT_AUTHORIZED");
 }
}
#[test]
fn partial_caller_readset_not_substitute_for_immutable_core_eight_and_bad_hash_is_denied(){
 let c=open(BASE);let r=c.receipt().unwrap();
 let mut supplied=intent(&r);
 supplied.source_read_set.push(SourceReadCondition{
  pointer:"/GameInfo/Version".into(),expected_raw_token_sha256:sha256(b"626")});
 let d=c.require_w1_core_operation_source_read_set(supplied).unwrap();
 assert_eq!(d.observed_core_refs.len(),8);remain_off(&c,&d);
 let mut forged=intent(&r);
 forged.source_read_set.push(SourceReadCondition{
  pointer:"/GameInfo/Version".into(),expected_raw_token_sha256:[0;32]});
 assert_eq!(c.require_w1_core_operation_source_read_set(forged).unwrap_err(),"W1_READ_SET_CAS_FAILED");
}
#[test]
fn incomplete_valid_raw_shape_world_native_arrays_and_bad_dates_fail_closed(){
 for mutate in ["villages-object","gridids-not-array","area-empty","grid-array","enddate-bad","last-bad"]{
  let mut v:serde_json::Value=serde_json::from_str(BASE).unwrap();
  match mutate{
   "villages-object"=>v["World"]["Villages"]=serde_json::json!({"Village04":{"Areas":{}}}),
   "gridids-not-array"=>v["World"]["Villages"][0]["Areas"]["1"]["GridIDs"]=serde_json::json!("invalid"),
   "area-empty"=>v["World"]["Villages"]=serde_json::json!([]),
   "grid-array"=>v["World"]["GridCollection"]["Grids"]=serde_json::json!([]),
   "enddate-bad"=>v["World"]["RecurringEvents"]["155"]["ItemSpawning"]["EndDate"]=serde_json::json!(42),
   "last-bad"=>v["World"]["RecurringEvents"]["155"]["ItemSpawning"]["LastOccurrence"]=serde_json::json!("2026-02-31T00:00:00Z"),
   _=>unreachable!()
  }
  let raw=v.to_string();let c=open(&raw);let r=c.receipt().unwrap();
  assert!(c.require_w1_core_operation_source_read_set(intent(&r)).is_err(),"{mutate}");
 }
}
#[test]
fn wrong_cipher_decoded_registry_revision_bid_event_and_old_date_are_not_authorized(){
 let c=open(BASE);let r=c.receipt().unwrap();
 let cases=["encrypted","decoded","registry","revision","bid","event","old"];
 for which in cases{
  let mut q=intent(&r);
  match which{
   "encrypted"=>q.expected_encrypted_sha256=[0;32],
   "decoded"=>q.expected_decoded_sha256=[0;32],
   "registry"=>q.expected_registry_sha256=[0;32],
   "revision"=>q.expected_revision=1,
   "bid"=>q.expected_external_bid="52BD625D9B4E0053",
   "event"=>q.event_id=2010500008,
   "old"=>q.expected_old_raw_json="\"2127-08-20T00:00:00Z\"",
   _=>unreachable!()
  }
  assert!(c.require_w1_core_operation_source_read_set(q).is_err(),"{which}");
 }
 c.original_unchanged().unwrap();
}
