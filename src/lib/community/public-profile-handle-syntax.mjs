// 03 COMM / W-ENTITY-016 / R12 R16 — user-profile handle syntax boundary.
// New public /users/{handle}/ grammar is separate from legacy CreatorProfile.handle.
// No DB read, RLS, Auth, JWT, privacy decision, alias reservation, HTTP status or redirect.
export const USER_PROFILE_HANDLE_CONTRACT = 'wand.public-profile-handle.syntax-only@1';

// Conservative local denial list; the actual historic/impersonation reservation index
// is server-owned and unverified. Passing this syntax check NEVER authorizes a URL.
export const PROTECTED_USER_HANDLE_TOKENS = Object.freeze([
  'about', 'account', 'accounts', 'admin', 'administrator', 'api', 'auth',
  'blog', 'collection', 'collections', 'constructor', 'creator', 'creators', 'dashboard',
  'delete', 'deleted', 'dreamsnaps', 'editor', 'explore', 'gallery', 'guide',
  'help', 'home', 'index', 'library', 'login', 'logout', 'moderation',
  'moodboards', 'notifications', 'operator', 'owner', 'preset', 'presets',
  'privacy', 'profile', 'profiles', 'prototype', 'register', 'root', 'search', 'settings',
  'signin', 'signup', 'staff', 'support', 'system', 'terms', 'user', 'users',
  'work', 'works', 'world'
]);
const reserved = new Set(PROTECTED_USER_HANDLE_TOKENS);
const validHandle = /^[a-z][a-z0-9]*(?:_[a-z0-9]+)*$/;

// Constant policy boundary. Even on a candidate handle, never derive a
// positive HTTP response or redirect from user-controlled syntax alone.
const deny = Object.freeze({
  mayReadPublicProfile: false,
  mayReadPrivateLibrary: false,
  mayRedirectOldAlias: false,
  mayIndex: false,
  mayWriteHandle: false,
  mayPublishCommunity: false,
  publicUrl: null,
  redirectCode: null
});
const invalid = reason => Object.freeze({
  ...deny, status: 'INVALID', reason, canonicalHandle: null
});

export function inspectPublicProfileHandleSegment(raw) {
  if (typeof raw !== 'string') return invalid('NOT_A_STRING');
  if (!raw || raw.length > 24) return invalid('LENGTH');
  // No unicode normalization, percent decoding, trimming, or path coalescing.
  // Reject encoded slash/dot, percent case variants, bidi and confusable Unicode.
  if (raw.includes('%')) return invalid('PERCENT_ENCODING');
  if (!/^[\x00-\x7f]*$/.test(raw)) return invalid('NON_ASCII');
  const canonical = raw.toLowerCase(); // ASCII only: no NFKC or locale fold
  if (canonical.length < 3 || canonical.length > 24) return invalid('LENGTH');
  if (!validHandle.test(canonical)) return invalid('GRAMMAR');
  if (reserved.has(canonical)) return invalid('PROTECTED_NAME');
  return Object.freeze({
    ...deny,
    status: 'SYNTAX_ONLY_UNVERIFIED',
    reason: 'SERVER_HISTORY_PRIVACY_AUTH_UNVERIFIED',
    canonicalHandle: canonical
  });
}
