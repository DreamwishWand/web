//! Native-private FE01 exact layout-only interior erase, PRESERVE_EXISTING.
//! 01C owns the plan; this is one fixed-shape validator and atomic applicator.
//! Exact archive + 01B geometry and 01E reference closure must be bound by
//! the independent operator. No refund, inventory change, generic compiler,
//! product Worker grant, or historical full-fresh identity churn.
use super::*;
use serde_json::{Value,json};
const BID:&str="52BD625D9B4E0053";
const BASE:u32=40700246;
const OLD_EXT:u32=40700252;
const NEW_EXT:u32=40700248;
fn digest(b:&[u8])->String{sha(b).iter().map(|x|format!("{x:02x}")).collect()}
fn uint(v:&Value)->CoreResult<u32>{v.as_u64().and_then(|n|u32::try_from(n).ok()).ok_or(denied("FE01_PLAN_UINT"))}
fn raw(b:&[u8],s:Span)->CoreResult<&[u8]>{b.get(s.begin..s.end).ok_or(denied("FE01_SPAN"))}
fn num(b:&[u8],s:Span,k:&str)->CoreResult<u32>{u32::try_from(number(b,object_field(b,s,k)?)?).map_err(|_|denied("FE01_UINT"))}
fn val(b:&[u8],s:Span)->CoreResult<Value>{
    if s.end.saturating_sub(s.begin)>4096{return Err(denied("FE01_RECORD_BOUND"));}
    serde_json::from_slice(raw(b,s)?).map_err(|_|denied("FE01_RECORD"))
}
fn enc(v:&Value)->CoreResult<Vec<u8>>{serde_json::to_vec(v).map_err(|_|denied("FE01_ENCODE"))}
fn obj(id:u32,item:u32,x:u32,y:u32)->Value{
    json!({"ID":id,"ItemID":item,"X":x,"Y":y,
        "Orientation":if item==BASE{"GridOrientation_Down"}else{"GridOrientation_Left"},"State":null})
}
fn plan_parse(b:&[u8])->CoreResult<Value>{
    if b.is_empty()||b.len()>16384{return Err(denied("FE01_PLAN_BOUNDS"));}
    let v:Value=serde_json::from_slice(b).map_err(|_|denied("FE01_PLAN_JSON"))?;
    if enc(&v)?.as_slice()!=b{return Err(denied("FE01_PLAN_NONCANONICAL"));}
    let keys=["contract","layout","sourceDecodedSha256","gridId","expectedNextId","gridSha256",
        "retainedIds","deletedIds","created"];
    let m=v.as_object().ok_or(denied("FE01_PLAN_OBJECT"))?;
    if m.len()!=keys.len()||!keys.iter().all(|k|m.contains_key(*k))||
       v["contract"]!="wand.private.switch624.fence-fe01-archive@1"||
       v["layout"]!="PRESERVE_EXISTING"{return Err(denied("FE01_PLAN_FIELDS"));}
    Ok(v)
}
fn pair(v:&Value)->CoreResult<[u32;2]>{
    let a=v.as_array().filter(|a|a.len()==2).ok_or(denied("FE01_PAIR"))?;
    Ok([uint(&a[0])?,uint(&a[1])?])
}
fn replace(b:&[u8],span:Span,new:Vec<u8>)->CoreResult<Replacement>{
    let old=raw(b,span)?.to_vec();
    if old==new{return Err(denied("FE01_NO_CHANGE"));}
    Ok(Replacement{span,old,new})
}
fn collect(s:&ProductSession,p:&Value)->CoreResult<Vec<Replacement>>{
    let b=&s.decoded;
    if p["sourceDecodedSha256"]!=digest(b){return Err(denied("FE01_SOURCE_SHA_CAS"));}
    let g=uint(&p["gridId"])?;let next=uint(&p["expectedNextId"])?;
    let n4=next.checked_add(4).ok_or(denied("FE01_COUNTER_OVERFLOW"))?;
    let keep=pair(&p["retainedIds"])?;let del=pair(&p["deletedIds"])?;
    let ids=[keep[0],keep[1],del[0],del[1]];
    if g==0||n4>i32::MAX as u32||ids.iter().any(|id|*id==0||*id>=next)||
       (0..4).any(|i|(i+1..4).any(|j|ids[i]==ids[j])){return Err(denied("FE01_ID_BOUNDS"));}
    let roots=indexed_read::roots(b)?;
    let gc=object_field(b,roots.world,"GridCollection")?;
    let grid=object_field(b,object_field(b,gc,"Grids")?,&g.to_string())?;
    if p["gridSha256"]!=digest(raw(b,grid)?)||num(b,grid,"ID")?!=g||
       num(b,grid,"TessellationFactor")?!=2||val(b,object_field(b,grid,"GridDefaultLayoutPath")?)?!=""{
        return Err(denied("FE01_GRID_CAS_OR_LAYOUT"));
    }
    let diffs=object_field(b,gc,"DiffGrids")?;
    let mut pos=diffs.begin+1;let mut count=0;
    while let Some((k,_))=next_object_member(b,diffs,&mut pos)?{
        count+=1;if count>50000||k==g.to_string(){return Err(denied("FE01_OVERLAY"));}
    }
    let counter=object_field(b,grid,"NextGridObjectID")?;
    if number(b,counter)?!=next as u64{return Err(denied("FE01_COUNTER_CAS"));}
    let objs=object_field(b,grid,"Objects")?;
    let mut pos=objs.begin+1;let mut members=Vec::new();let mut found=[None;4];
    loop{
        let start=indexed_read::skip_ws(b,pos);
        let Some((k,entry))=next_object_member(b,objs,&mut pos)? else{break};
        if members.len()>=250000{return Err(denied("FE01_OBJECT_BOUND"));}
        let id=k.parse::<u32>().map_err(|_|denied("FE01_OBJECT_KEY"))?;
        if id==0||id.to_string()!=k||id>=next||num(b,entry,"ID")?!=id{return Err(denied("FE01_OBJECT_ID"));}
        if let Some(i)=ids.iter().position(|x|*x==id){found[i]=Some(entry);}
        members.push((id,start,entry));
    }
    let [Some(first),Some(last),Some(old_ext),Some(old_base)]=found else{return Err(denied("FE01_OLD_MISSING"));};
    let x=num(b,first,"X")?;let y=num(b,first,"Y")?;
    let at=|dy:u32|y.checked_add(dy).filter(|v|*v<=i32::MAX as u32).ok_or(denied("FE01_COORD_BOUND"));
    if x>i32::MAX as u32||val(b,first)?!=obj(keep[0],BASE,x,y)||
       val(b,last)?!=obj(keep[1],BASE,x,at(16)?)||
       val(b,old_ext)?!=obj(del[0],OLD_EXT,x,at(2)?)||
       val(b,old_base)?!=obj(del[1],BASE,x,at(14)?){
        return Err(denied("FE01_OLD_SHAPE"));
    }
    // Exact historical descriptor-equivalent 01C plan with matching old
    // endpoints retained. Never regenerate all IDs or apply a refund.
    let wanted=[obj(next,NEW_EXT,x,at(2)?),obj(next+1,BASE,x,at(6)?),
        obj(next+2,BASE,x,at(10)?),obj(next+3,NEW_EXT,x,at(12)?)];
    let plan=p["created"].as_array().ok_or(denied("FE01_CREATED"))?;
    if plan.as_slice()!=wanted.as_slice(){return Err(denied("FE01_EXACT_PLAN_SHAPE"));}
    for (id,_,entry) in &members{
        if ids.contains(id){continue;}
        let ox=val(b,object_field(b,*entry,"X")?)?;let oy=val(b,object_field(b,*entry,"Y")?)?;
        let ox=ox.as_f64().filter(|v|v.is_finite()).ok_or(denied("FE01_COORD_TOKEN"))?;
        let oy=oy.as_f64().filter(|v|v.is_finite()).ok_or(denied("FE01_COORD_TOKEN"))?;
        if ox==x as f64&&(0..=8).any(|k|oy==(y+2*k) as f64){
            return Err(denied("FE01_OCCUPIED_ANCHOR"));
        }
    }
    layout_edits(b,&members,&del,objs,counter,n4,plan)
}
fn layout_edits(b:&[u8],members:&[(u32,usize,Span)],del:&[u32],objs:Span,
    counter:Span,n4:u32,plan:&[Value])->CoreResult<Vec<Replacement>>{
    // Remove exact member ranges, including only their adjacent separators.
    // Consecutive targets are coalesced. All untouched raw records/unknown
    // values and bytes outside deleted ranges remain unchanged.
    let mut edits=Vec::new();let mut i=0;
    while i<members.len(){
        if !del.contains(&members[i].0){i+=1;continue;}
        let first=i;while i<members.len()&&del.contains(&members[i].0){i+=1;}
        let span=if i<members.len(){Span{begin:members[first].1,end:members[i].1}}
            else{if first==0{return Err(denied("FE01_EMPTY_MAP"));}
                Span{begin:members[first-1].2.end,end:members[i-1].2.end}};
        edits.push(replace(b,span,Vec::new())?);
    }
    let mut insert=Vec::new();
    for o in plan{let id=uint(&o["ID"])?;insert.extend_from_slice(format!(",\"{id}\":").as_bytes());insert.extend_from_slice(&enc(o)?);}
    insert.push(b'}');
    edits.push(replace(b,Span{begin:objs.end-1,end:objs.end},insert)?);
    edits.push(replace(b,counter,n4.to_string().into_bytes())?);
    Ok(edits)
}
impl ProductSession{
    pub fn stage_switch624_fence_fe01_archive(&self,e:WorkerEnvelope,plan:&[u8])->CoreResult<SemanticStageReceipt>{
        let build=&self.native_source_build;
        if build.platform!=Platform::Switch||build.build_kind!=BuildKind::SwitchBid||build.build_id!=BID||
           build.schema!=624||!build.externally_attested||self.worker_bound{return Err(denied("FE01_EXACT_SWITCH624_REQUIRED"));}
        let p=plan_parse(plan)?;
        let edits=collect(self,&p)?;
        self.commit_semantic_replacements(e,edits,7)
    }
}
#[cfg(test)]
mod tests{
    use super::*;
    fn build()->crate::BuildIdentity{crate::BuildIdentity{platform:Platform::Switch,build_kind:BuildKind::SwitchBid,
        build_id:BID.into(),schema:624,externally_attested:true}}
    fn doc()->Value{json!({"GameInfo":{"Version":624},"World":{"Ambient":{"keep":7},
        "GridCollection":{"DiffGrids":{},"Grids":{"9":{"ID":9,"TessellationFactor":2,"GridDefaultLayoutPath":"",
        "NextGridObjectID":50,"Objects":{"10":obj(10,BASE,40,20),"11":obj(11,OLD_EXT,40,22),
            "12":obj(12,BASE,40,34),"13":obj(13,BASE,40,36),
            "14":{"ID":14,"ItemID":40000001,"X":80,"Y":90,"Unknown":{"keep":7}}}}}}},
        "Player":{"ListInventories":{"0":{"Inventory":{"40700246":{"Amount":30,"Marker":"Keep"}}}}}})}
    fn open(d:&Value)->ProductSession{let b=enc(d).unwrap();let h=sha(&b);
        ProductSession::open_switch624_fe01_private(b,build(),h).unwrap()}
    fn scope(s:&ProductSession,a:WorkerAction)->WorkerEnvelope{let r=s.receipt().unwrap();
        WorkerEnvelope{contract:PRODUCT_WORKER_CONTRACT,session_id:r.session_id,expected_revision:r.revision,
            expected_index_generation:r.index_generation,expected_decoded_sha256:r.decoded_sha256,action:a}}
    fn plan(d:&Value)->Value{json!({"contract":"wand.private.switch624.fence-fe01-archive@1","layout":"PRESERVE_EXISTING",
        "sourceDecodedSha256":digest(&enc(d).unwrap()),"gridId":9,"expectedNextId":50,
        "gridSha256":digest(&enc(&d["World"]["GridCollection"]["Grids"]["9"]).unwrap()),
        "retainedIds":[10,13],"deletedIds":[11,12],"created":[obj(50,NEW_EXT,40,22),obj(51,BASE,40,26),
            obj(52,BASE,40,30),obj(53,NEW_EXT,40,32)]})}
    #[test]
    fn fe01_exact7_preserve_endpoints_player_undo_redo_one_time(){
        let d=doc();let s=open(&d);let p=plan(&d);let e=scope(&s,WorkerAction::Stage);
        let staged=s.stage_switch624_fence_fe01_archive(e,&enc(&p).unwrap()).unwrap();
        assert_eq!(staged.operation_count,7);assert!(!staged.product_writer_authorized);
        assert!(s.stage_switch624_fence_fe01_archive(e,&enc(&p).unwrap()).is_err());
        s.undo_typed_semantic_batch(scope(&s,WorkerAction::Stage)).unwrap();
        assert!(s.take_typed_semantic_decoded_once(scope(&s,WorkerAction::ExportEditedCopy)).is_err());
        s.redo_typed_semantic_batch(scope(&s,WorkerAction::Stage)).unwrap();
        let e=scope(&s,WorkerAction::ExportEditedCopy);let out=s.take_typed_semantic_decoded_once(e).unwrap();
        assert!(s.take_typed_semantic_decoded_once(e).is_err());
        let mut expected=d.clone();let g=&mut expected["World"]["GridCollection"]["Grids"]["9"];
        g["NextGridObjectID"]=json!(54);
        for id in ["11","12"]{g["Objects"].as_object_mut().unwrap().remove(id);}
        for o in p["created"].as_array().unwrap(){g["Objects"][o["ID"].as_u64().unwrap().to_string()]=o.clone();}
        assert_eq!(serde_json::from_slice::<Value>(&out).unwrap(),expected);
        assert_eq!(sha(&out),staged.staged_decoded_sha256);
    }
    #[test]
    fn fe01_nonadjacent_and_terminal_delete_preserve_other_raw_records(){
        // Lexical object order intentionally differs from canonical order.
        let d=doc();let mut raw=enc(&d).unwrap();
        let old=enc(&d["World"]["GridCollection"]["Grids"]["9"]["Objects"]).unwrap();
        let g=&d["World"]["GridCollection"]["Grids"]["9"]["Objects"];
        let alt=format!("{{ \"11\":{}, \"10\":{}, \"14\":{}, \"13\":{}, \"12\":{} }}",
            g["11"],g["10"],g["14"],g["13"],g["12"]).into_bytes();
        let at=raw.windows(old.len()).position(|x|x==old).unwrap();raw.splice(at..at+old.len(),alt);
        let h=sha(&raw);let s=ProductSession::open_switch624_fe01_private(raw,build(),h).unwrap();
        let mut p=plan(&d);p["sourceDecodedSha256"]=json!(digest(&s.decoded));
        let roots=indexed_read::roots(&s.decoded).unwrap();
        let gc=object_field(&s.decoded,roots.world,"GridCollection").unwrap();
        let grid=object_field(&s.decoded,object_field(&s.decoded,gc,"Grids").unwrap(),"9").unwrap();
        p["gridSha256"]=json!(digest(&s.decoded[grid.begin..grid.end]));
        s.stage_switch624_fence_fe01_archive(scope(&s,WorkerAction::Stage),&enc(&p).unwrap()).unwrap();
        let out=s.take_typed_semantic_decoded_once(scope(&s,WorkerAction::ExportEditedCopy)).unwrap();
        let v:Value=serde_json::from_slice(&out).unwrap();
        for k in ["10","13","14"]{assert_eq!(v["World"]["GridCollection"]["Grids"]["9"]["Objects"][k],g[k]);}
        assert_eq!(v["Player"],d["Player"]);
        assert!(out.windows(enc(&g["14"]).unwrap().len()).any(|w|w==enc(&g["14"]).unwrap()));
    }
    #[test]
    fn fe01_wrong_plan_shape_refund_overlay_collision_and_epoch_deny(){
        let d=doc();let s=open(&d);let p=plan(&d);let e=scope(&s,WorkerAction::Stage);
        for (k,v) in [("layout",json!("EXPLICIT_USER_LAYOUT")),("expectedNextId",json!(51)),
            ("sourceDecodedSha256",json!("bad")),("gridSha256",json!("bad")),("retainedIds",json!([10,10])),
            ("deletedIds",json!([11,13])),("created",json!([])),("refund",json!(1))]{
            let mut q=p.clone();q[k]=v;assert!(s.stage_switch624_fence_fe01_archive(e,&enc(&q).unwrap()).is_err());
        }
        assert!(open(&d).stage_switch624_fence_fe01_archive(e,&enc(&p).unwrap()).is_err());
        for kind in 0..4{
            let mut q=d.clone();let grid=&mut q["World"]["GridCollection"]["Grids"]["9"];
            match kind{0=>grid["Objects"]["11"]["State"]=json!({}),
                1=>{grid["Objects"]["14"]["X"]=json!(40);grid["Objects"]["14"]["Y"]=json!(28);},
                2=>grid["GridDefaultLayoutPath"]=json!("unknown"),
                _=>grid["Objects"]["14"]["ID"]=json!(50)}
            let t=open(&q);assert!(t.stage_switch624_fence_fe01_archive(scope(&t,WorkerAction::Stage),&enc(&plan(&q)).unwrap()).is_err());
        }
        assert_eq!(s.receipt().unwrap().revision,0);
    }
}

