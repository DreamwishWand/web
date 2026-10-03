# Community Legal Review Packet — 2026-10-02

Status: **READY FOR EXTERNAL LEGAL REVIEW / LEGAL NOT APPROVED**

This packet separates current technical/Product facts from legal questions. It is not a legal
opinion, does not select governing law, and does not mark Wand legally compliant in any
jurisdiction.

## 1. Service facts Legal should review

Dreamwish Wand Community is intended to provide account-based user participation around Disney
Dreamlight Valley decorating/discovery/reuse.

Current Community capabilities/contracts include:

- Wand Account and Creator Profile;
- publishing of user-created works and associated media/Preset artifacts;
- PUBLIC / UNLISTED / PRIVATE visibility;
- Saves, Follows, Reactions, Comments/Replies and Notifications;
- DDV Profile Workspaces, limited to five retained Workspaces per Wand Account, with optional DDV Player ID association;
- reporting and moderation;
- account deletion;
- transactional/security email;
- backend media/object storage;
- operational/audit records;
- provider-managed infrastructure/authentication/email.

Community is not the DDV entitlement authority. Moonstones, receipts, Premium/DLC entitlement and
other online entitlement are not normal local-editing targets.

## 2. Product-approved deletion / retention facts

Product has approved:

- D1: immediate Community removal plus physical user-authored payload purge within 7 days;
- D2: one 90-day operational-detail scrub stage;
- D3: deletion is immediate and irreversible to the Wizard;
- D4: moderation/security/legal holds may delay applicable deletion/scrub only while justified;
- D5: minimum integrity-preserving structural tombstones may remain;
- D6: backup restore is quarantine-first and must reconcile an external minimal deletion ledger;
- D8: deletion/retention must be disclosed by data category.

D7 direction is supported by Product: minimize data sent to processors and disclose material
provider-controlled retention.

These facts are Product/technical facts, not legal conclusions.

## 3. Account-deletion facts

On account deletion, the current transaction immediately:

- anonymizes and privatizes the Creator Profile;
- removes owned works from Community access/discovery;
- replaces authored comment text with `[deleted]`;
- deletes the user's Saves, Follows, Reactions and NotificationDelivery rows;
- deletes DDV Profile Workspaces and cascades their private optional identity associations;
- retires Wand AuthIdentity and advances session cutoff;
- queues asynchronous provider-account deletion.

User-authored media/Preset payload is physically purged within 7 days unless a permitted hold
blocks applicable cleanup.

Operational detail is normally minimized at 90 days.

The seven-day period is not a recovery period.

## 4. Visibility facts for Terms / Privacy / UI

Legal copy must preserve the technical meanings:

- **PUBLIC**: published, moderation-clear work can be discovered and directly accessed.
- **UNLISTED**: not included in public discovery, but anyone with the direct link/identifier can
  access a published moderation-clear work. UNLISTED is not PRIVATE.
- **PRIVATE**: owner/staff only.

The service should not promise confidentiality for UNLISTED content.

## 5. DDV Profile Workspace and optional identity-association facts requiring review

The current Product/technical model separates the Wand-owned **DDV Profile Workspace** from the
optional DDV Player ID (`GameInfo.LastCustomIdOwner` / mdc) continuity association.

Current facts:

- one Wand Account may retain at most five Profile Workspaces across Active + Archived states;
- `self` and `parent_guardian_managed` Workspaces consume the same capacity;
- a Workspace can exist and be used without any Player ID association;
- raw Player ID is parsed locally for normal association and is not stored in PostgreSQL;
- the backend stores only a versioned server-keyed HMAC digest in the private identity-association table;
- the same Player ID may be associated by different Wand Accounts without sharing private Workspace data;
- within one Wand Account, the same Player ID may be associated with at most one Workspace;
- normal self-service unlink removes only the optional identity association and preserves the Workspace;
- self-service Workspace deletion is separately supported, requires explicit destructive confirmation, frees one of the five slots, and removes Workspace-scoped private data;
- independent WandAccount/CreatorProfile Community data does not become Workspace-owned merely because a Workspace was selected when it was created;
- account deletion removes the account's Workspaces and their private identity associations.

