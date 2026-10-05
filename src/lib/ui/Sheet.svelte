<script lang="ts">
  import { createEventDispatcher, onDestroy } from 'svelte';
  import { closeModalDialog, openModalDialog, trapDialogTab } from '$lib/a11y/dialog-focus.js';
  import Icon from './Icon.svelte';

  export let open = false;
  export let title: string;
  export let closeLabel = 'Close';
  export let position: 'end' | 'bottom' | 'full' = 'end';
  export let labelledBy = '';
  let dialog: HTMLDialogElement;
  let closeButton: HTMLButtonElement;
  let restoreFocus: (() => void) | null = null;
  let opening = false;
  const dispatch = createEventDispatcher();

  $: if (open && dialog && !dialog.open && !opening) {
    opening = true;
    restoreFocus = openModalDialog(dialog, { initialFocus: closeButton });
    queueMicrotask(() => { opening = false; });
  }
  $: if (!open && dialog?.open && !opening) {
    closeSheet(false);
  }

  function closeSheet(notify = true) {
    if (restoreFocus) {
      restoreFocus();
      restoreFocus = null;
    } else {
      closeModalDialog(dialog);
    }
    open = false;
    if (notify) dispatch('close');
  }
  function cancel(event: Event) {
    event.preventDefault();
    closeSheet();
  }
  function backdrop(event: MouseEvent) {
    if (event.target === dialog) closeSheet();
  }
  onDestroy(() => {
    if (dialog?.open) closeModalDialog(dialog);
  });
</script>

<dialog
  bind:this={dialog}
  class="ui-sheet"
  class:ui-sheet-end={position === 'end'}
  class:ui-sheet-bottom={position === 'bottom'}
  class:ui-sheet-full={position === 'full'}
  aria-labelledby={labelledBy || 'ui-sheet-title'}
  on:cancel={cancel}
  on:click={backdrop}
  on:keydown={(event) => trapDialogTab(event, dialog)}
>
  <div class="ui-sheet-panel">
    <header class="ui-sheet-header">
      <h2 id={labelledBy || 'ui-sheet-title'}>{title}</h2>
      <button bind:this={closeButton} class="ui-icon-button" type="button" aria-label={closeLabel} title={closeLabel} on:click={() => closeSheet()}>
        <Icon name="close" decorative={true} />
      </button>
    </header>
    <div class="ui-sheet-body"><slot /></div>
    <slot name="actions" />
  </div>
</dialog>
