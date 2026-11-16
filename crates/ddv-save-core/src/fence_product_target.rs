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
#[cfg(feature="product-switch626-fd01-scoped")]
struct Fd01Prepared{target:Fd01Target,edits:Vec<Replacement>,projected:[u8;32]}
#[cfg(feature="product-switch626-fd01-scoped")]
impl ProductSession{
 fn prepare_switch626_fd01_product(&self,e:WorkerEnvelope,grid:u32,x:u32,y:u32)->CoreResult<Fd01Prepared>{
  use super::super::super::switch624_fence_fe01::{Fd01CurrentExpected,collect_fd01_current};
  let t=self.mint_switch626_fd01_target(e,grid,x,y)?;
  let st=self.lock()?;check(self,&st,&e,WorkerAction::ReadDomain)?;
  need(st.semantic.is_none()&&st.revision==0&&st.generation==1,"FD01_PRODUCT_EPOCH")?;
  let w=Fd01CurrentExpected{grid:t.grid,next:t.next,grid_sha:t.grid_sha,counter_sha:t.counter_sha,x:t.x,y:t.y,stock:t.stock,stock_sha:t.stock_sha};
  let mut edits=collect_fd01_current(self,&w)?;
  need(edits.len()==2,"FD01_PRODUCT_EDIT_COUNT")?;
  edits.sort_by_key(|v|v.span.begin);
  let b=&self.decoded;let mut h=Sha256::new();let mut pos=0;
  for edit in &edits{
   need(edit.span.begin>=pos&&edit.span.end>=edit.span.begin&&edit.span.end<=b.len()&&raw(b,edit.span)?==edit.old.as_slice(),"FD01_PRODUCT_RAW_CAS")?;
   h.update(&b[pos..edit.span.begin]);h.update(&edit.new);pos=edit.span.end;
  }
  h.update(&b[pos..]);let projected=h.finalize().into();
  Ok(Fd01Prepared{target:t,edits,projected})
 }
 #[allow(dead_code)]
 pub(crate) fn preview_switch626_fd01_product(&self,e:WorkerEnvelope,grid:u32,x:u32,y:u32)->CoreResult<Value>{
  let p=self.prepare_switch626_fd01_product(e,grid,x,y)?;let t=&p.target;
  Ok(json!({"contract":"wand.worker.switch626.scoped-fd01-layout@1","layout":"PRESERVE_EXISTING","gridId":t.grid,"x":t.x,"y":t.y,"oldAmount":t.stock,"newAmount":t.stock,"inventoryEntrySha256":super::super::hex(&t.stock_sha),
   "expectedNextId":t.next,"inventoryDelta":0,"rootSha256":super::super::hex(&t.root_sha),"gridSha256":super::super::hex(&t.grid_sha),
   "counterSha256":super::super::hex(&t.counter_sha),"housesSha256":super::super::hex(&t.houses_sha),
   "projectedDecodedSha256":super::super::hex(&p.projected),"exactFieldChangedCount":4,
   "sessionId":super::super::hex(&e.session_id),"revision":e.expected_revision,"indexGeneration":e.expected_index_generation,
   "decodedSha256":super::super::hex(&e.expected_decoded_sha256),"productWriterAuthorized":false,"originalOverwriteAuthorized":false}))
 }
 #[allow(dead_code)]
 pub(crate) fn stage_switch626_fd01_product(&self,e:WorkerEnvelope,grid:u32,x:u32,y:u32,next:u32,
  root_sha:[u8;32],grid_sha:[u8;32],counter_sha:[u8;32],houses_sha:[u8;32],stock:u32,stock_sha:[u8;32],projected:[u8;32])->CoreResult<SemanticStageReceipt>{
  need(e.action==WorkerAction::Stage,"FD01_PRODUCT_STAGE_ACTION")?;
  let p=self.prepare_switch626_fd01_product(WorkerEnvelope{action:WorkerAction::ReadDomain,..e},grid,x,y)?;
  let t=&p.target;
  need(t.grid==grid&&t.next==next&&t.root_sha==root_sha&&t.grid_sha==grid_sha&&t.counter_sha==counter_sha&&t.houses_sha==houses_sha&&
    t.x==x&&t.y==y&&t.stock==stock&&t.stock_sha==stock_sha&&p.projected==projected,"FD01_PRODUCT_STAGE_CAS")?;
  self.commit_semantic_replacements(e,p.edits,4,Some(p.projected))
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
 #[cfg(feature="product-switch626-fd01-scoped")]
 #[test]fn switch626_fd01_worker_guard_boundary(){
  let(d,x,y)=doc(false);let s=open(&d);let e=env(&s);let p=s.prepare_switch626_fd01_product(e,90001,x,y).unwrap();let t=&p.target;
  let(next,root,grid,counter,houses,stock,entry,projected)=(t.next,t.root_sha,t.grid_sha,t.counter_sha,t.houses_sha,t.stock,t.stock_sha,p.projected);
  let mut g=crate::worker_session::WorkerSessionGuard::attach(s);
  assert_eq!(g.preview_switch626_fd01(e,90001,x,y).unwrap()["exactFieldChangedCount"],4);
  let st=WorkerEnvelope{action:WorkerAction::Stage,..e};
  assert!(g.stage_switch626_fd01(st,90001,x,y,next,root,grid,counter,houses,stock,entry,[0;32]).is_err());
  let r=g.stage_switch626_fd01(st,90001,x,y,next,root,grid,counter,houses,stock,entry,projected).unwrap();assert_eq!(r.exact_field_changed_count,4);
  assert!(g.stage_switch626_fd01(st,90001,x,y,next,root,grid,counter,houses,stock,entry,projected).is_err());
  let out=WorkerEnvelope{expected_revision:r.revision,expected_index_generation:r.index_generation,action:WorkerAction::ExportEditedCopy,..st};assert_eq!(sha(&g.take_scoped_edit(out).unwrap()),projected);assert!(g.take_scoped_edit(out).is_err());
 }
 #[cfg(feature="product-switch626-fd01-scoped")]
 #[test]fn switch626_fd01_product_exact4_atomic_cas_lifecycle(){
  let(d,x,y)=doc(false);let s=open(&d);let e=env(&s);
  let p=s.prepare_switch626_fd01_product(e,90001,x,y).unwrap();let t=&p.target;let before=s.receipt().unwrap();
  let q=s.preview_switch626_fd01_product(e,90001,x,y).unwrap();assert_eq!(q["exactFieldChangedCount"],4);assert_eq!(q["inventoryDelta"],0);
  let st=WorkerEnvelope{action:WorkerAction::Stage,..e};
  let run=|s:&ProductSession,e,next,root,grid,counter,houses,stock,entry,projected|
   s.stage_switch626_fd01_product(e,90001,x,y,next,root,grid,counter,houses,stock,entry,projected);
  let h=[t.root_sha,t.grid_sha,t.counter_sha,t.houses_sha,p.projected];
  for i in 0..5{let mut a=h;a[i]=[0;32];assert!(run(&s,st,50,a[0],a[1],a[2],a[3],10,t.stock_sha,a[4]).is_err());}
  assert!(run(&s,st,50,h[0],h[1],h[2],h[3],9,t.stock_sha,h[4]).is_err());assert!(run(&s,st,50,h[0],h[1],h[2],h[3],10,[0;32],h[4]).is_err());
  let valid=|s:&ProductSession,e|run(s,e,50,h[0],h[1],h[2],h[3],10,t.stock_sha,h[4]);
  assert!(valid(&s,e).is_err());assert!(valid(&open(&d),st).is_err());
  assert!(run(&s,st,51,h[0],h[1],h[2],h[3],10,t.stock_sha,h[4]).is_err());
  let mut unbound=open(&d);unbound.worker_bound=false;assert!(unbound.preview_switch626_fd01_product(env(&unbound),90001,x,y).is_err());
  let mut bad=d.clone();bad["Unknown"]=json!({"GridID":90001,"ObjectID":50});let bad=open(&bad);
  assert!(bad.preview_switch626_fd01_product(env(&bad),90001,x,y).is_err());
  assert_eq!(s.receipt().unwrap(),before);
  let r=valid(&s,st).unwrap();assert_eq!(r.exact_field_changed_count,4);assert_eq!(r.staged_decoded_sha256,p.projected);
  assert!(!r.product_writer_authorized&&!r.original_overwrite_authorized);assert!(valid(&s,st).is_err());
  s.undo_typed_semantic_batch(WorkerEnvelope{action:WorkerAction::Stage,..env(&s)}).unwrap();
  assert!(s.take_typed_semantic_decoded_once(WorkerEnvelope{action:WorkerAction::ExportEditedCopy,..env(&s)}).is_err());
  s.redo_typed_semantic_batch(WorkerEnvelope{action:WorkerAction::Stage,..env(&s)}).unwrap();
  let export=WorkerEnvelope{action:WorkerAction::ExportEditedCopy,..env(&s)};
  let out=s.take_typed_semantic_decoded_once(export).unwrap();assert!(s.take_typed_semantic_decoded_once(export).is_err());
  let mut wanted=d.clone();let g=&mut wanted["World"]["GridCollection"]["Grids"]["90001"];
  g["NextGridObjectID"]=json!(53);
  for(id,item,k)in [(50,BASE,0),(51,40700253,1),(52,BASE,2)]{g["Objects"][id.to_string()]=json!({"ID":id,"ItemID":item,"X":x+2*k,"Y":y+2*k,"Orientation":"GridOrientation_Down","State":{"FenceMode":{"Diagonal":true}}});}
  assert_eq!(serde_json::from_slice::<Value>(&out).unwrap(),wanted);assert_eq!(sha(&out),p.projected);assert_eq!(sha(&s.decoded),before.decoded_sha256);
  let reopened=ProductSession::open_decoded_readonly(out,crate::BuildIdentity{platform:Platform::Switch,build_kind:BuildKind::SwitchBid,build_id:"9A239D3DB569756D".into(),schema:626,externally_attested:true}).unwrap();
  assert_eq!(reopened.receipt().unwrap().decoded_sha256,p.projected);
 }
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
}
