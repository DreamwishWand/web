# Community Core launch search policy — 2026-09-30

Status: **HIGH CONFIDENCE LAUNCH CONTRACT**

## Launch backend

Dreamwish Wand Community launch search uses **PostgreSQL SearchDocument projection** as the
canonical search backend.

No external search provider (Algolia, Meilisearch, Elasticsearch/OpenSearch, hosted vector search,
etc.) is a first-launch dependency.

This keeps public discovery available whenever the core Wand backend is available and avoids adding
another identity/privacy/index-synchronization boundary before product-shaped acceptance.

## Public search contract

Canonical searchable source:

- `public.search_documents`

Public query surface:

- `public.community_search_public(...)`

The RPC is `SECURITY INVOKER`; it does not bypass SearchDocument RLS.

Only works that satisfy the existing discoverability contract can be returned:

- lifecycle = published;
- visibility = public;
- moderation = clear;
- backing CommunityEntity/work remains non-deleted/discoverable.

UNLISTED and PRIVATE content are not searchable even when their SearchDocument row exists.

## Search semantics

Launch search supports:

- case-insensitive substring keyword search over title + public text content;
- `work_type` filter;
- CreatorProfile filter;
- all-of tag filtering;
- stable cursor pagination by `published_at + work_id`;
- 1..50 results per request;
- maximum 100-character keyword query;
- maximum 20 requested tags.

`pg_trgm` indexes back title/text substring lookup. This avoids making English stemming/tokenization
a launch assumption and is more suitable for mixed-language user-generated text, including Japanese,
than an English-only text-search configuration.

Search ranking at launch is intentionally simple:

- filtered results are ordered by newest `published_at`, then `work_id` for deterministic cursor
  pagination.

Relevance ranking, popularity ranking, semantic/vector search and personalized recommendation are
separate later product/search-ranking work. They must not change Community identity/visibility or
moderation semantics.

## Security / privacy

- SearchDocument remains a derived projection, never the owner of canonical work state.
- RLS remains authoritative even when the search RPC is called anonymously.
- A search result does not grant access to content that later becomes unavailable.
- Moderation/privacy lifecycle changes must remove or make the projection non-discoverable through
  the same canonical state transition.
- Private save data, provider identity, email, report detail, moderation-only data and raw Preset
  payloads are not search fields.
- No external search provider receives Community data at first launch.

## Staging runtime evidence

A rollback-scoped real staging test created one PUBLIC and one UNLISTED synthetic Gallery
SearchDocument with the same Japanese keyword.

Under `anon` role:

- keyword `夜空` result count = 1;
- PUBLIC fixture found = 1;
- UNLISTED fixture found = 0;
- `gallery + garden` tag filter found the PUBLIC fixture = 1.

The transaction was rolled back; no search fixture remained.

## Upgrade boundary

An external search engine may be introduced later only if measured workload or product ranking needs
justify it.

Any future provider must consume the canonical SearchDocument/public projection and must preserve:

- stable Community IDs;
- visibility/moderation/tombstone convergence;
- deletion propagation;
- no indexing of private/unlisted content unless a separate non-enumerable direct-access contract is
  explicitly designed;
- provider outage must not become a prerequisite for local DDV save editing.

## Launch acceptance

Before launch:

1. execute public keyword search through the browser product path;
2. verify PUBLIC positive and UNLISTED/PRIVATE negative behavior;
3. verify work type / creator / tags filtering;
4. verify pagination has no duplicate/omitted rows across a stable result set;
5. verify moderation/unpublish/delete removes search discoverability;
6. verify stale SavedItem does not become a search/access bypass.

No external search-provider account or secret is required for launch.
