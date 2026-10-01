# Community deletion / retention disclosure map — 2026-10-01

Status: **READY FOR PRODUCT / PRIVACY / LEGAL REVIEW**

Machine contract: `ops/community-deletion-disclosure-contract.json`.

This is a semantic disclosure contract, not final legal wording.

## What a Wizard should be told

### Wand Account and Creator Profile

Account deletion is irreversible. Wand access ends immediately. The Creator profile is anonymized
and made private; active avatar/bio/profile identity is removed from Community use.

### Published and private works

Owned works disappear from Community access and discovery immediately.

Their user-authored payload — including media and Preset payload — is physically purged within
**7 days**, unless an allowed moderation/security/legal retention hold blocks the applicable
cleanup.

The seven-day period is not an undo or recovery window.

### Comments

Authored comments are deleted/anonymized immediately. Conversation structure may remain, but the
original comment body is replaced and the comment is marked deleted.

### Saves, follows, reactions, notifications and linked DDV profiles

These private interaction/profile-link records are removed as part of the account-deletion
transaction.

### Sign-in account

Wand sessions/access are revoked immediately. Provider-account deletion runs asynchronously through
the retryable provider-cleanup path. The original provider identifier is not retained in public
Community tables.

### Security, moderation and operational records

Operational detail is normally removed or minimized at **90 days**.

A moderation, security or legal hold may defer the applicable scrub only while the documented need
continues. There is no separate fixed 365-day retention tier.

### Minimal structural records

Some non-content identifiers and relationship/revision structure may remain where necessary to keep
publication, moderation, report and audit history internally consistent.

This is not permission to retain deleted user-authored payload or unnecessary re-identifying
detail.

### Backup and recovery copies

Backup copies follow D6 rather than the primary 7/90-day timers.

A recovered environment is quarantined. Recovery deletion-ledger reconciliation must run before
restored Community data can become user-visible.

### Service-provider copies and logs

Some infrastructure, authentication and transactional-email copies/logs follow provider-controlled
retention windows. Wand must minimize data sent to providers and disclose the material launch
provider windows in the Privacy Policy.

## Delete-account confirmation: required meaning

The confirmation surface must communicate, in plain language:

- deletion is irreversible;
- the account, Creator presence and owned works disappear from Community access immediately;
- user-authored payload is physically purged within 7 days;
- some operational records are normally minimized at 90 days;
- moderation/security/legal holds can delay applicable deletion while justified;
- backup and service-provider copies follow separate recovery/provider rules.

It must **not** claim:

- that every physical copy disappears immediately;
- that seven days is a recovery period;
- that 90 days is the retention period for user-authored content payload.

## Privacy Policy: additional detail

The Privacy Policy should also explain:

- the category-by-category mapping above;
- provider names used at launch;
- material provider-controlled retention windows;
- backup/restore deletion reconciliation;
- minimal structural tombstones;
- the D4 hold exception.

Final wording remains subject to explicit Product/Privacy/Legal approval.
