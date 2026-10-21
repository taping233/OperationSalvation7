# G2 注能遮挡返修

状态：源/CSS 修复与定向反馈完成，待父会话同步冻结副本并在当前窗口复验。依据为父会话当前原生 1523×956 内置窗口截图 `infusion-empty.png`；本子代理只读取该本地图，未启动或操纵浏览器。

## 原因与修复

- `#unitFrames` 是 overlay 直属宿主，拥有自己的 stacking context，位于 `.card.battle` / stage 之上。提高舞台内部卡牌层级不能盖过它。注能渲染现在调用现有 `hideUnitFrames()` 并暂停 attach，取消注能后恢复既有 attach 路径。
- 注能时隐藏原单位前景和已锁定的旧战术/道具/牌堆 HUD；只作用 `data-infusion-mode`。overlay 直属 frames 与场景 foreground 也有该模式下的 scoped 可见性约束；战场背景 world 保留，未增加全局 z-index。
- 原始脚下血条不再与确认按钮重叠。主卡、已选区和候选区外的顶部 24 px 带保留当前单位名称、生命/护甲和意图。信息从本轮已更新的真实单位 DOM 克隆，移除操作属性，作为只读状态条；意图没有展示时保留现有状态/攻击读数。没有新增领域规则或目标。

## 实际反馈

| 检查 | 结果 | 退出码 |
| --- | --- | --- |
| `npm run test:target -- tests/battle-infusion-action-layout.test.js tests/sts2-cast-layout-1021.test.js` | 2 文件、47 例通过；含新增暂停 frames / 顶部实时血量意图 / 取消后恢复 attach 集成例 | 0 |
| `node node_modules/vitest/vitest.mjs run tests/battle-infusion-action-layout.test.js -t suspends --reporter=dot` | 新增 scoped 前景契约后 2 例通过、40 例未选取 | 0 |
| runtime 全域 tsc | 通过 | 0 |
| 两个修改源 JS 与既有测试的目标 ESLint | 通过 | 0 |
| 返修路径 `git diff --check` | 通过；仅 CRLF→LF 提示 | 0 |

## 精确源字节

`layout-g2-source/` 保存这次三个修改源/CSS 文件的逐字节副本，目录内 `sha256.json` 记录相对路径、字节数和 SHA256。父会话可从此目录同步冻结预览，只需复制这三个文件；未修改发现、道具模块、core/aim/selection/runtime。

原 `layout-source.diff` / `layout-sha256.json` 是初次交付指纹，不代表这次 G2 返修后的三个文件。当前视觉是否已消除遮挡、顶部状态条是否完整、真实输入与其他模式恢复仍由父会话内置当前窗口复验；本子代理未作实页通过结论。
