# 被覆盖卡图的只读发布审计

<!-- cleanup-status-20261019 -->
> 2026-10-19清理后提示：本报告及本目录附件记录当时状态，其中提及的旧资源、旧音频实现或旧交付路径可能已按批准清单删除。“保留原文件/保留旧包”不代表今天仍可访问。当前保留包、替代入口与执行回执见[清理后状态](../../CLEANUP-STATUS.md)；下文历史验收结论与原始内容保持。


## 当前实施状态（追加授权后）

精确30项已追加到现有 `runtime-asset-redundancy-review.mjs`，专门分类 `shadowed-card-art` 仅锁定 art.js、data-loader.js、art-mapping.json。原有排除算法、Vite双清单统一过滤及复制逻辑均未修改。当前真实排除数 **165 → 195、零告警**。

- 改动：一个审定定义、两个既有测试、一个新真实卡图测试；见 [implementation.patch](implementation.patch) 和 [implementation-receipt.json](implementation-receipt.json)
- 7份定向Vitest **68/68通过**；四文件聚焦ESLint通过
- 真Vite hooks仅在虚拟文件系统测试，不是正式build：双manifest与copy均过滤30项，替代图/缩略图完整保留，旧源文件不变；恢复类别时旧30项重新发布
- 76项旧/新原图与缩略图观察值SHA全部保持审计值；生成manifest、资产许可清单、预算、Vite和算法均未在本轮改动
- 未build、未提交、未开浏览器；实际产物、预算与实页仍待父任务统一验证

下文及 audit-result / publication-proposal / receipt 保留实施前的只读审计基线，不应把其中历史“未实施”当作当前状态。

## 实施前审计结论

建议父任务先将下表 15 张卡的旧原图及对应旧缩略图，共 **30 个发布文件 / 1,291,352 B / 1.231529 MiB**，加入现有保守发布排除机制。源文件完整保留；不改图、不改许可、不放宽预算。

源候选 JSON 实际包含 19 张卡、38 个文件。“30 项”是其中原文件 stem 在 527 份运行源码中零引用的 15 对，不是 30 张卡。以下是首阶段只读审计结果，当时未实施生产修改；当前实施状态见上节。

- 30 个旧文件、30 个替代原图/缩略图均存在；全部 SHA256 与 R3 真实发布清单逐项一致
- 当前现有排除结果 165 项、零告警；仅在内存中追加本次 30 项并锁定选择器后为 195 项、零告警
- 独立真实模块 Vitest 8/8 通过，含缺缩略图回退和全现役卡库路径检查
- 另 8 个有字面命中的文件暂不加入本批；霜结之刃旧原图仍有演示页直接引用
- 未运行正式构建或浏览器；不能据此声称四项预算失败已解决。收益只计确定的图片文件字节，不计可能减少的 JS 清单开销

## 精确 30 项

下表每行排除“旧原图路径”及其 `thumbs/` 前缀路径。例如第一行为 `cards/spell-tt8-curse1.webp` 与 `thumbs/cards/spell-tt8-curse1.webp`。完整展开、带分类的机器可用名单见 [publication-proposal.json](publication-proposal.json)，逐项 SHA、R2/R3 清单匹配见 [audit-result.json](audit-result.json)。所有路径相对 `game/assets/`。

| 卡 ID | 旧原图路径 | 当前覆盖路径 | 原图 + 旧缩略图 B |
| --- | --- | --- | ---: |
| tt8-curse1 | cards/spell-tt8-curse1.webp | cards/curse-drain.webp | 92,426 |
| tt8-curse2 | cards/spell-tt8-curse2.webp | cards/curse-freeze.webp | 125,968 |
| tt8-curse3 | cards/spell-tt8-curse3.webp | cards/curse-venom.webp | 115,960 |
| tt8-curse4 | cards/spell-tt8-curse4.webp | cards/curse-silence.webp | 120,820 |
| tt3-staff | cards/equip-tt3-staff.webp | cards/studio-expanded/tt3-staff.webp | 32,694 |
| tt3-fate-wheel | cards/equip-tt3-fate-wheel.webp | cards/studio-expanded/tt3-fate-wheel.webp | 91,512 |
| tt3-wolf-bow | cards/equip-tt3-wolf-bow.webp | cards/studio-expanded/tt3-wolf-bow.webp | 81,812 |
| tt3-twinwater-mail | cards/equip-tt3-twinwater-mail.webp | cards/studio-expanded/tt3-twinwater-mail.webp | 132,744 |
| tt3-grass-armor | cards/equip-tt3-grass-armor.webp | cards/studio-expanded/tt3-grass-armor.webp | 158,738 |
| tt3-blooddrinker | cards/equip-tt3-blooddrinker.webp | cards/studio-expanded/tt3-blooddrinker.webp | 66,480 |
| tt8-demonslay | cards/equip-tt8-demonslay.webp | cards/studio-expanded/tt8-demonslay.webp | 21,730 |
| tt8-archdemon | cards/equip-tt8-archdemon.webp | cards/studio-expanded/tt8-archdemon.webp | 20,074 |
| tt8-heavensword | cards/equip-tt8-heavensword.webp | cards/studio-expanded/tt8-heavensword.webp | 65,976 |
| tt7-arcanescroll | cards/equip-tt7-arcanescroll.webp | cards/studio-expanded/tt7-arcanescroll.webp | 96,728 |
| tt12-raygun | cards/equip-tt12-raygun.webp | cards/studio-expanded/tt12-raygun.webp | 67,690 |

