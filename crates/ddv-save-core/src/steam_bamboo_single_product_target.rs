//! ACT1570: exact Steam626 BambooFence01 Base40700007 read-only target.
//! Reuses existing Meadow geometry, full typed scanner and Session CAS.
//! Positive stock is a witness only; no debit, Stage, rights or Writer grant.
use super::*;
const BASE:u32=40700007;
#[derive(Debug,PartialEq,Eq)]
#[allow(dead_code)]
pub(crate) struct SteamBambooSingleTarget{
 pub(crate) scope:WorkerEnvelope,pub(crate) grid:u32,pub(crate) x:u32,pub(crate) y:u32,
 pub(crate) next:u32,pub(crate) stock:u32,pub(crate) root_sha:[u8;32],pub(crate) grid_sha:[u8;32],
 pub(crate) counter_sha:[u8;32],pub(crate) stock_sha:[u8;32],pub(crate) houses_sha:[u8;32],pub(crate) pairs:usize,
}
fn catalog(b:&[u8],player:Span)->CoreResult<(u32,Span)>{
 let lists=f(b,player,"ListInventories")?;let route=f(b,lists,"0")?;
 inventory_route(b,route,0,BASE,"ItemType_Furniture")?;
 let entry=f(b,f(b,route,"Inventory")?,&BASE.to_string())?;
 let v=value(b,entry,4096)?;let old=uint(&v["Amount"]).ok_or(denied("BAMBOO_SINGLE_STOCK"))?;
 need(fields(&v,&["Amount","Marker"])&&old>=2&&old<=9999&&v["Marker"]=="ItemMarker_None","BAMBOO_SINGLE_STOCK")?;
 let mut hits=0;for(k,r)in members(b,lists,4096)?{let id=key(&k)?;need(n(b,r,"ID")?==id,"BAMBOO_SINGLE_ROUTE_ID")?;
  if opt(b,f(b,r,"Inventory")?,&BASE.to_string())?.is_some(){hits+=1;need(id==0,"BAMBOO_SINGLE_ROUTE")?;}}
 need(hits==1,"BAMBOO_SINGLE_ROUTE")?;physical_totals(b,player,BASE as i32,None,old)?;Ok((old,entry))
}
impl ProductSession{
 #[allow(dead_code)]
 pub(crate) fn mint_steam626_bamboo_single_target(&self,e:WorkerEnvelope,gid:u32,x:u32,y:u32)->CoreResult<SteamBambooSingleTarget>{
  road_build(self,RoadBuild::Steam626)?;let st=self.lock()?;check(self,&st,&e,WorkerAction::ReadDomain)?;
  need(self.worker_bound&&st.semantic.is_none()&&st.revision==0&&st.generation==1&&gid>0,"BAMBOO_SINGLE_EPOCH")?;
  let common=InstalledGeometry::fixed().ok_or(denied("BAMBOO_SINGLE_COMMON_PROVIDER"))?;
  let pack=MeadowGeometry::fixed(EXACT_STEAM,626).ok_or(denied("BAMBOO_SINGLE_PROVIDER"))?;
  let b=&self.decoded;let roots=indexed_read::roots(b)?;let w=roots.world;
  let(root,g,gs,ds)=selected(b,w,gid)?;let next=n(b,g,"NextGridObjectID")?;
  let end=next.checked_add(1).ok_or(denied("BAMBOO_SINGLE_COUNTER"))?;
  need(next>0&&end<=i32::MAX as u32,"BAMBOO_SINGLE_COUNTER")?;
  let start=indexed_read::skip_ws(b,0);let top=Span{begin:start,end:indexed_read::value_end(b,start)?};
  let refs=super::super::placement_saved_refs::scan(b,top,gid,None,next,end)?;
  need(refs.root(gid)==1&&refs.parent(gid)==0,"BAMBOO_SINGLE_REFERENCE_ALIAS")?;
  let(houses,house_span)=house_items(b,w)?;let objects=f(b,g,"Objects")?;let mut budget=0;
  for(_,o)in members(b,objects,4096)?{saved_grid_state(b,f(b,o,"State")?,BASE as i32,&mut budget)?;}
  let grid=value(b,g,MAX_GRID)?;
  let minted=pack.local_steam_bamboo_single(&grid,x,y,|i|common.dimensions(i),|o,dims|match uint(&o["ItemID"])?{
   20500005|20300115=>pack.effective_building(o,&houses),
   _=>ambient(b,w,gs,ds,&refs,&houses,o,dims),
  }).ok_or(denied("BAMBOO_SINGLE_GEOMETRY"))?;
  need(minted==next,"BAMBOO_SINGLE_COUNTER")?;
  let(stock,entry)=catalog(b,roots.player)?;
  Ok(SteamBambooSingleTarget{scope:e,grid:gid,x,y,next,stock,root_sha:digest(b,root)?,grid_sha:digest(b,g)?,
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
   "Player":{"ListInventories":{"0":{"ID":0,"CompatibleItemType":"ItemType_Furniture","CompatibleFurnitureTypes":{"List":["FurnitureItemType_Fence"]},"Inventory":{"40700007":{"Amount":10,"Marker":"ItemMarker_None"}}}},"ContainerInventories":{}}}),x,y)
 }
 fn open(d:&Value,switch:bool)->ProductSession{let mut s=ProductSession::open_decoded_readonly(serde_json::to_vec(d).unwrap(),crate::BuildIdentity{
  platform:if switch{Platform::Switch}else{Platform::SteamWindows},build_kind:if switch{BuildKind::SwitchBid}else{BuildKind::SteamFullVersion},
  build_id:if switch{"9A239D3DB569756D".into()}else{EXACT_STEAM.into()},schema:626,externally_attested:true}).unwrap();s.worker_bound=true;s}
 fn env(s:&ProductSession)->WorkerEnvelope{let r=s.receipt().unwrap();WorkerEnvelope{contract:PRODUCT_WORKER_CONTRACT,session_id:r.session_id,expected_revision:r.revision,expected_index_generation:r.index_generation,expected_decoded_sha256:r.decoded_sha256,action:WorkerAction::ReadDomain}}
 #[test]fn steam626_bamboo_single_target_exact1_no_debit(){
  let(d,x,y)=fixture();let s=open(&d,false);let e=env(&s);let before=s.receipt().unwrap();let t=s.mint_steam626_bamboo_single_target(e,90001,x,y).unwrap();
  assert_eq!((t.x,t.y,t.next,t.stock),(x,y,50,10));assert_eq!(s.receipt().unwrap(),before);
  assert!(s.mint_steam626_bamboo_single_target(WorkerEnvelope{action:WorkerAction::Stage,..e},90001,x,y).is_err());
  assert!(s.mint_steam626_bamboo_single_target(WorkerEnvelope{expected_revision:1,..e},90001,x,y).is_err());
  assert!(open(&d,false).mint_steam626_bamboo_single_target(e,90001,x,y).is_err());
  let q=open(&d,true);assert!(q.mint_steam626_bamboo_single_target(env(&q),90001,x,y).is_err());
  assert!(s.mint_steam626_bamboo_single_target(e,90001,x+1,y).is_err());
  assert!(s.mint_steam626_bamboo_single_target(e,90001,392,y).is_err());
  for dx in [0,2]{let mut q=d.clone();q["World"]["GridCollection"]["Grids"]["90001"]["Objects"]["10"]["X"]=json!(x+dx);q["World"]["GridCollection"]["Grids"]["90001"]["Objects"]["10"]["Y"]=json!(y);
   let z=open(&q,false);assert_eq!(z.mint_steam626_bamboo_single_target(env(&z),90001,x,y).unwrap_err().0,"BAMBOO_SINGLE_GEOMETRY");}
  let mut q=d.clone();q["Unknown"]=json!({"GridID":90001,"ObjectID":50});let z=open(&q,false);assert!(z.mint_steam626_bamboo_single_target(env(&z),90001,x,y).is_err());
  let mut q=d.clone();q["Player"]["ListInventories"]["0"]["Inventory"]["40700007"]["Amount"]=json!(1);let z=open(&q,false);assert!(z.mint_steam626_bamboo_single_target(env(&z),90001,x,y).is_err());
  let mut q=d.clone();q["World"]["GridCollection"]["Grids"]["90001"]["NextGridObjectID"]=json!(i32::MAX);let z=open(&q,false);assert!(z.mint_steam626_bamboo_single_target(env(&z),90001,x,y).is_err());
 }

 #[test]
 fn qa1968_bamboo_changed_target_readonly_contract(){
  // Reproduce only independently disclosed saved *scalar* witness (9140);
  // all placement/geometry/root bytes remain synthetic, NOT an actual private Save.
  let (mut d,x,y)=fixture();
  d["Player"]["ListInventories"]["0"]["Inventory"]["40700007"]["Amount"]=json!(9140);
  let source=serde_json::to_vec(&d).unwrap();
  let s=open(&d,false);let e=env(&s);let original=s.receipt().unwrap();
  let t=s.mint_steam626_bamboo_single_target(e,90001,x,y).unwrap();
  assert_eq!((t.grid,t.x,t.y,t.next,t.stock),(90001,x,y,50,9140));
  assert_eq!(t.scope,e);
  assert_eq!(s.receipt().unwrap(),original);
  assert_eq!(s.decoded.as_ref(),source.as_slice());
  let mut neg=0u32;
  // Table enumerates changed ItemID/physical inventory/geometry/reference boundaries,
  // without touching existing Road or single ordinary Fence semantics.
  for case in 0..22{
   let mut bad=d.clone();
   match case{
    0=>bad["Player"]["ListInventories"]["0"]["Inventory"]["40700007"]["Amount"]=json!(0),
    1=>bad["Player"]["ListInventories"]["0"]["Inventory"]["40700007"]["Amount"]=json!(1),
    2=>bad["Player"]["ListInventories"]["0"]["Inventory"]["40700007"]["Amount"]=json!(10000),
    3=>bad["Player"]["ListInventories"]["0"]["Inventory"]["40700007"]["Marker"]=json!("ItemMarker_Favorite"),
    4=>{bad["Player"]["ListInventories"]["0"]["Inventory"]["40700007"].as_object_mut().unwrap().remove("Marker");},
    5=>bad["Player"]["ListInventories"]["0"]["CompatibleItemType"]=json!("ItemType_ActivityItem"),
    6=>bad["Player"]["ListInventories"]["0"]["ID"]=json!(2),
    7=>bad["Player"]["ListInventories"]["1"]=json!({"ID":1,"CompatibleItemType":"ItemType_Furniture","Inventory":{"40700007":{"Amount":2,"Marker":"ItemMarker_None"}}}),
    8=>bad["World"]["Villages"][0]["Areas"]["2"]["Unlocked"]=json!(false),
    9=>bad["World"]["GridCollection"]["Grids"]["90001"]["TessellationFactor"]=json!(1),
    10=>bad["World"]["GridCollection"]["Grids"]["90001"]["GridDataPath"]=json!("foreign/noncanonical"),
    11=>bad["World"]["GridCollection"]["Grids"]["90001"]["NextGridObjectID"]=json!(10),
    12=>bad["World"]["GridCollection"]["Grids"]["90001"]["NextGridObjectID"]=json!(i32::MAX),
    13=>bad["World"]["GridCollection"]["Grids"]["90001"]["Objects"]["10"]["X"]=json!(x),
    14=>{bad["World"]["GridCollection"]["Grids"]["90001"]["Objects"]["10"]["X"]=json!(x+2);bad["World"]["GridCollection"]["Grids"]["90001"]["Objects"]["10"]["Y"]=json!(y);},
    15=>bad["World"]["GridCollection"]["Grids"]["90001"]["Objects"]["10"]["Y"]=json!(y),
    16=>bad["World"]["GridCollection"]["Grids"]["90001"]["Objects"]["10"]["ID"]=json!(11),
    17=>bad["World"]["GridCollection"]["Grids"]["90001"]["Objects"]["10"]["State"]=json!({"FenceMode":{"Diagonal":true}}),
    18=>bad["World"]["UnknownAlias"]=json!({"GridID":90001,"ObjectID":50}),
    19=>bad["World"]["GridCollection"]["Grids"]["90001"]["ID"]=json!(90002),
    20=>bad["World"]["Villages"][0]["Areas"]["2"]["GridIDs"]=json!([90002]),
    _=>bad["World"]["GridCollection"]["Grids"]["90001"]["GridDefaultLayoutPath"]=json!("unexpected"),
   }
   let q=open(&bad,false);
   assert!(q.mint_steam626_bamboo_single_target(env(&q),90001,x,y).is_err(),"bamboo negative {case}");
   neg+=1;
  }
  assert!(s.mint_steam626_bamboo_single_target(WorkerEnvelope{action:WorkerAction::Stage,..e},90001,x,y).is_err());neg+=1;
  assert!(s.mint_steam626_bamboo_single_target(WorkerEnvelope{expected_revision:1,..e},90001,x,y).is_err());neg+=1;
  assert!(s.mint_steam626_bamboo_single_target(WorkerEnvelope{expected_index_generation:e.expected_index_generation+1,..e},90001,x,y).is_err());neg+=1;
  assert!(s.mint_steam626_bamboo_single_target(WorkerEnvelope{expected_decoded_sha256:[0;32],..e},90001,x,y).is_err());neg+=1;
  let foreign=open(&d,false);
  assert!(foreign.mint_steam626_bamboo_single_target(e,90001,x,y).is_err());neg+=1;
  let switch=open(&d,true);
  assert!(switch.mint_steam626_bamboo_single_target(env(&switch),90001,x,y).is_err());neg+=1;
  assert!(s.mint_steam626_bamboo_single_target(e,90001,x+1,y).is_err());neg+=1;
  assert!(s.mint_steam626_bamboo_single_target(e,90001,392,y).is_err());neg+=1;
  assert_eq!(neg,30);
  assert_eq!(s.receipt().unwrap(),original);
  assert_eq!(s.decoded.as_ref(),source.as_slice());
  std::fs::write("/tmp/qrc1968-bamboo-fixture.json",&source).unwrap();
  std::fs::write("/tmp/qrc1968-bamboo-xy.txt",format!("{x},{y}")).unwrap();
  println!("QRC1968_BAMBOO_SYNTHETIC_TARGET_PASS 1POS 30NEG EXACT_ITEM40700007 STOCK9140 NO_DEBIT ORIGINAL_UNCHANGED RIGHTS_UNKNOWN ACTUAL_PRIVATE_TARGET_NOT_RUN");
 }
 #[test]
 #[ignore="Run in separate cargo test process after synthetic fixture emission"]
 fn qa1968_bamboo_child_readonly_reopen(){
  let bytes=std::fs::read("/tmp/qrc1968-bamboo-fixture.json").unwrap();
  let (left,right)=std::fs::read_to_string("/tmp/qrc1968-bamboo-xy.txt").unwrap().trim().split_once(',').unwrap();
  let(x,y)=(left.parse::<u32>().unwrap(),right.parse::<u32>().unwrap());
  let d:Value=serde_json::from_slice(&bytes).unwrap();
  let s=open(&d,false);let before=s.receipt().unwrap();let e=env(&s);
  let t=s.mint_steam626_bamboo_single_target(e,90001,x,y).unwrap();
  assert_eq!((t.grid,t.next,t.stock),(90001,50,9140));
  assert_eq!(s.receipt().unwrap(),before);
  assert_eq!(s.decoded.as_ref(),bytes.as_slice());
  assert!(s.mint_steam626_bamboo_single_target(WorkerEnvelope{action:WorkerAction::Stage,..e},90001,x,y).is_err());
  println!("QRC1968_BAMBOO_SYNTHETIC_CHILD_READONLY_REOPEN_PASS NO_DEBIT NOT_GENUINE_ENCRYPTED_P1G");
 }

}

#[cfg(test)]
mod bamboo_additional_negative_tests{
 use super::*;
 #[test]
 fn bamboo_install_definition_and_fail_closed_witness(){
  let common=InstalledGeometry::fixed().unwrap();
  assert_eq!(common.dimensions(BASE),Some((1,1)));
  let pack=MeadowGeometry::fixed(EXACT_STEAM,626).unwrap();
  assert_eq!(pack.dimensions(BASE,|id|common.dimensions(id)),None);
  assert!(MeadowGeometry::fixed("foreign",626).is_none());
  assert!(MeadowGeometry::fixed(EXACT_STEAM,624).is_none());
 }
}
