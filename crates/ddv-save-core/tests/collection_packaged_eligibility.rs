// Compile the isolated domain validator without wiring product authority.
use ddv_save_core::{BuildIdentity, BuildKind, Platform};
#[path = "../src/collection_packaged_eligibility.rs"]
mod collection_packaged_eligibility;
const PACK: &[u8] = include_bytes!("../data/collection-furniture-626.json");
