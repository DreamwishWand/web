# 01A CORE — W1 eight-Source-reference atomic CAS (2026-11-04)

## Scope
Native Rust **research-only**; child of frozen PR #456 Source `72a2d68e5fc228012899996f40d62d7030ef0067`. Preserve PR #447 / independent QA #454, PR #456 fresh Node independent reopen, and merged main #451 Single JS Worker W1 READ unchanged. No product Core/Worker Writer API or release flag.

The older research operation already requires Core-owned eight W1 reference hashes before a temporary atomic SaveSession operation. However its SaveSession transaction only CAS-checked the event ID. This patch binds **all eight modelled source references to the same decoded SHA** and includes the exact raw tokens in one stage_command read_set. Source roots are Version626, W1 EventID/Next/Last/EndDate, Grids/DiffGrids, Villages. Each expected raw token is rechecked against the Core-derived digest; missing, duplicate, forged, over-2MiB or altered tokens deny before original-first backup.

The atomic research Session still maintains its own history and source bytes and is **not** the canonical shared product SaveSession. The eight source roots are structural witnesses and do not prove Native Wetland defaults/DiffGrids, Tree/Softwood quota, real Clock/Actualize Last→Next, same-BID producer or gameplay. **Do not infer a Writer grant from eight successful read CAS checks.**

## Tests / evidence
The fixed-HEAD CI uses a synthetic encrypted P1G fixture, native Rust and an already separately accepted Node crypto implementation for independent fresh-process reopen. New focused Rust negative tests cover: missing/duplicate/foreign Core witness, caller-flag forgery, wrong snapshot SHA, altered EndDate, event identity, Villages GridIDs, DiffGrids, and stale readset supplied to stage_command. A stale Grid/DiffGrid token causes `READ_SET_CAS_FAILED`, leaves Revision0 and IndexGeneration0 unchanged, and preserves source SHA; no edited copy is released by product APIs.

Native Rust diagnostic 128MiB and Worker JS 128MiB remain separate. Rust decoded-only synthetic 200MiB sparse pass does not validate full genuine encrypted 200MiB browser Worker. Actual owner-private genuine Rust product V2 still NOT_RUN in this environment. Native same-build V3 UNKNOWN. Writer/EditedCopy/Apply/OriginalOverwrite OFF, no Cloud Save upload.

New-only 05 QR and 09 INT exact-HEAD changed-scope acceptance required before any integration. Do not wholesale merge stacked PRs #412 / #417 / #447 / #456.
