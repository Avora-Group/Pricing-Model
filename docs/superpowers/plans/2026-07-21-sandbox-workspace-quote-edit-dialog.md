# Sandbox Pricing Workspace & In-Dialog Quote Editing — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `/calculation` a self-cleaning sandbox with a one-click reset, and move all quote creation/editing into the Quotes-page dialog without ever disturbing sandbox state.

**Architecture:** Keep the three global zustand stores (`pricing-store`, `crew-config-store`, `costs-config-store`). A new helper module snapshots/restores/resets all three; the quote dialog snapshots on open and restores on close, the sandbox page leak-guards on mount. Quote editing reuses the existing hydration + edit-in-place save paths, relocated into the dialog.

**Tech Stack:** Next.js App Router (client components), zustand, lucide-react icons, existing `av-*` CSS utility classes.

**Spec:** `docs/superpowers/specs/2026-07-21-sandbox-workspace-quote-edit-dialog-design.md`

## Global Constraints

- No new dependencies; icons come from `lucide-react` (reset icon is `RefreshCw`).
- Working directory for all commands: `C:\Projects\acmi-app\nextjs-project`.
- No frontend test harness exists — every task verifies with `npx tsc --noEmit` (must be clean) and the final task adds `npx eslint src` + `npm run build`.
- Store restore uses zustand `setState(snapshot)` — action references are stable, so whole-state snapshots are safe.
- All effects must be React strict-mode safe (mount → cleanup → mount must not corrupt snapshots).
- Exact user-facing strings: reset button tooltip/aria `"Reset workspace"`; dialog titles `` `Edit ${quote_number} — Pricing Workspace` `` / `"New Quote — Pricing Workspace"` (em-dash `—`).
- Commit messages: plain imperative subject (repo style, no `feat:` prefixes), each ending with:

  ```
  Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
  ```

---

### Task 1: Workspace store snapshot/restore/reset helpers

**Files:**
- Create: `src/stores/workspace-stores.ts`

**Interfaces:**
- Consumes: `usePricingStore` (has `reset()`), `useCrewConfigStore` / `useCostsConfigStore` (both have `resetToDefaults()`).
- Produces: `snapshotWorkspaceStores(): WorkspaceSnapshot`, `restoreWorkspaceStores(snap: WorkspaceSnapshot): void`, `resetWorkspaceStores(): void` — used by Tasks 3 and 5.

- [ ] **Step 1: Create the helper module**

```ts
import { usePricingStore } from './pricing-store'
import { useCrewConfigStore } from './crew-config-store'
import { useCostsConfigStore } from './costs-config-store'

/**
 * Point-in-time copy of the three workspace stores (pricing + crew/costs
 * config). Zustand's setState produces a new state object on every write, so
 * holding the old getState() reference is a stable snapshot. Action function
 * references are stable across writes, which makes restoring via setState a
 * pure data rollback.
 */
export interface WorkspaceSnapshot {
  pricing: ReturnType<typeof usePricingStore.getState>
  crew: ReturnType<typeof useCrewConfigStore.getState>
  costs: ReturnType<typeof useCostsConfigStore.getState>
}

export function snapshotWorkspaceStores(): WorkspaceSnapshot {
  return {
    pricing: usePricingStore.getState(),
    crew: useCrewConfigStore.getState(),
    costs: useCostsConfigStore.getState(),
  }
}

export function restoreWorkspaceStores(snap: WorkspaceSnapshot): void {
  usePricingStore.setState(snap.pricing)
  useCrewConfigStore.setState(snap.crew)
  useCostsConfigStore.setState(snap.costs)
}

/** Blank slate: pricing cleared, crew/costs config back to company defaults. */
export function resetWorkspaceStores(): void {
  usePricingStore.getState().reset()
  useCrewConfigStore.getState().resetToDefaults()
  useCostsConfigStore.getState().resetToDefaults()
}
```

