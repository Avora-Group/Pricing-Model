/**
 * Design-sync bundle entry — NOT used by the app.
 *
 * Re-exports the presentational design-system surface for the claude.ai/design
 * sync (see .design-sync/config.json). Only pure, app-decoupled components
 * belong here; anything importing stores, server actions, or next/* stays out.
 */
export { StatusBadge } from './components/quotes/StatusBadge'
export { Redacted } from './components/common/Redacted'
export { FormulaCell, SectionHeader, TableCard } from './components/ui/TableParts'
export { EditableCell } from './components/ui/EditableCell'
export { ReadOnlyProvider, useReadOnly } from './components/ui/ReadOnlyContext'
export { LineDetailPopover } from './components/pricing/CostDetailPopover'
export type { BreakdownItem, ParamItem } from './components/pricing/CostDetailPopover'
export { PlaceholderPage } from './components/ui/PlaceholderPage'
