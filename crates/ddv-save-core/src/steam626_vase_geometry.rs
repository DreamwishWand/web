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
/// Narrow ACT1136 ordinary fresh-load ambient bounds. The existing fixed
/// GeometryPack SHA binds the Steam/Switch common Furniture definition.
/// Switch ActivityItem is a separate exact installed-definition witness;
/// the existing Steam-only build() gate is NOT widened by this helper.
/// Caller must prove its same-session build/provider, fresh epoch and no
/// overlay; keyhole callback must resolve the current World.Keyholes GUID.
fn scoped_ambient_radius<F>(p:&GeometryPack,build_id:&str,o:&Value,mut keyhole:F)->R<f64>
where F:FnMut(&str)->R<()> {
    let item=u(field(o,"ItemID")?)?;
    let orientation=field(o,"Orientation")?.as_str().ok_or("VASE_GEOMETRY_AMBIENT_ORIENTATION")?;
    let s=state(field(o,"State")?)?;
    if matches!(orientation,"GridOrientation_Up"|"GridOrientation_Right"|"GridOrientation_Down"|"GridOrientation_Left") {
        let (w,h)=*p.dims.get(&item).ok_or("VASE_GEOMETRY_UNKNOWN_DIMENSIONS")?;
        need(matches!(s,None|Some(("BuildingWithSkinData"|"HouseData"|"Keyhole",_))),"VASE_GEOMETRY_AMBIENT_STATE")?;
        return Ok((2*(w+h)) as f64);
    }
    // No From, serialized GridArea cache or unknown saved fields on the
    // newly admitted exact noncardinal records. Ordinary cardinal scope unchanged.
    let m=map(o)?;
    need(m.len()==6 && ["ID","ItemID","X","Y","Orientation","State"].iter().all(|k|m.contains_key(*k))
        && u(field(o,"ID")?)?>0 && field(o,"X")?.as_i64().is_some() && field(o,"Y")?.as_i64().is_some(),
        "VASE_GEOMETRY_AMBIENT_EXACT_SHAPE")?;
    const SWITCH626_BID:&str="9A239D3DB569756D";
    match (build_id,item,orientation,s) {
        (BUILD|SWITCH626_BID,40001075,"GridOrientation_DownDownRight",Some(("Keyhole",payload)))=>{
            need(p.dims.get(&item)==Some(&(4,3)) && map(payload)?.len()==1,"VASE_GEOMETRY_AMBIENT_KEYHOLE")?;
            let guid=field(payload,"KeyholeConfigDataGUID")?.as_str().ok_or("VASE_GEOMETRY_AMBIENT_KEYHOLE")?;
            need(!guid.is_empty()&&guid.len()<=128,"VASE_GEOMETRY_AMBIENT_KEYHOLE")?;
            keyhole(guid)?;
            Ok(14.)
        },
        // E2425 exact ActivityItem record 6339f09d...; 2x2, 4*0x44,
        // Floor130802943; ACT1136 no override. Not a generic major3 dimension.
        (SWITCH626_BID,31400039,"GridOrientation_DownRightRight",None)=>{
            need(!p.dims.contains_key(&item),"VASE_GEOMETRY_AMBIENT_ACTIVITY_DUPLICATE")?;
            Ok(8.)
        },
        _=>Err("VASE_GEOMETRY_AMBIENT_ORIENTATION"),
    }
}

