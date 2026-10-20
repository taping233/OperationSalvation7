# 公共浮层键盘可操作范围

## 当前行为

公共浮层的首焦点、Tab 环及 Esc 返回仅使用当前可操作内容。原生 details 的首个直接 summary 是键盘入口；收起后的内容不参与焦点或取消按钮选择，嵌套展开内容仍受外层折叠限制。CSS display:none、visibility:hidden/collapse、inert、hidden、aria-hidden 和原生禁用控件均被排除；visibility:visible 的显式子级覆盖仍可用。禁用 fieldset 的首个 legend 例外保持原生行为。

Esc 保持既有明确取消优先及文案推断规则，不把卡牌规则文本推断成返回操作。没有可用返回动作的强选页不会被关闭。样式读取仅在当次选择中缓存，不跨页面或开合保留，避免折叠后继续使用旧可见性。

## 问题与修复范围

撤离结算的已入库卡牌区和成就页灯光菜单已使用 details。旧焦点列表漏掉 summary，却包含折叠内部按钮，Tab 绕回可落到不可见动作；Esc 使用另一套过滤，可能命中 inert 或 fieldset 禁用按钮。

仅修改 game/src/ui/overlay.js，新增 tests/overlay-disclosure-focus.test.js。由公共可操作判定覆盖以上场景，没有逐页补丁、玩法变动、美术重做或新增依赖。取消探测先筛选语义再检查可见性，避免读取无关卡牌按钮样式；同轮祖先样式去重。

## 定向验证

- 基线：9b0fe799 快照，独立候选目录，无主快照改写。
- 新增 6 个回归在原实现全部失败，修复后全部通过。
- 组合定向：overlay-disclosure-focus、overlay-dialog、battle-secondary-overlay、help-return-lifecycle、bag-help-return-continuity、contracts、architecture-boundaries，共 7 文件 99 项通过。
- 首次组合中 contracts 的两项 Electron 静态输入因副本漏带 desktop-app 与启动器而失败；补齐原始输入后仅重跑 contracts，17 项通过。其余 82 项复用同一源码结果。
- 定向 ESLint：game/src/ui/overlay.js 与 tests/overlay-disclosure-focus.test.js 通过；node --check game/src/ui/overlay.js 通过。
- npm run handoff 的路径限定尝试受缺失 docs/PARALLEL-REGISTRY.md 阻塞。共享登记属地由主任务协调，未创建替代台账。主任务核对本地 190 暂存清单确认本改动路径无重叠。

## 验收边界

以上为 jsdom/静态定向证据，不代表实机或真实键盘验收。当前任务未启动服务或使用替代浏览器；待在当前平台内置浏览器核验：撤离结算折叠已入库卡牌后 Tab/Shift+Tab 绕回、成就灯光 summary 开合、帮助页 Esc 返回后滚动/焦点保持。未运行全量 CI、生产构建、推送或提交。

## 完整基线集成复核

- 独立完整目录 `game-work-9b0fe799` 从已验证的 `9b0fe799` 源码快照复制，原快照不变。独立 Git 的 `27492728782bbb3355e098927156a13d9a917223` 仅为原字节本地快照，不是上游提交或历史恢复；改进保持未提交、未推送。
- 本轮集中执行上述 7 个浮层/哨兵测试及 `video-review.test.js`：8 文件 106 项通过，包含 ffmpeg/ffprobe 合成视频集成检查，无跳过。Electron 静态输入完整，无需拼接复用旧结果。
- 四个变更 JS 文件定向 ESLint、两份实现 `node --check` 通过；`docs:check` 检查 606 个相对链接，零发现；`git diff --check` 通过。
- 依赖复用现有安装，`package-lock.json` 与安装来源副本逐字一致；无网络安装。当前 Node 24.19.0，与 CI 指定 Node 22 不同，结果只代表当前环境。
- 完整基线下路径限定 `npm run handoff` 已通过，相关编辑占用为零。台账由主任务统一协调，本集成只修改六个授权文件。
- 真实内置浏览器、全量 CI 和生产构建仍未验；上面的定向通过不替代这些检查。

## 四组集中复核

录屏覆盖、浮层键盘、手牌旧手势及资源奖励呈现已在同一完整副本合并。去重后 22 个相关 Vitest 文件 310 项全部通过，无跳过；11 个变更 JS 文件定向 ESLint、相关实现语法检查与 docs:check 通过。各组业务源码无文本冲突；仅手势补丁的公共登记文件因本地保护而排除，条目留待主任务结合本地增量合并。原六文件补丁是前一阶段记录，最终交付以本批 17 文件清单为准。

此结论仅覆盖定向自动检查。当前私有预览不是本批源码，真实内置浏览器验收不可用；没有借外部浏览器、CDP 或 headless 绕过。真实鼠标/键盘体验、全量 CI 和构建仍未核验。
