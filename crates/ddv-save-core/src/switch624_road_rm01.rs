//! Native-private exact historical mixed Road-RM01 transition only.
//! Validates one approved 01C plan shape; no general topology compiler.
//! Operator must independently bind exact archive and 01B/01C/01E receipt.
//! Caller-provided digest is CAS, not authorization; no Worker exposure.
use super::*;
use serde_json::{Value,json};
const BID:&str="52BD625D9B4E0053";
const ROAD:u32=40100068;
fn digest(b:&[u8])->String{sha(b).iter().map(|x|format!("{x:02x}")).collect()}
fn uint(v:&Value)->CoreResult<u32>{
    v.as_u64().and_then(|n|u32::try_from(n).ok()).ok_or(denied("RM01_PLAN_UINT"))
}
fn num(b:&[u8],s:Span,k:&str)->CoreResult<u32>{
    u32::try_from(number(b,object_field(b,s,k)?)?).map_err(|_|denied("RM01_FIELD_UINT"))
}
fn raw(b:&[u8],s:Span)->CoreResult<&[u8]>{b.get(s.begin..s.end).ok_or(denied("RM01_SPAN"))}
fn val(b:&[u8],s:Span)->CoreResult<Value>{
    if s.end.saturating_sub(s.begin)>4096{return Err(denied("RM01_RECORD_BOUNDS"));}
    serde_json::from_slice(raw(b,s)?).map_err(|_|denied("RM01_RECORD"))
}
fn enc(v:&Value)->CoreResult<Vec<u8>>{serde_json::to_vec(v).map_err(|_|denied("RM01_ENCODE"))}
fn plan_parse(bytes:&[u8],contract:&str)->CoreResult<Value>{
    if bytes.is_empty()||bytes.len()>16384{return Err(denied("RM01_PLAN_BOUNDS"));}
    let v:Value=serde_json::from_slice(bytes).map_err(|_|denied("RM01_PLAN_JSON"))?;
    if enc(&v)?.as_slice()!=bytes{return Err(denied("RM01_PLAN_NONCANONICAL"));}
    let keys=["contract","sourceDecodedSha256","gridId","retainedId","movedId",
        "expectedNextId","expectedAmount","gridSha256","inventoryEntrySha256","objects"];
    let m=v.as_object().ok_or(denied("RM01_PLAN_OBJECT"))?;
    if m.len()!=keys.len()||!keys.iter().all(|k|m.contains_key(*k))||
       v["contract"]!=contract{return Err(denied("RM01_PLAN_FIELDS"));}
    Ok(v)
}
fn obj(id:u32,x:u32,y:u32,diagonal:bool)->Value{
    json!({"ID":id,"ItemID":ROAD,"X":x,"Y":y,"Orientation":"GridOrientation_Down",
        "State":if diagonal{json!({"FenceMode":{"Diagonal":true}})}else{Value::Null}})
}
fn repl(b:&[u8],span:Span,new:Vec<u8>)->CoreResult<Replacement>{
    let old=raw(b,span)?.to_vec();
    if old==new{return Err(denied("RM01_NO_CHANGE"));}
    Ok(Replacement{span,old,new})
}
fn collect(s:&ProductSession,p:&Value)->CoreResult<Vec<Replacement>>{
    let b=&s.decoded;
    if p["sourceDecodedSha256"]!=digest(b){return Err(denied("RM01_SOURCE_SHA_CAS"));}
    let g=uint(&p["gridId"])?;let keep=uint(&p["retainedId"])?;let moved=uint(&p["movedId"])?;
    let next=uint(&p["expectedNextId"])?;let amount=uint(&p["expectedAmount"])?;
    let n3=next.checked_add(3).ok_or(denied("RM01_COUNTER_OVERFLOW"))?;
    if g==0||keep==0||moved==0||keep==moved||keep>=next||moved>=next||
       n3>i32::MAX as u32||amount<=3||amount as u64>MAX_CONSERVATIVE_AMOUNT{
        return Err(denied("RM01_TARGET_OR_COST_BOUNDS"));
    }
    let roots=indexed_read::roots(b)?;
    let gc=object_field(b,roots.world,"GridCollection")?;
    let grid=object_field(b,object_field(b,gc,"Grids")?,&g.to_string())?;
    if p["gridSha256"]!=digest(raw(b,grid)?)||num(b,grid,"ID")?!=g||
       num(b,grid,"TessellationFactor")?!=2||
       val(b,object_field(b,grid,"GridDefaultLayoutPath")?)?!=""{
        return Err(denied("RM01_GRID_CAS_OR_LAYOUT"));
    }
    let diffs=object_field(b,gc,"DiffGrids")?;
    let mut pos=diffs.begin+1;let mut count=0;
    while let Some((k,_))=next_object_member(b,diffs,&mut pos)?{
        count+=1;if count>50000||k==g.to_string(){return Err(denied("RM01_DIFFGRID_BOUND_OR_OVERLAY"));}
    }
    let counter=object_field(b,grid,"NextGridObjectID")?;
    if number(b,counter)?!=next as u64{return Err(denied("RM01_COUNTER_CAS"));}
    let objs=object_field(b,grid,"Objects")?;
    let mut pos=objs.begin+1;let mut count=0usize;let mut ks=None;let mut ms=None;
    while let Some((k,entry))=next_object_member(b,objs,&mut pos)?{
        count+=1;if count>250000{return Err(denied("RM01_OBJECT_BOUND"));}
        let id=k.parse::<u32>().map_err(|_|denied("RM01_OBJECT_KEY"))?;
        if id==0||id.to_string()!=k||id>=next||num(b,entry,"ID")?!=id{return Err(denied("RM01_OBJECT_ID_OR_COUNTER"));}
        if id==keep{ks=Some(entry);} if id==moved{ms=Some(entry);}
    }
    let ks=ks.ok_or(denied("RM01_RETAINED_MISSING"))?;let ms=ms.ok_or(denied("RM01_MOVED_MISSING"))?;
    let x=num(b,ks,"X")?;let y=num(b,ks,"Y")?;
    let x4=x.checked_add(4).ok_or(denied("RM01_COORD_BOUND"))?;
    let x8=x.checked_add(8).ok_or(denied("RM01_COORD_BOUND"))?;
    let y4=y.checked_add(4).ok_or(denied("RM01_COORD_BOUND"))?;
    if x8>i32::MAX as u32||y4>i32::MAX as u32||val(b,ks)?!=obj(keep,x,y,false)||val(b,ms)?!=obj(moved,x4,y,false){
        return Err(denied("RM01_EXACT_OLD_OBJECTS"));
    }
    let wanted=[obj(keep,x,y,false),obj(moved,x8,y4,true),obj(next,x4,y,true),obj(next+1,x4,y4,true),obj(next+2,x8,y,true)];
    let plan=p["objects"].as_array().ok_or(denied("RM01_PLAN_OBJECTS"))?;
    if plan.as_slice()!=wanted.as_slice(){return Err(denied("RM01_EXACT_PLAN_SHAPE"));}
    // Stored anchor guard, not full geometry proof. External exact-source
    // 01B readset covers footprint/floor/parent and 01E covers closure.
    let mut pos=objs.begin+1;
    while let Some((k,entry))=next_object_member(b,objs,&mut pos)?{
        if k==keep.to_string()||k==moved.to_string(){continue;}
        let ox=val(b,object_field(b,entry,"X")?)?;let oy=val(b,object_field(b,entry,"Y")?)?;
        let ox=ox.as_f64().filter(|v|v.is_finite()).ok_or(denied("RM01_COORD_TOKEN"))?;
        let oy=oy.as_f64().filter(|v|v.is_finite()).ok_or(denied("RM01_COORD_TOKEN"))?;
        if [(x,y),(x4,y),(x4,y4),(x8,y),(x8,y4)].iter().any(|(a,c)|ox==*a as f64&&oy==*c as f64){
            return Err(denied("RM01_OCCUPIED_ANCHOR"));
        }
    }
    let route=object_field(b,object_field(b,roots.player,"ListInventories")?,"0")?;
    inventory_route(b,route,0,ROAD,"ItemType_Furniture")?;
    let entry=object_field(b,object_field(b,route,"Inventory")?,&ROAD.to_string())?;
    if p["inventoryEntrySha256"]!=digest(raw(b,entry)?){return Err(denied("RM01_INVENTORY_ENTRY_CAS"));}
    let debit=validate_old_amount(b,object_field(b,entry,"Amount")?,amount,amount-3)?;
    Ok(vec![repl(b,object_field(b,ms,"X")?,enc(&plan[1]["X"])?)?,
        repl(b,object_field(b,ms,"Y")?,enc(&plan[1]["Y"])?)?,
        repl(b,object_field(b,ms,"State")?,enc(&plan[1]["State"])?)?,
        append_road_objects(b,objs,&plan[2..])?,repl(b,counter,n3.to_string().into_bytes())?,debit])
}
fn append_road_objects(b:&[u8],objs:Span,records:&[Value])->CoreResult<Replacement>{
    let mut insert=Vec::new();
    for o in records{let id=uint(&o["ID"])?;insert.extend_from_slice(format!(",\"{id}\":").as_bytes());insert.extend_from_slice(&enc(o)?);}
    insert.push(b'}');
    repl(b,Span{begin:objs.end-1,end:objs.end},insert)
}
impl ProductSession{
    pub fn stage_switch624_road_rm01_archive(&self,e:WorkerEnvelope,plan:&[u8])->CoreResult<SemanticStageReceipt>{
        let build=&self.native_source_build;
        if build.platform!=Platform::Switch||build.build_kind!=BuildKind::SwitchBid||
           build.build_id!=BID||build.schema!=624||!build.externally_attested||self.worker_bound{
            return Err(denied("RM01_EXACT_SWITCH624_REQUIRED"));
        }
        let p=plan_parse(plan,"wand.private.switch624.road-rm01-archive@1")?;
        let edits=collect(self,&p)?;
        self.commit_semantic_replacements(e,edits,8)
    }
}
impl ProductSession{
    /// Exact Switch626 Native mixed q5 transition; retained/moved identities,
    /// three fresh objects, exact debit3. No generic cost/topology grant.
    pub fn stage_switch626_road_rm01_native_mixed_q5(&self,e:WorkerEnvelope,plan:&[u8])->CoreResult<SemanticStageReceipt>{
        let b=&self.native_source_build;
        if b.platform!=Platform::Switch||b.build_kind!=BuildKind::SwitchBid||b.build_id!="9A239D3DB569756D"||
           b.schema!=626||!b.externally_attested||self.worker_bound{return Err(denied("RM01_EXACT_SWITCH626_REQUIRED"));}
        let p=plan_parse(plan,"wand.private.switch626.road-rm01-native-mixed-q5@1")?;
        let edits=collect(self,&p)?;
        self.commit_semantic_replacements(e,edits,8)
    }
}
#[cfg(test)]
mod tests{
    use super::*;
    fn build()->crate::BuildIdentity{crate::BuildIdentity{platform:Platform::Switch,build_kind:BuildKind::SwitchBid,
        build_id:BID.into(),schema:624,externally_attested:true}}
    fn doc()->Value{json!({"GameInfo":{"Version":624},"World":{"Ambient":{"keep":7},
        "GridCollection":{"DiffGrids":{},"Grids":{"9":{"ID":9,"TessellationFactor":2,"GridDefaultLayoutPath":"",
        "NextGridObjectID":50,"Objects":{"10":obj(10,40,20,false),"11":obj(11,44,20,false),
            "12":{"ID":12,"ItemID":40000001,"X":80,"Y":90,"Unknown":{"x":7}}}}}}},
        "Player":{"ListInventories":{"0":{"ID":0,"CompatibleItemType":"ItemType_Furniture",
            "CompatibleFurnitureTypes":{"List":["FurnitureItemType_GroundAlteration"]},
            "Inventory":{"40100068":{"Amount":30,"Marker":"Keep","Opaque":9}}}}}})}
    fn open(d:&Value)->ProductSession{let b=enc(d).unwrap();let h=sha(&b);
        ProductSession::open_switch624_rm01_private(b,build(),h).unwrap()}
    fn scope(s:&ProductSession,a:WorkerAction)->WorkerEnvelope{let r=s.receipt().unwrap();
        WorkerEnvelope{contract:PRODUCT_WORKER_CONTRACT,session_id:r.session_id,expected_revision:r.revision,
            expected_index_generation:r.index_generation,expected_decoded_sha256:r.decoded_sha256,action:a}}
    fn plan(d:&Value)->Value{json!({"contract":"wand.private.switch624.road-rm01-archive@1",
        "sourceDecodedSha256":digest(&enc(d).unwrap()),"gridId":9,"retainedId":10,"movedId":11,
        "expectedNextId":50,"expectedAmount":30,
        "gridSha256":digest(&enc(&d["World"]["GridCollection"]["Grids"]["9"]).unwrap()),
        "inventoryEntrySha256":digest(&enc(&d["Player"]["ListInventories"]["0"]["Inventory"]["40100068"]).unwrap()),
        "objects":[obj(10,40,20,false),obj(11,48,24,true),obj(50,44,20,true),obj(51,44,24,true),obj(52,48,20,true)]})}
    #[test]
    fn rm01_switch626_mixed_q5_exact8_debit3_preserve_identity(){
        let old=doc();let mut d=old.clone();d["GameInfo"]["Version"]=json!(626);
        d["Player"]["ListInventories"]["0"]["Inventory"]["40100068"]["Amount"]=json!(7025);
        let mut p=plan(&d);p["contract"]=json!("wand.private.switch626.road-rm01-native-mixed-q5@1");
        p["expectedAmount"]=json!(7025);
        let make=|v:&Value|ProductSession::open_decoded_readonly(enc(v).unwrap(),crate::BuildIdentity{
            platform:Platform::Switch,build_kind:BuildKind::SwitchBid,build_id:"9A239D3DB569756D".into(),
            schema:626,externally_attested:true}).unwrap();
        let s=make(&d);let e=scope(&s,WorkerAction::Stage);let bytes=enc(&p).unwrap();
        assert!(s.stage_switch624_road_rm01_archive(e,&bytes).is_err());
        assert!(s.stage_switch626_road_r02_native_q4(e,&bytes).is_err());
        let t=open(&old);assert!(t.stage_switch626_road_rm01_native_mixed_q5(scope(&t,WorkerAction::Stage),&bytes).is_err());
        assert!(make(&d).stage_switch626_road_rm01_native_mixed_q5(e,&bytes).is_err());
        for (k,v) in [("contract",json!("wand.private.switch624.road-rm01-archive@1")),("retainedId",json!(11)),
            ("expectedAmount",json!(7024)),("expectedNextId",json!(51)),("sourceDecodedSha256",json!("bad")),
            ("gridSha256",json!("bad")),("inventoryEntrySha256",json!("bad")),("refund",json!(1))]{
            let mut q=p.clone();q[k]=v;assert!(s.stage_switch626_road_rm01_native_mixed_q5(e,&enc(&q).unwrap()).is_err());
        }
        let mut q=p.clone();q["objects"][1]["ID"]=json!(50);assert!(s.stage_switch626_road_rm01_native_mixed_q5(e,&enc(&q).unwrap()).is_err());
        let mut q=p.clone();q["objects"][1]["State"]=Value::Null;assert!(s.stage_switch626_road_rm01_native_mixed_q5(e,&enc(&q).unwrap()).is_err());
        let r=s.stage_switch626_road_rm01_native_mixed_q5(e,&bytes).unwrap();
        assert_eq!(r.operation_count,8);assert_eq!(r.exact_field_changed_count,8);assert!(!r.product_writer_authorized);
        assert!(s.stage_switch626_road_rm01_native_mixed_q5(e,&bytes).is_err());
        s.undo_typed_semantic_batch(scope(&s,WorkerAction::Stage)).unwrap();
        assert!(s.take_typed_semantic_decoded_once(scope(&s,WorkerAction::ExportEditedCopy)).is_err());
        s.redo_typed_semantic_batch(scope(&s,WorkerAction::Stage)).unwrap();
        let e=scope(&s,WorkerAction::ExportEditedCopy);let out=s.take_typed_semantic_decoded_once(e).unwrap();
        assert!(s.take_typed_semantic_decoded_once(e).is_err());
        let mut wanted=d.clone();let g=&mut wanted["World"]["GridCollection"]["Grids"]["9"];g["NextGridObjectID"]=json!(53);
        for o in p["objects"].as_array().unwrap().iter().skip(1){g["Objects"][o["ID"].as_u64().unwrap().to_string()]=o.clone();}
        wanted["Player"]["ListInventories"]["0"]["Inventory"]["40100068"]["Amount"]=json!(7022);
        assert_eq!(serde_json::from_slice::<Value>(&out).unwrap(),wanted);assert_eq!(sha(&out),r.staged_decoded_sha256);
    }
    #[test]
    fn rm01_atomic_exact8_preserve_unknown_undo_redo_one_time(){
        let d=doc();let s=open(&d);let p=plan(&d);let e=scope(&s,WorkerAction::Stage);
        assert!(ProductSession::open_decoded_readonly(enc(&d).unwrap(),build()).is_err());
        let staged=s.stage_switch624_road_rm01_archive(e,&enc(&p).unwrap()).unwrap();
        assert_eq!(staged.operation_count,8);assert!(!staged.product_writer_authorized);
        assert!(s.stage_switch624_road_rm01_archive(e,&enc(&p).unwrap()).is_err());
        s.undo_typed_semantic_batch(scope(&s,WorkerAction::Stage)).unwrap();
        assert!(s.take_typed_semantic_decoded_once(scope(&s,WorkerAction::ExportEditedCopy)).is_err());
        s.redo_typed_semantic_batch(scope(&s,WorkerAction::Stage)).unwrap();
        let e=scope(&s,WorkerAction::ExportEditedCopy);let out=s.take_typed_semantic_decoded_once(e).unwrap();
        assert!(s.take_typed_semantic_decoded_once(e).is_err());
        let mut expected=d.clone();let g=&mut expected["World"]["GridCollection"]["Grids"]["9"];
        g["NextGridObjectID"]=json!(53);
        for o in p["objects"].as_array().unwrap().iter().skip(1){g["Objects"][o["ID"].as_u64().unwrap().to_string()]=o.clone();}
        expected["Player"]["ListInventories"]["0"]["Inventory"]["40100068"]["Amount"]=json!(27);
        assert_eq!(serde_json::from_slice::<Value>(&out).unwrap(),expected);
        assert_eq!(sha(&out),staged.staged_decoded_sha256);
    }
    #[test]
    fn rm01_wrong_build_plan_cas_overlay_collision_and_state_deny(){
        let d=doc();let p=plan(&d);let s=open(&d);let e=scope(&s,WorkerAction::Stage);
        for (k,v) in [("expectedNextId",json!(51)),("expectedAmount",json!(29)),("sourceDecodedSha256",json!("bad")),
            ("gridSha256",json!("bad")),("inventoryEntrySha256",json!("bad")),("retainedId",json!(11)),("objects",json!([]))]{
            let mut x=p.clone();x[k]=v;assert!(s.stage_switch624_road_rm01_archive(e,&enc(&x).unwrap()).is_err());
        }
        assert!(open(&d).stage_switch624_road_rm01_archive(e,&enc(&p).unwrap()).is_err());
        let mut bad=build();bad.build_id="9A239D3DB569756D".into();
        assert!(ProductSession::open_switch624_rm01_private(enc(&d).unwrap(),bad,sha(&enc(&d).unwrap())).is_err());
        assert!(ProductSession::open_switch624_rm01_private(enc(&d).unwrap(),build(),[1;32]).is_err());
        for kind in 0..4{
            let mut x=d.clone();
            match kind{0=>x["World"]["GridCollection"]["DiffGrids"]["9"]=json!({}),
                1=>{x["World"]["GridCollection"]["Grids"]["9"]["Objects"]["12"]["X"]=json!(48);
                    x["World"]["GridCollection"]["Grids"]["9"]["Objects"]["12"]["Y"]=json!(24);},
                2=>x["World"]["GridCollection"]["Grids"]["9"]["Objects"]["11"]["State"]=json!({}),
                _=>x["World"]["GridCollection"]["Grids"]["9"]["Objects"]["12"]["ID"]=json!(50)}
            let t=open(&x);assert!(t.stage_switch624_road_rm01_archive(scope(&t,WorkerAction::Stage),&enc(&plan(&x)).unwrap()).is_err());
        }
        assert_eq!(s.receipt().unwrap().revision,0);
    }
}

