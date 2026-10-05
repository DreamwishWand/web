<script lang="ts">
  import Icon from './Icon.svelte';
  export let href: string;
  export let title: string;
  export let description = '';
  export let icon = '';
  export let variant: 'standard' | 'horizontal' = 'standard';
  export let eyebrow = '';
</script>

<a class="visual-card" class:visual-card-horizontal={variant === 'horizontal'} {href}>
  {#if icon}<span class="visual-card-icon" aria-hidden="true"><Icon name={icon} decorative={true} size={28} /></span>{/if}
  <span class="visual-card-copy">
    {#if eyebrow}<span class="visual-card-eyebrow">{eyebrow}</span>{/if}
    <strong>{title}</strong>
    {#if description}<span>{description}</span>{/if}
  </span>
  <span class="visual-card-go" aria-hidden="true"><Icon name="chevron" decorative={true} /></span>
</a>
