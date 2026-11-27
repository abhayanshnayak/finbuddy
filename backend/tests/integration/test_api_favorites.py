import pytest
from fastapi.testclient import TestClient
from unittest.mock import MagicMock

from app.main import app
from app.core.auth import AuthenticatedUser
from app.api.endpoints import favorites as favorites_endpoint

client = TestClient(app)


@pytest.fixture(autouse=True)
def reset_quote_cache():
    favorites_endpoint.clear_quote_cache()
    yield
    favorites_endpoint.clear_quote_cache()


def _mock_authenticated_user(mocker, uid="uid-fav-1"):
    user = AuthenticatedUser(
        uid=uid,
        name="Value Investor",
        email="investor@example.com",
        provider="google.com",
        email_verified=True,
    )
    mocker.patch("app.core.auth.verify_firebase_id_token", return_value=user)
    return user


def test_favorites_endpoints_require_authentication():
    assert client.get("/api/favorites").status_code == 401
    assert client.put("/api/favorites/AAPL", json={"name": "Apple Inc."}).status_code == 401
    assert client.patch("/api/favorites/AAPL", json={"margin_of_safety_price": 150.0}).status_code == 401
    assert client.delete("/api/favorites/AAPL").status_code == 401


def test_list_favorites_enriches_live_quote_and_delta(mocker):
    _mock_authenticated_user(mocker, uid="uid-100")

    mock_db = MagicMock()
    mock_db.list_user_favorites.return_value = [
        {
            "ticker": "AAPL",
            "name": "Apple Inc.",
            "industry": "Technology",
            "margin_of_safety_price": 150.0,
            "model_mos_price": 142.5,
            "last_known_price": 175.0,
            "added_at": "2026-11-26T10:00:00+00:00",
            "updated_at": "2026-11-26T10:00:00+00:00",
        },
        {
            "ticker": "MSFT",
            "name": "Microsoft Corporation",
            "industry": "Technology",
            "margin_of_safety_price": 450.0,
            "model_mos_price": 400.0,
            "last_known_price": 410.0,
            "added_at": "2026-11-25T10:00:00+00:00",
            "updated_at": "2026-11-25T10:00:00+00:00",
        },
    ]
    mocker.patch("app.api.endpoints.favorites.db", mock_db)

    mock_finnhub = MagicMock()
    mock_finnhub.get_quote.side_effect = lambda sym: {
        "AAPL": {"c": 180.0, "dp": 1.25},
        "MSFT": {"c": 405.0, "dp": -0.5},
    }[sym]
    mocker.patch("app.api.endpoints.favorites.finnhub", mock_finnhub)

    response = client.get(
        "/api/favorites",
        headers={"Authorization": "Bearer valid-token"},
    )

    assert response.status_code == 200
    payload = response.json()
    assert len(payload["favorites"]) == 2

    aapl = payload["favorites"][0]
    assert aapl["ticker"] == "AAPL"
    assert aapl["current_price"] == 180.0
    assert aapl["price_source"] == "live"
    assert aapl["day_change_pct"] == 1.25
    assert aapl["margin_of_safety_price"] == 150.0
    assert aapl["delta_amount"] == 30.0
    assert aapl["delta_pct"] == 20.0

    msft = payload["favorites"][1]
    assert msft["ticker"] == "MSFT"
    assert msft["current_price"] == 405.0
    assert msft["margin_of_safety_price"] == 450.0
    assert msft["delta_amount"] == -45.0
    assert msft["delta_pct"] == -10.0

    mock_db.list_user_favorites.assert_called_once_with("uid-100")


def test_list_favorites_falls_back_to_cached_price_when_quote_fails(mocker):
    _mock_authenticated_user(mocker)

    mock_db = MagicMock()
    mock_db.list_user_favorites.return_value = [
        {
            "ticker": "COST",
            "name": "Costco Wholesale",
            "industry": "Retail",
            "margin_of_safety_price": 700.0,
            "last_known_price": 840.0,
            "added_at": "2026-11-26T10:00:00+00:00",
        }
    ]
    mocker.patch("app.api.endpoints.favorites.db", mock_db)

    mock_finnhub = MagicMock()
    mock_finnhub.get_quote.side_effect = RuntimeError("Finnhub rate limit")
    mocker.patch("app.api.endpoints.favorites.finnhub", mock_finnhub)

    response = client.get(
        "/api/favorites",
        headers={"Authorization": "Bearer valid-token"},
    )

    assert response.status_code == 200
    item = response.json()["favorites"][0]
    assert item["current_price"] == 840.0
    assert item["price_source"] == "cached"
    assert item["delta_amount"] == 140.0
    assert item["delta_pct"] == 20.0