- [ ] **Step 2: Verify types**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/stores/workspace-stores.ts
git commit -m "Add workspace-store snapshot/restore/reset helpers"
```

---

### Task 2: Stale-write guard in useCalculation

**Files:**
- Modify: `src/components/pricing/hooks/useCalculation.ts`

**Interfaces:**
- Produces: no API change — the hook just stops writing to the store after its component unmounts. Task 5 relies on this so an in-flight calculation started inside the dialog cannot clobber the restored workspace state after close.

- [ ] **Step 1: Add an alive-ref and post-await bail-out**

The debounce timer is already cleared on unmount, but a `calculatePnlAction` that is mid-flight when the dialog closes resolves afterwards and would write into the restored store. Add after the existing `debounceRef` declaration (line 23):

```ts
  // A calculation that is mid-flight when this component unmounts (e.g. the
  // New Quote dialog closing and restoring workspace state) must not write
  // its result into the store afterwards.
  const aliveRef = useRef(true)
  useEffect(() => {
    aliveRef.current = true
    return () => {
      aliveRef.current = false
    }
  }, [])
```

Inside the debounce callback, immediately after `const result = await calculatePnlAction({...})` (line 72-77), add:

```ts
      if (!aliveRef.current) return
```

This single check precedes every store write that follows the await (`setLastError`, `setIsCalculating`, `setResults`).

- [ ] **Step 2: Verify types**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/pricing/hooks/useCalculation.ts
git commit -m "Guard useCalculation against store writes after unmount"
```

---

### Task 3: Sandbox mode for the Pricing Workspace

**Files:**
- Modify: `src/components/pricing/DashboardSummary.tsx`
- Modify: `src/app/(dashboard)/calculation/page.tsx`

**Interfaces:**
- Consumes: `resetWorkspaceStores` from Task 1.
- Produces: `DashboardSummary` gains prop `sandbox?: boolean` (default false). The dialog (Task 5) keeps rendering it *without* `sandbox`.

- [ ] **Step 1: Add the `sandbox` prop, leak guard, and reset button to DashboardSummary**

In `src/components/pricing/DashboardSummary.tsx`:

1. Extend imports: add `RefreshCw` to the existing `lucide-react` import; add `useEffect` is already imported; add:

```ts
import { resetWorkspaceStores } from '@/stores/workspace-stores'
```

2. Extend the props interface:

```ts
interface DashboardSummaryProps {
  aircraftList: AircraftOption[]
  isViewer?: boolean
  /** Called after a quote is saved/updated — lets a hosting modal close + refresh. */
  onSaved?: (quoteNumber: string) => void
  /** Sandbox page (/calculation): leak-guard hydrated quote data on mount and
   *  show the reset-workspace button. The quote dialog leaves this off. */
  sandbox?: boolean
}
```

and the signature:

```ts
export function DashboardSummary({ aircraftList, isViewer = false, onSaved, sandbox = false }: DashboardSummaryProps) {
```

3. Add the leak guard right after the `const isEditing = editingQuoteNumber !== null` line (line 60):

```ts
  // Sandbox leak guard: quote data hydrated elsewhere (quote detail page,
  // dashboard P&L deep-link) must never appear in the sandbox. Hydration
  // already overwrote any sandbox state, so nothing of value is lost.
  useEffect(() => {
    if (!sandbox) return
    if (usePricingStore.getState().editingQuoteId !== null) {
      resetWorkspaceStores()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
```

4. Add the reset button in the toolbar, immediately after the closing `</span>` of the `av-addgrp` span (after line 223, before `<span className="sp" />`):

```tsx
        {sandbox && !isViewer && (
          <button
            onClick={resetWorkspaceStores}
            title="Reset workspace"
            aria-label="Reset workspace"
            className="av-btn av-btn-ghost !h-[34px] !px-2.5 !py-0"
          >
            <RefreshCw size={13} />
          </button>
        )}
```

5. Delete the dead "New quote" toolbar button (lines 249-253):

```tsx
        {isEditing && !isViewer && (
          <button onClick={() => reset()} className="av-btn av-btn-ghost !text-xs !h-[34px] !py-0">
            New quote
          </button>
        )}
```

and remove `reset,` from the store destructuring (line 58) — it has no other use in this file. The `isEditing` badge (lines 229-233) stays: it can now only render inside the edit dialog.

- [ ] **Step 2: Mark the calculation page as sandbox and update its subtitle**

In `src/app/(dashboard)/calculation/page.tsx` replace the page body markup (lines 48-56) with:

