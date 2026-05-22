import sys
sys.path.append('/Applications/Antigravity Projects/Finbuddy/backend')
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
