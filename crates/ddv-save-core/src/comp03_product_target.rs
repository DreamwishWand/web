//! ACT999: same ProductSession physical target preparation for COMP03.
//! Exact compiled installed geometry is a bounded definition projection,
//! not a caller attestation or proof of runtime provider parity.
//! No Stage, Worker ABI, operation grant or new Save reader.
use super::*;
use serde_json::{json,Value};
#[path="comp03_installed_geometry.rs"]
mod installed_geometry;
use installed_geometry::{InstalledGeometry,LocalGeometry};
use super::super::comp03_shape;
#[path="placement_applicable.rs"]
mod applicable;
const SUPPLEMENT:&[u8]=include_bytes!("../data/steam626-placement-applicable-supplement.json");
#[path="grid_append.rs"]
mod grid_append;

const MAX_GRID_BYTES:usize=2*1024*1024;
const ROAD:u32=40100038;
#[derive(Debug,PartialEq,Eq)]
pub(crate) struct Comp03PhysicalTarget {
    scope:WorkerEnvelope,
    grid:u32, sibling:u32, seed:u32, geometry:LocalGeometry,
    grid_sha:[u8;32], root_sha:[u8;32], sibling_root_sha:[u8;32],
    seed_sha:[u8;32], well_sha:[u8;32], sibling_well_sha:[u8;32],
    stock_sha:[u8;32], stock:u32, scanned_pairs:usize,
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
fn validate_identity_map(b:&[u8],map:Span,id_field:&str,limit:usize)->CoreResult<()>{
    let mut pos=map.begin+1;let mut count=0;
    while let Some((k,record))=next_object_member(b,map,&mut pos)?{
        count+=1;
        if count>limit||key(&k)?!=n(b,record,id_field)?{
            return Err(denied("COMP03_TARGET_NAMESPACE_IDENTITY"));
        }
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
    if old==0||old>9999||value(b,field(b,target,"Marker")?,128)?!="ItemMarker_None"{return Err(denied("COMP03_TARGET_STOCK"))}
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
        validate_identity_map(b,islands,"SceneItemId",4096)?;
        let (g,r,_ga)=root(b,islands,&defs[0])?;
        let (s,sr,_sa)=root(b,islands,&defs[1])?;
        if g==s{return Err(denied("COMP03_TARGET_SIBLING"))}
        let gc=field(b,world,"GridCollection")?;let grids=field(b,gc,"Grids")?;let diffs=field(b,gc,"DiffGrids")?;
        validate_identity_map(b,grids,"ID",50000)?;
        validate_identity_map(b,diffs,"ID",50000)?;
        let target=grid(b,grids,diffs,g,&defs[0])?;
        let sibling=grid(b,grids,diffs,s,&defs[1])?;
        let obs=field(b,target,"Objects")?;
        let ss=field(b,obs,&seed.to_string())?;let well=field(b,obs,"0")?;
        let sw=field(b,field(b,sibling,"Objects")?,"0")?;
        let geometry=pack.local_geometry(&value(b,target,MAX_GRID_BYTES)?,&value(b,sw,4096)?,seed)
            .ok_or(denied("COMP03_TARGET_LOCAL_GEOMETRY"))?;
        let start=indexed_read::skip_ws(b,0);let top=Span{begin:start,end:indexed_read::value_end(b,start)?};
        let incoming=super::placement_saved_refs::scan(b,top,g,Some(seed),geometry.next,geometry.next.checked_add(8).ok_or(denied("COMP03_REF_COUNTER"))?)?;
        if incoming.root(g)!=1||incoming.root(s)!=1||incoming.parent(g)!=0||incoming.parent(s)!=0{return Err(denied("COMP03_TARGET_ROOT_ALIAS"))}
        let (amount,entry)=stock(b,roots.player)?;
        Ok(Comp03PhysicalTarget{scope:e,grid:g,sibling:s,seed,geometry,
            grid_sha:digest(b,target)?,root_sha:digest(b,r)?,sibling_root_sha:digest(b,sr)?,
            seed_sha:digest(b,ss)?,well_sha:digest(b,well)?,sibling_well_sha:digest(b,sw)?,
            stock_sha:digest(b,entry)?,stock:amount,scanned_pairs:incoming.pairs})
    }
}

// Explicit saved composite addresses only (E1960). This does not establish
// active definition/provider applicability, nor authorize a Stage.
#[derive(Debug,PartialEq,Eq)]
pub(crate) struct Comp03SavedReferenceTarget {
    physical:Comp03PhysicalTarget,
    scanned_pairs:usize,
}
impl ProductSession{
    /// Reuse the same immutable decoded bytes and physical target from this
    /// session, then check the current envelope again under the state lock.
    /// No caller-supplied hashes, definition pack, refs, or authorization.
    #[allow(dead_code)]
    pub(crate) fn mint_comp03_saved_reference_target(&self,e:WorkerEnvelope,seed:u32)
        ->CoreResult<Comp03SavedReferenceTarget>{
        let physical=self.mint_comp03_physical_target(e,seed)?;
        let st=self.lock()?;check(self,&st,&e,WorkerAction::ReadDomain)?;
        if st.semantic.is_some()||st.revision!=0||st.generation!=1{
            return Err(denied("COMP03_REF_EPOCH"));
        }
        let pairs=physical.scanned_pairs;
        Ok(Comp03SavedReferenceTarget{physical,scanned_pairs:pairs})
    }
}

// ACT999: exact same-session layout proposal. No Stage authority yet:
// this opaque preparation is NOT the effective provider/rights/subscriber
// binder. Only the existing ledger may commit after that remaining gate.
#[derive(Debug)]
#[allow(dead_code)]
pub(crate) struct Comp03PreparedLayout {
    target:Comp03SavedReferenceTarget,
    edits:[Replacement;2],
    projected_sha:[u8;32],
}
impl ProductSession{
    #[allow(dead_code)]
    pub(crate) fn prepare_comp03_product_layout(&self,e:WorkerEnvelope,seed:u32)
        ->CoreResult<Comp03PreparedLayout>{
        let target=self.mint_comp03_saved_reference_target(e,seed)?;
        let st=self.lock()?;check(self,&st,&e,WorkerAction::ReadDomain)?;
        if st.semantic.is_some()||st.revision!=0||st.generation!=1{
            return Err(denied("COMP03_LAYOUT_EPOCH"));
        }
        let t=&target.physical;let b=&self.decoded;
        let roots=indexed_read::roots(b)?;
        let gc=field(b,roots.world,"GridCollection")?;
        let grid=field(b,field(b,gc,"Grids")?,&t.grid.to_string())?;
        if digest(b,grid)?!=t.grid_sha{return Err(denied("COMP03_LAYOUT_GRID_CAS"));}
        let objects=field(b,grid,"Objects")?;
        let counter=field(b,grid,"NextGridObjectID")?;
        let next=t.geometry.next;
        let end=next.checked_add(8).filter(|x|*x<=i32::MAX as u32)
            .ok_or(denied("COMP03_LAYOUT_COUNTER"))?;
        if bytes(b,counter)?!=next.to_string().as_bytes()||
           digest(b,field(b,objects,&seed.to_string())?)?!=t.seed_sha||
           digest(b,field(b,objects,"0")?)?!=t.well_sha{
            return Err(denied("COMP03_LAYOUT_TARGET_CAS"));
        }
        // The existing physical target proves a nonempty object map, exact
        // current allocator, unique IDs, geometry and no target aliases.
        // Reuse the identical shape source and shared Native append encoder.
        let rows=comp03_shape::additions(next,t.geometry.seed_x,t.geometry.seed_y)
            .ok_or(denied("COMP03_LAYOUT_SHAPE"))?;
        let closing=objects.end.checked_sub(1).ok_or(denied("COMP03_LAYOUT_MAP"))?;
        if rows.len()!=8||b.get(closing)!=Some(&b'}'){
            return Err(denied("COMP03_LAYOUT_MAP"));
        }
        let mut edits=[
            Replacement{span:Span{begin:closing,end:objects.end},old:vec![b'}'],
                new:grid_append::payload(&rows)?},
            Replacement{span:counter,old:bytes(b,counter)?.to_vec(),new:end.to_string().into_bytes()}
        ];
        edits.sort_by_key(|r|r.span.begin);
        if edits[0].span.end>edits[1].span.begin{return Err(denied("COMP03_LAYOUT_OVERLAP"));}
        // Project the exact byte output digest without allocating a second
        // full decoded document. No mutation, export, or semantic ledger.
        let mut hasher=Sha256::new();let mut pos=0;
        for edit in &edits{
            if bytes(b,edit.span)?!=edit.old.as_slice(){return Err(denied("COMP03_LAYOUT_OLD_CAS"));}
            hasher.update(&b[pos..edit.span.begin]);hasher.update(&edit.new);pos=edit.span.end;
        }
        hasher.update(&b[pos..]);
        Ok(Comp03PreparedLayout{target,edits,projected_sha:hasher.finalize().into()})
    }
}


// Same-session effective binder: exact geometry + physical/explicit-ref proof,
// common dependency screen AND COMP03-specific installed placement supplement.
fn project_fields(b:&[u8],s:Span,keys:&[&str])->CoreResult<Value>{
    let mut m=serde_json::Map::new();
    for k in keys{m.insert((*k).into(),value(b,field(b,s,k)?,MAX_GRID_BYTES)?);}
    Ok(Value::Object(m))
}
impl ProductSession{
    fn prepare_comp03_effective_layout(&self,e:WorkerEnvelope,seed:u32)->CoreResult<Comp03PreparedLayout>{
        let p=self.prepare_comp03_product_layout(e,seed)?;
        let st=self.lock()?;check(self,&st,&e,WorkerAction::ReadDomain)?;
        if st.semantic.is_some()||st.revision!=0||st.generation!=1{return Err(denied("COMP03_EFFECTIVE_EPOCH"))}
        let b=&self.decoded;let r=indexed_read::roots(b)?;
        let start=indexed_read::skip_ws(b,0);let top=Span{begin:start,end:indexed_read::value_end(b,start)?};
        let (_,defs)=super::pack()?;
        super::subscribers(b,r.player,r.world,top,defs,ROAD as i32,true)?;
        let player=project_fields(b,r.player,&["AchievementsData","DutySlots","BattlePassStates"])?;
        let world=project_fields(b,r.world,&["MissionSlots","RecurringEvents"])?;
        applicable::check_supplement(EXACT_STEAM,super::DEP.as_bytes(),SUPPLEMENT,
            applicable::PlacementScope::Comp03LayoutOnly,&player,&world).map_err(denied)?;
        Ok(p)
    }
    pub(crate) fn preview_comp03_product(&self,e:WorkerEnvelope,seed:u32)->CoreResult<Value>{
        let p=self.prepare_comp03_effective_layout(e,seed)?;let t=&p.target.physical;
        Ok(json!({"contract":"wand.worker.steam626.scoped-comp03-layout@1",
            "itemId":ROAD,"gridId":t.grid,"seedId":t.seed,"nextObjectId":t.geometry.next,
            "oldAmount":t.stock,"newAmount":t.stock,"inventoryDelta":0,
            "gridSha256":super::hex(&t.grid_sha),"seedSha256":super::hex(&t.seed_sha),
            "inventoryEntrySha256":super::hex(&t.stock_sha),"projectedDecodedSha256":super::hex(&p.projected_sha),
            "sessionId":super::hex(&e.session_id),"revision":e.expected_revision,"indexGeneration":e.expected_index_generation,
            "decodedSha256":super::hex(&e.expected_decoded_sha256),"exactFieldChangedCount":9,
            "scopedCandidate":true,"writerAuthorized":false,"editedCopyAuthorized":false}))
    }
    /// Versioned read-only companion, separately opted in. Reuse the
    /// current effective binder and exact append shape; no second geometry.
    #[cfg(feature="product-steam626-comp03-spatial-preview")]
    pub(crate) fn preview_comp03_spatial(&self,e:WorkerEnvelope,seed:u32,projected:[u8;32])->CoreResult<Value>{
        let p=self.prepare_comp03_effective_layout(e,seed)?;
        let t=&p.target.physical;
        if projected!=p.projected_sha{return Err(denied("COMP03_SPATIAL_PREVIEW_CAS"))}
        let rows=comp03_shape::additions(t.geometry.next,t.geometry.seed_x,t.geometry.seed_y)
            .ok_or(denied("COMP03_SPATIAL_SHAPE"))?;
        if rows.len()!=8{return Err(denied("COMP03_SPATIAL_COUNT"))}
        let mut anchors=vec![json!({"objectId":t.seed,"x":t.geometry.seed_x,"y":t.geometry.seed_y,"role":"retained"})];
        for (i,r) in rows.iter().enumerate(){
            if r["ID"].as_u64()!=Some(u64::from(t.geometry.next)+i as u64)||
               r["ItemID"]!=ROAD||r["Orientation"]!="GridOrientation_Down"||!r["State"].is_null(){
                return Err(denied("COMP03_SPATIAL_ROW"));
            }
            let x=r["X"].as_u64().filter(|v|*v<=260).ok_or(denied("COMP03_SPATIAL_COORD"))?;
            let y=r["Y"].as_u64().filter(|v|*v<=260).ok_or(denied("COMP03_SPATIAL_COORD"))?;
            anchors.push(json!({"objectId":r["ID"],"x":x,"y":y,"role":"proposed"}));
        }
        // Existing target proof guarantees unique current/allocator IDs.
        // Recheck epoch after projection to avoid returning a stale view.
        let st=self.lock()?;check(self,&st,&e,WorkerAction::ReadDomain)?;
        if st.semantic.is_some()||st.revision!=0||st.generation!=1{return Err(denied("COMP03_SPATIAL_EPOCH"))}
        Ok(json!({"contract":"wand.worker.steam626.comp03-spatial-preview@1",
            "rootSceneItemId":1540000150u32,"gridId":t.grid,"seedId":t.seed,"nextObjectId":t.geometry.next,
            "anchors":anchors,"sessionId":super::hex(&e.session_id),"revision":e.expected_revision,
            "indexGeneration":e.expected_index_generation,"decodedSha256":super::hex(&e.expected_decoded_sha256),
            "projectedDecodedSha256":super::hex(&p.projected_sha),"writerAuthorized":false,"editedCopyAuthorized":false}))
    }
    pub(crate) fn stage_comp03_product(&self,e:WorkerEnvelope,seed:u32,grid:u32,next:u32,old:u32,
        grid_sha:[u8;32],seed_sha:[u8;32],stock_sha:[u8;32],projected:[u8;32])->CoreResult<SemanticStageReceipt>{
        if e.action!=WorkerAction::Stage{return Err(denied("COMP03_EFFECTIVE_ACTION"))}
        let p=self.prepare_comp03_effective_layout(WorkerEnvelope{action:WorkerAction::ReadDomain,..e},seed)?;
        let t=&p.target.physical;
        if t.grid!=grid||t.geometry.next!=next||t.stock!=old||t.grid_sha!=grid_sha||
           t.seed_sha!=seed_sha||t.stock_sha!=stock_sha||p.projected_sha!=projected{
            return Err(denied("COMP03_EFFECTIVE_PREVIEW_CAS"))
        }
        self.commit_semantic_replacements(e,Vec::from(p.edits),9,Some(p.projected_sha))
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

    #[cfg(feature="product-steam626-comp03-spatial-preview")]
    #[test]
    fn comp03_spatial_projection_current_bound_exact9(){
        let mut d=doc(90001,90002,500);
        d["World"]["MissionSlots"]=json!({});d["World"]["RecurringEvents"]=json!({});
        d["Player"]["AchievementsData"]=json!([]);d["Player"]["DutySlots"]=json!({});
        d["Player"]["EvolveStatesProfile"]=json!({"EvolveProgressState":{}});
        d["Player"]["BattlePassStates"]=json!({"Progress":{},"FtueProgress":{"TasksProgress":[],"WeeklyTasksProgress":[]}});
        d["ConditionalEventHistory"]=json!({"ActiveEvents":{}});
        let s=open(&d);let e=env(&s);let before=s.receipt().unwrap();
        let p=s.prepare_comp03_effective_layout(e,500).unwrap();
        let v=s.preview_comp03_spatial(e,500,p.projected_sha).unwrap();
        assert_eq!(v["contract"],"wand.worker.steam626.comp03-spatial-preview@1");
        assert_eq!(v["rootSceneItemId"],1540000150u32);assert_eq!(v["gridId"],90001);assert_eq!(v["seedId"],500);
        assert_eq!(v["projectedDecodedSha256"],super::super::hex(&p.projected_sha));
        let a=v["anchors"].as_array().unwrap();assert_eq!(a.len(),9);
        assert_eq!(a[0],json!({"objectId":500,"x":16,"y":24,"role":"retained"}));
        let expected=[(20,24),(24,24),(16,28),(20,28),(24,28),(16,32),(20,32),(24,32)];
        for (i,(x,y)) in expected.into_iter().enumerate(){assert_eq!(a[i+1],json!({"objectId":510+i,"x":x,"y":y,"role":"proposed"}));}
        assert_eq!(s.receipt().unwrap(),before);assert_eq!(v["writerAuthorized"],false);
        assert!(s.preview_comp03_spatial(e,500,[0;32]).is_err());
        assert!(s.preview_comp03_spatial(e,501,p.projected_sha).is_err());
        assert!(s.preview_comp03_spatial(WorkerEnvelope{expected_revision:1,..e},500,p.projected_sha).is_err());
        assert!(s.preview_comp03_spatial(WorkerEnvelope{expected_index_generation:2,..e},500,p.projected_sha).is_err());
        assert!(s.preview_comp03_spatial(WorkerEnvelope{action:WorkerAction::Stage,..e},500,p.projected_sha).is_err());
        assert!(open(&d).preview_comp03_spatial(e,500,p.projected_sha).is_err());
        let t=&p.target.physical;
        s.stage_comp03_product(WorkerEnvelope{action:WorkerAction::Stage,..e},500,t.grid,t.geometry.next,t.stock,t.grid_sha,t.seed_sha,t.stock_sha,p.projected_sha).unwrap();
        assert!(s.preview_comp03_spatial(env(&s),500,p.projected_sha).is_err());
        s.close().unwrap();assert!(s.preview_comp03_spatial(e,500,p.projected_sha).is_err());
    }
    #[test]
    fn comp03_effective_atomic_exact9_and_current_cas(){
        let mut d=doc(90001,90002,500);
        d["World"]["MissionSlots"]=json!({});d["World"]["RecurringEvents"]=json!({});
        d["Player"]["AchievementsData"]=json!([]);d["Player"]["DutySlots"]=json!({});
        d["Player"]["EvolveStatesProfile"]=json!({"EvolveProgressState":{}});
        d["Player"]["BattlePassStates"]=json!({"Progress":{},"FtueProgress":{"TasksProgress":[],"WeeklyTasksProgress":[]}});
        d["ConditionalEventHistory"]=json!({"ActiveEvents":{}});
        let s=open(&d);let e=env(&s);let before=s.receipt().unwrap();
        let p=s.prepare_comp03_effective_layout(e,500).unwrap();let t=&p.target.physical;
        let view=s.preview_comp03_product(e,500).unwrap();assert_eq!(view["exactFieldChangedCount"],9);
        assert_eq!(view["inventoryDelta"],0);assert_eq!(s.receipt().unwrap(),before);
        let stage=WorkerEnvelope{action:WorkerAction::Stage,..e};
        assert!(s.stage_comp03_product(stage,500,t.grid,t.geometry.next,t.stock,t.grid_sha,t.seed_sha,t.stock_sha,[0;32]).is_err());
        assert!(open(&d).stage_comp03_product(stage,500,t.grid,t.geometry.next,t.stock,t.grid_sha,t.seed_sha,t.stock_sha,p.projected_sha).is_err());
        let r=s.stage_comp03_product(stage,500,t.grid,t.geometry.next,t.stock,t.grid_sha,t.seed_sha,t.stock_sha,p.projected_sha).unwrap();
        assert_eq!(r.operation_count,9);assert_eq!(r.exact_field_changed_count,9);assert!(!r.product_writer_authorized);
        let now=|a|WorkerEnvelope{action:a,..env(&s)};
        s.undo_typed_semantic_batch(now(WorkerAction::Stage)).unwrap();
        assert!(s.take_typed_semantic_decoded_once(now(WorkerAction::ExportEditedCopy)).is_err());
        s.redo_typed_semantic_batch(now(WorkerAction::Stage)).unwrap();
        let ex=now(WorkerAction::ExportEditedCopy);let out=s.take_typed_semantic_decoded_once(ex).unwrap();
        assert_eq!(sha(&out),p.projected_sha);assert!(s.take_typed_semantic_decoded_once(ex).is_err());
        let edited:Value=serde_json::from_slice(&out).unwrap();
        assert_eq!(edited["Player"],d["Player"]);assert_eq!(edited["World"]["GridCollection"]["Grids"]["90001"]["NextGridObjectID"],518);
        assert_eq!(edited["World"]["GridCollection"]["Grids"]["90001"]["Objects"].as_object().unwrap().len(),10);
        d["World"]["RecurringEvents"]=json!({"1":{"Unknown":{"RecurringEventItemID":1}}});
        let x=open(&d);assert!(x.preview_comp03_product(env(&x),500).is_err());
    }
    #[test]
    fn comp03_prepared_exact9_byte_projection_without_authority(){
        for (g,s,seed) in [(90001,90002,500),(301,742,42)]{
            let d=doc(g,s,seed);
            let raw=serde_json::to_vec(&d).unwrap();
            let session=open(&d);let e=env(&session);let before=session.receipt().unwrap();
            let proposal=session.prepare_comp03_product_layout(e,seed).unwrap();
            assert_eq!(proposal.target.physical.grid,g);assert_eq!(proposal.edits.len(),2);
            assert_eq!(session.receipt().unwrap(),before);
            let mut out=raw.clone();
            for edit in proposal.edits.iter().rev(){
                assert_eq!(&out[edit.span.begin..edit.span.end],edit.old.as_slice());
                out.splice(edit.span.begin..edit.span.end,edit.new.iter().copied());
            }
            assert_eq!(sha(&out),proposal.projected_sha);
            validate_entire_document(&out,626).unwrap();
            let mut want=d.clone();
            let grid=&mut want["World"]["GridCollection"]["Grids"][g.to_string()];
            let next=seed+10;let rows=comp03_shape::additions(next,16,24).unwrap();
            for row in rows{
                let id=row["ID"].as_u64().unwrap().to_string();
                grid["Objects"][id]=row;
            }
            grid["NextGridObjectID"]=json!(next+8);
            let actual:Value=serde_json::from_slice(&out).unwrap();
            assert_eq!(actual,want);
            // Undo projection reproduces the exact original, including the
            // closing-brace insertion and length-changing counter.
            let mut undo=out.clone();let mut delta=0isize;
            let ranges:Vec<_>=proposal.edits.iter().map(|edit|{
                let begin=(edit.span.begin as isize+delta) as usize;
                delta+=edit.new.len() as isize-edit.old.len() as isize;
                (begin,begin+edit.new.len(),edit.old.clone())
            }).collect();
            for (begin,end,old) in ranges.into_iter().rev(){undo.splice(begin..end,old);}
            assert_eq!(undo,raw);
            assert!(open(&d).prepare_comp03_product_layout(e,seed).is_err());
            assert!(session.prepare_comp03_product_layout(WorkerEnvelope{expected_revision:1,..e},seed).is_err());
            assert!(session.prepare_comp03_product_layout(WorkerEnvelope{action:WorkerAction::Stage,..e},seed).is_err());
            assert!(session.prepare_comp03_product_layout(e,seed+1).is_err());
            let mut q=d.clone();q["Player"]["Ref"]=json!({"GridID":g,"GridObjectID":next});
            let x=open(&q);assert!(x.prepare_comp03_product_layout(env(&x),seed).is_err());
            session.close().unwrap();assert!(session.prepare_comp03_product_layout(e,seed).is_err());
        }
    }

    #[test]
    fn comp03_current_explicit_reference_scope(){
        let g=90001;let s=90002;let seed=500;
        let d=doc(g,s,seed);
        let t=open(&d);let e=env(&t);let before=t.receipt().unwrap();
        let a=t.mint_comp03_saved_reference_target(e,seed).unwrap();
        assert_eq!(a.scanned_pairs,0);
        assert_eq!(a,t.mint_comp03_saved_reference_target(e,seed).unwrap());
        assert_eq!(t.receipt().unwrap(),before);
        let mut q=d.clone();
        q["Player"]["ReferenceWitness"]=json!([
            {"GridID":s,"GridObjectID":seed},{"GridId":g,"GridObjectId":508},
            {"GridID":s,"ObjectID":0},{"GridId":s,"ObjectId":510},
            {"GridID":g},{"ObjectID":seed}
        ]);
        let t=open(&q);
        assert_eq!(t.mint_comp03_saved_reference_target(env(&t),seed).unwrap().scanned_pairs,4);
        for (gk,ok) in [("GridID","GridObjectID"),("GridId","GridObjectId"),
            ("GridID","ObjectID"),("GridId","ObjectId")]{
            for id in [0,seed,510,517]{
                let mut q=d.clone();
                q["Player"]["ReferenceWitness"]=json!([{(gk):g,(ok):id}]);
                let t=open(&q);let before=t.receipt().unwrap();
                assert!(t.mint_comp03_saved_reference_target(env(&t),seed).is_err());
                assert_eq!(t.receipt().unwrap(),before);
            }
        }
        for r in [json!({"GridID":g,"GridObjectID":"500"}),
            json!({"GridID":g,"GridObjectID":500.0}),
            json!({"GridID":g,"GridObjectId":500}),
            json!({"GridID":g,"GridId":s,"GridObjectID":500}),
            json!({"GridID":g,"GridObjectID":500,"ObjectID":501})]{
            let mut q=d.clone();q["Player"]["ReferenceWitness"]=r;
            let t=open(&q);assert!(t.mint_comp03_saved_reference_target(env(&t),seed).is_err());
        }
        let t=open(&d);let e=env(&t);
        assert!(open(&d).mint_comp03_saved_reference_target(e,seed).is_err());
        assert!(t.mint_comp03_saved_reference_target(WorkerEnvelope{expected_revision:1,..e},seed).is_err());
        assert!(t.mint_comp03_saved_reference_target(WorkerEnvelope{action:WorkerAction::Stage,..e},seed).is_err());
        t.close().unwrap();assert!(t.mint_comp03_saved_reference_target(e,seed).is_err());
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
    fn comp03_target_and_sibling_namespace_contradictions(){
        let d=doc(90001,90002,500);
        for id in [90001,90002]{
            for map in ["Grids","DiffGrids"]{
                let mut q=d.clone();
                q["World"]["GridCollection"][map]["70001"]=json!({"ID":id});
                let t=open(&q);let before=t.receipt().unwrap();
                assert!(t.mint_comp03_physical_target(env(&t),500).is_err());
                assert_eq!(t.receipt().unwrap(),before);
            }
        }
        for id in [1540000150,1540000153]{
            let mut q=d.clone();
            q["World"]["FloatingIslands"]["1540000159"]=json!({"SceneItemId":id,"GridIDs":[]});
            let t=open(&q);let before=t.receipt().unwrap();
            assert!(t.mint_comp03_physical_target(env(&t),500).is_err());
            assert_eq!(t.receipt().unwrap(),before);
        }
        let mut q=d.clone();
        q["World"]["GridCollection"]["Grids"]["70001"]=json!({"ID":70001});
        q["World"]["GridCollection"]["DiffGrids"]["70002"]=json!({"ID":70002});
        q["World"]["FloatingIslands"]["1540000159"]=json!({"SceneItemId":1540000159,"GridIDs":[70001]});
        let t=open(&q);assert!(t.mint_comp03_physical_target(env(&t),500).is_ok());
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
