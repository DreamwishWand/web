# 04 QR — Source142 Operator Gate A decision addendum (2026-10-26)

**Scope:** Addendum ONLY to accepted PR #167 \`docs/qa/qr-r18work-atomic-staging-cutover-runbook-20261026.md\` and PR #171 A0–A7/B01–B14/C01–C07 evidence ledger. Do not replace, reimplement, or execute those runbooks. 04 QR / QA & Release; Owner code unchanged. **DRAFT / DO_NOT_MERGE / DO_NOT_DEPLOY. Human Gate A = NOT_APPROVED / NO-GO; B/C independently NOT_APPROVED.**

## 1. Approval target and frozen identities

- Supabase **Staging only**, reference \`ptpdoxhrqopvczpclcij\`, project \`dreamwish-wand-staging\`, PG engine 17 (reported 17.6.1.171). All inspections for this supplement were read-only. No SQL/ACL DDL or DML, Auth mutation, Edge deployment, Storage Copy/Remove, real Actor login or signed media access.
- Source target: 03 COMM Owner Draft PR #134 **exact HEAD \`0b90e6681507a20c5cfa637752fb6c5a575c5d06\`**, 142 SQL migration files. \`20261025003040_r19_reader_history_graph_gap_closure.sql\` Git Blob \`12ec679135ec00033e94760446dcff86ed70884d\`; \`20261025003050_r19_direct_media_sql_issuer_authority.sql\` Blob \`755c45a5edfe0d8cdab4b4320ecdfa02443183fe\`; \`20261025003060_r19_legacy_media_signer_authority.sql\` Blob \`b7563d68348f27591a20a98760534fa7d399b160\`. Ordinary CI \`40295103790\` and local 142 Clean Bootstrap \`40295103855\` SUCCESS; 31 additive same-schema reapplications are **not** a historical Stage116 rehearsal.
- Most recently observed Owner PR #134 HEAD `daeca51eb6c838d9042322a2f3f67fe744e9d01f` is a separate **Provider Gate B documentation-only** delta after the frozen accepted `0b90e6681507a20c5cfa637752fb6c5a575c5d06`; all three Source140/141/142 SQL Git Blobs above are unchanged. Latest ordinary CI `40303938402` SUCCESS; latest local 142 Bootstrap `40303938380` was IN_PROGRESS at initial check and is not presumed PASS. Supabase strict native Source137 provider/version/atomic destination Copy requirements are formally CAPABILITY_BLOCKED for Gate B; this does not change Gate A safety criteria.
- 04 QR PR #185 exact HEAD \`7ba385d81081cfc1aef8c2dc450b686df372d852\`, CI \`40295047337\` and isolated 2PG \`40295047759\` SUCCESS. 09 INT PR #187 exact HEAD \`3aa68a02e08fcbdbf981f6aa8eb3f803b40bc47a\` ordinary \`40295560259\` + local 2PG \`40295560423\` SUCCESS. No accepted Source142 positive signed remote Provider.
- Live read-only Stage migrations **116**, last Version \`20261024043436\`, \`gallery_known_reference_writer_fence_v1\`. **21 ACTIVE** Edge and **7 ACTIVE** pg_cron jobs. Stage Source142 migration 03060 is NOT deployed, nor new R18 Reservation/ReleaseGate or R19 Suppression.
- SQL ledger name/version comparison against exact Git Source142 tree: only **23** exact (Version+Name) matches, **107** shared *unique* names, **5** Stage-only names, **35** Source-only names, four duplicate Stage names. Stage-only names: \`community_core_v0_staging_media_bucket\`, \`community_staging_pg_net\`, \`community_staging_remove_pg_net\`, \`scene_preset_product_vertical_v1\`, \`scene_preset_unattached_media_discard_v1\`. **Neither 142−116 nor 35 source-only names constitutes a migration recipe.** Require historical-116 data-preserving clone, exact semantic DDL/dataset/ACL/RLS/Trigger reconciliation, and reviewed staged transition plan.
- Stage catalog \`private.preset_storage_reservations_r18\` absent, \`private.preset_storage_release_gate_r18\` absent, \`private.preset_storage_work_read_suppressions_r19\` absent; \`public.artifact_blobs\` has one user trigger. A clean Source142 installation does not prove Stage historical upgrade.

## 2. Stage issuer/worker manifest — provider SHA, not deployment attestation

Read-only \`list_edge_functions\` + individual \`get_edge_function\` confirmed all 21 rows ACTIVE and listed \`ezbr_sha256\`. These are **provider-reported existing bundle hashes**, **not** independently rebuilt/canonically attested future fail-closed runtime bundle hashes. Operator must re-fetch all active versions, source files, dependencies, replicas, aliases, dispatch paths and runtime route mapping immediately before its authorized window.

| Current Edge | v | JWT | Current provider ezbr SHA-256 | A risk/action |
|---|---:|:---:|---|---|
| community-command | 30 | ON | \`05434b71f095728b6754cdc85307e95402890674a6da666732ee87ba1466931f\` | indirect SQL Writer / all command aliases; freeze applicable mutations |
| community-query | 14 | ON | \`0bac6fe65dea784592c02c15f0746577b9b768b19bf6203856ee4e744a35e5a3\` | owner Reader / safe reopening only after SQL authority |
| community-media | 16 | ON | \`ccfe49b85e5ec9e2d463be76d12cdb43059029b4714b17ad23d81d89d5216845\` | Gallery physical Remove and legacy signed reader; bucket-specific safe policy |
| community-auth-e2e | 9 | ON | \`e4ae6bac0cfac9be9cf91e56cabadb7b31e9df42b51346f5eb63c7\` | disabled E2E; prove unreachable as mutation path |
| community-e2e-once | 7 | ON | \`b25a648aee32b18e135f9e47d8e79a8b46f358d77015874207abbd4dd2f3af2d\` | disabled E2E |
| community-auth | 4 | OFF | \`901e4c38ab428a023cc85b053f723da29e477225a6eef1ac065a8c77164b1a09\` | provider cleanup worker; credential/queue inventory |
| community-admin | 16 | ON | \`cf8e3490584250d611c7c58b41e1f4c052f5106f59aa72682e2b7e103717dbde\` | staff SQL/Moderation/retention privileged routes |
| community-account | 3 | ON | \`9526cce01292fbf7d14e09111a18f32e0b3100527d64751df03cf0653acd9690\` | preserve privacy suppression/tombstone |
| community-retention | 12 | OFF | \`2e0235b40060cf3d5462e4505905fbd28d7b62e24e2d408b2ca982327e29413c\` | separate physical Gallery/Account media Remove; legal hold |
| community-ops-escalation | 3 | OFF | \`463c1e173b61cb462ad6523122f91e4259309fb53103a99c734cad985a5f889f\` | operations worker; audit dispatch side effects |
| community-ops-email | 5 | OFF | \`02f3227169513d08a1ebf0a08822a55876efda93687df9d5ae693398ac2b65de\` | operations email worker, preserve harmless alerts |
| **wep-preset-artifact** | **14** | **ON** | \`fe7b0fa1f7c1c0bfec79f45da53b6d37bf43b430859f1ab6c0be410fbe57dfaa\` | **P0 Copy→SQL→compensating Remove + discard** |
| **wep-preset-retention** | **6** | **OFF** | \`675b3a2213ad3233e875f9120cb89151ff3b360fc33b4a282616725b5bed6f7e\` | **P0 claim→physical Remove→finalize** |
| community-email-resend | 4 | OFF | \`61138a14c664b47c6ca89dc271eaf0957b027c9bd965f3565e85ed982cbdabe8\` | mail worker; check service token ingress |
| community-wep-retention-e2e | 5 | ON | \`bbb2e0e9e695553b3162e1f7fd1bdea41fb02a8de782afb2a9140a7ed5f5206d\` | disabled E2E |
| wep-retention-e2e | 4 | OFF | \`88ce72510999d925ec9ea67df6e53d9a55637a6a588e212e2a1b4d507eba0102\` | disabled E2E |
| wep-preset-flow-e2e | 9 | ON | \`ef6118477cf0fcfebb9347cf0760c7ca80d7f145f2ee32539532e4735c85b8da\` | disabled E2E |
| community-auth-acceptance | 7 | OFF | \`f9c7189a345f3d213738dc54b10ec013742cd648c4a68297ae904796087b7d0d\` | auth acceptance, no assumed writer |
| **community-public-media** | **6** | OFF | \`376f40f919154195cd460501ba661af9f15bf9ac29cae099702af320b042bb39\` | **old public bearer issuer; no Source142 R19 edge guard** |
| **community-public-query** | **7** | OFF | \`baa7fb67eca0351617ba5afae85f0243bd435845d96a69d75ba1ae26e3040652\` | **old public Scene query; source failclosed response NOT deployed** |
| **wep-scene-preset-product** | **1** | **ON** | \`6f04d6cfdae3aea99d78b1b12f0e37575c11afb04cf7584b89fda936df690045\` | **P0 distinct Scene Copy-before-SQL → published/staging compensating Remove, unpublish/delete** |

Protected Source142 candidate *Git file blobs* (NOT final complete bundle SHA-256): \`wep-preset-artifact/index.ts\` \`7b07f750a9770886e4cf587537fed466b1965040\`; \`wep-scene-preset-product/index.ts\` \`89338d77937729b170d7ec5940b3683be88248b9\`; \`wep-preset-retention/index.ts\` \`052c642a2c739eb686e259135db8a2d33c26b965\`; public Media \`1988271818f4a2b75f2691312c725ea3c7a1eac7\`, public Query \`5f12b449724e2fddc554fa3767e243891698e58f\`, owner Media \`acc2658a8248456c160ebb3cb280aedb7c1321d7\`. Source142 candidate Generic/Scene/Retention files contain no direct \`storage.copy\` or \`storage.remove\` call, but still require dependency + bundle audit, negative live evidence and operator-approved SHA readback. **All target deployed bundle SHA256 = UNKNOWN / NOT_DEPLOYED**, so Gate A is NO-GO.

## 3. Seven Stage pg_cron jobs — unchanged and all ACTIVE

Read-only \`cron.job\` status and schedule; command content is intentionally NOT copied here because it may expose secrets/URLs. Command MD5 here is *non-cryptographic audit fingerprint only*, not proof of actual dispatch target/secret owner.

| id | job | schedule | command MD5 | A consideration |
|---:|---|---|---|---|
| 1 | community-outbox-every-minute | \`* * * * *\` | \`a57c63115802a2c207d38cea350cf624\` | route/Work/Outbox dependency |
| 31 | community-operations-alerts-every-minute | \`* * * * *\` | \`95e4937b88d737c79bc2619592f246be\` | safe alert only if proven |
| 32 | community-provider-cleanup-every-minute | \`* * * * *\` | \`9391c1e318ca1f6808d768222ce0699a\` | stop/drain cleanup claims |
| 33 | community-retention-hourly | \`17 * * * *\` | \`1143da830592a2de9ef525ab70e46e02\` | stop/drain physical retention |
| 34 | community-retention-alerts-every-minute | \`* * * * *\` | \`7797ac1d495b9e73c7cd943bdc885880\` | alerts may depend on cleanup |
| 37 | community-operations-escalation-alerts-every-minute | \`* * * * *\` | \`c440794662841d691255d7b0a05b1d6b\` | escalation review |
| 38 | community-operations-escalation-every-minute | \`* * * * *\` | \`feccbb8c1bebc8d9667c72a38d07ba48\` | alternate worker dispatch |

**UNKNOWN:** authoritative command targets, arbitrary service-role scripts, Vault/worker token issuance, external retries, in-flight leases, other schedulers; operator must inspect in protected environment, not via user-facing secret dumps. Cron silence alone does NOT stop existing Edge requests, privileged RPC callers, queues, webhook retries or valid preissued tokens.

## 4. Critical Stage SQL issuer / ACL evidence (read-only)

All below currently \`SECURITY DEFINER\`, \`service_role EXECUTE=true\`, \`anon=false\`, \`authenticated=false\`, and \`PUBLIC=false\` (Postgres role privilege check). These are Stage \`md5(pg_get_functiondef)\` fingerprints for change detection, **not SQL SHA256 nor semantic-equivalence proof**:

| public function signature (argument names omitted) | Stage function MD5 | Transition risk |
|---|---|---|
| \`community_publish_preset_envelope(13 arguments)\` | \`777735bf5fbadf5904cb1041c5f36b43\` | Generic legacy positive registration |
| \`community_publish_scene_preset_product_v1(13 arguments)\` | \`6edf29d98d2454e8b69bdb3041086e56\` | Separate Scene positive issuer |
| \`community_unpublish_scene_preset_v1(uuid,uuid,text)\` | \`731cb9160a5bc36e14486f4a13f9ace7\` | Scene lifecycle |
| \`community_delete_scene_preset_v1(uuid,uuid,text)\` | \`415baeb0057d5e61463f589a375ccc37\` | Scene deletion |
| \`community_get_scene_preset_public_v1(uuid)\` | \`443f9d950aa7f8ae8e47af06b8fd3fe7\` | Stage-only public Reader alias still executable to service-role |
| \`community_get_media_storage_key(uuid,uuid)\` | \`fa594ce367cbcd5916307cc78140f5eb\` | Legacy direct service-role storageKey; Source142 guard NOT deployed |
| \`community_get_public_media_storage_v2(uuid)\` | \`f982609ae809b2e24a8a2b57697f3a20\` | Older direct public media key issuer |
| \`community_gallery_owner_media_read_v1(uuid,uuid)\` | \`00fa5c47d5517d840e184087bdb32760\` | Older direct Owner Gallery media issuer |
| \`community_gallery_media_gateway_v1(uuid)\` | \`e4b5deff2b1e95bfe1a83d1ca0be27f1\` | Old Gallery gateway |

**SECURITY DEFINER RLS trap:** table policies alone do not close direct service-role EXECUTE. Operator must inventory *every* known/unknown overload, \`regprocedure\`/OID-bound caller, alias and historical Stage-only function, \`pg_get_functiondef\` plus \`pg_get_function_identity_arguments\`, grants to all roles, effective SECURITY DEFINER owner/search_path, triggers and table ACLs. Source142's three media issuer first-statement R19 guards do not protect already-issued raw signed 300-second bearer/CDN copies.

## 5. Source142-specific decision matrix to append to PR171 A0–A7

| Gate | Operator must submit before answering YES | As of this addendum | Default |
|---|---|---|---|
| **A0 — Change Authority** | Named Human change owner+independent approver, protected environment/approval ID, UTC window, exact Stage project, frozen Source142 HEAD/Blob + Stage old SHA | NO approval or protected deployment record | **NO** |
| **A1 — Complete Issuer Boundary** | 21 actual Edge+alias/replica and seven Cron target map; all service_role SQL/worker/Vault/webhook/CI/third-party callers + Credential owner; user/session privacy exception routing | 21 hash + seven IDs observed; full signed Caller/alias/worker closure UNKNOWN | **NO** |
| **A2 — Recovery/Legal** | Verified PITR availability+retention/cutoff and consistent historical SQL/ACL/RLS snapshot; separate actual Storage object original **bytes**, versions/metadata and restoration drill; Legal Hold/Privacy #139 approval; abort responder/RPO-RTO | No protected PITR drill or actual byte restore proof; Supabase DB backup does NOT restore deleted Storage bytes; S3 versioning unsupported | **NO** |
| **A3 — Global Quiesce/Drain** | Durable external entry barrier to old generic/scene/retention aliases and direct service-role callers; worker/Cron/Vault and queue stop; _zero_ new admissions, _zero unaccounted_ Copy/SQL/compensation/Remove and stale leases/retries; barrier stays ON | NOT EXECUTED; active old deployments | **NO** |
| **A4 — Safe Bundle Swap** | Reviewed failclosed Generic/Scene/Retention+relevant media/public reader bundles with **full dependency** SHA256; approved operator deploy with barrier; independent actual deployed/replica/route SHA readback; negative probes prove no Copy/Remove | Source Git blobs known only; new deployed bundle SHA/real readback UNKNOWN | **NO** |
| **A5 — Reviewed Historical SQL Cutover** | Data-preserving clone of actual 116 migration state, approved semantic per-object 116→Source142 SQL/ACL/RLS/Triggers including five Stage-only items + Stage-only Scene/public RPC, service_role unknowns, preservation of privacy/legal | Exact 23/107/35/5 name counts only. NO semantic clone replay | **NO** |
| **A6 — Negative Acceptance** | Under barrier, all old physical issuers and direct SQL/alias calls deny; affected Gallery/Scene/history/Cover-only/Privacy/Media read suppression; no unplanned Blob/Revision/Outbox/Storage change; checks both reporter orderings where applicable, all fail closed | local Source142 QA only; no Stage under-barrier negative live acceptance | **NO** |
| **A7 — Limited Safe Reopen** | Named set of read-only/unaffected traffic paths and lawful privacy operations; monitor/rollback owner; positive Preset/Scene publishers, staging removal and physical cleanup OFF; external barrier selectively maintained | NOT EXECUTED, no reopening permission | **NO** |

A0–A7 must all be evidence-signed. Missing one makes approval **NO-GO**, not PARTIAL PASS. A signed approval for Stage read-only preparation must NEVER be mistaken for runtime Gate A approval.

## 6. Human YES/NO decision (do not auto-approve)

The named approver must explicitly record in Issue #130 in a protected approval register:

\`DECISION: APPROVE_GATE_A_FAILCLOSED_CUTOVER\` or \`DECISION: REJECT_GATE_A\` (currently REJECT/NOT_APPROVED); responsible Change Owner and Independent Reviewer; requested UTC window; permitted exact Stage project; SOURCE142 full HEAD and SQL Blob; approved **new** runtime Edge+Worker bundle SHA256 and route-to-replica mapping; numbered A0–A7 evidence references and expiry; contingency / abort owner; maximum safe reopening scope; distinct B/C state NOT_APPROVED.

**Specific YES questions:** Are ALL ingress/privileged direct callers fenced? Can the operator prove no unaccounted Copy/SQL/compensating Remove/lease remains at one consistent durable checkpoint? Is every active old version replaced by matching SHA-verified safe bundle before any SQL revoke? Is the 116→142 semantic migration/ACL/trigger/Stage-only RPC closure independently rehearsed on a true historical data clone? Are PITR and independently restored actual object bytes available? Do Privacy/Legal approvers accept data retention and abort procedure? Can the protected negative check distinguish Stage old issuer from Source142 without live signed actors? Does only unaffected, reviewed surface reopen? If ANY answer NO/UNKNOWN => REJECT.

## 7. Approved-future execution order (NOT executed)

1. **Human approves A0–A7 evidence plan**; snapshot Stage project, functions, Cron, SQL Catalog/ACL/Triggers, Storage metadata, object byte backup, PITR, legal holds, secret-free route map; rehearse on disposable historical116 clone and recheck unchanged Source142 HEAD/Blob.
2. **Externally quiesce** both public and privileged write ingress, Generic and *separate* Scene product aliases, direct service-role issuers, service/worker/Cron dispatch, old upload/signed issuer paths, retries, TTL queues. Allow only independently classified safe emergency/privacy routes if proved. Keep barrier engaged continuously.
3. **Durably drain** Copy start/finish, SQL work commit/rollback, compensating Storage.remove, staging discard, retention claims, queued jobs, idempotency retries, any OID-bound direct caller; independently verify zero admissions and zero unaccounted work, else ABORT/HOLD.
4. With barrier still ON, **deploy complete reviewed failclosed Edge/Worker/media read bundles**; never deploy positive provider writer. Independent readback from each actual Stage endpoint/replica and dependency hash must match the protected signed bundle manifest. Verify old v14/v1/v6 and alternate aliases all now inert. Hash mismatch => ABORT, no SQL changes.
5. Only **AFTER** actual safe runtime SHA attestation, apply human-reviewed non-prefix historical116→Source142 SQL/ACL/RLS/Trigger tailored migration; explicitly retire all discovered old Scene/Gallery/WEP write signatures and prevent alternate provider key issuers. Keep positive and cleanup gates disabled. **SQL Revoke before Scene v1 Copy-before-SQL stop is strictly prohibited.**
6. Under barrier perform source-authority, SQL permission, registered/unregistered Reader/History/Media, no-copy/remove, privacy suppression and object metadata negative acceptance. One error => HOLD, preserve bytes/incident evidence.
7. Only with recorded authorization **limited safe reopening** of enumerated unaffected reads and approved lawful Privacy/Ops paths. Preset/Gallery/Cloud Positive writers, native DDV persistent apply, physical Cleanup, old signed CDN invalidation promises remain OFF. Gate B signed real Provider and Gate C deletion remain separately approved and NOT included.

### Abort and rollback boundary

At ANY old endpoint still reachable, unknown service-role caller, missing Bundle SHA, in-flight Copy/Remove, failed PITR/byte restore/Legal review, ACL/RLS drift, unauthorized positive Writer or unexpected Storage change: STOP. Retain external barrier; quarantine uncertain objects, claims and Work/Media keys; record secret-free evidence; notify Owner, 09 INT, Privacy/Legal. **Never rollback by reactivating destructive Generic v14, Scene v1 or Retention v6.** Prefer protected reviewed failclosed roll-forward. DB PITR alone can restore old unsafe ACL and does NOT resurrect deleted Storage object bytes, so a restore requires re-enforcing safe barrier/bundles and independent object-byte recovery before any reopen.

### Gate B/C exclusions

**B** remains CONFIGURATION_BLOCKED/NOT_EXECUTED: consented genuine signed Owner A/NonOwner B/Moderator M, real Provider destination nonoverwrite atomicity and source immutability/version or feasibility verdict, independent GET Byte SHA256+Size (do not infer SHA from ETag), same-key races and preissued signed bearer/CDN t0/t60/t300/post. Supabase S3 Versioning is unsupported; an alternative unversioned pinned GET + \`upsert:false\` design is still HYPOTHESIS until attested. **C** remains NOT_AUTHORIZED: complete current/historical Gallery/Preset/Scene/Cloud/Privacy/Legal/old signed bearer reference closure before version-conditional physical deletion. Neither B nor C implied by A.

## 8. Evidence scope and disposition

**CONFIRMED:** read-only latest Stage116+21 ACTIVE Edge SHA+7 ACTIVE Cron+9 listed service-only SQL signatures; exact Source142 142 migration tree and 23/107/5/35 ledger comparison; Owner CI/Bootstrap and QA/INT isolated local 2PG accepted (not rerun). **UNKNOWN / REQUIRED:** complete privileged Caller and OID graph, safe target deployed SHA, protected human approval, durable drain, genuine historical116 data clone migration, PITR+actual Storage object byte restore, signed normal Actor and CDN/Provider, Legal Hold review. **Gate A NO-GO / NOT_APPROVED / NOT_EXECUTED**. **R17 Product Tree30 PASS0/PARTIAL12/BLOCKED18**, all Draft DO_NOT_MERGE/DEPLOY, SOURCE_FULLY_ENROLLED=0, positive writer / Cloud / physical Cleanup / native DDV Writer OFF, NO formal Release R18/R19.

Reference only: accepted [PR167](https://github.com/DreamwishWand/web/pull/167) Runbook, [PR171](https://github.com/DreamwishWand/web/pull/171) evidence matrix, Operator [Issue130](https://github.com/DreamwishWand/web/issues/130). This addendum is not a substitute for protected runtime preflight or authority to execute.
