"""Pricing router aggregator.

Combines domain sub-routers under the /pricing prefix:
- calculate: P&L calculation endpoint
- config: Pricing and crew configuration CRUD
- projects: Project and MSN input management
- dashboard: Company-wide dashboard metrics
"""
from fastapi import APIRouter

from app.pricing.routes.calculate import router as calculate_router
from app.pricing.routes.config import router as config_router
from app.pricing.routes.dashboard import router as dashboard_router
from app.pricing.routes.projects import router as projects_router

router = APIRouter(prefix="/pricing", tags=["pricing"])

router.include_router(calculate_router)
router.include_router(config_router)
router.include_router(projects_router)
router.include_router(dashboard_router)
