<script lang="ts">
  import { locale } from '$lib/i18n/runtime.js';
  import { timingUxCopy } from '$lib/timing/timing-ui-copy.js';

  export let row: any;
  export let onClose: () => void = () => {};
  // Deliberately tab-local text only. No file, byte buffer, mutation command or export.
  let proposed = '';
  let reason = '';
  $: copy = timingUxCopy($locale);
  $: previous = typeof row?.nextOccurrence === 'string' ? row.nextOccurrence : null;
</script>

<section class="timing-preview" data-w1-preview="unaccepted" data-writer="off"
  aria-labelledby="timing-preview-title">
  <div class="preview-heading">
    <div>
      <p class="eyebrow">{copy.preview}</p>
      <h2 id="timing-preview-title">{copy.details}: {row.name}</h2>
    </div>
    <button type="button" class="preview-close" on:click={onClose}>{copy.clear}</button>
  </div>
  <dl class="identity">
    <div><dt>EventID</dt><dd>{row.eventId ?? copy.unknown}</dd></div>
    <div><dt>Map Key</dt><dd>{row.mapKey}</dd></div>
    <div><dt>oneof</dt><dd>{row.oneof}</dd></div>
    <div><dt>LastOccurrence</dt><dd><code>{row.lastOccurrence ?? copy.unknown}</code></dd></div>
  </dl>
  <div class="preview-fields">
    <div class="original" data-timing-old="true">
      <h3>{copy.from}</h3>
      <code>{previous ?? copy.unknown}</code>
    </div>
    <div class="proposal" data-timing-new="true">
      <label for="timing-proposed">{copy.to}</label>
      <input id="timing-proposed" type="text" maxlength="48" bind:value={proposed}
        placeholder="YYYY-MM-DDTHH:mm:ssZ" aria-describedby="timing-proposal-warning"
        autocomplete="off" spellcheck="false" />
      <p class="local-value"><code>{proposed.trim() || copy.notEntered}</code></p>
    </div>
  </div>
  <label for="timing-reason">{copy.reason}</label>
  <textarea id="timing-reason" rows="2" maxlength="280" bind:value={reason}></textarea>
  <p class="warning" id="timing-proposal-warning" role="status">{copy.previewNote}</p>
  <p class="warning">{copy.future}</p>
  <p class="boundary" data-w1-write-authority="off">{copy.noSave}</p>
  <div class="actions">
    <button type="button" disabled data-timing-backup-off="true">{copy.backup}</button>
    <button type="button" disabled data-timing-export-off="true">{copy.edited}</button>
    <button type="button" disabled data-timing-apply-off="true">{copy.apply}</button>
  </div>
  <p class="privacy">{copy.privacy}</p>
</section>

<style>
  .timing-preview{margin:14px 0 0;padding:clamp(14px,3vw,24px);border:1px solid var(--border);border-radius:16px;background:var(--surface);overflow-wrap:anywhere}
  .preview-heading{display:flex;align-items:flex-start;justify-content:space-between;flex-wrap:wrap;gap:12px;margin-bottom:18px}
  .preview-heading h2{font-size:20px;margin:4px 0}
  .preview-close,.actions button{border:1px solid var(--border);border-radius:10px;background:var(--surface-raised);color:var(--ink);min-height:44px;padding:9px 14px}
  .identity{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin:0 0 18px}
  .identity>div{min-width:0}.identity dt{color:var(--ink-soft);font-size:12px}
  .identity dd{margin:4px 0 0;overflow-wrap:anywhere}
  .preview-fields{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin-bottom:15px}
  .preview-fields>div{padding:12px;border-radius:10px;border:1px solid var(--border);min-width:0}
  .preview-fields h3{font-size:13px;margin:0 0 11px}
  label{display:block;font-size:13px;font-weight:700;margin:0 0 8px}
  input,textarea{box-sizing:border-box;display:block;width:100%;max-width:100%;padding:10px;border:1px solid var(--border);background:var(--surface-raised);border-radius:9px;color:var(--ink);font:inherit}
  code{overflow-wrap:anywhere;word-break:break-word}.local-value{font-size:12px}
  .warning,.boundary{font-size:13px;line-height:1.6;color:var(--ink-soft)}
  .actions{display:flex;gap:10px;flex-wrap:wrap;margin-top:14px}
  .actions button:disabled{opacity:.57;cursor:not-allowed}
  .privacy{font-size:12px;color:var(--ink-soft)}
  button:focus-visible,input:focus-visible,textarea:focus-visible{outline:3px solid var(--focus-ring);outline-offset:3px}
  @media(max-width:600px){.identity,.preview-fields{grid-template-columns:1fr}}
</style>
