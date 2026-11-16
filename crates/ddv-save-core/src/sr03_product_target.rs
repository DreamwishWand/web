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
#[derive(Debug,PartialEq,Eq)]
#[allow(dead_code)]
pub(crate) struct Sr03Target{
    scope:WorkerEnvelope, grid:u32, local:LocalTarget, stock:u32,
    root_sha:[u8;32],grid_sha:[u8;32],keep_sha:[u8;32],moved_sha:[u8;32],
    counter_sha:[u8;32],stock_sha:[u8;32],houses_sha:[u8;32],pairs:usize,
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
    /// Mint only an opaque target from one immutable, current worker session.
    /// No UI-supplied provider, rights, rectangle, hashes or Stage permission.
    #[allow(dead_code)]
    pub(crate) fn mint_sr03_target(&self,e:WorkerEnvelope,gid:u32,keep:u32,moved:u32)->CoreResult<Sr03Target>{
        build_check(self)?;let st=self.lock()?;check(self,&st,&e,WorkerAction::ReadDomain)?;
        need(self.worker_bound&&st.semantic.is_none()&&st.revision==0&&st.generation==1&&gid>0,"SR03_TARGET_EPOCH")?;
        let common=InstalledGeometry::fixed().ok_or(denied("SR03_TARGET_COMMON_PROVIDER"))?;
        let pack=MeadowGeometry::fixed(EXACT_STEAM,626).ok_or(denied("SR03_TARGET_PROVIDER"))?;
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

#[cfg(feature="product-steam626-sr03-scoped")]
struct Sr03Prepared{target:Sr03Target,edits:Vec<Replacement>,projected:[u8;32]}
#[cfg(feature="product-steam626-sr03-scoped")]
impl ProductSession{
    fn prepare_sr03_product(&self,e:WorkerEnvelope,grid:u32,keep:u32,moved:u32)->CoreResult<Sr03Prepared>{
        use super::super::switch624_road_rm01::{MixedQ5Expected,collect_mixed_q5_current};
        let t=self.mint_sr03_target(e,grid,keep,moved)?;
        let st=self.lock()?;check(self,&st,&e,WorkerAction::ReadDomain)?;
        need(st.semantic.is_none()&&st.revision==0&&st.generation==1,"SR03_PRODUCT_EPOCH")?;
        let b=&self.decoded;let r=indexed_read::roots(b)?;
        let start=indexed_read::skip_ws(b,0);let top=Span{begin:start,end:indexed_read::value_end(b,start)?};
        let (_,defs)=super::pack()?;super::subscribers(b,r.player,r.world,top,defs,ROAD as i32,true)?;
        let project=|s:Span,keys:&[&str]|->CoreResult<Value>{
            let mut m=serde_json::Map::new();
            for &k in keys{m.insert(k.into(),value(b,f(b,s,k)?,MAX_GRID)?);}
            Ok(Value::Object(m))
        };
        let player=project(r.player,&["AchievementsData","DutySlots","BattlePassStates"])?;
        let world=project(r.world,&["MissionSlots","RecurringEvents","TimeLostTreasures","NextTimeLostTreasureID","Snippets","NextSnippetID"])?;
        super::comp03_product_target::check_sr03_applicability(&player,&world)?;
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
    pub(crate) fn preview_sr03_product(&self,e:WorkerEnvelope,grid:u32,keep:u32,moved:u32)->CoreResult<Value>{
        let p=self.prepare_sr03_product(e,grid,keep,moved)?;let t=&p.target;
        Ok(json!({"contract":"wand.worker.steam626.scoped-sr03-mixed-q5@1","itemId":ROAD,
            "gridId":t.grid,"retainedId":t.local.keep,"movedId":t.local.moved,"expectedNextId":t.local.next,
            "oldAmount":t.stock,"newAmount":t.stock-3,"inventoryDelta":-3,
            "gridSha256":super::hex(&t.grid_sha),"inventoryEntrySha256":super::hex(&t.stock_sha),
            "projectedDecodedSha256":super::hex(&p.projected),"exactFieldChangedCount":8,
            "sessionId":super::hex(&e.session_id),"revision":e.expected_revision,"indexGeneration":e.expected_index_generation,
            "decodedSha256":super::hex(&e.expected_decoded_sha256),"productWriterAuthorized":false,"originalOverwriteAuthorized":false}))
    }
    pub(crate) fn stage_sr03_product(&self,e:WorkerEnvelope,grid:u32,keep:u32,moved:u32,next:u32,old:u32,
        grid_sha:[u8;32],stock_sha:[u8;32],projected:[u8;32])->CoreResult<SemanticStageReceipt>{
        need(e.action==WorkerAction::Stage,"SR03_PRODUCT_STAGE_ACTION")?;
        let p=self.prepare_sr03_product(WorkerEnvelope{action:WorkerAction::ReadDomain,..e},grid,keep,moved)?;
        let t=&p.target;
        need(t.grid==grid&&t.local.keep==keep&&t.local.moved==moved&&t.local.next==next&&t.stock==old&&
            t.grid_sha==grid_sha&&t.stock_sha==stock_sha&&p.projected==projected,"SR03_PRODUCT_STAGE_CAS")?;
        self.commit_semantic_replacements(e,p.edits,8,Some(p.projected))
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
