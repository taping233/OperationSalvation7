# 最小安全修复交付

## 当前结果

按父线程批准的范围完成工作树修复，未提交。奥术弹普通战现在能预览确定的直接伤害，明确说明抽牌替代和未计后续触发；先前漏算却标精确的动态参数、多 damage、引擎额外命中修正均保守降级。普通单次、多段、AOE 当前目标的确定伤害继续可用。

没有改真实 resolver、Combat、卡牌定版数据、实际规则、forecast 公式或 view/layers/CSS。没有操作浏览器、实机存档或实机状态，没有 build、提交、推送。会话回归只在 Vitest 进程的独立 BattleSession 夹具中恢复/执行，未接触父线程操控的页面。

## 独占归属

- `game/src/battle/view/battle.preview.js`：完整扫描 damage 列表、明确键白名单、未知来源/段数/目标/附加伤害降级；保留确定伤害和后置效果说明；奥术弹窄 hosted 支持
- `game/src/battle/core/battle.core.js`：从既有 hosted 适配器取得执行视图；复制 mode/验证标志；补 bleedAmp、装备 vsFreeze、未复活特殊生命流程的只读降级标志，扫描可能转向的活敌
- `game/src/battle/battle.snapshot.types.d.ts`：只读预览上下文及规格说明类型同步
- `game/src/battle/view/battle.hover.js`：主标题“精确伤害”改为“直接伤害”；沿用现成 unknownEffects 展示副文案
- `tests/battle-preview-trust-boundary.test.js`：新增独立信任边界测试
- `tests/r3-a-preview.test.js`：新增真实 BattleSession 对照与 jsdom hover 文案回归
- 本证据目录：审查、修复与验证证据

精确差异见 `fix.patch`；含新增正式测试，不包含其他 worker 的工作树改动。最终输入指纹见 `fix-source-baseline.json`。

## 实际验证

- 定向 8 个文件、191 用例全通过，见 `fix-target-tests.txt`
  - 新 trust-boundary：未支持 damage 键、多个 damage、后置伤害/新 op、段数与来源形状、普通确定伤害保留、奥术弹身份/hosted/模式边界、100 次无 RNG/输入副作用
  - r3-a：保留原直接伤害/多段/防御矩阵；新增奥术弹运行时 dmg 与定版执行文本一致性、法伤+祝福、普通战获得初始攻击、全灭后不抽牌、BOSS 降级、真实装备 vsFreeze 和 bleedAmp 降级、后续转向目标修正、实际 hover 文案
  - 近邻：battle-preview-amount、multi-hit-retarget、battle-resolution
  - 哨兵：contracts、architecture-boundaries、battle-snapshot-types
- 项目语法检查通过，425 个项目文件，见 `fix-syntax.txt`
- 项目 typecheck 的 8 个配置均通过，见 `fix-typecheck.txt`
- 对本任务 3 个 JS 生产文件和 2 个正式测试文件执行 ESLint，通过，见 `fix-lint.txt`（无报错输出）
- 自有 diff 空白检查通过

执行的定向命令：

```sh
node node_modules/vitest/vitest.mjs run tests/battle-preview-trust-boundary.test.js tests/r3-a-preview.test.js tests/battle-preview-amount.test.js tests/multi-hit-retarget.test.js tests/battle-resolution.test.js tests/contracts.test.js tests/architecture-boundaries.test.js tests/battle-snapshot-types.test.js --reporter=dot
npm run --silent check:syntax
npm run --silent typecheck
node node_modules/eslint/bin/eslint.js game/src/battle/view/battle.preview.js game/src/battle/core/battle.core.js game/src/battle/view/battle.hover.js tests/battle-preview-trust-boundary.test.js tests/r3-a-preview.test.js
```

## 仍然明确限制的边界

- 爆燃火球的法伤倍率、充能射线的累计注能、暗影射击的第二条件段暂时显示 unknown；本补丁封住伪精确，不扩写它们的结算
- 奥术弹只放行普通战、稳定 ID 与唯一 hosted 名称、已通过既有适配器取得的定版执行语义；BOSS 战及额外规则仍 unknown。运行时正数 dmg 会跟随实际字段，不硬编码 1
- 存在 bleedAmp / 合法装备冰冻增伤 / 未复活特殊生命流程时可保守降级，可能覆盖比当前单目标稍宽的范围，以保护多段转向
- 直接伤害后的附加效果不计入该数字；副文案显式说明。不会试跑真实规则或 RNG 来“猜”抽牌结果
- 历史 `repro.test.js` 是修复前缺陷复现，不是修复后的回归集；它的原始运行结果和输入指纹已保留，修复后应运行正式 trust-boundary/r3-a 测试
- 未运行全量测试、build、浏览器或远端 CI。父线程需在其当前真实窗口补奥术弹目标数字与结果的实页核对；forecast 主标签由另一任务负责
