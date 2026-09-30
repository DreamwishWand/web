Deno.serve(() =>
  Response.json(
    { ok: false, error: 'STAGING_E2E_DISABLED' },
    { status: 410, headers: { 'Cache-Control': 'no-store' } }
  )
);
