# Linked DDV Profile — DDV Player ID Identity Contract

Status: **IDENTITY SOURCE CONFIRMED / COMMUNITY TECHNICAL CONTRACT MAY PROCEED**

## Confirmed identity source

The Linked DDV Profile identity source is:

`GameInfo.LastCustomIdOwner`

Product/user-facing semantics: **DDV Player ID / User ID**.

Existing DDV Profile Converter/Wand backup naming represents this value as:

`mdc{GameInfo.LastCustomIdOwner}`

The literal `mdc` prefix is a filename/representation convention. It is **not** part of the
canonical identifier value.

## Evidence

- Existing Wand/Converter backup logic already derives the `mdc...` backup component from
  `GameInfo.LastCustomIdOwner`.
- Current Nintendo Switch v1.25.0 schema-624 accepted save evidence and a later fresh synced
  Steam/Windows v1.25.0 schema-624 save for the same cloud-linked DDV Profile contain the exact same
  `GameInfo.LastCustomIdOwner` value despite different revisions, sessions, timestamps and devices.
- The stored canonical Steam decrypted filename's `mdc` component matches that field exactly.
- The owner confirms that this value is the same User ID exposed by the game and used when dealing
  with official support.
- Gameloft's DDV Help Center documents an in-game Player ID and instructs users to obtain it through
  Settings -> Help -> Show User ID.

No raw identifier value is written into this document.

## Community privacy/security treatment

The DDV Player ID is a **persistent pseudonymous identifier**, not an authentication credential and
not an entitlement token.

Community must therefore:

- extract it locally from `GameInfo.LastCustomIdOwner`;
- never use Moonstones, receipts, Premium/DLC entitlement, platform credentials or online auth
  identifiers as substitutes;
- never expose the raw Player ID publicly or make it searchable;
- never persist the raw Player ID in Community tables;
- derive the stored binding value with a server-side keyed digest and domain separation;
- keep key material in production secrets/Vault, not client bundles or repository;
- fail closed when the field is missing/malformed;
- treat any unexpected digest collision/account conflict as a hard conflict, not an automatic
  merge;
- never use DDV Player ID possession as Wand authentication, account recovery or entitlement proof.

## Cross-platform semantics

For the current observed same cloud-linked DDV Profile, Switch and Steam/Windows resolve to the same
Player ID. Therefore a cross-save profile consumes **one** Linked DDV Profile slot, not one slot per
platform.

Platform/device identifiers remain separate provenance and must not define the Linked DDV Profile
identity.

## Remaining boundary

This closes the previous identifier-discovery blocker.

Still separate:

- final keyed-digest/key-rotation implementation;
- final verification transport and logging minimization;
- exceptional correction/right-to-correction Legal/Privacy review;
- age/minors parent-managed account rules;
- production provider binding and runtime gates.

Reset/new-profile lifecycle semantics may be recorded when a controlled fixture becomes available;
they do not block the current official Player ID identity source.
