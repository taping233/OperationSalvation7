import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createServer } from 'node:http';
import { decide, parseActionReply, saveConfig, loadConfig } from '../game/src/agent/agent.llm.js';

// ---------- 回复解析容错 ----------
describe('LLM 回复解析', () => {
  it('直给 JSON / 代码块围栏 / 内嵌大括号都能取到动作', () => {
    expect(parseActionReply('{"type":"sys","name":"noop"}').raw).toEqual({ type: 'sys', name: 'noop' });
    expect(parseActionReply('```json\n{"type":"move","li":1,"idx":2}\n```').raw).toEqual({ type: 'move', li: 1, idx: 2 });
    expect(parseActionReply('我认为应该 {"type":"battle","name":"endTurn","args":[]} 这么走').raw)
      .toEqual({ type: 'battle', name: 'endTurn', args: [] });
  });

  it('纯文本回复判为不可解析', () => {
    const parsed = parseActionReply('我觉得先走左边比较好');
    expect(parsed.ok).toBe(false);
    expect(parsed.code).toBe('LLM_REPLY_NOT_JSON');
  });
});

// ---------- decide 端到端（mock OpenAI 兼容服务） ----------
describe('LLM decide 契约', () => {
  const obs = {
    ok: true, settle: true, phase: 'overlay', turn: 3,
    run: { hp: 30, maxHp: 50, coins: 2, atk: 4, layer: 1, node: 2 },
    battle: null,
    ui: { open: true, title: '触发事件', actions: [] },
    actions: [{ type: 'ui', name: 'evtChoice', params: { i: '0' }, label: '继续前进', id: 'ui:evtChoice' }],
  };
  const requests = [];
  let replies = [];
  let statusCode = 200;
  let server = null;
  let port = 0;

  beforeAll(async () => {
    server = createServer((req, res) => {
      let body = '';
      req.on('data', (chunk) => { body += chunk; });
      req.on('end', () => {
        requests.push(JSON.parse(body || '{}'));
        res.writeHead(statusCode, { 'Content-Type': 'application/json' });
        if (statusCode !== 200) { res.end(JSON.stringify({ error: 'boom' })); return; }
        const text = replies.length > 1 ? replies.shift() : replies[0];
        res.end(JSON.stringify({ choices: [{ message: { content: text } }] }));
      });
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    port = server.address().port;
    saveConfig({ baseUrl: `http://127.0.0.1:${port}/v1`, apiKey: 'sk-test', model: 'mock-model' });
  });

  afterAll(() => new Promise(resolve => server.close(resolve)));

  it('配置读写落到 localStorage 且不丢字段', () => {
    const config = loadConfig();
    expect(config.apiKey).toBe('sk-test');
    expect(config.model).toBe('mock-model');
    expect(config.baseUrl).toContain(`:${port}`);
  });

  it('合法动作直接返回协议动作', async () => {
    requests.length = 0;
    replies = ['{"type":"ui","name":"evtChoice","params":{"i":"0"}}'];
    statusCode = 200;
    const action = await decide()(obs);
    expect(action).toEqual({ type: 'ui', name: 'evtChoice', params: { i: '0' } });
    expect(requests.length).toBeGreaterThan(0);
    expect(requests[0].messages[0].role).toBe('system');
  });

  it('垃圾回复带错误重试，第二次拿到合法动作', async () => {
    requests.length = 0;
    replies = ['先看看再说', '{"type":"move","li":1,"idx":2}'];
    const action = await decide()(obs);
    expect(action).toEqual({ type: 'move', li: 1, idx: 2 });
    expect(requests.length).toBe(2);
    expect(String(requests[1].messages.at(-1).content)).toContain('动作非法');
  });

  it('接口 5xx 不卡死：退化为贪心动作', async () => {
    requests.length = 0;
    statusCode = 500;
    const action = await decide()(obs);
    statusCode = 200;
    // 贪心在弹层页会选语义推进动作——这里回退结果必须仍是协议动作
    expect(action && typeof action).toBe('object');
    expect(['ui', 'move', 'battle', 'sys']).toContain(action.type);
  });

  it('回复动作不在清单内时重试后退化（非法形状被协议拒绝）', async () => {
    requests.length = 0;
    replies = ['{"type":"battle","name":"devHack","args":[]}', '{"type":"battle","name":"devHack","args":[]}'];
    const action = await decide()(obs);
    expect(action.type).toBe('ui');   // 退化贪心 → 继续前进
    expect(requests.length).toBe(3);  // 上限 3 次尝试后退化
  });
});
