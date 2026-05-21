from google.cloud import firestore
from datetime import datetime
import pytz

class DBService:
    def __init__(self, project_id: str):
        self.project_id = project_id
        try:
            self.db = firestore.Client(project=self.project_id)
        except Exception as e:
            print(f"Warning: Failed to initialize Firestore: {e}")
            self.db = None

    def get_company_data(self, ticker: str) -> dict:
        if not self.db:
            return {}
            
        try:
            company_ref = self.db.collection('companies').document(ticker)
            doc = company_ref.get()
            if not doc.exists:
                return {}
                
            data = doc.to_dict()
        except Exception as e:
            print(f"Firestore get failed: {e}")
            return {}
        
        # Get subcollections
        financials = {}
        for fin_doc in company_ref.collection('financials').stream():
            financials[fin_doc.id] = fin_doc.to_dict()
        if financials:
            data['financials'] = financials
            
        qualitative = {}
        for qual_doc in company_ref.collection('qualitative').stream():
            qualitative[qual_doc.id] = qual_doc.to_dict()
        if qualitative:
            data['qualitative'] = qualitative
            
        context = {}
        for ctx_doc in company_ref.collection('context').stream():
            context[ctx_doc.id] = ctx_doc.to_dict()
        if context:
            data['context'] = context
            
        return data

    def save_company_data(self, ticker: str, data: dict):
        if not self.db:
            return
            
        try:
            company_ref = self.db.collection('companies').document(ticker)
            
            # Save root data
            root_data = {k: v for k, v in data.items() if k not in ['financials', 'qualitative', 'context']}
            root_data['last_updated'] = datetime.now(pytz.utc).isoformat()
            company_ref.set(root_data)
        except Exception as e:
            print(f"Firestore save failed: {e}")
            return
        
        # Save financials
        if 'financials' in data:
            for doc_id, doc_data in data['financials'].items():
                doc_data['timestamp'] = datetime.now(pytz.utc).isoformat()
                company_ref.collection('financials').document(doc_id).set(doc_data)
                
        # Save qualitative
        if 'qualitative' in data:
            for doc_id, doc_data in data['qualitative'].items():
                company_ref.collection('qualitative').document(doc_id).set(doc_data)
                
        # Save context
        if 'context' in data:
            for doc_id, doc_data in data['context'].items():
                company_ref.collection('context').document(doc_id).set(doc_data)

    def get_batch(self, batch_id: str) -> dict:
        if not self.db:
            return {}
        try:
            doc = self.db.collection('ingestion_batches').document(batch_id).get()
            if doc.exists:
                return doc.to_dict()
        except Exception as e:
            print(f"Firestore get batch failed: {e}")
        return {}

    def save_batch(self, batch_id: str, data: dict):
        if not self.db:
            return
        try:
            self.db.collection('ingestion_batches').document(batch_id).set(data)
        except Exception as e:
            print(f"Firestore save batch failed: {e}")
