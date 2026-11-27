from concurrent.futures import ThreadPoolExecutor
import math
import re
import threading
import time
from typing import Any, Dict, Optional, Tuple

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, field_validator

from app.core.auth import AuthenticatedUser, get_current_user
from app.dependencies import db_service as db, finnhub_client as finnhub

router = APIRouter(prefix="/favorites")

_TICKER_PATTERN = re.compile(r"^[A-Z0-9.-]{1,12}$")
QUOTE_CACHE_TTL_SECONDS = 60.0
_quote_cache_lock = threading.Lock()
_quote_cache: Dict[str, Tuple[float, Optional[float], float]] = {}


def clear_quote_cache() -> None:
    with _quote_cache_lock:
        _quote_cache.clear()


def normalize_ticker(raw_ticker: str) -> str:
    ticker = (raw_ticker or "").strip().upper()
    if not ticker or ticker in (".", "..") or not _TICKER_PATTERN.fullmatch(ticker):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid ticker symbol.",
        )
    return ticker


def _to_positive_float(value: Any) -> Optional[float]:
    if value is None or isinstance(value, bool):
        return None
    try:
        num = float(value)
    except (TypeError, ValueError):
        return None
    if not math.isfinite(num) or num <= 0:
        return None
    return num


def _to_finite_float(value: Any) -> Optional[float]:
    if value is None or isinstance(value, bool):
        return None
    try:
        num = float(value)
    except (TypeError, ValueError):
        return None
    return num if math.isfinite(num) else None


def _validate_positive_price(value: Optional[float], field_label: str) -> Optional[float]:
    if value is None:
        return None
    if isinstance(value, bool) or not math.isfinite(value):
        raise ValueError(f"{field_label} must be a valid finite number.")
    if value <= 0 or value > 1_000_000_000:
        raise ValueError(f"{field_label} must be greater than 0.")
    return round(float(value), 4)


class FavoriteUpsertRequest(BaseModel):
    name: Optional[str] = None
    industry: Optional[str] = None
    margin_of_safety_price: Optional[float] = None
    model_mos_price: Optional[float] = None
    last_known_price: Optional[float] = None

    @field_validator("name", "industry")
    @classmethod
    def _clean_text(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        cleaned = value.strip()
        return cleaned[:200] if cleaned else None

    @field_validator("margin_of_safety_price")
    @classmethod
    def _validate_mos_price(cls, value: Optional[float]) -> Optional[float]:
        return _validate_positive_price(value, "Margin of safety price")

    @field_validator("model_mos_price", "last_known_price")
    @classmethod
    def _validate_optional_reference_price(cls, value: Optional[float]) -> Optional[float]:
        num = _to_positive_float(value)
        return round(num, 4) if num is not None else None


class FavoriteMarginOfSafetyUpdateRequest(BaseModel):
    margin_of_safety_price: Optional[float] = None

    @field_validator("margin_of_safety_price")
    @classmethod
    def _validate_mos_price(cls, value: Optional[float]) -> Optional[float]:
        return _validate_positive_price(value, "Margin of safety price")


def _fetch_live_quote(
    ticker: str,
    refresh: bool = False,
) -> Tuple[Optional[float], Optional[float]]:
    now = time.monotonic()
    if not refresh:
        with _quote_cache_lock:
            cached = _quote_cache.get(ticker)
            if cached and (now - cached[2]) < QUOTE_CACHE_TTL_SECONDS:
                return cached[0], cached[1]

    try:
        quote = finnhub.get_quote(ticker) or {}
    except Exception as e:
        print(f"Live quote lookup failed for favorite {ticker}: {e}")
        return None, None

    price = _to_positive_float(quote.get("c"))
    day_change_pct = _to_finite_float(quote.get("dp"))
    if price is not None:
        with _quote_cache_lock:
            _quote_cache[ticker] = (price, day_change_pct, now)
        return price, day_change_pct
    return None, None


def _compute_delta(
    current_price: Optional[float],
    margin_of_safety_price: Optional[float],
) -> Tuple[Optional[float], Optional[float]]:
    if current_price is None or margin_of_safety_price is None:
        return None, None
    if current_price <= 0 or margin_of_safety_price <= 0:
        return None, None
    delta_amount = round(current_price - margin_of_safety_price, 4)
    delta_pct = round(((current_price - margin_of_safety_price) / margin_of_safety_price) * 100.0, 2)
    return delta_amount, delta_pct


def _enrich_favorite(
    record: Dict[str, Any],
    include_quote: bool = True,
    refresh_quote: bool = False,
) -> Dict[str, Any]:
    ticker = (record.get("ticker") or "").upper()
    mos_price = _to_positive_float(record.get("margin_of_safety_price"))
    model_mos = _to_positive_float(record.get("model_mos_price"))
    last_known_price = _to_positive_float(record.get("last_known_price"))

    current_price: Optional[float] = None
    price_source: Optional[str] = None
    day_change_pct: Optional[float] = None

    if include_quote and ticker:
        live_price, live_dp = _fetch_live_quote(ticker, refresh=refresh_quote)
        if live_price is not None:
            current_price = round(live_price, 4)
            price_source = "live"
            day_change_pct = round(live_dp, 2) if live_dp is not None else None

    if current_price is None:
        fallback_price = last_known_price
        if fallback_price is None and ticker:
            cached_company = db.get_company_data(ticker) or {}
            fallback_price = _to_positive_float(cached_company.get("price_at_storage"))
        if fallback_price is not None:
            current_price = round(fallback_price, 4)
            price_source = "cached"

    delta_amount, delta_pct = _compute_delta(current_price, mos_price)

    return {
        "ticker": ticker,
        "name": record.get("name") or ticker,
        "industry": record.get("industry") or "",
        "margin_of_safety_price": round(mos_price, 4) if mos_price is not None else None,
        "model_mos_price": round(model_mos, 4) if model_mos is not None else None,
        "last_known_price": round(last_known_price, 4) if last_known_price is not None else None,
        "current_price": current_price,
        "price_source": price_source,
        "day_change_pct": day_change_pct,
        "delta_amount": delta_amount,
        "delta_pct": delta_pct,
        "added_at": record.get("added_at"),
        "updated_at": record.get("updated_at"),
    }


@router.get("")
def list_favorites(
    include_quotes: bool = Query(default=True),
    refresh_quotes: bool = Query(default=False),
    user: AuthenticatedUser = Depends(get_current_user),
):
    """
    Lists the signed-in user's favorite stocks enriched with current market price and
    delta vs. the user's Margin of Safety target buy price.
    """
    try:
        records = db.list_user_favorites(user.uid)
    except RuntimeError as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(e),
        )

    if not records:
        return {"favorites": []}

    if include_quotes and len(records) > 1:
        with ThreadPoolExecutor(max_workers=min(6, len(records))) as executor:
            enriched = list(
                executor.map(
                    lambda rec: _enrich_favorite(
                        rec,
                        include_quote=include_quotes,
                        refresh_quote=refresh_quotes,
                    ),
                    records,
                )
            )
    else:
        enriched = [
            _enrich_favorite(
                rec,
                include_quote=include_quotes,
                refresh_quote=refresh_quotes,
            )
            for rec in records
        ]

    return {"favorites": enriched}