## 为什么这 30 项可排除

### 真正的渲染选择器

`game/src/core/art.js:462-480` 每次取稳定 `card.id`，在第 468-469 行先查 `DATA.art.cardArtOverrides[cardId]` 并直接返回覆盖图。随后才有 `spell-${cardId}`、`martial-${cardId}`、`equip-${cardId}` 及更后面的英雄旧映射。以上 15 张卡均保留在旧族集合中，同时拥有非空覆盖映射；所以旧路径的构造分支不可达。

`game/src/core/data-loader.js:24-36` 对 art JSON 深冻结。运行时没有其他模块读取或修改这些美术映射；源码扫描的全部 `DATA.art` 取值都集中在 art.js。旧存档对象即使缺少类型、名称或职业，或者带有旧 art 字段，仍由稳定 ID 的覆盖映射先返回。

卡库网格 `game.cardslib.page.js:304`、卡牌渲染 `cards.view.js:137`、大图/悬停 `ui.js:149-153` 以及职业选页的卡图预热均经 `Art.cardIcon`。测试直接执行真实 Cards/Art 模块，覆盖全部现役卡的 full/low 输出和 collectCardAssets；没有出现 38 个旧路径中的任一个。

### 动态路径审计

527 份源文件覆盖 `game/src`、`game/data`、`game/css` 和 `game/` 根 HTML，排除自动生成清单。30 项所属 15 个完整文件 stem 均零引用。

已核对其他卡图动态构造：

- `rarity-design-lab.js:9-12,203` 仅三个固定样本：hero-warrior、spell-cc-demon、martial-tt3-frost-slash
- `wu-career-frame-preview.js:3-6,16` 仅飞刃偷袭、金蝉脱壳、偷袭三个固定样本
- `base-preview-rooms-v7.js:6-13` 仅长剑、冰刺、连射、血箭、满月形态五个固定样本；调用链传入该固定列表，不能产生本次 15 张图
- 其余已审定动态消费者构造角色、帧、场景、图标、音效，或转交已经生成的 DOM URL。此次扫描识别出的 22 个 JS opaque 消费者均匹配现有指纹
- 根 HTML 的固定图表无上述 30 项；霜结之刃的例外单独保留

### 缩略图、原图回退与预取

`art.js:117-124` 仅按最终覆盖路径查 `THUMB_MANIFEST`，存在则加 `thumbs/`，不存在则使用**同一覆盖图的原图**。它不会按旧族路径回退。测试同时移除替代图的缩略图元数据后，19 张卡的 low 模式仍选新原图。

原图不存在、下载失败或图片损坏时，cardIcon 没有重试旧族图的 onerror 回退。替代原图和替代缩略图必须继续发布；本次已逐个核验其存在与 R3 SHA，不以“旧图是网络 fallback”为由保留旧30项。

但旧文件目前仍在生成原图/缩略图清单内，`game.boot.js:807-829` 会启动预取。只停止复制文件会制造 404。因此必须继续沿用 `vite.config.js` 的 `writeArtManifest`、`writeThumbManifest` 与最终 copy 的同一排除集合，不能只改其中一处。旧 source asset-manifest 是许可/来源观察清单，不是运行时加载器，不应清理或改写。

## 本批保留的 8 个文件

以下原图和对应 `thumbs/` 均保留，本批收益不包含它们：

