import '@testing-library/jest-dom/vitest'
import { afterAll, afterEach, beforeAll, vi } from 'vitest'
import '@/i18n'
import { server } from '@/test/server'

// Mock HTMLCanvasElement.getContext for Chart.js in jsdom (no canvas npm package installed).
// jsdom doesn't implement canvas, so Chart.js gets a stub context object instead of failing.
HTMLCanvasElement.prototype.getContext = vi.fn(() => ({})) as any

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())
