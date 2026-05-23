import sys
import os

# Add backend directory to path
sys.path.append(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'backend'))

from google.cloud import firestore
from app.services.db_service import DBService
from app.main import settings

def clear_all_cache():
    print(f"Connecting to Firestore for project: {settings.GCP_PROJECT_ID}...")
    db_service = DBService(project_id=settings.GCP_PROJECT_ID)
    if not db_service.db:
        print("Error: Could not connect to Firestore.")
        return
        
    db = db_service.db
    companies_ref = db.collection('companies')
    docs = list(companies_ref.stream())
    
    if not docs:
        print("No cached companies found.")
        return
        
    print(f"Found {len(docs)} cached companies: {[doc.id for doc in docs]}")
    
    for doc in docs:
        ticker = doc.id
        print(f"Deleting cached data for {ticker}...")
        
        # Delete subcollections
        for subcoll_name in ['financials', 'qualitative', 'context']:
            subcoll_ref = companies_ref.document(ticker).collection(subcoll_name)
            sub_docs = list(subcoll_ref.stream())
            if sub_docs:
                print(f"  Deleting {len(sub_docs)} documents from subcollection '{subcoll_name}'...")
                for sub_doc in sub_docs:
                    sub_doc.reference.delete()
                    
        # Delete root document
        doc.reference.delete()
        print(f"Successfully deleted {ticker}.")

if __name__ == "__main__":
    clear_all_cache()