External Legal/Privacy should determine:

- whether the Player ID digest and Workspace metadata are personal/pseudonymous information in each launch jurisdiction;
- required notice and rights for optional association, unlink, correction and Workspace deletion;
- the legally sufficient age/minor implementation for parent/guardian-managed Workspaces;
- how Workspace-scoped deletion and independent Account/Creator-scoped content should be described;
- whether any additional retention or correction mechanism is legally required beyond the current minimized model.

No statement in this packet converts the Product contract into Legal approval.

## 6. Privacy Policy — facts that must be covered

The final Privacy Policy should accurately state, subject to Legal's jurisdiction-specific drafting:

### Data categories

At minimum:

- account/authentication identifiers;
- Creator Profile data;
- DDV Profile Workspace data and optional DDV Player ID digest-association data;
- uploaded media and Preset/user-authored payload;
- published/private works and revision/relationship metadata;
- Comments;
- Saves/Follows/Reactions/Notifications;
- reports/moderation records;
- audit/security/operations records;
- support/recovery records;
- deletion/retention state;
- transactional email/provider records;
- backup/recovery copies and minimal Recovery Deletion Ledger.

### Purposes

Legal should map each category to actual purposes such as:

- account/security/authentication;
- publishing/discovery/reuse;
- Profile Workspace organization and optional DDV identity continuity/routing;
- private interactions/notifications;
- moderation/abuse/security;
- deletion/retention execution;
- backup/recovery;
- service operations and transactional/security email.

Do not invent analytics/advertising purposes that Wand does not use.

### Retention / deletion

The policy must distinguish:

- immediate account/Creator/work removal;
- <=7-day user-authored payload purge;
- normal 90-day operational-detail minimization;
- D4 hold exceptions;
- minimum structural records;
- separate backup/recovery copies;
- separate provider-controlled copies/logs.

It must not claim all physical copies disappear immediately.

### Providers / transfers

The owner-approved launch provider direction is now:

- **Supabase Pro** for the production backend/database/Auth/Storage services used by Wand;
- **Cloudflare R2 Standard** for the independent private Storage recovery copy;
- **Resend** for the currently approved transactional/operator email boundary.

Supabase Pro and Cloudflare R2 Standard are to be provisioned at the release stage. No production
Supabase project or R2 recovery bucket exists yet.

Before final Legal/Privacy approval, bind:

- provider role and DPA/contract;
- processing region(s);
- relevant subprocessors;
- cross-border transfer mechanism where applicable;
- provider backup/log/email retention;
- termination/deletion behavior.

### User rights / contact

Legal must determine the rights and response channels actually required by launch jurisdiction(s),
which may include access, correction, deletion, portability/export, objection/restriction and
complaint rights.

The current technical existence of account deletion does not by itself prove a complete
jurisdiction-specific data-rights process.

## 7. Terms of Service — review topics

The final Terms should address, where applicable:

- operator/legal entity and contact;
- eligibility / minimum age / parental or guardian requirements;
- account security and acceptable account use;
- DDV Profile Workspace rules, the five-retained-Workspace capacity boundary, optional identity association, and separation from DreamSnaps competition rights;
- PUBLIC / UNLISTED / PRIVATE meanings;
- ownership of user-created submissions;
- license needed for Wand to host, transform, display, distribute, moderate and remove submitted
  works/media;
- handling of content that includes Disney/Gameloft game assets, screenshots or other third-party
  IP;
- prohibited content/conduct;
- moderation rights and account/content restrictions;
- reporting/notice process;
- appeals/complaints where required;
- termination/account deletion consequences;
- service availability/change/discontinuation;
- warranty/liability/indemnity/dispute/governing-law provisions as external Legal determines;
- paid Wand Cloud terms if/when a paid product is actually launched.

No jurisdiction-specific clause should be copied in merely because it appears in this checklist.

## 8. Community Rules — review topics

Community Rules should turn the moderation model into clear user rules, including:

