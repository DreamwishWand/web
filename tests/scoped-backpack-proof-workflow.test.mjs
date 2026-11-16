import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const y=readFileSync(new URL('../.github/workflows/pages.yml',import.meta.url),'utf8');
const specs={
  "scoped_steam_backpack_proof": {
    "input": "scoped_steam_backpack_proof_source",
    "key": "steam626-backpack-split",
    "feature": "product-steam626-backpack-scoped",
    "pins": [
      [
        "crates/ddv-save-core",
        "deff1fb1381acab58c466b03435dc81b9cd3a189"
      ],
      [
        "scripts/readonly-release/scoped-backpack-proof.mjs",
        "56532cde395a0302fa01ab2c59592dbf3fb39eab"
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
        "src/lib/ddv/core/save/product-scoped-backpack-transport.mjs",
        "3fe3988a54718be81a9b6bf2109a0cf8e240a72e"
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
        "src/lib/dev/product-steam-backpack.worker.mjs",
        "36fad8f308df8eb14849fe36eaa547b2c34e058d"
      ],
      [
        "src/routes/editor/backpack/steam/+page.svelte",
        "fb299a0e52ea5872de1eca93a8ceaaddb4f451a7"
      ]
    ]
  },
  "scoped_switch_backpack_proof": {
    "input": "scoped_switch_backpack_proof_source",
    "key": "switch626-backpack-split",
    "feature": "product-switch626-backpack-scoped",
    "pins": [
      [
        "crates/ddv-save-core",
        "deff1fb1381acab58c466b03435dc81b9cd3a189"
      ],
      [
        "scripts/readonly-release/scoped-backpack-proof.mjs",
        "56532cde395a0302fa01ab2c59592dbf3fb39eab"
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
        "src/lib/ddv/core/save/product-scoped-backpack-transport.mjs",
        "3fe3988a54718be81a9b6bf2109a0cf8e240a72e"
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
        "src/lib/dev/product-switch-backpack.worker.mjs",
        "8e8a33906ff88d738351e2c64c44539e78df885e"
      ],
      [
        "src/routes/editor/backpack/switch/+page.svelte",
        "f35ffa7cdc5817ceb32a009699e9039192cc60d3"
      ]
    ]
  }
};
const inputs=["scoped_collection_proof_source","scoped_switch_chest_proof_source","scoped_steam_chest_proof_source","scoped_steam_backpack_proof_source","scoped_switch_backpack_proof_source","scoped_steam_wardrobe_proof_source","scoped_switch_wardrobe_proof_source"];
const block=n=>{const start=y.indexOf('  '+n+':\n');assert.ok(start>=0);const rest=y.slice(start+1),end=rest.search(/\n  [a-z_]+:\n/);return end<0?rest:rest.slice(0,end)};
test('all proof selections exclusive; normal build only empty inputs',()=>{
 const normal=block('build').split('\n').find(l=>l.trimStart().startsWith('if:'));
 assert.equal(normal.trim(),"if: github.event_name != 'workflow_dispatch' || ("+inputs.map(k=>"inputs."+k+" == ''").join(' && ')+")");
 const jobs=inputs.map(k=>k.replace(/_source$/,''));
 for(const job of jobs){
  const own=job+'_source',condition=block(job).split('\n').find(l=>l.trimStart().startsWith('if:'));
  assert.ok(condition.includes("github.event_name == 'workflow_dispatch'"));assert.ok(condition.includes("github.ref == 'refs/heads/main'"));
  const checks=[...condition.matchAll(/inputs\.([a-z_]+) (!=|==) ''/g)].map(m=>[m[1],m[2]]);
  assert.deepEqual(checks.map(x=>x[0]).sort(),[...inputs].sort());assert.equal(checks.filter(x=>x[1]==='!=').length,1);assert.ok(checks.some(x=>x[0]===own&&x[1]==='!='));
 }
 for(let mask=0;mask<2**inputs.length;mask++){const active=inputs.filter((_,i)=>mask&(1<<i));const selected=jobs.filter(j=>active.length===1&&active[0]===j+'_source');assert.equal(selected.length,active.length===1?1:0);}
 assert.match(y,/deploy:\s+needs: build/);
});
for(const [job,s] of Object.entries(specs))test(s.key+' exact fixed proof-only job',()=>{
 const p=block(job),pins=[...p.matchAll(/test "\$\(git rev-parse HEAD:([^)]*)\)" = ([a-f0-9]{40})/g)].map(m=>[m[1],m[2]]);
 assert.deepEqual(pins,s.pins);assert.ok(p.includes('--no-default-features --features '+s.feature+',worker-wasm'));assert.ok(p.includes('WAND_PROOF_EXPECTED_SOURCE: \$\{\{ inputs.'+s.input+' \}\}'));
 assert.ok(p.includes('test "$WAND_PROOF_EXPECTED_SOURCE" = "$GITHUB_SHA"'));assert.ok(p.includes('test "$GITHUB_WORKFLOW_SHA" = "$GITHUB_SHA"'));
 const order=['node scripts/int-protected-ci-gate.mjs build','node scripts/wasm-distribution/verify-protected-release.mjs inputs','node scripts/readonly-release/scoped-backpack-proof.mjs build '+s.key,'node scripts/int-protected-ci-gate.mjs deploy','actions/attest-build-provenance@v2','node scripts/readonly-release/scoped-backpack-proof.mjs verify-protected-candidate '+s.key,'node scripts/int-protected-ci-gate.mjs deploy','actions/upload-artifact@v4'];let i=-1;for(const m of order){i=p.indexOf(m,i+1);assert.ok(i>=0,m);}
 assert.doesNotMatch(p,/actions\/(?:deploy-pages|upload-pages-artifact)@|seal-private-v2|npm run build|permissions:/);
 const upload=p.slice(p.indexOf('actions/upload-artifact@v4'));assert.ok(upload.includes('wand-'+s.key+'-proof/pins.json'));assert.ok(upload.includes('wand-'+s.key+'-proof/attestation-bundle.jsonl'));assert.doesNotMatch(upload,/ddv_save_core|fixtures\/|static\/|build\//);
 assert.equal((p.match(/subject-path: \|\n(?: +tests\/wasm-distribution\/fixtures\/[^\n]+\n){3}/g)||[]).length,1);
});
