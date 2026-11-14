//! W-CORE-RUST-SESSION-068: the one existing Rust ProductSession is the
//! authoritative source of ID, revision, index generation and decoded SHA.
//! This Worker *guard* does not mint another Session or own a second Reader.
//! Dropping a Worker must revoke any outstanding internal Arc read handles.
use crate::{CoreError, CoreResult, ProductSession, ReadReceipt, SessionReceipt, WorkerEnvelope};
use std::sync::Arc;

pub(crate) struct WorkerSessionGuard {
    session: Arc<ProductSession>,
    closed: bool,
}
impl WorkerSessionGuard {
    pub(crate) fn attach(session: ProductSession) -> Self {
        Self { session: Arc::new(session), closed: false }
    }
    pub(crate) fn receipt(&self) -> CoreResult<SessionReceipt> {
        if self.closed { return Err(CoreError("WORKER_SESSION_CLOSED")); }
        self.session.receipt()
    }
    pub(crate) fn dispatch(&self, envelope: WorkerEnvelope) -> CoreResult<ReadReceipt> {
        if self.closed { return Err(CoreError("WORKER_SESSION_CLOSED")); }
        // ProductSession itself performs all source, contract and revision CAS
        // checks while holding the same mutex used by its close() transition.
        self.session.dispatch(envelope)
    }
    #[cfg(feature="indexed-read")]
    pub(crate) fn issue_indexed_cursor(
        &self,scope:WorkerEnvelope,domain:crate::IndexedDomain
    )->CoreResult<crate::IndexedCursorReceipt>{
        if self.closed{return Err(CoreError("WORKER_SESSION_CLOSED"));}
        self.session.issue_indexed_cursor(scope,domain)
    }
    #[cfg(feature="indexed-read")]
    pub(crate) fn read_indexed_page(
        &self,scope:WorkerEnvelope,cursor:[u8;16]
    )->CoreResult<crate::IndexedPage>{
        if self.closed{return Err(CoreError("WORKER_SESSION_CLOSED"));}
        self.session.read_indexed_page(scope,cursor)
    }
    /// Read-only metadata bridge into the same Rust-owned Session, Mutex,
    /// indexed cache and CursorGrant table. No new Decoder/Reader/Executor.
    #[cfg(feature="indexed-read")]
    pub(crate) fn issue_saved_diffgrids_cursor(
        &self,scope:WorkerEnvelope
    )->CoreResult<crate::SavedDiffGridsCursorReceipt>{
        if self.closed{return Err(CoreError("WORKER_SESSION_CLOSED"));}
        self.session.issue_saved_diffgrids_cursor(scope)
    }
    #[cfg(feature="indexed-read")]
    pub(crate) fn read_saved_diffgrids_page(
        &self,scope:WorkerEnvelope,cursor:[u8;16]
    )->CoreResult<crate::SavedDiffGridsPage>{
        if self.closed{return Err(CoreError("WORKER_SESSION_CLOSED"));}
        self.session.read_saved_diffgrids_page(scope,cursor)
    }
    // DEV/OFF only. Delegate to the SAME Rust ProductSession; this guard
    // never creates a second Session, decoder or writer ledger.
    #[cfg(feature="semantic-writer-dev")]
    pub(crate) fn stage_dev_semantic(
        &self, scope:WorkerEnvelope, commands:&[crate::TypedSemanticCommand]
    )->CoreResult<crate::SemanticStageReceipt>{
        if self.closed{return Err(CoreError("WORKER_SESSION_CLOSED"));}
        self.session.stage_typed_semantic_batch(scope,commands)
    }
    #[cfg(feature="semantic-writer-dev")]
    pub(crate) fn undo_dev_semantic(
        &self,scope:WorkerEnvelope
    )->CoreResult<crate::SemanticStageReceipt>{
        if self.closed{return Err(CoreError("WORKER_SESSION_CLOSED"));}
        self.session.undo_typed_semantic_batch(scope)
    }
    #[cfg(feature="semantic-writer-dev")]
    pub(crate) fn redo_dev_semantic(
        &self,scope:WorkerEnvelope
    )->CoreResult<crate::SemanticStageReceipt>{
        if self.closed{return Err(CoreError("WORKER_SESSION_CLOSED"));}
        self.session.redo_typed_semantic_batch(scope)
    }
    #[cfg(feature="semantic-writer-dev")]
    pub(crate) fn take_dev_edited_once(
        &self,scope:WorkerEnvelope
    )->CoreResult<Vec<u8>>{
        if self.closed{return Err(CoreError("WORKER_SESSION_CLOSED"));}
        self.session.take_typed_semantic_decoded_once(scope)
    }
    pub(crate) fn close(&mut self) -> CoreResult<()> {
        if self.closed { return Err(CoreError("WORKER_SESSION_ALREADY_CLOSED")); }
        self.closed = true;
        self.session.close()
    }
}
impl Drop for WorkerSessionGuard {
    fn drop(&mut self) {
        if !self.closed {
            // The same ProductSession remains the authority. A leaked
            // internal read Arc is not permitted to revive the old session.
            let _ = self.session.close();
            self.closed = true;
        }
    }
}
#[cfg(test)]
mod tests {
    use super::*;
    use crate::{BuildIdentity, BuildKind, Platform, WorkerAction, PRODUCT_WORKER_CONTRACT};
    use std::{sync::{Arc, Barrier}, thread};