- no harassment, threats, hate or targeted abuse;
- no sexual/illegal/exploitative content;
- no doxxing or disclosure of another person's private information;
- no impersonation/deceptive identity use;
- no spam/scams/malicious links;
- no infringement of copyright/trademark/other rights;
- no manipulation of Community/DreamSnaps fairness or abuse of multiple profiles/accounts;
- no prohibited automated abuse;
- rules specific to Touch of Magic / image / video / Q&A contributions as Product finalizes them;
- reporting and enforcement process;
- repeat/severe violation consequences;
- appeals/reconsideration process where Product/Legal require it.

Moderation policy should distinguish rule violations from alleged illegal content where the launch
jurisdictions require different notice/appeal procedures.

## 9. Copyright / UGC review

Because Wand hosts user-generated images, works and comments, external Legal should review:

- the user representation/warranty regarding rights to upload;
- the license Wand needs to process/display/distribute submitted content;
- treatment of screenshots/content containing Disney/Gameloft assets;
- copyright/trademark notice process;
- counter-notice/reinstatement process where applicable;
- repeat-infringer handling;
- whether Wand should register a U.S. DMCA designated agent if it seeks 17 U.S.C. §512 safe-harbor
  treatment.

The U.S. Copyright Office states that service providers seeking §512 safe-harbor protection may
need a designated DMCA agent, public agent contact, expeditious notice/takedown handling and a
reasonably implemented repeat-infringer policy, depending on the service category:
https://www.copyright.gov/512/

This is a review trigger, not a conclusion that Wand qualifies for or must rely on the safe harbor.

## 10. EU DSA review

If Wand falls within the relevant DSA scope for EU users, external Legal should determine the exact
obligations and exemptions.

Review topics include:

- illegal-content notice-and-action mechanism;
- explanations of moderation decisions;
- internal complaint/appeal process;
- retention of complaint access/records where required;
- Terms transparency for moderation rules;
- minor-protection duties;
- any micro/small-enterprise exemptions and whether they apply.

Official anchors:

- Regulation (EU) 2022/2065:
  https://eur-lex.europa.eu/eli/reg/2022/2065/oj
- European Commission DSA guidance:
  https://digital-strategy.ec.europa.eu/en/policies/dsa-guidelines

Article 16 provides notice-and-action requirements for hosting services; Article 20 contains an
internal complaint-handling framework for online platforms. Applicability/exemptions must be
determined by Legal.

## 11. Japan privacy/platform review

For Japan, external review should consider APPI and any platform/content-distribution obligations
that apply to Wand's actual operator, scale and service shape.

PPC review anchors:

- APPI Q&A:
  https://www.ppc.go.jp/personalinfo/faq/APPI_QA/
- general guidelines:
  https://www.ppc.go.jp/personalinfo/legal/guidelines_tsusoku/

PPC explains that there is no universal statutory personal-data retention period and that data no
longer needed should be deleted without delay, while practical data-management cycles can be taken
into account. That supports review of the stated purposes for Wand's 7-day/90-day windows; it does
not itself approve those durations.

## 12. California / U.S. privacy review

If California consumer-privacy law applies, external Legal should assess notice and applicable
know/delete/correct/opt-out/provider-flow requirements.

CPPA review anchor:
https://cppa.ca.gov/faq

The existence of Wand's account-deletion path does not establish complete CCPA compliance.

## 13. Children / minors — Product boundary fixed, Legal review still required

Product has fixed the eligibility model:

- minimum age for an **independent Wand Account is 13**;
- users under 13 may not independently register;
- accountless local functionality remains available, including local save-file editing and local
  Editor/read-only workflows;
- a parent or guardian may use their own Wand Account to associate/manage an under-13 user's DDV
  Profile;
- the under-13 user receives no separate Wand credentials;
- parent/guardian-managed Workspaces use the same maximum-five retained Workspace capacity as self-managed Workspaces.

Decision evidence:

- `ops/community-age-minors-product-decision-20261002.json`
- `docs/community/age-minors-product-decision-20261002.md`

This is a Product contract, **not a Legal conclusion**.

