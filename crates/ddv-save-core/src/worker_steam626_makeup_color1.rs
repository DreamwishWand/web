//! ACT1486/09P: one existing ProductSession, fixed Male Makeup slot1 53 -> 60.
//! No caller-selected path, field, item, channel, currency, rights or quantity.
use super::*;
use crate::WorkerAction;

impl WorkerSessionGuard {
    pub(crate) fn preview_makeup_color1(&self,e:WorkerEnvelope)->CoreResult<serde_json::Value>{
        if self.closed{return Err(CoreError("WORKER_SESSION_CLOSED"));}
        let p=self.session.prepare_fixed_makeup_color1(e)?;
        let session_id=p.scope.session_id.iter().map(|b|format!("{b:02x}")).collect::<String>();
        let source_sha=p.scope.expected_decoded_sha256.iter().map(|b|format!("{b:02x}")).collect::<String>();
        let projected=p.projected.iter().map(|b|format!("{b:02x}")).collect::<String>();
        Ok(serde_json::json!({
          "contract":"wand.worker.steam626.makeup-color1-exact1@1",
          "makeupItemId":140100014,"slot":1,"field":"ColorIndex1","oldColorIndex":53,"newColorIndex":60,
          "sessionId":session_id,"revision":p.scope.expected_revision,
          "indexGeneration":p.scope.expected_index_generation,"decodedSha256":source_sha,
          "tokenSha256":p.token_sha,"entrySha256":p.entry_sha,
          "femaleSha256":p.female_sha,"maleSha256":p.male_sha,
          "routesSha256":p.routes_sha,"projectedDecodedSha256":projected,
          "exactFieldChangedCount":1,"inventoryDelta":0,
          "scopedCandidate":true,"writerAuthorized":false,"editedCopyAuthorized":false,
          "originalOverwriteAuthorized":false
        }))
    }
    pub(crate) fn stage_makeup_color1(&self,e:WorkerEnvelope,token:&str,entry:&str,female:&str,
        male:&str,routes:&str,projected:[u8;32])->CoreResult<crate::SemanticStageReceipt>{
        if self.closed{return Err(CoreError("WORKER_SESSION_CLOSED"));}
        if e.action!=WorkerAction::Stage{return Err(CoreError("MAKEUP_ABI_STAGE_ACTION"));}
        let p=self.session.prepare_fixed_makeup_color1(WorkerEnvelope{action:WorkerAction::ReadDomain,..e})?;
        if p.token_sha!=token||p.entry_sha!=entry||p.female_sha!=female||
           p.male_sha!=male||p.routes_sha!=routes||p.projected!=projected{
            return Err(CoreError("MAKEUP_ABI_TARGET_CAS"));
        }
        self.session.stage_fixed_makeup_color1(e,&p)
    }
}
