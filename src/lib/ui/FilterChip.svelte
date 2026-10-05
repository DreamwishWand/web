<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import Icon from './Icon.svelte';
  export let label: string;
  export let selected = true;
  export let removable = false;
  export let removeLabel = '';
  export let disabled = false;
  const dispatch = createEventDispatcher();
  function activate() {
    dispatch(removable ? 'remove' : 'toggle', { selected: !selected });
  }
</script>

<button
  type="button"
  class="filter-chip"
  class:selected
  aria-pressed={selected}
  aria-label={removable && removeLabel ? removeLabel : label}
  {disabled}
  on:click={activate}
>
  <span>{label}</span>
  {#if removable}<Icon name="close" decorative={true} size={14} />{/if}
</button>
