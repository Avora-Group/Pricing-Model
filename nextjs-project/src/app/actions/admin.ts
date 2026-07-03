'use server'
import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'

const API_URL = process.env.API_URL ?? 'http://localhost:8000'

/* ─── List Users ─── */

export interface User {
  id: number
  email: string
  role: string
  full_name: string | null
  is_active: boolean
  can_view_costs: boolean
  created_at: string
  updated_at: string
}

export async function listUsersAction(): Promise<{
  users?: User[]
  error?: string
}> {
  const cookieStore = await cookies()
  const token = cookieStore.get('access_token')?.value

  if (!token) {
    return { error: 'Not authenticated' }
  }

  try {
    const res = await fetch(`${API_URL}/admin/users`, {
      headers: {
        Cookie: `access_token=${token}`,
      },
    })

    if (!res.ok) {
      const data = await res.json().catch(() => ({ detail: 'Failed to load users' }))
      return { error: data.detail ?? 'Failed to load users' }
    }

    const users = await res.json()
    return { users }
  } catch {
    return { error: 'Network error — could not reach API' }
  }
}

/* ─── Create User ─── */

export interface CreateUserState {
  success?: boolean
  error?: string
}

export async function createUserAction(
  prevState: CreateUserState,
  formData: FormData
): Promise<CreateUserState> {
  const cookieStore = await cookies()
  const token = cookieStore.get('access_token')?.value

  if (!token) {
    return { error: 'Not authenticated' }
  }

  const email = (formData.get('email') as string)?.trim()
  const fullName = (formData.get('full_name') as string)?.trim() || null
  const role = (formData.get('role') as string) || 'user'
  // Checkbox: present in FormData only when checked. Admins always get access.
  const canViewCosts = role === 'admin' || formData.get('can_view_costs') === 'on'

  if (!email) return { error: 'Email is required' }

  try {
    const res = await fetch(`${API_URL}/admin/users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: `access_token=${token}`,
      },
      body: JSON.stringify({ email, full_name: fullName, role, can_view_costs: canViewCosts }),
    })

    if (!res.ok) {
      const data = await res.json().catch(() => ({ detail: 'Failed to create user' }))
      return { error: data.detail ?? 'Failed to create user' }
    }

    revalidatePath('/admin')
    return { success: true }
  } catch {
    return { error: 'Network error — could not reach API' }
  }
}

/* ─── Update Role ─── */

export async function updateRoleAction(
  userId: number,
  role: string,
): Promise<{ success?: boolean; error?: string }> {
  const cookieStore = await cookies()
  const token = cookieStore.get('access_token')?.value

  if (!token) return { error: 'Not authenticated' }

  try {
    const res = await fetch(`${API_URL}/admin/users/${userId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Cookie: `access_token=${token}`,
      },
      body: JSON.stringify({ role }),
    })

    if (!res.ok) {
      const data = await res.json().catch(() => ({ detail: 'Failed to update role' }))
      return { error: data.detail ?? 'Failed to update role' }
    }

    revalidatePath('/admin')
    return { success: true }
  } catch {
    return { error: 'Network error — could not reach API' }
  }
}

/* ─── Update Cost Access (naked-cost visibility) ─── */

export async function updateCostAccessAction(
  userId: number,
  canViewCosts: boolean,
): Promise<{ success?: boolean; error?: string }> {
  const cookieStore = await cookies()
  const token = cookieStore.get('access_token')?.value

  if (!token) return { error: 'Not authenticated' }

  try {
    const res = await fetch(`${API_URL}/admin/users/${userId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Cookie: `access_token=${token}`,
      },
      body: JSON.stringify({ can_view_costs: canViewCosts }),
    })

    if (!res.ok) {
      const data = await res.json().catch(() => ({ detail: 'Failed to update cost access' }))
      return { error: data.detail ?? 'Failed to update cost access' }
    }

    revalidatePath('/admin')
    return { success: true }
  } catch {
    return { error: 'Network error — could not reach API' }
  }
}

/* ─── Reset Password ─── */

export interface ResetPasswordState {
  success?: boolean
  error?: string
}

export async function resetPasswordAction(
  userId: number,
  prevState: ResetPasswordState,
  formData: FormData
): Promise<ResetPasswordState> {
  const cookieStore = await cookies()
  const token = cookieStore.get('access_token')?.value

  if (!token) {
    return { error: 'Not authenticated' }
  }

  const newPassword = formData.get('new_password') as string
  const confirmPassword = formData.get('confirm_password') as string

  if (!newPassword || newPassword.trim().length < 8) {
    return { error: 'Password must be at least 8 characters' }
  }

  if (newPassword !== confirmPassword) {
    return { error: 'Passwords do not match' }
  }

  try {
    const res = await fetch(`${API_URL}/admin/users/${userId}/password`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Cookie: `access_token=${token}`,
      },
      body: JSON.stringify({ new_password: newPassword }),
    })

    if (!res.ok) {
      const data = await res.json().catch(() => ({ detail: 'Reset failed' }))
      return { error: data.detail ?? 'Reset failed' }
    }

    revalidatePath('/admin')
    return { success: true }
  } catch {
    return { error: 'Network error — could not reach API' }
  }
}
