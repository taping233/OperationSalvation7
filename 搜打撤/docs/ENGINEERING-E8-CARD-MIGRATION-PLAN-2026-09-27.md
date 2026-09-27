# E8 全卡清单与首批规则迁移

Friday制定，2026-09-27（Asia/Shanghai）。老板在E7落库后明确“执行下一步”。协调聊天`01a0e1d6-342e-7971-8922-ad614061a6d4`（local）。本批使用独立新聊天、新主指挥和全新默认模型成员，旧E2–E7团队与三个Luna盘点成员保持停写，不复用实施者。

独立主指挥聊天：`01a0e225-8d81-7341-97f6-fe8daefe177a`（local），标题“E8 全卡清单与首批规则迁移”。原类型盘点作者仅获原报告事实纠错窗口（@ts-check及动态状态转移边界），不参加E8实施、测试或Git。

## 基线与证据

实时HEAD `7c8e3836663fd650785a0b402cc18d5a55e8591a`；E7生产提交eeffe5e。tracked/index干净，原排除未跟踪及三份ENGINEERING-PARALLEL报告保留。E7原门禁172文件/1134项全过，人工hover按老板选择跳过、未验证，旧04/05未归因。不以未验边界阻止独立卡牌工作，也不重新开展E7实页。

三份Luna盘点仅为导航和建议，未运行生产初始化或类型检查。E6历史生产272=68有rules+204legacy，CARDS_SYNC55为独立口径；本批须按实时初始化复测，不能硬编码历史数充当事实。类型盘点关于checkJs:false的表述不得误用：真实根中的@ts-check仍启用JS诊断，E2/E3/E6已有生产检查及负例。禁止退回只检查声明/fixture而称实现受检。

只开发搜打撤Vite。原未跟踪排除：.codex/、.ui-art-loop-0925/、.ui-loop-0926/、AGENTS.md.bak-20260927-082309-context、根package.json/package-lock.json、game/shots/、E2证据01-boss-empty.png及02-boss-deselected.png。三份Luna报告由Friday协调，团队只读，不混入E8交付。GitHub仓库已按老板要求私有，不改可见性、不推送。

## 本批交付

1. 使用现有测试/初始化接线和完全隔离的内存存储，执行真实生产卡库初始化。禁止读取浏览器/player存储；不调用写玩家库的同步脚本，不改cards-sync.json。输出全部现行卡稳定ID、名称、来源、rules有无、schema结果、capability结果、规则域、trigger及op，CARDS_SYNC单独报告。记录初始化顺序和取数口径；未知值明确记录，不按名称猜测。
2. 建立逐卡迁移表。区分“有结构化数据”“对应消费端确实使用”“仍有文本效果”“需新增执行能力”“仅非战斗域/无战斗效果”。无rules不等于每张都需要battle/onPlay；有rules不等于全效果结构化。逐卡关联现有测试或明确未覆盖。现有能力支持与base/bag域支持分别说明。
3. 选择至多8张、单一效果家族、可复用现有schema/执行能力的legacy卡作为首批候选；先向Friday交精确ID、旧行为来源、拟规则、目标/费用/顺序/随机/条件的等价性和文件归属，获范围裁决后迁移。若没有确证的简单候选，报告阻断与最小能力缺口，不硬凑数量、不直接增加复杂能力。选择数量按实际收益，不必凑满8张。
4. 迁移必须保留稳定ID、数值、文案、经济与玩法语义。特别核费用、目标、免疫/沉默、无目标、普通/BOSS差异、同步回填与历史自定义卡覆盖语义。不把文本触发丢掉、不双重结算、不覆写玩家编辑。复用既有迁移策略，持久迁移标记或回填方案先报告裁决。
5. 为选定卡先固定真实旧行为，再比较真实BattleSession新旧结果；不是只验证JSON形状或mock解释器。结构化执行不再依赖描述的部分应有改写描述仍等价且只执行一次的证据；混合效果不能盲目把整段文本全改掉。含随机时固定初态、流快照、动作和版本，不只同seed。候选迁移前后数量守恒，支持/legacy计数差异对应精确ID；保留E6付款前拒绝与E7可见反馈。

## 分工与实施窗口

