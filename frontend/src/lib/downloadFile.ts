import { apiClient } from '@/api/client'

/**
 * Downloads a file from an authenticated backend endpoint through the app's
 * own axios client, rather than a plain `<a href>` pointing at the backend's
 * absolute (different-port) URL.
 *
 * That plain-link approach looks reasonable but is fragile: Sanctum's SPA
 * auth only starts reading the session cookie for a request it recognizes
 * as coming from the frontend, which it decides from the Referer/Origin
 * header — and a `target="_blank"` navigation doesn't reliably send either
 * (confirmed via a real request dump: `sec-fetch-site: none`, no referer,
 * no origin — even though the session cookie itself was right there in the
 * request). The result was a working session getting a clean 401 on every
 * download link, in a real browser, not just this app's own automated
 * testing. Routing the request through axios (which already reliably
 * authenticates every other call in this app) sidesteps the whole
 * referrer/origin heuristic, then this just hands the browser the bytes to
 * save the same way a native download would.
 */
export async function downloadAuthenticatedFile(url: string, fallbackFilename: string): Promise<void> {
  const response = await apiClient.get<Blob>(url, { responseType: 'blob' })

  const disposition = response.headers['content-disposition'] as string | undefined
  const filenameMatch = disposition?.match(/filename="([^"]+)"/)
  const filename = filenameMatch?.[1] ?? fallbackFilename

  const blobUrl = URL.createObjectURL(response.data)
  const link = document.createElement('a')
  link.href = blobUrl
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(blobUrl)
}