    const BID: &str = "9A239D3DB569756D";
    fn session() -> ProductSession {
        let payload = br#"{"GameInfo":{"Version":626},"Player":{},"World":{},"Unknown":{"future":true}}"#.to_vec();
        ProductSession::open_decoded_readonly(payload, BuildIdentity {
            platform: Platform::Switch, build_kind: BuildKind::SwitchBid,
            build_id: BID.to_owned(), schema: 626, externally_attested: true
        }).unwrap()
    }
    fn request(r: SessionReceipt) -> WorkerEnvelope {
        WorkerEnvelope {
            contract: PRODUCT_WORKER_CONTRACT, session_id: r.session_id,
            expected_revision: r.revision, expected_index_generation: r.index_generation,
            expected_decoded_sha256: r.decoded_sha256,
            action: WorkerAction::ReadCoreSchemaWitness,
        }
    }

    #[cfg(feature="indexed-read")]
    fn steam_diffgrids_session(doc:&str)->ProductSession {
        ProductSession::open_decoded_readonly(doc.as_bytes().to_vec(),BuildIdentity{
            platform:Platform::SteamWindows,build_kind:BuildKind::SteamFullVersion,
            build_id:"releases_1.25-v1.25.3-44-g0b41250d9ac0-incremental-22".into(),
            schema:626,externally_attested:true,
        }).unwrap()
    }
    #[cfg(feature="indexed-read")]
    fn diffgrids_scope(r:SessionReceipt)->WorkerEnvelope {
        WorkerEnvelope{contract:PRODUCT_WORKER_CONTRACT,session_id:r.session_id,
            expected_revision:r.revision,expected_index_generation:r.index_generation,
            expected_decoded_sha256:r.decoded_sha256,action:WorkerAction::ReadDomain}
    }
    #[cfg(feature="indexed-read")]
    #[test]
    fn saved_diffgrids_worker_bridge_17_paginated_same_session_and_replay_denied() {
        let mut entries=Vec::new();
        for n in 0..17 {
            entries.push(format!(r#""{n}":{{"ID":{n},"DefaultLayoutGridID":0,"GridDefaultLayoutPath":"not-verified/{n}","DefaultGridHashCode":-4,"DefaultGridDataHashCode":6,"ModifiedObjects":{{"7":{{"ID":7}}}},"RemovedObjects":[7,9]}}"#));
        }
        let doc=format!(r#"{{"GameInfo":{{"Version":626}},"Player":{{}},"World":{{"GridCollection":{{"DiffGrids":{{{}}}}}}}}}"#,entries.join(","));
        let mut guard=WorkerSessionGuard::attach(steam_diffgrids_session(&doc));
        let r=guard.receipt().unwrap();
        let scope=diffgrids_scope(r);
        let receipt=guard.issue_saved_diffgrids_cursor(scope).unwrap();
        assert_eq!(receipt.session_id,r.session_id);
        assert_eq!(receipt.indexed_records,17);
        assert_eq!(receipt.max_records_per_page,8);
        assert!(!receipt.all_native_references_verified && !receipt.product_read_accepted && !receipt.writer_authorized);
        let mut cursor=receipt.cursor;
        let mut grid_total=0;
        let mut page_sizes=Vec::new();
        loop {
            let page=guard.read_saved_diffgrids_page(scope,cursor).unwrap();
            assert_eq!(page.session_id,r.session_id);
            assert_eq!(page.decoded_sha256,r.decoded_sha256);
            assert_eq!(page.revision,0);
            assert_eq!(page.index_generation,1);
            assert!(!page.all_native_references_verified && !page.writer_authorized);
            assert!(page.records.iter().all(|g|
                g.external_layout.as_str()=="UNRESOLVED_EXTERNAL_LAYOUT"
                && !g.native_effective_grid_verified
                && g.default_grid_hash_code==Some(-4)
                && g.modified_removed_id_pairs==1
            ));
            page_sizes.push(page.records.len());
            grid_total+=page.records.len();
            // First read already consumed its token. Shared core grant cannot
            // be replayed through either Worker entrypoint or root reader.
            assert!(guard.read_saved_diffgrids_page(scope,cursor).is_err());
            assert!(guard.read_indexed_page(scope,cursor).is_err());
            if let Some(next)=page.next_cursor {cursor=next} else {break}
        }
        assert_eq!(page_sizes,[8,8,1]);
        assert_eq!(grid_total,17);
        let root=guard.issue_indexed_cursor(scope,crate::IndexedDomain::World).unwrap();
        assert!(guard.read_saved_diffgrids_page(scope,root.cursor).is_err());
        guard.close().unwrap();
        assert_eq!(guard.read_saved_diffgrids_page(scope,cursor).unwrap_err().0,"WORKER_SESSION_CLOSED");
    }
    #[cfg(feature="indexed-read")]
    #[test]
    fn saved_diffgrids_worker_bridge_build_cas_foreign_and_bad_id_fail_closed(){
        let ok=r#"{"GameInfo":{"Version":626},"Player":{},"World":{"GridCollection":{"DiffGrids":{"7":{"ID":7,"DefaultLayoutGridID":0,"ModifiedObjects":{},"RemovedObjects":[]}}}}}"#;
        let mut guard=WorkerSessionGuard::attach(steam_diffgrids_session(ok));
        let r=guard.receipt().unwrap();
        let scope=diffgrids_scope(r);
        let grant=guard.issue_saved_diffgrids_cursor(scope).unwrap();
        let mut stale=scope;stale.expected_revision+=1;
        assert!(guard.read_saved_diffgrids_page(stale,grant.cursor).is_err());
        stale=scope;stale.expected_index_generation+=1;
        assert!(guard.issue_saved_diffgrids_cursor(stale).is_err());
        stale=scope;stale.expected_decoded_sha256=[4;32];
        assert!(guard.read_saved_diffgrids_page(stale,grant.cursor).is_err());
        stale=scope;stale.session_id=[7;16];
        assert!(guard.issue_saved_diffgrids_cursor(stale).is_err());
        let other=WorkerSessionGuard::attach(steam_diffgrids_session(ok));
        assert!(other.read_saved_diffgrids_page(diffgrids_scope(other.receipt().unwrap()),grant.cursor).is_err());
        assert!(guard.read_saved_diffgrids_page(scope,[0;16]).is_err());
        let p=guard.read_saved_diffgrids_page(scope,grant.cursor).unwrap();
        assert_eq!(p.records.len(),1);
        assert_eq!(p.records[0].default_layout_grid_id,Some(0));
        assert!(!p.records[0].native_effective_grid_verified);
        let mut switch=WorkerSessionGuard::attach(ProductSession::open_decoded_readonly(ok.as_bytes().to_vec(),
            BuildIdentity{platform:Platform::Switch,build_kind:BuildKind::SwitchBid,
             build_id:BID.to_owned(),schema:626,externally_attested:true}).unwrap());
        assert!(switch.issue_saved_diffgrids_cursor(diffgrids_scope(switch.receipt().unwrap())).is_err());
        switch.close().unwrap();
        let bad=r#"{"GameInfo":{"Version":626},"Player":{},"World":{"GridCollection":{"DiffGrids":{"7":{"ID":8}}}}}"#;
        let malformed=WorkerSessionGuard::attach(steam_diffgrids_session(bad));
        assert!(malformed.issue_saved_diffgrids_cursor(diffgrids_scope(malformed.receipt().unwrap())).is_err());
        assert!(ProductSession::open_decoded_readonly(ok.as_bytes().to_vec(),BuildIdentity{
            platform:Platform::SteamWindows,build_kind:BuildKind::SteamFullVersion,
            build_id:"releases_1.25-v1.25.3-44-g0b41250d9ac0-incremental-22".into(),
            schema:624,externally_attested:true
        }).is_err());
    }
    #[test]
    fn one_rust_owned_session_and_core_owned_readset_only() {
        let guard = WorkerSessionGuard::attach(session());
        let a = guard.receipt().unwrap();
        let b = guard.receipt().unwrap();
        assert_eq!(a.session_id, b.session_id);
        assert_eq!(a.decoded_sha256, b.decoded_sha256);
        assert_eq!(a.revision, 0);
        assert_eq!(a.index_generation, 1);
        assert!(!a.product_read_accepted && !a.writer_authorized);
        let witness = guard.dispatch(request(a)).unwrap();
        assert_eq!(witness.core_owned_readset, "/GameInfo/Version");
        assert!(!witness.complete_all_domains && !witness.writer_authorized);
    }
    #[test]
    fn forged_id_revision_index_sha_and_writer_commands_denied() {
        let guard = WorkerSessionGuard::attach(session());
        let r = guard.receipt().unwrap();
        let mut req = request(r);
        req.session_id[0] ^= 1;
        assert!(guard.dispatch(req).is_err());
        req = request(r); req.expected_revision = 1;
        assert!(guard.dispatch(req).is_err());
        req = request(r); req.expected_index_generation = 2;
        assert!(guard.dispatch(req).is_err());
        req = request(r); req.expected_decoded_sha256[0] ^= 1;
        assert!(guard.dispatch(req).is_err());
        req = request(r); req.contract = "forged-worker";
        assert!(guard.dispatch(req).is_err());
        for action in [WorkerAction::ReadDomain, WorkerAction::Stage,
                WorkerAction::ExportEditedCopy, WorkerAction::Apply,
                WorkerAction::OriginalOverwrite] {
            req = request(r);
            req.action = action;
            assert!(guard.dispatch(req).is_err());
        }
        assert_eq!(guard.receipt().unwrap().revision, 0);
    }
    #[test]
    fn explicit_close_revokes_all_handles_and_cannot_reopen() {
        let mut guard = WorkerSessionGuard::attach(session());
        let borrowed = Arc::clone(&guard.session);
        let scope = request(guard.receipt().unwrap());
        guard.close().unwrap();
        assert_eq!(guard.receipt().unwrap_err().0, "WORKER_SESSION_CLOSED");
        assert_eq!(guard.dispatch(scope).unwrap_err().0, "WORKER_SESSION_CLOSED");
        assert_eq!(borrowed.dispatch(scope).unwrap_err().0, "SESSION_CLOSED");
        assert_eq!(guard.close().unwrap_err().0, "WORKER_SESSION_ALREADY_CLOSED");
        drop(guard);
        assert_eq!(borrowed.receipt().unwrap_err().0, "SESSION_CLOSED");
    }
    #[test]
    fn drop_without_close_revokes_stale_internal_read_arc() {
        let (borrowed, scope) = {
            let guard = WorkerSessionGuard::attach(session());
            let shared = Arc::clone(&guard.session);
            let envelope = request(guard.receipt().unwrap());
            assert!(shared.dispatch(envelope).is_ok());
            (shared, envelope)
        };
        assert_eq!(borrowed.dispatch(scope).unwrap_err().0, "SESSION_CLOSED");
        assert_eq!(borrowed.receipt().unwrap_err().0, "SESSION_CLOSED");
    }
    #[test]
    fn concurrent_close_and_read_are_linearized_by_one_product_mutex() {
        let mut guard = WorkerSessionGuard::attach(session());
        let borrowed = Arc::clone(&guard.session);
        let scope = request(guard.receipt().unwrap());
        let barrier = Arc::new(Barrier::new(2));
        let sync = Arc::clone(&barrier);
        let observer = Arc::clone(&borrowed);
        let thread = thread::spawn(move || {
            sync.wait();
            for _ in 0..100 { let _ = observer.dispatch(scope); }
        });
        barrier.wait();
        guard.close().unwrap();
        thread.join().unwrap();
        assert_eq!(borrowed.dispatch(scope).unwrap_err().0, "SESSION_CLOSED");
        assert_eq!(borrowed.receipt().unwrap_err().0, "SESSION_CLOSED");
    }
}
