// Committed fail-closed default. Only the protected Pages build sealer may
// replace this file in its temporary checkout AFTER authenticating all three
// exact read-only subjects. Never commit generated pins or read them from UI,
// fetched manifest, storage, a query string or a mutable runtime route.
export const PROTECTED_READONLY_RELEASE_ANCHOR=null;
