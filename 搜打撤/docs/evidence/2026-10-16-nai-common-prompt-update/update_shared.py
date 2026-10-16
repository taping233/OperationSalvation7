# -*- coding: utf-8 -*-
from pathlib import Path
import json
import hashlib

root = Path(__file__).resolve().parents[3]
evidence = root / 'docs/evidence/2026-10-16-nai-common-prompt-update'
evidence.mkdir(parents=True, exist_ok=False)
paths = ['tools/nai_style.py', 'tools/NAI-PROMPTS.md', 'docs/production/art/NAI-PROMPTING.md']
original = {p: (root / p).read_bytes() for p in paths}
(evidence / 'before.json').write_text(json.dumps({p: {'sha256': hashlib.sha256(b).hexdigest(), 'text': b.decode('utf-8')} for p, b in original.items()}, ensure_ascii=False, indent=2), encoding='utf-8')
def once(s, old, new):
    assert s.count(old) == 1, old
    return s.replace(old, new)
s = original[paths[0]].decode('utf-8')
s = once(s, 'NAI 默认画风 v3.0：恢复2026-10-16认可横版配方。', 'NAI 默认画风 v3.3：参考质量尾与通用画法减约束。')
s = once(s, "RECIPE_VERSION = '3.0'", "RECIPE_VERSION = '3.3'")
s = once(s, "QUALITY_BLOCK = 'high complexity, very aesthetic, masterpiece, no text'", "QUALITY_BLOCK = 'masterpiece, best quality, very aesthetic, masterpiece, no text, rating:general'")
s = once(s, 'Construct hair and clothing from broad, opaque interlocking color planes with a few deliberate brush accents. ', '')
s = once(s, 'Use clear grouped shadows, angular cloth folds and subtle brush texture.', 'Use clear grouped shadows and angular cloth folds.')
s = once(s, 'Keep fine linework selective around the eyes, fingers and accessories; let larger painted shapes carry the hair and fabric.', 'Keep fine linework selective around the eyes, fingers and accessories.')
s = once(s, 'Skin has delicate restrained transitions; black cloth remains matte.', 'Skin has delicate restrained transitions.')
s = once(s, 'Avoid uniform polished gradients across every surface. ', '')
s = once(s, 'Use a quiet, loosely brushed background without scenery, ', 'Use a quiet background without scenery, ')
s = once(s, "BASE_UC = 'lowres, artistic error,", "BASE_UC = 'blurry, lowres, upscaled, artistic error,")
(root / paths[0]).write_text(s, encoding='utf-8')
s = original[paths[1]].decode('utf-8')
s = once(s, '当前已按老板要求恢复认可横版v3.0，四画师链、画法、质量尾与通用UC逐字取回v3.0快照', '当前配方v3.3，质量尾、按需质量词、负面和画法以nai_style及组合手册为准，默认四画师链保留')
(root / paths[1]).write_text(s, encoding='utf-8')
s = original[paths[2]].decode('utf-8')
s = once(s, s.splitlines()[2], '当前 NAI 配方为 **v3.3**。画师、画法、通用负面与质量尾由 [nai_style.py](../../../tools/nai_style.py) 维护；模型和采样配置由 [nai_gen.py](../../../tools/nai_gen.py) 维护。默认画师链保留 `0.9::quasarcake::, 0.5::rella::, 0.4::gomzi::, 0.3::piromizu::`，单批画师沿老板当次指定。通用质量尾为 `masterpiece, best quality, very aesthetic, masterpiece, no text, rating:general`，保留两次masterpiece。通用画法已移除大块不透明色面、笔刷纹理、哑光黑布及避免光滑渐变的固定要求，立绘背景也不再强制涂刷笔触。负面基线保留已有项并补入 `blurry, upscaled`。人物身份、动作、构图和光色按单图填写。')
s = once(s, '当前已恢复v3.0；恢复核对见', 'v3.0恢复记录见')
s = once(s, '共享正向构建器末尾手动追加 `high complexity, very aesthetic, masterpiece, no text`。', '共享正向构建器末尾追加本页通用质量尾。')
s = once(s, '4. 关键标签靠前；用短自然语言交代人物与物体的关系', '4. 关键标签靠前；按“人数 → 景别/视角/动作/表情 → 环境/光色 → 必要的关系描述 → 画师/通用画法/质量尾”组织，简单图省略无关层，不固定镜头和光线。用短自然语言交代人物与物体的关系')
s = once(s, '### 人物关系、强调与参考正向词', '5. 额外质量词按单图选用：需要丰富结构时在 `high complexity` / `ultra complexity` 中选择，需要细节时加 `highly detailed`，不默认堆叠；`absurdres` 不代表实际像素尺寸。光线、材质和画风词放对应单图层。新增负面先与基线比对；需要文字、留白、发亮布料等画面时检查 `no text`、`negative space`、`glossy fabric` 等冲突并在该批请求明确处理。参考中的 `-0.8::feet::` 不加入通用尾词。\n\n### 人物关系、强调与参考正向词')
(root / paths[2]).write_text(s, encoding='utf-8')
p = root / 'docs/PARALLEL-REGISTRY.md'
s = p.read_text(encoding='utf-8')
entry = 'Friday（NAI通用词与酒吧图 01a1445b），2026-10-16：属地 `tools/nai_style.py`、`tools/NAI-PROMPTS.md`、`docs/production/art/NAI-PROMPTING.md`、`docs/evidence/2026-10-16-nai-common-prompt-update/`、`docs/evidence/2026-10-16-wu-rain-bar45/` 与根 `.tmp/nai/wu-rain-bar45-20261016.png`；按老板要求更新通用词并用参考第二张场景动作生成无，NAI4.5；编辑与生成中，无服务、未提交。'
s = once(s, '## 活跃登记', '## 活跃登记\n\n' + entry)
p.write_text(s, encoding='utf-8')
print('Shared recipe and manuals updated.')
