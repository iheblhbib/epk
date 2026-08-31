import { ThemeProvider as NextThemesProvider } from 'next-themes'
import type { ReactNode } from 'react'

/**
 * Thin wrapper around next-themes — it toggles a `dark` class on <html>
 * (matching the `@custom-variant dark (&:is(.dark *))` already defined in
 * globals.css, which has carried a complete dark token palette since Phase
 * 1) and persists the choice to localStorage itself, no extra state needed
 * here. `defaultTheme="system"` means a first-time visitor gets whatever
 * their OS is set to, not an app-chosen default.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  return (
    <NextThemesProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      {children}
    </NextThemesProvider>
  )
}