/// Reference-only local proof. Input is the current validated selected Grid
/// from the existing indexed ProductSession reader, not a caller-authored plan.
/// Root, overlay and complete parent alias checks are also required by quota.
pub(crate) fn check_local_pose(p:&GeometryPack,build_id:&str,schema:u32,grid:&Value,gid:u32,x:u32,y:u32)->R<()> {
    // Preserve the original call surface: new noncardinal Keyhole requires
    // a same-session World.Keyholes binding, never a default grant.
    check_local_pose_with_ambient(p,build_id,schema,grid,gid,x,y,|_|Err("VASE_GEOMETRY_AMBIENT_KEYHOLE"))
}
pub(crate) fn check_local_pose_with_ambient<F>(p:&GeometryPack,build_id:&str,schema:u32,grid:&Value,gid:u32,x:u32,y:u32,mut keyhole:F)->R<()>
where F:FnMut(&str)->R<()> {
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
        let r=scoped_ambient_radius(p,build_id,o,&mut keyhole)?;
        let (ox,oy)=(pos(field(o,"X")?)?,pos(field(o,"Y")?)?);
        // Existing symmetric raw envelope; new exact ACT1136 bounds only.
        // No change to the half-open separating-axis collision predicate.
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
            need((id>0 || (id==0 && aid==7 && ids.len()==1 && field(a,"Unlocked")?.as_bool()==Some(true)))
                && roots.insert(id) && roots.len()<=4096,"VASE_GEOMETRY_QUOTA_ROOT_ALIAS")?;
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
        // Grid zero is a real Village root only in the exact supported SnowLevel scope.
        // The typed reference producer must exclude verified Realm-local puzzle IDs,
        // not arbitrary zero aliases; the ordinary root/parent check above remains.
        if id==0 {
            need(is_root && selected!=0 && field(&o.grid,"GridDataPath")?=="GridData/Villages/Village04-SnowLevel-GridData.json"
                && u(field(&o.grid,"TessellationFactor")?)?==2,"VASE_GEOMETRY_QUOTA_ZERO_ROOT")?;
        }
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


#[cfg(test)]
mod zero_root_tests {
    use super::*;

    fn fixture() -> (Value, BTreeMap<u32, Value>) {
        let village=json!({"VillageObjectLimitName":"Village04ObjectLimit",
            "HighEndVillageObjectLimitName":"HighEndVillageObjectLimit",
            "BoughtObjectLimit":{"UniqueLimit":0,"InstanceLimit":0,"Exclusions":[],"SpecificItemLimits":[]},
            "Areas":{"6":{"Unlocked":true,"GridIDs":[7]},"7":{"Unlocked":true,"GridIDs":[0]}}});
        let mut grids=BTreeMap::new();
        grids.insert(0,json!({"ID":0,"GridDataPath":"GridData/Villages/Village04-SnowLevel-GridData.json",
            "GridDefaultLayoutPath":"","TessellationFactor":2,"Objects":{}}));
        grids.insert(7,json!({"ID":7,"GridDataPath":GRID,"GridDefaultLayoutPath":"",
            "TessellationFactor":2,"Objects":{}}));
        (village,grids)
    }

    fn run(v:&Value, grids:&BTreeMap<u32,Value>, selected:u32, root_refs:u32,
        parent_refs:u32, overlay:bool) -> R<QuotaBound> {
        // Quota-only synthetic pack: installed pack SHA and floor/pose tests are separate.
        // Avoid introducing a second embedded data include in this module.
        let pack=GeometryPack{floor:Vec::new(),dims:BTreeMap::new(),excluded:BTreeSet::new()};
        check_village_quota(&pack,BUILD,626,v,&json!(false),selected,|id|{
            Ok(GridObservation{grid:grids.get(&id).ok_or("TEST_GRID_MISSING")?.clone(),
                root_refs:if id==0 {root_refs} else {1},
                parent_refs:if id==0 {parent_refs} else {0},
                overlay:id==0&&overlay})
        })
    }

    #[test]
    fn canonical_village_zero_root_is_counted_without_granting_zero_target() {
        let (v,g)=fixture();
        let q=run(&v,&g,7,1,0,false).unwrap();
        assert_eq!(q.grids,2);
        assert_eq!((q.raw,q.excluded,q.post_unique_upper,q.post_instance_upper),(0,0,1,1));
        for i in 0..13 {
            let (mut v,mut g)=fixture();
            let (mut selected,mut roots,mut parents,mut overlay)=(7,1,0,false);
            match i {
                0=>{let a=v["Areas"].as_object_mut().unwrap();let z=a.remove("7").unwrap();a.insert("8".into(),z);},
                1=>v["Areas"]["7"]["Unlocked"]=json!(false),
                2=>v["Areas"]["7"]["GridIDs"]=json!([0,8]),
                3=>v["Areas"]["8"]=json!({"Unlocked":true,"GridIDs":[0]}),
                4=>g.get_mut(&0).unwrap()["GridDataPath"]=json!("other"),
                5=>g.get_mut(&0).unwrap()["TessellationFactor"]=json!(1),
                6=>g.get_mut(&0).unwrap()["ID"]=json!(8),
                7=>g.get_mut(&0).unwrap()["GridDefaultLayoutPath"]=json!("other"),
                8=>roots=2,
                9=>parents=1,
                10=>overlay=true,
                11=>selected=0,
                _=>g.get_mut(&7).unwrap()["Objects"]=json!({"1":{"ID":1,"ItemID":ITEM,"State":{"SubGrid":{"GridID":0}}}}),
            }
            assert!(run(&v,&g,selected,roots,parents,overlay).is_err(),"zero root negative {i}");
        }
    }
}

#[cfg(test)]
mod ambient_scope_tests {
    use super::*;
    fn pack()->GeometryPack {
        GeometryPack{floor:Vec::new(),dims:BTreeMap::from([(40001075,(4,3)),(ITEM,(1,1))]),excluded:BTreeSet::new()}
    }
    fn kh()->Value {json!({"ID":1,"ItemID":40001075,"X":20,"Y":30,
        "Orientation":"GridOrientation_DownDownRight","State":{"Keyhole":{"KeyholeConfigDataGUID":"synthetic-keyhole"}}})}
    fn activity()->Value {json!({"ID":2,"ItemID":31400039,"X":40,"Y":50,
        "Orientation":"GridOrientation_DownRightRight","State":null})}
    fn match_keyhole(guid:&str)->R<()> {need(guid=="synthetic-keyhole","TEST_KEYHOLE_ENDPOINT")}
    #[test]
    fn exact_ambient_radius_and_denials() {
        let p=pack();let sw="9A239D3DB569756D";
        assert_eq!(scoped_ambient_radius(&p,BUILD,&kh(),match_keyhole).unwrap(),14.);
        assert_eq!(scoped_ambient_radius(&p,sw,&kh(),match_keyhole).unwrap(),14.);
        assert_eq!(scoped_ambient_radius(&p,sw,&activity(),match_keyhole).unwrap(),8.);
        let ordinary=json!({"ID":3,"ItemID":ITEM,"X":0,"Y":0,"Orientation":"GridOrientation_Up","State":null});
        assert_eq!(scoped_ambient_radius(&p,BUILD,&ordinary,match_keyhole).unwrap(),4.);
        for i in 0..11 {
            let mut o=kh();let mut b=BUILD;
            match i {
                0=>{o["gridArea"]=json!({});},
                1=>{o["From"]=json!({});},
                2=>{o["ItemID"]=json!(40001076);},
                3=>{o["Orientation"]=json!("GridOrientation_DownRight");},
                4=>{o["ID"]=json!(0);},
                5=>{o["X"]=json!(20.5);},
                6=>{o["State"]["Extra"]=json!({});},
                7=>{o["State"]["Keyhole"]["Extra"]=json!({});},
                8=>{o["State"]["Keyhole"]["KeyholeConfigDataGUID"]=json!("missing");},
                9=>{o["State"]=Value::Null;},
                _=>{b="foreign";},
            }
            assert!(scoped_ambient_radius(&p,b,&o,match_keyhole).is_err(),"ambient negative {i}");
        }
        assert!(scoped_ambient_radius(&p,BUILD,&activity(),match_keyhole).is_err());
        assert!(scoped_ambient_radius(&p,sw,&kh(),|_|Err("TEST_NO_PROVIDER")).is_err());
        let mut o=activity();o["State"]=json!({"Keyhole":{"KeyholeConfigDataGUID":"synthetic-keyhole"}});
        assert!(scoped_ambient_radius(&p,sw,&o,match_keyhole).is_err());
        let mut p=pack();p.dims.insert(31400039,(2,2));
        assert!(scoped_ambient_radius(&p,sw,&activity(),match_keyhole).is_err());
        p.dims.insert(40001075,(5,3));
        assert!(scoped_ambient_radius(&p,BUILD,&kh(),match_keyhole).is_err());
        // Helper tests do not grant Switch a product entry: existing gate unchanged.
        assert!(build(sw,626).is_err());
    }
}
