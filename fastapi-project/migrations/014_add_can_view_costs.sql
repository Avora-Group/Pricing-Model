-- Naked-cost access control.
-- Adds a per-user flag gating visibility of actual cost figures and profit margins.
-- Only users with can_view_costs = TRUE (and admins) receive naked cost/margin data;
-- for everyone else the API omits those fields entirely (enforced server-side).
-- Run: psql $DATABASE_URL -f fastapi-project/migrations/014_add_can_view_costs.sql

ALTER TABLE users ADD COLUMN IF NOT EXISTS can_view_costs BOOLEAN NOT NULL DEFAULT FALSE;

-- Admins always have full cost visibility.
UPDATE users SET can_view_costs = TRUE WHERE role = 'admin';
