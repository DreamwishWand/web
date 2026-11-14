# Dreamwish Wand transactional email public contract

This contract specifies the selected launch email architecture and acceptance boundaries. It is not a configuration runbook, evidence of current provider activation, or authorization to send mail, change DNS, provision resources, or enable production.

## Public configuration and separation

The selected transactional provider is Resend, with sending domain `dreamwishwand.com`. The Auth sender is `Dreamwish Wand <no-reply@dreamwishwand.com>`; the operator-critical sender is `Dreamwish Wand Ops <ops@dreamwishwand.com>`. The operator recipient is server-only configuration and is never committed or included in acceptance evidence.

Auth custom SMTP uses `smtp.resend.com`, TLS (465 SSL or 587 STARTTLS where supported), and the public SMTP username `resend`. **Dreamwish Wand Auth SMTP** denotes the dedicated Auth credential role; **Dreamwish Wand Ops Edge** denotes the separate HTTPS API credential role for `community-email-resend`. These labels are not credential values. The Auth credential is never exposed to Edge/browser code. Credentials, provider-issued DNS verification values, actual recipients and environment identifiers are excluded from public source and evidence.

The domain must be provider-verified; exact provider-issued DNS values, existing unrelated DNS/MX records, and reviewed DMARC policy are preserved. Domain configuration or a provider UI observation alone is not independent DNS or delivery acceptance. Email/password sign-in, required email confirmation, PKCE recovery and Wand session controls remain intact; rate-limit and endpoint/IP abuse protection must not be weakened for throughput.

## Operator delivery and authorization

The relay requires the server-side symbolic configuration names `RESEND_API_KEY` and `DREAMWISH_OPERATOR_EMAIL`. The From address is fixed in code to `Dreamwish Wand Ops <ops@dreamwishwand.com>`. No new relay secret is required. The `community-ops-email -> community-email-resend` hop uses the existing Vault-backed `operations_escalation` worker token, forwarded internally as `x-community-worker-token`; the relay verifies worker authorization and rejects invalid authorization. Neither credential values nor worker tokens are public.

The durable escalation channel is `operator_email`, bound to the authorized internal adapter. Delivery is conditional on verified provider/sender and required server-side configuration; no public feature or provider enablement follows from this contract. The persistent Operations Alert remains canonical; email is only its external projection.

## Staging acceptance criteria

Auth acceptance requires real browser signup, verification mail from the Auth sender, verified sign-in, PKCE recovery mail and callback, password update, and old/new session-cutoff behavior. Provider/SMTP configuration alone is not browser acceptance.

Operator acceptance requires one minimized mail per critical occurrence from the operator sender, canonical alert acknowledgment and resolution, recurrence as a new occurrence/new mail, and visible retry/dead-letter behavior on delivery failure. Canonical alerts survive delivery failure; self-monitor alerts do not recurse into the same failed email path. Payloads exclude provider subjects, Wizard email addresses, raw report detail, signed media URLs, passwords, tokens and private DDV data.

Normal Community activity remains in-app only:

- Comment / Reply -> no email
- Reaction -> no email
- Follow -> no email
- Save -> no email

## Production and outage boundary

Sender reputation/deliverability, bounce/complaint handling, appropriate Auth email capacity and abuse limits, separate credentials and rotation without repository changes are release acceptance requirements. Any provider plan or capacity change is a separate Owner decision, never implied by this contract. A Resend outage cannot notify through Resend. No second independent alert channel is required for first launch under the current single-operator, non-life-safety/non-financial workload; the boundary must be reconsidered if operational criticality or staffing changes.

Actual domain, mailbox, delivery, security, provider, privacy and production acceptance remains separately evidenced. No historical execution result is asserted here and no staging acceptance is promoted to production approval.
