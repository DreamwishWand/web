export const ORIGINAL_SAVE_BACKUP_CONTRACT =
  'dreamwish-wand-wep-original-save-backup@1';

function sanitizeBaseName(name:string) {
  const trimmed=String(name??'').trim();
  const fallback='ddv-save';
  const safe=(trimmed||fallback)
    .replace(/[\\/:*?"<>|]+/g,'_')
    .replace(/\s+/g,' ')
    .slice(0,160);
  return safe||fallback;
}

export function originalSaveBackupFileName(sourceName:string) {
  const safe=sanitizeBaseName(sourceName);
  const lower=safe.toLowerCase();
  if (lower.endsWith('.save')) {
    return `${safe.slice(0,-5)}.original-backup.save`;
  }
  return `${safe}.original-backup`;
}

export function createOriginalSaveBackup({
  bytes,
  sourceName
}:{
  bytes:Uint8Array;
  sourceName:string;
}) {
  if (!(bytes instanceof Uint8Array) || bytes.byteLength===0) {
    throw new Error('WEP_ORIGINAL_SAVE_BACKUP_BYTES_REQUIRED');
  }
  const copy=Uint8Array.from(bytes);
  return Object.freeze({
    contract: ORIGINAL_SAVE_BACKUP_CONTRACT,
    purpose: 'ORIGINAL_UNMODIFIED_SAVE_BACKUP',
    fileName: originalSaveBackupFileName(sourceName),
    mimeType: 'application/octet-stream',
    byteLength: copy.byteLength,
    bytes: copy,
    sourceMutationPerformed: false,
    serializerUsed: false,
    persistentWriteAuthorized: false
  });
}
