#!/usr/bin/env python3
"""Offline Steam 1.25 furniture Bundle *byte* delta, never Texture2D or released art proof.

Reads the two owner-supplied originals in fixed-size chunks without loading either
bundle wholesale. No input is modified; no untrusted SHA can mint source provenance.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
from pathlib import Path
from types import MappingProxyType

BUNDLE = 'furniture_a1c425a5.bundle'
VERSIONS = ('v1250', 'v1253')
# Private Drive metadata observed in owner original release folders, NOT byte SHA.
SOURCE_SIZES = MappingProxyType({'v1250': 249376337, 'v1253': 249369620})
SOURCE_VERSIONS = MappingProxyType({
    'v1250': 'releases_1.25-v1.25.0-8687-gdd3d3a5ae738-incremental-14',
    'v1253': 'releases_1.25-v1.25.3-44-g0b41250d9ac0-incremental-22',
})
CHUNK = 1024 * 1024
MAX_SOURCE_BYTES = 300 * 1024 * 1024
SCHEMA = 'wand.01d.steam-furniture-stream-delta-source-only@1'


def _open_regular_source(path: Path, expected_size: int):
    if not path.is_file() or path.is_symlink():
        raise ValueError('MISSING_OR_SYMLINK_ORIGINAL')
    flags = os.O_RDONLY | getattr(os, 'O_BINARY', 0)
    if hasattr(os, 'O_NOFOLLOW'):
        flags |= os.O_NOFOLLOW
    fd = os.open(path, flags)
    try:
        before = os.fstat(fd)
        if not (0 < expected_size <= MAX_SOURCE_BYTES and before.st_size == expected_size):
            raise ValueError('ORIGINAL_SIZE_MISMATCH')
        if not __import__('stat').S_ISREG(before.st_mode):
            raise ValueError('ORIGINAL_NOT_REGULAR')
        if path.stat().st_ino != before.st_ino or path.stat().st_dev != before.st_dev:
            raise ValueError('ORIGINAL_SOURCE_REPLACED')
        return os.fdopen(fd, 'rb', buffering=0), before
    except BaseException:
        os.close(fd)
        raise


def analyze(root: Path, sizes=SOURCE_SIZES, *, synthetic=False):
    # Imported callers cannot self-sign fake files by overriding release size pins.
    if not synthetic and sizes is not SOURCE_SIZES:
        raise ValueError('ORIGINAL_SIZE_OVERRIDE_FORBIDDEN')
    if set(sizes) != set(VERSIONS):
        raise ValueError('INVALID_VERSION_SET')
    root = Path(root).absolute()
    if root.is_symlink() or not root.is_dir():
        raise ValueError('ORIGINAL_ROOT_INVALID')
    paths = []
    for version in VERSIONS:
        directory = root / version
        path = directory / BUNDLE
        if directory.is_symlink() or not directory.is_dir() or path.is_symlink():
            raise ValueError('ORIGINAL_SOURCE_PATH_INVALID')
        if not path.resolve().is_relative_to(root.resolve()):
            raise ValueError('ORIGINAL_OUTSIDE_ROOT')
        paths.append(path)
    from contextlib import ExitStack
    with ExitStack() as stack:
        files = []
        stats = []
        for i, path in enumerate(paths):
            file, before = _open_regular_source(path, sizes[VERSIONS[i]])
            files.append(stack.enter_context(file))
            stats.append(before)
        hashes = [hashlib.sha256(), hashlib.sha256()]
        bytes_read = [0, 0]
        differing_chunks = 0
        sampled = []
        chunks = 0
        while True:
            blocks = [f.read(CHUNK) for f in files]
            if not any(blocks):
                break
            if blocks[0] != blocks[1]:
                differing_chunks += 1
                if len(sampled) < 12:
                    sampled.append(chunks)
            for i, block in enumerate(blocks):
                hashes[i].update(block)
                bytes_read[i] += len(block)
                if bytes_read[i] > sizes[VERSIONS[i]]:
                    raise ValueError('SOURCE_GREW_DURING_READ')
            chunks += 1
        for i, file in enumerate(files):
            after = os.fstat(file.fileno())
            before = stats[i]
            if (after.st_ino, after.st_dev, after.st_size, after.st_mtime_ns, after.st_ctime_ns) != (
                before.st_ino, before.st_dev, before.st_size, before.st_mtime_ns, before.st_ctime_ns
            ) or bytes_read[i] != sizes[VERSIONS[i]]:
                raise ValueError('ORIGINAL_CHANGED_DURING_READ')
    return {
        'schema': SCHEMA,
        'sourcePlatform': 'Steam/Windows',
        'fullVersions': dict(SOURCE_VERSIONS),
        'bundleName': BUNDLE,
        'tier': 'SYNTHETIC_ONLY' if synthetic else 'LOCAL_SOURCE_BYTES_UNATTESTED',
        'versionEvidence': 'OWNER_ORIGINAL_FOLDER_METADATA_SIZE_ONLY',
        'sizePinnedNotShaPinned': True,
        'hashesAreNewLocalObservationsNotIndependentProvenance': True,
        'sizes': dict(sizes),
        'sha256': dict(zip(VERSIONS, (h.hexdigest() for h in hashes))),
        'bytesRead': dict(zip(VERSIONS, bytes_read)),
        'byteIdentical': hashes[0].digest() == hashes[1].digest() and bytes_read[0] == bytes_read[1],
        'differingAlignedChunks': differing_chunks,
        'alignedChunkBytes': CHUNK,
        'firstDifferingAlignedChunkIndices': sampled,
        'differingChunkCountIsNotChangedTextureCount': True,
        'texture2dDiffVerified': False,
        'itemIdToTextureAddressVerified': False,
        'switchSameBuildOriginalPngShaVerified': 0,
        'publishAllowed': False,
        'steamGlobalMigrationAllowed': False,
        'nativeSaveWriterAllowed': False,
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--root', type=Path, required=True)
    parser.add_argument('--report', type=Path, required=True)
    args = parser.parse_args()
    root = args.root.resolve()
    report = args.report
    if (report.is_symlink() or report.exists() or report.resolve() == root or
            root in report.resolve().parents):
        raise ValueError('OUTPUT_MUST_BE_NEW_OUTSIDE_ORIGINALS')
    result = analyze(root)
    report.parent.mkdir(parents=True, exist_ok=True)
    with report.open('x', encoding='utf-8') as out:
        json.dump(result, out, indent=2, sort_keys=True)
        out.write('\n')
    print(json.dumps({k: result[k] for k in ('tier', 'byteIdentical', 'differingAlignedChunks', 'publishAllowed')}))


if __name__ == '__main__':
    main()
