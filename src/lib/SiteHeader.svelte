<script lang="ts">
  import { onMount } from 'svelte';
  import { base } from '$app/paths';
  import { locale, t, SUPPORTED_LOCALES } from '$lib/i18n/runtime.js';
  import { resetToBrowserLanguage, setManualLocalePreference } from '$lib/i18n/preference.js';
  import Icon from '$lib/ui/Icon.svelte';
  import IconButton from '$lib/ui/IconButton.svelte';
  import Sheet from '$lib/ui/Sheet.svelte';
  import { dispatchShellIntent, shellState } from '$lib/ui/shell-state.js';

  let theme: 'night' | 'day' = 'night';
  let mobileSettingsOpen = false;

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
  function activate(intent: string, detail = {}): void {
    dispatchShellIntent(intent, detail);
  }
  function accountLabel(): string {
    return $shellState.account.signedIn
      ? ($shellState.account.label || t('shared.shell.profile', {}, $locale))
      : t('shared.shell.signIn', {}, $locale);
  }
  function saveLabel(): string {
    if ($shellState.save.state === 'loaded') return $shellState.save.label || t('shared.shell.ddvSave', {}, $locale);
    if ($shellState.save.state === 'limited' || $shellState.save.state === 'unavailable') {
      return $shellState.save.label || t('shared.shell.saveLimited', {}, $locale);
    }
    return t('shared.shell.openSave', {}, $locale);
  }
</script>

<a class="skip-link" href="#main-content">{t('shared.a11y.skipToContent', {}, $locale)}</a>
<header class="site-header" data-shared-app-shell>
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

    <nav class="toolbar-context" aria-label={t('shared.shell.contextActions', {}, $locale)}>
      <a class="toolbar-context-link" href={base + '/discover/'}>
        <Icon name="sparkle" decorative={true} size={17} />
        <span>{t('shared.shell.discoverWand', {}, $locale)}</span>
      </a>
      {#each $shellState.contextActions as action}
        {#if action.href && !action.disabled}
          <a class="toolbar-context-link" href={action.href} aria-current={action.current ? 'page' : undefined}>
            {#if action.icon}<Icon name={action.icon} decorative={true} size={17} />{/if}
            <span>{action.label}</span>
          </a>
        {:else}
          <button
            class="toolbar-context-link"
            type="button"
            aria-pressed={action.pressed}
            aria-expanded={action.expanded}
            aria-disabled={action.disabled ? 'true' : undefined}
            disabled={action.disabled}
            on:click={() => activate(action.intent || action.id, { id: action.id })}
          >
            {#if action.icon}<Icon name={action.icon} decorative={true} size={17} />{/if}
            <span>{action.label}</span>
          </button>
        {/if}
      {/each}
    </nav>

    <div class="toolbar-globals" aria-label={t('shared.shell.globalControls', {}, $locale)}>
      {#if $shellState.save.href}
        <a class="shell-control save-control" data-shell-control="save" href={$shellState.save.href}>
          <Icon name="save" decorative={true} /><span>{saveLabel()}</span>
          {#if $shellState.save.status}<small>{$shellState.save.status}</small>{/if}
        </a>
      {:else}
        <button class="shell-control save-control" data-shell-control="save" type="button" on:click={() => activate('open-ddv-save', { state: $shellState.save.state })}>
          <Icon name="save" decorative={true} /><span>{saveLabel()}</span>
          {#if $shellState.save.status}<small>{$shellState.save.status}</small>{/if}
        </button>
      {/if}

      {#if $shellState.account.signedIn && $shellState.notifications.available}
        {#if $shellState.notifications.href}
          <a class="shell-control notification-control" data-shell-control="notifications" href={$shellState.notifications.href} aria-label={t('shared.shell.notifications', {}, $locale)}>
            <Icon name="bell" decorative={true} />
            <span>{t('shared.shell.notifications', {}, $locale)}</span>
            {#if $shellState.notifications.unread}<small class="notification-unread">{t('shared.shell.notificationsUnread', {}, $locale)}</small>{/if}
          </a>
        {:else}
          <button class="shell-control notification-control" data-shell-control="notifications" type="button" on:click={() => activate('open-notifications')}>
            <Icon name="bell" decorative={true} />
            <span>{t('shared.shell.notifications', {}, $locale)}</span>
            {#if $shellState.notifications.unread}<small class="notification-unread">{t('shared.shell.notificationsUnread', {}, $locale)}</small>{/if}
          </button>
        {/if}
      {/if}

      {#if $shellState.account.href}
        <a class="shell-control account-control" data-shell-control="account" href={$shellState.account.href}>
          <Icon name="account" decorative={true} /><span>{accountLabel()}</span>
        </a>
      {:else}
        <button class="shell-control account-control" data-shell-control="account" type="button" on:click={() => activate($shellState.account.signedIn ? 'open-account' : 'sign-in')}>
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
    <span class="mobile-brand">Dreamwish Wand</span>
    <div class="mobile-global-actions">
      {#if $shellState.account.signedIn && $shellState.notifications.available}
        <button class="ui-icon-button" data-shell-control="notifications-mobile" type="button" aria-label={t('shared.shell.notifications', {}, $locale)} on:click={() => activate('open-notifications')}>
          <Icon name="bell" decorative={true} />
          {#if $shellState.notifications.unread}<span class="mobile-unread-text">{t('shared.shell.unread', {}, $locale)}</span>{/if}
        </button>
      {/if}
      <button class="ui-icon-button" data-shell-control="account-mobile" type="button" aria-label={accountLabel()} on:click={() => activate($shellState.account.signedIn ? 'open-account' : 'sign-in')}>
        <Icon name="account" decorative={true} />
      </button>
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
