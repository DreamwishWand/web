#!/usr/bin/env python3
"""01D private source-only v1.25.3 furniture candidate and missing-evidence manifest.

Reuses the existing pinned native protobuf reader. This NEVER mints public rows,
relabels R39 historical lossy WebP as lossless, or infers Switch pixels from Steam.
No original bytes or player Save are printed or written into a repository.
"""
from __future__ import annotations
import argparse
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import re
import stat

SCHEMA = "wand.01d.v1253-original-image-candidate-preflight@1"
DRAFT = "wand.01d.versioned-image-release-hold@1"
ORIGINAL_FULLVERSION = "releases_1.25-v1.25.3-44-g0b41250d9ac0-incremental-22"
FULLVERSION_BYTES = (ORIGINAL_FULLVERSION + "\n").encode("ascii")
FURNITURE_SHA256 = "823316081efe513c3920ff5a870fae03b68fa5f6ff6be2de0de5c5eb87aaa674"
FURNITURE_BYTES = 2458197
STEAM_ITEM_COUNT = 6233
MAX_SAMPLE = 10
ITEM_RE = re.compile(r"[1-9][0-9]{0,15}\Z")
TARGET_SWITCH = {
    "platform": "Nintendo Switch", "gameVersion": "1.25.3",
    "buildID": "9A239D3DB569756D", "schema": 626
}
IMAGE_VARIANT = "webp-lossless-160-v1"


def accepted_native_reader():
    """Import the existing 01D SHA-pinned parser, never write a parallel decoder."""
    path = Path(__file__).with_name("01d-steam-native-icon-delta.py")
    spec = importlib.util.spec_from_file_location("ddv_accepted_native_icon_reader", path)
    if spec is None or spec.loader is None:
        raise ValueError("ACCEPTED_NATIVE_READER_UNAVAILABLE")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def _checked_directory(path: Path, error: str) -> Path:
    """PR787/QA844 real-path fence, stricter: no '..' or symlink ancestor."""
    path = path.absolute()
    if ".." in path.parts or any(p.is_symlink() for p in (path, *path.parents)):
        raise ValueError(error)
    try:
        real = path.resolve(strict=True)
    except (OSError, RuntimeError):
        raise ValueError(error) from None
    if real != path or not real.is_dir():
        raise ValueError(error)
    return real


def _overlap(a: Path, b: Path) -> bool:
    return a == b or a in b.parents or b in a.parents


def _output_parent(root: Path, report: Path) -> Path:
    if ".." in report.parts or report.is_symlink() or report.exists():
        raise ValueError("REPORT_ALIAS_OR_EXISTS")
    parent = _checked_directory(report.parent, "REPORT_PARENT_UNSAFE")
    repo = Path(__file__).resolve().parents[2]
    if _overlap(root, parent) or _overlap(repo, parent):
        raise ValueError("REPORT_ALIAS_OR_EXISTS")
    # Also reject a different Git checkout, including a worktree .git file.
    if any((p / ".git").exists() or (p / ".git").is_symlink()
           for p in (parent, *parent.parents)):
        raise ValueError("REPORT_PARENT_UNSAFE")
    return parent


def _directory_fd(path: Path, error: str) -> int:
    """Walk every component without following symlinks; pin the directory.
    A platform without these primitives fails closed (no insecure fallback).
    """
    if (not hasattr(os, "O_NOFOLLOW") or not hasattr(os, "O_DIRECTORY")
            or os.open not in os.supports_dir_fd
            or os.stat not in os.supports_dir_fd):
        raise ValueError("PRIVATE_DIRECTORY_FD_UNSUPPORTED")
    flags = os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW
    fd = None
    try:
        fd = os.open(path.anchor, flags)
        for part in path.parts[1:]:
            if part in ("..", "."):
                raise ValueError(error)
            child = os.open(part, flags, dir_fd=fd)
            os.close(fd)
            fd = child
        return fd
    except (OSError, ValueError):
        if fd is not None:
            os.close(fd)
        raise ValueError(error) from None


def _same_directory(path: Path, fd: int, error: str):
    check = _directory_fd(path, error)
    try:
        a, b = os.fstat(fd), os.fstat(check)
        if (a.st_dev, a.st_ino) != (b.st_dev, b.st_ino):
            raise ValueError(error)
    finally:
        os.close(check)


