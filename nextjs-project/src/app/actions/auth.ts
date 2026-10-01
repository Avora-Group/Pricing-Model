'use server'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { TRACKER_RT_DELETE } from '@/lib/tracker-rt'

export async function logoutAction() {
  const cookieStore = await cookies()
  cookieStore.delete('access_token')
  cookieStore.delete(TRACKER_RT_DELETE)
  redirect('/login')
}
