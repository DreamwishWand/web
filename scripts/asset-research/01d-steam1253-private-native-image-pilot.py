#!/usr/bin/env python3
"""01D R14 owner-private Steam1253 ItemID→GUID→Sprite/Texture→encoded SHA pilot.

No new Native item decoder. No original image or personal Save is ever emitted
to GitHub/CI/Pages. All products are private-local and publication remains OFF.
"""
from __future__ import annotations

import argparse
import bisect
from functools import lru_cache
import hashlib
import importlib.util
import io
import json
import os
from pathlib import Path
import re
import stat
import struct
import sys

OPERATION = "DEV_READY_SOURCE_ONLY"
SCHEMA = "wand.01d.steam1253-native-image-sample-hold@1"
VERSION = "releases_1.25-v1.25.3-44-g0b41250d9ac0-incremental-22\n"
PINS = {
    "Furniture.json": ("823316081efe513c3920ff5a870fae03b68fa5f6ff6be2de0de5c5eb87aaa674", 2458197),
    "furniture_a1c425a5.bundle": ("9fbf4b75e50bd08b7479e4dc372ca0568254051c64872b66ba9332ecf139cdb0", 249369620),
    "catalog.keyData.bin": ("cef9d3431ca327b560ed30e045a908615c31d7628c3d8c83acd85c69b8aded1a", 6933348),
    "catalog.bucketData.bin": ("c8a4b215b07988e988b34085f77e4d616ca7f5b0cc13bee13763e36c0ebdf4e6", 6112796),
    "catalog.entryData.bin": ("807fd38db08a107dada03cc207a1eecc5c41bc157b060091377fefce577d1619", 5911056),
    "catalog.InternalIds.bin": ("1822422bcf53e31b2b5653d28b36059bf591ec163a5721a8eecd630e4f8ec5ad", 7335899),
}
ITEMS = {
    "40000047": "26d1b07fac5a07a4ebea467b962fb6a4",
    "40002422": "094a2e721b66fc44cb13be2d368a3c38",
    "40006096": "b569dad82cd3de74397780d1fa7be96a",
}
U32 = lambda d, o: struct.unpack_from("<I", d, o)[0]
I32 = lambda d, o: struct.unpack_from("<i", d, o)[0]
I64 = lambda d, o: struct.unpack_from("<q", d, o)[0]
BE32 = lambda d, o: struct.unpack_from(">I", d, o)[0]
BE64 = lambda d, o: struct.unpack_from(">Q", d, o)[0]


def check_sample_ids(ids):
    if not ids or len(ids) > len(ITEMS) or len(set(ids)) != len(ids):
        raise ValueError("SAMPLE_DUPLICATE_EMPTY_OR_OVERSIZED")
    if any(not isinstance(i, str) or not re.fullmatch("[1-9][0-9]{0,15}", i) or i not in ITEMS for i in ids):
        raise ValueError("SAMPLE_NOT_FIRST_PARTY_ALLOWLIST")
    return ids


def source_fd(path: Path, size: int):
    if path.is_symlink() or not path.is_file():
        raise ValueError("ORIGINAL_MISSING_OR_SYMLINK")
    fd = os.open(path, os.O_RDONLY | getattr(os, "O_NOFOLLOW", 0))
    st = os.fstat(fd)
    if not stat.S_ISREG(st.st_mode) or st.st_size != size or os.stat(path, follow_symlinks=False).st_ino != st.st_ino:
        os.close(fd)
        raise ValueError("ORIGINAL_TYPE_OR_SIZE_OR_ALIAS")
    return fd, st


def exact_sha(path: Path, pin):
    fd, st = source_fd(path, pin[1])
    try:
        h = hashlib.sha256()
        while True:
            chunk = os.read(fd, 1024 * 1024)
            if not chunk:
                break
            h.update(chunk)
        after = os.fstat(fd)
        if (st.st_dev, st.st_ino, st.st_size, st.st_mtime_ns) != (
            after.st_dev, after.st_ino, after.st_size, after.st_mtime_ns
        ) or h.hexdigest() != pin[0]:
            raise ValueError("ORIGINAL_SHA_OR_MUTATION_MISMATCH")
    finally:
        os.close(fd)


