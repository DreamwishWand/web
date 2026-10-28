# X05 shared DreamSnaps metadata-only Source contract v1 (03 COMM, 2026-10-28)

**Contract ID:** `wand.dreamsnaps.public-work-detail-metadata@1`
**Status:** `DRAFT_PRIVATE_UNROUTED`, `DO_NOT_MERGE`, `DO_NOT_DEPLOY`.
**Parent:** 08 WEB integrated Source146 Owner `b907a86d67887bf841179f23824e5b26085520c3`.
**Existing authority:** Source144 r20; Source145 original legacy Gallery Detail; Source146 r21; Source141 Incident first-veto; Source143 official numerical OFF/NULL. These files are not changed.

## Tagged union / canonical identities

A future **service-controlled metadata** response is `OriginalCompetition | PostEventCreation`, never an arbitrary `kind` supplied by a browser. WorkID is the unique navigation/social target. `CreatorProfileID`, `ChallengeID`, `MediaID`, `RevisionID` and (for Originals only) `EntryID` have disjoint semantics and must be joined and validated by the server, never reinterpreted or trusted from a URL.

Common minimal fields: `contractVersion`, `kind`, `workId`, `creatorProfileId`, `challengeId`, `publishedRevisionId`, `mediaId` (reference only), `caption`, `publishedAt`, `creator` (privacy-validated), `commentsEnabled=false`, `wandRank=null`, `officialDdvRank=null`, `capabilities:{metadata:boolean,media:false,social:false,officialResults:false,conceptUpdate:false,delete:false}`.

- `OriginalCompetition`: `entryId:UUID`, `entryRevisionId:UUID` pinned to judged photo, plus current `publishedRevisionId`. In current private read implementation the **two revisions must be equal**; otherwise fail closed pending concept-only revision mapping. The only positive metadata projection is the accepted Source145 legacy Original/eligible Results-or-Closed Gallery Detail. `wandRank` is omitted/NULL until a separately authorized published original result read. Never read official DDV numerical fields from the Work alone.
- `PostEventCreation`: `entryId:null`, `entryRevisionId:null`, independent WorkID, one immutable photograph/media, optional concept version later. Multiple Works may share `ChallengeID + owner Account`; no competition Entry, score, rank or reward. **No positive PostEvent response or publisher exists in v1**. A private staging row records WorkID, ChallengeID, CreatorProfileID, photoRevisionID, mediaID and conceptRevisionID with evidence states hard-constrained to `unknown` and publication hard-constrained to `staged`. A BEFORE INSERT/UPDATE trigger validates current Work owner/Creator, no actual Entry/GalleryPublication, native Challenge/Work match, READY owned immutable photo role, same-Work concept revision and nonminor private Work. Unsupported rights/provenance and either Voting conclusion stay `NEED_SOURCE / NEED_RUNTIME`. No invented Official DDV voting state; a Wand round `results` alone does not prove official Voting closed.

## API: implemented, but intentionally inert to public callers

SQL: `private.dreamsnap_shared_public_work_metadata_v1(p_work_id uuid) RETURNS jsonb`. Explicit `revoke all from public,anon,authenticated,service_role`; not exposed in `community-public-query` allowlist, Browser, public URL or Storage signer. Its bounded positive Original result requires Source144 r20 **and** the complete accepted Source145 original reader plus exact frozen Entry image/revision relation. Exception/unavailable maps to SQL `NULL` **internally**; no browser-facing error taxonomy, URL, media capability or side channel is exposed by this change.

The PostEvent table `private.dreamsnap_post_event_staged_v1` also has no public/anon/authenticated/service_role table DML. The CHECK constraint makes publication impossible, even if a privileged migration executor attempts to set `published`. A future additive migration may enable writes only **after** official+Wand voting phase evidence, legal/media rights, idempotency, 2PG concurrency and incident/signer/caching acceptance. Do **not** edit Source141–146 or the legacy Gallery/Entry table to force a PostEvent release.

## Required subsequent independent owner work (not implied by this PR)

1. **NEED_SOURCE:** establish an authoritative, versioned Official DDV Voting-ended signal and proof of image provenance/creator rights from actual supported data. Distinguish from Wand Challenge `results`/closed; unknown or changed phase fails closed. Define authenticated atomic Create/Concept-only Update/Delete, CAS rowVersion/idempotency and search-index/outbox transaction; protected sources must stay read-only until proved. Current migration only stages reference integrity; it does not implement writer or release.
2. **NEED_CONTRACT:** typed PostEvent positive metadata reader and safe publication state transition (still OFF). Define first-class post-event payload with no EntryID and audit/Creator/Comments social suppression. `OriginalCompetition` future concept-only revision must protect judged EntryRevision and actual media/Challenge.
3. **04 QR** after new Owner exact HEAD: independently verify only new table/trigger/private projection via clean migration and two distinct disposable PG backends, transaction races/forgery/embargo/minor/account-retired/privacy/rights negative-first. The synthetic fixture here stubs Source144/145 and is **not** their reacceptance. No claim that official phase, identity, rights or saved personal data were tested.
4. **08 WEB** remains `WAIT_BACKEND`: existing `/dreamsnaps/community/` no-ID guarded route and Creator/Saved/Share are unchanged. Do NOT call private RPC, generate WorkID URL, use MediaID to sign or show public image on this candidate. X07 Saved and X08 Share require separate current Work reauthorization and signed actors.
5. **X10/X11 NEED_SIGNED_RUNTIME:** Image bytes, `community-public-media`, 300-second signed bearer, Origin/CDN revocation/cache, owner/non-owner/moderator actor and physical old-token behavior require Operator Gate A authorization. No Stage, signed JWT/Provider/Storage/CDN or private DDV save touched.

**Product:** 06G Stage1 final (2026-10-15) is UX design approval, not Source/security/QA approval. WAND public Work remains logically independent of OFF-default official DDV numeric-result consent; Source143 public helper is NULL even with ON. Original rank and voluntarily created PostEvent have unrelated competition entitlement. `graphComplete=false`, Operator A HUMAN_NO_GO / B D HOLD / C NOT_AUTHORIZED, R17 30 PASS0/PARTIAL12/BLOCKED18 plus human blockers.

## Tested scope

`tests/sql/comm-x05-metadata-staged-synthetic.sql` is a **synthetic stubbed local** PostgreSQL fixture targeting only the *new* migration. It exercises Original metadata positive with fake accepted legacy reader, two independent staged PostEvent references for one Challenge+owner with no Entry, forged cross-media and attempted publish denies, judging embargo/private/stale revision denies, and no anonymous/service role SQL privilege. It is NOT a Source141–146 full-schema test, live actor/phase validation or signed-media/CDN acceptance.
