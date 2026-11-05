<script lang="ts">
  import { onMount } from 'svelte';
  import { afterNavigate } from '$app/navigation';
  import { page } from '$app/stores';
  import { base } from '$app/paths';
  import { locale, t, SUPPORTED_LOCALES } from '$lib/i18n/runtime.js';
  import { resetToBrowserLanguage, setManualLocalePreference } from '$lib/i18n/preference.js';
  import Icon from '$lib/ui/Icon.svelte';
  import IconButton from '$lib/ui/IconButton.svelte';
  import Sheet from '$lib/ui/Sheet.svelte';
  import { shellState, setShellContextActions } from '$lib/ui/shell-state.js';
  import { resolveProductShell } from '$lib/ui/product-shell-navigation.mjs';

  type ShellAction = { id: string; label: string; href?: string | null; icon?: string; current?: boolean; disabled?: boolean; pressed?: boolean; expanded?: boolean; intent?: string };
  type ShellSnapshot = {
    save: { state: string; label: string; status: string; href: string | null };
    account: { signedIn: boolean; label: string; href: string | null };
    notifications: { available: boolean; unread: boolean; href: string | null };
    contextActions: ShellAction[];
  };
  let theme: 'night' | 'day' = 'night';
  let mobileSettingsOpen = false;
  let mobileSectionsOpen = false;
  $: shell = $shellState as ShellSnapshot;
  $: productNav = resolveProductShell($page.url.pathname, $locale);
  afterNavigate(() => {
    mobileSettingsOpen = false;
    mobileSectionsOpen = false;
    setShellContextActions([]);
  });

  onMount(() => {
    theme = document.documentElement.dataset.theme === 'day' ? 'day' : 'night';
  });

  function toggleTheme(): void {
    theme = theme === 'night' ? 'day' : 'night';
    document.documentElement.dataset.theme = theme;
    try { localStorage.setItem('dreamwishwand-theme', theme); } catch { /* private mode */ }
  }
  function changeLocale(event: Event): void {
    setManualLocalePreference((event.currentTarget as HTMLSelectElement).value);
  }
  function useBrowserLanguage(): void {
    void resetToBrowserLanguage();
  }
  function accountLabel(): string {
    return shell.account.signedIn
      ? (shell.account.label || t('shared.shell.profile', {}, $locale))
      : t('shared.shell.signIn', {}, $locale);
  }
  function saveLabel(): string {
    if (shell.save.state === 'loaded') return shell.save.label || t('shared.shell.ddvSave', {}, $locale);
    if (shell.save.state === 'limited' || shell.save.state === 'unavailable') {
      return shell.save.label || t('shared.shell.saveLimited', {}, $locale);
    }
    return t('shared.shell.saveLimited', {}, $locale);
  }
</script>

