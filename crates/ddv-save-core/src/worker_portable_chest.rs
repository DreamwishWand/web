//! Existing Worker guard, same ProductSession, no additional authority.
use super::*;
impl WorkerSessionGuard {
    pub(crate) fn capture_chest_portable(&self,e:WorkerEnvelope,container:u32,slot:u32)->CoreResult<Vec<u8>>{
        if self.closed{return Err(CoreError("WORKER_SESSION_CLOSED"));}
        self.session.capture_product_chest_portable_backup(e,container,slot as usize)
    }
    pub(crate) fn preview_chest_portable(&self,e:WorkerEnvelope,container:u32,slot:u32,backup:&[u8])->CoreResult<serde_json::Value>{
        if self.closed{return Err(CoreError("WORKER_SESSION_CLOSED"));}
        let v=self.session.preview_product_chest_portable_restore(e,container,slot as usize,backup)?;
        let hex=|v:[u8;32]|->String{v.iter().map(|x|format!("{x:02x}")).collect::<Vec<_>>().concat()};
        Ok(serde_json::json!({"contract":"wand.worker.steam626.chest-portable-restore@1","containerId":v.container_id,"slotIndex":v.slot_index,"itemId":v.item_id,"oldAmount":v.old_amount,"newAmount":v.new_amount,"entrySha256":hex(v.entry_sha),"backupSha256":hex(v.backup_sha),"projectedSha256":hex(v.projected_sha),"writerAuthorized":false}))
    }
    pub(crate) fn stage_chest_portable(&self,e:WorkerEnvelope,container:u32,slot:u32,backup:&[u8],old:u32,new:u32,entry:[u8;32],backup_sha:[u8;32],projected:[u8;32])->CoreResult<crate::SemanticStageReceipt>{
        if self.closed{return Err(CoreError("WORKER_SESSION_CLOSED"));}
        self.session.stage_product_chest_portable_restore(e,container,slot as usize,backup,old,new,entry,backup_sha,projected)
    }
}
