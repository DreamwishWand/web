// Resource-isolated real Chrome Tour phase for the existing complete Node test suite.
// Every *.test.mjs remains mandatory. Run the heavy real browser contract only
// after all sibling test files exit, so GitHub Pages does not cold-start Chrome
// while 300+ concurrent test files compete for runner CPU/memory.
// No skip, mock, timeout expansion, workflow permission or release gate change.
import {readdirSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const repo=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const matched=readdirSync(resolve(repo,'tests'),{withFileTypes:true})
 .filter(entry=>entry.name.endsWith('.test.mjs'));
// The former shell glob includes symlink and directory names. Never silently
// drop a matched path and then report that the full test suite passed.
if(matched.some(entry=>!entry.isFile()))throw Error('WEB_TEST_DISCOVERY_NONREGULAR_ENTRY');
const all=matched.map(entry=>'tests/'+entry.name).sort();
const browser='tests/web-presets-my-tour-contract.test.mjs';
if(!all.includes(browser)||all.length<2)throw Error('WEB_TEST_DISCOVERY_MISSING');
const ordinary=all.filter(path=>path!==browser);
if(ordinary.length+1!==all.length)throw Error('WEB_TEST_DISCOVERY_INCOMPLETE');
// A parent node:test process sets NODE_TEST_CONTEXT. If inherited by a nested
// node --test child, Node silently skips all test files and can exit with zero.
// Remove only this internal marker; preserve CI, Chrome and other settings.
const testEnv={...process.env};
delete testEnv.NODE_TEST_CONTEXT;
for(const [phase,paths] of [['ordinary',ordinary],['real-chrome-isolated',[browser]]]){
 process.stdout.write('WEB_TEST_PHASE '+phase+' files='+paths.length+'\n');
 const run=spawnSync(process.execPath,['--test',...paths],{
  cwd:repo,env:testEnv,stdio:'inherit'
 });
 if(run.error)throw run.error;
 if(run.status!==0)process.exit(run.status??1);
}
process.stdout.write('WEB_TEST_ALL_PHASES_PASS count='+all.length+'\n');
