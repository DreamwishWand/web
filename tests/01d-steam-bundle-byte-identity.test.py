import hashlib, importlib.util, json, pathlib, subprocess, sys, tempfile, unittest
SOURCE=pathlib.Path(__file__).resolve().parents[1]/'scripts'/'asset-research'/'01d-steam-bundle-byte-identity.py'
spec=importlib.util.spec_from_file_location('bundle_identity',SOURCE)
mod=importlib.util.module_from_spec(spec);spec.loader.exec_module(mod)
NAMES=('flower.bundle','seed.bundle','meal.bundle')

def fixture(root):
    pins={}
    for ver in mod.VERSIONS:
        (root/ver).mkdir(parents=True,exist_ok=True)
        for name in NAMES:
            payload=(b'Original simulated Steam UnityFS'+name.encode())*2
            (root/ver/name).write_bytes(payload)
            pins[name]=(hashlib.sha256(payload).hexdigest(),len(payload))
    return pins

class OriginalByteIdentity(unittest.TestCase):
    def test_synthetic_equal_all_three_source_only(self):
        with tempfile.TemporaryDirectory() as d:
            root=pathlib.Path(d);pins=fixture(root)
            out=mod.analyze(root,pins,True)
            self.assertEqual(out['identicalBundles'],3)
            self.assertEqual(out['tier'],'SYNTHETIC_ONLY')
            self.assertFalse(out['publishAllowed'])
            self.assertFalse(out['nativeSaveWriterAllowed'])
            self.assertEqual(out['switchSameBuildOriginalPngShaVerified'],0)

    def test_synthetic_same_size_changed_pixels_requires_update(self):
        with tempfile.TemporaryDirectory() as d:
            root=pathlib.Path(d);pins=fixture(root)
            original=root/'v1253'/NAMES[0]
            payload=original.read_bytes()
            original.write_bytes(payload[:-1]+(b'X' if payload[-1:]!=b'X' else b'Y'))
            self.assertEqual(original.stat().st_size,pins[NAMES[0]][1])
            out=mod.analyze(root,pins,True)
            self.assertEqual(out['identicalBundles'],2)
            self.assertFalse(next(x for x in out['bundles'] if x['bundleName']==NAMES[0])['reuseSourceBundleCandidate'])

    def test_original_mode_wrong_sha_denied(self):
        with tempfile.TemporaryDirectory() as d:
            root=pathlib.Path(d);pins=fixture(root)
            false_pins={k:('0'*64,v[1]) for k,v in pins.items()}
            with self.assertRaisesRegex(ValueError,'ORIGINAL_PIN_OVERRIDE_FORBIDDEN'):
                mod.analyze(root,false_pins)

    def test_qa653_forged_exact_sha_pins_cannot_claim_original_evidence(self):
        with tempfile.TemporaryDirectory() as d:
            root=pathlib.Path(d);self_signed_pins=fixture(root)
            # This is the exact independent QA653 TRUE RED: attacker-created
            # bytes and matching forged SHA/size were previously marked REAL.
            with self.assertRaisesRegex(ValueError,'ORIGINAL_PIN_OVERRIDE_FORBIDDEN'):
                mod.analyze(root,self_signed_pins,synthetic=False)
            fixture_result=mod.analyze(root,self_signed_pins,synthetic=True)
            self.assertEqual(fixture_result['tier'],'SYNTHETIC_ONLY')
            self.assertFalse(fixture_result['publishAllowed'])
            self.assertEqual(fixture_result['switchSameBuildOriginalPngShaVerified'],0)

    def test_default_original_pins_immutable_and_unpatchable_by_assignment(self):
        expected=mod.BUNDLE_PINS['flower_584a9f69.bundle']
        with self.assertRaises(TypeError):
            mod.BUNDLE_PINS['flower_584a9f69.bundle']=('0'*64,expected[1])
        self.assertEqual(mod.BUNDLE_PINS['flower_584a9f69.bundle'],expected)

    def test_missing_and_symlink_original_denied(self):
        with tempfile.TemporaryDirectory() as d:
            root=pathlib.Path(d);pins=fixture(root)
            target=root/'v1253'/NAMES[0]
            target.unlink()
            with self.assertRaisesRegex(ValueError,'MISSING_OR_SYMLINK_ORIGINAL_BUNDLE'):
                mod.analyze(root,pins,True)
            target.symlink_to(root/'v1250'/NAMES[0])
            with self.assertRaisesRegex(ValueError,'BUNDLE_ROOT_OR_SYMLINK_INVALID'):
                mod.analyze(root,pins,True)

    def test_empty_or_unsafe_pin_denied(self):
        with tempfile.TemporaryDirectory() as d:
            root=pathlib.Path(d);fixture(root)
            for pins in ({},{'../outside.bundle':('0'*64,1)},{'unsafe.txt':('0'*64,1)}):
                with self.assertRaises(ValueError):mod.analyze(root,pins,True)

    def test_original_report_existing_and_inside_root_denied(self):
        with tempfile.TemporaryDirectory() as d:
            home=pathlib.Path(d);root=home/'originals';fixture(root)
            report=root/'input-source.bundle'
            report.write_bytes(b'never overwrite private original')
            before=hashlib.sha256(report.read_bytes()).hexdigest()
            args=[sys.executable,str(SOURCE),'--root',str(root),'--report',str(report)]
            p=subprocess.run(args,capture_output=True,text=True)
            self.assertNotEqual(p.returncode,0)
            self.assertIn('OUTPUT_PATH_MUST_BE_NEW_OUTSIDE_ORIGINALS',p.stderr)
            self.assertEqual(hashlib.sha256(report.read_bytes()).hexdigest(),before)
            other=home/'existing.txt';other.write_bytes(b'preserve unrelated')
            p=subprocess.run(args[:-1]+[str(other)],capture_output=True,text=True)
            self.assertNotEqual(p.returncode,0)
            self.assertEqual(other.read_bytes(),b'preserve unrelated')

    def test_synthetic_source_read_no_ownership_leak(self):
        with tempfile.TemporaryDirectory() as d:
            root=pathlib.Path(d);pins=fixture(root)
            source=mod.analyze(root,pins,True)
            self.assertFalse(source['allOtherBundlesChecked'])
            self.assertFalse(source['itemIdToTextureAddressVerified'])
            self.assertTrue(source['sourceBytesEqualImpliesSameBundlePayloadOnly'])
            self.assertFalse(source['publishAllowed'])
            self.assertEqual(source['comparedBundles'],3)

if __name__=='__main__':unittest.main(verbosity=2)
