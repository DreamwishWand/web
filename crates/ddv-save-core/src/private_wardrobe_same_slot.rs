//! ACT1054: one private Steam626 occupied top-inner Wardrobe scalar.
//! The detached reviewed definition/rights/affected closure and approved plan
//! are private operator inputs; hashes alone are NOT a product authority.
use super::*;
use serde_json::{json,Value};

const CONTRACT:&str="wand.private.steam626.wardrobe-same-slot-exact1@1";

fn scope_ok(s:&ProductSession)->bool{
    let b=&s.native_source_build;
    !s.worker_bound&&b.platform==Platform::SteamWindows&&b.build_kind==BuildKind::SteamFullVersion&&
        b.build_id==EXACT_STEAM&&b.schema==626&&b.externally_attested
}
fn hex32(v:&Value)->CoreResult<[u8;32]>{
    let s=v.as_str().ok_or(denied("WARDROBE_PLAN_SHA_TYPE"))?;
    if s.len()!=64||!s.bytes().all(|c|matches!(c,b'0'..=b'9'|b'a'..=b'f')){
        return Err(denied("WARDROBE_PLAN_SHA_FORMAT"));
    }
    let mut out=[0u8;32];
    for (i,pair) in s.as_bytes().chunks_exact(2).enumerate(){
        let n=|c:u8|if c<=b'9'{c-b'0'}else{c-b'a'+10};
        out[i]=(n(pair[0])<<4)|n(pair[1]);
    }
    if out==[0;32]{return Err(denied("WARDROBE_PLAN_SHA_ZERO"));}
    Ok(out)
}
fn hex(v:&[u8;32])->String{v.iter().map(|b|format!("{b:02x}")).collect()}
fn projection(r:&Value)->Value{
    let a=&r["avatar"];
    json!({"avatarIsMale":a["avatarIsMale"],"activeBranch":a["activeBranch"],
        "maleAvatarSha256":a["maleAvatar"]["branchSha256"],
        "femaleAvatarSha256":a["femaleAvatar"]["branchSha256"],
        "incompatibleClothesMapSha256":a["maleAvatar"]["incompatibleClothes"]["mapSha256"],
        "customizationMapSha256":a["maleAvatar"]["clothingCustomization"]["mapSha256"],
        "oldScalarSha256":r["oldScalarSha256"],"clothesMapSha256":r["clothesMapSha256"],
        "inventory":r["inventory"]})
}
// Opaque, Core-minted. No caller span, path, replacement bytes, or generic
// wardrobe slot. The independent plan pins the entire expected output SHA.
pub struct PrivateWardrobeSameSlotTarget{
    scope:WorkerEnvelope,span:Span,old:i32,new:i32,expected_output:[u8;32],
}
impl ProductSession{
    pub fn mint_private_wardrobe_same_slot_target(&self,e:WorkerEnvelope,plan:&[u8],approved_plan_sha:[u8;32])
        ->CoreResult<PrivateWardrobeSameSlotTarget>{
        if !scope_ok(self)||e.expected_revision!=0||e.expected_index_generation!=1||
           e.action!=WorkerAction::ReadDomain||plan.is_empty()||plan.len()>8192||
           approved_plan_sha==[0;32]||sha(plan)!=approved_plan_sha{
            return Err(denied("WARDROBE_PRIVATE_PLAN_SCOPE"));
        }
        let p:Value=serde_json::from_slice(plan).map_err(|_|denied("WARDROBE_PLAN_JSON"))?;
        if serde_json::to_vec(&p).map_err(|_|denied("WARDROBE_PLAN_JSON"))?.as_slice()!=plan{
            return Err(denied("WARDROBE_PLAN_NONCANONICAL"));
        }
        let keys=["contract","fullVersion","sourceDecodedSha256","slot","oldItemId","newItemId",
            "savedReadSet","oldDefinitionSha256","newDefinitionSha256","candidateReceiptSha256",
            "affectedClosureSha256","expectedEditedDecodedSha256"];
        let m=p.as_object().ok_or(denied("WARDROBE_PLAN_OBJECT"))?;
        if m.len()!=keys.len()||!keys.iter().all(|k|m.contains_key(*k))||
           p["contract"]!=CONTRACT||p["fullVersion"]!=EXACT_STEAM||p["slot"]!=0||
           hex32(&p["sourceDecodedSha256"])?!=e.expected_decoded_sha256{
            return Err(denied("WARDROBE_PLAN_BINDING"));
        }
        let old_def=hex32(&p["oldDefinitionSha256"])?;
        let new_def=hex32(&p["newDefinitionSha256"])?;
        if old_def==new_def{return Err(denied("WARDROBE_DEFINITION_PAIR"));}
        hex32(&p["candidateReceiptSha256"])?;
        hex32(&p["affectedClosureSha256"])?;
        let expected_output=hex32(&p["expectedEditedDecodedSha256"])?;
        if expected_output==e.expected_decoded_sha256{return Err(denied("WARDROBE_OUTPUT_NO_CHANGE"));}
        let id=|k:&str|p[k].as_i64().and_then(|n|i32::try_from(n).ok())
            .filter(|n|*n/10_000_000==5).ok_or(denied("WARDROBE_PLAN_ITEM"));
        let old=id("oldItemId")?;let new=id("newItemId")?;
        if old==new{return Err(denied("WARDROBE_DISTINCT_ITEMS"));}
        // Existing typed Reader validates same Session/epoch, exact Build, active
        // slot, positive old/new Catalog1 stock, marker and map constraints.
        let r=self.read_private_wardrobe_same_slot(e,0,old,new)?.to_private_receipt_json();
        if r["avatar"]["avatarIsMale"]!=true||r["avatar"]["activeBranch"]!="MaleAvatar"||
           p["savedReadSet"]!=projection(&r){
            return Err(denied("WARDROBE_CURRENT_READSET_CAS"));
        }
        let bytes=&self.decoded;let player=indexed_read::roots(bytes)?.player;
        // Use the existing ledger's indexed object scanner, not a second
        // Reader, caller path or full decoded Value tree.
        let avatar=object_field(bytes,player,"MaleAvatar")?;
        let map=object_field(bytes,avatar,"Clothes")?;
        let span=object_field(bytes,map,"0")?;
        if number(bytes,span)?!=old as u64||hex(&sha(&bytes[span.begin..span.end]))!=r["oldScalarSha256"]{
            return Err(denied("WARDROBE_OLD_RAW_CAS"));
        }
        Ok(PrivateWardrobeSameSlotTarget{scope:e,span,old,new,expected_output})
    }
    pub fn stage_private_wardrobe_same_slot(&self,e:WorkerEnvelope,t:&PrivateWardrobeSameSlotTarget)
        ->CoreResult<SemanticStageReceipt>{
        if !scope_ok(self)||e.action!=WorkerAction::Stage||e.contract!=t.scope.contract||
           e.session_id!=t.scope.session_id||e.expected_revision!=t.scope.expected_revision||
           e.expected_index_generation!=t.scope.expected_index_generation||
           e.expected_decoded_sha256!=t.scope.expected_decoded_sha256{
            return Err(denied("WARDROBE_STAGE_SCOPE_CAS"));
        }
        self.commit_semantic_replacements(e,vec![Replacement{span:t.span,
            old:t.old.to_string().into_bytes(),new:t.new.to_string().into_bytes()}],1,Some(t.expected_output))
    }
}

