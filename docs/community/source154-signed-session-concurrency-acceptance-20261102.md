# 03 COMM — signed Source154 concurrency and GoTrue compatibility negative acceptance

2026-11-02 · isolated test-only child of QR-scoped PR308 HEAD `719da738700b8c16ac1d8115fe5ff60b7620d828`. DRAFT / DO_NOT_MERGE / DO_NOT_DEPLOY.

This tests the existing Source154 product bytes without modifying its SQL/Edge or historic PR304/306 evidence. It executes the inherited genuine GoTrue ES256 A1/A2/B/M local FULL154 suite and adds C01–C07 using two+ independent PostgreSQL connections, actual signed Edge and direct PostgREST calls. The additional signed CI is an Owner run requiring separate NEW-only QR judgement.

**C01/C03**: Source153 A1/A2 authorized before terminal commit. An independent SQL backend holds AuthIdentity row FOR SHARE while a real signed A1 local logout HTTP (using its original JWT) attempts FOR UPDATE; pg_blocking_pids must confirm real lock contention, not just a sleep. The call cannot finish before the first transaction commits. After releasing the lock, local terminal commit succeeds, Source153 A1 goes 401 and A2 remains 200. The earlier 200 was a historically completed read, not a reusable permit for later output or writes. We do not assert a network response arriving during an actual UI tab lifecycle.

**C02**: a direct authenticated privileged Owner-action SQL RPC made with revoked A1 must fail with no Work rowVersion mutation. Its supplied historical expected version may be stale; this test only demonstrates rejection for revoked A1, **not** proof that an eligible pre-revoke writer would have committed or proof for every writer/TOCTOU interleaving.

**C04/C05**: independently repeat actual PostgreSQL FOR SHARE/FOR UPDATE lock interleaving for A2 GLOBAL signed revoke after A1 is already locally revoked. After committed global cutoff, A1/A2 Source153 and direct privileged writer calls deny, independent B/M sessions are not globally revoked (their foreign Work 403 remains expected). The existing direct OwnerAuthority and Read R01–R10 signed suite remains inherited.

**C06**: inspect GoTrue-managed `auth.sessions` registration contract on CLI2.109.0: `id` and `user_id` each UUID, a primary key, authenticated cannot insert. This is a single pinned version; does **not** prove future GoTrue compatibility. Deleted/missing session old JWT is already directly checked in inherited R09. No unsupported forged JWTs are minted.

**C07**: an intentionally added disposable PostgreSQL table column is rolled back in the same transaction. Its absence is checked; Source153 A3 still reads200. This is ONLY transactional DDL rollback, **not** proof of full migration downgrade or schema migration rollback. No Source154 down-migration is authorized; forward-only migration rollback needs an independently tested deployment/restore plan.

**Unaccepted:** true delayed browser responses after logout, a privileged Writer successfully beginning before revocation then committing after its terminal boundary (DB-lock concurrency plus denied postcommit writer is a bounded subset), session_id rotation across future GoTrue upgrades, full GoTrue schema delete/alter and restore, more than the two tested Owner RPCs, Provider/Managed HTTPS/BFF/CORS/CDN, production application signOut wiring. Unknown semantics must fail closed. Owner/Writer/Publish flags OFF. No Stage116, real users, external Provider, Cloud or Native Apply.
