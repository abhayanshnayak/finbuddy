import asyncio
from app.main import get_report

async def run():
    try:
        report = get_report("AAPL")
        print("Management dict keys:", report.get("qualitative", {}).get("management", {}).keys())
        print("Windage Growth Rate Used:", report["financials"]["valuations"]["windage_growth_rate_used"])
        print("Windage PE Used:", report["financials"]["valuations"]["windage_pe_used"])
        print("Windage PE details:", report["financials"]["valuations"]["computation_pe_details"])
        print("Windage Growth details:", report["financials"]["derived_metrics"]["computation_windage_details"])
        print("Margin of Safety details:", report["financials"]["valuations"]["computation_mos_details"])
    except Exception as e:
        print("Error:", e)

async def run_async():
    await run()

if __name__ == "__main__":
    asyncio.run(run_async())
