# 搜打撤（Vite 版）· AI 交接文档 · 2026-09-20

<!-- photo-studio-commit:start -->
## 当前状态补充：照相馆提交（复核于 2026-09-23 15:30 +08:00）

- 本段随 `feat: refine photo studio art and add reusable overhaul guide` 提交。HEAD身份以本段所属提交为准；提交基线为 `d32a7d6`，入库后相对本地 `origin/master` ahead 39 / behind 0，未联网刷新远端。
- 本对话入库范围：照相馆布局/分级边框/彩色夹子/纸纹与阴影、照片专属大图和收回逻辑、同封面的左上退出键、相关定向测试、两张开发对照页、照相馆美术资产与记录，以及可迁移的完整 `docs/ui-art-overhaul/` 技能指南。
- `game.cardslib.js` 中独立的伤害/攻击词条修改不纳入本次；战斗/卡牌效果、其他卡面与缩略图、映射清单、NAI工具、全局图标、其他文档和根AGENTS改动均保留未提交。共享交接文档只暂存本补充段，其他任务记录保持工作区原样。
- 验证边界：此前相关5文件39项通过；老板接管验收后的素材、相纸和退出键更新未重新运行游戏测试/浏览器。本次同步测试的退出按钮定位，未执行该测试。指南结构/内部链接已检查；入库不代表完整美术验收通过。
- 此前资源故障为5173服务停止，后台Vite已恢复；验收页、面板PNG、代表照片WebP曾在本轮HTTP读取返回200。服务与工作区均会变化，接手时重查实际状态。

<!-- photo-studio-commit:end -->

> 老板 2026-09-20 指令：项目转交其他 AI 继续。本文写给接手的 AI，力求自包含；
> 同机 ZCode 的 AI 额外可读记忆库（见 §8）。上一版交接 `NEXT-AI-HANDOFF-2026-09-12.md`
> 是 09-12 冬日远征改造暂停点，其 P0/P1 大多已消化，仅作背景，以本文为准。
> 接手第一件事：读完 §1（工作区有未提交的多套半成品），并与老板逐套确认去留，再动手。

## 0. 项目速览

- 项目：**搜打撤**（仓库名「代号柒」，GitHub: taping233/OperationSalvation7）—— roguelike 卡牌网页游戏（杀戮尖塔式战斗 + 撤离玩法），中文，美术为动漫立绘+卡面。
- **唯一主线 = Vite 版**（源码 `D:\素材\代号柒\搜打撤\game`，全局对象 `window.SDT`，事件走 ink）。Godot / Unity / SoudacheGodot / SoudacheUnity 全部冻结，不开发、不清理、不当事故报。
- 桌面版（exe）已停维护（09-13 老板令），验证一律 Vite dev + vitest。
- 老板 = 王俊豪。默认中文交流，称呼「老板」；Friday 是移交前的 AI 协调者名字。
- 关键文档目录 `搜打撤/docs/`：`architecture.md`（架构）、`development.md`（开发）、`rules.md`、`design.md`、`terminology.md`（术语）、`game-compendium.md`（全书卡牌/敌人数据出处，**勿手改**，`npm run docs:compendium` 再生成）、`roadmap.md`、`changelog.md`、`character-bible/`（五角色人设权威，出图锚点照抄）、`save-format.md`、`multi-agent-review-changelog-2026-09-20.md`（7 岗位评审终案+实装顺序）。

## 1. ⚠️ 工作区未提交改动盘点（2026-09-20，接手必读）

`git status`：11 个已跟踪文件修改 + 一批 untracked。这些是**多会话并行的任务半成品**，全部测试绿/实机验证过，只是未到提交点或等老板验收。**规矩：绝不 `git checkout`/`clean`/顺手提交；每套的去留由老板拍板。**

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

## 2. 老板工作方式铁律（违反会被纠正，别试）

