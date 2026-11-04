use ddv_save_core::{index_selected_token_sha256,sha256};
#[test]
fn decoded_200mib_strict_full_scan_sparse_hashes_do_not_materialize_selected_grid(){
    // Synthetic decoded-only 200MiB; NOT a genuine P1G, and NOT Rust WASM
    // product memory/heap acceptance. One huge selected Grid must be omitted.
    const MEG:usize=1024*1024;
    let mut doc=String::with_capacity(200*MEG+512);
    doc.push_str(r#"{"GameInfo":{"Version":626},"World":{"GridCollection":{"Grids":{"big":"#);
    doc.push('"');
    doc.extend(std::iter::repeat('x').take(200*MEG));
    doc.push_str(r#""},"DiffGrids":{}},"RecurringEvents":{"155":{"ItemSpawning":{"RecurringEventItemID":2010000021,"NextOccurrence":"2126-08-20T00:00:00Z","LastOccurrence":"2026-08-20T00:00:00Z","EndDate":"2027-08-20T00:00:00Z"}}},"Villages":[]}}"#);
    assert!(doc.len()>200*MEG && doc.len()<256*MEG);
    let paths:Vec<String>=vec![
        "/GameInfo/Version", "/World/GridCollection/Grids",
        "/World/GridCollection/DiffGrids",
        "/World/RecurringEvents/155/ItemSpawning/NextOccurrence",
        "/World/Villages"
    ].into_iter().map(String::from).collect();
    let old_sha=sha256(doc.as_bytes());
    let hits=index_selected_token_sha256(doc.as_bytes(),&paths,2*MEG).unwrap();
    assert_eq!(hits.len(),4);
    assert!(!hits.iter().any(|h|h.pointer=="/World/GridCollection/Grids"));
    let version=hits.iter().find(|h|h.pointer=="/GameInfo/Version").unwrap();
    assert_eq!(version.raw_sha256,sha256(b"626"));
    let time=hits.iter().find(|h|h.pointer.ends_with("/NextOccurrence")).unwrap();
    assert_eq!(time.raw_sha256,sha256(br#""2126-08-20T00:00:00Z""#));
    assert_eq!(old_sha,sha256(doc.as_bytes()));
}
#[test]
fn source_hashing_refuses_invalid_json_duplicate_watch_and_bounds(){
    let good=br#"{"GameInfo":{"Version":626},"World":{"Villages":[]}}"#;
    let p=vec![String::from("/GameInfo/Version")];
    assert_eq!(index_selected_token_sha256(good,&p,0).unwrap_err(),"INDEX_HASH_SPAN_BUDGET_INVALID");
    assert_eq!(index_selected_token_sha256(good,&[p[0].clone(),p[0].clone()],1024).unwrap_err(),"INDEX_DUPLICATE_WATCH");
    let invalid=br#"{"GameInfo":{"Version":626},"bad":"\q"}"#;
    assert!(index_selected_token_sha256(invalid,&p,1024).is_err());
}
