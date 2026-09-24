## 当前状态补充：全界面美术排版流水线落库 + 09-24 批次收编（2026-09-24 08:50 +08:00）

- **8a71333** `feat: unify art direction across all UI screens via page overlay layers`：15 个 `css/page-*.css` 界面增量层（4.5k 行，12 个子代理产出、各页自验：截图+computed+交互回归+Tab 焦点走查+作用域零溢出断言）+ index.html 末尾统一挂载段（ui-scale.css 之后）。覆盖：选档/基地/出发/人物/仓库/商店/升级/设置+留言库/照相馆/制作坊/成就/远征HUD/事件/奖励+背包+帮助/战斗。语言基调=冷青调色+暗角、暖金 #d9bb82 封条金线/编号短线、交互三档节奏+快按慢弹+金线焦点环；动画仅 transform/opacity。
- **c699e4e** `feat: title screen art pass`：标题页第一二波（title-p0.css 调色/暗角/48 颗三层雪/出鞘扫光/档案徽章化 + winter.css akSnowNear 景深段）。
- 本笔（批次收编）：并行会话「09-24 留言批次 #5~#12」（见下一段）与 lab-ending/battle/hub 等 JS 批次随老板指示一并落库；index.html/winter.css 经 hunk 级拆分，三方改动归属清晰。
- 待老板决策：① 制作坊入口被 `game.cardslib.js:35 CARD_DESIGNER_WRITES_ENABLED=false` 代码关闭（现网点制作坊实际开照相馆）；② 战斗子代理将 handPageReminder 循环动画压成静态金强调；③ `game/.sdt-shots-upgrade/`（9 张验证截图）未入库未删除；④ 事件页 `.scene` 对话卡为休眠代码（样式已备）。
- 验证：vitest 全量 144 文件/811 用例全绿（8a71333 前，08:42）；挂载态实机目验选档页/基地页正常；真实存档 5 档零触碰（子代理全部用 headless Edge+CDP 隔离配置目录）。

## 当前状态补充：09-24 留言批次 #5~#12 落地（2026-09-24 +08:00，随批次收编提交）

- Edge 5173 网页版 localStorage 捞出 12 条新留言（09-20～09-23，解析脚本重写于 `代号柒/.tmp/sug_ldb.py`；关键修正：LevelDB 块句柄 size **不含** 1 字节压缩类型字节，其后才是 4 字节 crc——此前错切一字节全盘解析失败）。#1~#4（09-20/21 战斗 4 条）老板口头确认已处理；#5~#12 本批落地，12 条全部补写进 `game/output/suggestions.json` 标 done（89→101 条；Edge localStorage 侧无法文件侧回写 done，与 8139 同限制）。
- 落地明细（CSS 统一追加 winter.css 尾部「09-24 留言批次」注释块；对局地图左上三键透明与 lb-en 金色花体需 `!important`——winter.css 在 expedition 系之前加载，同特异性会被后加载文件压掉）：#5 照相馆特写相框改 `::after` 覆盖层绘制压在照片上方、照片四边外扩 45% 框宽伸入框下（选择器多挂 `.cz-photo-main` 压过 photo-studio-mounts.css）；#6 btnHome/btnHelp/btnMute 透明化；#7 lb-en 改 Segoe Script 金色 13px；#8 `#btnMapOverview` 按钮删除（index.html+game.boot.js 监听+cursor-art.js 引用；G 键 input.js camOverview 镜头总览保留），bagBtnFloat 放大 56×72 落底部栏（105px）正上方、btnLocate 上移 82px；#9 翻页动画 libPhotoPageIn（方向位移+微旋+stagger 40ms，消费此前无人用的 `--lib-page-enter-x`）；#10 退出照相馆闪烁根因=closeLibPage 提前摘 cardlib-open 使 `#overlay *` 禁动画规则集体解除（几百张卡重播入场）且容器淡出被压成瞬隐——摘类延至 hideOverlay 后 240ms（cardPageOpen 竞态防护）+`body.cardlib-open #overlay.closing` 豁免播 ovFadeOut；#11 留言库右下 BACK 删除，左上新增 ak-sq ak-exit 同款键（64×58 top16/left18，Esc 靠 aria-label「返回设置」仍可用，pg-head padding-left:98px 让位）；#12 标题位图字牌容器 .title-heading 宽度 ×1.2（clamp 430/43vw/760 → 516/51.6vw/912）。
- 验证：vite dev（5222，已停）IAB 实测——#12 同视口宽度严格 ×1.2 且不压照相馆圆钮；#6/#7/#8 computed 断言+截图；#9 computed animation/delay 断言（IAB 动画时钟冻结，观感留老板实机验收）；#10 点击退出瞬间 closing+ovFadeOut 挂载、400ms 后 cardlib-open 摘除、重开正常；#11 结构/尺寸/位置断言（受控后台标签截图停在旧帧，视觉留老板复检）；#5 特写渲染截图确认四角玻璃压角+提示文字不重叠。测试档位 5（newSlot→选人→启程→leaveSave）已 delSlot 两步确认删除。
- 现场：并行「09-24 标题页美术升级」会话改动（title-p0.css 雪花景深/wallpaper 调色 + index.html 雪花 48 颗）与「龙巢→经典生命研究所」改名批次未提交，本批全部尾部追加/定向 edit 未覆盖；version.json 0.60.0 为第四方发布改动未动。未构建、未推送。

## 当前状态补充：src 平铺目录化重构（2026-09-23 23:45 +08:00）

- 老板令解决「140 个 JS 平铺 game/src」问题：按 8 功能域目录化（core/ui/battle/cards/run/hub/home/audio），根层只留 4 个入口（main.js、boot-order.js、game.boot.js、r7a.qa.js）+ README + generated/。分层判据同步从文件名制改为目录路径制（architecture-graph.mjs 的 RUNTIME_OWNERS/PURE_MODULES/VIEW_MODULES 改按 `battle/`、`hub/`、`run/` 前缀判），BOOT_ORDER 条目改带域前缀路径，contracts/bag/hub/run-architecture/random 等测试的硬路径与正则同步。迁移用一次性脚本（`.tmp/migrate-src-layout.mjs` acorn 重写 + `git mv`，干完即弃不进 git）。
- 踩坑记录：脚本初版对非迁移目标（generated/）与 .json/css/assets 相对引用漏改，分别以「原 src 根解析存在即重算」补丁脚本修复（58 处）；`new URL('../assets/...')` 与 `import '../css/...'` 同类。文档仅更新活文档（src/README.md、docs/architecture.md、generate-compendium 模板），docs/ 历史计划/交付文档按史实保留旧路径；desktop-app/game 旧构建产物待下次 build 重生成。
- 验证：check-syntax 154 文件 0 错；全量串行 **142 文件 / 798 用例全绿**（比迁移前基线多 1 用例：random.test 改递归扫描全树后激活条件注册，并新增 `>100` 防假松断言）；守卫负例（合成图断言违规仍被抓）保持有效；`npm run docs:compendium` 入口重生成 docs/game-compendium.md（注意：直跑 generate-compendium.mjs 不落盘，写盘条件是 npm_lifecycle_event === 'docs:compendium'）。浏览器实机冒烟：标题页启动（SDT 25 模块）→ 开发面板跳遭遇战 → 手牌渲染/出牌命令/结束回合/敌方阶段/回大厅结算，全程零 JS 错误。
- 本轮为 rename-only 单提交（除路径/正则/文档外零行为变更）；dev server 5173 已重启可用。未构建、未推送。

## 当前状态补充：09-23 工作区整批落库（2026-09-23 22:43 +08:00）

- 老板指示「先提交」，将 09-23 各并行批次未提交改动整批落库（共 103 个修改 + 11 个新增路径，无删除）：无（侠客）职业卡/资源卡/穿刺等美术与 `art-mapping.json` 修订号、卡牌库照片墙与首页视觉（`expedition.css`/`winter.css`/`title-p0.css`/home-icons-v12）、光标素材（`cursor-art.js/.css`/cursors）、HarmonyOS 字体三件、音频（`sound.js`/`sound.policy.js`/`sound.scape.js`+新增战斗 sfx）、`game.cardslib.js`/`game.bag.settle.js` 等代码与配套测试（含新增 `battle-settlement-retry.test.js`）、本交接文档与 `audio-system.md`、`AGENTS.md`。
- 提交前证据：全量串行 `node node_modules/vitest/vitest.mjs run --no-file-parallelism` = **142 文件 / 797 用例全绿、0 红**（22:33 起跑，223s；6 红基线已清零）。按「并行半成品在场不 build」口径本次未构建、未推送；纯美术部分未做游戏内页面验收。落库后相对 `origin/master` ahead 45 / behind 0（未联网刷新），工作区清空；本次提交哈希以 `git log -1` 顶部为准（本条随提交 amend，不自记哈希）。

## 当前状态补充：无的职业武术卡接入较新生成稿（2026-09-23 22:30 +08:00）

