from typing import Optional
from fastapi import APIRouter, Depends

from app.core.auth import AuthenticatedUser, get_current_user, get_optional_user
from app.dependencies import db_service as db

router = APIRouter(prefix="/auth")


@router.get("/status")
def get_auth_status(user: Optional[AuthenticatedUser] = Depends(get_optional_user)):
    """
    Returns whether the caller is authenticated without requiring sign-in.
    """
    return {
        "authenticated": user is not None,
        "user": user.model_dump() if user else None,
    }


@router.get("/me")
def get_me(user: AuthenticatedUser = Depends(get_current_user)):
    """
    Verifies the caller's Firebase ID token, upserts their lightweight profile in Firestore
    (users/{uid}) for upcoming per-user features, and returns the verified identity.
    """
    payload = user.model_dump()
    db.upsert_user_profile(user.uid, payload)
    return payload
