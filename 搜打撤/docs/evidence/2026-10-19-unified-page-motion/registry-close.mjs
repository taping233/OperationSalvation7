import { planLedger, applyLedger } from '../../../scripts/workflow-ledger.mjs';
const root = process.cwd(), key = 'WF-page-motion-1019';
const plan = planLedger(root,{kind:'registry',action:'close',key,owner:'Friday',cells:[
  `Friday（页面切换统一 ${key}）`,
  'game/src/ui/{interface-motion,surface-motion,navigation-motion,motion-presets,page-motion-profiles,page-visual-ready,overlay}.js；game/src/run/game.run.scenes.js；game/css/{interface-motion,page-transitions,page-visual-ready,expedition-transitions}.css；tests/{surface-motion,page-surface-lifetime}.test.js；VISUAL-BIBLE与docs/evidence/2026-10-19-unified-page-motion/',
  '实现完成未提交、编辑释放，待老板验收。取消验证前150项定向回归、目标ESLint与语法通过；实页核对基地方向、背包开合、真实战斗入口。老板要求不再验证后停止测试/浏览器；战斗返回链及全页手感未完成验收。自建5321/PID27384/exec64615已停并释放，既有5200保留；事件01a14ddd按老板确认销账。证据见自有README，无build/提交/推送',
  '2026-10-19',
]});
console.log(applyLedger(root,plan,plan.expectedSha256));
