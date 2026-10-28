<!-- Applies only to Editor routes; body content keeps its own responsive width. -->
<slot />

<style>
  :global(.site-header .header-inner) {
    width: calc(100% - 32px);
    max-width: none;
    margin-inline: 16px;
    min-height: 66px;
  }
  @media (max-width: 620px) {
    :global(.site-header .header-inner) {
      width: calc(100% - 24px);
      margin-inline: 12px;
    }
  }
</style>
