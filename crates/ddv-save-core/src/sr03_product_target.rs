//! ACT1184: SR03 bounded same-session target, not Stage/Writer authority.
//! Existing lexical scanner, shared installed provider and typed reference closure.
use super::*;
use serde_json::{json,Value};
use super::comp03_product_target::installed_geometry::InstalledGeometry;
#[path="sr03_installed_geometry.rs"]
mod geometry;
use geometry::{MeadowGeometry,LocalTarget,Rect,ROAD,GRID};
use super::placement_saved_refs::Incoming;
const MAX_GRID:usize=2*1024*1024;
const HOUSE_MAX:usize=4096;
#[derive(Clone,Copy,PartialEq,Eq)]
enum RoadBuild{Steam626,Switch626}
fn road_build(s:&ProductSession,scope:RoadBuild)->CoreResult<()>{
 if scope==RoadBuild::Steam626{return build_check(s)}
 let b=&s.native_source_build;
 need(b.platform==Platform::Switch&&b.build_kind==BuildKind::SwitchBid&&b.build_id=="9A239D3DB569756D"&&b.schema==626&&b.externally_attested,"RM01_EXACT_SWITCH626_REQUIRED")
}
#[derive(Debug,PartialEq,Eq)]
#[allow(dead_code)]
pub(crate) struct Sr03Target{
    scope:WorkerEnvelope, grid:u32, local:LocalTarget, stock:u32,
    root_sha:[u8;32],grid_sha:[u8;32],keep_sha:[u8;32],moved_sha:[u8;32],
    counter_sha:[u8;32],stock_sha:[u8;32],houses_sha:[u8;32],pairs:usize,
}
/// R01 layout-only target: no seed removals and no inventory debit.
/// Internal receipt only; never a mutation/Stage grant.
#[derive(Debug,PartialEq,Eq)]
#[allow(dead_code)]
pub(crate) struct R01Target{
    scope:WorkerEnvelope, grid:u32, x:u32,y:u32,next:u32,stock:u32,
    root_sha:[u8;32],grid_sha:[u8;32],counter_sha:[u8;32],stock_sha:[u8;32],
    houses_sha:[u8;32],pairs:usize,
}
#[derive(Debug)]
pub(crate) struct R02Target{
    scope:WorkerEnvelope, grid:u32, x:u32,y:u32,next:u32,stock:u32,
    root_sha:[u8;32],grid_sha:[u8;32],counter_sha:[u8;32],stock_sha:[u8;32],
    houses_sha:[u8;32],pairs:usize,
}
fn raw(b:&[u8],s:Span)->CoreResult<&[u8]>{b.get(s.begin..s.end).ok_or(denied("SR03_TARGET_SPAN"))}
fn digest(b:&[u8],s:Span)->CoreResult<[u8;32]>{Ok(sha(raw(b,s)?))}
fn value(b:&[u8],s:Span,max:usize)->CoreResult<Value>{
    let p=raw(b,s)?;need(p.len()<=max,"SR03_TARGET_VALUE_BOUND")?;
    serde_json::from_slice(p).map_err(|_|denied("SR03_TARGET_VALUE"))
}
fn uint(v:&Value)->Option<u32>{v.as_u64()?.try_into().ok()}
fn fields(v:&Value,ks:&[&str])->bool{v.as_object().is_some_and(|m|m.len()==ks.len()&&ks.iter().all(|k|m.contains_key(*k)))}
fn level(v:&Value,l:u32)->bool{fields(v,&["Level"])&&uint(&v["Level"])==Some(l)}
fn selected(b:&[u8],w:Span,gid:u32)->CoreResult<(Span,Span,Span,Span)>{
    let mut root=None;let mut hits=0usize;
    for(vi,v)in array(b,f(b,w,"Villages")?,256)?.into_iter().enumerate(){
        for(k,a)in members(b,f(b,v,"Areas")?,4096)?{
            let aid=key(&k)?;let ids=array(b,f(b,a,"GridIDs")?,4096)?;
            for i in &ids{
                let id=u32::try_from(number(b,*i)?).map_err(|_|denied("SR03_TARGET_ROOT_ID"))?;
                if id==gid{hits+=1;need(vi==0&&aid==2&&ids.len()==1&&boolean(b,a,"Unlocked")?,"SR03_TARGET_ROOT")?;root=Some(a);}
            }
        }
    }
    need(hits==1,"SR03_TARGET_ROOT_ALIAS")?;
    let gc=f(b,w,"GridCollection")?;let gs=f(b,gc,"Grids")?;let ds=f(b,gc,"DiffGrids")?;
    let mut picked=None;let mut seen=std::collections::BTreeSet::new();
    for(k,g)in members(b,gs,50000)?{
        let id=key(&k)?;need(n(b,g,"ID")?==id&&seen.insert(id),"SR03_TARGET_GRID_ID")?;
        if id==gid{picked=Some(g)}
    }
    for(k,g)in members(b,ds,50000)?{
        let id=key(&k)?;need(n(b,g,"ID")?==id&&!seen.contains(&id),"SR03_TARGET_OVERLAY_ID")?;
    }
    let g=picked.ok_or(denied("SR03_TARGET_GRID"))?;
    need(strv(b,g,"GridDataPath")?==GRID&&strv(b,g,"GridDefaultLayoutPath")?.is_empty()&&n(b,g,"TessellationFactor")?==2,"SR03_TARGET_GRID_DEFINITION")?;
    Ok((root.ok_or(denied("SR03_TARGET_ROOT"))?,g,gs,ds))
}
fn stock(b:&[u8],player:Span)->CoreResult<(u32,Span)>{
    let lists=f(b,player,"ListInventories")?;
    let route=f(b,lists,"0")?;
    // Existing typed Catalog0 route verifies the exact GroundAlteration subtype.
    inventory_route(b,route,0,ROAD,"ItemType_Furniture")?;
    let entry=f(b,f(b,route,"Inventory")?,&ROAD.to_string())?;
    let v=value(b,entry,4096)?;let old=uint(&v["Amount"]).ok_or(denied("SR03_TARGET_STOCK"))?;
    need(fields(&v,&["Amount","Marker"])&&old>3&&old<=9999&&v["Marker"]=="ItemMarker_Favorite","SR03_TARGET_STOCK")?;
    let mut matches=0usize;
    for(k,r)in members(b,lists,4096)?{
        let id=key(&k)?;need(n(b,r,"ID")?==id,"SR03_TARGET_STOCK_ROUTE_ID")?;
        if opt(b,f(b,r,"Inventory")?,&ROAD.to_string())?.is_some(){matches+=1;need(id==0,"SR03_TARGET_STOCK_ROUTE")?;}
    }
    need(matches==1,"SR03_TARGET_STOCK_ROUTE")?;
    physical_totals(b,player,ROAD as i32,None,old)?;
    Ok((old,entry))
}
fn house_items(b:&[u8],w:Span)->CoreResult<(Value,Span)>{
    let s=f(b,w,"PlayerHouses")?;let mut rows=Vec::new();
    for h in array(b,s,HOUSE_MAX)?{rows.push(json!({"HouseItemID":n(b,h,"HouseItemID")?}));}
    Ok((Value::Array(rows),s))
}
fn orient(v:&Value)->Option<(bool,bool)>{
    let s=v.as_str()?;
    match s{
        "GridOrientation_Up"|"GridOrientation_Down"=>Some((true,false)),
        "GridOrientation_Left"|"GridOrientation_Right"=>Some((true,true)),
        "GridOrientation_UpRight"|"GridOrientation_UpLeft"|"GridOrientation_DownRight"|"GridOrientation_DownLeft"|
        "GridOrientation_UpUpRight"|"GridOrientation_UpUpLeft"|"GridOrientation_DownDownRight"|"GridOrientation_DownDownLeft"|
        "GridOrientation_UpRightRight"|"GridOrientation_UpLeftLeft"|"GridOrientation_DownRightRight"|"GridOrientation_DownLeftLeft"=>Some((false,false)),
        _=>None
    }
}
fn wide(x:i64,y:i64,r:i64)->Option<Rect>{
    Some(Rect(x.checked_sub(r)?,y.checked_sub(r)?,x.checked_add(r)?.checked_add(1)?,y.checked_add(r)?.checked_add(1)?))
}
fn child_extra(b:&[u8],gs:Span,ds:Span,refs:&Incoming,parent:u32,p:&Value)->Option<i64>{
    if !fields(p,&["DesignID","GridID"])||!p["DesignID"].is_null(){return None}
    let id=uint(&p["GridID"])?;if id==0||refs.root(id)!=0||refs.parent(id)!=1{return None}
    if opt(b,ds,&id.to_string()).ok()?.is_some(){return None}
    let g=value(b,f(b,gs,&id.to_string()).ok()?,MAX_GRID).ok()?;
    let path=match parent{
      40004191=>"GridData/Furniture/NonIP_Update17/CoffeeShopTable-GridData.json",
      40003564=>"GridData/Furniture/NonIP_Update14/CastleKit_Wall_Small_Window01-GridData.json",
      40005226=>"GridData/Furniture/NonIP_Update21/FlowerStoreFront-GridData.json",
      _=>return None,
    };
    if uint(&g["ID"])?!=id||uint(&g["TessellationFactor"])?!=2||g["GridDataPath"]!=path||g["GridDefaultLayoutPath"]!=""{return None}
    let m=g["Objects"].as_object()?;if m.len()>1{return None}
    let next=uint(&g["NextGridObjectID"])?;if next==0&&!m.is_empty(){return None}
    for(k,o)in m{
       // E1184 exact child definition, installed Furniture frame SHA
       // cd868c0a30a68f84961df793a23c14c9cb53c90add182481e1d95561e78c3060,
       // 1x1/tess1 -> 2x2 raw; no nested child/override.
       let oid=uint(&o["ID"])?;if parent!=40004191||k!=&oid.to_string()||oid>=next
        ||!fields(o,&["ID","ItemID","X","Y","Orientation","State"])||uint(&o["ItemID"])?!=40004104||!o["State"].is_null(){return None}
       orient(&o["Orientation"])?;
       let x=i64::from(uint(&o["X"])?);let y=i64::from(uint(&o["Y"])?);
       if x>64||y>64{return None}
       return Some(x+y+8)
    }
    Some(0)
}
fn ambient(b:&[u8],world:Span,gs:Span,ds:Span,refs:&Incoming,houses:&Value,o:&Value,dims:(u32,u32))->Option<Rect>{
    let id=uint(&o["ItemID"])?;let x=i64::from(uint(&o["X"])?);let y=i64::from(uint(&o["Y"])?);
    let (card,swap)=orient(&o["Orientation"])?;let(w,h)=(i64::from(dims.0),i64::from(dims.1));
    let mut r=2*(w+h);let s=&o["State"];
    if s.is_null(){
        // Normal-retail furniture/activity; no state-less building fallback.
        if !matches!(id/10_000_000,3|4){return None}
        if matches!(id,40000394|40002410|40003564|40004191|40005226|40001071){return None}
        if card{let(a,b)=if swap{(h,w)}else{(w,h)};return Some(Rect(x,y,x+a,y+b))}
        return wide(x,y,r)
    }
    let m=s.as_object()?;if m.len()!=1{return None}let(k,p)=m.iter().next()?;
    match k.as_str(){
      "FenceMode"=>{
        if !matches!(id,40100035|40100068|40700081|40700176|40700177|40700178|40700246|40700254|40700256)
            ||!fields(p,&["Diagonal"])||p["Diagonal"]!=true||!card{return None}
        let(a,b)=if swap{(h,w)}else{(w,h)};return Some(Rect(x,y,x+a,y+b))
      },
      "HouseData"=>{
        if !matches!(id,20000091|20500024|20500040|20500060|20500086|20500096)
            ||!fields(p,&["Built","PlayerHouseIndex","UpgradeState"])||p["Built"]!=true||!level(&p["UpgradeState"],1){return None}
        let ix=uint(&p["PlayerHouseIndex"])? as usize;let linked=uint(&houses.as_array()?.get(ix)?["HouseItemID"])?;
        // Exact base house link: the original shell and current house
        // definition differ; take the larger conservative envelope, never
        // treat a generic mismatched house as eligible.
        if id==20000091{if ix!=0||linked!=20500005{return None}r=r.max(96);}
        else if linked!=id{return None}
      },
      "BuildingWithSkinData"=>{
        if id!=20300002||!fields(p,&["CurrentSkinItemID","UpgradeState"])||uint(&p["CurrentSkinItemID"])?!=170200013||!level(&p["UpgradeState"],1){return None}
      },
      "StallData"=>{
        if !matches!(id,20100000|20100004|20100005|20100006|20100007|20100008|20100009)
          ||!fields(p,&["CurrentSkinItemID","ShopData","UpgradeState"])||!level(&p["UpgradeState"],3)
          ||uint(&p["CurrentSkinItemID"])?!=if id==20100000{170100012}else{170100010}||!p["ShopData"].is_object(){return None}
      },
      "Toggle"=>{if !matches!(id,40000394|40002410)||!fields(p,&["DesignID","Value"])||!p["DesignID"].is_null()||!p["Value"].is_null(){return None}},
      "SubGrid"=>{r=r.checked_add(child_extra(b,gs,ds,refs,id,p)?)?;},
      "Keyhole"=>{
        if id!=40001071||!fields(p,&["KeyholeConfigDataGUID"]){return None}
        let guid=p["KeyholeConfigDataGUID"].as_str()?;if guid.is_empty()||guid.len()>128{return None}
        let kh=f(b,world,"Keyholes").ok()?;let row=f(b,kh,guid).ok()?;
        if strv(b,row,"GUID").ok()?.as_str()!=guid{return None}
      },
      _=>return None
    }
    wide(x,y,r)
}
impl ProductSession{
    /// R01: exact horizontal three-add candidate using the same immutable
    /// Switch626 Session and existing typed provider/reference/stock checks.
    /// This is a read-only target; caller still owes R01 applicability/rights.
    #[allow(dead_code)]
    pub(crate) fn mint_switch626_r01_target(&self,e:WorkerEnvelope,gid:u32,x:u32,y:u32)->CoreResult<R01Target>{
        road_build(self,RoadBuild::Switch626)?;let st=self.lock()?;check(self,&st,&e,WorkerAction::ReadDomain)?;
        need(self.worker_bound&&st.semantic.is_none()&&st.revision==0&&st.generation==1&&gid>0,"R01_TARGET_EPOCH")?;
        let common=InstalledGeometry::fixed().ok_or(denied("R01_TARGET_COMMON_PROVIDER"))?;
        let pack=MeadowGeometry::fixed_switch626("9A239D3DB569756D",626).ok_or(denied("R01_TARGET_PROVIDER"))?;
        let b=&self.decoded;let roots=indexed_read::roots(b)?;let w=roots.world;
        let(root,g,gs,ds)=selected(b,w,gid)?;
        let next=n(b,g,"NextGridObjectID")?;
        let end=next.checked_add(3).ok_or(denied("R01_TARGET_COUNTER"))?;
        need(next>0&&end<=i32::MAX as u32,"R01_TARGET_COUNTER")?;
        let start=indexed_read::skip_ws(b,0);let top=Span{begin:start,end:indexed_read::value_end(b,start)?};
        let refs=super::placement_saved_refs::scan(b,top,gid,None,next,end)?;
        need(refs.root(gid)==1&&refs.parent(gid)==0,"R01_TARGET_REFERENCE_ALIAS")?;
        let(houses,house_span)=house_items(b,w)?;
        let objects=f(b,g,"Objects")?;let mut budget=0;
        for(_,o)in members(b,objects,4096)?{saved_grid_state(b,f(b,o,"State")?,ROAD as i32,&mut budget)?;}
        let grid=value(b,g,MAX_GRID)?;
        let minted=pack.local_r01_with_buildings(&grid,x,y,&houses,|i|common.dimensions(i),
            |o,dims|ambient(b,w,gs,ds,&refs,&houses,o,dims)).ok_or(denied("R01_TARGET_GEOMETRY"))?;
        need(minted==next,"R01_TARGET_COUNTER")?;
        // Reuse existing exact stock route + physical totals as a conservative
        // read-only witness (>3, Favorite); never subtract stock in R01.
        let(old,entry)=stock(b,roots.player)?;
        Ok(R01Target{scope:e,grid:gid,x,y,next,stock:old,root_sha:digest(b,root)?,grid_sha:digest(b,g)?,
            counter_sha:digest(b,f(b,g,"NextGridObjectID")?)?,stock_sha:digest(b,entry)?,houses_sha:digest(b,house_span)?,pairs:refs.pairs})
    }

