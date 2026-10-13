# 入城 / 事件 / 继续对局实施与自审

2026-10-11。完成未提交，本轮只做必要定向检查。最终当前窗口与老板统一过目尚未完成。

## 实际路径与行为

- game/src/run/game.run.altar.js：转场完成仍idle/save/refresh，随后打开完整入城页；展示实际grantedCards数量/大卡面与详情，继续/关闭只恢复idle，不发奖/不再次保存。confirmationStarted/entryPresented/currentContext守卫保留。
- game/src/run/game.run.scenes.js：nodeShell仅event/entry分支采用纯展示壳；shop实例、其他节点、既有city-cut代码保留。
- 新game/src/ui/node-scene-view.js：标题、实际区域/层、真实生命/金币/背包、叙事、选项与固定foot分别呈现，不定义业务动作。
- 新game/css/entry-events.css：scenes静态import确保实际加载；只作用event-scene/entry-scene，长文/选项分区、正向/禁用状态、减少动态；未改全局zoom/卡面。入城采用v2专属背景。
- game/src/ui/expedition-feedback.js：entry通知移除；fire实际结果/时长/导航清理保留。
- game/src/ui/game.menu.js：hasSavedRun仅presentation:'city-cut'一行，读取时序/战斗恢复/错误与取消守卫保留；其111行工作区总diff包含原110行基地完成改动。
- 新运行图两版game/assets/scenes/entry/winter-arrival-1011-v1.webp与v2.webp；详细SHA/源图索引/词见ART-GEN.md。原图精确gitignore，无manifest修改。

## 两轮自审

第一轮依据T01大整页开局，取消角落通知，实际卡牌居中为主对象；依据T02事件左场景/右叙事和选项，去掉纵向居中空白，保留完整已有label/detail。

第二轮依据G1和T01/T02资源持续可见，补真实生命、金币与格数，方便比较选项已有代价；入城背景v1→v2仅把碎砖木简化为大面，保留门廊/留白/光色，详见ART-GEN的实际看图比较。没有提前显示随机结果、改变事件成本/奖励或为了次数重复生图。

## 定向验证

- Vitest：departure-class-confirmation / expedition-feedback / e4-async-entry / r6-story-flow.repro / events-0919 / contracts / architecture-boundaries；7文件70测试通过。
- ESLint：本域5JS与3测试通过。
- check:syntax：365项目文件通过。
- diff --check通过。无build/全量/提交/发布。
- E4适配当前完整页继续动作、继续对局city-cut，并隔离interface-motion自动安装器防它替换测试的render端口spy；测试仍使用真实scenes过场、context取消和异步loader链。

## 最后统一过目操作

真实确认出征→统一field过场→完整入城大页：看背景门廊、实际职业卡/数量、资源与唯一继续；点卡详情、Esc/关闭与继续不会再奖励，刷新读档不重复发牌。取消/失效转场不打开该页；保存失败提示保留。

从真实事件入口看标题/叙事与已知代价/收益同选项，检查长文与三个选项、禁用态、背包往返后继续同一事件不重复结算。资源来自当前game，不提前透露结果。

返回标题再继续有存档对局：看到统一field city-cut，点击可跳过，读档恢复战斗modal或地图idle；错误仍保留原档回选档。

没有以逻辑测试代替实页美术验收；最终画面/字形/命中区域由root与老板统一过目。