def accepted_furniture_rows(path):
    spec = importlib.util.spec_from_file_location(
        "ddv_accepted_reader", Path(__file__).with_name("01d-steam-native-icon-delta.py")
    )
    if spec is None or spec.loader is None:
        raise ValueError("ACCEPTED_READER_MISSING")
    module = importlib.util.module_from_spec(spec)
    previous = sys.dont_write_bytecode
    try:
        sys.dont_write_bytecode = True
        spec.loader.exec_module(module)
    finally:
        sys.dont_write_bytecode = previous
    data = path.read_bytes()
    rows = module.read_category(data, "Furniture")
    if len(rows) != 6233:
        raise ValueError("EXPECTED_NATIVE_ROWS_MISMATCH")
    for item, guid in ITEMS.items():
        if rows.get(item, {}).get("iconGuid") != "guid:" + guid:
            raise ValueError("SOURCE_ITEM_ICON_GUID_MISMATCH")
    return rows


def resolve_catalog(catalog: Path):
    key = (catalog / "catalog.keyData.bin").read_bytes()
    bucket = (catalog / "catalog.bucketData.bin").read_bytes()
    entry = (catalog / "catalog.entryData.bin").read_bytes()
    ids = (catalog / "catalog.InternalIds.bin").read_text("utf8").splitlines()
    if BE32(b"\0\0\0\0", 0) != 0 or U32(bucket, 0) != 177766 or U32(entry, 0) != 211109:
        raise ValueError("CATALOG_HEADER_INVALID")
    if len(entry) != 4 + U32(entry, 0) * 28 or len(ids) != 164284:
        raise ValueError("CATALOG_LENGTH_INVALID")
    targets = {}
    for item, guid in ITEMS.items():
        at = key.find(guid.encode("ascii"))
        if at < 5 or key.find(guid.encode("ascii"), at + 1) != -1 or key[at - 5] != 0 or U32(key, at - 4) != 32:
            raise ValueError("CATALOG_GUID_KEY_NOT_UNIQUE")
        targets[at - 5] = item
    found = {}
    pos = 4
    for b in range(U32(bucket, 0)):
        if pos + 8 > len(bucket):
            raise ValueError("CATALOG_BUCKET_TRUNCATED")
        offset, num = struct.unpack_from("<II", bucket, pos)
        if num > (len(bucket) - pos - 8) // 4:
            raise ValueError("CATALOG_BUCKET_OOB")
        if offset in targets:
            indices = [U32(bucket, pos + 8 + i * 4) for i in range(num)]
            if len(indices) != 2 or len(set(indices)) != 2:
                raise ValueError("CATALOG_ICON_TWO_TYPES_REQUIRED")
            found[targets[offset]] = indices
        pos += 8 + 4 * num
    if pos != len(bucket) or set(found) != set(ITEMS):
        raise ValueError("CATALOG_BUCKET_COUNT_OR_ITEMS_MISMATCH")
    for item, indices in found.items():
        types = set()
        for i in indices:
            if i >= U32(entry, 0):
                raise ValueError("CATALOG_ENTRY_OOB")
            internal, provider, dependency, _hash, _extra, _primary, cls = struct.unpack_from("<7I", entry, 4 + 28 * i)
            if not (internal < len(ids) and provider == 1 and cls in (4, 5) and ids[internal] == ITEMS[item]):
                raise ValueError("CATALOG_ENTRY_WRONG_GUID_OR_TYPE")
            # ContentCatalogData resourceType 4 Texture2D, 5 Sprite.
            if dependency != 17992:
                raise ValueError("CATALOG_WRONG_DEPENDENCY")
            types.add(cls)
        if types != {4, 5}:
            raise ValueError("CATALOG_SPRITE_TEXTURE_MISSING")
    if b"ui-images-generatedicons_assets_assets\\furniture_a1c425a5.bundle" not in (
        catalog / "catalog.InternalIds.bin"
    ).read_bytes():
        raise ValueError("CATALOG_DEPENDENT_BUNDLE_MISSING")
    return found


