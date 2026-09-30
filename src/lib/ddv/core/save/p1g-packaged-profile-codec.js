const MAX_INPUT_BYTES = 128 * 1024 * 1024;
const MAX_ARCHIVE_BYTES = 256 * 1024 * 1024;
const MAX_PROFILE_BYTES = 128 * 1024 * 1024;
const MAX_ZIP_ENTRIES = 1024;
const PROFILE_NAME = 'profile';
const ZIP_LOCAL = 0x04034b50;
const ZIP_CENTRAL = 0x02014b50;
const ZIP_EOCD = 0x06054b50;
const ZIP_METHOD_STORE = 0;
const ZIP_METHOD_DEFLATE = 8;
const encoder = new TextEncoder();
const decoder = new TextDecoder('utf-8', { fatal: true });

// Established DDV profile interoperability key. Codec-internal only: never emit in metadata/UI/logs.
const KEY_BYTES = hexToBytes('62357168683873614A38556C444A557A545A5864325467366D626F3857386e35');
let AES_ROUND_KEYS;

export const P1G_CODEC_VERSION = 'p1g-packaged-profile-codec@1';
export const P1G_CONTRACT = 'p1g-v0';

export const p1gPackagedProfileCodec = Object.freeze({
  contract: P1G_CONTRACT,
  codecVersion: P1G_CODEC_VERSION,

  async loadProfile(input) {
    const source = requireBytes(input, 'profile source');
    const archive = await decryptAes256EcbPkcs7(source);
    if (archive.length > MAX_ARCHIVE_BYTES) throw new Error('DECRYPTED_ARCHIVE_TOO_LARGE');
    const extracted = await extractProfileFromZip(archive);
    let jsonText;
    try { jsonText = decoder.decode(extracted.profileBytes); }
    catch { throw new Error('PROFILE_UTF8_INVALID'); }
    const root = parseRequiredProfileJson(jsonText);
    return {
      inputType: 'packaged',
      jsonText,
      metadata: Object.freeze({
        codecVersion: P1G_CODEC_VERSION,
        profileVersion: checkedVersion(root.GameInfo.Version),
        zip: extracted.metadata
      })
    };
  },

  parseProfileText(text) {
    const root = parseRequiredProfileJson(text);
    return { metadata: Object.freeze({ profileVersion: checkedVersion(root.GameInfo.Version) }) };
  },

  async createEncodedProfile(text, expectedMetadata) {
    if (typeof text !== 'string' || text.length === 0) throw new Error('PROFILE_JSON_INVALID');
    const root = parseRequiredProfileJson(text);
    const metadata = requireCodecMetadata(expectedMetadata);
    if (metadata.codecVersion !== P1G_CODEC_VERSION) throw new Error('CODEC_METADATA_VERSION_MISMATCH');
    if (checkedVersion(root.GameInfo.Version) !== checkedVersion(metadata.profileVersion)) {
      throw new Error('PROFILE_VERSION_CHANGED_DURING_ENCODE');
    }
    // P1G rebuilds a single profile entry. If a future archive introduces other entries,
    // read/no-op can still remain possible, but modified encode must fail closed rather than drop them.
    if (metadata.zip.entryCount !== 1 || metadata.zip.profileEntryCount !== 1) {
      throw new Error('ZIP_UNSUPPORTED_EXTRA_ENTRIES_FOR_MODIFIED_ENCODE');
    }
    if (metadata.zip.archiveComment.length !== 0) {
      throw new Error('ZIP_UNSUPPORTED_ARCHIVE_COMMENT_FOR_MODIFIED_ENCODE');
    }

    const profileBytes = encoder.encode(text);
    if (profileBytes.length > MAX_PROFILE_BYTES) throw new Error('PROFILE_ENTRY_TOO_LARGE');
    const archive = await buildSingleProfileZip(profileBytes, metadata.zip.profileEntry);
    const encrypted = encryptAes256EcbPkcs7(archive);

    // Immediate P1G self-check before returning bytes.
    const reopened = await this.loadProfile(encrypted);
    const expectedRoot = JSON.parse(text);
    const actualRoot = JSON.parse(reopened.jsonText);
    if (!jsonSemanticEqual(expectedRoot, actualRoot)) throw new Error('ENCODE_REOPEN_SEMANTIC_MISMATCH');
    return encrypted;
  },

  getProfileVersion(metadata) {
    const obj = asObject(metadata);
    const version = obj?.profileVersion;
    return checkedVersion(version);
  }
});

