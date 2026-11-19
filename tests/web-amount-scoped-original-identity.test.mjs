import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {compile} from 'svelte/compiler';

const source=readFileSync(new URL('../src/lib/dev/LocalAmountEditorDev.svelte',import.meta.url),'utf8');
const identity='{#if file&&(switchChest||steamChest||switchCatalog0)&&/^[0-9a-f]{64}$/.test(sourceSha)}';

test('scoped Amount Svelte compiles with a local original File identity',()=>{
 const result=compile(source,{filename:'LocalAmountEditorDev.svelte',generate:'dom'});
 assert.ok(result.js.code.length>100);
});

test('scoped product identity is shown only after local SHA256 and never for absent files',()=>{
 assert.ok(source.includes(identity));
 assert.ok(source.includes('data-dev-selected-original'));
 assert.ok(source.includes('<code>{file.name}</code> ({file.size} B)'));
 assert.ok(source.includes('input.value=\'\'; // Native selection of the same original must work again.'));
});

test('a new File waits for CLOSED and a valid UI generation before taking identity',()=>{
 assert.ok(source.includes('if(!workflow||pending)return;'));
 assert.ok(source.includes('const active=workflow,token=++uiEpoch;'));
 assert.ok(source.includes('const closing=active.close();'));
 assert.ok(source.includes('if(workflow!==active||token!==uiEpoch)return;'));
 assert.ok(source.includes('state=v;file=f;'));
 assert.ok(source.includes('sourceSha=Array.from(new Uint8Array(digest)'));
});

test('close, rejected File and unmount clear identity without granting Writer',()=>{
 assert.ok(source.includes("file=null;sourceSha='';buildConfirmed=false;newAmount='';chosen=0;"));
 assert.ok(source.includes('if(workflow===active&&token===uiEpoch){resetInput();error=true;state=active.snapshot()}'));
 assert.ok(source.includes('workflow=null;available=false;'));
 for(const marker of ['data-product-writer="off"','data-cloud="off"','data-original-overwrite="off"'])assert.ok(source.includes(marker));
 assert.ok(!source.includes('{@html file.name}'));
});
