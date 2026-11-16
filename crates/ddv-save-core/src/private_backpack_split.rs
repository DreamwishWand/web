//! Native-private exact one-fruit split; no product/worker authority.
use super::*;
use serde_json::Value;
const CONTRACT:&str="wand.private.steam626.backpack-fruit-split-exact3@1";
const SWITCH_CONTRACT:&str="wand.private.switch626.backpack-fruit-split-exact3@1";
const SWITCH_BID:&str="9A239D3DB569756D";
const ITEM:u32=30200001;
fn switch_build(s:&ProductSession)->CoreResult<()>{
    let b=&s.native_source_build;
    if s.worker_bound||b.platform!=Platform::Switch||b.build_kind!=BuildKind::SwitchBid||
       b.build_id!=SWITCH_BID||b.schema!=626||!b.externally_attested{
        return Err(denied("BACKPACK_SPLIT_SWITCH_BUILD"));
    }
    Ok(())
}
const DEFINITION:&str="9f9b24ad7ec2fc56149887d1b0824de24128cca6101f374ffd4f4b04bbb099cc";
fn digest(v:&Value)->CoreResult<[u8;32]>{
    let s=v.as_str().ok_or(denied("BACKPACK_SPLIT_DIGEST"))?;
    if s.len()!=64||!s.bytes().all(|c|matches!(c,b'0'..=b'9'|b'a'..=b'f')){return Err(denied("BACKPACK_SPLIT_DIGEST"))}
    let mut out=[0;32];for (i,x) in s.as_bytes().chunks_exact(2).enumerate(){
        let n=|b|match b{b'0'..=b'9'=>b-b'0',_=>b-b'a'+10};
        out[i]=(n(x[0])<<4)|n(x[1]);
    }if out==[0;32]{return Err(denied("BACKPACK_SPLIT_DIGEST"))}Ok(out)
}
fn hex(v:&[u8])->String{v.iter().map(|b|format!("{b:02x}")).collect()}
fn plan(bytes:&[u8],switch:bool)->CoreResult<Value>{
    if bytes.is_empty()||bytes.len()>8192{return Err(denied("BACKPACK_SPLIT_PLAN_SIZE"))}
    let v:Value=serde_json::from_slice(bytes).map_err(|_|denied("BACKPACK_SPLIT_PLAN_JSON"))?;
    let keys=["contract","sourceDecodedSha256","definitionSha256","sourceSlot","destinationSlot","oldAmount",
        "containerSha256","mapSha256","slotsSha256","parentSha256","sourceEntrySha256","destinationEntrySha256",
        "sourceStateSha256","destinationStateSha256","expectedOutputSha256"];
    let m=v.as_object().ok_or(denied("BACKPACK_SPLIT_PLAN_KEYS"))?;
    if m.len()!=keys.len()+usize::from(switch)||keys.iter().any(|k|!m.contains_key(*k))||
        (switch&&v["buildId"]!=SWITCH_BID)||
        serde_json::to_vec(&v).map_err(|_|denied("BACKPACK_SPLIT_PLAN_JSON"))?.as_slice()!=bytes||
        v["contract"]!=(if switch{SWITCH_CONTRACT}else{CONTRACT})||v["definitionSha256"]!=DEFINITION{
        return Err(denied("BACKPACK_SPLIT_PLAN_CANONICAL"));
    }
    Ok(v)
}
impl ProductSession{
    pub fn stage_private_steam626_backpack_fruit_split_exact3(&self,e:WorkerEnvelope,bytes:&[u8])
        ->CoreResult<SemanticStageReceipt>{
        build_check(self)?;
        self.stage_private_backpack_fruit_split(e,bytes,false)
    }
    pub fn read_private_switch626_backpack_fruit_slot_pair(&self,e:WorkerEnvelope,src:usize,dst:usize)
        ->CoreResult<Value>{
        switch_build(self)?;
        let mut w=self.observe_private_backpack_slot_pair(e,src,dst)?;
        if w["source"]["itemId"]!=ITEM||w["packagedStackBound"]!=50{
            return Err(denied("BACKPACK_SPLIT_SWITCH_FRUIT_ONLY"));
        }
        let m=w.as_object_mut().ok_or(denied("BACKPACK_SPLIT_SWITCH_RECEIPT"))?;
        m.remove("fullVersion");
        m.insert("contract".into(),Value::from("wand.native.private.switch626.backpack-fruit-slot-pair-read@1"));
        m.insert("platform".into(),Value::from("Switch"));
        m.insert("buildKind".into(),Value::from("SwitchBid"));
        m.insert("buildId".into(),Value::from(SWITCH_BID));
        Ok(w)
    }
    pub fn stage_private_switch626_backpack_fruit_split_exact3(&self,e:WorkerEnvelope,bytes:&[u8])
        ->CoreResult<SemanticStageReceipt>{
        switch_build(self)?;
        self.stage_private_backpack_fruit_split(e,bytes,true)
    }
    fn stage_private_backpack_fruit_split(&self,e:WorkerEnvelope,bytes:&[u8],switch:bool)
        ->CoreResult<SemanticStageReceipt>{
        if self.worker_bound{return Err(denied("BACKPACK_SPLIT_PRIVATE_ONLY"))}
        {let st=self.lock()?;check(self,&st,&e,WorkerAction::Stage)?;
        if st.revision!=0||st.generation!=1||st.semantic.is_some(){return Err(denied("BACKPACK_SPLIT_FRESH_ONLY"))}}
        let p=plan(bytes,switch)?;
        if digest(&p["sourceDecodedSha256"])?!=self.sha{return Err(denied("BACKPACK_SPLIT_SOURCE_CAS"))}
        let slot=|k:&str|p[k].as_u64().and_then(|n|usize::try_from(n).ok()).filter(|n|*n<MAX_CONTAINER_SLOTS).ok_or(denied("BACKPACK_SPLIT_SLOT"));
        let src=slot("sourceSlot")?;let dst=slot("destinationSlot")?;
        let old=p["oldAmount"].as_u64().filter(|n|(2..=50).contains(n)).ok_or(denied("BACKPACK_SPLIT_AMOUNT"))? as u32;
        let read=WorkerEnvelope{action:WorkerAction::ReadDomain,..e};
        let w=if switch{self.read_private_switch626_backpack_fruit_slot_pair(read,src,dst)?}
              else{self.read_private_backpack_slot_pair(read,src,dst)?};
        if w["source"]["itemId"]!=ITEM||w["source"]["oldAmount"]!=old||w["packagedStackBound"]!=50{
            return Err(denied("BACKPACK_SPLIT_ITEM_AMOUNT_CAS"));
        }
        for (pk,root,wk) in [("containerSha256","container","recordSha256"),("mapSha256","container","mapSha256"),
            ("slotsSha256","container","slotsSha256"),("parentSha256","container","parentSha256"),
            ("sourceEntrySha256","source","entrySha256"),("destinationEntrySha256","destination","entrySha256"),
            ("sourceStateSha256","source","stateSha256"),("destinationStateSha256","destination","stateSha256")]{
            if hex(&digest(&p[pk])?)!=w[root][wk].as_str().unwrap_or(""){return Err(denied("BACKPACK_SPLIT_WITNESS_CAS"))}
        }
        let b=&self.decoded;let player=indexed_read::roots(b)?.player;
        let map=object_field(b,player,"ContainerInventories")?;
        let record=object_field(b,map,"0")?;let slots=object_field(b,record,"Inventory")?;
        let source=array_element(b,slots,src)?;let dest=array_element(b,slots,dst)?;
        let zero=|field:&str,new:u32|->CoreResult<Replacement>{
            let span=object_field(b,dest,field)?;
            if number(b,span)?!=0{return Err(denied("BACKPACK_SPLIT_DEST_CAS"))}
            Ok(Replacement{span,old:b[span.begin..span.end].to_vec(),new:new.to_string().into_bytes()})
        };
        let edits=vec![validate_old_amount(b,object_field(b,source,"Amount")?,old,old-1)?,
            zero("ItemID",ITEM)?,zero("Amount",1)?];
        self.commit_semantic_replacements(e,edits,3,Some(digest(&p["expectedOutputSha256"])?))
    }
}
#[cfg(test)]
mod tests{
    use super::*;use crate::{BuildIdentity,SessionReceipt};use serde_json::json;
    fn doc()->Value{json!({"GameInfo":{"Version":626},"World":{},"Player":{
        "ListInventories":{"0":{"ID":0,"CompatibleItemType":"ItemType_Furniture","Inventory":{}}},
        "ContainerInventories":{"0":{"ID":0,"Size":3,"ExtraSize":1,"BelongsToPlayer":true,
        "BlockMoveTo":false,"ParentItemID":null,"Inventory":[
        {"ItemID":ITEM,"Amount":4,"State":null,"Unknown":"keep"},
        {"ItemID":0,"Amount":0,"State":null,"Unknown":"also-keep"},{"ItemID":0,"Amount":0,"State":null}]},
        "1":{"ID":1,"Size":0,"Inventory":[]}}}})}
    fn open(d:&Value)->ProductSession{ProductSession::open_decoded_readonly(serde_json::to_vec(d).unwrap(),
        BuildIdentity{platform:Platform::SteamWindows,build_kind:BuildKind::SteamFullVersion,
        build_id:EXACT_STEAM.into(),schema:626,externally_attested:true}).unwrap()}
    fn env(r:SessionReceipt,action:WorkerAction)->WorkerEnvelope{WorkerEnvelope{contract:PRODUCT_WORKER_CONTRACT,
        session_id:r.session_id,expected_revision:r.revision,expected_index_generation:r.index_generation,
        expected_decoded_sha256:r.decoded_sha256,action}}
    fn fixture()->(ProductSession,Value,Vec<u8>){
        let d=doc();let s=open(&d);let r=s.receipt().unwrap();
        let w=s.read_private_backpack_slot_pair(env(r,WorkerAction::ReadDomain),0,1).unwrap();
        let mut out=d;let inv=&mut out["Player"]["ContainerInventories"]["0"]["Inventory"];
        inv[0]["Amount"]=json!(3);inv[1]["ItemID"]=json!(ITEM);inv[1]["Amount"]=json!(1);
        let expected=serde_json::to_vec(&out).unwrap();
        let p=json!({"contract":CONTRACT,"definitionSha256":DEFINITION,"sourceDecodedSha256":hex(&s.sha),
            "sourceSlot":0,"destinationSlot":1,"oldAmount":4,"containerSha256":w["container"]["recordSha256"],
            "mapSha256":w["container"]["mapSha256"],"slotsSha256":w["container"]["slotsSha256"],
            "parentSha256":w["container"]["parentSha256"],"sourceEntrySha256":w["source"]["entrySha256"],
            "destinationEntrySha256":w["destination"]["entrySha256"],"sourceStateSha256":w["source"]["stateSha256"],
            "destinationStateSha256":w["destination"]["stateSha256"],"expectedOutputSha256":hex(&sha(&expected))});
        (s,p,expected)
    }
    #[test]fn backpack_split_exact3_conservation_and_one_time(){
        let(s,p,expected)=fixture();let b=serde_json::to_vec(&p).unwrap();
        let e=env(s.receipt().unwrap(),WorkerAction::Stage);let r=s.stage_private_steam626_backpack_fruit_split_exact3(e,&b).unwrap();
        assert_eq!(r.exact_field_changed_count,3);assert_eq!(r.operation_count,3);assert!(!r.product_writer_authorized);
        assert!(s.stage_private_steam626_backpack_fruit_split_exact3(e,&b).is_err());
        s.undo_typed_semantic_batch(env(s.receipt().unwrap(),WorkerAction::Stage)).unwrap();
        assert!(s.take_typed_semantic_decoded_once(env(s.receipt().unwrap(),WorkerAction::ExportEditedCopy)).is_err());
        s.redo_typed_semantic_batch(env(s.receipt().unwrap(),WorkerAction::Stage)).unwrap();
        let ex=env(s.receipt().unwrap(),WorkerAction::ExportEditedCopy);
        assert_eq!(s.take_typed_semantic_decoded_once(ex).unwrap(),expected);
        assert!(s.take_typed_semantic_decoded_once(ex).is_err());
    }
    fn open_switch(d:&Value)->ProductSession{ProductSession::open_decoded_readonly(serde_json::to_vec(d).unwrap(),
        BuildIdentity{platform:Platform::Switch,build_kind:BuildKind::SwitchBid,
        build_id:SWITCH_BID.into(),schema:626,externally_attested:true}).unwrap()}
    #[test]fn switch_backpack_build_delta_and_exact3(){
        let(steam,mut p,expected)=fixture();let s=open_switch(&doc());
        let r=s.receipt().unwrap();let read=env(r,WorkerAction::ReadDomain);
        let w=s.read_private_switch626_backpack_fruit_slot_pair(read,0,1).unwrap();
        assert_eq!(w["buildId"],SWITCH_BID);assert_eq!(w["platform"],"Switch");
        assert_eq!(w["buildKind"],"SwitchBid");assert!(w.get("fullVersion").is_none());
        assert_eq!(w["writerAuthorized"],false);
        let sw=steam.read_private_backpack_slot_pair(env(steam.receipt().unwrap(),WorkerAction::ReadDomain),0,1).unwrap();
        for k in ["container","source","destination","decodedSha256"]{assert_eq!(w[k],sw[k]);}
        let e=env(s.receipt().unwrap(),WorkerAction::Stage);
        assert!(s.read_private_backpack_slot_pair(read,0,1).is_err());
        assert!(steam.read_private_switch626_backpack_fruit_slot_pair(env(steam.receipt().unwrap(),WorkerAction::ReadDomain),0,1).is_err());
        assert!(s.stage_private_switch626_backpack_fruit_split_exact3(e,&serde_json::to_vec(&p).unwrap()).is_err());
        p["contract"]=json!(SWITCH_CONTRACT);p["buildId"]=json!(SWITCH_BID);
        let b=serde_json::to_vec(&p).unwrap();
        assert!(s.stage_private_steam626_backpack_fruit_split_exact3(e,&b).is_err());
        assert!(steam.stage_private_switch626_backpack_fruit_split_exact3(env(steam.receipt().unwrap(),WorkerAction::Stage),&b).is_err());
        let mut wrong=p.clone();wrong["buildId"]=json!("0000000000000000");
        assert!(s.stage_private_switch626_backpack_fruit_split_exact3(e,&serde_json::to_vec(&wrong).unwrap()).is_err());
        assert!(open_switch(&doc()).stage_private_switch626_backpack_fruit_split_exact3(e,&b).is_err());
        let receipt=s.stage_private_switch626_backpack_fruit_split_exact3(e,&b).unwrap();
        assert_eq!(receipt.operation_count,3);assert_eq!(receipt.exact_field_changed_count,3);
        assert!(!receipt.product_writer_authorized);assert!(!receipt.original_overwrite_authorized);
        assert!(s.stage_private_switch626_backpack_fruit_split_exact3(e,&b).is_err());
        s.undo_typed_semantic_batch(env(s.receipt().unwrap(),WorkerAction::Stage)).unwrap();
        assert!(s.take_typed_semantic_decoded_once(env(s.receipt().unwrap(),WorkerAction::ExportEditedCopy)).is_err());
        s.redo_typed_semantic_batch(env(s.receipt().unwrap(),WorkerAction::Stage)).unwrap();
        let ex=env(s.receipt().unwrap(),WorkerAction::ExportEditedCopy);
        assert_eq!(s.take_typed_semantic_decoded_once(ex).unwrap(),expected);
        assert!(s.take_typed_semantic_decoded_once(ex).is_err());
    }
    #[test]fn backpack_split_cas_and_wrong_scope_denials(){
        let(s,p,_)=fixture();let e=env(s.receipt().unwrap(),WorkerAction::Stage);
        for (k,v) in [("sourceSlot",json!(1)),("destinationSlot",json!(2)),("oldAmount",json!(1)),
            ("oldAmount",json!(5)),("definitionSha256",json!("wrong")),("mapSha256",json!("wrong")),
            ("sourceEntrySha256",json!("wrong")),("destinationEntrySha256",json!("wrong")),
            ("sourceStateSha256",json!("wrong")),("destinationStateSha256",json!("wrong")),
            ("expectedOutputSha256",json!("11".repeat(32)))]{
            let mut q=p.clone();q[k]=v;
            assert!(s.stage_private_steam626_backpack_fruit_split_exact3(e,&serde_json::to_vec(&q).unwrap()).is_err(),"{k}");
        }
        let b=serde_json::to_vec(&p).unwrap();let mut stale=e;stale.expected_revision+=1;
        assert!(s.stage_private_steam626_backpack_fruit_split_exact3(stale,&b).is_err());
        assert!(open(&doc()).stage_private_steam626_backpack_fruit_split_exact3(e,&b).is_err());
        assert_eq!(s.receipt().unwrap().revision,0);
    }

    #[test]
    fn qa_switch_backpack_delta_noncanonical_exact3_and_build_scope(){
        let mut pos=0;let mut neg=0;
        for (src,dst,old) in [(2usize,0usize,50u32),(1,2,2)]{
            let mut d=doc();let slots=&mut d["Player"]["ContainerInventories"]["0"]["Inventory"];
            *slots=json!([{"ItemID":0,"Amount":0,"State":null,"Opaque":"keep"},{"ItemID":0,"Amount":0,"State":null},{"ItemID":0,"Amount":0,"State":null}]);
            slots[src]["ItemID"]=json!(ITEM);slots[src]["Amount"]=json!(old);
            let raw=serde_json::to_string_pretty(&d).unwrap().replace("\"keep\"","\"\\u006beep\"");
            let mk=|platform,kind,id:&str,attested|ProductSession::open_decoded_readonly(raw.as_bytes().to_vec(),BuildIdentity{platform,build_kind:kind,build_id:id.into(),schema:626,externally_attested:attested});
            let s=mk(Platform::Switch,BuildKind::SwitchBid,SWITCH_BID,true).unwrap();
            let t=mk(Platform::SteamWindows,BuildKind::SteamFullVersion,EXACT_STEAM,true).unwrap();
            let e=env(s.receipt().unwrap(),WorkerAction::ReadDomain);
            let w=s.read_private_switch626_backpack_fruit_slot_pair(e,src,dst).unwrap();
            let z=t.read_private_backpack_slot_pair(env(t.receipt().unwrap(),WorkerAction::ReadDomain),src,dst).unwrap();
            for k in ["source","destination","container","decodedSha256"]{assert_eq!(w[k],z[k]);}
            assert_eq!(w["buildId"],SWITCH_BID);assert_eq!(w["buildKind"],"SwitchBid");assert!(w.get("fullVersion").is_none());assert_eq!(w["writerAuthorized"],false);
            let p=indexed_read::roots(raw.as_bytes()).unwrap().player;
            let m=object_field(raw.as_bytes(),p,"ContainerInventories").unwrap();
            let c=object_field(raw.as_bytes(),m,"0").unwrap();
            let a=object_field(raw.as_bytes(),c,"Inventory").unwrap();
            let so=array_element(raw.as_bytes(),a,src).unwrap();let de=array_element(raw.as_bytes(),a,dst).unwrap();
            let field=|s:Span,k:&str|object_field(raw.as_bytes(),s,k).unwrap();
            let hash=|s:Span|hex(&sha(&raw.as_bytes()[s.begin..s.end]));
            let mut edits=[(field(so,"Amount"),(old-1).to_string()),(field(de,"ItemID"),ITEM.to_string()),(field(de,"Amount"),"1".into())];
            edits.sort_by_key(|x|x.0.begin);
            let mut want=raw.as_bytes().to_vec();for (sp,n) in edits.iter().rev(){want.splice(sp.begin..sp.end,n.as_bytes().iter().copied());}
            let plan=json!({"contract":SWITCH_CONTRACT,"buildId":SWITCH_BID,"definitionSha256":DEFINITION,
            "sourceDecodedSha256":hex(&sha(raw.as_bytes())),"sourceSlot":src,"destinationSlot":dst,"oldAmount":old,
            "containerSha256":hash(c),"mapSha256":hash(m),"slotsSha256":hash(a),"parentSha256":hash(field(c,"ParentItemID")),
            "sourceEntrySha256":hash(so),"destinationEntrySha256":hash(de),"sourceStateSha256":hash(field(so,"State")),
            "destinationStateSha256":hash(field(de,"State")),"expectedOutputSha256":hex(&sha(&want))});
            let bytes=serde_json::to_vec(&plan).unwrap();let st=WorkerEnvelope{action:WorkerAction::Stage,..e};
            for (key,v) in [("buildId",json!("52BD625D9B4E0053")),("contract",json!(CONTRACT)),("oldAmount",json!(1)),("sourceSlot",json!(dst)),("destinationSlot",json!(src)),("expectedOutputSha256",json!("ab".repeat(32))),("sourceEntrySha256",json!("cd".repeat(32)))]{
                let mut q=plan.clone();q[key]=v;assert!(s.stage_private_switch626_backpack_fruit_split_exact3(st,&serde_json::to_vec(&q).unwrap()).is_err());neg+=1;
            }
            let mut q=plan.clone();q.as_object_mut().unwrap().remove("buildId");assert!(s.stage_private_switch626_backpack_fruit_split_exact3(st,&serde_json::to_vec(&q).unwrap()).is_err());neg+=1;
            assert!(s.stage_private_switch626_backpack_fruit_split_exact3(st,&serde_json::to_vec_pretty(&plan).unwrap()).is_err());neg+=1;
            assert!(t.stage_private_switch626_backpack_fruit_split_exact3(env(t.receipt().unwrap(),WorkerAction::Stage),&bytes).is_err());neg+=1;
            assert!(s.stage_private_steam626_backpack_fruit_split_exact3(st,&bytes).is_err());neg+=1;
            assert!(s.stage_private_switch626_backpack_fruit_split_exact3(WorkerEnvelope{expected_index_generation:2,..st},&bytes).is_err());neg+=1;
            for (id,attested) in [("52BD625D9B4E0053",true),(SWITCH_BID,false)]{
                if let Ok(x)=mk(Platform::Switch,BuildKind::SwitchBid,id,attested){assert!(x.stage_private_switch626_backpack_fruit_split_exact3(env(x.receipt().unwrap(),WorkerAction::Stage),&bytes).is_err());}neg+=1;
            }
            let mut x=mk(Platform::Switch,BuildKind::SwitchBid,SWITCH_BID,true).unwrap();x.worker_bound=true;
            assert!(x.stage_private_switch626_backpack_fruit_split_exact3(env(x.receipt().unwrap(),WorkerAction::Stage),&bytes).is_err());neg+=1;
            let x=mk(Platform::Switch,BuildKind::SwitchBid,SWITCH_BID,true).unwrap();assert!(x.stage_private_switch626_backpack_fruit_split_exact3(st,&bytes).is_err());neg+=1;
            let r=s.stage_private_switch626_backpack_fruit_split_exact3(st,&bytes).unwrap();assert_eq!((r.operation_count,r.exact_field_changed_count),(3,3));assert!(!r.product_writer_authorized&&!r.original_overwrite_authorized);assert_eq!(r.staged_decoded_sha256,sha(&want));
            assert!(s.stage_private_switch626_backpack_fruit_split_exact3(st,&bytes).is_err());neg+=1;
            s.undo_typed_semantic_batch(env(s.receipt().unwrap(),WorkerAction::Stage)).unwrap();assert!(s.take_typed_semantic_decoded_once(env(s.receipt().unwrap(),WorkerAction::ExportEditedCopy)).is_err());neg+=1;
            s.redo_typed_semantic_batch(env(s.receipt().unwrap(),WorkerAction::Stage)).unwrap();let ex=env(s.receipt().unwrap(),WorkerAction::ExportEditedCopy);assert_eq!(s.take_typed_semantic_decoded_once(ex).unwrap(),want);assert!(s.take_typed_semantic_decoded_once(ex).is_err());neg+=1;
            assert_eq!(s.decoded.as_ref(),raw.as_bytes());pos+=1;
        }
        assert_eq!((pos,neg),(2,38));
    }

}
