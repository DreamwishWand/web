// 08 WEB / canonical custom root preflight: static approved surface ONLY.
// Does NOT grant identity, rights, publication, hosted HTTPS, DNS or redirects.
// Production/test GitHub Pages /web is intentionally unchanged and not canonicalized.
export const OWNER_CUSTOM_DOMAIN = 'https://dreamwishwand.com';
export const CUSTOM_DOMAIN_PREFLIGHT_OPERATION = 'WEB_SOURCE_ONLY_CANONICAL_DOMAIN_AND_DIRECT_ROUTE_PREFLIGHT';
export const EXISTING_PAGES_BASE_PATH = '/web';
export const PUBLIC_STATIC_CANONICAL_PATHS = Object.freeze([
  '/', '/discover/', '/decorate/', '/collection/', '/guide/', '/moodboards/',
  '/presets/', '/gallery/', '/dreamsnaps/', '/help/'
]);
const publicPaths = new Set(PUBLIC_STATIC_CANONICAL_PATHS);

// The presence of a static Svelte route is *not* consent or a hosted 200 for an entity.
// Deny dynamic records and personal/private areas until host-side source, rights,
// principal and revoked-session gates have independent acceptance.
export function canonicalForApprovedStaticPath(pathname, { basePath = '', origin = '' } = {}) {
  if (basePath !== '' || origin !== OWNER_CUSTOM_DOMAIN ||
      typeof pathname !== 'string' || !publicPaths.has(pathname)) return null;
  return OWNER_CUSTOM_DOMAIN + pathname;
}

export function inspectCustomDomainPath(pathname) {
  if (typeof pathname !== 'string' || !pathname.startsWith('/') ||
      pathname.includes('%') || pathname.includes('//') || pathname.includes('?') ||
      pathname.includes('#') || pathname.includes('\\')) {
    return Object.freeze({kind:'INVALID',eligibleForPublicIndex:false,authoritativeStatus:null});
  }
  if (publicPaths.has(pathname)) return Object.freeze({
    kind:'PUBLIC_STATIC_PRERENDER_CANDIDATE',eligibleForPublicIndex:false,
    authoritativeStatus:null,reason:'ACTUAL_HTTP_AND_OWNER_DOMAIN_GATE_REQUIRED'
  });
  if (/^\/(?:[1-9][0-9]{0,15})(?:\/(?:[1-9][0-9]{0,15}))?\/?$/.test(pathname))
    return Object.freeze({kind:'UNACCEPTED_ENTITY_ID_ROUTE',
      eligibleForPublicIndex:false,authoritativeStatus:null,reason:'HOST_HTTP_AND_RIGHTS_NOT_ACCEPTED'});
  if (/^\/(?:[a-z]{2}(?:-[A-Z]{2})?\/)?users\/[^/]+\/?$/.test(pathname))
    return Object.freeze({kind:'UNACCEPTED_PUBLIC_HANDLE_ROUTE',
      eligibleForPublicIndex:false,authoritativeStatus:null,reason:'HANDLE_AUTH_PRIVACY_CONSENT_UNVERIFIED'});
  if (/^\/library(?:\/|$)/.test(pathname))
    return Object.freeze({kind:'PRIVATE_ACCOUNT_ROUTE',
      eligibleForPublicIndex:false,authoritativeStatus:null,reason:'SIGNED_SESSION_RLS_REQUIRED'});
  return Object.freeze({kind:'UNACCEPTED_OR_UNKNOWN',eligibleForPublicIndex:false,
    authoritativeStatus:null,reason:'NO_DIRECT_PUBLIC_ROUTE_APPROVAL'});
}

// Future 301 aliases require server-side immutable identity, current visibility,
// consent, approved redirect permanence and actual HTTPS. Never infer an
// irreversible redirect from syntax or client side navigation alone.
export const PUBLIC_ALIAS_REDIRECTS_ACCEPTED = false;
export const PUBLIC_USER_PROFILE_HTTP200_ACCEPTED = false;
export const PUBLIC_ENTITY_HTTP200_ACCEPTED = false;
