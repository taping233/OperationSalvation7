"""只读核对本任务图片alpha，不改图，不扫描全库。"""
import json
import sys
from pathlib import Path
from PIL import Image

request_path = Path(sys.argv[1])
request = json.loads(request_path.read_text(encoding="utf-8-sig"))
reports = []
for item in request["items"]:
    with Image.open(item["source"]) as im:
        if "A" not in im.getbands():
            raise SystemExit("没有透明通道：" + item["source"])
        alpha = im.getchannel("A")
        limits = alpha.getextrema()
        if limits[0] != 0 or limits[1] == 0:
            raise SystemExit("没有有效透明背景或没有前景：" + item["source"])
        reports.append({"source": item["source"], "size": list(im.size),
                        "mode": im.mode, "alpha_range": list(limits),
                        "fully_transparent_fraction": alpha.histogram()[0] / (im.width * im.height)})
out = request_path.with_name(request_path.stem + "-alpha.json")
out.write_text(json.dumps(reports, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print(json.dumps([{"alpha": r["alpha_range"], "transparent_fraction": round(r["fully_transparent_fraction"], 3)} for r in reports]))
