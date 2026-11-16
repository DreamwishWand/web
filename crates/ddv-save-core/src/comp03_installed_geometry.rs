//! Installed Steam626 COMP03 geometry, not a target or permission registry.
//! Core must bind the external Build, installed data/provider identity, exact
//! typed direct roots, distinct sibling and all saved references in its own
//! ProductSession before using this local proof. Never expose this as a
//! caller-controlled attestation. No session, I/O, mutation or edit authority.
use serde_json::{json, Value};
use sha2::{Digest, Sha256};

// Exact installed-only projection, generated from pinned asset definitions. No file ingestion.
const PACK: &str = r#"{"ambientCardinalGroups":[[40100000,2,2,[6,8,9,10,12,14,15,16,18,19,20,21,30,31,32,33,34,35,36,37,38,39,40,41,42,43,50,53,54,55,56,57,58,59,60,62,64,65,66,67,68,75,76,82,87]],[40700000,1,1,[0,7,9,14,15,21,22,28,29,35,36,42,43,49,50,57,60,61,67,68,75,81,82,88,104,105,112,113,191,192,202,207,213,214,224,225,246,247,257,258,268,269,279,280,295,300,306,311]],[40700000,2,1,[2,8,16,23,30,37,44,51,62,69,76,83,106,114,193,208,215,226,248,259,270,281,301,312]],[40700000,3,1,[10,17,24,31,38,45,52,58,63,70,77,84,107,115,194,209,216,227,249,260,271,282,302,313]],[40700000,4,1,[4,11,18,25,32,39,46,53,64,71,78,85,108,116,195,210,217,228,250,261,272,283,303,314]],[40700000,5,1,[12,19,26,33,40,47,54,59,65,72,79,86,109,117,196,211,218,229,251,262,273,284,304,315]],[40700000,6,1,[6,13,20,27,34,41,48,55,66,73,80,87,110,118,197,212,219,230,252,263,274,285,305,316]]],"ambientWell":{"defaultSkinId":170200005,"definitionSha256":"6dbf31272daba3b08c4bf18d03afb991cce55caba6ed55ff45635b223195a513","itemId":20300048,"orientation":"GridOrientation_Down","rawSize":[10,10],"requiredUpgradeLevel":1,"savedXY":[120,120],"skinDefinitionSha256":"e0bdfc964ef21998c1ce0c3706e5ee65b38991bcaa2a97733ea173d27e289308","stateType":"BuildingWithSkinData","templateObjectId":0,"templateXY":[60,60]},"boundary":"geometry-only; fixed normal-retail definition identity required; unknown ambient item/state/override deny; not a target, provider, rights, reference or stage authorization","build":{"fullVersion":"releases_1.25-v1.25.3-44-g0b41250d9ac0-incremental-22","platform":"SteamWindows","schema":626},"contract":"wand.steam626.comp03.installed-geometry@1","excludedDiagonalCount":96,"excludedOnlineOrSpecialCount":4,"road":{"acceptedFloorMask":97247487,"inventoryDelta":0,"itemId":40100038,"orientation":"GridOrientation_Down","rawLayers":[1,1,1,1],"rawSize":[2,2],"recordSha256":"6c5aa8de314ba472c8f97955b71c2e28606927028e489e535cfbea66c85db669","savedPitch":4,"side":3,"stride":2},"roots":[{"customLocationsPath":"SceneLayouts/FloatingIslands/FloatingIsland_Snow/CustomLocations.json","floorMask":128,"gridDataPath":"GridData/FloatingIslands/FloatingIsland_Snow/FloatingIsland_SnowGrid-GridData.json","gridSize":[130,130],"layoutPath":"SceneLayouts/FloatingIslands/FloatingIsland_Snow/FloatingIsland_SnowLayout.json","layoutTessellation":1,"role":"target","savedTessellation":2,"sceneDefinitionSha256":"09e1a519a977ff8f1d9cd394cde2a0745c313d990e5792fb492f079491233397","sceneItemId":1540000150},{"customLocationsPath":"SceneLayouts/FloatingIslands/FloatingIsland_Savannah/CustomLocations.json","floorMask":16,"gridDataPath":"GridData/FloatingIslands/FloatingIsland_Savannah/FloatingIsland_SavannahGrid-GridData.json","gridSize":[130,130],"layoutPath":"SceneLayouts/FloatingIslands/FloatingIsland_Savannah/FloatingIsland_SavannahLayout.json","layoutTessellation":1,"role":"siblingWitness","savedTessellation":2,"sceneDefinitionSha256":"9baa9070bee1e2e95f45b364d039b4cf5e5749496721af17f8c9768c0bd459c1","sceneItemId":1540000153}],"sourceSha256":{"Building.json":"c111aea8770c2b210d4e544a7562d3d08a068b1427842f604f878ea8f4d294a3","FloatingIsland_SavannahGrid-GridData.json":"51abc3a15239e83546761e76b6b9f477eef47150569f9ba19c19d66cbfdf0851","FloatingIsland_SavannahLayout.json":"4301f4d0fa5fd95390b15b0d2fcc9d677b1b8ad1e0cc3008476eea1be59d92fb","FloatingIsland_SnowGrid-GridData.json":"361e192189d6fcb684164c62551362a76ff3b33bf8937c231366a05dd112efc0","FloatingIsland_SnowLayout.json":"e910527d23d713c8af0eeb3b54898d629dc511d3d5db5a1f37af5c6ff7c13c1f","FullVersion.txt":"763d42f58ed345430ced4627af6dddd8c31a941e3a6a2de30cba3408cd4aabb4","Furniture.json":"823316081efe513c3920ff5a870fae03b68fa5f6ff6be2de0de5c5eb87aaa674","Scene.json":"836e9c1db2a20a7e6b950043b06aa093a6022e9f024f9cdd68beec276938c8fc","Skin.json":"c776f67f00a35f3359b9c309548d966a3d61d7cb80c9bce7fdf8e5c047b03523","protoDb.bin":"1912bb552abddac8b112fa5a781a0401672add38a62276d6c9174db39b899ae1"}}
"#;
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
