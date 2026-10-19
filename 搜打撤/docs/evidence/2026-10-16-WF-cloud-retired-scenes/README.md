# 退役场景发布排除

<!-- cleanup-status-20261019 -->
> 2026-10-19清理后提示：本报告及本目录附件记录当时状态，其中提及的旧资源、旧音频实现或旧交付路径可能已按批准清单删除。“保留原文件/保留旧包”不代表今天仍可访问。当前保留包、替代入口与执行回执见[清理后状态](../../CLEANUP-STATUS.md)；下文历史验收结论与原始内容保持。


父任务逐项批准19个精确场景/缩略图，新增独立retired-scenes审定类别，预计正式发布减少3,428,566B。所有原文件保持原SHA，不物理删除；未加入第二批旧卡面。

## 19项精确退休发布候选

| R2发布路径（assets/之后） | 字节 |
|---|---:|
| scenes/base-home-v4.webp | 103,974 |
| scenes/battle-street-amber-anime-v1.webp | 414,722 |
| scenes/entry/winter-arrival-1011-v1.webp | 112,604 |
| scenes/entry/winter-arrival-1011-v2.webp | 88,082 |
| scenes/rewards/chest-small-1011-v2.webp | 526,708 |
| scenes/rewards/chest-small-cardstyle-1011-v1.webp | 815,604 |
| scenes/scene-chest-boss-anime-v1.webp | 124,864 |
| scenes/scene-chest-class-anime-v1.webp | 93,464 |
| scenes/scene-chest-large-anime-v1.webp | 156,162 |
| scenes/scene-chest-medium-anime-v1.webp | 131,346 |
| scenes/scene-chest-small-anime-v1.webp | 131,822 |
| scenes/ui-loop-0925/expedition-banner.webp | 118,232 |
| scenes/ui-loop-0925/rewards-convoy-success.webp | 127,652 |
| thumbs/scenes/battle-street-amber-anime-v1.webp | 17,594 |
| thumbs/scenes/scene-chest-boss-anime-v1.webp | 95,232 |
| thumbs/scenes/scene-chest-class-anime-v1.webp | 71,490 |
| thumbs/scenes/scene-chest-large-anime-v1.webp | 109,926 |
| thumbs/scenes/scene-chest-medium-anime-v1.webp | 97,124 |
| thumbs/scenes/scene-chest-small-anime-v1.webp | 91,964 |

## 使用证据与实施约束

- 对game/src（排除generated）、game/css、game/data及根HTML共527份源码扫描，19项的完整文件stem均零引用。原始当前文件逐项SHA均与R2相等
- art.js:468-489：卡面覆盖路径仅来自DATA.art.cardArtOverrides；场景动态路径仅来自DATA.art.eventCardArt。art-mapping.json中19项均不存在
- game/src/run/chests.js:95及chest-opening-art.js:4-11：现行道具仅safe-simple-v7四帧和burst；game.run.data.js:41与scenes.css:507/528：节点整页仍用scene-chest-anime-v2，未使用旧small/medium/large/class/boss-v1
- game/src/battle/view/battle.scenery.js:2-18：当前bridge/street/ruins/core均明确选择，不包含battle-street-amber-anime-v1
- entry-events.css:148/152：现行入城图是modern-winter-entry-1011-v2；旧winter-arrival两版为未采用候选，历史交接明确未获认可
- game.session.death.js:15：当前结算车队只保留fail图；battle.css:447的success/fail花括号为注释，当前chests没有success图请求
- lab.ending.js:14-28：只消费固定ending-1/2/3，不拼接旧场景路径
- 现行opaque消费者其余构造路径限于portrait/frame/icon/card/audio，或转交已有DOM的URL，不构造这19项路径。所有新/变更opaque源码仍应由现有审定机制保守兜底
- 实施建议：既有RUNTIME_REDUNDANCY_REVIEW新增精确retired-scenes类别，对当前选择器及art-mapping锁指纹，沿用源扫描和完整模块图再核；19项中6个thumbs由现有manifest过滤同步省略，不物理删除任何源
- 首次只读collectReviewedRuntimeAssetExclusions显示game.menu.pages.js新增opaque消费者未审，结果0排除；此项已即时告知父任务，父接回统一审定。本批未绕过该保护；最终状态见验收记录


现有通用精确机制已支持新类别，无需改runtime-asset-redundancy.mjs逻辑。新引用会恢复对应文件，映射/选择器变化会恢复整类，新动态消费者会保守恢复全部，完整模块图仍二次拒绝遗漏引用。菜单新拆分消费者交父任务统一审定，本任务未改其opaque指纹。

## 本批验证

- Vite.writeThumbManifest新增精确审定排除过滤，避免6个已省略缩略图残留在逻辑清单；新回归保留
- 相邻15文件112项通过，0失败/跳过；包含精确19项原SHA保持、当前safe/入城/四战场保留、动态引用fail-closed及真实Vite hooks虚拟文件系统测试，不运行真实build
- 相关ESLint与语法通过；父完成菜单动态消费者审定后，真实全仓排除165项、0警告；最终4文件26项全部通过，不改变保护断言

最终见final-target-tests.json及source-exclusions.json；首轮target-tests.json保留两项失败过程（菜单待审与thumb清单漏接），后者修复后的回归已通过。
