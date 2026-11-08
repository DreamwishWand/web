import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdtempSync,mkdirSync,writeFileSync,rmSync,symlinkSync,existsSync,readFileSync} from 'node:fs';
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
    // Keep this fake bundle in an independent input directory: the bundle's
    // parent must not contain the private output even for synthetic tests.
    const bundleDir=join(x,'bundle-input');mkdirSync(bundleDir);
    const bundle=join(bundleDir,'bundle');writeFileSync(bundle,Buffer.from([4,5,6]));
    const a=run(['--source-root',source,'--catalog-root',catalog,'--bundle',bundle,'--private-output',out]);
    assert.notEqual(a.status,0);
    assert.match(a.stderr,/ORIGINAL_TYPE_OR_SIZE_OR_ALIAS|ORIGINAL_SHA_OR_MUTATION_MISMATCH/);
    assert.equal(existsSync(join(out,'40000047-steam1253-reconstructed.png')),false);
    assert.equal(existsSync(join(out,'01d-r14-steam1253-private-native-hold.json')),false);
    const link=join(x,'link');symlinkSync(source,link,'dir');
    const b=run(['--source-root',link,'--catalog-root',catalog,'--bundle',bundle,'--private-output',out]);
    assert.notEqual(b.status,0);
    assert.match(b.stderr,/PRIVATE_DIRECTORY_MISSING_OR_SYMLINK/);
  }finally{rmSync(x,{force:true,recursive:true});}
});
test('R14 preflight denies both ancestor and descendant output overlaps for every original input',()=>{
  const d=mkdtempSync(join(tmpdir(),'wand-01d-r14-private-guard-'));
  try{
    const source=join(d,'source'),catalog=join(d,'catalog');
    const bundleParent=join(d,'bundle-input'),bundle=join(bundleParent,'original.bundle');
    const privateOut=join(d,'private-output');
    for(const p of [source,catalog,bundleParent,privateOut]) mkdirSync(p);
    writeFileSync(bundle,Buffer.from('synthetic bundle; never owner media'));
    writeFileSync(join(source,'Furniture.json'),Buffer.from([1,2,3]));
    const args=(out,{src=source,cat=catalog,bun=bundle}={})=>[
      '--source-root',src,'--catalog-root',cat,'--bundle',bun,
      '--private-output',out,'--item-id','40000047'];
    const accept=run(args(privateOut));
    assert.notEqual(accept.status,0,'fake synthetic inputs must fail pinned original SHA');
    assert.match(accept.stderr,/ORIGINAL_TYPE_OR_SIZE_OR_ALIAS|ORIGINAL_SHA_OR_MUTATION_MISMATCH/);
    assert.doesNotMatch(accept.stderr,/PRIVATE_OUTPUT_MUST_BE_SEPARATE/);
    const sourceNested=join(source,'nested'),catalogNested=join(catalog,'nested');
    const bundleNested=join(bundleParent,'nested');
    for(const p of [sourceNested,catalogNested,bundleNested]) mkdirSync(p);
    const inputParent=join(d,'source-parent');
    const inputChild=join(inputParent,'actual');
    mkdirSync(inputParent);mkdirSync(inputChild);
    const bundleParentParent=join(d,'bundle-ancestor');
    const actualBundleDir=join(bundleParentParent,'bundle-real');
    mkdirSync(bundleParentParent);mkdirSync(actualBundleDir);
    const nestedBundle=join(actualBundleDir,'original.bundle');
    writeFileSync(nestedBundle,Buffer.from('another synthetic bundle'));
    const rejected=[
      [d,{},'output ancestor of all inputs'],
      [source,{},'source input equals output'],
      [sourceNested,{},'output inside original root'],
      [catalog,{},'catalog input equals output'],
      [catalogNested,{},'output inside original catalog'],
      [bundleParent,{},'bundle.parent equals output'],
      [bundleNested,{},'output inside bundle.parent'],
      [inputParent,{src:inputChild},'output parent of original root only'],
      [bundleParentParent,{bun:nestedBundle},'output parent of bundle.parent only'],
      [actualBundleDir,{bun:nestedBundle},'output equals changed bundle.parent'],
    ];
    for(const [out,other,label] of rejected){
      const r=run(args(out,other));
      assert.notEqual(r.status,0,label);
      assert.match(r.stderr,/PRIVATE_OUTPUT_MUST_BE_SEPARATE/,label+' '+r.stderr);
    }
    // Symlinks at leaf and at intermediate path must not alias a private output/input.
    const targetLink=join(d,'target-symlink'),sourceLink=join(d,'source-symlink');
    symlinkSync(privateOut,targetLink,'dir');
    symlinkSync(source,sourceLink,'dir');
    const leaf=run(args(targetLink));
    assert.notEqual(leaf.status,0);
    assert.match(leaf.stderr,/PRIVATE_PATH_SYMLINK_OR_ALIAS/);
    const orig=run(args(privateOut,{src:sourceLink}));
    assert.notEqual(orig.status,0);
    assert.match(orig.stderr,/PRIVATE_PATH_SYMLINK_OR_ALIAS/);
    const linkParent=join(d,'link-parent');
    const realParent=join(d,'real-parent');
    mkdirSync(realParent);mkdirSync(join(realParent,'inner'));
    symlinkSync(realParent,linkParent,'dir');
    const intermediate=run(args(join(linkParent,'inner')));
    assert.notEqual(intermediate.status,0);
    assert.match(intermediate.stderr,/PRIVATE_PATH_SYMLINK_OR_ALIAS/);
    const duplicate=run(args(privateOut,{cat:source}));
    assert.notEqual(duplicate.status,0);
    assert.match(duplicate.stderr,/PRIVATE_INPUT_ROOT_DUPLICATE_OR_ALIAS/);
    for(const out of [source,sourceNested,catalog,catalogNested,bundleParent,bundleNested]){
      assert.equal(existsSync(join(out,'40000047-steam1253-reconstructed.png')),false);
      assert.equal(existsSync(join(out,'01d-r14-steam1253-private-native-hold.json')),false);
    }
  }finally{rmSync(d,{recursive:true,force:true});}
});
test('R14 protocol contains no static public output path or Owner GO as technical Native proof',()=>{
  // CI can inspect the Source contract, never original game media.
  const src=readFileSync(file,'utf8');
  assert.match(src,/publicImagesEnabled.*False/);
  assert.match(src,/license.*UNKNOWN/);
  assert.match(src,/switch1253OriginalPngSha256.*None/);
  assert.match(src,/originalSteamPngSha256.*None/);
  assert.match(src,/historicalR39LossyWebpNotReused/);
  assert.doesNotMatch(src,/static\/ddv\/item-images\/webp-lossless-160-v1\/manifest.json/);
});