// ACT704: R02 is a distinct Native dense q4 ADD, not a direct layout add.
// Reuse the exact-build native session, indexed scanner, lexical append and
// atomic ledger. No generic road cost, refund, or new topology compiler.
const R02_CONTRACT:&str="wand.private.switch624.road-r02-native-q4-archive@1";
const R02_626_CONTRACT:&str="wand.private.switch626.road-r02-native-q4@1";
const R01_626_CONTRACT:&str="wand.private.switch626.road-r01-orthogonal-q3-layout@1";
fn r02_plan_parse(bytes:&[u8],contract:&str)->CoreResult<Value>{
    if bytes.is_empty()||bytes.len()>16384{return Err(denied("R02_PLAN_BOUNDS"));}
    let v:Value=serde_json::from_slice(bytes).map_err(|_|denied("R02_PLAN_JSON"))?;
    if enc(&v)?.as_slice()!=bytes{return Err(denied("R02_PLAN_NONCANONICAL"));}
    let keys=["contract","sourceDecodedSha256","gridId","expectedNextId","expectedAmount",
        "gridSha256","inventoryEntrySha256","objects"];
    let m=v.as_object().ok_or(denied("R02_PLAN_OBJECT"))?;
    if m.len()!=keys.len()||!keys.iter().all(|k|m.contains_key(*k))||v["contract"]!=contract{
        return Err(denied("R02_PLAN_FIELDS"));
    }
    Ok(v)
}
fn r02_collect(s:&ProductSession,p:&Value)->CoreResult<Vec<Replacement>>{
    road_add_collect(s,p,false)
}
// R01 layout only: exact horizontal three orthogonal anchors. Reuse the
// same direct-grid scanner and append/atomic ledger; never debit inventory.
fn road_add_collect(s:&ProductSession,p:&Value,r01:bool)->CoreResult<Vec<Replacement>>{
    let b=&s.decoded;
    if p["sourceDecodedSha256"]!=digest(b){return Err(denied("R02_SOURCE_SHA_CAS"));}
    let g=uint(&p["gridId"])?;let next=uint(&p["expectedNextId"])?;let amount=uint(&p["expectedAmount"])?;
    let count_new=if r01{3}else{4};
    let n4=next.checked_add(count_new).ok_or(denied("R02_COUNTER_OVERFLOW"))?;
    if g==0||next==0||n4>i32::MAX as u32||amount<=if r01{0}else{4}||amount as u64>MAX_CONSERVATIVE_AMOUNT{
        return Err(denied("R02_TARGET_OR_COST_BOUNDS"));
    }
    let plan=p["objects"].as_array().filter(|a|a.len()==count_new as usize).ok_or(denied("R02_PLAN_OBJECTS"))?;
    let x=uint(&plan[0]["X"])?;let y=uint(&plan[0]["Y"])?;
    let x4=x.checked_add(4).filter(|n|*n<=i32::MAX as u32).ok_or(denied("R02_COORD_BOUND"))?;
    let wanted=if r01{
        let x8=x.checked_add(8).filter(|n|*n<=i32::MAX as u32).ok_or(denied("R01_COORD_BOUND"))?;
        if y>i32::MAX as u32{return Err(denied("R01_COORD_BOUND"));}
        vec![obj(next,x,y,false),obj(next+1,x4,y,false),obj(next+2,x8,y,false)]
    }else{
        let y4=y.checked_add(4).filter(|n|*n<=i32::MAX as u32).ok_or(denied("R02_COORD_BOUND"))?;
        vec![obj(next,x,y,true),obj(next+1,x4,y4,true),obj(next+2,x4,y,true),obj(next+3,x,y4,true)]
    };
    if plan.as_slice()!=wanted.as_slice(){return Err(denied("R02_EXACT_PLAN_SHAPE"));}
    let roots=indexed_read::roots(b)?;
    let gc=object_field(b,roots.world,"GridCollection")?;
    let grid=object_field(b,object_field(b,gc,"Grids")?,&g.to_string())?;
    if p["gridSha256"]!=digest(raw(b,grid)?)||num(b,grid,"ID")?!=g||
       num(b,grid,"TessellationFactor")?!=2||val(b,object_field(b,grid,"GridDefaultLayoutPath")?)?!=""{
        return Err(denied("R02_GRID_CAS_OR_LAYOUT"));
    }
    let diffs=object_field(b,gc,"DiffGrids")?;
    let mut pos=diffs.begin+1;let mut count=0;
    while let Some((k,_))=next_object_member(b,diffs,&mut pos)?{
        count+=1;if count>50000||k==g.to_string(){return Err(denied("R02_OVERLAY"));}
    }
    let counter=object_field(b,grid,"NextGridObjectID")?;
    if number(b,counter)?!=next as u64{return Err(denied("R02_COUNTER_CAS"));}
    let objs=object_field(b,grid,"Objects")?;
    let mut pos=objs.begin+1;let mut count=0usize;
    while let Some((k,entry))=next_object_member(b,objs,&mut pos)?{
        count+=1;if count>250000{return Err(denied("R02_OBJECT_BOUND"));}
        let id=k.parse::<u32>().map_err(|_|denied("R02_OBJECT_KEY"))?;
        if id==0||id.to_string()!=k||id>=next||num(b,entry,"ID")?!=id{return Err(denied("R02_OBJECT_ID_OR_COUNTER"));}
        let ox=val(b,object_field(b,entry,"X")?)?;let oy=val(b,object_field(b,entry,"Y")?)?;
        let ox=ox.as_f64().filter(|v|v.is_finite()).ok_or(denied("R02_COORD_TOKEN"))?;
        let oy=oy.as_f64().filter(|v|v.is_finite()).ok_or(denied("R02_COORD_TOKEN"))?;
        if wanted.iter().any(|v|v["X"].as_f64()==Some(ox)&&v["Y"].as_f64()==Some(oy)){
            return Err(denied("R02_OCCUPIED_ANCHOR"));
        }
    }
    // This scoped archived input is a nonempty direct grid. The external
    // exact-source readset must independently close floor/footprint/rights.
    if count==0{return Err(denied("R02_EMPTY_GRID_UNSUPPORTED"));}
    let route=object_field(b,object_field(b,roots.player,"ListInventories")?,"0")?;
    inventory_route(b,route,0,ROAD,"ItemType_Furniture")?;
    let entry=object_field(b,object_field(b,route,"Inventory")?,&ROAD.to_string())?;
    if p["inventoryEntrySha256"]!=digest(raw(b,entry)?){return Err(denied("R02_INVENTORY_ENTRY_CAS"));}
    let amount_span=object_field(b,entry,"Amount")?;
    let mut edits=vec![append_road_objects(b,objs,plan)?,repl(b,counter,n4.to_string().into_bytes())?];
    if r01{
        if raw(b,amount_span)?!=amount.to_string().as_bytes(){return Err(denied("R01_AMOUNT_CAS"));}
    }else{edits.push(validate_old_amount(b,amount_span,amount,amount-4)?);}
    Ok(edits)
}
impl ProductSession{
    pub fn stage_switch624_road_r02_native_q4_archive(&self,e:WorkerEnvelope,plan:&[u8])->CoreResult<SemanticStageReceipt>{
        let build=&self.native_source_build;
        if build.platform!=Platform::Switch||build.build_kind!=BuildKind::SwitchBid||build.build_id!=BID||
           build.schema!=624||!build.externally_attested||self.worker_bound{
            return Err(denied("R02_EXACT_SWITCH624_REQUIRED"));
        }
        let p=r02_plan_parse(plan,R02_CONTRACT)?;
        let edits=r02_collect(self,&p)?;
        self.commit_semantic_replacements(e,edits,6)
    }
}
impl ProductSession{
    /// Exact current Switch626 R02 Native q4; external target legality remains
    /// a separate private V2 prerequisite. No generic debit or refund.
    pub fn stage_switch626_road_r02_native_q4(&self,e:WorkerEnvelope,plan:&[u8])->CoreResult<SemanticStageReceipt>{
        let build=&self.native_source_build;
        if build.platform!=Platform::Switch||build.build_kind!=BuildKind::SwitchBid||
           build.build_id!="9A239D3DB569756D"||build.schema!=626||!build.externally_attested||self.worker_bound{
            return Err(denied("R02_EXACT_SWITCH626_REQUIRED"));
        }
        let p=r02_plan_parse(plan,R02_626_CONTRACT)?;
        let edits=r02_collect(self,&p)?;
        self.commit_semantic_replacements(e,edits,6)
    }
}
impl ProductSession{
    /// Current exact Switch626 direct layout. No Native cost or generic graph grant.
    pub fn stage_switch626_road_r01_orthogonal_q3(&self,e:WorkerEnvelope,plan:&[u8])->CoreResult<SemanticStageReceipt>{
        let b=&self.native_source_build;
        if b.platform!=Platform::Switch||b.build_kind!=BuildKind::SwitchBid||b.build_id!="9A239D3DB569756D"||b.schema!=626||!b.externally_attested||self.worker_bound{return Err(denied("R01_EXACT_SWITCH626_REQUIRED"));}
        let p=r02_plan_parse(plan,R01_626_CONTRACT)?;
        self.commit_semantic_replacements(e,road_add_collect(self,&p,true)?,4)
    }
}
#[cfg(test)]
mod r02_tests{
    use super::*;
    fn fixture()->(Value,Value){
        let d=json!({"GameInfo":{"Version":624},"World":{"Ambient":{"keep":7},
        "GridCollection":{"DiffGrids":{},"Grids":{"9":{"ID":9,"TessellationFactor":2,
        "GridDefaultLayoutPath":"","NextGridObjectID":50,"Objects":{"12":{"ID":12,"ItemID":40000001,
        "X":80,"Y":90,"Unknown":{"x":7}}}}}}},
        "Player":{"ListInventories":{"0":{"ID":0,"CompatibleItemType":"ItemType_Furniture",
        "CompatibleFurnitureTypes":{"List":["FurnitureItemType_GroundAlteration"]},
        "Inventory":{"40100068":{"Amount":30,"Marker":"Keep","Opaque":9}}}}}});
        let mut p=json!({"contract":R02_CONTRACT,"gridId":9,"expectedNextId":50,"expectedAmount":30,
            "objects":[obj(50,40,20,true),obj(51,44,24,true),obj(52,44,20,true),obj(53,40,24,true)]});
        bind(&d,&mut p);(d,p)
    }
    fn bind(d:&Value,p:&mut Value){
        p["sourceDecodedSha256"]=json!(digest(&enc(d).unwrap()));
        p["gridSha256"]=json!(digest(&enc(&d["World"]["GridCollection"]["Grids"]["9"]).unwrap()));
        p["inventoryEntrySha256"]=json!(digest(&enc(&d["Player"]["ListInventories"]["0"]["Inventory"]["40100068"]).unwrap()));
    }
    fn open(d:&Value)->ProductSession{let b=enc(d).unwrap();let h=sha(&b);
        ProductSession::open_switch624_rm01_private(b,crate::BuildIdentity{platform:Platform::Switch,
        build_kind:BuildKind::SwitchBid,build_id:BID.into(),schema:624,externally_attested:true},h).unwrap()}
    fn scope(s:&ProductSession,a:WorkerAction)->WorkerEnvelope{let r=s.receipt().unwrap();
        WorkerEnvelope{contract:PRODUCT_WORKER_CONTRACT,session_id:r.session_id,expected_revision:r.revision,
        expected_index_generation:r.index_generation,expected_decoded_sha256:r.decoded_sha256,action:a}}
    #[test]
    fn r01_switch626_exact4_layout_inventory_unchanged(){
        let (old,mut p)=fixture();let mut d=old.clone();d["GameInfo"]["Version"]=json!(626);
        p["contract"]=json!(R01_626_CONTRACT);p["objects"]=json!([obj(50,40,20,false),obj(51,44,20,false),obj(52,48,20,false)]);bind(&d,&mut p);
        let make=|v:&Value|ProductSession::open_decoded_readonly(enc(v).unwrap(),crate::BuildIdentity{platform:Platform::Switch,build_kind:BuildKind::SwitchBid,build_id:"9A239D3DB569756D".into(),schema:626,externally_attested:true}).unwrap();
        let s=make(&d);let e=scope(&s,WorkerAction::Stage);
        let t=open(&old);assert!(t.stage_switch626_road_r01_orthogonal_q3(scope(&t,WorkerAction::Stage),&enc(&p).unwrap()).is_err());
        assert!(s.stage_switch626_road_r02_native_q4(e,&enc(&p).unwrap()).is_err());
        assert!(make(&d).stage_switch626_road_r01_orthogonal_q3(e,&enc(&p).unwrap()).is_err());
        for(k,v)in [("expectedAmount",json!(29)),("expectedNextId",json!(51)),("gridSha256",json!("bad")),("inventoryEntrySha256",json!("bad")),("sourceDecodedSha256",json!("bad")),("refund",json!(1))]{
            let mut q=p.clone();q[k]=v;assert!(s.stage_switch626_road_r01_orthogonal_q3(e,&enc(&q).unwrap()).is_err());
        }
        for (k,v) in [("State",json!({"FenceMode":{"Diagonal":true}})),("X",json!(45)),("Orientation",json!("GridOrientation_Up")),("ID",json!(52))]{
            let mut q=p.clone();q["objects"][1][k]=v;assert!(s.stage_switch626_road_r01_orthogonal_q3(e,&enc(&q).unwrap()).is_err());
        }
        let mut q=p.clone();q["objects"].as_array_mut().unwrap().swap(0,1);assert!(s.stage_switch626_road_r01_orthogonal_q3(e,&enc(&q).unwrap()).is_err());
        let mut bad=d.clone();bad["World"]["GridCollection"]["Grids"]["9"]["Objects"]["12"]["X"]=json!(48);bad["World"]["GridCollection"]["Grids"]["9"]["Objects"]["12"]["Y"]=json!(20);let mut q=p.clone();bind(&bad,&mut q);let t=make(&bad);assert!(t.stage_switch626_road_r01_orthogonal_q3(scope(&t,WorkerAction::Stage),&enc(&q).unwrap()).is_err());
        let r=s.stage_switch626_road_r01_orthogonal_q3(e,&enc(&p).unwrap()).unwrap();assert_eq!(r.operation_count,4);assert_eq!(r.exact_field_changed_count,4);assert!(!r.product_writer_authorized);
        assert!(s.stage_switch626_road_r01_orthogonal_q3(e,&enc(&p).unwrap()).is_err());
        s.undo_typed_semantic_batch(scope(&s,WorkerAction::Stage)).unwrap();assert!(s.take_typed_semantic_decoded_once(scope(&s,WorkerAction::ExportEditedCopy)).is_err());
        s.redo_typed_semantic_batch(scope(&s,WorkerAction::Stage)).unwrap();let e=scope(&s,WorkerAction::ExportEditedCopy);let out=s.take_typed_semantic_decoded_once(e).unwrap();assert!(s.take_typed_semantic_decoded_once(e).is_err());
        let mut wanted=d.clone();let g=&mut wanted["World"]["GridCollection"]["Grids"]["9"];g["NextGridObjectID"]=json!(53);
        for o in p["objects"].as_array().unwrap(){g["Objects"][o["ID"].as_u64().unwrap().to_string()]=o.clone();}
        assert_eq!(serde_json::from_slice::<Value>(&out).unwrap(),wanted);assert_eq!(sha(&out),r.staged_decoded_sha256);
    }
    #[test]
    fn r02_switch626_exact6_current_debit4(){
        let (old,mut p)=fixture();let mut d=old.clone();
        d["GameInfo"]["Version"]=json!(626);
        d["Player"]["ListInventories"]["0"]["Inventory"]["40100068"]["Amount"]=json!(7025);
        p["contract"]=json!(R02_626_CONTRACT);p["expectedAmount"]=json!(7025);bind(&d,&mut p);
        let make=|v:&Value|ProductSession::open_decoded_readonly(enc(v).unwrap(),crate::BuildIdentity{
            platform:Platform::Switch,build_kind:BuildKind::SwitchBid,build_id:"9A239D3DB569756D".into(),schema:626,externally_attested:true}).unwrap();
        let s=make(&d);let e=scope(&s,WorkerAction::Stage);let bytes=enc(&p).unwrap();
        assert!(s.stage_switch624_road_r02_native_q4_archive(e,&bytes).is_err());
        let t=open(&old);assert!(t.stage_switch626_road_r02_native_q4(scope(&t,WorkerAction::Stage),&bytes).is_err());
        assert!(make(&d).stage_switch626_road_r02_native_q4(e,&bytes).is_err());
        for (k,v) in [("contract",json!(R02_CONTRACT)),("expectedAmount",json!(7024)),("expectedNextId",json!(51)),
            ("sourceDecodedSha256",json!("bad")),("gridSha256",json!("bad")),("inventoryEntrySha256",json!("bad")),("refund",json!(1))]{
            let mut q=p.clone();q[k]=v;assert!(s.stage_switch626_road_r02_native_q4(e,&enc(&q).unwrap()).is_err());
        }
        let mut q=p.clone();q["objects"].as_array_mut().unwrap().swap(1,2);
        assert!(s.stage_switch626_road_r02_native_q4(e,&enc(&q).unwrap()).is_err());
        let mut bad=d.clone();bad["World"]["GridCollection"]["Grids"]["9"]["Objects"]["12"]["X"]=json!(40);
        bad["World"]["GridCollection"]["Grids"]["9"]["Objects"]["12"]["Y"]=json!(24);
        let mut q=p.clone();bind(&bad,&mut q);let t=make(&bad);
        assert!(t.stage_switch626_road_r02_native_q4(scope(&t,WorkerAction::Stage),&enc(&q).unwrap()).is_err());
        let r=s.stage_switch626_road_r02_native_q4(e,&bytes).unwrap();assert_eq!(r.operation_count,6);assert_eq!(r.exact_field_changed_count,6);
        assert!(!r.product_writer_authorized);assert!(s.stage_switch626_road_r02_native_q4(e,&bytes).is_err());
        s.undo_typed_semantic_batch(scope(&s,WorkerAction::Stage)).unwrap();
        assert!(s.take_typed_semantic_decoded_once(scope(&s,WorkerAction::ExportEditedCopy)).is_err());
        s.redo_typed_semantic_batch(scope(&s,WorkerAction::Stage)).unwrap();
        let e=scope(&s,WorkerAction::ExportEditedCopy);let out=s.take_typed_semantic_decoded_once(e).unwrap();
        assert!(s.take_typed_semantic_decoded_once(e).is_err());
        let mut wanted=d.clone();let g=&mut wanted["World"]["GridCollection"]["Grids"]["9"];g["NextGridObjectID"]=json!(54);
        for o in p["objects"].as_array().unwrap(){g["Objects"][o["ID"].as_u64().unwrap().to_string()]=o.clone();}
        wanted["Player"]["ListInventories"]["0"]["Inventory"]["40100068"]["Amount"]=json!(7021);
        assert_eq!(serde_json::from_slice::<Value>(&out).unwrap(),wanted);assert_eq!(sha(&out),r.staged_decoded_sha256);
    }
    #[test]
    fn r02_native_exact6_debit4_undo_redo_one_time(){
        let (d,p)=fixture();let s=open(&d);let e=scope(&s,WorkerAction::Stage);
        let r=s.stage_switch624_road_r02_native_q4_archive(e,&enc(&p).unwrap()).unwrap();
        assert_eq!(r.operation_count,6);assert!(!r.product_writer_authorized);
        assert!(s.stage_switch624_road_r02_native_q4_archive(e,&enc(&p).unwrap()).is_err());
        s.undo_typed_semantic_batch(scope(&s,WorkerAction::Stage)).unwrap();
        assert!(s.take_typed_semantic_decoded_once(scope(&s,WorkerAction::ExportEditedCopy)).is_err());
        s.redo_typed_semantic_batch(scope(&s,WorkerAction::Stage)).unwrap();
        let e=scope(&s,WorkerAction::ExportEditedCopy);let out=s.take_typed_semantic_decoded_once(e).unwrap();
        assert!(s.take_typed_semantic_decoded_once(e).is_err());
        let mut wanted=d.clone();let g=&mut wanted["World"]["GridCollection"]["Grids"]["9"];
        g["NextGridObjectID"]=json!(54);
        for o in p["objects"].as_array().unwrap(){g["Objects"][o["ID"].as_u64().unwrap().to_string()]=o.clone();}
        wanted["Player"]["ListInventories"]["0"]["Inventory"]["40100068"]["Amount"]=json!(26);
        assert_eq!(serde_json::from_slice::<Value>(&out).unwrap(),wanted);
        assert_eq!(sha(&out),r.staged_decoded_sha256);
    }
    #[test]
    fn r02_reject_wrong_plan_cost_overlap_state_and_epoch(){
        let (d,p)=fixture();let s=open(&d);let e=scope(&s,WorkerAction::Stage);
        for (k,v) in [("contract",json!("bad")),("expectedNextId",json!(51)),("expectedAmount",json!(4)),
            ("sourceDecodedSha256",json!("bad")),("gridSha256",json!("bad")),
            ("inventoryEntrySha256",json!("bad")),("objects",json!([])),("refund",json!(1))]{
            let mut q=p.clone();q[k]=v;assert!(s.stage_switch624_road_r02_native_q4_archive(e,&enc(&q).unwrap()).is_err());
        }
        assert!(open(&d).stage_switch624_road_r02_native_q4_archive(e,&enc(&p).unwrap()).is_err());
        for k in 0..6{
            let mut d=d.clone();let mut q=p.clone();
            match k{
                0=>{d["World"]["GridCollection"]["Grids"]["9"]["Objects"]["12"]["X"]=json!(40);
                    d["World"]["GridCollection"]["Grids"]["9"]["Objects"]["12"]["Y"]=json!(24);},
                1=>d["World"]["GridCollection"]["DiffGrids"]["9"]=json!({}),
                2=>d["World"]["GridCollection"]["Grids"]["9"]["GridDefaultLayoutPath"]=json!("unknown"),
                3=>d["Player"]["ListInventories"]["0"]["Inventory"]["40100068"]["Amount"]=json!(29),
                4=>q["objects"][1]["State"]=Value::Null,
                _=>q["objects"].as_array_mut().unwrap().swap(1,2),
            }
            bind(&d,&mut q);let t=open(&d);assert!(t.stage_switch624_road_r02_native_q4_archive(scope(&t,WorkerAction::Stage),&enc(&q).unwrap()).is_err());
        }
        assert_eq!(s.receipt().unwrap().revision,0);
    }
}