#[cfg(test)]
mod tests{
    use super::*;
    use crate::{BuildIdentity,SessionReceipt};
    fn doc()->Value{json!({"GameInfo":{"Version":626},"World":{"Unknown":{"keep":[1,2,3]}},"Player":{
        "AvatarIsMale":true,
        "FemaleAvatar":{"Clothes":{"0":50000001},"IncompatibleClothes":{},"ClothingCustomization":{},"Makeup":{}},
        "MaleAvatar":{"Clothes":{"0":50000002,"5":50000004},"IncompatibleClothes":{},
            "ClothingCustomization":{},"Makeup":{},"Unknown":"keep"},
        "ListInventories":{"1":{"ID":1,"CompatibleItemType":"ItemType_Clothing","Inventory":{
            "50000001":{"Amount":1,"Marker":"ItemMarker_None"},"50000002":{"Amount":2,"Marker":"ItemMarker_Favorite"},
            "50000003":{"Amount":3,"Marker":"ItemMarker_None"},"50000004":{"Amount":1,"Marker":"ItemMarker_None"}}},
            "3":{"ID":3,"CompatibleItemType":"ItemType_Makeup","Inventory":{}}},
        "Unknown":[true,{"retained":"yes"}]}})}
    fn open(v:&Value)->ProductSession{
        ProductSession::open_decoded_readonly(serde_json::to_vec_pretty(v).unwrap(),BuildIdentity{
            platform:Platform::SteamWindows,build_kind:BuildKind::SteamFullVersion,
            build_id:EXACT_STEAM.into(),schema:626,externally_attested:true}).unwrap()
    }
    fn env(r:SessionReceipt,action:WorkerAction)->WorkerEnvelope{WorkerEnvelope{
        contract:PRODUCT_WORKER_CONTRACT,session_id:r.session_id,expected_revision:r.revision,
        expected_index_generation:r.index_generation,expected_decoded_sha256:r.decoded_sha256,action}}
    fn plan(s:&ProductSession,e:WorkerEnvelope,expected:&[u8])->Value{
        let r=s.read_private_wardrobe_same_slot(e,0,50000002,50000003).unwrap().to_private_receipt_json();
        json!({"contract":CONTRACT,"fullVersion":EXACT_STEAM,"sourceDecodedSha256":hex(&e.expected_decoded_sha256),
            "slot":0,"oldItemId":50000002,"newItemId":50000003,"savedReadSet":projection(&r),
            "oldDefinitionSha256":hex(&sha(b"synthetic old definition")),
            "newDefinitionSha256":hex(&sha(b"synthetic new definition")),
            "candidateReceiptSha256":hex(&sha(b"synthetic candidate")),
            "affectedClosureSha256":hex(&sha(b"synthetic closure")),
            "expectedEditedDecodedSha256":hex(&sha(expected))})
    }
    fn mint(s:&ProductSession,e:WorkerEnvelope,p:&Value)->CoreResult<PrivateWardrobeSameSlotTarget>{
        let b=serde_json::to_vec(p).unwrap();s.mint_private_wardrobe_same_slot_target(e,&b,sha(&b))
    }
    #[test]
    fn private_wardrobe_exact1_raw_output_and_lifecycle(){
        let d=doc();let s=open(&d);let before=s.receipt().unwrap();
        let e=env(before,WorkerAction::ReadDomain);
        let mut out=d.clone();out["Player"]["MaleAvatar"]["Clothes"]["0"]=json!(50000003);
        let expected=serde_json::to_vec_pretty(&out).unwrap();let p=plan(&s,e,&expected);
        let t=mint(&s,e,&p).unwrap();assert_eq!(s.receipt().unwrap(),before);
        for (k,v) in [("slot",json!(1)),("oldItemId",json!(50000003)),("newItemId",json!(50000002)),
            ("fullVersion",json!("wrong")),("sourceDecodedSha256",json!(hex(&sha(b"wrong")))),
            ("oldDefinitionSha256",json!("bad")),("candidateReceiptSha256",json!("0".repeat(64))),
            ("affectedClosureSha256",json!(false)),("productWriterAuthorized",json!(true))]{
            let mut q=p.clone();q[k]=v;assert!(mint(&s,e,&q).is_err(),"{k}");
        }
        for k in ["oldScalarSha256","clothesMapSha256","maleAvatarSha256","femaleAvatarSha256",
            "incompatibleClothesMapSha256","customizationMapSha256"]{
            let mut q=p.clone();q["savedReadSet"][k]=json!(hex(&sha(b"wrong")));
            assert!(mint(&s,e,&q).is_err(),"{k}");
        }
        for k in ["oldStock","proposedStock"]{
            let mut q=p.clone();q["savedReadSet"]["inventory"][k]["entrySha256"]=json!("wrong");
            assert!(mint(&s,e,&q).is_err());
        }
        let mut q=p.clone();q["savedReadSet"]["inventory"]["recordSha256"]=json!("wrong");assert!(mint(&s,e,&q).is_err());
        let b=serde_json::to_vec(&p).unwrap();assert!(s.mint_private_wardrobe_same_slot_target(e,&b,[1;32]).is_err());
        let mut stale=e;stale.expected_revision+=1;assert!(mint(&s,stale,&p).is_err());
        let other=open(&d);assert!(mint(&other,e,&p).is_err());
        let mut stage=e;stage.action=WorkerAction::Stage;
        assert!(s.stage_private_wardrobe_same_slot(e,&t).is_err());
        assert!(other.stage_private_wardrobe_same_slot(env(other.receipt().unwrap(),WorkerAction::Stage),&t).is_err());
        let mut q=p.clone();q["expectedEditedDecodedSha256"]=json!(hex(&sha(b"wrong output")));
        let wrong=mint(&s,e,&q).unwrap();assert!(s.stage_private_wardrobe_same_slot(stage,&wrong).is_err());
        assert_eq!(s.receipt().unwrap(),before);
        let r=s.stage_private_wardrobe_same_slot(stage,&t).unwrap();
        assert_eq!(r.operation_count,1);assert_eq!(r.exact_field_changed_count,1);
        assert_eq!(r.staged_decoded_sha256,sha(&expected));assert!(!r.product_writer_authorized);
        assert!(s.stage_private_wardrobe_same_slot(stage,&t).is_err());
        let undo=s.undo_typed_semantic_batch(env(s.receipt().unwrap(),WorkerAction::Stage)).unwrap();
        assert!(!undo.applied);
        assert!(s.take_typed_semantic_decoded_once(env(s.receipt().unwrap(),WorkerAction::ExportEditedCopy)).is_err());
        assert!(s.stage_private_wardrobe_same_slot(env(s.receipt().unwrap(),WorkerAction::Stage),&t).is_err());
        s.redo_typed_semantic_batch(env(s.receipt().unwrap(),WorkerAction::Stage)).unwrap();
        let export=env(s.receipt().unwrap(),WorkerAction::ExportEditedCopy);
        assert_eq!(s.take_typed_semantic_decoded_once(export).unwrap(),expected);
        assert!(s.take_typed_semantic_decoded_once(export).is_err());
    }
}