- 老板指出当前网页不是最后重画的版本。核对发现此前交接只接入 18:10 的第二版；`.tmp/nai/output/wu-profession-*` 中另有 19:07–20:27 生成的后续成品。按卡 ID 及各卡最新输出，将飞刃偷袭（v5）、金蝉脱壳、鬼魅之刃、偷袭、快意恩仇、流星箭雨、潜匿、剑仙形态（其余为 v3）共 8 张接入 `game/assets/cards/martial-*.webp` 与对应 `game/assets/thumbs/cards/`。源 PNG 保持原比例缩至 896×613，缩略图 448×307；替换前的 16 个文件保存在 `.tmp/nai/output/wu-profession-ready-20260923-222617/backup-before-v3/`。20:45 的“冰刺”稿当前没有卡库 ID `tt7-icethorn`，未擅自新增卡牌；不变应万变-改、盗宝、江湖救急-改仍保持已有 v2 图。
- `game/data/art-mapping.json` 为这 8 张标记独立美术修订号，`game/src/art.js` 在原图和缩略图 URL 附加该修订号，使同一游戏版本号下的旧浏览器缓存失效。`node --check`、映射 JSON 解析、`git diff --check`、`tests/card-art-coverage.test.js` 3/3 均通过；Vite HTTP 实际返回的 8 张原图及 8 张缩略图均与本地新文件逐字节一致。源 PNG 和流星箭雨缩略图已目视检查；本轮内置浏览器页面复核未取得可用控制接口，仍需老板在已打开的页面刷新后确认具体卡面。HEAD `27df181`，未提交、未构建、未推送，其它会话的未提交改动保留。

## 当前状态补充：卡牌规则统一整合（2026-09-23 22:00 +08:00）

- Vite 卡牌规则切片按稳定 id 整合：定版卡 `rules.version=1`、旧卡回填、出牌前判定和即时效果、首批资源与背包道具、固定卡出售资格；制作坊关闭新增/编辑/删除/导入写入口，查看与导出保留。详见 `docs/card-rule-structure-migration-plan-2026-09-23.md` 第 11 节。只选择性暂存卡牌规则相关 hunk，保留并行照相馆、页面、美术和音频改动。
- 全量串行测试在修正前为 142 文件 139 通过、797 项 793 通过。之后修正吞噬击杀最后一名敌人时终局 `busy` 未清的问题；TT3 定向 8/8，全卡实打 272 张、硬失败 0、条件卡零效果警告 3。另两项照相馆旧断言按老板要求移除、火球日志断言适配，各自定向复跑通过；修正后未重新全量。Codex 内置浏览器确认制作坊进入照相馆，导出工具无写入口，开发者遭遇战可实际出牌。材料卡/复原药水和新迁战斗卡完整实机流程未核实。
- 卡牌规则切片已提交为 `27df181`；相对本地 `origin/master` ahead 44 / behind 0（未联网刷新）。共享目录仍有其他会话未提交改动，未运行构建；未推送。旧交接条目保留为历史快照。

## 当前状态补充：普通卡“穿刺”重画（复核于 2026-09-23 18:29 +08:00）