class UnityFS:
    def __init__(self, filename):
        import lz4.block
        self._lz4 = lz4.block
        self.f = open(filename, "rb")
        header = self.f.read(64)
        if header[:8] != b"UnityFS\0" or BE32(header, 8) != 8:
            raise ValueError("UNITYFS_HEADER_OR_VERSION")
        compressed, unpacked, flags = struct.unpack_from(">III", header, 38)
        if BE64(header, 30) != PINS["furniture_a1c425a5.bundle"][1] or flags != 0x243 or unpacked > 1024 * 1024:
            raise ValueError("UNITYFS_SIZE_FLAGS_INFO")
        self.f.seek(64)
        info = self._lz4.decompress(self.f.read(compressed), uncompressed_size=unpacked)
        count = BE32(info, 16)
        if count != 6158:
            raise ValueError("UNITYFS_BLOCK_COUNT")
        self.blocks = []
        self.edges = [0]
        coff = (64 + compressed + 15) & ~15
        pos = 20
        for _ in range(count):
            rawlen, clen, bf = struct.unpack_from(">IIH", info, pos)
            pos += 10
            if rawlen > 1024 * 1024 or clen > 1024 * 1024 or bf & 0x3f not in (0, 3):
                raise ValueError("UNITYFS_BLOCK_BOUNDS")
            self.blocks.append((coff, clen, rawlen, bf))
            coff += clen
            self.edges.append(self.edges[-1] + rawlen)
        num_nodes = BE32(info, pos)
        pos += 4
        if num_nodes != 2:
            raise ValueError("UNITYFS_NODES_NOT_TWO")
        self.nodes = []
        for _ in range(num_nodes):
            off, size, flags = struct.unpack_from(">QQI", info, pos)
            pos += 20
            e = info.index(0, pos)
            name = info[pos:e].decode("ascii")
            pos = e + 1
            self.nodes.append((off, size, flags, name))
        if pos != len(info) or coff != PINS["furniture_a1c425a5.bundle"][1] or (
            self.nodes[0][0], self.nodes[0][1], self.nodes[1][0], self.nodes[1][1]
        ) != (0, 7989552, 7989552, 799025968):
            raise ValueError("UNITYFS_NODES_OR_TAIL_INVALID")

    @lru_cache(maxsize=16)
    def block(self, idx):
        off, comp, rawsize, flags = self.blocks[idx]
        self.f.seek(off)
        raw = self.f.read(comp)
        d = self._lz4.decompress(raw, uncompressed_size=rawsize) if flags & 0x3f == 3 else raw
        if len(d) != rawsize:
            raise ValueError("UNITYFS_DECOMPRESSION_BOUNDS")
        return d

    def read(self, offset, size):
        if offset < 0 or size < 0 or offset + size > self.edges[-1] or size > 16 * 1024 * 1024:
            raise ValueError("UNITYFS_VIRTUAL_READ_BOUNDS")
        output = bytearray()
        while size:
            i = bisect.bisect_right(self.edges, offset) - 1
            block = self.block(i)
            part = block[offset - self.edges[i]:][:size]
            if not part:
                raise ValueError("UNITYFS_EMPTY_BLOCK")
            output += part
            offset += len(part)
            size -= len(part)
        return bytes(output)


def cab_objects(cab):
    if BE32(cab, 8) != 22 or BE64(cab, 24) != len(cab) or BE64(cab, 32) != 214336:
        raise ValueError("CAB_SERIALIZED_HEADER_INVALID")
    if cab[48:60] != b"6000.0.62f1\0" or cab[64] != 0 or I32(cab, 65) != 3:
        raise ValueError("CAB_TYPE_LAYOUT_INVALID")
    classes = [I32(cab, 69 + n * 23) for n in range(3)]
    if classes != [213, 28, 142] or I32(cab, 138) != 8924:
        raise ValueError("CAB_NATIVE_TYPES_INVALID")
    objects = {}
    pos = 144
    counts = {213: 0, 28: 0, 142: 0}
    for _ in range(8924):
        pid, offset, length, typ = struct.unpack_from("<qQIi", cab, pos)
        pos += 24
        if typ not in range(3) or offset + length > len(cab) - 214336 or pid in objects:
            raise ValueError("CAB_PATHID_OR_OBJECT_OOB")
        cls = classes[typ]
        counts[cls] += 1
        objects[pid] = (cls, 214336 + offset, length)
    if counts != {213: 4459, 28: 4464, 142: 1}:
        raise ValueError("CAB_OBJECT_COUNT_CHANGED")
    return objects