def test_upsert_favorite_normalizes_ticker_and_populates_company_fallback(mocker):
    _mock_authenticated_user(mocker, uid="uid-200")

    mock_db = MagicMock()
    mock_db.get_company_data.return_value = {
        "name": "NVIDIA Corporation",
        "industry": "Semiconductors",
        "price_at_storage": 130.0,
    }
    mock_db.upsert_user_favorite.return_value = {
        "ticker": "NVDA",
        "name": "NVIDIA Corporation",
        "industry": "Semiconductors",
        "margin_of_safety_price": None,
        "model_mos_price": 95.0,
        "last_known_price": 130.0,
        "added_at": "2026-11-26T12:00:00+00:00",
        "updated_at": "2026-11-26T12:00:00+00:00",
    }
    mocker.patch("app.api.endpoints.favorites.db", mock_db)

    mock_finnhub = MagicMock()
    mock_finnhub.get_quote.return_value = {"c": 135.5, "dp": 2.1}
    mocker.patch("app.api.endpoints.favorites.finnhub", mock_finnhub)

    response = client.put(
        "/api/favorites/nvda",
        json={"model_mos_price": 95.0},
        headers={"Authorization": "Bearer valid-token"},
    )

    assert response.status_code == 200
    data = response.json()
    assert data["ticker"] == "NVDA"
    assert data["name"] == "NVIDIA Corporation"
    assert data["current_price"] == 135.5
    assert data["margin_of_safety_price"] is None
    assert data["delta_amount"] is None
    assert data["delta_pct"] is None

    mock_db.upsert_user_favorite.assert_called_once_with(
        "uid-200",
        "NVDA",
        {
            "model_mos_price": 95.0,
            "name": "NVIDIA Corporation",
            "industry": "Semiconductors",
            "last_known_price": 130.0,
        },
    )


def test_patch_favorite_updates_and_clears_margin_of_safety_price(mocker):
    _mock_authenticated_user(mocker, uid="uid-300")

    mock_db = MagicMock()
    mock_db.get_user_favorite.return_value = {
        "ticker": "GOOGL",
        "name": "Alphabet Inc.",
        "last_known_price": 170.0,
    }
    mock_db.upsert_user_favorite.return_value = {
        "ticker": "GOOGL",
        "name": "Alphabet Inc.",
        "margin_of_safety_price": 160.0,
        "last_known_price": 170.0,
        "added_at": "2026-11-26T10:00:00+00:00",
        "updated_at": "2026-11-26T11:00:00+00:00",
    }
    mocker.patch("app.api.endpoints.favorites.db", mock_db)

    mock_finnhub = MagicMock()
    mock_finnhub.get_quote.return_value = {"c": 176.0, "dp": 0.8}
    mocker.patch("app.api.endpoints.favorites.finnhub", mock_finnhub)

    response = client.patch(
        "/api/favorites/googl",
        json={"margin_of_safety_price": 160.0},
        headers={"Authorization": "Bearer valid-token"},
    )

    assert response.status_code == 200
    data = response.json()
    assert data["margin_of_safety_price"] == 160.0
    assert data["current_price"] == 176.0
    assert data["delta_amount"] == 16.0
    assert data["delta_pct"] == 10.0

    # Clearing MOS price back to null
    mock_db.upsert_user_favorite.return_value = {
        "ticker": "GOOGL",
        "name": "Alphabet Inc.",
        "margin_of_safety_price": None,
        "last_known_price": 170.0,
    }
    clear_res = client.patch(
        "/api/favorites/GOOGL",
        json={"margin_of_safety_price": None},
        headers={"Authorization": "Bearer valid-token"},
    )
    assert clear_res.status_code == 200
    assert clear_res.json()["margin_of_safety_price"] is None
    assert clear_res.json()["delta_amount"] is None


def test_patch_favorite_validates_non_positive_price_and_missing_favorite(mocker):
    _mock_authenticated_user(mocker)

    mock_db = MagicMock()
    mock_db.get_user_favorite.return_value = {}
    mocker.patch("app.api.endpoints.favorites.db", mock_db)

    bad_price = client.patch(
        "/api/favorites/AAPL",
        json={"margin_of_safety_price": -10},
        headers={"Authorization": "Bearer valid-token"},
    )
    assert bad_price.status_code == 422

    zero_price = client.patch(
        "/api/favorites/AAPL",
        json={"margin_of_safety_price": 0},
        headers={"Authorization": "Bearer valid-token"},
    )
    assert zero_price.status_code == 422

    not_found = client.patch(
        "/api/favorites/AAPL",
        json={"margin_of_safety_price": 150.0},
        headers={"Authorization": "Bearer valid-token"},
    )
    assert not_found.status_code == 404


def test_delete_favorite_and_invalid_ticker(mocker):
    _mock_authenticated_user(mocker, uid="uid-400")

    mock_db = MagicMock()
    mock_db.delete_user_favorite.return_value = True
    mocker.patch("app.api.endpoints.favorites.db", mock_db)

    res = client.delete(
        "/api/favorites/brk.b",
        headers={"Authorization": "Bearer valid-token"},
    )
    assert res.status_code == 200
    assert res.json() == {"deleted": True, "ticker": "BRK.B"}
    mock_db.delete_user_favorite.assert_called_once_with("uid-400", "BRK.B")

    invalid = client.delete(
        "/api/favorites/INVALID$$$",
        headers={"Authorization": "Bearer valid-token"},
    )
    assert invalid.status_code == 400
