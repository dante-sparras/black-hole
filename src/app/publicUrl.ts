/**
 * Resolve a path under Vite `public/` for any deploy base
 * (local `/` or GitHub Pages `/black-hole/`).
 */
export function publicUrl(path: string): string {
  const base = import.meta.env.BASE_URL || '/'
  const p = path.replace(/^\/+/, '')
  return base.endsWith('/') ? `${base}${p}` : `${base}/${p}`
}
