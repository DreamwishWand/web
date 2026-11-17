import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const y=readFileSync(new URL('../.github/workflows/pages.yml',import.meta.url),'utf8');
const proof=y.slice(y.indexOf('  scoped_steam_chest_proof:\n'),y.indexOf('  scoped_sr03_proof:\n'));
test('Steam Chest proof dispatch is exclusive, exact source, metadata only',()=>{
 assert.match(y,/build:\s+if: github.event_name != 'workflow_dispatch' \|\| \(inputs.scoped_collection_proof_source == '' && inputs.scoped_switch_chest_proof_source == '' && inputs.scoped_steam_chest_proof_source == '' && inputs.scoped_sr03_proof_source == '' && inputs.scoped_comp03_spatial_proof_source == '' && inputs.scoped_rm01_proof_source == '' && inputs.scoped_hair_proof_source == '' && inputs.scoped_skin_proof_source == '' && inputs.scoped_comp03_proof_source == ''\)/);
 assert.match(y,/deploy:\s+needs: build/);
 assert.match(proof,/if: github.event_name == 'workflow_dispatch' && inputs.scoped_steam_chest_proof_source != '' && inputs.scoped_collection_proof_source == '' && inputs.scoped_switch_chest_proof_source == '' && inputs.scoped_sr03_proof_source == '' && inputs.scoped_comp03_spatial_proof_source == '' && inputs.scoped_rm01_proof_source == '' && inputs.scoped_hair_proof_source == '' && inputs.scoped_skin_proof_source == '' && inputs.scoped_comp03_proof_source == '' && github.ref == 'refs\/heads\/main'/);
 assert.match(proof,/test "\$WAND_PROOF_EXPECTED_SOURCE" = "\$GITHUB_SHA"/);
 assert.match(proof,/test "\$GITHUB_WORKFLOW_SHA" = "\$GITHUB_SHA"/);
 assert.match(proof,/--no-default-features --features product-steam626-chest-scoped,worker-wasm/);
 const order=['node scripts/int-protected-ci-gate.mjs build','node scripts/wasm-distribution/verify-protected-release.mjs inputs','node scripts/wasm-distribution/build-scoped-steam-chest-candidate.mjs','node scripts/int-protected-ci-gate.mjs deploy','actions/attest-build-provenance@v2','verify-protected-candidate','actions/upload-artifact@v4'];
 let i=-1;for(const m of order){const n=proof.indexOf(m);assert.ok(n>i,m);i=n;}
 assert.doesNotMatch(proof,/actions\/(?:deploy-pages|upload-pages-artifact)@|seal-private-v2|npm run build|permissions:/);
 const upload=proof.slice(proof.indexOf('actions/upload-artifact@v4'));
 assert.match(upload,/wand-steam-chest-proof\/pins.json/);assert.match(upload,/wand-steam-chest-proof\/attestation-bundle.jsonl/);
 assert.doesNotMatch(upload,/ddv_save_core|fixtures\/scoped-steam-chest|static\/|build\//);
 assert.match(proof,/test ! -e static\/worker-wasm-scoped-steam-chest/);
 assert.match(proof,/SCOPED_STEAM_CHEST_PROTECTED_CANDIDATE_SIGNED_PROOF_ONLY/);
});
test('Steam Chest exact cumulative Core and accepted Web/adapter pins; no stale or extra path',()=>{
 const pins=[...proof.matchAll(/test "\$\(git rev-parse HEAD:([^)]*)\)" = ([a-f0-9]{40})/g)].map(x=>[x[1],x[2]]);
 assert.deepEqual(pins,[
  [
    "crates/ddv-save-core",
    "681177d588b7bfba04f2497dff81e36163a3350e"
  ],
  [
    "scripts/wasm-distribution/build-scoped-steam-chest-candidate.mjs",
    "fa2f389989bc76d58e6b941867201d3ececa433a"
  ],
  [
    "scripts/readonly-release/seal-scoped-steam-chest-private.mjs",
    "bf3ab5129e072f64d18ede2ce2b3055e61aef485"
  ],
  [
    "scripts/readonly-release/seal.mjs",
    "5b86ff1cf2dc009ba1733bf213e4cb979bf500ec"
  ],
  [
    "src/lib/ddv/core/save/product-scoped-steam-chest-release-anchor.mjs",
    "d31894accdbfd977953aeedd4055aa027a0f0cb8"
  ],
  [
    "src/lib/ddv/core/save/product-scoped-steam-chest-release.mjs",
    "2ae152ac9f2d7dc671fdfa0ac9c58a4a276a2566"
  ],
  [
    "src/lib/ddv/core/save/product-rust-wasm-candidate-loader.mjs",
    "959d0ef46c220ed6a402499ca3587b00275d8244"
  ],
  [
    "src/lib/dev/product-steam-chest-client.mjs",
    "a4534f259a4c6730640d4fa56f38a13580415719"
  ],
  [
    "src/lib/dev/product-steam-chest.worker.mjs",
    "d801ded148ad1ce00bc02861da4088636e5ebe86"
  ],
  [
    "src/routes/editor/chest/steam/+page.svelte",
    "927d2776e6091d50b54e7e7e92c3e173b64b4ec7"
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
    "eef37e2a1b027134439e686ea5e47501339bbace"
  ],
  [
    "src/lib/ddv/core/save/product-scoped-amount-transport.mjs",
    "d4643ccf023b6784c80fa5b2a377afe7936113ce"
  ],
  [
    "src/lib/ddv/core/save/p1g-rust-worker-readonly-bridge.mjs",
    "ee5929266406bb9a17e1e0a3fc9bce3cb15607f6"
  ],
  [
    "src/lib/ddv/core/save/product-wasm-read-owner.mjs",
    "ae89e25ad3cdc48d8b4e23e7eabc6ba92998b553"
  ],
  [
    "src/lib/dev/local-scoped-edit-worker-port.mjs",
    "1d5eacaabfb27a244a68c6a07cd22feba7eb57c2"
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
  ],
  [
    "src/lib/ddv/core/save/product-rust-wasm-release-trust.mjs",
    "d5b167f35b10ecc5b16d40e84e9d9bb324288539"
  ],
  [
    "src/lib/ddv/core/save/product-wasm-read-owner.d.mts",
    "f20fc6081da2bf67db72e668a11a888966cbbd86"
  ]
]);
});
