# Community Core support recovery verification runtime evidence — 2026-09-30

Project: `dreamwish-wand-staging` / `ap-northeast-1`

Status:

- **CONFIRMED PASS** — fail-closed support-assisted recovery state machine at the real staging database boundary.
- **IMPLEMENTED / CI PASS** — JWT-required Community admin Edge and hidden Community Ops surface.
- **PENDING** — real browser/operator execution with a staging admin.

## Launch recovery contract

Support-assisted ownership recovery uses three explicit stages:

`Open -> Verify -> Complete`

A recovery case cannot skip Verify.

Current permitted verification method:

- `provider_recovery`

Currently disabled:

- `linked_ddv_profile`

Linked DDV Profile proof remains disabled until CORE confirms a stable DDV Profile claim/binding contract.

Public Creator/Profile information, screenshots, display names, published works or other publicly
observable data are not accepted by this contract as strong ownership proof.

The support case stores an **opaque external verification reference**, not the verification artifact
itself.

## Security boundary

Open, Verify and Complete all require:

- an active WandAccount;
- admin role;
- session-bound recent authentication.

The operator listing does not return:

- requested provider subject;
- verification-reference value.

After successful completion:

- requested provider subject is replaced by a case tombstone identifier;
- verification reference is cleared;
- the old active AuthIdentity is retired;
- the newly verified AuthIdentity becomes active;
- WandAccount / Creator / ownership graph remain unchanged.

All three privileged stages write AuditEvents.

## Real staging runtime — 8/8 PASS

Transaction-scoped runtime tests passed:

1. `linked_ddv_profile` verification was rejected while the stable claim contract is unresolved;
2. a `provider_recovery` case opened in `pending` verification state;
3. Complete before Verify was rejected;
4. explicit Verify moved the case to `verified`;
5. operator listing exposed verification method/state but not provider subject or verification-reference value;
6. verified case completed successfully while preserving the same WandAccount;
7. new AuthIdentity became active and the old AuthIdentity was retired under the same account;
8. completion scrubbed provider subject + verification reference and Open/Verify/Complete were all audited.

The synthetic fixture was transaction-scoped and rolled back.

## Operator surface

Internal route:

`/community-ops/`

The UI now exposes:

- Open case;
- Verify recovery evidence;
- Complete verified recovery.

The UI only offers `provider_recovery` and explicitly states that Linked DDV Profile recovery remains
disabled pending CORE stable-claim closure.

## Current boundary

The support-verification **procedure itself is now defined and backend-confirmed**.

Remaining acceptance is product-shaped execution:

1. sign in as a real staging admin;
2. open a real disposable recovery case using a non-secret opaque verification reference;
3. confirm pre-Verify completion fails;
4. Verify;
5. Complete;
6. confirm ownership stability and secret-free operator evidence.

No password, JWT, provider subject, recovery token or raw verification artifact is recorded here.
