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
