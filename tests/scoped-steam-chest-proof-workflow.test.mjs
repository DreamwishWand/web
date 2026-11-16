import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const y=readFileSync(new URL('../.github/workflows/pages.yml',import.meta.url),'utf8');
const proof=y.slice(y.indexOf('  scoped_steam_chest_proof:\n'),y.indexOf('  scoped_steam_backpack_proof:\n'));
test('Steam Chest proof dispatch is exclusive, exact source, metadata only',()=>{
 assert.match(y,/build:\s+if: github.event_name != 'workflow_dispatch' \|\| \(inputs.scoped_collection_proof_source == '' && inputs.scoped_switch_chest_proof_source == '' && inputs.scoped_steam_chest_proof_source == '' && inputs.scoped_steam_backpack_proof_source == '' && inputs.scoped_switch_backpack_proof_source == '' && inputs.scoped_steam_wardrobe_proof_source == '' && inputs.scoped_switch_wardrobe_proof_source == '' && inputs.scoped_comp03_proof_source == '' && inputs.scoped_comp03_spatial_proof_source == ''\)/);
 assert.match(y,/deploy:\s+needs: build/);
 assert.match(proof,/if: github.event_name == 'workflow_dispatch' && inputs.scoped_steam_chest_proof_source != '' && inputs.scoped_collection_proof_source == '' && inputs.scoped_switch_chest_proof_source == '' && inputs.scoped_steam_backpack_proof_source == '' && inputs.scoped_switch_backpack_proof_source == '' && inputs.scoped_steam_wardrobe_proof_source == '' && inputs.scoped_switch_wardrobe_proof_source == '' && inputs.scoped_comp03_proof_source == '' && inputs.scoped_comp03_spatial_proof_source == '' && github.ref == 'refs\/heads\/main'/);
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
    "e5c863b756e9593afcfe4f3c24f122c91a4c4b6f"
  ],
  [
    "scripts/wasm-distribution/build-scoped-steam-chest-candidate.mjs",
    "fa2f389989bc76d58e6b941867201d3ececa433a"
  ],
  [
    "scripts/readonly-release/seal-scoped-steam-chest-private.mjs",
    "fb34157d277c10e09789924b2272c41a8c3ee63c"
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
    "dad444b7cfc037960bdcec7a869aa0792040c95e"
  ],
  [
    "src/lib/dev/local-amount-copy.mjs",
    "dcebde6318864381adb51898f4a2c9c87da23007"
  ],
  [
    "src/lib/ddv/core/save/product-scoped-amount-local-adapter.mjs",
    "470f8fc590cb23d9e3ce932c41929ccd65b185ed"
  ],
  [
    "src/lib/ddv/core/save/product-scoped-amount-transport.mjs",
    "620a19633aee1fbfd7ef8461ff1b66f9bc18b0db"
  ],
  [
    "src/lib/ddv/core/save/p1g-rust-worker-readonly-bridge.mjs",
    "562c4f5a29a0fea87a901f9f408358abe8eb002c"
  ],
  [
    "src/lib/ddv/core/save/product-wasm-read-owner.mjs",
    "4f34a20d16fceb27a8f9010819e603dec8c342b9"
  ],
  [
    "src/lib/dev/local-scoped-edit-worker-port.mjs",
    "a22209de4e59c220f1c854496e170c0450630e7b"
  ],
  [
    "src/lib/dev/local-amount-workflow.mjs",
    "f04e70600fcf62b43166258716e54448bc4f3381"
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
    "782622d9c295e7ebd2b8bbc6b6ab9ffe105bbf42"
  ]
]);
});
