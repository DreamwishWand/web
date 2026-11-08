// Static-build, server-only canonical origin gate. No runtime Auth or HTTP server.
// The generated HTML itself, not a client-inserted tag, is the SEO evidence.
import { base } from '$app/paths';
import { canonicalForApprovedStaticPath } from '$lib/foundation/canonical-domain-preview.mjs';

export function load({ url }) {
  return {
    canonicalPreview: canonicalForApprovedStaticPath(url.pathname, {
      basePath: base,
      origin: process.env.WAND_CANONICAL_BUILD_ORIGIN ?? ''
    })
  };
}
