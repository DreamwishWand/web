#!/usr/bin/env python3
"""Research-only native Chromium Worker WASM memory probe, synthetic JSON only.

OS process RSS sampled every ~50 ms is NOT an exact peak and may double count
shared memory across processes. Do not infer per-Worker heap or OOM immunity.
"""
import functools
import http.server
import json
import os
from pathlib import Path
import sys
import threading
import time

from playwright.sync_api import sync_playwright
import psutil

CRATE = Path(__file__).resolve().parents[1]
ROOT = Path(__file__).resolve().parents[3]
BROWSER = CRATE / "tests" / "browser"
SIZE_MB = int(sys.argv[1]) if len(sys.argv) > 1 else 16
if SIZE_MB not in (16,64,100,200):
    raise SystemExit("ONLY_16_64_100_200_DECIMAL_MB")
fixture = BROWSER / "fixture.json"
if fixture.stat().st_size != SIZE_MB * 1_000_000:
    raise SystemExit("SYNTHETIC_SIZE_MISMATCH")

class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *_): pass

server = http.server.ThreadingHTTPServer(
    ("127.0.0.1",0),
    functools.partial(QuietHandler,directory=str(ROOT))
)
server_thread = threading.Thread(target=server.serve_forever,daemon=True)
server_thread.start()
port = server.server_address[1]
stop = threading.Event()
samples = []
chromium_names = ("chrome","chromium","headless_shell","chrome-headless-shell")

def record_os_rss():
    while not stop.is_set():
        total = 0
        valid = 0
        for proc in psutil.process_iter(["name","memory_info"]):
            try:
                n = (proc.info["name"] or "").lower()
                if any(k in n for k in chromium_names):
                    total += proc.info["memory_info"].rss
                    valid += 1
            except (psutil.NoSuchProcess,psutil.AccessDenied,KeyError):
                continue
        if valid:
            samples.append(total)
        stop.wait(0.05)

record = {
    "type":"CHROMIUM_WASM_SYNTHETIC_ONLY",
    "decodedJsonBytes":fixture.stat().st_size,
    "decodedJsonMB":SIZE_MB,
    "decodedJsonMiB":round(fixture.stat().st_size / 1048576,3),
    "rssSampleSpacingMsApprox":50,
    "rssIsExactWorkerPeak":False,
    "browserSharedPagesMayBeDoubleCounted":True,
    "transientSpikesMayBeMissed":True,
    "productP1gRepackAccepted":False,
}
try:
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True,args=["--no-sandbox"])
        record["browserVersion"] = browser.version
        ctx = browser.new_context()
        page = ctx.new_page()
        url=f"http://127.0.0.1:{port}/crates/ddv-save-core/tests/browser/index.html"
        page.goto(url,wait_until="domcontentloaded",timeout=30000)
        page.wait_for_function("typeof window.probeStart === 'function'",timeout=30000)
        rss_thread=threading.Thread(target=record_os_rss,daemon=True)
        rss_thread.start()
        start=time.monotonic()
        page.evaluate("window.probeStart()")
        page.wait_for_function("window.probeResult !== null",timeout=220000)
        record["wallSeconds"] = round(time.monotonic()-start,3)
        record.update(page.evaluate("window.probeResult"))
        ctx.close()
        browser.close()
except Exception as exc:
    record["ok"]=False
    record["error"]=str(exc)[:300]
finally:
    stop.set()
    if "rss_thread" in locals():rss_thread.join(timeout=3)
    server.shutdown()
    server.server_close()
record["validRssSampleCount"]=len(samples)
record["observedProcessSumRssKiB"]=round(max(samples)/1024) if samples else None
record["rssEvidenceStatus"]="SAMPLED_PROCESS_SUM_NOT_EXACT_PEAK" if samples else "NO_VALID_RSS_SAMPLES"
print(json.dumps(record,ensure_ascii=True))
# Only the smallest research baseline is a hard CI gate.
# Larger inputs may be OOM/timeout and MUST be recorded as blocked, NOT PASS.
if SIZE_MB == 16 and not record.get("ok"): raise SystemExit(1)
