# 普通战牌库词条回归与动态素材消费者复核

状态：根会话本轮 effects/core/抽牌提示改动已按 `root-before` 原字节基线只读复核；仅更新相关测试，未改源码、资源、省略配置或指纹。

## 规则回归

确认的新规则：普通战开局随身牌仍入手，独立 99 张初始攻击库由领域实现；抽牌、指定类型抽取和抽到 N 张使用真实牌库。洗入词条可在普通战使用，不再改为凭空获得初始攻击。

- `effect-steps.audit/deck/kills/recovery/m1` 统一调用真实抽牌端口；`battle.target-rules` 移除普通战无牌库的旧禁用；`battle.core` 允许普通战打开牌库；factory 的替换初始攻击与元素符印解锁抽牌沿用现行真实库端口；卡面与设计器提示同步。对本次改动未发现额外阻断。
- 首轮最近 6 个测试文件共 84 项，其中 8 项失败全是旧普通抽牌降级断言：`m1-contract` 两条旧日志期望，以及 `structured-effect-authority` 六条普通过滤抽牌仍期望 `grantSha`。确认新规则后只更新这些期望，仍保留来源唯一、随机次数和不重放文本的原断言。
- 新增 `tests/normal-effects-deck-regression.test.js`，使用正式卡库的真实「铁甲阵」「武装」及真实 BattleSession，不用临时自造卡定义：铁甲阵向普通 99 库洗入 5 张实际实体，随后抽 104 张逐一移入手牌、库清空后再抽返回 0 且不新造实体；武装在纯初始攻击库中检索装备时手牌不凭空增加、库和临时实例数保持；普通牌库查看开关不移动卡牌。

验证：

- `npm run test:target -- tests/normal-effects-deck-regression.test.js tests/m1-contract.test.js tests/structured-effect-authority.test.js`：3 文件 54 项通过。
- 首轮未受期望更新影响的 `card-effect-semantics/effect-verbs/tt3-effect-baseline/requested-equipment-effects`：4 文件 33 项通过。
- `npm run test:target -- tests/card-render-context.test.js tests/card-audit.test.js tests/mistbox.test.js`：3 文件 31 项通过。
- 本轮相关共 10 个不同测试文件、118 项通过；未 build、启动服务或操作浏览器。原两份测试字节备份在仓库根 `.tmp/battle-flow-1020/effects-tests-before/`。

## 动态素材消费者审查

已读取 `scripts/runtime-asset-redundancy-review.mjs` 的现行指纹规则、`runtime-asset-redundancy.mjs` 的实际检测，以及其引用的 `2026-10-16-WF-integration-ship-1016/asset-contracts.md`。动态消费者变化、未知消费者或路径分析不确定时，规则保守保留全部候选；不能靠自动刷新指纹跳过审查。

| 消费者与比对基线 | 本轮素材路径/排除边界判断 |
| --- | --- |
| `battle.vfx.js` 对 `timing-before/game/src/battle/view/battle.vfx.js` | 只增加动作交接、续播及跳过已同步命中的额外等待。动态图片仍为 `assets/battle/fx-sticker-` + 从 cls 以 `sticker-(\\w+)` 提取的名称 + `.svg`；未新增任何 frames、chests、map-nodes、过场候选路径或改其输入。 |
| `battle.layers.js` 对 `ui-before/game/src/battle/view/battle.layers.js` | 本轮差异为引用 `playerCombatStatsHTML` 替换属性文字；该辅助仅生成已有图标占位与文字提示，无动态资源加载。`allyFigure` 仍只在固定 `assets/portraits/allies/` 三项 federal-patrol-v1/federal-shooter-v1/sealed-limb-v1 中选择，否则使用 runner 图标。路径与范围未变化。 |
| `battle.frames.js` 对 `timing-before/game/src/battle/view/battle.frames.js` | 新增动作续播和当前帧时钟查询；加载路径仍为 `assets/portraits/frames/${role}/${name}.webp`，角色/名字仍来自现行五角色 catalog 和其实际可用帧集，静态回退仍为各自 sprite-v1/neutral。新辅助的 frame-038/039/f038 字符串仅用于已播放列表中的接触帧比较，不发请求或恢复旧帧。 |

本轮未改变候选清单、类别/排除前缀、已退休资产选择器、源文件或发布省略策略；按现行规则可由根会话在以上语义复核后统一更新对应精确消费者指纹。本子任务没有刷新 hash，也没有声称当前资产门已经恢复绿灯。

## 最终定向补验与单项场景指纹复核

根会话随后授权本子任务更新 `battle-pure-rules.test.js:104` 的旧普通战 deckOnly 禁用断言为 `null`。同一测试中的结构化 unplayable、能力卡限制、手牌代价及改写描述不改变权威的断言全部保留。原字节连同此次审查配置备份于仓库根 `.tmp/battle-flow-1020/effects-tests-before/`。

另按根会话明确派工，复核 `game.run.scenes.js` 当前差异：新增 `createCardInstance` 与存档检查点入口；调整宝箱完成前消费节点的回调/持久化时点；两处浅复制发卡改用正式实例构造器。场景构造器、SCENES/NODE_BG/PICKUP_BG/PRELOAD_SCENES/WINTER_BATTLE_LAYERS 数据入口、场景资产键和 URL 选择范围均未变化，也未重新引用 retired-scenes 候选。

因此仅更新 `scripts/runtime-asset-redundancy-review.mjs` 中 `retired-scenes` 类别的 `game/src/run/game.run.scenes.js` 一项 SHA256，由 `c5f293be5a78ab8b05bc630b09ac5fe1187344b82e3888629f52daef96205532` 改为 `c250bdc2fec20371637a60421506697e53162d0e7d06cccdad8f8f9fbf21e5ad`。计算与正式脚本一致：读取完整 UTF-8 内容、CRLF 归一为 LF 后 SHA256；没有截断、放宽规则或刷新其他项。

最终集合：`runtime-asset-redundancy`、`battle-pure-rules` 加上前述 10 个 effects 最近回归，**12 文件、153 项全部通过**。完整输出保存在同目录 `effects-final-regression.log`，退出码 0。未 build、启动服务或操作浏览器。

合堆补充复核：battle.layers.js 新增差异仅空手提示与只看 drawPile 的条件，未改素材构造、Art 调用及排除前缀；规范化 SHA256 更新为 7477064e4630bbdb1909bf0cb482c0a83711ca4a2a6d6c6a58313f10f912c9ee。frames/vfx 字节与上一轮审查相同。
