//! ACT1075: native-private Switch626 Catalog0 ordinary existing decrease-one.
//! One existing ProductSession/semantic ledger. Not a product grant, not a
//! packaged eligibility claim. Private semantic/layout evidence and genuine
//! encrypted Backup/alternate output/reopen remain independent external gates.
use super::*;
use serde_json::{json,Value};
const BID:&str="9A239D3DB569756D";
const CONTRACT:&str="wand.private.switch626.catalog0-ordinary-existing-decrease-one@1";

fn exact_build(s:&ProductSession)->CoreResult<()>{
    let b=&s.native_source_build;
    if s.worker_bound||b.platform!=Platform::Switch||b.build_kind!=BuildKind::SwitchBid||
       b.build_id!=BID||b.schema!=626||!b.externally_attested{
        return Err(denied("PRIVATE_SWITCH_CATALOG0_BUILD"));
    }
    Ok(())
}
fn observe(s:&ProductSession,e:&WorkerEnvelope,item:u32)->CoreResult<(CoreExistingAmountTarget,Value)>{
    if item/10_000_000!=4||(item%10_000_000)/100_000!=0{
        return Err(denied("PRIVATE_SWITCH_CATALOG0_ORDINARY"));
    }
    let selection=ExistingAmountSelection::Inventory{inventory_id:0,item_id:item};
    let witness=observe_existing_amount(s,e,selection)?;
    let v=witness.view();
    if v.compatible_item_type!=ExistingAmountItemType::Furniture||v.chest.is_some()||v.old_amount<=1{
        return Err(denied("PRIVATE_SWITCH_CATALOG0_POSITIVE"));
    }
    let b=&s.decoded;
    let player=indexed_read::roots(b)?.player;
    let record=object_field(b,object_field(b,player,"ListInventories")?,"0")?;
    let restriction=object_field(b,record,"CompatibleFurnitureTypes")?;
    let (_,entry)=inventory_amount_entry(b,player,0,item)?;
    let marker=object_field(b,entry,"Marker")?;
    let token:String=serde_json::from_slice(&b[marker.begin..marker.end])
        .map_err(|_|denied("PRIVATE_SWITCH_CATALOG0_MARKER"))?;
    if token!="ItemMarker_None"{return Err(denied("PRIVATE_SWITCH_CATALOG0_MARKER"));}
    let facts=json!({
        "selector":{"inventoryId":0,"itemId":item},
        "target":{"itemId":item,"oldAmount":v.old_amount,"newAmount":v.old_amount-1,
            "compatibleItemType":native_type_token(v.compatible_item_type),
            "entrySha256":private_amount_hex(&v.entry_sha256),"chest":Value::Null},
        "routeSha256":private_amount_hex(&sha(&b[record.begin..record.end])),
        "restrictionSha256":private_amount_hex(&sha(&b[restriction.begin..restriction.end])),
        "markerSha256":private_amount_hex(&sha(&b[marker.begin..marker.end]))
    });
    Ok((witness,facts))
}
impl ProductSession{
    /// Read-only native witness for one explicit ordinary selector. No
    /// caller paths, no Save output or capability. Private receipts only.
    pub fn read_private_switch626_catalog0_witness(&self,e:WorkerEnvelope,item:u32)->CoreResult<Value>{
        exact_build(self)?;
        let st=self.lock()?;indexed_read::validate_scope(self,&st,&e)?;
        let (_,facts)=observe(self,&e,item)?;
        Ok(facts)
    }
    /// External plan/Backup bind the independently approved private evidence.
    /// Core derives all selected facts from the current immutable Session.
    pub fn mint_private_switch626_bound_catalog0_candidate(&self,e:WorkerEnvelope,plan:&[u8],
        original:[u8;32],original_size:u64,backup:[u8;32],backup_size:u64)
        ->CoreResult<PrivateBoundAmountCandidate>{
        exact_build(self)?;
        if e.expected_revision!=0||e.expected_index_generation!=1||original==[0;32]||
           original!=backup||original_size==0||original_size>128*1024*1024||original_size!=backup_size||
           plan.is_empty()||plan.len()>8192{
            return Err(denied("PRIVATE_SWITCH_CATALOG0_EXTERNAL_BINDING"));
        }
        let p:Value=serde_json::from_slice(plan).map_err(|_|denied("PRIVATE_SWITCH_CATALOG0_PLAN_JSON"))?;
        if serde_json::to_vec(&p).map_err(|_|denied("PRIVATE_SWITCH_CATALOG0_PLAN_JSON"))?.as_slice()!=plan{
            return Err(denied("PRIVATE_SWITCH_CATALOG0_PLAN_CANONICAL"));
        }
        let item=p["selector"]["itemId"].as_u64().and_then(|n|u32::try_from(n).ok())
            .ok_or(denied("PRIVATE_SWITCH_CATALOG0_SELECTOR"))?;
        let st=self.lock()?;indexed_read::validate_scope(self,&st,&e)?;
        let (witness,facts)=observe(self,&e,item)?;
        let expected=json!({"contract":CONTRACT,"buildId":BID,
            "sourceDecodedSha256":private_amount_hex(&e.expected_decoded_sha256),
            "originalSha256":private_amount_hex(&original),"backupSha256":private_amount_hex(&backup),
            "originalSizeBytes":original_size,"backupSizeBytes":backup_size,
            "revision":0,"indexGeneration":1,"selector":facts["selector"],"target":facts["target"],
            "routeSha256":facts["routeSha256"],"restrictionSha256":facts["restrictionSha256"],
            "markerSha256":facts["markerSha256"]});
        if p!=expected{return Err(denied("PRIVATE_SWITCH_CATALOG0_PLAN_WITNESS_CAS"));}
        let new_amount=witness.view().old_amount-1;
        let _=command_from_target(&witness,new_amount)?;
        Ok(PrivateBoundAmountCandidate{target:witness,new_amount,switch_chest:false})
    }
    pub fn stage_private_switch626_bound_catalog0_candidate(&self,e:WorkerEnvelope,c:&PrivateBoundAmountCandidate)
        ->CoreResult<SemanticStageReceipt>{
        exact_build(self)?;
        if c.switch_chest{return Err(denied("PRIVATE_SWITCH_CATALOG0_MODE"));}
        let ExistingAmountSelection::Inventory{inventory_id:0,item_id}=c.target.view().selection
            else{return Err(denied("PRIVATE_SWITCH_CATALOG0_MODE"));};
        let cmd={
            let st=self.lock()?;check(self,&st,&e,WorkerAction::Stage)?;
            if st.semantic.is_some(){return Err(denied("SEMANTIC_STAGE_ALREADY_EXISTS"));}
            let (current,_)=observe(self,&e,item_id)?;
            if current!=c.target||c.new_amount.checked_add(1)!=Some(current.view().old_amount){
                return Err(denied("PRIVATE_SWITCH_CATALOG0_TARGET_CAS"));
            }
            command_from_target(&c.target,c.new_amount)?
        };
        let player=indexed_read::roots(&self.decoded)?.player;
        let edit=target(&self.decoded,player,&cmd)?;
        self.commit_semantic_replacements(e,vec![edit],1,None)
    }
}
#[cfg(test)]
mod tests{
    use super::*;
    use crate::BuildIdentity;
    fn doc()->Value{json!({"GameInfo":{"Version":626},"World":{},"Player":{
        "ListInventories":{"0":{"ID":0,"CompatibleItemType":"ItemType_Furniture",
            "CompatibleFurnitureTypes":{"List":["FurnitureItemType_Default"]},
            "Inventory":{"40000001":{"Amount":7,"Marker":"ItemMarker_None","Unknown":{"a":1}},
                         "40000002":{"Amount":3,"Marker":"ItemMarker_None"}}}}}})}
    fn open(d:&Value)->ProductSession{ProductSession::open_decoded_readonly(serde_json::to_vec(d).unwrap(),
        BuildIdentity{platform:Platform::Switch,build_kind:BuildKind::SwitchBid,build_id:BID.into(),
            schema:626,externally_attested:true}).unwrap()}
    fn env(s:&ProductSession,action:WorkerAction)->WorkerEnvelope{
        let r=s.receipt().unwrap();WorkerEnvelope{contract:PRODUCT_WORKER_CONTRACT,
            session_id:r.session_id,expected_revision:r.revision,expected_index_generation:r.index_generation,
            expected_decoded_sha256:r.decoded_sha256,action}
    }
    #[test]
    fn switch626_catalog0_private_exact_one_cas(){
        let mut d=doc();let s=open(&d);let e=env(&s,WorkerAction::ReadDomain);let h=[7;32];
        let f=s.read_private_switch626_catalog0_witness(e,40000001).unwrap();
        let plan=json!({"contract":CONTRACT,"buildId":BID,"sourceDecodedSha256":private_amount_hex(&e.expected_decoded_sha256),
            "originalSha256":private_amount_hex(&h),"backupSha256":private_amount_hex(&h),
            "originalSizeBytes":123,"backupSizeBytes":123,"revision":0,"indexGeneration":1,
            "selector":f["selector"],"target":f["target"],"routeSha256":f["routeSha256"],
            "restrictionSha256":f["restrictionSha256"],"markerSha256":f["markerSha256"]});
        let mint=|p:&Value|s.mint_private_switch626_bound_catalog0_candidate(e,&serde_json::to_vec(p).unwrap(),h,123,h,123);
        for k in ["contract","buildId","sourceDecodedSha256","backupSha256","routeSha256","restrictionSha256","markerSha256","revision","indexGeneration"]{
            let mut q=plan.clone();q[k]=json!("bad");assert!(mint(&q).is_err(),"{k}");
        }
        for k in ["oldAmount","newAmount","entrySha256","compatibleItemType"]{
            let mut q=plan.clone();q["target"][k]=json!("bad");assert!(mint(&q).is_err(),"{k}");
        }
        let mut q=plan.clone();q["selector"]["inventoryId"]=json!(1);assert!(mint(&q).is_err());
        let mut q=plan.clone();q["target"]["newAmount"]=json!(0);assert!(mint(&q).is_err());
        let mut q=plan.clone();q["target"]["rightsVerified"]=json!(true);assert!(mint(&q).is_err());
        assert!(s.mint_private_switch626_bound_catalog0_candidate(e,&serde_json::to_vec(&plan).unwrap(),h,123,[8;32],123).is_err());
        for (k,v) in [("Amount",json!(1)),("Amount",json!(0)),("Marker",json!("ItemMarker_Favorite")),("Marker",json!(null))]{
            let mut bad=d.clone();bad["Player"]["ListInventories"]["0"]["Inventory"]["40000001"][k]=v;
            let other=open(&bad);assert!(other.read_private_switch626_catalog0_witness(env(&other,WorkerAction::ReadDomain),40000001).is_err());
        }
        let c=mint(&plan).unwrap();let stage=env(&s,WorkerAction::Stage);
        assert!(s.stage_private_bound_amount_candidate(stage,&c).is_err());
        assert!(s.stage_private_switch626_bound_chest_candidate(stage,&c).is_err());
        let other=open(&d);assert!(other.stage_private_switch626_bound_catalog0_candidate(env(&other,WorkerAction::Stage),&c).is_err());
        let mut stale=stage;stale.expected_revision+=1;assert!(s.stage_private_switch626_bound_catalog0_candidate(stale,&c).is_err());
        let r=s.stage_private_switch626_bound_catalog0_candidate(stage,&c).unwrap();
        assert_eq!(r.exact_field_changed_count,1);assert!(!r.product_writer_authorized);
        assert!(s.stage_private_switch626_bound_catalog0_candidate(stage,&c).is_err());
        s.undo_typed_semantic_batch(env(&s,WorkerAction::Stage)).unwrap();
        assert!(s.take_typed_semantic_decoded_once(env(&s,WorkerAction::ExportEditedCopy)).is_err());
        s.redo_typed_semantic_batch(env(&s,WorkerAction::Stage)).unwrap();
        let export=env(&s,WorkerAction::ExportEditedCopy);
        let out=s.take_typed_semantic_decoded_once(export).unwrap();
        assert!(s.take_typed_semantic_decoded_once(export).is_err());
        d["Player"]["ListInventories"]["0"]["Inventory"]["40000001"]["Amount"]=json!(6);
        assert_eq!(out,serde_json::to_vec(&d).unwrap());
    }
}
