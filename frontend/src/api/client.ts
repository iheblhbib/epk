import axios, { type AxiosError, type InternalAxiosRequestConfig } from 'axios'

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'

export const apiClient = axios.create({
  baseURL: API_URL,
  withCredentials: true,
  withXSRFToken: true,
  headers: {
    Accept: 'application/json',
  },
})

let csrfCookiePromise: Promise<unknown> | null = null

/**
 * Sanctum's SPA auth requires a CSRF cookie fetched once before the first
 * state-changing request; axios then echoes it back automatically as the
 * X-XSRF-TOKEN header on every request that shares this cookie jar.
 */
export function ensureCsrfCookie() {
  csrfCookiePromise ??= apiClient.get('/sanctum/csrf-cookie')

  return csrfCookiePromise
}

let retriedOnce = false

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const status = error.response?.status
    const config = error.config as InternalAxiosRequestConfig | undefined

    if (status === 419 && config && !retriedOnce) {
      retriedOnce = true
      csrfCookiePromise = null
      await ensureCsrfCookie()

      return apiClient(config)
    }

    // A 401 from the public EPK page or a private-link page means "this
    // link needs a password" — nothing to do with the current app user's
    // own session, so it must never trigger the auth-invalidation below
    // (which would otherwise misread a stranger's password gate as this
    // browser's admin session having expired).
    const isVisitorFacingEndpoint = typeof config?.url === 'string' && /\/api\/(public|private)\//.test(config.url)

    if (status === 401 && !isVisitorFacingEndpoint) {
      // Let TanStack Query's auth-user cache reflect the logged-out state;
      // route guarding (redirect to /login) happens in <ProtectedRoute>.
      queryClientAuthInvalidate?.()
    }

    return Promise.reject(error)
  }
)

// Set lazily by the QueryProvider to avoid a circular import between the
// query client and this module.
let queryClientAuthInvalidate: (() => void) | null = null
export function registerAuthInvalidator(fn: () => void) {
  queryClientAuthInvalidate = fn
}
