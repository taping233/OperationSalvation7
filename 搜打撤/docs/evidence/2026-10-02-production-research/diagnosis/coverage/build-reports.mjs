import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { interfaceRows } from './interface-spec.mjs';
import { functionRows } from './function-spec.mjs';
const dir = path.dirname(fileURLToPath(import.meta.url));
const inventoryPath = path.join(dir,'inventory.json');
const inv = JSON.parse(fs.readFileSync(inventoryPath,'utf8'));
// 仅把已经查过源码的文字校正同步回现存清单，不读源码、不重新扫描。
inv.functionFamilies = functionRows.map(([id,intent,pattern,interfaceIds,prerequisite,result,risk,counterevidence,recommendation])=>({id,intent,pattern,interfaceIds:interfaceIds.split(','),prerequisite,result,risk,counterevidence,recommendation,evidence:'S；风险未标已证即待核假设，不代表实测故障'}));
for (const row of interfaceRows) {
  const [id,name,parent,file,anchor,states,returns,persistence,status] = row;
  const found = inv.interfaces.find(i=>i.id===id);
  if (!found || found.entry.file !== 'game/src/'+file || found.entry.anchor !== anchor) throw new Error('界面目录与扫描证据不一致: '+id);
  Object.assign(found,{name,parent,states,returns,persistence,status});
}
inv.reportBuiltAt = new Date().toISOString();
fs.writeFileSync(inventoryPath,JSON.stringify(inv,null,2)+'\n');
const cell = value => String(value ?? '').replaceAll('|','\\|').replaceAll('\n',' ');
const source = (file,line) => '`'+file+(line?':'+line:'')+'`';
const familyByUI = id => inv.functionFamilies.filter(f=>f.interfaceIds.includes(id)).map(f=>f.id).join('、') || '父域对应操作族；只读/演出不单独改变规则';
const statusLabel = {current:'现行入口/状态定义',guarded:'制作器写总开关冻结',developer:'开发工具',tool:'独立工具页',deferred:'研究所暂缓', 'source-only':'源码存在、主入口未接'};
const pageTable = ['| ID / 中文名 | 父域 / 入口 | 正常、空态、失败边界 | 返回 / 持久化 | 功能分析 / 状态 |','| --- | --- | --- | --- | --- |',...inv.interfaces.map(i=>`| ${cell(i.id)} · ${cell(i.name)} | ${cell(i.parent)}<br>${source(i.entry.file,i.entry.line)}<br>${cell(i.entry.anchor)} | ${cell(i.states)} | 返回：${cell(i.returns)}<br>持久化：${cell(i.persistence)} | ${cell(familyByUI(i.id))}<br>${statusLabel[i.status] || i.status} |`)].join('\n');
const variantsTable = ['| 变体 ID | 共享模板 / 名称 | 来源与范围 |','| --- | --- | --- |',...inv.variants.map(v=>`| ${cell(v.id)} | ${cell(v.templateId)} · ${cell(v.name)} | ${cell(v.source)}<br>${cell(v.note)} |`)].join('\n');
const dynamics = inv.dynamicActions.map(a=>`| ${cell(a.action)} | ${source(a.file,a.line)} | ${cell(a.functionFamilies.join('、'))} |`).join('\n');
const listenerGroups = Object.groupBy(inv.unclassifiedListeners,l=>l.file);
const listenerTable = Object.entries(listenerGroups).map(([file,rows])=>`| ${source(file)} | ${rows.map(l=>`${l.line} (${cell(l.event)})`).join('、')} | ${file.includes('qa.js')?'QA探针触发、非现行玩家任务':file.includes('diagnostics')||file.includes('perf')?'错误/性能采集，非玩法动作':file.includes('ui-scale')?'尺寸/DPR同步；本轮未多尺寸验证':file.includes('motion')?'动态偏好媒体查询同步': '图片加载/回退与素材处理，非独立操作页'} |`).join('\n');
const interfaceMd = `# 当前 Vite 界面全覆盖清单

日期：2026-10-02。写属地仅本 coverage 目录。复用同轮根会话 handoff、gameplay/engineering/experience 报告；本代理只读源码与已有证据，未操作游戏、浏览器或存档，未 build/安装/提交。静态基线为 inventory.json 的 generatedAt=${inv.generatedAt}；${inv.sourceFiles.length} 个源码文件逐项 SHA256 已保存在 sourceFiles，接续收官未重新扫描或重新声称实时匹配。

目录按独立任务、决策、弹层和关键恢复状态拆分，现有 **${inv.interfaces.length} 个基本界面条目**；另列 **${inv.variants.length} 个真实数据/说明/层级变体**。这些不是 ${inv.interfaces.length+inv.variants.length} 套独立布局，也不是完成率。职业卡池、六份帮助、三种成就视图、备注工具均有独立对账键；图库筛选的笛卡尔积、每张卡详情、随机候选池不人为乘成新页。

**证据口径：S只证明当前代码定义/接线/守卫，P探针只证明被测规则，B/H/A图与输入分别遵循根会话/美术报告来源。** 此目录不声称所有条目均正常点击可达；逐界面画面与美术批注由 art_annotations 按相同 ID 对账。有图/无图、真人/辅助、现行/冻结/暂缓必须分列。某条没有单独空态或失败页描述，表示静态目录未给独立状态，运行失败仍待核，不能写成不存在。

## 独立界面与状态

${pageTable}

## 二/三级内容与共享模板变体

五个人物分别是无·侠客、常无欲·降临者、白塔·法师、黑像·战士、星月·牧师。CLASS-POOL 各变体由同一 renderPool(sel) 模板绘制，池内容/职业配色/卡牌详情不同；页数由实际池长和每页最多10张均衡算法决定。人物详情也在 CLASS-CHOICE 共享舞台内切换，HUB-CLASSES 是熟练度档案网格，不冒称另有五个独立弹窗。

${variantsTable}

## 完整静态接线与未归类边界

机器使用现有 acorn 对全部 game/src JS 作 AST 解析，忽略注释里的假调用。扫描留下 ${inv.actions.length} 个 UI.act 注册点、${inv.overlayCalls.length} 个渲染/节点壳调用点、${inv.domListeners.length} 个直接 DOM 监听点、${inv.templateActions.length} 个模板 data-act/data-action 片段及 main index 的 ${inv.staticControls.length} 个控件标签。注册点保留 path/line/function/handler；同名重复注册和删除handler不折成一条，不从注册存在推按钮可见。parseFailures=${inv.parseFailures.length}，missingAnchors=${inv.missingAnchors.length}，未归类 UI.act=${inv.unclassifiedActions.length}。

11处动态注册未求值；循环索引/元素/终局重试名不假报全部实例已运行：

| 动态表达式 | 源码 | 对应操作族 |
| --- | --- | --- |
${dynamics}

直接监听器有 ${inv.unclassifiedListeners.length} 处没有归到玩家操作族，逐路径行号显式保留。这些底层/QA监听不是漏掉的“可点页面”，但仍属于静态扫描边界：

| 文件 | 行号 / 事件 | 范围解释 |
| --- | --- | --- |
${listenerTable}

未覆盖：所有卡牌、事件、宠物、成就条件的正常可达性及任意组合；随机生成的全部地图/库存；每种损坏存档与存储失败实页；拖拽/键盘全链、声音实听、自然动画全过程；研究所完整实战与布置入口上线。BATTLE-DECK 仅首脑模式，普通战全部可用牌入手且没有该抽牌堆入口。制作器增删改与导入写开关为 false；旧 showBagCardDetail 为历史保留函数，不把其合成按钮登记为已开放操作。研究所与源码存在的布置仅登记，不扩开发。

复跑入口（仅静态产物；需要重新核源码时才运行扫描）：

\`\`\`powershell
node docs/evidence/2026-10-02-production-research/diagnosis/coverage/scan-inventory.mjs
node docs/evidence/2026-10-02-production-research/diagnosis/coverage/build-reports.mjs
\`\`\`
`;
const familiesMd = inv.functionFamilies.map(f=>{
  const regs=inv.actions.filter(a=>a.functionFamilies.includes(f.id));
  const rules=inv.ruleRegistries.filter(r=>r.functionFamilies.includes(f.id));
  const entries=inv.interfaces.filter(i=>f.interfaceIds.includes(i.id));
  const refs=[...new Set([...entries.map(i=>source(i.entry.file,i.entry.line)),...regs.map(a=>source(a.file,a.line)),...rules.map(r=>source(r.file,r.line))])];
  return `### ${f.id} · ${f.intent}\n\n- 玩家意图与前提：${f.prerequisite}\n- 实现结果：${f.result}\n- 失败风险/反证：${f.risk}。已有反证：${f.counterevidence}\n- 建议与边界：${f.recommendation}\n- 独立界面：${f.interfaceIds.join('、')}；动作：${[...new Set(regs.map(a=>a.action))].join('、')||'直接DOM/命令/自动规则，无独立UI.act'}${rules.length?'；规则注册：'+rules.map(r=>r.id).join('、'):''}\n- 来源：${refs.join('；')}\n`;
}).join('\n');
const settings = [
 ['setIndex','节点编号','game.toggles.index，sync侧栏','展示而非移动权限；保存/重载口径未实测'],
 ['setHint','操作提示条','sdt-hintbar与no-hintbar','可关闭提示，键盘输入未因此禁用'],
 ['setBanner','环层横幅','sdt-banner与no-banner','提示显示，非换图层'],
 ['setDev','开发者模式','sdt-dev、syncDevVisibility','展示写存档测试工具；制作器写开关仍false'],
 ['setShake','屏幕震动','sdt-reduce-shake','只管震动，不等于关音/飘字/顿帧'],
 ['setReduceMotion','减少动态','sdt-reduce-motion、Motion刷新缓存','偏好与媒体查询合并，实际动画未全面观测'],
 ['setMusic','背景音乐','Sound.setMusicMuted','通用静音存在不反证专属cue漏接'],
 ['setMusicSource','音乐来源','Sound.setMusicSource(scape/original)','改声景/原曲来源，不是所有节点音已接'],
 ['setMusicVol','音乐音量','input即时数值/音量','音量变化没有实听录音证据'],
 ['setSfx','音效','Sound.setSfxMuted与开启ding','关闭时试听也静音'],
 ['setSfxVol','音效音量','input即时音量，change播ding','试听ding不证明其他cue注册'],
 ['btSetMusic / btSetSfx','战斗音乐/音效','同Sound偏好','关闭面板需重绘战场'],
 ['btSetShake','战斗震动','同sdt-reduce-shake','仅震动'],
 ['btSetPace','2×战斗节奏','setPace(2/1)','敌方/序列/前摇/飘字倍率，不等于Agent turbo'],
];
const settingsMd = ['| 控件 | 玩家用途 | 真实结果 | 失败/未核边界 |','| --- | --- | --- | --- |',...settings.map(r=>'| '+r.map(cell).join(' | ')+' |')].join('\n');
const rulesMd = ['| 注册名 / 层 | 识别功能 | 分析族 | 源码 |','| --- | --- | --- | --- |',...inv.ruleRegistries.map(r=>`| ${cell(r.id)} / ${cell(r.registry)} | ${cell(r.label)}${r.gate?'<br>gate='+cell(r.gate):''} | ${cell(r.functionFamilies.join('、'))} | ${source(r.file,r.line)} |`)].join('\n');
const functionMd = `# 当前功能与规则族分析

日期：2026-10-02。本报告分析玩家/开发者的操作目的、条件、实际执行结果和失败风险，不以“战斗已分析”覆盖全部战斗动作。${inv.functionFamilies.filter(f=>f.id.startsWith('F')).length}个操作族与${inv.functionFamilies.filter(f=>f.id.startsWith('R')).length}个规则族，对应完整注册清单与独立界面；登记和建议不是实施授权。

证据复用：[gameplay](../gameplay/REPORT.md) 的GP-01安全往返XP、GP-02层数/共用收尾；[experience](../experience/REPORT.md) 的E01/E02专属音接线、E03物资标题遮挡及已证普通战闭环；[engineering](../engineering/REPORT.md) 的工程/契约范围。以上已证事项不重新包装为本代理实测。其余“风险”是由执行顺序/守卫推导的待核项，反证与建议紧随，不据此断言故障已经发生。

## 操作与规则分析

${familiesMd}

## 设置项逐项对账

来源 game/src/ui/game.menu.js:962–1091 与 battle/view/battle.view.js:436–454，原文直接监听器全保存在inventory.json。通用静音、音乐来源、音量、减动态、震动、节奏、开发展示各有不同结果；危险区三清空功能见F08，本轮未执行。

${settingsMd}

## 牌效注册表：完整静态定义而非穷举组合

${inv.ruleRegistries.length}个VERBS/ELSEWHERE/DESIGNER_BLANKS定义全保留于JSON，并按下表分到R01–R11；未归类规则=${inv.unclassifiedRuleEntries.length}。impl是历史人类标签，非代码分发器，pattern命中只说明“被识别”，不能证明数值/时序/目标执行正确。生物类型是敌人图鉴且不可打出，与召唤单位功能不同；职业是稀有度/归属，不是照相馆TYPES数组的一项。

${rulesMd}

## 禁用/留白/未归类边界

制作器写、导入写、编辑删除由CARD_DESIGNER_WRITES_ENABLED=false冻结；制作器源码存在不等于当前上线。结构预检显式拒绝transform无resolver、equip.container未接、hits.perFoe未支持、未知手牌操作/获取filter/dest-act、未知hosted规则；武器覆盖为DESIGNER_BLANKS留白。这些列为独立拒绝/留白边界，不“修复”成新功能。研究所备战/节点/符文/商店/结局等暂缓功能按F64及LAB-*目录登记，未展开实战。

275个UI.act注册点全部归类，11个动态表达式仍保留原式/循环源，没有假装全部实例已点击。17个未归类底层监听逐行列于INTERFACE-INVENTORY；动画/素材/错误捕获/QA与缩放事件尚未逐内部函数分析，属于工程边界，非玩家页面漏项。模板跨插值data-act只保留片段，不把静态无匹配直接判失接线；例如cardZoom在body外有专用footer分发。

**未覆盖的实测边界：** 所有卡牌两两/长链组合、全部事件/成就/宠物可达、长期构筑胜率、所有地图种子、每种存储损坏/配额失败实页、声音听感和自然动画时序。79个分析族是完整静态接线的归纳，不是79项全通过测试。前提/结果/风险里需决策的规则（如安全往返经验）先交老板定规则，再授权开发。
`;
fs.writeFileSync(path.join(dir,'INTERFACE-INVENTORY.md'),interfaceMd);
fs.writeFileSync(path.join(dir,'FUNCTION-ANALYSIS.md'),functionMd);
// 唯一收官验证：基于已保存的源SHA/扫描，不重读游戏、不测试游戏。
const ids = inv.interfaces.map(i=>i.id), familyIds=inv.functionFamilies.map(f=>f.id);
const checks = {
  uniqueInterfaceIds:new Set(ids).size===ids.length,
  allAnchorsResolved:inv.missingAnchors.length===0 && inv.interfaces.every(i=>i.entry.line>0),
  parseSucceeded:inv.parseFailures.length===0,
  allActionsClassified:inv.unclassifiedActions.length===0 && inv.actions.every(a=>a.functionFamilies.length && a.functionFamilies.every(id=>familyIds.includes(id))),
  allRulesClassified:inv.unclassifiedRuleEntries.length===0 && inv.ruleRegistries.every(r=>r.functionFamilies.length),
  familyInterfaceRefsExist:inv.functionFamilies.every(f=>f.interfaceIds.every(id=>ids.includes(id))),
  variantTemplatesExist:inv.variants.every(v=>ids.includes(v.templateId)),
  interfaceReportAllIds:ids.every(id=>interfaceMd.includes('| '+id+' ·')),
  functionReportAllIds:familyIds.every(id=>functionMd.includes('### '+id+' ·')),
  savedSourceHashesPresent:inv.sourceFiles.every(s=>/^[0-9a-f]{64}$/.test(s.sha256)),
};
const files=['interface-spec.mjs','function-spec.mjs','scan-inventory.mjs','build-reports.mjs','inventory.json','INTERFACE-INVENTORY.md','FUNCTION-ANALYSIS.md'].map(name=>{const b=fs.readFileSync(path.join(dir,name));return {name,bytes:b.length,sha256:crypto.createHash('sha256').update(b).digest('hex')};});
checks.filesUnder1MB=files.every(f=>f.bytes<=1048576);
const verification={at:new Date().toISOString(),kind:'coverage artifact consistency only; source SHA evidence reused, source/game/runtime not revalidated',checks,counts:{interfaces:ids.length,variants:inv.variants.length,functionFamilies:familyIds.length,actions:inv.actions.length,dynamicActions:inv.dynamicActions.length,ruleEntries:inv.ruleRegistries.length,unclassifiedActions:inv.unclassifiedActions.length,unclassifiedRules:inv.unclassifiedRuleEntries.length,unclassifiedListeners:inv.unclassifiedListeners.length},files,passed:Object.values(checks).every(Boolean)};
fs.writeFileSync(path.join(dir,'verification.json'),JSON.stringify(verification,null,2)+'\n');
console.log(JSON.stringify(verification,null,2));
if(!verification.passed) process.exitCode=1;
