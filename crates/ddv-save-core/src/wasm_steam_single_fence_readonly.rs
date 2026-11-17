//! ACT1630: fixed Steam626 SingleFence isolated read-only generated WASM.
 //! Reuses the existing one ProductSession: no second engine, Stage, Export
 //! or user-controlled ItemID, providers, entitlements, stock or action.
use super::*;
const CONTRACT:&str="wand.worker.steam626.singlefence.readonly-target@1";
const EXACT_STEAM:&str="releases_1.25-v1.25.3-44-g0b41250d9ac0-incremental-22";

#[wasm_bindgen]
impl WorkerWasmSource {
    pub fn read_steam626_singlefence_target(&self,grid:u32,x:u32,y:u32,
        session_id:&str,revision:u64,index_generation:u64,
        decoded_sha256:&str)->Result<String,JsValue>{
        if self.build.platform!=Platform::SteamWindows||
           self.build.build_kind!=BuildKind::SteamFullVersion||
           self.build.schema!=626||self.build.build_id!=EXACT_STEAM||
           !self.build.externally_attested {
            return Err(err("SINGLEFENCE_EXACT_STEAM626_REQUIRED"));
        }
        let guard=self.session.as_ref().ok_or(err("SINGLEFENCE_WORKER_SESSION_NOT_READY"))?;
        let e=WorkerEnvelope{
            contract:PRODUCT_WORKER_CONTRACT,session_id:from_hex(session_id)?,
            expected_revision:revision,expected_index_generation:index_generation,
            expected_decoded_sha256:from_hex(decoded_sha256)?,action:WorkerAction::ReadDomain,
        };
        let receipt=guard.read_steam626_singlefence_target(e,grid,x,y)
            .map_err(|error|err(error.0))?;
        debug_assert_eq!(receipt["contract"],CONTRACT);
        Ok(receipt.to_string())
    }
}
