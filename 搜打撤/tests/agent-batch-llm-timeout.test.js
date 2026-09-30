/* INFRA-04 + INFRA-05 回归（真实跑 agent-batch.mjs，jsdom 无头全量启动）：
 * ① --policy llm 且配置完整（环境变量）时，决策必须走 Agent.llm.decide 工厂——
 *   用桩 LLM 端点计数：llm 命中数 >0（旧 bug 回落 greedy 则为 0）。
 * ② 单局超时后旧 autoRun 必须被 stop 并等待收口——第二局能真正开跑（桩再命中），
 *   记录不再是 already-running。
 * 前提：agent-batch 的 fetch 桥须能透传绝对地址到 Node 原生 fetch
 *（2026-10-01 修复，jsdom 25 无 window.fetch 时旧实现恒拒绝）。 */
import { describe, it, expect, afterAll } from 'vitest';
import { spawn } from 'node:child_process';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { mkdtempSync, readFileSync, existsSync } from 'node:fs';

const REPO = process.cwd();
const OUT_DIR = mkdtempSync(path.join(os.tmpdir(), 'agent-batch-test-'));
const STUB_PORT = 45197;
const STUB_DELAY_MS = 3000;    // > --timeout 2s：决策挂起逼出单局超时
const ACTION = { type: 'sys', name: 'noop' };   // 合法且无害的动作（runner 语义内=等待）

let stubHits = 0;
const stub = http.createServer((req, rsp) => {
  req.on('data', () => {});
  req.on('end', () => {
    stubHits += 1;
    setTimeout(() => {
      rsp.writeHead(200, { 'Content-Type': 'application/json' });
      rsp.end(JSON.stringify({ choices: [{ message: { content: JSON.stringify(ACTION) } }] }));
    }, STUB_DELAY_MS);
  });
});
await new Promise(res => stub.listen(STUB_PORT, '127.0.0.1', res));
afterAll(() => { try { stub.close(); } catch { /* 已关闭 */ } });

describe('agent-batch --policy llm：真走 LLM 工厂 + 超时后旧 runner 收口', () => {
  it('桩端点每局各命中一次，两局记录均为 timeout 而非 already-running', async () => {
    const child = spawn(process.execPath,
      ['node_modules/vite-node/vite-node.mjs', 'game/tools/agent-batch.mjs',
        '--runs', '2', '--policy', 'llm', '--timeout', '2', '--max-steps', '50',
        '--out', OUT_DIR],
      {
        cwd: REPO,
        env: {
          ...process.env,
          SDT_AGENT_BASE_URL: `http://127.0.0.1:${STUB_PORT}/v1`,
          SDT_AGENT_API_KEY: 'test-key',
          SDT_AGENT_MODEL: 'stub-model',
        },
      });
    let output = '';
    child.stdout.on('data', d => { output += d; });
    child.stderr.on('data', d => { output += d; });
    const code = await new Promise(res => child.on('close', res));

    expect(code, `批跑未正常结束：\n${output.slice(-3000)}`).toBe(0);
    // INFRA-04：llm 工厂真实参与（greedy 工厂永远不会打桩端点）
    expect(stubHits, `LLM 桩命中 ${stubHits} 次（应为 2：两局各发起一次决策）`).toBe(2);
    // INFRA-05：第二局真正开跑（旧 bug 会在 already-running 处被拒，桩只中 1 次）
    const runsPath = path.join(OUT_DIR, 'runs.jsonl');
    expect(existsSync(runsPath), 'runs.jsonl 未落盘').toBe(true);
    const records = readFileSync(runsPath, 'utf8').trim().split('\n').map(l => JSON.parse(l));
    expect(records.length).toBe(2);
    for (const r of records) {
      expect(r.driver).toBe('llm');
      expect(r.stopReason, `局记录 stopReason=${r.stopReason}（already-running=旧 runner 未收口）`).toBe('timeout');
    }
    const summary = JSON.parse(readFileSync(path.join(OUT_DIR, 'summary.json'), 'utf8'));
    expect(summary.meta.policy).toBe('llm');
  }, 300000);
});
