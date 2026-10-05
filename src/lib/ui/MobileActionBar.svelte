<script lang="ts">
  export let label: string;
</script>

<div class="mobile-action-bar" role="region" aria-label={label}>
  <slot />
</div>
