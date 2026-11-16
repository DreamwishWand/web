use super::*;
use crate::portable_backup::{PortableBackupBuild,encode_inventory_amount_backup_for_build,decode_inventory_amount_backup_for_build};
use sha2::{Digest,Sha256};
const BUILD:PortableBackupBuild=PortableBackupBuild::Switch626;
fn parts(xs:&[&[u8]])->[u8;32]{let mut h=Sha256::new();for x in xs{h.update(x);}h.finalize().into()}
#[derive(Clone,Debug,PartialEq,Eq)]
pub(crate) struct SwitchCatalog0RestorePreview{
    pub(crate) old_amount:u32,pub(crate) new_amount:u32,pub(crate) entry_sha:[u8;32],
    pub(crate) backup_sha:[u8;32],pub(crate) projected_sha:[u8;32],
}
struct Prepared{preview:SwitchCatalog0RestorePreview,target:CoreExistingAmountTarget,edit:Replacement}
impl ProductSession{
    #[allow(dead_code)]
    pub(crate) fn capture_switch626_catalog0_portable_backup(&self,e:WorkerEnvelope,item:u32)->CoreResult<Vec<u8>>{
        need(item==ITEM,"SWITCH_PORTABLE_CATALOG0_TARGET")?;
        exact_build(self)?;
        let st=self.lock()?;check(self,&st,&e,WorkerAction::ReadDomain)?;
        need(st.semantic.is_none()&&st.revision==0&&st.generation==1,"SWITCH_PORTABLE_CAPTURE_EPOCH")?;
        let t=observe_existing_amount(self,&e,selection())?;let v=t.view();
        need(matches!(v.old_amount,998|999),"SWITCH_PORTABLE_CATALOG0_AMOUNT")?;
        eligible_bound(self,&t,v.old_amount-1,LayoutBinding::Switch626Catalog0Static)?;
        let payload=serde_json::json!({"amount":v.old_amount,"entrySha256":hex(&v.entry_sha256),"itemType":"ItemType_Furniture"});
        encode_inventory_amount_backup_for_build(BUILD,0,item,&hex(&self.sha),&serde_json::to_vec(&payload).map_err(|_|denied("SWITCH_PORTABLE_PAYLOAD"))?)
    }
    fn prepare_switch626_catalog0_portable_restore(&self,e:WorkerEnvelope,item:u32,backup:&[u8])->CoreResult<Prepared>{
        let snap=decode_inventory_amount_backup_for_build(BUILD,backup)?;
        need(item==ITEM&&snap.inventory_id==0&&snap.item_id==item&&snap.amount==998,"SWITCH_PORTABLE_CATALOG0_TARGET")?;
        let payload=snap.payload.as_object().ok_or(denied("SWITCH_PORTABLE_PAYLOAD"))?;
        need(payload.len()==3&&payload.contains_key("amount")&&payload.contains_key("entrySha256")&&
            snap.payload["itemType"]=="ItemType_Furniture","SWITCH_PORTABLE_PAYLOAD")?;
        let t=self.preview_switch626_scoped_catalog0(e,selection(),998)?;let v=t.view();
        need(v.old_amount==999,"SWITCH_PORTABLE_CATALOG0_AMOUNT")?;
        let b=&self.decoded;let (kind,entry)=inventory_amount_entry(b,indexed_read::roots(b)?.player,0,item)?;
        let span=object_field(b,entry,"Amount")?;let old=b"999".to_vec();let new=b"998".to_vec();
        need(kind==ExistingAmountItemType::Furniture&&entry.begin<=span.begin&&span.end<=entry.end&&
            b.get(span.begin..span.end)==Some(old.as_slice())&&sha(&b[entry.begin..entry.end])==v.entry_sha256,"SWITCH_PORTABLE_RAW_CAS")?;
        let after=parts(&[&b[entry.begin..span.begin],&new,&b[span.end..entry.end]]);
        let projected=parts(&[&b[..span.begin],&new,&b[span.end..]]);
        need(snap.payload["entrySha256"]==hex(&after)&&snap.source_decoded_sha256==hex(&projected),"SWITCH_PORTABLE_NOT_EXACT_LINEAGE")?;
        Ok(Prepared{preview:SwitchCatalog0RestorePreview{old_amount:999,new_amount:998,entry_sha:v.entry_sha256,
            backup_sha:sha(backup),projected_sha:projected},target:t,edit:Replacement{span,old,new}})
    }
    #[allow(dead_code)]
    pub(crate) fn preview_switch626_catalog0_portable_restore(&self,e:WorkerEnvelope,item:u32,backup:&[u8])->CoreResult<SwitchCatalog0RestorePreview>{
        Ok(self.prepare_switch626_catalog0_portable_restore(e,item,backup)?.preview)
    }
    #[allow(dead_code)]
    pub(crate) fn stage_switch626_catalog0_portable_restore(&self,e:WorkerEnvelope,item:u32,backup:&[u8],old:u32,new:u32,
        entry:[u8;32],backup_sha:[u8;32],projected:[u8;32])->CoreResult<SemanticStageReceipt>{
        need(e.action==WorkerAction::Stage,"SWITCH_PORTABLE_STAGE_ACTION")?;
        let p=self.prepare_switch626_catalog0_portable_restore(WorkerEnvelope{action:WorkerAction::ReadDomain,..e},item,backup)?;
        let v=&p.preview;need(v.old_amount==old&&v.new_amount==new&&v.entry_sha==entry&&v.backup_sha==backup_sha&&v.projected_sha==projected,"SWITCH_PORTABLE_STAGE_CAS")?;
        {let st=self.lock()?;check(self,&st,&e,WorkerAction::Stage)?;need(st.semantic.is_none(),"SWITCH_PORTABLE_ALREADY_STAGED")?;validate_target_snapshot(self,&e,&p.target)?;}
        self.commit_semantic_replacements(e,vec![p.edit],1,Some(projected))
    }
}
