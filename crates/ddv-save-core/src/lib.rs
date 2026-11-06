//! W-CORE-004 / R02-R03. Product Rust ABI boundary ONLY.
//! Single ProductSession identity for read and future staged commands.
//! Historical research TrustedReadCore and Stage IDs are not product authority.
//! No browser Worker/WASM, P1G codec, export, replacement, apply or cloud grant.
mod product_session;
mod strict_document;

pub use product_session::{
    BuildIdentity, BuildKind, Platform, ProductSession, ReadReceipt, SessionReceipt,
    WorkerAction, WorkerEnvelope, PRODUCT_WORKER_CONTRACT,
};
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct CoreError(pub &'static str);
pub type CoreResult<T> = Result<T, CoreError>;
