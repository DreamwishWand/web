//! ACT1685: generated, exact Steam626 BambooFence01 target ReadDomain.
//! Reuses one Rust-owned ProductSession. No generic item/rights/Stage/export.
use super::*;
const EXACT_STEAM: &str = "releases_1.25-v1.25.3-44-g0b41250d9ac0-incremental-22";
const CONTRACT: &str = "wand.worker.steam626.bamboo.readonly-target@1";

#[wasm_bindgen]
impl WorkerWasmSource {
    pub fn read_steam626_bamboo_single_target(
        &self, grid: u32, x: u32, y: u32, session_id: &str,
        revision: u64, index_generation: u64, decoded_sha256: &str,
    ) -> Result<String, JsValue> {
        if self.build.platform != Platform::SteamWindows
            || self.build.build_kind != BuildKind::SteamFullVersion
            || self.build.schema != 626
            || self.build.build_id != EXACT_STEAM
            || !self.build.externally_attested
        {
            return Err(err("BAMBOO_EXACT_STEAM626_REQUIRED"));
        }
        let guard = self.session.as_ref().ok_or(err("BAMBOO_WORKER_SESSION_NOT_READY"))?;
        let envelope = WorkerEnvelope {
            contract: PRODUCT_WORKER_CONTRACT,
            session_id: from_hex(session_id)?,
            expected_revision: revision, expected_index_generation: index_generation,
            expected_decoded_sha256: from_hex(decoded_sha256)?,
            action: WorkerAction::ReadDomain,
        };
        let receipt = guard.read_steam626_bamboo_single_target(envelope, grid, x, y)
            .map_err(|e| err(e.0))?;
        debug_assert_eq!(receipt["contract"], CONTRACT);
        Ok(receipt.to_string())
    }
}
