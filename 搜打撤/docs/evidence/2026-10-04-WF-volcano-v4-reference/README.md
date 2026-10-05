# 通用画风提示词与充能火山候选

2026-10-04，Friday / Codex；本轮 handoff 的 HEAD 425d03920e，远端差异未刷新核实。

老板认可并明确指定博览者 v4 原图 `exec-b4a4dd75-7441-419a-aa1b-7b8e2c3c8eb6.png`，令提取通用提示词、再画充能火山。附件路径前缀 `/C:/` 无法读取，改用同一文件的合法 Windows 路径读取。

通用画风已剥离白塔、书本、绿眼与服装色等主体内容，保存为 [general-style-zh.txt](general-style-zh.txt) 与 [general-style-en.txt](general-style-en.txt)。要点：宽长弧笔触、连通色块、选择性细线、脸部精确而外围松动、按结构着色与停笔、克制特效。完整本次生成提示词见 [prompt.txt](prompt.txt)。

内置 imagegen 以老板认可的 v4 作为画风参考、常无欲现行 ref-images 作为身份参考，生成常无欲托起熔火核心的职业卡充能火山。WebP候选保存为 `game/art-source/cards/hero-volcano-v4-reference-20261004.webp`；大PNG留 `.tmp/imagegen/volcano-v4-reference-20261004/volcano-v1.png`，原生成文件保留。来源、文件大小、SHA256及获取路径见 [images.json](images.json)。只进行格式编码，没有后处理改画。

实时 handoff 与登记表显示 WF-changwuyu-volcano 正在编辑本卡运行图。本轮独立候选未接入运行素材，未改其图片、缩略图、art-mapping 或 asset-manifest；归属不相交。按老板续令未检验、未测试、未实页、未build、未提交，无新服务。
