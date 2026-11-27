from unittest.mock import MagicMock
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_listCuratedCategories_returnsCatalogMetadata(mocker):
    mock_service = MagicMock()
    mock_service.list_categories.return_value = [
        {
            "id": "ai-semiconductors",
            "name": "AI & Semiconductors",
            "short_name": "AI & Semis",
            "sector_focus": "tech",
            "company_count": 18,
            "bucket_count": 3,
            "is_cached": True,
        }
    ]
    mocker.patch("app.api.endpoints.curated.curated_service", mock_service)

    response = client.get("/api/curated-lists")

    assert response.status_code == 200
    data = response.json()
    assert data["total_categories"] == 1
    assert data["categories"][0]["id"] == "ai-semiconductors"
    mock_service.list_categories.assert_called_once()


def test_getCuratedCategory_returnsEnrichedBuckets(mocker):
    mock_service = MagicMock()
    mock_service.get_category.return_value = {
        "id": "robotics-automation",
        "name": "Robotics & Physical AI",
        "company_count": 2,
        "buckets": [
            {
                "id": "surgical-autonomous",
                "name": "Surgical, Medical & Autonomous Robotics",
                "companies": [
                    {"ticker": "ISRG", "stage": "established", "roic_pct": 16.9},
                    {"ticker": "PRCT", "stage": "future_potential", "roic_pct": -12.0},
                ],
            }
        ],
    }
    mocker.patch("app.api.endpoints.curated.curated_service", mock_service)

    response = client.get("/api/curated-lists/robotics-automation")

    assert response.status_code == 200
    body = response.json()
    assert body["id"] == "robotics-automation"
    assert len(body["buckets"]) == 1
    assert body["buckets"][0]["companies"][0]["ticker"] == "ISRG"
    mock_service.get_category.assert_called_once_with("robotics-automation", force_fresh=False)


def test_getCuratedCategory_unknownSlugReturns404(mocker):
    mock_service = MagicMock()
    mock_service.get_category.return_value = None
    mocker.patch("app.api.endpoints.curated.curated_service", mock_service)

    response = client.get("/api/curated-lists/unknown-theme")

    assert response.status_code == 404
    assert "not found" in response.json()["detail"].lower()


def test_refreshCuratedCategory_forcesFreshRebuild(mocker):
    mock_service = MagicMock()
    mock_service.get_category.return_value = {
        "id": "power-grid",
        "cache_source": "freshly_built",
        "buckets": [],
    }
    mocker.patch("app.api.endpoints.curated.curated_service", mock_service)

    response = client.post("/api/curated-lists/power-grid/refresh")

    assert response.status_code == 200
    assert response.json()["cache_source"] == "freshly_built"
    mock_service.get_category.assert_called_once_with("power-grid", force_fresh=True)
