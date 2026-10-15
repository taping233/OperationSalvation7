# 新手与出征整备修复（2026-10-15）

状态：实现冻结，定向验证通过，待主会话当前窗口内置浏览器实页复核。未提交；第一批背包文件保持冻结。

## 玩家行为变化

| 编号 | 变化与边界 |
| --- | --- |
| F28 | 未学习消耗规则的新档在基地事务区看见“首次目标：带回一份收获”，按钮直接走既有出征整备动作。说明正常入城探索、撤离带回资源卡、后勤使用后扩建与留格领取战利品。沿用 ammoTaught 控制首次提示，不新增教程强制步骤或存档字段。 |
| F29 | 正常入城始终说明完整四层探索、基础倍率与首局推荐；直入敌腹说明仍是四层探索，敌人与首脑／战斗金币／人物经验倍率读取现有 modes，并保留高稀有度掉率说明。未修改模式规则。 |
| F30 | 正常基地选人和独立选人都显示生命上限、基础攻击、职业技能名称／费用／效果。生命由 MAP.rules.playerMaxHp + 实际随行伙伴 maxHp + 当前人物熟练度增量计算，攻击读 MAP.rules.playerAtk，技能读纯数据 slamSkillFor，不复制技能数值。原 mechanism 风格关键词保留。 |
| F31 | 整备页增加“预览推荐装配→应用预览→撤销推荐”。保留已选，最多补三张不同名称的可携带卡，优先防御／治疗／破甲与低费建议，按精确初始牌和伙伴占格预留至少三格。使用现有 preparation.commands 的 previewDeployment 校验库存和资格，再由 departureSummary 精算容量；不抽随机卡、不保存预设、不扣仓、不代选人物或出发。库存、模式、容量、伙伴或手选变化后必须重新预览；应用后继续手调，撤销不会覆盖新手选。 |
| F33 | 修复原 !onSelect 条件导致正常基地选人入口隐藏消耗说明。选人和整备均可查看，首次默认展开，明确普通牌进消耗口袋、下一场不自动回手；初始／职业／衍生用后消散；主动丢弃不可复原；火堆类型限制与结晶顺序复原；口袋撤离每张 1/3 带回。选人另注明首脑独立牌库入场前说明。 |
| F39 | 整备与生存指南战斗页复用简短教学：先看敌方意图、攻击前保留防御资源；遇到减伤读词缀，破甲克制格挡／护盾／护甲／元素庇幕；条件破甲先检查流血等前提。首脑入口即时教学由主会话交奖励代理接入。本切片未改首脑数值、牌库或随机池。 |

## 实现路径

- `game/src/hub/hub.home-v3.js`：首次目标与模式说明。
- `game/src/hub/game.hub.depart.js`：推荐预览／应用／撤销动作、库存和页面生命周期守卫、整备消耗与深入准备说明。
- `game/src/hub/departure.summary.js`：纯推荐候选与精确占格派生；previewDeployment 作为依赖注入，保持摘要模块不初始化基地。
- `game/src/run/game.run.class-choice.page.js`：真实属性、纯职业技能元数据、两个入口共用消耗说明。
- `game/src/ui/beginner-guide.js`、`beginner-guide-diagrams.js`：复用深入准备教学。
- `game/css/base-home-v7.css`、`departure-selected.css`、`roster-departure-v2.css`：仅新提示和按钮的局部排版；不重画页面。
- `tests/departure-stack-lifecycle-review.test.js`、`departure-class-confirmation.test.js`、`fresh-run-onboarding-copy.test.js`：真实宿主 DOM 操作、推荐边界、显示来源与文案验证。

推荐命令首次尝试静态导入时，测试发现 base.commands 的既有 base.js 副作用会提前初始化 Base。已改为仅点击预览时动态导入，并在返回后检查页面、档位及选择签名；加载失败给出继续手动整备／重试提示。技能元数据模块本身无 import、无副作用，未借此加载战斗引擎。

## 验证

第一组（退出码 0）：

```text
npm run test:target -- tests/fresh-run-onboarding-copy.test.js tests/departure-stack-lifecycle-review.test.js tests/departure-summary.test.js tests/departure-class-confirmation.test.js tests/class-choice-lazy-entry.test.js tests/beginner-guide-entry-copy.test.js tests/hub-architecture.test.js tests/contracts.test.js tests/architecture-boundaries.test.js
```

9 文件、100 测试通过，16:40:12 开始，8.24 秒。覆盖目标动作、两模式说明、指南教学、人物真实属性与技能、正常 onSelect 消耗说明、推荐真实按钮链／不扣仓／保留已选／精确伙伴占格／禁带职业卡／数量变化重预览／撤销不覆盖手调，以及 lazy-entry、contracts 和 architecture 哨兵。

最后补充“主动丢弃不可复原”文案后，按受影响出征路径补验（退出码 0）：

```text
npm run test:target -- tests/base-departure.test.js tests/departure-real-session-review.test.js tests/departure-drag.test.js tests/departure-handoff.test.js tests/departure-browse-state.test.js tests/departure-stack-lifecycle-review.test.js tests/departure-class-confirmation.test.js tests/fresh-run-onboarding-copy.test.js
```

8 文件、44 测试通过，16:41:37 开始，8.20 秒。覆盖真实扣仓会话、手选与推荐并存、稳定堆身份、拖拽、出征交接、返回浏览状态和本轮新手信息。两组有重叠，不能把测试数量相加当作去重总数。

最终目标源码／测试 ESLint 退出码 0；本切片 `git diff --check -- <修改文件>` 退出码 0。lazy-entry 断网测试按预期输出 offline 错误日志，测试本身通过。

## 待主会话复核

1. 当前窗口基地首次目标卡、两模式说明是否与底部导航或出征入口重叠。
2. 选人属性与技能可读性、首次展开说明的滚动可达性。
3. 整备推荐三个按钮、预览回执、应用／撤销和原拖拽同屏操作；新增说明是否挤压卡牌浏览区。推荐区域和说明采用局部小字与限高滚动，尚未实页测量。
4. 真实键盘与焦点路径、懒加载失败的实页重试。
5. F39 首脑确认入口教学由奖励代理负责，不能用本切片整备／指南测试替代该入口验证。

无新增玩法决策；未改卡池、初始卡数量、首脑数据、独立牌库或存档 schema；未开服务、未操作浏览器、未 build、未提交。

## 当前窗口返修：推荐按钮可读性与状态

主会话 current-window/03-departure-recommendation.png/txt 确认预览／应用／撤销功能通过，但继承 mini-btn 深字与透明底导致暗玻璃上难辨。本次直接修改 departure-selected.css 原 `.dep-recommend .mini-btn` 规则，为推荐组指定浅字、实底和边框，补 hover／focus-visible／disabled 状态，不改变整备布局。

game.hub.depart.js 仅同步推荐按钮的 disabled：未有有效且可补充的预览禁用应用；没有可撤销的已应用推荐禁用撤销；预览后可应用，应用后只开放撤销，撤销后两者禁用，手动调整后禁用旧撤销。复用原签名与撤销条件，推荐算法和库存逻辑保持原状。

返修验证：`npm run test:target -- tests/departure-stack-lifecycle-review.test.js tests/departure-browse-state.test.js tests/hub-architecture.test.js` 退出码 0；3 文件、31 测试通过（17:03:02，7.69 秒）。补了初始／预览／应用／撤销／手调后的真实 disabled 状态断言。目标 ESLint 与自有 diff --check 退出码均为 0。待主会话仅复验推荐按钮组颜色与状态。