// ACT683: two explicit historical Fence layout operations. Both share the
// existing validated scanner, exact lexical map splice and semantic ledger.
// The supplied plan is CAS evidence, not proof of external rights/geometry.
#[derive(Clone,Copy)]
enum HistoricalFenceOp { Frp01, Fm01, Switch626Fm01 }
impl HistoricalFenceOp {
    fn contract(self)->&'static str{match self{
        Self::Frp01=>"wand.private.switch624.fence-frp01-archive@1",
        Self::Fm01=>"wand.private.switch624.fence-fm01-archive@1",
        Self::Switch626Fm01=>"wand.private.switch626.fence-fm01-layout@1",
    }}
    fn count(self)->usize{match self{Self::Frp01=>7,Self::Fm01|Self::Switch626Fm01=>8}}
}
const EXT1:u32=40700247;
const REPLACEMENT_BASE:u32=40700268;
const REPLACEMENT_EXT1:u32=40700269;
fn fence_record(id:u32,item:u32,x:u32,y:u32,left:bool,diagonal:bool)->Value{
    json!({"ID":id,"ItemID":item,"X":x,"Y":y,
        "Orientation":if left{"GridOrientation_Left"}else{"GridOrientation_Down"},
        "State":if diagonal{json!({"FenceMode":{"Diagonal":true}})}else{Value::Null}})
}
fn exact_ids(v:&Value,n:usize)->CoreResult<Vec<u32>>{
    let a=v.as_array().filter(|v|v.len()==n).ok_or(denied("FENCE_LAYOUT_IDS"))?;
    a.iter().map(uint).collect()
}
fn historical_plan_parse(bytes:&[u8],op:HistoricalFenceOp)->CoreResult<Value>{
    if bytes.is_empty()||bytes.len()>16384{return Err(denied("FENCE_LAYOUT_PLAN_BOUNDS"));}
    let v:Value=serde_json::from_slice(bytes).map_err(|_|denied("FENCE_LAYOUT_JSON"))?;
    if enc(&v)?.as_slice()!=bytes{return Err(denied("FENCE_LAYOUT_NONCANONICAL"));}
    let keys=["contract","layout","sourceDecodedSha256","gridId","expectedNextId","gridSha256",
        "retainedIds","deletedIds","created","inventoryEntrySha256"];
    let m=v.as_object().ok_or(denied("FENCE_LAYOUT_PLAN_OBJECT"))?;
    if m.len()!=keys.len()||!keys.iter().all(|k|m.contains_key(*k))||
       v["contract"]!=op.contract()||v["layout"]!="PRESERVE_EXISTING"{
        return Err(denied("FENCE_LAYOUT_PLAN_FIELDS"));
    }
    Ok(v)
}
fn historical_collect(s:&ProductSession,p:&Value,op:HistoricalFenceOp)->CoreResult<Vec<Replacement>>{
    let b=&s.decoded;
    if p["sourceDecodedSha256"]!=digest(b){return Err(denied("FENCE_LAYOUT_SOURCE_CAS"));}
    let g=uint(&p["gridId"])?;let next=uint(&p["expectedNextId"])?;
    let n3=next.checked_add(3).ok_or(denied("FENCE_LAYOUT_COUNTER_OVERFLOW"))?;
    let frp=matches!(op,HistoricalFenceOp::Frp01);
    let keep=exact_ids(&p["retainedIds"],if frp{0}else{1})?;
    let del=exact_ids(&p["deletedIds"],if frp{3}else{4})?;
    let ids:Vec<u32>=keep.iter().chain(del.iter()).copied().collect();
    if g==0||n3>i32::MAX as u32||ids.iter().any(|id|*id==0||*id>=next)||
       (0..ids.len()).any(|i|(i+1..ids.len()).any(|j|ids[i]==ids[j])){
        return Err(denied("FENCE_LAYOUT_ID_BOUNDS"));
    }
    let roots=indexed_read::roots(b)?;
    let gc=object_field(b,roots.world,"GridCollection")?;
    let grid=object_field(b,object_field(b,gc,"Grids")?,&g.to_string())?;
    if p["gridSha256"]!=digest(raw(b,grid)?)||num(b,grid,"ID")?!=g||
       num(b,grid,"TessellationFactor")?!=2||val(b,object_field(b,grid,"GridDefaultLayoutPath")?)?!=""{
        return Err(denied("FENCE_LAYOUT_GRID_CAS"));
    }
    let diffs=object_field(b,gc,"DiffGrids")?;
    let mut pos=diffs.begin+1;let mut count=0;
    while let Some((k,_))=next_object_member(b,diffs,&mut pos)?{
        count+=1;if count>50000||k==g.to_string(){return Err(denied("FENCE_LAYOUT_OVERLAY"));}
    }
    let counter=object_field(b,grid,"NextGridObjectID")?;
    if number(b,counter)?!=next as u64{return Err(denied("FENCE_LAYOUT_COUNTER_CAS"));}
    let objs=object_field(b,grid,"Objects")?;
    let mut pos=objs.begin+1;let mut members=Vec::new();let mut found=vec![None;ids.len()];
    loop{
        let start=indexed_read::skip_ws(b,pos);
        let Some((k,entry))=next_object_member(b,objs,&mut pos)? else{break};
        if members.len()>=250000{return Err(denied("FENCE_LAYOUT_OBJECT_BOUND"));}
        let id=k.parse::<u32>().map_err(|_|denied("FENCE_LAYOUT_OBJECT_KEY"))?;
        if id==0||id.to_string()!=k||id>=next||num(b,entry,"ID")?!=id{
            return Err(denied("FENCE_LAYOUT_OBJECT_ID"));
        }
        if let Some(i)=ids.iter().position(|x|*x==id){found[i]=Some(entry);}
        members.push((id,start,entry));
    }
    let old:Vec<Span>=found.into_iter().collect::<Option<Vec<_>>>().ok_or(denied("FENCE_LAYOUT_OLD_MISSING"))?;
    let x=num(b,old[0],"X")?;let y=num(b,old[0],"Y")?;
    let coord=|v:u32,d:u32|v.checked_add(d).filter(|v|*v<=i32::MAX as u32).ok_or(denied("FENCE_LAYOUT_COORD"));
    let x2=coord(x,2)?;let x4=coord(x,4)?;let y2=coord(y,2)?;let y4=coord(y,4)?;let y6=coord(y,6)?;
    let (expected,wanted,anchors)=if frp{
        (vec![fence_record(ids[0],BASE,x,y,false,false),fence_record(ids[1],EXT1,x,y2,true,false),
              fence_record(ids[2],BASE,x,y4,false,false)],
         vec![fence_record(next,REPLACEMENT_BASE,x,y,false,false),fence_record(next+1,REPLACEMENT_EXT1,x,y2,true,false),
              fence_record(next+2,REPLACEMENT_BASE,x,y4,false,false)],
         vec![(x,y),(x,y2),(x,y4)])
    }else{
        (vec![fence_record(ids[0],BASE,x,y,false,false),fence_record(ids[1],EXT1,x2,y,false,false),
              fence_record(ids[2],BASE,x4,y,false,false),fence_record(ids[3],EXT1,x4,y2,true,false),
              fence_record(ids[4],BASE,x4,y4,false,false)],
         vec![fence_record(next,EXT1,x,y2,true,false),fence_record(next+1,BASE,x,y4,false,false),
              fence_record(next+2,BASE,x2,y6,false,true)],
         vec![(x,y),(x2,y),(x4,y),(x4,y2),(x4,y4),(x,y2),(x,y4),(x2,y6)])
    };
    for (span,want) in old.iter().zip(expected.iter()){
        if val(b,*span)?!=*want{return Err(denied("FENCE_LAYOUT_OLD_SHAPE"));}
    }
    let plan=p["created"].as_array().ok_or(denied("FENCE_LAYOUT_CREATED"))?;
    if plan.as_slice()!=wanted.as_slice(){return Err(denied("FENCE_LAYOUT_PLAN_SHAPE"));}
    for (id,_,entry) in &members{
        if ids.contains(id){continue;}
        let ox=val(b,object_field(b,*entry,"X")?)?;let oy=val(b,object_field(b,*entry,"Y")?)?;
        let ox=ox.as_f64().filter(|v|v.is_finite()).ok_or(denied("FENCE_LAYOUT_COORD_TOKEN"))?;
        let oy=oy.as_f64().filter(|v|v.is_finite()).ok_or(denied("FENCE_LAYOUT_COORD_TOKEN"))?;
        if anchors.iter().any(|(a,c)|ox==*a as f64&&oy==*c as f64){
            return Err(denied("FENCE_LAYOUT_OCCUPIED_ANCHOR"));
        }
    }
    // Exact stored catalog witnesses only. Positive inventory is necessary
    // for the scoped historical layout but does not confer entitlement.
    let route=object_field(b,object_field(b,roots.player,"ListInventories")?,"0")?;
    let inv=object_field(b,route,"Inventory")?;
    let item_ids=if frp{vec![BASE,REPLACEMENT_BASE]}else{vec![BASE]};
    let hashes=p["inventoryEntrySha256"].as_object().filter(|m|m.len()==item_ids.len())
        .ok_or(denied("FENCE_LAYOUT_CATALOG_WITNESS"))?;
    for item in item_ids{
        inventory_route(b,route,0,item,"ItemType_Furniture")?;
        let key=item.to_string();let entry=object_field(b,inv,&key)?;
        let amount=num(b,entry,"Amount")?;
        if amount==0||amount as u64>MAX_CONSERVATIVE_AMOUNT||
           hashes.get(&key).and_then(Value::as_str)!=Some(digest(raw(b,entry)?).as_str()){
            return Err(denied("FENCE_LAYOUT_CATALOG_CAS"));
        }
    }
    layout_edits(b,&members,&del,objs,counter,n3,plan)
}
impl ProductSession{
    fn stage_historical_fence(&self,e:WorkerEnvelope,plan:&[u8],op:HistoricalFenceOp)->CoreResult<SemanticStageReceipt>{
        let build=&self.native_source_build;
        let current=matches!(op,HistoricalFenceOp::Switch626Fm01);
        let (bid,schema)=if current{("9A239D3DB569756D",626)}else{(BID,624)};
        if build.platform!=Platform::Switch||build.build_kind!=BuildKind::SwitchBid||build.build_id!=bid||
           build.schema!=schema||!build.externally_attested||self.worker_bound{
            return Err(denied(if current{"FM01_EXACT_SWITCH626_REQUIRED"}else{"FENCE_LAYOUT_EXACT_SWITCH624_REQUIRED"}));
        }
        let p=historical_plan_parse(plan,op)?;
        let edits=historical_collect(self,&p,op)?;
        self.commit_semantic_replacements(e,edits,op.count())
    }
    pub fn stage_switch624_fence_frp01_archive(&self,e:WorkerEnvelope,plan:&[u8])->CoreResult<SemanticStageReceipt>{
        self.stage_historical_fence(e,plan,HistoricalFenceOp::Frp01)
    }
    pub fn stage_switch626_fence_fm01_layout(&self,e:WorkerEnvelope,plan:&[u8])->CoreResult<SemanticStageReceipt>{
        self.stage_historical_fence(e,plan,HistoricalFenceOp::Switch626Fm01)
    }
    pub fn stage_switch624_fence_fm01_archive(&self,e:WorkerEnvelope,plan:&[u8])->CoreResult<SemanticStageReceipt>{
        self.stage_historical_fence(e,plan,HistoricalFenceOp::Fm01)
    }
}
#[cfg(test)]
mod historical_layout_tests{
    use super::*;
    fn fixture(frp:bool)->(Value,Value){
        let (old,created,retained,deleted)=if frp{
            (vec![fence_record(10,BASE,40,20,false,false),fence_record(11,EXT1,40,22,true,false),fence_record(12,BASE,40,24,false,false)],
             vec![fence_record(50,REPLACEMENT_BASE,40,20,false,false),fence_record(51,REPLACEMENT_EXT1,40,22,true,false),
             fence_record(52,REPLACEMENT_BASE,40,24,false,false)],json!([]),json!([10,11,12]))
        }else{
            (vec![fence_record(10,BASE,40,20,false,false),fence_record(11,EXT1,42,20,false,false),
             fence_record(12,BASE,44,20,false,false),fence_record(13,EXT1,44,22,true,false),fence_record(14,BASE,44,24,false,false)],
             vec![fence_record(50,EXT1,40,22,true,false),fence_record(51,BASE,40,24,false,false),
             fence_record(52,BASE,42,26,false,true)],json!([10]),json!([11,12,13,14]))
        };
        let mut objects=json!({"30":{"ID":30,"ItemID":40000001,"X":80,"Y":90,"Opaque":{"n":7}}});
        for o in old{let key=o["ID"].as_u64().unwrap().to_string();objects[key]=o;}
        let d=json!({"GameInfo":{"Version":624},"World":{"Ambient":{"opaque":8},"GridCollection":{"DiffGrids":{},
            "Grids":{"9":{"ID":9,"TessellationFactor":2,"GridDefaultLayoutPath":"","NextGridObjectID":50,"Objects":objects}}}},
            "Player":{"ListInventories":{"0":{"ID":0,"CompatibleItemType":"ItemType_Furniture",
            "CompatibleFurnitureTypes":{"List":["FurnitureItemType_Fence"]},"Inventory":{
            "40700246":{"Amount":30,"Marker":"Keep"},"40700268":{"Amount":22,"Marker":"Other"}}}}}});
        let mut p=json!({"contract":if frp{HistoricalFenceOp::Frp01.contract()}else{HistoricalFenceOp::Fm01.contract()},
            "layout":"PRESERVE_EXISTING","gridId":9,"expectedNextId":50,"retainedIds":retained,"deletedIds":deleted,
            "created":created,"inventoryEntrySha256":{}});
        bind(&d,&mut p,frp);
        (d,p)
    }
    fn bind(d:&Value,p:&mut Value,frp:bool){
        p["sourceDecodedSha256"]=json!(digest(&enc(d).unwrap()));
        p["gridSha256"]=json!(digest(&enc(&d["World"]["GridCollection"]["Grids"]["9"]).unwrap()));
        let inv=&d["Player"]["ListInventories"]["0"]["Inventory"];
        for item in if frp{vec![BASE,REPLACEMENT_BASE]}else{vec![BASE]}{
            let k=item.to_string();p["inventoryEntrySha256"][&k]=json!(digest(&enc(&inv[&k]).unwrap()));
        }
    }
    fn open(d:&Value)->ProductSession{
        let b=enc(d).unwrap();let h=sha(&b);
        ProductSession::open_switch624_fe01_private(b,crate::BuildIdentity{platform:Platform::Switch,
            build_kind:BuildKind::SwitchBid,build_id:BID.into(),schema:624,externally_attested:true},h).unwrap()
    }
    fn scope(s:&ProductSession,a:WorkerAction)->WorkerEnvelope{let r=s.receipt().unwrap();
        WorkerEnvelope{contract:PRODUCT_WORKER_CONTRACT,session_id:r.session_id,expected_revision:r.revision,
            expected_index_generation:r.index_generation,expected_decoded_sha256:r.decoded_sha256,action:a}}
    fn stage(s:&ProductSession,e:WorkerEnvelope,p:&Value,frp:bool)->CoreResult<SemanticStageReceipt>{
        if frp{s.stage_switch624_fence_frp01_archive(e,&enc(p).unwrap())}else{s.stage_switch624_fence_fm01_archive(e,&enc(p).unwrap())}
    }
    #[test]
    fn switch626_fm01_exact8_no_inventory_and_contract_denials(){
        let (old,mut p)=fixture(false);let mut d=old.clone();d["GameInfo"]["Version"]=json!(626);
        p["contract"]=json!(HistoricalFenceOp::Switch626Fm01.contract());bind(&d,&mut p,false);
        let make=|v:&Value|ProductSession::open_decoded_readonly(enc(v).unwrap(),crate::BuildIdentity{
            platform:Platform::Switch,build_kind:BuildKind::SwitchBid,build_id:"9A239D3DB569756D".into(),schema:626,externally_attested:true}).unwrap();
        let s=make(&d);let e=scope(&s,WorkerAction::Stage);let bytes=enc(&p).unwrap();
        assert!(s.stage_switch624_fence_fm01_archive(e,&bytes).is_err());
        assert!(s.stage_switch624_fence_frp01_archive(e,&bytes).is_err());
        let t=open(&old);assert!(t.stage_switch626_fence_fm01_layout(scope(&t,WorkerAction::Stage),&bytes).is_err());
        assert!(make(&d).stage_switch626_fence_fm01_layout(e,&bytes).is_err());
        for (k,v) in [("contract",json!(HistoricalFenceOp::Fm01.contract())),("layout",json!("EXPLICIT_USER_LAYOUT")),
            ("expectedNextId",json!(51)),("gridSha256",json!("bad")),("sourceDecodedSha256",json!("bad")),
            ("inventoryEntrySha256",json!({})),("retainedIds",json!([11])),("deletedIds",json!([11,12,13,13])),("refund",json!(1))]{
            let mut q=p.clone();q[k]=v;assert!(s.stage_switch626_fence_fm01_layout(e,&enc(&q).unwrap()).is_err());
        }
        let mut q=p.clone();q["created"][2]["State"]=Value::Null;
        assert!(s.stage_switch626_fence_fm01_layout(e,&enc(&q).unwrap()).is_err());
        let r=s.stage_switch626_fence_fm01_layout(e,&bytes).unwrap();
        assert_eq!(r.operation_count,8);assert_eq!(r.exact_field_changed_count,8);assert!(!r.product_writer_authorized);
        assert!(s.stage_switch626_fence_fm01_layout(e,&bytes).is_err());
        s.undo_typed_semantic_batch(scope(&s,WorkerAction::Stage)).unwrap();
        assert!(s.take_typed_semantic_decoded_once(scope(&s,WorkerAction::ExportEditedCopy)).is_err());
        s.redo_typed_semantic_batch(scope(&s,WorkerAction::Stage)).unwrap();
        let e=scope(&s,WorkerAction::ExportEditedCopy);let out=s.take_typed_semantic_decoded_once(e).unwrap();
        assert!(s.take_typed_semantic_decoded_once(e).is_err());
        let mut wanted=d.clone();let g=&mut wanted["World"]["GridCollection"]["Grids"]["9"];g["NextGridObjectID"]=json!(53);
        for id in p["deletedIds"].as_array().unwrap(){g["Objects"].as_object_mut().unwrap().remove(&id.as_u64().unwrap().to_string());}
        for o in p["created"].as_array().unwrap(){g["Objects"][o["ID"].as_u64().unwrap().to_string()]=o.clone();}
        assert_eq!(serde_json::from_slice::<Value>(&out).unwrap(),wanted);assert_eq!(sha(&out),r.staged_decoded_sha256);
    }
    #[test]
    fn frp7_and_fm8_isolated_exact_layout_no_inventory_or_ambient(){
        for frp in [true,false]{
            let (d,p)=fixture(frp);let s=open(&d);let e=scope(&s,WorkerAction::Stage);
            let r=stage(&s,e,&p,frp).unwrap();assert_eq!(r.operation_count,if frp{7}else{8});
            assert!(!r.product_writer_authorized);assert!(stage(&s,e,&p,frp).is_err());
            s.undo_typed_semantic_batch(scope(&s,WorkerAction::Stage)).unwrap();
            assert!(s.take_typed_semantic_decoded_once(scope(&s,WorkerAction::ExportEditedCopy)).is_err());
            s.redo_typed_semantic_batch(scope(&s,WorkerAction::Stage)).unwrap();
            let e=scope(&s,WorkerAction::ExportEditedCopy);let out=s.take_typed_semantic_decoded_once(e).unwrap();
            assert!(s.take_typed_semantic_decoded_once(e).is_err());
            let mut wanted=d.clone();let g=&mut wanted["World"]["GridCollection"]["Grids"]["9"];g["NextGridObjectID"]=json!(53);
            for id in p["deletedIds"].as_array().unwrap(){g["Objects"].as_object_mut().unwrap().remove(&id.as_u64().unwrap().to_string());}
            for o in p["created"].as_array().unwrap(){g["Objects"][o["ID"].as_u64().unwrap().to_string()]=o.clone();}
            assert_eq!(serde_json::from_slice::<Value>(&out).unwrap(),wanted);
            assert_eq!(sha(&out),r.staged_decoded_sha256);
        }
    }
    #[test]
    fn frp_fm_cross_contract_stale_bad_shape_catalog_and_collision_deny(){
        for frp in [true,false]{
            let (d,p)=fixture(frp);let s=open(&d);let e=scope(&s,WorkerAction::Stage);
            assert!(stage(&s,e,&p,!frp).is_err());
            assert!(stage(&open(&d),e,&p,frp).is_err());
            for (k,v) in [("layout",json!("EXPLICIT_USER_LAYOUT")),("expectedNextId",json!(51)),
                ("sourceDecodedSha256",json!("bad")),("gridSha256",json!("bad")),
                ("deletedIds",json!([10,10,10])),("created",json!([])),("refund",json!(1)),
                ("inventoryEntrySha256",json!({}))]{
                let mut q=p.clone();q[k]=v;assert!(stage(&s,e,&q,frp).is_err());
            }
            for i in 0..5{
                let mut d=d.clone();let mut p=p.clone();
                match i{
                    0=>d["World"]["GridCollection"]["Grids"]["9"]["Objects"]["11"]["State"]=json!({"Opaque":1}),
                    1=>{d["World"]["GridCollection"]["Grids"]["9"]["Objects"]["30"]["X"]=json!(40);
                        d["World"]["GridCollection"]["Grids"]["9"]["Objects"]["30"]["Y"]=json!(22);},
                    2=>d["World"]["GridCollection"]["DiffGrids"]["9"]=json!({}),
                    3=>d["Player"]["ListInventories"]["0"]["Inventory"]["40700246"]["Amount"]=json!(0),
                    _=>d["Player"]["ListInventories"]["0"]["CompatibleFurnitureTypes"]["List"]=json!(["FurnitureItemType_Default"]),
                }
                bind(&d,&mut p,frp);let t=open(&d);assert!(stage(&t,scope(&t,WorkerAction::Stage),&p,frp).is_err());
            }
            assert_eq!(s.receipt().unwrap().revision,0);
        }
    }
}

