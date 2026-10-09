# 卡牌历史文档交付记录

2026-10-09，Friday。仅新增本目录文档与证据，未修改卡牌数据，未提交。

交付：[代号柒现役与历史卡牌总录](代号柒现役与历史卡牌总录.docx)，115 页；272 现役、49 明确退役、2 旧 ID 迁移或合并、8 其余历史 ID，共 331 个 ID 与 816 份卡面记录。

来源：当前源码装配卡库；本地所有 Git 引用中的卡库文件；冻结 Godot、旧桌面端、原型与证据内卡库快照。未读取浏览器私有存档、远端未取回引用或其他外部库。

提取 [extract.mjs](extract.mjs)；生成 [build.py](build.py)；核对 [checks.json](checks.json)。退役以 cards-sync、RETIRE_TT10、RETIRE_TT11 与按名清理规则为依据。

验证：331 个 Word 主条目与 485 个历史附属条目覆盖全部 816 份去重卡面；解析失败 0；最终 115 页渲染与图像复核通过；docs:check 通过。

catalog.json 与渲染 PDF 超过 1MB，保留本地，不进 git。render、render-final、render-tmp 与全文.txt 为本地中间或 QA 产物，不作为交付或提交内容。PNG 与接触表均由 render_docx.py 及 Pillow 本地生成。

## 大文件索引

- catalog.json，SHA256 7655a8d7f0de3537f885ccf868f55a3e5b8051e4207acd8597717ae319fdbd4b；获取方式：extract.mjs 本地 Git 与工作区提取。
- render-final\代号柒现役与历史卡牌总录.pdf，SHA256 c087aaf2efb637c94f0c25381773a1e2f4e90087a008bd7090e575ad61ce722a；获取方式：render_docx.py 本地渲染。

## PDF 排版交付

老板要求改善阅读，当前交付为 [卡牌图鉴与历史总录 PDF](output/pdf/代号柒卡牌图鉴与历史总录.pdf)。216 页、约5.4MB；每页最多四张卡，使用194份已留存配图，前半部分速查、后半部分历史卡面。331 个ID与816份卡面全部保留，596个书签、331个卡名目录链接、1030个内部链接目标核对通过。字体、长卡、分页和渲染图像检查通过。

生成脚本 [pdf_layout.py](pdf_layout.py)，核对 [pdf-checks.json](pdf-checks.json)。PDF超过1MB只留本地，不进git；SHA256 331bafe437a10981b0e4dbddc6cc727b7badef7422fb7f7596c3467afa3f4fa3；获取方式：读取catalog.json与当前卡图，由ReportLab本地生成。pdf-qa与pdf-qa-final为本地PNG/接触表，不入提交。原Word交付作为历史版本保留。