```tsx
  return (
    <div className="space-y-6">
      <div>
        <h1 className="av-page-title">Pricing Workspace</h1>
        <p className="av-page-sub">Sandbox — enter commercial assumptions and experiment; resets on refresh</p>
      </div>
      <DashboardSummary aircraftList={aircraftList} isViewer={isViewer} sandbox />
    </div>
  )
```

- [ ] **Step 3: Verify types**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Manual smoke check (dev server)**

With `npm run dev` running: open `/calculation` → add an aircraft → click the new circular-arrows button → workspace clears without confirm. Open a quote detail page (`/quotes/<id>`), then navigate to Calculation → workspace is blank, no "Editing" badge.

- [ ] **Step 5: Commit**

```bash
git add src/components/pricing/DashboardSummary.tsx "src/app/(dashboard)/calculation/page.tsx"
git commit -m "Make Pricing Workspace a sandbox: leak guard + reset button, drop dead edit flow"
```

---

### Task 4: Extract hydrateStoresFromQuote from useQuoteHydration

**Files:**
- Modify: `src/components/quotes/hooks/useQuoteHydration.ts`

**Interfaces:**
- Produces: `export function hydrateStoresFromQuote(quote: QuoteDetailResponse): { msnInputs: MsnInput[]; exchangeRate: number }` — populates all three stores (pricing via `loadFromQuote` including the `editing` block, crew/costs via `loadFromSnapshot`) and returns what the hook needs for summary computation. Task 5 calls it directly. `useQuoteHydration(quote)` keeps its exact signature and behavior.

- [ ] **Step 1: Perform the extraction**

This is a pure move — the mapping logic does not change. New file layout:

```ts
/**
 * Populates the pricing, crew, and costs stores from a saved
 * QuoteDetailResponse (pricing via loadFromQuote — including edit-in-place
 * identity — crew/costs via loadFromSnapshot). Returns the reconstructed
 * msnInputs and the effective exchange rate for follow-up computations.
 */
export function hydrateStoresFromQuote(
  quote: QuoteDetailResponse
): { msnInputs: MsnInput[]; exchangeRate: number } {
  const dashboardState = (quote.dashboard_state ?? {}) as Record<string, string>

  // <<< move lines 33-171 of the current file here UNCHANGED: the
  // msnInputs mapping, msnResults mapping, totalResult computation,
  // usePricingStore.getState().loadFromQuote({...}) call, and the two
  // crew/costs loadFromSnapshot blocks >>>

  const exchangeRate = parseFloat(dashboardState.exchangeRate ?? quote.exchange_rate ?? '0.85')
  return { msnInputs, exchangeRate }
}

export function useQuoteHydration(quote: QuoteDetailResponse) {
  const [loaded, setLoaded] = useState(false)
  const [msnSummaries, setMsnSummaries] = useState<MsnPnlSummary[]>([])

  useEffect(() => {
    const { msnInputs, exchangeRate } = hydrateStoresFromQuote(quote)

    // Compute P&L summaries using the full engine (matches PnlTable logic)
    const crewData = useCrewConfigStore.getState()
    const costsData = useCostsConfigStore.getState()
    const summaries = msnInputs.map((input) =>
      computeMsnPnlSummarySeasonal(input, crewData, costsData, exchangeRate),
    )
    setMsnSummaries(summaries)
    setLoaded(true)
  }, [quote])

  return { loaded, msnSummaries }
}
```

Notes for the mover:
- The current `exRate` computation (line 176) becomes the `exchangeRate` line above — same expression, renamed variable.
- All existing imports stay; nothing else changes.
- `hydrateStoresFromQuote` must be a plain exported function (no hooks inside).

- [ ] **Step 2: Verify types**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Manual smoke check**

Open a quote detail page — summary cards render exactly as before (hook behavior unchanged).

- [ ] **Step 4: Commit**

```bash
git add src/components/quotes/hooks/useQuoteHydration.ts
git commit -m "Extract hydrateStoresFromQuote for reuse outside the hook"
```

---

### Task 5: NewQuoteModal — snapshot/restore isolation + edit mode

**Files:**
- Modify: `src/components/quotes/NewQuoteModal.tsx` (full rewrite below)

