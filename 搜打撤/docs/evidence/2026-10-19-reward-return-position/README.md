# Return to the same reward and backpack position

From 5edd48830653d939984c6ea8dea8f734106fb180:
- Returning from reward organization or the full backpack restores the original card-list scroll and selected card focus. Reopening the same box preserves position. This uses an ephemeral per-box WeakMap, never save data.
- Abandon confirmation focuses the safe keep/reconsider button.
- Pearl box, mage pouch and discard confirmation return to the original backpack scroll position and card. If the discarded stack disappeared, focus moves to a remaining neighbour; cancelled discard changes no inventory. Return state is scoped to the same run and inventory instance.
- The existing engineering plan records the requested batch-first workflow and resource-consumer review check.

## Resource regression correction
The preceding build (run 39211577184) grew 212.04 to 231.44 MiB. Its log identifies changed chests selectors; the safe fallback retained 109 reviewed legacy assets. This increment belongs to the preceding batch, not old budget debt.

Re-reviewed chests.js against the exact previously reviewed SHA256 dbde483382c453fe9c716cc72e102a1f2ed438373bcde179e8d61b17d9ee8d18. The entire delta is DOM scroll/focus preservation and closing-action guards; imports, asset paths, chest artwork configuration and dynamic asset selection are unchanged. Updated only the two fingerprints for this consumer; candidate list, fallback behavior, graph guard and budgets stay intact. Local planning again omits 195 assets with zero warnings. The next remote build must verify the package increment is removed; no final byte-size claim yet.

## Verification and limits
Combined run: 203 pass, one asset-presence check initially blocked by two missing recovery-workspace files. Retrieved those two original winter-arrival images from exact GitHub 5edd488, verified Git blob SHA, and reran both asset suites: 28/28 pass. All 204 distinct assertions are now covered successfully across these runs. No test was skipped or weakened. Syntax, eight type checks and lint passed. Logs retained once per combined run.

The recovered workspace is still partial. Native-browser keyboard, scroll geometry and animation remain unverified. No original art is changed or deleted; restored local originals are not part of this commit. Remote main CI and build are checked after publication.

## Build confirmation and shared help return
Commit 20ee270c build run 39212530677 omitted all 195 reviewed assets and built successfully: package 212.05 MiB (down from 231.44), duplicate bytes 0.13 MiB, entry gzip 335.9 KiB, initial JS gzip 381.6 KiB and CSS gzip 217.5 KiB. The four budgets still fail; the previous 19.4 MiB fallback increase is corrected.

Shared help-return state now restores expanded/collapsed disclosures before scroll layout and refuses to restore focus to disabled/inert/hidden controls. This applies through the existing public help mechanism without per-page patches. Four related suites (118 tests), syntax/types/lint passed; combined-help.log contains the one combined run. Native-browser verification remains outstanding.

## 战斗二级页与公共帮助连续性（2026-10-19）

注能不再将 Ctrl/Alt/Meta+数字及可编辑区域输入当作材料选择；选满后把焦点留在同组详情，折叠摘要刷新保持焦点。选牌、发现、注能、牌堆共用页面活动性检查，旧页回调、覆盖中的战场按钮及关闭动画不再操作当前页；牌堆返回恢复战场入口焦点。公共帮助返回恢复 details 展开/关闭状态，避开隐藏、禁用和 inert 焦点。未修改卡牌成本、选择资格或核心战斗规则。

集中 jsdom/静态回归：17 套中 16 套通过，212 项通过；唯一未完成项为资源存在性检查，本地恢复副本缺少 stage-reset-1015/backdrop.webp 等原始战场图，不能记通过。资源消费指纹检查无警告，原 195 项排除全部保持，无新增资源选择、无预算调整。语法、8 组类型及 lint 通过。真实内置浏览器实页尚未核验；自动 CI 将在准确提交上补全仓库资产与全量测试。详见 combined-battle.log。

## 战斗背包、设置与确认页边界

沿用页面公共守卫到战斗背包、首脑编组、设置/规则返回和致死确认：退出或重开后，旧操作不再存安全格、用道具、结束回合或盖掉新面板；设置旧 DOM 不再改变音频/震动/节奏。安全格仅接受本页展示的合法整组，仍按实时容量检查。先复现五种旧背包回调确实改写 safe 状态，再统一修复；集中 145 项回归、语法/类型/lint 通过，195 项资源排除保持且无警告。实页未核。

