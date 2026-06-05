'use server'

import { cookies } from 'next/headers'

const API_URL = process.env.API_URL ?? 'http://localhost:8000'

// ---- Types ----

interface ComponentBreakdownApi {
  aircraft_eur_per_bh: string
  crew_eur_per_bh: string
  maintenance_eur_per_bh: string
  insurance_eur_per_bh: string
  doc_eur_per_bh: string
  other_cogs_eur_per_bh: string
  overhead_eur_per_bh: string
  total_cost_per_bh: string
  revenue_per_bh: string
  margin_percent: string
  final_rate_per_bh: string
}

interface MsnPnlResultApi {
  msn: number
  aircraft_type: string
  breakdown: ComponentBreakdownApi
  monthly_cost: string
  monthly_revenue: string
  monthly_pnl: string
}

export interface CalculateResponse {
  msn_results: MsnPnlResultApi[]
  total: ComponentBreakdownApi | null
}

export interface PricingConfigData {
  id: number
  version: number
  exchange_rate: string
  insurance_usd: string
  doc_total_budget: string
  overhead_total_budget: string
  other_cogs_monthly: string
  line_maintenance_monthly: string
  base_maintenance_monthly: string
  personnel_salary_monthly: string
  c_check_monthly: string
  maintenance_training_monthly: string
  spare_parts_rate: string
  maintenance_per_diem: string
  average_active_fleet: string
  is_current: boolean
}

export interface CrewConfigData {
  id: number
  version: number
  aircraft_type: string
  pilot_salary_monthly: string
  senior_attendant_salary_monthly: string
  regular_attendant_salary_monthly: string
  per_diem_rate: string
  accommodation_monthly_budget: string
  training_total_budget: string
  uniform_total_budget: string
  is_current: boolean
}

export interface ProjectData {
  id: number
  name: string | null
  exchange_rate: string
  margin_percent: string
  config_version_id: number | null
  status?: string
  status_source?: string
  signed_at?: string | null
  msn_inputs: MsnInputData[]
}

export interface MsnInputData {
  id: number
  project_id: number
  aircraft_id: number
  mgh: string
  cycle_ratio: string
  environment: string
  period_months: number
  lease_type: string
  crew_sets: number
}

// ---- Helper ----

async function getToken(): Promise<string | null> {
  const cookieStore = await cookies()
  return cookieStore.get('access_token')?.value ?? null
}

function authHeaders(token: string): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    Cookie: `access_token=${token}`,
  }
}

// ---- Server Actions ----

export async function calculatePnlAction(inputs: {
  exchange_rate: string
  margin_percent: string
  msn_inputs: {
    msn: number
    mgh: string
    cycle_ratio: string
    environment: string
    period_months: number
    lease_type: string
    crew_sets: number
  }[]
}): Promise<CalculateResponse | { error: string }> {
  const token = await getToken()
  if (!token) return { error: 'Not authenticated' }

  try {
    const res = await fetch(`${API_URL}/pricing/calculate`, {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify(inputs),
    })

    if (!res.ok) {
      const data = await res.json().catch(() => ({ detail: 'Calculation failed' }))
      return { error: data.detail ?? 'Calculation failed' }
    }

    return res.json()
  } catch {
    return { error: 'Network error -- could not reach API' }
  }
}

export async function fetchPricingConfigAction(): Promise<
  PricingConfigData | { error: string }
> {
  const token = await getToken()
  if (!token) return { error: 'Not authenticated' }

  try {
    const res = await fetch(`${API_URL}/pricing/config`, {
      headers: authHeaders(token),
      cache: 'no-store',
    })

    if (!res.ok) {
      const data = await res.json().catch(() => ({ detail: 'Failed to fetch config' }))
      return { error: data.detail ?? 'Failed to fetch config' }
    }

    return res.json()
  } catch {
    return { error: 'Network error -- could not reach API' }
  }
}

export async function updatePricingConfigAction(
  formData: FormData
): Promise<PricingConfigData | { error: string }> {
  const token = await getToken()
  if (!token) return { error: 'Not authenticated' }

  const body: Record<string, number> = {}
  for (const [key, value] of formData.entries()) {
    if (value && typeof value === 'string' && value.trim() !== '') {
      const num = Number(value)
      if (!isNaN(num)) {
        body[key] = num
      }
    }
  }

  try {
    const res = await fetch(`${API_URL}/pricing/config`, {
      method: 'PUT',
      headers: authHeaders(token),
      body: JSON.stringify(body),
    })

    if (!res.ok) {
      const data = await res.json().catch(() => ({ detail: 'Update failed' }))
      return { error: data.detail ?? 'Update failed' }
    }

    return res.json()
  } catch {
    return { error: 'Network error -- could not reach API' }
  }
}

export async function fetchCrewConfigAction(): Promise<
  CrewConfigData[] | { error: string }
> {
  const token = await getToken()
  if (!token) return { error: 'Not authenticated' }

  try {
    const res = await fetch(`${API_URL}/pricing/crew-config`, {
      headers: authHeaders(token),
      cache: 'no-store',
    })

    if (!res.ok) {
      const data = await res.json().catch(() => ({ detail: 'Failed to fetch crew config' }))
      return { error: data.detail ?? 'Failed to fetch crew config' }
    }

    return res.json()
  } catch {
    return { error: 'Network error -- could not reach API' }
  }
}