Friday持本PLAN、范围裁决、Git index/全量与最后提交；主指挥持本批RESULT、团队接线、精确文件分工、独审和进度回报。主指挥先核README/status/log、相关源码和现有环境，回接管及单写方案，Friday确认后实施。清单工具/清单文件、迁移代码、定向测试各自单写，不让多个成员共同写cards.sync/schema/resolution/engine。全新独审只读，直接检查代码与实际输出。

建议先使用独立清单输出和现有测试环境，无需浏览器。若迁移实际影响可见交互，由主指挥申请唯一Codex内置浏览器当前窗口及隔离origin，不使用旧玩家档、不擅操作E7保留现场。超过300行先rg再读片段；不重做全仓审计、不造新框架、不同时上类型改造/回放系统。

不build/install/push/delete/清理/回滚/amend，不改config.toml/全局配置、cards-sync.json或玩家档；任何文件删除先列路径给老板。共享README/PROJECT-STATUS不写，记录仅用本批自有文档。代码任务授权不等于本批Git提交授权；老板刚明确的提交授权为E7，E8完成后先提供具体可审查结果再按项目约定请求E8本地提交，不提前操作index。

## 验收与收尾

运行最小必要的隔离初始化/清单检查、选定真实卡牌及受影响既有定向；不要写只镜像实现的测试，不提前全量。脚本输出应可重现并有重复ID/缺分类/来源与计数核对，不能拿手填汇总当执行事实。独审通过后全队停写，交精确文件、输出证据、迁移前后ID差异及剩余能力缺口。全量只在最终获准统一提交窗口走原pre-commit，不绕过、不重复跑。

接管/范围裁决/真实阻断/全部完成时主指挥主动向Friday报告，普通等待不刷进度；沟通受拒准确报原因，不换身份或工具绕过。用户停止/暂停立即全队保留现场，不再检查、修复、测试、清理或提交。未来进一步迁移/类型化/诊断记录不自动启动。

## 第一窗口：真实清单实施

2026-09-27 主指挥回接管：HEAD7c8e383，tracked/index干净，本地upstream ahead17/behind0未fetch。Friday批准全新清单成员单写tests/helpers/e8-card-inventory.js、tests/e8-card-inventory.test.js以及docs/evidence/e8-card-migration-2026-09-27/catalog-before.json与catalog-before.md；主指挥单写本批RESULT，另一全新成员只读独审。其它生产文件尚未分配写权限。

复用Vitest jsdom和E6真实初始化顺序ensureSha→ensureStarters→ensureTabletop→ensureDmgTypes→ensureEffectFields，使用独立内存storage并验证隔离。允许本批定向执行与显式输出；普通测试不得写证据/生成物，证据生成由专用环境开关启用且仅写上述两路径。helper保持纯装配，不在普通测试中读Git/浏览器/玩家存储；HEAD等元信息仅生成模式采集或注入。

同意metadata、production、cardsSync、checks的清单接口；记录稳定ID、原始来源与阶段增改、rules/schema/capability、域/时点/op、实际消费者/文本残留/测试引用/unknowns。来源或消费者未经逐项证据核实就明确unknown，不能通过卡名/描述正则将推断升级为已验消费。missingClassifications应同时披露unknown数量；重复ID/遗漏/计数不平作为实质失败。历史272/68/204与55只作对照，不硬编码为永恒正确数字。生成清单不等于牌效测试或实页通过。

清单独审后由主指挥提交精确候选及第二窗口方案；cards.sync.js/cards.js/迁移测试仅为待裁决候选，不提前落笔。先完成第一窗口，不重跑全量、不操作Git索引或提交。

## 第二窗口：三张固定治疗卡的onPlay迁移

2026-09-27 第一窗口交回并独审通过：实时真实boot顺序ensureStarters→ensureSha→ensureTabletop→ensureDmgTypes→ensureEffectFields；与E6反序在两份独立内存中初始化，逐ID完整JSON最终差集0。生产272=68有rules+204legacy、sync独立55全legacy；结构/schema与计数检查通过。consumer/text/testReferences仍全unknown（生产272+sync55），因此只完成结构清单，不宣称全库消费端/效果分类已核完。后续至少为本批三候选补实际路径与测试证据，其余unknown继续如实保留。

