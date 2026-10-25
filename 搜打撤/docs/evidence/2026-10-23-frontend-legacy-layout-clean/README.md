# 旧页面版本与章节空轮询补清

老板要求继续深清前端，沿用不打开游戏实页的要求。本批三路只读核对生成端、开发预览和动态类；主线按当前源码逐块删除，未覆盖其他会话的在途代码。

## 本批结果

生产前端净减 **65,458 字节**，测试代码另减 **898 字节**。CSS本批净减 **60,419 字节**，累计净减 **213,105 字节，约 10.85%**，沿用本会话最初1,963,517字节基准。按UTF-8、LF统计，不把其他会话的增量或测试退役计作生产源码删除量。

- 人物、设置和公共界面：清退旧示例牌、旧卡池字段、设置说明、背包排序、首页纸层、旧换肤CSS及图集奖章已不使用的路径/文字样式。保留动态奖章状态、当前换肤动画控制器和三个首页入口的home-orbit。
- 基地、仓库和交易所：清退旧导航包装、旧首页简报、旧详情弹层、旧高级筛选/页签、旧设施摘要、旧档案直属卡板、旧故事条和失效的交易标记；当前公共卡牌浏览器和各v12生成器保留。
- 地图：删除game.boot对旧pocket-strip的装配，退役每600ms查找已消失的章节列表的空轮询；删除主页面、开发页和现行预览中的旧样式引用。保留当前章节名称、阶段提示，以及game.run.scenes仍生成的eps-fate。
- 奖励：清退cqo-progress、exr-overline、exr-bulk-note、battle-loot-summary等无生成端结构；保留当前总览、金币、待处理提示及排序说明。
- 189条完整旧规则和多处旧选择器分支已删除。会改变活分支特异性的4处混合规则保留，7份冻结候选原字节保留。相邻重复声明块仅有约1.3KB且分散26文件，本批未为此扩大修改。

老板逐项确认后删除以下5个文件，原文及SHA256保存在本目录：

- game/css/page-shop.css
- game/css/page-classes.css
- game/css/map-cover.css
- game/css/pocket-strip.css
- game/src/experience/pocket-strip.js

前三份样式全游戏和当前预览无加载入口；后两份旧条已无DOM生成端和装配入口。历史注释中提到旧样式的文字不作为运行时加载引用。完整范围、快照和哈希见[changes.json](changes.json)，删除清单见[retirement-plan.json](retirement-plan.json)，规则级证据见[css-details.json](css-details.json)，统计见[summary.json](summary.json)。

## 验证

- 42份存留且改动的CSS通过Stylelint，编辑的JS与测试通过ESLint；修改前完成语法解析，最终自有源码SHA256一致，定向diff检查通过。
- 20个测试文件、216项现行检查通过，覆盖启动/画布生命周期、基地实际结构、人物切换、成就、奖励流程、首页返回，以及架构守卫。主批记录见[target-tests.json](target-tests.json)。
- 主批中的两项旧CSS守卫在本批前就要求已不存在的class-dossier/stash-row；已改为检查存留的共享面板、实际仓库布局和成就样式，原出征人物保护仍保留。原失败保留，修正后该文件全通过，见[css-guard-tests.json](css-guard-tests.json)。未把初次失败计为通过。
- 只验证已退役章节轮询自身的一项测试随运行链退役，四处旧mock同步删除；不补空断言、不增加通过数。旧cqo-progress字号断言退役，实际奖励DOM和流程断言保留。
- 资源审查见[resource-review.json](resource-review.json)：本批前后资源保留/排除结果相同；唯一关联的scenes.css资源URL声明逐字相同，原指纹在本批前已不匹配，未改登记或扩大排除清单。
- 按老板要求未实页，未构建、提交或推送。当前返修的overlay、战斗决策壳、战斗场景和公共顶栏占用未修改；此结果不代表全项目零冗余或全量验收通过。
