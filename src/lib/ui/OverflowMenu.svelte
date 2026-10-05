<script lang="ts">
  import Icon from './Icon.svelte';
  export let label: string;
</script>

<details class="overflow-menu">
  <summary aria-label={label} title={label}>
    <Icon name="more" decorative={true} />
    <span class="visually-hidden">{label}</span>
  </summary>
  <div class="overflow-menu-panel"><slot /></div>
</details>