    /// R02 four-anchor read-only target; no Stage/Writer authority.
    #[allow(dead_code)]
    pub(crate) fn mint_switch626_r02_target(&self,e:WorkerEnvelope,gid:u32,x:u32,y:u32)->CoreResult<R02Target>{
        road_build(self,RoadBuild::Switch626)?;let st=self.lock()?;check(self,&st,&e,WorkerAction::ReadDomain)?;
        need(self.worker_bound&&st.semantic.is_none()&&st.revision==0&&st.generation==1&&gid>0,"R02_TARGET_EPOCH")?;
        let common=InstalledGeometry::fixed().ok_or(denied("R02_TARGET_COMMON_PROVIDER"))?;
        let pack=MeadowGeometry::fixed_switch626("9A239D3DB569756D",626).ok_or(denied("R02_TARGET_PROVIDER"))?;
        let b=&self.decoded;let roots=indexed_read::roots(b)?;let w=roots.world;
        let(root,g,gs,ds)=selected(b,w,gid)?;
        let next=n(b,g,"NextGridObjectID")?;
        let end=next.checked_add(4).ok_or(denied("R02_TARGET_COUNTER"))?;
        need(next>0&&end<=i32::MAX as u32,"R02_TARGET_COUNTER")?;
        let start=indexed_read::skip_ws(b,0);let top=Span{begin:start,end:indexed_read::value_end(b,start)?};
        let refs=super::placement_saved_refs::scan(b,top,gid,None,next,end)?;
        need(refs.root(gid)==1&&refs.parent(gid)==0,"R02_TARGET_REFERENCE_ALIAS")?;
        let(houses,house_span)=house_items(b,w)?;
        let objects=f(b,g,"Objects")?;let mut budget=0;
        for(_,o)in members(b,objects,4096)?{saved_grid_state(b,f(b,o,"State")?,ROAD as i32,&mut budget)?;}
        let grid=value(b,g,MAX_GRID)?;
        let minted=pack.local_r02_with_buildings(&grid,x,y,&houses,|i|common.dimensions(i),
            |o,dims|ambient(b,w,gs,ds,&refs,&houses,o,dims)).ok_or(denied("R02_TARGET_GEOMETRY"))?;
        need(minted==next,"R02_TARGET_COUNTER")?;
        // R02 needs four owned units and a positive remainder. Read-only witness.
        let(old,entry)=stock(b,roots.player)?;
        need(old>4,"R02_TARGET_STOCK")?;
        Ok(R02Target{scope:e,grid:gid,x,y,next,stock:old,root_sha:digest(b,root)?,grid_sha:digest(b,g)?,
            counter_sha:digest(b,f(b,g,"NextGridObjectID")?)?,stock_sha:digest(b,entry)?,houses_sha:digest(b,house_span)?,pairs:refs.pairs})
    }

