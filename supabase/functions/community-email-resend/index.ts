type OperatorEmailEnvelope = {
  schema?: unknown;
  purpose?: unknown;
  idempotencyKey?: unknown;
  subject?: unknown;
  text?: unknown;
};

function reply(body: unknown, status = 200) {
  return Response.json(body, {
    status,
    headers: { 'Cache-Control': 'private, no-store' }
  });
}

async function sha256(value: string): Promise<Uint8Array> {
  const encoded = new TextEncoder().encode(value);
  return new Uint8Array(await crypto.subtle.digest('SHA-256', encoded));
}

async function constantTimeEqual(left: string, right: string): Promise<boolean> {
  const [a, b] = await Promise.all([sha256(left), sha256(right)]);
  let diff = a.length ^ b.length;
  const length = Math.max(a.length, b.length);
  for (let index = 0; index < length; index += 1) {
    diff |= (a[index % a.length] ?? 0) ^ (b[index % b.length] ?? 0);
  }
  return diff === 0;
}

function requiredEnv(name: string): string | null {
  const value = Deno.env.get(name)?.trim() ?? '';
  return value || null;
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return reply({ ok: false, error: 'POST required' }, 405);
  }

  const relayToken = requiredEnv('COMMUNITY_EMAIL_RELAY_TOKEN');
  const resendApiKey = requiredEnv('RESEND_API_KEY');
  const from = requiredEnv('DREAMWISH_EMAIL_FROM');
  const operatorEmail = requiredEnv('DREAMWISH_OPERATOR_EMAIL');

  if (!relayToken || !resendApiKey || !from || !operatorEmail) {
    return reply({ ok: false, error: 'EMAIL_RELAY_NOT_CONFIGURED' }, 503);
  }

  const authorization = req.headers.get('authorization') ?? '';
  const prefix = 'Bearer ';
  if (!authorization.startsWith(prefix)) {
    return reply({ ok: false, error: 'RELAY_AUTH_REQUIRED' }, 401);
  }

  const suppliedToken = authorization.slice(prefix.length);
  if (!(await constantTimeEqual(suppliedToken, relayToken))) {
    return reply({ ok: false, error: 'RELAY_AUTH_INVALID' }, 401);
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
      from,
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
});
