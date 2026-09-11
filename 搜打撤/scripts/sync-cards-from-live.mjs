#!/usr/bin/env node
/**
 * 实机卡库 → cards.js 定版同步（2026-09-09 机制化，老板要求"网页版里对卡牌库的修改会同步"）。
 *
 * 用法:
 *   node scripts/sync-cards-from-live.mjs --input <实机卡库.json>          # 同步并改写 cards.js
 *   node scripts/sync-cards-from-live.mjs --input <json> --check          # 只报告差异，不改文件
 *
 * 输入 JSON 支持两种形态：游戏内「导出卡牌」的 {game,format,version,cards:[...]}
 * 或裸数组 [...]（本机 Edge localStorage 提取脚本 .tmp/extract_sdt_cards.py 的产物）。
 *
 * 原理：沙箱求值 cards.js 得到源码有效卡库（完整 ensure 迁移链），与实机卡库按 id diff；
 * 生成/替换 cards.js 对象内由标记注释包裹的「实机定版覆盖批次」（沿用 TABLETOP10/11 的
 * 整卡覆盖+补种+退役模式），播种 KEY 版本号自动递增，让所有旧环境重播一次拉齐到实机版。
 * 幂等：重复运行整块替换，不产生堆积。
 */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const TOOL_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(TOOL_DIR, '..');
const CARDS_JS = path.join(ROOT, 'game', 'src', 'cards.js');
const BEGIN_MARK = '// ===== [sync-cards-from-live:begin]';
const END_MARK = '// ===== [sync-cards-from-live:end] =====';
const CALL_LINE_OLD = 'SDT.Cards.ensureTabletopSync11();';
const INSERT_ANCHOR = '    // 指定道具定名迁移：保留稳定 id 与存档引用，只更新展示名；';

function fail(message) { throw new Error(`[sync-cards] ${message}`); }
function arg(name, argv) { const i = argv.indexOf(name); return i >= 0 ? argv[i + 1] : undefined; }

function makeStorage() {
  const values = new Map();
  return {
    getItem: k => (values.has(String(k)) ? values.get(String(k)) : null),
    setItem: (k, v) => values.set(String(k), String(v)),
    removeItem: k => values.delete(String(k)),
    clear: () => values.clear(),
  };
}

// 沙箱求值 cards.js 并跑完整迁移链 → 源码有效卡库（口径与浏览器启动一致）
function sourceCardLibrary() {
  const source = fs.readFileSync(CARDS_JS, 'utf8');
  const body = source
    .replace(/^\s*import\s+[^;]+;\s*$/gm, '')
    .replace(/^\s*export\s*\{[^}]+\};?\s*$/gm, '');
  const sandbox = {
    console,
    window: { SDT: { Icons: { img: n => `[[icon:${n}]]`, TYPE_ART: {} } } },
    localStorage: makeStorage(),
    Random: { random: () => 0.5 },
    characterName: v => v || '未选择人物',
    setTimeout, clearTimeout,
  };
  sandbox.globalThis = sandbox;
  try {
    vm.runInNewContext(`${body}\nglobalThis.__cards = window.SDT.Cards;`, sandbox, { filename: 'cards.js', timeout: 5000 });
  } catch (e) { fail(`cards.js 沙箱求值失败: ${e.message}`); }
  const cards = sandbox.__cards;
  if (!cards) fail('cards.js 未初始化 SDT.Cards');
  for (const m of ['ensureStarters', 'ensureSha', 'ensureTabletop', 'ensureDmgTypes', 'ensureEffectFields']) {
    try { if (typeof cards[m] === 'function') cards[m](); } catch (e) { fail(`迁移 ${m}() 失败: ${e.message}`); }
  }
  const all = JSON.parse(JSON.stringify(cards.all()));
  if (!all.length) fail('源码有效卡库为空');
  return all;
}

function normalize(card) {
  const out = {};
  for (const k of Object.keys(card).sort()) out[k] = card[k];
  return out;
}

function readLiveLibrary(inputPath) {
  if (!inputPath || !fs.existsSync(inputPath)) fail(`输入文件不存在: ${inputPath}`);
  const raw = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
  const cards = Array.isArray(raw) ? raw : raw.cards;
  if (!Array.isArray(cards) || !cards.length) fail('输入 JSON 里没有 cards 数组');
  return cards.filter(c => c && typeof c === 'object');
}

function diff(sourceLib, liveLib) {
  const src = new Map(sourceLib.filter(c => c.id).map(c => [c.id, c]));
  const live = new Map();
  const noId = [];
  for (const c of liveLib) {
    if (!c.id) { noId.push(c); continue; }
    live.set(c.id, c);
  }
  const upserts = [], changed = [];
  for (const [id, c] of live) {
    const s = src.get(id);
    if (!s) upserts.push(c);
    else if (JSON.stringify(normalize(s)) !== JSON.stringify(normalize(c))) changed.push(c);
  }
  // 退役只针对有 id 的内置卡；starter 初始牌由 ensureStarters 兜底补种，不退役
  const retire = sourceLib.filter(c => c.id && !live.has(c.id) && !String(c.id).startsWith('starter-')).map(c => c.id);
  return { upserts, changed, retire, noId };
}