def resolve_asset(cab, objects, guid):
    bundle = [(pid, p, n) for pid, (cls, p, n) in objects.items() if cls == 142]
    if len(bundle) != 1:
        raise ValueError("CAB_ASSETBUNDLE_COUNT")
    _, start, size = bundle[0]
    prefix = struct.pack("<I", 32) + guid.encode("ascii")
    positions = []
    cursor = start
    while True:
        at = cab.find(prefix, cursor, start + size)
        if at < 0:
            break
        if at + len(prefix) + 20 > start + size:
            raise ValueError("ASSETBUNDLE_PPTR_TRUNCATED")
        preload, count, file_id = struct.unpack_from("<III", cab, at + 36)
        pid = I64(cab, at + 48)
        if count != 2 or file_id != 0 or pid not in objects:
            raise ValueError("ASSETBUNDLE_GUID_PPTR_INVALID")
        positions.append((pid, *objects[pid]))
        cursor = at + len(prefix)
    if len(positions) != 2 or {t[1] for t in positions} != {28, 213}:
        raise ValueError("GUID_SPRITE_AND_TEXTURE_NOT_UNIQUE")
    return positions


def parse_texture(cab, objects, entries, unity):
    texture = next((x for x in entries if x[1] == 28), None)
    sprite = next((x for x in entries if x[1] == 213), None)
    assert texture is not None and sprite is not None
    tid, _, tpos, tlen = texture
    sid, _, spos, slen = sprite
    raw = cab[tpos:tpos + tlen]
    sraw = cab[spos:spos + slen]
    n = U32(raw, 0)
    name = raw[4:4 + n].decode("utf8")
    if not 1 <= n <= 128 or U32(sraw, 0) != n or sraw[4:4 + n] != raw[4:4 + n]:
        raise ValueError("SPRITE_TEXTURE_NAME_MISMATCH")
    after = (4 + n + 3) & ~3
    w, h = struct.unpack_from("<II", raw, after + 4)
    fmt = U32(raw, after + 20)
    rect = struct.unpack_from("<4f", sraw, after)
    if (w, h) != (512, 512) or fmt not in (12, 25) or rect != (0., 0., 512., 512.):
        raise ValueError("TEXTURE_FORMAT_OR_SPRITE_RECT_UNSUPPORTED")
    at = raw.find(b"archive:/CAB-")
    if at < 16 or U32(raw, at - 4) != 87 or at + 87 > len(raw):
        raise ValueError("TEXTURE_STREAMING_PATH_INVALID")
    ref = raw[at:at + 87].decode("ascii")
    if not ref.endswith(unity.nodes[1][3]):
        raise ValueError("TEXTURE_RES_SOURCE_NOT_OWN_BUNDLE")
    offset = struct.unpack_from("<Q", raw, at - 16)[0]
    length = U32(raw, at - 8)
    if length != w * h or offset + length > unity.nodes[1][1]:
        raise ValueError("TEXTURE_STREAMING_SIZE_BOUNDS")
    return {
        "name": name, "texturePathID": tid, "spritePathID": sid,
        "textureFormat": fmt, "width": w, "height": h,
        "streamOffset": offset, "streamBytes": length,
        "encoded": unity.read(unity.nodes[1][0] + offset, length),
    }


def self_test():
    assert check_sample_ids(["40000047", "40002422", "40006096"])
    negatives = ([], ["40000047", "40000047"], ["40000047"] * 4,
                 ["__proto__"], ["040000047"], ["40000048"], ["0"])
    for bad in negatives:
        try:
            check_sample_ids(bad)
        except ValueError:
            pass
        else:
            raise AssertionError("FALSE_ALLOWLIST_PASS")
    assert all(len(v) == 32 for v in ITEMS.values())
    return {"operation": OPERATION, "testTier": "SYNTHETIC_ONLY",
            "positive": 1, "negative": len(negatives), "publicImageRows": 0,
            "realMediaBytesInCI": False}


