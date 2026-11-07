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
