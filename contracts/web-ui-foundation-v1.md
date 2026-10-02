# Shared Web UI Foundation v1

Status: implementation contract for first-party public/authenticated web surfaces.

## Scope
This contract owns shared localization and accessibility mechanics only. Product semantics, Product-specific copy, locale-preference policy, and Product interaction behavior remain with their owning streams.

## Localization
Launch registry is fixed to EN, FR, IT, DE, ES-ES, JA, ZH-CN and PT-BR. Runtime codes are `en`, `fr`, `it`, `de`, `es-ES`, `ja`, `zh-CN`, `pt-BR`.

- Registry: `src/lib/i18n/registry.js`
- Catalog schema: `src/lib/i18n/catalog-schema.js`
- Catalogs: `src/lib/i18n/messages/<locale>.js`
- Runtime API: `src/lib/i18n/runtime.js`
- Build gate/report: `npm run verify:web-foundation`

Stable message keys use dot-separated lowerCamelCase segments, e.g. `shared.nav.explore` and `shared.theme.switchToDay`. Core reason codes, internal enum values, contract IDs and blocker IDs are machine identifiers and MUST NOT be translated; UI owners map them to localized presentation keys.

Runtime exports: `locale.subscribe`, `setLocale`, `t`, `formatNumber`, `formatDate`, `setMissingKeyReporter`, `getLocaleDiagnostics`, `configureLocalePreferenceAdapter`, and `restoreLocalePreference`.

Fallback locale is EN. Missing locale keys fall back to EN and emit diagnostics; a key missing from both renders `⟦message.key⟧`. Plurals use objects with mandatory `other`; interpolation uses `{name}`. CI rejects missing/orphan keys and placeholder mismatches.

Locale persistence is deliberately a boundary, not a Product decision. No persistence adapter is installed by this foundation. Product may later install an adapter and decide when persistence is appropriate.

## Accessibility
Day-theme `--gold` is a text-facing token and MUST keep >=4.5:1 contrast against every shared day background on which normal gold text is used. CI currently gates `--page`, `--page-2`, `--surface`, `--surface-raised`, and the three tokenized day-hero gradient anchors.

Shared primitives:
- global `:focus-visible` ring for links, buttons, inputs, selects, textareas, summaries and explicit tabindex targets;
- `.visually-hidden` / `VisuallyHidden.svelte`;
- `LiveRegion.svelte`;
- `FieldError.svelte` + `formErrorAttributes`;
- native-dialog focus helpers in `dialog-focus.js`;
- explained disabled-state helpers in `disabled.js`.

If a disabled control's reason matters, prefer a focusable `aria-disabled="true"` control, guard activation, and connect reason text with `aria-describedby`. Native `disabled` remains valid where no explanation must be discoverable.

Dialog helpers assume native `<dialog>` with `showModal()`; Product code supplies title/description semantics and commit/close behavior.

## Handoff
02 WEP and Product UI owners consume this registry/runtime and add Product-owned namespaces without translating machine IDs. They remain responsible for Product copy completeness, long-string layout, screen-reader semantics and Product-specific keyboard behavior.

04 QR may close only `A11Y-DAY-GOLD-TEXT-CONTRAST` and `L10N-SHARED-INFRASTRUCTURE-MISSING` when CI/browser evidence passes. Full Product Tree WCAG/localization acceptance remains separate.
