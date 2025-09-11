/**
 * Centralized helper for generating the site's base URL.
 * 
 * This function provides a consistent way to construct absolute URLs throughout the application.
 * It prioritizes the NEXT_PUBLIC_SITE_URL environment variable, falls back to the current
 * window origin in the browser, or defaults to localhost:3000 for server-side rendering.
 * 
 * @returns The site's base URL without trailing slash
 * 
 * @example
 * // In OAuth redirects
 * redirectTo: `${siteUrl()}/auth/callback`
 * 
 * // In API calls
 * const res = await fetch(`${siteUrl()}/api/games/browse`)
 * 
 * // In sitemaps
 * url: `${siteUrl()}/game/${gameId}`
 */
export function siteUrl() {
  const raw =
    process.env.NEXT_PUBLIC_SITE_URL ||
    (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000');
  return raw.replace(/\/$/, '');
}
