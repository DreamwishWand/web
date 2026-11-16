//! ACT1037 exact inverse of a separately accepted ordinary Vase ADD.
//! Native-private only: external Private Lab binds the derivative, fixed
//! definition, legality and affected closure before calling. No generic
//! remove/credit authorization, product ABI, or counter rollback.
use super::*;
const DELETE_CONTRACT:&str="wand.private.steam626.ordinary-vase-delete-exact2@1";
fn delete_plan_parse(p:&[u8])->CoreResult<Value>{
    if p.is_empty()||p.len()>8192{return Err(denied("VASE_DELETE_PLAN_BOUND"));}
    let v:Value=serde_json::from_slice(p).map_err(|_|denied("VASE_DELETE_PLAN_JSON"))?;
    let keys=["contract","sourceDecodedSha256","definitionSha256","gridId","gridSha256",
        "objectsSha256","counterSha256","stockEntrySha256","oldStock","nextId","objectId",
        "objectSha256","x","y","expectedOutputSha256","subscriberRootSha256"];
    if !v.as_object().is_some_and(|m|m.len()==keys.len()&&keys.iter().all(|k|m.contains_key(*k)))||
        v["contract"]!=DELETE_CONTRACT||v["definitionSha256"]!=DEFINITION||
        serde_json::to_vec(&v).map_err(|_|denied("VASE_DELETE_PLAN_ENCODE"))?.as_slice()!=p{
        return Err(denied("VASE_DELETE_PLAN_EXACT"));}
    Ok(v)
}
impl ProductSession{
    pub fn stage_private_steam626_ordinary_vase_delete_exact2(&self,e:WorkerEnvelope,plan:&[u8])
        ->CoreResult<SemanticStageReceipt>{
        build_check(self)?;
        if self.worker_bound{return Err(denied("VASE_DELETE_PRIVATE_ONLY"));}
        {let st=self.lock()?;check(self,&st,&e,WorkerAction::Stage)?;
         if st.semantic.is_some()||st.revision!=0||st.generation!=1{return Err(denied("VASE_DELETE_FRESH_EPOCH"));}}
        let p=delete_plan_parse(plan)?;
        if digest(&p["sourceDecodedSha256"])?!=self.sha{return Err(denied("VASE_DELETE_SOURCE_CAS"));}
        let gid=uint(&p["gridId"])?;valid_id(gid)?;
        let oid=uint(&p["objectId"])?;valid_id(oid)?;
        let next=uint(&p["nextId"])?;
        // Only the most recent appended member from this inverse scope.
        if oid.checked_add(1)!=Some(next)||next>i32::MAX as u32{return Err(denied("VASE_DELETE_COUNTER_SCOPE"));}
        let old=uint(&p["oldStock"])?;
        let new=old.checked_add(1).filter(|n|*n as u64<=MAX_CONSERVATIVE_AMOUNT&&old>0)
            .ok_or(denied("VASE_DELETE_CREDIT_BOUND"))?;
        let x=uint(&p["x"])?;let y=uint(&p["y"])?;
        if x%2!=0||y%2!=0||x>i32::MAX as u32-2||y>i32::MAX as u32-2{return Err(denied("VASE_DELETE_POSE"));}
        let r=self.read_private_ordinary_adddel_dependencies(
            WorkerEnvelope{action:WorkerAction::ReadDomain,..e},ITEM,digest(&p["stockEntrySha256"])?,gid,Some(oid))?;
        let g=&r["ordinaryStoredGridReadSet"];let a=&r["ordinarySpawnAddressReadSet"];
        if r["target"]["oldAmount"]!=old||g["nextGridObjectId"]!=next||g["nextAfterDelete"]!=next||
           g["nextUnusedInStoredMap"]!=true||g["selectedStoredObject"]["objectId"]!=oid||
           g["selectedStoredObject"]["itemId"]!=ITEM||
           g["selectedStoredObject"]["recordSha256"]!=p["objectSha256"]||
           a["gridId"]!=gid||a["objectId"]!=oid||a["knownSavedPathComplete"]!=true||
           a["noExactSavedSpawnAddress"]!=true{return Err(denied("VASE_DELETE_READSET_CAS"));}
        let b=&self.decoded;let root=indexed_read::roots(b)?;let f=|s,k|object_field(b,s,k);
        let village=array_element(b,f(root.world,"Villages")?,0)?;
        let area=f(f(village,"Areas")?,"6")?;
        raw_boolean_true(b,f(area,"Unlocked")?)?;
        if read_value(b,f(area,"GridIDs")?)?!=json!([gid]){return Err(denied("VASE_DELETE_AREA_ROOT"));}
        let grid_key=gid.to_string();
        let grid=f(f(f(root.world,"GridCollection")?,"Grids")?,&grid_key)?;
        if read_value(b,f(grid,"GridDataPath")?)?!="GridData/Villages/Village04-DarkLevel-GridData.json"||
           read_value(b,f(grid,"GridDefaultLayoutPath")?)?!=""||
           number(b,f(grid,"TessellationFactor")?)?!=2{return Err(denied("VASE_DELETE_GRID_DEFINITION"));}
        let objs=f(grid,"Objects")?;let counter=f(grid,"NextGridObjectID")?;
        let route=f(f(root.player,"ListInventories")?,"0")?;
        inventory_route(b,route,0,ITEM,"ItemType_Furniture")?;
        let stock=f(f(route,"Inventory")?,"40000066")?;
        exact(b,grid,&p["gridSha256"])?;exact(b,objs,&p["objectsSha256"])?;
        exact(b,counter,&p["counterSha256"])?;exact(b,stock,&p["stockEntrySha256"])?;
        if number(b,counter)?!=next as u64||read_value(b,f(stock,"Marker")?)?!="ItemMarker_None"{
            return Err(denied("VASE_DELETE_COUNTER_OR_MARKER"));}
        // Rebind the current exact five external affected roots, not the
        // original ADD session. No event replay or historic epoch transfer.
        let begin=indexed_read::skip_ws(b,0);let top=Span{begin,end:indexed_read::value_end(b,begin)?};
        let roots=&p["subscriberRootSha256"];
        if !roots.as_object().is_some_and(|m|m.len()==5){return Err(denied("VASE_DELETE_AFFECTED_SHAPE"));}
        for(s,k)in [(root.world,"MissionSlots"),(root.player,"AchievementsData"),
            (root.player,"EvolveStatesProfile"),(top,"ConditionalEventHistory"),(root.world,"QuestInfo")]{
            exact(b,f(s,k)?,&roots[k])?;
        }
        let record=json!({"ID":oid,"ItemID":ITEM,"X":x,"Y":y,"Orientation":"GridOrientation_Up","State":null});
        // Inverse of the accepted append helper: delete its final comma +
        // exact final member, preserve every earlier byte and the closing
        // brace. First/middle/only-member or noncanonical record is outside
        // this fixed derivative scope.
        let mut pos=objs.begin+1;let mut count=0;let mut remove=None;
        loop{
            let before=pos;
            let Some((k,o))=next_object_member(b,objs,&mut pos)? else{break};
            count+=1;if count>16384{return Err(denied("VASE_DELETE_OBJECT_BOUND"));}
            if k==oid.to_string(){
                if count<2||pos!=objs.end-1||before<=objs.begin+1||b.get(before-1)!=Some(&b',')||
                    read_value(b,o)?!=record||serde_json::to_vec(&record).map_err(|_|denied("VASE_DELETE_ENCODE"))?.as_slice()!=&b[o.begin..o.end]{
                    return Err(denied("VASE_DELETE_FINAL_MEMBER"));
                }
                exact(b,o,&p["objectSha256"])?;
                remove=Some(Span{begin:before-1,end:o.end});
            }
        }
        let span=remove.ok_or(denied("VASE_DELETE_OBJECT_MISSING"))?;
        let amount=f(stock,"Amount")?;
        if number(b,amount)?!=old as u64{return Err(denied("VASE_DELETE_STOCK_CAS"));}
        let edits=vec![Replacement{span,old:b[span.begin..span.end].to_vec(),new:Vec::new()},
            Replacement{span:amount,old:b[amount.begin..amount.end].to_vec(),new:new.to_string().into_bytes()}];
        self.commit_semantic_replacements(e,edits,2,Some(digest(&p["expectedOutputSha256"])?))
    }
}
#[cfg(test)]
mod ordinary_vase_tests{
    use super::*;
    use super::super::ordinary_vase_tests::{doc,plan,open,env};
    fn enc(v:&Value)->Vec<u8>{serde_json::to_vec(v).unwrap()}
    fn h(v:&Value)->String{hash(&enc(v))}
    fn derived()->(Value,Value){
        let mut d=doc();d["Player"]["ListInventories"]["0"]["Inventory"]["40000066"]["Marker"]=json!("ItemMarker_None");
        let (_,out)=plan(&d);let v:Value=serde_json::from_slice(&out).unwrap();
        d["World"]["GridCollection"]["Grids"]["7"]["NextGridObjectID"]=json!(10);
        (v,d)
    }
    fn dp(d:&Value,expected:&Value)->Value{
        let g=&d["World"]["GridCollection"]["Grids"]["7"];
        json!({"contract":DELETE_CONTRACT,"sourceDecodedSha256":h(d),"definitionSha256":DEFINITION,
            "gridId":7,"gridSha256":h(g),"objectsSha256":h(&g["Objects"]),"counterSha256":h(&g["NextGridObjectID"]),
            "stockEntrySha256":h(&d["Player"]["ListInventories"]["0"]["Inventory"]["40000066"]),
            "oldStock":2,"nextId":10,"objectId":9,"objectSha256":h(&g["Objects"]["9"]),"x":8,"y":8,
            "expectedOutputSha256":h(expected),"subscriberRootSha256":{
             "MissionSlots":h(&d["World"]["MissionSlots"]),"QuestInfo":h(&d["World"]["QuestInfo"]),
             "AchievementsData":h(&d["Player"]["AchievementsData"]),"EvolveStatesProfile":h(&d["Player"]["EvolveStatesProfile"]),
             "ConditionalEventHistory":h(&d["ConditionalEventHistory"])}})
    }
    #[test]
    fn delete_exact2_counter_invariant_lifecycle(){
        let(d,want)=derived();let p=dp(&d,&want);let s=open(&d);let before=s.receipt().unwrap();
        let e=env(before,WorkerAction::Stage);
        for(k,v)in [("contract",json!(CONTRACT)),("objectId",json!(4)),("nextId",json!(9)),
            ("oldStock",json!(3)),("x",json!(10)),("definitionSha256",json!("bad")),
            ("gridSha256",json!("a".repeat(64))),("objectSha256",json!("a".repeat(64))),
            ("objectsSha256",json!("a".repeat(64))),("counterSha256",json!("a".repeat(64))),
            ("stockEntrySha256",json!("a".repeat(64))),("sourceDecodedSha256",json!("a".repeat(64))),
            ("expectedOutputSha256",json!("a".repeat(64)))]{
            let mut q=p.clone();q[k]=v;assert!(s.stage_private_steam626_ordinary_vase_delete_exact2(e,&enc(&q)).is_err(),"{k}");
        }
        let mut q=p.clone();q["subscriberRootSha256"]["QuestInfo"]=json!("a".repeat(64));
        assert!(s.stage_private_steam626_ordinary_vase_delete_exact2(e,&enc(&q)).is_err());
        assert!(open(&d).stage_private_steam626_ordinary_vase_delete_exact2(e,&enc(&p)).is_err());
        assert!(s.stage_private_steam626_ordinary_vase_delete_exact2(WorkerEnvelope{expected_revision:1,..e},&enc(&p)).is_err());
        assert_eq!(s.receipt().unwrap(),before);
        let r=s.stage_private_steam626_ordinary_vase_delete_exact2(e,&enc(&p)).unwrap();
        assert_eq!((r.operation_count,r.exact_field_changed_count),(2,2));assert!(!r.product_writer_authorized);
        assert_eq!(r.staged_decoded_sha256,sha(&enc(&want)));
        assert!(s.stage_private_steam626_ordinary_vase_delete_exact2(e,&enc(&p)).is_err());
        s.undo_typed_semantic_batch(env(s.receipt().unwrap(),WorkerAction::Stage)).unwrap();
        assert!(s.take_typed_semantic_decoded_once(env(s.receipt().unwrap(),WorkerAction::ExportEditedCopy)).is_err());
        s.redo_typed_semantic_batch(env(s.receipt().unwrap(),WorkerAction::Stage)).unwrap();
        let ex=env(s.receipt().unwrap(),WorkerAction::ExportEditedCopy);
        assert_eq!(s.take_typed_semantic_decoded_once(ex).unwrap(),enc(&want));
        assert!(s.take_typed_semantic_decoded_once(ex).is_err());
    }
    #[test]
    fn delete_current_rebound_shape_denials(){
        let(d,want)=derived();
        for i in 0..7{
            let mut q=d.clone();
            let obj=&mut q["World"]["GridCollection"]["Grids"]["7"]["Objects"]["9"];
            match i{
                0=>obj["State"]=json!({}),1=>obj["From"]=json!(null),
                2=>obj["Orientation"]=json!("GridOrientation_Down"),3=>obj["ItemID"]=json!(40000001),
                4=>q["World"]["GridCollection"]["Grids"]["7"]["Objects"]["4"]=Value::Null,
                5=>q["ConditionalEventHistory"]["ActiveEvents"]["1"]=json!({"SpawnState":{"SpawnedObjects":[{"GridID":7,"GridObjectID":9}]}}),
                _=>q["Player"]["ListInventories"]["0"]["Inventory"]["40000066"]["Marker"]=json!("wrong"),
            }
            let p=dp(&q,&want);let s=open(&q);let before=s.receipt().unwrap();
            assert!(s.stage_private_steam626_ordinary_vase_delete_exact2(env(before.clone(),WorkerAction::Stage),&enc(&p)).is_err(),"{i}");
            assert_eq!(s.receipt().unwrap(),before);
        }
    }
}
