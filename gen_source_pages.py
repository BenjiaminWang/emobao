# gen_source_pages.py  —— 生成著作权登记源程序前/后 30 页打印稿
import os

LINES_PER_PAGE = 55          # 每页行数，≥50 即可
HEADER = "情绪宝（Emo Treasure）V1.0"

# 按第二节/第三节取材方案顺序填写文件路径（相对代码库根目录）
FRONT_FILES = [
    "index.html", "qx00_login.html",
    "js/qx0_main.js", "js/qx00_login.js", "js/qx_type_label.js",
    "style.css", "manifest.json", "sw.js",
]
BACK_FILES = [
    "js/qx_hrv_capture.js", "js/qx_polar_h10.js", "js/qx2_heal_chart.js",
    "js/qx2_regulate.js", "js/qx3_report.js", "js/qx5_engine.js",
    "js/qx5_profile.js", "qx4_questions.py", "sql/rpc_functions.sql",
    "js/qx6/redeem_code.js",
]

def collect_lines(files, need_pages):
    """按文件顺序收集行，直到凑满 need_pages 页"""
    lines, used = [], []
    for f in files:
        if not os.path.exists(f):
            print(f"[跳过] 文件不存在：{f}")
            continue
        with open(f, encoding="utf-8", errors="replace") as fh:
            file_lines = fh.read().splitlines()
        lines.extend(file_lines)
        used.append(f)
        if len(lines) >= need_pages * LINES_PER_PAGE:
            break
    return lines, used

def write_pages(lines, start_page, out_path):
    """按每页 LINES_PER_PAGE 行写页，带页眉与页码"""
    total_needed = start_page + 29
    with open(out_path, "w", encoding="utf-8") as out:
        for i in range(30):
            page_no = start_page + i
            chunk = lines[i * LINES_PER_PAGE:(i + 1) * LINES_PER_PAGE]
            if not chunk:
                chunk = ["// （本页无更多源程序，请补充取材文件）"]
            out.write(f"{HEADER}{' ' * 30}第 {page_no} 页 / 共 60 页\n")
            out.write("─" * 78 + "\n")
            out.writelines(line + "\n" for line in chunk)
            out.write("\n\f\n")   # 分页符

if __name__ == "__main__":
    front, used_f = collect_lines(FRONT_FILES, 30)
    back, used_b = collect_lines(BACK_FILES, 30)
    write_pages(front, 1, "源程序_前30页.txt")
    write_pages(back, 31, "源程序_后30页.txt")
    print("前30页取材文件：", used_f)
    print("后30页取材文件：", used_b)
    print("生成完毕：源程序_前30页.txt / 源程序_后30页.txt")