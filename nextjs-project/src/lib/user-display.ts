export const ROLE_LABEL: Record<string, string> = {
  admin: 'Administrator',
  user: 'Pricing',
  viewer: 'Viewer',
}

export function initials(email?: string): string {
  if (!email) return 'AV'
  const name = email.split('@')[0]
  const parts = name.split(/[.\-_]/).filter(Boolean)
  const chars = parts.length >= 2 ? parts[0][0] + parts[1][0] : name.slice(0, 2)
  return chars.toUpperCase()
}
