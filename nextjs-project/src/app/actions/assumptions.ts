'use server'
import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'

const API_URL = process.env.API_URL ?? 'http://localhost:8000'

export interface SavedAssumptionSet<T = Record<string, unknown>> {
  data: T
  updated_at: string | null
}

export interface SavedAssumptions {
  crew: SavedAssumptionSet | null
  costs: SavedAssumptionSet | null
}

/** Company-default Crew / Costs tables (null per kind when never saved). */
export async function fetchAssumptions(): Promise<SavedAssumptions> {
  const empty: SavedAssumptions = { crew: null, costs: null }
  const token = (await cookies()).get('access_token')?.value
  if (!token) return empty
  try {
    const res = await fetch(`${API_URL}/assumptions`, {
      headers: { Cookie: `access_token=${token}` },
      cache: 'no-store',
    })
    return res.ok ? await res.json() : empty
  } catch {
    return empty
  }
}

/** Save the Crew or Costs page as the company defaults (editors only). */
export async function saveAssumptionsAction(
  kind: 'crew' | 'costs',
  data: Record<string, unknown>,
): Promise<{ error?: string; saved?: SavedAssumptionSet }> {
  const token = (await cookies()).get('access_token')?.value
  if (!token) return { error: 'Not authenticated' }
  try {
    const res = await fetch(`${API_URL}/assumptions/${kind}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Cookie: `access_token=${token}` },
      body: JSON.stringify({ data }),
    })
    const body = await res.json().catch(() => ({}))
    if (!res.ok) return { error: typeof body.detail === 'string' ? body.detail : 'Save failed' }
    revalidatePath('/', 'layout')
    return { saved: body }
  } catch {
    return { error: 'Network error — could not reach API' }
  }
}
