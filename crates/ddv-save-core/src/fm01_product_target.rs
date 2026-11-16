//! FM01 read-only target for the same immutable, exact Switch626 ProductSession.
use super::*;
const BASE:u32=40700246;
#[derive(Debug,PartialEq,Eq)]
#[allow(dead_code)]
pub(crate) struct Fm01Target{
 pub(crate) scope:WorkerEnvelope,pub(crate) grid:u32,pub(crate) ids:[u32;5],
 pub(crate) next:u32,pub(crate) stock:u32,pub(crate) root_sha:[u8;32],
 pub(crate) grid_sha:[u8;32],pub(crate) counter_sha:[u8;32],pub(crate) stock_sha:[u8;32],
 pub(crate) houses_sha:[u8;32],pub(crate) old_rows_sha:[[u8;32];5],pub(crate) pairs:usize,
}
pub(super) fn catalog(b:&[u8],player:Span)->CoreResult<(u32,Span)>{
 let lists=f(b,player,"ListInventories")?;let route=f(b,lists,"0")?;
 inventory_route(b,route,0,BASE,"ItemType_Furniture")?;
 let entry=f(b,f(b,route,"Inventory")?,&BASE.to_string())?;
 let v=value(b,entry,4096)?;let amount=uint(&v["Amount"]).ok_or(denied("FM01_STOCK"))?;
 need(fields(&v,&["Amount","Marker"])&&amount>0&&amount<=9999&&v["Marker"]=="ItemMarker_Favorite","FM01_STOCK")?;
 let mut count=0usize;
 for(k,r)in members(b,lists,4096)?{
  let id=key(&k)?;need(n(b,r,"ID")?==id,"FM01_ROUTE_ID")?;
  if opt(b,f(b,r,"Inventory")?,&BASE.to_string())?.is_some(){count+=1;need(id==0,"FM01_STOCK_ROUTE")?;}
 }
 need(count==1,"FM01_STOCK_ROUTE")?;
 physical_totals(b,player,BASE as i32,None,amount)?;
 Ok((amount,entry))
}
impl ProductSession{
 #[allow(dead_code)]
 pub(crate) fn mint_switch626_fm01_target(&self,e:WorkerEnvelope,gid:u32,ids:[u32;5])->CoreResult<Fm01Target>{
  road_build(self,RoadBuild::Switch626)?;
  let st=self.lock()?;check(self,&st,&e,WorkerAction::ReadDomain)?;
  need(self.worker_bound&&st.semantic.is_none()&&st.revision==0&&st.generation==1&&gid>0,"FM01_TARGET_EPOCH")?;
  let common=InstalledGeometry::fixed().ok_or(denied("FM01_COMMON_PROVIDER"))?;
  let pack=MeadowGeometry::fixed_switch626("9A239D3DB569756D",626).ok_or(denied("FM01_PROVIDER"))?;
  let b=&self.decoded;let roots=indexed_read::roots(b)?;let w=roots.world;
  let(root,g,gs,ds)=selected(b,w,gid)?;let next=n(b,g,"NextGridObjectID")?;
  let start=indexed_read::skip_ws(b,0);let top=Span{begin:start,end:indexed_read::value_end(b,start)?};
  let refs=super::super::placement_saved_refs::scan_fm01(b,top,gid,ids,next)?;
  need(refs.root(gid)==1&&refs.parent(gid)==0,"FM01_TARGET_REFERENCE_ALIAS")?;
  let(houses,house_span)=house_items(b,w)?;let objects=f(b,g,"Objects")?;let mut budget=0;
  for(_,o)in members(b,objects,4096)?{saved_grid_state(b,f(b,o,"State")?,BASE as i32,&mut budget)?;}
  let grid=value(b,g,MAX_GRID)?;
  let minted=pack.local_fm01_with_buildings(&grid,ids,&houses,|i|common.dimensions(i),
    |o,dims|ambient(b,w,gs,ds,&refs,&houses,o,dims)).ok_or(denied("FM01_TARGET_GEOMETRY"))?;
  need(minted==next,"FM01_TARGET_COUNTER")?;
  let(stock,entry)=catalog(b,roots.player)?;
  let mut old_rows_sha=[[0u8;32];5];
  for(i,id)in ids.iter().enumerate(){old_rows_sha[i]=digest(b,f(b,objects,&id.to_string())?)?;}
  Ok(Fm01Target{scope:e,grid:gid,ids,next,stock,root_sha:digest(b,root)?,grid_sha:digest(b,g)?,
    counter_sha:digest(b,f(b,g,"NextGridObjectID")?)?,stock_sha:digest(b,entry)?,
    houses_sha:digest(b,house_span)?,old_rows_sha,pairs:refs.pairs})
 }
}
#[cfg(test)]
mod tests{
 use super::*;use serde_json::json;
 fn doc()->Value{
  let p=MeadowGeometry::fixed_switch626("9A239D3DB569756D",626).unwrap();
  let (x,y)=(0..387u32).step_by(2).flat_map(|a|(0..193u32).step_by(2).map(move|b|(a,b)))
    .find(|&(a,b)|[(a,b),(a+2,b),(a+4,b),(a+4,b+2),(a+4,b+4),(a,b+2),(a,b+4),(a+2,b+6)].iter().all(|&(c,d)|(0..2).all(|i|(0..2).all(|j|p.floor4(c+i,d+j))))).unwrap();
  let row=|id,item,x,y,left|json!({"ID":id,"ItemID":item,"X":x,"Y":y,"Orientation":if left{"GridOrientation_Left"}else{"GridOrientation_Down"},"State":null});
  json!({"GameInfo":{"Version":626},"World":{"Villages":[{"Areas":{"2":{"Unlocked":true,"GridIDs":[90001]}}}],
   "PlayerHouses":[],"GridCollection":{"Grids":{"90001":{"ID":90001,"GridDataPath":GRID,"GridDefaultLayoutPath":"","TessellationFactor":2,"NextGridObjectID":50,
   "Objects":{"10":row(10,BASE,x,y,false),"11":row(11,40700247,x+2,y,false),"12":row(12,BASE,x+4,y,false),"13":row(13,40700247,x+4,y+2,true),"14":row(14,BASE,x+4,y+4,false)}}},"DiffGrids":{}}},
   "Player":{"ListInventories":{"0":{"ID":0,"CompatibleItemType":"ItemType_Furniture","CompatibleFurnitureTypes":{"List":["FurnitureItemType_Fence"]},"Inventory":{"40700246":{"Amount":10,"Marker":"ItemMarker_Favorite"}}}},"ContainerInventories":{}}})
 }
 fn open(d:&Value)->ProductSession{
  let mut s=ProductSession::open_decoded_readonly(serde_json::to_vec(d).unwrap(),crate::BuildIdentity{platform:Platform::Switch,build_kind:BuildKind::SwitchBid,build_id:"9A239D3DB569756D".into(),schema:626,externally_attested:true}).unwrap();s.worker_bound=true;s
 }
 fn env(s:&ProductSession)->WorkerEnvelope{let r=s.receipt().unwrap();WorkerEnvelope{contract:PRODUCT_WORKER_CONTRACT,session_id:r.session_id,expected_revision:r.revision,expected_index_generation:r.index_generation,expected_decoded_sha256:r.decoded_sha256,action:WorkerAction::ReadDomain}}
 #[test]fn switch626_fm01_exact_target_old5_fresh3_and_stock(){
  let d=doc();let s=open(&d);let e=env(&s);let ids=[10,11,12,13,14];let before=s.receipt().unwrap();
  let t=s.mint_switch626_fm01_target(e,90001,ids).unwrap();
  assert_eq!((t.ids,t.next,t.stock),(ids,50,10));assert_eq!(s.receipt().unwrap(),before);
  assert!(open(&d).mint_switch626_fm01_target(e,90001,ids).is_err());
  assert!(s.mint_switch626_fm01_target(WorkerEnvelope{expected_revision:1,..e},90001,ids).is_err());
  assert!(s.mint_switch626_fm01_target(WorkerEnvelope{action:WorkerAction::Stage,..e},90001,ids).is_err());
  assert!(s.mint_switch626_fm01_target(e,90001,[10,11,12,13,13]).is_err());
  for id in ids.into_iter().chain(50..53){
   let mut bad=d.clone();bad["Unknown"]=json!({"GridID":90001,"ObjectID":id});let q=open(&bad);
   assert!(q.mint_switch626_fm01_target(env(&q),90001,ids).is_err());
  }
  for (field,v) in [("Amount",json!(0)),("Marker",json!("ItemMarker_None"))]{
   let mut bad=d.clone();bad["Player"]["ListInventories"]["0"]["Inventory"]["40700246"][field]=v;let q=open(&bad);
   assert!(q.mint_switch626_fm01_target(env(&q),90001,ids).is_err());
  }
  let mut wrong_route=d.clone();wrong_route["Player"]["ListInventories"]["0"]["CompatibleFurnitureTypes"]["List"]=json!(["FurnitureItemType_GroundAlteration"]);
  let q=open(&wrong_route);assert_eq!(q.mint_switch626_fm01_target(env(&q),90001,ids).unwrap_err().0,"AMOUNT_ZERO_ROUTE_SUBTYPE_DENIED");
  let mut bad=d.clone();bad["World"]["GridCollection"]["DiffGrids"]["90001"]=json!({"ID":90001});
  let q=open(&bad);assert!(q.mint_switch626_fm01_target(env(&q),90001,ids).is_err());
  let mut bad=d.clone();bad["World"]["GridCollection"]["Grids"]["90001"]["Objects"]["13"]["Orientation"]=json!("GridOrientation_Down");
  let q=open(&bad);assert!(q.mint_switch626_fm01_target(env(&q),90001,ids).is_err());
 }
}
