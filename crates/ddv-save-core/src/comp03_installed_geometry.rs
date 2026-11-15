//! Installed Steam626 COMP03 geometry, not a target or permission registry.
//! Core must bind the external Build, installed data/provider identity, exact
//! typed direct roots, distinct sibling and all saved references in its own
//! ProductSession before using this local proof. Never expose this as a
//! caller-controlled attestation. No session, I/O, mutation or edit authority.
use serde_json::{json, Value};
use sha2::{Digest, Sha256};

const PACK: &str = include_str!("comp03_installed_geometry.json");
const PACK_SHA256: &str = "a1fdec93eb98e8a54227c32a2deec969b26415a4d4d10245446f21a238584196";
const MAX_OBJECTS: usize = 4096;
const MAX_COORD: u32 = 260;
const MAX_NEXT: u32 = i32::MAX as u32 - 8;

pub(crate) struct InstalledGeometry(Value);
#[derive(Debug, PartialEq, Eq)]
pub(crate) struct LocalGeometry {
    pub(crate) seed_x: u32,
    pub(crate) seed_y: u32,
    pub(crate) next: u32,
}

fn num(v: &Value) -> Option<u32> { v.as_u64()?.try_into().ok() }
fn overlap(a: (i64, i64, i64, i64), b: (i64, i64, i64, i64)) -> bool {
    a.0.max(b.0) < a.2.min(b.2) && a.1.max(b.1) < a.3.min(b.3)
}