def save_exclusive(path, data):
    """Legacy arbitrary-path writer is disabled, even for a validated hint."""
    raise ValueError("PRIVATE_IMAGE_PATH_WRITE_DISABLED")


def private_path_preflight(source_root: Path, catalog_root: Path, bundle_path: Path, private_output: Path | None = None):
    """Read-only path validation. Optional legacy output is a hint, never a sink.

    This does not claim immutable containment for subsequent path writes.
    """
    raw = tuple(p.absolute() for p in (source_root, catalog_root, bundle_path))
    if private_output is not None:
        raw += (private_output.absolute(),)
    resolved = []
    repo = Path(__file__).resolve().parents[2]
    for index, candidate in enumerate(raw):
        is_file = index == 2
        if ".." in candidate.parts or any(part.is_symlink() for part in (candidate, *candidate.parents)):
            raise ValueError("PRIVATE_PATH_SYMLINK_OR_ALIAS")
        try:
            real = candidate.resolve(strict=True)
        except (OSError, RuntimeError):
            raise ValueError("PRIVATE_PATH_MISSING_OR_ALIAS") from None
        if real != candidate:
            raise ValueError("PRIVATE_PATH_SYMLINK_OR_ALIAS")
        if real == repo or repo in real.parents or real in repo.parents:
            raise ValueError("PRIVATE_PATH_INSIDE_REPOSITORY")
        if any((p / ".git").exists() or (p / ".git").is_symlink()
               for p in ((real.parent if is_file else real), *real.parents)):
            raise ValueError("PRIVATE_PATH_INSIDE_REPOSITORY")
        if is_file:
            if not real.is_file():
                raise ValueError("PRIVATE_BUNDLE_SYMLINK_OR_MISSING")
        elif not real.is_dir():
            raise ValueError("PRIVATE_DIRECTORY_MISSING_OR_SYMLINK")
        resolved.append(real)
    root, catalog, bundle = resolved[:3]
    target = resolved[3] if private_output is not None else None
    if root == catalog:
        raise ValueError("PRIVATE_INPUT_ROOT_DUPLICATE_OR_ALIAS")
    if target is not None:
        for input_dir in (root, catalog, bundle.parent):
            if (target == input_dir or input_dir in target.parents
                    or target in input_dir.parents):
                raise ValueError("PRIVATE_OUTPUT_MUST_BE_SEPARATE")
    return root, catalog, bundle, target


def decode_products(bundle, ids):
    """Existing exact Native decode and raster invariants; memory only."""
    from PIL import Image  # PRIVATE ONLY; imported after PINNED provenance; CI negatives need no Pillow
    unity = UnityFS(bundle)
    cab = unity.read(0, unity.nodes[0][1])
    objects = cab_objects(cab)
    products = []
    for item in ids:
        guid = ITEMS[item]
        entries = resolve_asset(cab, objects, guid)
        data = parse_texture(cab, objects, entries, unity)
        encoded = data.pop("encoded")
        bcn = {12: 3, 25: 7}[data["textureFormat"]]
        rgba = Image.frombytes("RGBA", (data["width"], data["height"]), encoded, "bcn", bcn)
        rgba = rgba.transpose(Image.Transpose.FLIP_TOP_BOTTOM)
        png = io.BytesIO()
        rgba.save(png, "PNG")
        display = rgba.copy()
        display.thumbnail((160, 160), Image.Resampling.LANCZOS)
        webp = io.BytesIO()
        display.save(webp, "WEBP", lossless=True, exact=True, method=6)
        confirmed = Image.open(io.BytesIO(webp.getvalue())).convert("RGBA")
        if confirmed.size != display.size or confirmed.tobytes() != display.tobytes():
            raise ValueError("WEBP_RGBA_NOT_LOSSLESS")
        products.append((
            {"itemId": item, "nativeIconGuid": "guid:" + guid,
             "catalogEntryTypes": [4, 5], "catalogDependency": "furniture_a1c425a5.bundle",
             "texturePathID": data["texturePathID"], "spritePathID": data["spritePathID"],
             "nativeObjectName": data["name"], "textureFormat": data["textureFormat"],
             "nativeCompressedStreamSha256": hashlib.sha256(encoded).hexdigest(),
             "steamReconstructedPngSha256": hashlib.sha256(png.getvalue()).hexdigest(),
             "steamLossless160WebpSha256": hashlib.sha256(webp.getvalue()).hexdigest(),
             "webpRgbaExact": True, "originalSteamPngSha256": None,
             "switch1253OriginalPngSha256": None, "visualQA": "HOLD_NEEDS_INDEPENDENT_IMAGE_DIFF",
             "canPublish": False},
            png.getvalue(), webp.getvalue()
        ))
    return products


