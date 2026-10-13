import { readTask, planTask, applyTask } from '../../../scripts/workflow-task.mjs';
const root=process.cwd(), id='WF-selection-map-implementation-1011', date='2026-10-11';
const before=readTask(root,{id,date});
const more=['game/src/ui/hud.js','game/src/game.boot.js','game/src/ui/game.menu.js','game/src/battle/view/battle.view.js','game/src/battle/view/battle.overlays.js','game/src/battle/view/battle.piles.view.js','game/src/hub/game.bag.js','game/css/expedition-inventory.css','game/css/base-camp-rework.css','game/src/run/expedition.view.js','tests/expedition-log-preference.test.js','game/assets/scenes/shop','game/assets/scenes/entry','game/assets/scenes/rewards','game/assets/scenes/battle'];
const plan=planTask(root,{action:'update',id,date,owner:'Friday',input:{
  goal:'按老板逐项授权，由三个GPT-6.1-sol代理参考优秀实机/美术原则多轮重做整条远征界面与相关新素材；保留机制，整套成型后交老板统一过目',
  paths:[...new Set([...before.task.paths,...more])],stage:'doing',
  doneWhen:['人物/整备、地图/导航、商店、整页入城/事件、统一继续过场、战斗主与附加、背包、奖励/透明宝箱均有来源驱动多轮制作记录与可审阅成品；必要定向检查和未覆盖边界清楚，不改机制/不覆盖他人属地，老板最后统一审阅'],
  checks:[{kind:'manual',description:'首批旧骨架12文件119项集成定向通过，integration-tests.log；不能证明后续重做通过。',result:'passed'}],
  unverified:['老板否定雪箱/单张战斗壁纸及商店/入城候选，本轮已完成专业案例/实际卡面画法与分层研究，尚未制作新的分层舞台和校准样本','NAI本地文本管线已查，不能接收图片reference；远端凭据/服务/额度未验证，后续组合用法已有brief','整套视觉尚未交老板统一过目；旧119项与旧截图不能证明后续重做通过','未build、全量测试、提交、推送或发布']
}});
console.log(applyTask(root,plan,before.sha256));
