//! Independent 05 QR PR417 sparse strict decoded JSON scan, synthetic only.
//! 200MiB DECODED BYTES research ≠ real encrypted P1G / browser / WASM heap PASS.
use ddv_save_core::{index_selected_token_sha256,sha256};
const MI:usize=1024*1024;
#[test]
fn independent_decoded_only_200mib_sparse_hashes_do_not_echo_oversize_grid(){
 let mut raw=String::with_capacity(200*MI+900);
 raw.push_str(r#"{"GameInfo":{"Version":626},"World":{"GridCollection":{"Grids":{"big":""#);
 raw.extend(std::iter::repeat_n('x',200*MI));
 raw.push_str(r#""},"DiffGrids":{}},"RecurringEvents":{"155":{"ItemSpawning":{"RecurringEventItemID":2010000021,"NextOccurrence":"2126-08-20T00:00:00Z","LastOccurrence":"2026-10-01T00:00:00Z","EndDate":null}}},"Villages":[]}}"#);
 assert!(raw.len()>200*MI && raw.len()<201*MI);
 let old=sha256(raw.as_bytes());
 let paths=["/GameInfo/Version","/World/GridCollection/Grids",
   "/World/GridCollection/DiffGrids","/World/RecurringEvents/155/ItemSpawning/NextOccurrence",
   "/World/Villages"].map(str::to_owned);
 let out=index_selected_token_sha256(raw.as_bytes(),&paths,2*MI).unwrap();
 assert_eq!(out.len(),4);
 assert!(!out.iter().any(|t|t.pointer.ends_with("/Grids")));
 assert!(out.iter().all(|t|t.raw_bytes<=2*MI));
 assert_eq!(out.iter().find(|t|t.pointer.ends_with("/Version")).unwrap().raw_sha256,sha256(b"626"));
 assert_eq!(out.iter().find(|t|t.pointer.ends_with("/NextOccurrence")).unwrap().raw_sha256,
  sha256(br#""2126-08-20T00:00:00Z""#));
 assert_eq!(out.iter().find(|t|t.pointer.ends_with("/NextOccurrence")).unwrap().lexical_kind,"string");
 assert_eq!(old,sha256(raw.as_bytes()));
}
#[test]
fn omitted_missing_tokens_and_duplicate_watch_do_not_create_fake_witnesses(){
 let s=br#"{"GameInfo":{"Version":626},"World":{"Villages":[],"GridCollection":{"Grids":{},"DiffGrids":{}}}}"#;
 let paths=["/World/RecurringEvents/155/ItemSpawning/NextOccurrence".to_owned(),
  "/World/Villages".to_owned()];
 let h=index_selected_token_sha256(s,&paths,1024).unwrap();
 assert_eq!(h.len(),1);
 assert_eq!(h[0].pointer,"/World/Villages");
 assert_eq!(h[0].lexical_kind,"array");
 assert_eq!(h[0].raw_sha256,sha256(b"[]"));
 assert_eq!(index_selected_token_sha256(s,&[paths[1].clone(),paths[1].clone()],1024).unwrap_err(),
  "INDEX_DUPLICATE_WATCH");
 assert_eq!(index_selected_token_sha256(s,&paths,0).unwrap_err(),"INDEX_HASH_SPAN_BUDGET_INVALID");
 assert_eq!(index_selected_token_sha256(s,&paths,2*MI+1).unwrap_err(),"INDEX_HASH_SPAN_BUDGET_INVALID");
}
#[test]
fn lexical_raw_hash_is_not_value_reencoding_and_rejects_strict_json_malformed(){
 let raw=br#"{"GameInfo":{"Version":626},"Lexical":{"x":1.00,"unicode":"\u3042"}}"#;
 let watch=["/Lexical/x".to_string(),"/Lexical/unicode".to_string()];
 let result=index_selected_token_sha256(raw,&watch,1024).unwrap();
 assert_eq!(result.len(),2);
 assert_eq!(result[0].raw_sha256,sha256(b"1.00"));
 assert_eq!(result[1].raw_sha256,sha256(br#""\u3042""#));
 assert_eq!(result[0].lexical_kind,"number");
 for malformed in [
  br#"{"GameInfo":{"Version":626},"x":"\q"}"#.as_slice(),
  br#"{"GameInfo":{"Version":626},"x":01}"#.as_slice(),
  br#"{"GameInfo":{"Version":626},"x":[1,]}"#.as_slice()
 ]{assert!(index_selected_token_sha256(malformed,&watch,1024).is_err());}
}
