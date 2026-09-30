import { withSupabase } from 'npm:@supabase/server';

type EscalationJob = {
  deliveryId: string;
  alertId: string;
  alertType: string;
  severity: 'critical';
  occurrence: number;
  firstSeenAt: string;
  lastSeenAt: string;
  attempts: number;
};

function reply(body: unknown, status = 200) {
  return Response.json(body, {
    status,
    headers: { 'Cache-Control': 'private, no-store' }
  });
}

function messageOf(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (error && typeof error === 'object' && 'message' in error) {
    return String((error as { message?: unknown }).message ?? 'external escalation failed');
  }
  return String(error ?? 'external escalation failed');
}

export default {
  fetch: withSupabase({ auth: 'none' }, async (req, ctx) => {
    if (req.method !== 'POST') return reply({ ok: false, error: 'POST required' }, 405);

    const workerToken = req.headers.get('x-community-worker-token') ?? '';
    if (!workerToken) return reply({ ok: false, error: 'WORKER_AUTH_REQUIRED' }, 401);

    const { data: workerAuthorized, error: workerAuthError } =
      await ctx.supabaseAdmin.rpc('community_verify_worker_token', {
        p_worker_name: 'operations_escalation',
        p_token: workerToken
      });

    if (workerAuthError || workerAuthorized !== true) {
      return reply({ ok: false, error: 'WORKER_AUTH_INVALID' }, 401);
    }

    const { data: destination, error: destinationError } =
      await ctx.supabaseAdmin.rpc('community_get_operations_escalation_destination');

    if (destinationError) {
      return reply(
        { ok: false, error: 'DESTINATION_CONFIGURATION_INVALID', message: destinationError.message },
        500
      );
    }

    if (destination?.enabled !== true) {
      return reply({ ok: true, enabled: false, claimed: 0, delivered: 0, failed: 0 });
    }

    const url = String(destination.url ?? '');
    const authToken = typeof destination.authToken === 'string' ? destination.authToken : '';
    if (!url.startsWith('https://')) {
      return reply({ ok: false, error: 'DESTINATION_CONFIGURATION_INVALID' }, 500);
    }

    const body = await req.json().catch(() => ({}));
    const requestedLimit = Number((body as { limit?: unknown }).limit ?? 20);
    const limit = Math.max(1, Math.min(50, Math.trunc(requestedLimit || 20)));
    const lockToken = crypto.randomUUID();

    const { data: claimed, error: claimError } = await ctx.supabaseAdmin.rpc(
      'community_claim_operations_escalations',
      { p_limit: limit, p_lock_token: lockToken }
    );

    if (claimError) {
      return reply({ ok: false, error: 'CLAIM_FAILED', message: claimError.message }, 500);
    }

    const jobs = Array.isArray(claimed?.jobs) ? (claimed.jobs as EscalationJob[]) : [];
    const results: Array<Record<string, unknown>> = [];

    for (const job of jobs) {
      try {
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
          'User-Agent': 'DreamwishWand-CommunityOps/1'
        };
        if (authToken) headers.Authorization = `Bearer ${authToken}`;

        const response = await fetch(url, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            schema: 'dreamwishwand.community.operations-alert.v1',
            environment: 'staging',
            alertId: job.alertId,
            alertType: job.alertType,
            severity: job.severity,
            occurrence: job.occurrence,
            firstSeenAt: job.firstSeenAt,
            lastSeenAt: job.lastSeenAt,
            operationsPath: '/community-ops/'
          })
        });

        if (!response.ok) {
          throw Object.assign(
            new Error(`External escalation HTTP ${response.status}`),
            { httpStatus: response.status }
          );
        }

        const { data: completed, error: completeError } = await ctx.supabaseAdmin.rpc(
          'community_complete_operations_escalation',
          {
            p_delivery_id: job.deliveryId,
            p_lock_token: lockToken,
            p_http_status: response.status
          }
        );
        if (completeError) throw completeError;

        results.push({
          deliveryId: job.deliveryId,
          ok: true,
          outcome: 'delivered',
          state: completed?.state ?? 'delivered'
        });
      } catch (error) {
        const status =
          error && typeof error === 'object' && 'httpStatus' in error
            ? Number((error as { httpStatus?: unknown }).httpStatus)
            : null;

        const { data: failed, error: failError } = await ctx.supabaseAdmin.rpc(
          'community_fail_operations_escalation',
          {
            p_delivery_id: job.deliveryId,
            p_lock_token: lockToken,
            p_error: messageOf(error),
            p_http_status: Number.isInteger(status) ? status : null
          }
        );
        if (failError) {
          results.push({ deliveryId: job.deliveryId, ok: false, outcome: 'fail-rpc-error' });
          continue;
        }
        results.push({
          deliveryId: job.deliveryId,
          ok: false,
          outcome: 'failed',
          state: failed?.state ?? null
        });
      }
    }

    return reply({
      ok: true,
      enabled: true,
      claimed: jobs.length,
      delivered: results.filter((result) => result.ok === true).length,
      failed: results.filter((result) => result.ok !== true).length,
      results
    });
  })
};
