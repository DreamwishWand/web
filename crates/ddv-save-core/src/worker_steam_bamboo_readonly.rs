//! ACT1685: one existing WorkerSessionGuard owns the exact Bamboo ReadDomain.
//! No Stage, inventory debit, new engine, native entitlement, or UI authority.
use super::*;

impl WorkerSessionGuard {
    pub(crate) fn read_steam626_bamboo_single_target(
        &self, e: WorkerEnvelope, grid: u32, x: u32, y: u32,
    ) -> CoreResult<serde_json::Value> {
        if self.closed { return Err(CoreError("BAMBOO_WORKER_CLOSED")); }
        let target = self.session.mint_steam626_bamboo_single_target(e, grid, x, y)?;
        let hex = |value: &[u8]| value.iter().map(|b| format!("{b:02x}")).collect::<String>();
        Ok(serde_json::json!({
            "contract": "wand.worker.steam626.bamboo.readonly-target@1",
            "sessionId": hex(&target.scope.session_id),
            "revision": target.scope.expected_revision,
            "indexGeneration": target.scope.expected_index_generation,
            "decodedSha256": hex(&target.scope.expected_decoded_sha256),
            "platform": "SteamWindows", "schema": 626, "itemId": 40700007,
            "gridId": target.grid, "x": target.x, "y": target.y,
            "nextGridObjectId": target.next, "oldStock": target.stock,
            "rootSha256": hex(&target.root_sha), "gridSha256": hex(&target.grid_sha),
            "counterSha256": hex(&target.counter_sha), "stockSha256": hex(&target.stock_sha),
            "housesSha256": hex(&target.houses_sha), "referencePairs": target.pairs,
            "stockDelta": 0, "readOnly": true, "productReadAccepted": false,
            "writerAuthorized": false, "stageAuthorized": false,
            "editedCopyAuthorized": false, "operationOn": false
        }))
    }
}
