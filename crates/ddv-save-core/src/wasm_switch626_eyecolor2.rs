//! ACT1507/09P: only fixed Switch626 Eyeball ColorIndex2 64 -> 69 exact1.
//! Separate opt-in generated surface; reuse the existing ProductSession,
//! Worker guarded CAS, semantic batch, Undo/Redo and once-only output.
use super::*;
const CONTRACT:&str="wand.worker.switch626.eyecolor2-exact1@1";
const OUTPUT:&str="wand.worker.switch626.eyecolor2-exact1-output@1";

#[wasm_bindgen]
impl WorkerWasmSource {
    pub fn preview_switch626_eyecolor2(&self,session_id:&str,revision:u64,
        index_generation:u64,decoded_sha256:&str)->Result<String,JsValue>{
        if self.scoped_domain.get().is_some(){return Err(err("EYECOLOR2_ABI_ALREADY_STAGED"));}
        let guard=self.session.as_ref().ok_or(err("WORKER_SESSION_NOT_READY"))?;
        let e=scoped_edit_envelope(session_id,revision,index_generation,decoded_sha256,
                                   WorkerAction::ReadDomain)?;
        Ok(guard.preview_switch_eyecolor2(e).map_err(|x|err(x.0))?.to_string())
    }
    #[allow(clippy::too_many_arguments)]
    pub fn stage_switch626_eyecolor2(&self,active_sha:&str,inactive_sha:&str,
        male_sha:&str,female_sha:&str,stock_sha:&str,route_sha:&str,token_sha:&str,
        projected_sha:&str,session_id:&str,revision:u64,index_generation:u64,
        decoded_sha256:&str)->Result<String,JsValue>{
        if self.scoped_domain.get().is_some(){return Err(err("EYECOLOR2_ABI_ALREADY_STAGED"));}
        let guard=self.session.as_ref().ok_or(err("WORKER_SESSION_NOT_READY"))?;
        let e=scoped_edit_envelope(session_id,revision,index_generation,decoded_sha256,
                                   WorkerAction::Stage)?;
        for hash in [active_sha,inactive_sha,male_sha,female_sha,stock_sha,route_sha,token_sha]{
            let _=from_hex::<32>(hash)?;
        }
        let r=guard.stage_switch_eyecolor2(e,active_sha,inactive_sha,male_sha,female_sha,
             stock_sha,route_sha,token_sha,from_hex(projected_sha)?)
             .map_err(|x|err(x.0))?;
        self.scoped_domain.set(Some(ScopedEditDomain::EyeColor2));
        Ok(scoped_edit_receipt(r,CONTRACT))
    }
    pub fn toggle_switch626_eyecolor2(&self,redo:bool,session_id:&str,revision:u64,
        index_generation:u64,decoded_sha256:&str)->Result<String,JsValue>{
        if self.scoped_domain.get()!=Some(ScopedEditDomain::EyeColor2){
            return Err(err("EYECOLOR2_ABI_DOMAIN_MISMATCH"));
        }
        self.toggle_scoped_edit_inner(redo,session_id,revision,index_generation,decoded_sha256,CONTRACT)
    }
    pub fn begin_switch626_eyecolor2_output(&mut self,session_id:&str,revision:u64,
        index_generation:u64,decoded_sha256:&str)->Result<String,JsValue>{
        if self.scoped_domain.get()!=Some(ScopedEditDomain::EyeColor2){
            return Err(err("EYECOLOR2_ABI_DOMAIN_MISMATCH"));
        }
        self.begin_scoped_edit_output_inner(session_id,revision,index_generation,decoded_sha256,OUTPUT)
    }
    pub fn next_switch626_eyecolor2_output_chunk(&mut self)->Result<Vec<u8>,JsValue>{
        if self.scoped_domain.get()!=Some(ScopedEditDomain::EyeColor2){
            return Err(err("EYECOLOR2_ABI_DOMAIN_MISMATCH"));
        }
        self.next_scoped_edit_output_chunk_inner()
    }
}