**Interfaces:**
- Consumes: Task 1 helpers, Task 4 `hydrateStoresFromQuote`.
- Produces: new optional prop `editQuote?: QuoteDetailResponse | null`. When set, the dialog hydrates that quote (store `editingQuoteId` drives `SaveQuoteDialog`'s existing update-in-place path). Tasks 6 and 7 pass it.

- [ ] **Step 1: Replace the file content**

```tsx
'use client'

import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import {
  snapshotWorkspaceStores,
  restoreWorkspaceStores,
  resetWorkspaceStores,
} from '@/stores/workspace-stores'
import { hydrateStoresFromQuote } from './hooks/useQuoteHydration'
import { DashboardSummary } from '@/components/pricing/DashboardSummary'
import type { AircraftOption } from '@/lib/api-converters'
import type { QuoteDetailResponse } from '@/app/actions/quotes'

interface NewQuoteModalProps {
  isOpen: boolean
  onClose: () => void
  /** Called with the quote number after a successful save/update. */
  onSaved: (quoteNumber: string) => void
  aircraftList: AircraftOption[]
  /** When set, the dialog edits this existing quote in place (stores are
   *  hydrated from it; saving updates the same quote). Otherwise it opens
   *  as a blank New Quote. */
  editQuote?: QuoteDetailResponse | null
}

/**
 * "New Quote" / "Edit Quote" — the full Pricing Workspace in a centered
 * overlay (75vw × 80vh). The three workspace stores are snapshotted when the
 * dialog opens and restored when it closes (saved or cancelled), so the
 * dialog never disturbs the sandbox Pricing Workspace. Closes on ✕ or
 * Escape only — no backdrop-click close, so half-entered inputs aren't lost
 * to a stray click.
 */
export function NewQuoteModal({
  isOpen,
  onClose,
  onSaved,
  aircraftList,
  editQuote = null,
}: NewQuoteModalProps) {
  // Stores are prepared in the effect below; gate the body on `ready` so
  // children first mount AFTER preparation (SaveQuoteDialog reads the
  // editing client name into useState at mount time). The effect-with-
  // cleanup shape is strict-mode safe: a double invoke restores the
  // snapshot before re-snapshotting, so the original state survives.
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (!isOpen) return
    const snap = snapshotWorkspaceStores()
    if (editQuote) {
      hydrateStoresFromQuote(editQuote)
    } else {
      resetWorkspaceStores()
    }
    setReady(true)
    return () => {
      setReady(false)
      restoreWorkspaceStores(snap)
    }
  }, [isOpen, editQuote])

  // Close on Escape — unless the nested Save Quote dialog is on top.
  useEffect(() => {
    if (!isOpen) return
    function handleKey(e: KeyboardEvent) {
      if (e.key !== 'Escape') return
      if (document.querySelector('[data-dialog="save-quote"]')) return
      onClose()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div
        className="av-panel flex flex-col overflow-hidden"
        style={{ width: '75vw', height: '80vh', boxShadow: '0 20px 50px rgba(0,0,0,.3)' }}
      >
        {/* Header */}
        <div className="av-panel-h shrink-0">
          <h2>
            {editQuote
              ? `Edit ${editQuote.quote_number} — Pricing Workspace`
              : 'New Quote — Pricing Workspace'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="transition-colors"
            style={{ color: 'var(--muted)' }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Workspace body */}
        <div className="flex-1 overflow-y-auto p-[18px]">
          {ready && (
            <DashboardSummary aircraftList={aircraftList} isViewer={false} onSaved={onSaved} />
          )}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify types**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Manual smoke check**

Build sandbox state on `/calculation` → go to Quotes → open New Quote → add a different aircraft → close (✕) → back to Calculation: sandbox state is intact.

- [ ] **Step 4: Commit**

```bash
git add src/components/quotes/NewQuoteModal.tsx
git commit -m "Isolate quote dialog via store snapshot/restore; add edit mode"
```

---

### Task 6: Quotes list — drop the confirm, add row Edit action

**Files:**
- Modify: `src/components/quotes/QuoteList.tsx`

**Interfaces:**
- Consumes: `NewQuoteModal` `editQuote` prop (Task 5), existing `getQuoteAction` server action.
- Produces: user-facing only.

- [ ] **Step 1: Remove the workspace-clearing confirm**

Delete `handleNewQuote` (lines 126-135) and the `usePricingStore` import (line 8). Change the New Quote button's handler (line 197) to:

```tsx
                onClick={() => setShowNewQuote(true)}
```

- [ ] **Step 2: Add edit state and handler**

Add `Pencil` to the `lucide-react` import; extend the quotes-actions import:

```ts
import { listQuotesAction, updateQuoteStatusAction, deleteQuoteAction, getQuoteAction } from '@/app/actions/quotes'
import type { QuoteListItem, QuoteDetailResponse } from '@/app/actions/quotes'
```

Add state next to `showNewQuote` (line 43):

```ts
  const [editQuote, setEditQuote] = useState<QuoteDetailResponse | null>(null)
  const [editLoadingId, setEditLoadingId] = useState<number | null>(null)
```

Add the handler next to `handleDelete`:

```ts
  const handleEdit = async (quoteId: number) => {
    setStatusError(null)
    setEditLoadingId(quoteId)
    const result = await getQuoteAction(quoteId)
    setEditLoadingId(null)
    if ('error' in result) {
      setStatusError(result.error)
      return
    }
    setEditQuote(result)
  }
```

- [ ] **Step 3: Add the row Edit button**

In the actions cell, between the "Open" link and the delete button (after line 265), insert:

```tsx
                            <button
                              type="button"
                              onClick={() => handleEdit(q.id)}
                              disabled={editLoadingId === q.id}
                              title="Edit quote"
                              aria-label={`Edit ${q.quote_number}`}
                              className="p-1 rounded transition-colors disabled:opacity-50"
                              style={{ color: 'var(--muted)' }}
                            >
                              <Pencil size={14} />
                            </button>
```

(The surrounding cell is already `!isViewer`-gated, so no extra role check is needed.)

- [ ] **Step 4: Wire the modal for both modes**

Replace the `<NewQuoteModal ... />` block (lines 293-304) with:

```tsx
      <NewQuoteModal
        isOpen={showNewQuote || editQuote !== null}
        editQuote={editQuote}
        onClose={() => {
          setShowNewQuote(false)
          setEditQuote(null)
        }}
        aircraftList={aircraftList}
        onSaved={() => {
          setShowNewQuote(false)
          setEditQuote(null)
          // The list is client state seeded from a server prop — re-fetch it
          // directly, and refresh the route so server-computed financials update.
          fetchQuotes(search, statusFilter)
          router.refresh()
        }}
      />
```

- [ ] **Step 5: Verify types**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Manual smoke check**

Quotes page: New Quote opens with no confirm. Pencil on a row opens "Edit Q-xxxx — Pricing Workspace" pre-filled; Update Quote → list refreshes, values update, no navigation.

- [ ] **Step 7: Commit**

```bash
git add src/components/quotes/QuoteList.tsx
git commit -m "Quotes list: in-dialog quote editing, drop workspace-clearing confirm"
```

---

### Task 7: Quote detail page — edit in place, no more redirects

**Files:**
- Modify: `src/app/(dashboard)/quotes/[id]/page.tsx`
- Modify: `src/app/(dashboard)/quotes/[id]/QuoteDetailClient.tsx`
- Modify: `src/components/quotes/QuoteHeader.tsx`

**Interfaces:**
- Consumes: `NewQuoteModal` `editQuote` prop (Task 5).
- Produces: `QuoteHeader` prop change — `onEdit?: () => void` replaces the internal `/calculation` push; `QuoteDetailClient` gains `isViewer?: boolean`.

- [ ] **Step 1: Fetch the user role in the page server component**

In `src/app/(dashboard)/quotes/[id]/page.tsx`, add below `getAircraftList` (same pattern as the calculation page):

```ts
async function getIsViewer(token: string): Promise<boolean> {
  try {
    const res = await fetch(`${API_URL}/auth/me`, {
      headers: { Cookie: `access_token=${token}` },
      cache: 'no-store',
    })
    if (!res.ok) return false
    const user = await res.json()
    return user.role === 'viewer'
  } catch {
    return false
  }
}
```

Extend the parallel fetch and the client props:

```ts
  const [quote, aircraftList, isViewer] = await Promise.all([
    getQuoteDetail(id, token),
    getAircraftList(token),
    getIsViewer(token),
  ])
```

```tsx
      <QuoteDetailClient quote={quote} aircraftList={aircraftList} isViewer={isViewer} />
```

- [ ] **Step 2: Rework QuoteHeader**

Replace `src/components/quotes/QuoteHeader.tsx` content with:

```tsx
'use client'

import { useRouter } from 'next/navigation'
import { ArrowLeft, Pencil, TrendingUp } from 'lucide-react'
import { StatusBadge } from '@/components/quotes/StatusBadge'

interface QuoteHeaderProps {
  quoteNumber: string
  clientName: string
  status: string
  createdAt: string
  /** Opens the in-place edit dialog. Omit (e.g. for viewers) to hide Edit. */
  onEdit?: () => void
}

function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return dateStr
  }
}

