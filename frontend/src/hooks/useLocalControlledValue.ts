import { useState } from 'react'

/**
 * Settings-panel fields write into a shared React Query cache on every
 * keystroke (see useDraftSectionConfig.ts) so the live preview updates
 * instantly, and that cache write is what feeds this same field's own
 * `value` prop back to it -- a re-render the field's own typing caused,
 * echoing back the exact string it just emitted. A plain controlled input
 * still reassigns `.value` on that re-render, which is what native browsers
 * reset the caret to the end of the value for, even though nothing the
 * user typed actually changed. useStableCaret used to paper over the
 * resulting jump by restoring the caret a frame later, which was still
 * visibly janky; this instead never lets the echo reach the input at all.
 *
 * Renders from local state that's updated the moment `onChange` fires, and
 * only adopts a new incoming `value` when it *doesn't* match what this same
 * hook last emitted -- i.e. a genuinely external change (switching to a
 * different field whose DOM node got reused, a value normalized server-side,
 * etc.), never this field's own keystroke echoing back through the cache.
 * Follows React's documented "adjusting state when a prop changes" pattern
 * (comparing during render, not in an effect) so the correction lands in
 * the same commit as the prop change -- state, not a ref, since refs
 * shouldn't be read or written during render.
 */
export function useLocalControlledValue(value: string) {
  const [state, setState] = useState(() => ({ local: value, lastProp: value, lastEmitted: value }))

  if (value !== state.lastProp) {
    setState((prev) =>
      value === prev.lastEmitted
        ? { ...prev, lastProp: value } // our own echo -- nothing to adopt, just stop re-checking it
        : { local: value, lastProp: value, lastEmitted: value } // genuinely external -- adopt it
    )
  }

  return {
    value: state.local,
    onChange: (nextValue: string) => {
      setState((prev) => ({ ...prev, local: nextValue, lastEmitted: nextValue }))
    },
  }
}