def run(args):
    # No provenance file read before path validation; never write a file.
    root, catalog, bundle, _ = private_path_preflight(
        args.source_root, args.catalog_root, args.bundle, getattr(args, "private_output", None)
    )
    for name in ("Furniture.json",):
        exact_sha(root / name, PINS[name])
    if (root / "FullVersion.txt").read_bytes() != VERSION.encode("ascii"):
        raise ValueError("EXTERNAL_STEAM_FULLVERSION_MISMATCH")
    for name in ("catalog.keyData.bin", "catalog.bucketData.bin", "catalog.entryData.bin", "catalog.InternalIds.bin"):
        exact_sha(catalog / name, PINS[name])
    exact_sha(bundle, PINS["furniture_a1c425a5.bundle"])
    accepted_furniture_rows(root / "Furniture.json")
    resolve_catalog(catalog)
    products = decode_products(bundle, check_sample_ids(args.item_id))
    # Complete private data stays in memory; no caller path is opened for
    # writing and failure cannot unlink an unrelated file.
    record = {
        "schema": SCHEMA, "operation": OPERATION, "source": {
            "platform": "Steam/Windows", "gameVersion": "1.25.3",
            "fullVersion": VERSION.strip(), "originalBundleSha256": PINS["furniture_a1c425a5.bundle"][0],
            "privateOriginal": True
        },
        "rights": {"origin": "Disney Dreamlight Valley", "affiliation": "UNAFFILIATED",
                   "license": "UNKNOWN", "perImageTakedown": "NOT_RUN", "hostedHttps": "NOT_RUN"},
        "historicalR39LossyWebpNotReused": True,
        "nativeSamples": [x for x, _, _ in products],
        "releaseManifestDraft": {"items": {}, "publicUrl": None, "schema": "HOLD_SOURCE_ONLY",
                                 "publicImagesEnabled": False},
        "currentSwitchSameBuildSourcePositive": 0, "canPublish": False,
        "canWriteSave": False, "cloudUploadAllowed": False
    }
    return {"record": record, "products": tuple(products)}


def report_summary(result):
    record = result["record"]
    products = result["products"]
    payload = (json.dumps(record, ensure_ascii=False, indent=2, sort_keys=True) + "\n").encode()
    # A summary of caller-supplied memory is not itself a verification witness.
    return {"sourceOriginal": "NOT_ATTESTED_BY_SUMMARY", "items": len(products),
            "webpRgbaExact": sum(x.get("webpRgbaExact") is True for x, _, _ in products), "publicImages": 0,
            "privateFilesWritten": False,
            "receiptSha256": hashlib.sha256(payload).hexdigest()}


def main():
    p = argparse.ArgumentParser(description="Owner-private exact-three Native icon sample, no release")
    p.add_argument("--self-test", action="store_true")
    p.add_argument("--source-root", type=Path)
    p.add_argument("--catalog-root", type=Path)
    p.add_argument("--bundle", type=Path)
    p.add_argument("--private-output", type=Path)
    p.add_argument("--item-id", action="append", default=[])
    a = p.parse_args()
    if a.self_test:
        print(json.dumps(self_test(), sort_keys=True))
        return
    if any(x is None for x in (a.source_root, a.catalog_root, a.bundle)):
        raise ValueError("PRIVATE_SOURCE_ROOT_CATALOG_BUNDLE_REQUIRED")
    a.item_id = a.item_id or list(ITEMS)
    result = run(a)
    summary = report_summary(result)
    # Only the completed real CLI verification path emits the historical label.
    summary["sourceOriginal"] = "STEAM1253_SHA_VERIFIED"
    print(json.dumps(summary, sort_keys=True))


if __name__ == "__main__":
    main()
