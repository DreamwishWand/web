
-- Community canonical tables are not a direct browser/Data API surface.
-- This prevents UNLISTED content from becoming enumerable through unrestricted table scans.
revoke select on all tables in schema public from anon, authenticated;

-- Public discovery is the only direct client-readable projection in v0.
grant select on public.search_documents to anon, authenticated;

-- search_documents RLS still requires the backing work to be PUBLIC+CLEAR+PUBLISHED.