    /// Mint only an opaque target from one immutable, current worker session.
    /// No UI-supplied provider, rights, rectangle, hashes or Stage permission.
    #[allow(dead_code)]
    pub(crate) fn mint_sr03_target(&self,e:WorkerEnvelope,gid:u32,keep:u32,moved:u32)->CoreResult<Sr03Target>{
        self.mint_mixed_road_target(e,gid,keep,moved,RoadBuild::Steam626)
    }
    fn mint_mixed_road_target(&self,e:WorkerEnvelope,gid:u32,keep:u32,moved:u32,scope:RoadBuild)->CoreResult<Sr03Target>{
        road_build(self,scope)?;let st=self.lock()?;check(self,&st,&e,WorkerAction::ReadDomain)?;
        need(self.worker_bound&&st.semantic.is_none()&&st.revision==0&&st.generation==1&&gid>0,"SR03_TARGET_EPOCH")?;
        let common=InstalledGeometry::fixed().ok_or(denied("SR03_TARGET_COMMON_PROVIDER"))?;
        let pack=match scope{RoadBuild::Steam626=>MeadowGeometry::fixed(EXACT_STEAM,626),RoadBuild::Switch626=>MeadowGeometry::fixed_switch626("9A239D3DB569756D",626)}.ok_or(denied("SR03_TARGET_PROVIDER"))?;
        let b=&self.decoded;let roots=indexed_read::roots(b)?;let w=roots.world;
        let(root,g,gs,ds)=selected(b,w,gid)?;
        let next=n(b,g,"NextGridObjectID")?;let start=indexed_read::skip_ws(b,0);
        let top=Span{begin:start,end:indexed_read::value_end(b,start)?};
        let refs=super::placement_saved_refs::scan_sr03(b,top,gid,keep,moved,next)?;
        need(refs.root(gid)==1&&refs.parent(gid)==0,"SR03_TARGET_REFERENCE_ALIAS")?;
        let(houses,house_span)=house_items(b,w)?;
        let objects=f(b,g,"Objects")?;let mut budget=0;
        for(_,o)in members(b,objects,4096)?{saved_grid_state(b,f(b,o,"State")?,ROAD as i32,&mut budget)?;}
        let grid=value(b,g,MAX_GRID)?;
        let local=pack.local_candidate_with_buildings(&grid,keep,moved,&houses,|i|common.dimensions(i),
            |o,dims|ambient(b,w,gs,ds,&refs,&houses,o,dims)).ok_or(denied("SR03_TARGET_GEOMETRY"))?;
        let(old,entry)=stock(b,roots.player)?;
        Ok(Sr03Target{scope:e,grid:gid,local,stock:old,root_sha:digest(b,root)?,grid_sha:digest(b,g)?,
          keep_sha:digest(b,f(b,objects,&keep.to_string())?)?,moved_sha:digest(b,f(b,objects,&moved.to_string())?)?,
          counter_sha:digest(b,f(b,g,"NextGridObjectID")?)?,stock_sha:digest(b,entry)?,houses_sha:digest(b,house_span)?,pairs:refs.pairs})
    }
}

