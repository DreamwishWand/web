use super::*;
impl WorkerSessionGuard{
 pub(crate) fn preview_switch626_fd01(&self,e:WorkerEnvelope,grid:u32,x:u32,y:u32)->CoreResult<serde_json::Value>{
  if self.closed{return Err(CoreError("WORKER_SESSION_CLOSED"));}self.session.preview_switch626_fd01_product(e,grid,x,y)
 }
 pub(crate) fn stage_switch626_fd01(&self,e:WorkerEnvelope,grid:u32,x:u32,y:u32,next:u32,root:[u8;32],grid_sha:[u8;32],counter:[u8;32],houses:[u8;32],stock:u32,entry:[u8;32],projected:[u8;32])->CoreResult<crate::SemanticStageReceipt>{
  if self.closed{return Err(CoreError("WORKER_SESSION_CLOSED"));}self.session.stage_switch626_fd01_product(e,grid,x,y,next,root,grid_sha,counter,houses,stock,entry,projected)
 }
}
