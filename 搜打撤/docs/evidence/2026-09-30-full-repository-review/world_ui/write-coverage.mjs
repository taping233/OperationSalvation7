import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const here = path.dirname(fileURLToPath(import.meta.url));
const assigned = JSON.parse(fs.readFileSync(path.join(here, 'assigned.json'), 'utf8')).filter(x => x.owner === 'world_ui' && x.category === 'review-target');
const scans = JSON.parse(fs.readFileSync(path.join(here, 'css-static-scan.json'), 'utf8'));
const describe = {
  'game/index.html': ['deep', '主入口CSS装配顺序、关键DOM id/hidden/对话框语义、B键浮动入口、原样启动inline脚本故障计时器；WORLD-005实际脚本复现。', '素材仅核引用形状，未验图片显示/真实网络；未逐个SVG像素复核。'],
  'game/dev.html': ['static-only', '旧开发入口CSS/导入映射、boot错误收集、全局UI字段及routePanel标记与当前运行壳的差异。', '旧静态dev入口未启动；非正式index入口，不将旧DOM差异单列主线玩家Bug。'],
  'game/src/experience/pocket-strip.js': ['systematic', '轮询显隐、签名去重、张数与格数口径、撤离期望与encounter元数据来源、章节装饰幂等、拆除后计时器守卫。', '未验当前窗口布局/真实长局interval资源占用；预估不是实际带出保证。'],
  'game/src/home/home.catalog.js': ['systematic', '家具价格/拥有上限/ footprint、旋转集、支持关系、墙面与地面边界、目录冻结。', '首包样板价格不作经济平衡审查。'],
  'game/src/home/home.commands.js': ['deep', '购买草稿与幂等回执、库存实例验证、布局碰撞/边界/桌面支撑、陈列解锁、revision端口提交及失败路径。', '未复现外部多会话同时提交；依赖基地命令事务由其他分片深审。'],
  'game/src/home/home.presenter.js': ['systematic', '只读投影/冻结、收藏registered过滤、人物选择和资源默认值、错误文案。', '显示数据本身未验真实Pixi/DOM画面。'],
  'game/src/home/home.scene.js': ['systematic', '共享投影与逆投影、WebGL失败DOM兜底、编辑草稿/取消/提交快照、异步intent、update保留草稿、事件清理、隐藏停ticker、ResizeObserver。', '未创建Pixi上下文；家具旋转与多格占据视觉、透明素材层级未核验；prototype入口以当前hub接线为准。'],
  'game/src/home/home.visuals.js': ['static-only', '素材URL构造、角色id匹配、pivot/层/footprint元数据、原型房间校准与projectHomeCell口径。', '素材像素、校准落点和WebGL命中视觉未核验。'],
  'game/src/home/narrative.js': ['systematic', '专属事件id→Ink knot、choice元数据解析、懒加载/catch降级、独立Story实例与环境故事段落解析。', '未重编generated剧情；普通事件async来源令牌与每个旧事件降级效果并非全部动态遍历。'],
  'game/src/home/story.commands.js': ['deep', 'inspect只读快照、record回执重放、prepare失败保护、revision和幂等payload转交基地命令。', '基地命令底层由其他分片；未模拟全部并发receipt故障。'],
  'game/src/home/story.last-lamp.js': ['deep', 'runId/实例id绑定、阶段与segments/runs/ending互证、每局一次、结局纪念物、prepare克隆和不可用选择。', '历史恶意超大JSON性能不在本片验证。'],
  'game/src/run/chests.js': ['deep', '普通/职业池、同id同名去重、稀有度保底、宠物蛋保底调用、金币/通行证追加、队列收尾、防重复领取、搜索代次与背包suspend/resume、容量预估。', 'resourceOnly选项未传递列WORLD-S01待契约；未逐个RNG种子穷举；宝箱实际卡牌能力由卡牌分片。'],
  'game/src/run/encounter-meta.js': ['systematic', '层表回退、risk/eliteChance投影、敌人名缺省与只读数组复制。', '只提供层池信息，不把每格都相同判为玩法缺陷。'],
  'game/src/run/encounter-selector.js': ['deep', 'entry/group/elite选择顺序、2×2组结构验证、重复group id、非法组entry回退、精确resolveEncounterGroup。', '仅当前数据合法随机域；无生产请求让random返回NaN/越界的证据。'],
  'game/src/run/expedition.view.js': ['systematic', '当前层合法邻边投影、去重/同名路线编号、visited清除提示、门指向、目标血量优先级、DOM viewKey缓存与焦点恢复。', '方向/直线步数为提示，未作当前窗口实画验收；跨层进入仍由door modal承担。'],
  'game/src/run/extraction-preview.js': ['deep', '袋中初始攻击剔除、消耗袋Σcount×权威概率、资源/金币分离及只读零RNG消费，与撤离命令口径对照。', '容量与仓库空间不能保证实际100%入库，显示只是预估。'],
  'game/src/run/game.nest.js': ['static-only', '冻结研究所全过程静态读审：开门/备战/推进/旧格战斗上下文/奖励与容量/符文选择/撤离身份和异步结算归属；WORLD-S02。', 'BASE-DIRECT-WRITE-AUDIT明确冻结，公开关卡制作中；未启动或证明生产玩家入口可达，不列活跃P1。'],
  'game/src/run/game.run.altar.js': ['deep', '火堆一次性消费、选角前确认与能力卡获得、祭坛献祭取消/激活/待领状态、首脑计划与门禁、紧急撤离付款、撤离快照/身份/页面revision与整理入库。WORLD-002实际复现。', 'F1-F4上轮修复未重复报告；未验完整4层、玩家旧档、真实异步故障和每个祭坛选项组合。'],
  'game/src/run/game.run.data.js': ['systematic', '共享DATA只读引用、PRELOAD_SCENES URL与NODE_BG/PICKUP_BG映射、启动场景集合和懒预热边界。', '未验资源下载/素材像素；snapshot不包含全部二进制素材。'],
  'game/src/run/game.run.dev.js': ['systematic', 'dev开战状态守卫、运行态创建、强制Boss编组、节点跳转、控制台搜索保持输入、保存与背包/战斗重绘分流。', '开发功能本就授权改局，不将调试作弊入口算玩家经济Bug；未启动开发页。'],
  'game/src/run/game.run.flow.js': ['deep', '邻边移动事务/watchdog、节点visited防重入、资源领取、事件一次结算与二级选卡/黑市/重编、LastLamp身份及保存回滚。WORLD-002/003实际模块复现。', 'moveCancel IME已知项根代理统一列known；异步Ink换页和所有节点×背包组合未穷举。'],
  'game/src/run/game.run.js': ['systematic', '装配导出保持、grantCard绑定时机与dev代理函数、moveTo/reenterCell接口唯一来源。', '无独立玩法分支，依赖实际实现见其他文件覆盖条目。'],
  'game/src/run/game.run.scenes.js': ['deep', '过场context/代次、房间结束/保存、拾取恢复与定时器连接性、encounter传递、grantCard容量、阿猫额外卡去递归、火堆复原；WORLD-001实际复现。', '复原容量特例WORLD-S03未定性；未验真实输入时延和奖励演出视觉。'],
  'game/src/run/game.run.shop.js': ['deep', '店货架持久key/去重、固定与神秘货位、canReceiveCard买前验证、售出锁、卖stored拒绝、键盘入口、背包返回店页、动画异步只重绘。', '首轮初始化未购买便退出的持久时机、所有卡库自定义缺失形状未穷举；飞行动画视觉未验。'],
  'game/src/run/lab.ending.js': ['static-only', '冻结研究所结局页的打字机、下一页/跳过、keyboard捕获、计时与监听收尾、onDone时序。', '冻结研究所未启动；实际素材/结局归属与IME输入未做实页验证。'],
  'game/src/run/layeredMap.js': ['systematic', '生成器纯图→logical/节点显示适配、四层中英文名/颜色、门和坐标透传。', '纯适配非生成质量证明；种子穷举由现有测试，不将其当人工逐行审查。'],
  'game/src/run/map-generator.js': ['deep', '四向边/生长/入口出口、功能房间隔、战斗上下限、紧急撤离位置、L4祭坛首脑、分层配额及quality门、失败seed fallback兼容序列。', '未新增多种子穷举测试，quality未检查的全部玩法偏好不作为契约要求。'],
  'game/src/run/map-graph.js': ['deep', '完整next数组与旧闭环回退、层间门链接、入口集合flood-fill、孤点/空图边界与只读检测。', '实际快照另有严格节点验证，本函数不单独承担恶意边界验证。'],
  'game/src/run/map-snapshot.js': ['deep', 'exactKeys/pureJson/大小与版本、节点id/坐标/边、反向邻边、door pair唯一、全图连通、route计划与交换记录、position/元数据冲突和旧3/9恢复。', '未重新跑上轮读档修复完整门；边/节点类型语义不把schema可接受当玩法正确。'],
  'game/src/ui/cinematics.js': ['systematic', '奖励演出队列、runActive来源过滤、close幂等与计时器、show/hideScreen代次及reduce-motion。', '只按runActive绑定的跨真对局身份风险未证明可由公开输入触发；未验视觉/多演出叠层。'],
  'game/src/ui/feedback.local.js': ['deep', '读取损坏保留/写失败、留言删除返回、导出字段与diagnostics白名单、Blob URL生成/释放、文件名安全。', '用户本地反馈非外发；未操作桌面IPC或下载真实文件。'],
  'game/src/ui/game.menu.js': ['deep', '标题与数据来源、右键留言/删除确认、选档预检/异步context保护、覆盖/删除显式确认、放弃终局token重试、设置/数据/留言返回链；WORLD-004实际复现。', 'SVG图标只核标记，不逐路径视觉检查；未执行删除/覆盖存档；单档存储底层另片深审。'],
  'game/src/ui/hud.js': ['systematic', '数字diff缓存、血量展示钳位、环层与背包显隐、日志边界、浮动背包inert反守卫和z-index补偿。', '未测当前窗口背包可命中区域、DOM宿主被重建后的Observer生命周期。'],
  'game/src/ui/overlay.js': ['deep', 'show/hide模式与210ms尾巴、动作表清理、Esc安全取消语义、背包closeHook、focus trap/默认焦点、inert记录恢复、背景加载失败与页面替换保护；复现使用实际方法。', '仅静态及jsdomDOM验证，未测真实读屏/高对比模式和所有弹层叠加组合。'],
  'game/src/ui/quick-nav.js': ['systematic', 'Alt入口can守卫、inRun/busy边界、输入让路、cancelPendingCardPageOpen、失败异常日志。', '特定异步事件加载中允许工具页盖开的归属风险未完成真实UI复现。'],
  'game/src/ui/route-overlay.js': ['deep', '四节点分叉筛选、不可交换类型、纯clone草稿、配额/相邻战斗质量门、回退计划与swap证据和失败保护。', '未重跑种子组合；已是chest的供给支路跳过属当前算法设计，未当缺陷。'],
  'game/src/ui/term-tips.js': ['systematic', '词条metadata与别名、悬停/触摸捕获、click只说明、定位scale、scroll收起和事件委托。', '全部词条语义与battle回合时序需要战斗分片交叉核对；未验真实窗口提示遮挡。'],
  'game/src/ui/terminal-settlement.js': ['deep', 'token/current守卫、busy锁、ephemeral分支、createAttempt/replay/commit、失败重试以及异步换档后阻止finish。', '通用编排不等同存储原子性证明，终局命令与恢复层另片。'],
  'game/src/ui/ui-scale.js': ['systematic', 'viewport合法值、0.85可读性floor、html zoom状态、rect/pt抵消、resize更新。', '按老板约定未切多尺寸；未在当前窗口实际校验全部坐标调用方。'],
  'game/src/ui/ui.js': ['systematic', 'UI动作委托dataset契约、键盘/IME/Esc、cardZoom来源矩形裁切/FLIP、note保存、close幂等/inert/焦点、照片解码与延迟守卫、方法包装配。', '未验实页图片/动画连续性、每个footer动作和所有onNoteSave形状；卡牌侧接口由另一片核验。'],
  'narrative/events.ink': ['static-only', '全部knot/choice/effect元数据与flow分支对照，LastLamp三段和互斥结局文本；旧timeskip有文本但当前卡库入口已摘除。', '未编译剧情或审文学质量；对已被V2覆盖的旧choice文字不重复报实际效果问题。'],
};
const coverage = assigned.map(entry => {
  let status, reviewed, limitation, evidence = [];
  if (entry.file.endsWith('.css')) {
    const scan = scans.summaries.find(x => x.file === entry.file);
    status = 'static-only';
    reviewed = `PostCSS完整结构解析；${scan.rules}规则、${scan.riskRules}尺寸/溢出/定位/显隐/命中/焦点声明块定位，${scan.important}个!important；对${path.basename(entry.file, '.css')}所属页面级联热点片段读审，核对index样式装配与作用域。`;
    limitation = '未逐条解释全部视觉声明；未进行浏览器computedStyle/命中/视觉验收，media规则仅静态阅读，未切多尺寸；颜色对比、素材加载和跨页面最终级联仍未核验。';
    evidence = ['world_ui/css-static-scan.json', 'game/index.html stylesheet order'];
  } else {
    const desc = describe[entry.file];
    if (!desc) throw new Error(`Missing per-file coverage: ${entry.file}`);
    [status, reviewed, limitation] = desc;
    if (reviewed.includes('WORLD-')) evidence.push('world_ui/repro.test.js', 'world_ui/repro.log', 'world_ui/findings.json');
  }
  return { file: entry.file, owner: 'world_ui', category: 'review-target', status, sourceSha256: entry.sha256, lines: entry.lines, reviewedRisks: reviewed, limitations: limitation, evidence };
});
fs.writeFileSync(path.join(here, 'coverage.json'), JSON.stringify(coverage, null, 2));
console.log(JSON.stringify({ total: coverage.length, statusCounts: coverage.reduce((a, x) => (a[x.status]=(a[x.status]||0)+1,a), {}) }));
