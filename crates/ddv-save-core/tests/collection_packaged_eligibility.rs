// Compile the isolated domain validator without wiring product authority.
use ddv_save_core::{BuildIdentity, BuildKind, Platform};
#[path = "../src/collection_packaged_eligibility.rs"]
mod collection_packaged_eligibility;
const PACK: &[u8] = include_bytes!("../data/collection-furniture-626.json");

use collection_packaged_eligibility::{packaged_collection_candidate,pinned};
use serde_json::Value;
const STEAM: &str = "releases_1.25-v1.25.3-44-g0b41250d9ac0-incremental-22";
const SWITCH: &str = "9A239D3DB569756D";
fn steam()->BuildIdentity { BuildIdentity{platform:Platform::SteamWindows,build_kind:BuildKind::SteamFullVersion,build_id:STEAM.into(),schema:626,externally_attested:true} }
fn switch()->BuildIdentity { BuildIdentity{platform:Platform::Switch,build_kind:BuildKind::SwitchBid,build_id:SWITCH.into(),schema:626,externally_attested:true} }
#[test]
fn all_catalog_rows_both_explicit_builds() {
    let p=pinned(PACK).unwrap();
    for r in p["items"].as_array().unwrap() {
        let i=r[0].as_u64().unwrap() as u32;
        let g=r[1].as_u64().unwrap() as u32;
        let a=packaged_collection_candidate(PACK,&steam(),i,g,0).unwrap();
        let b=packaged_collection_candidate(PACK,&switch(),i,g,0).unwrap();
        assert_eq!(a,b);
        assert_eq!(a.item_definition_sha256,r[2].as_str().unwrap());
    }
}
#[test]
fn unknown_build_group_item_and_index_deny() {
    let p=pinned(PACK).unwrap();
    let r=&p["items"][0];
    let i=r[0].as_u64().unwrap() as u32;
    let g=r[1].as_u64().unwrap() as u32;
    let mut a=steam();
    a.schema=624; assert!(packaged_collection_candidate(PACK,&a,i,g,0).is_none());
    a=steam(); a.externally_attested=false; assert!(packaged_collection_candidate(PACK,&a,i,g,0).is_none());
    a=steam(); a.build_id=SWITCH.into(); assert!(packaged_collection_candidate(PACK,&a,i,g,0).is_none());
    a=switch(); a.build_kind=BuildKind::SteamFullVersion; assert!(packaged_collection_candidate(PACK,&a,i,g,0).is_none());
    a=switch(); a.build_id="9a239d3db569756d".into(); assert!(packaged_collection_candidate(PACK,&a,i,g,0).is_none());
    a=steam(); a.build_id.push(' '); assert!(packaged_collection_candidate(PACK,&a,i,g,0).is_none());
    for a in [steam(),switch()] {
        assert!(packaged_collection_candidate(PACK,&a,i,g,1).is_none());
        assert!(packaged_collection_candidate(PACK,&a,i,g+1,0).is_none());
        assert!(packaged_collection_candidate(PACK,&a,0,g,0).is_none());
        assert!(packaged_collection_candidate(PACK,&a,30_000_001,g,0).is_none());
    }
}
#[test]
fn tampered_pack_deny_even_with_valid_json() {
    let mut p=pinned(PACK).unwrap();
    p["writerAuthorized"]=Value::Bool(true);
    assert!(pinned(&serde_json::to_vec(&p).unwrap()).is_none());
    let mut b=PACK.to_vec();b[0]=b'[';
    assert!(pinned(&b).is_none());
    assert!(pinned(&PACK[..PACK.len()-1]).is_none());
    let mut b=PACK.to_vec();b.push(b' ');
    assert!(pinned(&b).is_none());
}
