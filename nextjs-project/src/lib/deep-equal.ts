/** Structural equality for plain JSON-like data, ignoring object key order
 *  (Postgres JSONB returns keys in its own order). */
export function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false
  if (Array.isArray(a) !== Array.isArray(b)) return false
  if (Array.isArray(a)) {
    const bb = b as unknown[]
    return a.length === bb.length && a.every((v, i) => deepEqual(v, bb[i]))
  }
  const ao = a as Record<string, unknown>
  const bo = b as Record<string, unknown>
  const keys = Object.keys(ao).filter((k) => ao[k] !== undefined)
  const bKeys = Object.keys(bo).filter((k) => bo[k] !== undefined)
  return keys.length === bKeys.length && keys.every((k) => deepEqual(ao[k], bo[k]))
}
