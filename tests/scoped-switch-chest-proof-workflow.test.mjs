import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const y=readFileSync(new URL('../.github/workflows/pages.yml',import.meta.url),'utf8');
test('proof-only Switch Chest dispatch cannot use normal Pages build/deploy or upload executable subjects',()=>{
 const proof=y.slice(y.indexOf('  scoped_switch_chest_proof:\n'),y.indexOf('  scoped_steam_chest_proof:\n'));
 assert.match(y,/build:\s+if: github.event_name != 'workflow_dispatch' \|\| \(inputs.scoped_collection_proof_source == '' && inputs.scoped_switch_chest_proof_source == '' && inputs.scoped_steam_chest_proof_source == '' && inputs.scoped_sr03_proof_source == '' && inputs.scoped_comp03_spatial_proof_source == '' && inputs.scoped_rm01_proof_source == '' && inputs.scoped_r01_proof_source == ''\)/);
 assert.match(y,/deploy:\s+needs: build/);
 assert.match(proof,/if: github.event_name == 'workflow_dispatch' && inputs.scoped_switch_chest_proof_source != '' && inputs.scoped_collection_proof_source == '' && inputs.scoped_steam_chest_proof_source == '' && inputs.scoped_sr03_proof_source == '' && inputs.scoped_comp03_spatial_proof_source == '' && inputs.scoped_rm01_proof_source == '' && inputs.scoped_r01_proof_source == '' && github.ref == 'refs\/heads\/main'/);
 assert.match(proof,/test "\$WAND_PROOF_EXPECTED_SOURCE" = "\$GITHUB_SHA"/);
 assert.match(proof,/1318590f458f274017a6c0bd9d65f81b97cc1ade/);
 assert.match(proof,/--no-default-features --features product-switch626-chest-scoped,worker-wasm/);
 const order=['node scripts/int-protected-ci-gate.mjs build','node scripts/wasm-distribution/verify-protected-release.mjs inputs','node scripts/wasm-distribution/build-scoped-switch-chest-candidate.mjs','node scripts/int-protected-ci-gate.mjs deploy','actions/attest-build-provenance@v2','verify-protected-candidate','actions/upload-artifact@v4'];
 let i=-1;for(const m of order){const n=proof.indexOf(m);assert.ok(n>i,m);i=n;}
 assert.doesNotMatch(proof,/actions\/(?:deploy-pages|upload-pages-artifact)@|seal-private-v2|npm run build|permissions:/);
 const upload=proof.slice(proof.indexOf('actions/upload-artifact@v4'));
 assert.match(upload,/wand-switch-chest-proof\/pins.json/);assert.match(upload,/wand-switch-chest-proof\/attestation-bundle.jsonl/);
 assert.doesNotMatch(upload,/ddv_save_core|fixtures\/scoped-switch-chest|static\/|build\//);
 assert.match(proof,/test ! -e static\/worker-wasm-scoped-switch-chest/);
});


// E2556: fixed accepted PR1507 Web composite. Only these eight pins changed.
test('Switch Chest proof pins exact accepted Web composite, no stale or extra paths',()=>{
 const proof=y.slice(y.indexOf('  scoped_switch_chest_proof:\n'),y.indexOf('  scoped_steam_chest_proof:\n'));
 const pins=[...proof.matchAll(/test "\$\(git rev-parse HEAD:([^)]*)\)" = ([a-f0-9]{40})/g)].map(x=>[x[1],x[2]]);
 assert.deepEqual(pins,[
  [
    "crates/ddv-save-core",
    "1318590f458f274017a6c0bd9d65f81b97cc1ade"
  ],
  [
    "scripts/wasm-distribution/build-scoped-switch-chest-candidate.mjs",
    "1cec59930562e9b6918490e54761808d3819c434"
  ],
  [
    "scripts/readonly-release/seal-scoped-switch-chest-private.mjs",
    "6c8dfc4afea309eac4af94da778b01dde43b3f1c"
  ],
  [
    "scripts/readonly-release/seal.mjs",
    "5b86ff1cf2dc009ba1733bf213e4cb979bf500ec"
  ],
  [
    "src/lib/ddv/core/save/product-scoped-switch-chest-release-anchor.mjs",
    "374064f2da8a5681134aeb555166ebe00fce0704"
  ],
  [
    "src/lib/ddv/core/save/product-scoped-switch-chest-release.mjs",
    "7dc69bc0765d6a08e888b99bd976c60c7b9723ce"
  ],
  [
    "src/lib/ddv/core/save/product-rust-wasm-candidate-loader.mjs",
    "959d0ef46c220ed6a402499ca3587b00275d8244"
  ],
  [
    "src/lib/dev/product-switch-chest-client.mjs",
    "ac21d47f40ffea370d175c8cd06c4bd27be16570"
  ],
  [
    "src/lib/dev/product-switch-chest.worker.mjs",
    "b6645a9746d01be64dc1452232c0b36dd848bec6"
  ],
  [
    "src/routes/editor/chest/+page.svelte",
    "1576744c5b11d189e6e82a4edd93fde6e7cf3bea"
  ],
  [
    "src/lib/dev/LocalAmountEditorDev.svelte",
    "da627ecd86d4435c026e611b241aa489d8259dac"
  ],
  [
    "src/lib/dev/local-amount-copy.mjs",
    "9631b4ee40f47432a2a26a6df386b0db9353b09d"
  ],
  [
    "src/lib/ddv/core/save/product-scoped-amount-local-adapter.mjs",
    "94bdf2b9d585410d32a1f3717b3926d2136efac1"
  ],
  [
    "src/lib/ddv/core/save/product-scoped-amount-transport.mjs",
    "cb58ac87357cfc7f3fba9219fd3c482a5883fbc2"
  ],
  [
    "src/lib/ddv/core/save/p1g-rust-worker-readonly-bridge.mjs",
    "ba8c9ccf4df6b4f8e6decd694cb0e62151b53bec"
  ],
  [
    "src/lib/ddv/core/save/product-wasm-read-owner.mjs",
    "fdce9056fb422b99238021d1a588f2a812129147"
  ],
  [
    "src/lib/dev/local-scoped-edit-worker-port.mjs",
    "6e8f6c91a72e5a8290475d657746509c8c3c4df1"
  ],
  [
    "src/lib/dev/local-amount-workflow.mjs",
    "54a5dc90fb0b82ec51f1716089d4fd607eecceb9"
  ],
  [
    "src/lib/dev/local-amount-worker-adapter.mjs",
    "7e2a6fc8250cd5d6ca5cceb0f95e83e06d2d4bd6"
  ],
  [
    "src/lib/ddv/core/save/local-encrypted-copy-store.mjs",
    "67f6579622e5d8903d3798d5921d2ea525980eda"
  ],
  [
    "src/lib/dev/local-amount-codec-reopen.worker.mjs",
    "955d95056d4c115b24b77db2ec2f31ef90992882"
  ],
  [
    "src/lib/ddv/core/save/local-original-backup.mjs",
    "7ea426cffdce8b6cdc8a5b100ff5607ddb9ea48f"
  ]
]);
});
