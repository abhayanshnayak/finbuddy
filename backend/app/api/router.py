from fastapi import APIRouter

from app.api.endpoints import reports, companies, batches, auth, favorites, curated

api_router = APIRouter(prefix="/api")

api_router.include_router(reports.router, tags=["reports"])
api_router.include_router(companies.router, tags=["companies"])
api_router.include_router(batches.router, tags=["batches"])
api_router.include_router(auth.router, tags=["auth"])
api_router.include_router(favorites.router, tags=["favorites"])
api_router.include_router(curated.router, tags=["curated"])
