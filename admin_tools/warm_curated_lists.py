"""Pre-warm all curated thematic lists into Firestore so frontend views load instantly.

Usage:
    cd backend && ./venv/bin/python ../admin_tools/warm_curated_lists.py
    cd backend && ./venv/bin/python ../admin_tools/warm_curated_lists.py --force
    cd backend && ./venv/bin/python ../admin_tools/warm_curated_lists.py --categories ai-semiconductors,robotics-automation
"""

import argparse
import os
import sys
import time

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
BACKEND_DIR = os.path.abspath(os.path.join(SCRIPT_DIR, "..", "backend"))
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

from app.data.curated_lists import get_catalog_categories
from app.dependencies import calc_service, db_service, finnhub_client
from app.services.curated_service import CuratedListService


def main():
    parser = argparse.ArgumentParser(description="Pre-warm StockClue curated stock lists in Firestore.")
    parser.add_argument(
        "--force",
        action="store_true",
        help="Force fresh Finnhub fetch even when a cached snapshot exists.",
    )
    parser.add_argument(
        "--categories",
        type=str,
        default="",
        help="Comma-separated category IDs to warm (default: all 10 categories).",
    )
    parser.add_argument(
        "--delay",
        type=float,
        default=1.1,
        help="Delay in seconds between Finnhub API calls (default: 1.1s to stay comfortably below 60 req/min).",
    )
    args = parser.parse_args()

    service = CuratedListService(
        db=db_service,
        finnhub=finnhub_client,
        calc=calc_service,
        request_delay_seconds=args.delay,
    )

    target_ids = (
        [c.strip() for c in args.categories.split(",") if c.strip()]
        if args.categories
        else [cat["id"] for cat in get_catalog_categories()]
    )

    print(f"Warming {len(target_ids)} curated categories (force={args.force}, delay={args.delay}s)...")
    t0 = time.monotonic()

    missing_metrics_report = []

    for cat_id in target_ids:
        cat_t0 = time.monotonic()
        data = service.get_category(cat_id, force_fresh=args.force)
        if not data:
            print(f"  [SKIP] Unknown category: {cat_id}")
            continue

        elapsed = time.monotonic() - cat_t0
        companies = [c for b in data["buckets"] for c in b["companies"]]
        with_roic = sum(1 for c in companies if c.get("roic_pct") is not None)
        with_roe = sum(1 for c in companies if c.get("roe_pct") is not None)
        with_rev = sum(1 for c in companies if (c.get("big4") or {}).get("revenue", {}).get("latest") is not None)
        with_fcfm = sum(1 for c in companies if c.get("fcf_margin_pct") is not None)
        with_nim = sum(1 for c in companies if c.get("net_income_margin_pct") is not None)

        print(
            f"  [OK] {cat_id:24s} | {len(companies):2d} stocks | "
            f"rev={with_rev:2d} roic={with_roic:2d} roe={with_roe:2d} "
            f"nim={with_nim:2d} fcfm={with_fcfm:2d} | src={data.get('cache_source')} | {elapsed:.1f}s"
        )

        for c in companies:
            gaps = []
            if (c.get("big4") or {}).get("revenue", {}).get("latest") is None:
                gaps.append("rev")
            if c.get("roic_pct") is None:
                gaps.append("roic")
            if c.get("roe_pct") is None:
                gaps.append("roe")
            if c.get("net_income_margin_pct") is None:
                gaps.append("ni_margin")
            if c.get("fcf_margin_pct") is None:
                gaps.append("fcf_margin")
            if c.get("total_debt") is None:
                gaps.append("debt")
            if c.get("cash_and_equivalents") is None:
                gaps.append("cash")
            if gaps:
                missing_metrics_report.append((cat_id, c["ticker"], c.get("data_source"), gaps))

    total_elapsed = time.monotonic() - t0
    print(f"\nCompleted warming in {total_elapsed:.1f}s.")
    if missing_metrics_report:
        print(f"Tickers with any missing optional metric ({len(missing_metrics_report)}):")
        for cat_id, sym, src, gaps in missing_metrics_report:
            print(f"  - {cat_id}/{sym} ({src}): missing {', '.join(gaps)}")
    else:
        print("All tickers across all warmed categories have complete metric coverage!")


if __name__ == "__main__":
    main()
