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
fn catalog(b:&[u8],player:Span)->CoreResult<(u32,Span)>{
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
#[cfg(feature="product-switch626-fm01-scoped")]
struct Fm01Prepared{target:Fm01Target,edits:Vec<Replacement>,projected:[u8;32]}
#[cfg(feature="product-switch626-fm01-scoped")]
impl ProductSession{
 fn prepare_switch626_fm01_product(&self,e:WorkerEnvelope,grid:u32,ids:[u32;5])->CoreResult<Fm01Prepared>{
  use super::super::super::switch624_fence_fe01::{Fm01Expected,collect_fm01_current};
  let t=self.mint_switch626_fm01_target(e,grid,ids)?;
  let st=self.lock()?;check(self,&st,&e,WorkerAction::ReadDomain)?;
  need(st.semantic.is_none()&&st.revision==0&&st.generation==1,"FM01_PRODUCT_EPOCH")?;
  let w=Fm01Expected{grid:t.grid,ids:t.ids,next:t.next,stock:t.stock,grid_sha:t.grid_sha,
   stock_sha:t.stock_sha,counter_sha:t.counter_sha,old_rows_sha:t.old_rows_sha};
  let mut edits=collect_fm01_current(self,&w)?;
  // Physical splice count depends on the lexical adjacency of the four
  // removed rows; logical diff is always four deletes + three adds + counter.
  need((3..=6).contains(&edits.len()),"FM01_PRODUCT_EDIT_COUNT")?;
  edits.sort_by_key(|v|v.span.begin);
  let b=&self.decoded;let mut h=Sha256::new();let mut pos=0;
  for edit in &edits{
   need(edit.span.begin>=pos&&edit.span.end>=edit.span.begin&&edit.span.end<=b.len()&&
       raw(b,edit.span)?==edit.old.as_slice(),"FM01_PRODUCT_RAW_CAS")?;
   h.update(&b[pos..edit.span.begin]);h.update(&edit.new);pos=edit.span.end;
  }
  h.update(&b[pos..]);let projected=h.finalize().into();
  Ok(Fm01Prepared{target:t,edits,projected})
 }
 #[allow(dead_code)]
 pub(crate) fn preview_switch626_fm01_product(&self,e:WorkerEnvelope,grid:u32,ids:[u32;5])->CoreResult<Value>{
  let p=self.prepare_switch626_fm01_product(e,grid,ids)?;let t=&p.target;
  Ok(json!({"contract":"wand.worker.switch626.scoped-fm01-layout@1","layout":"PRESERVE_EXISTING",
   "gridId":t.grid,"oldIds":t.ids,"retainedId":t.ids[0],"deletedIds":&t.ids[1..],
   "expectedNextId":t.next,"oldAmount":t.stock,"newAmount":t.stock,"inventoryDelta":0,
   "rootSha256":super::super::hex(&t.root_sha),"gridSha256":super::super::hex(&t.grid_sha),
   "counterSha256":super::super::hex(&t.counter_sha),"inventoryEntrySha256":super::super::hex(&t.stock_sha),
   "housesSha256":super::super::hex(&t.houses_sha),"oldRowsSha256":t.old_rows_sha.map(|v|super::super::hex(&v)),
   "projectedDecodedSha256":super::super::hex(&p.projected),"exactFieldChangedCount":8,
   "sessionId":super::super::hex(&e.session_id),"revision":e.expected_revision,"indexGeneration":e.expected_index_generation,
   "decodedSha256":super::super::hex(&e.expected_decoded_sha256),"productWriterAuthorized":false,"originalOverwriteAuthorized":false}))
 }
 #[allow(dead_code)]
 pub(crate) fn stage_switch626_fm01_product(&self,e:WorkerEnvelope,grid:u32,ids:[u32;5],next:u32,stock:u32,
  root_sha:[u8;32],grid_sha:[u8;32],counter_sha:[u8;32],stock_sha:[u8;32],houses_sha:[u8;32],
  old_rows_sha:[[u8;32];5],projected:[u8;32])->CoreResult<SemanticStageReceipt>{
  need(e.action==WorkerAction::Stage,"FM01_PRODUCT_STAGE_ACTION")?;
  let p=self.prepare_switch626_fm01_product(WorkerEnvelope{action:WorkerAction::ReadDomain,..e},grid,ids)?;
  let t=&p.target;
  need(t.grid==grid&&t.ids==ids&&t.next==next&&t.stock==stock&&t.root_sha==root_sha&&t.grid_sha==grid_sha&&
       t.counter_sha==counter_sha&&t.stock_sha==stock_sha&&t.houses_sha==houses_sha&&t.old_rows_sha==old_rows_sha&&
       p.projected==projected,"FM01_PRODUCT_STAGE_CAS")?;
  self.commit_semantic_replacements(e,p.edits,8,Some(p.projected))
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
 #[cfg(feature="product-switch626-fm01-scoped")]
 #[test]fn switch626_fm01_product_exact8_atomic_cas_lifecycle(){
  let d=doc();let s=open(&d);let e=env(&s);let ids=[10,11,12,13,14];
  let p=s.prepare_switch626_fm01_product(e,90001,ids).unwrap();let t=&p.target;let before=s.receipt().unwrap();
  let q=s.preview_switch626_fm01_product(e,90001,ids).unwrap();
  assert_eq!(q["exactFieldChangedCount"],8);assert_eq!(q["inventoryDelta"],0);
  assert_eq!(q["oldAmount"],q["newAmount"]);assert_eq!(q["layout"],"PRESERVE_EXISTING");
  let st=WorkerEnvelope{action:WorkerAction::Stage,..e};
  let run=|s:&ProductSession,e,ids,next,stock,root,grid,counter,entry,houses,rows,projected|
   s.stage_switch626_fm01_product(e,90001,ids,next,stock,root,grid,counter,entry,houses,rows,projected);
  let hashes=[t.root_sha,t.grid_sha,t.counter_sha,t.stock_sha,t.houses_sha,p.projected];
  for i in 0..6{let mut h=hashes;h[i]=[0;32];assert!(run(&s,st,ids,50,10,h[0],h[1],h[2],h[3],h[4],t.old_rows_sha,h[5]).is_err());}
  for i in 0..5{let mut rows=t.old_rows_sha;rows[i]=[0;32];assert!(run(&s,st,ids,50,10,hashes[0],hashes[1],hashes[2],hashes[3],hashes[4],rows,hashes[5]).is_err());}
  let valid=|s:&ProductSession,e|run(s,e,ids,50,10,hashes[0],hashes[1],hashes[2],hashes[3],hashes[4],t.old_rows_sha,hashes[5]);
  assert!(valid(&s,e).is_err());assert!(valid(&open(&d),st).is_err());
  assert!(run(&s,st,ids,51,10,hashes[0],hashes[1],hashes[2],hashes[3],hashes[4],t.old_rows_sha,hashes[5]).is_err());
  assert!(run(&s,st,ids,50,9,hashes[0],hashes[1],hashes[2],hashes[3],hashes[4],t.old_rows_sha,hashes[5]).is_err());
  assert!(run(&s,st,[10,11,12,13,13],50,10,hashes[0],hashes[1],hashes[2],hashes[3],hashes[4],t.old_rows_sha,hashes[5]).is_err());
  let mut unbound=open(&d);unbound.worker_bound=false;assert!(unbound.preview_switch626_fm01_product(env(&unbound),90001,ids).is_err());
  let mut bad=d.clone();bad["Unknown"]=json!({"GridID":90001,"ObjectID":50});let bad=open(&bad);
  assert!(bad.preview_switch626_fm01_product(env(&bad),90001,ids).is_err());
  assert_eq!(s.receipt().unwrap(),before);
  let r=valid(&s,st).unwrap();assert_eq!(r.exact_field_changed_count,8);assert_eq!(r.staged_decoded_sha256,p.projected);
  assert!(!r.product_writer_authorized&&!r.original_overwrite_authorized);assert!(valid(&s,st).is_err());
  s.undo_typed_semantic_batch(WorkerEnvelope{action:WorkerAction::Stage,..env(&s)}).unwrap();
  assert!(s.take_typed_semantic_decoded_once(WorkerEnvelope{action:WorkerAction::ExportEditedCopy,..env(&s)}).is_err());
  s.redo_typed_semantic_batch(WorkerEnvelope{action:WorkerAction::Stage,..env(&s)}).unwrap();
  let export=WorkerEnvelope{action:WorkerAction::ExportEditedCopy,..env(&s)};
  let out=s.take_typed_semantic_decoded_once(export).unwrap();assert!(s.take_typed_semantic_decoded_once(export).is_err());
  let mut wanted=d.clone();let g=&mut wanted["World"]["GridCollection"]["Grids"]["90001"];
  let x=g["Objects"]["10"]["X"].as_u64().unwrap();let y=g["Objects"]["10"]["Y"].as_u64().unwrap();
  g["NextGridObjectID"]=json!(53);for id in ["11","12","13","14"]{g["Objects"].as_object_mut().unwrap().remove(id);}
  g["Objects"]["50"]=json!({"ID":50,"ItemID":40700247,"X":x,"Y":y+2,"Orientation":"GridOrientation_Left","State":null});
  g["Objects"]["51"]=json!({"ID":51,"ItemID":BASE,"X":x,"Y":y+4,"Orientation":"GridOrientation_Down","State":null});
  g["Objects"]["52"]=json!({"ID":52,"ItemID":BASE,"X":x+2,"Y":y+6,"Orientation":"GridOrientation_Down","State":{"FenceMode":{"Diagonal":true}}});
  assert_eq!(serde_json::from_slice::<Value>(&out).unwrap(),wanted);assert_eq!(sha(&out),p.projected);
  assert_eq!(sha(&s.decoded),before.decoded_sha256);
  let reopened=ProductSession::open_decoded_readonly(out,crate::BuildIdentity{platform:Platform::Switch,build_kind:BuildKind::SwitchBid,build_id:"9A239D3DB569756D".into(),schema:626,externally_attested:true}).unwrap();
  assert_eq!(reopened.receipt().unwrap().decoded_sha256,p.projected);
 }
 #[cfg(feature="product-switch626-fm01-scoped")]
 #[test]fn switch626_fm01_worker_guard_boundary(){
  let d=doc();let s=open(&d);let e=env(&s);let ids=[10,11,12,13,14];
  let p=s.prepare_switch626_fm01_product(e,90001,ids).unwrap();let t=&p.target;
  let (root,grid,counter,entry,houses,rows,projected)=(t.root_sha,t.grid_sha,t.counter_sha,t.stock_sha,t.houses_sha,t.old_rows_sha,p.projected);
  let mut g=crate::worker_session::WorkerSessionGuard::attach(s);
  assert_eq!(g.preview_switch626_fm01(e,90001,ids).unwrap()["exactFieldChangedCount"],8);
  assert!(g.preview_switch626_fm01(e,90001,[10,11,12,13,13]).is_err());
  let st=WorkerEnvelope{action:WorkerAction::Stage,..e};
  assert!(g.stage_switch626_fm01(st,90001,ids,50,10,root,grid,counter,entry,houses,rows,[0;32]).is_err());
  let r=g.stage_switch626_fm01(st,90001,ids,50,10,root,grid,counter,entry,houses,rows,projected).unwrap();assert_eq!(r.exact_field_changed_count,8);
  assert!(g.stage_switch626_fm01(st,90001,ids,50,10,root,grid,counter,entry,houses,rows,projected).is_err());
  let out=WorkerEnvelope{expected_revision:r.revision,expected_index_generation:r.index_generation,action:WorkerAction::ExportEditedCopy,..st};
  assert_eq!(sha(&g.take_scoped_edit(out).unwrap()),projected);assert!(g.take_scoped_edit(out).is_err());
 }
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
 #[test]fn qa1808_synthetic_fixture(){let mut d=doc();d["Opaque"]=json!({"escaped":"keep","stockDecoy":10});let raw=serde_json::to_string(&d).unwrap().replace("\"escaped\":\"keep\"","\"escaped\":\"\\u006beep\"");std::fs::write("/tmp/qrc1808-input.json",raw).unwrap();}
}