| 旧原图 | 现有命中 | 判断 |
| --- | --- | --- |
| cards/hero-forbidden.webp | art-mapping.json:305 的 heroCardArt 值 | 逻辑被覆盖，但现有通用 stem 护栏会保留；如单独实施需精确语义守卫，不应删除映射或绕过护栏 |
| cards/spell-tt3-fireball.webp | card-v3.css:12 的 data-asset-key | 仅旧布局选择器，没有 url()；当前覆盖分支输出 card-tt3-fireball，不使用该 key。可做后续精确语义审定 |
| cards/martial-tt3-skewer.webp | card-v3.css:6 的 data-asset-key | 同上；不是图片下载引用，可做后续精确语义审定 |
| cards/equip-tt2-frostsword.webp | battle-redesign-demo.html:502 的直接图片 URL | 确有来源页消费者，保守保留旧原图；其 thumb 无直接请求，但本批不拆此对 |

前三对额外合计 296,286 B；霜结之刃旧 thumb 为 6,872 B。它们仅为后续审定信息，不混入已证明零 stem 的 30 项，不通过扩大忽略规则偷取收益。

## 已执行的检查

1. 527 文件全源快照、精确/动态引用扫描，19 张卡的覆盖和旧族成员关系核验
2. 每张旧图、旧 thumb、替代图、替代 thumb 与 R2/R3 发布记录的 bytes/SHA 匹配
3. 仅内存追加新分类与 art.js / data-loader.js / art-mapping.json 指纹：165 → 195，零告警
4. 对30个路径逐一创建“新 lazy 模块恢复直接请求”的模块图样例，既有最终守卫全部拒绝
5. 内存破坏性夹具：移除 override、改选择器、改冻结 loader、缺选择器、新动态消费者、语法错误均保留本批；恢复静态引用保留该原图及同 stem 缩略图
6. 真实模块 Vitest 8/8：19 候选 × 4 种卡对象 × full/low × defer/直接；全现役卡库；模拟 manifest 排除；无替代 thumb 的原图回退；基线预取；保留8个例外

另已通过两份审计脚本的 Node 语法检查；docs:check 通过（461 条现行文档链接、零 findings，按工具范围不扫描 evidence，因此本 README 的两条本地链接另行验证存在）。最终复核527份源码快照与13个核心文件指纹均未变化。详见 receipt.json。

测试先遇到独立测试夹具的 import.meta.url 被 Vite 转换为浏览器 URL，已在自有测试中改用项目 cwd 读文件后重跑通过；未修改生产逻辑。

## 父任务实施后必须验证

- 仅追加 publication-proposal 的精确30项和专门类别；沿现有指纹/新动态消费者保守兜底，不修改任何预算、许可或源资产
- 目标替代原图和 thumb 必须保留，源30项必须仍存在；新增/恢复旧引用、改 override/选择器时应停止排除
- 更新相关既有发布回归数量195；增加上述 category 退回与30个资产保留/省略测试
- 运行相关 runtime-asset-redundancy、runtime-asset-redundancy-plugin、runtime-asset-publication、card-art-coverage、cards、art-preload-scheduling 等定向回归
- 正式构建后核对完整 Rollup 模块图守卫、生成的两个 manifest 与实际输出：旧30项都不存在，替代30项都存在，源30项原 bytes/SHA 未变
- 正式实际产物至少少 1,291,352 B 的这批图片；重新查看总包/图片/声音/字体预算的各自结果，仍失败就如实保留失败
- 本次没有浏览器或真实网络执行，父任务可在正在使用的实机做卡库低清、放大原图、战斗代表图确认；不复用“未运行”作为实页通过

## 重现（实施前基线）

在项目根，用 Node22：

```sh
export PATH=/workspace/shared/toolchains/node-v22.23.3-linux-x64/bin:$PATH
node docs/evidence/2026-10-16-shadowed-card-audit/audit-shadowed-cards.mjs
node node_modules/vitest/vitest.mjs run --config docs/evidence/2026-10-16-shadowed-card-audit/vitest.audit.config.mjs --reporter=verbose
```

该重现针对实施前基线（当前配置已195项，勿覆盖历史基线结果）。审计脚本只写本证据目录。Vitest 独立配置不加载生产 Vite 插件，缓存也位于本目录；没有构建、写生成清单、开启服务或访问浏览器。候选来源与 R2/R3 清单位于共享审计目录，绝对路径已记在 audit-result 中；若迁移环境需传入相同内容而非假定这些共享路径存在。
