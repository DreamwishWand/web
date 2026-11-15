//! Static packaged-definition supplement for ACT964. No product authorization.
use serde_json::{json, Value};
use sha2::{Digest, Sha256};

const PACK: &[u8] = include_bytes!("../data/collection-effective-group-626.json");
const PACK_SHA: &str = "79919d427cf21f4466b94e3f5f3c9d32ceaadd568cf06379a15f0a6bf797468a";
const KEY_SHA: &str = "1226bc92f5c8c63e86eaa6aedfeca1b56a6e3ece86d574edb532cee595466127";

fn sha(bytes: &[u8]) -> String {
    format!("{:x}", Sha256::digest(bytes))
}

#[test]
fn fixed_pack_and_complete_group_keyset() {
    assert_eq!(PACK.len(), 1640);
    assert_eq!(sha(PACK), PACK_SHA);
    let p: Value = serde_json::from_slice(PACK).unwrap();
    assert_eq!(p["contract"], "wand.catalog.collection-effective-group@1");
    assert_eq!(p["authority"], "fixed-packaged-keyset-only");
    assert_eq!(p["writerAuthorized"], false);
    assert_eq!(p["baseEligibilityPackSha256"], "b9ebc7bebf2c3e1df274b9a98a7b7276896270faa303a41657ecc6c56db84f4f");
    assert_eq!(p["builds"], json!([
        {"platform":"SteamWindows","kind":"SteamFullVersion","id":"releases_1.25-v1.25.3-44-g0b41250d9ac0-incremental-22","schema":626},
        {"platform":"Switch","kind":"SwitchBid","id":"9A239D3DB569756D","schema":626}
    ]));
    let g = &p["group"];
    assert_eq!(g["definitionId"], 2120000159u64);
    assert_eq!(g["groupIndex"], 0);
    assert_eq!(g["effectiveKeySetSha256"], KEY_SHA);
    let ids: Vec<u64> = serde_json::from_value(g["effectiveItemIds"].clone()).unwrap();
    let candidates: Vec<u64> = serde_json::from_value(g["packagedCandidateIds"].clone()).unwrap();
    assert_eq!(ids.len(), 27);
    assert!(ids.windows(2).all(|w| w[0] < w[1]));
    assert_eq!(sha(&serde_json::to_vec(&ids).unwrap()), KEY_SHA);
    assert_eq!(candidates.len(), 3);
    assert!(candidates.windows(2).all(|w| w[0] < w[1]));
    assert!(candidates.iter().all(|i| ids.binary_search(i).is_ok()));
    assert_eq!(g["counts"], json!({"universeSets":8,"furnitureCandidates":34,"hiddenOrNameExcluded":8,"craftExcluded":1,"trimmingIncluded":2,"effective":27}));
}

#[test]
fn static_digest_cannot_be_reused_for_mutated_pack() {
    let p: Value = serde_json::from_slice(PACK).unwrap();
    for key in ["effectiveItemIds", "packagedCandidateIds"] {
        let mut q = p.clone();
        q["group"][key].as_array_mut().unwrap().pop();
        assert_ne!(sha(&serde_json::to_vec(&q).unwrap()), PACK_SHA);
    }
    let mut q = p.clone();
    q["writerAuthorized"] = json!(true);
    assert_ne!(sha(&serde_json::to_vec(&q).unwrap()), PACK_SHA);
    q = p.clone();
    q["builds"][0]["id"] = json!("9A239D3DB569756D");
    assert_ne!(sha(&serde_json::to_vec(&q).unwrap()), PACK_SHA);
}
