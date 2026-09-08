import { act, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { useLocalControlledValue } from './useLocalControlledValue'

describe('useLocalControlledValue', () => {
  it('keeps rendering its own value when the prop echoes back exactly what it last emitted', () => {
    // This is the real shape of the bug: useDraftSectionConfig writes every
    // keystroke into a React Query cache so the live preview updates
    // instantly, and that cache write is what feeds this field's `value`
    // prop back to it on the next render -- an echo of exactly what this
    // field itself just typed, not an external change.
    let value = 'ABCDEFGH'

    const { result, rerender } = renderHook(() => useLocalControlledValue(value))

    act(() => result.current.onChange('A1BCDEFGH'))
    value = 'A1BCDEFGH' // the store write the real onChange caller makes
    expect(result.current.value).toBe('A1BCDEFGH')

    // Re-rendering with that echoed-back value -- exactly what a React
    // Query cache re-render feeds this same field a moment later -- must
    // not disturb the field's own rendered value.
    rerender()
    expect(result.current.value).toBe('A1BCDEFGH')
  })

  it('adopts a value that changed for a reason other than this field own typing', () => {
    let value = 'original'

    const { result, rerender } = renderHook(() => useLocalControlledValue(value))
    expect(result.current.value).toBe('original')

    // Something other than this field's own onChange changed the value --
    // e.g. this DOM node got reused for a different record.
    value = 'changed elsewhere'
    rerender()

    expect(result.current.value).toBe('changed elsewhere')
  })
})
