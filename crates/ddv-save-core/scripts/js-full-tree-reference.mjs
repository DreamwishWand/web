// Synthetic-only approximation of the current JS whole-tree algorithm.
// Not the encrypted P1G Codec; only JSON.parse -> structuredClone -> JSON.stringify.
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const file=process.argv[2];if(!file)throw Error('NEED_SYNTHETIC_FIXTURE_PATH');
const started=performance.now();
const source=readFileSync(file);const hash=createHash('sha256').update(source).digest('hex');
const parsed=JSON.parse(source.toString('utf8'));
const clone=structuredClone(parsed);
assert.equal(clone.GameInfo.Version,626);
assert.equal(clone.World.RecurringEvents['0'].ItemSpawning.NextOccurrence,'2126-08-20T00:00:00Z');
clone.World.RecurringEvents['0'].ItemSpawning.NextOccurrence='2022-09-06T00:00:00Z';
const encoded=JSON.stringify(clone);
const reopened=JSON.parse(encoded);
assert.equal(reopened.World.RecurringEvents['0'].ItemSpawning.NextOccurrence,'2022-09-06T00:00:00Z');
assert.equal(reopened.World.GridCollection.Objects.length,parsed.World.GridCollection.Objects.length);
assert.deepEqual(reopened.Unknown,parsed.Unknown);
assert.equal(createHash('sha256').update(source).digest('hex'),hash);
console.log(JSON.stringify({type:'NODE_JS_FULL_TREE_SYNTHETIC_REFERENCE_ONLY',
 originalBytes:source.length,stringifiedUtf8Bytes:Buffer.byteLength(encoded),
 observedProcessRssBytes:process.memoryUsage().rss,
 observedJsHeapBytes:process.memoryUsage().heapUsed,
 elapsedMs:Math.round(performance.now()-started),
 lexicalJsonByteParity:false,productCodecExecuted:false,chromium:false}));
