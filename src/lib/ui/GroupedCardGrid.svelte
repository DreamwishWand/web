<script lang="ts">
  export let label: string;
  export let minCardWidth = '15rem';
  export let className = '';
</script>

<section class={'grouped-card-grid ' + className} aria-label={label} style:--card-min={minCardWidth}>
  <div class="responsive-card-grid"><slot /></div>
</section>
