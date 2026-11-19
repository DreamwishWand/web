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
    "2f712d047e99bc024672e4d7a488baa6276e06f4"
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
    "d58f2a29f248810068205638ccf1d1f68ecafdd9"
  ],
  [
    "src/lib/dev/local-amount-copy.mjs",
    "9631b4ee40f47432a2a26a6df386b0db9353b09d"
  ],
  [
    "src/lib/ddv/core/save/product-scoped-amount-local-adapter.mjs",
    "107a44cfdcfdaf8cd1769bba3e90c0056fb59cc0"
  ],
  [
    "src/lib/ddv/core/save/product-scoped-amount-transport.mjs",
    "16cfcda06614be2536b877872b15f7ff85bc0f2b"
  ],
  [
    "src/lib/ddv/core/save/p1g-rust-worker-readonly-bridge.mjs",
    "3893195fe0b675a80cab36ec788be4ac756a3ac5"
  ],
  [
    "src/lib/ddv/core/save/product-wasm-read-owner.mjs",
    "17c3daf6eaa529745c9c48775d677e1289955872"
  ],
  [
    "src/lib/dev/local-scoped-edit-worker-port.mjs",
    "f86b066f76d1093b3f677b706dc18868bb238e1c"
  ],
  [
    "src/lib/dev/local-amount-workflow.mjs",
    "8d05fb604ac38b1ab2224fcce2474199ba9f7fee"
  ],
  [
    "src/lib/dev/local-amount-worker-adapter.mjs",
    "3469316b24acc09a8565b8ee57d031315e524e84"
  ],
  [
    "src/lib/ddv/core/save/local-encrypted-copy-store.mjs",
    "f724110108d3244487cfc0336410c96085a893d2"
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
    "30a1331d153ccf9402f22219146e8708860eb968"
  ]
]);
});
