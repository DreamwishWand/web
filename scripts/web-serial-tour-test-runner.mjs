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
const all=readdirSync(resolve(repo,'tests'),{withFileTypes:true})
 .filter(entry=>entry.isFile()&&entry.name.endsWith('.test.mjs'))
 .map(entry=>'tests/'+entry.name).sort();
const browser='tests/web-presets-my-tour-contract.test.mjs';
if(!all.includes(browser)||all.length<2)throw Error('WEB_TEST_DISCOVERY_MISSING');
const ordinary=all.filter(path=>path!==browser);
if(ordinary.length+1!==all.length)throw Error('WEB_TEST_DISCOVERY_INCOMPLETE');
for(const [phase,paths] of [['ordinary',ordinary],['real-chrome-isolated',[browser]]]){
 process.stdout.write('WEB_TEST_PHASE '+phase+' files='+paths.length+'\n');
 const run=spawnSync(process.execPath,['--test',...paths],{
  cwd:repo,env:process.env,stdio:'inherit'
 });
 if(run.error)throw run.error;
 if(run.status!==0)process.exit(run.status??1);
}
process.stdout.write('WEB_TEST_ALL_PHASES_PASS count='+all.length+'\n');
