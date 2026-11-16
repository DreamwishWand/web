//! Policy73 Catalog0 portable Backup/Restore adapter, Steam626 only.
//! Reuse the accepted amount provider and the single immutable ProductSession.
//! A .wand.json digest is integrity, NOT authority. Restore is exact prior
//! document equality after the already-eligible positive one-unit decrease.
//! Increase, Apply to another target, and any public Worker/Flag grant stay out.
use super::*;
use crate::portable_backup::{decode_inventory_amount_backup,InventoryRestoreDisposition};
use sha2::{Digest,Sha256};

#[derive(Clone,Debug,PartialEq,Eq)]
pub(crate) struct Catalog0PortableRestorePreview{
    pub(crate) item_id:u32,
    pub(crate) old_amount:u32,
    pub(crate) new_amount:u32,
    pub(crate) entry_sha:[u8;32],
    pub(crate) backup_sha:[u8;32],
    pub(crate) projected_sha:[u8;32],
}
struct Prepared{
    preview:Catalog0PortableRestorePreview,
    target:CoreExistingAmountTarget,
    edit:Replacement,
}
fn parts(xs:&[&[u8]])->[u8;32]{
    let mut h=Sha256::new();for x in xs{h.update(x);}h.finalize().into()
}
impl ProductSession{
    #[allow(dead_code)]
    pub(crate) fn capture_product_catalog0_portable_backup(&self,e:WorkerEnvelope,item:u32)->CoreResult<Vec<u8>>{
        build_check(self)?;
        {
            let st=self.lock()?;check(self,&st,&e,WorkerAction::ReadDomain)?;
            need(st.semantic.is_none()&&st.revision==0&&st.generation==1,"PORTABLE_CATALOG0_CAPTURE_EPOCH")?;
        }
        let (catalog,_)=pack()?;
        need(item<=i32::MAX as u32&&in_rows(&catalog["profiles"]["catalog0Furniture"]["entries"],item as i32),"PORTABLE_CATALOG0_CAPTURE_ITEM")?;
        let b=&self.decoded;let roots=indexed_read::roots(b)?;let lists=f(b,roots.player,"ListInventories")?;
        let mut matches=0usize;
        for(k,route)in members(b,lists,4096)?{
            let id=key(&k)?;need(n(b,route,"ID")?==id,"PORTABLE_CATALOG0_CAPTURE_ROUTE")?;
            if opt(b,f(b,route,"Inventory")?,&item.to_string())?.is_some(){
                matches+=1;need(id==0,"PORTABLE_CATALOG0_CAPTURE_ROUTE")?;
            }
        }
        need(matches==1,"PORTABLE_CATALOG0_CAPTURE_ROUTE")?;
        // Reuse the existing exact lexical positive amount reader (including 1)
        // and common canonical envelope. Capture never grants a later Stage.
        self.capture_inventory_amount_backup(e,0,item)
    }
    fn prepare_product_catalog0_portable_restore(&self,e:WorkerEnvelope,item:u32,backup:&[u8])->CoreResult<Prepared>{
        build_check(self)?;
        let snapshot=decode_inventory_amount_backup(backup)?;
        need(snapshot.inventory_id==0&&snapshot.item_id==item,"PORTABLE_CATALOG0_RESTORE_TARGET")?;
        let review=self.review_inventory_amount_restore(e,backup,0,item)?;
        need(review.disposition==InventoryRestoreDisposition::PositiveDecreaseCandidate&&
            review.current_amount.checked_sub(1)==Some(review.backup_amount)&&review.backup_amount>0,"PORTABLE_CATALOG0_RESTORE_DECREASE_ONE")?;
        // Product scope/rights/current subscribers/references are independently
        // re-established by the existing provider, never by backup metadata.
        let target=self.preview_scoped_product_amount(e,ExistingAmountSelection::Inventory{inventory_id:0,item_id:item},review.backup_amount)?;
        let v=target.view();
        need(v.old_amount==review.current_amount&&v.entry_sha256==review.current_entry_sha256&&
            v.compatible_item_type==ExistingAmountItemType::Furniture,"PORTABLE_CATALOG0_RESTORE_WITNESS")?;
        let b=&self.decoded;
        let (kind,entry)=inventory_amount_entry(b,indexed_read::roots(b)?.player,0,item)?;
        let span=object_field(b,entry,"Amount")?;
        let old=v.old_amount.to_string().into_bytes();let new=review.backup_amount.to_string().into_bytes();
        need(kind==ExistingAmountItemType::Furniture&&entry.begin<=span.begin&&span.end<=entry.end&&
            b.get(span.begin..span.end)==Some(old.as_slice())&&sha(&b[entry.begin..entry.end])==v.entry_sha256,"PORTABLE_CATALOG0_RESTORE_RAW_CAS")?;
        let entry_after=parts(&[&b[entry.begin..span.begin],&new,&b[span.end..entry.end]]);
        let projected=parts(&[&b[..span.begin],&new,&b[span.end..]]);
        // Restore the original target only. Same ItemID alone is not lineage.
        // Both exact entry and full lexical output must match the backup.
        need(hex(&entry_after)==review.backup_entry_sha256&&hex(&projected)==review.backup_decoded_sha256,
            "PORTABLE_CATALOG0_RESTORE_NOT_EXACT_LINEAGE")?;
        let preview=Catalog0PortableRestorePreview{item_id:item,old_amount:v.old_amount,new_amount:review.backup_amount,
            entry_sha:v.entry_sha256,backup_sha:sha(backup),projected_sha:projected};
        Ok(Prepared{preview,target,edit:Replacement{span,old,new}})
    }
    #[allow(dead_code)]
    pub(crate) fn preview_product_catalog0_portable_restore(&self,e:WorkerEnvelope,item:u32,backup:&[u8])->CoreResult<Catalog0PortableRestorePreview>{
        Ok(self.prepare_product_catalog0_portable_restore(e,item,backup)?.preview)
    }
    #[allow(dead_code)]
    pub(crate) fn stage_product_catalog0_portable_restore(&self,e:WorkerEnvelope,item:u32,backup:&[u8],old:u32,new:u32,
        entry_sha:[u8;32],backup_sha:[u8;32],projected_sha:[u8;32])->CoreResult<SemanticStageReceipt>{
        need(e.action==WorkerAction::Stage,"PORTABLE_CATALOG0_RESTORE_STAGE_ACTION")?;
        let p=self.prepare_product_catalog0_portable_restore(WorkerEnvelope{action:WorkerAction::ReadDomain,..e},item,backup)?;
        let v=&p.preview;
        need(v.item_id==item&&v.old_amount==old&&v.new_amount==new&&v.entry_sha==entry_sha&&v.backup_sha==backup_sha&&v.projected_sha==projected_sha,
            "PORTABLE_CATALOG0_RESTORE_STAGE_CAS")?;
        {
            let st=self.lock()?;check(self,&st,&e,WorkerAction::Stage)?;
            need(st.semantic.is_none(),"PORTABLE_CATALOG0_RESTORE_ALREADY_STAGED")?;
            validate_target_snapshot(self,&e,&p.target)?;
        }
        // Same ledger, final epoch/old-byte/full-document/projected-SHA CAS.
        self.commit_semantic_replacements(e,vec![p.edit],1,Some(projected_sha))
    }
}
