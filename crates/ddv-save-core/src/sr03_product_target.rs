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

 #[test]
 fn qa_act1245_independent_same_session_binding() {
  // Fixed synthetic pose independently decoded from the accepted floor bitset.
  let (g,k,m,nx)=(90001u32,10u32,11u32,50u32);
  let row=|id,item,x,y,state:Value|json!({"ID":id,"ItemID":item,"X":x,"Y":y,"Orientation":"GridOrientation_Down","State":state});
  let mut d=json!({"GameInfo":{"Version":626},"World":{"Villages":[{"Areas":{"2":{"Unlocked":true,"GridIDs":[g]}}}],
   "PlayerHouses":[{"HouseItemID":20500005,"Floors":[]}],"Keyholes":{"synthetic-guid":{"GUID":"synthetic-guid"}},
   "GridCollection":{"Grids":{"90001":{"ID":g,"GridDataPath":GRID,"GridDefaultLayoutPath":"","TessellationFactor":2,"NextGridObjectID":nx,
    "Objects":{"10":row(k,ROAD,204,116,json!(null)),"11":row(m,ROAD,208,116,json!(null)),
     "12":row(12,20000091,20,20,json!({"HouseData":{"Built":true,"PlayerHouseIndex":0,"UpgradeState":{"Level":1}}})),
     "13":row(13,40004191,30,30,json!({"SubGrid":{"DesignID":null,"GridID":20}})),
     "14":row(14,40001071,40,40,json!({"Keyhole":{"KeyholeConfigDataGUID":"synthetic-guid"}}))}},
     "20":{"ID":20,"TessellationFactor":2,"GridDataPath":"GridData/Furniture/NonIP_Update17/CoffeeShopTable-GridData.json","GridDefaultLayoutPath":"","NextGridObjectID":1,"Objects":{"0":row(0,40004104,1,2,json!(null))}}},"DiffGrids":{}},
   "DecorationPresets":[{"GridCollection":{"Grids":{"90001":{"ID":g,"Objects":{"10":{"ID":k},"11":{"ID":m},"50":{"ID":nx},"51":{"ID":51},"52":{"ID":52}}}},"DiffGrids":{}}}]},
   "Player":{"ListInventories":{"0":{"ID":0,"CompatibleItemType":"ItemType_Furniture","CompatibleFurnitureTypes":{"List":["FurnitureItemType_GroundAlteration"]},"Inventory":{"40100068":{"Amount":10,"Marker":"ItemMarker_Favorite"}}}},"ContainerInventories":{}},
   "Opaque":{"Keep":"unchanged"}});
  // Local preset IDs may equal actual old/fresh IDs, but only typed local references are disjoint.
  d["World"]["DecorationPresets"][0]["GridCollection"]["Grids"]["90001"]["Objects"]["10"]["LocalRef"]=json!({"GridID":g,"ObjectID":nx});
  let open_build=|v:&Value,platform,kind,build:&str,schema,attested,bound| {
   let mut s=ProductSession::open_decoded_readonly(serde_json::to_vec(v).unwrap(),crate::BuildIdentity{platform,build_kind:kind,build_id:build.into(),schema,externally_attested:attested}).unwrap();
   s.worker_bound=bound;s
  };
  let check=|v:&Value|{let s=open(v);let before=s.receipt().unwrap();let t=s.mint_sr03_target(env(&s),g,k,m);assert_eq!(s.receipt().unwrap(),before);t};
  let t=check(&d).unwrap();let gr=&d["World"]["GridCollection"]["Grids"]["90001"];let h=|v:&Value|sha(&serde_json::to_vec(v).unwrap());
  assert_eq!((t.grid,t.stock,t.local.keep,t.local.moved,t.local.next,t.local.x,t.local.y),(g,10,k,m,nx,204,116));
  assert_eq!(t.root_sha,h(&d["World"]["Villages"][0]["Areas"]["2"]));assert_eq!(t.grid_sha,h(gr));assert_eq!(t.keep_sha,h(&gr["Objects"]["10"]));assert_eq!(t.moved_sha,h(&gr["Objects"]["11"]));assert_eq!(t.counter_sha,h(&gr["NextGridObjectID"]));assert_eq!(t.stock_sha,h(&d["Player"]["ListInventories"]["0"]["Inventory"]["40100068"]));assert_eq!(t.houses_sha,h(&d["World"]["PlayerHouses"]));assert_eq!(t.pairs,1);
  let mut pos=1;let mut neg=0;
  let s=open(&d);let e=env(&s);let before=s.receipt().unwrap();assert_eq!(s.mint_sr03_target(e,g,k,m).unwrap(),s.mint_sr03_target(e,g,k,m).unwrap());
  assert_eq!(s.receipt().unwrap(),before);pos+=1;
  let mut bad=e;bad.expected_revision=1;assert!(s.mint_sr03_target(bad,g,k,m).is_err());neg+=1;
  let mut bad=e;bad.expected_index_generation=2;assert!(s.mint_sr03_target(bad,g,k,m).is_err());neg+=1;
  let mut bad=e;bad.expected_decoded_sha256=[0;32];assert!(s.mint_sr03_target(bad,g,k,m).is_err());neg+=1;
  let mut bad=e;bad.action=WorkerAction::Stage;assert!(s.mint_sr03_target(bad,g,k,m).is_err());neg+=1;
  assert!(open(&d).mint_sr03_target(e,g,k,m).is_err());neg+=1;
  let unbound=open_build(&d,Platform::SteamWindows,BuildKind::SteamFullVersion,EXACT_STEAM,626,true,false);assert!(unbound.mint_sr03_target(env(&unbound),g,k,m).is_err());neg+=1;
  let foreign=open_build(&d,Platform::Switch,BuildKind::SwitchBid,"9A239D3DB569756D",626,true,true);assert!(foreign.mint_sr03_target(env(&foreign),g,k,m).is_err());neg+=1;
  for (a,b,c) in [(0,k,m),(g,0,m),(g,k,k),(g,k,nx),(g,nx,m)]{assert!(s.mint_sr03_target(e,a,b,c).is_err());neg+=1;}
  // Shared scan old0/1 compatibility and new exact old2/fresh3. Different World grid IDs stay independent.
  for id in [0,k,m,nx,nx+1,nx+2,nx+3,49]{
   let mut q=d.clone();q["Opaque"]["Pair"]=json!({"GridID":g,"ObjectID":id});
   let b=serde_json::to_vec(&q).unwrap();let top=Span{begin:0,end:b.len()};
   let a=super::super::placement_saved_refs::scan(&b,top,g,None,nx,nx+1);
   let one=super::super::placement_saved_refs::scan(&b,top,g,Some(k),nx,nx+1);
   let two=super::super::placement_saved_refs::scan_sr03(&b,top,g,k,m,nx);
   assert_eq!(a.is_ok(),!matches!(id,0|50));assert_eq!(one.is_ok(),!matches!(id,0|10|50));assert_eq!(two.is_ok(),matches!(id,49|53));
   if matches!(id,49|53){assert!(check(&q).is_ok());pos+=1}else{assert!(check(&q).is_err());neg+=1;}
  }
  let mut q=d.clone();q["Opaque"]["Pair"]=json!({"GridID":98765,"ObjectID":nx});assert!(check(&q).is_ok());pos+=1;
  // Mutate only one boundary per case, not the inherited floor provider.
  for i in 0..28{let mut q=d.clone();match i{
   0=>q["World"]["Villages"][0]["Areas"]["2"]["GridIDs"]=json!([g,g]),
   1=>q["World"]["Villages"][0]["Areas"]["3"]=json!({"Unlocked":true,"GridIDs":[g]}),
   2=>q["World"]["Villages"][0]["Areas"]["2"]["Unlocked"]=json!(false),
   3=>q["World"]["GridCollection"]["DiffGrids"]["90001"]=json!({"ID":g}),
   4=>q["Opaque"]["SubGrid"]=json!({"GridID":g}),
   5=>q["Opaque"]["Pair"]=json!({"GridID":g,"GridId":g,"ObjectID":k}),
   6=>q["Opaque"]["Pair"]=json!({"GridID":g,"ObjectId":m}),
   7=>q["Opaque"]["Pair"]=json!({"GridID":g,"ObjectID":50.0}),
   8=>q["World"]["DecorationPresets"][0]["GridCollection"]["Grids"]["90001"]["Objects"]["10"]["LocalRef"]["ObjectID"]=json!(99),
   9=>q["World"]["PlayerHouses"][0]["HouseItemID"]=json!(20500024),
   10=>q["World"]["GridCollection"]["Grids"]["90001"]["Objects"]["12"]["State"]["HouseData"]["PlayerHouseIndex"]=json!(1),
   11=>q["World"]["GridCollection"]["Grids"]["90001"]["Objects"]["12"]["X"]=json!(204),
   12=>q["World"]["Keyholes"]["synthetic-guid"]["GUID"]=json!("other"),
   13=>q["World"]["GridCollection"]["Grids"]["90001"]["Objects"]["14"]["State"]["Keyhole"]["KeyholeConfigDataGUID"]=json!("missing"),
   14=>q["World"]["GridCollection"]["Grids"]["20"]["GridDataPath"]=json!("wrong"),
   15=>q["World"]["GridCollection"]["Grids"]["20"]["Objects"]["0"]["ItemID"]=json!(40000066),
   16=>q["World"]["GridCollection"]["Grids"]["20"]["Objects"]["0"]["X"]=json!(65),
   17=>q["World"]["GridCollection"]["Grids"]["20"]["NextGridObjectID"]=json!(0),
   18=>q["Opaque"]["GridIDs"]=json!([20]),
   19=>q["Opaque"]["SubGrid"]=json!({"GridID":20}),
   20=>q["World"]["GridCollection"]["DiffGrids"]["20"]=json!({"ID":20}),
   21=>q["Player"]["ListInventories"]["0"]["Inventory"]["40100068"]["Amount"]=json!(3),
   22=>q["Player"]["ListInventories"]["0"]["Inventory"]["40100068"]["Amount"]=json!(10000),
   23=>q["Player"]["ListInventories"]["0"]["Inventory"]["40100068"]["Marker"]=json!("ItemMarker_None"),
   24=>q["Player"]["ListInventories"]["1"]=json!({"ID":1,"Inventory":{"40100068":{"Amount":1}}}),
   25=>q["Player"]["ContainerInventories"]["0"]=json!({"ID":0,"BelongsToPlayer":true,"Size":1,"ExtraSize":0,"Inventory":[{"ItemID":ROAD,"Amount":1,"State":null}]}),
   26=>q["World"]["GridCollection"]["Grids"]["90001"]["Objects"]["13"]["State"]["SubGrid"]["DesignID"]=json!(1),
   _=>q["World"]["GridCollection"]["Grids"]["90001"]["Objects"]["14"]["ItemID"]=json!(40000066)
   }assert!(check(&q).is_err(),"QA mutation {i}");neg+=1;}
  let mut q=d.clone();q["World"]["GridCollection"]["Grids"]["20"]["Objects"]=json!({});q["World"]["GridCollection"]["Grids"]["20"]["NextGridObjectID"]=json!(0);assert!(check(&q).is_ok());pos+=1;
  println!("ACT1245_SR03_BINDER_ACTUAL {pos}POS {neg}NEG 24REFCHECKS");
  assert_eq!((pos,neg),(6,46));
 }
}
