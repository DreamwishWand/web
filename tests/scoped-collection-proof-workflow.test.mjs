import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const y=readFileSync(new URL('../.github/workflows/pages.yml',import.meta.url),'utf8');
test('proof-only Collection dispatch cannot use normal Pages build/deploy or upload executable subjects',()=>{
 const proof=y.slice(y.indexOf('  scoped_collection_proof:\n'),y.indexOf('  scoped_switch_chest_proof:\n'));
 assert.match(y,/build:\s+if: github.event_name != 'workflow_dispatch' \|\| \(inputs.scoped_collection_proof_source == '' && inputs.scoped_switch_chest_proof_source == '' && inputs.scoped_steam_chest_proof_source == '' && inputs.scoped_sr03_proof_source == '' && inputs.scoped_comp03_spatial_proof_source == '' && inputs.scoped_rm01_proof_source == '' && inputs.scoped_hair_proof_source == '' && inputs.scoped_skin_proof_source == '' && inputs.scoped_portable_proof_request == ''\)/);
 assert.match(y,/deploy:\s+needs: build/);
 assert.match(proof,/if: github.event_name == 'workflow_dispatch' && inputs.scoped_collection_proof_source != '' && inputs.scoped_switch_chest_proof_source == '' && inputs.scoped_steam_chest_proof_source == '' && inputs.scoped_sr03_proof_source == '' && inputs.scoped_comp03_spatial_proof_source == '' && inputs.scoped_rm01_proof_source == '' && inputs.scoped_hair_proof_source == '' && inputs.scoped_skin_proof_source == '' && inputs.scoped_portable_proof_request == '' && github.ref == 'refs\/heads\/main'/);
 assert.match(proof,/test "\$WAND_PROOF_EXPECTED_SOURCE" = "\$GITHUB_SHA"/);
 assert.match(proof,/fa7aeef5dc1459104564bf1eb9704d315ab7c415/);
 assert.match(proof,/--no-default-features --features product-collection-scoped,semantic-writer-dev,worker-wasm/);
 const order=['node scripts/int-protected-ci-gate.mjs build','node scripts/wasm-distribution/verify-protected-release.mjs inputs','node scripts/wasm-distribution/build-scoped-collection-candidate.mjs','node scripts/int-protected-ci-gate.mjs deploy','actions/attest-build-provenance@v2','verify-protected-candidate','actions/upload-artifact@v4'];
 let i=-1;for(const m of order){const n=proof.indexOf(m);assert.ok(n>i,m);i=n;}
 assert.doesNotMatch(proof,/actions\/(?:deploy-pages|upload-pages-artifact)@|seal-private-v2|npm run build|permissions:/);
 const upload=proof.slice(proof.indexOf('actions/upload-artifact@v4'));
 assert.match(upload,/wand-scoped-proof\/pins.json/);assert.match(upload,/wand-scoped-proof\/attestation-bundle.jsonl/);
 assert.doesNotMatch(upload,/ddv_save_core|fixtures\/scoped-collection|static\/|build\//);
 assert.match(proof,/test ! -e static\/worker-wasm-scoped-collection/);
});
