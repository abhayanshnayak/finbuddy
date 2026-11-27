from fastapi import APIRouter, HTTPException, Query

from app.dependencies import curated_service

router = APIRouter(prefix="/curated-lists")


@router.get("")
def list_curated_categories():
    """Returns all curated thematic categories (<= 10) with supply-chain summaries and cache status."""
    categories = curated_service.list_categories()
    return {
        "categories": categories,
        "total_categories": len(categories),
    }


@router.get("/{category_id}")
def get_curated_category(
    category_id: str,
    force_fresh: bool = Query(default=False),
):
    """Returns a curated category grouped into supply-chain buckets with cached financial fundamentals."""
    result = curated_service.get_category(category_id, force_fresh=force_fresh)
    if result is None:
        raise HTTPException(
            status_code=404,
            detail=f"Curated category '{category_id}' not found.",
        )
    return result


@router.post("/{category_id}/refresh")
def refresh_curated_category(category_id: str):
    """Refreshes cached metrics for a curated category and persists the updated snapshot."""
    result = curated_service.get_category(category_id, force_fresh=True)
    if result is None:
        raise HTTPException(
            status_code=404,
            detail=f"Curated category '{category_id}' not found.",
        )
    return result