export function QuoteHeader({ quoteNumber, clientName, status, createdAt, onEdit }: QuoteHeaderProps) {
  const router = useRouter()

  return (
    <div className="av-panel">
      <div className="av-card-b flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h1 className="av-page-title av-num !text-[22px]">
              {quoteNumber}
            </h1>
            <StatusBadge status={status} />
          </div>
          <p style={{ color: 'var(--ink-2)' }}>{clientName}</p>
          <p className="text-xs mt-1" style={{ color: 'var(--muted)' }}>
            Created {formatDate(createdAt)}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => router.push('/quotes')}
            className="av-btn av-btn-ghost"
          >
            <ArrowLeft size={14} />
            Back to Quotes
          </button>
          <button
            type="button"
            onClick={() => router.push('/pnl')}
            className="av-btn av-btn-ghost"
          >
            <TrendingUp size={14} />
            Go to P&amp;L
          </button>
          {onEdit && (
            <button
              type="button"
              onClick={onEdit}
              className="av-btn av-btn-primary"
            >
              <Pencil size={14} />
              Edit
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
```

(This removes "Go to Calculation", the `ExternalLink`/`Calculator` icons, the redirect, and the "Click Edit to open this quote in Calculation…" info banner — the fragment wrapper collapses to the single panel div.)

- [ ] **Step 3: Rework QuoteDetailClient**

Replace `src/app/(dashboard)/quotes/[id]/QuoteDetailClient.tsx` content with:

```tsx
'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useQuoteHydration } from '@/components/quotes/hooks/useQuoteHydration'
import { QuoteHeader } from '@/components/quotes/QuoteHeader'
import { NewQuoteModal } from '@/components/quotes/NewQuoteModal'
import { SummaryTable } from '@/components/pricing/SummaryTable'
import type { QuoteDetailResponse } from '@/app/actions/quotes'
import type { AircraftOption } from '@/lib/api-converters'

interface QuoteDetailClientProps {
  quote: QuoteDetailResponse
  aircraftList?: AircraftOption[]
  isViewer?: boolean
}

export function QuoteDetailClient({ quote, aircraftList = [], isViewer = false }: QuoteDetailClientProps) {
  const { loaded } = useQuoteHydration(quote)
  const router = useRouter()
  const searchParams = useSearchParams()
  const [showEdit, setShowEdit] = useState(false)

  // Deep-link target (e.g. from the dashboard): once this quote's data is
  // hydrated into the stores, forward to P&L to inspect it.
  const go = searchParams.get('go')
  useEffect(() => {
    if (loaded && go === 'pnl') {
      router.replace('/pnl')
    }
  }, [loaded, go, router])

  if (go === 'pnl') {
    return (
      <div className="flex items-center justify-center py-20 text-sm" style={{ color: 'var(--muted)' }}>
        Loading {quote.quote_number} into P&L…
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <QuoteHeader
        quoteNumber={quote.quote_number}
        clientName={quote.client_name}
        status={quote.status}
        createdAt={quote.created_at}
        onEdit={!isViewer ? () => setShowEdit(true) : undefined}
      />

      {/* Same summary cards as the Pricing Workspace (metrics, ACMI cost
          build-up, cost breakdown), driven by the hydrated pricing store. */}
      {loaded ? (
        <SummaryTable aircraftList={aircraftList} />
      ) : (
        <div className="flex items-center justify-center py-20 text-sm" style={{ color: 'var(--muted)' }}>
          Loading {quote.quote_number}…
        </div>
      )}

      {/* Navigation hint */}
      <div className="text-xs" style={{ color: 'var(--muted)' }}>
        Stores are loaded with this quote&apos;s data. Navigate to{' '}
        <Link href="/pnl" className="av-link">
          P&amp;L
        </Link>
        ,{' '}
        <Link href="/crew" className="av-link">
          Crew
        </Link>
        , or{' '}
        <Link href="/costs" className="av-link">
          Costs
        </Link>{' '}
        to see full details from this quote.
      </div>

      {/* In-place edit dialog. After an update, router.refresh() re-fetches
          the quote; the fresh prop re-runs useQuoteHydration, overwriting the
          snapshot the closing dialog restored. */}
      <NewQuoteModal
        isOpen={showEdit}
        editQuote={quote}
        onClose={() => setShowEdit(false)}
        aircraftList={aircraftList}
        onSaved={() => {
          setShowEdit(false)
          router.refresh()
        }}
      />
    </div>
  )
}
```

- [ ] **Step 4: Verify types**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Manual smoke check**

Detail page: no "Go to Calculation" button, no info banner. Edit opens the dialog in place; Update Quote → dialog closes, page shows fresh numbers, URL unchanged. `?go=pnl` deep-link still forwards.

- [ ] **Step 6: Commit**

```bash
git add "src/app/(dashboard)/quotes/[id]/page.tsx" "src/app/(dashboard)/quotes/[id]/QuoteDetailClient.tsx" src/components/quotes/QuoteHeader.tsx
git commit -m "Quote detail: edit in dialog, remove Calculation redirect and banner"
```

---

### Task 8: Dashboard repoint + full verification

**Files:**
- Modify: `src/components/dashboard/DashboardMetrics.tsx:392-394`

**Interfaces:**
- Consumes: Task 7 (QuoteDetailClient no longer handles `go=calculation`).
- Produces: user-facing only.

- [ ] **Step 1: Repoint the "Calculation" deep-link**

The leak guard would instantly wipe a quote loaded into `/calculation`, so the link now opens the quote detail page (which shows the same calculation summary). Replace lines 392-394:

```tsx
            <Link href={`/quotes/${p.id}`} className="av-btn av-btn-ghost !py-1 !px-2.5 !text-[12px]">
              <Calculator size={13} /> Open
            </Link>
```

(The `?go=pnl` link below it stays unchanged.)

- [ ] **Step 2: Full static verification**

Run: `npx tsc --noEmit`
Expected: no errors.

Run: `npx eslint src`
Expected: no errors (warnings acceptable only if pre-existing).

Run: `npm run build`
Expected: build succeeds. **Note:** if a dev server is running, stop it first — builds under a running `next dev` are known (in this repo) to leave the dev server serving stale CSS; restart the dev server afterwards.

- [ ] **Step 3: Manual verification checklist (from the spec)**

1. Sandbox: build a calc on `/calculation` → visit P&L → return: state intact. F5: state gone.
2. Sandbox: view a quote detail → go to Calculation: workspace blank, no "Editing" badge.
3. Reset button clears aircraft, rates, and crew/costs overrides in one click.
4. Quotes page: build sandbox state → New Quote → add aircraft → close → Calculation still shows sandbox state.
5. New Quote → save: quote appears in list; workspace untouched.
6. List row Edit → dialog pre-filled (client name/code included in the Update dialog) → Update Quote → list and detail show updated values; no redirect.
7. Detail page Edit → same dialog in place; after update the page shows fresh numbers.
8. Dashboard: "Open" goes to quote detail; "P&L" still loads the quote into P&L.
9. Viewer role sees no Edit / New Quote / Reset controls.

- [ ] **Step 4: Commit**

```bash
git add src/components/dashboard/DashboardMetrics.tsx
git commit -m "Dashboard: link project card to quote detail instead of Calculation deep-link"
```
