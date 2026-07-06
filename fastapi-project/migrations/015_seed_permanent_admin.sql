-- Migration 015: Seed permanent admin (Abukhair Alpyspayev)
-- Ensures abukhair.alpyspayev@avora.aero always exists as an active admin with
-- full cost visibility. This also allowlists the address for Azure AD login
-- (auth/azure rejects any email that has no user row).
--
-- Idempotent: if the row already exists it is forced back to admin/active so the
-- account can never be silently demoted at the data layer. Application-level
-- protection against demotion/deactivation lives in app/users/router.py.

INSERT INTO users (email, hashed_password, azure_id, role, full_name, is_active, can_view_costs)
VALUES (
    'abukhair.alpyspayev@avora.aero',
    NULL,
    NULL,
    'admin',
    'Abukhair Alpyspayev',
    TRUE,
    TRUE
)
ON CONFLICT (email) DO UPDATE
    SET role = 'admin',
        is_active = TRUE,
        can_view_costs = TRUE,
        updated_at = NOW();
