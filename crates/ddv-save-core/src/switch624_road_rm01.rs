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
fn plan_parse(bytes:&[u8])->CoreResult<Value>{
    if bytes.is_empty()||bytes.len()>16384{return Err(denied("RM01_PLAN_BOUNDS"));}
    let v:Value=serde_json::from_slice(bytes).map_err(|_|denied("RM01_PLAN_JSON"))?;
    if enc(&v)?.as_slice()!=bytes{return Err(denied("RM01_PLAN_NONCANONICAL"));}
    let keys=["contract","sourceDecodedSha256","gridId","retainedId","movedId",
        "expectedNextId","expectedAmount","gridSha256","inventoryEntrySha256","objects"];
    let m=v.as_object().ok_or(denied("RM01_PLAN_OBJECT"))?;
    if m.len()!=keys.len()||!keys.iter().all(|k|m.contains_key(*k))||
       v["contract"]!="wand.private.switch624.road-rm01-archive@1"{return Err(denied("RM01_PLAN_FIELDS"));}
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
    let mut insert=Vec::new();
    for o in &plan[2..]{let id=uint(&o["ID"])?;insert.extend_from_slice(format!(",\"{id}\":").as_bytes());insert.extend_from_slice(&enc(o)?);}
    insert.push(b'}');
    let close=Span{begin:objs.end-1,end:objs.end};
    Ok(vec![repl(b,object_field(b,ms,"X")?,enc(&plan[1]["X"])?)?,
        repl(b,object_field(b,ms,"Y")?,enc(&plan[1]["Y"])?)?,
        repl(b,object_field(b,ms,"State")?,enc(&plan[1]["State"])?)?,
        repl(b,close,insert)?,repl(b,counter,n3.to_string().into_bytes())?,debit])
}
impl ProductSession{
    pub fn stage_switch624_road_rm01_archive(&self,e:WorkerEnvelope,plan:&[u8])->CoreResult<SemanticStageReceipt>{
        let build=&self.native_source_build;
        if build.platform!=Platform::Switch||build.build_kind!=BuildKind::SwitchBid||
           build.build_id!=BID||build.schema!=624||!build.externally_attested||self.worker_bound{
            return Err(denied("RM01_EXACT_SWITCH624_REQUIRED"));
        }
        let p=plan_parse(plan)?;
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
