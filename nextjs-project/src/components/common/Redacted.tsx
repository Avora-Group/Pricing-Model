/**
 * Shared naked-cost redaction placeholder.
 *
 * Rendered in place of a cost / profit / margin figure when the current user
 * lacks cost-view permission. The `.av-redacted` class (globals.css) draws the
 * hatched pill; the aria-label keeps it accessible.
 */
export function Redacted() {
  return (
    <span className="av-redacted" aria-label="Hidden — insufficient permission">
      ••••
    </span>
  )
}