Friday实读catalog-before与目标/治疗旧路径，批准候选仅`tt-jinchuangyao`（金疮药heal20）、`tt4-woodify`（能量饮料heal6）、`starter-emergency-bandage`（当前卡库定版heal12）。只新增version1、battle.target self/area:false与onPlay heal/amountField:heal，不改其它字段、数值或文案，不扩执行能力。特别注意STARTERS还有同ID旧2点绷带定义及已有run副本；本批不把它们升为12、不重写ownedCards/口袋/存档，必须另验其旧路径仍按原值工作。有rules只表示该卡库版本的onPlay迁移，地图及普通/BOSS背包仍按既有文本入口，不能称全入口脱离文本。

批准一次性严格匹配回填：使用新marker`sdt-cards-e8-fixed-heal-rules-v1-seeded`，已有marker即跳过；仅在候选无rules且整卡与所选现定版canonical字段/值完全一致时添加规则（键顺序不敏感）。额外字段、任何数值/文案/元数据差异、已有rules、自建卡均保留，缺卡不补种。新对象构造和校验完成后单次saveAll，成功才marker；false/抛错不得marker或留下缓存内的半迁移。marker写失败后的再次执行不得重复改卡。全跳过可记“已做一次保守判定”，但不得把存储读取错误/损坏库降级当成正常空库或成功检查并盖章；先在现有接口范围证明读取有效，实质需要扩改存储接口则先报。并发库替换仍由原saveAll拒绝覆盖，不绕过。

接受明确取舍：标记后用户主动删rules、后导入旧卡、外部同步移除rules不自动修复；未匹配的旧库和已有对局副本继续legacy。此marker不是全部卡迁移完成证明，不为提高迁移率放宽匹配。canonical从实际选定TABLETOP10/11定义取值，不复制另一份可漂移的卡牌数值表。

单写范围：全新迁移实施者仅game/src/cards/cards.sync.js及cards.js末尾一处初始化接线；全新测试实施者仅tests/e8-card-migration.test.js及tests/e6-card-rules-capability.test.js的初始化口径/精确71-201预期适配（不放宽能力断言）；原本批清单成员持已有helper/test必要生成选择变更，并新增catalog-after.json/.md，禁止覆盖before，默认测试仍不得写产物。主指挥持RESULT和三候选消费路径/等价证据；独审只读。schema/capability/resolution/engine/bag及cards-sync.json不在修改范围。

先固定旧真实BattleSession行为，再新旧对照：正常/满血/近满、沉默/禁疗/叠加、self选择前不扣/选择后一次消耗、错误/无目标、BOSS手牌拒绝；地图及普通/BOSS背包既有治疗行为单列，描述改写不依赖性只验证onPlay。另测严格匹配跳过、自定义字段/已有rules/旧heal值、存储读写及marker故障、并发替换与重入幂等。旧实卡从before原始card取，不能先迁移后拿新卡删rules冒充全部历史定义。迁移前后仅三ID新增rules、总数守恒、sync原始串不变，以after实际差异证实，不仅改计数断言。

若真实旧/新对照发现不等价或须超出上述文件，先报Friday；不扩大规则表达力来迁就这三卡。必要定向与独审后按本计划收尾，E8提交仍待老板另行明确批准。

## 第二窗口修订：按真实地图背包入口迁移

2026-09-27，生产尚未修改时发现battle.lifecycle在普通/BOSS开局均排除道具。Friday撤销上述三候选的onPlay规则方案及把手牌fixture算成日常可达性的验收；保留调查证据，不删除已有文件。现批准同三ID仅添加`{version:1,bag:{use:[{op:'heal',amountField:'heal'}]}}`。game.bag.js既有useOwnedCard入口已优先消费此规则，因此不扩schema/能力/背包执行器，不改卡type或开局筛选。目标是地图背包真实入口的固定治疗迁移；普通/BOSS战斗背包仍依赖文本，明确未迁移。规则总数预期变为71/201，但不能将bag-only算作onPlay覆盖提升。

原strict canonical匹配、单次saveAll、存储故障和marker约束继续适用。marker改用`sdt-cards-e8-fixed-heal-bag-rules-v1-seeded`，区分未实施的onPlay草案。有效原始非空数组须与热缓存深等；空/缺/损坏/读失败或缓存不匹配不写marker。全跳过时复读原串未变才可标记。仍只写cards.sync.js与cards.js初始化接线，测试及清单归属不变。

