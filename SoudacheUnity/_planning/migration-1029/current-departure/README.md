# 当前出征流程迁入

状态：本域代码已实现，待主会集中 Unity 原生渲染、流程与真实输入验收。静态编译与领域断言不表示效果全部一致；本线没有启动 Unity、前台窗口或共享编译。

## 当前来源与分工

来源为现行 `game.run.class-choice.page.js`、`game.hub.depart.js`、`preparation.view.js` 的实际模块链与最后生效 CSS；完整 SHA 在 `source-map.json`。对应 current-ui-version 第 06/07 页。

- `ClassChoiceScreen.Request(selected,cancel,initial)` 只选草稿人物；`Open()` 继续作为 LoadRun 无人物时的修复入口。五人物、机制/生命攻击/每回合技能、熟练成长折叠、外观选择、完整卡池的分类/均衡分页/详情入口沿源。最终 CSS 是左侧 59% 大立绘、中间 37% 信息框、最右 270px 双列五头像；历史底部头像条被最终 `roster-departure-v2.css` 覆盖。标准立绘高度/底边/横向透明边界参数来自 `roster-reference.css`。
- `DepartPrepScreen.Open()` 无有效草稿先选人物；同 Base 引用与同 ActiveSlot 的草稿继续整备。`HasDraft / DraftCharacterId / DraftCardCount` 给当前基地页消费，换档或起局后不暴露旧草稿。人物→整备→最终出发，前两步不 NewRun、不扣仓、不抽职业卡；改人/返回基地保留当前携带。
- cover-v3 使用 `base-operations-v5` 与玻璃双等宽区、真实仓库卡面、稀有度/类型/费用筛选、剩余/已带、按源同名合格并保留稳定 source key、固定初始牌与拖回移除。空格按最终 CSS 隐藏。局部选择保留仓库节点并重用背包格节点；宠物沿源即时保存，初始牌/容量/安全格在确认前可预览。
- 当前 cover-v3 原模板没有挂载推荐条；源保留 preview/apply/undo handlers。迁入同样保留处理方法，不额外增加可见按钮。
- `PreparationScreen` 沿源显示收藏目标与并排的两个固定预设、折叠编辑、重新预览/应用整备。移除旧 Unity 的直接出发按钮旁路；没有另建预设系统。领域 `TryStartPreparation` 保留既有显式调用契约，没有 UI 直达调用。
- `GameRuntime.Departure` 转译 `departure.summary` 与 `base-departure.commands`。身份为显式 stackKey，或 `card:id:variantKey`，历史 name 调用保留源 first-match 语义。显式 variant 愿望先分配，普通愿望基础版本优先、跨可解析卡堆分配。最终交易精确扣选中栈并在带入快照保留 variantKey；没有改 NewRun 的起局顺序和现有保存事务。
- 最终确认先挂演出遮层，160ms 后只执行一次已有保存事务，2400ms 当前 city-reflection 演出、680ms 退出；跳过只缩短演出。失败留在整备并保留人物和携带选择，成功才清草稿。资料与贴图由主会中央 Res 接线。

## 验证

`dotnet run --project _planning/migration-1029/current-departure/DepartureChecks.csproj`：89 断言通过，结果 `domain-checks.json`。包含已有权威 JS 预设向量、同 id 同名异 variant 精确扣仓、合格后的 source slices、双预设、预览不写档不耗 RNG、库存变化拒绝、写盘失败回滚后复用相同携带重试、保存重读、重复身份拒绝与宠物初始牌替换。

隔离静态程序集编译写在本目录 `compile`，以当前原生 Unity 托管引用编译当前源，不启动编辑器。结果 `ui-compile.log`。与原生运行、系统输入、像素/材质/动画对拍分开。

## 主会原生复验清单

1. 新档基地点击出征先出现五人整页；人物/外观/成长/卡池后「下一步」才出现整备。检查标准立绘透明边界、右信息字体与右头像双列，核对 1920 设计坐标在当前窗口的实际缩放。
2. 带一张、拖一张、合并同名、筛选、拖回仓库、含固定与自选混合格只移除自选；容器移除导致超容时阻止。改人再回整备、返回基地再进、换档再进分别核对草稿。
3. 宠物保存成功/失败、固定初始牌替换、额外初始牌、安全格数与容量变化；预设双列折叠、指定 variant 与普通愿望的实配。
4. 最终确认锁/跳过/出发失败保留/重试；成功时原人物直接进入局内，不再次弹选人。旧 LoadRun 无人物入口仍能选人与领取入城补给。
5. 当前窗口原生截图和真实输入分开取证；玻璃采样、圆角、渐变、肤图焦点、反射擦入/退出节奏尚未对拍，不能记为全效果一致。