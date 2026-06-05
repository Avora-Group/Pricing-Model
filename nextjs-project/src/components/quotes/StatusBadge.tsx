'use client'

const STATUS_STYLES: Record<string, string> = {
  draft: 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300',
  sent: 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300',
  signed: 'bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300',
  active: 'bg-emerald-100 dark:bg-emerald-900 text-emerald-700 dark:text-emerald-300',
  accepted: 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300', // legacy alias of signed
  rejected: 'bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300',
}

export function StatusBadge({ status }: { status: string }) {
  const style = STATUS_STYLES[status.toLowerCase()] ?? 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
  const label = status.charAt(0).toUpperCase() + status.slice(1).toLowerCase()

  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${style}`}>
      {label}
    </span>
  )
}
