//! ACT1062: fixed installed Steam626 Vase placement/limit reference.
//! No Session, Reader, registry, command, or authority lives here.
//! The existing ProductSession binder must supply current typed observations
//! from its validated same-epoch document and prove effective provider,
//! subscriber, rights and reference predicates before Stage.
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use std::collections::{BTreeMap, BTreeSet};

pub(crate) const BUILD: &str = "releases_1.25-v1.25.3-44-g0b41250d9ac0-incremental-22";
const SHA: &str = "e30ce195d78b74551ffeef6b5c23ccbf10d962103deac8c4a1d8d4ce1c471400";
pub(crate) const GRID: &str = "GridData/Villages/Village04-DarkLevel-GridData.json";
const NX: usize = 250;
const NY: usize = 175;
const FLOOR_BYTES: usize = (NX * NY + 7) / 8;
pub(crate) const ITEM: u32 = 40000066;
pub(crate) type R<T> = Result<T, &'static str>;
pub(crate) struct GeometryPack {
    floor: Vec<u8>,
    dims: BTreeMap<u32, (u32, u32)>,
    excluded: BTreeSet<u32>,
}
fn need(ok: bool, reason: &'static str) -> R<()> {
    if ok { Ok(()) } else { Err(reason) }
}
fn u(v: &Value) -> R<u32> {
    v.as_u64().and_then(|n| u32::try_from(n).ok()).ok_or("VASE_GEOMETRY_UINT")
}
fn map(v: &Value) -> R<&serde_json::Map<String, Value>> {
    v.as_object().ok_or("VASE_GEOMETRY_MAP")
}
fn list(v: &Value) -> R<&Vec<Value>> { v.as_array().ok_or("VASE_GEOMETRY_LIST") }
fn key(s: &str) -> R<u32> {
    let n = s.parse::<u32>().map_err(|_| "VASE_GEOMETRY_KEY")?;
    need(n.to_string() == s, "VASE_GEOMETRY_KEY")?;
    Ok(n)
}
fn field<'a>(v: &'a Value, name: &str) -> R<&'a Value> {
    map(v)?.get(name).ok_or("VASE_GEOMETRY_FIELD")
}
/// Parse only the exact pinned installed-data projection. The product
/// provider must supply the approved fixed artifact, never caller data.
pub(crate) fn load(data: &str) -> R<GeometryPack> {
    need(format!("{:x}", Sha256::digest(data.as_bytes())) == SHA, "VASE_GEOMETRY_PACK_SHA")?;
    let mut lines = data.lines();
    let h: Value = serde_json::from_str(lines.next().ok_or("VASE_GEOMETRY_PACK")?)
        .map_err(|_| "VASE_GEOMETRY_PACK")?;
    need(h["contract"] == "wand.core.steam626.vase-geometry-quota-reference@1"
        && h["build"] == BUILD && h["schema"] == 626
        && h["authority"] == "REFERENCE_ONLY_FIXED_NORMAL_RETAIL"
        && h["gridPath"] == GRID && h["gridSize"] == json!([NX, NY])
        && h["tessellation"] == 2 && h["floorMask"] == 64
        && h["floorEncoding"] == "x-major-lsb0-hex" && h["floorCount"] == 11314
        && h["vase"] == json!([ITEM, 1, 1, 324, 130807039])
        && h["dimsCount"] == 6591 && h["excludedCount"] == 49
        && h["limits"] == json!([
          ["Village04ObjectLimit",600,3000,"6412c6019d56c560cad44548c19bc348418e23fe093975a1a50d3955a7f98a08"],
          ["HighEndVillageObjectLimit",1200,6000,"08708bdcca1525eb9a1183aab20de5864ff1141068e8aae4c74bd096e1e60fef"]]),
        "VASE_GEOMETRY_PACK_HEADER")?;
    let mut p = GeometryPack { floor: Vec::new(), dims: BTreeMap::new(), excluded: BTreeSet::new() };
    for l in lines {
        let v: Value = serde_json::from_str(l).map_err(|_| "VASE_GEOMETRY_PACK")?;
        let a = list(&v)?;
        match a.first().and_then(Value::as_str) {
            Some("floor") if a.len() == 3 => {
                need(u(&a[1])? as usize == p.floor.len(), "VASE_GEOMETRY_FLOOR_OFFSET")?;
                let s = a[2].as_str().ok_or("VASE_GEOMETRY_FLOOR_HEX")?;
                need(!s.is_empty() && s.len() <= 512 && s.len() % 2 == 0
                    && s.bytes().all(|b| b.is_ascii_digit() || (b'a'..=b'f').contains(&b)),
                    "VASE_GEOMETRY_FLOOR_HEX")?;
                for off in (0..s.len()).step_by(2) {
                    p.floor.push(u8::from_str_radix(&s[off..off+2],16).map_err(|_| "VASE_GEOMETRY_FLOOR_HEX")?);
                }
                need(p.floor.len() <= FLOOR_BYTES, "VASE_GEOMETRY_FLOOR_BOUND")?;
            }
            Some("dims") if a.len() == 4 => {
                let (w,h) = (u(&a[1])?,u(&a[2])?);
                let ids = list(&a[3])?;
                need((1..=256).contains(&w) && (1..=256).contains(&h)
                    && !ids.is_empty() && ids.len() <= 64, "VASE_GEOMETRY_DIMS")?;
                for x in ids {
                    let id=u(x)?;
                    need(matches!(id / 10_000_000,2|4) && p.dims.insert(id,(w,h)).is_none(),
                        "VASE_GEOMETRY_DIMS_ID")?;
                }
                need(p.dims.len() <= 6591,"VASE_GEOMETRY_DIMS_BOUND")?;
            }
            Some("excluded") if a.len() == 2 => {
                let ids=list(&a[1])?;
                need(!ids.is_empty() && ids.len()<=64,"VASE_GEOMETRY_EXCLUDED")?;
                for x in ids {
                    let id=u(x)?;
                    need(id/10_000_000==4 && id%10_000_000/100_000==1
                        && p.excluded.insert(id),"VASE_GEOMETRY_EXCLUDED_ID")?;
                }
                need(p.excluded.len()<=49,"VASE_GEOMETRY_EXCLUDED_BOUND")?;
            }
            _ => return Err("VASE_GEOMETRY_PACK_ROW"),
        }
    }
    need(p.floor.len()==FLOOR_BYTES && p.floor.last().is_some_and(|v|v&0xc0==0)
        && p.floor.iter().map(|b|b.count_ones()).sum::<u32>()==11314
        && p.dims.len()==6591 && p.dims.get(&ITEM)==Some(&(1,1)) && p.excluded.len()==49
        && p.excluded.iter().all(|id|p.dims.contains_key(id)),"VASE_GEOMETRY_PACK_COUNT")?;
    Ok(p)
}
fn build(build: &str, schema: u32) -> R<()> {
    need(build==BUILD && schema==626,"VASE_GEOMETRY_BUILD")
}
pub(crate) fn floor_halo(p: &GeometryPack, x:u32, y:u32) -> R<()> {
    // Preserve the prior conservative 12x12 raw-cell clearance proof, not
    // a generic 0x144 or floor permission. Each logical cell is tessellation 2.
    need(x%2==0 && y%2==0 && x>=4 && y>=4 && x.checked_add(8).is_some_and(|n|n<=500)
        && y.checked_add(8).is_some_and(|n|n<=350),"VASE_GEOMETRY_POSE_BOUND")?;
    for a in x-4..x+8 { for b in y-4..y+8 {
        let i=(a as usize/2)*NY+b as usize/2;
        need(p.floor[i/8] & (1u8<<(i%8)) != 0,"VASE_GEOMETRY_FLOOR")?;
    }}
    Ok(())
}
fn state(v: &Value) -> R<Option<(&str,&Value)>> {
    if v.is_null(){return Ok(None)}
    let o=map(v)?;
    need(o.len()==1,"VASE_GEOMETRY_STATE")?;
    let (name,payload)=o.iter().next().ok_or("VASE_GEOMETRY_STATE")?;
    need(payload.is_object(),"VASE_GEOMETRY_STATE")?;
    Ok(Some((name.as_str(),payload)))
}
fn pos(v: &Value) -> R<f64> {
    let x=v.as_f64().ok_or("VASE_GEOMETRY_AMBIENT_POSE")?;
    need(x.is_finite() && x.abs()<=1_000_000.,"VASE_GEOMETRY_AMBIENT_POSE")?;
    Ok(x)
}
/// Reference-only local proof. Input is the current validated selected Grid
/// from the existing indexed ProductSession reader, not a caller-authored plan.
/// Root, overlay and complete parent alias checks are also required by quota.
pub(crate) fn check_local_pose(p:&GeometryPack,build_id:&str,schema:u32,grid:&Value,gid:u32,x:u32,y:u32)->R<()> {
    build(build_id,schema)?;
    need(gid>0 && u(field(grid,"ID")?)?==gid && field(grid,"GridDataPath")?==GRID
        && field(grid,"GridDefaultLayoutPath")?=="" && u(field(grid,"TessellationFactor")?)?==2,
        "VASE_GEOMETRY_GRID")?;
    floor_halo(p,x,y)?;
    let objects=map(field(grid,"Objects")?)?;
    let next=u(field(grid,"NextGridObjectID")?)?;
    need(next>0 && !objects.is_empty() && objects.len()<=16384,"VASE_GEOMETRY_OBJECTS")?;
    for (k,o) in objects {
        let id=key(k)?;
        need(id>0 && id<next && u(field(o,"ID")?)?==id && !map(o)?.contains_key("From"),"VASE_GEOMETRY_OBJECT")?;
        let item=u(field(o,"ItemID")?)?;
        let (w,h)=*p.dims.get(&item).ok_or("VASE_GEOMETRY_UNKNOWN_DIMENSIONS")?;
        let s=state(field(o,"State")?)?;
        need(matches!(s,None|Some(("BuildingWithSkinData"|"HouseData"|"Keyhole",_))),"VASE_GEOMETRY_AMBIENT_STATE")?;
        need(matches!(field(o,"Orientation")?.as_str(),Some("GridOrientation_Up"|"GridOrientation_Right"|"GridOrientation_Down"|"GridOrientation_Left")),"VASE_GEOMETRY_AMBIENT_ORIENTATION")?;
        let (ox,oy)=(pos(field(o,"X")?)?,pos(field(o,"Y")?)?);
        // For the exact accepted no-area-override states, a symmetric raw
        // envelope around the anchor overbounds any cardinal orientation.
        let r=(2*(w+h)) as f64;
        let (l,t,rr,bb)=((x-4) as f64,(y-4) as f64,(x+8) as f64,(y+8) as f64);
        need(l.max(ox-r)>=rr.min(ox+r+1.) || t.max(oy-r)>=bb.min(oy+r+1.),"VASE_GEOMETRY_AMBIENT_OVERLAP")?;
    }
    Ok(())
}
/// This is a bounded view from the existing same-session indexed reader.
/// Its producer MUST compute exact global root and saved SubGrid incoming
/// counts and overlay presence from the current typed document. No public ABI
/// accepts this object. These fields are not an installed-provider proof.
pub(crate) struct GridObservation {
    pub(crate) grid: Value,
    pub(crate) root_refs: u32,
    pub(crate) parent_refs: u32,
    pub(crate) overlay: bool,
}
#[derive(Debug,PartialEq,Eq)]
pub(crate) struct QuotaBound {
    pub(crate) grids: usize,
    pub(crate) raw: usize,
    pub(crate) excluded: usize,
    pub(crate) post_unique_upper: usize,
    pub(crate) post_instance_upper: usize,
}
/// Iterate only the current Village's root/child closure, using one bounded
/// grid observation at a time. No duplicate Session/Reader or whole-document
/// decode. All unknown quota definitions, state kinds and aliases deny.
/// Count all distinct IDs and all records except exact GroundAlteration
/// membership; never subtract unproved exclusions or unknown IDs.
pub(crate) fn check_village_quota<F>(p:&GeometryPack,build_id:&str,schema:u32,village:&Value,extra:&Value,selected:u32,mut observe:F)->R<QuotaBound>
where F:FnMut(u32)->R<GridObservation> {
    build(build_id,schema)?;
    need(extra.is_boolean() && field(village,"VillageObjectLimitName")?=="Village04ObjectLimit"
        && field(village,"HighEndVillageObjectLimitName")?=="HighEndVillageObjectLimit"
        && field(village,"BoughtObjectLimit")?==&json!({"UniqueLimit":0,"InstanceLimit":0,"Exclusions":[],"SpecificItemLimits":[]}),
        "VASE_GEOMETRY_QUOTA_DEFINITION")?;
    let areas=map(field(village,"Areas")?)?;
    need(!areas.is_empty() && areas.len()<=4096,"VASE_GEOMETRY_QUOTA_AREAS")?;
    let mut roots=BTreeSet::new();
    let mut chosen=false;
    for (k,a) in areas {
        let aid=key(k)?;
        let ids=list(field(a,"GridIDs")?)?;
        need(ids.len()<=4096 && field(a,"Unlocked")?.is_boolean(),"VASE_GEOMETRY_QUOTA_AREA")?;
        for v in ids {
            let id=u(v)?;
            need(id>0 && roots.insert(id) && roots.len()<=4096,"VASE_GEOMETRY_QUOTA_ROOT_ALIAS")?;
            if id==selected {
                need(aid==6 && ids.len()==1 && field(a,"Unlocked")?.as_bool()==Some(true),"VASE_GEOMETRY_QUOTA_SELECTED_ROOT")?;
                chosen=true;
            }
        }
    }
    need(chosen,"VASE_GEOMETRY_QUOTA_SELECTED_ROOT")?;
    let mut pending:Vec<(u32,bool)>=roots.iter().map(|id|(*id,true)).collect();
    let mut seen=BTreeSet::new();
    let mut items=BTreeSet::new();
    let mut raw=0usize;let mut excluded=0usize;
    while let Some((id,is_root))=pending.pop(){
        need(seen.insert(id) && seen.len()<=4096,"VASE_GEOMETRY_QUOTA_GRAPH")?;
        let o=observe(id)?;
        need(!o.overlay && u(field(&o.grid,"ID")?)?==id && field(&o.grid,"GridDefaultLayoutPath")?==""
            && if is_root {o.root_refs==1&&o.parent_refs==0} else {o.root_refs==0&&o.parent_refs==1},"VASE_GEOMETRY_QUOTA_GRID_ALIAS")?;
        let objects=map(field(&o.grid,"Objects")?)?;
        need(objects.len()<=16384,"VASE_GEOMETRY_QUOTA_OBJECT_BOUND")?;
        for (k,v) in objects {
            need(key(k)?==u(field(v,"ID")?)?,"VASE_GEOMETRY_QUOTA_OBJECT_ID")?;
            let item=u(field(v,"ItemID")?)?;
            need(item>0 && item<=i32::MAX as u32,"VASE_GEOMETRY_QUOTA_ITEM")?;
            items.insert(item);raw+=1;
            need(raw<=50_000,"VASE_GEOMETRY_QUOTA_BOUND")?;
            if p.excluded.contains(&item){excluded+=1;}
            match state(field(v,"State")?)? {
                None=>{},
                Some(("SubGrid",s))=>{
                    let child=u(field(s,"GridID")?)?;
                    need(child>0 && !roots.contains(&child) && !seen.contains(&child)
                        && !pending.iter().any(|(x,_)|*x==child) && pending.len()<4096,"VASE_GEOMETRY_QUOTA_CHILD_ALIAS")?;
                    pending.push((child,false));
                }
                Some(("BuildingWithSkinData"|"FenceMode"|"FishingStallData"|"GardenData"|"HouseData"|"ItemList"|"Keyhole"|"StallData"|"Toggle",_))=>{},
                _=>return Err("VASE_GEOMETRY_QUOTA_STATE"),
            }
        }
    }
    // Enforce both installed limits, independent of ExtraLimitObject.
    // Specific limits and purchased extensions are excluded by the exact
    // pinned records and current BoughtObjectLimit shape above.
    let post_unique_upper=items.len()+1;
    let post_instance_upper=raw-excluded+1;
    need(post_unique_upper<=600 && post_instance_upper<=3000,"VASE_GEOMETRY_QUOTA_LIMIT")?;
    Ok(QuotaBound{grids:seen.len(),raw,excluded,post_unique_upper,post_instance_upper})
}

