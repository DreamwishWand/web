<script lang="ts">
  export let name = 'sparkle';
  export let label = '';
  export let decorative = true;
  export let size = 20;

  const paths: Record<string, string[]> = {
    home: ['M3.5 10.5 12 3l8.5 7.5','M5.5 9.5V21h13V9.5','M9.5 21v-6h5v6'],
    save: ['M4 4h13l3 3v13H4z','M8 4v6h8V4','M8 20v-6h8v6'],
    bell: ['M6 9a6 6 0 0 1 12 0c0 7 3 7 3 7H3s3 0 3-7','M10 20h4'],
    account: ['M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8','M4.5 21a7.5 7.5 0 0 1 15 0'],
    language: ['M4 5h10','M9 3v2c0 5-2.5 8-6 10','M6 9c2 3 4 5 7 6','M14 21l4-10 4 10','M15.5 17h5'],
    sun: ['M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8','M12 2v2','M12 20v2','M4.93 4.93l1.41 1.41','M17.66 17.66l1.41 1.41','M2 12h2','M20 12h2','M4.93 19.07l1.41-1.41','M17.66 6.34l1.41-1.41'],
    moon: ['M20 15.5A8.5 8.5 0 0 1 8.5 4 8.5 8.5 0 1 0 20 15.5Z'],
    settings: ['M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7','M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.12 3.67-.09-.03a1.7 1.7 0 0 0-1.79.34l-.8.64h-4l-.8-.64a1.7 1.7 0 0 0-1.79-.34l-.09.03L6.2 16.94l.06-.06A1.7 1.7 0 0 0 6.6 15l-.14-.94-2.12-1.22v-3.68l2.12-1.22.14-.94a1.7 1.7 0 0 0-.34-1.88l-.06-.06L8.32 1.4l.09.03a1.7 1.7 0 0 0 1.79-.34L11 0.45h2l.8.64a1.7 1.7 0 0 0 1.79.34l.09-.03 2.12 3.67-.06.06A1.7 1.7 0 0 0 17.4 7l.14.94 2.12 1.22v3.68l-2.12 1.22-.14.94Z'],
    close: ['M5 5l14 14','M19 5 5 19'],
    chevron: ['M9 5l7 7-7 7'],
    filter: ['M3 5h18l-7 8v6l-4 2v-8z'],
    search: ['M11 18a7 7 0 1 1 0-14 7 7 0 0 1 0 14','M16.5 16.5 21 21'],
    more: ['M5 12h.01','M12 12h.01','M19 12h.01'],
    grip: ['M8 7h.01','M16 7h.01','M8 12h.01','M16 12h.01','M8 17h.01','M16 17h.01'],
    check: ['M4 12.5 9.5 18 20 6'],
    plus: ['M12 5v14','M5 12h14'],
    sparkle: ['M12 2c.8 5.3 2.7 7.2 8 8-5.3.8-7.2 2.7-8 8-.8-5.3-2.7-7.2-8-8 5.3-.8 7.2-2.7 8-8Z'],
    heart: ['M20.8 5.8c-2.2-2.2-5.7-2.2-7.9 0L12 6.7l-.9-.9a5.6 5.6 0 0 0-7.9 7.9L12 22l8.8-8.3a5.6 5.6 0 0 0 0-7.9Z'],
    collection: ['M4 5h16v14H4z','M8 9h8','M8 13h5'],
    book: ['M4 5.5A3.5 3.5 0 0 1 7.5 2H12v18H7.5A3.5 3.5 0 0 0 4 23.5z','M20 5.5A3.5 3.5 0 0 0 16.5 2H12v18h4.5a3.5 3.5 0 0 1 3.5 3.5z'],
    palette: ['M12 3a9 9 0 1 0 0 18h1.5a2 2 0 0 0 0-4H12a2 2 0 0 1 0-4h2a7 7 0 0 0-2-10Z'],
    gallery: ['M4 5h16v14H4z','M7 16l4-4 3 3 2-2 3 3','M9 9h.01'],
    camera: ['M4 7h4l1.5-2h5L16 7h4v12H4z','M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8'],
    qa: ['M4 4h16v13H9l-5 4z','M8 9h8','M8 13h5'],
    preset: ['M5 4h14v16H5z','M8 8h8','M8 12h8','M8 16h5']
  };
  $: iconPaths = paths[name] ?? paths.sparkle;
</script>

<svg
  class="ui-icon"
  viewBox="0 0 24 24"
  width={size}
  height={size}
  fill="none"
  stroke="currentColor"
  stroke-width="1.8"
  stroke-linecap="round"
  stroke-linejoin="round"
  aria-hidden={decorative ? 'true' : undefined}
  role={decorative ? undefined : 'img'}
  aria-label={decorative ? undefined : label}
  focusable="false"
>
  {#if !decorative && label}<title>{label}</title>{/if}
  {#each iconPaths as d}<path {d} />{/each}
</svg>