// ACT713: exact archived 01C shape validation only, no generic compiler.
// Standalone layout adds never debit/refund inventory or replace existing IDs.
#[derive(Clone,Copy)]
enum FenceAddShape { OrthoL, Diagonal90, OrthoT, DiagonalN3Positive, DiagonalN3Mirrored, DiagonalN6Positive, Switch626Fd01, Switch626Fd02, Switch626Fd03, Switch626OrthoL, Switch626Diagonal90, Switch626OrthoT }
impl FenceAddShape {
    fn contract(self)->&'static str{match self{
        Self::OrthoL=>"wand.private.switch624.fence-ortho-l-archive@1",
        Self::Diagonal90=>"wand.private.switch624.fence-diagonal90-archive@1",
        Self::OrthoT=>"wand.private.switch624.fence-ortho-t-archive@1",
        Self::DiagonalN3Positive=>"wand.private.switch624.fence-diagonal-n3-positive-archive@1",
        Self::DiagonalN3Mirrored=>"wand.private.switch624.fence-diagonal-n3-mirrored-archive@1",
        Self::DiagonalN6Positive=>"wand.private.switch624.fence-diagonal-n6-positive-archive@1",
        Self::Switch626Fd01=>"wand.private.switch626.fence-fd01-layout@1",
        Self::Switch626Fd02=>"wand.private.switch626.fence-fd02-layout@1",
        Self::Switch626Fd03=>"wand.private.switch626.fence-fd03-layout@1",
        Self::Switch626OrthoL=>"wand.private.switch626.fence-ortho-l-layout@1",
        Self::Switch626Diagonal90=>"wand.private.switch626.fence-diagonal90-layout@1",
        Self::Switch626OrthoT=>"wand.private.switch626.fence-ortho-t-layout@1",
    }}
    fn records(self)->u32{match self{Self::OrthoL|Self::Diagonal90|Self::Switch626OrthoL|Self::Switch626Diagonal90=>5,Self::OrthoT|Self::Switch626OrthoT=>7,Self::DiagonalN3Positive|Self::DiagonalN3Mirrored|Self::DiagonalN6Positive|Self::Switch626Fd01|Self::Switch626Fd02|Self::Switch626Fd03=>3}}
    fn descriptors(self)->&'static [(u32,i32,i32,bool,bool)]{match self{
        Self::OrthoL|Self::Switch626OrthoL=>&[(BASE,0,0,false,false),(EXT1,2,0,false,false),(BASE,4,0,false,false),
            (EXT1,4,2,true,false),(BASE,4,4,false,false)],
        Self::Diagonal90|Self::Switch626Diagonal90=>&[(BASE,0,0,false,true),(40700253,2,2,false,true),(BASE,4,4,false,true),
            (40700253,6,2,true,true),(BASE,8,0,false,true)],
        Self::OrthoT|Self::Switch626OrthoT=>&[(BASE,0,0,false,false),(EXT1,2,0,false,false),(BASE,4,0,false,false),
            (EXT1,6,0,false,false),(BASE,8,0,false,false),(EXT1,4,2,true,false),(BASE,4,4,false,false)],
        // ACT732 exact historical diagonal tranche A: N3 both slopes,
        // N6 positive single n4 extension, no inferred other lengths.
        Self::DiagonalN3Positive|Self::Switch626Fd01=>&[(BASE,0,0,false,true),(40700253,2,2,false,true),(BASE,4,4,false,true)],
        Self::DiagonalN3Mirrored|Self::Switch626Fd02=>&[(BASE,0,0,false,true),(40700253,2,-2,true,true),(BASE,4,-4,false,true)],
        Self::DiagonalN6Positive|Self::Switch626Fd03=>&[(BASE,0,0,false,true),(40700256,2,2,false,true),(BASE,10,10,false,true)],
    }}
}
fn add_plan_parse(bytes:&[u8],shape:FenceAddShape)->CoreResult<Value>{
    if bytes.is_empty()||bytes.len()>16384{return Err(denied("FENCE_ADD_PLAN_BOUNDS"));}
    let v:Value=serde_json::from_slice(bytes).map_err(|_|denied("FENCE_ADD_PLAN_JSON"))?;
    if enc(&v)?.as_slice()!=bytes{return Err(denied("FENCE_ADD_NONCANONICAL"));}
    let keys=["contract","layout","sourceDecodedSha256","gridId","expectedNextId","gridSha256",
        "created","inventoryEntrySha256"];
    let m=v.as_object().ok_or(denied("FENCE_ADD_PLAN_OBJECT"))?;
    if m.len()!=keys.len()||!keys.iter().all(|k|m.contains_key(*k))||
       v["contract"]!=shape.contract()||v["layout"]!="PRESERVE_EXISTING"{
        return Err(denied("FENCE_ADD_PLAN_FIELDS"));
    }
    Ok(v)
}
fn add_wanted(shape:FenceAddShape,next:u32,x:u32,y:u32)->CoreResult<Vec<Value>>{
    let coord=|v:u32,d:i32|i64::from(v).checked_add(i64::from(d))
        .filter(|n|*n>=0&&*n<=i64::from(i32::MAX)).map(|n|n as u32).ok_or(denied("FENCE_ADD_COORD_BOUND"));
    shape.descriptors().iter().enumerate().map(|(i,(item,dx,dy,left,diag))|
        Ok(fence_record(next.checked_add(i as u32).ok_or(denied("FENCE_ADD_COUNTER_OVERFLOW"))?,
            *item,coord(x,*dx)?,coord(y,*dy)?,*left,*diag))).collect()
}
fn add_collect(s:&ProductSession,p:&Value,shape:FenceAddShape)->CoreResult<Vec<Replacement>>{
    let b=&s.decoded;
    if p["sourceDecodedSha256"]!=digest(b){return Err(denied("FENCE_ADD_SOURCE_CAS"));}
    let g=uint(&p["gridId"])?;let next=uint(&p["expectedNextId"])?;
    let end=next.checked_add(shape.records()).ok_or(denied("FENCE_ADD_COUNTER_OVERFLOW"))?;
    if g==0||next==0||end>i32::MAX as u32{return Err(denied("FENCE_ADD_ID_BOUNDS"));}
    let plan=p["created"].as_array().filter(|a|a.len()==shape.records() as usize).ok_or(denied("FENCE_ADD_CREATED"))?;
    let wanted=add_wanted(shape,next,uint(&plan[0]["X"])?,uint(&plan[0]["Y"])?)?;
    if plan.as_slice()!=wanted.as_slice(){return Err(denied("FENCE_ADD_EXACT_SHAPE"));}
    let anchors:Vec<(u32,u32)>=wanted.iter().map(|o|Ok((uint(&o["X"])?,uint(&o["Y"])?)))
        .collect::<CoreResult<_>>()?;
    let roots=indexed_read::roots(b)?;
    let gc=object_field(b,roots.world,"GridCollection")?;
    let grid=object_field(b,object_field(b,gc,"Grids")?,&g.to_string())?;
    if p["gridSha256"]!=digest(raw(b,grid)?)||num(b,grid,"ID")?!=g||
       num(b,grid,"TessellationFactor")?!=2||val(b,object_field(b,grid,"GridDefaultLayoutPath")?)?!=""{
        return Err(denied("FENCE_ADD_GRID_CAS"));
    }
    let diffs=object_field(b,gc,"DiffGrids")?;
    let mut pos=diffs.begin+1;let mut count=0;
    while let Some((k,_))=next_object_member(b,diffs,&mut pos)?{
        count+=1;if count>50000||k==g.to_string(){return Err(denied("FENCE_ADD_OVERLAY"));}
    }
    let counter=object_field(b,grid,"NextGridObjectID")?;
    if number(b,counter)?!=next as u64{return Err(denied("FENCE_ADD_COUNTER_CAS"));}
    let objs=object_field(b,grid,"Objects")?;
    let mut pos=objs.begin+1;let mut count=0usize;
    while let Some((k,entry))=next_object_member(b,objs,&mut pos)?{
        count+=1;if count>250000{return Err(denied("FENCE_ADD_OBJECT_BOUND"));}
        let id=k.parse::<u32>().map_err(|_|denied("FENCE_ADD_OBJECT_KEY"))?;
        if id==0||id.to_string()!=k||id>=next||num(b,entry,"ID")?!=id{
            return Err(denied("FENCE_ADD_OBJECT_ID"));
        }
        let ox=val(b,object_field(b,entry,"X")?)?.as_f64().filter(|v|v.is_finite()).ok_or(denied("FENCE_ADD_COORD_TOKEN"))?;
        let oy=val(b,object_field(b,entry,"Y")?)?.as_f64().filter(|v|v.is_finite()).ok_or(denied("FENCE_ADD_COORD_TOKEN"))?;
        if anchors.iter().any(|(x,y)|ox==*x as f64&&oy==*y as f64){return Err(denied("FENCE_ADD_OCCUPIED_ANCHOR"));}
    }
    // Existing lexical append uses a leading comma. Scope is the nonempty
    // archived direct grid; actual full footprint/rights are external gates.
    if count==0{return Err(denied("FENCE_ADD_EMPTY_GRID"));}
    let route=object_field(b,object_field(b,roots.player,"ListInventories")?,"0")?;
    inventory_route(b,route,0,BASE,"ItemType_Furniture")?;
    let entry=object_field(b,object_field(b,route,"Inventory")?,&BASE.to_string())?;
    let amount=num(b,entry,"Amount")?;
    if amount==0||amount as u64>MAX_CONSERVATIVE_AMOUNT||p["inventoryEntrySha256"]!=digest(raw(b,entry)?){
        return Err(denied("FENCE_ADD_CATALOG_CAS"));
    }
    layout_edits(b,&[],&[],objs,counter,end,plan)
}
impl ProductSession{
    fn stage_fence_add(&self,e:WorkerEnvelope,plan:&[u8],shape:FenceAddShape)->CoreResult<SemanticStageReceipt>{
        let build=&self.native_source_build;
        // ACT775/835/839: only the independently evidenced FD01/02/03
        // descriptors are transferred. Every archived shape retains its 624 gate.
        let current=matches!(shape,FenceAddShape::Switch626Fd01|FenceAddShape::Switch626Fd02|FenceAddShape::Switch626Fd03|FenceAddShape::Switch626OrthoL|FenceAddShape::Switch626Diagonal90|FenceAddShape::Switch626OrthoT);
        let exact=if current{build.build_id=="9A239D3DB569756D"&&build.schema==626}
            else{build.build_id==BID&&build.schema==624};
        if build.platform!=Platform::Switch||build.build_kind!=BuildKind::SwitchBid||
           !exact||!build.externally_attested||self.worker_bound{
            return Err(denied(match shape{FenceAddShape::Switch626Fd01=>"FENCE_FD01_EXACT_SWITCH626_REQUIRED",FenceAddShape::Switch626Fd02=>"FENCE_FD02_EXACT_SWITCH626_REQUIRED",FenceAddShape::Switch626Fd03=>"FENCE_FD03_EXACT_SWITCH626_REQUIRED",FenceAddShape::Switch626OrthoL|FenceAddShape::Switch626Diagonal90|FenceAddShape::Switch626OrthoT=>"FENCE_NONSTRAIGHT_EXACT_SWITCH626_REQUIRED",_=>"FENCE_ADD_EXACT_SWITCH624_REQUIRED"}));
        }
        let p=add_plan_parse(plan,shape)?;
        let edits=add_collect(self,&p,shape)?;
        self.commit_semantic_replacements(e,edits,shape.records() as usize+1)
    }
    pub fn stage_switch626_fence_ortho_l_layout(&self,e:WorkerEnvelope,plan:&[u8])->CoreResult<SemanticStageReceipt>{
        self.stage_fence_add(e,plan,FenceAddShape::Switch626OrthoL)
    }
    pub fn stage_switch626_fence_diagonal90_layout(&self,e:WorkerEnvelope,plan:&[u8])->CoreResult<SemanticStageReceipt>{
        self.stage_fence_add(e,plan,FenceAddShape::Switch626Diagonal90)
    }
    pub fn stage_switch626_fence_ortho_t_layout(&self,e:WorkerEnvelope,plan:&[u8])->CoreResult<SemanticStageReceipt>{
        self.stage_fence_add(e,plan,FenceAddShape::Switch626OrthoT)
    }
    pub fn stage_switch626_fence_fd02_layout(&self,e:WorkerEnvelope,plan:&[u8])->CoreResult<SemanticStageReceipt>{
        self.stage_fence_add(e,plan,FenceAddShape::Switch626Fd02)
    }
    pub fn stage_switch626_fence_fd03_layout(&self,e:WorkerEnvelope,plan:&[u8])->CoreResult<SemanticStageReceipt>{
        self.stage_fence_add(e,plan,FenceAddShape::Switch626Fd03)
    }
    pub fn stage_switch626_fence_fd01_layout(&self,e:WorkerEnvelope,plan:&[u8])->CoreResult<SemanticStageReceipt>{
        self.stage_fence_add(e,plan,FenceAddShape::Switch626Fd01)
    }
    pub fn stage_switch624_fence_ortho_l_archive(&self,e:WorkerEnvelope,plan:&[u8])->CoreResult<SemanticStageReceipt>{
        self.stage_fence_add(e,plan,FenceAddShape::OrthoL)
    }
    pub fn stage_switch624_fence_diagonal90_archive(&self,e:WorkerEnvelope,plan:&[u8])->CoreResult<SemanticStageReceipt>{
        self.stage_fence_add(e,plan,FenceAddShape::Diagonal90)
    }
    pub fn stage_switch624_fence_ortho_t_archive(&self,e:WorkerEnvelope,plan:&[u8])->CoreResult<SemanticStageReceipt>{
        self.stage_fence_add(e,plan,FenceAddShape::OrthoT)
    }
    pub fn stage_switch624_fence_diagonal_n3_positive_archive(&self,e:WorkerEnvelope,plan:&[u8])->CoreResult<SemanticStageReceipt>{
        self.stage_fence_add(e,plan,FenceAddShape::DiagonalN3Positive)
    }
    pub fn stage_switch624_fence_diagonal_n3_mirrored_archive(&self,e:WorkerEnvelope,plan:&[u8])->CoreResult<SemanticStageReceipt>{
        self.stage_fence_add(e,plan,FenceAddShape::DiagonalN3Mirrored)
    }
    pub fn stage_switch624_fence_diagonal_n6_positive_archive(&self,e:WorkerEnvelope,plan:&[u8])->CoreResult<SemanticStageReceipt>{
        self.stage_fence_add(e,plan,FenceAddShape::DiagonalN6Positive)
    }
}
#[cfg(test)]
mod add_tests{
    use super::*;
    fn fixture(shape:FenceAddShape)->(Value,Value){
        let d=json!({"GameInfo":{"Version":624},"World":{"Ambient":{"keep":7},
            "GridCollection":{"DiffGrids":{},"Grids":{"9":{"ID":9,"TessellationFactor":2,
            "GridDefaultLayoutPath":"","NextGridObjectID":50,"Objects":{"12":{"ID":12,"ItemID":40000001,
            "X":80,"Y":90,"Opaque":{"k":7}}}}}}},
            "Player":{"ListInventories":{"0":{"ID":0,"CompatibleItemType":"ItemType_Furniture",
            "CompatibleFurnitureTypes":{"List":["FurnitureItemType_Fence"]},
            "Inventory":{"40700246":{"Amount":30,"Marker":"Keep","Unknown":8}}}}}});
        let mut p=json!({"contract":shape.contract(),"layout":"PRESERVE_EXISTING","gridId":9,
            "expectedNextId":50,"created":add_wanted(shape,50,40,20).unwrap()});
        bind(&d,&mut p);(d,p)
    }
    fn bind(d:&Value,p:&mut Value){
        p["sourceDecodedSha256"]=json!(digest(&enc(d).unwrap()));
        p["gridSha256"]=json!(digest(&enc(&d["World"]["GridCollection"]["Grids"]["9"]).unwrap()));
        p["inventoryEntrySha256"]=json!(digest(&enc(&d["Player"]["ListInventories"]["0"]["Inventory"]["40700246"]).unwrap()));
    }
    fn open(d:&Value)->ProductSession{let b=enc(d).unwrap();let h=sha(&b);
        ProductSession::open_switch624_fe01_private(b,crate::BuildIdentity{platform:Platform::Switch,
            build_kind:BuildKind::SwitchBid,build_id:BID.into(),schema:624,externally_attested:true},h).unwrap()}
    fn scope(s:&ProductSession,a:WorkerAction)->WorkerEnvelope{let r=s.receipt().unwrap();
        WorkerEnvelope{contract:PRODUCT_WORKER_CONTRACT,session_id:r.session_id,expected_revision:r.revision,
            expected_index_generation:r.index_generation,expected_decoded_sha256:r.decoded_sha256,action:a}}
    const SHAPES:[FenceAddShape;3]=[FenceAddShape::OrthoL,FenceAddShape::Diagonal90,FenceAddShape::OrthoT];
    #[test]
    fn nonstraight_exact6_6_8_layout_only_undo_redo_export(){
        for shape in SHAPES{
            let (d,p)=fixture(shape);let s=open(&d);let e=scope(&s,WorkerAction::Stage);
            let r=s.stage_fence_add(e,&enc(&p).unwrap(),shape).unwrap();
            assert_eq!(r.operation_count,shape.records() as usize+1);assert!(!r.product_writer_authorized);
            assert!(s.stage_fence_add(e,&enc(&p).unwrap(),shape).is_err());
            s.undo_typed_semantic_batch(scope(&s,WorkerAction::Stage)).unwrap();
            assert!(s.take_typed_semantic_decoded_once(scope(&s,WorkerAction::ExportEditedCopy)).is_err());
            s.redo_typed_semantic_batch(scope(&s,WorkerAction::Stage)).unwrap();
            let e=scope(&s,WorkerAction::ExportEditedCopy);let out=s.take_typed_semantic_decoded_once(e).unwrap();
            assert!(s.take_typed_semantic_decoded_once(e).is_err());
            let mut expected=d.clone();let g=&mut expected["World"]["GridCollection"]["Grids"]["9"];
            g["NextGridObjectID"]=json!(50+shape.records());
            for o in p["created"].as_array().unwrap(){g["Objects"][o["ID"].as_u64().unwrap().to_string()]=o.clone();}
            assert_eq!(serde_json::from_slice::<Value>(&out).unwrap(),expected);
            assert_eq!(sha(&out),r.staged_decoded_sha256);
        }
    }
    #[test]
    fn nonstraight_contract_shape_catalog_collision_and_epoch_deny(){
        for shape in SHAPES{
            let (d,p)=fixture(shape);let s=open(&d);let e=scope(&s,WorkerAction::Stage);
            assert!(open(&d).stage_fence_add(e,&enc(&p).unwrap(),shape).is_err());
            for (k,v) in [("layout",json!("EXPLICIT_USER_LAYOUT")),("contract",json!("wrong")),
                ("expectedNextId",json!(51)),("sourceDecodedSha256",json!("bad")),("gridSha256",json!("bad")),
                ("inventoryEntrySha256",json!("bad")),("created",json!([])),("refund",json!(1))]{
                let mut q=p.clone();q[k]=v;assert!(s.stage_fence_add(e,&enc(&q).unwrap(),shape).is_err());
            }
            for i in 0..7{
                let mut d=d.clone();let mut q=p.clone();
                match i{
                    0=>{d["World"]["GridCollection"]["Grids"]["9"]["Objects"]["12"]["X"]=json!(40);
                        d["World"]["GridCollection"]["Grids"]["9"]["Objects"]["12"]["Y"]=json!(20);},
                    1=>d["World"]["GridCollection"]["DiffGrids"]["9"]=json!({}),
                    2=>d["World"]["GridCollection"]["Grids"]["9"]["GridDefaultLayoutPath"]=json!("unknown"),
                    3=>d["Player"]["ListInventories"]["0"]["Inventory"]["40700246"]["Amount"]=json!(0),
                    4=>q["created"][1]["Orientation"]=json!("GridOrientation_Up"),
                    5=>q["created"][1]["Opaque"]=json!(true),
                    _=>q["created"][1]["ID"]=json!(50),
                }
                bind(&d,&mut q);let t=open(&d);assert!(t.stage_fence_add(scope(&t,WorkerAction::Stage),&enc(&q).unwrap(),shape).is_err());
            }
            assert_eq!(s.receipt().unwrap().revision,0);
        }
    }
    const DIAG_A:[FenceAddShape;3]=[FenceAddShape::DiagonalN3Positive,FenceAddShape::DiagonalN3Mirrored,
        FenceAddShape::DiagonalN6Positive];
    #[test]
    fn diagonal_tranche_a_exact4_independent_descriptors_and_ledger(){
        // Independent explicit descriptor expectations, not generated by add_wanted.
        let want=[
            vec![fence_record(50,BASE,40,20,false,true),fence_record(51,40700253,42,22,false,true),fence_record(52,BASE,44,24,false,true)],
            vec![fence_record(50,BASE,40,20,false,true),fence_record(51,40700253,42,18,true,true),fence_record(52,BASE,44,16,false,true)],
            vec![fence_record(50,BASE,40,20,false,true),fence_record(51,40700256,42,22,false,true),fence_record(52,BASE,50,30,false,true)]];
        for (i,shape) in DIAG_A.iter().copied().enumerate(){
            let (d,mut p)=fixture(shape);p["created"]=json!(want[i]);
            let s=open(&d);let e=scope(&s,WorkerAction::Stage);
            let r=s.stage_fence_add(e,&enc(&p).unwrap(),shape).unwrap();
            assert_eq!(r.operation_count,4);assert!(!r.product_writer_authorized);
            assert!(s.stage_fence_add(e,&enc(&p).unwrap(),shape).is_err());
            s.undo_typed_semantic_batch(scope(&s,WorkerAction::Stage)).unwrap();
            assert!(s.take_typed_semantic_decoded_once(scope(&s,WorkerAction::ExportEditedCopy)).is_err());
            s.redo_typed_semantic_batch(scope(&s,WorkerAction::Stage)).unwrap();
            let e=scope(&s,WorkerAction::ExportEditedCopy);let out=s.take_typed_semantic_decoded_once(e).unwrap();
            assert!(s.take_typed_semantic_decoded_once(e).is_err());
            let mut expected=d.clone();let g=&mut expected["World"]["GridCollection"]["Grids"]["9"];
            g["NextGridObjectID"]=json!(53);
            for o in &want[i]{g["Objects"][o["ID"].as_u64().unwrap().to_string()]=o.clone();}
            assert_eq!(serde_json::from_slice::<Value>(&out).unwrap(),expected);
            assert_eq!(sha(&out),r.staged_decoded_sha256);
        }
    }
    #[test]
    fn diagonal_tranche_a_reject_cross_shape_ext_slope_state_underflow_and_collision(){
        for (i,shape) in DIAG_A.iter().copied().enumerate(){
            let (d,p)=fixture(shape);let s=open(&d);let e=scope(&s,WorkerAction::Stage);
            assert!(s.stage_fence_add(e,&enc(&p).unwrap(),DIAG_A[(i+1)%3]).is_err());
            assert!(open(&d).stage_fence_add(e,&enc(&p).unwrap(),shape).is_err());
            for k in 0..10{
                let mut q=p.clone();let mut d=d.clone();
                match k{
                    0=>q["created"][1]["ItemID"]=json!(40700247),
                    1=>q["created"][1]["Orientation"]=json!("GridOrientation_Up"),
                    2=>q["created"][2]["State"]=Value::Null,
                    3=>q["created"][2]["X"]=json!(46),
                    4=>q["created"][1]["State"]["FenceMode"]["Opaque"]=json!(1),
                    5=>q["created"][2]["ID"]=json!(51),
                    6=>q["created"][0]["Y"]=json!(0),
                    7=>{d["World"]["GridCollection"]["Grids"]["9"]["Objects"]["12"]["X"]=q["created"][2]["X"].clone();
                        d["World"]["GridCollection"]["Grids"]["9"]["Objects"]["12"]["Y"]=q["created"][2]["Y"].clone();},
                    8=>d["Player"]["ListInventories"]["0"]["Inventory"]["40700246"]["Amount"]=json!(0),
                    _=>d["World"]["GridCollection"]["DiffGrids"]["9"]=json!({}),
                }
                bind(&d,&mut q);let t=open(&d);assert!(t.stage_fence_add(scope(&t,WorkerAction::Stage),&enc(&q).unwrap(),shape).is_err());
            }
            assert_eq!(s.receipt().unwrap().revision,0);
        }
        assert!(add_wanted(FenceAddShape::DiagonalN3Mirrored,50,40,3).is_err());
        assert!(add_wanted(FenceAddShape::DiagonalN6Positive,50,i32::MAX as u32-9,20).is_err());
    }

