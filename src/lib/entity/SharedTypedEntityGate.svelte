<script lang="ts">
  import { base } from '$app/paths';
  import { safeTypedEntityReference, inspectNativeComposite } from './shared-typed-entity-contract.mjs';
  import { sharedTypedCopy } from './shared-typed-entity-copy.mjs';

  export let kind: string = '';
  export let primaryId: string = '';
  export let secondaryId: string | null = null;
  export let localeCode: string = 'en';
  export let mode: 'TYPED' | 'COMPOSITE' = 'TYPED';

  $: copy = sharedTypedCopy(localeCode);
  $: cleanKind = kind.toUpperCase();
  $: requested = mode === 'COMPOSITE'
    ? inspectNativeComposite(primaryId,secondaryId ?? '')
    : safeTypedEntityReference(cleanKind,primaryId);
  $: valid = mode === 'COMPOSITE'
    ? requested?.status === 'UNVERIFIED_RELATION'
    : requested !== null;
  $: kindTitle = mode === 'COMPOSITE' ? copy.composite : (copy.kinds[cleanKind] ?? copy.unknown);
  $: returnRoute = cleanKind === 'QUEST' ? '/guide/'
    : cleanKind === 'CREATOR' ? '/creator/'
    : cleanKind === 'WORK' ? '/gallery/'
    : cleanKind === 'PRESET' ? '/presets/' : '/collection/';
</script>

<svelte:head>
  <title>{copy.unavailable} | Dreamwish Wand</title>
  <meta name="robots" content="noindex,nofollow" />
  <meta name="description" content={copy.unavailable} />
</svelte:head>

<section class="container typed-detail" lang={localeCode}
  data-typed-entity-gate="closed" data-public-indexable="false" data-writer="off"
  data-provider="off" data-relations-verified="false" data-alias-resolved="false"
  data-personal-state="unknown">
  <nav aria-label={copy.back}>
    <a href={base + returnRoute}>{copy.back}</a>
  </nav>
  <header>
    <p class="eyebrow">{copy.preview}</p>
    <h1>{kindTitle}: {copy.unavailable}</h1>
    <p role="status" data-typed-unavailable="true">{valid ? copy.notVerified : copy.invalid}</p>
  </header>
  <div class="entity-grid">
    <section data-shared-card="identity">
      <h2>{copy.identity}</h2>
      <p>{kindTitle}</p>
      {#if valid}
        <p><small>{copy.requested} · {copy.notVerifiedLabel}</small></p>
        <code>{primaryId}{#if mode === 'COMPOSITE'}/{secondaryId}{/if}</code>
      {/if}
    </section>
    <section data-shared-card="version">
      <h2>{copy.version}</h2>
      <p>{copy.noSource}</p>
    </section>
    <section data-shared-card="relations">
      <h2>{copy.relations}</h2>
      <p>{copy.noRelations}</p>
    </section>
    <section data-shared-card="visibility">
      <h2>{copy.visibility}</h2>
      <p>{copy.private}</p>
    </section>
  </div>
  <p class="boundary">{copy.boundary}</p>
</section>
<style>
 .typed-detail{max-width:1000px;padding-block:42px 100px;min-height:60vh;overflow-wrap:anywhere}
 nav a{color:var(--gold);font-weight:650}
 header{margin:32px 0}
 h1{font-family:Georgia,serif;font-weight:500;font-size:clamp(30px,5vw,52px)}
 header p,.boundary{max-width:75ch;color:var(--ink-soft);line-height:1.65}
 .eyebrow{letter-spacing:.12em;color:var(--gold);font-size:12px}
 .entity-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}
 .entity-grid section{border:1px solid var(--border);background:var(--surface);border-radius:14px;padding:18px;min-width:0}
 .entity-grid h2{font-size:13px;color:var(--ink-soft)}
 .entity-grid p{font-size:14px;overflow-wrap:anywhere}
 code{display:inline-block;max-width:100%;white-space:normal;overflow-wrap:anywhere;font-size:12px}
 small{font-size:11px;color:var(--ink-muted)}
 a:focus-visible{outline:3px solid var(--gold);outline-offset:3px}
 @media(max-width:620px){.entity-grid{grid-template-columns:1fr}}
</style>
