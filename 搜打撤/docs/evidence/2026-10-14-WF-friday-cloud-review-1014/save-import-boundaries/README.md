# 存储、备注与导入边界定向审查

核验时间：2026-10-13 UTC。仅使用独立导出工作区与假 Storage，不读取或写入玩家真实存储。

## 本次完成

1. 照片备注写入失败不得显示“已存档”。旧 `savePhotoNote` 字符串返回保持兼容；结果接口明确返回 `persisted`。未落盘的编辑和清空留在本次会话，重新打开及导出仍可获取，成功重试会一并保存其他待落盘编辑。原备注库损坏或读取失败时拒绝覆盖原串。
2. 新档/覆盖重开必须先确认基地初始化落盘。`Base.reset` 返回 `false` 时保留选档界面、标题及游戏活动档位，显示错误，不打开基地或记录进入成功；允许同页重试。
3. 结点备注仅接纳 JSON 记录，真正缺档仍允许创建。数组、标量、空串、坏 JSON 或读取失败返回 `false` 给既有编辑 UI，保留原串；不会把数组的非索引属性误报为持久化成功。

编辑：`game/src/cards/card-photo-notes.js`、`game/src/core/notes.js`、`game/src/hub/game.cardslib.page.js`（仅备注接线）、`game/src/ui/game.menu.js`（仅新档/覆盖初始化门禁）、`game/src/ui/ui.js`（仅备注状态）；对应四份测试。

## 独立故障复核

- 照片备注原实现：模拟配额错误，保存返回非空字符串，但立即读取为空，UI 会误报成功。修复后由定向测试确认 `persisted:false`、会话保留、重试及导出。
- 结点备注原实现：原串 `[]`，`Notes.set` 返回包含编辑的成功对象，实际保存仍为 `[]`。修复后同一源代码 VM 探针返回 `false`，原串 `[]` 保留。
- 新档原实现：真实菜单控制器搭配 `Base.reset:()=>false`，仍打开基地且记录进入成功。修复后同一探针确认基地打开次数为 0、无成功日志、原选档页仍存在并显示初始化失败。
- 基地读失败缺陷另由基地存储工作项修复：假 Storage 中已有 150 币、revision 0，读取基地键失败而写入可用；原实现把缺失误判为初始状态并允许提交 2 币。独立复核修复后读取及提交均失败，原 150 币保留。

## 实际验证

外置 Vitest 配置使用已有依赖；没有执行 npm pretest 或构建。9 文件、107 项通过：

- card-photo-notes
- photo-zoom-lifecycle
- card-notes-coverage
- menu-recovery-entry
- cell-notes-quota
- save-compat
- base-storage-read-failure（基地工作项的跨项复核）
- contracts
- architecture-boundaries

九个修改文件的定向 ESLint 与 `git diff --check` 通过。原始 Vitest 输出见 `targeted-tests.log`。

未执行实页、全量测试、构建、安装、暂存、提交或推送。UI 状态文案的当前内置浏览器复核由父任务统一验收。

## 边界审查结论

- 运行中对局/基地没有发现当前可用的通用存档 JSON 导入界面。
- 卡牌 JSON 导入受 `CARD_DESIGNER_WRITES_ENABLED=false` 禁用；结点备注导入/导出函数仍保留，但当前 HTML 不包含其按钮；不把这些休眠路径的问题当成现行用户攻击入口。
- tooltip 展示按现有产品要求整体空转；旧悬停文案不是当前渲染入口。
- 检查到的现行图片/音频映射以内置路径、清单或冻结映射为主；本次没有确认现行外部可达的 DOM 注入或资源载入漏洞。此结论仅对应已读边界，不代表全项目安全认证。
