import os
import zipfile

root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
staging_dir = os.path.join(root, "deploy", "staging")
zip_path = os.path.join(root, "deploy", "lawyer_office.zip")

print("Packing lawyer_office.zip with POSIX forward slashes...")

with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
    # 1. Add client/dist
    client_dist = os.path.join(root, "client", "dist")
    for foldername, subfolders, filenames in os.walk(client_dist):
        for filename in filenames:
            filepath = os.path.join(foldername, filename)
            arcname = "client/dist/" + os.path.relpath(filepath, client_dist).replace("\\", "/")
            zipf.write(filepath, arcname)

    # 2. Add server root files
    server_dir = os.path.join(root, "server")
    for filename in ["package.json", "package-lock.json", "config.js", "index.js", ".env.example"]:
        filepath = os.path.join(server_dir, filename)
        if os.path.exists(filepath):
            zipf.write(filepath, "server/" + filename)

    # 3. Add server directories
    for sub in ["database", "routes", "middleware", "services", "templates", "scripts", "tests"]:
        subdir_path = os.path.join(server_dir, sub)
        if os.path.exists(subdir_path):
            for foldername, subfolders, filenames in os.walk(subdir_path):
                for filename in filenames:
                    if filename.endswith('.db') or filename.endswith('.db-wal') or filename.endswith('.db-shm'):
                        continue
                    filepath = os.path.join(foldername, filename)
                    rel = os.path.relpath(filepath, server_dir).replace("\\", "/")
                    zipf.write(filepath, "server/" + rel)

print(f"Archive created successfully: {zip_path} ({round(os.path.getsize(zip_path)/(1024*1024), 2)} MB)")