impl InstalledGeometry {
    /// Internal compiled data only. Its hash is an integrity pin, not evidence
    /// that an arbitrary save or runtime provider uses the installed assets.
    pub(crate) fn fixed() -> Option<Self> {
        if format!("{:x}", Sha256::digest(PACK.as_bytes())) != PACK_SHA256 { return None; }
        let v: Value = serde_json::from_str(PACK).ok()?;
        if v["contract"] != "wand.steam626.comp03.installed-geometry@1" { return None; }
        Some(Self(v))
    }
    pub(crate) fn data(&self) -> &Value { &self.0 }
    pub(crate) fn dimensions(&self, item: u32) -> Option<(u32, u32)> {
        for group in self.0["ambientCardinalGroups"].as_array()? {
            let g = group.as_array()?;
            if g.len() != 4 { return None; }
            let prefix = num(&g[0])?;
            if let Some(offset) = item.checked_sub(prefix) {
                if g[3].as_array()?.iter().any(|v| num(v) == Some(offset)) {
                    return Some((num(&g[1])?, num(&g[2])?));
                }
            }
        }
        None
    }
    fn expected_well(&self) -> Option<Value> {
        let w = &self.0["ambientWell"];
        Some(json!({"ID":0,"ItemID":num(&w["itemId"])? ,
            "X":num(&w["savedXY"][0])?,"Y":num(&w["savedXY"][1])?,
            "Orientation":w["orientation"],"State":{"BuildingWithSkinData":{
                "UpgradeState":{"Level":num(&w["requiredUpgradeLevel"])?},
                "CurrentSkinItemID":num(&w["defaultSkinId"])?}}}))
    }
    /// Pure local saved geometry, with the sibling well already obtained from
    /// the same Core-owned session. Does NOT prove sibling/root identity,
    /// no DiffGrid aliases, rights, stock, effective provider, or references.
    /// The caller must independently close those predicates before Stage.
    pub(crate) fn local_geometry(&self, grid: &Value, sibling_well: &Value, seed_id: u32) -> Option<LocalGeometry> {
        let root = &self.0["roots"][0];
        if num(&grid["ID"])? == 0 || grid["GridDataPath"] != root["gridDataPath"]
            || grid["GridDefaultLayoutPath"] != "" || num(&grid["TessellationFactor"])? != 2 { return None; }
        let n = num(&grid["NextGridObjectID"])?;
        if n == 0 || n > MAX_NEXT || seed_id == 0 || seed_id >= n { return None; }
        let objects = grid["Objects"].as_object()?;
        if objects.len() > MAX_OBJECTS { return None; }
        let well = self.expected_well()?;
        if objects.get("0")? != &well || sibling_well != &well { return None; }
        let seed = objects.get(&seed_id.to_string())?;
        let x = num(&seed["X"])?; let y = num(&seed["Y"])?;
        if x % 4 != 0 || y % 4 != 0 || x.checked_add(12)? > MAX_COORD || y.checked_add(12)? > MAX_COORD
            || num(&seed["ID"])? != seed_id || seed["ItemID"] != self.0["road"]["itemId"]
            || seed["Orientation"] != self.0["road"]["orientation"] || !seed["State"].is_null() { return None; }
        if num(&root["floorMask"])? & num(&self.0["road"]["acceptedFloorMask"])? == 0 { return None; }
        let (hx, hy) = (i64::from(x), i64::from(y));
        let halo = (hx - 4, hy - 4, hx + 16, hy + 16);
        for (key, o) in objects {
            let map = o.as_object()?;
            if map.len() != 6 || !["ID","ItemID","X","Y","Orientation","State"].iter().all(|k| map.contains_key(*k)) { return None; }
            let id = num(&o["ID"])?;
            if key != &id.to_string() || id >= n { return None; }
            if id == seed_id { continue; }
            let ox = num(&o["X"])?; let oy = num(&o["Y"])?;
            if id == 0 {
                if o != &well { return None; }
                let w = num(&self.0["ambientWell"]["rawSize"][0])?;
                let h = num(&self.0["ambientWell"]["rawSize"][1])?;
                let r = 2 * i64::from(w.checked_add(h)?);
                let (a,b) = (i64::from(ox),i64::from(oy));
                if overlap(halo,(a-r,b-r,a+r+1,b+r+1)) { return None; }
                continue;
            }
            if !o["State"].is_null() { return None; }
            let (mut w,mut h) = self.dimensions(num(&o["ItemID"])?)?;
            match o["Orientation"].as_str()? {
                "GridOrientation_Up" | "GridOrientation_Down" => (),
                "GridOrientation_Left" | "GridOrientation_Right" => std::mem::swap(&mut w,&mut h),
                _ => return None,
            }
            let ex = ox.checked_add(w.checked_mul(2)?)?;
            let ey = oy.checked_add(h.checked_mul(2)?)?;
            if ex > MAX_COORD || ey > MAX_COORD || overlap(halo,(i64::from(ox),i64::from(oy),i64::from(ex),i64::from(ey))) { return None; }
        }
        Some(LocalGeometry { seed_x:x, seed_y:y, next:n })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    fn fixture(data: &InstalledGeometry) -> (Value,Value) {
        let well=data.expected_well().unwrap();
        let grid=json!({"ID":90001,"GridDataPath":data.data()["roots"][0]["gridDataPath"],
            "GridDefaultLayoutPath":"","TessellationFactor":2,"NextGridObjectID":600,
            "Objects":{"0":well,"500":{"ID":500,"ItemID":40100038,"X":16,"Y":24,"Orientation":"GridOrientation_Down","State":null},
                "501":{"ID":501,"ItemID":40700252,"X":70,"Y":70,"Orientation":"GridOrientation_Left","State":null}}});
        (grid,well)
    }
    #[test]
    fn installed_projection_exact_groups_and_nonfixture_ids() {
        let d=InstalledGeometry::fixed().unwrap(); let p=d.data();
        assert_eq!(p["build"]["platform"],"SteamWindows"); assert_eq!(p["build"]["schema"],626);
        assert_eq!(p["roots"][0]["floorMask"],128); assert_eq!(p["roots"][1]["floorMask"],16);
        let mut ids=std::collections::BTreeSet::new();
        for g in p["ambientCardinalGroups"].as_array().unwrap() {
            for v in g[3].as_array().unwrap() {
                let id=num(&g[0]).unwrap()+num(v).unwrap(); assert!(ids.insert(id));
                assert_eq!(d.dimensions(id),Some((num(&g[1]).unwrap(),num(&g[2]).unwrap())));
            }
        }
        assert_eq!(ids.len(),213);
        for excluded in [40100085,40100086,40100091,40100092,40700253,40000066,20300048,0] { assert!(d.dimensions(excluded).is_none()); }
        let (g,w)=fixture(&d); assert_eq!(d.local_geometry(&g,&w,500),Some(LocalGeometry{seed_x:16,seed_y:24,next:600}));
        let mut alt=g.clone(); alt["Objects"]["500"]["X"]=json!(248); alt["Objects"]["500"]["Y"]=json!(248);
        assert_eq!(d.local_geometry(&alt,&w,500),Some(LocalGeometry{seed_x:248,seed_y:248,next:600}));
    }
    #[test]
    fn local_geometry_fail_closed_and_no_generic_id0() {
        let d=InstalledGeometry::fixed().unwrap(); let (g,w)=fixture(&d);
        let mut cases=Vec::new();
        for (field,value) in [("GridDataPath",json!("foreign")),("GridDefaultLayoutPath",json!("overlay")),("TessellationFactor",json!(1)),("NextGridObjectID",json!(501)),("NextGridObjectID",json!(2147483640)),("ID",json!(0))] {
            let mut v=g.clone();v[field]=value;cases.push(v);
        }
        for (id,field,value) in [("500","X",json!(1)),("500","Y",json!(252)),("500","Orientation",json!("GridOrientation_Up")),("500","State",json!({})),("501","ItemID",json!(40100085)),("501","ItemID",json!(40000066)),("501","ID",json!(502)),("501","Orientation",json!("GridOrientation_UpRight")),("501","X",json!(20)),("501","State",json!({"unknown":{}})),("501","From",json!({})),("0","ItemID",json!(40100038)),("0","X",json!(121))] {
            let mut v=g.clone();v["Objects"][id][field]=value;cases.push(v);
        }
        // A footprint at (20,24) overlaps the seed's 3x3 halo.
        let mut v=g.clone();v["Objects"]["501"]["X"]=json!(20);v["Objects"]["501"]["Y"]=json!(24);cases.push(v);
        // X-only change at Y=70 is deliberately not a collision; use the full
        // paired case above, retaining the rest of the negative matrix.
        cases.retain(|v| !(v["Objects"]["501"]["X"]==20 && v["Objects"]["501"]["Y"]==70));
        for v in cases { assert!(d.local_geometry(&v,&w,500).is_none()); }
        let mut bad=w.clone();bad["State"]["BuildingWithSkinData"]["UpgradeState"]["Level"]=json!(2);
        assert!(d.local_geometry(&g,&bad,500).is_none()); assert!(d.local_geometry(&g,&w,0).is_none());
    }
}