/** @param {Uint8Array} ciphertext */
export async function decodeP1gPackagedProfile(ciphertext) {
  return p1gPackagedProfileCodec.loadProfile(ciphertext);
}

/** @param {Uint8Array} input */
function requireBytes(input, label) {
  if (!(input instanceof Uint8Array)) throw new TypeError(`${label} must be Uint8Array.`);
  if (input.length === 0 || input.length > MAX_INPUT_BYTES) throw new Error('INVALID_ENCRYPTED_PROFILE_LENGTH');
  return input;
}

function asObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value : null;
}

function checkedVersion(value) {
  if (typeof value === 'number' && Number.isSafeInteger(value) && value >= 0) return value;
  if (typeof value === 'string' && /^(?:0|[1-9]\d*)$/.test(value)) {
    const n = Number(value);
    if (Number.isSafeInteger(n)) return n;
  }
  throw new Error('PROFILE_VERSION_INVALID');
}

function parseRequiredProfileJson(text) {
  let root;
  try { root = JSON.parse(text); }
  catch { throw new Error('PROFILE_JSON_INVALID'); }
  if (!asObject(root) || !asObject(root.GameInfo)) throw new Error('PROFILE_ROOT_INVALID');
  if (!asObject(root.Player) || !asObject(root.World)) throw new Error('PROFILE_REQUIRED_SECTIONS_MISSING');
  return root;
}

function requireCodecMetadata(value) {
  const obj = asObject(value);
  const zip = asObject(obj?.zip);
  const entry = asObject(zip?.profileEntry);
  if (!obj || !zip || !entry || typeof obj.codecVersion !== 'string') throw new Error('CODEC_METADATA_INVALID');
  return obj;
}

function jsonSemanticEqual(a, b) {
  if (Object.is(a, b)) return true;
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((v, i) => jsonSemanticEqual(v, b[i]));
  }
  const ao = asObject(a), bo = asObject(b);
  if (ao && bo) {
    const ak = Object.keys(ao), bk = Object.keys(bo);
    if (ak.length !== bk.length) return false;
    for (const k of ak) {
      if (!Object.prototype.hasOwnProperty.call(bo, k) || !jsonSemanticEqual(ao[k], bo[k])) return false;
    }
    return true;
  }
  return false;
}

// ---------- AES-256 ECB ----------

async function decryptAes256EcbPkcs7(ciphertext) {
  if (ciphertext.length === 0 || ciphertext.length % 16 !== 0) throw new Error('INVALID_ENCRYPTED_PROFILE_LENGTH');
  if (!globalThis.crypto?.subtle) throw new Error('WEB_CRYPTO_UNAVAILABLE');

  // WebCrypto does not expose AES-ECB. CBC decryption gives D(C_i) xor C_(i-1).
  // Append a crafted block whose CBC plaintext is a full 0x10 padding block so the
  // built-in PKCS#7 removal succeeds, then xor previous ciphertext blocks back out.
  const last = ciphertext.subarray(ciphertext.length - 16);
  const x = new Uint8Array(16);
  for (let i = 0; i < 16; i += 1) x[i] = last[i] ^ 0x10;
  const crafted = aes256EncryptBlock(x, AES_ROUND_KEYS);
  const cbcCipher = new Uint8Array(ciphertext.length + 16);
  cbcCipher.set(ciphertext, 0);
  cbcCipher.set(crafted, ciphertext.length);

  let cbcPlain;
  try {
    const key = await crypto.subtle.importKey('raw', KEY_BYTES, { name: 'AES-CBC' }, false, ['decrypt']);
    const result = await crypto.subtle.decrypt({ name: 'AES-CBC', iv: new Uint8Array(16) }, key, cbcCipher);
    cbcPlain = new Uint8Array(result);
  } catch (error) {
    throw new Error(`AES_DECRYPT_FAILED:${error instanceof Error ? error.message : String(error)}`);
  }
  if (cbcPlain.length !== ciphertext.length) throw new Error('AES_CBC_ECB_BRIDGE_LENGTH_MISMATCH');

  const padded = new Uint8Array(ciphertext.length);
  padded.set(cbcPlain.subarray(0, 16), 0);
  for (let off = 16; off < ciphertext.length; off += 16) {
    for (let i = 0; i < 16; i += 1) padded[off + i] = cbcPlain[off + i] ^ ciphertext[off - 16 + i];
  }
  return pkcs7Unpad(padded);
}