def _read_regular(path: Path, max_size: int, *, dir_fd: int | None = None) -> bytes:
    if path.is_symlink() or not path.is_file():
        raise ValueError("ORIGINAL_MISSING_OR_SYMLINK")
    flags = os.O_RDONLY | getattr(os, "O_BINARY", 0) | getattr(os, "O_NOFOLLOW", 0)
    name = path.name if dir_fd is not None else path
    fd = os.open(name, flags, dir_fd=dir_fd)
    try:
        before = os.fstat(fd)
        if not stat.S_ISREG(before.st_mode) or before.st_size <= 0 or before.st_size > max_size:
            raise ValueError("ORIGINAL_TYPE_OR_SIZE_INVALID")
        data = bytearray()
        while len(data) < before.st_size:
            chunk = os.read(fd, min(1024 * 1024, before.st_size - len(data)))
            if not chunk:
                raise ValueError("ORIGINAL_TRUNCATED")
            data.extend(chunk)
        after = os.fstat(fd)
        if (before.st_dev, before.st_ino, before.st_size, before.st_mtime_ns) != (
            after.st_dev, after.st_ino, after.st_size, after.st_mtime_ns
        ):
            raise ValueError("ORIGINAL_CHANGED_DURING_READ")
        external = os.stat(name, dir_fd=dir_fd, follow_symlinks=False)
        if (external.st_dev, external.st_ino) != (before.st_dev, before.st_ino):
            raise ValueError("ORIGINAL_REPLACED")
        return bytes(data)
    finally:
        os.close(fd)


def _ids(values):
    if not 1 <= len(values) <= MAX_SAMPLE:
        raise ValueError("SAMPLE_COUNT_OUT_OF_BOUNDS")
    if any(not isinstance(v, str) or ITEM_RE.fullmatch(v) is None or int(v) >= 2**53 for v in values):
        raise ValueError("ITEM_ID_NONCANONICAL")
    if len(set(values)) != len(values):
        raise ValueError("DUPLICATE_ITEM_ID")
    return values


def assemble(rows: dict, ids: list[str], source_tier: str):
    """Always HOLD. Absence is distinct from unmatched icon/source pixel proof."""
    _ids(ids)
    samples = []
    for item_id in ids:
        row = rows.get(item_id)
        if row is None:
            samples.append({
                "itemId": item_id, "status": "MISSING_NATIVE_ITEM",
                "iconGuid": None, "spritePathID": None, "texturePathID": None,
                "sourcePngSha256": None, "losslessWebpSha256": None,
                "missing": ["ITEM_NOT_IN_PINNED_STEAM_FURNITURE_SOURCE"]
            })
            continue
        if row.get("category") != "Furniture" or re.fullmatch(r"guid:[0-9a-f]{32}", row.get("iconGuid", "")) is None:
            raise ValueError("NATIVE_ICON_ROW_MALFORMED")
        samples.append({
            "itemId": item_id, "status": "STEAM_ITEM_ICON_GUID_ONLY",
            "iconGuid": row["iconGuid"], "spritePathID": None,
            "texturePathID": None, "sourcePngSha256": None,
            "losslessWebpSha256": None,
            "missing": [
                "STEAM_ICON_GUID_TO_SPRITE_TEXTURE_UNVERIFIED",
                "STEAM_CURRENT_ORIGINAL_IMAGE_SHA_NOT_ATTESTED",
                "SWITCH_1253_ITEM_ID_ICON_PNG_SHA_VISIBILITY_UNVERIFIED",
                "LOSSLESS_WEBP_RGBA_EXACT_160_NOT_VERIFIED"
            ]
        })
    return {
        "schema": SCHEMA, "operation": "DEV_READY_SOURCE_ONLY",
        "sourceTier": source_tier, "privateSource": {
            "platform": "Steam/Windows", "gameVersion": "1.25.3",
            "fullVersion": ORIGINAL_FULLVERSION,
            "nativeCategory": "Furniture", "nativeOriginalSha256": FURNITURE_SHA256,
            "nativeOriginalSize": FURNITURE_BYTES,
            "actualRowsExpected": STEAM_ITEM_COUNT
        },
        "historicalR39": {
            "platform": "Nintendo Switch", "gameVersion": "1.24.13",
            "reuseOfLossyWebp88AsLossless": False, "sameVersionProof": False,
            "currentImagePngShaVerified": 0
        },
        "releaseManifestDraft": {
            "schema": DRAFT, "assetVariant": IMAGE_VARIANT,
            "target": TARGET_SWITCH, "items": {}, "publicUrl": None,
            "publicImagesEnabled": False, "reason": "NO_INDEPENDENT_SAME_BUILD_IMAGE_AND_RIGHTS_OPERATION_PROOF"
        },
        "rights": {
            "gameSource": "Disney Dreamlight Valley", "affiliation": "UNAFFILIATED",
            "license": "UNKNOWN", "ownerPublicationDecision": "ISSUE_604_APPROVED_DIRECTION",
            "rightsContactTest": "NOT_RUN", "perItemTakedownTest": "NOT_RUN",
            "cdnRevocationTest": "NOT_RUN"
        },
        "samples": samples,
        "counts": {
            "requested": len(ids),
            "steamNativePresent": sum(s["status"] == "STEAM_ITEM_ICON_GUID_ONLY" for s in samples),
            "currentSwitchImageVerified": 0, "publicImageRows": 0
        },
        "canPublishImage": False, "canEnableItemThumb": False,
        "canWriteSave": False, "cloudUploadAllowed": False
    }


