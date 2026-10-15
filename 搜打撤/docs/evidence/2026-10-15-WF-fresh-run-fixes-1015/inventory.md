# 背包与后勤修复（2026-10-15）

状态：实现已冻结，定向验证通过；当前窗口内置浏览器实页由主会话统一补验。未提交。

## 行为变化

| 编号 | 当前实现与证据边界 |
| --- | --- |
| F03 | 招式／物资筛选直接接受真实按钮值 `move`／`supply`；招式只显示武术、法术、能力卡，物资只显示 inventory 散装物资，其他卡牌分类不再混入散装物资。新增 DOM 按钮回归。 |
| F05 | 结构化背包消费器接受 `acquire legendary`，通行证 B 恢复直接获取传说卡；保持传说品质与 `isRandomObtainable` 谓词、loot 随机流，不改随机池。空池不消耗，结果在背包保留回执。 |
| F08 | 木材／口粮入口优先使用标准资源卡，缺标准 ID 时按材料类型匹配，仍无卡时展示基地材料信息卡；消除 `if (!card) return` 静默断点。已测缺卡打开、关闭、再次打开，库存不改变。原审查现场根因未复现，不声称已证明原因为缺卡；待实页复核。未改 runtime guard。 |
| F09 | 沿现有玻璃背包，保留原 fullscreen / transform:none，补根内容 width:100%、卡片独立 scale/translate:none、头部允许换行。尺寸与外观待当前窗口实页检查，不能以单测宣称填满已通过。 |
| F10 | 标题与主容量跟随随身背包／安全格／消耗口袋；安全格显示实际占格／安全格上限，消耗口袋显示张数与不限容量。 |
| F11 | 筛选无结果显示该分类无卡牌或物资，并提供真实“显示全部”按钮；不再说整个背包为空。 |
| F12 | 安全格页和帮助改用实际 `Base.carriedPet()?.name`，无伙伴名时用随行伙伴。失败结算由主会话另改。 |
| F13 | 丢弃确认统一描述实际永久丢弃动作，不再声称按钮操作来自拖到包外。 |
| F14 | 碎片显示库存枚数与每次需 2 枚分列，注明通行证 A 详情合成／祭坛使用入口；保留原合成和祭坛规则。 |
| F17 | 消耗口袋按张统计火堆可／不可复原，逐卡标记；明确道具／装备不能在火堆复原，但能源结晶可按原顺序复原它们。底栏“待复原”文案跨域请求主会话改“已消耗卡牌”。 |
| F18 | 结构化治疗、复原与获取返回背包后保留就地回执；复原列实际数量、名单、容量满导致的剩余数量；切换筛选仍保留，替换 ownedCards 实例后清除。空口袋／满血／空池／战斗专用道具给出不消耗原因。旧档纯描述分支原行为保留，当前标准晶体经迁移已有结构化规则。 |
| F27 | 背包排序／整理图标按钮有动作名称，背包按钮统一补 focus-visible；关闭背包已有名称。其他页面关闭钮不在本切片范围。 |
| F32 | 背包说明张／格／种，并写明同名通常 3 张一格、初始攻击／火球 5 张一格；仓库说明容量格与卡牌张数、种类计量。 |
| F44 | 页面与材料详情明确资源卡不计入散装物资估值；带回资源卡需在后勤详情使用后折入基地材料。仓库材料入口明确显示已折入库存，未更改资源换算或结算。补齐散装物资 tile 模型 value/tier，tooltip 使用真实值。 |

## 修改文件

- `game/src/hub/game.bag.js`
- `game/src/hub/game.bag.view2.js`
- `game/src/hub/game.bag.rules.js`
- `game/src/hub/game.bag.drag.js`（键盘查看接线，口袋卡禁止拖入真实持有区）
- `game/src/hub/game.hub.pages.js`（原材料详情、仓库既有补给处理器页脚恢复）
- `game/src/hub/hub.warehouse.js`
- `game/css/expedition-inventory.css`
- `tests/bag-page-lifecycle-review.test.js`
- `tests/bag-structured-use.test.js`
- `tests/base-inventory-lifecycle-audit.test.js`

## 验证

最终定向命令（退出码 0）：

```text
npm run test:target -- tests/bag-architecture.test.js tests/bag-item-rule-baseline.test.js tests/bag-page-lifecycle-review.test.js tests/bag-pouch-capacity.test.js tests/bag-return-hook.test.js tests/bag-slam-button.test.js tests/bag-structured-rule-migration.test.js tests/bag-structured-use.test.js tests/base-inventory-lifecycle-audit.test.js tests/hub-flow-regression.test.js tests/hub-architecture.test.js tests/contracts.test.js tests/architecture-boundaries.test.js
```