- 核对 `game/data/art-mapping.json` 与 `game/src/art.js`：`tt3-skewer`（穿刺）当前实际使用 `cards/expedition-starters/pierce.webp` 的覆盖图，属于普通卡；旧图误用了无的角色形象。本轮按官方 `tools/nai_gen.py` + `tools/nai_style.py` 的 NovelAI V5 Full / painterly v1.2 流程重画为通用破甲视觉：纯色暖米背景、两片深色护甲与穿过缝隙的一道亮线，没有人物。
- API 第二稿返回 HTTP 200；目视检查原图和约 215×165 小图后，替换 `game/assets/cards/expedition-starters/pierce.webp`（896×672）和对应缩略图（448×336）。第一稿与最终 PNG、提示词、seed、旧图备份均保存在工作区外 `D:\nai_pierce_generic_20260923\`。`martial-tt3-skewer.webp` 当前被覆盖图优先级遮蔽，本轮未改动。
- 纯美术资源未跑测试、构建或游戏内页面验收。复核时 HEAD `fdbbee2`，相对本地 `origin/master` ahead 42 / behind 0（未联网刷新）；`git status --short` 共 88 项，含其他并行改动。本轮只改上述原图、缩略图与本交接记录，未提交。
## 当前状态补充：无的职业卡第二版重画（复核于 2026-09-23 18:11 +08:00）

- 按老板反馈，继续使用 `tools/nai_gen.py` + `tools/nai_style.py`、NovelAI V5 Full 与 painterly v1.2，重画同一批 10 张无（侠客）职业卡。新版以大幅主体、完整单色背景和单一视觉符号提高小图可读性；固定无的白色高马尾、蓝缎带、黑玫瑰、头顶圆墨镜、蓝眼和黑色露肩裙，并变化俯视、仰视、侧面、正面及回身镜头。卡牌效果以闪避、突袭、隐匿、援助、应变等动作为主，不照字面堆砌场景。
- 新版 10/10 API 返回 HTTP 200；已查看完整联系表和约 215×165 的缩小联系表。卡面 WebP 为 896×672，对应缩略图为 448×336，已替换同一批 10 个 `game/assets/cards/martial-*.webp` 及同 ID 的 `game/assets/thumbs/cards/` 文件。飞刃偷袭与无的能力卡未改。
- 第一版 20 个 WebP 已先备份至 `D:\nai_wu_cards_v2_20260923\retained-v1\`，第一版生成源图仍在 `D:\nai_wu_cards_20260923\`；第二版 PNG、提示词、seed、联系表与转换成品在 `D:\nai_wu_cards_v2_20260923\`。替换前逐个核对项目目标文件与备份哈希一致，未覆盖并行新改动。
- 本次为纯美术资源，未跑测试或构建，也未做游戏内页面验收。HEAD `bed8509`，相对本地 `origin/master` ahead 41 / behind 0（未联网刷新），`git status --short` 共 83 项，含其他并行改动；本轮只修改上述 20 张图与本交接记录，未提交。
## 当前状态补充：无（侠客）职业卡插画/API 重出（复核于 2026-09-23 17:56 +08:00）

- 按项目 `tools/nai_gen.py` + `tools/nai_style.py` 官方流程，通过 NovelAI Diffusion V5 Full API、画风 v1.2 重出 10 张职业卡插画：金蝉脱壳、偷袭、鬼魅之刃、快意恩仇、流星箭雨、潜匿、剑仙形态、盗宝、江湖救急-改、不变应万变-改；接口 10/10 返回 HTTP 200，生成尺寸 1024×768，转换为卡面 WebP 896×672 与缩略图 448×336。
- 只替换上述 10 个 `game/assets/cards/martial-*.webp` 及同 ID 的 `game/assets/thumbs/cards/` 缩略图；`martial-tt7-throwblade.webp`（飞刃偷袭）和三张无的能力卡未改。统一白发高马尾、蓝缎带、黑色露肩裙与蓝色点缀，按卡牌主题区分动作和场景。API PNG、seed、完整提示词、清单与联系表保存在工作区外 `D:\nai_wu_cards_20260923\`。
- 已目视检查十张图的联系表与输出尺寸；未做游戏内页面验收、测试或构建（纯美术资产）。复核时 HEAD `bed8509`，相对本地 `origin/master` ahead 41 / behind 0（未联网刷新）；`git status --short` 共 80 项，含其他并行改动，本轮只写入上述 20 个卡面/缩略图和本交接记录，未提交。
# 搜打撤（Vite 版）· AI 交接文档（原编于 2026-09-20，状态更新至 2026-09-23）

## 当前状态补充：首页文字材质与画面活力（复核于 2026-09-23 17:41 +08:00）

- 本轮只改 `game/css/expedition.css`：四个入口与探索的中文改为较大的楷体与暖白金色描光，英文改为金色斜体并加细金线；各图标增加低强度的对应色边缘光、错开的轻微浮动和金环明暗变化，右侧加入少量缓慢漂移的暖色光点。系统或游戏的减少动态效果模式会停用新增动画。
- 旧 `winter.css` 存在 `body,body *` 的全局字体 `!important`，已对首页这几处文字做局部覆盖；内置浏览器计算样式确认中文为 KaiTi 字体栈、英文为 Georgia、浮动与光点动画生效。1280×720 实际截图显示文字清晰，标题、人物和五个入口无明显遮挡。`git diff --check -- game/css/expedition.css` 通过；纯 CSS 未跑测试或构建，最终审美待老板验收。HEAD `bed8509`，未提交，其他工作区改动保留。

## 当前状态补充：照相馆取消照片墙纵向滚动（复核于 2026-09-23 17:40 +08:00）

- 照片墙固定两行、四列，每页八张；网格和页面关闭纵向滚动，窄屏也维持四列并压缩卡格留白。移除回顶按钮、滚动状态样式与滚动事件；下方分页仍保留。未做页面验收或测试/构建（依老板要求）。
- HEAD `bed8509`，相对本地 `origin/master` ahead 41 / behind 0（未联网刷新）；工作区 52 项改动，包括其他并行内容，本次只改 `game.cardslib.js`、`expedition-library.css` 与本交接记录，未提交。

## 当前状态补充：首页图标放大与位置调整（复核于 2026-09-23 17:37 +08:00）

- 老板反馈独立图标偏小且位置欠妥；本轮只改 `game/css/expedition.css`，四个入口图标本体由约 72px 放大至 104–130px，入口排到标题下方两列，增大纵横间距；探索黑剑由 190px 扩至 250px 并放在右下。法杖底部黑色渐变收窄，火堆盾牌单独加大。
- Codex 内置浏览器 1280×720 截图复核：五个图标、各自文字与主标题均可见，菜单之间无明显重叠；最终位置与审美待老板验收。`git diff --check -- game/css/expedition.css` 通过；纯 CSS 未跑测试或构建。HEAD 仍为 `bed8509`，本轮未提交，其他工作区改动保持原样。

## 当前状态补充：照相馆缓存、渐进高清与美术预取（复核于 2026-09-23 17:26 +08:00）

- 启动仍遍历全量美术清单并分批预取到浏览器 HTTP 缓存；只对首轮场景显式解码，卡面和缩略图在显示前按需解码。照相馆翻页保留当前页外最多两页 DOM，筛选变化、重开与关闭时清空；点开照片先显示已加载缩略图，入场后再异步解码并切回原图，常态照片滤镜已移除。
- 本轮仅源码级调整，未跑测试、构建或页面验收；高清图仍使用原图，入场动画期间降低了竞争，但没有生成中尺寸详情资产，原图完成解码后仍会占用相同位图内存。HEAD `bed8509`，相对本地 `origin/master` ahead 41 / behind 0（未联网刷新），工作区仍有 50 项改动；未覆盖其他并行素材和改动，未提交。

## 当前状态补充：首页独立图标与少量前景纸张（复核于 2026-09-23 17:25 +08:00）

- 按老板本轮指定，使用 `tools/nai_style.py` 官方 painterly v1.2 与 NovelAI V5 Full 生成五张透明底图标：探索为横向黑剑与金色气流，制作坊为紫焰法杖，成就为火堆与盾牌，照相馆为球形藏书，设置为冷钢齿轮。WebP 成品在 `game/assets/ui/home-icons-v12/`；原始 PNG、提示词与种子保存在仓库外层 `.tmp/nai/output/home-icons-v12-20260923/`。
- `game/css/expedition.css` 将四个入口改为独立的图标在上、文字在下的 2×2 布局，探索单独放大置于右下；去掉原有菜单金属框，在每个图标后加统一的不规则暗色渐变、细金环及小点。`game/index.html` 增加一个不接收点击的前景纸张层，CSS 在画面下沿放两小片纸。
- Codex 内置浏览器在 1280×720 实际截图确认五个入口均可见，标题、人物与按钮无明显相互遮挡；最终审美由老板验收。`git diff --check` 通过；本轮纯页面美术未跑测试或构建，也未提交。HEAD `bed8509`，相对本地 `origin/master` ahead 41 / behind 0（未联网刷新）；工作区仍有其他并行改动，未覆盖或提交，具体以实时 `git status --short` 为准。

## 当前状态补充：照相馆悬停与滚动绘制减负（复核于 2026-09-23 17:19 +08:00）

- 悬停预览切换复用 `libCardById`，并避免对已选中的同一张卡重复替换预览 DOM；网格滚动期间临时关闭照片颜色滤镜，停止滚动后恢复原效果。
- 源码级局部改动，未跑测试、构建或页面验收（依老板要求）；HEAD `bed8509`，相对本地 `origin/master` ahead 41 / behind 0（未联网刷新），工作区共 50 项改动。仅在 `game.cardslib.js`、`expedition-library.css` 追加上述局部差异，其他现场保留。

## 当前状态补充：资源卡统一画风重出（复核于 2026-09-23 17:12 +08:00）

- 按官方 painterly v1.2 与 NovelAI Diffusion V5 Full 重出 16 张 `resourceArt` 资源插画，并同步 `tt-rations` 实际使用的 expedition 覆盖图；同时更新卡面与缩略图。木材三档为单根、两根、三根；钥匙串为两把/三把，双份口粮为两包。
- 资源卡 WebP 为 1024×1024，缩略图 448×448，均核对 alpha 0–255；16 张 PNG、提示词和种子见 `.tmp/nai/output/resource-cards-v12-r1-20260923/manifest.json`。未跑测试、构建或游戏页面验收。
- HEAD `bed8509`，相对本地 `origin/master` ahead 41 / behind 0（未联网刷新）；`git status --short` 共 50 项。

## 当前状态补充：全量预热让出卡牌库渲染（复核于 2026-09-23 17:08 +08:00）

- 888 项总预热仍以 2 张一批执行，批间交给 `requestIdleCallback`（无此 API 时让出 32ms）；照相馆打开时暂停后续批次，关闭后续跑。预热池预算不变。
- 本次依据源码检查和资源清单核算定位启动解码连续排队风险并加调度保护；未做浏览器验收、测试或构建。HEAD 沿用 `bed8509`，远端未刷新，其他并行改动未覆盖或提交。

## 当前状态补充：首页局部微动效（复核于 2026-09-23 17:01 +08:00）

- 老板要求继续首页美术改稿。本任务只改 `game/css/expedition.css`：玫瑰附近加入低强度暖光呼吸，“开始探索”加入每 8 秒一次的窄幅柔光扫过；窄屏裁切隐藏玫瑰光区，`reduce-motion` 与系统减少动态效果时停用动画。未改插画、HTML、点击逻辑或其他并行文件。
- Codex 内置浏览器 1280×720 实际截图确认首页布局保持正常，计算样式确认 `titleRoseBreath` 和 `titleStartGleam` 生效；截图时主按钮扫光处于透明阶段，尚未逐帧目视确认整段动画。`git diff --check -- game/css/expedition.css` 通过。纯 CSS 改动未跑测试或构建，最终动效观感待老板验收。HEAD `bed8509`，本任务未提交。

## 当前状态补充：启动全量美术预热（复核于 2026-09-23 17:00 +08:00）

- 启动预热由 6 个首轮场景扩展为运行时美术清单与卡牌库缩略图清单：当前源清单分别为 536 张原图、352 张缩略图（约 46.4 MB 文件数据）；启动场景先排队，随后分 6 张一批加载与解码。预热池沿用上限 96 张/192 MiB，不扩大解码常驻预算。
- 原图和缩略图 URL 使用各自渲染端同款 `assetUrl` 规则并去重。未运行构建或测试；并行工作区改动仍在，HEAD `bed8509`，远端未刷新。

## 当前状态补充：首页主标题使用现有艺术字（复核于 2026-09-23 16:56 +08:00）

- 16:56 +08:00 视觉复核后修正：艺术字原来占右栏过小、颜色偏暗；现将标题容器扩大到 `clamp(380px,35vw,500px)`，右距 3.6%、顶距 9.5%，亮度调至 1.3，并隐藏重复的英文眉题。Codex 内置浏览器 1280×720 截图确认艺术字完整可见，与第一个菜单之间有 28px 盒间距且页面无横向溢出；其他视口和最终审美仍待验收。
- 老板指定主标题用素材库艺术字，允许先查找。已找到 `game/assets/title-wordmark.png`（3200×1486、RGBA 透明），并确认 `game/dev.html` 曾使用同一资源。仅改 `game/css/expedition.css`：用该素材显示首页 `h1.winter-wordmark`，保留原有标题文本，隐藏重复的英文版次行；未触碰其他会话改动中的 `game/index.html`。
- `git diff --check -- game/css/expedition.css` 通过。未跑测试或构建；最终审美效果待老板验收。HEAD `bed8509`，本任务改动未提交，并行工作区其他文件未覆盖。

## 当前状态补充：照相馆翻页动效与缩略图预热（复核于 2026-09-23 16:50 +08:00）

- 翻页会给网格标记前进/后退方向，当前页 8 张照片从对应方向短距离淡入；代码路径已核对。内置浏览器确认可翻至第 2 页并显示新卡片，但未做动效验收。
- 预热为当前页近视口懒加载：IntersectionObserver 的 `rootMargin` 为上下各 55%，触发后将缩略图 `data-lib-src` 赋给 `src` 并调用 `decode()`。没有预载下一页；下一页缩略图在翻页生成节点后才开始请求/解码。
- 本次未跑测试或构建。HEAD `bed8509`，未联网刷新远端；并行工作区其他改动未覆盖或提交。

## 当前状态补充：首页右侧入口空间连接（复核于 2026-09-23 16:50 +08:00）

- 老板要求执行第三项首页改稿。本任务仅在 `game/css/expedition.css` 给右侧四个入口的图标列后方加低对比纵向结构线，延伸到“开始探索”按钮，并加强入口与壁纸之间的接触阴影；850px 及以下关闭这条线，避免窄屏拥挤。未改页面结构、素材或交互。
- `git diff --check -- game/css/expedition.css` 通过。沿用老板自行验收安排，未操作浏览器、未跑测试或构建，画面效果待老板验收。HEAD `bed8509`；本任务改动未提交，其他并行工作区文件未覆盖。

## 当前状态补充：首页人物与场景局部光影（复核于 2026-09-23 16:47 +08:00）

- 老板要求迅速执行第二项首页改稿并自行验收。本任务只在 `game/css/expedition.css` 为单张壁纸叠加局部光影：远处书架轻压对比，脸与玫瑰局部提亮，裙摆和地面交界补微弱冷光；窄屏裁切移走角色时禁用这些桌面光区。未换图、未改交互或其他模块。
- `git diff --check -- game/css/expedition.css` 通过。按老板“我来验收”，未操作浏览器，未跑测试或构建；实际画面效果待老板验收。HEAD 仍为 `bed8509`，本任务改动未提交；并行工作区其他文件未覆盖。

## 当前状态补充：照相馆动画性能调整（复核于 2026-09-23 16:46 +08:00）

- `game/src/game.cardslib.js` 的卡格动画序号改为页内序号；`game/css/expedition-library.css` 将当前索引页卡片改为短淡入、取消位移缩放，并缩短照片背签过渡；`game/src/ui.js` 将点开照片 FLIP 时长由 420ms 改为 240ms、取消背签延迟。
- 按老板要求，本次改动未做浏览器验收、测试或构建。HEAD 沿用本轮已核 `bed8509`；远端未刷新。其他并行工作区改动未覆盖或提交。

## 当前状态补充：首页左上角透明控件（复核于 2026-09-23 16:44 +08:00）

- 老板指定左上角三个图标透明底图。本任务在 `game/css/expedition.css` 将退出、静音、快速参考三控件的背景、边框和盒阴影置透明，移除退出/静音的内框；图标与文字保留深色投影，确保浅色雪景上可辨，悬停也保持透明。
- Codex 内置浏览器当前窄视口实机截图可见三控件无底板；计算样式确认三者 `background-image:none`、透明背景/边框、`box-shadow:none`。`git diff --check -- game/css/expedition.css` 通过。纯 CSS 改动未跑测试或构建；未改点击逻辑。
- 复核时 HEAD `bed8509`；本任务仍只有 `game/css/expedition.css` 与本交接文档的增量。工作区另有照相馆、光标、场景缩略图等并行未提交改动，均未覆盖、未提交，具体状态以实时 `git status --short` 为准。

## 当前状态补充：照相馆分页性能调整（复核于 2026-09-23 16:41 +08:00）

- 老板要求分页控件置于卡格下方，并将单页缩至 8 张；`game/src/game.cardslib.js` 的 `LIB_PAGE_SIZE` 已从工作区原有值 24 调整为 8。底部单一翻页条沿用工作区现有实现。本次纠正后未做浏览器验收或测试（按老板要求）。
- 当前 HEAD `bed8509`；相对 `origin/master` 的 ahead/behind 沿用 16:37 快照 41/0，未联网刷新。工作区其他未提交改动保持原样；以实时 `git status --short` 为准。

## 当前状态补充：首页视觉层级改稿（复核于 2026-09-23 16:41 +08:00）

- 老板要求落实首页美术对比后的建议。本任务只改 `game/css/expedition.css`：减轻全屏底部暗幕，把右侧对比集中在无硬边的局部渐变；强化四个菜单的图标金属承托、文字层级与悬停反馈；给“开始探索”增加暖金材质和内边框。现有插画、页面结构、点击逻辑和其他模块未改。
- Codex 内置浏览器 `http://127.0.0.1:5173/` 在 1280×720 实际截图复核：角色裙摆与地面细节可见，右侧标题/四个菜单/主按钮可读，主要控件均在视口内，页面无横纵溢出；计算样式显示壁纸与菜单材质已加载。`git diff --check -- game/css/expedition.css` 通过。未跑测试或构建，未取得更宽/窄视口的实机截图，也未进行最终玩家审美验收。
- 复核时 HEAD `bed8509`，相对本地 `origin/master` ahead 41 / behind 0，未联网刷新。`git status --short` 含本任务的 `game/css/expedition.css` 和本交接文档，以及其他并行任务的素材、照相馆、光标与工具改动；其余改动归属/验收以各任务自己的记录为准，本任务未覆盖、未提交。