External Legal/Privacy must still determine:

1. the legally sufficient and privacy-minimized age-gate/age-assurance implementation;
2. whether parental notice, consent or verification is required, and in which launch jurisdictions;
3. what under-13 Community actions, if any, may be performed through a parent/guardian-managed
   account and under what safeguards;
4. requirements applicable to users aged 13–17;
5. the required Terms, Privacy Policy and Community Rules wording.

Do not select an age-verification vendor or implement a complex parental-consent system until those
questions are resolved.

## 14. Moderation / legal holds

The Product-approved D4 mechanism permits only moderation/security/legal holds while justified.

Legal must define:

- who may request/authorize a legal hold;
- the required basis/documentation;
- whether expiry/review dates are mandatory;
- when a hold must be released;
- access controls;
- whether/when the affected user must be notified;
- conflict with deletion/right requests;
- response to preservation requests, subpoenas/orders or litigation holds.

Terms/Privacy should describe the possibility at a high level without exposing sensitive case or
security details.

## 15. Backup / provider-copy boundary

The current D6 design says:

- PITR is not launch-required;
- DB and Storage recovery are separate;
- Storage backup is private and outside the primary rollback domain;
- restore is quarantine-first;
- a minimal external Deletion Ledger prevents deleted-user resurrection;
- restored sessions are revalidated;
- promotion fails closed if reconciliation is incomplete.

Provider selection is closed: Supabase Pro + Cloudflare R2 Standard. Legal/Privacy must still approve
the actual provider-specific configuration, DPA/subprocessor/transfer, retention and deletion terms
before production exposure.

## 16. External Legal decisions required before LEGAL APPROVED

At minimum:

1. launch operator/legal entity and contact;
2. launch countries/regions and intended audience;
3. implementation of the approved 13+ independent-account boundary, under-13 parent-managed Community scope, and any age-assurance/parental-consent requirement;
4. Privacy Policy legal bases/notices/rights workflow;
5. processor/DPA/subprocessor/cross-border treatment;
6. DDV Profile Workspace / optional Player ID-association minimization, unlink/correction/deletion rights and Workspace-scoped deletion semantics;
7. Terms/UGC license/IP policy;
8. notice/takedown/counter-notice/repeat-infringer strategy;
9. moderation/report/appeal obligations, including DSA analysis where applicable;
10. D4 hold/legal-preservation procedure;
11. actual production backup/provider retention boundary;
12. governing law/disputes/liability language appropriate to the operator and launch regions.

## 17. Approval boundary

**LEGAL = PENDING.**

No statement in this packet should be converted to `LEGAL APPROVED` without a competent external
Legal review or an explicitly authorized owner/legal decision based on the intended jurisdictions.

If Legal requests a semantic Product/technical change, reopen only the affected contract and
targeted regression. Do not rerun unrelated Community acceptance suites.


## DDV Profile Workspace Product/identity delta — 2026-10-02

The prior max-three exclusive Linked DDV Profile model is superseded.

The current Product contract is:

- maximum five retained DDV Profile Workspaces per Wand Account;
- Active and Archived Workspaces both consume capacity;
- parent/guardian-managed and self-managed Workspaces use the same capacity;
- DDV Player ID association is optional and is not authentication, entitlement proof or exclusive ownership;
- cross-account reuse of the same Player ID association is allowed without cross-account private data sharing;
- same-account duplicate association of one Player ID to multiple Workspaces is blocked;
- normal self-service unlink removes the association but preserves the Workspace;
- Workspace deletion is a separate confirmed destructive action that frees a slot and deletes Workspace-scoped private data;
- independent Account/Creator Community contributions survive Workspace deletion unless separately deleted under their own lifecycle;
- raw Player ID is not persisted for normal association; only the private server-keyed digest is stored.

The technical identity source remains `GameInfo.LastCustomIdOwner` (DDV Player ID / User ID).
External Legal/Privacy should review the minimized digest, Workspace lifecycle, age/minor boundary,
user-rights wording and jurisdiction-specific notice obligations. This technical/Product closure is
not Legal approval.