13 文件、152 测试通过，16:18:28 启动，耗时 10.18 秒。覆盖真实 DOM 筛选按钮、分类空态、安全格容量与伙伴名、口袋类型标记、按钮丢弃确认、碎片口径、B 获取传说池排除、能源结晶复原装备／名单、容量限制回执、缺材料卡时详情重入，以及既有拖拽取消、生命周期、容器、存储与架构边界。

目标 ESLint 命令退出码 0：

```text
node node_modules/eslint/bin/eslint.js game/src/hub/game.bag.js game/src/hub/game.bag.view2.js game/src/hub/game.bag.rules.js game/src/hub/hub.warehouse.js game/src/hub/game.hub.pages.js tests/bag-page-lifecycle-review.test.js tests/bag-structured-use.test.js tests/base-inventory-lifecycle-audit.test.js
```

自有文件 `git diff --check -- <上述修改文件>` 退出码 0。测试存在 jsdom 无音频 codec 和测试职业美术映射提示，未出现测试失败；未运行 build、未开服务、未操作浏览器、未更改数据或存档、未提交。

## 待主会话当前窗口实页

1. 背包实际占用区域、头部换行、卡牌文字与说明是否挤占过多；F09 当前有原 fullscreen 修复，需量实际尺寸。
2. 全部→招式→物资→无结果→显示全部，安全格与消耗口袋切换。
3. 通行证 B 使用、能源结晶复原／容量回执、丢弃取消、排序按钮键盘焦点。
4. 木材详情关闭后重入及“扩建／补给”去向；原 F08 未证明具体触发原因。
5. F12 失败页与 F17 底栏由主会话跨域统筹，均未在本切片宣称通过。


## 集成审阅补修（16:24 冻结）

主会话指出现行仓库详情只渲染收藏按钮，资源卡／蛋／卡包的既有处理器未有可点入口，已补齐：

- 材料卡显示“使用 1 张 · 折入基地材料”，有多张时显示“使用整堆 · N 张”；沿用 `useStashMaterial`。最后一张与整堆保持二次确认，确认签名含稳定 stackKey 和当前数量。
- 宠物蛋显示“孵化 1 枚 · 消耗 50 储备币”，按钮再次确认后调用原 `hatchPet`；孵化条件、宠物池与费用沿用现行规则。
- 经济卡包显示“拆开 1 包 · 获得 5 张随机卡牌”；沿用随机可获得谓词、loot 随机流、五格空位检查和 `openCardPack`，最后一包保持二次确认。
- 材料／孵化／拆包成功先关闭当前详情再刷新仓库，避免 renderHub 替换 host 后详情守卫失效而残留旧按钮；失败保留详情。旧命令分别按名字／ID定位，因此遇到同名材料堆或同 ID 的蛋／包多 variant 时拒绝误消费，保留原库存。不扩大底层命令 API。
- F26 背包卡格补 `role=button`、名称、Enter／Space 查看详情；移除卡面内部重复 tabindex，防止嵌套焦点停靠；查看详情明确传来源卡格作 returnFocus。分区按钮原为原生按钮，补 aria-pressed 和切换后焦点恢复；消耗口袋卡可打开只读详情，不能拖动或使用。指针拖拽路径保留。

补修后执行：

```text
npm run test:target -- tests/base-inventory-lifecycle-audit.test.js tests/bag-page-lifecycle-review.test.js tests/bag-architecture.test.js tests/hub-architecture.test.js tests/hub-flow-regression.test.js tests/contracts.test.js tests/architecture-boundaries.test.js
```

退出码 0；7 文件、126 测试通过，16:23:43 启动，耗时 14.42 秒。新增真实按钮点击验证材料单张入库与重入最后一张确认、整堆数量变化重新确认、蛋成本与失败重试、经济包五格限制／五张命令参数、同名／同ID多 variant 不误消耗；键盘事件验证 Enter/Space 到详情／关闭归焦、分区焦点、口袋只读与不可拖动、无重复 Tab 停靠。详情与主页面为测试 UI 宿主，键盘输入是 jsdom 合成事件，不能代替实页真实键盘结论。

补修目标 ESLint 与自有 diff --check 均退出码 0。主会话需实页补材料使用按钮、蛋／包操作提示及 F26 键盘焦点。本补修不重跑已经通过且未影响的结构化迁移等检查；首轮 13 文件／152 测试证据保持其原覆盖边界。