## 当前状态补充：鼠标光标接入回退（复核于 2026-09-23 17:25 +08:00）

- 按老板要求回退运行时自定义光标：从 `game/index.html` 移除了光标样式表、覆盖层节点和模块脚本入口，页面恢复使用现有鼠标指针。保留 `game/assets/ui/cursors/` 全部美术素材，以及未接入的 `game/css/cursor-art.css`、`game/src/cursor-art.js` 作为后续参考稿；没有删除素材或稿件。
- 照相馆里仍无法正常使用自定义光标，按老板反馈记录为未解决；上一轮样式审计未能代表实际可用性，因此不作为通过验收。此次仅执行运行时接入回退，没有继续做浏览器测试、测试套件或构建。
- 复核时 HEAD `bed8509`，本地 `origin/master` ahead 41 / behind 0，未联网刷新远端。`git status --short` 共 51 项；本任务保留的未跟踪光标素材、CSS/JS 稿件仍在。另有 46 项并行改动归属/验收未核实，包含 `game/assets/cards/{expedition-starters,resources}/` 与对应 `game/assets/thumbs/cards/` 素材、`game/assets/thumbs/scenes/{hub-wallpaper,endfield-ruins}.webp`、`game/assets/ui/home-icons-v12/`、`game/css/{expedition-library,expedition}.css`、`game/src/{art,game.boot,game.cardslib,performance-budgets,ui}.js`、`game/tools/bake-card-thumbs.cjs` 和 `vite.config.js`。未覆盖这些并行改动。

## 当前状态：整体提交（复核于 2026-09-23 16:17 +08:00）

- 老板明确要求将当时全部未提交改动入库。本段随该次提交入库；提交基线为 `034b2bd`，提交后的 HEAD 以本段所属提交为准。提交前相对本地 `origin/master` ahead 40 / behind 0，未联网刷新远端。
- 提交前 `git status --short` 包括 60 个已跟踪文件修改、38 项未跟踪、暂存区为空。范围含根 `AGENTS.md`、项目文档、战斗/卡牌/效果与照相馆代码、测试、卡面与缩略图、美术映射与生成清单、NAI 工具、标题牌图片；包括 `game/.tmp_sign_check.png` 和 `tools/__pycache__/` 的 2 个 `.pyc` 文件。
- 并行任务仍在写入封印肢体素材与本交接文档；具体改动归属、整体验收未核实。本次不运行构建、测试或新的浏览器验收；提交后需以实时 `git status --short` 核对是否有后续写入。

## 当前状态补充：封印肢体透明素材重出（复核于 2026-09-23 16:17 +08:00）

