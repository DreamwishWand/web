//! ACT1501: exact Steam626 one ordinary Fence read-only target.
//! Reuses existing Meadow geometry, full typed scanner and Session CAS.
//! Positive stock is a witness only; no debit, Stage, rights or Writer grant.
use super::*;
const BASE:u32=40700246;
#[derive(Debug,PartialEq,Eq)]
#[allow(dead_code)]
pub(crate) struct SteamSingleFenceTarget{
 pub(crate) scope:WorkerEnvelope,pub(crate) grid:u32,pub(crate) x:u32,pub(crate) y:u32,
 pub(crate) next:u32,pub(crate) stock:u32,pub(crate) root_sha:[u8;32],pub(crate) grid_sha:[u8;32],
 pub(crate) counter_sha:[u8;32],pub(crate) stock_sha:[u8;32],pub(crate) houses_sha:[u8;32],pub(crate) pairs:usize,
}
fn catalog(b:&[u8],player:Span)->CoreResult<(u32,Span)>{
 let lists=f(b,player,"ListInventories")?;let route=f(b,lists,"0")?;
 inventory_route(b,route,0,BASE,"ItemType_Furniture")?;
 let entry=f(b,f(b,route,"Inventory")?,&BASE.to_string())?;
 let v=value(b,entry,4096)?;let old=uint(&v["Amount"]).ok_or(denied("SINGLE_FENCE_STOCK"))?;
 need(fields(&v,&["Amount","Marker"])&&old>=2&&old<=9999&&v["Marker"]=="ItemMarker_Favorite","SINGLE_FENCE_STOCK")?;
 let mut hits=0;for(k,r)in members(b,lists,4096)?{let id=key(&k)?;need(n(b,r,"ID")?==id,"SINGLE_FENCE_ROUTE_ID")?;
  if opt(b,f(b,r,"Inventory")?,&BASE.to_string())?.is_some(){hits+=1;need(id==0,"SINGLE_FENCE_ROUTE")?;}}
 need(hits==1,"SINGLE_FENCE_ROUTE")?;physical_totals(b,player,BASE as i32,None,old)?;Ok((old,entry))
}
impl ProductSession{
 #[allow(dead_code)]
 pub(crate) fn mint_steam626_single_fence_target(&self,e:WorkerEnvelope,gid:u32,x:u32,y:u32)->CoreResult<SteamSingleFenceTarget>{
  road_build(self,RoadBuild::Steam626)?;let st=self.lock()?;check(self,&st,&e,WorkerAction::ReadDomain)?;
  need(self.worker_bound&&st.semantic.is_none()&&st.revision==0&&st.generation==1&&gid>0,"SINGLE_FENCE_EPOCH")?;
  let common=InstalledGeometry::fixed().ok_or(denied("SINGLE_FENCE_COMMON_PROVIDER"))?;
  let pack=MeadowGeometry::fixed(EXACT_STEAM,626).ok_or(denied("SINGLE_FENCE_PROVIDER"))?;
  let b=&self.decoded;let roots=indexed_read::roots(b)?;let w=roots.world;
  let(root,g,gs,ds)=selected(b,w,gid)?;let next=n(b,g,"NextGridObjectID")?;
  let end=next.checked_add(1).ok_or(denied("SINGLE_FENCE_COUNTER"))?;
  need(next>0&&end<=i32::MAX as u32,"SINGLE_FENCE_COUNTER")?;
  let start=indexed_read::skip_ws(b,0);let top=Span{begin:start,end:indexed_read::value_end(b,start)?};
  let refs=super::super::placement_saved_refs::scan(b,top,gid,None,next,end)?;
  need(refs.root(gid)==1&&refs.parent(gid)==0,"SINGLE_FENCE_REFERENCE_ALIAS")?;
  let(houses,house_span)=house_items(b,w)?;let objects=f(b,g,"Objects")?;let mut budget=0;
  for(_,o)in members(b,objects,4096)?{saved_grid_state(b,f(b,o,"State")?,BASE as i32,&mut budget)?;}
  let grid=value(b,g,MAX_GRID)?;
  let minted=pack.local_steam_single_fence(&grid,x,y,|i|common.dimensions(i),|o,dims|match uint(&o["ItemID"])?{
   20500005|20300115=>pack.effective_building(o,&houses),
   _=>ambient(b,w,gs,ds,&refs,&houses,o,dims),
  }).ok_or(denied("SINGLE_FENCE_GEOMETRY"))?;
  need(minted==next,"SINGLE_FENCE_COUNTER")?;
  let(stock,entry)=catalog(b,roots.player)?;
  Ok(SteamSingleFenceTarget{scope:e,grid:gid,x,y,next,stock,root_sha:digest(b,root)?,grid_sha:digest(b,g)?,
   counter_sha:digest(b,f(b,g,"NextGridObjectID")?)?,stock_sha:digest(b,entry)?,houses_sha:digest(b,house_span)?,pairs:refs.pairs})
 }
}
#[cfg(test)]
mod tests{
 use super::*;
 fn fixture()->(Value,u32,u32){
  let p=MeadowGeometry::fixed(EXACT_STEAM,626).unwrap();
  let(x,y)=(4..388u32).step_by(2).flat_map(|a|(4..196u32).step_by(2).map(move|b|(a,b))).find(|&(a,b)|(0..2).all(|i|(0..2).all(|j|p.floor4(a+i,b+j)))).unwrap();
  let row=json!({"ID":10,"ItemID":BASE,"X":if x<190{388}else{0},"Y":if y<100{196}else{0},"Orientation":"GridOrientation_Down","State":null});
  (json!({"GameInfo":{"Version":626},"World":{"Villages":[{"Areas":{"2":{"Unlocked":true,"GridIDs":[90001]}}}],"PlayerHouses":[],
   "GridCollection":{"Grids":{"90001":{"ID":90001,"GridDataPath":GRID,"GridDefaultLayoutPath":"","TessellationFactor":2,"NextGridObjectID":50,"Objects":{"10":row}}},"DiffGrids":{}}},
   "Player":{"ListInventories":{"0":{"ID":0,"CompatibleItemType":"ItemType_Furniture","CompatibleFurnitureTypes":{"List":["FurnitureItemType_Fence"]},"Inventory":{"40700246":{"Amount":10,"Marker":"ItemMarker_Favorite"}}}},"ContainerInventories":{}}}),x,y)
 }
 fn open(d:&Value,switch:bool)->ProductSession{let mut s=ProductSession::open_decoded_readonly(serde_json::to_vec(d).unwrap(),crate::BuildIdentity{
  platform:if switch{Platform::Switch}else{Platform::SteamWindows},build_kind:if switch{BuildKind::SwitchBid}else{BuildKind::SteamFullVersion},
  build_id:if switch{"9A239D3DB569756D".into()}else{EXACT_STEAM.into()},schema:626,externally_attested:true}).unwrap();s.worker_bound=true;s}
 fn env(s:&ProductSession)->WorkerEnvelope{let r=s.receipt().unwrap();WorkerEnvelope{contract:PRODUCT_WORKER_CONTRACT,session_id:r.session_id,expected_revision:r.revision,expected_index_generation:r.index_generation,expected_decoded_sha256:r.decoded_sha256,action:WorkerAction::ReadDomain}}
 #[test]fn steam626_single_fence_target_exact1_no_debit(){
  let(d,x,y)=fixture();let s=open(&d,false);let e=env(&s);let before=s.receipt().unwrap();let t=s.mint_steam626_single_fence_target(e,90001,x,y).unwrap();
  assert_eq!((t.x,t.y,t.next,t.stock),(x,y,50,10));assert_eq!(s.receipt().unwrap(),before);
  assert!(s.mint_steam626_single_fence_target(WorkerEnvelope{action:WorkerAction::Stage,..e},90001,x,y).is_err());
  assert!(s.mint_steam626_single_fence_target(WorkerEnvelope{expected_revision:1,..e},90001,x,y).is_err());
  assert!(open(&d,false).mint_steam626_single_fence_target(e,90001,x,y).is_err());
  let q=open(&d,true);assert!(q.mint_steam626_single_fence_target(env(&q),90001,x,y).is_err());
  assert!(s.mint_steam626_single_fence_target(e,90001,x+1,y).is_err());
  assert!(s.mint_steam626_single_fence_target(e,90001,392,y).is_err());
  for dx in [0,2]{let mut q=d.clone();q["World"]["GridCollection"]["Grids"]["90001"]["Objects"]["10"]["X"]=json!(x+dx);q["World"]["GridCollection"]["Grids"]["90001"]["Objects"]["10"]["Y"]=json!(y);
   let z=open(&q,false);assert_eq!(z.mint_steam626_single_fence_target(env(&z),90001,x,y).unwrap_err().0,"SINGLE_FENCE_GEOMETRY");}
  let mut q=d.clone();q["Unknown"]=json!({"GridID":90001,"ObjectID":50});let z=open(&q,false);assert!(z.mint_steam626_single_fence_target(env(&z),90001,x,y).is_err());
  let mut q=d.clone();q["Player"]["ListInventories"]["0"]["Inventory"]["40700246"]["Amount"]=json!(1);let z=open(&q,false);assert!(z.mint_steam626_single_fence_target(env(&z),90001,x,y).is_err());
  let mut q=d.clone();q["World"]["GridCollection"]["Grids"]["90001"]["NextGridObjectID"]=json!(i32::MAX);let z=open(&q,false);assert!(z.mint_steam626_single_fence_target(env(&z),90001,x,y).is_err());
 }

 #[test]
 fn qa1938_combined_main_geometry_readonly_target(){
  let (d,x,y)=fixture();
  let source=serde_json::to_vec(&d).unwrap();
  let geo=MeadowGeometry::fixed(EXACT_STEAM,626).unwrap();
  let installed=InstalledGeometry::fixed().unwrap();
  let grid=&d["World"]["GridCollection"]["Grids"]["90001"];
  let direct=geo.local_steam_single_fence(grid,x,y,|id|installed.dimensions(id),|o,dims|{
   let ox=o["X"].as_i64()?;let oy=o["Y"].as_i64()?;
   Some(Rect(ox,oy,ox+i64::from(dims.0),oy+i64::from(dims.1)))
  });
  assert_eq!(direct,Some(50),"composed current-main installed geometry exact valid target");
  assert!(geo.local_steam_single_fence(grid,x+1,y,|id|installed.dimensions(id),|_,_|panic!("unaligned must reject before ambient")).is_none());
  assert!(geo.local_steam_single_fence(grid,x,y,|id|installed.dimensions(id),|_,_|None).is_none(),"no ambient proof is not permission");
  let s=open(&d,false);let e=env(&s);let before=s.receipt().unwrap();
  let a=s.mint_steam626_single_fence_target(e,90001,x,y).unwrap();
  assert_eq!((a.grid,a.x,a.y,a.next,a.stock),(90001,x,y,50,10));
  assert_eq!(a.scope,e);
  assert_eq!(a,s.mint_steam626_single_fence_target(e,90001,x,y).unwrap(),"read-only repeated preview remains stable");
  assert_eq!(s.receipt().unwrap(),before);
  assert_eq!(s.decoded,source,"no mutation/debit/export or original change");
  let mut neg=0usize;
  macro_rules! deny {($ex:expr)=>{{assert!(($ex).is_err());neg+=1;}};}
  deny!(s.mint_steam626_single_fence_target(WorkerEnvelope{action:WorkerAction::Stage,..e},90001,x,y));
  deny!(s.mint_steam626_single_fence_target(WorkerEnvelope{expected_revision:e.expected_revision+1,..e},90001,x,y));
  deny!(s.mint_steam626_single_fence_target(WorkerEnvelope{expected_index_generation:e.expected_index_generation+1,..e},90001,x,y));
  deny!(s.mint_steam626_single_fence_target(WorkerEnvelope{expected_decoded_sha256:[0;32],..e},90001,x,y));
  deny!(s.mint_steam626_single_fence_target(e,90001,x+1,y));
  deny!(s.mint_steam626_single_fence_target(e,90001,x,y+1));
  deny!(s.mint_steam626_single_fence_target(e,90001,392,y));
  deny!(s.mint_steam626_single_fence_target(e,90001,x,196));
  let other=open(&d,false);deny!(other.mint_steam626_single_fence_target(e,90001,x,y));
  let switch=open(&d,true);deny!(switch.mint_steam626_single_fence_target(env(&switch),90001,x,y));
  for i in 0..10{
   let mut bad=d.clone();
   match i{
    0=>bad["Player"]["ListInventories"]["0"]["Inventory"]["40700246"]["Amount"]=json!(1),
    1=>bad["Player"]["ListInventories"]["0"]["Inventory"]["40700246"]["Marker"]=json!("ItemMarker_None"),
    2=>bad["Player"]["ListInventories"]["0"]["CompatibleItemType"]=json!("ItemType_ActivityItem"),
    3=>bad["World"]["GridCollection"]["Grids"]["90001"]["NextGridObjectID"]=json!(0),
    4=>bad["World"]["GridCollection"]["Grids"]["90001"]["GridDefaultLayoutPath"]=json!("not-ordinary"),
    5=>bad["World"]["GridCollection"]["Grids"]["90001"]["TessellationFactor"]=json!(1),
    6=>bad["World"]["GridCollection"]["DiffGrids"]["90001"]=json!({"ID":90001}),
    7=>bad["UnknownRefs"]=json!({"GridID":90001,"ObjectID":50}),
    8=>{bad["World"]["GridCollection"]["Grids"]["90001"]["Objects"]["11"]=json!({
      "ID":11,"ItemID":40700246,"X":x,"Y":y,"Orientation":"GridOrientation_Down","State":null});},
    _=>bad["Player"]["ListInventories"]["1"]=json!({"ID":1,"CompatibleItemType":"ItemType_Furniture",
      "Inventory":{"40700246":{"Amount":5,"Marker":"ItemMarker_Favorite"}}}),
   }
   let b=open(&bad,false);
   deny!(b.mint_steam626_single_fence_target(env(&b),90001,x,y));
  }
  assert_eq!(s.receipt().unwrap(),before);
  assert_eq!(s.decoded,source);
  std::fs::write("/tmp/qrc1938-singlefence-current-main-source.json",&source).unwrap();
  std::fs::write("/tmp/qrc1938-singlefence-current-main-coordinate.json",
    serde_json::to_vec(&json!({"x":x,"y":y})).unwrap()).unwrap();
  println!("QRC1938_MAIN_FIRST_SHARED_GEOMETRY_PASS 1POS {}NEG NO_DEBIT ORIGINAL_UNCHANGED current_source3",neg);
 }
 #[test]
 #[ignore="QA-only independent read-only process re-open; no Stage or encrypted Save product V2"]
 fn qa1938_main_first_singlefence_child_readonly_reopen(){
  let raw=std::fs::read("/tmp/qrc1938-singlefence-current-main-source.json").unwrap();
  let coord:Value=serde_json::from_slice(&std::fs::read("/tmp/qrc1938-singlefence-current-main-coordinate.json").unwrap()).unwrap();
  let d:Value=serde_json::from_slice(&raw).unwrap();
  let (x,y)=(coord["x"].as_u64().unwrap() as u32,coord["y"].as_u64().unwrap() as u32);
  let s=open(&d,false);let e=env(&s);let before=s.receipt().unwrap();
  let t=s.mint_steam626_single_fence_target(e,90001,x,y).unwrap();
  assert_eq!((t.next,t.stock),(50,10));
  assert_eq!(s.receipt().unwrap(),before);
  assert_eq!(s.decoded,raw);
  println!("QRC1938_MAIN_FIRST_CHILD_READONLY_REOPEN_PASS schema626 no_debit");
 }
}
