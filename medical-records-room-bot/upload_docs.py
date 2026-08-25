import os
import boto3
import concurrent.futures

# === Cloudflare R2 Credentials ===
ACCOUNT_ID = "6a871b687234a00480747db62d204e18"
ACCESS_KEY_ID = "cb31a46d76415d7e1c12bfabb3f28ff3"
SECRET_ACCESS_KEY = "a271aa6210b67583dd1b993049664977f2a3f2633c917f1a6b81e79159b1b9fe"

BUCKET_NAME = "ntuh-rag-articles"
DATA_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "data"))

def upload_files():
    print(f"🤖 開始連線並上傳資料夾：{DATA_DIR}")
    
    if not os.path.exists(DATA_DIR):
        print(f"❌ 找不到資料夾：{DATA_DIR}")
        return

    s3 = boto3.client('s3',
        endpoint_url=f'https://{ACCOUNT_ID}.r2.cloudflarestorage.com',
        aws_access_key_id=ACCESS_KEY_ID,
        aws_secret_access_key=SECRET_ACCESS_KEY,
        region_name='auto'
    )

    print("✅ 連線成功！準備上傳檔案...")

    files_to_upload = []
    for root, dirs, files in os.walk(DATA_DIR):
        for filename in files:
            if filename.endswith(".md") or filename.endswith(".pdf"):
                file_path = os.path.join(root, filename)
                rel_path = os.path.relpath(file_path, DATA_DIR).replace("\\", "/")
                files_to_upload.append((rel_path, file_path))

    total_files = len(files_to_upload)
    print(f"總共找到 {total_files} 個檔案，開始平行上傳...")

    def upload_single_file(item):
        key, file_path = item
        try:
            s3.upload_file(file_path, BUCKET_NAME, key)
            return True
        except Exception as e:
            print(f"❌ {key} 上傳失敗: {e}")
            return False

    uploaded_count = 0
    with concurrent.futures.ThreadPoolExecutor(max_workers=20) as executor:
        results = executor.map(upload_single_file, files_to_upload)
        for res in results:
            if res:
                uploaded_count += 1
                if uploaded_count % 50 == 0 or uploaded_count == total_files:
                    print(f"✅ 已上傳 {uploaded_count} / {total_files} 個檔案...")

    print(f"\n🎉 全部上傳完成！成功上傳了 {uploaded_count} 個檔案到 {BUCKET_NAME}。")

if __name__ == "__main__":
    upload_files()
