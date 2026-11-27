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
                
            return doc.to_dict()
        except Exception as e:
            print(f"Firestore get failed: {e}")
            return {}

    def save_company_data(self, ticker: str, data: dict):
        if not self.db:
            return
            
        try:
            company_ref = self.db.collection('companies').document(ticker)
            data['last_updated'] = datetime.now(pytz.utc).isoformat()
            company_ref.set(data)
        except Exception as e:
            print(f"Firestore save failed: {e}")

    def update_company_field(self, ticker: str, field_name: str, field_data: dict):
        if not self.db:
            return
            
        try:
            company_ref = self.db.collection('companies').document(ticker)
            # Use dot notation to update a nested field
            company_ref.update({
                f"context.{field_name}": field_data,
                "last_updated": datetime.now(pytz.utc).isoformat()
            })
        except Exception as e:
            # If the document doesn't exist, this will fail. Let's fallback to set with merge.
            print(f"Firestore update failed, falling back to set with merge: {e}")
            try:
                company_ref.set({
                    "context": {
                        field_name: field_data
                    },
                    "last_updated": datetime.now(pytz.utc).isoformat()
                }, merge=True)
            except Exception as inner_e:
                print(f"Firestore set merge failed: {inner_e}")

    def list_companies(self) -> list:
        if not self.db:
            return []
        try:
            companies = []
            docs = self.db.collection('companies').stream()
            for doc in docs:
                data = doc.to_dict()
                companies.append({
                    "ticker": doc.id,
                    "name": data.get("name", doc.id),
                    "tags": data.get("tags", []),
                    "industry": data.get("industry", "Unknown"),
                    "last_updated_pst": data.get("last_updated_pst", "")
                })
            return companies
        except Exception as e:
            print(f"Firestore list failed: {e}")
            return []

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

    def update_batch_ticker_status(self, batch_id: str, ticker: str, status: str, error: str = None):
        if not self.db:
            return
            
        transaction = self.db.transaction()
        batch_ref = self.db.collection('ingestion_batches').document(batch_id)
        
        @firestore.transactional
        def update_in_transaction(transaction, batch_ref):
            snapshot = batch_ref.get(transaction=transaction)
            if not snapshot.exists:
                return
                
            batch = snapshot.to_dict()
            if ticker not in batch.get("symbols", {}):
                return
                
            batch["symbols"][ticker]["status"] = status
            batch["symbols"][ticker]["timestamp"] = datetime.now(pytz.utc).isoformat()
            if error:
                batch["symbols"][ticker]["error"] = error
                
            completed = sum(1 for sym, data in batch["symbols"].items() if data.get("status") == "completed")
            failed = sum(1 for sym, data in batch["symbols"].items() if data.get("status") == "failed")
            
            batch["completed_count"] = completed
            batch["failed_count"] = failed
            
            if completed + failed == batch.get("total_symbols", 0):
                batch["status"] = "completed"
            elif status == "processing" and batch.get("status") == "pending":
                batch["status"] = "processing"
                
            transaction.set(batch_ref, batch)
            
        try:
            update_in_transaction(transaction, batch_ref)
        except Exception as e:
            print(f"Transaction failed for batch {batch_id}, ticker {ticker}: {e}")

    def upsert_user_profile(self, uid: str, profile: dict) -> dict:
        if not self.db or not uid:
            return profile
        try:
            now_iso = datetime.now(pytz.utc).isoformat()
            user_ref = self.db.collection("users").document(uid)
            existing = user_ref.get()
            record = {
                "uid": uid,
                "name": profile.get("name"),
                "email": profile.get("email"),
                "picture": profile.get("picture"),
                "provider": profile.get("provider"),
                "email_verified": bool(profile.get("email_verified", False)),
                "last_login_at": now_iso,
            }
            if not existing.exists:
                record["created_at"] = now_iso
            user_ref.set(record, merge=True)
            return record
        except Exception as e:
            print(f"Firestore upsert user profile failed for {uid}: {e}")
            return profile

    def get_user_profile(self, uid: str) -> dict:
        if not self.db or not uid:
            return {}
        try:
            doc = self.db.collection("users").document(uid).get()
            if doc.exists:
                return doc.to_dict()
        except Exception as e:
            print(f"Firestore get user profile failed for {uid}: {e}")
        return {}

    def list_user_favorites(self, uid: str) -> list:
        if not self.db or not uid:
            return []
        try:
            favorites = []
            docs = (
                self.db.collection("users")
                .document(uid)
                .collection("favorites")
                .stream()
            )
            for doc in docs:
                data = doc.to_dict() or {}
                data["ticker"] = (data.get("ticker") or doc.id).upper()
                favorites.append(data)
            favorites.sort(key=lambda item: item.get("added_at") or "", reverse=True)
            return favorites
        except Exception as e:
            print(f"Firestore list favorites failed for {uid}: {e}")
            raise RuntimeError(f"Failed to load favorites: {e}") from e

    def get_user_favorite(self, uid: str, ticker: str) -> dict:
        if not self.db or not uid or not ticker:
            return {}
        try:
            doc = (
                self.db.collection("users")
                .document(uid)
                .collection("favorites")
                .document(ticker.upper())
                .get()
            )
            if doc.exists:
                data = doc.to_dict() or {}
                data["ticker"] = (data.get("ticker") or doc.id).upper()
                return data
        except Exception as e:
            print(f"Firestore get favorite failed for {uid}/{ticker}: {e}")
        return {}

    def upsert_user_favorite(self, uid: str, ticker: str, data: dict) -> dict:
        if not self.db:
            raise RuntimeError("Database is unavailable.")
        if not uid or not ticker:
            raise ValueError("User ID and ticker are required.")

        norm_ticker = ticker.upper()
        now_iso = datetime.now(pytz.utc).isoformat()
        fav_ref = (
            self.db.collection("users")
            .document(uid)
            .collection("favorites")
            .document(norm_ticker)
        )
        existing_doc = fav_ref.get()
        existing = existing_doc.to_dict() if existing_doc.exists else {}

        record = {
            "ticker": norm_ticker,
            "name": data.get("name") or existing.get("name") or norm_ticker,
            "industry": data.get("industry") if data.get("industry") is not None else existing.get("industry", ""),
            "margin_of_safety_price": (
                data["margin_of_safety_price"]
                if "margin_of_safety_price" in data
                else existing.get("margin_of_safety_price")
            ),
            "model_mos_price": (
                data["model_mos_price"]
                if "model_mos_price" in data
                else existing.get("model_mos_price")
            ),
            "last_known_price": (
                data["last_known_price"]
                if "last_known_price" in data and data["last_known_price"] is not None
                else existing.get("last_known_price")
            ),
            "added_at": existing.get("added_at") or now_iso,
            "updated_at": now_iso,
        }
        fav_ref.set(record)
        return record

    def delete_user_favorite(self, uid: str, ticker: str) -> bool:
        if not self.db:
            raise RuntimeError("Database is unavailable.")
        if not uid or not ticker:
            return False
        norm_ticker = ticker.upper()
        (
            self.db.collection("users")
            .document(uid)
            .collection("favorites")
            .document(norm_ticker)
            .delete()
        )
        return True

    def get_curated_category(self, category_id: str) -> dict:
        if not self.db or not category_id:
            return {}
        try:
            doc = self.db.collection("curated_lists").document(category_id).get()
            if doc.exists:
                return doc.to_dict() or {}
        except Exception as e:
            print(f"Firestore get curated category failed for {category_id}: {e}")
        return {}

    def save_curated_category(self, category_id: str, data: dict):
        if not self.db or not category_id:
            return
        try:
            payload = dict(data)
            payload["last_updated"] = datetime.now(pytz.utc).isoformat()
            self.db.collection("curated_lists").document(category_id).set(payload)
        except Exception as e:
            print(f"Firestore save curated category failed for {category_id}: {e}")

    def list_curated_categories(self) -> dict:
        if not self.db:
            return {}
        try:
            result = {}
            docs = self.db.collection("curated_lists").stream()
            for doc in docs:
                result[doc.id] = doc.to_dict() or {}
            return result
        except Exception as e:
            print(f"Firestore list curated categories failed: {e}")
            return {}

    def get_curated_ticker_snapshot(self, ticker: str) -> dict:
        if not self.db or not ticker:
            return {}
        try:
            doc = self.db.collection("curated_ticker_snapshots").document(ticker.upper()).get()
            if doc.exists:
                return doc.to_dict() or {}
        except Exception as e:
            print(f"Firestore get curated ticker snapshot failed for {ticker}: {e}")
        return {}

    def save_curated_ticker_snapshot(self, ticker: str, data: dict):
        if not self.db or not ticker:
            return
        try:
            payload = dict(data)
            payload["last_updated"] = datetime.now(pytz.utc).isoformat()
            self.db.collection("curated_ticker_snapshots").document(ticker.upper()).set(payload)
        except Exception as e:
            print(f"Firestore save curated ticker snapshot failed for {ticker}: {e}")
