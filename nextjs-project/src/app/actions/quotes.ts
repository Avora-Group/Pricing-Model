'use server'

import { cookies } from 'next/headers'

const API_URL = process.env.API_URL ?? 'http://localhost:8000'

// ---- Types ----

export interface SaveQuotePayload {
  client_name: string
  client_code: string
  project_id?: number | null
  dashboard_state: Record<string, unknown>
  pricing_config_snapshot: Record<string, unknown>
  crew_config_snapshot: Record<string, unknown>
  costs_config_snapshot: Record<string, unknown>
  msn_snapshots: Record<string, unknown>[]
}

export interface QuoteListItem {
  id: number
  quote_number: string
  client_name: string
  status: string
  exchange_rate: string
  margin_percent: string
  msn_list: number[]
  created_at: string
  updated_at: string
}

export interface QuoteDetailResponse {
  id: number
  quote_number: string
  client_name: string
  client_code: string
  status: string
  exchange_rate: string
  margin_percent: string
  msn_list: number[]
  dashboard_state: Record<string, unknown>
  pricing_config_snapshot: Record<string, unknown>
  crew_config_snapshot: Record<string, unknown>
  costs_config_snapshot: Record<string, unknown>
  msn_snapshots: QuoteMsnSnapshot[]
  created_at: string
  created_by: number
}

export interface QuoteMsnSnapshot {
  id: number
  msn: number
  aircraft_type: string
  aircraft_id: number
  msn_input: Record<string, unknown>
  breakdown: Record<string, unknown>
  monthly_pnl: Record<string, unknown>
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

export async function saveQuoteAction(
  payload: SaveQuotePayload
): Promise<{ id: number; quote_number: string } | { error: string }> {
  const token = await getToken()
  if (!token) return { error: 'Not authenticated' }

  try {
    const res = await fetch(`${API_URL}/quotes/`, {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify(payload),
    })

    if (!res.ok) {
      const data = await res.json().catch(() => ({ detail: 'Failed to save quote' }))
      return { error: data.detail ?? 'Failed to save quote' }
    }

    return res.json()
  } catch {
    return { error: 'Network error -- could not reach API' }
  }
}

export async function listQuotesAction(params?: {
  search?: string
  status?: string
  msn?: number
  limit?: number
  offset?: number
}): Promise<{ items: QuoteListItem[]; total: number } | { error: string }> {
  const token = await getToken()
  if (!token) return { error: 'Not authenticated' }

  try {
    const searchParams = new URLSearchParams()
    if (params?.search) searchParams.set('search', params.search)
    if (params?.status) searchParams.set('status', params.status)
    if (params?.msn !== undefined) searchParams.set('msn', String(params.msn))
    if (params?.limit !== undefined) searchParams.set('limit', String(params.limit))
    if (params?.offset !== undefined) searchParams.set('offset', String(params.offset))

    const qs = searchParams.toString()
    const url = `${API_URL}/quotes/${qs ? `?${qs}` : ''}`

    const res = await fetch(url, {
      headers: authHeaders(token),
      cache: 'no-store',
    })

    if (!res.ok) {
      const data = await res.json().catch(() => ({ detail: 'Failed to list quotes' }))
      return { error: data.detail ?? 'Failed to list quotes' }
    }

    return res.json()
  } catch {
    return { error: 'Network error -- could not reach API' }
  }
}

export async function getQuoteAction(
  quoteId: number
): Promise<QuoteDetailResponse | { error: string }> {
  const token = await getToken()
  if (!token) return { error: 'Not authenticated' }

  try {
    const res = await fetch(`${API_URL}/quotes/${quoteId}`, {
      headers: authHeaders(token),
      cache: 'no-store',
    })

    if (!res.ok) {
      const data = await res.json().catch(() => ({ detail: 'Quote not found' }))
      return { error: data.detail ?? 'Quote not found' }
    }

    return res.json()
  } catch {
    return { error: 'Network error -- could not reach API' }
  }
}

export async function updateQuoteStatusAction(
  quoteId: number,
  status: string
): Promise<{ id: number; status: string } | { error: string }> {
  const token = await getToken()
  if (!token) return { error: 'Not authenticated' }

  try {
    const res = await fetch(`${API_URL}/quotes/${quoteId}/status`, {
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

export async function deleteQuoteAction(
  quoteId: number
): Promise<{ success: true } | { error: string }> {
  const token = await getToken()
  if (!token) return { error: 'Not authenticated' }

  try {
    const res = await fetch(`${API_URL}/quotes/${quoteId}`, {
      method: 'DELETE',
      headers: authHeaders(token),
    })

    if (!res.ok) {
      const data = await res.json().catch(() => ({ detail: 'Failed to delete quote' }))
      return { error: data.detail ?? 'Failed to delete quote' }
    }

    return { success: true }
  } catch {
    return { error: 'Network error -- could not reach API' }
  }
}