def read_private_source(root: Path, *, root_fd: int | None = None):
    root = _checked_directory(root, "PRIVATE_ROOT_INVALID")
    if root_fd is None:
        fd = _directory_fd(root, "PRIVATE_ROOT_INVALID")
        try:
            return read_private_source(root, root_fd=fd)
        finally:
            os.close(fd)
    _same_directory(root, root_fd, "PRIVATE_ROOT_INVALID")
    raw = _read_regular(root / "Furniture.json", 4 * 1024 * 1024, dir_fd=root_fd)
    if (len(raw), hashlib.sha256(raw).hexdigest()) != (FURNITURE_BYTES, FURNITURE_SHA256):
        raise ValueError("ORIGINAL_FURNITURE_SHA_OR_SIZE_MISMATCH")
    full = _read_regular(root / "FullVersion.txt", 128, dir_fd=root_fd)
    if full != FULLVERSION_BYTES:
        raise ValueError("EXTERNAL_FULLVERSION_MISMATCH")
    rows = accepted_native_reader().read_category(raw, "Furniture")
    if len(rows) != STEAM_ITEM_COUNT:
        raise ValueError("NATIVE_ROW_COUNT_MISMATCH")
    return rows


def emit_private_report(root: Path, report: Path, ids):
    _ids(ids)
    root = _checked_directory(root, "PRIVATE_ROOT_INVALID")
    report = report.absolute()
    parent = _output_parent(root, report)
    root_fd = _directory_fd(root, "PRIVATE_ROOT_INVALID")
    try:
        parent_fd = _directory_fd(parent, "REPORT_PARENT_UNSAFE")
        try:
            a, b = os.fstat(root_fd), os.fstat(parent_fd)
            if (a.st_dev, a.st_ino) == (b.st_dev, b.st_ino):
                raise ValueError("REPORT_ALIAS_OR_EXISTS")
            rows = read_private_source(root, root_fd=root_fd)
            result = assemble(rows, ids, "OWNER_LOCAL_ORIGINAL_STEAM_SHA_VERIFIED")
            payload = (json.dumps(result, ensure_ascii=False, indent=2) + "\n").encode("utf-8")
            # Revalidate after reading; do not follow a replaced parent or root.
            _checked_directory(root, "PRIVATE_ROOT_INVALID")
            _output_parent(root, report)
            _same_directory(root, root_fd, "PRIVATE_ROOT_INVALID")
            _same_directory(parent, parent_fd, "REPORT_PARENT_UNSAFE")
            flags = os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW
            try:
                fd = os.open(report.name, flags, 0o600, dir_fd=parent_fd)
            except FileExistsError:
                raise ValueError("REPORT_ALIAS_OR_EXISTS") from None
            with os.fdopen(fd, "wb") as out:
                out.write(payload)
        finally:
            os.close(parent_fd)
    finally:
        os.close(root_fd)
    return {"schema": SCHEMA, "count": len(ids),
            "nativePresent": result["counts"]["steamNativePresent"],
            "publicImageRows": 0, "sourceTier": result["sourceTier"],
            "reportSha256": hashlib.sha256(payload).hexdigest()}


def self_test():
    fake = {"40000047": {"category": "Furniture", "iconGuid": "guid:" + "a" * 32}}
    held = assemble(fake, ["40000047", "40002422"], "SYNTHETIC_ONLY")
    assert held["counts"]["steamNativePresent"] == 1
    assert held["counts"]["publicImageRows"] == 0
    assert held["releaseManifestDraft"]["items"] == {}
    assert held["releaseManifestDraft"]["publicUrl"] is None
    assert held["rights"]["license"] == "UNKNOWN"
    assert held["samples"][0]["losslessWebpSha256"] is None
    assert held["samples"][1]["status"] == "MISSING_NATIVE_ITEM"
    for invalid in (["040000047"], ["__proto__"], ["40000047", "40000047"], [], ["40000047"] * 11):
        try:
            assemble(fake, invalid, "SYNTHETIC_ONLY")
        except ValueError:
            continue
        raise AssertionError("NEGATIVE_ITEM_ID_ACCEPTED")
    try:
        assemble({"40000047": {"category": "Furniture", "iconGuid": "guid:invalid"}}, ["40000047"], "SYNTHETIC_ONLY")
    except ValueError:
        pass
    else:
        raise AssertionError("FORGED_GUID_ACCEPTED")
    return {"schema": SCHEMA, "selfTest": "SYNTHETIC_ONLY_PASS",
            "checks": 13, "realGameBytesInCI": False, "publicImageRows": 0}


def main():
    p = argparse.ArgumentParser(description="01D owner-private v1253 source image preflight; never publishes assets")
    p.add_argument("--root", type=Path)
    p.add_argument("--report", type=Path)
    p.add_argument("--item-id", action="append", default=[])
    p.add_argument("--self-test", action="store_true")
    args = p.parse_args()
    if args.self_test:
        print(json.dumps(self_test(), sort_keys=True))
        return
    if args.root is None or args.report is None:
        raise ValueError("PRIVATE_SOURCE_AND_REPORT_REQUIRED")
    _ids(args.item_id)
    print(json.dumps(emit_private_report(args.root, args.report, args.item_id), sort_keys=True))


if __name__ == "__main__":
    main()
