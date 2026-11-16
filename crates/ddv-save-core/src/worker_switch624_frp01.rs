//! ACT1534: fixed Switch624 FRP01 exact7 Worker adapter, same ProductSession and ledger.
use super::*;
use crate::WorkerAction;

fn hex32(v:&[u8;32])->String{v.iter().map(|b|format!("{b:02x}")).collect()}

impl WorkerSessionGuard {
    pub(crate) fn preview_frp01_product(&self,e:WorkerEnvelope,grid:u32,ids:[u32;3])->CoreResult<serde_json::Value>{
        if self.closed{return Err(CoreError("WORKER_SESSION_CLOSED"));}
        let p=self.session.preview_switch624_frp01_product(e,grid,ids)?;
        let t=&p.target;
        Ok(serde_json::json!({
            "contract":"wand.worker.switch624.scoped-frp01-exact7@1",
            "layout":"PRESERVE_EXISTING","gridId":t.grid,"oldIds":t.ids,"nextGridObjectId":t.next,
            "oldStock":t.old_stock,"newStock":t.new_stock,"inventoryDelta":0,
            "rootSha256":hex32(&t.root_sha),"gridSha256":hex32(&t.grid_sha),
            "counterSha256":hex32(&t.counter_sha),"housesSha256":hex32(&t.houses_sha),
            "oldStockSha256":hex32(&t.old_stock_sha),"newStockSha256":hex32(&t.new_stock_sha),
            "oldRowsSha256":t.old_rows_sha.iter().map(hex32).collect::<Vec<_>>(),
            "projectedDecodedSha256":hex32(&p.projected),"exactFieldChangedCount":7,
            "sessionId":t.scope.session_id.iter().map(|b|format!("{b:02x}")).collect::<String>(),
            "revision":t.scope.expected_revision,"indexGeneration":t.scope.expected_index_generation,
            "decodedSha256":hex32(&t.scope.expected_decoded_sha256),
            "writerAuthorized":false,"editedCopyAuthorized":false,
            "originalOverwriteAuthorized":false,"productReadAccepted":false
        }))
    }
    #[allow(clippy::too_many_arguments)]
    pub(crate) fn stage_frp01_product(&self,e:WorkerEnvelope,grid:u32,ids:[u32;3],next:u32,
       old_stock:u32,new_stock:u32,root:[u8;32],grid_sha:[u8;32],counter_sha:[u8;32],
       houses_sha:[u8;32],old_stock_sha:[u8;32],new_stock_sha:[u8;32],old_rows_sha:[[u8;32];3],
       projected:[u8;32])->CoreResult<crate::SemanticStageReceipt>{
        if self.closed{return Err(CoreError("WORKER_SESSION_CLOSED"));}
        if e.action!=WorkerAction::Stage{return Err(CoreError("FRP01_ABI_STAGE_ACTION"));}
        let fresh=self.session.preview_switch624_frp01_product(
            WorkerEnvelope{action:WorkerAction::ReadDomain,..e},grid,ids)?;
        let t=&fresh.target;
        if (t.next,t.old_stock,t.new_stock,t.root_sha,t.grid_sha,t.counter_sha,
            t.houses_sha,t.old_stock_sha,t.new_stock_sha,t.old_rows_sha,fresh.projected)
           !=(next,old_stock,new_stock,root,grid_sha,counter_sha,houses_sha,
              old_stock_sha,new_stock_sha,old_rows_sha,projected){
            return Err(CoreError("FRP01_ABI_TARGET_CAS"));
        }
        self.session.stage_switch624_frp01_product(e,&fresh)
    }
}