#[cfg(any(feature="product-steam626-sr03-scoped",feature="product-switch626-rm01-scoped"))]
struct Sr03Prepared{target:Sr03Target,edits:Vec<Replacement>,projected:[u8;32]}
#[cfg(any(feature="product-steam626-sr03-scoped",feature="product-switch626-rm01-scoped"))]
impl ProductSession{
    fn prepare_sr03_product(&self,e:WorkerEnvelope,grid:u32,keep:u32,moved:u32)->CoreResult<Sr03Prepared>{
        self.prepare_mixed_road_product(e,grid,keep,moved,RoadBuild::Steam626)
    }
    fn prepare_mixed_road_product(&self,e:WorkerEnvelope,grid:u32,keep:u32,moved:u32,scope:RoadBuild)->CoreResult<Sr03Prepared>{
        use super::super::switch624_road_rm01::{MixedQ5Expected,collect_mixed_q5_current};
        let t=self.mint_mixed_road_target(e,grid,keep,moved,scope)?;
        let st=self.lock()?;check(self,&st,&e,WorkerAction::ReadDomain)?;
        need(st.semantic.is_none()&&st.revision==0&&st.generation==1,"SR03_PRODUCT_EPOCH")?;
        let b=&self.decoded;let r=indexed_read::roots(b)?;
        let start=indexed_read::skip_ws(b,0);let top=Span{begin:start,end:indexed_read::value_end(b,start)?};
        let (_,defs)=super::pack()?;super::subscribers_bound(b,r.player,r.world,top,defs,ROAD as i32,true,scope==RoadBuild::Switch626)?;
        let project=|s:Span,keys:&[&str]|->CoreResult<Value>{
            let mut m=serde_json::Map::new();
            for &k in keys{m.insert(k.into(),value(b,f(b,s,k)?,MAX_GRID)?);}
            Ok(Value::Object(m))
        };
        let player=project(r.player,&["AchievementsData","DutySlots","BattlePassStates"])?;
        let world=project(r.world,&["MissionSlots","RecurringEvents","TimeLostTreasures","NextTimeLostTreasureID","Snippets","NextSnippetID"])?;
        match scope{
            RoadBuild::Steam626=>{#[cfg(feature="product-steam626-sr03-scoped")] super::comp03_product_target::check_sr03_applicability(&player,&world)?;#[cfg(not(feature="product-steam626-sr03-scoped"))] return Err(denied("SR03_FEATURE_OFF"));},
            RoadBuild::Switch626=>{#[cfg(feature="product-switch626-rm01-scoped")] super::comp03_product_target::check_switch626_rm01_applicability(&player,&world)?;#[cfg(not(feature="product-switch626-rm01-scoped"))] return Err(denied("RM01_FEATURE_OFF"));},
        }
        let source_sha=super::hex(&e.expected_decoded_sha256);
        let grid_sha=super::hex(&t.grid_sha);let stock_sha=super::hex(&t.stock_sha);
        let expected=MixedQ5Expected{source_sha:&source_sha,grid:t.grid,retained:t.local.keep,moved:t.local.moved,next:t.local.next,amount:t.stock,grid_sha:&grid_sha,inventory_entry_sha:&stock_sha};
        let mut edits=collect_mixed_q5_current(self,&expected)?;
        need(edits.len()==6,"SR03_PRODUCT_EDIT_COUNT")?;
        edits.sort_by_key(|v|v.span.begin);
        let mut hasher=Sha256::new();let mut pos=0;
        for edit in &edits{
            need(edit.span.begin>=pos&&edit.span.end>=edit.span.begin&&edit.span.end<=b.len()&&raw(b,edit.span)?==edit.old.as_slice(),"SR03_PRODUCT_RAW_CAS")?;
            hasher.update(&b[pos..edit.span.begin]);hasher.update(&edit.new);pos=edit.span.end;
        }
        hasher.update(&b[pos..]);let projected=hasher.finalize().into();
        Ok(Sr03Prepared{target:t,edits,projected})
    }
    #[cfg(feature="product-steam626-sr03-scoped")]
    pub(crate) fn preview_sr03_product(&self,e:WorkerEnvelope,grid:u32,keep:u32,moved:u32)->CoreResult<Value>{
        self.preview_mixed_road_product(e,grid,keep,moved,RoadBuild::Steam626)
    }
    #[cfg(feature="product-switch626-rm01-scoped")]
    pub(crate) fn preview_switch626_rm01_product(&self,e:WorkerEnvelope,grid:u32,keep:u32,moved:u32)->CoreResult<Value>{
        self.preview_mixed_road_product(e,grid,keep,moved,RoadBuild::Switch626)
    }
    fn preview_mixed_road_product(&self,e:WorkerEnvelope,grid:u32,keep:u32,moved:u32,scope:RoadBuild)->CoreResult<Value>{
        let p=self.prepare_mixed_road_product(e,grid,keep,moved,scope)?;let t=&p.target;
        let contract=if scope==RoadBuild::Steam626{"wand.worker.steam626.scoped-sr03-mixed-q5@1"}else{"wand.worker.switch626.scoped-rm01-mixed-q5@1"};
        Ok(json!({"contract":contract,"itemId":ROAD,
            "gridId":t.grid,"retainedId":t.local.keep,"movedId":t.local.moved,"expectedNextId":t.local.next,
            "oldAmount":t.stock,"newAmount":t.stock-3,"inventoryDelta":-3,
            "gridSha256":super::hex(&t.grid_sha),"inventoryEntrySha256":super::hex(&t.stock_sha),
            "projectedDecodedSha256":super::hex(&p.projected),"exactFieldChangedCount":8,
            "sessionId":super::hex(&e.session_id),"revision":e.expected_revision,"indexGeneration":e.expected_index_generation,
            "decodedSha256":super::hex(&e.expected_decoded_sha256),"productWriterAuthorized":false,"originalOverwriteAuthorized":false}))
    }
    #[cfg(feature="product-steam626-sr03-scoped")]
    pub(crate) fn stage_sr03_product(&self,e:WorkerEnvelope,grid:u32,keep:u32,moved:u32,next:u32,old:u32,
        grid_sha:[u8;32],stock_sha:[u8;32],projected:[u8;32])->CoreResult<SemanticStageReceipt>{
        self.stage_mixed_road_product(e,grid,keep,moved,next,old,grid_sha,stock_sha,projected,RoadBuild::Steam626)
    }
    #[cfg(feature="product-switch626-rm01-scoped")]
    pub(crate) fn stage_switch626_rm01_product(&self,e:WorkerEnvelope,grid:u32,keep:u32,moved:u32,next:u32,old:u32,
        grid_sha:[u8;32],stock_sha:[u8;32],projected:[u8;32])->CoreResult<SemanticStageReceipt>{
        self.stage_mixed_road_product(e,grid,keep,moved,next,old,grid_sha,stock_sha,projected,RoadBuild::Switch626)
    }
    fn stage_mixed_road_product(&self,e:WorkerEnvelope,grid:u32,keep:u32,moved:u32,next:u32,old:u32,
        grid_sha:[u8;32],stock_sha:[u8;32],projected:[u8;32],scope:RoadBuild)->CoreResult<SemanticStageReceipt>{
        need(e.action==WorkerAction::Stage,"SR03_PRODUCT_STAGE_ACTION")?;
        let p=self.prepare_mixed_road_product(WorkerEnvelope{action:WorkerAction::ReadDomain,..e},grid,keep,moved,scope)?;
        let t=&p.target;
        need(t.grid==grid&&t.local.keep==keep&&t.local.moved==moved&&t.local.next==next&&t.stock==old&&
            t.grid_sha==grid_sha&&t.stock_sha==stock_sha&&p.projected==projected,"SR03_PRODUCT_STAGE_CAS")?;
        self.commit_semantic_replacements(e,p.edits,8,Some(p.projected))
    }
}
// R02 product scope: separate feature, no RM01/SR03 dispatch or authority.
#[cfg(feature="product-switch626-r02-scoped")]
struct R02Prepared{target:R02Target,edits:Vec<Replacement>,projected:[u8;32]}
#[cfg(feature="product-switch626-r02-scoped")]
impl ProductSession{
    fn prepare_switch626_r02_product(&self,e:WorkerEnvelope,grid:u32,x:u32,y:u32)->CoreResult<R02Prepared>{
        use super::super::switch624_road_rm01::{R02Q4Expected,collect_r02_q4_current};
        let t=self.mint_switch626_r02_target(e,grid,x,y)?;
        let st=self.lock()?;check(self,&st,&e,WorkerAction::ReadDomain)?;
        need(st.semantic.is_none()&&st.revision==0&&st.generation==1,"R02_PRODUCT_EPOCH")?;
        let b=&self.decoded;let r=indexed_read::roots(b)?;
        let start=indexed_read::skip_ws(b,0);let top=Span{begin:start,end:indexed_read::value_end(b,start)?};
        // Same current Switch626 subscriber and applicability closure, with
        // four owned units debited, positive remainder, no relaxed exclusions.
        let (_,defs)=super::pack()?;
        super::subscribers_bound(b,r.player,r.world,top,defs,ROAD as i32,true,true)?;
        let project=|s:Span,keys:&[&str]|->CoreResult<Value>{
            let mut m=serde_json::Map::new();
            for &k in keys{m.insert(k.into(),value(b,f(b,s,k)?,MAX_GRID)?);}
            Ok(Value::Object(m))
        };
        let player=project(r.player,&["AchievementsData","DutySlots","BattlePassStates"])?;
        let world=project(r.world,&["MissionSlots","RecurringEvents","TimeLostTreasures","NextTimeLostTreasureID","Snippets","NextSnippetID"])?;
        super::comp03_product_target::check_switch626_rm01_applicability(&player,&world)?;
        let source_sha=super::hex(&e.expected_decoded_sha256);
        let grid_sha=super::hex(&t.grid_sha);let stock_sha=super::hex(&t.stock_sha);
        let expected=R02Q4Expected{source_sha:&source_sha,grid:t.grid,x:t.x,y:t.y,next:t.next,
            amount:t.stock,grid_sha:&grid_sha,inventory_entry_sha:&stock_sha};
        let mut edits=collect_r02_q4_current(self,&expected)?;
        need(edits.len()==3,"R02_PRODUCT_EDIT_COUNT")?;
        edits.sort_by_key(|v|v.span.begin);
        let mut hasher=Sha256::new();let mut pos=0;
        for edit in &edits{
            need(edit.span.begin>=pos&&edit.span.end>=edit.span.begin&&edit.span.end<=b.len()&&raw(b,edit.span)?==edit.old.as_slice(),"R02_PRODUCT_RAW_CAS")?;
            hasher.update(&b[pos..edit.span.begin]);hasher.update(&edit.new);pos=edit.span.end;
        }
        hasher.update(&b[pos..]);
        Ok(R02Prepared{target:t,edits,projected:hasher.finalize().into()})
    }
    #[allow(dead_code)]
    pub(crate) fn preview_switch626_r02_product(&self,e:WorkerEnvelope,grid:u32,x:u32,y:u32)->CoreResult<Value>{
        let p=self.prepare_switch626_r02_product(e,grid,x,y)?;let t=&p.target;
        Ok(json!({"contract":"wand.worker.switch626.scoped-r02-diagonal-q4@1",
            "itemId":ROAD,"gridId":t.grid,"x":t.x,"y":t.y,"expectedNextId":t.next,
            "oldAmount":t.stock,"newAmount":t.stock-4,"inventoryDelta":-4,
            "gridSha256":super::hex(&t.grid_sha),"inventoryEntrySha256":super::hex(&t.stock_sha),
            "projectedDecodedSha256":super::hex(&p.projected),"exactFieldChangedCount":6,
            "sessionId":super::hex(&e.session_id),"revision":e.expected_revision,"indexGeneration":e.expected_index_generation,
            "decodedSha256":super::hex(&e.expected_decoded_sha256),"productWriterAuthorized":false,"originalOverwriteAuthorized":false}))
    }
    #[allow(dead_code)]
    pub(crate) fn stage_switch626_r02_product(&self,e:WorkerEnvelope,grid:u32,x:u32,y:u32,next:u32,old:u32,
        grid_sha:[u8;32],stock_sha:[u8;32],projected:[u8;32])->CoreResult<SemanticStageReceipt>{
        need(e.action==WorkerAction::Stage,"R02_PRODUCT_STAGE_ACTION")?;
        let p=self.prepare_switch626_r02_product(WorkerEnvelope{action:WorkerAction::ReadDomain,..e},grid,x,y)?;
        let t=&p.target;
        need(t.grid==grid&&t.x==x&&t.y==y&&t.next==next&&t.stock==old&&
            t.grid_sha==grid_sha&&t.stock_sha==stock_sha&&p.projected==projected,"R02_PRODUCT_STAGE_CAS")?;
        self.commit_semantic_replacements(e,p.edits,6,Some(p.projected))
    }
}
#[cfg(test)]
mod tests{
 use super::*;
 fn doc()->Value{
  let p=MeadowGeometry::fixed(EXACT_STEAM,626).unwrap();
  let(x,y)=(0..382).step_by(4).flat_map(|x|(0..194).step_by(4).map(move|y|(x,y)))
   .find(|&(x,y)|[(x,y),(x+4,y),(x+4,y+4),(x+8,y),(x+8,y+4)].iter().all(|&(x,y)|(0..2).all(|a|(0..2).all(|b|p.floor4(x+a,y+b))))).unwrap();
  let row=|id,x,y|json!({"ID":id,"ItemID":ROAD,"X":x,"Y":y,"Orientation":"GridOrientation_Down","State":null});
  json!({"GameInfo":{"Version":626},"World":{"Villages":[{"Areas":{"2":{"Unlocked":true,"GridIDs":[90001]}}}],
   "PlayerHouses":[],"GridCollection":{"Grids":{"90001":{"ID":90001,"GridDataPath":GRID,"GridDefaultLayoutPath":"","TessellationFactor":2,"NextGridObjectID":50,"Objects":{"10":row(10,x,y),"11":row(11,x+4,y)}}},"DiffGrids":{}}},
   "Player":{"ListInventories":{"0":{"ID":0,"CompatibleItemType":"ItemType_Furniture","CompatibleFurnitureTypes":{"List":["FurnitureItemType_GroundAlteration"]},"Inventory":{"40100068":{"Amount":10,"Marker":"ItemMarker_Favorite"}}}},"ContainerInventories":{}}})
 }
 fn open(d:&Value)->ProductSession{
  let mut s=ProductSession::open_decoded_readonly(serde_json::to_vec(d).unwrap(),crate::BuildIdentity{platform:Platform::SteamWindows,build_kind:BuildKind::SteamFullVersion,build_id:EXACT_STEAM.into(),schema:626,externally_attested:true}).unwrap();s.worker_bound=true;s
 }
 fn env(s:&ProductSession)->WorkerEnvelope{let r=s.receipt().unwrap();WorkerEnvelope{contract:PRODUCT_WORKER_CONTRACT,session_id:r.session_id,expected_revision:r.revision,expected_index_generation:r.index_generation,expected_decoded_sha256:r.decoded_sha256,action:WorkerAction::ReadDomain}}

 #[cfg(feature="product-steam626-sr03-scoped")]
 #[test]fn sr03_product_exact8_atomic_cas_and_lifecycle(){
  let mut d=doc();
  d["World"]["MissionSlots"]=json!({});d["World"]["RecurringEvents"]=json!({});
  d["World"]["TimeLostTreasures"]=json!({});d["World"]["NextTimeLostTreasureID"]=json!(1);
  d["World"]["Snippets"]=json!({});d["World"]["NextSnippetID"]=json!(0);
  d["Player"]["AchievementsData"]=json!([]);d["Player"]["DutySlots"]=json!({});
  d["Player"]["EvolveStatesProfile"]=json!({"EvolveProgressState":{}});
  d["Player"]["BattlePassStates"]=json!({"Progress":{},"FtueProgress":{"TasksProgress":[],"WeeklyTasksProgress":[]}});
  d["ConditionalEventHistory"]=json!({"ActiveEvents":{}});
  let s=open(&d);let e=env(&s);let p=s.prepare_sr03_product(e,90001,10,11).unwrap();
  let t=&p.target;let q=s.preview_sr03_product(e,90001,10,11).unwrap();
  assert_eq!(q["exactFieldChangedCount"],8);assert_eq!(q["newAmount"],7);
  let stage=WorkerEnvelope{action:WorkerAction::Stage,..e};
  assert!(s.stage_sr03_product(e,90001,10,11,50,10,t.grid_sha,t.stock_sha,p.projected).is_err());
  assert!(s.stage_sr03_product(stage,90001,10,11,51,10,t.grid_sha,t.stock_sha,p.projected).is_err());
  assert!(s.stage_sr03_product(stage,90001,10,11,50,9,t.grid_sha,t.stock_sha,p.projected).is_err());
  assert!(s.stage_sr03_product(stage,90001,10,11,50,10,[0;32],t.stock_sha,p.projected).is_err());
  assert!(s.stage_sr03_product(stage,90001,10,11,50,10,t.grid_sha,[0;32],p.projected).is_err());
  assert!(s.stage_sr03_product(stage,90001,10,11,50,10,t.grid_sha,t.stock_sha,[0;32]).is_err());
  assert_eq!(env(&s),e);
  let receipt=s.stage_sr03_product(stage,90001,10,11,50,10,t.grid_sha,t.stock_sha,p.projected).unwrap();
  assert_eq!(receipt.exact_field_changed_count,8);assert_eq!(receipt.staged_decoded_sha256,p.projected);
  assert!(!receipt.product_writer_authorized&&!receipt.original_overwrite_authorized);
  assert!(s.stage_sr03_product(stage,90001,10,11,50,10,t.grid_sha,t.stock_sha,p.projected).is_err());
  assert_eq!(s.receipt().unwrap().decoded_sha256,e.expected_decoded_sha256);
  let mut bad=d.clone();bad["World"]["RecurringEvents"]=json!({"999999999":{"Unknown":{}}});
  let bad=open(&bad);assert!(bad.preview_sr03_product(env(&bad),90001,10,11).is_err());
 }
 #[cfg(feature="product-switch626-rm01-scoped")]
 #[test]fn switch626_rm01_product_exact8_build_delta_and_lifecycle(){
  let mut d=doc();d["World"]["MissionSlots"]=json!({});d["World"]["RecurringEvents"]=json!({"1":{"ItemSpawning":{"RecurringEventItemID":2010000176,"NextOccurrence":"2026-01-01T00:00:00Z","EndDate":null,"LastOccurrence":null}}});
  d["World"]["TimeLostTreasures"]=json!({});d["World"]["NextTimeLostTreasureID"]=json!(1);d["World"]["Snippets"]=json!({});d["World"]["NextSnippetID"]=json!(0);
  d["Player"]["AchievementsData"]=json!([]);d["Player"]["DutySlots"]=json!({"0":{"Slots":[{"State":"DutySlotState_OnGoing","DutyId":2110000038u32,"DifficultyLayer":0,"ItemsUsed":[],"StepData":{"ItemFilter":{"Data":{"Item":0,"ItemList":[],"Type":"ItemType_ActivityItem","ActivityItemType":"ActivityItemType_Crop","AnyActivityItem":false}}}}]}});
  d["Player"]["EvolveStatesProfile"]=json!({"EvolveProgressState":{}});d["Player"]["BattlePassStates"]=json!({"Progress":{},"FtueProgress":{"TasksProgress":[],"WeeklyTasksProgress":[]}});d["ConditionalEventHistory"]=json!({"ActiveEvents":{}});
  let open_switch=|v:&Value|{let mut s=ProductSession::open_decoded_readonly(serde_json::to_vec(v).unwrap(),crate::BuildIdentity{platform:Platform::Switch,build_kind:BuildKind::SwitchBid,build_id:"9A239D3DB569756D".into(),schema:626,externally_attested:true}).unwrap();s.worker_bound=true;s};
  let s=open_switch(&d);let e=env(&s);let p=s.prepare_mixed_road_product(e,90001,10,11,RoadBuild::Switch626).unwrap();let t=&p.target;
  let q=s.preview_switch626_rm01_product(e,90001,10,11).unwrap();assert_eq!(q["contract"],"wand.worker.switch626.scoped-rm01-mixed-q5@1");assert_eq!(q["exactFieldChangedCount"],8);assert_eq!(q["newAmount"],7);
  let stage=WorkerEnvelope{action:WorkerAction::Stage,..e};assert!(s.stage_switch626_rm01_product(stage,90001,10,11,51,10,t.grid_sha,t.stock_sha,p.projected).is_err());
  assert!(s.stage_switch626_rm01_product(stage,90001,10,11,50,10,t.grid_sha,t.stock_sha,[0;32]).is_err());
  let r=s.stage_switch626_rm01_product(stage,90001,10,11,50,10,t.grid_sha,t.stock_sha,p.projected).unwrap();assert_eq!(r.exact_field_changed_count,8);assert_eq!(r.staged_decoded_sha256,p.projected);assert!(!r.product_writer_authorized);
  let now=env(&s);s.undo_typed_semantic_batch(WorkerEnvelope{action:WorkerAction::Stage,..now}).unwrap();let now=env(&s);s.redo_typed_semantic_batch(WorkerEnvelope{action:WorkerAction::Stage,..now}).unwrap();let now=WorkerEnvelope{action:WorkerAction::ExportEditedCopy,..env(&s)};let out=s.take_typed_semantic_decoded_once(now).unwrap();assert_eq!(sha(&out),p.projected);assert!(s.take_typed_semantic_decoded_once(now).is_err());
  let steam=open(&d);assert!(steam.preview_switch626_rm01_product(env(&steam),90001,10,11).is_err());
  for mode in 0..5{let mut bad=d.clone();match mode{0=>bad["World"]["RecurringEvents"]["1"]["ItemSpawning"]["RecurringEventItemID"]=json!(2010000179),1=>bad["World"]["RecurringEvents"]["1"]["ItemSpawning"]["GridID"]=json!(1),2=>bad["Player"]["DutySlots"]["0"]["Slots"][0]["DifficultyLayer"]=json!(1),3=>bad["Player"]["DutySlots"]["0"]["Slots"][0]["ItemsUsed"]=json!([40100068]),_=>bad["Player"]["DutySlots"]["0"]["Slots"][0]["StepData"]["ItemFilter"]["Data"]["Item"]=json!(40100068)}let x=open_switch(&bad);assert!(x.preview_switch626_rm01_product(env(&x),90001,10,11).is_err(),"mode {mode}");}
 }
 #[test]fn switch626_r01_current_session_target_no_seed_exemption(){
  let mut d=doc();
  let x=d["World"]["GridCollection"]["Grids"]["90001"]["Objects"]["10"]["X"].as_u64().unwrap() as u32;
  let y=d["World"]["GridCollection"]["Grids"]["90001"]["Objects"]["10"]["Y"].as_u64().unwrap() as u32;
  let open_switch=|v:&Value|{let mut s=ProductSession::open_decoded_readonly(serde_json::to_vec(v).unwrap(),crate::BuildIdentity{platform:Platform::Switch,build_kind:BuildKind::SwitchBid,build_id:"9A239D3DB569756D".into(),schema:626,externally_attested:true}).unwrap();s.worker_bound=true;s};
  let s=open_switch(&d);
  // Existing mixed seeds are NOT exempt in R01.
  assert!(s.mint_switch626_r01_target(env(&s),90001,x,y).is_err());
  let far_x=if x<190{388}else{0};let far_y=if y<100{196}else{0};
  let g=&mut d["World"]["GridCollection"]["Grids"]["90001"];
  g["Objects"]["10"]["X"]=json!(far_x);g["Objects"]["10"]["Y"]=json!(far_y);
  g["Objects"].as_object_mut().unwrap().remove("11");
  let s=open_switch(&d);let e=env(&s);let before=s.receipt().unwrap();
  let t=s.mint_switch626_r01_target(e,90001,x,y).unwrap();
  assert_eq!((t.grid,t.x,t.y,t.next,t.stock),(90001,x,y,50,10));
  assert_eq!(s.receipt().unwrap(),before);
  let steam=open(&d);assert!(steam.mint_switch626_r01_target(env(&steam),90001,x,y).is_err());
  assert!(open_switch(&d).mint_switch626_r01_target(e,90001,x,y).is_err());
  assert!(s.mint_switch626_r01_target(WorkerEnvelope{expected_revision:1,..e},90001,x,y).is_err());
  assert!(s.mint_switch626_r01_target(WorkerEnvelope{action:WorkerAction::Stage,..e},90001,x,y).is_err());
  assert!(s.mint_switch626_r01_target(e,90001,x+1,y).is_err());
  for i in 0..12{let mut q=d.clone();match i{
   0=>q["World"]["Villages"][0]["Areas"]["2"]["Unlocked"]=json!(false),
   1=>q["Unknown"]=json!({"GridIDs":[90001]}),
   2=>q["Unknown"]=json!({"GridID":90001,"ObjectID":50}),
   3=>q["Unknown"]=json!({"GridID":90001,"ObjectID":51}),
   4=>q["Unknown"]=json!({"GridID":90001,"ObjectID":52}),
   5=>q["World"]["GridCollection"]["DiffGrids"]["90001"]=json!({"ID":90001}),
   6=>q["World"]["GridCollection"]["Grids"]["90001"]["GridDefaultLayoutPath"]=json!("foreign"),
   7=>q["World"]["GridCollection"]["Grids"]["90001"]["NextGridObjectID"]=json!(i32::MAX),
   8=>q["Player"]["ListInventories"]["0"]["Inventory"]["40100068"]["Amount"]=json!(0),
   9=>q["Player"]["ListInventories"]["0"]["Inventory"]["40100068"]["Marker"]=json!("ItemMarker_None"),
   10=>q["World"]["GridCollection"]["Grids"]["90001"]["Objects"]["10"]["X"]=json!(x),
   _=>q["World"]["GridCollection"]["Grids"]["90001"]["Objects"]["10"]["ID"]=json!(50)
  }
  if i==10{q["World"]["GridCollection"]["Grids"]["90001"]["Objects"]["10"]["Y"]=json!(y);}
  let s=open_switch(&q);let before=s.receipt().unwrap();
  assert!(s.mint_switch626_r01_target(env(&s),90001,x,y).is_err(),"R01 mode {i}");
  assert_eq!(s.receipt().unwrap(),before);}
 }

 #[cfg(feature="product-switch626-r02-scoped")]
 #[test]fn qa1731_r02_stage_exact6_lexical_delta(){
  let mut d=doc();
  let p=MeadowGeometry::fixed_switch626("9A239D3DB569756D",626).unwrap();
  let (x,y)=(0..387u32).step_by(4).flat_map(|x|(0..195u32).step_by(4).map(move|y|(x,y))).find(|&(x,y)|[(x,y),(x+4,y+4),(x+4,y),(x,y+4)].iter().all(|&(a,b)|(0..2).all(|i|(0..2).all(|j|p.floor4(a+i,b+j))))).unwrap();
  let g=&mut d["World"]["GridCollection"]["Grids"]["90001"];
  g["Objects"]["10"]["X"]=json!(if x<190{388}else{0});g["Objects"]["10"]["Y"]=json!(if y<100{196}else{0});
  g["Objects"]["10"]["QRCKeep"]=json!({"amount":4,"old":50});g["Objects"].as_object_mut().unwrap().remove("11");
  d["World"]["MissionSlots"]=json!({});d["World"]["RecurringEvents"]=json!({});
  d["World"]["TimeLostTreasures"]=json!({});d["World"]["NextTimeLostTreasureID"]=json!(1);
  d["World"]["Snippets"]=json!({});d["World"]["NextSnippetID"]=json!(0);
  d["Player"]["AchievementsData"]=json!([]);d["Player"]["DutySlots"]=json!({});
  d["Player"]["EvolveStatesProfile"]=json!({"EvolveProgressState":{}});
  d["Player"]["BattlePassStates"]=json!({"Progress":{},"FtueProgress":{"TasksProgress":[],"WeeklyTasksProgress":[]}});
  d["ConditionalEventHistory"]=json!({"ActiveEvents":{}});
  d["QRC1731Opaque"]=json!({"escaped":"keep","stock":5,"counter":50});
  let make=|raw:&str|{let mut s=ProductSession::open_decoded_readonly(raw.as_bytes().to_vec(),crate::BuildIdentity{platform:Platform::Switch,build_kind:BuildKind::SwitchBid,build_id:"9A239D3DB569756D".into(),schema:626,externally_attested:true}).unwrap();s.worker_bound=true;s};
  let mut pos=0;let mut neg=0;
  for stock in [5u32,17]{
   let mut d=d.clone();d["Player"]["ListInventories"]["0"]["Inventory"]["40100068"]["Amount"]=json!(stock);
   let raw=serde_json::to_string(&d).unwrap().replace("\"escaped\":\"keep\"","\"escaped\":\"\\u006beep\"");
   let s=make(&raw);let e=env(&s);let before=s.receipt().unwrap();
   let q=s.preview_switch626_r02_product(e,90001,x,y).unwrap();
   let oldobj=serde_json::to_string(&d["World"]["GridCollection"]["Grids"]["90001"]["Objects"]).unwrap();
   let mut newobj=oldobj[..oldobj.len()-1].to_string();
   for (i,(a,b)) in [(x,y),(x+4,y+4),(x+4,y),(x,y+4)].into_iter().enumerate(){
    let id=50+i;let row=json!({"ID":id,"ItemID":40100068,"X":a,"Y":b,"Orientation":"GridOrientation_Down","State":{"FenceMode":{"Diagonal":true}}});
    newobj.push_str(&format!(",\"{id}\":{}",serde_json::to_string(&row).unwrap()));
   }
   newobj.push('}');
   assert_eq!(raw.matches(&oldobj).count(),1);
   let oldamount=format!("\"Amount\":{stock},");let newamount=format!("\"Amount\":{},",stock-4);
   assert_eq!(raw.matches(&oldamount).count(),1);
   let expected=raw.replacen(&oldobj,&newobj,1).replacen("\"NextGridObjectID\":50","\"NextGridObjectID\":54",1).replacen(&oldamount,&newamount,1);
   let projected=sha(expected.as_bytes());
   assert_eq!(q["projectedDecodedSha256"],super::super::hex(&projected));
   assert_eq!(q["exactFieldChangedCount"],6);assert_eq!(q["newAmount"],stock-4);assert_eq!(q["inventoryDelta"],-4);
   let t=s.mint_switch626_r02_target(e,90001,x,y).unwrap();
   let stage=WorkerEnvelope{action:WorkerAction::Stage,..e};
   let call=|s:&ProductSession,e:WorkerEnvelope,g:u32,a:u32,b:u32,n:u32,o:u32,gs:[u8;32],ss:[u8;32],p:[u8;32]|s.stage_switch626_r02_product(e,g,a,b,n,o,gs,ss,p);
   for (g,a,b,n,o,gs,ss,p) in [(90002,x,y,50,stock,t.grid_sha,t.stock_sha,projected),(90001,x+4,y,50,stock,t.grid_sha,t.stock_sha,projected),(90001,x,y,54,stock,t.grid_sha,t.stock_sha,projected),(90001,x,y,50,stock-4,t.grid_sha,t.stock_sha,projected),(90001,x,y,50,stock,[0;32],t.stock_sha,projected),(90001,x,y,50,stock,t.grid_sha,[0;32],projected),(90001,x,y,50,stock,t.grid_sha,t.stock_sha,[0;32])]{assert!(call(&s,stage,g,a,b,n,o,gs,ss,p).is_err());neg+=1;}
   assert!(call(&make(&raw),stage,90001,x,y,50,stock,t.grid_sha,t.stock_sha,projected).is_err());neg+=1;
   assert_eq!(s.receipt().unwrap(),before);
   let r=call(&s,stage,90001,x,y,50,stock,t.grid_sha,t.stock_sha,projected).unwrap();
   assert_eq!(r.exact_field_changed_count,6);assert_eq!(r.staged_decoded_sha256,projected);assert!(!r.product_writer_authorized&&!r.original_overwrite_authorized);
   assert!(call(&s,stage,90001,x,y,50,stock,t.grid_sha,t.stock_sha,projected).is_err());neg+=1;
   s.undo_typed_semantic_batch(WorkerEnvelope{action:WorkerAction::Stage,..env(&s)}).unwrap();
   assert!(s.take_typed_semantic_decoded_once(WorkerEnvelope{action:WorkerAction::ExportEditedCopy,..env(&s)}).is_err());neg+=1;
   s.redo_typed_semantic_batch(WorkerEnvelope{action:WorkerAction::Stage,..env(&s)}).unwrap();
   let out_e=WorkerEnvelope{action:WorkerAction::ExportEditedCopy,..env(&s)};
   assert_eq!(s.take_typed_semantic_decoded_once(out_e).unwrap(),expected.as_bytes());
   assert!(s.take_typed_semantic_decoded_once(out_e).is_err());neg+=1;
   assert_eq!(sha(&s.decoded),e.expected_decoded_sha256);pos+=1;
  }
  for amount in [0,4,10000]{let mut bad=d.clone();bad["Player"]["ListInventories"]["0"]["Inventory"]["40100068"]["Amount"]=json!(amount);let s=make(&serde_json::to_string(&bad).unwrap());assert!(s.preview_switch626_r02_product(env(&s),90001,x,y).is_err());neg+=1;}
  assert_eq!((pos,neg),(2,25));println!("QRC1731_R02_STAGE_ACTUAL {pos}POS {neg}NEG EXACT6");
 }
 #[cfg(feature="product-switch626-r02-scoped")]
 #[test]fn switch626_r02_product_exact6_debit4_cas(){
  let mut d=doc();
  let p=MeadowGeometry::fixed_switch626("9A239D3DB569756D",626).unwrap();
  let (x,y)=(0..387u32).step_by(4).flat_map(|x|(0..195u32).step_by(4).map(move|y|(x,y))).find(|&(x,y)|[(x,y),(x+4,y+4),(x+4,y),(x,y+4)].iter().all(|&(a,b)|(0..2).all(|i|(0..2).all(|j|p.floor4(a+i,b+j))))).unwrap();
  let far_x=if x<190{388}else{0};let far_y=if y<100{196}else{0};
  let g=&mut d["World"]["GridCollection"]["Grids"]["90001"];
  g["Objects"]["10"]["X"]=json!(far_x);g["Objects"]["10"]["Y"]=json!(far_y);
  g["Objects"].as_object_mut().unwrap().remove("11");
  d["World"]["MissionSlots"]=json!({});d["World"]["RecurringEvents"]=json!({});
  d["World"]["TimeLostTreasures"]=json!({});d["World"]["NextTimeLostTreasureID"]=json!(1);
  d["World"]["Snippets"]=json!({});d["World"]["NextSnippetID"]=json!(0);
  d["Player"]["AchievementsData"]=json!([]);d["Player"]["DutySlots"]=json!({});
  d["Player"]["EvolveStatesProfile"]=json!({"EvolveProgressState":{}});
  d["Player"]["BattlePassStates"]=json!({"Progress":{},"FtueProgress":{"TasksProgress":[],"WeeklyTasksProgress":[]}});
  d["ConditionalEventHistory"]=json!({"ActiveEvents":{}});
  let open_switch=|v:&Value|{let mut s=ProductSession::open_decoded_readonly(serde_json::to_vec(v).unwrap(),
    crate::BuildIdentity{platform:Platform::Switch,build_kind:BuildKind::SwitchBid,build_id:"9A239D3DB569756D".into(),schema:626,externally_attested:true}).unwrap();s.worker_bound=true;s};
  let s=open_switch(&d);let e=env(&s);let p=s.prepare_switch626_r02_product(e,90001,x,y).unwrap();
  let t=&p.target;let before=s.receipt().unwrap();let q=s.preview_switch626_r02_product(e,90001,x,y).unwrap();
  assert_eq!(q["exactFieldChangedCount"],6);assert_eq!(q["inventoryDelta"],-4);assert_eq!(q["oldAmount"],10);assert_eq!(q["newAmount"],6);
  assert_eq!(s.receipt().unwrap(),before);
  let stage=WorkerEnvelope{action:WorkerAction::Stage,..e};
  assert!(s.stage_switch626_r02_product(e,90001,x,y,50,10,t.grid_sha,t.stock_sha,p.projected).is_err());
  assert!(s.stage_switch626_r02_product(stage,90001,x,y,51,10,t.grid_sha,t.stock_sha,p.projected).is_err());
  assert!(s.stage_switch626_r02_product(stage,90001,x,y,50,9,t.grid_sha,t.stock_sha,p.projected).is_err());
  assert!(s.stage_switch626_r02_product(stage,90001,x,y,50,10,[0;32],t.stock_sha,p.projected).is_err());
  assert!(s.stage_switch626_r02_product(stage,90001,x,y,50,10,t.grid_sha,[0;32],p.projected).is_err());
  assert!(s.stage_switch626_r02_product(stage,90001,x,y,50,10,t.grid_sha,t.stock_sha,[0;32]).is_err());
  assert!(open_switch(&d).stage_switch626_r02_product(stage,90001,x,y,50,10,t.grid_sha,t.stock_sha,p.projected).is_err());
  let steam=open(&d);assert!(steam.preview_switch626_r02_product(env(&steam),90001,x,y).is_err());
  assert_eq!(s.receipt().unwrap(),before);
  let receipt=s.stage_switch626_r02_product(stage,90001,x,y,50,10,t.grid_sha,t.stock_sha,p.projected).unwrap();
  assert_eq!(receipt.exact_field_changed_count,6);assert_eq!(receipt.staged_decoded_sha256,p.projected);
  assert!(!receipt.product_writer_authorized&&!receipt.original_overwrite_authorized);
  assert!(s.stage_switch626_r02_product(stage,90001,x,y,50,10,t.grid_sha,t.stock_sha,p.projected).is_err());
  s.undo_typed_semantic_batch(WorkerEnvelope{action:WorkerAction::Stage,..env(&s)}).unwrap();
  assert!(s.take_typed_semantic_decoded_once(WorkerEnvelope{action:WorkerAction::ExportEditedCopy,..env(&s)}).is_err());
  s.redo_typed_semantic_batch(WorkerEnvelope{action:WorkerAction::Stage,..env(&s)}).unwrap();
  let out_e=WorkerEnvelope{action:WorkerAction::ExportEditedCopy,..env(&s)};
  let out=s.take_typed_semantic_decoded_once(out_e).unwrap();
  assert!(s.take_typed_semantic_decoded_once(out_e).is_err());
  let mut expected=d.clone();let g=&mut expected["World"]["GridCollection"]["Grids"]["90001"];
  g["NextGridObjectID"]=json!(54);
  for (i,(a,b)) in [(x,y),(x+4,y+4),(x+4,y),(x,y+4)].into_iter().enumerate(){
   g["Objects"][format!("{}",50+i)]=json!({"ID":50+i,"ItemID":ROAD,"X":a,"Y":b,"Orientation":"GridOrientation_Down","State":{"FenceMode":{"Diagonal":true}}});
  }
  expected["Player"]["ListInventories"]["0"]["Inventory"]["40100068"]["Amount"]=json!(6);
  assert_eq!(serde_json::from_slice::<Value>(&out).unwrap(),expected);
  assert_eq!(sha(&out),p.projected);assert_eq!(sha(&s.decoded),e.expected_decoded_sha256);
  for kind in 0..2{let mut bad=d.clone();if kind==0{bad["World"]["RecurringEvents"]=json!({"999999999":{"Unknown":{}}});}else{bad["Player"]["ListInventories"]["0"]["Inventory"]["40100068"]["Amount"]=json!(4);}
   let b=open_switch(&bad);assert!(b.preview_switch626_r02_product(env(&b),90001,x,y).is_err());}
 }
 #[test]fn switch626_r02_current_session_target_no_seed_exemption(){
  let mut d=doc();
  let p=MeadowGeometry::fixed_switch626("9A239D3DB569756D",626).unwrap();
  let (x,y)=(0..387u32).step_by(4).flat_map(|x|(0..195u32).step_by(4).map(move|y|(x,y))).find(|&(x,y)|[(x,y),(x+4,y+4),(x+4,y),(x,y+4)].iter().all(|&(a,b)|(0..2).all(|i|(0..2).all(|j|p.floor4(a+i,b+j))))).unwrap();
  d["World"]["GridCollection"]["Grids"]["90001"]["Objects"]["10"]["X"]=json!(x);
  d["World"]["GridCollection"]["Grids"]["90001"]["Objects"]["10"]["Y"]=json!(y);
  let open_switch=|v:&Value|{let mut s=ProductSession::open_decoded_readonly(serde_json::to_vec(v).unwrap(),crate::BuildIdentity{platform:Platform::Switch,build_kind:BuildKind::SwitchBid,build_id:"9A239D3DB569756D".into(),schema:626,externally_attested:true}).unwrap();s.worker_bound=true;s};
  let s=open_switch(&d);
  // Existing mixed seeds are NOT exempt in R02.
  assert!(s.mint_switch626_r02_target(env(&s),90001,x,y).is_err());
  let far_x=if x<190{388}else{0};let far_y=if y<100{196}else{0};
  let g=&mut d["World"]["GridCollection"]["Grids"]["90001"];
  g["Objects"]["10"]["X"]=json!(far_x);g["Objects"]["10"]["Y"]=json!(far_y);
  g["Objects"].as_object_mut().unwrap().remove("11");
  let s=open_switch(&d);let e=env(&s);let before=s.receipt().unwrap();
  let t=s.mint_switch626_r02_target(e,90001,x,y).unwrap();
  assert_eq!((t.grid,t.x,t.y,t.next,t.stock),(90001,x,y,50,10));
  assert_eq!(s.receipt().unwrap(),before);
  let steam=open(&d);assert!(steam.mint_switch626_r02_target(env(&steam),90001,x,y).is_err());
  assert!(open_switch(&d).mint_switch626_r02_target(e,90001,x,y).is_err());
  assert!(s.mint_switch626_r02_target(WorkerEnvelope{expected_revision:1,..e},90001,x,y).is_err());
  assert!(s.mint_switch626_r02_target(WorkerEnvelope{action:WorkerAction::Stage,..e},90001,x,y).is_err());
  assert!(s.mint_switch626_r02_target(e,90001,x+1,y).is_err());
  for i in 0..14{let mut q=d.clone();match i{
   0=>q["World"]["Villages"][0]["Areas"]["2"]["Unlocked"]=json!(false),
   1=>q["Unknown"]=json!({"GridIDs":[90001]}),
   2=>q["Unknown"]=json!({"GridID":90001,"ObjectID":50}),
   3=>q["Unknown"]=json!({"GridID":90001,"ObjectID":51}),
   4=>q["Unknown"]=json!({"GridID":90001,"ObjectID":52}),
   5=>q["World"]["GridCollection"]["DiffGrids"]["90001"]=json!({"ID":90001}),
   6=>q["World"]["GridCollection"]["Grids"]["90001"]["GridDefaultLayoutPath"]=json!("foreign"),
   7=>q["World"]["GridCollection"]["Grids"]["90001"]["NextGridObjectID"]=json!(i32::MAX),
   8=>q["Player"]["ListInventories"]["0"]["Inventory"]["40100068"]["Amount"]=json!(0),
   9=>q["Player"]["ListInventories"]["0"]["Inventory"]["40100068"]["Marker"]=json!("ItemMarker_None"),
   10=>q["World"]["GridCollection"]["Grids"]["90001"]["Objects"]["10"]["X"]=json!(x),
   11=>q["World"]["GridCollection"]["Grids"]["90001"]["Objects"]["10"]["ID"]=json!(50),
   12=>q["Unknown"]=json!({"GridID":90001,"ObjectID":53}),
   _=>q["Player"]["ListInventories"]["0"]["Inventory"]["40100068"]["Amount"]=json!(4)
  }
  if i==10{q["World"]["GridCollection"]["Grids"]["90001"]["Objects"]["10"]["Y"]=json!(y);}
  let s=open_switch(&q);let before=s.receipt().unwrap();
  assert!(s.mint_switch626_r02_target(env(&s),90001,x,y).is_err(),"R02 mode {i}");
  assert_eq!(s.receipt().unwrap(),before);}
 }
 #[test]fn sr03_subgrid_empty_zero_counter_and_bounded_child(){
  let mut d=json!({"Grids":{"20":{"ID":20,"TessellationFactor":2,"GridDataPath":"GridData/Furniture/NonIP_Update17/CoffeeShopTable-GridData.json","GridDefaultLayoutPath":"","NextGridObjectID":0,"Objects":{}}},"DiffGrids":{}});
  let p=json!({"DesignID":null,"GridID":20});
  let check=|v:&Value,root:u32,parent:u32|{let b=serde_json::to_vec(v).unwrap();let top=Span{begin:0,end:b.len()};let mut a=Incoming::default();a.roots.insert(20,root);a.parents.insert(20,parent);
   child_extra(&b,f(&b,top,"Grids").unwrap(),f(&b,top,"DiffGrids").unwrap(),&a,40004191,&p)};
  assert_eq!(check(&d,0,1),Some(0));assert_eq!(check(&d,1,1),None);assert_eq!(check(&d,0,2),None);
  d["Grids"]["20"]["Objects"]["0"]=json!({"ID":0,"ItemID":40004104,"X":0,"Y":0,"Orientation":"GridOrientation_DownRight","State":null});
  assert_eq!(check(&d,0,1),None);
  d["Grids"]["20"]["NextGridObjectID"]=json!(1);assert_eq!(check(&d,0,1),Some(8));
  d["Grids"]["20"]["Objects"]["0"]["X"]=json!(65);assert_eq!(check(&d,0,1),None);
  d["Grids"]["20"]["Objects"]["0"]["X"]=json!(0);d["Grids"]["20"]["Objects"]["0"]["ItemID"]=json!(40000066);assert_eq!(check(&d,0,1),None);
  d["Grids"]["20"]["Objects"]["0"]["ItemID"]=json!(40004104);d["DiffGrids"]["20"]=json!({"ID":20});assert_eq!(check(&d,0,1),None);
 }
 #[test]fn sr03_current_session_target_root_stock_and_refs(){
  let d=doc();let s=open(&d);let e=env(&s);let r=s.receipt().unwrap();let t=s.mint_sr03_target(e,90001,10,11).unwrap();
  assert_eq!((t.stock,t.local.next,t.local.keep,t.local.moved),(10,50,10,11));assert_eq!(s.receipt().unwrap(),r);
  assert!(open(&d).mint_sr03_target(e,90001,10,11).is_err());
  let mut wrong=e;wrong.expected_revision=1;assert!(s.mint_sr03_target(wrong,90001,10,11).is_err());
  assert!(s.mint_sr03_target(e,90001,10,10).is_err());
  for i in 0..15{let mut q=d.clone();match i{
   0=>q["World"]["Villages"][0]["Areas"]["2"]["Unlocked"]=json!(false),
   1=>q["Unknown"]=json!({"GridIDs":[90001]}),
   2=>q["Unknown"]=json!({"GridID":90001,"ObjectID":10}),
   3=>q["Unknown"]=json!({"GridID":90001,"ObjectID":11}),
   4=>q["Unknown"]=json!({"GridID":90001,"ObjectID":50}),
   5=>q["Unknown"]=json!({"GridID":90001,"ObjectID":51}),
   6=>q["Unknown"]=json!({"GridID":90001,"ObjectID":52}),
   7=>q["World"]["GridCollection"]["DiffGrids"]["90001"]=json!({"ID":90001}),
   8=>q["Player"]["ListInventories"]["0"]["Inventory"]["40100068"]["Amount"]=json!(3),
   9=>q["Player"]["ListInventories"]["0"]["Inventory"]["40100068"]["Marker"]=json!("ItemMarker_None"),
   10=>q["Player"]["ListInventories"]["0"]["CompatibleFurnitureTypes"]["List"]=json!(["FurnitureItemType_Default"]),
   11=>q["Player"]["ListInventories"]["1"]=json!({"ID":1,"Inventory":{"40100068":{"Amount":1}}}),
   12=>q["World"]["GridCollection"]["Grids"]["90001"]["Objects"]["10"]["State"]=json!({"FenceMode":{"Diagonal":true}}),
   13=>q["World"]["GridCollection"]["Grids"]["90001"]["NextGridObjectID"]=json!(11),
   _=>q["World"]["GridCollection"]["Grids"]["90001"]["Objects"]["11"]["Orientation"]=json!("GridOrientation_Up")
  }let x=open(&q);let before=x.receipt().unwrap();assert!(x.mint_sr03_target(env(&x),90001,10,11).is_err(),"mode {i}");assert_eq!(x.receipt().unwrap(),before);}
 }
}
