import { withSupabase } from 'npm:@supabase/server';

type OperatorEmailEnvelope = {
  schema?: unknown;
  purpose?: unknown;
  idempotencyKey?: unknown;
  subject?: unknown;
  text?: unknown;
};

const FROM = 'Dreamwish Wand Ops <ops@dreamwishwand.com>';

function reply(body: unknown, status = 200) {
  return Response.json(body, {
    status,
    headers: { 'Cache-Control': 'private, no-store' }
  });
}

function requiredEnv(name: string): string | null {
  const value = Deno.env.get(name)?.trim() ?? '';
  return value || null;
}

export default {
  fetch: withSupabase({ auth: 'none' }, async (req, ctx) => {
    if (req.method !== 'POST') {
      return reply({ ok: false, error: 'POST required' }, 405);
    }

    const workerToken = req.headers.get('x-community-worker-token') ?? '';
    if (!workerToken) {
      return reply({ ok: false, error: 'WORKER_AUTH_REQUIRED' }, 401);
    }

    const { data: workerAuthorized, error: workerAuthError } =
      await ctx.supabaseAdmin.rpc('community_verify_worker_token', {
        p_worker_name: 'operations_escalation',
        p_token: workerToken
      });

    if (workerAuthError || workerAuthorized !== true) {
      return reply({ ok: false, error: 'WORKER_AUTH_INVALID' }, 401);
    }

    const resendApiKey = requiredEnv('RESEND_API_KEY');
    const operatorEmail = requiredEnv('DREAMWISH_OPERATOR_EMAIL');

    if (!resendApiKey || !operatorEmail) {
      return reply({ ok: false, error: 'EMAIL_RELAY_NOT_CONFIGURED' }, 503);
    }

    let body: OperatorEmailEnvelope;
    try {
      body = await req.json();
    } catch {
      return reply({ ok: false, error: 'INVALID_JSON' }, 400);
    }

    if (
      body.schema !== 'dreamwishwand.transactional-email.operator-critical.v1' ||
      body.purpose !== 'operator_critical_operations_alert'
    ) {
      return reply({ ok: false, error: 'UNSUPPORTED_EMAIL_PURPOSE' }, 400);
    }

    const idempotencyKey = String(body.idempotencyKey ?? '').trim();
    const subject = String(body.subject ?? '').trim();
    const text = String(body.text ?? '').trim();

    if (
      idempotencyKey.length < 1 ||
      idempotencyKey.length > 256 ||
      subject.length < 1 ||
      subject.length > 200 ||
      text.length < 1 ||
      text.length > 6000
    ) {
      return reply({ ok: false, error: 'INVALID_EMAIL_ENVELOPE' }, 400);
    }

    const providerResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': idempotencyKey,
        'User-Agent': 'DreamwishWand-TransactionalEmail/1'
      },
      body: JSON.stringify({
        from: FROM,
        to: [operatorEmail],
        subject,
        text
      })
    });

    const providerBody = await providerResponse.json().catch(() => ({}));

    if (!providerResponse.ok) {
      return reply(
        {
          ok: false,
          error: 'EMAIL_PROVIDER_FAILED',
          provider: 'resend',
          providerStatus: providerResponse.status
        },
        502
      );
    }

    return reply({
      ok: true,
      provider: 'resend',
      providerMessageId:
        providerBody && typeof providerBody === 'object' && 'id' in providerBody
          ? String((providerBody as { id?: unknown }).id ?? '')
          : null
    });
  })
};
