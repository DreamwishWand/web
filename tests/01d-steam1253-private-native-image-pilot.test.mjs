import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdtempSync,mkdirSync,writeFileSync,rmSync,symlinkSync,existsSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
const file = resolve('scripts/asset-research/01d-steam1253-private-native-image-pilot.py');
const py = process.env.PYTHON || 'python3';
const run = args => spawnSync(py,[file,...args],{encoding:'utf8',timeout:15000,maxBuffer:1024*1024});
test('R14 source-only synthetic pilot allows only bounded known ItemID and no public media',()=>{
  const r=run(['--self-test']);
  assert.equal(r.status,0,r.stderr);
  const v=JSON.parse(r.stdout);
  assert.equal(v.operation,'DEV_READY_SOURCE_ONLY');
  assert.equal(v.testTier,'SYNTHETIC_ONLY');
  assert.equal(v.positive,1);
  assert.equal(v.negative,7);
  assert.equal(v.publicImageRows,0);
  assert.equal(v.realMediaBytesInCI,false);
});
test('R14 missing owner-private original, catalog or output blocks by default',()=>{
  const r=run([]);
  assert.notEqual(r.status,0);
  assert.match(r.stderr,/PRIVATE_SOURCE_ROOT_CATALOG_BUNDLE_OUTPUT_REQUIRED/);
});
test('R14 fabricated root and fake original cannot emit release media',()=>{
  const x=mkdtempSync(join(tmpdir(),'wand-01d-r14-'));
  try{
    const source=join(x,'source');const catalog=join(x,'catalog');const out=join(x,'out');
    mkdirSync(source);mkdirSync(catalog);mkdirSync(out);
    writeFileSync(join(source,'FullVersion.txt'),'releases_1.24-v1.24.13-INVALID\n');
    writeFileSync(join(source,'Furniture.json'),Buffer.from([1,2,3]));
    writeFileSync(join(x,'bundle'),Buffer.from([4,5,6]));
    const a=run(['--source-root',source,'--catalog-root',catalog,'--bundle',join(x,'bundle'),'--private-output',out]);
    assert.notEqual(a.status,0);
    assert.match(a.stderr,/ORIGINAL_TYPE_OR_SIZE_OR_ALIAS|ORIGINAL_SHA_OR_MUTATION_MISMATCH/);
    assert.equal(existsSync(join(out,'40000047-steam1253-reconstructed.png')),false);
    assert.equal(existsSync(join(out,'01d-r14-steam1253-private-native-hold.json')),false);
    const link=join(x,'link');symlinkSync(source,link,'dir');
    const b=run(['--source-root',link,'--catalog-root',catalog,'--bundle',join(x,'bundle'),'--private-output',out]);
    assert.notEqual(b.status,0);
    assert.match(b.stderr,/PRIVATE_DIRECTORY_MISSING_OR_SYMLINK/);
  }finally{rmSync(x,{force:true,recursive:true});}
});
test('R14 protocol contains no static public output path or Owner GO as technical Native proof',()=>{
  // CI can inspect the Source contract, never original game media.
  const {readFileSync}=requireShim();
  const src=readFileSync(file,'utf8');
  assert.match(src,/publicImagesEnabled.*False/);
  assert.match(src,/license.*UNKNOWN/);
  assert.match(src,/switch1253OriginalPngSha256.*None/);
  assert.match(src,/originalSteamPngSha256.*None/);
  assert.match(src,/historicalR39LossyWebpNotReused/);
  assert.doesNotMatch(src,/static\/ddv\/item-images\/webp-lossless-160-v1\/manifest.json/);
});
function requireShim(){ return {readFileSync:(...args)=> {
  // Intentional local module import without CommonJS require under ESM.
  return importUnneeded(...args);
}};}
function importUnneeded(){throw new Error('REPLACED_BY_SOURCE_IMPORT');}
