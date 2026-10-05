# 无今日职业卡接入

2026-10-04，老板令「把无今天重绘的职业卡接入」。从工作树3169的 `WF-wu-class-cards` 最终索引接入16张：10职业牌、3能力牌、3衍生剑；潜匿、剑仙形态、天剑诛魔选用索引指定v2稿。只替换对应32张运行WebP（原卡面+缩略图），添加16卡缓存版本与对应素材清单条目，卡牌规则未变。

来源会话 `01a10615-bc80-76f1-9180-db97f763caca` 已归档；[最终选择](generation-selected-outputs.json)、[首轮提示词](generation-requests-v1.json)、[返修提示词](generation-requests-repairs.json)留存。PNG原件与被替换旧图保存在主线忽略目录 `.tmp/art-reference/wu-cards-integrate-20261004/`，[图片报告](images.json)逐件记录路径、SHA256、大小及获取方式；大件原图不进Git。原卡面保持现行尺寸，WebP q90；缩略图宽448、q82，沿现行烘焙调色矩阵。

验证：卡面实装守卫 `npm run test:target -- tests/card-art-coverage.test.js` 3/3通过；32/32 WebP解码；[目标资产检查](asset-check.json)32件无发现，范围外1133条既有/其他会话资产问题不在本轮处理；[HTTP检查](http-check.json)32/32返回200且与落盘SHA256一致。JSON解析及自有diff空白检查通过。

Codex内置浏览器 `http://127.0.0.1:5200/` 当前默认窗口：真实点击照相馆、筛选人物无、滚动到最后一张、打开无量仙剑大图；[实页报告](browser-check.json)16张新缩略图全部加载，放大原卡面加载且带新缓存版本，控制台error0。首次HMR后入口提示加载失败，本会话标签刷新后重开通过；未操作存档/备注。截图为[当前窗口](current-window.png)，不是多尺寸或战斗验收。

HEAD `425d03920e4323b016433419ec11aec4a7f3795b`；本地既有 `origin/master` 引用差异 ahead53/behind0，未刷新远端。复用已有5200服务，未创建或停止进程。完成未提交；未build、未提交、未推送，全量/CI/战斗场景不覆盖本轮。复现转换代码见[integrate.py](integrate.py)，执行过即拒绝覆盖已有导入报告及备份。