- 使用项目官方 painterly v1.2 与 NovelAI Diffusion V5 Full，生成左手、右手、左腿、右腿四张独立透明 PNG；原图与提示词/种子清单保存在 `D:\素材\代号柒\.tmp\r\nai\output\sealed-limbs-v12-20260923\`。
- 同步替换 `game/assets/cards/creature-tt8-{curseimmune,energycap,nofocus,healplus}.webp` 与对应缩略图；卡面为 896×896，缩略图为 448×448，均保留 alpha。
- PNG 与 WebP 均已用 Pillow 核对尺寸和 alpha 范围 0–255。未跑测试、构建或游戏页面视觉验收。
- 16:17 复核：老板反馈旧第 3、4 张腿图易看成两条腿，已仅重出左腿/右腿为单一连续肢体轮廓并替换对应卡面与缩略图；左右手保持不变。新 WebP 卡面为 896×896、缩略图为 448×448，alpha 均为 0–255；生成 PNG 与提示词/种子记录在 `.tmp/nai/output/sealed-limbs-v12-r3-20260923/`。未跑测试、构建或游戏页面视觉验收。
- HEAD `034b2bd`，相对本地 `origin/master` ahead 40 / behind 0（未联网刷新）。`git status --short` 共 98 项；本补充记录本次 8 个素材文件，其余工作区改动仍沿用未核归属/验收状态。

<!-- photo-studio-commit:start -->
## 当前状态补充：照相馆提交（复核于 2026-09-23 15:30 +08:00）

- 本段随 `feat: refine photo studio art and add reusable overhaul guide` 提交。HEAD身份以本段所属提交为准；提交基线为 `d32a7d6`，入库后相对本地 `origin/master` ahead 39 / behind 0，未联网刷新远端。
- 本对话入库范围：照相馆布局/分级边框/彩色夹子/纸纹与阴影、照片专属大图和收回逻辑、同封面的左上退出键、相关定向测试、两张开发对照页、照相馆美术资产与记录，以及可迁移的完整 `docs/ui-art-overhaul/` 技能指南。
- `game.cardslib.js` 中独立的伤害/攻击词条修改不纳入本次；战斗/卡牌效果、其他卡面与缩略图、映射清单、NAI工具、全局图标、其他文档和根AGENTS改动均保留未提交。共享交接文档只暂存本补充段，其他任务记录保持工作区原样。
- 验证边界：此前相关5文件39项通过；老板接管验收后的素材、相纸和退出键更新未重新运行游戏测试/浏览器。本次同步测试的退出按钮定位，未执行该测试。指南结构/内部链接已检查；入库不代表完整美术验收通过。
- 此前资源故障为5173服务停止，后台Vite已恢复；验收页、面板PNG、代表照片WebP曾在本轮HTTP读取返回200。服务与工作区均会变化，接手时重查实际状态。

- 2026-09-23 15:57 +08:00：照相馆底图与退出键修复已在提交 `034b2bd` 入库：展墙使用已有 `wall.webp`，关闭键复用标题页锚点与尺寸；Codex 内置浏览器确认底图显示，点击关闭返回标题页。当前相对本地 `origin/master` ahead 40 / behind 0（未联网刷新）；其他未提交改动的归属与验收仍待核实。

<!-- photo-studio-commit:end -->

> 本文于 2026-09-20 初编，当前状态区更新至 2026-09-23。接手以本次对话指令、根 `AGENTS.md` 和实时仓库为准；后文带日期的盘点与决策清单均为历史快照。
> 旧版 `NEXT-AI-HANDOFF-2026-09-12.md` 仅作可选历史背景，不是开工前置条件。

## 60 秒接手

| 先看 | 当前信息 |
| --- | --- |
| 范围 | 唯一开发主线是 Vite；Godot / Unity 冻结。遵守仓库根 `AGENTS.md`。 |
| 快照 | 2026-09-23 16:02 +08:00：`master`，HEAD `034b2bd`，领先本地 `origin/master` 40 / 落后 0，未联网刷新；工作区仍有其他未提交改动。**开始操作前重跑 `git status --short`**。 |
| 进行中 | 照相馆当前底图与退出键已在内置浏览器核对；此前响应式、文案和动效改动仍待统一验收。战斗/卡牌/效果、卡面与 NAI 工具仍有未提交改动，归属/状态待核对。 |
| 下一步 | 核对老板最新指示及文件所有权，再选一个确认过的工作切片；归属不明的共享文件先不改。 |
| 验证 | [结算恢复计划](settlement-recovery-plan-2026-09-23.md)记录隔离全量 118 文件/652 项通过、最终定向回归与死亡实机流程通过；正常成功撤离闭环仍未验收。其他当前未提交改动的合并验证状态未知。入口见 §3。 |
| 边界 | 保留现有未提交改动；不清理、不回滚、不提交、不推送。其他会话改动仍在时，不 build 或覆盖共享文件。 |
| 决策清单 | §7 是 2026-09-20 历史清单；当前哪些事项仍待老板决定尚未复核，不能直接照单执行。 |

## 0. 项目速览

- 项目：**搜打撤**（仓库名「代号柒」，GitHub: taping233/OperationSalvation7）—— roguelike 卡牌网页游戏（杀戮尖塔式战斗 + 撤离玩法），中文，美术为动漫立绘+卡面。
- 源码位于仓库内 `搜打撤/game`，全局兼容对象为 `window.SDT`，叙事由 ink 驱动。桌面 EXE 已停维护；验证方式见 §3。
- 默认中文交流，称呼用户「老板」；助手名为 Friday。
- 按主题查阅规则、架构、开发、验证与美术文档（§§ 3–6）；长期约束见根 `AGENTS.md`。

## 当前状态（复核于 2026-09-23 16:02 +08:00）

- 重新读取 `git status --short` 与 `git log -1`：分支 `master`，HEAD `034b2bd`（`fix: restore photo studio background and align exit`）；相对本地 `origin/master` ahead 40 / behind 0，未联网刷新远端。
- 本轮只提交照相馆修复：`game/src/game.cardslib.js` 中退出键挂载到标题页 `.ak-tl` 锚点，`game/css/photo-studio-craft.css` 中对齐 64×58 尺寸并恢复已有 `wall.webp` 底图、叠加深绿暗纱。`game.cardslib.js` 中既有的伤害/攻击词条改动未核归属，未提交。
- Codex 内置浏览器 `http://127.0.0.1:5173/` 实际检查（1028×1003）：照相馆加载 273 张馆藏，背景墙可见、照片和筛选可读；点击关闭按钮返回标题页。未运行测试或构建；工作区仍有其他会话未提交改动，整体归属/验收未核实。
- 其他战斗/卡牌、素材、NAI 工具与文档改动继续保留，未覆盖、构建或提交；交接文档含其他范围改写，当前状态补充也仅留在工作区，未暂存。

## 历史状态快照（复核于 2026-09-23 15:26 +08:00）

- 指南任务补充：HEAD `d32a7d6`，相对本地 `origin/master` ahead 38 / behind 0，未联网刷新远端。其他未提交工作保留，归属/整体验收未核实。
- 资源服务：此前全部图片失效时，5173端口无监听、请求连接被拒绝，文件仍在。已恢复后台Vite服务；本轮HTTP读取验收页、木雕面板PNG和代表照片WebP均返回200及正确类型。没有操作用户页面，HTTP恢复不代表视觉验收通过。
- 新增 `docs/UI-ART-OVERHAUL-GUIDE.md`。技能与四份配套说明位于 `C:\Users\太平\.codex\skills\ui-art-overhaul`；未修改Codex配置或游戏实现。技能结构验证通过，内部Markdown链接无缺失；未进行小模型端到端实跑、游戏测试、构建或浏览器验收。
- 下方15:23的其他任务核验记录保持原样，本指南任务没有重复验证其结果。

### 此前状态记录（2026-09-23 15:23 +08:00）

- 本次重新读取 `git status --short` 与 `git log -1`：HEAD `d32a7d6`；相对本地远端跟踪引用 `origin/master` ahead 38 / behind 0，未联网刷新远端。
- 此前照相馆改动仅涉及 `game/src/game.cardslib.js` 的退出按钮标记、`game/css/photo-studio-craft.css` 的对应样式，以及本状态记录。退出键复用封面相同 SVG 路径、58×58 按钮尺寸、24×24 图标和窄屏缩放样式，退出事件不变。
- 卡面核验：`高端研发`（`tt12-hitechrd`）与`基础开发`（`tt12-basicdev`）已分别使用对应 `spell-<id>.webp` 新卡面，缩略图也已在位。通过内置浏览器打开照相馆搜索两张卡并目视确认；本轮没有改游戏文件，也未运行测试或构建。该核验仅覆盖这两张卡，不代表其他未提交卡牌素材已验收。
- 本对话子代理已无运行任务。其他战斗/卡牌、素材、NAI 工具及文档等未提交改动仍在；其归属与验收状态未核实，不覆盖、不构建、不提交。
- 老板此前已明确自行验收照相馆退出按钮；其最新退出按钮画面仍未由本轮验收。此前照相馆测试与画面检查不能作为最新素材和退出按钮的验收结果。

### 上一次状态快照（2026-09-23 12:50 +08:00，历史）

本节记录的是复核时的仓库证据。复核时间不是有效期；开工前重查实时状态。提交、文件归属或验收结果发生变化时，按根 `AGENTS.md` 更新本节；历史快照另行标日期保留。

- Git：分支 `master`，HEAD `d32a7d6`（2026-09-23，`fix: recover terminal and extraction settlements atomically`），比 `origin/master` ahead 38。
- 最新检查时 `git status --short` 显示 30 个已跟踪文件修改、9 个未跟踪项（含本次文档改动）。仍有战斗/卡牌效果、照相馆/UI 和 NAI 工具改动；不要将它们与已提交的结算恢复工作混为一组。接手时仍须重查实时状态与文件所有权。
- **终局/撤离恢复**：实现已在 `d32a7d6` 本地提交；[结算恢复计划](settlement-recovery-plan-2026-09-23.md)记录了隔离全量、定向回归、故障注入和死亡路径内置浏览器验收。正常四层游玩后的生产撤离整理刷新/多次入库闭环仍未验收；该提交未推送。
- **战斗/卡牌/效果**：`battle.*`、`cards.*`、`effect-steps.*`、`effect-verbs.js`、卡牌 compendium 和相关测试均有改动。仅凭当前文件清单无法确认各改动的任务归属或整体验收状态。
- **照相馆/UI/美术工具**：照相馆 CSS、图库/UI 模块、图标、相关测试、素材、`game/dev/` 和 NAI 工具均有改动。`PHOTO-STUDIO-ART-ACCEPTANCE-2026-09-23.md` 明确记录最新响应式、文案和动效修改仍待统一真实页面验收。
- **验证边界**：结算恢复证据和缺口见 `settlement-recovery-plan-2026-09-23.md`；历史可靠性记录见 `reliability-plan-2026-09-23.md`。已提交恢复工作通过不代表其他当前未提交改动通过。
- 本次 P2 只改文档，未运行测试、构建或浏览器流程；当前未提交游戏改动的整体验证状态仍未核验。
- 安全接手动作：先核对并行任务/文件所有权与老板最新指示，再选定一组改动；不要清理、回滚、提交或推送这些未提交内容。

