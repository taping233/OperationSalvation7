# M06 收藏目标、来源与出征准备交付

## 交付范围

本包新增目标／预设领域命令、只读来源证据、纯预览与可挂载 DOM 组件。只写 M01 已预留的 `goals.tracked` 和 `goals.presets`；不修改仓库、人物、宠物、皮肤、对局键或 RNG。

主要接口：

- `preparation.commands.js`：`getPreparation(baseSnapshot)`、`createPreparationCommands(deps)`、`setTrackedGoals`、`savePreset`、`previewDeployment`、`startDeployment`。
- `preparation.sources.js`：`getSources(targetId,catalogVersion,cardCatalog)` 和 `SOURCE_EVIDENCE`。
- `preparation.view.js`：`buildPreparationViewModel(input)`；`mountPreparationView(root,{model,onIntent})` 返回 `update(nextModel)`、`dispose()`。
- `preparation.css`：局部 `.preparation-module` 样式，不修改公共 CSS。

最多保存三个去重目标。预设 ID 固定为 `preset-1`、`preset-2`，默认名“猛攻／跑刀”只作为可编辑名字。picks 使用稳定 `{card:{cardId,variantKey?},count}`；相同 CardRef 合并数量，显示名不参与身份。

## 预览与应用口径

`previewDeployment` 每次读取调用方给的最新 `baseSnapshot`，按稳定卡 ID 汇总仓库数量，分别输出：

```js
resolvedPicks: [{
  card, name, requestedCount, availableCount, appliedCount,
  status: 'ready' | 'missing' | 'forbidden'
}]
```

缺一张与全缺分别保留准确 `availableCount/missingCount`；职业卡固定 `CLASS_CARD_FORBIDDEN`。人物和宠物同时报告 ID 是否存在、当前档是否拥有。查询不扣卡、不保存、不调用 RNG。应用到旧整备选择时只能使用完整 `ready` 项；预览后、真正应用前必须以最新快照重验，不能静默减量或换卡。

`buildPreparationViewModel` 把最新基地快照、预设、卡库、人物、宠物和背包容量投影为共享 UI model。组件通过 `onIntent({type,payload})` 上送 `goal-add/remove`、`preset-field`、`preset-pick-add/remove`、`preset-preview/apply/start`；组件自身不写业务状态。`dispose()` 移除监听器并清空自己渲染的 root。

## 来源证据

- 普通可随机卡：对应 `Cards.isRandomObtainable` 与基地商店候选过滤；显示“进入候选池不代表本次必得”。
- 职业卡：对应 `Cards.classPool`，以及 `chests.js`、`game.run.altar.js` 的实际职业池调用；要求对应人物职业，不显示保证获得。
- 能力卡：只在代码确有按职业筛选能力卡候选时标记已知。
- 事件、衍生、被 `unrandom` 排除且没有可靠专属条件的条目：明确“来源未确认”。不由卡名或稀有度猜掉率。

## M06-A～D 状态

- **M06-A：模块完成**。第四项目标返回 `GOAL_LIMIT` 且不写档；重复去重；两预设可改名、人物、宠物和愿望 picks。M01 的档位提交门面负责切档隔离与持久收据。
- **M06-B：模块完成**。有货、缺一、全缺、职业禁带、人物宠物资格均有结构化预览；测试连续预览十次不改快照、不调用 RNG。
- **M06-C：部分完成**。应用前可用最新快照重验；`startDeployment` 只接受注入的 M11 门面，缺失返回 `DEPENDENCY_UNAVAILABLE`。M11 替身路径已测，但真实跨键提交、跨重启重复开局只生成一个 runId 仍待 M11，不能宣称通过。
- **M06-D：模块完成**。展示来源逐项映射实际代码证据；无证据显示未知。后续卡池规则变更时需同步这张证据表。

## 验证与接入状态

定向命令：

```text
npx vitest run tests/m06-preparation.test.js tests/m06-sources-view.test.js --no-file-parallelism
```

结果：2 个文件、6 项通过。覆盖目标上限、预设、四种库存状态、查询纯度、M11 依赖边界、来源证据、model 构造和 DOM 挂载／更新／销毁。

M05 独占 `game.hub.js` 接线。本包交付组件与协议，不修改旧出征流程；在 M11 接入前，旧确认出发必须继续可用，M06 的 `preset-start` 只能说明依赖尚未就绪。皮肤只读取 M02 状态，不新增保存字段。未执行 build、全量测试或正式跨重启开局验收。

## 根任务最终复验（覆盖上方阶段状态）

详见 `../MODULES-01-06-RESULTS-2026-09-21.md`。已修复 hub 将读模型 id 映射为 savePreset 要求的 presetId；实机方案改名 QA 已持久保存，追踪目标重进保留，空合法方案可应用到原整备页。已移除界面上的 preset-start 按钮，API 仍保留依赖边界。人物/宠物仍需按原流程确认，界面已明确说明。最终本批 9 文件 37 测试通过；M06-C 的 M11 跨键事务仍未验收。
