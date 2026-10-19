import { planLedger, applyLedger } from '../../../scripts/workflow-ledger.mjs';
const root = process.cwd();
const key = 'WF-page-motion-1019';
const plan = planLedger(root, { kind: 'registry', action: 'add', key, owner: 'Friday', cells: [
  `Friday（页面切换统一 ${key}）`,
  'game/src/ui/{interface-motion,surface-motion,navigation-motion,motion-presets,page-motion-profiles,page-visual-ready,overlay}.js；game/css/{interface-motion,page-transitions,page-visual-ready,expedition-transitions}.css；场景转场入口；相关测试、VISUAL-BIBLE与自有证据',
  '统一导航、详情、覆盖层、场景切换；当前Codex内置5200复核，复用PID26772服务；不build、不提交，保护其他在途改动',
  '2026-10-19', '编辑中',
] });
console.log(applyLedger(root, plan, plan.expectedSha256));
