//! Policy73 Steam626 linked Chest amount Backup/Restore; exact same target.
//! Common .wand.json envelope, accepted linked-crop provider and shared ledger.
use super::*;
use crate::portable_backup::{LinkedChestAmountBackup,encode_linked_chest_amount_backup,decode_linked_chest_amount_backup};
use sha2::{Digest,Sha256};

#[derive(Clone,Debug,PartialEq,Eq)]
pub(crate) struct ChestPortableRestorePreview{
    pub(crate) container_id:u32,pub(crate) slot_index:usize,pub(crate) item_id:u32,
    pub(crate) old_amount:u32,pub(crate) new_amount:u32,
    pub(crate) entry_sha:[u8;32],pub(crate) backup_sha:[u8;32],pub(crate) projected_sha:[u8;32],
}
struct Prepared{preview:ChestPortableRestorePreview,target:CoreExistingAmountTarget,edit:Replacement}
fn parts(xs:&[&[u8]])->[u8;32]{let mut h=Sha256::new();for x in xs{h.update(x);}h.finalize().into()}
fn capture_facts(s:&ProductSession,t:&CoreExistingAmountTarget)->CoreResult<ExistingChestFacts>{
    let v=t.view();let facts=v.chest.ok_or(denied("PORTABLE_CHEST_FACTS"))?;
    let (a,_)=pack()?;let p=&a["profiles"]["linkedCropChest48"];
    need(matches!(v.old_amount,49|50)&&facts.size==48&&facts.extra_size==0&&facts.physical_slot_count==48&&
        facts.packaged_stack_bound==50&&facts.state_sha256==sha(b"null")&&facts.belongs_to_player&&!facts.block_move_to&&
        in_rows(&p["items"],v.item_id)&&in_rows(&p["parents"],facts.parent_item_id),"PORTABLE_CHEST_CAPTURE_PROFILE")?;
    let b=&s.decoded;let r=indexed_read::roots(b)?;let (container,slot)=match v.selection{
        ExistingAmountSelection::Chest{container_id,slot_index}=>(container_id,slot_index),_=>return Err(denied("PORTABLE_CHEST_CAPTURE_TARGET"))};
    need(container>1&&slot<48,"PORTABLE_CHEST_CAPTURE_TARGET")?;
    // Same existing linked parent/root and physical stock checks, read-only.
    let link=scan_grids_bound(b,r.world,v.item_id,Some((container,facts.parent_item_id)),LayoutBinding::Steam626ChestStatic)?
        .ok_or(denied("PORTABLE_CHEST_CAPTURE_LINK"))?;
    check_parent(b,r.world,link,facts.parent_item_id,container)?;
    physical_totals(b,r.player,v.item_id,Some((container,slot)),v.old_amount)?;
    Ok(facts)
}
impl ProductSession{
    #[allow(dead_code)]
    pub(crate) fn capture_product_chest_portable_backup(&self,e:WorkerEnvelope,container:u32,slot:usize)->CoreResult<Vec<u8>>{
        build_check(self)?;
        let st=self.lock()?;check(self,&st,&e,WorkerAction::ReadDomain)?;
        need(st.semantic.is_none()&&st.revision==0&&st.generation==1,"PORTABLE_CHEST_CAPTURE_EPOCH")?;
        let t=observe_existing_amount(self,&e,ExistingAmountSelection::Chest{container_id:container,slot_index:slot})?;
        let facts=capture_facts(self,&t)?;let v=t.view();
        encode_linked_chest_amount_backup(&LinkedChestAmountBackup{container_id:container,slot_index:slot as u32,item_id:v.item_id as u32,
            parent_item_id:facts.parent_item_id as u32,amount:v.old_amount,entry_sha256:hex(&v.entry_sha256),source_decoded_sha256:hex(&self.sha)})
    }
    fn prepare_product_chest_portable_restore(&self,e:WorkerEnvelope,container:u32,slot:usize,backup:&[u8])->CoreResult<Prepared>{
        let snap=decode_linked_chest_amount_backup(backup)?;
        need(snap.container_id==container&&snap.slot_index as usize==slot&&snap.amount==49,"PORTABLE_CHEST_RESTORE_TARGET")?;
        let t=self.preview_scoped_product_amount(e,ExistingAmountSelection::Chest{container_id:container,slot_index:slot},49)?;
        let v=t.view();let facts=v.chest.ok_or(denied("PORTABLE_CHEST_FACTS"))?;
        need(v.old_amount==50&&v.item_id as u32==snap.item_id&&facts.parent_item_id as u32==snap.parent_item_id,"PORTABLE_CHEST_RESTORE_WITNESS")?;
        let b=&self.decoded;let r=indexed_read::roots(b)?;
        let record=object_field(b,object_field(b,r.player,"ContainerInventories")?,&container.to_string())?;
        let entry=array_element(b,object_field(b,record,"Inventory")?,slot)?;
        let span=object_field(b,entry,"Amount")?;let old=b"50".to_vec();let new=b"49".to_vec();
        need(entry.begin<=span.begin&&span.end<=entry.end&&b.get(span.begin..span.end)==Some(old.as_slice())&&
            sha(&b[entry.begin..entry.end])==v.entry_sha256,"PORTABLE_CHEST_RESTORE_RAW_CAS")?;
        let entry_after=parts(&[&b[entry.begin..span.begin],&new,&b[span.end..entry.end]]);
        let projected=parts(&[&b[..span.begin],&new,&b[span.end..]]);
        need(hex(&entry_after)==snap.entry_sha256&&hex(&projected)==snap.source_decoded_sha256,"PORTABLE_CHEST_RESTORE_NOT_EXACT_LINEAGE")?;
        let preview=ChestPortableRestorePreview{container_id:container,slot_index:slot,item_id:snap.item_id,
            old_amount:50,new_amount:49,entry_sha:v.entry_sha256,backup_sha:sha(backup),projected_sha:projected};
        Ok(Prepared{preview,target:t,edit:Replacement{span,old,new}})
    }
    #[allow(dead_code)]
    pub(crate) fn preview_product_chest_portable_restore(&self,e:WorkerEnvelope,container:u32,slot:usize,backup:&[u8])->CoreResult<ChestPortableRestorePreview>{
        Ok(self.prepare_product_chest_portable_restore(e,container,slot,backup)?.preview)
    }
    #[allow(dead_code)]
    pub(crate) fn stage_product_chest_portable_restore(&self,e:WorkerEnvelope,container:u32,slot:usize,backup:&[u8],old:u32,new:u32,
        entry_sha:[u8;32],backup_sha:[u8;32],projected_sha:[u8;32])->CoreResult<SemanticStageReceipt>{
        need(e.action==WorkerAction::Stage,"PORTABLE_CHEST_RESTORE_STAGE_ACTION")?;
        let p=self.prepare_product_chest_portable_restore(WorkerEnvelope{action:WorkerAction::ReadDomain,..e},container,slot,backup)?;
        let v=&p.preview;
        need(v.old_amount==old&&v.new_amount==new&&v.entry_sha==entry_sha&&v.backup_sha==backup_sha&&v.projected_sha==projected_sha,"PORTABLE_CHEST_RESTORE_STAGE_CAS")?;
        {let st=self.lock()?;check(self,&st,&e,WorkerAction::Stage)?;need(st.semantic.is_none(),"PORTABLE_CHEST_RESTORE_ALREADY_STAGED")?;validate_target_snapshot(self,&e,&p.target)?;}
        self.commit_semantic_replacements(e,vec![p.edit],1,Some(projected_sha))
    }
}
