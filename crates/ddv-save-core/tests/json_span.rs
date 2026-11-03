use ddv_save_core::{
    match_explicit_build,patch_json_string_tokens,sha256,validate_json,
    TokenChange,RESEARCH_CAPABILITIES
};
fn source()->Vec<u8>{
    br#"{ "GameInfo":{"Version":626}, "World":{"RecurringEvents":{
 "0":{"ItemSpawning":{"RecurringEventItemID":2010000021,"NextOccurrence":"2126-08-20T00:00:00Z","LastOccurrence":"2126-08-20T00:00:00Z"}},
 "1":{"FlowerSpawningInVillage":{"RecurringEventItemID":2010500008,"NextOccurrence":"2126-08-20T00:00:00Z"}}}},
 "Unknown":{"exact":1.00,"numexp":1e2,"escape":"\u00e9","arr":[true,null,{"x":"\u2728"}]}}"#.to_vec()
}
fn change(row:usize,kind:&str,target:&str)->TokenChange{
    TokenChange {
        pointer:format!("/World/RecurringEvents/{row}/{kind}/NextOccurrence"),
        expected_old_string:"2126-08-20T00:00:00Z".into(),
        replacement_string:target.into()
    }
}
#[test]
fn single_token_update_preserves_every_other_raw_byte() {
    let input=source();
    let snapshot=input.clone();
    let ch=change(0,"ItemSpawning","2026-11-02T10:15:00.000Z");
    let proof=patch_json_string_tokens(&input,sha256(&input),626,&[ch]).unwrap();
    assert_eq!(input,snapshot);
    assert_eq!(proof.changed.len(),1);
    let range=&proof.changed[0].span;
    let old=&input[range.clone()];
    let replacement=br#""2026-11-02T10:15:00.000Z""#;
    assert_eq!(&proof.bytes[..range.start],&input[..range.start]);
    assert_eq!(&proof.bytes[range.start..range.start+replacement.len()],replacement);
    assert_eq!(&proof.bytes[range.start+replacement.len()..],&input[range.end..]);
    assert_eq!(old,br#""2126-08-20T00:00:00Z""#);
    assert_eq!(proof.original_sha256,sha256(&input));
    assert_eq!(proof.edited_sha256,sha256(&proof.bytes));
    let s=std::str::from_utf8(&proof.bytes).unwrap();
    assert!(s.contains(r#""exact":1.00"#));
    assert!(s.contains(r#""numexp":1e2"#));
    assert!(s.contains(r#""escape":"\u00e9""#));
    assert!(s.contains(r#""LastOccurrence":"2126-08-20T00:00:00Z""#));
}
#[test]
fn two_patches_keep_ranges_disjoint_and_unselected_values() {
    let s=source();
    let edits=[change(0,"ItemSpawning","2022-09-06T00:00:00Z"),
        change(1,"FlowerSpawningInVillage","2127-08-20T00:00:00Z")];
    let out=patch_json_string_tokens(&s,sha256(&s),626,&edits).unwrap();
    assert_eq!(out.changed.len(),2);
    assert_ne!(out.bytes,s);
    // Two intentionally equal-length UTC strings need not change total length.
    let result=std::str::from_utf8(&out.bytes).unwrap();
    assert_eq!(result.matches("2022-09-06T00:00:00Z").count(),1);
    assert_eq!(result.matches("2127-08-20T00:00:00Z").count(),1);
    assert!(result.contains(r#""LastOccurrence":"2126-08-20T00:00:00Z""#));
}
#[test]
fn rejects_wrong_sha_schema_old_value_and_noop() {
    let s=source();
    let good=change(0,"ItemSpawning","2022-09-06T00:00:00Z");
    assert_eq!(patch_json_string_tokens(&s,[0;32],626,&[good.clone()]).unwrap_err(),"SOURCE_SHA_CAS_FAILED");
    assert_eq!(patch_json_string_tokens(&s,sha256(&s),647,&[good.clone()]).unwrap_err(),"SAVE_SCHEMA_MISMATCH");
    let mut bad=good.clone();bad.expected_old_string="2024".into();
    assert_eq!(patch_json_string_tokens(&s,sha256(&s),626,&[bad]).unwrap_err(),"SOURCE_VALUE_CAS_FAILED");
    let mut no_op=good;no_op.replacement_string=no_op.expected_old_string.clone();
    assert_eq!(patch_json_string_tokens(&s,sha256(&s),626,&[no_op]).unwrap_err(),"NO_OP_DENIED");
}
#[test]
fn rejects_missing_duplicated_or_malformed_pointers() {
    let s=source();
    let a=change(0,"ItemSpawning","2026");
    assert_eq!(patch_json_string_tokens(&s,sha256(&s),626,&[a.clone(),a]).unwrap_err(),"INVALID_OR_DUPLICATE_POINTER");
    assert_eq!(patch_json_string_tokens(&s,sha256(&s),626,&[change(9,"ItemSpawning","2026")]).unwrap_err(),"POINTER_NOT_FOUND");
    let mut weird=change(0,"ItemSpawning","2026");weird.pointer="/World/~9bad".into();
    assert_eq!(patch_json_string_tokens(&s,sha256(&s),626,&[weird]).unwrap_err(),"INVALID_JSON_POINTER_ESCAPE");
}
#[test]
fn exact_pointer_does_not_replace_same_timestamp_elsewhere() {
    let s=source();let result=patch_json_string_tokens(&s,sha256(&s),626,&[change(0,"ItemSpawning","2026")]).unwrap();
    let json=std::str::from_utf8(&result.bytes).unwrap();
    assert_eq!(json.matches("2126-08-20T00:00:00Z").count(),2);
}
#[test]
fn rejects_duplicate_keys_even_outside_selected_path() {
    for sample in [
        r#"{"GameInfo":{"Version":626},"other":{"x":1,"x":2}}"#,
        r#"{"GameInfo":{"Version":626},"left":{"\u0061":1,"a":2}}"#,
        r#"{"GameInfo":{"Version":626},"arr":[{"x":1,"x":2}]}"#,
    ]{assert_eq!(validate_json(sample.as_bytes()).unwrap_err(),"JSON_DUPLICATE_KEY");}
}
#[test]
fn rejects_unsafe_integral_numbers_and_broken_json() {
    for sample in [
        r#"{"n":9007199254740992}"#,r#"{"n":-9007199254740992}"#,
        r#"{"n":9223372036854775808}"#,r#"{"n":1e999}"#
    ]{assert!(matches!(validate_json(sample.as_bytes()),Err("JSON_UNSAFE_INTEGER"|"JSON_UNSAFE_NUMBER")));}
    for sample in [r#"{"n":01}"#,r#"{"n":1,}"#,r#"{"s":"\uD800"}"#,r#"{"s":"\q"}"#]{
        assert!(validate_json(sample.as_bytes()).is_err());
    }
}
#[test]
fn accepts_escaped_unicode_keys_and_rejects_bad_utf8() {
    let txt=br#"{"GameInfo":{"Version":626},"extra":{"\u0061":7}}"#;
    validate_json(txt).unwrap();
    assert_eq!(validate_json(b"{\"a\":\"\xFF\"}").unwrap_err(),"JSON_INVALID_UTF8");
}
#[test]
fn verifies_explicit_build_without_inference() {
    assert!(match_explicit_build("switch","switch-bid","9A239D3DB569756D",626,
        626,"switch","switch-bid","9A239D3DB569756D").is_ok());
    assert_eq!(match_explicit_build("switch","switch-bid","UNKNOWN",626,
        626,"switch","switch-bid","9A239D3DB569756D").unwrap_err(),"EXPLICIT_BUILD_ID_MISMATCH");
    assert_eq!(match_explicit_build("switch","switch-bid","9A239D3DB569756D",608,
        626,"switch","switch-bid","9A239D3DB569756D").unwrap_err(),"SAVE_SCHEMA_MISMATCH");
}
#[test]
fn all_product_write_capabilities_remain_unavailable() {
    assert!(RESEARCH_CAPABILITIES.read);
    assert!(!RESEARCH_CAPABILITIES.encode_copy);
    assert!(!RESEARCH_CAPABILITIES.persistent_replace);
}
#[test]
fn huge_input_rejected_before_parse_or_allocation() {
    // Cap acceptance is independent from real browser peak memory verification.
    let size=ddv_save_core::MAX_DECODED_JSON_BYTES+1;
    let data=vec![b'x';size];
    assert_eq!(validate_json(&data).unwrap_err(),"JSON_TOO_LARGE");
}
