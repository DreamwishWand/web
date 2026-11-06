// 05 QR-C: NEW_ONLY independent tests appended in ephemeral CI workspace
// AFTER exact immutable Source Git blob verification.
// Never published as an alteration to the original 01A worker_session.rs.
#[cfg(test)]
mod qr_stage_a_independent {
    use super::*;
    use crate::{BuildIdentity, BuildKind, Platform, WorkerAction, PRODUCT_WORKER_CONTRACT};
    use std::{sync::{Arc, Barrier}, thread};

    fn fresh() -> WorkerSessionGuard {
        let payload=br#"{"GameInfo":{"Version":626},"Player":{"opaque":{"x":null}},"World":{},"NewUnknown":[true,false,0]}"#.to_vec();
        let core=ProductSession::open_decoded_readonly(payload,BuildIdentity {
            platform:Platform::Switch,build_kind:BuildKind::SwitchBid,
            build_id:"9A239D3DB569756D".to_owned(),schema:626,
            externally_attested:true
        }).unwrap();
        WorkerSessionGuard::attach(core)
    }
    fn scope(r:SessionReceipt) -> WorkerEnvelope {
        WorkerEnvelope {
            contract:PRODUCT_WORKER_CONTRACT,session_id:r.session_id,
            expected_revision:r.revision,expected_index_generation:r.index_generation,
            expected_decoded_sha256:r.decoded_sha256,
            action:WorkerAction::ReadCoreSchemaWitness
        }
    }

    #[test]
    fn qr_stage_a_01_drop_during_parallel_stale_arc_reads_is_terminal() {
        for _ in 0..12 {
            let guard=fresh();
            let held=Arc::clone(&guard.session);
            let token=scope(guard.receipt().unwrap());
            let start=Arc::new(Barrier::new(2));
            let gate=Arc::clone(&start);
            let worker=Arc::clone(&held);
            let task=thread::spawn(move || {
                gate.wait();
                for _ in 0..120 { let _=worker.dispatch(token); }
            });
            start.wait();
            drop(guard); // NO explicit Close; the Drop implementation must revoke.
            task.join().unwrap();
            assert_eq!(held.receipt().unwrap_err().0,"SESSION_CLOSED");
            assert_eq!(held.dispatch(token).unwrap_err().0,"SESSION_CLOSED");
        }
    }

    #[test]
    fn qr_stage_a_02_new_session_b_rejects_old_a_token_even_identical_decoded_bytes() {
        let a=fresh();
        let a_borrowed=Arc::clone(&a.session);
        let a_r=a.receipt().unwrap();
        let a_scope=scope(a_r);
        assert_eq!(a.dispatch(a_scope).unwrap().core_owned_readset,"/GameInfo/Version");
        drop(a);
        let b=fresh();
        let b_r=b.receipt().unwrap();
        assert_eq!(a_r.decoded_sha256,b_r.decoded_sha256);
        assert_ne!(a_r.session_id,b_r.session_id);
        assert_eq!(a_borrowed.dispatch(a_scope).unwrap_err().0,"SESSION_CLOSED");
        assert!(b.dispatch(a_scope).is_err());
        let ok=b.dispatch(scope(b_r)).unwrap();
        assert_eq!(ok.core_owned_readset,"/GameInfo/Version");
        assert!(!ok.complete_all_domains);
        assert!(!ok.writer_authorized);
    }

    #[test]
    fn qr_stage_a_03_external_underlying_close_then_guard_close_fails_closed() {
        let mut guard=fresh();
        let borrowed=Arc::clone(&guard.session);
        let token=scope(guard.receipt().unwrap());
        borrowed.close().unwrap();
        assert_eq!(guard.receipt().unwrap_err().0,"SESSION_CLOSED");
        assert_eq!(guard.dispatch(token).unwrap_err().0,"SESSION_CLOSED");
        assert_eq!(guard.close().unwrap_err().0,"SESSION_CLOSED");
        assert_eq!(guard.close().unwrap_err().0,"WORKER_SESSION_ALREADY_CLOSED");
        drop(guard);
        assert_eq!(borrowed.dispatch(token).unwrap_err().0,"SESSION_CLOSED");
    }

    #[test]
    fn qr_stage_a_04_staged_and_export_actions_never_mutate_or_revive_after_drop() {
        let guard=fresh();
        let shared=Arc::clone(&guard.session);
        let r=guard.receipt().unwrap();
        for command in [
            WorkerAction::ReadDomain,WorkerAction::Stage,
            WorkerAction::ExportEditedCopy,WorkerAction::Apply,
            WorkerAction::OriginalOverwrite
        ] {
            let mut req=scope(r);
            req.action=command;
            assert!(shared.dispatch(req).is_err());
        }
        let stable=guard.receipt().unwrap();
        assert_eq!(stable.session_id,r.session_id);
        assert_eq!(stable.decoded_sha256,r.decoded_sha256);
        assert_eq!(stable.revision,0);
        assert_eq!(stable.index_generation,1);
        assert!(!stable.product_read_accepted);
        assert!(!stable.writer_authorized);
        assert!(!stable.edited_copy_authorized);
        drop(guard);
        for command in [WorkerAction::Stage,WorkerAction::Apply,WorkerAction::OriginalOverwrite] {
            let mut req=scope(r);req.action=command;
            assert_eq!(shared.dispatch(req).unwrap_err().0,"SESSION_CLOSED");
        }
    }

    #[test]
    fn qr_stage_a_05_poison_error_mapping_and_wasm_drop_owner_static_only() {
        // Poisoned Mutex cannot be induced with the public ProductSession API
        // without unsafe or a dedicated source test hook. The branch is
        // inspected statically. This is NOT a poisoned-runtime PASS.
        let product=include_str!(concat!(env!("CARGO_MANIFEST_DIR"),"/src/product_session.rs"));
        let wasm=include_str!(concat!(env!("CARGO_MANIFEST_DIR"),"/src/wasm_worker.rs"));
        assert!(product.contains("self.state.lock().map_err(|_| CoreError(\"SESSION_LOCK_POISONED\"))"));
        assert!(wasm.contains("session:Option<WorkerSessionGuard>"));
        assert!(wasm.contains("impl Drop for WorkerWasmSource"));
        assert!(wasm.contains("let _=guard.close()"));
        assert!(wasm.contains("self.entropy.fill(0)"));
        assert!(wasm.contains("self.buffer.fill(0)"));
        assert!(wasm.contains("const MAX_CHUNK:usize=1024*1024"));
        assert!(wasm.contains("const MAX_WORKER_DOCUMENT:usize=128*1024*1024"));
        assert!(!wasm.contains("WorkerAction::Stage,"));
    }
}
