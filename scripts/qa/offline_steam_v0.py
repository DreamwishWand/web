#!/usr/bin/env python3
"""Offline, read-only Steam Save ZIP V0 identity check (not P1G decoding).

No filesystem writes, uploads, or network. Output never contains filenames,
raw content, plaintext profile data, or identifying account paths.
"""
import argparse
import hashlib
import json
from pathlib import Path
import re
import stat
import sys
import zipfile

MAX_ENTRIES = 256
MAX_ENTRY = 256 * 1024 * 1024
MAX_TOTAL = 512 * 1024 * 1024
MAX_RATIO = 500
CHUNK = 1024 * 1024


def sha256_file(path):
    digest = hashlib.sha256()
    with open(path, "rb") as f:
        for block in iter(lambda: f.read(CHUNK), b""):
            digest.update(block)
    return digest.hexdigest()


def unsafe_name(name):
    """Reject POSIX/Windows absolute, traversal and ambiguous ZIP names."""
    norm = name.replace("\\", "/")
    segments = norm.split("/")
    return (not norm or norm.startswith("/") or re.match(r"^[a-zA-Z]:", norm) is not None
            or any(s in ("", ".", "..") for s in segments[:-1])
            or segments[-1] in ("", ".", "..") and not name.endswith("/")
            or "\x00" in name)


def audit(path):
    path = Path(path)
    report = {
        "schema": "ddvre.qa.steam-zip-v0@1",
        "mode": "OWNER_DEVICE_LOCAL_READ_ONLY",
        "v0": "REJECTED",
        "v1_save_structure": "NOT_RUN",
        "v2_edited_copy_reopen": "NOT_RUN",
        "v3_native_semantics": "UNKNOWN",
        "v4_device_runtime": "NOT_RUN",
        "game_version": "UNKNOWN",
        "external_build_id": "UNKNOWN",
        "profile_schema": "UNKNOWN",
        "product_writer": "OFF",
        "network_or_upload": False,
        "errors": [],
    }
    errors = report["errors"]
    try:
        if not path.is_file() or path.is_symlink():
            errors.append("SOURCE_NOT_REGULAR_FILE")
            return report
        report["outer_size_bytes"] = path.stat().st_size
        report["outer_sha256"] = sha256_file(path)
        with zipfile.ZipFile(path, allowZip64=True) as archive:
            entries = archive.infolist()
            report["entry_count"] = len(entries)
            report["total_declared_uncompressed_bytes"] = sum(x.file_size for x in entries)
            if len(entries) == 0 or len(entries) > MAX_ENTRIES:
                errors.append("ENTRY_COUNT_OUT_OF_BOUNDS")
            if any(unsafe_name(x.filename) for x in entries):
                errors.append("UNSAFE_ENTRY_PATH")
            names = [x.filename.casefold().replace("\\", "/") for x in entries]
            if len(set(names)) != len(names):
                errors.append("DUPLICATE_MEMBER_NAME")
            if any(x.flag_bits & 1 for x in entries):
                errors.append("ZIP_ENCRYPTION_UNSUPPORTED")
            if any(stat.S_IFMT(x.external_attr >> 16) == stat.S_IFLNK for x in entries):
                errors.append("SYMLINK_MEMBER_UNSUPPORTED")
            if any(x.file_size > MAX_ENTRY for x in entries) or report["total_declared_uncompressed_bytes"] > MAX_TOTAL:
                errors.append("UNCOMPRESSED_SIZE_LIMIT")
            if any(x.file_size > MAX_RATIO * max(x.compress_size, 1) for x in entries):
                errors.append("COMPRESSION_RATIO_LIMIT")
            if errors:
                return report
            largest = (0, "")
            actual_total = 0
            for member in entries:
                if member.is_dir():
                    continue
                digest = hashlib.sha256()
                read_total = 0
                with archive.open(member) as stream:
                    while True:
                        chunk = stream.read(CHUNK)
                        if not chunk:
                            break
                        read_total += len(chunk)
                        actual_total += len(chunk)
                        if read_total > MAX_ENTRY or actual_total > MAX_TOTAL:
                            errors.append("STREAM_SIZE_LIMIT")
                            return report
                        digest.update(chunk)
                if read_total != member.file_size:
                    errors.append("ZIP_MEMBER_SIZE_MISMATCH")
                    return report
                if read_total > largest[0]:
                    largest = (read_total, digest.hexdigest())
            report["largest_member_size_bytes"] = largest[0]
            report["largest_member_sha256"] = largest[1]
            report["v0"] = "ZIP_CONTAINER_VERIFIED_ONLY"
    except (OSError, ValueError, zipfile.BadZipFile, RuntimeError, EOFError):
        # Never include exception text: it may contain private member paths.
        errors.append("INVALID_ARCHIVE_OR_CRC")
    return report


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("zip_file", help="ZIP path on owner's own device; never uploaded")
    args = parser.parse_args(argv)
    result = audit(args.zip_file)
    print(json.dumps(result, ensure_ascii=False, sort_keys=True, indent=2))
    return 0 if result["v0"] == "ZIP_CONTAINER_VERIFIED_ONLY" else 2


if __name__ == "__main__":
    sys.exit(main())
