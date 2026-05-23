from fastapi import APIRouter

from app.api.endpoints import reports, companies, batches

api_router = APIRouter(prefix="/api")

api_router.include_router(reports.router, tags=["reports"])
api_router.include_router(companies.router, tags=["companies"])
api_router.include_router(batches.router, tags=["batches"])
