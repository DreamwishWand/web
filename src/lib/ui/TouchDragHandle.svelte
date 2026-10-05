<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import Icon from './Icon.svelte';
  export let label: string;
  export let alternativeActionsId: string;
  export let disabled = false;
  let activePointer: number | null = null;
  const dispatch = createEventDispatcher();

  function pointerDown(event: PointerEvent) {
    if (disabled) return;
    activePointer = event.pointerId;
    (event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId);
    dispatch('dragstart', { pointerId: event.pointerId, x: event.clientX, y: event.clientY });
  }
  function pointerMove(event: PointerEvent) {
    if (activePointer !== event.pointerId) return;
    dispatch('dragmove', { pointerId: event.pointerId, x: event.clientX, y: event.clientY });
  }
  function pointerUp(event: PointerEvent) {
    if (activePointer !== event.pointerId) return;
    dispatch('dragend', { pointerId: event.pointerId, x: event.clientX, y: event.clientY });
    activePointer = null;
  }
</script>

<button
  type="button"
  class="touch-drag-handle"
  aria-label={label}
  aria-describedby={alternativeActionsId}
  aria-controls={alternativeActionsId}
  {disabled}
  on:pointerdown={pointerDown}
  on:pointermove={pointerMove}
  on:pointerup={pointerUp}
  on:pointercancel={pointerUp}
>
  <Icon name="grip" decorative={true} />
</button>
