# Shared Web UI Foundation v1

Status: implementation contract for first-party public/authenticated web surfaces.

## Scope
This contract owns shared localization/accessibility mechanics and the Product-approved device-local locale-preference implementation. Product-specific copy and Product interaction behavior remain with their owning streams.

## Localization
Launch registry is fixed to EN, FR, IT, DE, ES-ES, JA, ZH-CN and PT-BR. Runtime codes are `en`, `fr`, `it`, `de`, `es-ES`, `ja`, `zh-CN`, `pt-BR`.

- Registry: `src/lib/i18n/registry.js`
- Catalog schema: `src/lib/i18n/catalog-schema.js`
- Catalogs: `src/lib/i18n/messages/<locale>.js`
- Runtime API: `src/lib/i18n/runtime.js`
- Locale preference policy adapter/resolver: `src/lib/i18n/preference.js`
- Product contract: `wand.locale-preference-product@1`
- Build gate/report: `npm run verify:web-foundation`

Stable message keys use dot-separated lowerCamelCase segments. Core reason codes, internal enum values, contract IDs and blocker IDs are machine identifiers and MUST NOT be translated.

Runtime exports include `locale.subscribe`, `setLocale`, `setManualLocale`, `resetLocalePreference`, `t`, `formatNumber`, `formatDate`, `configureLocalePreferenceAdapter`, and `restoreLocalePreference`.

Fallback locale is EN. Missing locale keys fall back per-message to EN without changing the active/persisted locale.

## Locale preference — wand.locale-preference-product@1
Resolution precedence is:
1. current or persisted valid explicit manual device-local preference;
2. first resolvable browser preferred-language entry, in order;
3. EN.

Browser aliases are exact Product policy: `en-*`→en, `fr-*`→fr, `it-*`→it, `de-*`→de, `es-*`→es-ES, `ja-*`→ja, `pt-*`→pt-BR; bare zh / zh-CN / zh-SG / zh-Hans*→zh-CN. zh-Hant*, zh-TW, zh-HK and zh-MO do not auto-map to zh-CN.

Only explicit manual choice is persisted, under the first-party local key `dreamwishwand-locale-manual-v1`, as the canonical locale tag only. Browser-derived automatic locale is never persisted. Storage failure remains session-only and introduces no backend fallback.

`resetToBrowserLanguage()` clears the persisted manual choice and immediately re-runs browser resolution. Unsupported stored locale is cleared and then browser-resolved, with EN fallback.

Locale persistence is browser-profile/application-origin/device-local only. It is not attached to Wand Account, Creator, DDV Profile Workspace, Player ID/mdc, save, age, jurisdiction, permissions, moderation, DreamSnaps eligibility, entitlement or save capability. Sign-in/out, account switch and Workspace lifecycle/switches do not alter locale. There is no launch server sync or cross-device sync.

## Accessibility
Day-theme `--gold` remains governed by the closed composited-background WCAG AA gate. Shared focus-visible, visually-hidden, live-region, form-error, dialog-focus and explained-disabled primitives remain unchanged.

## Handoff
02 WEP and all Product UI owners consume the shared active locale and preference policy. They MUST NOT create a Product-local locale store, auth/workspace binding or independent selector semantics.

04 QR validates `QR-L10N-PREF-FIRST-VISIT`, `QR-L10N-PREF-MANUAL`, `QR-L10N-PREF-AUTH`, `QR-L10N-PREF-WORKSPACE`, `QR-L10N-PREF-DEVICE`, `QR-L10N-PREF-UPDATE`, `QR-L10N-PREF-STORAGE-FAIL`, and `QR-L10N-PREF-PRIVACY` on the shared shell plus representative Product surface and World Editor after WEP binding.
