import { describe, expect, it } from 'vitest'
import { moveItem } from '@/lib/arrayMove'

describe('moveItem', () => {
  it('moves an item up one slot', () => {
    expect(moveItem(['a', 'b', 'c'], 1, 'up')).toEqual(['b', 'a', 'c'])
  })

  it('moves an item down one slot', () => {
    expect(moveItem(['a', 'b', 'c'], 1, 'down')).toEqual(['a', 'c', 'b'])
  })

  it('is a no-op moving the first item up', () => {
    expect(moveItem(['a', 'b', 'c'], 0, 'up')).toEqual(['a', 'b', 'c'])
  })

  it('is a no-op moving the last item down', () => {
    expect(moveItem(['a', 'b', 'c'], 2, 'down')).toEqual(['a', 'b', 'c'])
  })

  it('does not mutate the original array', () => {
    const original = ['a', 'b', 'c']
    moveItem(original, 0, 'down')
    expect(original).toEqual(['a', 'b', 'c'])
  })
})
