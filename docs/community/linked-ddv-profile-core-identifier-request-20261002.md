# Linked DDV Profile — DDV Core Stable Identifier Gate

Status: **OPEN / BLOCKED ON DDV CORE**

Community rechecked `DDV_CORE_INTEGRATION_CURRENT` after the Age/minors Product decision was closed.
No Integrator-promoted Core contract currently confirms a stable local DDV Profile identifier that
Community may use for account/Profile binding.

This is not a request to reopen broad Community engineering.

## Required Core result

The Core/Integrator should route this to the appropriate semantic owner and return a versioned
contract (suggested semantic name: `ddv.profile-local-identity@1`) only when evidence establishes:

1. the identifier stays the same across ordinary save/resave of one DDV Profile;
2. Nintendo Switch and Steam/Windows v1.25.0 semantics are explicit, including the same
   cloud-linked-profile case where evidence exists;
3. it does not depend on Moonstones, receipts, Premium/DLC entitlements, online auth tokens or
   platform credentials;
4. it can be extracted locally without uploading/persistently storing the entire save;
5. clone/copy/reset/new-profile behavior and collision/domain semantics are defined;
6. the exact source field/path and privacy/linkability characteristics are documented.

Minimum evidence should include a controlled same-profile before/after save pair, a distinct-profile
negative comparison, and cross-platform same-cloud-profile evidence where available.

## Forbidden substitutes

Community must not substitute:

- whole-save SHA-256;
- whole decrypted profile JSON hash;
- provider Auth subject;
- unreviewed platform account IDs;
- entitlement/receipt identifiers;
- online authentication identifiers.

## Community boundary

Until the Core contract is **CONFIRMED / Integrator-promoted**:

- Linked DDV Profile link/verify remains fail-closed;
- no raw identifier is persisted;
- no final keyed-digest construction is frozen;
- no Community implementation or acceptance test for binding is started.

After Core confirmation, Privacy/Legal review the identifier/linkability and final verification
transport before Community implementation proceeds.
