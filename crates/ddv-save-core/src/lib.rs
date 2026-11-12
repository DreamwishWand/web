//! W-CORE-004 / R02-R03. Product Rust ABI boundary ONLY.
//! Single ProductSession identity for read and future staged commands.
//! Historical research TrustedReadCore and Stage IDs are not product authority.
//! No browser Worker/WASM, P1G codec, export, replacement, apply or cloud grant.
// Native private proof code must NEVER be linked in the browser WASM Worker.
#[cfg(all(feature="private-native-v2",target_arch="wasm32"))]
compile_error!("private-native-v2 is native-only and cannot enter WASM");
#[cfg(all(feature="private-native-v1",target_arch="wasm32"))]
compile_error!("private-native-v1 is native-only and cannot enter WASM");
// DEV feature may be type-checked for the same wasm32 Rust Core, but a
// browser build needs the existing Worker entropy/session boundary. Production
// Pages explicitly compiles ONLY worker-wasm,indexed-read, never this feature.
#[cfg(all(feature="semantic-writer-dev",target_arch="wasm32",not(feature="worker-wasm")))]
compile_error!("semantic-writer-dev wasm32 requires the existing Worker binding");
mod product_session;
mod strict_document;
// Source-only synthetic transaction lab is compiled out of the product Worker.
#[cfg(all(feature = "synthetic-stage-b", target_arch = "wasm32"))]
compile_error!("synthetic-stage-b must not be linked into WASM/Worker release");
#[cfg(feature = "synthetic-stage-b")]
pub use product_session::{SyntheticChangeSet, SyntheticStageReceipt, SyntheticExportReceipt};
#[cfg(feature = "private-native-v1")]
pub use product_session::NativeAreaGridSliceReceipt;
#[cfg(feature = "semantic-writer-dev")]
pub use product_session::{TypedOperationKind,TypedOperationRegistryEntry,
    TypedSemanticCommand,SemanticStageReceipt,TYPED_OPERATION_REGISTRY,
    ExistingAmountSelection,ExistingAmountItemType,ExistingChestFacts,ExistingAmountTargetView,CoreExistingAmountTarget,AuthorizedExistingAmountTarget};
#[cfg(feature = "private-native-v2")]
pub use product_session::PrivateOfflineReceipt;
#[cfg(feature = "indexed-read")]
pub use product_session::{IndexedCursorReceipt, IndexedDomain, IndexedFieldWitness, IndexedKind, IndexedPage, INDEX_PAGE_ENTRIES_MAX};
#[cfg(feature = "indexed-read")]
pub use product_session::{ExternalLayoutStatus,SavedDiffGridMetadata,SavedDiffGridsCursorReceipt,SavedDiffGridsPage,StoredRemovedShape};
#[cfg(feature = "indexed-read")]
mod spatial_reference_index;
#[cfg(feature = "indexed-read")]
pub use spatial_reference_index::{
    SpatialAreaRef, SpatialCandidateIndex, SpatialExtent, SpatialGridRef,
    SpatialObjectKey, SpatialObjectRef, SpatialReadWitness, SpatialScope,
    MAX_SPATIAL_GRIDS, MAX_SPATIAL_OBJECTS, SPATIAL_GRAPH_CONTRACT,
};
// Private-native only: count concordance cannot grant Native V3 or Writer.
#[cfg(feature="private-native-v1")]
pub use spatial_reference_index::SpatialNativeCensusReceipt;
mod steam_spatial_preflight;
pub use steam_spatial_preflight::{
    preflight_steam_move_rotate,steam_orientation_cardinal,steam_orientation_defined,
    PreviewCell,PreviewObjectKey,PreviewTransform,PreviewGrid,
    PreviewRestrictions,PreviewOccupiedCell,PreviewSnapshot,PreviewRequest,
    PreviewReceipt,STEAM_SPATIAL_PREFLIGHT_CONTRACT,
};
mod worker_session;
#[cfg(all(feature = "worker-wasm", target_arch = "wasm32"))]
mod wasm_worker;

pub use product_session::{
    BuildIdentity, BuildKind, Platform, ProductSession, ReadReceipt, SessionReceipt,
    WorkerAction, WorkerEnvelope, PRODUCT_WORKER_CONTRACT,
};
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct CoreError(pub &'static str);
pub type CoreResult<T> = Result<T, CoreError>;