export async function updateCrewConfigAction(
  formData: FormData
): Promise<CrewConfigData | { error: string }> {
  const token = await getToken()
  if (!token) return { error: 'Not authenticated' }

  const body: Record<string, string | number> = {}
  for (const [key, value] of formData.entries()) {
    if (value && typeof value === 'string' && value.trim() !== '') {
      if (key === 'aircraft_type') {
        body[key] = value
      } else {
        const num = Number(value)
        if (!isNaN(num)) {
          body[key] = num
        }
      }
    }
  }

  try {
    const res = await fetch(`${API_URL}/pricing/crew-config`, {
      method: 'PUT',
      headers: authHeaders(token),
      body: JSON.stringify(body),
    })

    if (!res.ok) {
      const data = await res.json().catch(() => ({ detail: 'Update failed' }))
      return { error: data.detail ?? 'Update failed' }
    }

    return res.json()
  } catch {
    return { error: 'Network error -- could not reach API' }
  }
}

export async function createProjectAction(
  name?: string
): Promise<ProjectData | { error: string }> {
  const token = await getToken()
  if (!token) return { error: 'Not authenticated' }

  try {
    const res = await fetch(`${API_URL}/pricing/projects`, {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify({ name: name ?? null }),
    })

    if (!res.ok) {
      const data = await res.json().catch(() => ({ detail: 'Failed to create project' }))
      return { error: data.detail ?? 'Failed to create project' }
    }

    return res.json()
  } catch {
    return { error: 'Network error -- could not reach API' }
  }
}

export async function fetchProjectAction(
  projectId: number
): Promise<ProjectData | { error: string }> {
  const token = await getToken()
  if (!token) return { error: 'Not authenticated' }

  try {
    const res = await fetch(`${API_URL}/pricing/projects/${projectId}`, {
      headers: authHeaders(token),
      cache: 'no-store',
    })

    if (!res.ok) {
      const data = await res.json().catch(() => ({ detail: 'Failed to fetch project' }))
      return { error: data.detail ?? 'Failed to fetch project' }
    }

    return res.json()
  } catch {
    return { error: 'Network error -- could not reach API' }
  }
}

export async function addMsnInputAction(
  projectId: number,
  input: {
    aircraft_id: number
    mgh: string
    cycle_ratio: string
    environment: string
    period_months: number
    lease_type: string
    crew_sets: number
  }
): Promise<MsnInputData | { error: string }> {
  const token = await getToken()
  if (!token) return { error: 'Not authenticated' }

  try {
    const res = await fetch(`${API_URL}/pricing/projects/${projectId}/msn`, {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify(input),
    })

    if (!res.ok) {
      const data = await res.json().catch(() => ({ detail: 'Failed to add MSN' }))
      return { error: data.detail ?? 'Failed to add MSN' }
    }

    return res.json()
  } catch {
    return { error: 'Network error -- could not reach API' }
  }
}

export async function updateMsnInputAction(
  projectId: number,
  inputId: number,
  fields: Record<string, string | number>
): Promise<MsnInputData | { error: string }> {
  const token = await getToken()
  if (!token) return { error: 'Not authenticated' }

  try {
    const res = await fetch(
      `${API_URL}/pricing/projects/${projectId}/msn/${inputId}`,
      {
        method: 'PUT',
        headers: authHeaders(token),
        body: JSON.stringify(fields),
      }
    )

    if (!res.ok) {
      const data = await res.json().catch(() => ({ detail: 'Failed to update MSN input' }))
      return { error: data.detail ?? 'Failed to update MSN input' }
    }

    return res.json()
  } catch {
    return { error: 'Network error -- could not reach API' }
  }
}

export async function deleteMsnInputAction(
  projectId: number,
  inputId: number
): Promise<{ status: string } | { error: string }> {
  const token = await getToken()
  if (!token) return { error: 'Not authenticated' }

  try {
    const res = await fetch(
      `${API_URL}/pricing/projects/${projectId}/msn/${inputId}`,
      {
        method: 'DELETE',
        headers: authHeaders(token),
      }
    )

    if (!res.ok) {
      const data = await res.json().catch(() => ({ detail: 'Failed to delete MSN input' }))
      return { error: data.detail ?? 'Failed to delete MSN input' }
    }

    return res.json()
  } catch {
    return { error: 'Network error -- could not reach API' }
  }
}

export async function updateProjectStatusAction(
  projectId: number,
  status: 'potential' | 'signed' | 'active'
): Promise<ProjectData | { error: string }> {
  const token = await getToken()
  if (!token) return { error: 'Not authenticated' }

  try {
    const res = await fetch(`${API_URL}/pricing/projects/${projectId}/status`, {
      method: 'PATCH',
      headers: authHeaders(token),
      body: JSON.stringify({ status }),
    })

    if (!res.ok) {
      const data = await res.json().catch(() => ({ detail: 'Failed to update status' }))
      return { error: data.detail ?? 'Failed to update status' }
    }

    return res.json()
  } catch {
    return { error: 'Network error -- could not reach API' }
  }
}
