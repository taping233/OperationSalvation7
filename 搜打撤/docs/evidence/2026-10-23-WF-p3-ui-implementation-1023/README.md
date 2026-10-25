# P3界面细节实装交付入口

本任务把P3模组的具体界面代码转成适合本游戏的按钮、BUFF栏、卡牌选择与图形改进，处理已有实现的冲突。分类底板、卡牌焦点、密集状态和语义图标已经接入；公共生命数字／外观及顶栏按场景显示已统一，并完成当前窗口实页复核。源码为完成未提交，详见[最终验收](FINAL-ACCEPTANCE.md)。

[实际游戏预览](http://127.0.0.1:5319/)保留在隔离服务中，当前为5格、8张卡的背包；[完整当前窗口截图](previews/bag-in-game.jpg)。预览不再导入状态构造夹具，服务归属见[runtime.json](runtime.json)及`WF-p3-ui-preview-1024`登记。

原要求来自老板对 `P3Makoto_v0.14.76.zip` 与 `P3MusicBox_v1.1.3.zip` 的参考：要能实际落地、与已有交互协调，并让执行者能沿具体代码继续工作。包内文档只作为参考材料，任务范围与取舍以老板授权及下列实施记录为准。

## 计划与代码入口

| 资料 | 用途 |
| --- | --- |
| [原执行方案：28个设计与核对单元](../2026-10-23-WF-p3-ui-adaptation-audit-1023/IMPLEMENTATION.md) | 11项确定整改、条件优化、公共约束和暂缓扩展的原始边界。 |
| [本轮逐项实施覆盖](implementation-coverage.md) | 当前文件、关键符号、参考代码锚点、已实施／沿用／未触发／延后的逐项对照；执行者从这里定位源码。 |
| [P3参考代码摘录](../2026-10-23-WF-p3-ui-adaptation-audit-1023/reference-code.md) | R06卡片状态、R08设置行、R10单块分类底板等具体实现；摘录保留采样时的原行号。 |
| [原项目代码摘录](../2026-10-23-WF-p3-ui-adaptation-audit-1023/project-code.md) | 原P01–P30责任入口与参考方法的对应关系；现行位置以本轮覆盖表为准。 |
| [重复占位图标原清单](../2026-10-23-WF-p3-ui-adaptation-audit-1023/ICON-REPLACEMENT.md) | 剩余牌库图反复占用、同键多义与别名的拆分依据。 |

## 已接入的实际变化

| 范围 | 当前实现与效果 | 详细证据 |
| --- | --- | --- |
| 设置与分类按钮 | 阅读高亮与开关开启分开；分类只有一块移动底板，未测量、隐藏、销毁及减少动态时保留静态选中；设置按钮按压／禁用／忙碌不再以位移改变布局。 | [settings.md](settings.md)，覆盖A01／A02／A04。 |
| 发现、领奖与背包卡 | 发现使用一层金框及已选标记，Tab焦点独立；其他可领奖卡维持正常对比，已领卡由业务状态控制；背包真实卡片的transform由公共运动服务负责，数量角标随宿主；焦点不再被全局清框规则抹去。 | [cards.md](cards.md)，覆盖C01／C02／C05／C07／C08。 |
| BUFF与诅咒栏 | 不再因第5项使全组变形。玩家保留全名／单位两行；敌人和随从使用机制图标＋纯数字的固定高度原生滚动区，完整名称／单位仍在ARIA和词条里。按元数据区分量、回合和开关，保留正在阅读节点及滚动位置。 | [status-layout.md](status-layout.md)，覆盖B01–B04与局部输入隔离。 |
| 美术与图标消费者 | 注册68张原创SVG，拆分牌库、手牌页码、抽牌、注能、法伤、容器、制作等用途；16种状态贯通核心元数据、展示、词条与日志。消费者分片21份源码107处token迁移，另有主代理手牌／卡面3个参数接线。原真实卡背保留。 | [icons.md](icons.md)、[icons-consumers.md](icons-consumers.md)。 |
| 动效责任与减少动态 | 清理背包hover与JS姿态的竞争，避免CSS再过渡一次transform；分类与卡片有静态出口；补齐临时／变化卡状态光的游戏内减少动态遗漏。 | [cards.md](cards.md)、[覆盖表公共约束](implementation-coverage.md#主代理最终css接管补充)。 |

没有把原清单28单元当成28个新增效果。未触发的8项条件优化和2项延后扩展仍按覆盖表处理，包含重写拾牌算法、追加领取动画、整套状态汇总浮层等；现有证据不足以支持扩大这些范围。

## 直接看图与实页证据

| 预览／场景 | 查看内容与边界 |
| --- | --- |
| [68张矢量图总览](previews/semantic-icons-all.png) | 全部新语义键的形体总览；逐键用途见图形记录。 |
| [图标改造前后预览](previews/icons-before-after.jpg)、[16状态图预览](previews/status-icons.jpg) | 原重复图与新图的对照、状态机制辨识。 |
| [真实发现：选中与Tab焦点分离](discovery-selected-and-tab-focus.jpg) | 实际施放寻宝进入3选1，选择第二项、Tab至第三项；详情返回保留选择，双击确认只获得1张。 |
| [最终密集状态栏](status-16-99-compact-final.jpg) | 当前自然1280×720窗口第三轮compact版本；随从同屏2项、敌人各3项，玩家两行。构造展示snapshot验证排布，不代表玩法实际施加16状态。 |
| [状态末项键盘滚动](status-keyboard-scroll-final.jpg)、[拿牌后查看状态](status-tooltip-and-input.jpg) | Tab到末项；拿牌后点状态未出牌／扣能量。数量与数值矩阵见[状态记录](status-layout.md#主代理最终实页结果)。 |
| [领奖查看焦点](screens/reward-focus.jpg)、[全部领取后总览](reward-all-claimed.jpg) | 三张均可领取，最终已处理3张，背包2/16→5/16；单张截图不证明动态轨迹或容量不足分支。 |
| [背包筛选返回](bag-filter-restored.jpg)、[背包减少动态](bag-reduced-static-final.jpg) | 卡片／筛选反馈已有取证；后者同时暴露待修的顶部资源与容量重叠，不作为整页最终验收图。 |
| [牌库入口](screens/pile-new-icon.jpg)、[设置页](screens/settings.jpg) | 对应截图时刻的入口与外观。更多真实输入范围以主代理记录为准。 |

以上真实页面由主代理通过Codex内置浏览器取得。旧`status-16-99-final.jpg`是第二轮，不用于代表最终compact状态栏；截图也不代替快速反向动作、触屏或逐帧性能采样。

## 验证结果分开阅读

| 类型 | 已有结果 | 证据与限制 |
| --- | --- | --- |
| 主代理组合定向批次 | 87项通过。 | [覆盖表最终验证补记](implementation-coverage.md#主代理最终实页与定向验证补记)。这是指定范围测试，不称本地全量。 |
| 后续CSS级联与状态光契约 | `tests/ui-motion-cascade.test.js`最终7项通过；新增3项先失败，修复后通过。 | [卡片修复记录](cards.md#卡面状态光的游戏内减少动态补齐)。与前一批时点／范围不同，不相加成94项。 |
| 图标注册与真实hydrate | `semantic-icons.test.js`＋`icon-hydration.test.js`共12项通过。 | [图标最终集成检查](icons.md#最终集成检查2026-10-24)。安全格旧预期lock已同步为safe-slot，不再列为当前失败；装饰ARIA和名称契约保留。 |
| 状态一致性与结算近邻 | `status-icon-consistency.test.js`17项、`battle-resolution.test.js`58项最近补跑通过。 | [消费者验证](icons-consumers.md)。核心未引入UI依赖，token以外玩法行保留。 |
| 真实页面输入 | 发现选择／查看／确认、状态数量与数值／末项Tab／拿牌阅读、领奖交易、背包筛选及减少动态已有各自取证。 | 上表截图、JSON与分片记录；不同场景各自成立，公共HUD整改后另有15次跨页读数，见[最终验收](FINAL-ACCEPTANCE.md)。 |

设置20项、卡片25项、状态8项等分片记录保留在各自证据中，不与组合批次重复累计。资源68键／68文件／68登记一致，13／22／64px共204次尺寸与像素复核已有记录，复用未变输入的结果。

## 公共HUD最终结果与保留边界

1. **公共HUD及顶栏整改已实页通过。** 数字由一个入口维护；地图／奖励／战斗显示统一生命，背包三区／完整设置／真实发现隐藏共享栏，返回恢复。15次读数中节点各1，真实受伤后顶部与脚下同为23/30。查看[最终验收](FINAL-ACCEPTANCE.md)、[背包最终页](bag-header-clean-final.jpg)、[发现最终页](discovery-header-clean-final.jpg)、[HUD矩阵](hud-cross-page-matrix.json)。
2. **卡面文案沙箱有外部失败。** `card-description-text.test.js`的`sourceCardLibrary()`路径遇到同步脚本沙箱缺少`onPlayDefinition as R`别名，报`R is not defined`；同批其余45项通过。未修改该同步脚本或放宽测试，见[消费者记录](icons-consumers.md)。
3. **资源精简测试仍有selector指纹漂移。** 三个已授权动态消费者指纹已经复审；`runtime-asset-redundancy.test.js:152`仍受6份外属地文件的旧selector指纹保护：`game/src/ui/game.menu.pages.js`、`game/src/ui/menu-slots.js`、`game/src/run/chests.js`、`game/src/run/game.session.death.js`、`game/css/entry-events.css`、`game/css/scenes.css`。保留资源保护及原失败记录，不把图标12项通过写成资源全套通过，见[图标闭包回归及最终检查](icons.md#战斗层复审后闭包回归)。
4. 容量不足、全部牌库边缘、触屏、真实状态施加／到期／死亡等未覆盖场景沿[覆盖表](implementation-coverage.md#最终覆盖仍有的边界)保留；域外单义图标候选沿[消费者清单](icons-consumers.md)保留。护甲“span被铺满”的疑点已按当前真实`b`节点证伪，不据此添加样式；真实包扎后护甲3的像素范围已检查，未铺满生命条，见[护甲几何](armor-geometry-final.json)。

原清单的实施、代码参考和实际验证在本入口集中交付；未运行build或全量，未提交。定向批次、未覆盖项与隔离快照边界见[最终验收](FINAL-ACCEPTANCE.md)。