## 1. 历史工作区未提交改动盘点（2026-09-20；已过期）

以下内容仅保留作历史记录，不代表当前文件清单、负责人或验收状态。

当时的 `git status` 为 11 个已跟踪文件修改 + 一批 untracked。这些是多会话并行任务的历史盘点；各项测试与实机状态以各行说明为准（并非全部通过）。清单已过期，当前去留须重新核对。

| # | 涉及文件 | 归属任务 | 状态 |
| --- | --- | --- | --- |
| 1 | `src/combat.js` `src/effect-steps.js` `src/battle.core.js` `src/battle.view.js`（部分） | **闪避语义重做**：老板定版「闪避=免疫下一次攻击，非减伤」。dealDamage 拦截仅 ATTACK 类型、playerTakeHit parry 演出（音效+浮字+log 剩余层数）、回合末过期 | 落码+测试绿；**实机演出未走查**（进战斗打「闪避」卡 tt3sp-dodge，或调试面板发卡验浮字/音效） |
| 2 | `src/term-tips.js`（新，untracked）`src/cards.view.js` `src/battle.view.js` `src/main.js` `css/overlays.css` | **特殊词条触摸讲解浮框**：24 词条表（诅咒/祝福/形态/机制词/词缀），descRich 输出 `data-term`，按下即显松手收，点词条拦 click | 全量落码+实机验证通过，**待老板验收** |
| 3 | `data/cards-sync.json`（v32→v33）`src/cards.js`（TT10/TT11 快照对齐）`tests/cards-sync-snapshot-guard.test.js`（新守卫，**非临时文件**）`docs/game-compendium.md` | **卡库防退回三件套**：09-20 TT11 重播实测把受缚之残影退回邪渊主宰。v33 补 tt6-goldhammer「满电动力锤」整卡 + TT10/TT11 内联快照按 sync 定版对齐 + 守卫测试钉死「改 sync 定版必须同步快照」 | 落码+守卫在；随本套整体提交 |
| 4 | `data/card-notes.json`（268 行→5 行骨架） | **备注底稿清空重来**（老板令）：弃 255 条惊悚乐园腔底稿，备注改走卡牌库内手写层（localStorage 优先+导出回填）；旧底稿在 commit fa949f5 可随时恢复 | tests/card-photo-notes 2 红灯=此任务预期归属，**不是坏测试** |

untracked 杂项：

- `game/assets/thumbs/scenes/scene-chest-*.webp` ×5：宝箱缩略图，775ca40 提交了原图但漏了 thumbs——**正确产物，保留**（换卡面必须重烘 thumbs 是铁律，见 §6）。
- `tests/_tmp-infuse-check/scan/view.test.js`：注能实机验证的排查残留，**待老板批准后删**。
- `tests/_tmp-l4flow.test.js`：过期临时（4e605d5 相关已定性），待批删。
- `搜打撤/.tmp-appinfo.txt`、`.tmp-build-test/`、`.tmp-proxies.json`：历史残留，待老板拍板（同名单还有 photo-nail 无引用图、martial-builtin-sha 死图白名单）。

Git 状态：`master` 领先 `origin/master` **8 个提交未推送**（最新 2dfec66）。换机器交接需老板拍板后 push；同机交接无碍。

## 2. 通用改动边界

当前协作、安全、验证范围和提交边界统一维护在仓库根 `AGENTS.md`；本交接不复制这些长期规则。

## 3. 验证入口

改动相关测试与全量检查的选择口径见根 `AGENTS.md`；本地质量门、卡牌审计和内置浏览器验收要点见 `quality-gates.md`。当前基线结果见上方速览和 `reliability-plan-2026-09-23.md`。

## 4. 卡牌与战斗规则

玩家规则见 `rules.md`；模块与卡牌历史数据约束见 `architecture.md`；卡牌文本语义见 `terminology.md`；生成的卡牌/敌人数据见 `game-compendium.md`（勿手改）。卡牌效果审计与对应测试见 `quality-gates.md`。

## 5. 界面实现与性能

界面坐标、输入、遮罩和图片挂载约定见 `development.md`；样式级联来源见 `architecture.md`；动画与空闲性能约定见 `performance.md`。

## 6. 美术与素材

当前 NAI 提示词公共风格以 `搜打撤/tools/nai_style.py` 为准，角色外观锚点见 `docs/character-bible/`。NAI API 与素材落地流程参考仓库根 `NovelAI生图功能手册-AI接手版.md`；其内按日期记录的旧风格示例不得覆盖当前公共风格模块。卡面覆盖审计是带日期的状态记录，不当作当前覆盖真源。

## 7. 历史待拍板 / 验收清单（截至 09-20；逐项核对是否仍有效）

1. §1 四套未提交改动的去留与提交时机；master ahead 8 是否推送。
2. 闪避重做实机演出走查；term-tips 浮框验收（§1#1/#2）。
3. 备注体系：手写层机制已在，是否要重出全量底稿待拍板（§1#4）。
4. 鸿门宴茶会群像 v4（seed 155420775）验收——白塔刺杀动作三版未吃到+黑像发色回退残留，建议锁 seed 迭代；vibe 通道 500 不可用。
5. 战斗立绘重出 v3 验收（星月脸重钉/白塔去法阵/无单剑/黑像拄剑/站姿系）；「无」832×1216 战斗立绘新出待验收。
6. 受缚之残影专属卡面：两张 NAI 候选待老板挑（seal-side 命中率高），验收后挂 heroCardArt+烘 thumbs。
7. UI 图标统一方案：60 枚仅 34 独立（12 组复制）重绘全套，预览在 .tmp 待批准；icon-forge.py 可再生。
8. 关卡审查：龙巢 S3/S4 与中优项；卡库审计 09-17 三发现（sync carried 失效/充能火山被覆盖/石榴弹珠随机池）；五层敌人重做方案；商店重复率。
9. 7 岗位迭代评审：5 项待老板拍板 + Wave1-4 实装顺序（`docs/multi-agent-review-changelog-2026-09-20.md`）。
10. UI 走查遗留 U2/U3/U11 未点名未做；杂项待批删清单（§1 untracked 部分）。

## 8. 资源指针

- **当前必需来源**：本次对话指令、仓库根 `AGENTS.md`、当前源码和主题文档。Codex 记忆若由运行环境提供，只作补充；不能替代仓库现状或当前指令，也不作为接手前置条件。
- **首页留言箱（补充任务线索）**：按老板此前要求，接手新任务时尝试核对游戏首页留言；它保存在原浏览器的本地存储，通常只有同机 Edge 会话可读。若当前环境无法访问，不要声称已检查，也不因此阻断无关工作；只有范围依赖留言内容时再请老板转发。
- **可选只读背景**：`搜打撤/.tmp/sts2-reverse`（若本机存在）用于相关战斗机制对照；`SoudacheGodot/_planning/` 是已冻结版本的历史设计资料，仅在问题明确涉及旧方案时查阅。两者均非 Vite 接手前置条件。
## 当前状态补充：塔2战斗反馈对照与实机复核（2026-09-24 09:47 +08:00）

- HEAD `b1de402`；相对本地 `origin/master` ahead 0 / behind 0（未联网刷新远端）。本批战斗反馈、交互和音效改动仍未提交，详见 `docs/sts2-combat-delta-2026-09-24.md`；未提交的 `game/css/winter.css`、`game/index.html`、`game/src/game.boot.js`、`game/src/hub/game.cardslib.js`、`game/.sdt-shots-upgrade/` 等现场改动未覆盖或清理，归属与整体验收未核实。
- 为在持有测试卡的当前局直接进入 Boss 战，修复 `game/src/hub/game.notes.js:203-206` 开发者侧栏父面板显隐。Vite 独立站点 `localhost:52791` 标题显示“暂无档案”，开发模式下侧栏「强制遭遇战 / 强制BOSS战」实机可见并可进入；测试卡仅发到该端口测试局。
- Codex 内置浏览器实机：普通遭遇战「流星箭雨」两段各 3 点并转向第二敌人；Boss 战 1× 页面采样到 `44/50 → 41/50 → 38/50` 与 `-3 → -3|-3` 两拍飘字、受击状态/特效；2× 再打该牌时出现两条 `-3` 飘字、Boss `50/50 → 44/50`。10 点「惩击」命中时 `44/50 → 34/50` 与 `-10` 飘字、受击特效。浏览器控制台无 error。定向 Vitest 11 文件、63 项通过，相关 `git diff --check` 通过；未跑全量测试或构建。
- 仍未完成：整张卡的内部 HP/击杀钩子逐击 await、2× 两拍间隔的直接计时、100ms 全屏顿帧直接测量、终结一击、音效听感、敌方真实序列帧打断。测试 Vite 服务已停止。

## 当前状态补充：塔2战斗逐击交互代码提交（2026-09-24 11:26 +08:00）

