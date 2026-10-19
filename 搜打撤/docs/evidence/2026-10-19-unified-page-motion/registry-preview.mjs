import { readLedger, planLedger, applyLedger } from '../../../scripts/workflow-ledger.mjs';
const root = process.cwd(), key = 'WF-page-motion-1019';
const cells = readLedger(root,'registry').rows.find(row => row.key === key).cells;
cells[1] += '；隔离代码副本.tmp/page-motion-1019，5321/PID27384/exec64615（本会话创建）';
const plan = planLedger(root,{kind:'registry',action:'update',key,owner:'Friday',cells});
console.log(applyLedger(root,plan,plan.expectedSha256));