    fn current_fd_stage(s:&ProductSession,e:WorkerEnvelope,p:&[u8],fd03:bool)->CoreResult<SemanticStageReceipt>{
        if fd03{s.stage_switch626_fence_fd03_layout(e,p)}else{s.stage_switch626_fence_fd02_layout(e,p)}
    }
    #[test]
    fn switch626_fd02_fd03_exact_four_and_independent_denials(){
        for fd03 in [false,true]{
            let shape=if fd03{FenceAddShape::Switch626Fd03}else{FenceAddShape::Switch626Fd02};
            let (mut d,mut p)=fixture(shape);
            d["GameInfo"]["Version"]=json!(626);
            let wanted=if fd03{
                vec![fence_record(50,BASE,40,20,false,true),fence_record(51,40700256,42,22,false,true),fence_record(52,BASE,50,30,false,true)]
            }else{
                vec![fence_record(50,BASE,40,20,false,true),fence_record(51,40700253,42,18,true,true),fence_record(52,BASE,44,16,false,true)]
            };
            p["created"]=json!(wanted);bind(&d,&mut p);
            let s=open626(&d);let e=scope(&s,WorkerAction::Stage);
            let bytes=enc(&p).unwrap();
            assert!(current_fd_stage(&s,e,&bytes,!fd03).is_err());
            assert!(s.stage_switch626_fence_fd01_layout(e,&bytes).is_err());
            let (old,_)=fixture(shape);let old=open(&old);
            assert!(current_fd_stage(&old,scope(&old,WorkerAction::Stage),&bytes,fd03).is_err());
            let other=open626(&d);
            assert!(current_fd_stage(&other,e,&bytes,fd03).is_err());
            for (k,v) in [("sourceDecodedSha256",json!("bad")),("gridSha256",json!("bad")),("inventoryEntrySha256",json!("bad")),("expectedNextId",json!(51)),("layout",json!("EXPLICIT_USER_LAYOUT"))]{
                let mut q=p.clone();q[k]=v;assert!(current_fd_stage(&s,e,&enc(&q).unwrap(),fd03).is_err());
            }
            let mut q=p.clone();q["created"][1]["Orientation"]=json!("GridOrientation_Up");
            assert!(current_fd_stage(&s,e,&enc(&q).unwrap(),fd03).is_err());
            let mut q=p.clone();q["created"][1]["ItemID"]=json!(if fd03{40700253}else{40700256});
            assert!(current_fd_stage(&s,e,&enc(&q).unwrap(),fd03).is_err());
            assert_eq!(s.receipt().unwrap().revision,0);
            let r=current_fd_stage(&s,e,&bytes,fd03).unwrap();
            assert_eq!(r.operation_count,4);assert!(!r.product_writer_authorized);
            assert!(current_fd_stage(&s,e,&bytes,fd03).is_err());
            s.undo_typed_semantic_batch(scope(&s,WorkerAction::Stage)).unwrap();
            assert!(s.take_typed_semantic_decoded_once(scope(&s,WorkerAction::ExportEditedCopy)).is_err());
            s.redo_typed_semantic_batch(scope(&s,WorkerAction::Stage)).unwrap();
            let e=scope(&s,WorkerAction::ExportEditedCopy);let out=s.take_typed_semantic_decoded_once(e).unwrap();
            assert!(s.take_typed_semantic_decoded_once(e).is_err());
            let mut expected=d.clone();let g=&mut expected["World"]["GridCollection"]["Grids"]["9"];
            g["NextGridObjectID"]=json!(53);
            for o in wanted{let id=o["ID"].as_u64().unwrap().to_string();g["Objects"][id]=o;}
            assert_eq!(serde_json::from_slice::<Value>(&out).unwrap(),expected);
            assert_eq!(sha(&out),r.staged_decoded_sha256);
        }
    }
    #[test]
    fn switch626_nonstraight_exact_6_6_8_separate_contracts(){
        let shapes=[FenceAddShape::Switch626OrthoL,FenceAddShape::Switch626Diagonal90,FenceAddShape::Switch626OrthoT];
        let old=[FenceAddShape::OrthoL,FenceAddShape::Diagonal90,FenceAddShape::OrthoT];
        let stage=|s:&ProductSession,e:WorkerEnvelope,p:&[u8],i:usize|match i{
            0=>s.stage_switch626_fence_ortho_l_layout(e,p),
            1=>s.stage_switch626_fence_diagonal90_layout(e,p),
            _=>s.stage_switch626_fence_ortho_t_layout(e,p),
        };
        let wanted=[
            vec![fence_record(50,BASE,40,20,false,false),fence_record(51,EXT1,42,20,false,false),fence_record(52,BASE,44,20,false,false),fence_record(53,EXT1,44,22,true,false),fence_record(54,BASE,44,24,false,false)],
            vec![fence_record(50,BASE,40,20,false,true),fence_record(51,40700253,42,22,false,true),fence_record(52,BASE,44,24,false,true),fence_record(53,40700253,46,22,true,true),fence_record(54,BASE,48,20,false,true)],
            vec![fence_record(50,BASE,40,20,false,false),fence_record(51,EXT1,42,20,false,false),fence_record(52,BASE,44,20,false,false),fence_record(53,EXT1,46,20,false,false),fence_record(54,BASE,48,20,false,false),fence_record(55,EXT1,44,22,true,false),fence_record(56,BASE,44,24,false,false)]
        ];
        for i in 0..3{
            let (mut d,mut p)=fixture(shapes[i]);d["GameInfo"]["Version"]=json!(626);
            p["created"]=json!(wanted[i]);bind(&d,&mut p);
            let s=open626(&d);let e=scope(&s,WorkerAction::Stage);let bytes=enc(&p).unwrap();
            for j in 0..3{if i!=j{assert!(stage(&s,e,&bytes,j).is_err());}}
            let (old_doc,_)=fixture(old[i]);let old_s=open(&old_doc);
            assert!(stage(&old_s,scope(&old_s,WorkerAction::Stage),&bytes,i).is_err());
            assert!(open626(&d).stage_fence_add(e,&bytes,shapes[i]).is_err());
            assert!(s.stage_fence_add(e,&bytes,old[i]).is_err());
            for (k,v) in [("sourceDecodedSha256",json!("bad")),("gridSha256",json!("bad")),
                ("inventoryEntrySha256",json!("bad")),("expectedNextId",json!(51)),("layout",json!("EXPLICIT_USER_LAYOUT"))]{
                let mut q=p.clone();q[k]=v;assert!(stage(&s,e,&enc(&q).unwrap(),i).is_err());
            }
            let mut q=p.clone();q["created"][1]["Orientation"]=json!("GridOrientation_Up");
            assert!(stage(&s,e,&enc(&q).unwrap(),i).is_err());
            let mut q=p.clone();q["created"][1]["ItemID"]=json!(40000001);
            assert!(stage(&s,e,&enc(&q).unwrap(),i).is_err());
            assert_eq!(s.receipt().unwrap().revision,0);
            let r=stage(&s,e,&bytes,i).unwrap();
            let n=if i==2{8}else{6};
            assert_eq!(r.operation_count,n);assert_eq!(r.exact_field_changed_count,n);
            assert!(!r.product_writer_authorized);
            assert!(stage(&s,e,&bytes,i).is_err());
            s.undo_typed_semantic_batch(scope(&s,WorkerAction::Stage)).unwrap();
            assert!(s.take_typed_semantic_decoded_once(scope(&s,WorkerAction::ExportEditedCopy)).is_err());
            s.redo_typed_semantic_batch(scope(&s,WorkerAction::Stage)).unwrap();
            let e=scope(&s,WorkerAction::ExportEditedCopy);let out=s.take_typed_semantic_decoded_once(e).unwrap();
            assert!(s.take_typed_semantic_decoded_once(e).is_err());
            let mut expected=d.clone();let g=&mut expected["World"]["GridCollection"]["Grids"]["9"];
            g["NextGridObjectID"]=json!(50+shapes[i].records());
            for o in &wanted[i]{let id=o["ID"].as_u64().unwrap().to_string();g["Objects"][id]=o.clone();}
            assert_eq!(serde_json::from_slice::<Value>(&out).unwrap(),expected);assert_eq!(sha(&out),r.staged_decoded_sha256);
        }
    }
    fn fd01_fixture()->(Value,Value){
        let (mut d,mut p)=fixture(FenceAddShape::Switch626Fd01);
        d["GameInfo"]["Version"]=json!(626);
        bind(&d,&mut p);(d,p)
    }
    fn open626(d:&Value)->ProductSession{
        ProductSession::open_decoded_readonly(enc(d).unwrap(),crate::BuildIdentity{
            platform:Platform::Switch,build_kind:BuildKind::SwitchBid,build_id:"9A239D3DB569756D".into(),
            schema:626,externally_attested:true}).unwrap()
    }
    #[test]
    fn switch626_fd01_exact4_reuses_descriptor_and_ledger(){
        let (d,p)=fd01_fixture();let s=open626(&d);let e=scope(&s,WorkerAction::Stage);
        let r=s.stage_switch626_fence_fd01_layout(e,&enc(&p).unwrap()).unwrap();
        assert_eq!(r.operation_count,4);assert_eq!(r.exact_field_changed_count,4);
        assert!(!r.product_writer_authorized);assert!(r.applied);
        assert!(s.stage_switch626_fence_fd01_layout(e,&enc(&p).unwrap()).is_err());
        s.undo_typed_semantic_batch(scope(&s,WorkerAction::Stage)).unwrap();
        assert!(s.take_typed_semantic_decoded_once(scope(&s,WorkerAction::ExportEditedCopy)).is_err());
        s.redo_typed_semantic_batch(scope(&s,WorkerAction::Stage)).unwrap();
        let e=scope(&s,WorkerAction::ExportEditedCopy);let out=s.take_typed_semantic_decoded_once(e).unwrap();
        assert!(s.take_typed_semantic_decoded_once(e).is_err());
        let mut wanted=d.clone();let g=&mut wanted["World"]["GridCollection"]["Grids"]["9"];
        g["NextGridObjectID"]=json!(53);
        for o in [fence_record(50,BASE,40,20,false,true),fence_record(51,40700253,42,22,false,true),
            fence_record(52,BASE,44,24,false,true)]{
            let key=o["ID"].as_u64().unwrap().to_string();g["Objects"][key]=o;
        }
        assert_eq!(serde_json::from_slice::<Value>(&out).unwrap(),wanted);
        assert_eq!(sha(&out),r.staged_decoded_sha256);
    }
    #[test]
    fn switch626_fd01_denies_cross_build_shape_stale_and_changed_catalog(){
        let (d,p)=fd01_fixture();let s=open626(&d);let e=scope(&s,WorkerAction::Stage);
        let (old,old_plan)=fixture(FenceAddShape::DiagonalN3Positive);let t=open(&old);
        assert!(t.stage_switch626_fence_fd01_layout(scope(&t,WorkerAction::Stage),&enc(&p).unwrap()).is_err());
        assert!(s.stage_switch624_fence_diagonal_n3_positive_archive(e,&enc(&old_plan).unwrap()).is_err());
        let steam=ProductSession::open_decoded_readonly(enc(&d).unwrap(),crate::BuildIdentity{
            platform:Platform::SteamWindows,build_kind:BuildKind::SteamFullVersion,
            build_id:"releases_1.25-v1.25.3-44-g0b41250d9ac0-incremental-22".into(),schema:626,externally_attested:true}).unwrap();
        assert!(steam.stage_switch626_fence_fd01_layout(scope(&steam,WorkerAction::Stage),&enc(&p).unwrap()).is_err());
        assert!(open626(&d).stage_switch626_fence_fd01_layout(e,&enc(&p).unwrap()).is_err());
        for (k,v) in [("contract",json!(FenceAddShape::DiagonalN3Positive.contract())),
            ("sourceDecodedSha256",json!("bad")),("gridSha256",json!("bad")),
            ("inventoryEntrySha256",json!("bad")),("expectedNextId",json!(51)),
            ("layout",json!("EXPLICIT_USER_LAYOUT")),("created",json!([])),("refund",json!(1))]{
            let mut q=p.clone();q[k]=v;assert!(s.stage_switch626_fence_fd01_layout(e,&enc(&q).unwrap()).is_err());
        }
        for i in 0..5{
            let mut d=d.clone();let mut q=p.clone();
            match i{
                0=>q["created"][1]["Orientation"]=json!("GridOrientation_Left"),
                1=>q["created"][1]["ItemID"]=json!(40700256),
                2=>d["Player"]["ListInventories"]["0"]["Inventory"]["40700246"]["Amount"]=json!(0),
                3=>d["World"]["GridCollection"]["DiffGrids"]["9"]=json!({}),
                _=>{d["World"]["GridCollection"]["Grids"]["9"]["Objects"]["12"]["X"]=json!(42);
                    d["World"]["GridCollection"]["Grids"]["9"]["Objects"]["12"]["Y"]=json!(22);}
            }
            bind(&d,&mut q);let t=open626(&d);
            assert!(t.stage_switch626_fence_fd01_layout(scope(&t,WorkerAction::Stage),&enc(&q).unwrap()).is_err());
        }
        assert_eq!(s.receipt().unwrap().revision,0);
    }

}
