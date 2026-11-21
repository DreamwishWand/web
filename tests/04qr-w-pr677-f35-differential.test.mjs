// 04 QR-W NEW_ONLY differential for fixed Source PR677/f35. No private Save or public registry.
import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {
 matchesPresetThemeFacets, PRESET_THEME_STAGE1_BOUNDARIES
} from '../src/lib/product/preset-theme-stage1-contract.mjs';

const SOURCE='f35b01a40506eb549fa878615bcab407d6979b97';
const ORIGINAL_RED='099b6eab4fb02943b093c1b5f43f1962daf5498b';
const SOURCE_BLOBS=new Map([
 ['src/lib/product/preset-theme-stage1-contract.mjs','8f012cd7a53b2212ee8ac134be9b059ce7c8e422'],
 ['tests/preset-theme-stage1-contract.test.mjs','c01d4ccabae8c1f0e353a15f11d8781e83fb7bc3']
]);
const git=(...args)=>execFileSync('git',args,{encoding:'utf8'}).trim();

test('Q677-DIFF01 fixed f35 Source2 blobs and old RED ancestor exact; QA branch cannot silently mutate Source',()=>{
 assert.equal(git('rev-parse',SOURCE),SOURCE);
 assert.equal(git('merge-base',ORIGINAL_RED,SOURCE),ORIGINAL_RED);
 const originalChanged=git('diff','--name-only',ORIGINAL_RED,SOURCE).split('\n').filter(Boolean).sort();
 assert.deepEqual(originalChanged,[...SOURCE_BLOBS.keys()].sort());
 for(const [name,blob] of SOURCE_BLOBS)assert.equal(git('hash-object',name),blob,name);
 assert.equal(git('merge-base',SOURCE,'HEAD'),SOURCE);
});

test('Q677-DIFF02 Q07 record has no own season; inherited valid-looking value cannot match',()=>{
 const row=Object.create({season:['winter']});
 row.decorationTheme=['cozy'];
 assert.equal(Object.hasOwn(row,'season'),false);
 assert.equal(matchesPresetThemeFacets(row,{season:['winter'],decorationTheme:['cozy']}),false);
 const legitimate={season:['winter'],decorationTheme:['cozy']};
 assert.equal(matchesPresetThemeFacets(legitimate,{season:['winter'],decorationTheme:['cozy']}),true);
});

function indexInherited(value='winter'){
 const arr=Array(1);
 const proto=Object.create(Array.prototype);
 Object.defineProperty(proto,'0',{value,configurable:true});
 Object.setPrototypeOf(arr,proto);
 assert.equal(arr[0],value);
 assert.equal(Object.hasOwn(arr,0),false);
 return arr;
}

test('Q677-DIFF03 Q08 inherited array index cannot act as source-owned record facet',()=>{
 const record={season:indexInherited()};
 assert.equal(matchesPresetThemeFacets(record,{season:['winter']}),false);
 assert.equal(matchesPresetThemeFacets({season:['winter']},{season:['winter']}),true);
});

test('Q677-DIFF04 Q08 inherited/sparse selected array and inherited selected property deny',()=>{
 const selected=Object.create({season:['winter']});
 assert.equal(Object.hasOwn(selected,'season'),false);
 assert.equal(matchesPresetThemeFacets({season:['winter']},selected),false);
 assert.equal(matchesPresetThemeFacets({season:['winter']},{season:indexInherited()}),false);
 assert.equal(matchesPresetThemeFacets({season:['winter']},{season:Array(1)}),false);
 assert.equal(matchesPresetThemeFacets({season:Array(1)},{season:['winter']}),false);
});

test('Q677-DIFF05 dense own arrays preserve positive empty, OR within and AND across, even mismatched other facet',()=>{
 const record={season:['winter'],decorationTheme:['urban','cafe'],featuredWork:['ddv-work']};
 assert.equal(matchesPresetThemeFacets(record,{season:[],decorationTheme:['urban']}),true);
 assert.equal(matchesPresetThemeFacets(record,{season:['spring','winter'],decorationTheme:['garden','cafe']}),true);
 assert.equal(matchesPresetThemeFacets(record,{season:['spring','winter'],decorationTheme:['garden']}),false);
 assert.equal(matchesPresetThemeFacets(record,{featuredWork:['foreign-work'],season:['winter']}),false);
 assert.equal(matchesPresetThemeFacets(record,{}),true);
});

test('Q677-DIFF06 malformed own selected/record array elements do not gain a positive',()=>{
 for(const bad of [[null],[undefined],[0],[''],[true],Array(1),indexInherited('winter')]){
  assert.equal(matchesPresetThemeFacets({season:bad},{season:['winter']}),false);
  assert.equal(matchesPresetThemeFacets({season:['winter']},{season:bad}),false);
 }
 assert.equal(matchesPresetThemeFacets({season:['winter']},{season:'winter'}),false);
 assert.equal(matchesPresetThemeFacets({season:['winter']},{bad:['winter']}),false);
 for(const flag of ['publicRegistryApproved','numericAssignmentCapApproved','candidateAutomaticallyActive','themeRequestAutomaticallyPublic','createdOrPublishedByThisModule']){
  assert.equal(PRESET_THEME_STAGE1_BOUNDARIES[flag],false,flag);
 }
});