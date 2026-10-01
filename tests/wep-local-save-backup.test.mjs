import test from 'node:test';
import assert from 'node:assert/strict';

import {
  ORIGINAL_SAVE_BACKUP_CONTRACT,
  createOriginalSaveBackup,
  originalSaveBackupFileName
} from '../src/lib/wep/local-save-backup.ts';

test('original save backup preserves source bytes exactly without serializer or writer authorization', () => {
  const source = Uint8Array.from([0x44, 0x44, 0x56, 0x00, 0xff, 0x10]);
  const backup = createOriginalSaveBackup({
    bytes: source,
    sourceName: 'save_0.save'
  });

  assert.equal(
    backup.contract,
    ORIGINAL_SAVE_BACKUP_CONTRACT
  );
  assert.equal(
    backup.purpose,
    'ORIGINAL_UNMODIFIED_SAVE_BACKUP'
  );
  assert.equal(
    backup.fileName,
    'save_0.original-backup.save'
  );
  assert.equal(backup.byteLength, source.byteLength);
  assert.deepEqual([...backup.bytes], [...source]);
  assert.notEqual(backup.bytes, source);
  assert.equal(backup.sourceMutationPerformed, false);
  assert.equal(backup.serializerUsed, false);
  assert.equal(backup.persistentWriteAuthorized, false);

  source[0] = 0;
  assert.equal(backup.bytes[0], 0x44);
});

test('original save backup filename is local-safe and deterministic', () => {
  assert.equal(
    originalSaveBackupFileName('My DDV.save'),
    'My DDV.original-backup.save'
  );
  assert.equal(
    originalSaveBackupFileName('unsafe:name?.bin'),
    'unsafe_name_.bin.original-backup'
  );
  assert.equal(
    originalSaveBackupFileName(''),
    'ddv-save.original-backup'
  );
});

test('original save backup refuses empty input', () => {
  assert.throws(
    () =>
      createOriginalSaveBackup({
        bytes: new Uint8Array(),
        sourceName: 'save_0.save'
      }),
    /WEP_ORIGINAL_SAVE_BACKUP_BYTES_REQUIRED/
  );
});
