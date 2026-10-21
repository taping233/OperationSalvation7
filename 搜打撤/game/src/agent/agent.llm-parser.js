// 从模型回复中提取动作 JSON：优先整体解析，其次抓第一个 {...} 块（容代码块围栏）
function parseActionReply(text) {
  const raw = String(text || '').trim();
  const candidates = [];
  candidates.push(raw);
  const fence = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) candidates.push(fence[1].trim());
  const brace = raw.match(/\{[\s\S]*\}/);
  if (brace) candidates.push(brace[0]);
  for (const candidate of candidates) {
    try {
      const obj = JSON.parse(candidate);
      if (obj && typeof obj === 'object' && !Array.isArray(obj)) return { ok: true, raw: obj };
    } catch { /* 试下一个候选 */ }
  }
  return { ok: false, code: 'LLM_REPLY_NOT_JSON', message: '回复里没有可解析的动作 JSON' };
}

export { parseActionReply };
