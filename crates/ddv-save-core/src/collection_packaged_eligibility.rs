//! ACT964: catalog-only candidate lookup. This module grants no edit authority.
//! The ProductSession must separately prove current exact Build, raw target,
//! unique saved membership, positive Catalog0 stock, effective definition,
//! visibility/rights and noncompleting false->true CAS at the same epoch.
//! Do not expose this lookup as a Worker authorization or caller-supplied pack.
use crate::{BuildIdentity, BuildKind, Platform};
use serde_json::Value;
use sha2::{Digest, Sha256};

const SHA: &str = "b9ebc7bebf2c3e1df274b9a98a7b7276896270faa303a41657ecc6c56db84f4f";
const STEAM: &str = "releases_1.25-v1.25.3-44-g0b41250d9ac0-incremental-22";
const SWITCH: &str = "9A239D3DB569756D";

#[derive(Debug, PartialEq, Eq)]
pub(crate) struct PackagedCollectionCandidate {
    pub(crate) item_id: u32,
    pub(crate) definition_id: u32,
    pub(crate) item_definition_sha256: String,
    pub(crate) collection_definition_sha256: String,
    pub(crate) group_definition_sha256: String,
}

fn digest(bytes: &[u8]) -> String {
    format!("{:x}", Sha256::digest(bytes))
}

fn hash(v: &Value) -> Option<&str> {
    let s = v.as_str()?;
    (s.len() == 64 && s.bytes().all(|b| matches!(b,b'0'..=b'9'|b'a'..=b'f'))
        && s.bytes().any(|b| b != b'0')).then_some(s)
}

pub(crate) fn pinned(bytes: &[u8]) -> Option<Value> {
    if bytes.len() != 5608 || digest(bytes) != SHA { return None; }
    let p: Value = serde_json::from_slice(bytes).ok()?;
    if p["contract"] != "wand.catalog.collection-furniture-exact1@1"
        || p["authority"] != "packaged-candidate-only"
        || p["writerAuthorized"] != false
        || p["builds"] != serde_json::json!([
            {"platform":"SteamWindows","kind":"SteamFullVersion","id":STEAM,"schema":626},
            {"platform":"Switch","kind":"SwitchBid","id":SWITCH,"schema":626}])
    { return None; }
    let groups = p["groups"].as_array()?;
    let items = p["items"].as_array()?;
    if groups.len() != 10 || items.len() != 33 { return None; }
    let mut gids = std::collections::BTreeSet::new();
    let mut prev = 0;
    for r in groups {
        let a = r.as_array()?;
        if a.len()!=3 { return None; }
        let id = a[0].as_u64()?;
        if id/10_000_000 != 212 || id<=prev || !gids.insert(id) { return None; }
        hash(&a[1])?; hash(&a[2])?; prev=id;
    }
    prev=0;
    let mut used = std::collections::BTreeSet::new();
    for r in items {
        let a = r.as_array()?;
        if a.len()!=3 { return None; }
        let id = a[0].as_u64()?;
        let group = a[1].as_u64()?;
        if id/100_000 != 400 || id<=prev || !gids.contains(&group) { return None; }
        hash(&a[2])?; prev=id; used.insert(group);
    }
    if used != gids { return None; }
    Some(p)
}

fn supported(b: &BuildIdentity) -> bool {
    b.schema == 626 && b.externally_attested &&
        ((b.platform == Platform::SteamWindows && b.build_kind == BuildKind::SteamFullVersion && b.build_id == STEAM)
        || (b.platform == Platform::Switch && b.build_kind == BuildKind::SwitchBid && b.build_id == SWITCH))
}

/// Static membership only. Group zero means the single packaged group;
/// it is not proof of the saved group or any current false flag/stock.
/// The trusted bytes are supplied internally by Core; their exact digest is
/// pinned here. This is not a Worker-facing API or a permission token.
pub(crate) fn packaged_collection_candidate(
    trusted_pack: &[u8], build: &BuildIdentity, item_id: u32, definition_id: u32, group_index: usize,
) -> Option<PackagedCollectionCandidate> {
    if !supported(build) || group_index != 0 { return None; }
    let p = pinned(trusted_pack)?;
    let row = p["items"].as_array()?.iter().find(|r|
        r[0].as_u64()==Some(u64::from(item_id)) && r[1].as_u64()==Some(u64::from(definition_id)))?;
    let group = p["groups"].as_array()?.iter().find(|r|r[0].as_u64()==Some(u64::from(definition_id)))?;
    Some(PackagedCollectionCandidate {
        item_id, definition_id,
        item_definition_sha256: hash(&row[2])?.to_owned(),
        collection_definition_sha256: hash(&group[1])?.to_owned(),
        group_definition_sha256: hash(&group[2])?.to_owned(),
    })
}