- 用户级指令 `C:\Users\太平\.zcode\AGENTS.md` + 项目级 `D:\素材\代号柒\AGENTS.md` 先读。
- **不确定就问，多问别猜**（AskUserQuestion）；能从文件/日志/代码查证的先查证，只有老板决策项才问。
- **没要求的不写；只改被要求的部分**。顺带发现的问题只报告不动手（含重构、格式化、顺手修复）。
- **删除必先报批**：任何删除先列清单报老板批准，绝不与改动命令捆绑。git checkout HEAD -- 可救误删。
- **快速交付**：压缩测试验证，构建通过即交付，老板亲自过目；快 ≠ 少确认。
- 默认**不用子 agent**（老板点名才用）。
- 结论必须绑定具体路径/日志/哈希/验证结果；不做凭空规划。
- **并行会话协调**：老板常开多个 AI 会话并行。文件所有权划线、热点文件串行、收尾即落库、**树上别人半成品在场绝不 build/提交**。接手任务前先读首页留言信箱里老板的建议。
- Windows 中文路径+编码坑：`PYTHONIOENCODING=utf-8`；node 会静默死、rmSync 删不掉、ps1 无 BOM 被 GBK 读、MSYS 命令假阴性——文件存在性以 python isfile 为准。

## 3. 验证 / 测试口径

- 起服：`npm run dev`（Vite；默认 5173 起，僵尸端口直接换）。**python http.server 直出源码必死**。测产物用 build + 8139/preview。
- 测试：`npx vitest run`（**全量必须加 `--no-file-parallelism`**）；`node game/selftest.js`；`node scripts/validate-data.mjs`。
- 已知 flake 别当改坏：药水/mana-surge 抖动、nest 负载 flake（复跑 3 次再定性）。红灯先归因：并行会话在途、已知预期红灯（当前在案：card-photo-notes 2 红=§1#4）。
- 实机验证用内置浏览器（IAB）拉 localhost，禁 computer-use。IAB 坑合集：locator 点击失效→evaluate 合成事件；截图全黑→先 finish 动画；boot 预热期 state=boot 可超 60s 先轮询；build 触发 HMR 重载会杀测试序列；webview 反复脱挂→整流程压缩进单次 evaluate；页面跑旧 bundle 先怀疑缓存。
- 实机进战斗必须走真实开局流程（devForceBattle 新会话会拒：「还没有随身卡牌」）。开发者测试面板：标题页 `#titleDev` 一键跳 9 类节点（构造性测节点入口，只在标题页可点是设计如此）。
- 战斗日志在 DOM `#log`，没有 `game.logs`。

## 4. 卡牌库铁律（最容易踩雷的域）

- `game/data/cards-sync.json` 由 `scripts/sync-cards-from-live.mjs` 生成**勿手改**；改 desc 必须 version+1；删卡=移进 retire 名单+version+1；**cards.js 新增卡不进 sync 数组 = 老档永久缺失**（禁咒/满电动力锤两次实锤）。
- cards.js 内 TT10/TT11 内联快照与 sync 定版必须同步改，`tests/cards-sync-snapshot-guard.test.js` 守卫红灯（09-20 退回事故，见 §1#3）。
- `effect-steps.js` 步骤表顺序即语义**别重排**；识别面 fixtures 冻结在 tests/fixtures，改表先跑差分。
- 卡库定版基准：微信版 233 张定版 + 后续批次；同名双版并存是定版不是 bug。稀有度口径：衍生/初始/职业不进随机、发现、商店池。
- 同一选择面板内不许重复卡（面板去重口径）；商店货架 25.6% 重复率是已知待点名项。
- 全量卡牌数据出处查 `docs/game-compendium.md`。

## 5. UI / 前端铁律

