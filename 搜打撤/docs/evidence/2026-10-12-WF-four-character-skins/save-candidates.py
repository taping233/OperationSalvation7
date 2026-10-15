import json, hashlib, os
from pathlib import Path
from PIL import Image
root=Path(r"D:/素材/代号柒/搜打撤")
folder=root/"docs/evidence/2026-10-12-WF-four-character-skins"
manifest_path=folder/"generated-manifest.json"
m=json.loads(manifest_path.read_text(encoding="utf-8"))
for a in m["assets"]:
    source=Path(a["source"])
    target=folder/a["preview"]
    target.parent.mkdir(exist_ok=True)
    with Image.open(source) as im:
        a["size"]=list(im.size)
        if not target.exists(): im.convert("RGB").save(target,"WEBP",quality=91,method=6)
    a["sourceBase"]="C:/Users/太平/.codex"
    a["sourceRelativeToCodexHome"]=os.path.relpath(source,Path(a["sourceBase"])).replace("\\","/")
    a["sourceSha256"]=hashlib.sha256(source.read_bytes()).hexdigest()
    a["previewSha256"]=hashlib.sha256(target.read_bytes()).hexdigest()
    a["previewBytes"]=target.stat().st_size
    if a["previewBytes"]>1000000: raise RuntimeError("Preview exceeds git binary limit")
    with Image.open(target) as im:
        if list(im.size)!=a["size"]: raise RuntimeError("Size changed")
manifest_path.write_text(json.dumps(m,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
readme=["# 四角色十二款皮肤 · 第一批候选","", "2026-10-12，内置 image_gen，每款独立调用。12/12 已保存、逐张展示；全部待老板审阅，未接入游戏。","", "## 研究依据","", "[星极「寻耀」真实皮肤图](https://www.9game.cn/news/4513244.html)：礼服、望远镜、星图围绕观星动作组织，服饰与道具共同表达主题。", "[赫拉格皮肤图与分析](https://hyldagarde.wordpress.com/2021/04/12/in-depth-analysis-of-hellagurs-new-skin/)：观察长外套、内层和装备层级；不采用文章中未经官方确认的剧情推测。", "[明日方舟官方皮肤系列公告](https://arknights.global/news/282)：核对 EPOQUE、Bloodline of Combat 等真实系列。","", "画风使用 artifact-template-anime-block-brush 正式提示词，人物身份以四人当前运行立绘为准；无与 source-5/8/1 仅作画法参考。实际提示词、参考顺序、源PNG相对路径与SHA256见 [generated-manifest.json](generated-manifest.json)。源PNG保留在 .codex/generated_images；本目录仅保存等比例WebP预览，每张小于1MB。","", "## 已看图的结果与待审阅项","", "四人的发型、眼色、脸部身份特征连续；动作、主题、场景和主要道具可区别。当前候选仍有石面、背景及部分衣褶笔触偏碎的情况，服饰轮廓的差异尚可加强；未获老板认可，不能作为稳定画风或已采用资产。","", "只做生成画作目检及文件尺寸/哈希核对；未测试、素材审计、workflow verify、build、游戏实页、提交或推送。未修改源码或运行引用，未启动服务。",""]
for a in m["assets"]:
    readme.extend([f'## {a["number"]:02d} · {a["name"]}（{a["character"]}）',"",f'![{a["name"]}]({a["preview"]})',""])
(folder/"README.md").write_text("\n".join(readme),encoding="utf-8")
html=['<!doctype html><meta charset="utf-8"><title>十二款皮肤候选</title><style>body{background:#15191c;color:#eee;font:16px system-ui;margin:28px}main{display:grid;grid-template-columns:repeat(3,1fr);gap:20px}img{width:100%;height:auto}article{background:#252b30;padding:12px}a{color:#ddd}h2{font-size:18px}</style><h1>四角色十二款皮肤 · v1候选</h1><p>未接入 · 点击看大图 · 每人三款</p><main>']
for a in m["assets"]:
    html.append(f'<article><h2>{a["number"]:02d} {a["name"]}</h2><a href="{a["preview"]}"><img src="{a["preview"]}" alt="{a["name"]}"></a><p>{a["character"]}</p></article>')
html.append('</main>')
(folder/"gallery.html").write_text("\n".join(html),encoding="utf-8")
tpath=folder/"task.json"
t=json.loads(tpath.read_text(encoding="utf-8"))
t["stage"]="complete-uncommitted"
t["checks"]=["manual: 12/12 内置生成图已逐张查看并展示；全部为待审阅候选","files: 12 WebP 等比例保存、均小于1MB，源PNG及预览SHA256已记录"]
t["unverified"]=["全部候选尚未获老板认可或接入；部分笔触偏碎和服饰差异待审阅","按老板边界未测试/build/素材审计/verify/游戏实页/提交/推送"]
tpath.write_text(json.dumps(t,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
print(json.dumps({"count":len(m["assets"]),"sizes":sorted(set(tuple(a["size"]) for a in m["assets"])),"previewBytes":sum(a["previewBytes"] for a in m["assets"]),"status":"review-candidate-not-integrated"},ensure_ascii=False))
