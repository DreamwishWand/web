//! ACT1465: Switch624 FRP01 exact7. A fixed Stage for the existing Worker-bound
//! ProductSession, not generic624, Native archive, rights, UI or public ABI.
use super::*;
use serde_json::{json,Value};

#[derive(Debug,PartialEq,Eq)]
pub(crate) struct Frp01StagePreview{
 pub(crate) target:Frp01Target,pub(crate) projected:[u8;32],
}
fn record(id:u32,item:u32,x:u32,y:u32,left:bool)->Value{
 json!({"ID":id,"ItemID":item,"X":x,"Y":y,
       "Orientation":if left{"GridOrientation_Left"}else{"GridOrientation_Down"},"State":null})
}
fn edit(b:&[u8],span:Span,new:Vec<u8>)->CoreResult<Replacement>{
 let old=b.get(span.begin..span.end).ok_or(denied("FRP01_STAGE_SPAN"))?.to_vec();
 need(old!=new,"FRP01_STAGE_NO_CHANGE")?;Ok(Replacement{span,old,new})
}
impl ProductSession{
 fn prepare_frp01_product(&self,e:WorkerEnvelope,grid:u32,ids:[u32;3])
     ->CoreResult<(Frp01StagePreview,Vec<Replacement>)>{
  let t=self.mint_switch624_frp01_target(e,grid,ids)?;
  let st=self.lock()?;check(self,&st,&e,WorkerAction::ReadDomain)?;
  need(st.semantic.is_none()&&st.revision==0&&st.generation==1,"FRP01_STAGE_EPOCH")?;drop(st);
  let b=&self.decoded;
  let roots=indexed_read::roots(b)?;
  let (root,g,_,_)=selected(b,roots.world,t.grid)?;
  let (_,houses_span)=house_items(b,roots.world)?;
  let counter=f(b,g,"NextGridObjectID")?;
  need(digest(b,root)?==t.root_sha&&digest(b,g)?==t.grid_sha&&
    digest(b,counter)?==t.counter_sha&&digest(b,houses_span)?==t.houses_sha&&
    n(b,g,"NextGridObjectID")?==t.next,"FRP01_STAGE_ROOT_CAS")?;
  let (old_stock,old_entry)=super::super::fixed_fence_catalog(b,roots.player)?;
  let (new_stock,new_entry)=new_catalog(b,roots.player)?;
  need((old_stock,new_stock)==(t.old_stock,t.new_stock)&&
    digest(b,old_entry)?==t.old_stock_sha&&digest(b,new_entry)?==t.new_stock_sha,
    "FRP01_STAGE_STOCK_CAS")?;
  let end=t.next.checked_add(3).filter(|v|*v<=i32::MAX as u32)
    .ok_or(denied("FRP01_STAGE_COUNTER"))?;
  let objs=f(b,g,"Objects")?;
  let mut pos=objs.begin+1;let mut members=Vec::new();
  loop{
   let start=indexed_read::skip_ws(b,pos);
   let Some((key,span))=next_object_member(b,objs,&mut pos)? else{break};
   let id=key.parse::<u32>().map_err(|_|denied("FRP01_STAGE_OBJECT_ID"))?;
   need(id>0&&key==id.to_string()&&n(b,span,"ID")?==id&&id<t.next,
        "FRP01_STAGE_OBJECT_ID")?;
   need(members.len()<4096,"FRP01_STAGE_OBJECT_BOUNDS")?;
   members.push((id,start,span));
  }
  let mut old=[Span{begin:0,end:0};3];
  for (i,id) in t.ids.iter().enumerate(){
   let matches=members.iter().filter(|(n,_,_)|n==id).map(|(_,_,s)|*s).collect::<Vec<_>>();
   need(matches.len()==1,"FRP01_STAGE_OLD_ID")?;
   old[i]=matches[0];
   need(digest(b,old[i])?==t.old_rows_sha[i],"FRP01_STAGE_OLD_CAS")?;
  }
  let origin=value(b,old[0],4096)?;
  let x=uint(&origin["X"]).ok_or(denied("FRP01_STAGE_COORD"))?;
  let y=uint(&origin["Y"]).ok_or(denied("FRP01_STAGE_COORD"))?;
  let y2=y.checked_add(2).ok_or(denied("FRP01_STAGE_COORD"))?;
  let y4=y.checked_add(4).filter(|v|*v<=i32::MAX as u32).ok_or(denied("FRP01_STAGE_COORD"))?;
  let expected=[record(ids[0],BASE,x,y,false),record(ids[1],40700247,x,y2,true),record(ids[2],BASE,x,y4,false)];
  for i in 0..3{need(value(b,old[i],4096)?==expected[i],"FRP01_STAGE_OLD_SHAPE")?;}
  let created=[record(t.next,NEW_BASE,x,y,false),record(t.next+1,40700269,x,y2,true),record(t.next+2,NEW_BASE,x,y4,false)];
  let mut edits=Vec::new();
  if members.len()>3{
   let mut i=0;
   while i<members.len(){
    if !ids.contains(&members[i].0){i+=1;continue;}
    let first=i;while i<members.len()&&ids.contains(&members[i].0){i+=1;}
    let span=if i<members.len(){Span{begin:members[first].1,end:members[i].1}}
      else{need(first>0,"FRP01_STAGE_EMPTY_MAP")?;
       Span{begin:members[first-1].2.end,end:members[i-1].2.end}};
    edits.push(edit(b,span,Vec::new())?);
   }
  }
  let all_old=members.len()==3;
  let mut insert=Vec::new();
  if all_old{insert.push(b'{');}
  for(i,o)in created.iter().enumerate(){
   if i>0||!all_old{insert.push(b',');}
   let id=t.next+i as u32;
   insert.push(b'"');insert.extend_from_slice(id.to_string().as_bytes());
   insert.push(b'"');insert.push(b':');
   insert.extend_from_slice(&serde_json::to_vec(o).map_err(|_|denied("FRP01_STAGE_ENCODE"))?);
  }
  insert.push(b'}');
  edits.push(edit(b,if all_old{objs}else{Span{begin:objs.end-1,end:objs.end}},insert)?);
  edits.push(edit(b,counter,end.to_string().into_bytes())?);
  edits.sort_by_key(|v|v.span.begin);
  need(edits.len()<=5,"FRP01_STAGE_EDIT_BOUNDS")?;
  let mut h=Sha256::new();let mut p=0;
  for change in &edits{
   need(change.span.begin>=p&&change.span.end<=b.len()&&
        b.get(change.span.begin..change.span.end)==Some(change.old.as_slice()),
        "FRP01_STAGE_RAW_CAS")?;
   h.update(&b[p..change.span.begin]);h.update(&change.new);p=change.span.end;
  }
  h.update(&b[p..]);
  Ok((Frp01StagePreview{target:t,projected:h.finalize().into()},edits))
 }
 #[allow(dead_code)]
 pub(crate) fn preview_switch624_frp01_product(&self,e:WorkerEnvelope,grid:u32,ids:[u32;3])
     ->CoreResult<Frp01StagePreview>{
  self.prepare_frp01_product(e,grid,ids).map(|(p,_)|p)
 }
 #[allow(dead_code)]
 pub(crate) fn stage_switch624_frp01_product(&self,e:WorkerEnvelope,p:&Frp01StagePreview)
     ->CoreResult<SemanticStageReceipt>{
  need(e.action==WorkerAction::Stage,"FRP01_STAGE_ACTION")?;
  let (fresh,edits)=self.prepare_frp01_product(WorkerEnvelope{action:WorkerAction::ReadDomain,..e},
                                                p.target.grid,p.target.ids)?;
  need(&fresh==p,"FRP01_STAGE_PREVIEW_CAS")?;
  self.commit_semantic_replacements(e,edits,7,Some(fresh.projected))
 }
}
