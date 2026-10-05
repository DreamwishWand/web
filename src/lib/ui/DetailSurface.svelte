<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import Sheet from './Sheet.svelte';
  export let open = false;
  export let title: string;
  export let closeLabel = 'Close';
  export let position: 'end' | 'bottom' | 'full' = 'end';
  const dispatch = createEventDispatcher();
</script>

<Sheet bind:open {title} {closeLabel} {position} on:close={() => dispatch('close')}>
  <div class="detail-surface">
    <slot />
  </div>
  <div slot="actions" class="detail-surface-actions"><slot name="actions" /></div>
</Sheet>
