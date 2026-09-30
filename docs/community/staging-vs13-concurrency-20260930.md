# Community Core VS-13 true concurrency staging result — 2026-09-30

Status: **CONFIRMED PASS at the Community PostgreSQL concurrency boundary**

Staging: `dreamwish-wand-staging` / `ap-northeast-1`.

## Purpose

Close the remaining VS-13 gap that could not be satisfied by sequential retry tests. The test had to prove that separate PostgreSQL backends actually overlapped while contending for the same logical Community state.

The connector-level `Promise.all` experiment was **not** accepted as evidence: although each call received a different backend PID, the connector serialized the requests several seconds apart. That result was discarded.

## Method

Temporary A/B WandAccount + CreatorProfile fixtures and one PUBLIC/PUBLISHED Gallery target were created in isolated staging. Temporary DDV Profile fixtures were also created for the account-limit race.

For the accepted test, independent `pg_cron` jobs were scheduled at a 5-second interval. Each job:

1. ran in its own PostgreSQL backend;
2. recorded `pg_backend_pid()` and its start time;
3. slept for 1 second before the contested mutation so independently started jobs necessarily overlapped;
4. executed the real Community function / trigger path;
5. recorded finish time, result or error.

Each slot wrote once to a temporary private result table. Jobs were unscheduled after the first execution. The normal Community outbox cron remained enabled.

## Results

| Race | Workers | Distinct backend PIDs | Start spread | Minimum measured overlap | RPC/job outcome | Final canonical state |
| --- | ---: | ---: | ---: | ---: | --- | --- |
| Save same entity | 6 | 6 | 10.135 ms | 1001.331 ms | 6/6 calls succeeded | exactly 1 SavedItem |
| Follow same Creator | 6 | 6 | 23.682 ms | 986.286 ms | 6/6 calls succeeded | exactly 1 Follow; exactly 1 follow Outbox event |
| Add same Reaction kind | 6 | 6 | 23.489 ms | 994.518 ms | 6/6 calls succeeded | exactly 1 Reaction; exactly 1 reaction Outbox event |
| Same idempotency key / Create Gallery Draft | 6 | 6 | 23.210 ms | 998.310 ms | 6/6 calls succeeded | all 6 returned the same workId; exactly 1 idempotency row, 1 CommunityWork and 1 draft-created Outbox event |
| DDV Profile cap: simultaneous candidate #3/#4 from a starting count of 2 | 2 | 2 | 8.264 ms | 995.501 ms | 1 insert succeeded; 1 rejected with `A Wand Account may link at most three DDV Profiles` | exactly 3 linked DDV Profiles |

The idempotency race returned one distinct work ID across all six workers:
`c63824af-e343-47b3-ab97-ca11710a9faa` (temporary fixture; removed after evidence capture).

The DDV Profile race proved the per-account transaction advisory lock closes the classic check-then-insert race: both contenders began within 8.264 ms, but only one became the third link and the other observed/rejected the post-lock count.

## Evidence classification

**CONFIRMED**

- Save/Follow/Reaction uniqueness holds under actual overlapping multi-backend contention.
- Follow/Reaction event dedupe remains one logical Outbox event under contention.
- Gallery-draft idempotency advisory locking returns the same committed response under concurrent retries and creates one aggregate.
- The three-DDV-Profile boundary is transaction-safe under concurrent inserts.

This closes the prior VS-13 **PARTIAL / HIGH CONFIDENCE** gap at the Community database/transaction boundary.

## Boundary

This does not replace browser/app acceptance. The product-shaped Community Lab still needs execution with real staging Auth users and an actual signed media upload. VS-13 itself, however, is no longer blocked on a parallel-session database test.

## Cleanup requirement

All `vs13-*` cron jobs, temporary Community fixtures, DDV Profile fixtures, interaction rows, Outbox/Notification/Audit rows associated with those fixtures, idempotency rows and the private result table must be removed after capture. A zero-residue verification is required before this result is considered complete.
