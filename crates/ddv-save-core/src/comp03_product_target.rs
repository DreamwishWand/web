//! ACT999: same ProductSession physical target preparation for COMP03.
//! Exact compiled installed geometry is a bounded definition projection,
//! not a caller attestation or proof of runtime provider parity.
//! No Stage, Worker ABI, operation grant or new Save reader.
use super::*;
use serde_json::{json,Value};
#[path="comp03_installed_geometry.rs"]
mod installed_geometry;
use installed_geometry::{InstalledGeometry,LocalGeometry};

const MAX_GRID_BYTES:usize=2*1024*1024;
const MAX_ALIAS_NODES:usize=1_000_000;
const ROAD:u32=40100038;
#[derive(Debug,PartialEq,Eq)]
pub(crate) struct Comp03PhysicalTarget {
    scope:WorkerEnvelope,
    grid:u32, sibling:u32, seed:u32, geometry:LocalGeometry,
    grid_sha:[u8;32], root_sha:[u8;32], sibling_root_sha:[u8;32],
    seed_sha:[u8;32], well_sha:[u8;32], sibling_well_sha:[u8;32],
    stock_sha:[u8;32], stock:u32,
}
fn u32_at(b:&[u8],s:Span)->CoreResult<u32>{
    u32::try_from(number(b,s)?).map_err(|_|denied("COMP03_TARGET_UINT"))
}
fn field(b:&[u8],s:Span,k:&str)->CoreResult<Span>{object_field(b,s,k)}
fn n(b:&[u8],s:Span,k:&str)->CoreResult<u32>{u32_at(b,field(b,s,k)?)}
fn bytes(b:&[u8],s:Span)->CoreResult<&[u8]>{b.get(s.begin..s.end).ok_or(denied("COMP03_TARGET_SPAN"))}
fn value(b:&[u8],s:Span,max:usize)->CoreResult<Value>{
    let raw=bytes(b,s)?;
    if raw.len()>max{return Err(denied("COMP03_TARGET_VALUE_BOUND"));}
    serde_json::from_slice(raw).map_err(|_|denied("COMP03_TARGET_VALUE"))
}
fn digest(b:&[u8],s:Span)->CoreResult<[u8;32]>{Ok(sha(bytes(b,s)?))}
fn key(k:&str)->CoreResult<u32>{
    k.parse::<u32>().ok().filter(|x|x.to_string()==k).ok_or(denied("COMP03_TARGET_KEY"))
}
fn exact_text(b:&[u8],s:Span,k:&str,want:&Value)->CoreResult<()>{
    if !want.is_string()||value(b,field(b,s,k)?,2048)?!=*want{return Err(denied("COMP03_TARGET_DEFINITION_PATH"))}
    Ok(())
}
fn root(b:&[u8],islands:Span,def:&Value)->CoreResult<(u32,Span,Span)>{
    let scene=def["sceneItemId"].as_u64().and_then(|x|u32::try_from(x).ok()).ok_or(denied("COMP03_TARGET_PACK"))?;
    let r=field(b,islands,&scene.to_string())?;
    if n(b,r,"SceneItemId")?!=scene||bytes(b,field(b,r,"Unlocked")?)?!=b"true"{
        return Err(denied("COMP03_TARGET_ROOT"));
    }
    exact_text(b,r,"CustomLocationPositionsPath",&def["customLocationsPath"])?;
    let ids=field(b,r,"GridIDs")?;
    let v=value(b,ids,128)?;
    let a=v.as_array().filter(|x|x.len()==1).ok_or(denied("COMP03_TARGET_ROOT_GRID"))?;
    let id=a[0].as_u64().and_then(|x|u32::try_from(x).ok()).filter(|x|*x>0)
        .ok_or(denied("COMP03_TARGET_ROOT_GRID"))?;
    Ok((id,r,ids))
}
fn array_spans<F>(b:&[u8],s:Span,mut f:F)->CoreResult<()> where F:FnMut(Span)->CoreResult<()> {
    if b.get(s.begin)!=Some(&b'[')||b.get(s.end.saturating_sub(1))!=Some(&b']'){
        return Err(denied("COMP03_TARGET_ARRAY"));
    }
    let mut p=s.begin+1;let mut count=0;
    loop{
        p=indexed_read::skip_ws(b,p);if p==s.end-1{return Ok(())}
        if p>=s.end||count>=250000{return Err(denied("COMP03_TARGET_ARRAY_BOUND"))}
        let end=indexed_read::value_end(b,p)?;
        if end>=s.end{return Err(denied("COMP03_TARGET_ARRAY_SPAN"))}
        f(Span{begin:p,end})?;count+=1;p=indexed_read::skip_ws(b,end);
        match b.get(p){
            Some(b',') if p<s.end-1=>p+=1,
            Some(b']') if p==s.end-1=>return Ok(()),
            _=>return Err(denied("COMP03_TARGET_ARRAY_SPAN"))
        }
    }
}
// Only the material direct root/SubGrid aliases for the selected two grids.
// Walk the existing indexed lexical spans, not a second decoded document.
fn aliases(b:&[u8],s:Span,ids:[u32;2],expected:[Span;2],hits:&mut [usize;2],budget:&mut usize,depth:usize)->CoreResult<()> {
    *budget+=1;
    if *budget>MAX_ALIAS_NODES||depth>64{return Err(denied("COMP03_TARGET_ALIAS_BOUND"))}
    match b.get(s.begin){
        Some(b'{')=>{
            let mut p=s.begin+1;
            while let Some((k,v))=next_object_member(b,s,&mut p)?{
                if k=="GridIDs"{
                    array_spans(b,v,|x|{
                        let id=u32_at(b,x)?;
                        for i in 0..2{if id==ids[i]{
                            if v.begin!=expected[i].begin||v.end!=expected[i].end{return Err(denied("COMP03_TARGET_ROOT_ALIAS"))}
                            hits[i]+=1;
                        }}Ok(())
                    })?;
                }else if k=="SubGrid"&&bytes(b,v)?!=b"null"{
                    if ids.contains(&n(b,v,"GridID")?){return Err(denied("COMP03_TARGET_SUBGRID_ALIAS"))}
                }
                aliases(b,v,ids,expected,hits,budget,depth+1)?;
            }
        },
        Some(b'[')=>array_spans(b,s,|v|aliases(b,v,ids,expected,hits,budget,depth+1))?,
        Some(_)=>(),None=>return Err(denied("COMP03_TARGET_SPAN")),
    }
    Ok(())
}
fn grid(b:&[u8],grids:Span,diffs:Span,id:u32,def:&Value)->CoreResult<Span>{
    let g=field(b,grids,&id.to_string())?;
    if n(b,g,"ID")?!=id||n(b,g,"TessellationFactor")?!=2||
        value(b,field(b,g,"GridDefaultLayoutPath")?,2048)?!=""{
        return Err(denied("COMP03_TARGET_GRID"));
    }
    exact_text(b,g,"GridDataPath",&def["gridDataPath"])?;
    let mut pos=diffs.begin+1;let mut count=0;
    while let Some((k,_))=next_object_member(b,diffs,&mut pos)?{
        count+=1;if count>50000||key(&k)?==id{return Err(denied("COMP03_TARGET_OVERLAY"))}
    }
    Ok(g)
}
fn stock(b:&[u8],player:Span)->CoreResult<(u32,Span)>{
    let lists=field(b,player,"ListInventories")?;
    let route=field(b,lists,"0")?;
    inventory_route(b,route,0,ROAD,"ItemType_Furniture")?;
    let target=field(b,field(b,route,"Inventory")?,&ROAD.to_string())?;
    let old=n(b,target,"Amount")?;
    if old==0||old>9999{return Err(denied("COMP03_TARGET_STOCK"))}
    let mut p=lists.begin+1;let mut count=0;let mut matches=0;
    while let Some((k,r))=next_object_member(b,lists,&mut p)?{
        count+=1;let id=key(&k)?;
        if count>4096||n(b,r,"ID")?!=id{return Err(denied("COMP03_TARGET_STOCK_ROUTE"))}
        let inv=field(b,r,"Inventory")?;
        if field(b,inv,&ROAD.to_string()).is_ok(){
            if id!=0{return Err(denied("COMP03_TARGET_STOCK_ROUTE"))}
            matches+=1;
        }
    }
    if matches!=1{return Err(denied("COMP03_TARGET_STOCK_ROUTE"))}
    Ok((old,target))
}
impl ProductSession{
    /// Fixed normal-retail physical/geometry witness, deliberately not Stage
    /// authority. Additional effective provider and affected refs/rights
    /// must be closed before it can be used for the actual product edit.
    #[allow(dead_code)]
    pub(crate) fn mint_comp03_physical_target(&self,e:WorkerEnvelope,seed:u32)->CoreResult<Comp03PhysicalTarget>{
        let st=self.lock()?;check(self,&st,&e,WorkerAction::ReadDomain)?;
        let bld=&self.native_source_build;
        if bld.platform!=Platform::SteamWindows||bld.build_kind!=BuildKind::SteamFullVersion||
            bld.build_id!=EXACT_STEAM||bld.schema!=626||!bld.externally_attested||!self.worker_bound||
            st.semantic.is_some()||st.revision!=0||st.generation!=1{
            return Err(denied("COMP03_TARGET_BUILD_OR_EPOCH"))
        }
        let pack=InstalledGeometry::fixed().ok_or(denied("COMP03_TARGET_PACK"))?;
        let defs=&pack.data()["roots"];
        let b=&self.decoded;let roots=indexed_read::roots(b)?;
        let world=roots.world;let islands=field(b,world,"FloatingIslands")?;
        let (g,r,ga)=root(b,islands,&defs[0])?;
        let (s,sr,sa)=root(b,islands,&defs[1])?;
        if g==s{return Err(denied("COMP03_TARGET_SIBLING"))}
        let gc=field(b,world,"GridCollection")?;let grids=field(b,gc,"Grids")?;let diffs=field(b,gc,"DiffGrids")?;
        let target=grid(b,grids,diffs,g,&defs[0])?;
        let sibling=grid(b,grids,diffs,s,&defs[1])?;
        let obs=field(b,target,"Objects")?;
        let ss=field(b,obs,&seed.to_string())?;let well=field(b,obs,"0")?;
        let sw=field(b,field(b,sibling,"Objects")?,"0")?;
        let geometry=pack.local_geometry(&value(b,target,MAX_GRID_BYTES)?,&value(b,sw,4096)?,seed)
            .ok_or(denied("COMP03_TARGET_LOCAL_GEOMETRY"))?;
        let mut hits=[0usize;2];let mut budget=0;
        aliases(b,world,[g,s],[ga,sa],&mut hits,&mut budget,0)?;
        if hits!=[1,1]{return Err(denied("COMP03_TARGET_ROOT_ALIAS"))}
        let (amount,entry)=stock(b,roots.player)?;
        Ok(Comp03PhysicalTarget{scope:e,grid:g,sibling:s,seed,geometry,
            grid_sha:digest(b,target)?,root_sha:digest(b,r)?,sibling_root_sha:digest(b,sr)?,
            seed_sha:digest(b,ss)?,well_sha:digest(b,well)?,sibling_well_sha:digest(b,sw)?,
            stock_sha:digest(b,entry)?,stock:amount})
    }
}
#[cfg(test)]
mod tests{
    use super::*;
    fn doc(g:u32,s:u32,seed:u32)->Value{
        let p=InstalledGeometry::fixed().unwrap();let r=&p.data()["roots"];
        let well=json!({"ID":0,"ItemID":20300048,"X":120,"Y":120,"Orientation":"GridOrientation_Down","State":{"BuildingWithSkinData":{"UpgradeState":{"Level":1},"CurrentSkinItemID":170200005}}});
        json!({"GameInfo":{"Version":626},"World":{"Villages":[],"FloatingIslands":{
            "1540000150":{"SceneItemId":1540000150,"Unlocked":true,"GridIDs":[g],"CustomLocationPositionsPath":r[0]["customLocationsPath"]},
            "1540000153":{"SceneItemId":1540000153,"Unlocked":true,"GridIDs":[s],"CustomLocationPositionsPath":r[1]["customLocationsPath"]}},
            "GridCollection":{"Grids":{
                (g.to_string()):{"ID":g,"GridDefaultLayoutPath":"","GridDataPath":r[0]["gridDataPath"],"TessellationFactor":2,"NextGridObjectID":seed+10,
                    "Objects":{"0":well.clone(),(seed.to_string()):{"ID":seed,"ItemID":ROAD,"X":16,"Y":24,"Orientation":"GridOrientation_Down","State":null}}},
                (s.to_string()):{"ID":s,"GridDefaultLayoutPath":"","GridDataPath":r[1]["gridDataPath"],"TessellationFactor":2,"NextGridObjectID":12,"Objects":{"0":well}}},"DiffGrids":{}}},
            "Player":{"ListInventories":{"0":{"ID":0,"CompatibleItemType":"ItemType_Furniture","CompatibleFurnitureTypes":{"List":["FurnitureItemType_GroundAlteration"]},"Inventory":{"40100038":{"Amount":99,"Marker":"ItemMarker_None"}}}}}})
    }
    fn open(d:&Value)->ProductSession{
        let mut s=ProductSession::open_decoded_readonly(serde_json::to_vec(d).unwrap(),crate::BuildIdentity{
            platform:Platform::SteamWindows,build_kind:BuildKind::SteamFullVersion,build_id:EXACT_STEAM.into(),schema:626,externally_attested:true}).unwrap();
        s.worker_bound=true;s
    }
    fn env(s:&ProductSession)->WorkerEnvelope{
        let r=s.receipt().unwrap();WorkerEnvelope{contract:PRODUCT_WORKER_CONTRACT,session_id:r.session_id,
            expected_revision:r.revision,expected_index_generation:r.index_generation,expected_decoded_sha256:r.decoded_sha256,action:WorkerAction::ReadDomain}
    }
    #[test]
    fn comp03_physical_target_same_session_dynamic_ids(){
        for (g,s,seed) in [(90001,90002,500),(301,742,42)]{
            let d=doc(g,s,seed);let t=open(&d);let e=env(&t);let before=t.receipt().unwrap();
            let a=t.mint_comp03_physical_target(e,seed).unwrap();
            assert_eq!((a.grid,a.sibling,a.seed,a.stock),(g,s,seed,99));
            assert_eq!(a.geometry,LocalGeometry{seed_x:16,seed_y:24,next:seed+10});
            assert_eq!(a,t.mint_comp03_physical_target(e,seed).unwrap());
            assert_eq!(t.receipt().unwrap(),before);assert_eq!(t.decoded.as_ref(),serde_json::to_vec(&d).unwrap());
            assert!(open(&d).mint_comp03_physical_target(e,seed).is_err());
            assert!(t.mint_comp03_physical_target(WorkerEnvelope{expected_revision:1,..e},seed).is_err());
            assert!(t.mint_comp03_physical_target(WorkerEnvelope{expected_index_generation:2,..e},seed).is_err());
            assert!(t.mint_comp03_physical_target(WorkerEnvelope{action:WorkerAction::Stage,..e},seed).is_err());
            assert!(t.mint_comp03_physical_target(e,0).is_err());
            t.close().unwrap();assert!(t.mint_comp03_physical_target(e,seed).is_err());
        }
    }
    #[test]
    fn comp03_physical_target_root_alias_stock_and_unknown_denials(){
        let d=doc(90001,90002,500);
        for i in 0..14{
            let mut q=d.clone();
            match i{
                0=>q["World"]["FloatingIslands"]["1540000150"]["SceneItemId"]=json!(1540000153),
                1=>q["World"]["FloatingIslands"]["1540000150"]["GridIDs"]=json!([90001,90001]),
                2=>q["World"]["FloatingIslands"]["1540000153"]["GridIDs"]=json!([90001]),
                3=>q["World"]["FloatingIslands"]["1540000150"]["CustomLocationPositionsPath"]=json!("unknown"),
                4=>q["World"]["FloatingIslands"]["1540000150"]["Unlocked"]=json!(false),
                5=>q["World"]["Villages"]=json!([{"Areas":{"1":{"GridIDs":[90001]}}}]),
                6=>q["World"]["GridCollection"]["DiffGrids"]["90001"]=json!({"ID":90001}),
                7=>q["World"]["GridCollection"]["Grids"]["90002"]["GridDataPath"]=json!("unknown"),
                8=>q["World"]["GridCollection"]["Grids"]["90002"]["Objects"]["0"]["X"]=json!(121),
                9=>q["World"]["Extra"] =json!({"SubGrid":{"GridID":90001}}),
                10=>q["Player"]["ListInventories"]["0"]["Inventory"]["40100038"]["Amount"]=json!(0),
                11=>q["Player"]["ListInventories"]["1"]=json!({"ID":1,"Inventory":{"40100038":{"Amount":1}}}),
                12=>q["World"]["GridCollection"]["Grids"]["90001"]["Objects"]["501"]=json!({"ID":501,"ItemID":40000066,"X":80,"Y":80,"Orientation":"GridOrientation_Down","State":null}),
                _=>q["World"]["Extra"]=json!({"GridIDs":["90001"]}),
            }
            let t=open(&q);let before=t.receipt().unwrap();assert!(t.mint_comp03_physical_target(env(&t),500).is_err());assert_eq!(t.receipt().unwrap(),before);
        }
        let mut t=open(&d);t.worker_bound=false;assert!(t.mint_comp03_physical_target(env(&t),500).is_err());
    }
}
