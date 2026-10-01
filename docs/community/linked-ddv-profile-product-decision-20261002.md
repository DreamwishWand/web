# Linked DDV Profile Product Decision — 2026-10-02

Status: **PRODUCT APPROVED / IMPLEMENTATION DEPENDENCY OPEN**

The Product owner approved the Linked DDV Profile lifecycle with one change from the earlier
proposal: the post-unlink/account-deletion binding tombstone is **7 days**, not 90 days.

## Approved Product behavior

- one Wand Account may link at most **3 DDV Profiles**;
- normal self-service unlink/rebind is not available;
- mistaken/obsolete links may be corrected only through recent-authenticated support/admin review;
- correction requires a recorded reason and AuditEvent;
- the removed old DDV Profile receives the same **7-day** cooldown;
- successful verification does not permanently store the raw save or raw verification evidence;
- ordinary verification evidence is ephemeral and removed after successful verification;
- stored binding state is minimized to an internal DDV Profile row, keyed binding digest, state,
  verified timestamp, verification method and contract version;
- account deletion immediately removes the account link, display/verification state and active
  evidence;
- the minimum binding digest may remain for **7 days** solely to prevent immediate cycling/abuse;
- after seven days the ordinary tombstone is deleted and the DDV Profile may be linked again;
- moderation/security/legal necessity may extend the minimum digest only through the existing D4
  hold path and only while justified;
- Wand does not retain a permanent profile fingerprint for ordinary deleted/unlinked users;
- Moonstones, receipts, Premium/DLC entitlement, online-auth tokens and platform credentials are not
  valid binding inputs.

## Stable identifier dependency

The reviewed DDV Core does not yet expose a **confirmed DDV-profile-stable local identifier**.

Current save identity/build code contains source/build/platform and whole-file/hash context, but a
raw save SHA or complete profile hash changes as the save changes and therefore is not a valid DDV
Profile identity.

The implementation must therefore **fail closed** until DDV Core provides evidence for a local
identifier that:

1. identifies the same DDV Profile across ordinary saves/resaves;
2. does not rely on Premium/DLC/receipt/authentication entitlement;
3. has known platform/cross-save semantics;
4. has acceptable privacy/linkability properties;
5. can be extracted without retaining the entire save server-side.

Forbidden shortcuts include whole-save SHA-256, whole-profile hash, provider Auth subject and
unreviewed platform-account identifiers.

Once the stable identifier is confirmed, Community may implement a server-side keyed digest using
production-only secret material. The raw identifier must not be stored.

## Approval boundary

This closes the **Product lifecycle decision**, not Privacy or Legal approval.

Privacy/Legal must review the actual confirmed identifier and final verification transport before
Linked DDV Profiles become launch-ready.

Retention Engineering remains CLOSED. This decision creates a separate Linked DDV Profile
implementation dependency.
