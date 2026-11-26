import pytest
from app.core.auth import verify_firebase_id_token
from app.core.config import settings


def test_verify_firebase_token_google_provider(mocker):
    project_id = settings.FIREBASE_PROJECT_ID or settings.GCP_PROJECT_ID
    mock_verify = mocker.patch(
        "app.core.auth.id_token.verify_firebase_token",
        return_value={
            "iss": f"https://securetoken.google.com/{project_id}",
            "aud": project_id,
            "sub": "google-uid-123",
            "name": "Ada Lovelace",
            "email": "ada@example.com",
            "picture": "https://lh3.googleusercontent.com/a/photo",
            "email_verified": True,
            "firebase": {"sign_in_provider": "google.com"},
        },
    )

    user = verify_firebase_id_token("fake-google-jwt")

    assert user.uid == "google-uid-123"
    assert user.name == "Ada Lovelace"
    assert user.email == "ada@example.com"
    assert user.provider == "google.com"
    assert user.email_verified is True
    mock_verify.assert_called_once()


def test_verify_firebase_token_facebook_provider(mocker):
    project_id = settings.FIREBASE_PROJECT_ID or settings.GCP_PROJECT_ID
    mocker.patch(
        "app.core.auth.id_token.verify_firebase_token",
        return_value={
            "iss": f"https://securetoken.google.com/{project_id}",
            "aud": project_id,
            "sub": "fb-uid-456",
            "name": "Grace Hopper",
            "email": "grace@example.com",
            "picture": "https://graph.facebook.com/456/picture",
            "email_verified": False,
            "firebase": {"sign_in_provider": "facebook.com"},
        },
    )

    user = verify_firebase_id_token("fake-facebook-jwt")

    assert user.uid == "fb-uid-456"
    assert user.name == "Grace Hopper"
    assert user.provider == "facebook.com"
    assert user.email_verified is False


def test_verify_firebase_token_rejects_wrong_issuer(mocker):
    mocker.patch(
        "app.core.auth.id_token.verify_firebase_token",
        return_value={
            "iss": "https://securetoken.google.com/some-other-project",
            "sub": "uid-789",
        },
    )

    with pytest.raises(ValueError, match="Invalid token issuer"):
        verify_firebase_id_token("wrong-iss-jwt")


def test_verify_firebase_token_rejects_missing_sub(mocker):
    project_id = settings.FIREBASE_PROJECT_ID or settings.GCP_PROJECT_ID
    mocker.patch(
        "app.core.auth.id_token.verify_firebase_token",
        return_value={
            "iss": f"https://securetoken.google.com/{project_id}",
            "email": "missing-sub@example.com",
        },
    )

    with pytest.raises(ValueError, match="subject"):
        verify_firebase_id_token("no-sub-jwt")
