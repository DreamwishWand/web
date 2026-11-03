<script lang="ts">
  import { base } from '$app/paths';
  import { locale } from '$lib/i18n/runtime.js';
  import { WAND_RC_PRODUCTS, WAND_RC_RESTRICTED_OPERATIONS, WAND_RC_TARGET } from '$lib/product-home/rc-manifest.js';
  $: ja = $locale === 'ja';
  const availability = {
    RC_REQUIRED: { en:'RC scope · not yet accepted', ja:'内部RC対象・未受入' },
    CONDITIONAL: { en:'Conditional · verify permission and version', ja:'条件付き・権限とバージョン要確認' },
    OFF: { en:'Unavailable · OFF', ja:'利用不可・OFF' }
  };
  function statusLabel(status: string, japan: boolean): string {
    return availability[status as keyof typeof availability]?.[japan?'ja':'en'] ?? 'Unavailable · OFF';
  }
</script>

<svelte:head>
  <title>{ja ? '利用範囲と制限' : 'Availability and limits'} | Dreamwish Wand</title>
  <meta name="description" content="Internal RC feature scope and explicit unavailable product capabilities. Nothing on this page enables private, publish or writer operations." />
</svelte:head>

<section class="container rc-overview" data-internal-rc-status="not-a-release-gate">
  <a class="back" href={base + '/'}>{ja ? '← ホームに戻る' : '← Back to home'}</a>
  <h1>{ja ? '利用範囲と制限' : 'Availability and limits'}</h1>
  <p class="explain">
    {ja
      ? 'ここに記載するRC対象は開発・検証範囲です。公開受入や書込みの許可を意味しません。未受入の操作はOFFのままです。'
      : 'RC scope describes planned development and testing. It is not public release acceptance or write authorization. Unaccepted operations remain OFF.'}
  </p>
  <p class="version" role="status" data-rc-version>{WAND_RC_TARGET.referenceVersion}</p>
  <p class="boundary" data-rc-owner-off role="status">
    {ja ? 'Community Owner・公開・認証済み管理・Writerは未受入のためOFFです。' :
      'Community Owner, publishing, authenticated management and Save Writer remain OFF pending independent acceptance.'}
  </p>
  <div class="status-legend" aria-label={ja ? '状態の凡例' : 'Status legend'}>
    {#each Object.keys(availability) as state}
      <span class="legend-item" data-rc-legend={state}>{statusLabel(state, ja)}</span>
    {/each}
  </div>
  <div class="product-list">
    {#each WAND_RC_PRODUCTS as product}
      <section class="product" data-rc-product={product.id}>
        <header>
          <h2><a href={base + product.href}>{product.name}</a></h2>
          {#if product.id === 'help'}<small>{ja ? '共通参加面・Core製品ではありません' : 'Participation surface · not a seventh Core product'}</small>{/if}
        </header>
        <ul>
          {#each product.jobs as item}
            <li data-rc-job={item.status}>
              <div class="job-name">
                <a href={base + item.href}>{item.name}</a>
                <span class="status" data-status={item.status}>{statusLabel(item.status, ja)}</span>
              </div>
              <p>{item.boundary}</p>
            </li>
          {/each}
        </ul>
      </section>
    {/each}
  </div>
  <section class="blocked" aria-labelledby="blocked-title">
    <h2 id="blocked-title">{ja ? '有効化していない操作' : 'Operations that remain disabled'}</h2>
    <ul>
      {#each WAND_RC_RESTRICTED_OPERATIONS as item}
        <li><strong>{item.name}</strong> — {statusLabel(item.status, ja)}</li>
      {/each}
    </ul>
    <p>{ja ? '2026年11月30日は内部RC目標日です。公開日ではありません。' :
      'November 30, 2026 is an internal RC target, not a public release date.'}</p>
  </section>
</section>

<style>
  .rc-overview{padding-block:clamp(26px,5vw,64px) 85px;max-width:1150px}
  .rc-overview h1{font:500 clamp(30px,5vw,58px) Georgia,serif;margin:16px 0}
  .back,.rc-overview a{color:var(--ink)}
  .back{display:inline-block;font-size:13px}
  .explain{max-width:75ch;line-height:1.7;color:var(--ink-soft)}
  .version,.boundary{padding:12px 16px;border:1px solid var(--border);border-radius:12px;background:var(--surface);overflow-wrap:anywhere}
  .version{font-size:13px}.boundary{font-size:14px;color:var(--ink-soft)}
  .status-legend{display:flex;gap:8px;flex-wrap:wrap;margin:22px 0}
  .legend-item,.status{font-size:12px;border:1px solid var(--border);padding:6px 8px;border-radius:9px;background:var(--surface-raised)}
  .product-list{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,330px),1fr));gap:14px}
  .product,.blocked{min-width:0;border:1px solid var(--border);border-radius:16px;padding:clamp(14px,3vw,22px);background:var(--surface)}
  .product h2,.blocked h2{font:500 clamp(22px,3vw,30px) Georgia,serif;margin:0 0 8px}
  .product small{color:var(--ink-muted);display:block;line-height:1.6}
  .product ul,.blocked ul{padding:0;list-style:none;display:grid;gap:12px}
  .product li{border-top:1px solid var(--border);padding-top:11px;min-width:0}
  .job-name{display:flex;align-items:flex-start;justify-content:space-between;gap:10px;flex-wrap:wrap}
  .job-name a{font-weight:650}
  .status{overflow-wrap:anywhere}
  .status[data-status="OFF"]{color:var(--ink-muted)}
  .product li p{font-size:12px;color:var(--ink-soft);line-height:1.5;margin:7px 0 0;overflow-wrap:anywhere}
  .blocked{margin-top:24px}.blocked li{font-size:13px;line-height:1.7;color:var(--ink-soft)}
  .blocked>p{font-size:13px;color:var(--ink-muted)}
  a:focus-visible{outline:3px solid var(--focus-ring);outline-offset:3px}
  @media(max-width:420px){.rc-overview{padding-inline:16px}.product-list{grid-template-columns:minmax(0,1fr)}}
</style>
