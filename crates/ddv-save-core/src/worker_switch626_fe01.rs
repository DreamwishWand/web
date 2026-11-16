use super::*;
impl WorkerSessionGuard{
 pub(crate) fn preview_switch626_fe01(&self,e:WorkerEnvelope,grid:u32,ids:[u32;4])->CoreResult<serde_json::Value>{
  if self.closed{return Err(CoreError("WORKER_SESSION_CLOSED"));}self.session.preview_switch626_fe01_product(e,grid,ids)
 }
 pub(crate) fn stage_switch626_fe01(&self,e:WorkerEnvelope,grid:u32,ids:[u32;4],next:u32,root:[u8;32],grid_sha:[u8;32],counter:[u8;32],houses:[u8;32],rows:[[u8;32];4],projected:[u8;32])->CoreResult<crate::SemanticStageReceipt>{
  if self.closed{return Err(CoreError("WORKER_SESSION_CLOSED"));}self.session.stage_switch626_fe01_product(e,grid,ids,next,root,grid_sha,counter,houses,rows,projected)
 }
}
