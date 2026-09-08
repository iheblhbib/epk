import { useLayoutEffect, useRef, type RefObject, type SyntheticEvent } from 'react'

/**
 * Settings-panel fields write into a shared React Query cache on every
 * keystroke (see useDraftSectionConfig.ts) so the live preview updates
 * instantly. That write notifies every subscriber of the cache -- including
 * this same field, through its own `value` prop -- as a re-render the input
 * didn't itself trigger via a normal onChange -> setState round trip.
 * Browsers reset the native caret to the end of the value whenever it's
 * reassigned that way, even to an unchanged string, which is exactly the
 * "cursor jumps to the end" bug: type anywhere but the end of a field (or
 * select and retype a word) and every keystroke after the first lands at
 * the end instead of where you're actually looking.
 *
 * Attach the returned `onChange` alongside the field's own onChange (it
 * fires first, so it always sees the caret the browser just placed) and
 * pass the same ref used for the input/textarea itself -- this restores
 * that remembered position after every render where it's drifted.
 */
export function useStableCaret<T extends HTMLInputElement | HTMLTextAreaElement>(ref: RefObject<T | null>) {
  const caret = useRef<{ start: number; end: number } | null>(null)

  useLayoutEffect(() => {
    const el = ref.current
    const remembered = caret.current
    if (!el || !remembered || document.activeElement !== el) return
    if (remembered.start > el.value.length || remembered.end > el.value.length) return

    // input types other than text/search/tel/url/password (email, number,
    // date, ...) throw InvalidStateError on any selection access at all --
    // this field never has a remembered caret for one of those (see below),
    // but guard the restore too rather than assume every caller matches.
    try {
      if (el.selectionStart === remembered.start && el.selectionEnd === remembered.end) return
      el.setSelectionRange(remembered.start, remembered.end)
    } catch {
      // Selection isn't supported on this element -- nothing to restore.
    }
  })

  return {
    onChange: (event: SyntheticEvent<T>) => {
      const el = event.currentTarget
      try {
        caret.current = {
          start: el.selectionStart ?? el.value.length,
          end: el.selectionEnd ?? el.value.length,
        }
      } catch {
        // Selection isn't supported on this element (e.g. type="email") --
        // nothing to remember, so there's nothing later to restore either.
        caret.current = null
      }
    },
  }
}
