from fastapi.testclient import TestClient
from unittest.mock import MagicMock

from app.main import app
from app.core.auth import AuthenticatedUser

client = TestClient(app)


def test_auth_status_allows_anonymous_requests():
    response = client.get("/api/auth/status")

    assert response.status_code == 200
    assert response.json() == {"authenticated": False, "user": None}


def test_auth_status_returns_user_when_valid_token_provided(mocker):
    mocker.patch(
        "app.core.auth.verify_firebase_id_token",
        return_value=AuthenticatedUser(
            uid="uid-google-1",
            name="Abhay Nayak",
            email="abhay@example.com",
            picture="https://example.com/avatar.png",
            provider="google.com",
            email_verified=True,
        ),
    )

    response = client.get(
        "/api/auth/status",
        headers={"Authorization": "Bearer valid-token"},
    )

    assert response.status_code == 200
    data = response.json()
    assert data["authenticated"] is True
    assert data["user"]["uid"] == "uid-google-1"
    assert data["user"]["name"] == "Abhay Nayak"
    assert data["user"]["provider"] == "google.com"


def test_auth_status_rejects_invalid_bearer_token(mocker):
    mocker.patch(
        "app.core.auth.verify_firebase_id_token",
        side_effect=ValueError("Token expired"),
    )

    response = client.get(
        "/api/auth/status",
        headers={"Authorization": "Bearer expired-token"},
    )

    assert response.status_code == 401


def test_auth_me_requires_authentication():
    response = client.get("/api/auth/me")
    assert response.status_code == 401


def test_auth_me_rejects_malformed_authorization_header():
    response = client.get(
        "/api/auth/me",
        headers={"Authorization": "Basic abc123"},
    )
    assert response.status_code == 401


def test_auth_me_upserts_user_profile_and_returns_user(mocker):
    mock_db = MagicMock()
    mocker.patch("app.api.endpoints.auth.db", mock_db)
    mocker.patch(
        "app.core.auth.verify_firebase_id_token",
        return_value=AuthenticatedUser(
            uid="uid-fb-2",
            name="Jane Investor",
            email="jane@example.com",
            picture="https://example.com/jane.png",
            provider="facebook.com",
            email_verified=True,
        ),
    )

    response = client.get(
        "/api/auth/me",
        headers={"Authorization": "Bearer valid-fb-token"},
    )

    assert response.status_code == 200
    data = response.json()
    assert data["uid"] == "uid-fb-2"
    assert data["name"] == "Jane Investor"
    assert data["provider"] == "facebook.com"
    mock_db.upsert_user_profile.assert_called_once_with("uid-fb-2", data)
