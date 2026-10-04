# DreamSnaps Integrity / Privacy Product Decision — 2026-10-02

Status: **PRODUCT CLOSED — ENGINEERING ENFORCEMENT + PRIVACY/LEGAL REVIEW REMAIN**

## Competitive image integrity

A Wand competitive DreamSnaps entry must be a **game screenshot**.

External post-processing that changes the competitive image is prohibited, including added text/logos/graphics, decorative frames, compositing and other external visual edits.

Competition presentation must use a consistent full-screenshot presentation. Wand may validate file/dimension/aspect/full-screen properties where those checks are reliable, but it must not claim that file metadata can cryptographically prove that an image was never edited.

Enforcement is layered:

- explicit submission rule/attestation;
- reliable upload validation;
- suspicious-content detection where appropriate;
- reports and moderation.

The exact detection algorithm is an Engineering/QA matter, not a remaining Product-owner decision.

## Active Voting privacy

During active Voting / Formal Judging, Wand hides creator identity and social/popularity signals. Do not show comments, reactions, follower popularity, current rank/vote state, Formal Judging totals or similar influence signals.

## Official save-derived results

Official in-game DreamSnaps result history is **private by default**. Score, rank, Moonstones, Pixel Dust and related save-derived result metadata are not automatically published with a public image.

After Results, the owner may explicitly choose to expose supported official-result fields.

## Under-13-managed DreamSnaps

The parent/guardian Wand Account is the submission actor.

After Results, the work may receive ordinary non-text reactions and saves/favorites. Comments/replies remain disabled at launch.

Public creator attribution uses the parent Creator Profile. The child Workspace identity and under-13-managed provenance are not public metadata.

## Remaining gates

Product integrity/privacy semantics are closed. Remaining work is technical upload/integrity enforcement, browser/runtime acceptance, and Privacy/Legal review. Overall launchReady remains false.