function buildBlock(upserts, changed, retire, version) {
  const all = [...changed, ...upserts].sort((a, b) => String(a.id) < String(b.id) ? -1 : 1);
  const lit = list => list.map(c => '      ' + JSON.stringify(normalize(c)) + ',').join('\n');
  const key = `sdt-cards-sync-v${version}-seeded`;
  const retireLit = retire.length ? '\n      ' + retire.map(id => JSON.stringify(id) + ',').join('\n') + '\n    ' : '';
  return `${BEGIN_MARK} v${version}（脚本生成，勿手改；重跑 scripts/sync-cards-from-live.mjs 整块替换）
    // 实机定版覆盖批次：网页版卡牌库修改同步进源码（老板 2026-09-09 拍板的机制）。
    // 沿用 TABLETOP10/11 模式：按 id 整卡覆盖 + 缺失补种 + RETIRE 退役；KEY 变更让旧环境重播。
    CARDS_SYNC: [
${lit(all)}
    ],
    RETIRE_CARDS_SYNC: [${retireLit}],
    ensureCardsSyncLive() {
      try {
        if (localStorage.getItem(${JSON.stringify(key)})) return;
        const cards = SDT.Cards.all();
        for (let i = cards.length - 1; i >= 0; i--) {
          if (this.RETIRE_CARDS_SYNC.includes(cards[i].id)) cards.splice(i, 1);
        }
        this.CARDS_SYNC.forEach(d => {
          const i = cards.findIndex(c => c.id === d.id);
          if (i >= 0) {
            const old = cards[i];
            // 实现字段保留（TABLETOP11 定版规则，2026-09-09 补进同步管线）：
            // 实机同步不回退 cls/hero/tokenOf/unrandom/type(能力卡)/art 贴图键/cost
            const merged = { ...d };
            ['cls', 'hero', 'tokenOf', 'unrandom', 'cost'].forEach(k => {
              if (merged[k] === undefined && old[k] !== undefined) merged[k] = old[k];
            });
            if (merged.type !== '能力卡' && old.type === '能力卡') merged.type = '能力卡';
            if (merged.art === undefined && old.art !== undefined) merged.art = old.art;
            cards[i] = merged;
          } else cards.push({ ...d });
        });
        SDT.Cards.saveAll(cards);
        localStorage.setItem(${JSON.stringify(key)}, '1');
      } catch (e) { /* 隐私模式等场景静默跳过 */ }
    },
    ${END_MARK}`;
}

function main() {
  const argv = process.argv.slice(2);
  const input = arg('--input', argv);
  const checkOnly = argv.includes('--check');
  if (!input) {
    console.error('用法: node scripts/sync-cards-from-live.mjs --input <实机卡库.json> [--check]');
    process.exit(1);
  }
  const sourceLib = sourceCardLibrary();
  const liveLib = readLiveLibrary(input);
  const { upserts, changed, retire, noId } = diff(sourceLib, liveLib);
  console.log(`[sync-cards] 源码有效卡库 ${sourceLib.length} 张；实机 ${liveLib.length} 张`);
  console.log(`[sync-cards] 新增 ${upserts.length} / 覆盖 ${changed.length} / 退役 ${retire.length}${noId.length ? ` / 无id跳过 ${noId.length}` : ''}`);
  for (const c of changed) console.log(`  ~ 覆盖 ${c.id} ${c.name || ''}`);
  for (const c of upserts) console.log(`  + 新增 ${c.id} ${c.name || ''}`);
  for (const id of retire) console.log(`  - 退役 ${id}`);
  for (const c of noId) console.log(`  ? 无id跳过: ${c.name || JSON.stringify(c).slice(0, 40)}`);

  if (checkOnly) { console.log('[sync-cards] --check 模式，未改写文件'); return; }
  if (!upserts.length && !changed.length && !retire.length) {
    console.log('[sync-cards] 无差异，cards.js 无需更新');
    return;
  }

  const before = fs.readFileSync(CARDS_JS, 'utf8');
  let text = before;
  // 旧标记块整块移除（幂等），并清掉旧调用行
  const reOld = new RegExp(BEGIN_MARK.replace(/[/\\^$*+?.()|[\]{}]/g, '\\$&') + '[\\s\\S]*?' + END_MARK.replace(/[/\\^$*+?.()|[\]{}]/g, '\\$&') + '\n');
  text = text.replace(reOld, '');
  text = text.replace(/^\s*SDT\.Cards\.ensureCardsSyncLive\(\);.*\n/m, '');
  // 版本号：旧块存在则 +1，否则 v1
  const mVer = before.match(/\[sync-cards-from-live:begin\] v(\d+)/);
  const version = mVer ? Number(mVer[1]) + 1 : 1;

  // 生成块插入：ensureItemRenames 定义前（SDT.Cards 对象字面量内部）
  if (!text.includes(INSERT_ANCHOR)) fail('cards.js 结构变化：找不到生成块插入锚点');
  text = text.replace(INSERT_ANCHOR, buildBlock(upserts, changed, retire, version) + '\n' + INSERT_ANCHOR);
  // 播种调用行：ensureTabletopSync11 调用之后
  if (!text.includes(CALL_LINE_OLD)) fail('cards.js 结构变化：找不到 ensureTabletopSync11() 调用行');
  text = text.replace(CALL_LINE_OLD, `${CALL_LINE_OLD}\n      SDT.Cards.ensureCardsSyncLive(); // 实机卡库同步（scripts/sync-cards-from-live.mjs 生成，只跑一次）`);

  fs.writeFileSync(CARDS_JS, text, 'utf8');
  console.log(`[sync-cards] cards.js 已更新（sync v${version}，覆盖批次 ${changed.length + upserts.length} 张 + 退役 ${retire.length} 张）`);
}

main();
