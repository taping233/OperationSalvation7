# 公共页面层性能核查

本轮修改标题时钟和公共卡面缓存；其余菜单入口复用已存在的按需加载、事件更新和取消机制。基线是本轮编辑前工作树原字节，见 `baseline/`，不以 HEAD 代替已有未提交实现。

## 修改与对照

| 热点 | 修改前 | 修改后 | 证据范围 |
| --- | --- | --- | --- |
| 单一卡对象的动态费用/加伤 HTML 变体 | Map 随不同参数持续增长 | 每卡最多保留最近生成的 32 份；重复命中不重建，淘汰后按当前参数重建 | 同一卡 1,024 组不同参数，保留条目 1,024→32，1,024 组输出相同；热变体连续调用 100 次零重建；重访淘汰项结果相同 |
| 不可见标题时钟 | 每秒仍唤醒一次；版本字串无变化也写 DOM | 被整页覆盖、壁纸模式、名单弹窗、离开标题、隐藏文档及 pagehide 时停表；恢复仅启动一份；时间/版本仅变化时写入 | 受控隐藏 60 秒回调 60→0；所有恢复、重复 pageshow 和覆盖切换通过 |

上述是操作数与保留条目预算，不代表浏览器 RSS、GPU 驻留或整机 FPS 的实测降幅。

## 页面入口覆盖

| 页面/公共通路 | 当前源码 | 核查结果 |
| --- | --- | --- |
| 标题、壁纸、制作名单 | `game/src/ui/home-fx.js`、`title-wallpaper.js`、`title-credits.js` | 本轮停掉不可见时钟；指针视差已按帧合并，壁纸无额外 JS 绘制循环 |
| 存档选择/续局/离开确认 | `game/src/ui/game.menu.js`、`game.menu.pages.js` | 叶页面动态加载，入口可取消；确认动作与存档不改 |
| 设置及分类 | `game/src/ui/game.menu.pages.js`、`settings-navigation.js` | 控件事件即时更新，未发现常驻轮询；保留性能/音量语义 |
| 留言/数据页 | `game/src/ui/game.menu.pages.js`、`page-entry-cancellation.js` | 请求在打开/操作时执行；数据页观察器只观察直接子层，关闭时断开；不调用写留言/清档动作 |
| 新手指南 | `game/src/ui/beginner-guide.js` | 切页更新现有节点，无常驻绘制 |
| 成就陈列室 | `game/src/ui/achievement-gallery.js`、`achievement-motion.js` | 搜索/筛选驱动，保留滚动锚点；动画支持取消，不增加跨状态缓存 |
| 共用卡面、详情、术语 | `game/src/cards/cards.view.js`、`game/src/ui/ui.js`、`term-tips.js` | 本轮限制变体缓存；描述已内容去重；悬浮跟随只在提示打开时运行 |
| 转场、加载与覆盖 | `game/src/ui/page-loading.js`、`page-visual-ready.js`、`overlay.js` | 已有信号取消、期限、首屏代表图等待和不透明全屏暂停；不重复改造 |
| 声音公共层 | `game/src/audio/sound.music.player.js`、`sound.samples.player.js`、`sound.scape.js` | 长曲媒体后端、短音效缓存和可见性暂停保持；本轮无音频变更 |

## 定向验证

- `node node_modules/vitest/vitest.mjs run tests/page-perf-shared.test.js tests/runtime-hotpaths.test.js tests/card-face-presentation.test.js tests/home-menu-motion.test.js --reporter=dot`：4 文件、36 项通过。
- 菜单按需入口、设置、指南、取消、标题资源与卡面阅读定向：实际命中 6 文件、44 项通过，运行时间 2026-10-18 14:43（北京时间）。
- `git diff --check`：本轮文件无空白错误；Git 提示既有 CRLF 将规范为 LF，不代表失败。

实页覆盖和集成结论由父目录记录；受控 jsdom/VM 计数不替代真实浏览器帧率测量。
