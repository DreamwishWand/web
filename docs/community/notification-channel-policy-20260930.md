# Community Core launch notification-channel policy — 2026-09-30

Status: **HIGH CONFIDENCE LAUNCH CONTRACT**

## Launch channel map

Dreamwish Wand launch uses a deliberately small notification-channel set.

### 1. In-app Wand notifications

Primary channel for normal Community activity:

- Follow;
- Reaction;
- Comment;
- Reply;
- eligible Creator/publication activity;
- other product-approved Community events.

These use the canonical Community NotificationEvent / NotificationDelivery substrate.

Normal Community activity does **not** fan out to email.

Save itself does not generate a notification at launch.

### 2. Auth-provider transactional email

Provider-owned account/security flows:

- email verification;
- password recovery.

Auth email remains provider data and must not be converted into Community NotificationEvent payloads.

### 3. Wizard transactional email

Allowed launch categories only:

- important security notices;
- important moderation notices;
- Wand Cloud purchase notices;
- Gift notices.

These are not generic Community-activity fan-out. Each future implementation must use an explicit
approved email kind rather than treating every NotificationEvent as email-eligible.

### 4. Operator-only Operations email

Critical persistent Operations Alerts use the separate `operator_email` transport.

The canonical incident remains the persistent Operations Alert; operator email is only delivery.

## Channels not required at first launch

Not first-launch notification channels:

- Discord;
- Slack;
- SMS;
- mobile push;
- browser push.

Adding any later channel must consume canonical notification/operations state rather than becoming a
new ownership or event source of truth.

## Separation invariant

Sharing one transactional email provider does not merge the following:

- Supabase Auth email;
- Wizard transactional email;
- operator critical Operations email.

They may share provider infrastructure, sender-domain operations and secret rotation, while retaining
separate event semantics, eligibility and persistence.

## Community activity email denylist

At launch, the following must not produce email solely because the in-app notification exists:

- Comment;
- Reply;
- Reaction;
- Follow;
- Save;
- ordinary work-published/activity fan-out.

The code-level email policy mirrors this denylist.

## Privacy / preferences boundary

In-app activity preferences may later suppress eligible NotificationDelivery creation or presentation.

Wizard transactional email preference/mandatory-security rules require a separate policy when the
Security/Moderation/Cloud/Gift mail worker is implemented. Do not infer email consent from a Follow,
Save, Comment, Reaction or generic in-app notification setting.

Operator email is an internal operations configuration and is not a Wizard preference.

## Launch acceptance

Before launch:

1. confirm normal Community activity appears in Wand where expected;
2. confirm Comment/Reply/Reaction/Follow/Save never create email;
3. confirm Auth verification/recovery email works through the production provider;
4. confirm operator critical email works through the separate Operations transport;
5. for each implemented Wizard transactional category, confirm only explicitly approved categories can
   enter its mail queue;
6. confirm no push/SMS/Discord dependency exists in the launch path.

This closes the launch **notification channel mix**. Exact per-product event defaults still belong to
the owning product policy.
