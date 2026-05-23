import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from app.services.db_service import DBService

db = DBService(project_id="gen-lang-client-0826635932")

docs = db.db.collection('companies').stream()
missing = []
for doc in docs:
    data = doc.to_dict()
    context = data.get("context", {})
    if "growth_company_analysis" not in context:
        missing.append(doc.id)

if not missing:
    print("All companies have the AI analysis!")
else:
    print(f"Companies missing AI analysis ({len(missing)}):")
    print(", ".join(missing))
