#!/usr/bin/env python3
"""04 QR-W changed-HEAD independent provenance trust-root differential QA.
No original Steam bundles, art, P1G, secrets or private save data.
"""
from __future__ import annotations
import hashlib
import importlib.util
import pathlib
import subprocess
import tempfile
from types import MappingProxyType

ROOT = pathlib.Path(__file__).resolve().parents[1]
SOURCE_HEAD = "264cc9396ca7793b44040382edae9c9faf290811"
PARENT = "1847a3b1c4f3c65151e64e9e6405c3b5c272a361"
SOURCE_BLOBS = {
    "docs/core/01d-steam-v1253-generated-icon-bundle-sha-20261106.md": "29be72106fb0e38e9ce79c8574d44c97d5513798",
    "scripts/asset-research/01d-steam-bundle-byte-identity.py": "6565bff3592c53727629ed22693a0706d5f1c2a1",
    "tests/01d-steam-bundle-byte-identity.test.mjs": "03fc4a0e850666b017dc9f9c9d775ccba7725ed7",
    "tests/01d-steam-bundle-byte-identity.test.py": "325592b937a46f506e1130ecea4b27573873a360",
}
QA_FILES = {
    ".github/workflows/04qr-w-pr650-fixed264-pins-differential.yml",
    "scripts/04qr-w-pr650-fixed264-pins-differential.py",
}
def git(*args):
    return subprocess.check_output(["git", *args], cwd=ROOT, text=True).strip()

assert git("merge-base", PARENT, SOURCE_HEAD) == PARENT
assert git("merge-base", SOURCE_HEAD, "HEAD") == SOURCE_HEAD
assert set(git("diff", "--name-only", PARENT, SOURCE_HEAD).splitlines()) == set(SOURCE_BLOBS)
assert set(git("diff", "--name-only", SOURCE_HEAD, "HEAD").splitlines()) == QA_FILES
for path, sha in SOURCE_BLOBS.items():
    assert git("rev-parse", SOURCE_HEAD + ":" + path) == sha, path
print("QR650_FIXED264_SOURCE4_GIT_BLOB_PIN_AND_QA2_DIFF_ONLY_PASS", flush=True)

path = ROOT / "scripts/asset-research/01d-steam-bundle-byte-identity.py"
spec = importlib.util.spec_from_file_location("steam_identity_fixed264", path)
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)
expected = {
    "flower_584a9f69.bundle": ("e7cbd3f2c08f13bcca84e58ec96cf519ef566cb2061c5ae6fe3d65a612b97770", 3784859),
    "seed_8c733f88.bundle": ("3650906d8318350dd35944ddbcf67f4616e11c37e544ab379a48faa059514e3f", 6372358),
    "meal_7a31d699.bundle": ("9770b0d4980da18332bf1870f7fdb0969cc88046d769e25316b0663cdf47ccf5", 24835033),
}
assert isinstance(mod.BUNDLE_PINS, MappingProxyType)
assert dict(mod.BUNDLE_PINS) == expected
assert mod.VERSIONS == ("v1250", "v1253")
before_pin = dict(mod.BUNDLE_PINS)
try:
    mod.BUNDLE_PINS["flower_584a9f69.bundle"] = ("0" * 64, 0)
except TypeError:
    pass
else:
    raise AssertionError("QR650_FIXED264_TRUE_RED_IMMUTABLE_PIN_MODIFIED")
assert dict(mod.BUNDLE_PINS) == before_pin
print("QR650_FIXED264_CANONICAL_SOURCE_PINS_IMMUTABLE_PASS", flush=True)

def must_deny(reason, callback):
    try:
        callback()
    except ValueError as error:
        assert reason in str(error), (reason, str(error))
    else:
        raise AssertionError("QR650_FIXED264_TRUE_RED_NO_DENIAL: " + reason)

with tempfile.TemporaryDirectory(prefix="wand-04qrw-fixed264-toy-") as temp:
    root = pathlib.Path(temp)
    fake_pins = {}
    immutable_source_shas = {}
    for version in mod.VERSIONS:
        base = root / version
        base.mkdir()
        for name in expected:
            fake = (b"04QRW_SYNTHETIC_NOT_ORIGINAL_" + name.encode("ascii")) * 3
            target = base / name
            target.write_bytes(fake)
            fake_pins[name] = (hashlib.sha256(fake).hexdigest(), len(fake))
            immutable_source_shas[target] = hashlib.sha256(fake).hexdigest()
    # Exact former QA653 exploit must fail with the source's new trust root.
    must_deny("ORIGINAL_PIN_OVERRIDE_FORBIDDEN",
              lambda: mod.analyze(root, fake_pins, synthetic=False))
    # Copying authentic constants to an untrusted caller-controlled dict is not
    # allowed to substitute the immutable provenance object either.
    must_deny("ORIGINAL_PIN_OVERRIDE_FORBIDDEN",
              lambda: mod.analyze(root, dict(mod.BUNDLE_PINS), synthetic=False))
    must_deny("ORIGINAL_PIN_OVERRIDE_FORBIDDEN",
              lambda: mod.analyze(root, {}, synthetic=False))
    # Default authentic SHA pins must refuse synthetic originals.
    must_deny("ORIGINAL_BUNDLE_PIN_MISMATCH",
              lambda: mod.analyze(root, synthetic=False))
    print("QR650_FIXED264_FORGED_MATCHING_SHA_REAL_SOURCE_MINT_DENIED_PASS", flush=True)

    synthetic = mod.analyze(root, fake_pins, synthetic=True)
    assert synthetic["tier"] == "SYNTHETIC_ONLY"
    assert synthetic["comparedBundles"] == synthetic["identicalBundles"] == 3
    assert all(p["reuseSourceBundleCandidate"] for p in synthetic["bundles"])
    for boolean in ("publishAllowed", "nativeSaveWriterAllowed",
                    "allOtherBundlesChecked", "itemIdToTextureAddressVerified"):
        assert synthetic[boolean] is False, boolean
    assert synthetic["switchSameBuildOriginalPngShaVerified"] == 0
    # Change one byte, preserve length: synthetic candidate must drop, never
    # upgrade to image identity or true original evidence.
    changed = root / "v1253" / "flower_584a9f69.bundle"
    content = changed.read_bytes()
    changed.write_bytes(content[:-1] + bytes([content[-1] ^ 1]))
    diff = mod.analyze(root, fake_pins, synthetic=True)
    assert diff["tier"] == "SYNTHETIC_ONLY"
    assert diff["identicalBundles"] == 2
    assert next(x for x in diff["bundles"] if x["bundleName"] == changed.name)["reuseSourceBundleCandidate"] is False
    must_deny("ORIGINAL_PIN_OVERRIDE_FORBIDDEN",
              lambda: mod.analyze(root, fake_pins, synthetic=False))
    for item, digest in immutable_source_shas.items():
        if item == changed:
            assert item.stat().st_size == len(content)
        else:
            assert hashlib.sha256(item.read_bytes()).hexdigest() == digest
    print("QR650_FIXED264_SYNTHETIC_ONLY_AND_SAME_SIZE_BYTE_DELTA_PASS", flush=True)

print("QR650_FIXED264_INDEPENDENT_DIFFERENTIAL_SCOPE_PASS", flush=True)
