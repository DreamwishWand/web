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
- Linked DDV Profiles, currently limited to three links per Wand Account;
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
- deletes WandAccount-to-DDV-Profile link rows;
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

## 5. Linked DDV Profile facts requiring review

Technical fields currently include:

- `ddv_profile_id`;
- `binding_state`;
- `binding_key_hash`;
- `verification_evidence_ref`;
- the Wand Account link and link timestamp.

The account link is deleted on Wand Account deletion, but the underlying `ddv_profiles` row is not
automatically removed by that transaction.

The reviewed source does not yet define the binding-hash derivation or verification-evidence
lifecycle. Live staging routine inspection found no reviewed DDV Profile creation/verification
routine beyond the three-link limit trigger and account-deletion tombstone path, and the current
Community command surface exposes no DDV Profile link/verify/unlink command.

External Legal/Privacy should determine:

- the complete creation/verification lifecycle that must exist before Linked DDV Profiles launch;
- whether the binding identifier is personal/pseudonymous information in applicable jurisdictions;
- correction/unlink/rebinding rights or Product processes that are required;
- an acceptable orphan-retention purpose/horizon, if any;
- what notice is required for the verification process.

No schema change is authorized by this packet.

## 6. Privacy Policy — facts that must be covered

The final Privacy Policy should accurately state, subject to Legal's jurisdiction-specific drafting:

### Data categories

At minimum:

- account/authentication identifiers;
- Creator Profile data;
- Linked DDV Profile binding/verification data;
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
- profile linking/fairness;
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
- Linked DDV Profile rules and the three-profile fairness rule;
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

## 13. Children / minors — launch blocker for Legal review

No canonical Wand launch age floor or minors/parental-consent model is currently fixed.

External Legal must decide this before final Legal approval.

For the U.S., FTC COPPA materials explain that COPPA can apply to services directed to children
under 13 and to general-audience services with actual knowledge that they are collecting personal
information from a child under 13:
https://www.ftc.gov/legal-library/browse/rules/childrens-online-privacy-protection-rule-coppa

For the EU, the Commission has DSA guidance on protection of minors:
https://digital-strategy.ec.europa.eu/en/policies/dsa-guidelines

The correct response is not to add an age-verification vendor now. First define launch audience,
jurisdictions and the legally required approach.

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
3. age/minor eligibility and any age-assurance/parental-consent requirement;
4. Privacy Policy legal bases/notices/rights workflow;
5. processor/DPA/subprocessor/cross-border treatment;
6. Linked DDV Profile identifier/verification retention and correction/unlink policy;
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
