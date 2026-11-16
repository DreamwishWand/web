import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const y=readFileSync(new URL('../.github/workflows/pages.yml',import.meta.url),'utf8');
const proof=y.slice(y.indexOf('  scoped_rm01_proof:\n'));
test('RM01 proof-only dispatch exact exclusive inputs, immutable source and metadata only',()=>{
 assert.ok(y.includes("if: github.event_name != 'workflow_dispatch' || (inputs.scoped_collection_proof_source == '' && inputs.scoped_switch_chest_proof_source == '' && inputs.scoped_rm01_proof_source == '')"));
 assert.ok(proof.includes("if: github.event_name == 'workflow_dispatch' && inputs.scoped_rm01_proof_source != '' && inputs.scoped_collection_proof_source == '' && inputs.scoped_switch_chest_proof_source == '' && github.ref == 'refs/heads/main'"));
 assert.ok(proof.includes('test "$WAND_PROOF_EXPECTED_SOURCE" = "$GITHUB_SHA"'));
 assert.ok(proof.includes('test "$GITHUB_WORKFLOW_SHA" = "$GITHUB_SHA"'));
 assert.ok(proof.includes('test "$GITHUB_REPOSITORY_ID" = 1371485649'));
 assert.ok(proof.includes('--no-default-features --features product-switch626-rm01-scoped,worker-wasm'));
 assert.ok(proof.includes('scoped-placement-proof.mjs build switch626-rm01 "$GITHUB_SHA"'));
 const order=['node scripts/int-protected-ci-gate.mjs build','node scripts/wasm-distribution/verify-protected-release.mjs inputs','scoped-placement-proof.mjs build switch626-rm01','node scripts/int-protected-ci-gate.mjs deploy','actions/attest-build-provenance@v2','verify-protected-candidate switch626-rm01','actions/upload-artifact@v4'];
 let i=-1;for(const m of order){const n=proof.indexOf(m);assert.ok(n>i,m);i=n;}
 assert.doesNotMatch(proof,/actions\/(?:deploy-pages|upload-pages-artifact)@|seal-private-v2|npm run build|permissions:/);
 const upload=proof.slice(proof.indexOf('actions/upload-artifact@v4'));
 assert.match(upload,/wand-switch626-rm01-proof\/pins.json/);
 assert.match(upload,/wand-switch626-rm01-proof\/attestation-bundle.jsonl/);
 assert.doesNotMatch(upload,/ddv_save_core|fixtures\/scoped-switch626-rm01|static\/|build\//);
 const subjects=proof.slice(proof.indexOf('subject-path: |'),proof.indexOf('      - name: Verify exact signer'));
 assert.deepEqual(subjects.match(/tests\/wasm-distribution\/fixtures\/scoped-switch626-rm01\/[^\s]+/g),['tests/wasm-distribution/fixtures/scoped-switch626-rm01/ddv_save_core.js','tests/wasm-distribution/fixtures/scoped-switch626-rm01/ddv_save_core_bg.wasm','tests/wasm-distribution/fixtures/scoped-switch626-rm01/manifest.json']);
 assert.ok(proof.includes('test ! -e static/worker-wasm-scoped-switch626-rm01'));
 assert.ok(proof.includes('SCOPED_PLACEMENT_PROTECTED_CANDIDATE_SIGNED_PROOF_ONLY'));
});
test('RM01 exact accepted target Core/R22 and fixed Web/proof pins; no extra or stale path',()=>{
 const pins=[...proof.matchAll(/test "\$\(git rev-parse HEAD:([^)]*)\)" = ([a-f0-9]{40})/g)].map(x=>[x[1],x[2]]);
 assert.deepEqual(pins,[
  [
    "crates/ddv-save-core",
    "f942165161b98cf7f9de16a1f7459cf3d337dc61"
  ],
  [
    "scripts/wasm-distribution/protected-release-inputs.json",
    "636955805479ed9794896c0d06acbf991c10bf14"
  ],
  [
    "scripts/wasm-distribution/r22-accepted-rust-scope.mjs",
    "83a26102290370bc492417bdc57b1571b5f3c775"
  ],
  [
    "scripts/readonly-release/scoped-placement-proof.mjs",
    "80f799d5369d3772649754d53cc2f59afca102fb"
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
    "5820e5358b69a231736771782c110bf4399d3a06"
  ],
  [
    "src/lib/ddv/core/save/product-scoped-rm01-release-anchor.mjs",
    "027f988f22e3e33ee1d61c600a09a268581d7d40"
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
    "89a12c7ae5eb4f19c66f898fc9c72f0eb22e81c1"
  ],
  [
    "src/lib/ddv/core/save/product-scoped-amount-transport.mjs",
    "d4643ccf023b6784c80fa5b2a377afe7936113ce"
  ],
  [
    "src/lib/ddv/core/save/product-scoped-amount-local-adapter.mjs",
    "dc5fe97f26385f8325e825e00a403d7d742f8cba"
  ],
  [
    "src/lib/ddv/core/save/p1g-rust-worker-readonly-bridge.mjs",
    "f58aaa07de5fbab3adb045c5400dfd35c7e85e7f"
  ],
  [
    "src/lib/ddv/core/save/product-wasm-read-owner.mjs",
    "3ecd98ce619779f7be62ef7f9885aaf659087c95"
  ],
  [
    "src/lib/ddv/core/save/product-wasm-read-owner.d.mts",
    "a2ea0516eccb5a63bd6edcd356df893e1e898d9c"
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
    "7d34795d00103c675a48aa144beb64fc5d4030a2"
  ],
  [
    "src/lib/dev/PlacementProductRoute.svelte",
    "8b7942417e6d9098468cea2232c1834537db1be3"
  ],
  [
    "src/lib/dev/local-placement-copy.mjs",
    "6e26c33894137de89873d4333c426a6976b49564"
  ],
  [
    "src/lib/dev/local-placement-workflow.mjs",
    "03c24e1b4620d6b95c7521b294d685c4376f92bf"
  ],
  [
    "src/lib/dev/product-placement-client.mjs",
    "4a09a05587daed4d02e0443c4189a6ac617e95c4"
  ],
  [
    "src/lib/dev/product-placement-worker-boot.mjs",
    "d054cfdf6ff2e8680ac59cd07daef043921bc0a5"
  ],
  [
    "src/lib/dev/local-scoped-edit-worker-port.mjs",
    "a09148fc88771dd6bf3d2cbc3c6d36e1e31a721a"
  ],
  [
    "src/lib/dev/local-amount-codec-reopen.worker.mjs",
    "955d95056d4c115b24b77db2ec2f31ef90992882"
  ],
  [
    "src/lib/dev/product-rm01.worker.mjs",
    "fc3e58ba7fab3482dcc1908613e6b0372b95a946"
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
    "src/routes/editor/world/rm01/switch/+page.svelte",
    "0d8fc064f5eb61f755505a13030c508d70c73e90"
  ],
  [
    "src/lib/ddv/core/save/product-scoped-sr03-release-anchor.mjs",
    "66f9bb63da4bd7d6f8f43aeac3adf4aa7df2c751"
  ]
]);
});