@router.put("/{ticker}")
def upsert_favorite(
    ticker: str,
    payload: Optional[FavoriteUpsertRequest] = None,
    user: AuthenticatedUser = Depends(get_current_user),
):
    """
    Adds a stock to the signed-in user's favorites list (or updates it idempotently).
    """
    norm_ticker = normalize_ticker(ticker)
    req = payload or FavoriteUpsertRequest()
    fields_set = req.model_fields_set

    update_data: Dict[str, Any] = {}
    if req.name is not None:
        update_data["name"] = req.name
    if req.industry is not None:
        update_data["industry"] = req.industry
    if "margin_of_safety_price" in fields_set:
        update_data["margin_of_safety_price"] = req.margin_of_safety_price
    if "model_mos_price" in fields_set:
        update_data["model_mos_price"] = req.model_mos_price
    if req.last_known_price is not None:
        update_data["last_known_price"] = req.last_known_price

    # Fill missing company metadata from cached companies collection when available
    if "name" not in update_data or "industry" not in update_data or "last_known_price" not in update_data:
        cached_company = db.get_company_data(norm_ticker) or {}
        if "name" not in update_data and cached_company.get("name"):
            update_data["name"] = cached_company["name"]
        if "industry" not in update_data and cached_company.get("industry"):
            update_data["industry"] = cached_company["industry"]
        if "last_known_price" not in update_data:
            cached_price = _to_positive_float(cached_company.get("price_at_storage"))
            if cached_price is not None:
                update_data["last_known_price"] = round(cached_price, 4)

    try:
        saved = db.upsert_user_favorite(user.uid, norm_ticker, update_data)
    except RuntimeError as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(e),
        )

    return _enrich_favorite(saved, include_quote=True, refresh_quote=False)


@router.patch("/{ticker}")
def update_favorite_margin_of_safety(
    ticker: str,
    payload: FavoriteMarginOfSafetyUpdateRequest,
    user: AuthenticatedUser = Depends(get_current_user),
):
    """
    Updates (or clears when null) the user's personal Margin of Safety buy price for a favorited stock.
    """
    norm_ticker = normalize_ticker(ticker)
    existing = db.get_user_favorite(user.uid, norm_ticker)
    if not existing:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"{norm_ticker} is not in your favorites list.",
        )

    try:
        saved = db.upsert_user_favorite(
            user.uid,
            norm_ticker,
            {"margin_of_safety_price": payload.margin_of_safety_price},
        )
    except RuntimeError as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(e),
        )

    return _enrich_favorite(saved, include_quote=True, refresh_quote=False)


@router.delete("/{ticker}")
def delete_favorite(
    ticker: str,
    user: AuthenticatedUser = Depends(get_current_user),
):
    """
    Removes a stock from the signed-in user's favorites list.
    """
    norm_ticker = normalize_ticker(ticker)
    try:
        db.delete_user_favorite(user.uid, norm_ticker)
    except RuntimeError as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(e),
        )
    return {"deleted": True, "ticker": norm_ticker}
