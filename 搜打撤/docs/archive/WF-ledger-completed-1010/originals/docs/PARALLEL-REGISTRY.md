# 并行会话热点登记（PARALLEL-REGISTRY）

> **规则（09-29 起；10-01 精简：动作先行）**：
> 1. 会话改**共享文件**（AGENTS.md / docs 公共文档 / MEMORY.md / 其他会话热点）或开**长任务**（工作树 / 端口服务 / 后台进程）：动作先行，登记行同轮紧随补齐——不缺席、不阻塞启动（10-01 老板拍板）；登记表或 `npm run handoff` 显示他人活跃占用同一属地时，先协调再动手。收官/释放后把行移入「近期已释放」。单会话活跃（`npm run handoff` 占用仅本会话）时小额共享台账修改可直接编辑+收官核对，免登记免两段式。
> 2. 发现**无主改动/文件**（归属不明的 M 文件、陌生未跟踪产物）登记到「无主物品」，**只记录勿动**，等认领或老板处置；认领者把行移入活跃登记。
> 3. 本文件是占用登记的唯一真源；记忆只放指针。状态用「编辑中 / 待验收 / 完成未提交 / 已交付」；完成未提交必须列路径、归属和证据，编辑结束不等于提交获批，其他会话不能覆盖未提交内容。
> 4. 服务登记工作目录/端口/PID/创建会话；收官只停本会话创建且身份确认的服务。完成事项移至已释放，工作树等仍需处置的资源保留登记。日期/PID 是记录时点，使用前核实身份。

## 活跃登记
| Friday（Codex 圣光之源接手 WF-holy-source-v2-1010） | game/assets/{cards,thumbs/cards}/spell-tt7-livingwater.webp；game/data/art-mapping.json仅本卡revision；asset-manifest.json仅本卡两条/count；docs/evidence/2026-10-10-holy-source/；根.tmp/nai/output/holy-source-20261010/ | 沿用老板授权与v2提示词：NAI单张→内置宽笔重绘→本卡接入 | 10-10 | 编辑中；旧WF-holy-source-1010已释放，无新服务、不测试、不实页、不build、不提交 |
| Friday（Codex 存档转场执行 WF-archive-choreo-1010） | game/src/ui/{archive-motion,camp-entry,interface-motion}.js仅选档与初入基地；game/css/{archive-motion,camp-entry}.css；tests/archive-motion.test.js；docs/development.md动效说明；docs/evidence/2026-10-10-archive-choreo/；本表自有行 | 老板令执行已提方案：首页衔接、五卡分层展开、选中档案号承接基地；保留其他页面动效与业务流程 | 10-10 | 编辑中；复用5200/PID21616，无新服务、不build、不提交 |
| Friday（Codex 射线枪重绘 WF-raygun-1010） | game/assets/{cards,thumbs/cards}/equip-tt12-raygun.webp；game/data/art-mapping.json仅本卡revision；asset-manifest.json仅两条/count；docs/evidence/2026-10-10-raygun/request.json、receipt.json | 老板令射线枪宽笔块面重绘并接入；保留金黑枪身、蓝晶枪口与右上青色射线，内置ImageGen单张已接入 | 10-10 | 完成未提交、编辑释放；已看生成画作，未测试/实页/build，无新服务、不提交 |
| Friday（Codex 无连续受击 wu-hurt-v1-1010） | game/art-source/characters/wu-slim-sprites-20261010/continuous-hurt-v1/；docs/evidence/2026-10-10-wu-hurt-v1/；本表自有行 | 老板认可攻击v7后令制作受击；复用当前立绘与刚性剑，快速后撤/肩胸后仰/缓恢复；攻击v7只读 | 10-10 | 完成未提交、编辑释放；43帧/60fps受击后撤后仰缓恢复，刚性剑与攻击v7同源；301点剑长边界、导出端点/脚底/逐帧剑尖检查通过，当前Codex实页目检；候选未实装；复用5200，无新服务、不build、不提交 |
| Friday（Codex 奥术残卷重绘 WF-arcanescroll-1010） | game/assets/{cards,thumbs/cards}/equip-tt7-arcanescroll.webp；game/data/art-mapping.json仅本卡revision；asset-manifest.json仅两条/count；docs/evidence/2026-10-10-arcanescroll/request.json、receipt.json | 老板令按原构图宽笔块面重绘，保留竖卷、上下右向卷轴、青绿符文及上部法阵；内置ImageGen单张已接入 | 10-10 | 完成未提交、编辑释放；已看生成画作，未测试/实页/build，无新服务、不提交 |
| Friday（Codex 导航触碰变色 WF-nav-touch-1010） | game/css/navigation-feedback.css；game/css/archive-back.css仅导入/说明；docs/development.md；docs/evidence/2026-10-10-nav-touch/；本表自有行 | 老板认可成就返回键变色并授权推广前三类：返回/退出、地图帮助静音、弹窗关闭；石墨背景/白图标共用160ms反馈 | 10-10 | 完成未提交、编辑释放、待用户验收；未跑测试/实页，复用5200，无新服务、不build、不提交 |
| Friday（Codex 无刚性剑与变速残影 wu-attack-v7-1010） | game/art-source/characters/wu-slim-sprites-20261010/continuous-attack-v7/；docs/evidence/2026-10-10-wu-attack-v7/；本表自有行 | 老板反馈剑长仍不稳，要求变速与模糊残影；待机攻击共用独立剑层，重排时间曲线并加挥击模糊 | 10-10 | 完成未提交、编辑释放；待机/攻击同一刚性剑层、慢蓄力快斩缓收势及模糊残影；73帧/60fps、72不同帧，601点与新待机端点/脚底/73帧剑尖检查通过，当前Codex实页目检；候选未实装；复用5200，无新服务、不build、不提交 |
| Friday（Codex 成就点击黑边 WF-ach-edge-1010） | game/css/title-achievements.css仅滚动溢出；game/src/ui/achievement-gallery.js仅详情隔离/焦点；tests/achievement-gallery.test.js仅关闭入口及焦点回归；docs/evidence/2026-10-10-ach-motion/黑边修复记录；本表自有行 | 老板令实检迭代，反馈栏右侧黑边短暂出现；关闭横向溢出并稳定滚动槽，修复详情后台键盘可操作 | 10-10 | 完成未提交、编辑释放；8/8定向测试、当前内置窗口真实点击/关闭/Esc/焦点通过，复核未见黑边；原黑边帧未捕获、根因仍为推断；无新服务、不build、不提交 |
| Friday（Codex 无剑长与有效帧 wu-attack-v6-1010） | game/art-source/characters/wu-slim-sprites-20261010/continuous-attack-v6/；docs/evidence/2026-10-10-wu-attack-v6/；本表自有行 | 老板反馈剑长不稳、有效帧不足；修脚底覆盖裁剑，60fps补挥击过渡并减少重复停顿 | 10-10 | 完成未提交、编辑释放；脚底先绘再绘剑，收势无裁尖；67导出帧/60fps、65不同帧；601点剑长边界及逐帧剑尖像素/脚底首尾检查通过，当前Codex实页目检；候选未实装；复用5200，无新服务、不build、不提交 |
| Friday（Codex 无立绘攻击修复 wu-attack-v5-1010） | game/art-source/characters/wu-slim-sprites-20261010/continuous-attack-v5/；docs/evidence/2026-10-10-wu-attack-v5/；本表自有行 | 老板令执行目检修复：清理原剑残留，重做持剑臂姿势与遮挡，同待机立绘；改后当前窗口目检 | 10-10 | 完成未提交、编辑释放；原剑遮挡残片清理，抬肘与伸臂前挥/袖根遮挡重做；当前Codex实页关键帧与播放目检，301点剑长边界和31导出帧锚点检查通过；候选未实装，老板观感未确认；复用5200，无新服务、不build、不提交 |
| Friday（Codex 无立绘攻击快速稿 wu-attack-portrait-v4-1010） | game/art-source/characters/wu-slim-sprites-20261010/continuous-attack-v4/；本表自有行 | 老板指定继续用当前待机立绘，快速迭代攻击；同一脸服装长剑，短蓄力/快速斩击/收势 | 10-10 | 完成未提交、编辑释放；当前待机原图、0.8秒攻击、PNG导出；沿用老板免检查，由老板目检，未验收候选；复用5200，无新服务、不测试、不build、不提交 |
| Friday（Codex 无攻击快速稿 wu-attack-fast-v3-1010） | game/art-source/characters/wu-slim-sprites-20261010/continuous-attack-v3/；本表自有行 | 老板否决v2，令参考其他游戏快速迭代；复用昨日9部件只读，短蓄力/快速斩击/收势 | 10-10 | 完成未提交、编辑释放；复用昨日9部件做0.8秒斩击，附PNG导出；老板明确免检查，由老板目检，未验收候选；复用5200，无新服务、不测试、不build、不提交 |
| Friday（Codex 成就动效迭代 WF-ach-motion-1010） | game/src/ui/{page-motion-profiles,surface-motion,achievement-gallery,achievement-motion}.js仅成就方案及区域参数；game/css/title-achievements.css仅内部动效；docs/development.md；docs/evidence/2026-10-10-ach-motion/；本表自有行 | 老板续令自主迭代：奖章按行列成组入场，分类连点从高亮当前位置续行，详情徽章依点击方向进退，锁定奖章悬停克制；保留进度展开与总览呼吸光 | 10-10 | 实现完成未提交、编辑释放、待用户验收；沿用免验证，未跑测试/实页，无新服务、不build、不提交 |
| Friday（Codex 分页动效同步 WF-page-motion-1010） | game/src/ui/{page-motion-profiles,surface-motion,interface-motion}.js；docs/development.md；docs/evidence/2026-10-10-page-motion/；本表自有行 | 老板令逐页规划实施进入/退出动效；13类页面配置与通用进退曲线，基地切页只动内容；不编辑其他会话业务文件或照片放大流程 | 10-10 | 实现完成未提交、编辑释放、待用户验收；沿用免验证，未跑测试/实页，无新服务、不build、不提交 |
| Friday（Codex 退出键单一来源 WF-archive-back-source-1010） | game/css/archive-back.css；game/index.html仅btnHome；game/src/ui/game.menu.js仅选档class/说明；game/src/hub/game.hub.js仅返回class；game/css/{page-slot-select,base-camp,base-camp-compact,winter,page-expedition-hud}.css仅退出键旧规则；docs/development.md；docs/evidence/2026-10-10-archive-back/；本表自有行 | 老板令退出键尺寸和样式一个来源，地图也复用；保留离开对局流程 | 10-10 | 完成未提交、编辑释放、待用户验收；沿用免验证，未跑测试/实页，无新服务、不build、不提交 |
| Friday（Codex 选档基地返回键 WF-archive-back-1010） | game/css/archive-back.css；game/src/ui/game.menu.js仅样式导入；game/src/hub/game.hub.js仅返回键class；docs/evidence/2026-10-10-archive-back/；本表自有行 | 老板令统一选档与基地退出键位置/大小；共用64×58、left18/top16、24px图标，基地窄窗恢复按钮全局缩放 | 10-10 | 完成未提交、编辑释放、待用户验收；沿用免验证，未跑测试/实页；无新服务、不build、不提交 |
| Friday（Codex 选档进入基地 WF-camp-entry-1010） | game/src/ui/{camp-entry,interface-motion,game.menu}.js仅初入基地动效与选档交接；game/css/camp-entry.css；docs/development.md动效入口；docs/evidence/2026-10-10-camp-entry/；本表自有行 | 老板令参考优秀游戏重换进入存档和基地初次展现；续修入场后刷新：基地静止外壳改为常态规则，首次进入移除旧page-in标记 | 10-10 | 实现完成未提交、编辑释放、待用户验收；沿用老板免验证，未跑测试/实页；复用5200，无新服务、不build、不提交 |
| Friday（Codex 选档背景动态 WF-slot-motion-1010） | game/css/page-slot-select.css仅背景雪粒与雾光；docs/evidence/2026-10-10-slot-motion/；本表自有行 | 老板令选择存档背景加入动态元素；保留已有未提交返回键样式 | 10-10 | 完成未提交、编辑释放；老板明确免验证，动态效果未核验；复用5200，无新服务、不build、不提交 |
| Friday（Codex 无连续攻击接班 wu-continuous-attack-v2-1010） | game/art-source/characters/wu-slim-sprites-20261010/continuous-attack-v2/；docs/evidence/2026-10-10-wu-continuous-attack-v2/；本表自有行 | 老板令承接瘦一点右侧大腿对话，继续扩大攻击身体动幅；举剑→前挥→收回、小臂先动、同一人物剑长；旧continuous-attack只读保留 | 10-10 | 完成未提交、编辑释放；36攻击帧/24fps、72配套待机；241点几何与端点/脚底/停顿像素检查通过，当前Codex实页目检；独立预览未实装、受击死亡未重做；复用5200，无新服务、不build、不提交 |

| Friday（Codex 无连续待机 wu-continuous-idle-1010） | game/art-source/characters/wu-slim-sprites-20261010/continuous-idle/；docs/evidence/2026-10-10-wu-continuous-idle/；本表自有行 | 老板确定2倍待机；默认值及72导出帧同步更新 | 10-10 | 编辑中；头脸/腰线/脚底固定约束保留，无新服务、不build、不提交 |








| Friday（Codex 仓库放大界面 WF-stash-inspect-1010） | game/src/hub/game.hub.pages.js仅仓库footerHTML；game/css/base-camp.css仅camp-card-actions放大层；docs/evidence/2026-10-10-stash-inspect/；本表自有行 | 执行新留言：放大时卡外展示价格、缩小双按钮、重排查看界面 | 10-10 | 编辑中；保留第一款共用卡面与既有交易命令，无新服务、不build、不提交 |
















| Friday（Codex 无精致版四动作 wu-sprites-refined-1010） | game/art-source/characters/wu-sprites-refined-20261010/；docs/evidence/2026-10-10-wu-sprites-refined/；本表自有行 | 老板令重做无动画帧；以当前立绘保留精致度和身份，新基准及四动作单独制作 | 10-10 | 制作中；旧运行帧只读、不提交，无新服务 |



















| 会话/来源 | 属地（文件/端口/工作树） | 事项 | 登记时间 | 状态 |
|---|---|---|---|---|








| Friday（Codex 无动画实装 wu-sprite-install-1009） | game/src/battle/view/battle.frames.js；game/src/battle/view/battle.frame-catalog.js；game/src/battle/core/battle.presentation.js；game/src/battle/core/battle.lifecycle.js；game/assets/portraits/frames/wu/sprite-v1/；game/assets/asset-manifest.json仅对应条目；tests/battle-frames-lifecycle.test.js；另含新增定向测试；docs/evidence/2026-10-09-wu-sprite-install/；game/assets/README.md | 老板令实装认可待机/攻击/受击/死亡；固定画布锚点、死亡演出完成后进入结算 | 10-09 | 编辑中；复用5200，无新服务、不build、不提交 |











| Friday（Codex 本会话，基地统一美术 WF-base-camp-redo-1009） | game/src/hub/{game.hub.js,game.hub.pages.js,game.hub.depart.js}；game/src/run/game.run.altar.js 仅可取消出征选角/卡池作用域标记；game/css/base-camp{,-roster,-compact}.css；game/index.html 仅基地样式链；tests/hub-flow-regression.test.js；10-10追加 game/src/ui/interface-motion.js仅基地刷新分支、tests/surface-motion.test.js对应回归；docs/evidence/2026-10-09-base-camp-redo/；本表自有行；复用5200，无新服务 | 老板确认ZCode已停由Codex接手，基地统一美术；10-10续令修每次切页刷新黑屏：取消基地内整层遮罩/外壳重播，保留内容反馈与其他页面入场；不改全局转场时长/数值/存档 | 10-10 | 待验收；本轮切页黑屏修复完成未提交、编辑释放；原整体窄窗收尾见任务记录 |
| Friday（Codex 无简化动画重做 wu-simple-rig-v2-1009） | .tmp/imagegen/wu-simple-rig-v2-20261009/、wu-simple-rig-v3-20261009/；docs/evidence/2026-10-09-wu-simple-rig-v2/；本表自有行 | 老板反馈v2身体撕裂、攻击与受击不自然；改为闭合完整9件、两段持剑臂几何求解与短前刺，逐段复核；复用5200 | 10-09 | 编辑中；不碰旧22件会话、无新服务、不提交 |

