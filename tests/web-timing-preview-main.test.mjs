import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { TIMING_UX_COPY, timingUxCopy } from '../src/lib/timing/timing-ui-copy.js';

const read = path=>readFileSync(path,'utf8');
const locales=['en','fr','it','de','es-ES','ja','zh-CN','pt-BR'];
test('Timing Safety and proposed W1 UI are translated across all eight supported locales',()=>{
  assert.deepEqual(Object.keys(TIMING_UX_COPY).sort(),locales.sort());
  const keys=Object.keys(TIMING_UX_COPY.en);
  for(const locale of locales){
    const c=timingUxCopy(locale);
    assert.deepEqual(Object.keys(c).sort(),keys.sort(),locale+' translation keys');
    for(const key of keys) assert.equal(typeof c[key],'string',locale+'/'+key);
    for(const key of ['limit','warning','future','previewNote','noSave','privacy','sourceChanged'])
      assert.ok(c[key].length>=12,locale+'/'+key);
  }
  assert.equal(timingUxCopy('xx'),TIMING_UX_COPY.en);
  for(const locale of locales){
    assert.match(TIMING_UX_COPY[locale].limit,/128/);
    assert.match(TIMING_UX_COPY[locale].limit,/200/);
    assert.match(TIMING_UX_COPY[locale].future,/2126/);
    assert.match(TIMING_UX_COPY[locale].warning,/OFF/);
  }
});
test('main Timing remains read-only with exact source build gating, safe invalidation and no private upload',()=>{
  const p=read('src/routes/editor/timing/+page.svelte');
  for(const marker of ['openWorldSaveBytes','sourceEvidence:WEP_WORLD_READONLY_626_PROVENANCE','sourceBuild.trim().toUpperCase() !== WAND_TIMING_SWITCH_BID','token !== openToken','profileSchemaVersion !== 626','productionReadAccepted','editingAuthorized !== false'])
    assert.ok(p.includes(marker),marker);
  for(const marker of ['on:input={invalidateAttestation}','on:change={invalidateAttestation}','selectedKey = \'\'','data-w1-writer-off="true"','data-timing-expanded-limit="128"','data-timing-2126="preserve"','data-timing-inspect={row.mapKey}','<TimingEditPreview row={selectedRow}'])
    assert.ok(p.includes(marker),marker);
  assert.ok(!p.includes('saveEditedCopy('));
  assert.ok(!p.includes('upload('));
  assert.ok(!p.includes('post('));
  assert.ok(!p.includes('fetch(\'https:'));
});
test('isolated preview renders old/new/reason but cannot export, write, mutate or auto-repair 2126',()=>{
  const p=read('src/lib/timing/TimingEditPreview.svelte');
  for(const marker of ['data-w1-preview="unaccepted"','data-writer="off"','data-timing-old="true"','data-timing-new="true"','data-w1-write-authority="off"','data-timing-backup-off="true"','data-timing-export-off="true"','data-timing-apply-off="true"','type="button" disabled','type="text" maxlength="48"','maxLength'])
    if(marker!=='maxLength') assert.ok(p.includes(marker),marker);
  for(const forbidden of ['openWorldSaveBytes','localStorage','FileReader','indexedDB','fetch(','.postMessage(','new Blob(','URL.createObjectURL','setYear(2126)' ])
    assert.ok(!p.includes(forbidden),forbidden);
  assert.doesNotMatch(p,/row\\.nextOccurrence\\s*=(?!=)/,'preview must not assign to source date');
});
test('Worker PR361 contract is not imported into main before independent 05 QR',()=>{
  const p=read('src/routes/editor/timing/+page.svelte');
  assert.ok(!p.includes('createTimingLocalReadWorker'));
  assert.ok(!p.includes('TIMING_LOCAL_WORKER_WRITER_ENABLED'));
  assert.ok(!p.includes('READ_WRITER_OPERATION_DISABLED'));
});
