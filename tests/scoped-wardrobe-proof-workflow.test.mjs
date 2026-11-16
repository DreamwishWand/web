import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const y=readFileSync(new URL('../.github/workflows/pages.yml',import.meta.url),'utf8');
const specs={
  "scoped_steam_wardrobe_proof": {
    "input": "scoped_steam_wardrobe_proof_source",
    "key": "steam626-wardrobe",
    "feature": "product-steam626-wardrobe-scoped",
    "pins": [
      [
        "crates/ddv-save-core",
        "61485cb8ed43950c97591d81e00cf24ebe534bd2"
      ],
      [
        "scripts/readonly-release/scoped-wardrobe-proof.mjs",
        "a5a6f780c3c1621492c81fc2ce98766476429404"
      ],
      [
        "scripts/readonly-release/seal.mjs",
        "5b86ff1cf2dc009ba1733bf213e4cb979bf500ec"
      ],
      [
        "src/lib/ddv/core/save/product-scoped-placement-release.mjs",
        "788ee376f2f24315d834a875ef6c5263ea8694fa"
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
        "src/lib/ddv/core/save/product-scoped-wardrobe-transport.mjs",
        "8a8b93403c203b116a68afe85b03080c2d6473c9"
      ],
      [
        "src/lib/ddv/core/save/product-scoped-amount-local-adapter.mjs",
        "a3a1c586bab326cdfe49eedcdf1b9bf8a2ee39b4"
      ],
      [
        "src/lib/ddv/core/save/p1g-rust-worker-readonly-bridge.mjs",
        "8f63c96637aa9d77c9db25dba73ffb396a41dc61"
      ],
      [
        "src/lib/ddv/core/save/product-wasm-read-owner.mjs",
        "e31e15b24526bdf903433608e329e81b5776014f"
      ],
      [
        "src/lib/ddv/core/save/product-wasm-read-owner.d.mts",
        "51495acd5ffa3d42b1d4865d72fd25b36ddf46b7"
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
        "d12f770061e9a17a8fc88d0d5bb7293568bbb4f7"
      ],
      [
        "src/lib/dev/PlacementProductRoute.svelte",
        "11cb70c60664b9327718409248ebd29868431a4b"
      ],
      [
        "src/lib/dev/local-placement-copy.mjs",
        "6ba8502e79a27e3d2860374b5e6d0bebde4ff383"
      ],
      [
        "src/lib/dev/local-placement-workflow.mjs",
        "4035d82ebbff5a497d8a36e4d87efeb5eab4b812"
      ],
      [
        "src/lib/dev/product-placement-client.mjs",
        "4ace4cdbd6fa7a8e28872e2dc0cddde4b357cfb7"
      ],
      [
        "src/lib/dev/product-placement-worker-boot.mjs",
        "d054cfdf6ff2e8680ac59cd07daef043921bc0a5"
      ],
      [
        "src/lib/dev/local-scoped-edit-worker-port.mjs",
        "d2f1cd290340eb0a0ea2e74028ca0916276bc946"
      ],
      [
        "src/lib/dev/local-amount-codec-reopen.worker.mjs",
        "955d95056d4c115b24b77db2ec2f31ef90992882"
      ],
      [
        "src/lib/dev/product-steam-wardrobe.worker.mjs",
        "cd12fad9e42487dc3e45531c18a0610d27a95660"
      ],
      [
        "src/routes/editor/wardrobe/steam/+page.svelte",
        "ba71becc76ad9c4c531465309b72a62ffdbfd8e2"
      ]
    ]
  },
  "scoped_switch_wardrobe_proof": {
    "input": "scoped_switch_wardrobe_proof_source",
    "key": "switch626-wardrobe",
    "feature": "product-switch626-wardrobe-scoped",
    "pins": [
      [
        "crates/ddv-save-core",
        "61485cb8ed43950c97591d81e00cf24ebe534bd2"
      ],
      [
        "scripts/readonly-release/scoped-wardrobe-proof.mjs",
        "a5a6f780c3c1621492c81fc2ce98766476429404"
      ],
      [
        "scripts/readonly-release/seal.mjs",
        "5b86ff1cf2dc009ba1733bf213e4cb979bf500ec"
      ],
      [
        "src/lib/ddv/core/save/product-scoped-placement-release.mjs",
        "788ee376f2f24315d834a875ef6c5263ea8694fa"
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
        "src/lib/ddv/core/save/product-scoped-wardrobe-transport.mjs",
        "8a8b93403c203b116a68afe85b03080c2d6473c9"
      ],
      [
        "src/lib/ddv/core/save/product-scoped-amount-local-adapter.mjs",
        "a3a1c586bab326cdfe49eedcdf1b9bf8a2ee39b4"
      ],
      [
        "src/lib/ddv/core/save/p1g-rust-worker-readonly-bridge.mjs",
        "8f63c96637aa9d77c9db25dba73ffb396a41dc61"
      ],
      [
        "src/lib/ddv/core/save/product-wasm-read-owner.mjs",
        "e31e15b24526bdf903433608e329e81b5776014f"
      ],
      [
        "src/lib/ddv/core/save/product-wasm-read-owner.d.mts",
        "51495acd5ffa3d42b1d4865d72fd25b36ddf46b7"
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
        "d12f770061e9a17a8fc88d0d5bb7293568bbb4f7"
      ],
      [
        "src/lib/dev/PlacementProductRoute.svelte",
        "11cb70c60664b9327718409248ebd29868431a4b"
      ],
      [
        "src/lib/dev/local-placement-copy.mjs",
        "6ba8502e79a27e3d2860374b5e6d0bebde4ff383"
      ],
      [
        "src/lib/dev/local-placement-workflow.mjs",
        "4035d82ebbff5a497d8a36e4d87efeb5eab4b812"
      ],
      [
        "src/lib/dev/product-placement-client.mjs",
        "4ace4cdbd6fa7a8e28872e2dc0cddde4b357cfb7"
      ],
      [
        "src/lib/dev/product-placement-worker-boot.mjs",
        "d054cfdf6ff2e8680ac59cd07daef043921bc0a5"
      ],
      [
        "src/lib/dev/local-scoped-edit-worker-port.mjs",
        "d2f1cd290340eb0a0ea2e74028ca0916276bc946"
      ],
      [
        "src/lib/dev/local-amount-codec-reopen.worker.mjs",
        "955d95056d4c115b24b77db2ec2f31ef90992882"
      ],
      [
        "src/lib/dev/product-switch-wardrobe.worker.mjs",
        "b1c412fd2b8b0858058200a3e60de9616203efb6"
      ],
      [
        "src/routes/editor/wardrobe/switch/+page.svelte",
        "c2f80d35b3cee7ebb2073952cb31f60fb0603206"
      ]
    ]
  }
};
const inputs=["scoped_collection_proof_source","scoped_switch_chest_proof_source","scoped_steam_chest_proof_source","scoped_steam_backpack_proof_source","scoped_switch_backpack_proof_source","scoped_steam_wardrobe_proof_source","scoped_switch_wardrobe_proof_source","scoped_comp03_proof_source","scoped_comp03_spatial_proof_source"];
const block=n=>{const start=y.indexOf('  '+n+':\n');assert.ok(start>=0);const rest=y.slice(start+1),end=rest.search(/\n  [a-z0-9_]+:\n/);return end<0?rest:rest.slice(0,end)};
for(const [job,s] of Object.entries(specs))test(s.key+' exact fixed proof-only job',()=>{
 const p=block(job),pins=[...p.matchAll(/test "\$\(git rev-parse HEAD:([^)]*)\)" = ([a-f0-9]{40})/g)].map(m=>[m[1],m[2]]);
 assert.deepEqual(pins,s.pins);assert.ok(p.includes('--no-default-features --features '+s.feature+',worker-wasm'));assert.ok(p.includes('WAND_PROOF_EXPECTED_SOURCE: \$\{\{ inputs.'+s.input+' \}\}'));
 assert.ok(p.includes('test "$WAND_PROOF_EXPECTED_SOURCE" = "$GITHUB_SHA"'));assert.ok(p.includes('test "$GITHUB_WORKFLOW_SHA" = "$GITHUB_SHA"'));
 const order=['node scripts/int-protected-ci-gate.mjs build','node scripts/wasm-distribution/verify-protected-release.mjs inputs','node scripts/readonly-release/scoped-wardrobe-proof.mjs build '+s.key,'node scripts/int-protected-ci-gate.mjs deploy','actions/attest-build-provenance@v2','node scripts/readonly-release/scoped-wardrobe-proof.mjs verify-protected-candidate '+s.key,'node scripts/int-protected-ci-gate.mjs deploy','actions/upload-artifact@v4'];let i=-1;for(const m of order){i=p.indexOf(m,i+1);assert.ok(i>=0,m);}
 assert.doesNotMatch(p,/actions\/(?:deploy-pages|upload-pages-artifact)@|seal-private-v2|npm run build|permissions:/);
 const upload=p.slice(p.indexOf('actions/upload-artifact@v4'));assert.ok(upload.includes('wand-'+s.key+'-proof/pins.json'));assert.ok(upload.includes('wand-'+s.key+'-proof/attestation-bundle.jsonl'));assert.doesNotMatch(upload,/ddv_save_core|fixtures\/|static\/|build\//);
  const anchor='product-scoped-wardrobe-release-anchor.mjs';
 assert.ok(p.includes('test -z "$(git diff --name-only HEAD -- src/lib/ddv/core/save/'+anchor+')"'));
 assert.equal((p.match(/subject-path: \|\n(?: +tests\/wasm-distribution\/fixtures\/[^\n]+\n){3}/g)||[]).length,1);
});
