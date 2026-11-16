//! Native-private exact one-fruit split; no product/worker authority.
use super::*;
use serde_json::Value;
const CONTRACT:&str="wand.private.steam626.backpack-fruit-split-exact3@1";
const ITEM:u32=30200001;
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
fn plan(bytes:&[u8])->CoreResult<Value>{
    if bytes.is_empty()||bytes.len()>8192{return Err(denied("BACKPACK_SPLIT_PLAN_SIZE"))}
    let v:Value=serde_json::from_slice(bytes).map_err(|_|denied("BACKPACK_SPLIT_PLAN_JSON"))?;
    let keys=["contract","sourceDecodedSha256","definitionSha256","sourceSlot","destinationSlot","oldAmount",
        "containerSha256","mapSha256","slotsSha256","parentSha256","sourceEntrySha256","destinationEntrySha256",
        "sourceStateSha256","destinationStateSha256","expectedOutputSha256"];
    let m=v.as_object().ok_or(denied("BACKPACK_SPLIT_PLAN_KEYS"))?;
    if m.len()!=keys.len()||keys.iter().any(|k|!m.contains_key(*k))||
        serde_json::to_vec(&v).map_err(|_|denied("BACKPACK_SPLIT_PLAN_JSON"))?.as_slice()!=bytes||
        v["contract"]!=CONTRACT||v["definitionSha256"]!=DEFINITION{
        return Err(denied("BACKPACK_SPLIT_PLAN_CANONICAL"));
    }
    Ok(v)
}
impl ProductSession{
    pub fn stage_private_steam626_backpack_fruit_split_exact3(&self,e:WorkerEnvelope,bytes:&[u8])
        ->CoreResult<SemanticStageReceipt>{
        build_check(self)?;
        if self.worker_bound{return Err(denied("BACKPACK_SPLIT_PRIVATE_ONLY"))}
        {let st=self.lock()?;check(self,&st,&e,WorkerAction::Stage)?;
        if st.revision!=0||st.generation!=1||st.semantic.is_some(){return Err(denied("BACKPACK_SPLIT_FRESH_ONLY"))}}
        let p=plan(bytes)?;
        if digest(&p["sourceDecodedSha256"])?!=self.sha{return Err(denied("BACKPACK_SPLIT_SOURCE_CAS"))}
        let slot=|k:&str|p[k].as_u64().and_then(|n|usize::try_from(n).ok()).filter(|n|*n<MAX_CONTAINER_SLOTS).ok_or(denied("BACKPACK_SPLIT_SLOT"));
        let src=slot("sourceSlot")?;let dst=slot("destinationSlot")?;
        let old=p["oldAmount"].as_u64().filter(|n|(2..=50).contains(n)).ok_or(denied("BACKPACK_SPLIT_AMOUNT"))? as u32;
        let w=self.read_private_backpack_slot_pair(WorkerEnvelope{action:WorkerAction::ReadDomain,..e},src,dst)?;
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
}
