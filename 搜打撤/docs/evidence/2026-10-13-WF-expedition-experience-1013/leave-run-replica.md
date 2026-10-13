# 离开对局与放弃确认

状态：结构与定向回归完成，当前窗口实页待主代理复核。未操作本聊天浏览器标签。

## 真实参考

- 源页面：[原神深境螺旋攻略 / GameWith](https://gamewith.jp/genshin/article/show/231031)
- 实机原图：[深境螺旋离开确认](https://img.gamewith.jp/img/e24c253db888d98b44e60e492f409037.jpg)
- 本地证据：`reference-images/genshin-abyss-leave.jpg`，25,140 字节，直接下载公开原图后通过 `view_image` 查看，未修改。
- 直接观察：对局画面在背景保留；中央浅色面板只有一个标题；说明区与底部动作区分开；暂离与放弃分别说明后果。左上红圈/箭头属于攻略标注，不属于游戏设计。
- 动态未核实：静帧不能证明原作进入/离开时长或二次确认流程。

映射到本作：沿用真实参考的中央浅色对话面板、单标题和清楚的动作分层，使用本轮灰蓝/青色语义。保存退出为主操作，继续游玩为安全返回，放弃移到底部弱入口。放弃的详细损失只在独立二级确认里出现一次。

## 实现

- 离开初页只显示档位/地点、保存后如何继续以及主次动作，不再无条件声称“已经自动保存”。
- 保存退出读取原有 `saveGame()` 结果：只有 `true` 才回主菜单；失败、跳过保存或异常保留对局与面板，显示明确未保存状态，可重试或继续游玩。
- 保存处理中禁用所有动作，阻止重复保存、取消与放弃交叉触发；成功前不隐藏面板。
- 放弃不再通过 2.6 秒定时改字确认；独立页面一次说明失去哪些物品、安全格保留哪些物品，默认焦点在安全返回。
- 放弃二级确认返回后，旧确认回调失效；实际终局搬运/落库仍调用原有 `abandonRun()` 与 `runTerminalSettlement()`，保持幂等和存档规则。
- 放弃后的完成面板复用同一视觉外壳，安全格带回卡面与返回基地/主菜单动作保留。
- 按钮按压使用现有 motion token；面板开/关使用现有 `glass/confirm` 生命周期，不给父子层重复添加入场动画。同一 `glass` 步骤切换的共用动画重播已向主代理交接。

## 文件

- `game/src/ui/game.menu.js`：仅增加专属 CSS 导入及离开/放弃相关展示与 handler。
- `game/css/leave-run.css`：全部规则限定 `.leave-run-panel` 及包含它的弹层。
- `tests/leave-run-menu.test.js`：新增保存结果、防双击、二级确认及过期回调回归。
- `tests/terminal-settlement.test.js`：适配独立确认动作，继续验证安全格搬运幂等。

未改变全局 base/home、设置页、保存算法、终局落库协议或桌面退出应用逻辑。未修改 `overlay.js` / `ui.js` 生命周期。

## 验证

`npm run test:target -- tests/leave-run-menu.test.js tests/terminal-settlement.test.js tests/r5a-session-menu.test.js tests/menu-recovery-entry.test.js tests/contracts.test.js tests/architecture-boundaries.test.js`：6 文件、53 项通过。

测试覆盖：打开不声称已保存、继续不保存/不放弃、保存失败留页、重试成功后退出、处理中重复输入拦截、未关联档位/undefined 不伪装成功、放弃独立二级确认、返回后旧确认失效、实际放弃安全格搬运一次、既有菜单和会话保存回归。

待复核：当前窗口主离开面板、二级确认的层级与留白，真实继续/返回输入与共用开关过渡。截图可以在二级确认返回，不要求实际放弃当前跑局。
