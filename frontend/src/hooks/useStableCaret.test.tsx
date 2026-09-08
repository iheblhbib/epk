import { act, fireEvent, render } from '@testing-library/react'
import { useEffect, useRef, useSyncExternalStore } from 'react'
import { describe, expect, it } from 'vitest'
import { useStableCaret } from './useStableCaret'

/**
 * Mimics the React Query cache useDraftSectionConfig writes into on every
 * keystroke (see useDraftSectionConfig.ts): `set` publishes a brand new
 * snapshot object, just like `queryClient.setQueryData`'s `old?.map(...)`
 * always returns a new array -- so every subscriber, including this same
 * field through its own `value` prop, re-renders even when the string
 * content it ends up showing hasn't actually changed.
 */
function createStore(initialTitle: string) {
  let snapshot = { title: initialTitle }
  const listeners = new Set<() => void>()
  return {
    get: () => snapshot,
    set: (title: string) => {
      snapshot = { title }
      listeners.forEach((listener) => listener())
    },
    subscribe: (listener: () => void) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }
}

function Field({
  store,
  onReady,
  type = 'text',
}: {
  store: ReturnType<typeof createStore>
  onReady: (el: HTMLInputElement) => void
  type?: string
}) {
  const snapshot = useSyncExternalStore(store.subscribe, store.get)
  const ref = useRef<HTMLInputElement>(null)
  const { onChange } = useStableCaret(ref)

  useEffect(() => {
    if (ref.current) onReady(ref.current)
  })

  return (
    <input
      ref={ref}
      type={type}
      value={snapshot.title}
      onChange={(event) => {
        onChange(event)
        store.set(event.target.value)
      }}
    />
  )
}

describe('useStableCaret', () => {
  it('restores the caret after a re-render the input itself did not cause moves it', () => {
    const store = createStore('ABCDEFGH')
    let inputEl!: HTMLInputElement
    render(
      <Field
        store={store}
        onReady={(el) => {
          inputEl = el
        }}
      />
    )
    act(() => inputEl.focus())

    // A real keystroke: the browser inserts the character and moves the
    // caret on its own, then fires `input` -- which is when useStableCaret's
    // onChange records the position it should be restored to later.
    fireEvent.input(inputEl, { target: { value: 'A1BCDEFGH', selectionStart: 2, selectionEnd: 2 } })
    expect(inputEl.value).toBe('A1BCDEFGH')
    expect(inputEl.selectionStart).toBe(2)

    // jsdom doesn't reproduce the real-browser quirk where reassigning
    // `.value` during a render the input didn't itself trigger snaps the
    // caret to the end -- so force that here, then publish an external,
    // content-only store notification (no onChange, exactly like some other
    // part of the query cache write re-rendering this same field) and
    // confirm the caret lands back where the user actually left it.
    act(() => {
      inputEl.setSelectionRange(inputEl.value.length, inputEl.value.length)
      store.set(store.get().title)
    })

    expect(inputEl.selectionStart).toBe(2)
    expect(inputEl.selectionEnd).toBe(2)
  })

  it('does not throw on a password field, which browsers refuse selection access on', () => {
    const store = createStore('')
    let inputEl!: HTMLInputElement
    render(
      <Field
        store={store}
        type="password"
        onReady={(el) => {
          inputEl = el
        }}
      />
    )
    act(() => inputEl.focus())

    expect(() => {
      fireEvent.input(inputEl, { target: { value: 'secret' } })
      act(() => store.set(store.get().title))
    }).not.toThrow()

    expect(inputEl.value).toBe('secret')
  })

  it('does not throw on an email field, whose setSelectionRange throws InvalidStateError', () => {
    // Unlike password, reading selectionStart on type="email" doesn't throw
    // (it's just null) -- it's specifically the restore effect's
    // setSelectionRange call that must be guarded, which this exercises by
    // forcing that effect to run via a second, content-only store notify.
    const store = createStore('')
    let inputEl!: HTMLInputElement
    render(
      <Field
        store={store}
        type="email"
        onReady={(el) => {
          inputEl = el
        }}
      />
    )
    act(() => inputEl.focus())

    expect(() => {
      fireEvent.input(inputEl, { target: { value: 'a@b.com' } })
      act(() => store.set(store.get().title))
    }).not.toThrow()

    expect(inputEl.value).toBe('a@b.com')
  })
})