前一提交 90d8c32 的生产构建已完成（11.91 秒），包体 212.05 MiB、重复 0.13 MiB、入口 gzip 336.0 KiB、首屏 JS 381.6 KiB、CSS 217.5 KiB；四项预算仍超限，未放宽。入口较20ee的335.9 KiB略增，未出现旧图回流。主CI当时仍运行。

## 收藏与人物招式列表连续性

公共卡牌分页器翻页/筛选后不再将键盘焦点留在隐藏卡或禁用箭头；列数变化时继续显示当前聚焦卡；无结果时焦点落在有标签的列表容器，不抢外部搜索框焦点。人物招式页重开保留页码，重复选择当前类型不回第一页。收藏与招式输入法组词期间不反复筛选，提交文字后统一更新，重复提交同值不重刷。各实例复制临时页码状态，避免共用可变对象。9 套150项定向回归、语法/8组类型/lint通过；资源排除195项无警告。

真实页尝试：当前平台浏览器访问 http://127.0.0.1:5301/ 得到 net::ERR_CONNECTION_REFUSED；Vite在命令自身网络内HTTP200，但跨命令HTTP000。标题背景wallpaper-snow-road-1016.webp本地亦缺失。停止额外诊断服务，未切换外部浏览器，实页仍未核验。前两批90d8c32与69ef10b主CI均成功，后者6371通过/2跳过；预算限制如前。

## 商店价格反馈与收购台阅读层级

核对已有价签差额、免费、容量不足和奖励保留/放弃出口后，未重复改这些既有功能。本批补齐实际成交回执：买入/补货注明此次支出，免费明确未扣币；收购台现场显示卖出收入与余额，不必返回货架才看结果。卡名回执按文本编码，避免被当作HTML。收购规则复用公共折叠说明，保留价格、可售数量和确认卖出主动作。

连续补货保留长规则展开、阅读滚动与原焦点；连续出售保留列表滚动，焦点顺延至下一张可售卡，售空回到返回商店，旧恢复任务不能干扰后续页面。8 套117项通过，语法/8组类型/lint与本文件Stylelint通过；资源排除仍195项、无警告。未改成交价格、容量、可售资格或存档规则。实页依旧受localhost隔离阻塞。此前ee039f0主CI通过（6376过/2跳），构建完成但四项预算仍超限。

## 08:06 UTC 原反馈复核：地图容量与资源选择

已取回用户 2026-10-18 的原 44 条反馈。FB042 地图背包仍有“余 N 格/已满”文本，现改为四段递增图形刻度，保留原数字容量与读屏描述；紧张/已满有颜色与填充形态区别，未新增图片资产。FB006 同类资源二选一明确标题与“选择这张”，不改变选择后永久放弃规则。资源卡特写的“整理背包”原先只关特写，必须再点一次，回归已复现；现先收回特写，一次进入整理，返回保留原候选。

定向首轮 7 套 151 项通过，地图夹具套因恢复工作区缺少 game/dev/map-overview-review.js 无法加载；从 f93c82b 精确读取原 JS/HTML 后补验（见日志）。8 配置 types、两生产文件 syntax、定向 ESLint 与 Stylelint 通过。资源 guard 套通过，无消费者指纹命中、无资源选择变动。平台浏览器 127.0.0.1:5301 连接被拒，图形观感与真实点击仍待验；未以 DOM 测试冒充实页。FB001/018/020/027/034 已无原指向冗余文案，未重复删除；FB039 未指定卡牌，仍不能猜。

## 08:12 UTC 补给整理返回与奖励取消

入城补给满包领取失败时先关闭特写，保留失败提示；从整理返回直接恢复领取页，不重放介绍页，连续往返仍保留未领取卡牌。公共取消按钮推断排除 reward-card/event-choice-card/bt-card 卡面，避免卡名或规则包含“返回/离开”时 Esc 误触查看、选牌；显式 data-cancel 优先保持。修前 3 种卡面反例均失败，修后与补给/资源/闸门/宝箱取消回归合并 9 套 199 项通过。两生产文件 syntax、8 配置 types、定向 ESLint 通过；资源 guard 套保持通过。实页仍受同一连接拒绝阻碍。

商店 f93c82b 主 CI 39219420596：642 文件、6379 通过、2 跳过。构建完成但四预算失败：212.05 MiB / 重复 0.13 MiB，入口336.5 KiB、首屏382.1 KiB、CSS217.6 KiB；相较前批有少量代码/CSS增量，未归为纯旧债。后续62b5192构建212.05 MiB，入口336.5、首屏382.2、CSS217.7 KiB，主CI尚在运行。