| Friday（ZCode 银墨钴蓝美术 WF-ink-cobalt-1009） | 暂不占用任何源码；方案草稿与脚本在 .tmp/ink-cobalt（git 忽略）；本表自有行；复用 127.0.0.1:5200，无新服务 | 老板令「前端美术自由发挥，唯一风格例图=银发黑裙蓝缎带立绘」；已做一轮仅调色的实验（60 个 CSS）并全部回退，game/css 与实验前逐字节一致；等老板确认方案（含动效/卡牌/UI/配色/文字/排版）后再动手 | 10-09 | 方案待老板确认（暂停，无源码改动） |
| Friday（Codex 四层垂直切片 WF-four-layer-slice-1009） | game/src/run/expedition.view.js；tests/expedition-view.test.js；docs/evidence/2026-10-09-WF-four-layer-slice-1009/；本表自有行；127.0.0.1:5359 PID18660 exec60278 cwd搜打撤，本聊天创建 | 四层真实新档试玩；补第三层深入选择与第四层祭坛/首脑/通关状态指引；不build不提交 | 10-09 | 编辑中 |
| Friday（Codex 本会话网页版 WF-web-1009） | cwd 搜打撤；127.0.0.1:5200 / PID23664 / npm run web -- --skip-compile；本会话创建；日志 node_modules/.cache/web-up-5200.log | 老板令拉起网页版；入口与 PNG/WebP 资源探测通过；保留服务供老板使用 | 10-09 | 服务运行中；无源码修改、不提交 |
| Friday（ZCode 本会话网页版 WF-web-1009b） | cwd 搜打撤；127.0.0.1:5200 / PID21616 / npm run web / 本会话创建；日志 node_modules/.cache/web-up-5200.log | 老板令拉起网页版；入口与 PNG/WebP 探测通过 | 10-09 | 服务运行中（留老板用）；无源码修改、不提交 |
| Friday（Codex WF-art-reference-board 预览） | 5318/PID24680，工作目录搜打撤，exec会话59250；本表本行 | 参考板编辑已释放，六图实页加载已核对；Python静态服务保留供老板查看与选图 | 10-08 | 预览服务保留，待老板选图 |
| Friday（ZCode 本会话，招式词条与卡牌数值改版） | game/src/cards/cards.sync.m9.js；game/src/cards/card-rules.schema.js；game/src/cards/cards.sync.face-refresh.js；game/src/cards/cards.view.js、game/src/battle/core/battle.engine.js；game/src/battle/core/battle.core.js、game/src/battle/effects/effect-steps.m2.js、game/src/ui/term-tips.js、tests/m9-data.test.js；tests/battle-lifecycle.test.js；tests/hand-cost-patterns.test.js；tests/m8-data.test.js、已释放三份术语/矩阵/图鉴文档（10-09 老板确认文档占用结束；10-10老板授权WF-card-fixes-1010接手cards.data.js与cards-sync.json，保留既有改动；同日授权Codex接手cards.view.js与term-tips.js仅补潜行识别，WF-stealth-term-art-review-1010已完成，其余改版属地保留）、docs/evidence/2026-10-06-WF-move-term-cost/；本表本行 | 老板令：银河之旅改「所有招式（=武术+法术）1 费」并把招式立为词条；恶魔之力改 7 点法伤；定向测试 + 53xx 隔离副本实页验收 | 10-06 | 编辑中；不提交 |
| Friday（ZCode 本会话，仓库特写操作台改版+5200 服务修复） | game/src/hub/game.hub.pages.js、game/src/hub/game.hub.js、tests/home-async-lifecycle.test.js、tests/hub-flow-regression.test.js；docs/evidence/2026-10-06-WF-stash-card-view/；本表本行；Vite 127.0.0.1:5200 / PID15512 / npm run web / 本会话创建。修复记档：10-06 应老板令停掉 5200 双实例（22196=无登记他会话 strictPort 残留、24792=本会话 web-up），现仅单实例 | 老板二次反馈后废除旧 stash 弹窗：点卡=大卡特写操作台（卖出/收藏/使用/孵化全在页脚、armOrRun 就地二次确认、动作后页脚就地刷新、按卡名重读堆防串位）；44 项定向测试绿；实页全链路已验：看卡/收藏保护与解禁/就地确认卖出落账/全部卖出 ×n/堆空自动收特写（截图 r4/r5）。引导失败根因=删除函数后导出列表残留 openStashItem（模块求值即炸、页面静默全死），移除后恢复；「IAB 模块通道卡死」系测试路径用错（/game/src/* 应回退）造成的误判，内置浏览器无恙 | 10-06 | 待老板验收；不提交 |
| Friday（Codex 场景BGM补全 WF-music-missing-bgm） | docs/evidence/2026-10-05-WF-music-missing-bgm/；.tmp/music-workstation/missing-bgm/；本表自有行 | 老板令按已确认双手/连贯标准生成全部缺失场景BGM，自由配器独立旋律；核定11首：基地/商店/营火/事件/祭坛/撤离/3首脑/成功/失败 | 10-05 | 创作中；只生成候选和覆盖清单，旧曲及游戏只读，无服务，不提交 |
| Friday（Codex 壁纸预览服务 WF-wallpaper-view） | 127.0.0.1:5200/PID26752；cwd搜打撤；创建聊天01a10bd8-f1cd-7b13-b6fa-fd8cbef66018 | 壁纸代码编辑已完成释放；本轮实核5200仍由该PID监听，非打包会话创建，保留服务 | 10-05 | 服务运行中；代码完成项已移已释放，未停止他会话服务 |
| Friday（Codex 无部件长期任务 WF-wu-parts-full） | game/art-source/characters/wu-parts-v1/；docs/evidence/2026-10-05-WF-wu-parts-full/；本表自有行；独立Vite 127.0.0.1:5348，PID见证据preview.pid，本聊天创建（旧10028退出后已恢复） | 老板明确授权长期自主生成22件、拼装检验并按缺陷重画；持续Goal＋每小时本聊天续做；22件已齐，右小腿v2与关节遮挡修正已实检 | 10-05 | 编辑中；三种动作完整过程复核中，未接入游戏主流程 |
| Friday（ZCode 本会话，主线5200拉起+全场收尾 WF-web-5200-1005） | cwd 搜打撤；127.0.0.1:5200 / PID3744 / npm run web / web-up detached / 本会话创建；日志 node_modules/.cache/web-up-5200.log；本表本行 | 老板令「拉起一个主线，顺便把其他任务都收尾结束」+拍板（打包提交落库/五在途接手收尾/已验两件不用测试）：5200 实核无监听后重建（node.exe PID3744 LISTENING+入口 HTTP200）；全场 33 行定终态移已释放；manifest 转正 259 条+6 svg 归一（0 errors）；打包门修正三件（RNG visual 流/closeLibPage 经 common 派发器中止 entry/六套断言对齐终态）；码笔 39d5251（622 文件 +16463/−2276）+文档笔 71f9663（1050 文件，>1MB 十四件退回留本地）落库；排除件=三活会话在途属地（request-batching：根AGENTS/WORKFLOW-TOOLS/AGENT-TOOLBOX/QUICKSTART/workflow-memory.mjs；wu-parts-full+ui-art-live 起后新增 drift：workflow.mjs/sound.js/selftest.js/manifest+26 行）+嵌套搜打撤/（无主待批）+nul；SKIP_FULL_TESTS 显式放行有记档（门内 0 测试失败，同机并发负载环境级 error×3，独立全量两轮 295 文件 2517 过 0 失败+syntax 315+ESLint 净为证） | 10-05 | 服务运行中（留老板用）；全场收尾收官，行保留至服务停用 |

## 无主物品（只记录勿动，等认领/处置）

| 物品 | 现象 | 发现时间 | 备注 |
|---|---|---|---|
| ~~`搜打撤/game/src/audio/sound.js`（已暂存 404 行改动）~~ | ~~暂存区实质改动（367+/37−，264→594 行）：音效系统重构（合成音软限幅/点击音压缩链/解码队列并发限 2+asset-url/random 导入）；mtime 20:42:45，改动会话不明~~ | 10-01 21:0x 发现 | 【10-02 核实销账】已随 8be424a 落库（老板拍板打包，音效域单独成笔），工作树复核干净 |
| ~~`搜打撤/__try_feedback.local.json`、`__try_hud.json`、`__try_route-overlay.json`（根目录 3 个未跟踪）~~ | ~~jsconfig 形态 tsc 实验配置（target/module/files），文件名对应 hud/route-overlay~~ | 10-02 00:5x 发现（WF-process-refine 复查） | 【10-05 收尾销账】三个文件已不存在（10-05 实核），DEBT 会话已自清理，疑点解除 |
| ~~`搜打撤/code-map/`~~ | ~~generate.mjs+data.js+index.html，生成会话不明~~【10-01 认领】即活跃登记 WF-code-map 行（ZCode 会话产出，老板令做的代码结构可视化地图）；仍在迭代与实机验证中 | 10-01 21:0x 发现 | 已认领，移活跃登记 |
| ~~`搜打撤/package-lock.json`~~ | ~~已修改未提交（M），改动者不明~~【10-01 核实销账】内容 diff 恒为零（行尾假差：npm install 重写为 LF，git 归一后零变化，add 后工作树干净）；当日接力会话 npm install 修复 @cacheable/memory 时触碰，依赖树零变化 | 09-29 深夜登记；10-01 核实 | 无主疑点解除，无实质改动 |
| ~~scripts/{workflow-staged,impact-query,workflow-gate-receipt}.mjs + tests/{workflow-staged,impact-query,boot}.test.js（6 文件 M，提交 2336355 之后新出现）~~ | ~~workflow-staged.test.js:256 quotepath 断言失败单跑稳定红=半成品实证~~ | 10-03 09:5x | 【10-05 收尾收编销账】半成品已被后续会话做完：workflow-staged+impact-query 契约测试 10-05 实跑 32/32 绿；六文件随 10-05 打包落库，归属随包注记 |
| ~~node.exe ×2（PID 21272/22356）~~ | ~~监听 5200（主线 Vite 端口）/5321，REGISTRY 无登记~~ | 09-29 深夜 | 【10-05 收尾销账】两进程已不存在（5321 无监听实核；5200 由 WF-web-5200-1005 重建为本会话登记服务），疑点解除 |
| `搜打撤/搜打撤/` 嵌套目录（内含 production-research/diagnosis/engineering/measure.mjs，4KB） | production-research 会话脚本相对路径多拼一层项目名致产物落错位置（10-02 18:23 生成）；10-05 比对：与正位 measure.mjs **不同体**——系 git 直调迭代版（正位为 env 注入+hashManifest 定稿版） | 10-03 00:1x 包装会话发现 | 【10-05 收尾注记】变体内容已保全至正位证据目录 measure-git-variant.mjs（纯新增）；嵌套壳目录原样留现场，删除须老板批；本轮打包显式排除该路径 |
| `搜打撤/docs/evidence/2026-10-02-staged-check/` 两个 >1.5MB staged 报告 JSON | 9d4b5ef 会话隔离门证据，超 1MB 红线留本地未入库 | 10-03 包装会话发现 | 只记录；随该会话属地处置 |

## 近期已释放

| Friday（Codex 圣光之源 WF-holy-source-1010） | docs/evidence/2026-10-10-holy-source/；根.tmp/nai/output/holy-source-20261010/ | 老板要求压缩上下文移交新任务；v2侧身站姿/双手展开晨曦光面提示词已保存，尚未生图；原NAI草稿不接入 | 10-10 | 当前会话编辑释放，授权新任务接手续做；无服务、未测试、未build、未提交 |
| Friday（Codex 霜月斩重绘 WF-frostslash-1010） | game/assets/{cards,thumbs/cards}/martial-tt3-frost-slash.webp；game/data/art-mapping.json仅本卡revision；asset-manifest.json仅两条/count；docs/evidence/2026-10-10-frostslash/；本表自有行 | 原构图重绘已接入；来源/备份/SHA见request与receipt | 10-10 | 完成未提交，编辑释放；无新服务、未测试、未build |
| Friday（Codex 制作名单职责 WF-credits-role-1010） | game/index.html仅太平职责；docs/evidence/2026-10-10-credits-redo/README.md | 老板令程序员改为程序、测试、美术、动画，保留制作人署名 | 10-10 | 完成未提交，编辑释放；仅文案，未测试/build，无新服务、不提交 |
| Friday（Codex 制作名单细致打磨 WF-credits-finesse-1010） | game/css/title-credits.css；docs/evidence/2026-10-10-credits-redo/ | 保持800宽；拉开文字层级、收拢双列、感谢区改轻页脚、细化玻璃反光与投影；当前窗口目检及基线测量完成 | 10-10 | 完成未提交，编辑释放；无新服务、不自动测试、不build、不提交 |
| Friday（Codex 制作名单再收小 WF-credits-compact2-1010） | game/css/title-credits.css；docs/evidence/2026-10-10-credits-redo/ | 宽980→800、压缩留白，保留字号与玻璃材质；当前窗口目检完整显示 | 10-10 | 完成未提交，编辑释放；无新服务、不自动测试、不build、不提交 |
| Friday（Codex 制作名单紧凑玻璃 WF-credits-compact-1010） | game/css/title-credits.css；docs/evidence/2026-10-10-credits-redo/ | 面板收小、留白收紧、提高透明度/模糊/层次阴影；当前窗口目检完成 | 10-10 | 完成未提交，编辑释放；无新服务、不自动测试、不build、不提交 |
| Friday（Codex 制作名单大模型标注 WF-credits-models-1010） | game/index.html仅额外感谢区；game/css/title-credits.css；docs/evidence/2026-10-10-credits-redo/ | 明确“额外感谢·大模型”，感谢区分层、署名配色及细线迭代；当前窗口两轮目检完成 | 10-10 | 完成未提交，编辑释放；无新服务、不自动测试、不build、不提交 |
| Friday（Codex 制作名单署名迭代 WF-credits-editorial-1010） | game/css/title-credits.css；docs/evidence/2026-10-10-credits-redo/ | 去横条、居中署名、放大文字及压暗背景；两轮当前窗口目检完成，保存credits-editorial.png | 10-10 | 完成未提交，编辑释放；复用5200，无新服务、不自动测试、不build、不提交 |
| Friday（Codex 制作名单感谢 WF-credits-thanks-1010） | game/index.html仅homeCredits下部；game/css/title-credits.css仅额外感谢；docs/evidence/2026-10-10-credits-redo/ | 去掉本页素材来源、增加gpt/glm/mimo/claude/deepseek，当前窗口目检完成 | 10-10 | 完成未提交，编辑释放；无新服务、不自动测试、不build、不提交 |
| Friday（Codex 制作名单 WF-credits-redo-1010） | game/index.html仅homeCredits；game/src/ui/title-credits.js仅CSS import；game/css/title-credits.css；docs/evidence/2026-10-10-credits-redo/ | 扩大透明署名面板、分列名单、特别鸣谢与素材来源；当前窗口目检及真实返回再开完成 | 10-10 | 完成未提交，编辑释放；保留他人首页修改，复用5200，无新服务、不自动测试、不build、不提交 |
| Friday（Codex 设置排版目检 WF-settings-type-1010） | game/css/settings-navigation.css；game/src/ui/game.menu.js仅设置文案与致谢布局；docs/evidence/2026-10-10-settings-navigation/ | 修分类色/按钮字号覆盖，精简说明、致谢分列；当前窗口音频/数据/关于截图与对应计算样式确认 | 10-10 | 完成未提交，编辑释放；按老板授权仅实页目检，未自动测试/build，无新服务、不提交 |
| Friday（Codex 设置分类配色 WF-settings-colors-1010） | game/src/ui/settings-navigation.js仅分类色标记；game/css/settings-navigation.css；docs/evidence/2026-10-10-settings-navigation/README.md | 五类低饱和点睛色联动选中标记/标题/控件，烟灰透明底与危险操作警示色保留 | 10-10 | 完成未提交，编辑释放，待老板验收；沿用免测试，未测试/实页/截图/build，无新服务、不提交 |
| Friday（Codex 设置动效 WF-settings-motion-1010） | game/src/ui/settings-navigation.js；game/css/settings-navigation.css；docs/evidence/2026-10-10-settings-navigation/README.md | 面板/标题淡入、条目错峰、导航标记滑动与开关滑钮transform过渡，减少动态兼容 | 10-10 | 完成未提交，编辑释放，待老板验收；沿用免测试，未测试/实页/截图/build，无新服务、不提交 |
| Friday（Codex 设置细节三轮 WF-settings-detail3-1010） | game/css/settings-navigation.css；docs/evidence/2026-10-10-settings-navigation/README.md | 分类/条目间距、音量三列对齐、键盘聚焦整行提示、记录入口高度与危险区组间距 | 10-10 | 完成未提交，编辑释放，待老板验收；沿用免测试，未测试/实页/截图/build，无新服务、不提交 |

| Friday（Codex 匿名武术重绘 WF-generic-martial-faceless-1010） | game/assets/{cards,thumbs/cards}/martial-tt3-{frostfall,fly-arrowhawk}.webp；game/data/art-mapping.json两卡revision；game/assets/asset-manifest.json四条；docs/evidence/2026-10-10-generic-martial-faceless/；根.tmp/nai/output/generic-martial-20261010/ | 10-10：老板授权接入，剑荡妖邪握剑斩妖面特写、飞身劈腾空下劈近景已替换卡面和缩略图，头脸出框、匿名非主角；素材来源/旧图备份见receipt.json，缓存与清单同步 | 完成未提交，编辑占用释放；进程99648/PID3688与58948均已结束；无服务、不测试、不build、不提交 |
| Friday（Codex 饮血寻宝重绘 WF-blood-map-1010） | game/assets/{cards,thumbs/cards}/equip-{tt3-blooddrinker,tt2-treasuremap}.webp；game/data/art-mapping.json仅两卡revision；asset-manifest.json仅四条/count；docs/evidence/2026-10-10-blood-map/；本表自有行 |老板令饮血剑、藏宝图（寻宝图）按原构图宽笔块面重绘；原构图重绘已接入，来源/备份/SHA见request与receipt | 10-10 | 完成未提交，编辑释放；无新服务、未测试、未build |
| Friday（Codex 毒杖迷匣重绘 WF-venom-mistbox-1010） | game/assets/{cards,thumbs/cards}/equip-{tt2-venomstaff,tt3eq-mistbox}.webp；game/data/art-mapping.json仅两卡revision；asset-manifest.json仅四条/count；docs/evidence/2026-10-10-venom-mistbox/；本表自有行 |老板令毒杖、秘之匣（迷之匣）按原构图宽笔块面重绘；原构图重绘已接入，来源/备份/SHA见request与receipt | 10-10 | 完成未提交，编辑释放；无新服务、未测试、未build |
| Friday（Codex 设置细节二轮 WF-settings-detail2-1010） | game/css/settings-navigation.css；docs/evidence/2026-10-10-settings-navigation/README.md | 中性透明底色、文字层级、开启行右沿、音量百分比、记录入口箭头与外链标识 | 10-10 | 完成未提交，编辑释放，待老板验收；沿用免测试，未测试/实页/截图/build，无新服务、不提交 |
| Friday（Codex 设置细节 WF-settings-detail-1010） | game/css/settings-navigation.css；docs/evidence/2026-10-10-settings-navigation/README.md | 分类选中标记、面板/条目高光投影、开关凹槽、音量底签、统一按钮与清档警示边 | 10-10 | 完成未提交，编辑释放，待老板验收；老板明确免测试，未测试/实页/截图/build，无新服务、不提交 |
| Friday（Codex 设置界面整改 WF-settings-nav-1010） | game/src/ui/game.menu.js仅设置布局调用/import；game/src/ui/settings-navigation.js；game/css/settings-navigation.css；tests/settings-page.test.js；docs/evidence/2026-10-10-settings-navigation/ | 左分类右条目；依老板反馈继续迭代烟灰透明面板、背景虚化与阴影；40项定向测试、ESLint、当前窗口分类/音频/留言往返/首页返回通过 | 10-10 | 完成未提交，编辑释放；保留他人选档改动，复用5200，无新服务、不build、不提交；性能未量化 |
| Friday（Codex 首页左侧阴影 WF-home-shadow-1010） | game/css/home-polish.css仅home-primary底部阴影；docs/evidence/2026-10-10-home-shadow/ | 左侧两个选项添加底部柔和阴影；当前窗口截图、计算样式与error检查通过 | 10-10 | 完成未提交；编辑释放，复用5200，无新服务、不build、不提交 |
| Friday（Codex 连射救急连弩重绘 WF-rapid-jianghu-bow-1010） | game/assets/{cards,thumbs/cards}/{martial-cc-rapid-fire,martial-tt2-jianghu,equip-tt3-reverse-bow}.webp；game/data/art-mapping.json仅三卡revision；asset-manifest.json仅六条/count；docs/evidence/2026-10-10-rapid-jianghu-bow/；本表自有行 |老板令三卡按原构图宽笔块面重绘；原构图重绘已接入，来源/备份/SHA见request与receipt | 10-10 | 完成未提交，编辑释放；无新服务、未测试、未build |
| Friday（Codex 法力奔涌重绘 WF-manasurge-1010） | game/assets/{cards,thumbs/cards}/spell-cc-mana-surge.webp；game/data/art-mapping.json仅cc-mana-surge revision；asset-manifest.json仅本卡两条/count；docs/evidence/2026-10-10-manasurge/；本表自有行 |老板令法力奔涌按原构图宽笔块面重绘；原构图重绘已接入，来源/备份/SHA见request与receipt | 10-10 | 完成未提交，编辑释放；无新服务、未测试、未build |
| Friday（Codex 首页深蓝底色 WF-home-blue-1010） | game/css/home-polish.css仅home-secondary底色与注释；docs/evidence/2026-10-10-home-blue/ | 首页右侧菜单改低饱和深蓝；当前窗口截图、计算样式及浏览器error检查通过 | 10-10 | 完成未提交；编辑已释放，复用5200，无新服务、不build、不提交 |

| Friday（Codex 满月形态分镜 WF-fullmoon-1010） | docs/evidence/2026-10-10-fullmoon-storyboard/；根.tmp/nai/output/fullmoon-20261010/ | 10-10：完成新分镜、NAI及内置重绘，光牧星月侧跪月缘揭夜幕；源图/完整提示词见 request.json；候选尚未接入 | 编辑占用释放；无服务、不测试、不build、不提交 |
| Friday（Codex 白塔双背带补画 WF-baita-straps-1010） | game/assets/{cards,thumbs/cards}/spell-{tt3-firm-barrier,tt7-energize,cmtn1p9vb5au,tt7-elementstorm}.webp；game/data/art-mapping.json仅四卡revision及cc-thousand共图缓存；asset-manifest.json仅八条；docs/evidence/2026-10-10-baita-straps/；本表自有行 | 四张补清双肩背带及裙身连接，保留原构图与遮挡；卡面/缩略图/revision已更新，来源与备份SHA见request/receipt | 10-10 | 完成未提交，编辑释放；无新服务、未测试、未build |

| Friday（Codex 恶魔之力黑暗形态 WF-demon-darkform-1010） | game/assets/{cards,thumbs/cards}/spell-{cc-demon,cmtn1r10xnl1}.webp；game/data/art-mapping.json两卡revision；game/assets/asset-manifest.json四条；星月双形象锚点；docs/evidence/2026-10-10-demon-darkform/ | 10-10：黑暗形态及恶魔之力均已按老板授权接入；恶魔之力采用暗牧星月全身碰影爪内置重绘，源图/提示词/旧图备份见 demon-final/request.json与receipt.json；缓存revision、素材清单同步 | 编辑占用释放；完成未提交，无服务、不测试、不build、不提交 |
| Friday（Codex 坚冰火球重绘 WF-barrier-fireball-1010） | game/assets/{cards,thumbs/cards}/spell-tt3-firm-barrier.webp与expedition-starters/fireball.webp；game/data/art-mapping.json仅两卡revision；asset-manifest.json仅四条/count；docs/evidence/2026-10-10-barrier-fireball/；本表自有行 |老板令两卡按原构图重绘；原构图重绘已接入，来源/备份/SHA见request与receipt | 10-10 | 完成未提交，编辑释放；无新服务、未测试、未build |
| Friday（Codex 重斩重绘 WF-reshot-1010） | game/assets/{cards,thumbs/cards}/martial-tt3-reshot.webp；game/data/art-mapping.json仅tt3-reshot revision；asset-manifest.json仅本卡两条/count；docs/evidence/2026-10-10-reshot/；本表自有行 |老板令重斩按原构图宽笔块面重绘；原构图重绘已接入，来源/备份/SHA见request与receipt | 10-10 | 完成未提交，编辑释放；无新服务、未测试、未build |
| Friday（Codex 全事件逐张重绘 WF-events-redraw-1010） | game/assets/scenes/event-*.webp及对应thumbs，仅eventCardArt现行19张；game/data/art-mapping.json仅19卡revision；asset-manifest.json仅对应条目/count；docs/evidence/2026-10-10-events-redraw/；.tmp/imagegen/events-redraw-1010/；本表自有行 | 19张事件原构图宽笔块面重绘全部接入；原图/缩略图/revision/清单已更新；生成提示词/源图/旧图备份/SHA见四批request与receipt | 10-10 | 完成未提交，编辑释放；无新服务、未测试、未build |
| Friday（Codex 三重千变光辉重绘 WF-triple-change-glow-1010） | game/assets/{cards,thumbs/cards}/spell-{tt7-twinfireball,cmtn1p9vb5au,tt7-holyglow}.webp；game/data/art-mapping.json仅对应revision及cc-thousand同图缓存；asset-manifest.json仅六条/count；docs/evidence/2026-10-10-triple-change-glow/；本表自有行 |老板令三卡按原构图重绘；原构图重绘已接入，来源/备份/SHA见request与receipt | 10-10 | 完成未提交，编辑释放；无新服务、未测试、未build |
| Friday（Codex 征召爆炸吊坠重绘 WF-recruit-boom-pendant-1010） | game/assets/{cards,thumbs/cards}/{spell-tt7-recruit,spell-cc-double-boom,equip-tt7-darkfort}.webp；game/data/art-mapping.json仅三卡revision；asset-manifest.json仅六条/count；docs/evidence/2026-10-10-recruit-boom-pendant/；本表自有行 |老板令三卡按原构图重绘；原构图重绘已接入，来源/备份/SHA见request与receipt | 10-10 | 完成未提交，编辑释放；无新服务、未测试、未build |
| Friday（Codex 星陨射线深渊重绘 WF-meteor-ray-abyss-1010） | game/assets/{cards,thumbs/cards}/spell-{tt7-meteorstrong,tt3-nuke-ray,tt7-abysscurse}.webp；game/data/art-mapping.json仅三卡revision；asset-manifest.json仅六条/count；docs/evidence/2026-10-10-meteor-ray-abyss/；本表自有行 |老板令三卡按原构图重绘；原构图重绘已接入，来源/备份/SHA见request与receipt | 10-10 | 完成未提交，编辑释放；无新服务、未测试、未build |
| Friday（Codex 聚能重绘 WF-energize-1010） | game/assets/{cards,thumbs/cards}/spell-tt7-energize.webp；game/data/art-mapping.json仅tt7-energize revision；asset-manifest.json仅本卡两条/count；docs/evidence/2026-10-10-energize/；本表自有行 |老板令聚能重绘，沿用原构图与宽笔块面画法；原构图重绘已接入，来源/备份/SHA见request与receipt | 10-10 | 完成未提交，编辑释放；无新服务、未测试、未build |
| Friday（Codex 初始攻击重绘 WF-basicattack-1010） | game/assets/{cards,thumbs/cards}/expedition-starters/basic-attack.webp；game/data/art-mapping.json仅starter-attack revision；asset-manifest.json仅本卡两条/count；docs/evidence/2026-10-10-basicattack/；本表自有行 |老板令初始攻击重绘，沿用原构图与宽笔块面画法；原构图宽笔块面重绘已接入，来源/备份/SHA见request与receipt | 10-10 | 完成未提交，编辑释放；无新服务、未测试、未build |
| Friday（Codex 厄运重绘 WF-doom-1010） | game/assets/{cards,thumbs/cards}/spell-cmtn1gfhczzj.webp；game/data/art-mapping.json仅cmtn1gfhczzj revision；asset-manifest.json仅本卡两条/count；docs/evidence/2026-10-10-doom/；本表自有行 |老板令厄运重绘，沿用原构图与宽笔块面画法；原构图宽笔块面重绘已接入，来源/备份/SHA见request与receipt | 10-10 | 完成未提交，编辑释放；无新服务、未测试、未build |
| Friday（Codex 永恒绽放重绘 WF-bladebloom-1010） | game/assets/{cards,thumbs/cards}/spell-tt7-bladebloom.webp；game/data/art-mapping.json仅tt7-bladebloom revision；asset-manifest.json仅本卡两条/count；docs/evidence/2026-10-10-bladebloom/；本表自有行 |老板令永恒绽放重绘，沿用原构图与宽笔块面画法；原构图宽笔块面重绘已接入，来源/备份/SHA见request与receipt | 10-10 | 完成未提交，编辑释放；无新服务、未测试、未build |

| Friday（Codex 白塔法师锦囊 WF-baita-stratagem-1010） | game/assets/{cards,thumbs/cards}/spell-tt7-stratagem.webp；game/data/art-mapping.json仅tt7-stratagem revision；asset-manifest.json仅本卡两条/count；docs/evidence/2026-10-10-baita-stratagem/；根.tmp/nai/output/baita-stratagem-20261010/ | 白塔坐姿侧转、单袋取出一道展开法术职业卡已接入；NAI草稿seed437326112→内置重绘纠正双袋、保留白底，来源/缩略图/缓存/清单更新，SHA见receipt | 10-10 | 完成未提交，编辑释放；未测试、未实页、未build、未提交，无新服务 |
| Friday（Codex 元素风暴闪金之锤重绘 WF-element-goldhammer-1010） | game/assets/{cards,thumbs/cards}/{spell-tt7-elementstorm,martial-cmtn0xt0zr7}.webp；game/data/art-mapping.json仅两卡revision；asset-manifest.json仅四条/count；docs/evidence/2026-10-10-element-goldhammer/ | 两卡原构图宽笔块面重绘已接入；提示词/来源/旧图备份/SHA见request与receipt | 10-10 | 完成未提交，编辑释放；无新服务、未测试、未build |
| Friday（Codex 圣光治愈重绘 WF-holyheal-1010） | game/assets/{cards,thumbs/cards}/spell-tt7-holyheal.webp；game/data/art-mapping.json仅tt7-holyheal revision；asset-manifest.json仅本卡两条/count；docs/evidence/2026-10-10-holyheal/ | 原构图宽笔块面重绘已接入，保留闭眼与双手围卡圣光；提示词/来源/旧图备份/SHA见request与receipt | 10-10 | 完成未提交，编辑释放；无新服务、未测试、未build |
| Friday（Codex 花瓣火形风暴原构图重绘 WF-petal-fire-storm-1010） | game/assets/{cards,thumbs/cards}/spell-{tt3-petal,cmtn1ntxzoc4,tt3-flame-storm}.webp；game/data/art-mapping.json仅三卡revision；asset-manifest.json仅六条/count；docs/evidence/2026-10-10-petal-fire-storm/ | 花瓣法阵、火焰形态、风暴火球按原构图宽笔块面重绘并接入；提示词/来源/备份/SHA见request与receipt | 10-10 | 完成未提交，编辑释放；无新服务、未测试、未build |

| Friday（Codex 法力补给白塔职业卡 WF-baita-manasupply-1010） | game/assets/{cards,thumbs/cards}/spell-tt7-maxsupply.webp；game/data/art-mapping.json仅tt7-maxsupply revision；asset-manifest.json仅本卡两条/count；docs/evidence/2026-10-10-baita-manasupply/；根.tmp/nai/output/baita-manasupply-20261010/ | 白塔坐姿膝上书/前景掌心接金白页状魔力职业卡已接入；NAI V5单张seed767127936→内置重绘，人物/画法参考分工；源图/缩略图/缓存/清单更新，SHA见receipt | 10-10 | 完成未提交，编辑释放；未测试、未实页、未build、未提交，无新服务 |
| Friday（Codex 三法术原构图重绘 WF-three-spells-redraw-1010） | game/assets/cards/spell-{tt7-burnharvest,tt7-frozenight,cmtn1lbhbqi4}.webp及对应thumbs；game/data/art-mapping.json仅三卡revision；game/assets/asset-manifest.json仅三卡条目/count；docs/evidence/2026-10-10-three-spells-redraw/ | 三卡保留原构图改为宽笔块面手绘，已接入；提示词/来源/旧图备份/SHA见request与receipt | 10-10 | 完成未提交；编辑释放，无新服务、未测试、未build |

| Friday（Codex 邪神手3续做 WF-eldritch-hand3-resume-1010） | game/assets/{cards,thumbs/cards}/creature-tt8-nofocus.webp；game/data/art-mapping.json仅tt8-nofocus revision；asset-manifest.json仅两条；docs/evidence/2026-10-10-eldritch-hand3-resume/；旧证据README与preserve-alpha.py仅目录参数 | 内置一次成功补第3勾爪手，已接入；源PNG/运行图/缩略图alpha0–255；四手全部补齐，其他三卡未重生；来源/SHA见receipt | 10-10 | 完成未提交，编辑释放；仅透明通道核对，未测试套件/实页/build/提交，无新服务 |

| Friday（Codex 邪神四手 WF-eldritch-hands-1010） | game/assets/{cards,thumbs/cards}/creature-tt8-{curseimmune,energycap,nofocus,healplus}.webp；game/data/art-mapping.json仅四卡revision；asset-manifest.json仅八条；docs/evidence/2026-10-10-eldritch-hands/；根.tmp/nai/output/eldritch-hands-20261010/；Codex MEMORY本任务透明编码经验 | 1/2/4首轮已接入，第3网络阻塞已由WF-eldritch-hand3-resume-1010补齐；四邪神手全部重绘，RGBA原图和缩略图均保留透明通道；来源/SHA见首轮与续做证据 | 10-10 | 完成未提交，编辑释放；仅透明通道核对，未测试套件/实页/build/提交；无新服务，NAI进程结束 |
| Friday（Codex 无修腿版四动作 wu-slim-sprites-1010） | game/art-source/characters/wu-slim-sprites-20261010/；docs/evidence/2026-10-10-wu-slim-sprites/ | 基于当前立绘重做四动作24关键帧；待机轻呼吸与手部微摆；统一576×560、复用同一待机端点；分帧/透明通道/端点字节核对、内置当前窗口真实单动作与连播通过；尚有低透明边缘残留，未做补间与正式战斗接入 | 10-10 | 候选完成未提交，编辑释放；原动画与精致版占用未动；无新服务、不build、不提交 |

| Friday（Codex 风吟白底画风返修 WF-wind-white-style-1010） | game/assets/{cards,thumbs/cards}/hero-sacredrain.webp；game/data/art-mapping.json仅tt8-hero-priest revision；asset-manifest.json仅两条；docs/evidence/2026-10-10-wind-white-style/；Codex MEMORY.md本任务经验 | 按老板纠正补全画风描述/三参考职责，原NAI白底与S风带构图保留，内置重绘一张已接入；原图/缩略图/revision更新，SHA见receipt；经验记忆已补，不重跑NAI | 10-10 | 完成未提交，编辑释放；未测试、未实页、未build、未提交，无新服务 |

| Friday（Codex 残影风吟三步重绘 WF-bound-wind-redesign-1010） | game/assets/{cards,thumbs/cards}/{bound-shadow,hero-sacredrain}.webp；game/data/art-mapping.json仅两卡revision；asset-manifest.json仅四条；docs/evidence/2026-10-10-bound-wind-redesign/；根.tmp/nai/output/bound-wind-redesign-20261010/ | 两卡重新设计→NAI草稿→内置重绘已接入；残影跪姿伸手/巨链锁影，风吟后仰吟唱/S形风带；风吟两次内置网络失败，精简输入第三次成功；来源/提示词/SHA见自有目录，原图>1MB只本地；原图重绘例外已记忆 | 10-10 | 完成未提交，编辑释放；未测试、未实页、未build、未提交，无新服务；NAI生成进程已结束 |

| Friday（Codex 全资源卡重绘 WF-resources-1010） | game/assets/{cards,thumbs/cards}/resources/{key,key-one}.webp；game/data/art-mapping.json仅tt-key/tt-key-one revision；game/assets/asset-manifest.json仅四条/count；docs/evidence/2026-10-10-resources/ | 全量15张请求仅一把/三把钥匙成功并接入，透明通道保留；其余13张网络错误，两把钥匙补发一次仍失败，旧图保留；未完成清单见generation-status.json，提示词/来源与备份SHA见request/receipt | 10-10 | 部分完成未提交，编辑释放；全资源重绘未完成，生成服务阻塞；只查看生图返回，未测试/实页/build，无新服务 |

| Friday（Codex 火幕内置重绘与经验 WF-volcano-builtin-1010） | game/assets/{cards,thumbs/cards}/hero-volcano.webp；game/data/art-mapping.json仅tt8-hero-descender revision；asset-manifest.json仅火山两条；docs/evidence/2026-10-10-volcano-builtin/；Codex MEMORY.md本任务主题与memory_summary.md索引 | 老板选free-v8第一张，全身扬臂提火幕构图内置重绘已接入；原图/缩略图/revision及来源SHA更新；经验已存Codex记忆并检索命中，参考职责明确分工；生成图已看，未跑验收 | 10-10 | 完成未提交，编辑释放；未测试、未build、未提交，无新服务 |

| Friday（Codex 火山自由分镜v8 WF-volcano-nai-v8-1010） | docs/evidence/2026-10-10-volcano-nai/free-v8/；根.tmp/nai/output/volcano-free-v8-20261010/{A,B,C}.png | V5 Full三HTTP200候选：全身扬火幕/半身控火/大透视火墙探身；B未充分落实压制怒潮，三张全数交付；正式画师链不改、无卡片道具，背景按设计；原图均>1MB仅本地，SHA见receipts | 10-10 | 候选已交付，编辑释放；未接入、未测试、未提交，无新服务；生成进程已结束 |

| Friday（Codex 第一款全入口接入 WF-card-first-install-1010） | game/css/card-layout-selected.css；game/index.html仅样式引用；docs/cards/{card-display,README}.md；docs/evidence/2026-10-10-card-first-install/ | 10-10 | 完成未提交，编辑释放；第一款统一仓库/战斗/发现/放大，20项定向测试及docs:check通过，真实开局→战斗→出牌触发发现实页通过；localhost档位2为本轮测试档，127存档仅浏览；旧未启用CSS草案已替换为正式第一款，排除状态结束；卡牌美术留言已标完成，无新服务、不build、不提交 |

| Friday（Codex 火山撕卡分镜 WF-volcano-nai-v7-1010） | docs/evidence/2026-10-10-volcano-nai/skill-v3/{generate-v7.py,request-v7-sent.json,receipt-v7.json,visual-review-v7.md}；根.tmp/nai/output/volcano-painterly-20261010/volcano-nai5-v7.png | 老板令背景按卡牌设计不锁颜色，推荐A撕卡分镜单张V5 HTTP200，seed1543562841；双手/撕裂/火焰已出现，实际背景白色、火山更像裂缝，待老板评价；原图>1MB仅本地，SHA见receipt | 10-10 | 候选已交付，编辑释放；未接入、未测试、未提交，无新服务 |

| Friday（Codex 暗影射击重绘 WF-shadowshot-1010） | game/assets/{cards,thumbs/cards}/spell-tt3sp-shadowshot.webp；game/data/art-mapping.json仅tt3sp-shadowshot revision；game/assets/asset-manifest.json仅两条/count；docs/evidence/2026-10-10-shadowshot/；本表自有行 | 原构图粗手绘重绘并接入；保留常无欲侧身伸手、双暗影箭左下至右上；来源/提示词/SHA见request与receipt | 10-10 | 完成未提交，编辑释放；只查看生图返回，未测试/实页/build，无新服务 |

| Friday（Codex 射击与奥术弹重绘 WF-shoot-arcanebolt-1010） | game/assets/{cards,thumbs/cards}/{martial-tt2-shoot,spell-tt7-arcanebolt}.webp；game/data/art-mapping.json仅两卡revision；game/assets/asset-manifest.json仅四条/count；docs/evidence/2026-10-10-shoot-arcanebolt/；本表自有行 | 两卡基于原图粗手绘重绘并接入；射击保留竖枪/火光/烟带，奥术弹保留白塔眨眼/前伸手势/青色指尖光；来源与SHA见request/receipt | 10-10 | 完成未提交，编辑释放；只查看生图返回，未测试/实页/build，无新服务 |

| Friday（Codex 照相馆退出键 WF-photo-exit-1010） | game/src/hub/game.cardslib.page.js仅退出SVG/class；game/css/photo-studio-unified.css仅退出样式及top7px；docs/evidence/2026-10-10-WF-photo-ui-fix/exit/ | 选档同款SVG、64×58、透明无框；上移8px，内置窗口图标/馆名中心差0.013px；真实点击关馆返回确认，boot17/17通过（位置后续CSS实页核对）；无新服务、不build不提交 | 10-10 | 完成未提交，编辑锁释放；本会话归属 |

| Friday（Codex 火山v6灰底完整躯干 WF-volcano-nai-v6-1010） | docs/evidence/2026-10-10-volcano-nai/skill-v3/{generate-v6.py,request-v6-sent.json,receipt-v6.json,visual-review-v6.md}；根.tmp/nai/output/volcano-painterly-20261010/volcano-nai5-v6.png | v5仅修背景/裁切，V5单张HTTP200，随机seed133766920；浅暖灰底与袍服闭合轮廓落实，仍有悬浮感、未延至画框下缘；待老板评价，原图>1MB仅本地，SHA见receipt | 10-10 | 候选已交付，编辑释放；未接入、未测试、未提交，无新服务 |

| Friday（Codex 深渊主宰与禁术解放重绘 WF-abyss-forbidden-1010） | game/assets/{cards,thumbs/cards}/{hero-abysssovereign,dark-eclipse}.webp；game/data/art-mapping.json仅两卡revision；game/assets/asset-manifest.json仅四条/count；docs/evidence/2026-10-10-{abyss-forbidden,forbidden-original}/ | 两卡基于原图粗笔重绘并接入；禁术解放保留黑袍、紫瞳、展开双手、日蚀与垂链星饰；取错的备用卡图已从自有备份恢复。提示词与来源SHA见request/receipt | 10-10 | 完成未提交，编辑释放；只查看生图返回，未测试/实页/build，无新服务 |

| Friday（Codex 火山记忆配方v5 WF-volcano-nai-v5-1010） | docs/evidence/2026-10-10-volcano-nai/skill-v3/{generate-v5.py,request-v5-sent.json,receipt-v5.json}；根.tmp/nai/output/volcano-painterly-20261010/volcano-nai5-v5.png | 老板令已核记忆v5单张，V5 Full/1024/28步/随机seed655720502，直连HTTP200；已看返回图，火山口/熔岩喷涌/烟柱与三卡可辨，脸和画风待老板评价；正式画师链与共享画风原文未变；原图1211195字节仅本地，SHA见receipt | 10-10 | 候选已交付，编辑释放；未接入、未测试、未提交，无新服务 |

| Friday（Codex 火山NAI v4 WF-volcano-nai-v4-1010） | docs/evidence/2026-10-10-volcano-nai/skill-v3/{generate-v4.py,request-v4-sent.json,receipt-v4.json,visual-review-v4.md}；根.tmp/nai/output/volcano-painterly-20261010/volcano-nai5-v4.png | 老板令v4单张，V5 Full/1024/28步/随机seed260554937，HTTP200；白边消失、旋涡移入画内，仍有矩形嵌套画面，待老板评价；原图>1MB仅本地，SHA见receipt | 10-10 | 候选已交付，编辑释放；未接入、未测试、未提交，无新服务 |

| Friday（Codex 第一款有据细化 WF-card-rarity-craft-1010） | game/card-design-options-v2.html；game/css/card-rarity-preview.css；docs/evidence/2026-10-10-first-card-refinement/；前轮工艺图保留2026-10-10-card-rarity-craft/ | 10-10 | 预览完成未提交，编辑释放，待老板审阅；主方案改第一款，文字进一步下移，撤冠/角件/双宝石，依炉石固定宝石与SNAP边框/亮面名称/饰面机制重做；内置当前窗口五档及放大长文案完整、error零条。未接入游戏，无新服务、不build、不提交 |

| Friday（Codex 照相馆美术动效 WF-photo-polish-1010） | game/src/hub/game.cardslib.page.js；game/css/photo-studio-unified.css；tests/boot.test.js；四张禁咒正图与缩略图；game/data/art-mapping.json仅四卡revision；game/assets/asset-manifest.json仅对应8条；docs/evidence/2026-10-10-WF-photo-ui-fix/；复用5200无新服务 | 棱彩可读、容器220ms可重播过渡、原等级框恢复与独立选中标记、初次换选残留修复；四张禁咒粗笔稿接入；71/71、本轮素材零问题、内置真实操作确认；未build/全量/提交 | 10-10 | 完成未提交，编辑锁释放；本会话归属；证据 result.json |

| Friday（Codex NAI5技能重写火山 WF-volcano-nai5-skill-1010） | docs/evidence/2026-10-10-volcano-nai/skill-v3/；根.tmp/nai/output/volcano-painterly-20261010/volcano-nai5-v3.png | 找到ZCode nai5-prompting并按字段/词组/关系句重写，显式V5，随机seed1586848622，HTTP200单张；已看图：身臂连贯、卡片燃烧进入喷发，仍有白色外缘和画风待评；完整提示词/来源/SHA见自有目录，原图>1MB仅本地 | 10-10 | 技能学习与候选交付，编辑释放；未接入、未测试、未提交，无新服务；全局配方与默认模型未改 |

| Friday（Codex 充能火山NAI v2 WF-volcano-nai-v2-1010） | docs/evidence/2026-10-10-volcano-nai/{prepare-v2.py,request-v2.json,generate-v2.py,receipt-v2.json}；根.tmp/nai/output/volcano-painterly-20261010/volcano-nai-v2.png | 老板令画v2完整提示词，V4.5/1024方图/28步/seed101010031，直连HTTP200单张，guard pending解除；已看图：暗底与男性身份存在，但躯干/手臂仍断开、能量变为平滑白月弧，画风与火山意象未达目标，未接入 | 10-10 | API候选已交付，编辑释放；未测试、未提交，无新服务；原图>1MB仅留本地，SHA见receipt-v2 |

| Friday（Codex 第二款卡面审阅 WF-card-layout-selected-1010） | game/card-design-options-v2.html仅第二款；docs/evidence/2026-10-10-card-layout-selected/；game/css/card-layout-selected.css为未启用接入草案 | 10-10 | 预览完成未提交，编辑释放；老板明确还在审阅，提前接入的index引用已撤下，正式接入暂停；费用与第一款53px徽章样式一致，卡名中心偏差0.007px、薄框保留，当前内置预览error零条；未启用CSS草案不算交付且不得混入完成代码包；无新服务、不build、不提交 |

| Friday（Codex 充能火山NAI单张 WF-volcano-nai-1010） | docs/evidence/2026-10-10-volcano-nai/；根.tmp/nai/output/volcano-painterly-20261010/volcano-nai.png | 现行NAI客户端+配方v1.3追加单图宽笔要求；V4.5/1024方图/28步/seed101010031，直连HTTP200一张，guard pending解除。实际图偏线稿平滑明暗/白底/半身贴片，画风构图未达目标，不接入；提示词与SHA见request/receipt | 10-10 | 单张API试图已交付，编辑释放；未测试、未提交，无新服务；全局配方未改 |

Friday（Codex 常无欲动画实装 changwuyu-sprite-install-1010），10-10：完成未提交、编辑释放。自有 game/src/battle/view/battle.frame-catalog-changwuyu.js、battle.frames.js常无欲追加分支、game/assets/portraits/frames/changwuyu/sprite-v1/、portraits/battle/changwuyu.webp、asset-manifest仅常无欲条目、game/assets/README.md常无欲说明、docs/evidence/2026-10-10-changwuyu-install/。老板明确允许接手共用播放器保留无改动；63去重纹理、待机/左手攻击(含施法)/连续受击/倒地保持已接入，复用现有战败演出结束后结算。按老板停止检查指示未补测试/实页/build，未提交，无新服务。

Friday（Codex 常无欲四动作Sprite changwuyu-sprites-1009），10-10：老板认可，完成未提交、编辑释放。自有 game/art-source/characters/changwuyu-sprites-20261009/、docs/evidence/2026-10-09-changwuyu-sprites/；当前为角色自身左手挥动500ms（帽檐修复）、胸腹呼吸3秒、同底图连续受击792ms、重做倒地1167ms；各动作统一基准，已转交本轮实装。

| Friday（Codex 卡牌稀有度识别 WF-card-rarity-preview-1010） | game/card-design-options-v2.html；docs/evidence/2026-10-10-card-rarity-preview/ | 10-10 | 三版预览完成未提交，编辑释放；整圈稀有度边框/独立标记/文字，删除额外攻击伤害类型价值栏；复用rarityOf纠正青龙化身为棱彩，当前内置实页长文案完整、三档色样切换通过、error零条；正式卡牌待选，无新服务、不build、不提交 |

| Friday（Codex 充能火山定稿接入 WF-volcano-install-1010） | game/assets/{cards,thumbs/cards}/hero-volcano.webp；game/data/art-mapping.json仅tt8-hero-descender revision；asset-manifest.json仅火山两条；docs/evidence/2026-10-10-wind-final-volcano/fire-install/ | 老板选定第三张男性修正版已接入；原图/缩略图与缓存revision更新，来源与SHA见receipt.json；风吟和火山均已接入 | 10-10 | 完成未提交，编辑释放；未测试、未提交，无新服务 |

| Friday（Codex 风吟定稿与火山三画风 WF-wind-final-volcano-1010） | game/assets/{cards,thumbs/cards}/hero-sacredrain.webp；game/data/art-mapping.json仅tt8-hero-priest revision；asset-manifest.json仅风吟两条；docs/evidence/2026-10-10-wind-final-volcano/；.tmp/imagegen/wind-final-volcano-1010/ | 老板选定附件风吟1已接入与revision更新；火山三候选人物身份错误，老板认可第三构图，已据常无欲现行男性立绘修正脸/低发髻/胸饰，只交候选未替换火山；提示词/来源/SHA见wind与fire的request/receipt | 10-10 | 风吟完成未提交，火山修正版待老板评价，编辑释放；未测试、未提交，无新服务 |

| Friday（Codex 卡牌真实参考重做 WF-card-visual-research-1010） | game/card-design-references/；game/card-design-options-v2.html；docs/evidence/2026-10-10-card-visual-research/ | 10-10 | 真实参考板及三款新样板完成未提交，编辑释放；6款游戏12份官方参考图与逐项拆解、来源SHA齐；当前内置窗口12图全加载，新样板长文案完整/无横溢出/切换正常/error零条；正式外观待选PENDING39，无新服务、不build、不提交 |

| Friday（ZCode 本会话，首页美学加动效 WF-home-polish-1009） | game/css/home-polish.css（新建）；game/src/ui/home-fx.js、game/css/home-layers.css、game/src/ui/home-layers.js（均新建）；game/src/ui/title-credits.js 仅加一行 import；不碰 title-p0.css / index.html（他会话壁纸改动未提交，保持原样）；5200 仅作预览不起新服务 | 老板令「按审美随意改，加动效与细节」：壁纸漂移与视差、字标光泽与星光、玫瑰花瓣、菜单悬停去抖与光斑、CTA 扫光、冷光呼吸、状态读数；证据 docs/evidence/2026-10-09-home-polish/ | 10-09 | 已落库（代码614bdc45；证据随本笔文档）；编辑释放，待老板验收 |

| Friday（Codex 完成项打包 WF-ship-1010） | 代码614bdc45共296文件；文档证据按冻结清单；docs/evidence/2026-10-10-ship-release/ | 老板令都提交实装；完成项分代码实装/文档证据两笔；排除在途、无主嵌套脚本与超限原图，共享manifest仅暂存完成资产条目 | 10-10 | 已落库（代码614bdc45；证据随本笔文档）；298文件2537通过17跳过；无新服务、未build、未推送 |

| Friday（Codex 三卡画风基准草稿 WF-ability-anchors-1010） | docs/evidence/2026-10-10-ability-anchors/{request,receipt}.json；.tmp/imagegen/ability-anchors-1010/{v1,v2,w1,w2}.png | 老板指定花开两面/青龙偃月斩/惩击画风参考；双C构图各两版已交付，1偏人物/手势、2偏能力意象；四张来源/提示词/SHA留证，待老板选择，未替换现行卡图 | 10-10 | 候选已交付，编辑释放；未测试、未提交，无新服务 |

| Friday（Codex 卡牌美术多方案 WF-card-design-options-1010） | game/src/hub/game.hub.pages.js仅仓库卡牌特写底部；game/css/base-camp.css仅对应底部；game/card-design-options.html；docs/evidence/2026-10-10-card-design-options/ | 10-10 | 底部清理与四版预览完成未提交，编辑释放；11项定向测试通过，内置当前窗口真实开仓库卡牌确认无描述/透明底/按钮保留；A/B/C/D无主题版式、3真实样本、长文案和放大预览已查，error零条；正式卡牌外观待老板选版，PENDING39；无新服务、不build、不提交 |

| Friday（Codex 两能力卡C构图画风草稿 WF-ability-style-drafts-1010） | docs/evidence/2026-10-10-ability-style-drafts/{request,receipt}.json；.tmp/imagegen/ability-style-drafts-1010/ | 双C构图草稿：初组差异过小，后组平涂/油画肌理/粗线均被老板反馈不像照相馆；全部5张草图板保留及SHA登记，未替换现行卡面；待老板指定2–3张画风基准再绘 | 10-10 | 草稿未获认可，编辑释放；未测试、未提交，无新服务 |

| Friday（Codex 基地页脚文字 WF-base-foot-copy-1010） | game/src/hub/game.hub.js仅camp-nav-foot span；docs/evidence/2026-10-10-base-foot-copy/ | 10-10 | 完成未提交，编辑释放；7项测试通过，内置当前窗口真实进入基地确认中文句子已删，error零条，本条留言已标完成，待处理0；无新服务、不build、不提交 |

| Friday（Codex 两能力卡分镜 WF-ability-storyboards-1010） | docs/evidence/2026-10-10-ability-storyboards/{request,receipt}.json；.tmp/imagegen/ability-storyboards-1010/{volcano-board,wind-board}.png | 两张能力卡各三构图候选已交付；建议火山B、风吟A。画作只作分镜，原游戏卡图未替换；内置imagegen输出与提示词/来源/SHA已保存 | 10-10 | 候选已交付，编辑释放；待老板选分镜后正式重绘；无服务、未测试、未提交 |

| Friday（Codex 收藏说明删除 WF-archive-copy-1010） | game/src/hub/game.hub.pages.js仅sectionHead可选说明及收藏标题调用；docs/evidence/2026-10-10-archive-copy/ | 10-10 | 完成未提交，编辑释放；13项测试通过，内置当前窗口真实输入收藏室标题下说明已无p，error零条，本条本地留言标完成，其余新留言未动；无新服务、不build、不提交 |

| Friday（Codex 基地返回同款 WF-base-back-border-1010） | game/src/hub/game.hub.js仅返回按钮SVG；game/css/base-camp.css仅返回按钮；docs/evidence/2026-10-10-base-back-border/ | 10-10 | 完成未提交，编辑释放；同选档SVG/无边框/无阴影/透明底，7项定向测试通过，内置当前窗口真实输入返回选档通过，error零条；无新服务、不build、不提交 |

| Friday（Codex 选档返回无框 WF-slot-back-border-1010） | game/css/page-slot-select.css仅返回按钮；docs/evidence/2026-10-10-slot-back-border/ | 10-10 | 完成未提交，编辑释放；边框0/透明底/无阴影/内框none，内置当前窗口真实点击返回主菜单通过，error零条；无新服务、不build、不提交 |

| Friday（Codex 七款卡背 WF-cardbacks-seven-1010） | game/assets/card-backs/；game/css/scenes.css仅卡背规则；game/assets/asset-manifest.json仅七款条目；docs/evidence/2026-10-10-cardbacks-seven/ | 10-10 | 七款完成并接入，完成未提交、编辑释放；11项base-meta测试、7图尺寸/解码/哈希核对、内置浏览器收藏页通过。全库资产门18项其他路径未登记错误；背包翻面/战斗外观未验。无新服务、不build、不提交；见本轮证据。 |

| Friday（Codex 跑局数据返回无框 WF-data-back-border-1010） | game/css/page-datapage.css仅返回按钮；docs/evidence/2026-10-10-data-back-border/ | 10-10 | 完成未提交，编辑释放；真实输入进入数据页并返回设置通过，边框0/透明底/无阴影，页面error零条；18条本地留言已标完成保留原文，其余按老板确认；无新服务、不build、不提交 |

| Friday（Codex 五套成就徽章 WF-ach-five-styles） | game/src/ui/achievement-gallery.js；game/src/ui/achievement-medals.js；game/css/title-achievements.css；game/assets/ui/achievement-styles/五套WebP；game/assets/asset-manifest.json仅自有五条；tests/achievement-gallery.test.js；docs/evidence/2026-10-09-WF-ach-five-styles/ | 五套130枚直接提取已确认样板，每次打开同套随机；分类220ms淡入上移可重播；定向45/45、本轮素材零问题、内置真实点击与页面error0；全局素材审计21项范围外错误未动；未build/全量/提交；复用5200无新服务 | 10-10 | 完成未提交，编辑锁释放；本会话归属；证据 integration-result.json / browser-checks.json |

| Friday（Codex 进入存档直达基地 WF-slot-direct-base-1010） | game/src/ui/game.menu.js仅进入基地分支；docs/evidence/2026-10-10-slot-direct-base/ | 10-10 | 完成未提交，编辑释放；删除抵达转场，51项定向测试通过，Codex内置浏览器当前窗口真实点击档位01直达基地出发页，页面error零条；无新服务、不build、不提交 |

| Friday（Codex 花开两面原构图重绘 WF-two-blooms-1010） | game/assets/{cards,thumbs/cards}/hero-summoner.webp；game/data/art-mapping.json仅tt8-hero-summoner revision；asset-manifest.json仅两条；docs/evidence/2026-10-10-two-blooms/ | 保留白塔正面双手捧花、半明半暗花朵与米金/深绿分色背景，粗手绘块面重绘；内置imagegen单张返回已查看，原图/缩略图/revision已接入；提示词与SHA见request/receipt.json | 10-10 | 已落库（614bdc45）；提交门298文件2537通过17跳过，编辑释放；未build，无新服务 |

| Friday（Codex 最新四留言 WF-feedback-four-1010） | game/src/hub/game.hub.js、game.hub.depart.js；game/css/page-expedition-hud.css、base-camp-roster.css；docs/evidence/2026-10-10-feedback-four/ | 10-10 | 三处UI完成未提交，编辑释放；19项定向测试及内置浏览器当前窗口实页通过。卡背全部7款待重绘，当前交付第二版草稿，未接入。见本轮证据；无新服务、不build、不提交。 |
| Friday（Codex 人物先选 WF-character-first-1010） | game/src/hub/game.hub.depart.js；game/src/run/game.run.altar.js；tests/hub-flow-regression.test.js、departure-class-confirmation.test.js | 10-10 | 完成未提交，编辑释放；77项定向测试通过，实页真实输入验证先人物后卡牌及所选人物传递。证据并入2026-10-10-feedback-four；未实测最终创建新局，不build、不提交。 |

| Friday（Codex 二刀流原构图重绘 WF-dual-wield-1010） | game/assets/{cards,thumbs/cards}/martial-cc-dual-wield.webp；game/data/art-mapping.json仅cc-dual-wield revision；asset-manifest.json仅对应两条/count；docs/evidence/2026-10-10-dual-wield/ | 原交叉刀刃/两角裁切刀刃/月夜水面/中央偏下火花构图粗笔重绘；内置imagegen单张返回已查看，卡图与缩略图接入、revision更新；来源与SHA见receipt.json | 10-10 | 已落库（614bdc45）；提交门298文件2537通过17跳过，编辑释放；未build，无新服务 |

| Friday（Codex 卡牌修正 WF-card-fixes-1010） | game/src/cards/cards.{data,sync,sync.m4,sync.m10,sync.m11}.js；game/src/battle/effects/effect-steps.ctx.js；game/data/{cards-sync,art-mapping}.json；game/assets/{cards,thumbs/cards}/martial-tt3-{frostfall,fly-arrowhawk}.webp与creature-tt8-{nofocus,healplus}.webp；asset-manifest.json仅目标条目；tests/{card-fixes-1010,m4-data,m10-data,message-batch-0917}.test.js；docs/game-compendium.md、docs/evidence/2026-10-10-card-fixes/ | 毒爆1费、神秘召唤仅传说、通行证A去重/C传说、三卡退役；两通用武术无人卡图接入；封印3/4两次生图网络失败后复用1/2正确手图，四卡均为手。7文件97过1跳过，图鉴12过，数据验证通过；实页确认费用/A单一/C传说，实战发现由定向测试覆盖 | 10-10 | 已落库（614bdc45）；提交门298文件2537通过17跳过，编辑释放；未build，无新服务 |

Friday（Codex 常无欲四动作Sprite changwuyu-sprites-1009），10-09：未完成、编辑释放，生成服务阻塞。自有 game/art-source/characters/changwuyu-sprites-20261009/（仅README/requests.json）与 docs/evidence/2026-10-09-changwuyu-sprites/；老板令四动作同无标准，纠正为不画火球、向右挥手，并选择继续内置生图。内置三次请求均 network error，无基准图/动作资产；已保存人设/规格/提示词/失败记录，待内置服务恢复续做。现行素材与角色文档只读，无新服务、不build、不提交；未切换API。

Friday（Codex 无死亡Sprite wu-death-sprite-1009），10-09：候选交付、编辑释放。自有 game/art-source/characters/wu-death-sprite-20261009/ 与 docs/evidence/2026-10-09-wu-death-sprite/；875ms失去支撑/屈膝撑地/侧身落地，最终保持躺倒；首帧与认可待机PNG字节像素同一，最后两帧同一倒地图。透明留边、帧图一致、时长/脚本语法、内置当前窗口真实单次播放保持倒地通过，错误0；未接入游戏、不提交、无新服务。

Friday（Codex 无受击Sprite wu-hurt-sprite-1009），10-09：老板已认可，完成未提交、编辑释放。自有 game/art-source/characters/wu-hurt-sprite-20261009/ 与 docs/evidence/2026-10-09-wu-hurt-sprite/；短促后仰/稳住/回待机，334ms；首尾PNG与认可待机初始PNG字节像素相同，透明留边、帧图与时长/脚本语法通过；内置当前窗口真实受击与单次回待机检查，错误0；未接入游戏、不提交、无新服务。

| Friday（Codex 全界面过渡 WF-surface-motion-1009） | game/src/ui/{surface-motion,interface-motion}.js；tests/surface-motion.test.js；docs/development.md公共模块说明；docs/evidence/2026-10-09-surface-motion/；本表自有行 | 首页、弹层、整页、独立屏幕统一自动挂载，后续动效集中修改surface-motion.js；不改他人基地/首页美术源码 | 10-09 | 完成未提交；编辑释放；68/68定向测试、ESLint、docs守卫，内置设置/指南/制作名单/存档/基地仓库与返回通过；未逐页验战斗/选人/照相馆/信箱；复用5200，无新服务、不build不提交 |

Friday（Codex 制作名单打开修复 credits-open-1009），10-09：完成未提交、编辑释放。属地 game/css/home-menu-motion.css 制作名单独立动效范围、docs/evidence/2026-10-09-credits-open/；不改活跃 WF-surface-motion-1009 模块。修复主页退场误隐藏 dialog 内容和返回按钮重叠；定向测试1/1、自有diff检查、内置当前窗口真实打开/返回/再次打开通过；Esc未通过，详见证据；复用5200，无新服务、不提交。

Friday（Codex 壁纸遮罩 wallpaper-shade-1009），10-09：完成未提交、编辑释放。自有 game/css/title-p0.css 的 wallpaper-only .home-slash 显隐规则及 docs/evidence/2026-10-09-wallpaper-shade/；既有壁纸素材改动保留。5项壁纸定向测试、diff检查、Codex内置当前窗口真实点击隐藏/恢复及计算样式 hidden/visible 通过，页面错误0；复用5200，无新服务、不提交。

Friday（Codex 无攻击待机统一 wu-sprite-match-1009），10-09：完成未提交、编辑释放。自有 game/art-source/characters/wu-attack-sprite-20261009/v3/、该目录README统一版入口、docs/evidence/2026-10-09-wu-sprite-match/；攻击首帧=待机初始帧=攻击尾帧，PNG字节/像素/哈希相同；中间姿态比例脚底与两张收势比例修正。轮廓留边、帧图一致、脚本语法、内置当前窗口真实连播进入攻击并返回待机通过，错误0；未接入游戏，不提交，无新服务。

Friday（Codex 无攻击Sprite wu-attack-sprite-1009），10-09：参考改版候选交付、编辑释放。自有 game/art-source/characters/wu-attack-sprite-20261009/ 与 docs/evidence/2026-10-09-wu-attack-sprite/；老板否定首版后参考Slynyrd与imonk，v2改为腰胯/重心驱动、后脚抬跟、短拖影与命中停顿。8姿态、10个24fps时间步、约417ms；透明留边、同一比例、可见帧图一致、时长与脚本语法通过；当前窗口内置浏览器真实预备/命中/收势/单次播放核对，错误0。动作认可待老板审阅，未接入游戏、不提交；复用既有5200，无新服务。

Friday（Codex 卡牌历史文档 WF-card-history-document-1009），10-09：完成未提交，编辑释放。自有 docs/evidence/2026-10-09-card-history-document/；交付 Word 115 页，331 个 ID / 816 份卡面，含现役272、明确退役49、旧ID迁移或合并2、其余历史8。完整性、渲染图像及 docs:check 通过；未改源码卡库、无新服务。catalog.json 和渲染 PDF 超1MB只留本地，全部render目录、全文与临时QA文件不入提交，来源和SHA见该目录README。 后续PDF重排完成：output/pdf/代号柒卡牌图鉴与历史总录.pdf，216页、596书签、194份卡图；331个目录/1030个内部链接目标有效，保留全部331个ID/816份卡面。PDF>1MB与pdf-qa目录只留本地，不进git；详见自有README和pdf-checks.json。

Friday（Codex 无待机Sprite wu-idle-sprite-1009），10-09：候选交付、编辑释放。自有 game/art-source/characters/wu-idle-sprite-20261009/ 与 docs/evidence/2026-10-09-wu-idle-sprite/；老板反馈后改为平静马尾、24fps/72帧/3秒连续呼吸。透明、留边、下半身固定、动画帧数与脚本语法通过；内置浏览器当前窗口播放及暂停核对，连续按钮检查受共享刷新打断。未接入正式战斗、不提交、复用既有5200/PID21616，无新服务。

| Friday（Codex 首页动效恢复 WF-home-motion-restore-1009） | game/src/ui/home-fx.js、game/css/{home-polish,home-layers}.css；docs/evidence/2026-10-09-home-perf/；本表自有行；复用5200无新服务 | 老板令恢复地雾、颗粒、视差及持续动效，保留花瓣删除 | 10-09 | 完成未提交；编辑释放；语法/ESLint、43项定向测试及内置动画/构造鼠标视差通过；不重测帧率；无新服务/构建/提交 |

| Friday（Codex 首页减负 WF-home-perf-1009） | game/src/ui/home-fx.js、game/css/{home-polish,home-layers}.css；docs/evidence/2026-10-09-home-perf/；本表自有行；复用5200无新服务 | 老板令首页减负、删飘红花；在已完成首页美学版本上定向削减持续动效 | 10-09 | 完成未提交；编辑释放；43项定向测试、语法/ESLint及内置壁纸/制作名单路径通过；历史减负版本5秒106→143FPS，p95 14→7.1ms（持续动效已按后续授权恢复，该数据不代表当前版本）；无新服务/构建/提交 |

Friday（Codex 无简化拆图 wu-simple-rig-1009），10-09：候选交付、编辑释放。自有 `.tmp/imagegen/wu-simple-rig-20261009/` 与 [交付记录](evidence/2026-10-09-wu-simple-rig/README.md)；9张透明PNG、10根骨骼（含根骨骼）、待机/攻击/受击/死亡四动作草稿、离线预览与ZIP完成。透明留边/引用/四动作30fps边界、Codex内置浏览器真实按钮与时间轴核对、文档守卫通过；Spine编辑器导入与官方运行库未验证。复用他人5200，不新建或停止服务，不碰旧22部件任务，未接入游戏、未提交。

| Friday（Codex 统一比例适配 WF-ui-scale-1009） | game/src/ui/ui-scale.js；game/css/ui-scale.css；tests/ui-scale.test.js；docs/development.md缩放说明；docs/evidence/2026-10-09-ui-scale/；本表自有行 | 老板令全部元素按比例缩放；取消0.85下限和局部放大；复用5200，无新服务 | 10-09 | 完成未提交；编辑释放；11/11定向测试、ESLint、docs守卫及内置浏览器四比例主页与存档往返通过；未逐页验收战斗/基地；证据见本任务目录；不build不提交 |

| Friday（Codex 第一壁纸扩图接入 wallpaper-outpaint-replace-1009） | game/assets/reconstruction/wallpaper-wu-1004.webp；asset-manifest对应条目；game/css/title-p0.css与game/index.html第一壁纸缓存串；docs/evidence/2026-10-09-wallpaper-outpaint/；本表自有行 | 老板令扩图替换原图；保持既有首页布局，同步资源记录与缓存 | 10-09 | 完成未提交；编辑释放；5/5测试、本资产零问题、内置当前窗口显示及console error0通过；整体资产检查受其他17项登记问题阻断；复用5200无新服务 |

| Friday（Codex 第一壁纸扩图 wallpaper-outpaint-1009） | game/art-source/home-wallpaper-outpaint-1009/wallpaper-one-expanded.png（本地大图不进git）；docs/evidence/2026-10-09-wallpaper-outpaint/README.md；本表自有行 | 当前首页壁纸一左右扩景；内置 imagegen 生成并视觉复核，尺寸与 SHA256 见证据 | 10-09 | 已交付扩图；编辑释放；原图及首页引用未修改；不提交 |

| Friday（Codex 壁纸人物居中 wallpaper-center-1009） | game/css/title-p0.css第一壁纸位置与延伸层；docs/evidence/2026-10-09-wallpaper-one/；本表自有行 | 老板令第一壁纸人物放到中间；临时Vite5200/PID10516/exec14604/cwd搜打撤，本会话创建 | 10-09 | 完成未提交；编辑释放；5/5测试与Codex内置当前606×958窗口人物居中通过；临时服务已停止，端口无监听；不build不提交 |

| Friday（Codex 第一壁纸去水印 wallpaper-one-1009） | game/assets/reconstruction/wallpaper-wu-1004.webp；asset-manifest本条；game/css/title-p0.css与game/index.html第一壁纸缓存串；docs/evidence/2026-10-09-wallpaper-one/；本表自有行 | 老板令以本聊天去水印图替换第一壁纸 | 10-09 | 完成未提交；编辑释放；5/5测试、本资产零问题、Codex内置当前窗口新图及console error0通过；临时5200/PID14756会话16636已停止；证据见本任务目录 |

| Friday（Codex 主页返回恢复 home-menu-return-1009） | game/src/ui/home-menu-motion.js；tests/home-menu-motion.test.js；docs/evidence/2026-10-09-home-menu-return/；本表自有行 | 修复基地/选人返回主页后入口route已清导致菜单停在退场状态 | 10-09 | 完成未提交；编辑释放；41/41测试、eslint、内置浏览器选人往返及菜单再次进入通过；复用5200，无新服务 |


| Friday（Codex 选人去特效 roster-no-effects-1009） | game/src/ui/character-idle.js；game/css/character-idle.css；tests/character-idle.test.js；docs/evidence/2026-10-09-roster-no-effects/；本表自有行 | 老板令移除选人页五人特效；保留CSS缓慢待机，去掉画布绘制循环 | 10-09 | 完成未提交；编辑释放；46/46定向测试、eslint、五人内置浏览器画布为0通过；复用5200，无新服务 |


| Friday（Codex 无选人立绘 wu-roster-1009） | game/assets/portraits/full/wu.webp；game/assets/asset-manifest.json（仅wu字节数）；game/art-source/characters/wu-roster-20261009.png；docs/character-bible/{wu.md,README.md,ref-images/wu.webp}；docs/evidence/2026-10-09-wu-roster-portrait/；本表自有行 | 老板确认新版立绘及文字落盘，并明确允许接手人设页与索引中的无条目；保留已有文档修改，仅叠加本轮锚点 | 10-09 | 完成未提交；编辑释放；内置浏览器选人页通过、文档守卫通过、无素材检查通过；整体资产审计受他人卡图登记阻断；无新服务 |


Friday（Codex WF-cross-category-art-v2），10-09：完成未提交、编辑占用释放。自有 docs/evidence/2026-10-09-cross-category-art-v2/ 与本条；老板否定过度简化后改以首版轻修，保留场景／光影／道具，膝上前后等长短裙与手持直剑修正，两跨类别静态样板＋总览、固定提示词、源／输出SHA完成。已视觉核对与文字边界检查，剑长比例仍有生成误差、自然感待老板审阅；不改游戏、不控制前台、不发布、不提交。

此段索引已释放记录；完整路径、归属、结果与授权原文保存在[10-09 整理前快照](archive/WF-ledger-context-1009/originals/docs/PARALLEL-REGISTRY.md#近期已释放)。当前编辑与服务占用仍由上方活跃登记维护。

| 会话 / 任务 | 查阅线索 | 来源 | 状态说明 |
|---|---|---|---|
| Friday（Codex 1999档案排版细化 WF-studio-archive-align-1010） | 已实现、待用户验收，完成未提交；沿用不用检测，未运行测试/浏览器/构建，无新服务 | game/css/photo-studio-archive.css；game/src/hub/game.cardslib.page.js；docs/evidence/2026-10-10-WF-studio-archive-align-1010/README.md | 2026-10-10 |
| Friday（Codex 1999档案美术版 WF-studio-archive-1010） | 已实现、待用户验收，完成未提交；老板明确不用检测，本轮未运行测试/浏览器/构建，无新服务 | game/css/photo-studio-archive.css；game/src/hub/game.cardslib.page.js；docs/evidence/2026-10-10-WF-studio-archive-1010/README.md | 2026-10-10 |
| Friday（Codex 照相馆逐步精修 WF-studio-polish-1010） | 已完成第一轮，完成未提交；74项定向、最终17项启动链、CSS/语法/ESLint/docs与实页通过；缩略图焦点只校正9张代表 | game/css/photo-studio-unified.css；game/src/hub/game.cardslib.page.js；game/src/hub/game.cardslib.photo-props.js；docs/evidence/2026-10-10-WF-studio-polish-1010/README.md；docs/evidence/2026-10-10-WF-studio-polish-1010/result.json；docs/evidence/2026-10-10-WF-studio-polish-1010/browser-export.json；docs/evidence/2026-10-10-WF-studio-polish-1010/07-final-gallery.png；其余有效证据见README；中间文件排除；5331 PID9708已核身份停止，5200保留 | 2026-10-10 |
| Friday（Codex 照相馆原版与取片 WF-photo-revert-1010） | game/src/hub/game.cardslib.page.js；game/css/photo-studio-unified.css；game/src/ui/ui.js仅照片预设；game/css/photo-studio-zoom-motion.css；tests/{boot,photo-zoom-lifecycle}.test.js；docs/evidence/2026-10-10-WF-studio-experience/revert/ | 原三文件指纹恢复，图库仅增加动效导入/选项两行；420ms来源放大、背签340ms/100ms延后，原120ms收回保持；83项、ESLint/语法/CSS/docs及内置真实开关重开通过；此前已释放改动保留 | 10-10 完成未提交，编辑释放；本会话归属；共享5200保留，旧样板320已核实停止、5329无监听；旧候选CSS未采用/不加载；不build不提交 |
| Friday（Codex 照相馆层次样板 WF-studio-layered-1010） | 线程visualizations/studio-atelier.html；docs/evidence/2026-10-10-WF-studio-experience/本轮样板记录 | 老板反馈不如原版，整体样板不采用；仅认可点击取片放大动效，由WF-photo-revert-1010接入原版；原型保留 | 10-10 停止样板迭代、编辑释放；本会话PID320身份核实停止，5329无监听；未改正式游戏样式、不build不提交 |
| Friday（Codex 照相馆具体案例 WF-studio-cases-1010） | docs/evidence/2026-10-10-WF-studio-experience/{concrete-case-study.md,concrete-prototype-check.json,prototype-detail.png,prototype-desk.png}；线程visualizations/studio-concrete-proposal.html | 作者实图：Card Album工具/状态、Destiny贴物品详情、The Mother选中分镜、按钮六态；明确布局/时序参数与两种交互原型；JS解析、内置真实搜索/筛选/取片收回/换片通过，console error0；未改正式游戏 | 10-10 研究与原型完成未提交，编辑释放；美术建议未定稿；本会话5329/PID8968身份核实停止且端口无监听；5200保留；无build、不提交 |
| Friday（Codex 照相馆体验 WF-studio-experience-1010） | game/src/hub/game.cardslib.page.js；game/css/{photo-studio-unified,photo-studio-motion}.css；tests/boot.test.js；docs/evidence/2026-10-10-WF-studio-experience/ | 老板否定美术并令退回原版；本会话界面改造已由WF-photo-revert-1010按开工前指纹还原，旧候选CSS未加载/未采用，不纳入完成代码打包；原记录保留为历史 | 10-10 已回退、编辑释放；本会话归属；仅认可的取片入场另行接入；不build不提交；此前已释放改动保留 |
| Friday（Codex 金蝉脱壳缩放实装 WF-goldencicada-scale-install-1010） | game/css/card-layout-selected.css仅金蝉脱壳；docs/cards/card-display.md仅缩放说明；docs/evidence/2026-10-10-card-framing-review/README.md、goldencicada-scale.html、installed.html与installed.png | 老板确认实装；大小卡正式渲染器+共用CSS内置实页通过，其他卡仍100% cover，error零条；docs:check通过；当前存档无金蝉脱壳，未验实际持有战斗路径 | 10-10 完成未提交；编辑释放；复用5200，无新服务、不build、不提交 |
| Friday（Codex 潜行词条与卡面检查 WF-stealth-term-art-review-1010） | game/src/cards/cards.view.js仅潜行识别；game/src/ui/term-tips.js仅潜行alias；tests/stealth-term.test.js；docs/evidence/2026-10-10-card-framing-review/ | 老板授权两文件仅补潜行；三文件38项测试通过，照相馆实页悬停通过；268张卡库共享样式检查与金蝉脱壳缩放对照见证据README | 10-10 完成未提交；编辑释放；正式卡面比例未改，复用5200无自建服务 |
| Friday（Codex 四首BGM实装 WF-four-bgm-install-1009） | game/src/audio/sound.js与sound.music.catalog.js；game/src/ui/game.menu.js音频设置；game/assets/music-demo新增2条及asset-manifest对应条；game/music-demo.html；game/selftest.js；tests/sound-music.test.js；docs/audio-system.md；docs/evidence/2026-10-09-WF-four-bgm-install/ | 10-09 | 完成未提交；仅四首BGM，旧文件保留停用；28/28定向测试、eslint、文档守卫及内置四首解码/设置页通过；编辑释放，全局守卫受他人home-fx语法及资产登记阻断；无新服务/构建/提交 |
| Friday（Codex 方舟战斗方向 WF-ark-battle-demo-1009） | docs/evidence/2026-10-09-WF-ark-battle-demo/；game/ark-battle-demo.html；本表自有行 | 10-09 | 完成未提交；首页/探索初版原样引用，战斗工业电子30秒全新草稿；定向制作检查通过-20.83LUFS，听感待试听；商店不变，编辑释放，无新服务/正式替换/提交 |
| Friday（Codex 连贯与降噪 WF-music-soft-continuity-1009） | docs/evidence/2026-10-09-WF-music-soft-continuity/；game/music-soft-continuity-demo.html；本表自有行 | 10-09 | 完成未提交；首页接句/释放与战斗收敛已生成；探索最初版和商店上一版原样引用；两首定向制作硬项通过，战斗短片段LRA关注保留；编辑释放，无新服务/正式替换/提交 |
| Friday（Codex 四首方向重做 WF-music-redirection-1009） | docs/evidence/2026-10-09-WF-music-redirection/；game/music-redirection-demo.html；本表自有行；.tmp/salamander-title-1009本地素材 | 10-09 | 完成未提交；真实钢琴素材与前三首新写、商店上一版原样保留；量化自评返修钢琴后四首制作检查通过；编辑释放，听感待试听；无新服务/浏览器验收/正式替换/提交 |
| Friday（Codex 四首草稿精修 WF-music-refinement-1009） | docs/evidence/2026-10-09-WF-music-refinement/；game/music-refinement-demo.html；本表自有行 | 10-09 | 完成未提交；四首30秒逐声部重排草稿与试听页已生成；编辑释放，听感待老板试听；按要求无浏览器验收或测试，无新服务/正式替换/提交 |
| Friday（Codex 四首原曲编曲 WF-four-music-demos-1009） | docs/evidence/2026-10-09-WF-four-music-demos/；game/four-music-demos.html | 10-09 | 四首30秒候选已交付；编辑释放，完成未提交；老板要求停止验证后直接试听；商店后续全新重做见WF-shop-remake-1009，其余三首待定；无新服务、不提交 |
| Friday（Codex 商店曲重做 WF-shop-remake-1009） | docs/evidence/2026-10-09-WF-shop-remake/；game/shop-remake-demo.html；本表自有行 | 10-09 | 完成未提交；四首结构自评与全新30秒灯下交易已生成；编辑释放，听感待老板试听；按要求无浏览器验收，无新服务/正式BGM替换/提交 |
| Friday（Codex 平和标题曲 WF-title-calm-demo-1009） | docs/evidence/2026-10-09-WF-title-calm-demo/；game/title-calm-demo.html | 10-09 | 候选已生成并验证播放，老板否定听感；保留现场，编辑释放；方向被四首原曲改编任务替代，无新服务、不提交 |
| Friday（Codex 标题现代编曲 WF-title-modern-demo-1009） | docs/evidence/2026-10-09-WF-title-modern-demo/；game/title-modern-demo.html；本表自有行 | 10-09 | 完成未提交；6首公开转录谱收集、30秒音频渲染及内置浏览器播放通过；编辑释放，听感待老板验收；复用5200，无新服务、不替换正式BGM、不提交 |
| Friday（美术与图鉴文档 WF-doc-system-art-cards-1009） | scripts/generate-compendium.mjs、tests/compendium.test.js；docs/production/art/VISUAL-BIBLE.md、character-bible、terminology.md、M-BATCH-MATRIX.md、game-compendium.md、cards/README.md、README.md、STATUS.md；本轮归档与证据。完整 paths 见 task.json | 10-09 | 完成未提交，编辑占用释放。老板确认三份卡牌文档释放后接手；美术/身份/历史配方分层，图鉴生成入口修复并刷新272卡快照，150卡迁移集合保持；17项测试、8项定向核对、文档守卫通过。另一会话新无锚点保留；未改游戏、图片或服务，未提交。明细见 [交付记录](evidence/2026-10-09-WF-doc-system-art-cards-1009/README.md)。 |
| Friday（文档系统后续 WF-doc-system-followup-1009） | scripts/workflow-task.mjs、tests/workflow-task.test.js；docs 的规则/状态/流程/路线图/两台账；docs/archive/WF-ledger-context-1009/ 与本轮证据。完整范围见本任务 task.json | 10-09 | 完成未提交，编辑占用释放。任务汇总恢复，旧格式原文保留；玩法文档源码核对与台账历史索引完成，14 项测试与文档守卫通过，18 条未决行保持。明细见 [后续交付记录](evidence/2026-10-09-WF-doc-system-followup-1009/README.md)。在途卡牌/术语/图鉴及游戏实页未验；无服务、不提交。 |
| Friday（历史记录 WF-cross-category-art） | Friday（Codex WF-cross-category-art），10-09：完成未提交、编辑占用释放。自有 docs/evidenc | [原文](archive/WF-ledger-context-1009/originals/docs/PARALLEL-REGISTRY.md#近期已释放) | 历史状态与归属见原文 |
| Friday（历史记录 WF-doc-system-1009） | Friday（Codex 文档系统整理 WF-doc-system-1009），10-09：本轮完成未提交，编辑占用释放。根规则/工作区与项 | [原文](archive/WF-ledger-context-1009/originals/docs/PARALLEL-REGISTRY.md#近期已释放) | 历史状态与归属见原文 |
| Friday（历史记录 WF-agents-doc-writing） | Friday（Codex 文档规则修订 WF-agents-doc-writing），10-09：完成未提交，编辑占用释放。仅根 AGENT | [原文](archive/WF-ledger-context-1009/originals/docs/PARALLEL-REGISTRY.md#近期已释放) | 历史状态与归属见原文 |
| Friday（历史记录 WF-xhs-full-post-draft） | Friday（Codex WF-xhs-full-post-draft），10-09：完成未提交、编辑占用释放。自有 docs/eviden | [原文](archive/WF-ledger-context-1009/originals/docs/PARALLEL-REGISTRY.md#近期已释放) | 历史状态与归属见原文 |
| Friday（历史记录 WF-xhs-triptych-art） | Friday（Codex WF-xhs-triptych-art），10-09：完成未提交、编辑占用释放。自有 docs/evidence/ | [原文](archive/WF-ledger-context-1009/originals/docs/PARALLEL-REGISTRY.md#近期已释放) | 历史状态与归属见原文 |
| Friday（历史记录 WF-m1-face-r4） | Friday（Codex WF-m1-face-r4），10-09：v3附件五官修正及v4头脸透视修正候选完成未提交、编辑释放。自有 doc | [原文](archive/WF-ledger-context-1009/originals/docs/PARALLEL-REGISTRY.md#近期已释放) | 历史状态与归属见原文 |
| Friday（历史记录 WF-xhs-reference-comparison） | Friday（Codex WF-xhs-reference-comparison），10-09：完成未提交、编辑占用释放。自有 docs/e | [原文](archive/WF-ledger-context-1009/originals/docs/PARALLEL-REGISTRY.md#近期已释放) | 历史状态与归属见原文 |
| Friday（历史记录 WF-m1-style-refinement-r2） | Friday（Codex WF-m1-style-refinement-r2），10-09：v2原图微调候选完成未提交、编辑释放。自有 do | [原文](archive/WF-ledger-context-1009/originals/docs/PARALLEL-REGISTRY.md#近期已释放) | 历史状态与归属见原文 |
| Friday（历史记录 WF-xhs-post-concept） | Friday（Codex WF-xhs-post-concept），10-09：完成未提交、编辑占用释放。自有 docs/evidence/ | [原文](archive/WF-ledger-context-1009/originals/docs/PARALLEL-REGISTRY.md#近期已释放) | 历史状态与归属见原文 |
| Friday（历史记录 WF-m1-style-refinement） | Friday（Codex WF-m1-style-refinement），10-09：一张M1风格收敛候选完成未提交、编辑释放。自有 doc | [原文](archive/WF-ledger-context-1009/originals/docs/PARALLEL-REGISTRY.md#近期已释放) | 历史状态与归属见原文 |
| Friday（历史记录 WF-art-mood-m1） | Friday（Codex WF-art-mood-m1），10-09：老板选择M1情绪基准，已回写自有 docs/production/ar | [原文](archive/WF-ledger-context-1009/originals/docs/PARALLEL-REGISTRY.md#近期已释放) | 历史状态与归属见原文 |
| Friday（历史记录 WF-art-mood-board） | Friday（Codex WF-art-mood-board），10-09：情绪板v0.1完成未提交，编辑占用释放。自有 docs/evid | [原文](archive/WF-ledger-context-1009/originals/docs/PARALLEL-REGISTRY.md#近期已释放) | 历史状态与归属见原文 |
| Friday（历史记录 WF-art-reference-board） | Friday（Codex WF-art-mood-board），10-09：情绪板v0.1完成未提交，编辑占用释放。自有 docs/evid | [原文](archive/WF-ledger-context-1009/originals/docs/PARALLEL-REGISTRY.md#近期已释放) | 历史状态与归属见原文 |
| Friday（历史记录 WF-art-direction-brief） | Friday（Codex WF-art-direction-brief），10-09：美术方向简报v0.1完成未提交，编辑占用释放。自有 d | [原文](archive/WF-ledger-context-1009/originals/docs/PARALLEL-REGISTRY.md#近期已释放) | 历史状态与归属见原文 |
| Friday（历史记录 WF-art-style-samples） | Friday（Codex WF-art-style-samples），10-09：两张首页玫瑰坐姿对照小样完成未提交，编辑释放。自有 doc | [原文](archive/WF-ledger-context-1009/originals/docs/PARALLEL-REGISTRY.md#近期已释放) | 历史状态与归属见原文 |
| Friday（历史记录 WF-xhs-poster-ps） | Friday（Codex WF-xhs-poster-ps），10-09：完成未提交，编辑占用释放。自有 docs/evidence/202 | [原文](archive/WF-ledger-context-1009/originals/docs/PARALLEL-REGISTRY.md#近期已释放) | 历史状态与归属见原文 |
| Friday（历史记录 WF-xhs-project-intro） | Friday（Codex WF-xhs-project-intro），10-08：完成未提交，编辑占用释放。自有 docs/evidence | [原文](archive/WF-ledger-context-1009/originals/docs/PARALLEL-REGISTRY.md#近期已释放) | 历史状态与归属见原文 |
| Friday（历史记录 WF-inbox-export-all） | Friday（Codex 留言箱全部导出 WF-inbox-export-all），10-05：完成未提交、编辑/服务占用释放。自有 gam | [原文](archive/WF-ledger-context-1009/originals/docs/PARALLEL-REGISTRY.md#近期已释放) | 历史状态与归属见原文 |
| Friday（历史记录 WF-exe-1005） | Friday（Codex EXE打包 WF-exe-1005），10-05：已交付EXE，编辑/构建占用释放。接手中断音乐任务，14首指纹复 | [原文](archive/WF-ledger-context-1009/originals/docs/PARALLEL-REGISTRY.md#近期已释放) | 历史状态与归属见原文 |
| Friday（历史记录 WF-music-integration） | Friday（Codex 音乐接入提交 WF-music-integration），10-05：原会话中断后由WF-exe-1005沿老板明 | [原文](archive/WF-ledger-context-1009/originals/docs/PARALLEL-REGISTRY.md#近期已释放) | 历史状态与归属见原文 |
| Friday（历史记录 WF-music-piano-two-hands） | Friday（Codex 双手钢琴 WF-music-piano-two-hands），10-05：完成未提交，编辑占用释放。自有 docs | [原文](archive/WF-ledger-context-1009/originals/docs/PARALLEL-REGISTRY.md#近期已释放) | 历史状态与归属见原文 |
| Friday（历史记录 WF-music-continuity-review） | Friday（Codex 连贯性复核与重写 WF-music-continuity-review），10-05：完成未提交，编辑占用释放。老 | [原文](archive/WF-ledger-context-1009/originals/docs/PARALLEL-REGISTRY.md#近期已释放) | 历史状态与归属见原文 |
| Friday（历史记录 WF-package-cleanup-1005） | Friday（Codex 冗余清理与提交推送 WF-package-cleanup-1005），10-05：编辑占用释放，码笔da6b8ff | [原文](archive/WF-ledger-context-1009/originals/docs/PARALLEL-REGISTRY.md#近期已释放) | 历史状态与归属见原文 |
| Friday（历史记录 WF-music-explore-battle-v4） | Friday（Codex 探索战斗V4 WF-music-explore-battle-v4），10-05：完成未提交，编辑占用释放。自有  | [原文](archive/WF-ledger-context-1009/originals/docs/PARALLEL-REGISTRY.md#近期已释放) | 历史状态与归属见原文 |
| Friday（历史记录 WF-card-ally-redesign） | Friday（Codex 卡牌/友军返修 WF-card-ally-redesign），10-05：老板在提交会话明确确认已完成并令代销账、 | [原文](archive/WF-ledger-context-1009/originals/docs/PARALLEL-REGISTRY.md#近期已释放) | 历史状态与归属见原文 |
| Friday（历史记录 WF-wallpaper-view） | Friday（Codex 壁纸全幅与纯展示 WF-wallpaper-view），10-05：已随da6b8ff入库、编辑占用释放，由WF- | [原文](archive/WF-ledger-context-1009/originals/docs/PARALLEL-REGISTRY.md#近期已释放) | 历史状态与归属见原文 |
| Friday（历史记录 WF-ensemble-wallpaper-final） | Friday（Codex 壁纸全幅与纯展示 WF-wallpaper-view），10-05：已随da6b8ff入库、编辑占用释放，由WF- | [原文](archive/WF-ledger-context-1009/originals/docs/PARALLEL-REGISTRY.md#近期已释放) | 历史状态与归属见原文 |
| Friday（历史记录 WF-music-title-v8） | Friday（Codex 标题曲V8 WF-music-title-v8），10-05：完成未提交，编辑占用释放。仅 docs/eviden | [原文](archive/WF-ledger-context-1009/originals/docs/PARALLEL-REGISTRY.md#近期已释放) | 历史状态与归属见原文 |
| Friday（历史记录 WF-music-independent-review） | Friday（Codex 独立音乐复核 WF-music-independent-review），10-05：完成未提交，编辑占用释放。仅  | [原文](archive/WF-ledger-context-1009/originals/docs/PARALLEL-REGISTRY.md#近期已释放) | 历史状态与归属见原文 |
| Friday（历史记录 WF-music-title-v7） | Friday（Codex 第一首开场垫音v7 WF-music-title-v7），10-05：完成未提交，编辑占用释放。仅 docs/ev | [原文](archive/WF-ledger-context-1009/originals/docs/PARALLEL-REGISTRY.md#近期已释放) | 历史状态与归属见原文 |
| Friday（历史记录 WF-music-title-v6） | Friday（Codex 第一首钢琴最后尝试v6 WF-music-title-v6），10-05：完成未提交，编辑占用释放。仅 docs/ | [原文](archive/WF-ledger-context-1009/originals/docs/PARALLEL-REGISTRY.md#近期已释放) | 历史状态与归属见原文 |
| Friday（历史记录 WF-ui-art-implement） | Friday（Codex 美术实施 WF-ui-art-implement），10-05：完成未提交，编辑占用释放。仅game/css/or | [原文](archive/WF-ledger-context-1009/originals/docs/PARALLEL-REGISTRY.md#近期已释放) | 历史状态与归属见原文 |
| Friday（历史记录 WF-ui-art-step1） | Friday（Codex 美术实施 WF-ui-art-implement），10-05：完成未提交，编辑占用释放。仅game/css/or | [原文](archive/WF-ledger-context-1009/originals/docs/PARALLEL-REGISTRY.md#近期已释放) | 历史状态与归属见原文 |
| Friday（历史记录 WF-music-title-v5） | Friday（Codex 第一首旋律整理v5 WF-music-title-v5），10-05：完成未提交，编辑占用释放。仅 docs/ev | [原文](archive/WF-ledger-context-1009/originals/docs/PARALLEL-REGISTRY.md#近期已释放) | 历史状态与归属见原文 |
| Friday（历史记录 WF-music-title-v4） | Friday（Codex 第一首音乐v4 WF-music-title-v4），10-05：完成未提交，编辑占用释放。仅 docs/evid | [原文](archive/WF-ledger-context-1009/originals/docs/PARALLEL-REGISTRY.md#近期已释放) | 历史状态与归属见原文 |
| Friday（历史记录 WF-ui-art-live-more） | Friday（Codex 遗漏美术补检 WF-ui-art-live-more），10-05：完成未提交，编辑占用释放。仅docs/evid | [原文](archive/WF-ledger-context-1009/originals/docs/PARALLEL-REGISTRY.md#近期已释放) | 历史状态与归属见原文 |
| Friday（历史记录 WF-music-gap） | Friday（Codex 音乐量化差距 WF-music-gap），10-05：完成未提交，编辑占用释放。仅 docs/evidence/2 | [原文](archive/WF-ledger-context-1009/originals/docs/PARALLEL-REGISTRY.md#近期已释放) | 历史状态与归属见原文 |
| Friday（历史记录 WF-music-identity） | Friday（Codex 音乐共同元素与古典配器 WF-music-identity），10-05：完成未提交，编辑占用释放。属地 docs | [原文](archive/WF-ledger-context-1009/originals/docs/PARALLEL-REGISTRY.md#近期已释放) | 历史状态与归属见原文 |
| Friday（历史记录 WF-ui-art-live） | Friday（Codex 美术实机检查 WF-ui-art-live）｜属地：docs/evidence/2026-10-05-WF-ui- | [原文](archive/WF-ledger-context-1009/originals/docs/PARALLEL-REGISTRY.md#近期已释放) | 历史状态与归属见原文 |
| Friday（历史记录 WF-music-demos） | Friday（Codex 循环音乐 WF-music-demos / WF-music-daw），10-05：完成未提交，编辑占用释放。首轮 | [原文](archive/WF-ledger-context-1009/originals/docs/PARALLEL-REGISTRY.md#近期已释放) | 历史状态与归属见原文 |
| Friday（历史记录 WF-music-daw） | Friday（Codex 循环音乐 WF-music-demos / WF-music-daw），10-05：完成未提交，编辑占用释放。首轮 | [原文](archive/WF-ledger-context-1009/originals/docs/PARALLEL-REGISTRY.md#近期已释放) | 历史状态与归属见原文 |
| Friday（历史记录 WF-flow-practice） | Friday（Codex 实际任务流程迭代 WF-flow-practice）｜属地：根AGENTS.md仅流程入口；README.md、d | [原文](archive/WF-ledger-context-1009/originals/docs/PARALLEL-REGISTRY.md#近期已释放) | 历史状态与归属见原文 |
| Friday（历史记录 WF-dual-memory-efficiency） | Friday（Codex 双端效率对齐 WF-dual-memory-efficiency）｜属地：Codex/ZCode全局AGENTS、 | [原文](archive/WF-ledger-context-1009/originals/docs/PARALLEL-REGISTRY.md#近期已释放) | 历史状态与归属见原文 |
| Friday（历史记录 WF-wu-parts-01） | Friday（Codex 无简化动画部件 WF-wu-parts-01）｜属地：game/art-source/characters/wu- | [原文](archive/WF-ledger-context-1009/originals/docs/PARALLEL-REGISTRY.md#近期已释放) | 历史状态与归属见原文 |
| Friday（历史记录 WF-memory-efficiency） | Friday（Codex 流程与记忆检索迭代 WF-memory-efficiency）｜属地：scripts/workflow-memor | [原文](archive/WF-ledger-context-1009/originals/docs/PARALLEL-REGISTRY.md#近期已释放) | 历史状态与归属见原文 |
| Friday（历史记录 WF-request-batching） | Friday（Codex 请求合并实测 WF-request-batching）｜属地：全局 AGENTS.md、Codex memory_ | [原文](archive/WF-ledger-context-1009/originals/docs/PARALLEL-REGISTRY.md#近期已释放) | 历史状态与归属见原文 |
| Friday（历史记录 WF-flyslash-no-character） | Friday（Codex 飞身劈无人版 WF-flyslash-no-character）｜属地：cards/martial-tt3-fly | [原文](archive/WF-ledger-context-1009/originals/docs/PARALLEL-REGISTRY.md#近期已释放) | 历史状态与归属见原文 |
| Friday（历史记录 WF-ach-blank-dismiss） | Friday（Codex 成就详情空白关闭 WF-ach-blank-dismiss）｜属地：game/src/ui/achievement | [原文](archive/WF-ledger-context-1009/originals/docs/PARALLEL-REGISTRY.md#近期已释放) | 历史状态与归属见原文 |
| Friday（历史记录 WF-web-restore-2255） | Friday（Codex 5200掉线恢复 WF-web-restore-2255）｜属地：cwd D:\素材\代号柒\搜打撤；127.0. | [原文](archive/WF-ledger-context-1009/originals/docs/PARALLEL-REGISTRY.md#近期已释放) | 历史状态与归属见原文 |
| Friday（历史记录 WF-web-5200-1005） | Friday（Codex 5200掉线恢复 WF-web-restore-2255）｜属地：cwd D:\素材\代号柒\搜打撤；127.0. | [原文](archive/WF-ledger-context-1009/originals/docs/PARALLEL-REGISTRY.md#近期已释放) | 历史状态与归属见原文 |
| Friday（历史记录 WF-home-return-settle） | Friday（Codex 主界面返回闪刷修复 WF-home-return-settle）｜属地：game/src/ui/home-menu | [原文](archive/WF-ledger-context-1009/originals/docs/PARALLEL-REGISTRY.md#近期已释放) | 历史状态与归属见原文 |
| Friday（历史记录 WF-hub-cover） | Friday（Codex 远征基地同款美术 WF-hub-cover）｜属地：新增game/css/hub-cover*.css、hub-a | [原文](archive/WF-ledger-context-1009/originals/docs/PARALLEL-REGISTRY.md#近期已释放) | 历史状态与归属见原文 |
| Friday（历史记录 WF-hub-personnel） | Friday（Codex 远征基地同款美术 WF-hub-cover）｜属地：新增game/css/hub-cover*.css、hub-a | [原文](archive/WF-ledger-context-1009/originals/docs/PARALLEL-REGISTRY.md#近期已释放) | 历史状态与归属见原文 |
| Friday（历史记录 WF-hub-warehouse） | Friday（Codex 远征基地同款美术 WF-hub-cover）｜属地：新增game/css/hub-cover*.css、hub-a | [原文](archive/WF-ledger-context-1009/originals/docs/PARALLEL-REGISTRY.md#近期已释放) | 历史状态与归属见原文 |
| Friday（历史记录 WF-departure-cover） | Friday（Codex 远征基地同款美术 WF-hub-cover）｜属地：新增game/css/hub-cover*.css、hub-a | [原文](archive/WF-ledger-context-1009/originals/docs/PARALLEL-REGISTRY.md#近期已释放) | 历史状态与归属见原文 |
| Friday（历史记录 WF-changwuyu-volcano） | Friday（Codex 充能火山重绘 WF-changwuyu-volcano）｜属地：cards/hero-volcano.webp + | [原文](archive/WF-ledger-context-1009/originals/docs/PARALLEL-REGISTRY.md#近期已释放) | 历史状态与归属见原文 |
| Friday（历史记录 WF-volcano-abstract-block） | Friday（Codex 充能火山重绘 WF-changwuyu-volcano）｜属地：cards/hero-volcano.webp + | [原文](archive/WF-ledger-context-1009/originals/docs/PARALLEL-REGISTRY.md#近期已释放) | 历史状态与归属见原文 |
| Friday（历史记录 WF-wind-song-block-brush） | Friday（Codex 充能火山重绘 WF-changwuyu-volcano）｜属地：cards/hero-volcano.webp + | [原文](archive/WF-ledger-context-1009/originals/docs/PARALLEL-REGISTRY.md#近期已释放) | 历史状态与归属见原文 |
| Friday（历史记录 WF-process-trim-1004） | Friday（ZCode 本会话，流程瘦身 WF-process-trim-1004）｜属地：根 AGENTS.md；docs/{READM | [原文](archive/WF-ledger-context-1009/originals/docs/PARALLEL-REGISTRY.md#近期已释放) | 历史状态与归属见原文 |
| Friday（历史记录 WF-process-trim） | Friday（ZCode 本会话，流程瘦身 WF-process-trim-1004）｜属地：根 AGENTS.md；docs/{READM | [原文](archive/WF-ledger-context-1009/originals/docs/PARALLEL-REGISTRY.md#近期已释放) | 历史状态与归属见原文 |
| Friday（历史记录 WF-xingyue-wind-song） | Friday（Codex 正常星月浪掷风吟 WF-xingyue-wind-song）｜属地：cards/hero-sacredrain.w | [原文](archive/WF-ledger-context-1009/originals/docs/PARALLEL-REGISTRY.md#近期已释放) | 历史状态与归属见原文 |
| Friday（历史记录 WF-web-codex-1004） | Friday（Codex 本会话，拉起网页版 WF-web-codex-1004）｜属地：cwd 搜打撤；127.0.0.1:5200 /  | [原文](archive/WF-ledger-context-1009/originals/docs/PARALLEL-REGISTRY.md#近期已释放) | 历史状态与归属见原文 |
| Friday（历史记录 WF-web-5200-1004） | Friday（ZCode 本会话，拉起网页版 5200 重启 WF-web-5200-1004）｜属地：cwd 搜打撤；127.0.0.1: | [原文](archive/WF-ledger-context-1009/originals/docs/PARALLEL-REGISTRY.md#近期已释放) | 历史状态与归属见原文 |
| Friday（历史记录 WF-sfx-opensource-1004） | Friday（ZCode 本会话，音效全量换开源 WF-sfx-opensource-1004）｜属地：game/assets/sfx/ba | [原文](archive/WF-ledger-context-1009/originals/docs/PARALLEL-REGISTRY.md#近期已释放) | 历史状态与归属见原文 |
| Friday（历史记录 WF-minako-ui-benchmark） | Friday（ZCode 本会话，米娜可 PV 基准拆解+美术UI升级计划 WF-minako-ui-benchmark）｜属地：docs/ | [原文](archive/WF-ledger-context-1009/originals/docs/PARALLEL-REGISTRY.md#近期已释放) | 历史状态与归属见原文 |
| Friday（历史记录 WF-ach-gallery） | Friday（ZCode 本会话，米娜可 PV 基准拆解+美术UI升级计划 WF-minako-ui-benchmark）｜属地：docs/ | [原文](archive/WF-ledger-context-1009/originals/docs/PARALLEL-REGISTRY.md#近期已释放) | 历史状态与归属见原文 |
| Friday（历史记录 WF-photolib-perf） | Friday（ZCode 本会话，米娜可 PV 基准拆解+美术UI升级计划 WF-minako-ui-benchmark）｜属地：docs/ | [原文](archive/WF-ledger-context-1009/originals/docs/PARALLEL-REGISTRY.md#近期已释放) | 历史状态与归属见原文 |
| Friday（历史记录 WF-motion-ui-p0） | Friday（ZCode 本会话，美术UI P0 实施·工作流 dwfrun-0e76e773，WF-motion-ui-p0）｜属地：ga | [原文](archive/WF-ledger-context-1009/originals/docs/PARALLEL-REGISTRY.md#近期已释放) | 历史状态与归属见原文 |
| Friday（历史记录 WF-web-5200-1003） | Friday（ZCode 本会话，照相馆打不开排查+Codex 现场盘点）｜属地：cwd 搜打撤；127.0.0.1:5200 / PID2 | [原文](archive/WF-ledger-context-1009/originals/docs/PARALLEL-REGISTRY.md#近期已释放) | 历史状态与归属见原文 |
| Friday（历史记录 WF-wu-battle-imagegen-v2-1004） | Friday（Codex 无动画立绘返修 WF-wu-battle-imagegen-v2-1004）｜属地：docs/evidence/2 | [原文](archive/WF-ledger-context-1009/originals/docs/PARALLEL-REGISTRY.md#近期已释放) | 历史状态与归属见原文 |
| Friday（历史记录 WF-wu-battle-imagegen） | Friday（Codex 无动画立绘返修 WF-wu-battle-imagegen-v2-1004）｜属地：docs/evidence/2 | [原文](archive/WF-ledger-context-1009/originals/docs/PARALLEL-REGISTRY.md#近期已释放) | 历史状态与归属见原文 |
| Friday（历史记录 WF-wu-nai-v3） | Friday（Codex 无战斗立绘 NovelAI WF-wu-nai-v3）【已停止，10-03 老板令弃用，ZCode 会话收尾盘点】 | [原文](archive/WF-ledger-context-1009/originals/docs/PARALLEL-REGISTRY.md#近期已释放) | 历史状态与归属见原文 |
| Friday（历史记录 WF-nai-prompt-clean） | Friday（Codex 无战斗立绘 NovelAI WF-wu-nai-v3）【已停止，10-03 老板令弃用，ZCode 会话收尾盘点】 | [原文](archive/WF-ledger-context-1009/originals/docs/PARALLEL-REGISTRY.md#近期已释放) | 历史状态与归属见原文 |
| Friday（历史记录 WF-nai-v13-restore） | Friday（ZCode 本会话，nai_style v1.3 恢复与无正面立绘 WF-nai-v13-restore）｜属地：tools/ | [原文](archive/WF-ledger-context-1009/originals/docs/PARALLEL-REGISTRY.md#近期已释放) | 历史状态与归属见原文 |
| Friday（历史记录 WF-xart-z1） | Friday（ZCode 本会话，nai_style v1.3 恢复与无正面立绘 WF-nai-v13-restore）｜属地：tools/ | [原文](archive/WF-ledger-context-1009/originals/docs/PARALLEL-REGISTRY.md#近期已释放) | 历史状态与归属见原文 |
| Friday（历史记录 WF-style-recipe-v5） | Friday（ZCode 本会话，画风基准重定 WF-style-recipe-v5）｜属地：docs/evidence/2026-10-0 | [原文](archive/WF-ledger-context-1009/originals/docs/PARALLEL-REGISTRY.md#近期已释放) | 历史状态与归属见原文 |
| Friday（历史记录 WF-experience-art-exec） | Friday（ZCode 本会话，体验美术执行 ZCode 侧 WF-xart-z1）｜属地：**10-03 老板令：Codex 执行会话已 | [原文](archive/WF-ledger-context-1009/originals/docs/PARALLEL-REGISTRY.md#近期已释放) | 历史状态与归属见原文 |
| Friday（历史记录 WF-experience-art-plan） | Friday（Codex 体验美术总纲 WF-experience-art-plan）｜属地：负责人独占 game/css/{battle, | [原文](archive/WF-ledger-context-1009/originals/docs/PARALLEL-REGISTRY.md#近期已释放) | 历史状态与归属见原文 |
| Friday（历史记录 WF-cls2-idle） | Friday（ZCode 本会话，选人页待机演出 WF-cls2-idle）｜属地：game/src/ui/character-idle.j | [原文](archive/WF-ledger-context-1009/originals/docs/PARALLEL-REGISTRY.md#近期已释放) | 历史状态与归属见原文 |
| Friday（历史记录 WF-ph1-sys03） | Friday（ZCode 本会话，选人页待机演出 WF-cls2-idle）｜属地：game/src/ui/character-idle.j | [原文](archive/WF-ledger-context-1009/originals/docs/PARALLEL-REGISTRY.md#近期已释放) | 历史状态与归属见原文 |
| Friday（历史记录 WF-pending35-normalize） | Friday（ZCode 本会话，#35 归一化实施 WF-pending35-normalize）｜属地：scripts/asset-au | [原文](archive/WF-ledger-context-1009/originals/docs/PARALLEL-REGISTRY.md#近期已释放) | 历史状态与归属见原文 |
| Friday（历史记录 WF-ph1-sys08） | Friday（ZCode 本会话，PH1 第五批 WF-ph1-sys08）｜属地：battle/view 预览构造、battle.core | [原文](archive/WF-ledger-context-1009/originals/docs/PARALLEL-REGISTRY.md#近期已释放) | 历史状态与归属见原文 |
| Friday（历史记录 WF-ph1-sys11） | Friday（ZCode 本会话，PH1 第三批 WF-ph1-sys11）｜属地：game/src/agent/{recorder,pro | [原文](archive/WF-ledger-context-1009/originals/docs/PARALLEL-REGISTRY.md#近期已释放) | 历史状态与归属见原文 |
| Friday（历史记录 WF-ph1-sys02） | Friday（ZCode 本会话，PH1 第二批 WF-ph1-sys02）｜属地：game/src/hub/extraction.comm | [原文](archive/WF-ledger-context-1009/originals/docs/PARALLEL-REGISTRY.md#近期已释放) | 历史状态与归属见原文 |
| Friday（历史记录 WF-ph1-sys01-10） | Friday（ZCode 本会话，PH1 第一批 WF-ph1-sys01-10）｜属地：game/src/run/（经验结算落点：game | [原文](archive/WF-ledger-context-1009/originals/docs/PARALLEL-REGISTRY.md#近期已释放) | 历史状态与归属见原文 |
| Friday（历史记录 WF-ui-cover-all） | Friday（Codex 全游戏分层界面重塑 WF-ui-cover-all），10-05：授权范围源码美术实现完成未提交，编辑占用释放、待 | [原文](archive/WF-ledger-context-1009/originals/docs/PARALLEL-REGISTRY.md#近期已释放) | 历史状态与归属见原文 |
| Friday（历史记录 WF-character-pool-cover） | Friday（Codex 角色卡池同款与动效 WF-character-pool-cover），10-05：完成未提交、编辑占用释放。属地  | [原文](archive/WF-ledger-context-1009/originals/docs/PARALLEL-REGISTRY.md#近期已释放) | 历史状态与归属见原文 |
| Friday（历史记录 WF-cards-22-fast） | Friday（Codex 二十二卡快速重绘 WF-cards-22-fast），10-05：完成未提交、占用释放。前8黑像卡按原构图：不变应 | [原文](archive/WF-ledger-context-1009/originals/docs/PARALLEL-REGISTRY.md#近期已释放) | 历史状态与归属见原文 |
| Friday（历史记录 WF-eight-items-rough-1005） | Friday（Codex 八装备粗笔重绘 WF-eight-items-rough-1005），10-05：完成未提交、编辑占用释放。car | [原文](archive/WF-ledger-context-1009/originals/docs/PARALLEL-REGISTRY.md#近期已释放) | 历史状态与归属见原文 |
| Friday（历史记录 WF-eight-items-rough） | Friday（Codex 八装备粗笔重绘 WF-eight-items-rough-1005），10-05：完成未提交、编辑占用释放。car | [原文](archive/WF-ledger-context-1009/originals/docs/PARALLEL-REGISTRY.md#近期已释放) | 历史状态与归属见原文 |
| Friday（历史记录 WF-holy-shield-fast） | Friday（Codex 圣盾快速粗笔重绘 WF-holy-shield-fast），10-05：完成未提交、占用释放。仅cards/spe | [原文](archive/WF-ledger-context-1009/originals/docs/PARALLEL-REGISTRY.md#近期已释放) | 历史状态与归属见原文 |
| Friday（历史记录 WF-wallpaper-glass-1005） | Friday（Codex 第二壁纸玻璃与城市背景 WF-wallpaper-glass-1005），10-05：完成未提交、编辑占用释放。属 | [原文](archive/WF-ledger-context-1009/originals/docs/PARALLEL-REGISTRY.md#近期已释放) | 历史状态与归属见原文 |
| Friday（历史记录 WF-wallpaper-redraw） | Friday（Codex 第二壁纸玻璃与城市背景 WF-wallpaper-glass-1005），10-05：完成未提交、编辑占用释放。属 | [原文](archive/WF-ledger-context-1009/originals/docs/PARALLEL-REGISTRY.md#近期已释放) | 历史状态与归属见原文 |
| Friday（历史记录 WF-wallpaper-block-1005） | Friday（Codex 第二壁纸宽笔块面续修 WF-wallpaper-block-1005），10-05：完成未提交、编辑占用释放。属地 | [原文](archive/WF-ledger-context-1009/originals/docs/PARALLEL-REGISTRY.md#近期已释放) | 历史状态与归属见原文 |
| Friday（历史记录 WF-big-chest-search-1005） | Friday（Codex 搜索大宝箱自由粗笔重绘 WF-big-chest-search-1005），10-05：完成未提交、编辑占用释放。 | [原文](archive/WF-ledger-context-1009/originals/docs/PARALLEL-REGISTRY.md#近期已释放) | 历史状态与归属见原文 |
| Friday（历史记录 WF-big-chest-search） | Friday（Codex 搜索大宝箱自由粗笔重绘 WF-big-chest-search-1005），10-05：完成未提交、编辑占用释放。 | [原文](archive/WF-ledger-context-1009/originals/docs/PARALLEL-REGISTRY.md#近期已释放) | 历史状态与归属见原文 |
| Friday（历史记录 WF-map-cover） | Friday（Codex 地图同款美术 WF-map-cover），10-05：完成未提交、编辑占用释放。属地 game/src/core/ | [原文](archive/WF-ledger-context-1009/originals/docs/PARALLEL-REGISTRY.md#近期已释放) | 历史状态与归属见原文 |
| Friday（历史记录 WF-wallpaper-redraw-1005） | Friday（Codex 第二壁纸清晰重绘 WF-wallpaper-redraw-1005），10-05：完成未提交、编辑占用释放。属地g | [原文](archive/WF-ledger-context-1009/originals/docs/PARALLEL-REGISTRY.md#近期已释放) | 历史状态与归属见原文 |
| Friday（历史记录 WF-fullstrike-identity-rough） | Friday（Codex 全力一击原构图人设修正 WF-fullstrike-identity-rough），10-05：完成未提交、编辑占 | [原文](archive/WF-ledger-context-1009/originals/docs/PARALLEL-REGISTRY.md#近期已释放) | 历史状态与归属见原文 |
| Friday（历史记录 WF-home-wallpaper-1005） | Friday（Codex 第二壁纸切换 WF-home-wallpaper-1005），10-05：完成未提交、编辑占用释放。属地game/ | [原文](archive/WF-ledger-context-1009/originals/docs/PARALLEL-REGISTRY.md#近期已释放) | 历史状态与归属见原文 |
| Friday（历史记录 WF-home-wallpaper） | Friday（Codex 第二壁纸切换 WF-home-wallpaper-1005），10-05：完成未提交、编辑占用释放。属地game/ | [原文](archive/WF-ledger-context-1009/originals/docs/PARALLEL-REGISTRY.md#近期已释放) | 历史状态与归属见原文 |
| Friday（历史记录 WF-fullmoon-creative-1005） | Friday（Codex 满月形态创意粗笔重绘 WF-fullmoon-creative-1005），10-05：完成未提交、编辑占用释放。 | [原文](archive/WF-ledger-context-1009/originals/docs/PARALLEL-REGISTRY.md#近期已释放) | 历史状态与归属见原文 |
| Friday（历史记录 WF-fullmoon-creative） | Friday（Codex 满月形态创意粗笔重绘 WF-fullmoon-creative-1005），10-05：完成未提交、编辑占用释放。 | [原文](archive/WF-ledger-context-1009/originals/docs/PARALLEL-REGISTRY.md#近期已释放) | 历史状态与归属见原文 |
| Friday（历史记录 WF-smite-original-rough） | Friday（Codex 惩击原构图粗笔重绘 WF-smite-original-rough），10-05：完成未提交、编辑占用释放。仅ca | [原文](archive/WF-ledger-context-1009/originals/docs/PARALLEL-REGISTRY.md#近期已释放) | 历史状态与归属见原文 |
| Friday（历史记录 WF-cardlib-term-colors） | Friday（Codex 卡牌库词条数字分色 WF-cardlib-term-colors），10-05：完成未提交、编辑占用释放。仅gam | [原文](archive/WF-ledger-context-1009/originals/docs/PARALLEL-REGISTRY.md#近期已释放) | 历史状态与归属见原文 |
| Friday（历史记录 WF-sealed-limbs-transparent） | Friday（Codex 四封印肢体透明重绘 WF-sealed-limbs-transparent），任务开始10-04：完成未提交、编辑 | [原文](archive/WF-ledger-context-1009/originals/docs/PARALLEL-REGISTRY.md#近期已释放) | 历史状态与归属见原文 |
| Friday（历史记录 WF-dragonblade-original-rough） | Friday（Codex 青龙偃月斩原构图重绘 WF-dragonblade-original-rough），10-05：完成未提交、编辑占 | [原文](archive/WF-ledger-context-1009/originals/docs/PARALLEL-REGISTRY.md#近期已释放) | 历史状态与归属见原文 |
| Friday（历史记录 WF-character-cover） | Friday（Codex 全屏选人同款美术 WF-character-cover），10-04：完成未提交、编辑占用释放。属地 game/c | [原文](archive/WF-ledger-context-1009/originals/docs/PARALLEL-REGISTRY.md#近期已释放) | 历史状态与归属见原文 |
| Friday（历史记录 WF-heixiang-two-forms-rough） | Friday（Codex 圣剑/青龙原构图粗笔重绘 WF-heixiang-two-forms-rough），10-04：完成未提交、编辑占 | [原文](archive/WF-ledger-context-1009/originals/docs/PARALLEL-REGISTRY.md#近期已释放) | 历史状态与归属见原文 |
| Friday（历史记录 WF-departure-card-size） | Friday（Codex 整备卡牌放大/底部数量与选项栏 WF-departure-card-size），10-04：实现完成待实页查看、编 | [原文](archive/WF-ledger-context-1009/originals/docs/PARALLEL-REGISTRY.md#近期已释放) | 历史状态与归属见原文 |
| Friday（历史记录 WF-bound-shadow-rough） | Friday（Codex 受缚之残影粗笔重绘 WF-bound-shadow-rough），10-04：完成未提交、编辑占用释放。cards | [原文](archive/WF-ledger-context-1009/originals/docs/PARALLEL-REGISTRY.md#近期已释放) | 历史状态与归属见原文 |
| Friday（历史记录 WF-jianghu-rough-reset） | Friday（Codex 江湖救急改粗笔重置 WF-jianghu-rough-reset），10-04：完成未提交、编辑占用释放。card | [原文](archive/WF-ledger-context-1009/originals/docs/PARALLEL-REGISTRY.md#近期已释放) | 历史状态与归属见原文 |
| Friday（历史记录 WF-group-identity-1004） | Friday（Codex 群像人设返修 WF-group-identity-1004），10-04：两遍内置生图候选已展示、完成未提交、编辑 | [原文](archive/WF-ledger-context-1009/originals/docs/PARALLEL-REGISTRY.md#近期已释放) | 历史状态与归属见原文 |
| Friday（历史记录 WF-group-identity） | Friday（Codex 群像人设返修 WF-group-identity-1004），10-04：两遍内置生图候选已展示、完成未提交、编辑 | [原文](archive/WF-ledger-context-1009/originals/docs/PARALLEL-REGISTRY.md#近期已释放) | 历史状态与归属见原文 |
| Friday（历史记录 WF-departure-cover-search） | Friday（Codex 整备仓库五列与检索 WF-departure-cover-search），10-04：实现完成待实页查看、编辑占用 | [原文](archive/WF-ledger-context-1009/originals/docs/PARALLEL-REGISTRY.md#近期已释放) | 历史状态与归属见原文 |
| Friday（历史记录 WF-heaven-face-exact） | Friday（Codex 天剑诛魔脸部严格参考返修 WF-heaven-face-exact），10-04：完成未提交、编辑占用释放。仅ca | [原文](archive/WF-ledger-context-1009/originals/docs/PARALLEL-REGISTRY.md#近期已释放) | 历史状态与归属见原文 |
| Friday（历史记录 WF-wu-two-swords-rough） | Friday（Codex 天剑诛魔脸部严格参考返修 WF-heaven-face-exact），10-04：完成未提交、编辑占用释放。仅ca | [原文](archive/WF-ledger-context-1009/originals/docs/PARALLEL-REGISTRY.md#近期已释放) | 历史状态与归属见原文 |
| Friday（历史记录 WF-home-menu-motion） | Friday（Codex 全界面统一动效 WF-home-menu-motion），10-04：完成未提交、编辑占用释放、待老板验收。新增g | [原文](archive/WF-ledger-context-1009/originals/docs/PARALLEL-REGISTRY.md#近期已释放) | 历史状态与归属见原文 |
| Friday（历史记录 WF-studio-cover） | Friday（Codex 照相馆同款美术及性能 WF-studio-cover），10-04：实现完成未提交、编辑占用释放，最新照片大小恢复 | [原文](archive/WF-ledger-context-1009/originals/docs/PARALLEL-REGISTRY.md#近期已释放) | 历史状态与归属见原文 |
| Friday（历史记录 WF-slot-emblems） | Friday（Codex 选档说明移除与徽记重绘 WF-slot-emblems），10-04：完成未提交、编辑占用释放。属地 game/s | [原文](archive/WF-ledger-context-1009/originals/docs/PARALLEL-REGISTRY.md#近期已释放) | 历史状态与归属见原文 |
| Friday（历史记录 WF-slots-cover） | Friday（Codex 选档说明移除与徽记重绘 WF-slot-emblems），10-04：完成未提交、编辑占用释放。属地 game/s | [原文](archive/WF-ledger-context-1009/originals/docs/PARALLEL-REGISTRY.md#近期已释放) | 历史状态与归属见原文 |
| Friday（历史记录 WF-wind-song-abstract） | Friday（Codex 浪掷风吟抽象背景返修 WF-wind-song-abstract），10-04：完成未提交、编辑占用释放。同名替换 | [原文](archive/WF-ledger-context-1009/originals/docs/PARALLEL-REGISTRY.md#近期已释放) | 历史状态与归属见原文 |
| Friday（历史记录 WF-survival-guide-cover） | Friday（Codex 生存指南同款改造 WF-survival-guide-cover），10-04：完成未提交、编辑占用释放。属地 g | [原文](archive/WF-ledger-context-1009/originals/docs/PARALLEL-REGISTRY.md#近期已释放) | 历史状态与归属见原文 |
| Friday（历史记录 WF-rundata-cover） | Friday（Codex 跑局数据同款美术 WF-rundata-cover），10-04：完成未提交、编辑占用释放。属地 game/css | [原文](archive/WF-ledger-context-1009/originals/docs/PARALLEL-REGISTRY.md#近期已释放) | 历史状态与归属见原文 |
| Friday（历史记录 WF-inbox-cover） | Friday（Codex 留言界面同款美术 WF-inbox-cover），10-04：完成未提交、编辑占用释放。属地 game/css/p | [原文](archive/WF-ledger-context-1009/originals/docs/PARALLEL-REGISTRY.md#近期已释放) | 历史状态与归属见原文 |
| Friday（历史记录 WF-wu-cards-integrate-1004） | Friday（Codex 接入无今日职业卡 WF-wu-cards-integrate-1004），10-04：完成未提交，编辑占用释放。来 | [原文](archive/WF-ledger-context-1009/originals/docs/PARALLEL-REGISTRY.md#近期已释放) | 历史状态与归属见原文 |
| Friday（历史记录 WF-wu-cards-integrate） | Friday（Codex 接入无今日职业卡 WF-wu-cards-integrate-1004），10-04：完成未提交，编辑占用释放。来 | [原文](archive/WF-ledger-context-1009/originals/docs/PARALLEL-REGISTRY.md#近期已释放) | 历史状态与归属见原文 |
| Friday（历史记录 WF-settings-cover） | Friday（Codex 设置页同款美术 WF-settings-cover），10-04：完成未提交、编辑占用释放，老板反馈“非常好”。属 | [原文](archive/WF-ledger-context-1009/originals/docs/PARALLEL-REGISTRY.md#近期已释放) | 历史状态与归属见原文 |
| Friday（历史记录 WF-ach-proportion） | Friday（Codex 成就比例修正 WF-ach-proportion），10-04 21:04：完成未提交，编辑锁释放。仅 game/ | [原文](archive/WF-ledger-context-1009/originals/docs/PARALLEL-REGISTRY.md#近期已释放) | 历史状态与归属见原文 |
| Friday（历史记录 WF-home-composition） | Friday（Codex 主页构图重构及续修 WF-home-composition），10-04：完成未提交、编辑占用释放。属地 game | [原文](archive/WF-ledger-context-1009/originals/docs/PARALLEL-REGISTRY.md#近期已释放) | 历史状态与归属见原文 |
| Friday（历史记录 WF-home-snow-wallpaper） | Friday（Codex 主页构图重构及续修 WF-home-composition），10-04：完成未提交、编辑占用释放。属地 game | [原文](archive/WF-ledger-context-1009/originals/docs/PARALLEL-REGISTRY.md#近期已释放) | 历史状态与归属见原文 |
| Friday（历史记录 WF-volcano-v4-reference） | Friday（Codex 通用画风提取与充能火山独立候选 WF-volcano-v4-reference），10-04：完成未提交、编辑锁释 | [原文](archive/WF-ledger-context-1009/originals/docs/PARALLEL-REGISTRY.md#近期已释放) | 历史状态与归属见原文 |
| Friday（历史记录 WF-home-minako-layout） | Friday（ZCode 本会话，首页米娜可式排版重做 WF-home-minako-layout），10-04：完成未提交、编辑锁释放，待 | [原文](archive/WF-ledger-context-1009/originals/docs/PARALLEL-REGISTRY.md#近期已释放) | 历史状态与归属见原文 |
| Friday（历史记录 WF-baita-lore-raving） | Friday（Codex 博览者狂语重绘 WF-baita-lore-raving），10-04：v6完成未提交、编辑锁释放。仅 cards | [原文](archive/WF-ledger-context-1009/originals/docs/PARALLEL-REGISTRY.md#近期已释放) | 历史状态与归属见原文 |
| Friday（历史记录 WF-photo-studio-unified） | Friday（Codex 照相馆统一UI WF-photo-studio-unified），10-04：完成未提交、编辑锁释放，待老板验收。 | [原文](archive/WF-ledger-context-1009/originals/docs/PARALLEL-REGISTRY.md#近期已释放) | 历史状态与归属见原文 |
| Friday（历史记录 WF-stop-servers） | Friday（Codex 关闭多余服务器 WF-stop-servers），10-04 20:52：老板明确授权“停掉现在所有服务器，只留5 | [原文](archive/WF-ledger-context-1009/originals/docs/PARALLEL-REGISTRY.md#近期已释放) | 历史状态与归属见原文 |
| Friday（历史记录 WF-feedback-title-batch-1005） | Friday（ZCode 本会话·留言批处理 WF-feedback-title-batch-1005，三子代理分批），10-05 完成未提 | [原文](archive/WF-ledger-context-1009/originals/docs/PARALLEL-REGISTRY.md#近期已释放) | 历史状态与归属见原文 |
| Friday（历史记录 WF-feedback-inbox-polish） | Friday（ZCode 本会话·留言批处理 WF-feedback-title-batch-1005，三子代理分批），10-05 完成未提 | [原文](archive/WF-ledger-context-1009/originals/docs/PARALLEL-REGISTRY.md#近期已释放) | 历史状态与归属见原文 |
| Friday（历史记录 WF-title-visuals） | Friday（ZCode 本会话·留言批处理 WF-feedback-title-batch-1005，三子代理分批），10-05 完成未提 | [原文](archive/WF-ledger-context-1009/originals/docs/PARALLEL-REGISTRY.md#近期已释放) | 历史状态与归属见原文 |
