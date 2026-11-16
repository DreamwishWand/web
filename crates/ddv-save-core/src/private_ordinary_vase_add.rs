//! Owner-private exact ordinary Vase ADD. The private Lab must independently
//! approve the full source/definition/geometry/rights/affected closure and
//! expected output before calling. Digests are CAS, never product authority.
use super::*;
use serde_json::{Value,json};
const ITEM:u32=40000066;
const DEFINITION:&str="60f840fa471e3678b5f7a018466d150882ad7bddaece6ada9a86327fd1c0607a";
const CONTRACT:&str="wand.private.steam626.ordinary-vase-add-exact3@1";
fn hash(v:&[u8])->String{sha(v).iter().map(|n|format!("{n:02x}")).collect()}
fn digest(v:&Value)->CoreResult<[u8;32]>{
    let s=v.as_str().ok_or(denied("VASE_PLAN_SHA"))?;
    if s.len()!=64||!s.bytes().all(|b|matches!(b,b'0'..=b'9'|b'a'..=b'f')){
        return Err(denied("VASE_PLAN_SHA"));}
    let mut out=[0u8;32];for (i,n) in out.iter_mut().enumerate(){
        *n=u8::from_str_radix(&s[2*i..2*i+2],16).map_err(|_|denied("VASE_PLAN_SHA"))?;}
    if out==[0;32]{return Err(denied("VASE_PLAN_SHA"));} Ok(out)
}
fn uint(v:&Value)->CoreResult<u32>{v.as_u64().and_then(|n|u32::try_from(n).ok()).ok_or(denied("VASE_PLAN_UINT"))}
fn exact(b:&[u8],s:Span,v:&Value)->CoreResult<()>{
    if sha(&b[s.begin..s.end])!=digest(v)?{return Err(denied("VASE_RAW_CAS"));}Ok(())
}
fn read_value(b:&[u8],s:Span)->CoreResult<Value>{
    serde_json::from_slice(&b[s.begin..s.end]).map_err(|_|denied("VASE_VALUE"))
}
fn plan_parse(p:&[u8])->CoreResult<Value>{
    if p.is_empty()||p.len()>8192{return Err(denied("VASE_PLAN_BOUND"));}
    let v:Value=serde_json::from_slice(p).map_err(|_|denied("VASE_PLAN_JSON"))?;
    let keys=["contract","sourceDecodedSha256","definitionSha256","gridId","gridSha256",
        "objectsSha256","counterSha256","stockEntrySha256","oldStock","nextId","x","y",
        "expectedOutputSha256","subscriberRootSha256"];
    if !v.as_object().is_some_and(|m|m.len()==keys.len()&&keys.iter().all(|k|m.contains_key(*k)))||
        v["contract"]!=CONTRACT||v["definitionSha256"]!=DEFINITION||
        serde_json::to_vec(&v).map_err(|_|denied("VASE_PLAN_ENCODE"))?.as_slice()!=p{
        return Err(denied("VASE_PLAN_EXACT"));}
    Ok(v)
}
impl ProductSession{
    pub fn stage_private_steam626_ordinary_vase_add_exact3(&self,e:WorkerEnvelope,plan:&[u8])
        ->CoreResult<SemanticStageReceipt>{
        build_check(self)?;
        if self.worker_bound{return Err(denied("VASE_PRIVATE_ONLY"));}
        {let st=self.lock()?;check(self,&st,&e,WorkerAction::Stage)?;
         if st.semantic.is_some()||st.revision!=0||st.generation!=1{return Err(denied("VASE_FRESH_EPOCH"));}}
        let p=plan_parse(plan)?;
        if digest(&p["sourceDecodedSha256"])?!=self.sha{return Err(denied("VASE_SOURCE_CAS"));}
        let gid=uint(&p["gridId"])?;valid_id(gid)?;
        let next=uint(&p["nextId"])?;valid_id(next)?;
        let after=next.checked_add(1).filter(|n|*n<=i32::MAX as u32).ok_or(denied("VASE_COUNTER_BOUND"))?;
        let old=uint(&p["oldStock"])?;let new=old.checked_sub(1).ok_or(denied("VASE_STOCK"))?;
        valid_amount_decrease(old,new)?;
        let x=uint(&p["x"])?;let y=uint(&p["y"])?;
        if x%2!=0||y%2!=0||x>i32::MAX as u32-2||y>i32::MAX as u32-2{
            return Err(denied("VASE_POSE_BOUND"));}
        let entry_sha=digest(&p["stockEntrySha256"])?;
        let r=self.read_private_ordinary_adddel_dependencies(
            WorkerEnvelope{action:WorkerAction::ReadDomain,..e},ITEM,entry_sha,gid,None)?;
        let g=&r["ordinaryStoredGridReadSet"];let a=&r["ordinarySpawnAddressReadSet"];
        if r["target"]["oldAmount"]!=old||g["nextGridObjectId"]!=next||g["nextAfterAdd"]!=after||
           g["nextUnusedInStoredMap"]!=true||!g["selectedStoredObject"].is_null()||
           a["gridId"]!=gid||a["objectId"]!=next||a["knownSavedPathComplete"]!=true||
           a["noExactSavedSpawnAddress"]!=true{return Err(denied("VASE_READSET_CAS"));}
        let b=&self.decoded;let root=indexed_read::roots(b)?;
        let f=|s,k|object_field(b,s,k);
        let village=array_element(b,f(root.world,"Villages")?,0)?;
        let area=f(f(village,"Areas")?,"6")?;
        raw_boolean_true(b,f(area,"Unlocked")?)?;
        if read_value(b,f(area,"GridIDs")?)?!=json!([gid]){return Err(denied("VASE_AREA_ROOT"));}
        let grid_key=gid.to_string();
        let grid=f(f(f(root.world,"GridCollection")?,"Grids")?,&grid_key)?;
        if read_value(b,f(grid,"GridDataPath")?)?!="GridData/Villages/Village04-DarkLevel-GridData.json"||
           read_value(b,f(grid,"GridDefaultLayoutPath")?)?!=""||
           number(b,f(grid,"TessellationFactor")?)?!=2{return Err(denied("VASE_GRID_DEFINITION"));}
        let objs=f(grid,"Objects")?;let counter=f(grid,"NextGridObjectID")?;
        let route=f(f(root.player,"ListInventories")?,"0")?;
        inventory_route(b,route,0,ITEM,"ItemType_Furniture")?;
        let stock=f(f(route,"Inventory")?,"40000066")?;
        exact(b,grid,&p["gridSha256"])?;exact(b,objs,&p["objectsSha256"])?;
        exact(b,counter,&p["counterSha256"])?;exact(b,stock,&p["stockEntrySha256"])?;
        if number(b,counter)?!=next as u64{return Err(denied("VASE_COUNTER_CAS"));}
        // Bind the independently reviewed affected roots; no replay or
        // inference of runtime rights, event or geometry authority from SHA.
        let top=Span{begin:indexed_read::skip_ws(b,0),end:b.len()};
        let end=indexed_read::value_end(b,top.begin)?;
        let top=Span{begin:top.begin,end};
        let roots=&p["subscriberRootSha256"];
        if !roots.as_object().is_some_and(|m|m.len()==5){return Err(denied("VASE_AFFECTED_SHAPE"));}
        for (s,k) in [(root.world,"MissionSlots"),(root.player,"AchievementsData"),
            (root.player,"EvolveStatesProfile"),(top,"ConditionalEventHistory"),(root.world,"QuestInfo")]{
            exact(b,f(s,k)?,&roots[k])?;
        }
        // Existing append helper expects nonempty map; reject empty, existing
        // key/anchor, malformed position. Other footprints are external scope.
        let mut pos=objs.begin+1;let mut count=0;
        while let Some((key,o))=next_object_member(b,objs,&mut pos)?{
            count+=1;if key==next.to_string()||count>16384{return Err(denied("VASE_OBJECT_CAS"));}
            if read_value(b,f(o,"X")?)?==x&&read_value(b,f(o,"Y")?)?==y{return Err(denied("VASE_OCCUPIED_ANCHOR"));}
        }
        if count==0{return Err(denied("VASE_NONEMPTY_MAP"));}
        let record=json!({"ID":next,"ItemID":ITEM,"X":x,"Y":y,"Orientation":"GridOrientation_Up","State":null});
        let append=super::switch624_road_rm01::append_road_objects(b,objs,&[record])?;
        let bump=Replacement{span:counter,old:b[counter.begin..counter.end].to_vec(),new:after.to_string().into_bytes()};
        let debit=validate_old_amount(b,f(stock,"Amount")?,old,new)?;
        self.commit_semantic_replacements(e,vec![append,bump,debit],3,Some(digest(&p["expectedOutputSha256"])?))
    }
}
#[cfg(test)]
mod ordinary_vase_tests{
    use super::*;use crate::{BuildIdentity,SessionReceipt};
    fn doc()->Value{json!({"GameInfo":{"Version":626},"World":{
        "Villages":[{"Areas":{"6":{"Unlocked":true,"GridIDs":[7]}}}],
        "GridCollection":{"Grids":{"7":{"ID":7,"GridDataPath":"GridData/Villages/Village04-DarkLevel-GridData.json",
          "GridDefaultLayoutPath":"","TessellationFactor":2,"NextGridObjectID":9,
          "Objects":{"4":{"ID":4,"ItemID":40000001,"X":2,"Y":2,"Orientation":"GridOrientation_Up","State":null}}}},"DiffGrids":{}},
        "MissionSlots":{},"QuestInfo":{}},"Player":{
        "ListInventories":{"0":{"ID":0,"CompatibleItemType":"ItemType_Furniture",
          "CompatibleFurnitureTypes":{"List":["FurnitureItemType_Default"]},"Inventory":{"40000066":{"Amount":3,"Marker":"Keep"}}}},
        "AchievementsData":[],"EvolveStatesProfile":{"EvolveProgressState":{}}},
        "ConditionalEventHistory":{"ActiveEvents":{},"InboxSpawnCount":{}},"Unknown":{"keep":true}})}
    fn enc(v:&Value)->Vec<u8>{serde_json::to_vec(v).unwrap()}
    fn h(v:&Value)->String{hash(&enc(v))}
    fn open(d:&Value)->ProductSession{ProductSession::open_decoded_readonly(enc(d),BuildIdentity{
        platform:Platform::SteamWindows,build_kind:BuildKind::SteamFullVersion,build_id:EXACT_STEAM.into(),schema:626,externally_attested:true}).unwrap()}
    fn env(r:SessionReceipt,a:WorkerAction)->WorkerEnvelope{WorkerEnvelope{contract:PRODUCT_WORKER_CONTRACT,
        session_id:r.session_id,expected_revision:r.revision,expected_index_generation:r.index_generation,
        expected_decoded_sha256:r.decoded_sha256,action:a}}
    fn plan(d:&Value)->(Value,Vec<u8>){
        let g=&d["World"]["GridCollection"]["Grids"]["7"];let mut out=d.clone();
        out["World"]["GridCollection"]["Grids"]["7"]["Objects"]["9"]=json!({"ID":9,"ItemID":ITEM,"X":8,"Y":8,"Orientation":"GridOrientation_Up","State":null});
        out["World"]["GridCollection"]["Grids"]["7"]["NextGridObjectID"]=json!(10);
        out["Player"]["ListInventories"]["0"]["Inventory"]["40000066"]["Amount"]=json!(2);
        let bytes=enc(&out);
        (json!({"contract":CONTRACT,"sourceDecodedSha256":h(d),"definitionSha256":DEFINITION,
            "gridId":7,"gridSha256":h(g),"objectsSha256":h(&g["Objects"]),"counterSha256":h(&g["NextGridObjectID"]),
            "stockEntrySha256":h(&d["Player"]["ListInventories"]["0"]["Inventory"]["40000066"]),
            "oldStock":3,"nextId":9,"x":8,"y":8,"expectedOutputSha256":hash(&bytes),
            "subscriberRootSha256":{"MissionSlots":h(&d["World"]["MissionSlots"]),"QuestInfo":h(&d["World"]["QuestInfo"]),
             "AchievementsData":h(&d["Player"]["AchievementsData"]),"EvolveStatesProfile":h(&d["Player"]["EvolveStatesProfile"]),
             "ConditionalEventHistory":h(&d["ConditionalEventHistory"])}}),bytes)
    }
    #[test]fn exact3_stage_undo_redo_export_and_fail_closed(){
        let d=doc();let (p,expected)=plan(&d);let s=open(&d);let before=s.receipt().unwrap();let e=env(before,WorkerAction::Stage);
        for (k,v) in [("oldStock",json!(2)),("nextId",json!(8)),("x",json!(3)),("x",json!(2)),("x",json!(10)),
            ("gridId",json!(8)),("definitionSha256",json!("wrong")),("sourceDecodedSha256",json!("0".repeat(64))),
            ("expectedOutputSha256",json!("a".repeat(64))),("stockEntrySha256",json!("a".repeat(64))),
            ("gridSha256",json!("a".repeat(64))),("objectsSha256",json!("a".repeat(64))),("counterSha256",json!("a".repeat(64)))]{
            let mut q=p.clone();q[k]=v;assert!(s.stage_private_steam626_ordinary_vase_add_exact3(e,&enc(&q)).is_err(),"{k}");}
        let mut q=p.clone();q["subscriberRootSha256"]["QuestInfo"]=json!("a".repeat(64));
        assert!(s.stage_private_steam626_ordinary_vase_add_exact3(e,&enc(&q)).is_err());
        let mut stale=e;stale.expected_revision+=1;
        assert!(s.stage_private_steam626_ordinary_vase_add_exact3(stale,&enc(&p)).is_err());
        assert!(open(&d).stage_private_steam626_ordinary_vase_add_exact3(e,&enc(&p)).is_err());
        assert_eq!(s.receipt().unwrap(),before);
        let r=s.stage_private_steam626_ordinary_vase_add_exact3(e,&enc(&p)).unwrap();
        assert_eq!(r.operation_count,3);assert_eq!(r.exact_field_changed_count,3);assert!(!r.product_writer_authorized);
        assert_eq!(r.staged_decoded_sha256,sha(&expected));assert!(s.stage_private_steam626_ordinary_vase_add_exact3(e,&enc(&p)).is_err());
        s.undo_typed_semantic_batch(env(s.receipt().unwrap(),WorkerAction::Stage)).unwrap();
        assert!(s.take_typed_semantic_decoded_once(env(s.receipt().unwrap(),WorkerAction::ExportEditedCopy)).is_err());
        s.redo_typed_semantic_batch(env(s.receipt().unwrap(),WorkerAction::Stage)).unwrap();
        let export=env(s.receipt().unwrap(),WorkerAction::ExportEditedCopy);
        assert_eq!(s.take_typed_semantic_decoded_once(export).unwrap(),expected);
        assert!(s.take_typed_semantic_decoded_once(export).is_err());
    }

    #[test]
    fn qa_vase_exact3_independent_rebound_and_lifecycle(){
        let mut d=doc();
        d["Unknown"]=json!({"keep":[true,{"opaque":"preserve"}],"count":17});
        d["Player"]["ListInventories"]["0"]["Inventory"]["40000066"]["Extra"]=json!({"untouched":true});
        let (p,_)=plan(&d);
        let mut expected=d.clone();
        expected["World"]["GridCollection"]["Grids"]["7"]["Objects"]["9"]=json!({"ID":9,"ItemID":40000066,"X":8,"Y":8,"Orientation":"GridOrientation_Up","State":null});
        expected["World"]["GridCollection"]["Grids"]["7"]["NextGridObjectID"]=json!(10);
        expected["Player"]["ListInventories"]["0"]["Inventory"]["40000066"]["Amount"]=json!(2);
        let expected=enc(&expected);
        let s=open(&d);let b=s.receipt().unwrap();let e=env(b,WorkerAction::Stage);
        let reject=|q:&Value|{assert!(s.stage_private_steam626_ordinary_vase_add_exact3(e,&enc(q)).is_err());assert_eq!(s.receipt().unwrap(),b);};
        for (k,v) in [("contract",json!("foreign")),("oldStock",json!("3")),("nextId",json!(0)),("x",json!(4294967294u64)),("y",json!(9)),("gridId",json!(0)),("expectedOutputSha256",json!("f".repeat(64))),("sourceDecodedSha256",json!("f".repeat(64)))]{
            let mut q=p.clone();q[k]=v;reject(&q);
        }
        for k in ["MissionSlots","QuestInfo","AchievementsData","EvolveStatesProfile","ConditionalEventHistory"] {
            let mut q=p.clone();q["subscriberRootSha256"][k]=json!("f".repeat(64));reject(&q);
        }
        let mut q=p.clone();q["authority"]=json!(true);reject(&q);
        let mut q=p.clone();q.as_object_mut().unwrap().remove("expectedOutputSha256");reject(&q);
        let pretty=serde_json::to_vec_pretty(&p).unwrap();assert!(s.stage_private_steam626_ordinary_vase_add_exact3(e,&pretty).is_err());
        assert!(s.stage_private_steam626_ordinary_vase_add_exact3(WorkerEnvelope{expected_index_generation:2,..e},&enc(&p)).is_err());
        assert!(s.stage_private_steam626_ordinary_vase_add_exact3(WorkerEnvelope{action:WorkerAction::ReadDomain,..e},&enc(&p)).is_err());
        assert!(open(&d).stage_private_steam626_ordinary_vase_add_exact3(e,&enc(&p)).is_err());
        assert_eq!(s.receipt().unwrap(),b);
        // Rebind hashes to fresh modified documents. A new digest is not permission.
        let mut cases=Vec::new();
        let mut q=d.clone();q["World"]["Villages"][0]["Areas"]["6"]["Unlocked"]=json!(false);cases.push(q);
        let mut q=d.clone();q["World"]["GridCollection"]["Grids"]["7"]["GridDefaultLayoutPath"]=json!("overlay");cases.push(q);
        let mut q=d.clone();q["World"]["GridCollection"]["Grids"]["7"]["Objects"]["4"]["X"]=json!(8);q["World"]["GridCollection"]["Grids"]["7"]["Objects"]["4"]["Y"]=json!(8);cases.push(q);
        let mut q=d.clone();q["World"]["GridCollection"]["Grids"]["7"]["Objects"]["9"]=json!({"ID":9,"ItemID":40000001,"X":14,"Y":14,"Orientation":"GridOrientation_Up","State":null});cases.push(q);
        let mut q=d.clone();q["World"]["GridCollection"]["Grids"]["7"]["NextGridObjectID"]=json!(8);cases.push(q);
        let mut q=d.clone();q["Player"]["ListInventories"]["0"]["Inventory"]["40000066"]["Amount"]=json!(1);cases.push(q);
        for q in cases {let (p,_)=plan(&q);let t=open(&q);let before=t.receipt().unwrap();assert!(t.stage_private_steam626_ordinary_vase_add_exact3(env(before,WorkerAction::Stage),&enc(&p)).is_err());assert_eq!(t.receipt().unwrap(),before);}
        let r=s.stage_private_steam626_ordinary_vase_add_exact3(e,&enc(&p)).unwrap();
        assert_eq!((r.operation_count,r.exact_field_changed_count),(3,3));assert!(!r.product_writer_authorized);assert!(!r.original_overwrite_authorized);assert_eq!(r.staged_decoded_sha256,sha(&expected));
        assert!(s.stage_private_steam626_ordinary_vase_add_exact3(e,&enc(&p)).is_err());
        s.undo_typed_semantic_batch(env(s.receipt().unwrap(),WorkerAction::Stage)).unwrap();
        assert!(s.take_typed_semantic_decoded_once(env(s.receipt().unwrap(),WorkerAction::ExportEditedCopy)).is_err());
        s.redo_typed_semantic_batch(env(s.receipt().unwrap(),WorkerAction::Stage)).unwrap();
        let ex=env(s.receipt().unwrap(),WorkerAction::ExportEditedCopy);
        assert_eq!(s.take_typed_semantic_decoded_once(ex).unwrap(),expected);
        assert!(s.take_typed_semantic_decoded_once(ex).is_err());
    }

}
