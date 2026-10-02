<script lang="ts">
  export let id: string;
  export let message: string;
</script>
<p {id} class="field-error" data-field-error>{message}</p>
