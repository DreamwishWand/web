// Read-only projection for the upcoming Svelte EditorSession UI.
// Does not mutate a profile, allocate slots, or infer capacity from Inventory.length.
export function backpackSlots(profile, entries = [], pending = new Map()) {
  const container = profile?.Player?.ContainerInventories?.['0'];
  if (!container || !Number.isSafeInteger(container.Size) || container.Size < 0 || !Array.isArray(container.Inventory) || container.Inventory.length > container.Size) return null;
  const length = Math.min(container.Size, 96);
  const bySlot = new Map(entries.filter(e => e.containerKey === '0').map(e => [e.slotIndex, e]));
  const cells = Array.from({ length }, (_, index) => {
    const entry = bySlot.get(index);
    if (entry) return {
      index, status: entry.editable ? 'editable' : 'readonly', entry,
      itemID: entry.itemID, amount: pending.get(entry.path)?.to ?? entry.amount,
      original: entry.amount
    };
    const raw = container.Inventory[index];
    const safelyEmpty = raw == null || (typeof raw === 'object' &&
      (raw.ItemID === undefined || raw.ItemID === 0) &&
      (raw.Amount === undefined || raw.Amount === 0) &&
      (raw.State == null || (typeof raw.State === 'object' && Object.keys(raw.State).length === 0)) &&
      Object.keys(raw).every(k => ['ItemID', 'Amount', 'State'].includes(k)));
    return { index, status: safelyEmpty ? 'empty' : 'unknown', itemID: null, amount: null };
  });
  return { capacity: container.Size, truncated: container.Size > length, cells };
}
