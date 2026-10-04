import json
import os
from pathlib import Path
from supabase import create_client

# =========================
# 1. 配置
# =========================

SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]

INPUT_FILE = Path("qx4_questions.json")
BATCH_SIZE = 30

# 9 个大类 → assessmentid 映射
CATEGORY_TO_ASSESSMENT = {
    "QX4_C1": "c8b3f21a-2cfd-45fa-b96b-ad34ef577098",
    "QX4_C2": "aaf72b5c-6c4f-4474-8e30-b8b828860b99",
    "QX4_C3": "1a8a1ebc-24b3-41d9-bdd9-e898bbf24010",
    "QX4_C4": "cd13d6c9-037f-472f-be1f-ea15043e53b5",
    "QX4_C5": "c16bbcab-ef77-40e1-8c8f-d007d663e493",
    "QX4_C6": "a0bef2c1-5ca3-4629-9090-9183947a1ac0",
    "QX4_C7": "e7759148-1f23-47a7-87b4-23ee5551cd75",
    "QX4_C8": "abe2d18a-51a7-48e3-bdca-d74f1221a8af",
    "QX4_C9": "4f8a2383-0c7b-4a8c-a2f3-60f6a59f575a",
}

# =========================
# 2. 读取 JSON
# =========================

with INPUT_FILE.open("r", encoding="utf-8") as f:
    items = json.load(f)

print(f"读取 {len(items)} 条题目")

# =========================
# 3. 构造待插入数据
# =========================

rows = []
for item in items:
    categorycode = item["categorycode"]

    if categorycode not in CATEGORY_TO_ASSESSMENT:
        raise ValueError(f"未知 categorycode: {categorycode}")

    # 必填字段校验
    questiontext_cn = item.get("questiontext_cn", "").strip()
    questiontext_en = item.get("questiontext_en", "").strip()

    if not questiontext_cn:
        raise ValueError(f"global_no={item['optionconfig']['global_no']} 缺 questiontext_cn")
    if not questiontext_en:
        raise ValueError(f"global_no={item['optionconfig']['global_no']} 缺 questiontext_en")

    rows.append({
        "assessmentid": CATEGORY_TO_ASSESSMENT[categorycode],
        "questionno": item["questionno"],
        "questiontext_cn": questiontext_cn,
        "questiontext_en": questiontext_en,
        "optiontype": item.get("optiontype"),   # qx4 为 null
        "optionconfig": item["optionconfig"],   # 内含 global_no / answer_cn / answer_en
        "scoringrule": item.get("scoringrule", {}),
        "dimension": item.get("dimension"),
    })

# =========================
# 4. 写入 Supabase
# =========================

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

total = len(rows)
for i in range(0, total, BATCH_SIZE):
    batch = rows[i:i + BATCH_SIZE]
    resp = (
        supabase.table("emobao_assessment_question")
        .insert(batch)
        .execute()
    )
    print(f"已写入 {min(i + BATCH_SIZE, total)} / {total}")

print("全部完成")