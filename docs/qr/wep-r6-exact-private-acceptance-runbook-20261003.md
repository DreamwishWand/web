# QR WEP R6 exact private-save acceptance

Purpose: close only the remaining exact private-browser evidence for representative routes B/H. This does not authorize any persistent DDV writer.

## Required source checkpoint

- Product source: `dev/wep-v125@9db7502b7d19bb7f22a28b83b959969c0c43de09`
- Rendered route source: `3d433e9ad3ea9cf21196b291a68664c01b5d1d5d` plus later test/inventory-only commits
- CI: `37073599549 / #1824 SUCCESS`
- Browser regression: `37073406371 / #77 SUCCESS`

## Private input

Use the exact representative Switch profile locally only.

Expected identity:
- bytes: `12,846,979`
- SHA-256: `1cfc40196f7ee36048e1fa98c0835561901c6fed3f19ca8dd6fa36c47740dc10`
- schema: `624`
- Floating Island SceneItemId: `1540000147`
- GridID: `760`
- GridDataPath: `GridData/FloatingIslands/FloatingIsland_Urban/FloatingIsland_UrbanGrid-GridData.json`
- root objects: `4,230`

Never commit or upload the private save to GitHub.

## Run

From the checked-out product source:

```bash
npm ci --no-audit --no-fund
npm install --no-save --package-lock=false playwright-core@1.55.0

BASE_PATH= npm run dev -- --host 127.0.0.1 --port 4173
```

In another shell:

```bash
QR_WEP_PRIVATE_SAVE="/absolute/path/to/mdc3768951AEBEA42C5_v624_20260929T071234Z.profile.json" \
QR_WEP_BASE_URL="http://127.0.0.1:4173/editor/world/" \
CHROME_BIN="/absolute/path/to/chrome-or-chromium" \
node scripts/qr-wep-r6-exact-private-acceptance.mjs
```

Evidence is written under `.artifacts/qr-wep-r6-exact-private/`.

## PASS assertions

The harness requires all of the following:
- exact save byte/hash match;
- exact SceneItemId / GridDataPath route exists;
- Open in Canvas succeeds;
- exactly 4,230 Canvas objects render;
- exactly one Canvas object is in the Tab sequence;
- direct-root target has no fabricated Area identity;
- Canvas remains read-only;
- Move left/up/down/right each expose `aria-disabled=true` and `aria-describedby=wep-reason-move`;
- an exact projected object can be selected and inspected;
- Search visible value survives JA/DE/FR/PT-BR/ZH-CN locale switching;
- no Apply or Commit surface exists;
- consoleErrors and pageErrors are empty.

## Separate manual gate

Native browser UI zoom is not simulated by this harness. QR must record real browser UI zoom evidence separately.

## Acceptance boundary

A harness PASS can close the remaining private-save B/H browser event when QR records browser/version/artifact provenance. It does not change:
- `persistentWriteAuthorized=false`
- `WORLD_PERSISTENT_WRITE_V125=false`
- persistent Apply/save replacement/native restore/atomic commit/persistent Road-Fence/world serialization remain OFF.
