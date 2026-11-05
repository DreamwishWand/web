import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const script=fileURLToPath(new URL('../scripts/asset-research/steam-switch-10pair-offline.py',import.meta.url));
const ledger=JSON.parse(readFileSync(fileURLToPath(new URL('../docs/core/01d-steam-switch-10pair-source-ledger-20261105.json',import.meta.url)),'utf8'));
const python=spawnSync('python3',['--version'],{encoding:'utf8'});
const ready=python.status===0;
const run=(data)=>{
  const dir=mkdtempSync(join(tmpdir(),'01d-quality-neg-'));
  try{
    writeFileSync(join(dir,'manifest.json'),JSON.stringify(data));
    return spawnSync('python3',[script,'--manifest',join(dir,'manifest.json'),'--source-root',dir,'--report',join(dir,'result.json')],{encoding:'utf8'});
  }finally{rmSync(dir,{recursive:true,force:true});}
};

test('01D quality study pins 10 slots and never fabricates image or permission evidence',()=>{
  assert.equal(ledger.schema,'wand.01d.steam-switch-10pair-original-quality@1');
  assert.equal(ledger.gameVersion,'1.24.13');
  assert.equal(ledger.ownerVisualABRequired,false);
  assert.equal(ledger.pairs.length,10);
  assert.deepEqual(ledger.pairs.map(x=>x.slot),[1,2,3,4,5,6,7,8,9,10]);
  assert.equal(ledger.status,'INSUFFICIENT_EVIDENCE');
  assert.ok(ledger.pairs.every(x=>x.matchStatus!=='SOURCE_PROVENANCE_CONFIRMED'));
  assert.ok(ledger.pairs.every(x=>!x.steam?.pngSha256));
});

test('01D Python quality tool syntax parses without any licensed game image',t=>{
  if(!ready){t.skip('python3 unavailable, PILLOW and real images NOT_RUN');return;}
  const code="import ast,sys;ast.parse(open(sys.argv[1],encoding='utf8').read())";
  const p=spawnSync('python3',['-c',code,script],{encoding:'utf8'});
  assert.equal(p.status,0,p.stderr);
});

test('01D rejects non-ten-pair or wrongly-versioned input before image analysis',t=>{
  if(!ready){t.skip('python3 unavailable; not a quality acceptance');return;}
  const nine=structuredClone(ledger);nine.pairs.pop();
  const a=run(nine);
  assert.notEqual(a.status,0);
  assert.match(a.stderr,/TEN_EXACT_SAME_VERSION_SOURCE_SLOTS_REQUIRED/);
  const wrong=structuredClone(ledger);wrong.gameVersion='1.25.3';
  const b=run(wrong);
  assert.notEqual(b.status,0);
  assert.match(b.stderr,/TEN_EXACT_SAME_VERSION_SOURCE_SLOTS_REQUIRED/);
});

test('01D rejects duplicate ItemID and falsified slot ordering before imaging',t=>{
  if(!ready){t.skip('python3 unavailable; not a quality acceptance');return;}
  const dup=structuredClone(ledger);dup.pairs[1].itemId=dup.pairs[0].itemId;
  const a=run(dup);
  assert.notEqual(a.status,0);
  assert.match(a.stderr,/DUPLICATE_OR_NONCANONICAL_ITEM_ID/);
  const wrong=structuredClone(ledger);wrong.pairs[4].slot=6;
  const b=run(wrong);
  assert.notEqual(b.status,0);
  assert.match(b.stderr,/TEN_DISTINCT_ORDERED_SLOTS_REQUIRED/);
});

test('01D requires exact versioned original ItemID/GUID on each side before comparing pictures',t=>{
  const source=readFileSync(script,'utf8');
  assert.match(source,/SOURCE_ITEM_IDENTITY_MISMATCH/);
  assert.match(source,/CROSS_PLATFORM_ICON_GUID_MISMATCH/);
  assert.match(source,/SAME_ORIGINAL_FILE_NOT_TWO_INDEPENDENT_SOURCES/);
  assert.match(source,/MISSING_CANONICAL_ITEM_ID/);
  assert.match(source,/manifest\.get\("steamFullVersion"\)!=STEAM_FULL_VERSION/);
  if(!ready){t.diagnostic('python3 NOT_RUN, source text checks only');return;}
  const pil=spawnSync('python3',['-c',"from PIL import Image,features;assert features.check('webp')"],{encoding:'utf8'});
  if(pil.status!==0){t.diagnostic('Pillow/libwebp NOT_RUN; no original image comparison accepted');return;}
  const dummy='0'.repeat(64);
  const def=(itemId,guid,platform)=>({itemId,iconReference:guid,
    itemDefinitionSourceSha256:dummy,pngSha256:dummy,path:platform+'.png',
    platform:platform==='switch'?'Nintendo Switch':'Steam/Windows',gameVersion:'1.24.13',
    ...(platform==='steam'?{fullVersion:'releases_1.24-v1.24.13-2-ga6fe50c4da68-incremental-33'}:{})});
  const seed=structuredClone(ledger);
  seed.pairs[0]={slot:1,itemId:'30800076',category:'Flower',gameVersion:'1.24.13',
    matchStatus:'SOURCE_PROVENANCE_CONFIRMED',
    switch:def('30800076','guid:'+'1'.repeat(32),'switch'),
    steam:def('30800076','guid:'+'2'.repeat(32),'steam')};
  const guidMismatch=run(seed);
  assert.equal(guidMismatch.status,2,guidMismatch.stderr);
  // Real original images are absent: all 10 must remain unmeasured despite forged row status.
  assert.match(guidMismatch.stdout,/"measuredPairs": 0/);
  seed.pairs[0].steam.iconReference=seed.pairs[0].switch.iconReference;
  seed.pairs[0].steam.itemId='30800077';
  const itemMismatch=run(seed);
  assert.equal(itemMismatch.status,2,itemMismatch.stderr);
  assert.match(itemMismatch.stdout,/"measuredPairs": 0/);
});

test('01D separate public shipping flags and R39 source-only provenance from quality research',()=>{
  const source=readFileSync(script,'utf8');
  assert.match(source,/lossless=True, exact=True/);
  assert.match(source,/LANCZOS/);
  assert.match(source,/ORIGINAL_PNG_SHA_MISMATCH/);
  assert.match(source,/MISSING_ACTUAL_PAIRED_ORIGINALS/);
  assert.match(source,/"productMigrationAuthority":False/);
  assert.match(source,/Never uploads/);
  assert.match(source,/CROSS_PLATFORM_ITEM_IDENTITY_OR_VERSION_NOT_CONFIRMED/);
});
