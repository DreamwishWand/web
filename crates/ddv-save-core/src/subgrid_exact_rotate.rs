//! ACT797: Native-private exact existing same-anchor SubGrid parent rotation.
//! External scoped geometry/rights/provider and Native legality remain gates
//! for actual V2. No generic layer grant, Move, child lifecycle or Writer.
use super::*;
use serde_json::{json,Value};
const SWITCH:&str="9A239D3DB569756D";
const ITEM:u32=40000178;
const STEAM_CONTRACT:&str="wand.private.steam626.subgrid-same-anchor-up-right@1";
const SWITCH_CONTRACT:&str="wand.private.switch626.subgrid-same-anchor-up-right@1";
const STEAM_MOVE:&str="wand.private.steam626.subgrid-exact-up-move@1";
const SWITCH_MOVE:&str="wand.private.switch626.subgrid-exact-up-move@1";
fn hex_digest(b:&[u8])->String{sha(b).iter().map(|x|format!("{x:02x}")).collect()}
fn raw(b:&[u8],s:Span)->CoreResult<&[u8]>{b.get(s.begin..s.end).ok_or(denied("SUBGRID_ROTATE_SPAN"))}
fn value(b:&[u8],s:Span)->CoreResult<Value>{
    if s.end.saturating_sub(s.begin)>16384{return Err(denied("SUBGRID_ROTATE_VALUE_BOUND"));}
    serde_json::from_slice(raw(b,s)?).map_err(|_|denied("SUBGRID_ROTATE_VALUE"))
}
fn uint(v:&Value)->CoreResult<u32>{v.as_u64().and_then(|n|u32::try_from(n).ok()).ok_or(denied("SUBGRID_ROTATE_UINT"))}
fn num(b:&[u8],s:Span,k:&str)->CoreResult<u32>{
    u32::try_from(number(b,object_field(b,s,k)?)?).map_err(|_|denied("SUBGRID_ROTATE_UINT"))
}
fn enc(v:&Value)->CoreResult<Vec<u8>>{serde_json::to_vec(v).map_err(|_|denied("SUBGRID_ROTATE_ENCODE"))}
fn parse(bytes:&[u8],contract:&str)->CoreResult<Value>{
    if bytes.is_empty()||bytes.len()>16384{return Err(denied("SUBGRID_ROTATE_PLAN_BOUNDS"));}
    let v:Value=serde_json::from_slice(bytes).map_err(|_|denied("SUBGRID_ROTATE_PLAN_JSON"))?;
    if enc(&v)?.as_slice()!=bytes{return Err(denied("SUBGRID_ROTATE_PLAN_NONCANONICAL"));}
    let fields=["contract","sourceDecodedSha256","gridCollectionSha256","gridId","gridSha256",
        "objectId","objectSha256","itemId","expectedX","expectedY","expectedNextId",
        "childId","childSha256","expectedOrientation","newOrientation"];
    let m=v.as_object().ok_or(denied("SUBGRID_ROTATE_PLAN_OBJECT"))?;
    if m.len()!=fields.len()||!fields.iter().all(|k|m.contains_key(*k))||v["contract"]!=contract||
       v["itemId"]!=ITEM||v["expectedOrientation"]!="GridOrientation_Up"||
       v["newOrientation"]!="GridOrientation_Right"{
        return Err(denied("SUBGRID_ROTATE_PLAN_FIELDS"));
    }
    Ok(v)
}
fn collect_target(s:&ProductSession,p:&Value)->CoreResult<Span>{
    let b=&s.decoded;
    if p["sourceDecodedSha256"]!=hex_digest(b){return Err(denied("SUBGRID_ROTATE_SOURCE_CAS"));}
    let g=uint(&p["gridId"])?;let id=uint(&p["objectId"])?;let child=uint(&p["childId"])?;
    let x=uint(&p["expectedX"])?;let y=uint(&p["expectedY"])?;let next=uint(&p["expectedNextId"])?;
    if g==0||child==0||g==child||id==0||id>=next||next>i32::MAX as u32||
       x>i32::MAX as u32||y>i32::MAX as u32{
        return Err(denied("SUBGRID_ROTATE_TARGET_BOUNDS"));
    }
    let roots=indexed_read::roots(b)?;
    let gc=object_field(b,roots.world,"GridCollection")?;
    if p["gridCollectionSha256"]!=hex_digest(raw(b,gc)?){return Err(denied("SUBGRID_ROTATE_COLLECTION_CAS"));}
    let grids=object_field(b,gc,"Grids")?;
    let grid=object_field(b,grids,&g.to_string())?;
    if num(b,grid,"ID")?!=g||num(b,grid,"NextGridObjectID")?!=next||
       num(b,grid,"TessellationFactor")?!=2||p["gridSha256"]!=hex_digest(raw(b,grid)?){
        return Err(denied("SUBGRID_ROTATE_GRID_CAS"));
    }
    let obj=object_field(b,object_field(b,grid,"Objects")?,&id.to_string())?;
    if num(b,obj,"ID")?!=id||num(b,obj,"ItemID")?!=ITEM||
       num(b,obj,"X")?!=x||num(b,obj,"Y")?!=y||p["objectSha256"]!=hex_digest(raw(b,obj)?){
        return Err(denied("SUBGRID_ROTATE_OBJECT_CAS"));
    }
    let state=object_field(b,obj,"State")?;
    if value(b,state)?!=json!({"SubGrid":{"GridID":child,"DesignID":null}}){
        return Err(denied("SUBGRID_ROTATE_BOUND_STATE"));
    }
    let child_grid=object_field(b,grids,&child.to_string())?;
    if num(b,child_grid,"ID")?!=child||num(b,child_grid,"NextGridObjectID")?!=0||
       value(b,object_field(b,child_grid,"GridDefaultLayoutPath")?)?!=""||
       p["childSha256"]!=hex_digest(raw(b,child_grid)?){
        return Err(denied("SUBGRID_ROTATE_CHILD_CAS"));
    }
    let child_objects=object_field(b,child_grid,"Objects")?;
    let mut pos=child_objects.begin+1;
    if next_object_member(b,child_objects,&mut pos)?.is_some(){return Err(denied("SUBGRID_ROTATE_CHILD_NONEMPTY"));}
    // A direct DiffGrids overlay on either target is outside the fixed
    // source scope; the external readset must close other effective links.
    let diffs=object_field(b,gc,"DiffGrids")?;
    let mut pos=diffs.begin+1;let mut count=0;
    while let Some((k,_))=next_object_member(b,diffs,&mut pos)?{
        count+=1;if count>50000||k==g.to_string()||k==child.to_string(){
            return Err(denied("SUBGRID_ROTATE_OVERLAY"));
        }
    }
    let orient=object_field(b,obj,"Orientation")?;
    if raw(b,orient)?!=b"\"GridOrientation_Up\""{return Err(denied("SUBGRID_ROTATE_OLD_ORIENTATION"));}
    Ok(obj)
}
impl ProductSession{
    /// Native-private only. Caller must use the independently accepted
    /// operation-specific readset/legality binding before a real invocation.
    /// Hashes are CAS witnesses, never a proof of rights or Native legality.
    pub fn stage_subgrid_same_anchor_rotate(&self,e:WorkerEnvelope,plan:&[u8])->CoreResult<SemanticStageReceipt>{
        let b=&self.native_source_build;
        if b.schema!=626||!b.externally_attested||self.worker_bound{
            return Err(denied("SUBGRID_ROTATE_PRIVATE_BUILD"));
        }
        let contract=match (b.platform,b.build_kind,b.build_id.as_str()){
            (Platform::SteamWindows,BuildKind::SteamFullVersion,EXACT_STEAM)=>STEAM_CONTRACT,
            (Platform::Switch,BuildKind::SwitchBid,SWITCH)=>SWITCH_CONTRACT,
            _=>return Err(denied("SUBGRID_ROTATE_PRIVATE_BUILD")),
        };
        let p=parse(plan,contract)?;
        let obj=collect_target(self,&p)?;
        let orient=object_field(&self.decoded,obj,"Orientation")?;
        let edit=Replacement{span:orient,old:raw(&self.decoded,orient)?.to_vec(),new:b"\"GridOrientation_Right\"".to_vec()};
        self.commit_semantic_replacements(e,vec![edit],1)
    }
}
fn parse_move(bytes:&[u8],contract:&str)->CoreResult<Value>{
    if bytes.is_empty()||bytes.len()>16384{return Err(denied("SUBGRID_MOVE_PLAN_BOUNDS"));}
    let v:Value=serde_json::from_slice(bytes).map_err(|_|denied("SUBGRID_MOVE_PLAN_JSON"))?;
    if enc(&v)?.as_slice()!=bytes{return Err(denied("SUBGRID_MOVE_PLAN_NONCANONICAL"));}
    let fields=["contract","sourceDecodedSha256","gridCollectionSha256","gridId","gridSha256",
        "objectId","objectSha256","itemId","expectedX","expectedY","expectedNextId","childId","childSha256",
        "expectedOrientation","newX","newY"];
    let m=v.as_object().ok_or(denied("SUBGRID_MOVE_PLAN_OBJECT"))?;
    if m.len()!=fields.len()||!fields.iter().all(|k|m.contains_key(*k))||v["contract"]!=contract||
       v["itemId"]!=ITEM||v["expectedOrientation"]!="GridOrientation_Up"||
       v["expectedX"]!=222||v["expectedY"]!=112||v["newX"]!=206||v["newY"]!=98{
        return Err(denied("SUBGRID_MOVE_PLAN_FIELDS"));
    }
    Ok(v)
}
impl ProductSession{
    /// Exact source-only move contract; target-specific effective geometry,
    /// provider/rights/Native legality remain independent private V2 gates.
    /// No generic layer permission or change to child, State or Orientation.
    pub fn stage_subgrid_exact_up_move(&self,e:WorkerEnvelope,plan:&[u8])->CoreResult<SemanticStageReceipt>{
        let b=&self.native_source_build;
        if b.schema!=626||!b.externally_attested||self.worker_bound{
            return Err(denied("SUBGRID_MOVE_PRIVATE_BUILD"));
        }
        let contract=match (b.platform,b.build_kind,b.build_id.as_str()){
            (Platform::SteamWindows,BuildKind::SteamFullVersion,EXACT_STEAM)=>STEAM_MOVE,
            (Platform::Switch,BuildKind::SwitchBid,SWITCH)=>SWITCH_MOVE,
            _=>return Err(denied("SUBGRID_MOVE_PRIVATE_BUILD")),
        };
        let p=parse_move(plan,contract)?;
        let obj=collect_target(self,&p)?;
        let bytes=&self.decoded;
        let x=object_field(bytes,obj,"X")?;let y=object_field(bytes,obj,"Y")?;
        if raw(bytes,x)?!=b"222"||raw(bytes,y)?!=b"112"{
            return Err(denied("SUBGRID_MOVE_OLD_COORD_TOKEN"));
        }
        // Direct parent/child and entire collection hashes remain bound by
        // the existing scanner; only these two original lexical spans change.
        self.commit_semantic_replacements(e,vec![
            Replacement{span:x,old:b"222".to_vec(),new:b"206".to_vec()},
            Replacement{span:y,old:b"112".to_vec(),new:b"98".to_vec()}],2)
    }
}
#[cfg(test)]
mod tests{
    use super::*;
    fn fixture(switch:bool)->(Value,Value){
        let d=json!({"GameInfo":{"Version":626,"Unknown":4},"Player":{"Opaque":{"x":1}},
            "World":{"Ambient":{"keep":2},"GridCollection":{"DiffGrids":{},
            "Grids":{"7":{"ID":7,"TessellationFactor":2,"NextGridObjectID":90,"Objects":{
                "40":{"ID":40,"ItemID":ITEM,"X":20,"Y":30,"Orientation":"GridOrientation_Up",
                    "State":{"SubGrid":{"GridID":8,"DesignID":null}},"Opaque":{"k":[1,2]}}}},
            "8":{"ID":8,"NextGridObjectID":0,"GridDefaultLayoutPath":"","Objects":{},"Unknown":7}}}}});
        let mut p=json!({"contract":if switch{SWITCH_CONTRACT}else{STEAM_CONTRACT},
            "gridId":7,"objectId":40,"itemId":ITEM,"expectedX":20,"expectedY":30,"expectedNextId":90,
            "childId":8,"expectedOrientation":"GridOrientation_Up","newOrientation":"GridOrientation_Right"});
        bind(&d,&mut p);(d,p)
    }
    fn bind(d:&Value,p:&mut Value){
        let gc=&d["World"]["GridCollection"];
        p["sourceDecodedSha256"]=json!(hex_digest(&enc(d).unwrap()));
        p["gridCollectionSha256"]=json!(hex_digest(&enc(gc).unwrap()));
        p["gridSha256"]=json!(hex_digest(&enc(&gc["Grids"]["7"]).unwrap()));
        p["objectSha256"]=json!(hex_digest(&enc(&gc["Grids"]["7"]["Objects"]["40"]).unwrap()));
        p["childSha256"]=json!(hex_digest(&enc(&gc["Grids"]["8"]).unwrap()));
    }
    fn open(d:&Value,switch:bool)->ProductSession{
        ProductSession::open_decoded_readonly(enc(d).unwrap(),crate::BuildIdentity{
            platform:if switch{Platform::Switch}else{Platform::SteamWindows},
            build_kind:if switch{BuildKind::SwitchBid}else{BuildKind::SteamFullVersion},
            build_id:if switch{SWITCH}else{EXACT_STEAM}.into(),schema:626,externally_attested:true}).unwrap()
    }
    fn scope(s:&ProductSession,a:WorkerAction)->WorkerEnvelope{let r=s.receipt().unwrap();WorkerEnvelope{
        contract:PRODUCT_WORKER_CONTRACT,session_id:r.session_id,expected_revision:r.revision,
        expected_index_generation:r.index_generation,expected_decoded_sha256:r.decoded_sha256,action:a}}
    #[test]
    fn subgrid_exact_up_move_two_paths_both_builds_and_rejects(){
        for switch in [false,true]{
            let (mut d,mut p)=fixture(switch);
            let obj=&mut d["World"]["GridCollection"]["Grids"]["7"]["Objects"]["40"];
            obj["X"]=json!(222);obj["Y"]=json!(112);
            p["contract"]=json!(if switch{SWITCH_MOVE}else{STEAM_MOVE});
            p["expectedX"]=json!(222);p["expectedY"]=json!(112);
            p.as_object_mut().unwrap().remove("newOrientation");
            p["newX"]=json!(206);p["newY"]=json!(98);
            bind(&d,&mut p);let s=open(&d,switch);let e=scope(&s,WorkerAction::Stage);
            let bytes=enc(&p).unwrap();
            let other=open(&d,!switch);
            assert!(other.stage_subgrid_exact_up_move(scope(&other,WorkerAction::Stage),&bytes).is_err());
            assert!(open(&d,switch).stage_subgrid_exact_up_move(e,&bytes).is_err());
            assert!(s.stage_subgrid_same_anchor_rotate(e,&bytes).is_err());
            for (k,v) in [("sourceDecodedSha256",json!("bad")),("gridCollectionSha256",json!("bad")),
                ("gridSha256",json!("bad")),("objectSha256",json!("bad")),("childSha256",json!("bad")),
                ("expectedX",json!(221)),("expectedY",json!(111)),("newX",json!(205)),("newY",json!(99)),
                ("expectedOrientation",json!("GridOrientation_Right")),("newOrientation",json!("GridOrientation_Right"))]{
                let mut q=p.clone();q[k]=v;assert!(s.stage_subgrid_exact_up_move(e,&enc(&q).unwrap()).is_err());
            }
            for i in 0..4{
                let mut bad=d.clone();let mut q=p.clone();let g=&mut bad["World"]["GridCollection"];
                match i{
                    0=>g["Grids"]["7"]["Objects"]["40"]["State"]["SubGrid"]["DesignID"]=json!(1),
                    1=>g["Grids"]["8"]["Objects"]["1"]=json!({"ID":1}),
                    2=>g["DiffGrids"]["7"]=json!({}),
                    _=>g["Grids"]["7"]["Objects"]["40"]["Orientation"]=json!("GridOrientation_Right"),
                }
                bind(&bad,&mut q);let t=open(&bad,switch);
                assert!(t.stage_subgrid_exact_up_move(scope(&t,WorkerAction::Stage),&enc(&q).unwrap()).is_err());
            }
            assert_eq!(s.receipt().unwrap().revision,0);
            let r=s.stage_subgrid_exact_up_move(e,&bytes).unwrap();
            assert_eq!(r.operation_count,2);assert_eq!(r.exact_field_changed_count,2);
            assert!(!r.product_writer_authorized);assert!(s.stage_subgrid_exact_up_move(e,&bytes).is_err());
            s.undo_typed_semantic_batch(scope(&s,WorkerAction::Stage)).unwrap();
            assert!(s.take_typed_semantic_decoded_once(scope(&s,WorkerAction::ExportEditedCopy)).is_err());
            s.redo_typed_semantic_batch(scope(&s,WorkerAction::Stage)).unwrap();
            let e=scope(&s,WorkerAction::ExportEditedCopy);let out=s.take_typed_semantic_decoded_once(e).unwrap();
            assert!(s.take_typed_semantic_decoded_once(e).is_err());
            let mut want=d.clone();let obj=&mut want["World"]["GridCollection"]["Grids"]["7"]["Objects"]["40"];
            obj["X"]=json!(206);obj["Y"]=json!(98);
            assert_eq!(out,enc(&want).unwrap());assert_eq!(sha(&out),r.staged_decoded_sha256);
        }
    }
    #[test]
    fn subgrid_exact_rotate_one_path_both_builds_child_and_state_preserved(){
        for switch in [false,true]{
            let (d,p)=fixture(switch);let s=open(&d,switch);let e=scope(&s,WorkerAction::Stage);
            let r=s.stage_subgrid_same_anchor_rotate(e,&enc(&p).unwrap()).unwrap();
            assert_eq!(r.operation_count,1);assert_eq!(r.exact_field_changed_count,1);
            assert!(!r.product_writer_authorized);assert!(r.applied);
            assert!(s.stage_subgrid_same_anchor_rotate(e,&enc(&p).unwrap()).is_err());
            s.undo_typed_semantic_batch(scope(&s,WorkerAction::Stage)).unwrap();
            assert!(s.take_typed_semantic_decoded_once(scope(&s,WorkerAction::ExportEditedCopy)).is_err());
            s.redo_typed_semantic_batch(scope(&s,WorkerAction::Stage)).unwrap();
            let e=scope(&s,WorkerAction::ExportEditedCopy);let out=s.take_typed_semantic_decoded_once(e).unwrap();
            assert!(s.take_typed_semantic_decoded_once(e).is_err());
            let mut expected=d.clone();expected["World"]["GridCollection"]["Grids"]["7"]["Objects"]["40"]["Orientation"]=json!("GridOrientation_Right");
            assert_eq!(serde_json::from_slice::<Value>(&out).unwrap(),expected);
            assert_eq!(sha(&out),r.staged_decoded_sha256);
        }
    }
    #[test]
    fn subgrid_exact_rotate_denies_cross_build_move_child_state_hash_and_epoch(){
        for switch in [false,true]{
            let (d,p)=fixture(switch);let s=open(&d,switch);let e=scope(&s,WorkerAction::Stage);
            let t=open(&d,!switch);assert!(t.stage_subgrid_same_anchor_rotate(scope(&t,WorkerAction::Stage),&enc(&p).unwrap()).is_err());
            assert!(open(&d,switch).stage_subgrid_same_anchor_rotate(e,&enc(&p).unwrap()).is_err());
            for (k,v) in [("sourceDecodedSha256",json!("bad")),("gridCollectionSha256",json!("bad")),
                ("gridSha256",json!("bad")),("objectSha256",json!("bad")),("childSha256",json!("bad")),
                ("expectedX",json!(21)),("newX",json!(21)),("newOrientation",json!("GridOrientation_Down")),
                ("childId",json!(9)),("expectedNextId",json!(91)),("itemId",json!(40000001))]{
                let mut q=p.clone();q[k]=v;assert!(s.stage_subgrid_same_anchor_rotate(e,&enc(&q).unwrap()).is_err());
            }
            for i in 0..8{
                let mut d=d.clone();let mut p=p.clone();
                let g=&mut d["World"]["GridCollection"];
                match i{
                    0=>g["Grids"]["7"]["Objects"]["40"]["State"]["SubGrid"]["DesignID"]=json!(1),
                    1=>g["Grids"]["7"]["Objects"]["40"]["State"]["Future"]=json!(1),
                    2=>g["Grids"]["8"]["Objects"]["1"]=json!({"ID":1}),
                    3=>g["Grids"]["8"]["NextGridObjectID"]=json!(1),
                    4=>g["Grids"]["8"]["GridDefaultLayoutPath"]=json!("unknown"),
                    5=>g["DiffGrids"]["7"]=json!({}),
                    6=>g["Grids"]["7"]["Objects"]["40"]["Orientation"]=json!("GridOrientation_Left"),
                    _=>g["Grids"]["7"]["Objects"]["40"]["X"]=json!(21),
                }
                bind(&d,&mut p);let t=open(&d,switch);
                assert!(t.stage_subgrid_same_anchor_rotate(scope(&t,WorkerAction::Stage),&enc(&p).unwrap()).is_err());
            }
            assert_eq!(s.receipt().unwrap().revision,0);
        }
    }
}
