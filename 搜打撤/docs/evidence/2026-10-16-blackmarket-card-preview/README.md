# 黑市投入前卡牌详情

黑市投入前的三张小卡现在可点击，复用远征奖励页的标准卡牌大图。实现与代码验证完成；当前窗口自然黑市的视觉与真实键盘输入仍由父会话补验。

## 实现

仅修改 `game/src/run/game.run.flow.js` 的 `openEventGamble()`：

- 三张 `div.bt-card` 换成原生 `button.bt-card.event-choice-card`，加逐张「放大查看卡名」名称与 dialog 提示
- 显示「点击卡牌放大查看」提示，直接复用已有按钮样式
- `eventGambleRead` 经过原 `settled` / `active()` 检查后打开 `UI.showCardZoom()`，传来源与返回焦点，不挂交易 footer
- 关闭不调用黑市 render，不更换三张候选，不读随机，不收费，不保存

本轮没有修改 ui.js、CSS、投币逻辑、概率、第五次保底或待领奖持久化。通过反向去除本轮最小增量，`flow.js` 字节哈希与编辑前基线完全一致，确认保留已有事件恢复及其他接线改动。

## 验证

- 7 文件、116 项定向 Vitest 全部通过，含新增黑市详情专测 8 项
- 专测使用实际共用 `UI.showCardZoom()`，不是详情桩：三张详情显示原奖品及 lg 卡面，Esc / 关闭按钮 / 背景收回后返回原按钮焦点，底层 inert 正常解除
- 连续查看 9 次：原黑市 DOM、金币、尝试次数、候选与状态保持；没有 render、save 或 random 调用
- 四次失败、详情开关与背包返回后，第五次仍保底、只扣 3 币、原三张进入待领；旧详情回调无法在成功后覆盖待领页
- 离开、换页、新局、换节点及越界索引不会打开失效奖品
- 事件恢复、事件节点绑定、共用大图生命周期、架构边界与契约回归一起通过
- ESLint（改动源码与新测）、两文件 node --check、自有 diff --check 均通过

命令与输出：

- `test-targeted.log`：完整 7 文件定向输出
- `static-checks.log`：静态检查退出码
- `self-delta.patch`：仅本轮生产增量
- `read-only-baseline.sha256` / `delta-verification.json`：原改动保留与未碰 CSS / ui.js 的哈希核对
- `test-first.log`：首轮 7/8 通过；失败是测试错误假定招式抽取顺序，已改为按实际卡 id 验证，未调整生产随机逻辑

## 未核范围

未运行浏览器、服务、build 或项目全量测试；没有提交。jsdom 的 click 与键盘事件是合成输入；原生 button 的真实 Enter / Space 激活、当前窗口排版、hover/focus 外观及交易按钮不被遮挡，需下一自然黑市场景复验。父当前成功待领现场不倒退或重造事件。
