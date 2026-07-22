'use server'
import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'

const API_URL = process.env.API_URL ?? 'http://localhost:8000'

export interface UpdateRatesState {
  success?: boolean
  error?: string
}

export async function updateRatesAction(
  msn: number,
  prevState: UpdateRatesState,
  formData: FormData
): Promise<UpdateRatesState> {
  const cookieStore = await cookies()
  const token = cookieStore.get('access_token')?.value

  if (!token) {
    return { error: 'Not authenticated' }
  }

  const body: Record<string, number> = {}
  for (const [key, value] of formData.entries()) {
    if (value && typeof value === 'string' && value.trim() !== '') {
      const num = Number(value)
      if (!isNaN(num)) {
        body[key] = num
      }
    }
  }

  if (Object.keys(body).length === 0) {
    return { error: 'No fields to update' }
  }

  try {
    const res = await fetch(`${API_URL}/aircraft/${msn}/rates`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Cookie: `access_token=${token}`,
      },
      body: JSON.stringify(body),
    })

    if (!res.ok) {
      const data = await res.json().catch(() => ({ detail: 'Update failed' }))
      return { error: data.detail ?? 'Update failed' }
    }

    revalidatePath(`/aircraft/${msn}`)
    return { success: true }
  } catch {
    return { error: 'Network error — could not reach API' }
  }
}

/* ─── Update Aircraft (registration) ─── */

export interface UpdateAircraftState {
  success?: boolean
  error?: string
}

export async function updateRegistrationAction(
  msn: number,
  prevState: UpdateAircraftState,
  formData: FormData
): Promise<UpdateAircraftState> {
  const cookieStore = await cookies()
  const token = cookieStore.get('access_token')?.value

  if (!token) {
    return { error: 'Not authenticated' }
  }

  const registration = String(formData.get('registration') ?? '').trim()

  try {
    const res = await fetch(`${API_URL}/aircraft/${msn}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Cookie: `access_token=${token}`,
      },
      // Empty input clears the registration.
      body: JSON.stringify({ registration: registration || null }),
    })

    if (!res.ok) {
      const data = await res.json().catch(() => ({ detail: 'Update failed' }))
      return { error: data.detail ?? 'Update failed' }
    }

    revalidatePath(`/aircraft/${msn}`)
    revalidatePath('/aircraft')
    return { success: true }
  } catch {
    return { error: 'Network error — could not reach API' }
  }
}

/* ─── Create Aircraft ─── */

export interface CreateAircraftState {
  success?: boolean
  error?: string
  msn?: number
}

export async function createAircraftAction(
  prevState: CreateAircraftState,
  formData: FormData
): Promise<CreateAircraftState> {
  const cookieStore = await cookies()
  const token = cookieStore.get('access_token')?.value

  if (!token) {
    return { error: 'Not authenticated' }
  }

  const msn = formData.get('msn')
  if (!msn || String(msn).trim() === '') {
    return { error: 'MSN is required' }
  }

  const body: Record<string, unknown> = {
    msn: Number(msn),
    aircraft_type: formData.get('aircraft_type') || 'A320',
  }

  const registration = formData.get('registration')
  if (registration && String(registration).trim() !== '') {
    body.registration = String(registration).trim()
  }

  // Collect all rate fields
  const rateFields = [
    'lease_rent_usd', 'six_year_check_usd', 'twelve_year_check_usd',
    'ldg_usd', 'apu_rate_usd', 'llp1_rate_usd', 'llp2_rate_usd',
    'epr_escalation', 'llp_escalation', 'af_apu_escalation',
  ]
  for (const field of rateFields) {
    const value = formData.get(field)
    if (value && String(value).trim() !== '') {
      const num = Number(value)
      if (!isNaN(num)) {
        body[field] = num
      }
    }
  }

  try {
    const res = await fetch(`${API_URL}/aircraft`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: `access_token=${token}`,
      },
      body: JSON.stringify(body),
    })

    if (!res.ok) {
      const data = await res.json().catch(() => ({ detail: 'Create failed' }))
      return { error: data.detail ?? 'Create failed' }
    }

    const result = await res.json()
    revalidatePath('/aircraft')
    return { success: true, msn: result.msn }
  } catch {
    return { error: 'Network error — could not reach API' }
  }
}

/* ─── Update EPR Matrix ─── */

export interface UpdateEprMatrixState {
  success?: boolean
  error?: string
}

export async function updateEprMatrixAction(
  msn: number,
  prevState: UpdateEprMatrixState,
  formData: FormData
): Promise<UpdateEprMatrixState> {
  const cookieStore = await cookies()
  const token = cookieStore.get('access_token')?.value

  if (!token) {
    return { error: 'Not authenticated' }
  }

  const rowsJson = formData.get('rows')
  if (!rowsJson || typeof rowsJson !== 'string') {
    return { error: 'No EPR data provided' }
  }

  let rows: Array<{ cycle_ratio: string; benign_rate: string; hot_rate: string }>
  try {
    rows = JSON.parse(rowsJson)
  } catch {
    return { error: 'Invalid EPR data format' }
  }

  // Validate all values are numeric
  for (const row of rows) {
    if (
      isNaN(Number(row.cycle_ratio)) ||
      isNaN(Number(row.benign_rate)) ||
      isNaN(Number(row.hot_rate))
    ) {
      return { error: 'All EPR values must be valid numbers' }
    }
  }

  try {
    const res = await fetch(`${API_URL}/aircraft/${msn}/epr-matrix`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Cookie: `access_token=${token}`,
      },
      body: JSON.stringify({ rows }),
    })

    if (!res.ok) {
      const data = await res.json().catch(() => ({ detail: 'Update failed' }))
      return { error: data.detail ?? 'Update failed' }
    }

    revalidatePath(`/aircraft/${msn}`)
    return { success: true }
  } catch {
    return { error: 'Network error — could not reach API' }
  }
}
