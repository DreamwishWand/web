<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import Icon from './Icon.svelte';
  export let icon = 'sparkle';
  export let label: string;
  export let pressed: boolean | undefined = undefined;
  export let expanded: boolean | undefined = undefined;
  export let controls: string | undefined = undefined;
  export let disabled = false;
  export let tooltip: string | undefined = undefined;
  export let type: 'button' | 'submit' = 'button';
  const dispatch = createEventDispatcher();
</script>

<button
  class="ui-icon-button"
  {type}
  aria-label={label}
  aria-pressed={pressed}
  aria-expanded={expanded}
  aria-controls={controls}
  {disabled}
  title={tooltip ?? label}
  on:click={(event) => dispatch('activate', event)}
>
  <Icon name={icon} decorative={true} />
</button>
