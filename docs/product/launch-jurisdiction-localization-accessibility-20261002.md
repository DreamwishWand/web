# Launch Jurisdiction / Localization / Accessibility Product Decision — 2026-10-02

Status: **PRODUCT APPROVED — PRIVACY + LEGAL JURISDICTION REVIEW STILL REQUIRED**

## Global launch position

Dreamwish Wand is a **global product by default**.

- Accountless/local Wand functionality is not region-locked as a Product rule.
- Wand Account and Community participation are also intended for global launch.
- If Privacy/Legal determines that a jurisdiction cannot be supported at launch, Wand may fail closed for account registration and/or Community writes in that jurisdiction rather than disabling local/accountless features globally.
- Signed-out public browsing remains available where lawful.
- The exact jurisdiction/age-assurance mechanism is an implementation and Privacy/Legal matter, not a Product reason to make Wand Japan-only, US-only, or otherwise region-limited by default.

## Launch languages

The launch locale set tracks the languages supported by the current supported Disney Dreamlight Valley release.

Current verified set:

- English
- French
- Italian
- German
- Spanish — Spain
- Japanese
- Simplified Chinese
- Portuguese — Brazil

Wand does not plan independent expansion into languages for which DDV/game data has no supported locale.

Locale parity is an **update acceptance gate**: when DDV adds a supported language, that language enters Wand's required first-party locale set for the supported release.

First-party localization includes navigation/UI, errors/status/recovery text, canonical Wand Database labels/taxonomy, launch Guide content, moderation/report reasons, and required account/auth/security/moderation transactional messages.

User-generated content remains in its original language at launch. Automatic translation of creator titles/body text is not required. Localized entity names, tags and taxonomy may still improve search/discovery.

## Accessibility launch target

Launch target: **WCAG 2.2 Level AA** for public and launch-critical authenticated web UI.

Product-specific acceptance includes:

- keyboard-operable core jobs;
- a non-drag alternative where dragging is used;
- visible/non-obscured focus;
- semantic control names/roles and accessible validation/status messaging;
- AA contrast and responsive layouts;
- screen-reader-compatible navigation, forms, dialogs and command-disabled reasons;
- appropriate target sizes and pointer alternatives;
- World Editor launch-critical operations must not be drag-only.

Creator-supplied media cannot be guaranteed intrinsically accessible, but Wand must keep surrounding controls and metadata accessible and support descriptive metadata where applicable.

## Boundary

These Product decisions are closed. Privacy and Legal must still review jurisdiction-specific availability, age/minor requirements, accessibility obligations and final Terms/Privacy language. Overall launchReady remains false.
