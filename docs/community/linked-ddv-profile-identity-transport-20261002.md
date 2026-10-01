# Linked DDV Profile Identity / Transport Contract — 2026-10-02

Status: **TECHNICAL CONTRACT READY / PRIVACY + LEGAL REVIEW PENDING**

## Identity source

Use `GameInfo.LastCustomIdOwner` as the DDV Player ID / User ID identity source.

Existing Converter/Wand backup naming represents it as `mdc{GameInfo.LastCustomIdOwner}`.
The literal `mdc` prefix is a filename convention and is not part of the canonical value.

Current DDV v1.25 evidence confirms the same value in accepted Nintendo Switch and later
Steam/Windows saves of the same cloud-linked DDV Profile. One cross-save profile therefore consumes
one Linked DDV Profile slot.

## Data-minimization boundary

- Parse the save locally.
- Extract only `GameInfo.LastCustomIdOwner` for linking.
- Do not upload the raw save for normal linking.
- Do not persist the raw Player ID.
- Do not publish or index the raw Player ID.
- Keep `verification_evidence_ref` empty by default.

The authenticated backend converts the transient Player ID into a versioned server-keyed digest and
stores only that digest in `ddv_profiles.binding_key_hash`.

## Link behavior

- linking requires recent Wand authentication;
- same Player ID + same Wand Account is idempotent;
- same Player ID already bound elsewhere fails without revealing the other owner;
- the existing maximum of three Linked DDV Profiles still applies;
- unexpected identity conflicts fail closed;
- platform/device identifiers do not define DDV Profile identity.

## Security boundary

The DDV Player ID is a persistent pseudonymous identifier, not a Wand password, recovery secret or
entitlement token.

It must never be used to grant Wand authentication, account recovery, Moonstones, Premium/DLC
entitlement or other online rights.

## Lifecycle

The existing Product-approved lifecycle remains unchanged:

- no ordinary self-service unlink/rebind;
- exceptional correction requires recent authentication, support/admin review, reason and audit;
- ordinary revoked/unlinked/account-deletion binding digest is retained for at most 7 days;
- only a justified moderation/security/legal hold may extend that period.

Because the raw Player ID is intentionally not retained, any future digest-key replacement must use
an explicit re-verification/migration procedure rather than retaining raw IDs for convenience.

## Minors

A parent/guardian Wand Account may link/manage an under-13 DDV Profile within the existing
three-profile limit. No separate under-13 Wand credentials are created.

Under-13 Community participation scope remains a separate Privacy/Legal decision.
