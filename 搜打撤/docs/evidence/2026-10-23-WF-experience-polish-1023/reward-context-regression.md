# 奖励整理会话失效确定性回归

2026-10-23：纠正常规定向测试名称与实际断言范围，并补充三个确定性案例；未发现生产源码缺陷，未修改生产源码。

已有覆盖：`tests/tools/reward-sequences.property.test.js:128` 起使用真实整理器生成随机操作序列，`:142`、`:146` 使用可变 `current`，`:177` 断言失效时奖励、终止回调、移动和丢弃均不增加。本次不是全测试体系缺失该边界；三个明确序列便于日常常规定向门稳定验证，不替代已有 property 覆盖，也未重跑 property。

修改先在隔离副本 `.tmp/polish-1023/project/tests/reward-capacity-organizer.test.js` 完成验证，随后按主代理精确合回授权复制到主线 `tests/reward-capacity-organizer.test.js`；生产源码未修改。

原“领取前再核容量与当前会话”用例实际只改变容量。保留该容量用例，并改名为“领取前容量发生变化时拒绝领取并提示继续整理”。测试夹具的 `current` 改为每例初始化、可真实切换的布尔谓词。

新增三项独立回归：领取、丢弃确认、返回。每项先保证容量足够，进入丢弃确认状态，保留已挂载 DOM 和启用的目标按钮，再仅将会话谓词由 true 切为 false；连续点击旧按钮两次后，背包堆和页面 HTML 不变，领取、丢弃、移安全格、返回与完整背包回调均未调用。各动作独立初始化，避免前一动作的状态变化掩盖后一动作。

验证范围：直接使用生产整理器的隔离副本，核验会话谓词失效后的动作拒绝；没有把这份证据表述为真实换局入口或浏览器流程验证。

执行目录：`搜打撤/.tmp/polish-1023/project`。沿用副本 `vitest.config.mjs` 的 jsdom、forks、单 worker 配置，未修改配置、安装依赖或构建。

命令：

```text
node ../../../node_modules/vitest/vitest.mjs run --config vitest.config.mjs tests/reward-capacity-organizer.test.js
```

结果：1 个测试文件、19 项测试全部通过；退出码 0。原始输出见同目录 `reward-context-vitest.txt`（含 `EXIT_CODE=0`）。

执行后字节核对（SHA256）：

- 主线与副本 `game/src/ui/reward-capacity-organizer.js` 一致：`7C0423BD4CADED968E375DABA69CBF93D49E2C39648A3A45FD7FC66E2A56C2EC`。
- 副本目标测试：`28C20F8BCE988ACD67F113FE51B3AF31592534F62768D5F3794EE35AC008F751`。

## 合回主线

复制前定向核对占用：当前登记没有其他会话对目标测试的定向编辑占用；主线目标测试没有未提交差异，其 SHA256 与 `reward-before-sha.json` 的原件指纹 `ECE4921ED9406498734B657DEA57027BAC7007C918E6A2A137FEAD20C0D36F45` 一致。复制前再次断言原件及已验副本指纹，任一不符即停止。

本轮只合回该单测试文件。合回后主线与副本 SHA256 均为 `28C20F8BCE988ACD67F113FE51B3AF31592534F62768D5F3794EE35AC008F751`。目标整理器及其完整静态导入链 `reward-scene-view.js`、`shared.js` 的主线/副本字节也分别一致；本轮沿用同一主线 `node_modules`，没有安装、更新或修改依赖。原19项定向测试输入和模块未变化，按授权复用既有通过证据，不重复运行测试。

主线定向静态验证均通过（退出码0）：

```text
node node_modules/eslint/bin/eslint.js tests/reward-capacity-organizer.test.js
node --check tests/reward-capacity-organizer.test.js
git diff --check -- tests/reward-capacity-organizer.test.js
```

字节与合回收据见 `reward-context-merge.json`；静态检查退出码见 `reward-context-static.txt`。

未覆盖：真实换档/换局入口如何使上游奖励会话失效、跨页面完整返回流程、浏览器实际输入及全量回归。本次只证明整理器在收到 false 会话谓词时拒绝旧按钮动作；不推断真实入口均已验收。未运行构建，未提交或推送，未修改共享台账及其他会话生成资源。
