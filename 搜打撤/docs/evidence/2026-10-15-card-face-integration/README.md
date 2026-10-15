# 卡牌共用展示接入

状态：完成未提交。老板授权的网页版卡牌样式已接入；未改玩法、卡库或存档契约，未提交、推送或构建。复用已有5200服务，无新增服务进程。

## 交付

- 保留SDT.Cards.cardHTML(card,size,options)签名、缓存、实际费用修正、术语/引用交互与文字转义。正式卡面仅由该模板产生；静态搜索有26个直接调用文件，覆盖hub/run/ui/battle及其别名转发。
- 根盒完整包含2:3透明框，内层画窗按透明开口定位；画窗上53%为卡图，下47%为深色正文，窄类型铭牌跨图文交界。宿主只控制完整卡片的尺寸、位置、选中与交互，不再分别猜外扩框留白。
- 费用使用靠框切角徽与Oxanium粗体数字；降费绿、升费红保留。卡名按有效品级配色，棱彩保留卡名渐变、边缘光与扫光，减少动态偏好可关闭动画。
- 13款原比例重绘框转512×768无损WebP，共1,485,570字节，最大146,622字节。透明度与黑/白背景可见像素核对通过；runtime-assets.json与asset-audit.json登记本轮13项，范围内问题为0。
- 替换card-layout-selected正本，移除113项跨页旧卡内覆盖，退役rose/career两份旧样式映射。旧源图保留；退役CSS文本保存在retired-*-frames.css。背包、卡池、整备、仓库和商店适配完整框体尺寸；兼容shop-v3卡牌商品改走共用接口，基地物资图标保持物资用途。

## 验证

| 检查 | 结果与证据 |
|---|---|
| 卡牌接口、全种子目录、框体/品质/职业、费用/转义/全文、样式唯一性、战斗详情/布局、仓库/商店/收藏/人物、架构哨兵 | 16份定向文件，176通过、1跳过；[最终报告](../2026-10-15-WF-card-face-global-1015/2026-10-14T17-24-30.373Z-fdffe6b9.json) |
| 最终CSS宿主尺寸与阅读检查 | 3份相关文件37通过；[报告](../2026-10-15-WF-card-face-global-1015/2026-10-14T17-22-12.156Z-67cc64d3.json) |
| 静态 | 类型、定向ESLint、408文件语法、128份CSS解析、差异与文档检查通过 |
| 原生输入 | 战斗详情打开/关闭/焦点返回；真实指针拖拽出牌后能量2→1、叠数5→4、一名敌人被击败 |
| 运行卡面 | final-browser-check.json：当前窗口14组宿主/场景、77个卡面实例，均为split接口，框图处于组件盒内，内层卡图占比约53%；包含8种类型、8档有效品级和13款框 |
| 实页图片 | final-warehouse.png、final-warehouse-zoom.png、final-departure.png、final-departure-card-pool.png、final-person-pool.png、final-prism.png、final-base-shop.png、final-run-shop.png、final-rewards.png、final-bag.png、final-battle-inspector.png、final-battle-focus.png、final-battle-play.png |

基地、人物卡池、出征整备与仓库详情经普通UI导航检查，没有确认新出征或购买商品。战斗/对局商店/宝箱/背包通过任务独立验收页调用项目原有devJumpNode，属于不占档位、不写存档的构造节点；节点内点击、键盘与拖拽为内置浏览器真实输入。全种类组件样本直接调用生产cardHTML，另标为构造样本。

中途截图不作最终版通过证据；以final-*和final-browser-check.json为准。共用组件封装完整框体前曾发现背包格与卡池侧栏裁框，已通过完整根盒与宿主适配解决。

## 边界

全局资产审计仍有93项范围外错误、618项旧债警告，本轮13个新框无问题；未扩大修复或改债基线。未运行混合工作树build、完整真人跑局、全场景长时性能采样或远端CI。收藏室空态、制作坊及每一种事件/牌堆组合未逐状态目视；共享接口、调用链和相关定向测试覆盖已列出，不以构造节点冒充完整真人跑局。

旧制作人记录保留，本轮仅在当前工作树修改自有卡牌范围。规则与入口见[卡牌显示](../../cards/card-display.md)、[职业框](../../cards/career-frames.md)；原图与提示词在game/art-source/card-frame-study-1014/，运行框在game/assets/ui/card-frames/split-1014/。
