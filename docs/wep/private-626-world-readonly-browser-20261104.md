# 02 WEP — Nintendo Switch 1.25.3/schema626 genuine P1G local read-only browser receipt

**W-DEC-018 / Separate next READY.** This is an owner-PC-only preparation. A genuine encrypted personal P1G was **NOT available or executed** while authoring or testing this change. No genuine Save belongs in the repository, CI, connected apps, project files, or Cloud Work. Do **not** interpret synthetic CI or QA as real Save V1/Native 2D proof.

## Exact scope

- Nintendo Switch v1.25.3, **external executable BID `9A239D3DB569756D`**, P1G Save schema626; the BID must be confirmed independently from the game's executable. `LastSaveDeviceInfo` may report a cross-save Windows device and is not platform identity.
- Local-only P1G decode/ZIP count, encrypted SHA/size; source `read626SpatialReferences` Area/Grid/Child/SubGrid reference issue status; same original encrypted P1G passed to **loopback-only Chromium** World Reader's existing `[data-wep-626-readonly]` and compared with raw serialized GridObject entry count. The Browser must have **no Canvas, Edit/Apply, Export, Writer**, and wrong BID re-import must clear the old read-only panel.
- A matching record count establishes only a **bounded serialized source→browser structural agreement**. It does not establish spatial coordinates, native GridData placement, parent/child transform, footprint, collision, valid Grid default/diff reconstruction or V3 Native semantics. `geometryFor2d=NOT_VERIFIED` remains mandatory. Missing/mismatched counts or Source issues → **PARTIAL**, not V1 PASS.
- Core 01A product Shared SingleSession Spatial capability remains OFF. The locally minted `sourceRevision=owner-local-ui-only:...` is not Core-issued Revision/CAS; no Writer/export/edited copy.

## Owner-only prerequisites and steps

From a reviewed local checkout containing this child branch, on the **owner's own PC** with Node 22, Playwright-core + Chrome already installed locally, and Vite dev server bound only to loopback:

```sh
npm run dev -- --host 127.0.0.1 --port 4197
# In a separate OWNER PC terminal (not CI or public GitHub)
export WEP_PRIVATE_P1G_PATH=/absolute/private/path/outside/wand-repo/profile
export WEP_PRIVATE_BUILD_ID=9A239D3DB569756D
export WEP_PRIVATE_EXTERNAL_BUILD_CONFIRMED=YES
export WEP_PRIVATE_LOCAL_ONLY_ACK=YES
export WEP_PRIVATE_CHROME_BIN=/absolute/path/to/google-chrome
node --experimental-strip-types scripts/wep-private-626-readonly-browser-receipt-20261104.mjs
```

Windows PowerShell: set the variables with `$env:...`. A real P1G must remain **outside** the checkout, including symlink target. The script refuses `CI` or `GITHUB_ACTIONS`, requires exact `http://127.0.0.1:4197/editor/world/` (other loopback hostnames permitted by shared strict policy), permits only localhost GET/HEAD, blocks off-origin HTTP/WebSocket and service workers, prevents downloads and screenshots, never writes modified Save bytes. Original SHA is rechecked after Browser use against the resolved same source path. Private SHA/ZIP counts/source issue counts stay in an owner-local OS temp receipt with POSIX 0600; verify Windows ACL separately. Stdout contains safe statuses only, not original path/SHA/ItemIDs. No server-side storage/backup.

## Evidence and release gates

| Check | Owner private requirement | In this development/QA run |
| --- | --- | --- |
| V0 encrypted P1G | SHA/size, local codec/ZIP, external Platform/BID, schema | **NOT_RUN** |
| V1 same-source 626 World | valid Area/Grid refs, Native IDs, Source issues, original→browser count match, wrong BID deny, original SHA unchanged | **NOT_RUN** |
| Browser 626 | actual on-device Chrome loopback, read-only UI, 320px no overflow, no offhost/JS errors | **NOT_RUN** for genuine P1G |
| Native geometry | 626 GridData/Diff/Default/Parent World matrix and footprint | `NOT_VERIFIED`, never inferred |
| Product Rust V2 | verified backup→atomic edited-copy→independent Reopen | `NOT_ACCEPTED` |
| Native V3/V4 | same-BID Native compiler/consumer/Device named test | `NOT_RUN` |
| Writer/Product flags | Grid/Road/Fence/Building mutation, Apply, overwrite, Provider/Community/Public | **OFF** |

CI runs **only pure Node synthetic policy tests and a syntax check** of the genuine owner-private script; the script is NEVER invoked in CI. New-only 04 QR Source acceptance and later 09 INT selection on fresh cumulative main are separate gates. Previous PR479 private-624 harness policy and prior independently accepted PR445/PR457 sources are unchanged.
