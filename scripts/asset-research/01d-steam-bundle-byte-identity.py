#!/usr/bin/env python3
"""Bounded v1.25.0→v1.25.3 original Steam bundle byte reuse; no image release."""
from __future__ import annotations
import argparse
import hashlib
import json
import pathlib
from types import MappingProxyType

SCHEMA='wand.01d.steam-bundle-identity-source-only@1'
BUNDLE_PINS=MappingProxyType({
  'flower_584a9f69.bundle':('e7cbd3f2c08f13bcca84e58ec96cf519ef566cb2061c5ae6fe3d65a612b97770',3784859),
  'seed_8c733f88.bundle':('3650906d8318350dd35944ddbcf67f4616e11c37e544ab379a48faa059514e3f',6372358),
  'meal_7a31d699.bundle':('9770b0d4980da18332bf1870f7fdb0969cc88046d769e25316b0663cdf47ccf5',24835033),
})
VERSIONS=('v1250','v1253')

def hash_original(path):
    if path.is_symlink() or not path.is_file():
        raise ValueError('MISSING_OR_SYMLINK_ORIGINAL_BUNDLE')
    if not (0<path.stat().st_size<=32000000):
        raise ValueError('BUNDLE_SIZE_INVALID')
    digest=hashlib.sha256()
    with path.open('rb') as source:
        while True:
            chunk=source.read(1024*1024)
            if not chunk:break
            digest.update(chunk)
    return digest.hexdigest(),path.stat().st_size

def analyze(root,pins=BUNDLE_PINS,synthetic=False):
    # Do not allow a caller to supply self-signed original-source provenance.
    # Fixture pin overrides are valid ONLY for explicitly synthetic evidence.
    if not synthetic and pins is not BUNDLE_PINS:
        raise ValueError('ORIGINAL_PIN_OVERRIDE_FORBIDDEN')
    root=root.resolve()
    result=[]
    if not pins or len(pins)>40:raise ValueError('INVALID_PIN_COUNT')
    for filename,(expected_sha,expected_size) in sorted(pins.items()):
        if pathlib.PurePath(filename).name != filename or '/' in filename or '\\' in filename or not filename.endswith('.bundle'):
            raise ValueError('UNSAFE_BUNDLE_FILENAME')
        per_version={}
        for version in VERSIONS:
            path=root/version/filename
            if not path.is_relative_to(root) or path.resolve()!=path.absolute() or root not in path.resolve().parents:
                raise ValueError('BUNDLE_ROOT_OR_SYMLINK_INVALID')
            sha,size=hash_original(path)
            if not synthetic and (sha,size)!=(expected_sha,expected_size):
                raise ValueError('ORIGINAL_BUNDLE_PIN_MISMATCH')
            per_version[version]={'sha256':sha,'bytes':size}
        identical=per_version['v1250']==per_version['v1253']
        result.append({'bundleName':filename,'versions':per_version,
                       'originalByteEqual':identical,
                       'reuseSourceBundleCandidate':identical})
    return {'schema':SCHEMA,'sourcePlatform':'Steam/Windows',
            'fullVersions':{'v1250':'releases_1.25-v1.25.0-8687-gdd3d3a5ae738-incremental-14',
                            'v1253':'releases_1.25-v1.25.3-44-g0b41250d9ac0-incremental-22'},
            'tier':'SYNTHETIC_ONLY' if synthetic else 'REAL_STEAM_ORIGINAL_BUNDLE_BYTES_SOURCE_ONLY',
            'comparedBundles':len(result),
            'identicalBundles':sum(x['originalByteEqual'] for x in result),
            'sourceBytesEqualImpliesSameBundlePayloadOnly':True,
            'switchSameBuildOriginalPngShaVerified':0,
            'allOtherBundlesChecked':False,
            'itemIdToTextureAddressVerified':False,
            'publishAllowed':False,'nativeSaveWriterAllowed':False,
            'bundles':result}

def main():
    p=argparse.ArgumentParser()
    p.add_argument('--root',required=True,type=pathlib.Path)
    p.add_argument('--report',required=True,type=pathlib.Path)
    args=p.parse_args()
    root=args.root.resolve()
    if args.report.is_symlink() or args.report.exists() or args.report.resolve()==root or root in args.report.resolve().parents:
        raise ValueError('OUTPUT_PATH_MUST_BE_NEW_OUTSIDE_ORIGINALS')
    result=analyze(root)
    args.report.parent.mkdir(parents=True,exist_ok=True)
    with args.report.open('x',encoding='utf-8') as output:
        json.dump(result,output,indent=2,sort_keys=True)
        output.write('\n')
    print(json.dumps({'tier':result['tier'],'compared':result['comparedBundles'],
                      'identical':result['identicalBundles'],'publishAllowed':False}))

if __name__=='__main__':main()
