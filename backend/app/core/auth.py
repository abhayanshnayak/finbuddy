from typing import Optional
from fastapi import Depends, HTTPException, Request, status
from google.auth.transport import requests as google_requests
from google.oauth2 import id_token
from pydantic import BaseModel

from app.core.config import settings

_auth_request = google_requests.Request()


class AuthenticatedUser(BaseModel):
    uid: str
    name: Optional[str] = None
    email: Optional[str] = None
    picture: Optional[str] = None
    provider: Optional[str] = None
    email_verified: bool = False


def verify_firebase_id_token(token: str) -> AuthenticatedUser:
    """
    Verifies a Firebase Auth ID token (issued for Google, Facebook, or other configured providers)
    against Google's public Secure Token X.509 certificates.
    """
    project_id = (settings.FIREBASE_PROJECT_ID or settings.GCP_PROJECT_ID or "").strip()
    if not project_id:
        raise ValueError("Firebase project ID is not configured.")

    claims = id_token.verify_firebase_token(
        token,
        _auth_request,
        audience=project_id,
        clock_skew_in_seconds=10,
    )

    expected_issuer = f"https://securetoken.google.com/{project_id}"
    if claims.get("iss") != expected_issuer:
        raise ValueError(f"Invalid token issuer: {claims.get('iss')}")

    uid = claims.get("sub") or claims.get("user_id")
    if not uid or not isinstance(uid, str):
        raise ValueError("Token is missing a valid subject (uid).")

    firebase_meta = claims.get("firebase") or {}
    provider = firebase_meta.get("sign_in_provider") if isinstance(firebase_meta, dict) else None

    return AuthenticatedUser(
        uid=uid,
        name=claims.get("name"),
        email=claims.get("email"),
        picture=claims.get("picture"),
        provider=provider,
        email_verified=bool(claims.get("email_verified", False)),
    )


def get_optional_user(request: Request) -> Optional[AuthenticatedUser]:
    """
    FastAPI dependency for endpoints where authentication is optional.
    - Returns None when no Authorization header is sent.
    - Verifies the Bearer Firebase ID token when present, raising 401 if malformed or invalid.
    """
    auth_header = request.headers.get("Authorization")
    if not auth_header:
        return None

    parts = auth_header.strip().split(" ", 1)
    if len(parts) != 2 or parts[0].lower() != "bearer" or not parts[1].strip():
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Malformed Authorization header. Expected 'Bearer <token>'.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = parts[1].strip()
    try:
        return verify_firebase_id_token(token)
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired authentication token.",
            headers={"WWW-Authenticate": "Bearer"},
        )


def get_current_user(
    user: Optional[AuthenticatedUser] = Depends(get_optional_user),
) -> AuthenticatedUser:
    """
    FastAPI dependency for future per-user endpoints that require a signed-in user.
    """
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return user
