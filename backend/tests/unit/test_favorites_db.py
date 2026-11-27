from unittest.mock import MagicMock
import pytest

from app.services.db_service import DBService


def _make_service_with_mock_firestore():
    svc = DBService.__new__(DBService)
    svc.project_id = "test-project"
    svc.db = MagicMock()
    return svc


def test_upsert_user_favorite_preserves_added_at_and_supports_clearing_mos():
    svc = _make_service_with_mock_firestore()

    existing_doc = MagicMock()
    existing_doc.exists = True
    existing_doc.to_dict.return_value = {
        "ticker": "AAPL",
        "name": "Apple Inc.",
        "industry": "Technology",
        "margin_of_safety_price": 145.0,
        "model_mos_price": 130.0,
        "last_known_price": 180.0,
        "added_at": "2026-11-20T00:00:00+00:00",
        "updated_at": "2026-11-20T00:00:00+00:00",
    }
    fav_ref = (
        svc.db.collection.return_value
        .document.return_value
        .collection.return_value
        .document.return_value
    )
    fav_ref.get.return_value = existing_doc

    # Updating metadata without passing margin_of_safety_price preserves existing MOS
    updated = svc.upsert_user_favorite("uid-1", "aapl", {"last_known_price": 185.0})
    assert updated["ticker"] == "AAPL"
    assert updated["margin_of_safety_price"] == 145.0
    assert updated["last_known_price"] == 185.0
    assert updated["added_at"] == "2026-11-20T00:00:00+00:00"

    # Passing margin_of_safety_price=None explicitly clears it
    cleared = svc.upsert_user_favorite("uid-1", "AAPL", {"margin_of_safety_price": None})
    assert cleared["margin_of_safety_price"] is None
    assert cleared["added_at"] == "2026-11-20T00:00:00+00:00"


def test_list_user_favorites_sorts_newest_first():
    svc = _make_service_with_mock_firestore()

    doc_old = MagicMock()
    doc_old.id = "MSFT"
    doc_old.to_dict.return_value = {"name": "Microsoft", "added_at": "2026-11-20T10:00:00+00:00"}

    doc_new = MagicMock()
    doc_new.id = "AAPL"
    doc_new.to_dict.return_value = {"name": "Apple", "added_at": "2026-11-26T10:00:00+00:00"}

    (
        svc.db.collection.return_value
        .document.return_value
        .collection.return_value
        .stream.return_value
    ) = [doc_old, doc_new]

    items = svc.list_user_favorites("uid-1")
    assert [i["ticker"] for i in items] == ["AAPL", "MSFT"]


def test_favorites_write_raises_when_db_unavailable():
    svc = DBService.__new__(DBService)
    svc.project_id = "test-project"
    svc.db = None

    with pytest.raises(RuntimeError, match="Database is unavailable"):
        svc.upsert_user_favorite("uid-1", "AAPL", {"name": "Apple"})

    with pytest.raises(RuntimeError, match="Database is unavailable"):
        svc.delete_user_favorite("uid-1", "AAPL")
