// Node-only synthetic pressure characterization for public Gallery SHA-256.
// This does NOT exercise Edge, network, CDN, authenticated Storage or real DDV media.
// Run: node --expose-gc scripts/bench-gallery-public-checksum.mjs
import { webcrypto } from 'node:crypto';
import { performance } from 'node:perf_hooks';

const mib=1024*1024;
const size=20*mib;
const args=process.argv.slice(2).map(Number).filter(x=>Number.isSafeInteger(x)&&x>=1&&x<=16);
const concurrencies=args.length?args:[1,4,8];
for (const concurrency of concurrencies) {
  global.gc?.();
  const payloads=Array.from({length:concurrency},()=>new Uint8Array(size).fill(0x5a));
  const cpuStart=process.cpuUsage();
  const memBefore=process.memoryUsage();
  const start=performance.now();
  const hashes=await Promise.all(payloads.map(p=>webcrypto.subtle.digest('SHA-256',p)));
  const elapsedMs=performance.now()-start;
  const cpu=process.cpuUsage(cpuStart);
  const rssAfter=process.memoryUsage().rss;
  if(hashes.some(h=>h.byteLength!==32)) throw Error('Digest length mismatch');
  const line={
    contract:'ddv.gallery-sha256-node-synthetic-benchmark@1',
    runtime:process.version,
    concurrency,
    payloadMiB:20,
    totalMiB:20*concurrency,
    wallMs:+elapsedMs.toFixed(2),
    throughputMiBPerSec:+((20*concurrency)*1000/elapsedMs).toFixed(2),
    cpuUserMs:+(cpu.user/1000).toFixed(2),
    cpuSystemMs:+(cpu.system/1000).toFixed(2),
    rssBeforeMiB:+(memBefore.rss/mib).toFixed(2),
    rssAfterMiB:+(rssAfter/mib).toFixed(2),
    limitation:'Node memory+SHA ONLY: no Edge isolate, proxy, Origin download, backpressure, CDN or network'
  };
  process.stdout.write(JSON.stringify(line)+'\n');
}
