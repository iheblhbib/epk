/**
 * Moves the item at `index` one slot earlier/later, clamped to the array
 * bounds. Used by the builder's gallery-style settings editors (Photos,
 * Music, Releases, Videos, Press) for simple up/down reordering within one
 * section's config array — no drag-and-drop needed for this scale of list.
 */
export function moveItem<T>(items: T[], index: number, direction: 'up' | 'down'): T[] {
  const targetIndex = direction === 'up' ? index - 1 : index + 1
  if (targetIndex < 0 || targetIndex >= items.length) return items

  const next = [...items]
  const [moved] = next.splice(index, 1)
  next.splice(targetIndex, 0, moved)
  return next
}
