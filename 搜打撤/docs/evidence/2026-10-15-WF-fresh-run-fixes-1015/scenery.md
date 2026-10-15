# F37 战斗章节场景（2026-10-15）

四章战斗已有不同场景：第一层原四层雪桥、第二层既有雪工业街、第三层新冻土遗迹、第四层与首脑新污染核心。两张新图使用系统 imagegen 技能的内置 `image_gen`，每图独立调用一次；未使用CLI/API、未安装依赖、未替换旧素材或角色卡面。

## 新素材与目视核验

| 场景 | 运行路径 | 尺寸 | 字节 | SHA256 |
| --- | --- | --- | --- | --- |
| 冻土遗迹 | `game/assets/scenes/battle/frozen-ruins-1015.webp` | 1600×900 | 194026 | `28bffc69088702a0676d9c823d3a42a4eb57ae2de0aa09b4b110ee15c9b37379` |
| 污染核心 | `game/assets/scenes/battle/contaminated-core-1015.webp` | 1600×900 | 192968 | `f8164af14613afdc981a902d4f8ece8822073cca0850bcd467da19ef524c1868` |

画风/镜头参考为 `winter-street-1011-v2.webp`。生成前用 `view_image` 查看参考，生成结果与WebP运行文件均已目视检查：两图无人、无怪物/武器/文字/UI，中心和左右站位地面开放；冻土图为坍塌工业/实验区、断管与积雪，污染核心为地下工业大厅与两侧/后墙紫晶、冷青顶灯。全图以不透明块面与灰蓝硬边塑形，未对旧图加滤镜冒充新场景。

原稿各大于1MB，保留在工具原目录，不复制进git：

- 冻土：`C:/Users/太平/.codex/generated_images/01a13e9e-67fb-7e60-bd8f-6f612af7aaff/exec-3a77437e-6bb4-4710-bbe0-1a4681900327.png`，2259991字节，SHA256 `3b70c7ca11d8859a60799fec693a7d3eac47b6d08388234b669c9e06b612e861`。
- 核心：`C:/Users/太平/.codex/generated_images/01a13e9e-67fb-7e60-bd8f-6f612af7aaff/exec-5aea5dd5-9762-4215-a85a-b2014724a274.png`，2321946字节，SHA256 `78e2f6770da8a441a62fd297aec3e11049e8a2bb29cefb6dec6aefed0c19b7ef`。

两张原稿均1672×941；沿项目既有Pillow wallpaper交付编码流程，RGB、LANCZOS等比近似校正至精确1600×900、WebP quality87/method6。只做交付重采样与编码，未裁图/合成/重绘。详细回执：[scenery-assets.json](scenery-assets.json)；完整提示词：[冻土](frozen-ruins-prompt.txt)、[核心](contaminated-core-prompt.txt)。

## 接入与生命周期

- 新纯模块 `game/src/battle/view/battle.scenery.js` 负责配置和选择：零起算层号0/1/2/3分别为桥/街/遗迹/核心，首脑优先核心。
- 每个battle token首次挂载时捕获层号，优先使用战斗opts显式层号，否则从当前game层号捕获一次。布局和解码回调不再读取实时地图层；面板返回仍使用原token捕获结果。
- `battle.view.js` 第一层继续只创建原far/mid/ground及foreground，保留原前景遮罩与UI开孔。
- 静态场景只创建一张 `.scene-static`，不创建原雪桥层、不创建前景图片/遮罩、不挂无用的pointer遮罩重算监听。共用原74%站脚线和舞台/立绘ResizeObserver，切换/隐藏时共用原断开、移除与取消rAF流程。
- 解码仍先隐藏图，检查场次、舞台、节点身份与当前mode后再揭示；旧图迟到解码不能揭示到下一场。既有入场等待/简化显示保持。
- `asset-manifest.json` diff只有count +2及本轮两项；没有扫入其他原稿、没有派生缩略图或修改旧资产。

## 验证与边界

- `npx vitest run tests/battle-scenery.test.js tests/battle-entry-view.test.js tests/battle-entry-readiness.test.js --reporter=dot`：3文件40测试通过，exit 0。覆盖四章选择、首脑选择、每token捕获、第二/三/四层单图挂载、无旧前景、重绘不重复解码、弹层返回、跨场迟到解码，以及原雪桥入场/简化/失败清理回归。
- 对新场景模块、`battle.view.js`及两份变更测试定向ESLint：exit 0。自有路径diff检查：exit 0。
- 两图精确登记核对：每路径唯一条目，bytes与SHA256匹配；调用现有asset-audit库筛选这两路径，`ownErrors:[]`，exit 0。
- 完整资产增量门 `asset-audit.cjs --check --paths-json [...]`：exit 1，仓库另有91个未登记/漂移错误，首项为`scenes/chests/boss-rig-v1/frame-00.webp`等。两图自身无错误；未扩大范围登记这些其他资产。

当前窗口内置浏览器实页由主会话统一执行，重点检查第二/三/四层与首脑的脚底贴地、UI可读、背景不混叠、弹层返回和场次切换。未运行build、全量测试、浏览器或服务；未提交、推送；未删除旧资产。第一批交互及第二批结算未改。
