#!/usr/bin/env python3
"""09 INT R15: actual Source119 Gallery v4 vs held HISTORICAL linked Gallery Work.

This is a NEW narrow lock-closure case, not a replay of earlier Source119
Account/Artifact contention or shared-Artifact two-positive-writer tests.
All writes target disposable local Supabase seeded by exact119 migrations.
"""
import importlib.util
import json
import sys
from pathlib import Path
import psycopg

file = Path(__file__).with_name("09int-r15-owner119-real-cross-gallery-shared-artifact.py")
spec = importlib.util.spec_from_file_location("r15_cross_historical_base", file)
r = importlib.util.module_from_spec(spec)
sys.modules[spec.name] = r
spec.loader.exec_module(r)


def main():
    with psycopg.connect(r.url, autocommit=True) as seed:
        g = r.f.fixture(seed)
        historical = r.draft(seed, g)
        contender = r.draft(seed, g)
        assert historical["work"] != contender["work"]
        initial = r.state(seed, contender, "r15-historical-contender")
        assert initial[:4] == (0, 0, 0, 0), initial

        # This is the real public Source119 RPC, not a validation lock wrapper.
        published = r.execute_actual(seed, g, historical, "r15-historical-published")
        assert published.get("revisionId"), published
        hstate = r.state(seed, historical, "r15-historical-published")
        assert hstate[:4] == (1, 1, 1, 1), hstate
        graph = r.same_scope(seed, g, contender["work"])
        assert str(historical["work"]) in graph["galleryWorkIds"], (
            "HISTORICAL_GALLERY_MISSING_FROM_DISCOVERED_GRAPH", graph["galleryWorkIds"]
        )
        assert str(contender["work"]) in graph["galleryWorkIds"]
        graph_before = graph

    with psycopg.connect(r.url, autocommit=True) as locker, psycopg.connect(
        r.url, autocommit=True
    ) as other:
        assert r.one(locker, "SELECT pg_backend_pid()") != r.one(other, "SELECT pg_backend_pid()")
        # Deliberately hold ONLY the historical linked Gallery Work row.
        # Account, Artifact, PresetWork, requested Gallery Work remain free.
        locker.execute("BEGIN")
        try:
            held = r.one(
                locker,
                "SELECT work_id FROM public.community_works WHERE work_id=%s FOR UPDATE NOWAIT",
                (historical["work"],),
            )
            assert held == historical["work"]
            other.execute("BEGIN")
            other.execute("SET LOCAL lock_timeout='800ms'")
            try:
                try:
                    r.execute_actual(other, g, contender, "r15-historical-contender")
                except psycopg.Error as error:
                    assert error.sqlstate == "55P03", (
                        "HISTORICAL_LINKED_WORK_LOCK_NOT_ENFORCED",
                        error.sqlstate, str(error)
                    )
                else:
                    raise AssertionError("HISTORICAL_LINKED_WORK_LOCK_BYPASSED")
            finally:
                other.execute("ROLLBACK")
            assert r.state(other, contender, "r15-historical-contender") == initial, (
                "HISTORICAL_LOCK_FAILURE_LEFT_PARTIAL_WRITES"
            )
            assert r.state(other, historical, "r15-historical-published") == hstate
        finally:
            locker.execute("ROLLBACK")

        # A NEW actual RPC transaction can now proceed without stale
        # in-flight lock contention. It cannot manufacture a graph pin.
        assert r.same_scope(other, g, contender["work"]) == graph_before
        accepted = r.execute_actual(other, g, contender, "r15-historical-contender")
        assert accepted.get("revisionId")
        cstate = r.state(other, contender, "r15-historical-contender")
        assert cstate[:4] == (1, 1, 1, 1), cstate
        assert r.state(other, historical, "r15-historical-published") == hstate
        assert r.execute_actual(other, g, contender, "r15-historical-contender") == accepted
        assert r.state(other, contender, "r15-historical-contender") == cstate

    print(json.dumps({
        "case": "R15_OWNER119_REAL_HISTORICAL_LINKED_GALLERY_WORK_LOCK",
        "result": "PASS",
        "sourceRpc": "public.community_publish_gallery_v4",
        "twoPostgresBackends": True,
        "historicalGalleryFromCommittedRevision": True,
        "lockHeldOnHistoricalGalleryWorkOnly": True,
        "contenderSqlstate": "55P03",
        "failedRpcFullRollback": True,
        "freshActualRpcAfterRelease": True,
        "revisionSearchOutboxIdempotencyOnce": True,
        "sourceCallerExpectedGraphPinAvailable": False,
        "globallyCompleteGraph": False,
        "retirementAuthorized": False,
        "signedStagingOrMediaCdnExecuted": False
    }))


if __name__ == "__main__":
    main()