- 本段随战斗代码提交；提交前 HEAD `b1de402`，相对本地 `origin/master` ahead 0 / behind 0。提交标识以本段所属提交的实时 `git log -1` 为准；提交后预计 ahead 1 / behind 0，未联网刷新远端，未推送。
- 本批只收编 `game/src/battle/` 下 15 个战斗文件、`game/css/battle.css`、`game/src/audio/sound.js` 与 `sound.policy.js`、`game/css/winter.css` 中死亡演出的单个 hunk、开发战斗入口 `game/src/hub/game.notes.js`、`tests/battle-presentation.test.js` 和两份战斗文档。完整清单以本提交 `git show --stat` 为准。`winter.css` 的照相馆 hunk 及其他页面、卡库、截图现场保留未提交。
- 继上一节的分拍页面验证后，代码又接入可取消的逐击生成器和反馈等待，覆盖卡牌、部分衍生伤害、敌方逐击行动及目标交互收尾。具体完成范围和同步例外见 `docs/sts2-combat-delta-2026-09-24.md` 的“后续代码进展”。本批后续修改依老板要求未运行测试、构建或浏览器走查；上一节的 11 文件 / 63 项及页面采样只是早期快照，不作为新增代码验收。

## 当前状态补充：剩余界面改动与走查截图收编（2026-09-24 11:34 +08:00）

- 老板指示将上一轮盘点的剩余工作区内容全部提交。本段随该提交入库；提交前 HEAD `2dc7f3c`，相对本地 `origin/master` ahead 1 / behind 0；提交标识以本段所属提交的实时 `git log -1` 为准，提交后预计 ahead 2 / behind 0，未联网刷新远端，未推送。
- 收编 `game/css/winter.css` 的照相馆相框样式、`game/index.html` 的已跟踪 `lab-ending.css` 引用、`game/src/game.boot.js` 与 `game/src/hub/game.cardslib.js` 的少量代码整理，以及 `game/.sdt-shots-upgrade/` 的 9 张走查截图。提交前暂存区为空，工作区除这些路径外无其他改动；提交后以实时 `git status --short` 复核。
- 本批依老板此前指示未运行测试、构建或新的页面验收。截图是已有走查产物，不代表此次代码已有新的实机验收。

## 当前状态补充：六路战斗代码改进（2026-09-24 11:54 +08:00）

- 当前 HEAD `66ecb57`；相对本地 `origin/master` ahead 2 / behind 0，未联网刷新远端，未推送。此前剩余界面改动及 9 张截图已在该提交入库；其后的战斗代码是本段记录的**新未提交改动**。
- 6 位 GPT-6 Luna 子代理分工处理回合自动效果、统一演出时钟、攻击 cue 生产/消费和目标会话；本会话整合敌方行动间隔到共享等待，并检查接口衔接。工作区新改动仅在 `game/src/battle/`（10 个已跟踪文件修改、3 个新文件）及本交接/塔2差距文档；具体范围、同步例外与实现边界见 `docs/sts2-combat-delta-2026-09-24.md` 的“并行代码切片”。
- 依老板要求，**未运行测试、构建或浏览器走查**；子代理仅对部分文件做静态语法/差异格式检查。不能将上一批 11 文件 / 63 项或 Boss 页面采样作为这批未提交代码的验收证据。未提交、未推送；接手前重查 `git status --short` 与 `git log -1`。

## 当前状态补充：六路战斗代码提交（2026-09-24 12:05 +08:00）

- 老板授权确认无明显问题后提交。提交前 HEAD `66ecb57`，相对本地 `origin/master` ahead 2 / behind 0；本段随本批提交入库，提交标识以实时 `git log -1` 为准，提交后预计 ahead 3 / behind 0。未联网刷新远端，未推送。
- 本批范围为 `game/src/battle/` 的 10 个已跟踪文件改动、3 个新增模块（`battle.clock.js`、`battle.attack-cues.js`、`battle.target-session.js`）及本交接/塔2差距文档。提交前静态审查补正了 2× 抛体轨迹、CSS 反馈清理时长、首击动作重复起播，以及回合初延迟伤害清场后的胜利收尾；详情见 `docs/sts2-combat-delta-2026-09-24.md` 的“并行切片提交补记”。
- 依老板此前要求，本批未运行测试、构建或浏览器走查；`node --check` 覆盖 13 个战斗 JS 文件、`git diff --check` 通过（仅 LF/CRLF 提示）。此前 11 文件 / 63 项和 Boss 页面采样不覆盖本批。实际逐击、顿帧、音效与取消边界仍待实机确认。

## 当前状态补充：标题页制作坊图标入口移除（2026-09-24 12:15 +08:00）

- 老板明确要求移除制作坊图标入口。当前 HEAD `a85b857`，相对本地 `origin/master` ahead 3 / behind 0（未联网刷新远端），未推送。本批仅改 `game/index.html` 的标题页 `btnCardDesigner` 按钮和 `game/src/game.boot.js` 对应点击绑定；本记录随代码保留在工作区，尚未提交。制作坊页面、卡牌库内部入口和调试调用未改。
- 当前默认尺寸内置浏览器 `http://127.0.0.1:5173/` 实际看到制作坊图标消失，照相馆、成就、设置和开始探索入口仍显示。页面同时提示“游戏加载失败”；控制台错误为 `CardRulesValidationError: tt12-firecracker rules.battle.target.area/side`，栈指向 `game/src/cards/cards.js` / `cards.sync.js`，本批未改这些文件。因此本次只确认标题页入口外观，不能称整页或游戏流程通过验收。未运行测试或构建。

## 当前状态补充：对敌卡拖拽改为近敌瞄准（2026-09-24 12:26 +08:00）

- 老板要求对敌卡在战场自由跟手，仅靠近敌人时切为箭头瞄准；拖离敌人恢复跟手，空处松手回手牌。当前 HEAD 仍为 `a85b857`，相对本地 `origin/master` ahead 3 / behind 0（未联网刷新远端），未推送。此改动和上一节制作坊入口改动均未提交。
- 本批改 `game/src/battle/battle.aim.js` 与 `game/css/battle.css`：以存活敌人的立绘矩形及附近范围判定瞄准（进入 72px、退出 108px），选中目标仍经过目标会话存活校验；松手在附近打出，远离回手；拖动时停用 CSS transform 过渡，松手恢复手牌弹簧过渡；拖空后的合成 click 不再误触发选牌。自指向卡、无目标卡、药水及背包砸击保留既有出牌路径。
- 当前未提交路径：`game/index.html`、`game/src/game.boot.js`、`game/src/battle/battle.aim.js`、`game/css/battle.css`、本交接文档。依老板当前口径未运行测试或构建；这次拖拽交互未做实机页面验收，`127.0.0.1:5173` 页面现有卡牌规则加载错误仍需另行处理。

## 当前状态补充：卡牌跟手物理节奏（2026-09-24 12:33 +08:00）

- 老板指出拖动时卡牌追得太快。`battle.aim.js` 之前每次 `pointermove` 固定推进 16ms，随后 rAF 又按帧时间推进，导致跟手速度受鼠标事件频率影响；本批改为两个入口共用真实时间戳，只累计一次实际经过的时间。
- 跟手位置改用保存速度的临界阻尼弹簧，自由拖动比旧指数追随慢，停靠仍稍快；拖拽与近敌瞄准间切换时保留位置和速度。当前 HEAD、远端差异和未提交路径同上一节；未提交、未推送。`node --check game/src/battle/battle.aim.js` 与 `git diff --check` 通过（仅 LF/CRLF 提示）；依老板口径未运行测试、构建或新的实机走查。

## 当前状态补充：制作坊入口与卡牌拖拽提交（2026-09-24 12:39 +08:00）

- 老板授权提交本轮改动。提交前 HEAD `a85b857`，相对本地 `origin/master` ahead 3 / behind 0；本段随提交入库，提交标识以实时 `git log -1` 为准。未联网刷新远端，未推送。
- 精确提交路径：`game/index.html`、`game/src/game.boot.js`、`game/src/battle/battle.aim.js`、`game/css/battle.css` 与本交接文档。另有并行任务的未跟踪 `docs/previews/wu-card-art-versions-2026-09-24/`（50 张 WebP），归属本批之外，保持未暂存。
- 本批依老板口径未运行测试、构建或新的战斗页面验收；仅 `node --check` 与 `git diff --check` 通过。标题页入口外观证据和浏览器加载错误见 12:15 节，不能代替战斗拖拽实机验收。

## 当前状态补充：战斗中心模块拆分与拖牌重绘保持（2026-09-24 13:14 +08:00）