<a class="skip-link" href="#main-content">{t('shared.a11y.skipToContent', {}, $locale)}</a>
<header class="site-header" data-shared-app-shell data-shell-presentation={productNav.presentation} data-current-product={productNav.id || "home"}>
  <div class="desktop-app-toolbar">
    <a class="app-home-action ui-icon-button" href={base + '/'} aria-label={t('shared.shell.home', {}, $locale)} title={t('shared.shell.home', {}, $locale)}>
      <Icon name="home" decorative={true} />
    </a>

    <div class="brand" aria-label={t('shared.brand.label', {}, $locale)}>
      <span class="brand-mark" aria-hidden="true">
        <svg viewBox="0 0 48 48" fill="none" aria-hidden="true"><path d="M10 37 34 13" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/><path d="m32 5 2.7 6.3L41 14l-6.3 2.7L32 23l-2.7-6.3L23 14l6.3-2.7L32 5Z" stroke="currentColor" stroke-width="1.8"/><path d="m13 8 1.4 3.6L18 13l-3.6 1.4L13 18l-1.4-3.6L8 13l3.6-1.4L13 8Z" fill="currentColor"/></svg>
      </span>
      <span class="brand-wordmark">Dreamwish <span>Wand</span></span>
    </div>

    <nav class="toolbar-context" aria-label={productNav.rootLabel || t('shared.shell.contextActions', {}, $locale)} data-product-local-navigation>
      {#if productNav.rootHref}
        <a class="toolbar-context-link product-root-link" data-product-root href={base + productNav.rootHref} aria-current={productNav.atRoot ? 'page' : undefined}>{productNav.rootLabel}</a>
        {#each productNav.sections as section (section.id)}
          <a class="toolbar-context-link" data-product-section={section.id} href={base + section.href} aria-current={section.current ? 'page' : undefined}>{section.label}</a>
        {/each}
      {:else}
        <a class="toolbar-context-link" href={base + '/discover/'}>
          <Icon name="sparkle" decorative={true} size={17} />
          <span>{t('shared.shell.discoverWand', {}, $locale)}</span>
        </a>
      {/if}
    </nav>
    {#if productNav.presentation === 'immersive'}
      <div class="immersive-nav" data-immersive-recovery>
        <a class="toolbar-context-link product-root-link" href={base + productNav.rootHref}>{productNav.rootLabel}</a>
        <button type="button" class="toolbar-context-link" aria-expanded={mobileSectionsOpen} on:click={() => mobileSectionsOpen = true}>{productNav.rootLabel} · {t('shared.shell.contextActions', {}, $locale)}</button>
        <button type="button" class="toolbar-context-link immersive-settings" on:click={() => mobileSettingsOpen = true}>{t('shared.shell.settings', {}, $locale)}</button>
      </div>
    {/if}

    <div class="toolbar-globals" aria-label={t('shared.shell.globalControls', {}, $locale)}>
      {#if shell.save.href}
        <a class="shell-control save-control" data-shell-control="save" href={shell.save.href}>
          <Icon name="save" decorative={true} /><span>{saveLabel()}</span>
          {#if shell.save.status}<small>{shell.save.status}</small>{/if}
        </a>
      {:else}
        <button class="shell-control save-control" data-shell-control="save" type="button" disabled aria-label={saveLabel()} title={t('shared.shell.saveLimited', {}, $locale)}>
          <Icon name="save" decorative={true} /><span>{saveLabel()}</span>
          {#if shell.save.status}<small>{shell.save.status}</small>{/if}
        </button>
      {/if}

      {#if shell.account.signedIn && shell.notifications.available}
        {#if shell.notifications.href}
          <a class="shell-control notification-control" data-shell-control="notifications" href={shell.notifications.href} aria-label={t('shared.shell.notifications', {}, $locale)}>
            <Icon name="bell" decorative={true} />
            <span>{t('shared.shell.notifications', {}, $locale)}</span>
            {#if shell.notifications.unread}<small class="notification-unread">{t('shared.shell.notificationsUnread', {}, $locale)}</small>{/if}
          </a>
        {:else}
          <button class="shell-control notification-control" data-shell-control="notifications" type="button" disabled title={t('shared.shell.notifications', {}, $locale)}>
            <Icon name="bell" decorative={true} />
            <span>{t('shared.shell.notifications', {}, $locale)}</span>
            {#if shell.notifications.unread}<small class="notification-unread">{t('shared.shell.notificationsUnread', {}, $locale)}</small>{/if}
          </button>
        {/if}
      {/if}

      {#if shell.account.href}
        <a class="shell-control account-control" data-shell-control="account" href={shell.account.href}>
          <Icon name="account" decorative={true} /><span>{accountLabel()}</span>
        </a>
      {:else}
        <button class="shell-control account-control" data-shell-control="account" type="button" disabled title={accountLabel()}>
          <Icon name="account" decorative={true} /><span>{accountLabel()}</span>
        </button>
      {/if}

      <div class="locale-control">
        <label class="visually-hidden" for="site-locale">{t('shared.locale.label', {}, $locale)}</label>
        <select id="site-locale" class="locale-select" value={$locale} on:change={changeLocale}>
          {#each SUPPORTED_LOCALES as option}<option value={option.code}>{option.nativeName}</option>{/each}
        </select>
        <button class="locale-reset" type="button" on:click={useBrowserLanguage}>{t('shared.locale.useBrowserLanguage', {}, $locale)}</button>
      </div>

      <button class="theme-button" type="button" aria-label={theme === 'night' ? t('shared.theme.switchToDay', {}, $locale) : t('shared.theme.switchToNight', {}, $locale)} aria-pressed={theme === 'day'} on:click={toggleTheme}>
        <Icon name={theme === 'night' ? 'sun' : 'moon'} decorative={true} />
        <span class="theme-label">{theme === 'night' ? t('shared.theme.light', {}, $locale) : t('shared.theme.dark', {}, $locale)}</span>
      </button>
    </div>
  </div>

  <div class="mobile-app-toolbar">
    <a class="app-home-action ui-icon-button" href={base + '/'} aria-label={t('shared.shell.home', {}, $locale)} title={t('shared.shell.home', {}, $locale)}>
      <Icon name="home" decorative={true} />
    </a>
    {#if productNav.rootHref}
      <a class="mobile-brand" href={base + productNav.rootHref} aria-current={productNav.atRoot ? 'page' : undefined}>{productNav.rootLabel}</a>
    {:else}
      <span class="mobile-brand">Dreamwish Wand</span>
    {/if}
    <div class="mobile-global-actions">
      {#if productNav.sections.length}
        <button class="ui-icon-button" type="button" data-mobile-product-sections aria-label={productNav.rootLabel} aria-expanded={mobileSectionsOpen} on:click={() => mobileSectionsOpen = true}>
          <Icon name="more" decorative={true} />
        </button>
      {/if}
      {#if shell.account.signedIn && shell.notifications.available}
        {#if shell.notifications.href}
          <a class="ui-icon-button" data-shell-control="notifications-mobile" href={shell.notifications.href} aria-label={t('shared.shell.notifications', {}, $locale)}>
            <Icon name="bell" decorative={true} />
            {#if shell.notifications.unread}<span class="mobile-unread-text">{t('shared.shell.unread', {}, $locale)}</span>{/if}
          </a>
        {:else}
          <button class="ui-icon-button" type="button" disabled aria-label={t('shared.shell.notifications', {}, $locale)}><Icon name="bell" decorative={true} /></button>
        {/if}
      {/if}
      {#if shell.account.href}
        <a class="ui-icon-button" data-shell-control="account-mobile" href={shell.account.href} aria-label={accountLabel()}><Icon name="account" decorative={true} /></a>
      {:else}
        <button class="ui-icon-button" data-shell-control="account-mobile" type="button" disabled aria-label={accountLabel()} title={accountLabel()}>
          <Icon name="account" decorative={true} />
        </button>
      {/if}
      <IconButton icon="settings" label={t('shared.shell.settings', {}, $locale)} on:activate={() => mobileSettingsOpen = true} />
    </div>
  </div>
</header>

<Sheet bind:open={mobileSettingsOpen} title={t('shared.shell.settings', {}, $locale)} closeLabel={t('shared.dialog.close', {}, $locale)} position="bottom">
  <div class="mobile-settings">
    <a class="toolbar-context-link" href={base + '/discover/'}>
      <Icon name="sparkle" decorative={true} size={17} />
      <span>{t('shared.shell.discoverWand', {}, $locale)}</span>
    </a>
    {#if shell.account.href}
      <a class="toolbar-context-link" href={shell.account.href} data-shell-settings-account>{accountLabel()}</a>
    {:else}
      <span class="disabled-reason" data-shell-settings-account-unavailable aria-disabled="true">{accountLabel()}</span>
    {/if}
    {#if shell.account.signedIn && shell.notifications.available && shell.notifications.href}
      <a class="toolbar-context-link" href={shell.notifications.href} data-shell-settings-notifications>{t('shared.shell.notifications', {}, $locale)}</a>
    {/if}
    <label for="site-locale-mobile">{t('shared.locale.label', {}, $locale)}</label>
    <select id="site-locale-mobile" class="locale-select" value={$locale} on:change={changeLocale}>
      {#each SUPPORTED_LOCALES as option}<option value={option.code}>{option.nativeName}</option>{/each}
    </select>
    <button class="locale-reset" type="button" on:click={useBrowserLanguage}>{t('shared.locale.useBrowserLanguage', {}, $locale)}</button>
    <button class="theme-button" type="button" aria-pressed={theme === 'day'} on:click={toggleTheme}>
      <Icon name={theme === 'night' ? 'sun' : 'moon'} decorative={true} />
      <span>{theme === 'night' ? t('shared.theme.light', {}, $locale) : t('shared.theme.dark', {}, $locale)}</span>
    </button>
  </div>
</Sheet>

{#if productNav.rootHref && productNav.sections.length}
  <Sheet bind:open={mobileSectionsOpen} title={productNav.rootLabel} labelledBy="shell-section-sheet-title" closeLabel={t('shared.dialog.close', {}, $locale)} position="bottom">
    <nav class="product-section-sheet" aria-label={productNav.rootLabel} data-product-local-mobile>
      <a href={base + productNav.rootHref} aria-current={productNav.atRoot ? 'page' : undefined}>{productNav.rootLabel}</a>
      {#each productNav.sections as section (section.id)}
        <a href={base + section.href} data-product-section={section.id} aria-current={section.current ? 'page' : undefined}>{section.label}</a>
      {/each}
    </nav>
  </Sheet>
{/if}

<style>
  .site-header[data-shell-presentation='standard'] { position: sticky; top: 0; }
  .toolbar-context-link[aria-current='page'], .product-section-sheet a[aria-current='page'] { border-color: var(--gold); color: var(--gold); font-weight: 800; }
  .product-root-link { font-weight: 850; }
  .immersive-nav { display: none; }
  .site-header[data-shell-presentation='immersive'] { position: sticky; top: 0; }
  .site-header[data-shell-presentation='immersive'] .desktop-app-toolbar { min-height: 56px; grid-template-columns: auto minmax(0,1fr) auto; }
  .site-header[data-shell-presentation='immersive'] .brand,
  .site-header[data-shell-presentation='immersive'] .toolbar-context,
  .site-header[data-shell-presentation='immersive'] .toolbar-globals { display: none; }
  .site-header[data-shell-presentation='immersive'] .immersive-nav { min-width: 0; display: flex; align-items: center; gap: 8px; overflow-x: auto; }
  .site-header[data-shell-presentation='immersive'] .immersive-nav .toolbar-context-link { flex: 0 0 auto; }
  .product-section-sheet { display: grid; gap: 10px; padding: 6px 0 14px; }
  .product-section-sheet a { display: flex; min-height: 44px; align-items: center; padding: 10px 14px; border: 1px solid var(--border); border-radius: 12px; background: var(--surface); overflow-wrap: anywhere; }
  .shell-control:disabled, .ui-icon-button:disabled { cursor: not-allowed; opacity: .55; }
  @media (max-width: 820px) {
    .site-header[data-shell-presentation='immersive'] .mobile-app-toolbar { display: flex; }
    .mobile-brand { min-width: 0; flex: 1 1 auto; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  }
  @media (max-width: 460px) {
    .mobile-app-toolbar { gap: 5px; }
    .mobile-global-actions { gap: 3px; }
  }
</style>