- **全局 UI 缩放**：ui-scale.js zoom 挂 `<html>`，基准 1920×1080 完全跟随。新坐标代码必须过 uiRect()；`position:fixed` 元素坐标 = getBoundingClientRect() / scale。
- **title 全局死刑**：boot MutationObserver 移除一切 `title` 属性——提示一律自绘文字浮层（药水提示栏/term-tip 是定版先例）。
- **overlay 输入框**：handler 里不许整页 render() 重建（IME 中文组合必被掐断，2dfec66）；Esc 分支必须判 `isComposing`。
- **inert 隔离**：`_isolateOverlayBackground` 会把 #overlay 兄弟层 inert 化（Chrome 下对 hit-test 隐身）；**新增常驻层必须加进排除名单**（#sugLayer 先例，fc2aef5）。
- 大图挂载后调 `SDT.Art.decodeIn(el)`，否则 IAB 合成器画黑窗（showCardZoom/池页/战斗手牌三次同源坑）。
- 性能三铁律：不出画面的动画即暂停；常驻动画只走 transform/opacity 合成器；idle 预热。
- 事件页排版单一真源=expedition-rewards 样式；样式级联真源表与 CSS 孤儿口径见记忆。

## 6. 美术 / NAI 出图管线

- **画风权威口径：painterly v1.0 全游戏统一**；立绘画师串 = miv4t + quasarcake（卡通版不挂）。提示词按 nai5-prompting skill 写； anatomical/prompt 坑合集见记忆。
- 人设权威 = `docs/character-bible/`，出图锚点照抄（0919 细粒度定稿）；星月已解绑星灯道具（c4cdf8b）。
- **卡面出图铁律**：职业卡必须体现本人形象；黑球/黑雾=诅咒系专属意象，火球=火球系专属，不可混用。
- 卡面规格 1.32 横版（角色脸必须可见）；道具透明图走色距抠底+WebP exact 保 alpha（员工通行证A 先例）；**同名不同 id 双覆盖**（材料版+衍生产物版都要挂图）。
- **新增/换卡面必须重跑 thumbs 烘焙**（thumbs 不进 art-manifest）；`art.js` 是唯一路径构造点，守卫测试 card-art-coverage 双层红灯；LANDMARK_ART 支持 hero 族条目。
- NAI 链路：唯一稳定通道 = curl 子进程 `--noproxy --ssl-no-revoke`；image 子域 TUN 被掐走 `socks5h://7890`；**一轮一张 ≥45s，429 停 15 分钟，403 立即停手上报**；出图产物直接给老板看，不自检。Clash 保持 rule 模式，不切节点（尤其不切香港）。
- 项目根 `NovelAI生图功能手册-AI接手版.md` 是生图接手手册。出图脚本/seed 台账在 `搜打撤/.tmp/nai/`。

## 7. 等老板拍板 / 验收清单（截至 09-20，接手后逐项对齐，别自作主张）

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

- **ZCode 记忆库（同机接手必读）**：`C:\Users\太平\.zcode\cli\memories\projects\project-9f3e184c77472436\memory\`——95 个记忆文件 + `MEMORY.md` 索引（每次会话自动加载）。坑/铁律/验收状态都在里面，本文只是摘要。
- 用户级指令：`C:\Users\太平\.zcode\AGENTS.md`（老板背景+基本原则）；旧 Codex 记忆 `~/.zcode/memories/`。
- 首页留言信箱：老板在游戏首页留言布置任务，网页版存于 Edge localStorage（读法见记忆 soudache-suggestions-inbox）——**接手任务前先读**。
- STS2 逆向参考：80 万行官方 C# 在 `搜打撤/.tmp/sts2-reverse`（战斗机制对标源）。
- Godot 事实源：`SoudacheGodot/_planning/`（冻结，仅查阅）。
- 设计者回传合并口径与 v0.56.1 取舍见记忆 soudache-designer-v0561-merge；全量测试的 CRLF 假差、裸 sha1 坑也在该条。

## 9. 禁止事项速查

- 不动 Godot/Unity/SoudacheGodot 工作区；不打包 exe；不维护桌面版。
- 不删任何东西（含 untracked、_tmp、死代码）未经老板批准。
- 未经老板拍板不 push、不提交他人会话的半成品、不重排 main.js boot 导入。
- 不切代理节点；不对外发布任何内容；不把「生成成功」当验收成功（美术/实机都以老板过目为准）。
