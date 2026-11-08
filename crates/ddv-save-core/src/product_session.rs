//! Product ABI: one Rust-owned session identity; research IDs have no authority.
use crate::{strict_document::validate_entire_document, CoreError, CoreResult};
use sha2::{Digest, Sha256};
use std::sync::{Arc, Mutex, MutexGuard};

pub const PRODUCT_WORKER_CONTRACT: &str = "wand.product.single-save-session.boundary@1";
pub const MAX_DECODED_BYTES: usize = 256 * 1024 * 1024;
const SWITCH_V1253_BID: &str = "9A239D3DB569756D";
const STEAM_V1253_FULL_VERSION: &str = "releases_1.25-v1.25.3-44-g0b41250d9ac0-incremental-22";

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Platform { Switch, SteamWindows }
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum BuildKind { SwitchBid, SteamFullVersion }
#[derive(Clone, Debug)]
pub struct BuildIdentity {
    pub platform: Platform,
    pub build_kind: BuildKind,
    pub build_id: String,
    pub schema: u64,
    /// External declaration only: not cryptographically bound by P1G.
    pub externally_attested: bool,
}
impl BuildIdentity {
    fn validate_registry_candidate(&self) -> CoreResult<()> {
        if !self.externally_attested || self.schema != 626 {
            return Err(CoreError("BUILD_IDENTITY_NOT_ATTESTED"));
        }
        match (self.platform, self.build_kind, self.build_id.as_str()) {
            (Platform::Switch, BuildKind::SwitchBid, SWITCH_V1253_BID) => Ok(()),
            (Platform::SteamWindows, BuildKind::SteamFullVersion, STEAM_V1253_FULL_VERSION) => Ok(()),
            _ => Err(CoreError("EXACT_BUILD_ID_MISMATCH")),
        }
    }
}
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct SessionReceipt {
    pub contract: &'static str,
    pub session_id: [u8;16],
    pub revision: u64,
    pub index_generation: u64,
    pub decoded_sha256: [u8;32],
    pub schema: u64,
    pub full_document_json_validated: bool,
    pub all_domain_references_verified: bool,
    pub product_worker_bound: bool,
    pub product_read_accepted: bool,
    pub writer_authorized: bool,
    pub edited_copy_authorized: bool,
    pub apply_authorized: bool,
}
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum WorkerAction { ReadCoreSchemaWitness, ReadDomain, Stage, ExportEditedCopy, Apply, OriginalOverwrite }
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct WorkerEnvelope {
    pub contract: &'static str,
    pub session_id: [u8;16],
    pub expected_revision: u64,
    pub expected_index_generation: u64,
    pub expected_decoded_sha256: [u8;32],
    pub action: WorkerAction,
}
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct ReadReceipt {
    pub session_id: [u8;16],
    pub revision: u64,
    pub index_generation: u64,
    pub decoded_sha256: [u8;32],
    pub core_owned_readset: &'static str,
    pub complete_all_domains: bool,
    pub writer_authorized: bool,
}
struct State { id: [u8;16], revision: u64, generation: u64, closed: bool,
    #[cfg(feature = "synthetic-stage-b")] lab: Option<synthetic_stage_b::SyntheticLedger>,
    #[cfg(feature = "private-native-v2")] private_offline: Option<private_native_v2::PrivateOfflineLedger>,
    #[cfg(feature = "indexed-read")] indexed: Option<indexed_read::IndexedCache>,
}
#[cfg(feature = "synthetic-stage-b")]
#[path = "synthetic_stage_b.rs"]
mod synthetic_stage_b;
#[cfg(feature = "synthetic-stage-b")]
pub use synthetic_stage_b::{SyntheticChangeSet, SyntheticStageReceipt, SyntheticExportReceipt};
#[cfg(feature = "private-native-v1")]
#[path = "native_reference_slice.rs"]
mod native_reference_slice;
#[cfg(feature = "private-native-v1")]
pub use native_reference_slice::NativeAreaGridSliceReceipt;
#[cfg(feature = "private-native-v2")]
#[path = "private_native_v2.rs"]
mod private_native_v2;
#[cfg(feature = "private-native-v2")]
pub use private_native_v2::PrivateOfflineReceipt;
#[cfg(feature = "indexed-read")]
#[path = "indexed_read.rs"]
mod indexed_read;
#[cfg(feature = "indexed-read")]
pub use indexed_read::{IndexedCursorReceipt,IndexedDomain,IndexedFieldWitness,IndexedKind,IndexedPage,INDEX_PAGE_ENTRIES_MAX};
/// Same synchronized State for all dispatch/close paths; research Stage session
/// cannot mint or rebind another product ID. No product Writer entrypoint.
pub struct ProductSession {
    state: Mutex<State>,
    decoded: Arc<[u8]>,
    sha: [u8;32],
    schema: u64,
    worker_bound: bool,
    #[cfg(all(feature="worker-wasm",feature="indexed-read",target_arch="wasm32"))]
    worker_cursor_key:[u8;32],
}
impl ProductSession {
    /// R02 native-only decoded JSON prototype. NOT a P1G decrypt, Worker
    /// product binding, physical external Build verification or V2 acceptance.
    pub fn open_decoded_readonly(decoded: Vec<u8>, build: BuildIdentity) -> CoreResult<Self> {
        build.validate_registry_candidate()?;
        if decoded.is_empty() || decoded.len() > MAX_DECODED_BYTES {
            return Err(CoreError("DECODED_SOURCE_BOUNDS"));
        }
        validate_entire_document(&decoded, build.schema)?;
        let mut id = [0_u8; 16];
        #[cfg(not(target_arch = "wasm32"))]
        getrandom::getrandom(&mut id).map_err(|_| CoreError("SESSION_CSPRNG_UNAVAILABLE"))?;
        #[cfg(target_arch = "wasm32")]
        return Err(CoreError("WASM_WORKER_ENTROPY_NOT_BOUND"));
        if id.iter().all(|b| *b == 0) { return Err(CoreError("SESSION_ID_INVALID")); }
        let sha = Sha256::digest(&decoded).into();
        Ok(Self {
            state: Mutex::new(State { id, revision:0, generation:1, closed:false,
                #[cfg(feature = "synthetic-stage-b")] lab:None,
                #[cfg(feature = "private-native-v2")] private_offline:None,
                #[cfg(feature = "indexed-read")] indexed:None }),
            decoded:Arc::from(decoded), sha, schema:build.schema, worker_bound:false,
            #[cfg(all(feature="worker-wasm",feature="indexed-read",target_arch="wasm32"))]
            worker_cursor_key:[0;32],
        })
    }
    /// Worker WASM-only source entry. A trusted Worker supplies CSPRNG entropy,
    /// never UI-provided SessionID. Rust derives one immutable product identity.
    /// Caller still owes external build proof and reference-closure validation.
    #[cfg(all(feature = "worker-wasm", target_arch = "wasm32"))]
    pub(crate) fn open_decoded_in_worker(
        decoded: Vec<u8>, build: BuildIdentity, entropy: [u8;32]
    ) -> CoreResult<Self> {
        build.validate_registry_candidate()?;
        if decoded.is_empty() || decoded.len() > MAX_DECODED_BYTES {
            return Err(CoreError("DECODED_SOURCE_BOUNDS"));
        }
        if entropy.iter().all(|byte| *byte == 0) {
            return Err(CoreError("WORKER_ENTROPY_INVALID"));
        }
        validate_entire_document(&decoded,build.schema)?;
        let sha: [u8;32] = Sha256::digest(&decoded).into();
        // This key never crosses the Rust/Worker boundary. The Worker must
        // use its own WebCrypto CSPRNG on open and may not accept UI seed.
        #[cfg(all(feature="worker-wasm",feature="indexed-read",target_arch="wasm32"))]
        let worker_cursor_key:[u8;32]={
            let mut h=Sha256::new();
            h.update(b"wand.product.worker.indexed.secret.v1");
            h.update(entropy);
            h.update(sha);
            h.finalize().into()
        };
        let mut hash = Sha256::new();
        hash.update(b"wand.product.worker.session.v1");
        hash.update(entropy);
        hash.update(sha);
        let digest = hash.finalize();
        let mut id=[0u8;16];
        id.copy_from_slice(&digest[..16]);
        let state=State {id,revision:0,generation:1,closed:false,
            #[cfg(feature = "synthetic-stage-b")] lab:None,
                #[cfg(feature = "private-native-v2")] private_offline:None,
            #[cfg(feature = "indexed-read")] indexed:None};
        Ok(Self {
            state:Mutex::new(state),decoded:Arc::from(decoded),
            sha,schema:build.schema,worker_bound:true,
            #[cfg(all(feature="worker-wasm",feature="indexed-read",target_arch="wasm32"))]
            worker_cursor_key,
        })
    }
    fn lock(&self) -> CoreResult<MutexGuard<'_, State>> {
        self.state.lock().map_err(|_| CoreError("SESSION_LOCK_POISONED"))
    }
    pub fn receipt(&self) -> CoreResult<SessionReceipt> {
        let state = self.lock()?;
        if state.closed { return Err(CoreError("SESSION_CLOSED")); }
        // Full-document means JSON grammar, duplicate-keys and required roots;
        // NOT Native reference closure, verified physical build, or export.
        Ok(SessionReceipt {
            contract:PRODUCT_WORKER_CONTRACT, session_id:state.id,
            revision:state.revision,index_generation:state.generation,
            decoded_sha256:self.sha,schema:self.schema,
            full_document_json_validated:true,all_domain_references_verified:false,
            product_worker_bound:self.worker_bound,product_read_accepted:false,
            writer_authorized:false,edited_copy_authorized:false,apply_authorized:false,
        })
    }
    pub fn dispatch(&self, envelope: WorkerEnvelope) -> CoreResult<ReadReceipt> {
        let state=self.lock()?;
        if state.closed { return Err(CoreError("SESSION_CLOSED")); }
        if envelope.contract != PRODUCT_WORKER_CONTRACT ||
            envelope.session_id != state.id ||
            envelope.expected_decoded_sha256 != self.sha {
            return Err(CoreError("SESSION_SOURCE_SCOPE_MISMATCH"));
        }
        if envelope.expected_revision != state.revision ||
            envelope.expected_index_generation != state.generation {
            return Err(CoreError("SESSION_REVISION_GENERATION_CAS"));
        }
        match envelope.action {
            WorkerAction::ReadCoreSchemaWitness => Ok(ReadReceipt {
                session_id:state.id,revision:state.revision,index_generation:state.generation,
                decoded_sha256:self.sha,core_owned_readset:"/GameInfo/Version",
                complete_all_domains:false,writer_authorized:false,
            }),
            WorkerAction::ReadDomain => Err(CoreError("DOMAIN_INDEX_NOT_BOUND")),
            WorkerAction::Stage | WorkerAction::ExportEditedCopy |
            WorkerAction::Apply | WorkerAction::OriginalOverwrite =>
                Err(CoreError("PRODUCT_WRITER_DISABLED")),
        }
    }
    /// Close linearizes against in-flight dispatch, revoking held Arc handles.
    pub fn close(&self) -> CoreResult<()> {
        let mut state=self.lock()?;
        if state.closed { return Err(CoreError("SESSION_ALREADY_CLOSED")); }
        // Fail closed before changing state if generation would overflow.
        let generation=state.generation.checked_add(1)
            .ok_or(CoreError("GENERATION_OVERFLOW"))?;
        state.closed=true;
        state.generation=generation;
        Ok(())
    }
    /// Only a local benchmark receipt, not decoded contents or UI ownership.
    pub fn decoded_len_for_internal_benchmark(&self) -> usize { self.decoded.len() }
}
