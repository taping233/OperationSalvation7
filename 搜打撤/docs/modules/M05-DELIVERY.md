# M05 2.5D 基地场景与交互交付

## 范围与基线

- 契约：`GAME-MODULE-CONTRACTS-2026-09-21.md` v1.0 §8、§17、§18。
- 源码基线：`master` / `2dfec66`，保留工作区其他未提交任务；本包未 build、未 commit、未清理。
- 玩家入口：标题页选择或创建档位后进入新的 `base-room-01` 基地场景；旧出征、仓库、商店、升级、人物、收藏和宠物入口仍可用，并可从旧 hub 的「基地」页签返回场景。
- 存档与资产版本：M05 不新增存档字段，不提升 schema；消费 M01/M02/M03 门面和 M04 `m04-prototype-1` VisualPack。

## 实现

- `game/src/home.presenter.js`：把 M01 基地快照、M02 收藏/人物视图和 M03 家具视图组合为冻结的 `HomeSceneView`，不写业务状态。
- `game/src/home.scene.js`：实现 `mountHome({host,view,assets,onIntent}) -> {update,setActive,dispose}`。Pixi 7 只画房间和家具层，DOM 承载五热点、旧入口、布置/购买/展位表单和错误反馈；无 WebGL 时保留完整 DOM 入口。
- 场景常驻内容：通过 `Art.classArt` 的受控适配显示当前驻留人物；两个展位读取 `home.displays` 的永久收藏引用，通过现有 `Cards.cardHTML` 显示具体卡面与卡名。实体数量为 0 的永久收藏仍显示，缺卡面时保留稳定 ID/名称文字回退。
- `game/css/home-scene.css`：全宽自适应场景、44px 以上热点、编辑抽屉、遮罩和窄屏布局。
- `game/src/game.hub.js`：本批唯一 hub 接线。M03 命令注入 M02 `getCollection`；购买、布局与展位只在命令成功后刷新；旧收藏按钮改用 M02 `convertCollection`，皮肤按钮改用 `selectSkin` 并在进基地时恢复选择，未重复旧 `Meta.onCollect` 发奖。
- M04：直接消费 `getM04VisualPack()`；房间和六家具路径只来自 VisualPack。该包状态是 `direction-sample`，仍是几何原型，未冒充最终美术。

## 验收证据

定向与相邻回归：

```text
npx vitest run tests/m05-home-presenter.test.js tests/m05-home-scene.test.js \
  tests/m01-base-commit.test.js tests/m02-collection-commands.test.js tests/m03-home.test.js \
  --no-file-parallelism
```

结果：5 文件、26 测试通过。M05 用例覆盖五热点/旧入口同路由、取消不写命令、保存失败不误报、隐藏暂停 ticker、dispose 幂等和连续进入退出 10 次无 canvas 残留。

同批 M04/M06 接入追加：M04 2 文件 3 测试通过；M05+M06+M01/M02/M03 7 文件 33 测试通过。

内置浏览器实机：唯一标记服务 `http://127.0.0.1:4179/game/`，1280×720，档位 01。

- M05-A：通过。真实标题页创建档位进入基地，五热点与 7 个旧快捷入口均可访问；仓库快捷入口打开原仓库页。
- M05-B：部分通过。1280×720 实机点击、遮罩和全宽布局通过；最初发现 host 只占半宽，修复后复验全宽。1920×1080 本次浏览器不提供视口切换，未实机验证。
- M05-C：通过模块证据，实机验证余额 0 购买座椅显示“储备币不足”，没有成功提示；取消与保存失败由定向测试固定。真实有币购买→摆放→重载尚未完成实机闭环。
- M05-D：通过模块证据。10 次 mount/dispose 后画布归零，inactive 停 ticker；WebGL 构造失败保留 DOM 入口。浏览器真实禁用 WebGL未单独切换验证。

同一实机还确认：M06 两套预设页从旧出征页可达，空合法预设点击“应用到整备”只进入原出征整备页，没有创建对局；人物页选择 `wu/casual` 后选中状态由 M02 命令刷新。M11 尚未接入，未验证预设直接开局。

后续补齐包：驻留人物、实际展位卡面与家具热点路由已有定向测试；补齐后子代理的 Codex 内置浏览器会话不可用，尚未取得角色/展位新截图，也未完成独立测试档的“卖卡得币→买家具→摆放→保存→刷新重入”实机证据。服务 `127.0.0.1:4179` 保留供根任务串行复验。

## 正常、失败与重试

- 正常：空布局提交经 `home.commitLayout` 成功后才显示“布局已保存”，并以新 revision 刷新场景。
- 失败：储备币不足时 `home.purchase` 返回 `INSUFFICIENT_FUNDS`，币和拥有量不变，场景显示原因。
- 重试：M03/M01 以 `requestId + expectedRevision` 保证幂等；M05 每个玩家动作只生成一次 requestId，旧 revision 返回刷新提示。

## 已知边界与回退

- M04 资产是原型 SVG，审美方向和最终绘制仍待制作人确认。
- M06 已通过 `mountPreparationView` 接入旧出征页的「下一局目标与两套预设」入口。应用预设前用最新基地快照重新预览，只把完整 `ready` 项映射到旧 `deployPick`；随后进入原出征整备确认页。`preset-start` 在 M11 未接入时保留 `DEPENDENCY_UNAVAILABLE`，不改写 `newRun` 或绕过原确认出发。
- 回退只移除 M05 场景入口和 UI 模块，恢复旧 hub 首屏；保留 M01 `home`、M02 收藏/皮肤和 M03 家具数据及请求收据，不清档。

## 根任务最终复验（覆盖上方阶段状态）

详见 `../MODULES-01-06-RESULTS-2026-09-21.md`。实际游戏 URL 为 `http://127.0.0.1:4179/`。已修复公开 revision 传递，档位 05 的真实有币购买、摆放保存、收藏归零后展示、刷新重进均通过；档位 01—04 未变化。最终本批 9 文件 37 测试通过。真实 DOM 为 1158×986，视口覆盖没有生效，不能宣称指定 1280/1920 尺寸验收通过。M06 的无效直接出征按钮已移除，保留原整备确认流程。
