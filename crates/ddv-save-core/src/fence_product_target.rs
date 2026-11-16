//! Exact read-only Switch626 FD01/FE01 target receipts. Existing Session/walker/geometry only.
use super::*;
const BASE:u32=40700246;
#[derive(Debug,PartialEq,Eq)]
#[allow(dead_code)]
pub(crate) struct Fd01Target{
 pub(crate) scope:WorkerEnvelope,pub(crate) grid:u32,pub(crate) x:u32,pub(crate) y:u32,pub(crate) next:u32,pub(crate) stock:u32,
 pub(crate) root_sha:[u8;32],pub(crate) grid_sha:[u8;32],pub(crate) counter_sha:[u8;32],pub(crate) stock_sha:[u8;32],pub(crate) houses_sha:[u8;32],pub(crate) pairs:usize,
}
#[derive(Debug,PartialEq,Eq)]
#[allow(dead_code)]
pub(crate) struct Fe01Target{
 pub(crate) scope:WorkerEnvelope,pub(crate) grid:u32,pub(crate) ids:[u32;4],pub(crate) next:u32,
 pub(crate) root_sha:[u8;32],pub(crate) grid_sha:[u8;32],pub(crate) counter_sha:[u8;32],pub(crate) houses_sha:[u8;32],pub(crate) old_rows_sha:[[u8;32];4],pub(crate) pairs:usize,
}
impl ProductSession{
 #[allow(dead_code)]
 pub(crate) fn mint_switch626_fd01_target(&self,e:WorkerEnvelope,gid:u32,x:u32,y:u32)->CoreResult<Fd01Target>{
  road_build(self,RoadBuild::Switch626)?;let st=self.lock()?;check(self,&st,&e,WorkerAction::ReadDomain)?;
  need(self.worker_bound&&st.semantic.is_none()&&st.revision==0&&st.generation==1&&gid>0,"FD01_TARGET_EPOCH")?;
  let common=InstalledGeometry::fixed().ok_or(denied("FD01_COMMON_PROVIDER"))?;
  let pack=MeadowGeometry::fixed_switch626("9A239D3DB569756D",626).ok_or(denied("FD01_PROVIDER"))?;
  let b=&self.decoded;let roots=indexed_read::roots(b)?;let w=roots.world;
  let(root,g,gs,ds)=selected(b,w,gid)?;let next=n(b,g,"NextGridObjectID")?;
  let end=next.checked_add(3).ok_or(denied("FD01_COUNTER"))?;need(next>0&&end<=i32::MAX as u32,"FD01_COUNTER")?;
  let start=indexed_read::skip_ws(b,0);let top=Span{begin:start,end:indexed_read::value_end(b,start)?};
  let refs=super::super::placement_saved_refs::scan(b,top,gid,None,next,end)?;
  need(refs.root(gid)==1&&refs.parent(gid)==0,"FD01_TARGET_REFERENCE_ALIAS")?;
  let(houses,house_span)=house_items(b,w)?;let objects=f(b,g,"Objects")?;let mut budget=0;
  for(_,o)in members(b,objects,4096)?{saved_grid_state(b,f(b,o,"State")?,BASE as i32,&mut budget)?;}
  let grid=value(b,g,MAX_GRID)?;
  let minted=pack.local_fd01(&grid,x,y,|i|common.dimensions(i),|o,dims|match uint(&o["ItemID"])?{
   20500005|20300115=>pack.effective_building(o,&houses),_=>ambient(b,w,gs,ds,&refs,&houses,o,dims),
  }).ok_or(denied("FD01_TARGET_GEOMETRY"))?;
  need(minted==next,"FD01_TARGET_COUNTER")?;
  let(stock,entry)=super::fm01_product_target::catalog(b,roots.player)?;
  Ok(Fd01Target{scope:e,grid:gid,x,y,next,stock,root_sha:digest(b,root)?,grid_sha:digest(b,g)?,
   counter_sha:digest(b,f(b,g,"NextGridObjectID")?)?,stock_sha:digest(b,entry)?,houses_sha:digest(b,house_span)?,pairs:refs.pairs})
 }
 #[allow(dead_code)]
 pub(crate) fn mint_switch626_fe01_target(&self,e:WorkerEnvelope,gid:u32,ids:[u32;4])->CoreResult<Fe01Target>{
  road_build(self,RoadBuild::Switch626)?;let st=self.lock()?;check(self,&st,&e,WorkerAction::ReadDomain)?;
  need(self.worker_bound&&st.semantic.is_none()&&st.revision==0&&st.generation==1&&gid>0,"FE01_TARGET_EPOCH")?;
  let common=InstalledGeometry::fixed().ok_or(denied("FE01_COMMON_PROVIDER"))?;
  let pack=MeadowGeometry::fixed_switch626("9A239D3DB569756D",626).ok_or(denied("FE01_PROVIDER"))?;
  let b=&self.decoded;let roots=indexed_read::roots(b)?;let w=roots.world;
  let(root,g,gs,ds)=selected(b,w,gid)?;let next=n(b,g,"NextGridObjectID")?;
  let start=indexed_read::skip_ws(b,0);let top=Span{begin:start,end:indexed_read::value_end(b,start)?};
  let refs=super::super::placement_saved_refs::scan_fe01(b,top,gid,ids,next)?;
  need(refs.root(gid)==1&&refs.parent(gid)==0,"FE01_TARGET_REFERENCE_ALIAS")?;
  let(houses,house_span)=house_items(b,w)?;let objects=f(b,g,"Objects")?;let mut budget=0;
  for(_,o)in members(b,objects,4096)?{saved_grid_state(b,f(b,o,"State")?,BASE as i32,&mut budget)?;}
  let grid=value(b,g,MAX_GRID)?;
  let minted=pack.local_fe01(&grid,ids,|i|common.dimensions(i),|o,dims|match uint(&o["ItemID"])?{
   20500005|20300115=>pack.effective_building(o,&houses),
   20500024=>pack.fe01_house_bound(o,&houses),
   _=>ambient(b,w,gs,ds,&refs,&houses,o,dims),
  }).ok_or(denied("FE01_TARGET_GEOMETRY"))?;
  need(minted==next,"FE01_TARGET_COUNTER")?;
  let mut old_rows_sha=[[0u8;32];4];for(i,id)in ids.iter().enumerate(){old_rows_sha[i]=digest(b,f(b,objects,&id.to_string())?)?;}
  Ok(Fe01Target{scope:e,grid:gid,ids,next,root_sha:digest(b,root)?,grid_sha:digest(b,g)?,
   counter_sha:digest(b,f(b,g,"NextGridObjectID")?)?,houses_sha:digest(b,house_span)?,old_rows_sha,pairs:refs.pairs})
 }
}
#[cfg(test)]
mod tests{
 use super::*;use serde_json::json;
 fn row(id:u32,item:u32,x:u32,y:u32,left:bool)->Value{json!({"ID":id,"ItemID":item,"X":x,"Y":y,"Orientation":if left{"GridOrientation_Left"}else{"GridOrientation_Down"},"State":null})}
 fn doc(fe:bool)->(Value,u32,u32){
  let p=MeadowGeometry::fixed_switch626("9A239D3DB569756D",626).unwrap();
  let(x,y)=(0..386u32).step_by(2).flat_map(|a|(0..182u32).step_by(2).map(move|b|(a,b)))
   .find(|&(a,b)|if fe{(0..2).all(|i|(0..18).all(|j|p.floor4(a+i,b+j)))}else{(0..3).all(|k|(0..2).all(|i|(0..2).all(|j|p.floor4(a+2*k+i,b+2*k+j))))}).unwrap();
  let objects=if fe{json!({"10":row(10,BASE,x,y,false),"11":row(11,BASE,x,y+16,false),"12":row(12,40700252,x,y+2,true),"13":row(13,BASE,x,y+14,false)})}
  else{json!({"10":row(10,BASE,if x<190{388}else{0},if y<100{196}else{0},false)})};
  (json!({"GameInfo":{"Version":626},"World":{"Villages":[{"Areas":{"2":{"Unlocked":true,"GridIDs":[90001]}}}],"PlayerHouses":[],
   "GridCollection":{"Grids":{"90001":{"ID":90001,"GridDataPath":GRID,"GridDefaultLayoutPath":"","TessellationFactor":2,"NextGridObjectID":50,"Objects":objects}},"DiffGrids":{}}},
   "Player":{"ListInventories":{"0":{"ID":0,"CompatibleItemType":"ItemType_Furniture","CompatibleFurnitureTypes":{"List":["FurnitureItemType_Fence"]},"Inventory":{"40700246":{"Amount":10,"Marker":"ItemMarker_Favorite"}}}},"ContainerInventories":{}}}),x,y)
 }
 fn open(d:&Value)->ProductSession{let mut s=ProductSession::open_decoded_readonly(serde_json::to_vec(d).unwrap(),crate::BuildIdentity{platform:Platform::Switch,build_kind:BuildKind::SwitchBid,build_id:"9A239D3DB569756D".into(),schema:626,externally_attested:true}).unwrap();s.worker_bound=true;s}
 fn env(s:&ProductSession)->WorkerEnvelope{let r=s.receipt().unwrap();WorkerEnvelope{contract:PRODUCT_WORKER_CONTRACT,session_id:r.session_id,expected_revision:r.revision,expected_index_generation:r.index_generation,expected_decoded_sha256:r.decoded_sha256,action:WorkerAction::ReadDomain}}
 #[test]fn switch626_fd01_target_fresh3_no_exemption(){
  let(d,x,y)=doc(false);let s=open(&d);let e=env(&s);let before=s.receipt().unwrap();
  let t=s.mint_switch626_fd01_target(e,90001,x,y).unwrap();assert_eq!((t.next,t.stock),(50,10));assert_eq!(s.receipt().unwrap(),before);
  assert!(s.mint_switch626_fd01_target(e,90001,x+1,y).is_err());
  assert!(s.mint_switch626_fd01_target(WorkerEnvelope{expected_revision:1,..e},90001,x,y).is_err());
  for id in 50..53{let mut q=d.clone();q["Unknown"]=json!({"GridID":90001,"ObjectID":id});let s=open(&q);assert!(s.mint_switch626_fd01_target(env(&s),90001,x,y).is_err());}
  let mut q=d.clone();q["World"]["GridCollection"]["Grids"]["90001"]["Objects"]["10"]=row(10,BASE,x,y,false);let s=open(&q);assert!(s.mint_switch626_fd01_target(env(&s),90001,x,y).is_err());
  let mut q=d.clone();q["Player"]["ListInventories"]["0"]["Inventory"]["40700246"]["Amount"]=json!(0);let s=open(&q);assert!(s.mint_switch626_fd01_target(env(&s),90001,x,y).is_err());
 }
 #[test]fn switch626_fe01_target_old4_fresh4_exact_shape(){
  let(d,x,y)=doc(true);let s=open(&d);let e=env(&s);let ids=[10,11,12,13];let before=s.receipt().unwrap();
  let t=s.mint_switch626_fe01_target(e,90001,ids).unwrap();assert_eq!((t.ids,t.next),(ids,50));assert_eq!(s.receipt().unwrap(),before);
  assert!(s.mint_switch626_fe01_target(e,90001,[10,11,12,12]).is_err());
  assert!(s.mint_switch626_fe01_target(WorkerEnvelope{action:WorkerAction::Stage,..e},90001,ids).is_err());
  for id in ids.into_iter().chain(50..54){let mut q=d.clone();q["Unknown"]=json!({"GridID":90001,"ObjectID":id});let s=open(&q);assert!(s.mint_switch626_fe01_target(env(&s),90001,ids).is_err());}
  let mut q=d.clone();q["World"]["GridCollection"]["Grids"]["90001"]["Objects"]["12"]["Orientation"]=json!("GridOrientation_Down");let s=open(&q);assert!(s.mint_switch626_fe01_target(env(&s),90001,ids).is_err());
  let mut q=d.clone();q["World"]["GridCollection"]["Grids"]["90001"]["Objects"]["14"]=row(14,BASE,x,y+6,false);let s=open(&q);assert!(s.mint_switch626_fe01_target(env(&s),90001,ids).is_err());
 }

 #[test]fn qa1798_independent_fd_fe(){
  for fe in [false,true]{
   let(d,x,y)=doc(fe);let s=open(&d);let e=env(&s);let before=s.receipt().unwrap();let ids=[10,11,12,13];
   let hash=|v:&Value|sha(&serde_json::to_vec(v).unwrap());let g=&d["World"]["GridCollection"]["Grids"]["90001"];
   let root=hash(&d["World"]["Villages"][0]["Areas"]["2"]);let gh=hash(g);let houses=sha(b"[]");let counter=sha(b"50");
   if fe{let t=s.mint_switch626_fe01_target(e,90001,ids).unwrap();assert_eq!((t.root_sha,t.grid_sha,t.houses_sha,t.counter_sha),(root,gh,houses,counter));assert_eq!(t.old_rows_sha,ids.map(|i|hash(&g["Objects"][i.to_string()])));}
   else{let t=s.mint_switch626_fd01_target(e,90001,x,y).unwrap();assert_eq!((t.root_sha,t.grid_sha,t.houses_sha,t.counter_sha),(root,gh,houses,counter));assert_eq!(t.stock_sha,hash(&d["Player"]["ListInventories"]["0"]["Inventory"]["40700246"]));}
   let deny=|q:&Value|{let a=open(q);let e=env(&a);if fe{assert!(a.mint_switch626_fe01_target(e,90001,ids).is_err())}else{assert!(a.mint_switch626_fd01_target(e,90001,x,y).is_err())}};
   let mut neg=0;
   for i in 0..9{let mut q=d.clone();match i{
     0=>q["World"]["Villages"][0]["Areas"]["2"]["GridIDs"]=json!([90001,90001]),
     1=>q["World"]["Villages"][0]["Areas"]["2"]["Unlocked"]=json!(false),
     2=>q["World"]["GridCollection"]["Grids"]["90001"]["NextGridObjectID"]=json!(2147483646u32),
     3=>q["World"]["GridCollection"]["Grids"]["90001"]["TessellationFactor"]=json!(1),
     4=>q["World"]["GridCollection"]["Grids"]["90001"]["GridDefaultLayoutPath"]=json!("foreign"),
     5=>q["World"]["GridCollection"]["DiffGrids"]["90001"]=json!({"ID":90001}),
     6=>q["Opaque"]=json!({"GridID":90001,"ObjectID":51}),
     7=>q["World"]["GridCollection"]["Grids"]["90001"]["Objects"]["10"]["State"]=json!({"Unknown":true}),
     _=>q["World"]["GridCollection"]["Grids"]["90001"]["Objects"]["15"]=row(15,BASE,x,y,false)
   }deny(&q);neg+=1;}
   let bad=WorkerEnvelope{expected_index_generation:2,..e};if fe{assert!(s.mint_switch626_fe01_target(bad,90001,ids).is_err());assert!(s.mint_switch626_fe01_target(e,90001,[10,11,13,12]).is_err());}else{assert!(s.mint_switch626_fd01_target(bad,90001,x,y).is_err());assert!(s.mint_switch626_fd01_target(e,90001,x,y+1).is_err());}neg+=2;
   let mut q=d.clone();q["Opaque"]=json!({"GridID":90001,"ObjectID":if fe{13}else{52}});deny(&q);neg+=1;
   assert_eq!(s.receipt().unwrap(),before);assert_eq!(neg,12);println!("QRC1798_{}_TARGET_ACTUAL 1POS {neg}NEG RAW_HASHES",if fe{"FE01"}else{"FD01"});
  }
  let p=MeadowGeometry::fixed_switch626("9A239D3DB569756D",626).unwrap();let h=json!({"ID":9,"ItemID":20500024,"X":42,"Y":24,"Orientation":"GridOrientation_UpLeft","State":{"HouseData":{"Built":true,"PlayerHouseIndex":0,"UpgradeState":{"Level":1}}}});let hs=json!([{"HouseItemID":20500024}]);assert_eq!(p.fe01_house_bound(&h,&hs),Some(Rect(42,24,76,58)));
  for v in [json!([]),json!([{"HouseItemID":20500025}]),json!([{"HouseItemID":20500024},{"HouseItemID":20500024}])]{assert!(p.fe01_house_bound(&h,&v).is_none());}
  for (k,v) in [("Built",json!(false)),("PlayerHouseIndex",json!(1)),("UpgradeState",json!({"Level":2}))]{let mut q=h.clone();q["State"]["HouseData"][k]=v;assert!(p.fe01_house_bound(&q,&hs).is_none());}
  println!("QRC1798_FE01_HOUSE_ACTUAL 1POS 6NEG EXACT34");
 }

}
