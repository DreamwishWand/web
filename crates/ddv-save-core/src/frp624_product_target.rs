//! Exact Switch624 FRP01 read-only target. No Writer, Stage or 626 grant.
use super::*;
use super::geometry::{Frp624Geometry,FRP_BUILD};
const BASE:u32=40700246;const NEW_BASE:u32=40700268;
#[derive(Debug,PartialEq,Eq)]
#[allow(dead_code)]
pub(crate) struct Frp01Target{
 pub(crate) scope:WorkerEnvelope,pub(crate) grid:u32,pub(crate) ids:[u32;3],pub(crate) next:u32,
 pub(crate) old_stock:u32,pub(crate) new_stock:u32,pub(crate) root_sha:[u8;32],pub(crate) grid_sha:[u8;32],
 pub(crate) counter_sha:[u8;32],pub(crate) old_stock_sha:[u8;32],pub(crate) new_stock_sha:[u8;32],
 pub(crate) houses_sha:[u8;32],pub(crate) old_rows_sha:[[u8;32];3],pub(crate) pairs:usize,
}
fn new_catalog(b:&[u8],player:Span)->CoreResult<(u32,Span)>{
 let lists=f(b,player,"ListInventories")?;let route=f(b,lists,"0")?;
 inventory_route(b,route,0,NEW_BASE,"ItemType_Furniture")?;
 let entry=f(b,f(b,route,"Inventory")?,&NEW_BASE.to_string())?;
 let v=value(b,entry,4096)?;let amount=uint(&v["Amount"]).ok_or(denied("FRP01_NEW_STOCK"))?;
 need(fields(&v,&["Amount","Marker"])&&amount>0&&amount<=9999&&v["Marker"]=="ItemMarker_None","FRP01_NEW_STOCK")?;
 let mut count=0usize;for(k,r)in members(b,lists,4096)?{let id=key(&k)?;need(n(b,r,"ID")?==id,"FRP01_ROUTE_ID")?;
  if opt(b,f(b,r,"Inventory")?,&NEW_BASE.to_string())?.is_some(){count+=1;need(id==0,"FRP01_NEW_STOCK_ROUTE")?;}}
 need(count==1,"FRP01_NEW_STOCK_ROUTE")?;physical_totals(b,player,NEW_BASE as i32,None,amount)?;Ok((amount,entry))
}
impl ProductSession{
 #[allow(dead_code)]
 pub(crate) fn mint_switch624_frp01_target(&self,e:WorkerEnvelope,gid:u32,ids:[u32;3])->CoreResult<Frp01Target>{
  let build=&self.native_source_build;
  need(build.platform==Platform::Switch&&build.build_kind==BuildKind::SwitchBid&&build.build_id==FRP_BUILD&&build.schema==624&&build.externally_attested,"FRP01_EXACT_SWITCH624_REQUIRED")?;
  let st=self.lock()?;check(self,&st,&e,WorkerAction::ReadDomain)?;
  need(self.worker_bound&&st.semantic.is_none()&&st.revision==0&&st.generation==1&&gid>0,"FRP01_TARGET_EPOCH")?;
  let common=InstalledGeometry::fixed().ok_or(denied("FRP01_COMMON_PROVIDER"))?;
  let pack=Frp624Geometry::fixed(&build.build_id,624).ok_or(denied("FRP01_PROVIDER"))?;
  let b=&self.decoded;let roots=indexed_read::roots(b)?;let w=roots.world;
  let(root,g,gs,ds)=selected(b,w,gid)?;let next=n(b,g,"NextGridObjectID")?;
  let start=indexed_read::skip_ws(b,0);let top=Span{begin:start,end:indexed_read::value_end(b,start)?};
  let refs=super::super::placement_saved_refs::scan_frp01(b,top,gid,ids,next)?;
  need(refs.root(gid)==1&&refs.parent(gid)==0,"FRP01_TARGET_REFERENCE_ALIAS")?;
  let(houses,house_span)=house_items(b,w)?;let objects=f(b,g,"Objects")?;
  for item in [BASE,NEW_BASE]{let mut budget=0;for(_,o)in members(b,objects,4096)?{saved_grid_state(b,f(b,o,"State")?,item as i32,&mut budget)?;}}
  let grid=value(b,g,MAX_GRID)?;
  let minted=pack.local(&grid,ids,|i|common.dimensions(i),|o,dims|match uint(&o["ItemID"])?{
   20500005|20300115=>pack.effective_building(o,&houses),
   40700253 if !o["State"].is_null()=>pack.diagonal_extension(o,dims),
   _=>ambient(b,w,gs,ds,&refs,&houses,o,dims),
  }).ok_or(denied("FRP01_TARGET_GEOMETRY"))?;
  need(minted==next,"FRP01_TARGET_COUNTER")?;
  let(old_stock,old_entry)=super::fm01_product_target::catalog(b,roots.player)?;
  let(new_stock,new_entry)=new_catalog(b,roots.player)?;
  let mut old_rows_sha=[[0u8;32];3];for(i,id)in ids.iter().enumerate(){old_rows_sha[i]=digest(b,f(b,objects,&id.to_string())?)?;}
  Ok(Frp01Target{scope:e,grid:gid,ids,next,old_stock,new_stock,root_sha:digest(b,root)?,grid_sha:digest(b,g)?,
   counter_sha:digest(b,f(b,g,"NextGridObjectID")?)?,old_stock_sha:digest(b,old_entry)?,new_stock_sha:digest(b,new_entry)?,
   houses_sha:digest(b,house_span)?,old_rows_sha,pairs:refs.pairs})
 }
}
#[cfg(test)]
mod tests{
 use super::*;use serde_json::json;
 fn doc()->Value{
  let p=MeadowGeometry::fixed_switch626("9A239D3DB569756D",626).unwrap();
  let(x,y)=(0..386u32).step_by(2).flat_map(|a|(0..190u32).step_by(2).map(move|b|(a,b)))
   .find(|&(a,b)|(0..2).all(|i|(0..6).all(|j|p.floor4(a+i,b+j)))).unwrap();
  let row=|id,item,dy,left|json!({"ID":id,"ItemID":item,"X":x,"Y":y+dy,"Orientation":if left{"GridOrientation_Left"}else{"GridOrientation_Down"},"State":null});
  json!({"GameInfo":{"Version":624},"World":{"Villages":[{"Areas":{"2":{"Unlocked":true,"GridIDs":[90001]}}}],"PlayerHouses":[],
   "GridCollection":{"Grids":{"90001":{"ID":90001,"GridDataPath":GRID,"GridDefaultLayoutPath":"","TessellationFactor":2,"NextGridObjectID":50,"Objects":{"10":row(10,BASE,0u32,false),"11":row(11,40700247,2,true),"12":row(12,BASE,4,false)}}},"DiffGrids":{}}},
   "Player":{"ListInventories":{"0":{"ID":0,"CompatibleItemType":"ItemType_Furniture","CompatibleFurnitureTypes":{"List":["FurnitureItemType_Fence"]},"Inventory":{"40700246":{"Amount":10,"Marker":"ItemMarker_Favorite"},"40700268":{"Amount":20,"Marker":"ItemMarker_None"}}}},"ContainerInventories":{}}})
 }
 fn open(d:&Value,bid:&str,schema:u64)->ProductSession{
  let bytes=serde_json::to_vec(d).unwrap();
  let build=crate::BuildIdentity{platform:Platform::Switch,build_kind:BuildKind::SwitchBid,build_id:bid.into(),schema,externally_attested:true};
  // Existing 624 private archive entry only. This fixture simulates a bound
  // session solely to test internal target logic; it does not grant 624 Worker admission.
  let mut s=if schema==624{
   assert_eq!(bid,FRP_BUILD);
   assert_eq!(ProductSession::open_decoded_readonly(bytes.clone(),build.clone()).err().unwrap().0,"BUILD_IDENTITY_NOT_ATTESTED");
   #[cfg(feature="product-switch624-frp01-readonly")]
   {let mut seed=[0u8;32];getrandom::getrandom(&mut seed).unwrap();return ProductSession::open_switch624_frp01_in_worker(bytes,build,seed).unwrap();}
   #[cfg(not(feature="product-switch624-frp01-readonly"))]
   {let digest=sha(&bytes);ProductSession::open_switch624_rm01_private(bytes,build,digest).unwrap()}
  }else{ProductSession::open_decoded_readonly(bytes,build).unwrap()};
  s.worker_bound=true;s
 }
 fn env(s:&ProductSession)->WorkerEnvelope{let r=s.receipt().unwrap();WorkerEnvelope{contract:PRODUCT_WORKER_CONTRACT,session_id:r.session_id,expected_revision:r.revision,expected_index_generation:r.index_generation,expected_decoded_sha256:r.decoded_sha256,action:WorkerAction::ReadDomain}}
 #[cfg(feature="product-switch624-frp01-readonly")]
 #[test]fn switch624_frp01_worker_admission_exact_and_readonly(){
  let d=doc();let bytes=serde_json::to_vec(&d).unwrap();
  let build=crate::BuildIdentity{platform:Platform::Switch,build_kind:BuildKind::SwitchBid,build_id:FRP_BUILD.into(),schema:624,externally_attested:true};
  let admit=|b:Vec<u8>,i:crate::BuildIdentity,seed:[u8;32]|ProductSession::open_switch624_frp01_in_worker(b,i,seed);
  assert!(ProductSession::open_decoded_readonly(bytes.clone(),build.clone()).is_err());
  assert!(admit(bytes.clone(),build.clone(),[0;32]).is_err());
  for mut bad in [build.clone(),build.clone(),build.clone(),build.clone(),build.clone()].into_iter().enumerate().map(|(i,mut b)|{match i{0=>b.schema=626,1=>b.build_id="9A239D3DB569756D".into(),2=>b.externally_attested=false,3=>b.platform=Platform::SteamWindows,_=>b.build_kind=BuildKind::SteamFullVersion};b}){
   assert!(admit(bytes.clone(),bad,[1;32]).is_err());
  }
  assert!(admit(br#"{"GameInfo":{"Version":624,"Version":624},"Player":{},"World":{}}"#.to_vec(),build.clone(),[1;32]).is_err());
  let mut wrong=d.clone();wrong["GameInfo"]["Version"]=json!(626);assert!(admit(serde_json::to_vec(&wrong).unwrap(),build.clone(),[1;32]).is_err());
  let s=admit(bytes.clone(),build.clone(),[1;32]).unwrap();let e=env(&s);let r=s.receipt().unwrap();
  assert!(r.product_worker_bound&&r.full_document_json_validated&&!r.writer_authorized&&!r.edited_copy_authorized&&!r.apply_authorized);
  let foreign=admit(bytes,build,[2;32]).unwrap();assert_ne!(r.session_id,foreign.receipt().unwrap().session_id);
  assert!(foreign.mint_switch624_frp01_target(e,90001,[10,11,12]).is_err());
  for action in [WorkerAction::Stage,WorkerAction::ExportEditedCopy,WorkerAction::Apply,WorkerAction::OriginalOverwrite]{
   assert!(s.dispatch(WorkerEnvelope{action,..e}).is_err());
  }
  let mut g=crate::worker_session::WorkerSessionGuard::attach(s);
  let t=g.read_switch624_frp01_target(e,90001,[10,11,12]).unwrap();assert_eq!(t["nextGridObjectId"],50);assert_eq!(t["writerAuthorized"],false);
  assert!(g.read_switch624_frp01_target(WorkerEnvelope{expected_revision:1,..e},90001,[10,11,12]).is_err());
  assert!(g.read_switch624_frp01_target(WorkerEnvelope{expected_index_generation:2,..e},90001,[10,11,12]).is_err());
  assert!(g.read_switch624_frp01_target(WorkerEnvelope{expected_decoded_sha256:[0;32],..e},90001,[10,11,12]).is_err());
  g.close().unwrap();assert!(g.read_switch624_frp01_target(e,90001,[10,11,12]).is_err());
 }
 #[test]fn switch624_frp01_exact3_replacement_target_conservative(){
  let d=doc();let s=open(&d,FRP_BUILD,624);let e=env(&s);let ids=[10,11,12];let before=s.receipt().unwrap();
  let t=s.mint_switch624_frp01_target(e,90001,ids).unwrap();assert_eq!((t.ids,t.next,t.old_stock,t.new_stock),(ids,50,10,20));assert_eq!(s.receipt().unwrap(),before);
  assert!(s.mint_switch624_frp01_target(e,90001,[10,11,11]).is_err());
  assert!(s.mint_switch624_frp01_target(WorkerEnvelope{action:WorkerAction::Stage,..e},90001,ids).is_err());
  assert!(s.mint_switch624_frp01_target(WorkerEnvelope{expected_revision:1,..e},90001,ids).is_err());
  assert!(open(&d,FRP_BUILD,624).mint_switch624_frp01_target(e,90001,ids).is_err());
  let mut d626=d.clone();d626["GameInfo"]["Version"]=json!(626);let q=open(&d626,"9A239D3DB569756D",626);assert!(q.mint_switch624_frp01_target(env(&q),90001,ids).is_err());
  for id in ids.into_iter().chain(50..53){let mut q=d.clone();q["Unknown"]=json!({"GridID":90001,"ObjectID":id});let s=open(&q,FRP_BUILD,624);assert!(s.mint_switch624_frp01_target(env(&s),90001,ids).is_err());}
  let mut q=d.clone();q["Player"]["ListInventories"]["0"]["Inventory"]["40700268"]["Amount"]=json!(0);let s=open(&q,FRP_BUILD,624);assert!(s.mint_switch624_frp01_target(env(&s),90001,ids).is_err());
  let mut q=d.clone();q["World"]["GridCollection"]["Grids"]["90001"]["Objects"]["11"]["ItemID"]=json!(40700248);let s=open(&q,FRP_BUILD,624);assert!(s.mint_switch624_frp01_target(env(&s),90001,ids).is_err());
  let mut q=d.clone();let mut ambient=q["World"]["GridCollection"]["Grids"]["90001"]["Objects"]["10"].clone();ambient["ID"]=json!(13);ambient["ItemID"]=json!(40005494);ambient["Orientation"]=json!("GridOrientation_UpLeft");q["World"]["GridCollection"]["Grids"]["90001"]["Objects"]["13"]=ambient;
  let s=open(&q,FRP_BUILD,624);assert_eq!(s.mint_switch624_frp01_target(env(&s),90001,ids).unwrap_err().0,"FRP01_TARGET_GEOMETRY");
 }
}
