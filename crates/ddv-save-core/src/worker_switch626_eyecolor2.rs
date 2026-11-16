//! ACT1507/09P: fixed Switch626 owned Eyeball ColorIndex2 exact1 Worker adapter.
//! The existing Core-minted readset, ProductSession and semantic ledger are the
//! only authorities. No caller item/color/path, rights, inventory or second Engine.
use super::*;
use crate::WorkerAction;

impl WorkerSessionGuard {
    pub(crate) fn preview_switch_eyecolor2(&self,e:WorkerEnvelope)->CoreResult<serde_json::Value>{
        if self.closed{return Err(CoreError("WORKER_SESSION_CLOSED"));}
        let p=self.session.prepare_fixed_switch626_eyecolor2(e)?;
        let hex=|bytes:&[u8]|bytes.iter().map(|b|format!("{b:02x}")).collect::<String>();
        Ok(serde_json::json!({
            "contract":"wand.worker.switch626.eyecolor2-exact1@1",
            "eyeballItemId":70000010,"field":"ColorIndex2","oldColorIndex":64,"newColorIndex":69,
            "sessionId":hex(&p.scope.session_id),"revision":p.scope.expected_revision,
            "indexGeneration":p.scope.expected_index_generation,
            "decodedSha256":hex(&p.scope.expected_decoded_sha256),
            "activeEyeSha256":p.active_eye_sha,"inactiveEyeSha256":p.inactive_eye_sha,
            "maleSha256":p.male_sha,"femaleSha256":p.female_sha,
            "stockEntrySha256":p.stock_entry_sha,"routeSha256":p.route_sha,
            "selectedTokenSha256":p.selected_token_sha,"projectedDecodedSha256":hex(&p.projected),
            "exactFieldChangedCount":1,"inventoryDelta":0,
            "writerAuthorized":false,"editedCopyAuthorized":false,
            "originalOverwriteAuthorized":false,"productReadAccepted":false
        }))
    }
    #[allow(clippy::too_many_arguments)]
    pub(crate) fn stage_switch_eyecolor2(&self,e:WorkerEnvelope,
        active:&str,inactive:&str,male:&str,female:&str,stock:&str,route:&str,
        token:&str,projected:[u8;32])->CoreResult<crate::SemanticStageReceipt>{
        if self.closed{return Err(CoreError("WORKER_SESSION_CLOSED"));}
        if e.action!=WorkerAction::Stage{return Err(CoreError("EYECOLOR2_ABI_STAGE_ACTION"));}
        let p=self.session.prepare_fixed_switch626_eyecolor2(
            WorkerEnvelope{action:WorkerAction::ReadDomain,..e})?;
        if p.active_eye_sha!=active||p.inactive_eye_sha!=inactive||
           p.male_sha!=male||p.female_sha!=female||
           p.stock_entry_sha!=stock||p.route_sha!=route||
           p.selected_token_sha!=token||p.projected!=projected{
            return Err(CoreError("EYECOLOR2_ABI_TARGET_CAS"));
        }
        self.session.stage_fixed_switch626_eyecolor2(e,&p)
    }
}
