# DDV Profile Identity Transport — 2026-10-02

Status: **OPTIONAL WORKSPACE ASSOCIATION IMPLEMENTED IN STAGING / PRIVACY + LEGAL PENDING**

## Identity source

- Source: `GameInfo.LastCustomIdOwner`
- Meaning: DDV Player ID / User ID
- `mdc` is only a Wand/Converter filename convention and is not part of the canonical identity value.

The value is an identifier, not a password, ownership proof, Wand authentication factor, recovery factor or entitlement proof.

## Workspace relationship

A Wand Profile Workspace does not require a Player ID. A Wizard may associate the Player ID later by manual entry or when Wand observes it while parsing a local save. Both paths resolve to the same optional identity association.

Within one Wand Account, one digest may map to at most one Workspace. Across different Wand Accounts the same digest may be associated independently. Private Workspace data is never merged or exposed because of a matching digest.

## Transport and storage

- raw save upload is not required;
- raw Player ID travels only in the authenticated request body over TLS;
- it must not appear in URL paths, query strings, analytics or application logs;
- Edge validates the opaque string and derives HMAC-SHA-256;
- domain separation: `dreamwishwand/ddv-player-id/v1\0`;
- PostgreSQL receives only `hmac-sha256:v1:<hex>`;
- stored relation: `private.ddv_identity_associations.binding_key_hash`;
- raw Player ID is not persisted.

## Lifecycle

- self-service unlink is allowed and does not delete the Workspace;
- no ordinary relink cooldown applies;
- Workspace deletion is separate, destructive and requires explicit confirmation;
- Workspace deletion removes its identity association;
- account deletion removes the account's Workspaces and identity-association state.

## Remaining acceptance

The digest-only DB path and Workspace lifecycle have staging runtime PASS evidence. Live raw Player ID Edge E2E remains pending staging HMAC-secret configuration. Privacy and Legal review remain launch gates.