新旧对照通过实际地图背包useOwnedCard及其真实UI绑定，覆盖正常/满血/近满、一次消耗、重复同uid、文案改写不影响结构化治疗、旧2点绷带和既有run副本不被升级。普通/BOSS背包保留旧文本行为另测；onPlay手牌fixture如保留只能作为契约调查，不能算迁移收益。确认常规获取卡副本会携带bag规则；不能只手工拼rules证明生产迁移可用。独审核对旧描述治疗数与heal字段等价，before/after仅三ID规则变化。可申请唯一内置浏览器当前窗口、隔离origin作地图背包实页，禁止接触旧玩家档；先由主指挥交实际方案。其他范围和待E8提交授权边界不变。

实页窗口已批准：主指挥独占Codex内置浏览器一个新任务标签及当前尺寸，现有Vite CLI在127.0.0.1:51983 strictPort启动，新origin为http://e8-01a0e225.localhost:51983/。定向通过后正常新建测试局，用现有Ctrl+L开发者入口经game.grantCard发放当前三卡（受控获取，非自然掉落），实际地图背包点击核满血拒绝及普通战受伤回地图后的治疗/一次消耗。主指挥单写新增evidence/e8-card-migration-2026-09-27/ui/截图。不得碰旧标签/玩家档、任意storage、改配置、predev或build；如实际流程困难先报告，不为截图无限跑局。服务/标签及未验边界在RESULT中记录，不擅自清理。

## after生成自动审批阻断

2026-09-27：地图/存储等定向2文件49项通过，生产静态独审通过。清单成员after生成命令连续两次被自动审批拒绝，均未启动；理由为恢复授权仅来自助手消息/计划文件，根对话没有用户撤销其所引用的暂停或批准该写入。第二次已通过同一工具提供bag-only范围修订证据，仍被拒。故停止该命令重试，不换成员/工具代跑；after未生成，before保留。清单消费端/文本/测试引用的后续补丁尚未验证，不与原第一窗口通过证据混算。

Friday已向老板发出异步直接授权问题，内容限于恢复E8清单验证、运行tests/e8-card-inventory.test.js并新增catalog-after.json/.md，不含提交或推送。答复前不执行受阻动作；实页与既有证据整理继续。原E8提交仍需具体交付完成后的另行明确授权。

随后老板在根对话直接答复：“批准恢复并生成 E8 迁移后清单”。对应问题明确包含上述定向测试及两个after文件。已通知原清单成员按原工具/命令恢复正常审批与生成；本次授权不含Git提交/推送，若仍审批拒绝不得更换身份绕过。

## 最终接收：实施完成，待本地提交授权

2026-09-27 18:02主指挥交付，全队停写；Friday复读最终RESULT、核对前后272张原卡差异仅三指定ID、目视满血及05截断治疗截图，git diff --check通过、index为空、HEAD仍7c8e383，未fetch/提交/推送。自动审批阻断已因老板新直接授权解除，原成员原工具成功生成after。

最终结构计数272张=71有rules+201legacy，bag3→6、onPlay56不变，sync55全legacy；未把bag-only算作战斗onPlay覆盖。定向迁移/E6为2文件49项通过，after生成5项通过，独审普通inventory4通过/1生成项跳过且四清单hash不变，独审核对327记录及Markdown一致、无阻断。三卡之外生产269与sync55的consumer/text/testReferences仍未知。

代表性实页采用共用背包入口，避免重复刷战斗：金疮药满血不消耗；一场正常遭遇受伤并获胜后，饮料20→26、绷带26→35（截断+9），各消耗一张。金疮药正向20点依赖定向、未实页验证；这是最终已接受的逐卡验证边界。Friday目视05日志与血量一致。五截图保存在本批ui目录，独立origin/服务session64713/标签保留供复查。

候选提交范围仅本PLAN、RESULT、两生产文件、E6适配、新migration/inventory两测试及inventory helper、四清单及五ui截图，共17文件；原排除未跟踪与三个Luna报告不混入。所有旧存档/玩家编辑保护及战斗背包文本边界见RESULT。E8全量尚未跑，待老板明确批准本地提交后由Friday精确暂存并通过原pre-commit；当前不操作index、不推送。

## 本地提交窗口

2026-09-27，老板在上述具体交付与提交请求后明确回复“提交”，授权本批本地提交。Friday实时复核HEAD仍7c8e383、暂存区为空、仅E8三处tracked变更及上述未跟踪交付，实施团队已停写。按17文件白名单暂存，原pre-commit执行全量门禁；不绕过门禁、不推送、不混入原排除项。门禁与提交实际结果待执行后记录。
