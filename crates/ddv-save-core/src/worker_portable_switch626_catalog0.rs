//! Existing Worker guard, same ProductSession, no additional authority.
use super::*;
impl WorkerSessionGuard {
    pub(crate) fn capture_switch626_catalog0_portable(&self,e:WorkerEnvelope,item:u32)->CoreResult<Vec<u8>>{
        if self.closed{return Err(CoreError("WORKER_SESSION_CLOSED"));}
        self.session.capture_switch626_catalog0_portable_backup(e,item)
    }
    pub(crate) fn preview_switch626_catalog0_portable(&self,e:WorkerEnvelope,item:u32,backup:&[u8])->CoreResult<serde_json::Value>{
        if self.closed{return Err(CoreError("WORKER_SESSION_CLOSED"));}
        let v=self.session.preview_switch626_catalog0_portable_restore(e,item,backup)?;
        let hex=|v:[u8;32]|->String{v.iter().map(|x|format!("{x:02x}")).collect::<Vec<_>>().concat()};
        Ok(serde_json::json!({"contract":"wand.worker.switch626.catalog0-portable-restore@1","itemId":item,"oldAmount":v.old_amount,"newAmount":v.new_amount,"entrySha256":hex(v.entry_sha),"backupSha256":hex(v.backup_sha),"projectedSha256":hex(v.projected_sha),"writerAuthorized":false}))
    }
    pub(crate) fn stage_switch626_catalog0_portable(&self,e:WorkerEnvelope,item:u32,backup:&[u8],old:u32,new:u32,entry:[u8;32],backup_sha:[u8;32],projected:[u8;32])->CoreResult<crate::SemanticStageReceipt>{
        if self.closed{return Err(CoreError("WORKER_SESSION_CLOSED"));}
        self.session.stage_switch626_catalog0_portable_restore(e,item,backup,old,new,entry,backup_sha,projected)
    }
}
