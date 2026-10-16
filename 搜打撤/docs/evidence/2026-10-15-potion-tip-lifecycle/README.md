# 药水提示监听生命周期

## 结论

已修复药水提示的 `document` 终止监听残留。原实现同时注册两个 `once` 回调，正常 `pointerup` 只移除自身，未触发的 `pointercancel` 仍引用旧提示节点。药水栏替换或下一场战斗重建后，这个引用继续保留旧 DOM。本轮证实的是监听/DOM 保留，不宣称 FPS 提升。

## 复现与范围

- 修改前 `battle.view.js` SHA256：`3aeb0ea58bdf7e714c802e451919ecaba31258ca24bf41cccebb7ef18e6fa08a`
- 从当时源码原样提取药水提示绑定段，在 jsdom 中执行 100 次面板替换，每轮普通按下并松开；移除所有面板后，一次后续 `pointercancel` 仍触发 100 次旧提示的 `hidden` 写入，第二次为 0
- 这是受控合成事件与 DOM 复现，未启动浏览器或游戏服务，未访问真实存档，不代表真实输入或帧率测量
- 原始微探针保存在该次执行环境的 `/tmp/audit-potion-listeners.mjs`；持久回归由 [potion-tip-lifecycle.test.js](../../../tests/potion-tip-lifecycle.test.js) 通过真实 `BattleSession` 和 `render` 覆盖

## 修复

- `pointerup`、`pointercancel` 或移开药水时，同时移除两个终止监听
- 复用现有模式/关闭事件，药水栏局部替换、舞台整建及模块卸载时释放活动提示
- 已脱离文档的旧药水节点不能重新注册全局监听
- 没有新增每面板观察器或常驻轮询；保留进入前已有的有效卡显示、注能栏、职业技能及预测 UI 改动
- 自有生产差异见 [selfdelta.patch](selfdelta.patch)，仅涉及 `battle.view.js` 的提示生命周期

## 验证

2026-10-15 UTC 执行：

1. 新增生命周期测试：10/10 通过，包含普通终止、替换/离页/关闭/新舞台、100 轮重建、旧节点和复用悬停
2. 邻近回归：`potion-tip-lifecycle`、`potion-tip`、`battle-entry-view`、`battle-potion-bar-layout` 共 4 文件 28/28 通过
3. 两个源码/测试文件的 `node --check` 与文件级 ESLint：退出码 0

定向命令：

```sh
npx vitest run tests/potion-tip-lifecycle.test.js tests/potion-tip.test.js tests/battle-entry-view.test.js tests/battle-potion-bar-layout.test.js --reporter=dot
node --check game/src/battle/view/battle.view.js
node --check tests/potion-tip-lifecycle.test.js
npx eslint game/src/battle/view/battle.view.js tests/potion-tip-lifecycle.test.js
```

未执行全量、构建和实页。本次没有这些检查的通过结论；集成验收由主会话统一进行。

修改后生产源码 SHA256：`18a09f8477bfec2e922bfcf526a95ec3358ca69db588a6f5ff2fc182011c25ba`

新增测试 SHA256：`973a7243fe0b69fa1ce785ed34a78f31a0ce209a4f98db617dea17b879ed76c9`