- 当前 HEAD `e9bf7a5`，相对本地 `origin/master` ahead 6 / behind 0（未联网刷新远端）；本批战斗代码未提交、未推送。并行美术与照相馆改动已另行提交；未跟踪 `docs/previews/wu-card-art-versions-2026-09-24/` 属其他任务，本批未触碰。
- 3 个并行子代理分别修快照缓存、拖牌重绘、执行会话/动作调度；本会话接合 `battle.engine.js` 并抽出 `battle.staged-playback.js`。本批精确代码路径：修改 `game/src/battle/battle.aim.js`、`battle.core.js`、`battle.engine.js`、`battle.snapshot.js`、`battle.view.js`；新增 `battle.action-runner.js`、`battle.execution-session.js`、`battle.staged-playback.js`。动作队列、逐拍等待与取消边界脱离中心文件，旧战斗异步收尾由 generation 拦截。中心文件仍承载规则、装备、战斗入口、背包及选择流程，未完成全域拆分。
- 快照签名现覆盖同一份视图输入的逐值变化，补入阶段、队列长度、友军状态、`viewingDeck` 与装备卡面；装备开战闪卡按战斗 token 只播一次。拖牌时常驻 overlay 接管指针捕获；安全重绘保持卡牌，刷新目标和费用，手牌 UID/槽位布局变化或阶段变化则取消。静态复核补正了检查点恢复前取消旧动作、首脑死亡后截断余句、同名叠牌代表切换及取消后的合成 click 边界。
- 本批 8 个战斗 JS 文件 `node --check` 通过，已跟踪战斗文件 `git diff --check` 通过（仅 LF/CRLF 提示）。依老板当前要求未运行测试、构建或浏览器走查；拖动手感、开战装备闪卡、逐击与重开终局仍需实机确认。此前测试与页面证据不覆盖本批。

## 当前状态补充：存量红修复 + 拆分补完（2026-09-24 15:05 +08:00）

- 当前 HEAD `e9bf7a5`，相对本地 `origin/master` ahead 6 / behind 0（未联网刷新远端）；本批未提交、未推送。上一节（13:14）路径清单不全：同批还有修改 `battle.runtime.js`（退化为 7 行 `export *` 兼容壳）并新增 `battle.runtime.{session,piles,interaction,effects,presentation}.js` 与 `battle.selection-flow.js`。工作区另有并行任务改动（`game/css/page-cardslib.css`、`game/src/cards/cards.view.js`、`hub/game.cardslib.js` 等），本批未触碰。
- **基线鉴定**：全量测试 7 个失败（架构守卫 1、playthrough-bot 1、r3-0 3、tt3 1、tt7 1）在 HEAD `e9bf7a5` 同样红、逐条同断言（`git worktree` 于 `D:\素材\_wt-head-check` 跑基线证实）——元凶是 09-24 11:29 `2dc7f3c`（逐拍节奏）与 12:07 `a85b857`（逐击演出）两批提交时未跑测试，非 13:14 拆分批引入。
- **修复内容**：① `battle.frames.js` 的 `battle:end` 订阅改为 attach 接管立绘后惰性订阅——模块级常驻订阅会被事件总线计为「已有订阅者」，吞掉 `finish()` 对 `game.onBattleEnd` 的 0 订阅回退（审计 harness 依赖）；② `battle.engine.js` `play()` 只清「上一张卡」的指向槽，不再吞背包砸击/血毒双镖/道具点选态（R3-0「保留砍击选择态」契约）；③ `battle.aim.js` 改经 core 快照取 `battleState/foes`（视图禁直读运行时，守卫口径），3 处 `getTargets` 走 `getSnapshot().foes`；④ `scripts/architecture-graph.mjs` 守卫覆盖 runtime 全表面（壳+5 子文件）、白名单加入 selection-flow/equipment/bag/lifecycle；⑤ `tests/r3-0-command-guards.test.js` 两处效果断言改 `await settle()` 后检查（口径决策见下）。
- **口径决策（老板未答，按推荐执行、可否决）**：镖/砸击的逐击前摇演出（a85b857）保留，r3-0 三处「命令返回瞬间可见效果」的同步断言改为演出落定后检查；守卫语义逐条保留（死目标不改打、重复命令不二扣、能量不足不结算不吞态）。若老板改判「效果即时生效」，回退方向是把两命令的效果移出 staged 步进、测试不动。
- **拆分补完**：新增 `battle.equipment.js`（147 行，装备/主动技能/开战被动）、`battle.bag.js`（261 行，战斗背包/道具药水/砸击双镖命令）、`battle.lifecycle.js`（387 行，start/编组/restore/finish/flee）；均按 selection-flow 先例（runtime 活绑定直读 + `createBattleXxx` 工厂注入规则核件）。`battle.engine.js` 2267 → 1615 行，保留规则核（词条时点/出牌结算/命中/死亡/抽牌）与转发面（具名导出兼容 core/enemy-phase，一处未改）。规则核保留的依据是原文件头的强连通簇注释（回合循环互递归），继续外提需更大的注入面，收益低。
- **验证**：全量 `node node_modules/vitest/vitest.mjs run --no-file-parallelism` **814/814 全绿**（15:00）；全部触及 JS 文件 `node --check` 通过。构建与浏览器实机走查未做；拖动手感、开战装备闪卡、逐击与重开终局仍需实机确认（同 13:14 节遗留）。
- **现场待批**：基线鉴定用的 worktree `D:\素材\_wt-head-check`（含 node_modules 目录联接）与 `D:\素材\代号柒\.git` 的 worktree 注册记录，属临时验证产物，删除待老板批准。
- 老板 15:1x 授权收尾提交并推送，并指定并行会话改动一并由本会话入库：战斗批（本节内容）、卡牌库/远征图鉴批（09-24 口头定版的上下滚动+纸纹页头+法伤角标）、`docs/previews/wu-card-art-versions-2026-09-24/` 预览图批分 3 个提交。本段随战斗批入库，提交标识以实时 `git log -1` 为准；推送后 ahead 归零以 `git status` 为准。

## 当前状态补充：三子代理并行批——门禁/拆分/Lint（2026-09-24 16:40 +08:00）

- 老板 15:2x 指示「拆给子代理慢慢做」。三子代理按属地划线并行：A=门禁（`.githooks`/`package.json`/`scripts`）、B=战斗拆分（`game/src/battle`+架构守卫脚本）、C=lint（`eslint.config.js`/`game/src` 除 battle/`tests`），互不触碰、互不提交，Friday 集成验收后分组落库。
- **B 拆分批 `c387e62`**：新增 `battle.exec-play.js`（queueCardExecution+execPlay，21 件工厂注入），engine 1615→1438 行，具名导出面零变化；状态袋试点 presentation 域 set$ 外部调用 19→0、piles 56→19（域内聚合接口），core 包装改委托；新增 `docs/RUNTIME-BAG-THINNING-ROADMAP-2026-09-24.md`（interaction/effects/session 三域后续分批路线）。子代理实测 battle 定向 172/172、全量 814/814、守卫双零。
- **A 门禁批 `fee8a7b`**：`.githooks/pre-commit`——暂存命中 `game/src|game/data|tests` 即跑与 CI 逐字一致的全量 vitest，红灯阻断并列出失败用例名，其余改动秒过；绕过口 `--no-verify` / `SKIP_FULL_TESTS=1`；`scripts/setup-commit-gate.mjs` 已在本机写入 `core.hooksPath`（`.git/config` 本地配置不入库，新克隆需重跑一次）。红/绿/绕过/轻提交四段演示在临时 worktree 完成并已清理。本批之后 `6b3ba29`、`537fd29` 两次提交各经门禁实跑 814 全绿放行。
- **C lint 批 `537fd29`**：基线实测 115 error（battle 110+非 battle 5）→ 非 battle 归零，`eslint.config.js` 零改动无规则降级；死代码删除 2 处（`libPageWarmGeneration`、`openScene` 级联）、真修复 1 处（r5b 断言改用已解构绑定）、行内豁免 2 处带理由（selftest 正则锚定、rest 省略语义）。
- **`6b3ba29`**：C 的开工基线抓到 `battle.engine.js:276` no-undef `restoreConsumed`（Friday 15:00 拆分批漏留转发 shim，复原类卡牌文本结算会 ReferenceError，814 用例无该分支覆盖故此前全绿）——补一行转发后 engine no-undef 归零。**此前记忆「lint 基线 493」已过时**，现场基线即 115。
- **集成验收**：`node node_modules/vitest/vitest.mjs run --no-file-parallelism` **814/814 全绿（16:20，A+B+C+修复合体）**；`npm run lint` 总 148 全在 battle 域（开工 110，+39 属 `c387e62` 拆分产物的 unused）。
- **未完成/遗留**：① battle 域 lint 148 待后续独立批次（含 c387e62 增量清理）；② 状态袋打薄 interaction/effects/session 三域按路线图后续分批；③ C 顺带发现（按规未动手）：`finishScene`/`sceneState` 无外部调用者、`ui.js` 的 `sceneNext` 分支与对应 CSS 处于休眠态，清理待拍板；④ 构建与浏览器实机走查仍未做（拖动手感/开战装备闪卡/逐击/重开终局 实机确认同 13:14 节遗留）；⑤ 门禁对本仓既有其他 codex worktree 的提交同样生效（共享 `core.hooksPath`，命中时约 3.5 分钟）。
- 本段随本批文档提交入库，4 个代码提交（`c387e62`/`fee8a7b`/`6b3ba29`/`537fd29`）+ 本段推送状态以实时 `git log`/`git status` 为准。
