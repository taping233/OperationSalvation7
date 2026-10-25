// Shared registry lifecycle and path parsing. Pure functions: no files, Git, or gate dependencies.
export const withoutReleasedText = value => String(value ?? '').replace(/~~[^~]*~~/g, '');

// Concurrent writers also register plain paragraphs above the table. Keep these
// read-only claims visible; table writers must not silently replace their prose.
export function registryProseRows(registryText) {
  const lines = registryText.split(/\r?\n/), rows = [];
  let active = false, paragraph = [], index = 0, fenced = false;
  const flush = () => {
    const line = paragraph.join(' ').trim(); paragraph = [];
    if (!line || !/^[\p{L}\p{N}]/u.test(line)) return;
    const key = line.match(/WF-[a-zA-Z0-9-]+/);
    if (!key || key.index > 200 || /[。\n]/.test(line.slice(0, key.index))) return;
    // The final lifecycle marker is current: e.g. retain earlier completed
    // increments, then freeze the new source for integration, is still occupied.
    const markers = [...line.matchAll(/完成未提交|complete-uncommitted|编辑占用释放|编辑释放|已落库|已交付|已归档|已提交|编辑中|待验收|集成验证中|源码已冻结|代码已冻结|运行中/g)];
    let status = markers.at(-1)?.[0] || '状态未明（段落登记）';
    if (/^编辑(?:占用)?释放$/.test(status)) status = '完成未提交、' + status;
    const ownerEnd = line.indexOf('：', key.index);
    const owner = ownerEnd < 0 ? line.slice(0, key.index + key[0].length) : line.slice(0, ownerEnd);
    rows.push({ index, line, source: 'paragraph', cells: [owner, line, line, line.match(/20\d{2}-\d{2}-\d{2}/)?.[0] || '', status] });
  };
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i], trimmed = line.trim();
    if (/^```|^~~~/.test(trimmed)) { flush(); fenced = !fenced; continue; }
    if (fenced) continue;
    if (line.startsWith('## ')) { flush(); active = line.slice(3).startsWith('活跃登记'); continue; }
    if (!active) continue;
    if (!trimmed || /^[|>#]/.test(trimmed)) { flush(); continue; }
    if (!paragraph.length) index = i;
    paragraph.push(trimmed);
  }
  flush();
  return rows;
}

// Classification describes the active table, never moves rows or authorizes overwriting them.
// Unknown registry states keep a conservative edit claim; completed work keeps ownership.
export function classifyLedgerRow(row, kind) {
  const cells = Array.isArray(row) ? row : row.cells;
  if (kind === 'pending') {
    const resolved = /^~~[^~]+~~$/.test(cells[0]?.trim() ?? '') || /^(?:完结|已销账|已决)(?:$|[，；。\s])/.test(cells[4] ?? '');
    return { state: resolved ? 'resolved' : 'open', isOpen: !resolved, isBlocking: false };
  }
  if (kind !== 'registry') throw new Error('台账仅支持 registry / pending');
  const status = (cells[4] ?? '').replace(/\*\*/g, '').trim();
  const released = /^~~[^~]+~~$/.test(cells[0]?.trim() ?? '');
  const settled = /^(?:已落库|已释放|已交付|已归档|归档|已提交)(?:$|[\s（(，；：])/.test(status);
  const complete = /完成未提交|complete-uncommitted|编辑占用释放/.test(status);
  const state = released ? 'released' : settled ? 'settled' : complete ? 'complete-uncommitted' : 'editing';
  return { state, isBlocking: state === 'editing', isOpen: state === 'editing' || state === 'complete-uncommitted' };
}

/** 从属地单元格文本提取路径 token（反引号优先，兼容裸路径；丢弃端口/PID/URL 与「不碰」类排除声明）。 */
export function extractRegistryTokens(cellText) {
  const tokens = [];
  const backticked = [...cellText.matchAll(/`([^`]+)`/g)].map(m => ({ text: m[1], dir: m[1].endsWith('/') }));
  const loose = [...cellText.matchAll(/[\w\u4e00-\u9fff.-]+(?:\/[\w\u4e00-\u9fff.-]+)*\/?/g)]
    .map(m => ({ text: m[0], dir: m[0].endsWith('/') }));
  const raw = backticked.length ? backticked : loose;
  for (const { text, dir } of raw) {
    if (/[:*?"<>|]/.test(text)) continue;           // 端口/PID/URL/通配 噪声
    if (/^\d+(?:\/\d+)+$/.test(text)) continue;     // 纯数字斜杠串（如 PID 并列 21272/22356）不是路径
    // 「不碰 / 零改动 xxx」是排除声明不是属地，避免整目录误报撞线
    const at = cellText.indexOf(text);
    if (at > 0 && /不碰|不涉及|零改动|不含/.test(cellText.slice(Math.max(0, at - 6), at))) continue;
    const item = text.replace(/^搜打撤\//, '').replace(/\/+$/, '');
    if (!item || item.length > 200) continue;
    // 目录 token（原文带尾斜杠）直接保留；文件 token 需带 / 或已知扩展名，纯词（PID 等）丢弃
    if (!dir && !item.includes('/') && !/\.(js|mjs|cjs|json|md|css|html|ts)$/.test(item)) continue;
    tokens.push(item);
  }
  return [...new Set(tokens)];
}

/** 保留兼容字段；完成未提交只保护归属，终态按需保留为审计，不算编辑占用。 */
export function parseActiveRegistry(registryText, { includeSettled = false } = {}) {
  const section = registryText.split('## 活跃登记')[1];
  if (!section) return [];
  const body = section.split(/\n## /)[0];
  const rows = [];
  for (const line of body.split('\n')) {
    if (!line.startsWith('|') || /^\|\s*[-—]+/.test(line) || line.startsWith('| 会话')) continue;
    const cells = line.split('|').slice(1, -1).map(c => c.trim());
    if (cells.length < 5) continue;
    const [session, territory, matter, , status] = cells;
    const lifecycle = classifyLedgerRow({ cells }, 'registry');
    if (!lifecycle.isOpen && !includeSettled) continue;
    rows.push({ session, status, matter, tokens: extractRegistryTokens(withoutReleasedText(territory)), ...lifecycle });
  }
  for (const row of registryProseRows(registryText)) {
    const [session, territory, matter, , status] = row.cells;
    const lifecycle = classifyLedgerRow(row, 'registry');
    if (!lifecycle.isOpen && !includeSettled) continue;
    rows.push({ session, status, matter, tokens: extractRegistryTokens(withoutReleasedText(territory)), ...lifecycle });
  }
  return rows;
}

/** 查询路径 × 属地 token 双向包含（文件∈目录 / 目录∋文件 / 相等）。 */
export function pathOverlaps(p, token) {
  if (p === token) return true;
  if (p.startsWith(token + '/')) return true;   // 查询文件在属地目录内
  if (token.startsWith(p + '/')) return true;   // 查询目录覆盖属地文件（整目录动手=撞线）
  return false;
}

/** 属地命中：rows 中任一 token 与任一查询路径重叠。 */
export function registryHits(paths, rows) {
  const hits = [];
  for (const row of rows) {
    const matched = row.tokens.filter(token => paths.some(p => pathOverlaps(p, token)));
    if (matched.length && row.isOpen !== false) hits.push({ session: row.session, status: row.status, matched,
      state: row.state ?? 'editing', isBlocking: row.isBlocking ?? true,
      action: row.state === 'complete-uncommitted' ? 'retain-ownership' : 'coordinate-editing' });
  }
  return hits;
}

/** 松扫描 scripts/ 与 game/tools/（gate 主图只盖 src/tests/data）：正则抓 import 说明符建反向边。 */
export function parseUnclaimedPaths(registryText) {
  // R1（2026-10-01 拍板）：无主物品表第一列反引号内的路径 token；~~删除线~~行已处置，跳过。
  const paths = [];
  const section = registryText.split('## 无主物品')[1]?.split(/\n## /)[0] ?? '';
  for (const line of section.split('\n')) {
    const cell = line.match(/^\|\s*(~~)?([^|]*)/);
    if (!cell || cell[1] || cell[2].includes('物品') || cell[2].startsWith('---')) continue;
    for (const match of cell[2].matchAll(/`([^`]+)`/g)) {
      const candidate = match[1].trim();
      if (candidate.includes('/')) paths.push(candidate);
    }
  }
  return paths;
}

