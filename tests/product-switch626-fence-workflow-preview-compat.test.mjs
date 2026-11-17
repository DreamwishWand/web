import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

// Focused lexical guard for Chrome TRUE_RED on current combined Fence/Appearance:
// existing Rust transport behavioral tests and independent browser QA remain separate.
const source=await readFile(new URL('../src/lib/dev/local-placement-workflow.mjs',import.meta.url),'utf8');
test('Fence7 typed Preview and preserved-stock receipt precede generic Vase',()=>{
 const fence=source.indexOf('if(fenceAdd||fe01){');
 const makeup=source.indexOf('if(makeup){');
 const generic=source.indexOf("const common='itemId,gridId,nextObjectId,oldAmount,newAmount");
 assert.ok(fence>0&&fence<makeup&&makeup<generic);
 const branch=source.slice(fence,makeup);
 for(const s of ["r.itemId!==40700246","r.layout!=='PRESERVE_EXISTING'","r.inventoryDelta!==0","r.addObjects!==(fenceAdd?count-1:4)","r.exactFieldChangedCount!==count","r.scopedCandidate!==true","r.writerAuthorized!==false","r.editedCopyAuthorized!==false","r.newAmount===r.oldAmount","r.nextObjectId>Math.max(...selected.oldIds)"])assert.ok(branch.includes(s),'lost Fence typed receipt: '+s);
 assert.ok(source.includes("count=(wardrobe||appearance)?1:comp?9:sr03?8:(fd01||fd02||fd03)?4:(orthoL||diagonal90)?6:orthoT?8:fe01?7:3"));
});
test('FE01 validates four distinct ID selectors and freezes accepted reply IDs',()=>{
 for(const s of ["fe01?exact(selector,'gridId,oldIds')","selector.oldIds.length===4","selector.oldIds.every(positive)","new Set(selector.oldIds).size===4","const selected=fe01?{gridId:selector.gridId,oldIds:[...selector.oldIds]}:{...selector}","adapter[previewMethod](selected)","sameIds(r.oldIds,selected.oldIds)","sameIds(r.retainedIds,selected.oldIds.slice(0,2))","sameIds(r.deletedIds,selected.oldIds.slice(2))","oldIds:Object.freeze([...r.oldIds])"])assert.ok(source.includes(s),'lost FE01 selector/receipt: '+s);
});
test('current Makeup, Eye, COMP03 preview safety remains independent',()=>{
 for(const s of ["if(makeup){","r.makeupItemId!==140100014","if(eye){","r.eyeballItemId!==70000010","if(appearance){","r.old!==(hair?74:170000054)","r.itemId!==(comp?40100038:sr03?40100068:40000066)"])assert.ok(source.includes(s),'lost existing preview: '+s);
});
