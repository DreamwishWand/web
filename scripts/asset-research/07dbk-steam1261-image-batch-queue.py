#!/usr/bin/env python3
"""07 DBK: authenticated private Steam v1.26.1 ItemID/Name/IconGUID image queue.

Consumes 01D's pinned original Steam v1.25.3 + v1.26.1 itemlists, never
extracts media, uploads original bytes, mints a release or changes a public
manifest. Worklist contains private text metadata and is never printed to CI.
"""
from __future__ import annotations

import argparse
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import re

SCHEMA = "wand.07dbk.steam1261-private-guid-image-queue@1"
G = re.compile(r"guid:[0-9a-f]{32}\Z")
ITEM = re.compile(r"[1-9][0-9]{0,15}\Z")
ROOT = Path(__file__).resolve().parents[2]
SOURCE = Path(__file__).with_name("01d-steam-native-icon-delta.py")
CATEGORIES = frozenset(("ActivityItem", "Furniture", "Clothing", "Trimming"))


def denied(code):
    raise ValueError("07DBK_STEAM1261_QUEUE_" + code)


def load_01d():
    spec = importlib.util.spec_from_file_location("wand_01d_pinned_icon_source", SOURCE)
    if not spec or not spec.loader:
        denied("SOURCE_MODULE_UNAVAILABLE")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def secure_private_path(path: Path, is_dir=False):
    if not path.is_absolute() or ".." in path.parts or path != Path(os.path.abspath(path)):
        denied("ABSOLUTE_CANONICAL_PRIVATE_PATH_REQUIRED")
    p = path if is_dir else path.parent
    if not p.is_dir():
        denied("PRIVATE_PARENT_DIRECTORY_MISSING")
    current = p
    while True:
        if current.is_symlink() or not current.is_dir():
            denied("PRIVATE_DIRECTORY_SYMLINK_OR_ALIAS")
        if (current / ".git").exists() or (current / ".git").is_symlink():
            denied("PRIVATE_GIT_ROOT_DENIED")
        if current == current.parent:
            break
        current = current.parent
    if p == ROOT or ROOT in p.parents or p in ROOT.parents:
        denied("PRIVATE_PATH_MUST_BE_OUTSIDE_REPO")
    if p.resolve(strict=True) != p:
        denied("PRIVATE_DIRECTORY_ALIAS")
    if is_dir and path != p:
        denied("PRIVATE_DIRECTORY_ALIAS")
    if not is_dir and (path.exists() or path.is_symlink()):
        denied("NO_CLOBBER_EXISTING_OUTPUT")
    return path


def build_image_queue(delta, old_guids, *, expected=None):
    """Group the actual new IDs without confusing reused and new GUIDs."""
    if not isinstance(delta, dict) or not isinstance(old_guids, (set, frozenset)):
        denied("DELTA_OR_OLD_GUID_SET_INVALID")
    required = {"sourceVersion": "v1253", "targetVersion": "v1261"}
    if any(delta.get(key) != value for key, value in required.items()):
        denied("WRONG_BUILD_COMPARISON")
    if not old_guids or not all(isinstance(v, str) and G.fullmatch(v) for v in old_guids):
        denied("OLD_GUID_SOURCE_UNVERIFIED")
    if delta.get("removedCount") != 0 or delta.get("iconGuidChangedCount") != 0 or \
       delta.get("changedGuidCandidates") != [] or delta.get("removedCandidates") != []:
        denied("CHANGED_OR_REMOVED_REQUIRES_SEPARATE_MEDIA_REVIEW")
    if any(delta.get(k) is not False for k in
           ("sourceIconPixelShaCompared", "deployAllowed")) or \
       delta.get("targetSwitchOriginalPngShaVerified") != 0 or \
       delta.get("imagePublicEligibleRows") != 0:
        denied("SOURCE_REPORT_CLAIMS_MEDIA_AUTHORITY")
    entries = delta.get("addedCandidates")
    if not isinstance(entries, list) or len(entries) > 5000 or \
       delta.get("addedCount") != len(entries):
        denied("ADDED_ITEMS_COUNT_MISMATCH")
    source_count, target_count = delta.get("sourceCount"), delta.get("targetCount")
    if not isinstance(source_count, int) or isinstance(source_count, bool) or \
       not isinstance(target_count, int) or isinstance(target_count, bool) or \
       source_count < 1 or target_count != source_count + len(entries) or \
       delta.get("retained") != source_count or \
       delta.get("iconGuidEqualCandidateCount") != source_count:
        denied("RETAINED_ITEM_COUNTS_MISMATCH")
    grouped = {}
    seen = set()
    for row in entries:
        if not isinstance(row, dict) or set(row) != {"itemId", "category", "name", "iconGuid"}:
            denied("ITEM_SHAPE_INVALID")
        id = row["itemId"]
        if not isinstance(id, str) or not ITEM.fullmatch(id) or \
           id in seen or int(id) >= 2**53:
            denied("ITEM_ID_UNSAFE_OR_DUPLICATE")
        seen.add(id)
        if row["category"] not in CATEGORIES or \
           not isinstance(row["name"], str) or not row["name"] or \
           len(row["name"]) > 1024 or \
           not isinstance(row["iconGuid"], str) or not G.fullmatch(row["iconGuid"]):
            denied("ITEM_NAME_OR_GUID_INVALID")
        guid = row["iconGuid"]
        grouped.setdefault(guid, []).append({
            "itemId": id, "category": row["category"], "name": row["name"]
        })
    # All actual item names are retained ONLY in owner-private output, never
    # in public code, CI logs, or release metadata before provenance gate.
    new_groups, reuse_groups = [], []
    for guid, items in sorted(grouped.items()):
        group = {
            "iconGuid": guid,
            "items": sorted(items, key=lambda x: int(x["itemId"])),
            "actualTexturePixelsVerified": False,
            "visibilityVerified": False,
            "publishAllowed": False,
        }
        if guid in old_guids:
            group["action"] = "REUSE_OLD_GUID_ONLY_AFTER_EXACT_NATIVE_PIXEL_SHA_VISIBILITY_MATCH"
            reuse_groups.append(group)
        else:
            group["action"] = "EXTRACT_NEW_STEAM_TEXTURE_PRIVATE_THEN_RGBA160_SHA_REVIEW"
            new_groups.append(group)
    summary = {
        "newItemIds": len(entries),
        "newUniqueIconGuids": len(new_groups),
        "newGuidReferencedItemIds": sum(len(g["items"]) for g in new_groups),
        "existingGuidReusedItemIds": sum(len(g["items"]) for g in reuse_groups),
        "reusedUniqueIconGuids": len(reuse_groups),
        "nativeOriginalMediaDecoded": 0,
        "publiclyApprovedImages": 0,
    }
    if summary["newGuidReferencedItemIds"] + summary["existingGuidReusedItemIds"] != len(entries):
        denied("IMAGE_WORK_SPLIT_INCOMPLETE")
    if expected is not None and any(summary.get(k) != value for k, value in expected.items()):
        denied("TRUE_SOURCE_IMAGE_GUID_DELTA_COUNT_CHANGED")
    return {
        "schema": SCHEMA,
        "sourcePlatform": "Steam Windows",
        "fromVersion": "v1253",
        "toVersion": "v1261",
        "privateSource": "01D_PINNED_ORIGINAL_ITEMLIST_8_FILES",
        "publicMedia": "OFF",
        "signedBatch": "NOT_RUN",
        "sourceOnlyNotAnImageReview": True,
        "rightsHolderLicence": "UNKNOWN",
        "consumerOn": False,
        "summary": summary,
        "extractNewGuidGroups": new_groups,
        "recheckOldGuidGroups": reuse_groups,
    }


