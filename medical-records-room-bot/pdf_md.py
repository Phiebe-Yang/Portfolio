import pymupdf4llm
from pathlib import Path

def batch_convert_pdfs_md(input_dir, output_dir):
    # 建立路徑物件
    in_folder = Path(input_dir)
    out_folder = Path(output_dir)
    
    # 檢查來源資料夾是否存在
    if not in_folder.exists() or not in_folder.is_dir():
        print(f"找不到來源資料夾: {in_folder.absolute()}")
        return

    # 尋找資料夾內所有的 PDF 檔案 (不區分大小寫的話可以用 .rglob 如果有子資料夾)
    # 這裡示範只抓取該資料夾底下的 .pdf 檔案
    pdf_files = list(in_folder.glob("*.pdf"))
    
    if len(pdf_files) == 0:
        print(f"在 {in_folder} 中找不到任何 PDF 檔案。")
        return
        
    print(f"總共找到 {len(pdf_files)} 個 PDF 檔案，準備開始轉換...\n")
    print("-" * 40)

    # 確保輸出的目標資料夾存在
    out_folder.mkdir(parents=True, exist_ok=True)
    
    # 紀錄成功轉換的數量
    success_count = 0
    
    # 用迴圈逐一處理每個 PDF 檔案
    for pdf_file in pdf_files:
        output_md_path = out_folder / f"{pdf_file.stem}.md"
        
        try:
            print(f"正在轉換: {pdf_file.name} ...")
            
            # 進行轉換
            md_text = pymupdf4llm.to_markdown(str(pdf_file))
            
            # 寫入 Markdown 檔案
            output_md_path.write_bytes(md_text.encode('utf-8'))
            success_count += 1
            
        except Exception as e:
            # 加上 try-except 是為了防止某一個損壞的 PDF 導致整個程式中斷
            print(f"❌ 轉換 {pdf_file.name} 時發生錯誤: {e}")
            
    print("-" * 40)
    print(f"批次轉換完成！")
    print(f"成功: {success_count} / 總數: {len(pdf_files)}")
    print(f"所有檔案已儲存至: {out_folder.absolute()}")

# 使用範例
if __name__ == "__main__":
    # 1. 放滿 PDF 的「來源資料夾」路徑
    source_folder = r"C:\Users\Phiebe\Project\ep\data\org"
    
    # 2. 想要儲存 MD 檔的「目標資料夾」路徑
    target_folder = r"C:\Users\Phiebe\Project\ep\data\fin"
    
    batch_convert_pdfs_md(source_folder, target_folder)