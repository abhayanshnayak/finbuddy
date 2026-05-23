from app.core.config import settings
from app.services.finnhub_client import FinnhubClient
from app.services.calculator import FinancialCalculator
from app.services.analyst_service import AnalystService
from app.services.db_service import DBService

finnhub_client = FinnhubClient(api_key=settings.FINNHUB_API_KEY)
calc_service = FinancialCalculator()
ai_service = AnalystService(project_id=settings.GCP_PROJECT_ID)
db_service = DBService(project_id=settings.GCP_PROJECT_ID)

try:
    from google.cloud import pubsub_v1
    publisher = pubsub_v1.PublisherClient()
    topic_path = publisher.topic_path(settings.GCP_PROJECT_ID, "stock-ingestion-topic")
except Exception as e:
    print(f"Warning: Failed to initialize Pub/Sub publisher client: {e}")
    publisher = None
    topic_path = None
