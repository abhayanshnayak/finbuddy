from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.router import api_router
from app.worker import router as worker_router
from app.core.config import settings

app = FastAPI(title="Finbuddy Stock Research API")

# Parse allowed CORS origins from settings
origins = [origin.strip() for origin in settings.ALLOWED_CORS_ORIGINS.split(",") if origin.strip()]
if not origins:
    origins = ["*"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include the API routes
app.include_router(api_router)

# Include the Pub/Sub worker route
app.include_router(worker_router)