def run(source_root: Path):
    source_root = secure_private_path(source_root, is_dir=True)
    module = load_01d()
    report = module.analyze(source_root, synthetic=False, include_v1261=True)
    if report.get("schema") != module.SCHEMA or \
       report.get("evidence") != "SOURCE_ONLY_ORIGINAL_STEAM_NATIVE_DEFINITIONS" or \
       set(report.get("source", {})) != {"v12413", "v1250", "v1253", "v1261"}:
        denied("SOURCE_PROVENANCE_INVALID")
    old_guids = set()
    # Independently re-open the old 4 original files, not an untrusted list
    # or aggregate report field; pin SHA+size again before computing reuse.
    for cat in module.CATEGORIES:
        p = source_root / "v1253" / (cat + ".json")
        if p.is_symlink() or not p.is_file() or source_root not in p.resolve().parents:
            denied("OLD_ITEMLIST_ALIAS")
        b = p.read_bytes()
        if (hashlib.sha256(b).hexdigest(), len(b)) != module.SOURCE_PINS["v1253"][cat]:
            denied("OLD_ITEMLIST_SHA_RACE")
        old_guids.update(row["iconGuid"] for row in module.read_category(b, cat).values())
    # Do not silently trust current version rows after earlier analysis: all
    # 8 required raw source bytes are rechecked against 01D original pins.
    for version in ("v1253", "v1261"):
        for cat in module.CATEGORIES:
            p = source_root / version / (cat + ".json")
            if p.is_symlink() or not p.is_file() or source_root not in p.resolve().parents:
                denied("SOURCE_FILE_CHANGED_DURING_RECHECK")
            b = p.read_bytes()
            if (hashlib.sha256(b).hexdigest(), len(b)) != module.SOURCE_PINS[version][cat]:
                denied("SOURCE_FILE_CHANGED_DURING_RECHECK")
    delta = report["v1253_to_v1261"]
    return build_image_queue(delta, old_guids, expected={
        "newItemIds": 993,
        "newUniqueIconGuids": 647,
        "newGuidReferencedItemIds": 681,
        "existingGuidReusedItemIds": 312,
    })


def main():
    ap = argparse.ArgumentParser(description="Private-only Steam v1.26.1 image GUID reuse/extract queue; never publishes")
    ap.add_argument("--source-root", type=Path, required=True)
    ap.add_argument("--private-output", type=Path, required=True)
    args = ap.parse_args()
    root = secure_private_path(args.source_root, is_dir=True)
    out = secure_private_path(args.private_output, is_dir=False)
    if out.parent == root or root in out.parent.parents or out.parent in root.parents:
        denied("OUTPUT_MUST_BE_SEPARATE_FROM_SOURCE")
    report = run(root)
    raw = (json.dumps(report, ensure_ascii=False, separators=(",", ":"), sort_keys=True) + "\n").encode("utf-8")
    if len(raw) > 2 * 1024 * 1024:
        denied("PRIVATE_QUEUE_OVERSIZED")
    secure_private_path(out, is_dir=False)
    fd = os.open(out, os.O_WRONLY | os.O_CREAT | os.O_EXCL | getattr(os, "O_NOFOLLOW", 0), 0o600)
    with os.fdopen(fd, "wb") as f:
        f.write(raw)
    print(json.dumps({"schema": SCHEMA, **report["summary"],
        "privateOutputWritten": True, "publishAllowed": False,
        "realMediaBytesCompared": False, "consumerOn": False}, sort_keys=True))


if __name__ == "__main__":
    main()
