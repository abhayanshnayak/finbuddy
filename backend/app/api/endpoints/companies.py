from fastapi import APIRouter
from app.dependencies import db_service as db

router = APIRouter()

@router.get("/companies")
def get_all_companies():
    companies = db.list_companies()
    return companies
