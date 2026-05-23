import os
import mimetypes
from google.cloud import storage

def deploy_frontend():
    project_id = os.environ.get('GCP_PROJECT_ID')
    bucket_name = f"finbuddy-frontend-{project_id}"
    region = "us-central1"
    
    print(f"Initializing Storage Client for project: {project_id}...")
    client = storage.Client(project=project_id)
    
    # 1. Create or get bucket
    bucket = client.bucket(bucket_name)
    if not bucket.exists():
        print(f"Creating bucket {bucket_name} in {region}...")
        bucket = client.create_bucket(bucket_name, location=region)
    else:
        print(f"Bucket {bucket_name} already exists.")
        
    # 2. Configure bucket as a static website
    print("Configuring bucket website settings...")
    bucket.configure_website(main_page_suffix="index.html", not_found_page="index.html")
    bucket.patch()
    
    # 3. Add public read permission (allUsers -> Storage Object Viewer)
    print("Configuring public IAM permissions (public read access for allUsers)...")
    try:
        policy = bucket.get_iam_policy(requested_policy_version=3)
        policy.bindings.append({
            "role": "roles/storage.objectViewer",
            "members": {"allUsers"}
        })
        bucket.set_iam_policy(policy)
        print("Successfully set IAM policy for public access.")
    except Exception as e:
        print(f"Note: Could not set bucket IAM policy: {e}. Attempting public ACL fallback...")
        try:
            bucket.make_public(recursive=True, future=True)
            print("Successfully made bucket public via ACLs.")
        except Exception as acl_e:
            print(f"Warning: Could not make bucket public via ACL fallback: {acl_e}")
    
    # 4. Upload build artifacts
    dist_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "../frontend/dist"))
    if not os.path.exists(dist_dir):
        raise Exception(f"Frontend dist folder not found at {dist_dir}. Please run 'npm run build' first.")
        
    print(f"Uploading files from {dist_dir} to {bucket_name}...")
    for root, _, files in os.walk(dist_dir):
        for file in files:
            local_path = os.path.join(root, file)
            relative_path = os.path.relpath(local_path, dist_dir)
            blob = bucket.blob(relative_path)
            
            # Guess content type
            content_type, _ = mimetypes.guess_type(local_path)
            if relative_path.endswith(".webmanifest"):
                content_type = "application/manifest+json"
            elif relative_path.endswith(".jsx"):
                content_type = "application/javascript"
                
            print(f"Uploading {relative_path} ({content_type or 'unknown'})...")
            blob.upload_from_filename(local_path, content_type=content_type)
            
    print("\nDeployment complete!")
    print(f"Public URL: https://storage.googleapis.com/{bucket_name}/index.html")

if __name__ == "__main__":
    deploy_frontend()
