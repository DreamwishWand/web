import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const y=readFileSync(new URL('../.github/workflows/pages.yml',import.meta.url),'utf8');
const proof=y.slice(y.indexOf('  scoped_sr03_proof:\n'));
test('SR03 proof-only dispatch exact exclusive inputs, immutable source and metadata only',()=>{
 assert.ok(y.includes("if: github.event_name != 'workflow_dispatch' || (inputs.scoped_collection_proof_source == '' && inputs.scoped_switch_chest_proof_source == '' && inputs.scoped_sr03_proof_source == '')"));
 assert.ok(proof.includes("if: github.event_name == 'workflow_dispatch' && inputs.scoped_sr03_proof_source != '' && inputs.scoped_collection_proof_source == '' && inputs.scoped_switch_chest_proof_source == '' && github.ref == 'refs/heads/main'"));
 assert.ok(proof.includes('test "$WAND_PROOF_EXPECTED_SOURCE" = "$GITHUB_SHA"'));
 assert.ok(proof.includes('test "$GITHUB_WORKFLOW_SHA" = "$GITHUB_SHA"'));
 assert.ok(proof.includes('test "$GITHUB_REPOSITORY_ID" = 1371485649'));
 assert.ok(proof.includes('--no-default-features --features product-steam626-sr03-scoped,worker-wasm'));
 assert.ok(proof.includes('scoped-placement-proof.mjs build steam626-sr03 "$GITHUB_SHA"'));
 const order=['node scripts/int-protected-ci-gate.mjs build','node scripts/wasm-distribution/verify-protected-release.mjs inputs','scoped-placement-proof.mjs build steam626-sr03','node scripts/int-protected-ci-gate.mjs deploy','actions/attest-build-provenance@v2','verify-protected-candidate steam626-sr03','actions/upload-artifact@v4'];
 let i=-1;for(const m of order){const n=proof.indexOf(m);assert.ok(n>i,m);i=n;}
 assert.doesNotMatch(proof,/actions\/(?:deploy-pages|upload-pages-artifact)@|seal-private-v2|npm run build|permissions:/);
 const upload=proof.slice(proof.indexOf('actions/upload-artifact@v4'));
 assert.match(upload,/wand-steam626-sr03-proof\/pins.json/);
 assert.match(upload,/wand-steam626-sr03-proof\/attestation-bundle.jsonl/);
 assert.doesNotMatch(upload,/ddv_save_core|fixtures\/scoped-steam626-sr03|static\/|build\//);
 const subjects=proof.slice(proof.indexOf('subject-path: |'),proof.indexOf('      - name: Verify exact signer'));
 assert.deepEqual(subjects.match(/tests\/wasm-distribution\/fixtures\/scoped-steam626-sr03\/[^\s]+/g),['tests/wasm-distribution/fixtures/scoped-steam626-sr03/ddv_save_core.js','tests/wasm-distribution/fixtures/scoped-steam626-sr03/ddv_save_core_bg.wasm','tests/wasm-distribution/fixtures/scoped-steam626-sr03/manifest.json']);
 assert.ok(proof.includes('test ! -e static/worker-wasm-scoped-steam626-sr03'));
 assert.ok(proof.includes('SCOPED_PLACEMENT_PROTECTED_CANDIDATE_SIGNED_PROOF_ONLY'));
});
test('SR03 exact accepted target Core/R22 and fixed Web/proof pins; no extra or stale path',()=>{
 const pins=[...proof.matchAll(/test "\$\(git rev-parse HEAD:([^)]*)\)" = ([a-f0-9]{40})/g)].map(x=>[x[1],x[2]]);
 assert.deepEqual(pins,[
  [
    "crates/ddv-save-core",
    "c93264e1c060fa1dacba71ad2cd72628ef6dbbc4"
  ],
  [
    "scripts/wasm-distribution/protected-release-inputs.json",
    "ac82abac187157f26b850868b1af93bc50842b1e"
  ],
  [
    "scripts/wasm-distribution/r22-accepted-rust-scope.mjs",
    "cc9af5e87b19bf93286ec5e16c1658f20659e27a"
  ],
  [
    "scripts/readonly-release/scoped-placement-proof.mjs",
    "a93f28a863ab9d9cf7340499d53602af2a04d596"
  ],
  [
    "scripts/readonly-release/seal.mjs",
    "5b86ff1cf2dc009ba1733bf213e4cb979bf500ec"
  ],
  [
    "scripts/int-protected-ci-gate.mjs",
    "d08d7cb0995b8af9f631448024c8acc83d68a743"
  ],
  [
    "scripts/wasm-distribution/verify-protected-release.mjs",
    "03486f17f41cb7e807c207601b27a3981fe9df6a"
  ],
  [
    "scripts/wasm-distribution/approved-Cargo.lock",
    "b667b42cfef2032c2925be7b2aa9b7142bff4b52"
  ],
  [
    "src/lib/ddv/core/save/product-scoped-placement-release.mjs",
    "e9eb94f91a1c4858d0d93f5837e86e7935a5f471"
  ],
  [
    "src/lib/ddv/core/save/product-scoped-sr03-release-anchor.mjs",
    "66f9bb63da4bd7d6f8f43aeac3adf4aa7df2c751"
  ],
  [
    "src/lib/ddv/core/save/product-scoped-placement-release-anchor.mjs",
    "8bf869bf71546c467194483955e256cbe104c312"
  ],
  [
    "src/lib/ddv/core/save/product-scoped-backpack-release-anchor.mjs",
    "7969122897ebc81bb249dda14d578038a9ffe9e2"
  ],
  [
    "src/lib/ddv/core/save/product-scoped-wardrobe-release-anchor.mjs",
    "f3f12518965dde92617962b5505b8212f4e04980"
  ],
  [
    "src/lib/ddv/core/save/product-rust-wasm-candidate-loader.mjs",
    "959d0ef46c220ed6a402499ca3587b00275d8244"
  ],
  [
    "src/lib/ddv/core/save/product-rust-wasm-release-trust.mjs",
    "d5b167f35b10ecc5b16d40e84e9d9bb324288539"
  ],
  [
    "src/lib/ddv/core/save/product-scoped-placement-transport.mjs",
    "6a99d242ae9dd9d3847f7ac1e6794c4836d2cfb0"
  ],
  [
    "src/lib/ddv/core/save/product-scoped-amount-transport.mjs",
    "330ced0f78c7eb9167a5eeb67757381bb15b96be"
  ],
  [
    "src/lib/ddv/core/save/product-scoped-amount-local-adapter.mjs",
    "e5e645d71f27b2d77d27bd52d61e6b4a9bc49e88"
  ],
  [
    "src/lib/ddv/core/save/p1g-rust-worker-readonly-bridge.mjs",
    "8f63c96637aa9d77c9db25dba73ffb396a41dc61"
  ],
  [
    "src/lib/ddv/core/save/product-wasm-read-owner.mjs",
    "72f8b5e82722ed94d16cc1ac74d19caba5539ddb"
  ],
  [
    "src/lib/ddv/core/save/product-wasm-read-owner.d.mts",
    "d214f944bbfff0f57b456a91d2affe9ba811bc54"
  ],
  [
    "src/lib/ddv/core/save/local-original-backup.mjs",
    "7ea426cffdce8b6cdc8a5b100ff5607ddb9ea48f"
  ],
  [
    "src/lib/ddv/core/save/local-encrypted-copy-store.mjs",
    "67f6579622e5d8903d3798d5921d2ea525980eda"
  ],
  [
    "src/lib/dev/LocalPlacementEditorDev.svelte",
    "4fa7c7bc35fa577633a511d926b44756a16d5b3b"
  ],
  [
    "src/lib/dev/PlacementProductRoute.svelte",
    "29dd56ec075024633f11ab0dcd6841a4f177befe"
  ],
  [
    "src/lib/dev/local-placement-copy.mjs",
    "cb9cf8fea8f4944f93b4c66e286c728571af80bb"
  ],
  [
    "src/lib/dev/local-placement-workflow.mjs",
    "043346466ae11102f976366db085797920ca6e5e"
  ],
  [
    "src/lib/dev/product-placement-client.mjs",
    "e236c90ca236385c28d0bfa5e8b87cfda36cad98"
  ],
  [
    "src/lib/dev/product-placement-worker-boot.mjs",
    "d054cfdf6ff2e8680ac59cd07daef043921bc0a5"
  ],
  [
    "src/lib/dev/local-scoped-edit-worker-port.mjs",
    "ffb65e5ba0540edd85373bda7b02a7c79b561774"
  ],
  [
    "src/lib/dev/local-amount-codec-reopen.worker.mjs",
    "955d95056d4c115b24b77db2ec2f31ef90992882"
  ],
  [
    "src/lib/dev/product-sr03.worker.mjs",
    "bbd7e3fd06b51c26fb3a7011a4e06f8f7337b676"
  ],
  [
    "src/lib/wep/Comp03ReferencePattern.svelte",
    "af6861ca808e7e44ab3e419c146a36090d63fb7f"
  ],
  [
    "src/lib/collection/collection-exact1-consumer.mjs",
    "e5a169a29588f735f4fcffde40078a3a6e9e3a82"
  ],
  [
    "src/lib/collection/collection-exact1-copy.mjs",
    "21abcdb2d51e4f881db1c9e026bd15456ec83f5e"
  ],
  [
    "src/routes/editor/world/sr03/+page.svelte",
    "1b3d0f9773f43f3c6f0651db543804adfdf2436a"
  ]
]);
});
