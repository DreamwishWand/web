#!/usr/bin/env python3
"""Synthetic-only, non-authorizing 01D Collection v1.26.1/643 Source tests."""
import hashlib
import importlib.util
import io
import json
import pathlib
import stat
import sys
import tempfile
import unittest
from contextlib import redirect_stdout
from unittest.mock import patch

MODULE=pathlib.Path(__file__).resolve().parents[1]/'scripts/asset-research/01d-collection1261-private-structure-read.py'
spec=importlib.util.spec_from_file_location('source_reader',MODULE)
s=importlib.util.module_from_spec(spec);spec.loader.exec_module(s)

def record(frame):
    item_id=2120000000+frame
    row=b'\x08'+s.encode_varint(item_id)+b'\x12\x01x'
    return s.encode_varint(frame)+s.encode_varint(len(row))+row

def source():
    return b''.join(record(i) for i in range(1,306))

def profile():
    return json.dumps({'GameInfo':{'Version':643},'Player':{'CollectionSets':[
        {'CollectionDefinitionID':2120000000+i,
         'GroupData':[{'GroupIndex':0,'State':'Synthetic','GroupsCollectionItems':{'40000001':i%2==0,'40000002':False}}]}
        for i in range(1,306)]}}).encode('utf-8')

class SourceContract(unittest.TestCase):
    def setUp(self):
        self.raw=source()
        self.pins=patch.multiple(s,COLLECTION_SHA=hashlib.sha256(self.raw).hexdigest(),COLLECTION_BYTES=len(self.raw))
        self.pins.start();self.addCleanup(self.pins.stop)

    def test_source_only_two_pinned_305_frame_inputs_do_not_authorize(self):
        d=s.make_report(self.raw,self.raw)
        self.assertEqual(d['sourceDefinitionCount'],305)
        self.assertTrue(d['sourceBytesIdentical'])
        self.assertFalse(d['profileExamined'])
        self.assertFalse(d['writerAuthorized'])
        self.assertFalse(d['nativeDynamicGroupVerified'])
        self.assertFalse(d['savedVsStaticItemMembershipVerified'])
        self.assertEqual(d['displayedCollectedMeaning'],'UNKNOWN')
        self.assertNotIn('definitionIds',d)

    def test_forged_or_modified_originals_deny_without_profile(self):
        for a,b in [(self.raw+b'\x00',self.raw),(self.raw,self.raw+b'\x00'),
                    (self.raw[:-1]+bytes([self.raw[-1]^1]),self.raw)]:
            with self.assertRaisesRegex(s.SourceDenied,'ORIGINAL_SHA_MISMATCH'):
                s.attest_pair(a,b)
        with self.assertRaisesRegex(s.SourceDenied,'PROFILE_REQUIRED_FOR_PRIVATE_SHA'):
            s.make_report(self.raw,self.raw,None,'a'*64)

    def test_frame_duplicate_noncanonical_truncated_and_type_mismatch(self):
        self.assertEqual(len(s.source_ids(self.raw)),305)
        for raw,denial in [
            (record(1)+record(1),'FRAME_DUPLICATE'),
            (b'\x81\x00'+record(1)[1:],'NONCANONICAL_VARINT'),
            (record(1)[:-1],'FRAME_SIZE_INVALID'),
            (s.encode_varint(2)+record(1)[1:],'DEFINITION_FRAME_ID_CONFLICT'),
            (s.encode_varint(1)+s.encode_varint(1)+b'\x08','TRUNCATED_VARINT')]:
            with self.subTest(denial=denial),self.assertRaisesRegex(s.SourceDenied,denial):
                s.source_ids(raw)

    def test_actual_shape_643_synthetic_reports_tokens_not_ownership(self):
        raw=profile();h=hashlib.sha256(raw).hexdigest()
        d=s.make_report(self.raw,self.raw,raw,h)
        self.assertEqual(d['observedSavedDefinitions'],305)
        self.assertEqual(d['observedGroupRecords'],305)
        self.assertEqual(d['observedSavedBooleanFlags'],610)
        self.assertEqual(d['observedTrueTokens']+d['observedFalseTokens'],610)
        self.assertFalse(d['writerAuthorized'])
        self.assertFalse(d['ownedEntitlementVerified'])
        self.assertNotIn('privateSaveSha256',d)
        self.assertNotIn('itemIds',d)

    def test_invalid_profile_sha_build_route_boolean_and_group_denied(self):
        raw=profile();ids=s.source_ids(self.raw)
        with self.assertRaisesRegex(s.SourceDenied,'PRIVATE_SAVE_SHA_MISMATCH'):
            s.read_private_save(raw,'a'*64,ids)
        for change,needle in [
            (lambda x:x['GameInfo'].update(Version=626),'PRIVATE_SAVE_SCHEMA643_REQUIRED'),
            (lambda x:x['GameInfo'].update(Version=643.0),'PRIVATE_SAVE_SCHEMA643_REQUIRED'),
            (lambda x:x['Player']['CollectionSets'].pop(),'PRIVATE_SOURCE_DEFINITION_SET_MISMATCH'),
            (lambda x:x['Player']['CollectionSets'][1].update(CollectionDefinitionID=2120000001),'COLLECTION_ID_INVALID_OR_DUPLICATE'),
            (lambda x:x['Player']['CollectionSets'][0]['GroupData'][0]['GroupsCollectionItems'].update({'40000001':5}),'NONBOOL_ITEM_VALUE'),
            (lambda x:x['Player']['CollectionSets'][0]['GroupData'].append(x['Player']['CollectionSets'][0]['GroupData'][0]),'GROUP_INDEX_INVALID_OR_DUPLICATE')]:
            obj=json.loads(raw);change(obj);payload=json.dumps(obj).encode()
            with self.subTest(needle=needle),self.assertRaisesRegex(s.SourceDenied,needle):
                s.read_private_save(payload,hashlib.sha256(payload).hexdigest(),ids)
        duplicate=raw.replace(b'"Version": 643',b'"Version": 643, "Version": 643',1)
        with self.assertRaisesRegex(s.SourceDenied,'DUPLICATE_JSON_KEY'):
            s.read_private_save(duplicate,hashlib.sha256(duplicate).hexdigest(),ids)

    def test_cli_regular_sources_private_report_exclusive_no_raw_leak(self):
        with tempfile.TemporaryDirectory() as temp:
            root=pathlib.Path(temp).resolve()
            a=root/'steam';b=root/'switch';out_dir=root/'output'
            a.mkdir();b.mkdir();out_dir.mkdir()
            aa=a/'CollectionSet.json';bb=b/'CollectionSet.json'
            aa.write_bytes(self.raw);bb.write_bytes(self.raw)
            saved=root/'private-profile.bin';saved.write_bytes(profile())
            report=out_dir/'only-aggregates.json'
            args=['prog','--steam-collection',str(aa),'--switch-collection',str(bb),
                  '--private-profile',str(saved),'--expected-private-profile-sha256',hashlib.sha256(saved.read_bytes()).hexdigest(),
                  '--private-report',str(report)]
            with patch.object(sys,'argv',args),redirect_stdout(io.StringIO()):s.main()
            result=json.loads(report.read_text())
            self.assertEqual(result['observedSavedBooleanFlags'],610)
            self.assertFalse(result['writerAuthorized'])
            self.assertFalse(result['publishAllowed'])
            self.assertEqual(stat.S_IMODE(report.stat().st_mode),0o600)
            self.assertNotIn('40000001',report.read_text())
            with patch.object(sys,'argv',args),self.assertRaisesRegex(s.SourceDenied,'OUTPUT_EXISTS_NO_CLOBBER'):
                s.main()
            self.assertEqual(aa.read_bytes(),self.raw)
            bad=root/'symlink.json';bad.symlink_to(aa)
            with self.assertRaisesRegex(s.SourceDenied,'SOURCE_SYMLINK'):
                s.read_regular_original(bad,s.MAX_COLLECTION)

if __name__=='__main__':unittest.main()
