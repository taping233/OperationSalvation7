#!/usr/bin/env node
/**
 * 实机卡库 → 定版数据同步（2026-09-09 机制化，老板要求"网页版里对卡牌库的修改会同步"）。
 *
 * 用法:
 *   node scripts/sync-cards-from-live.mjs --input <实机卡库.json>          # 同步并改写 game/data/cards-sync.json
 *   node scripts/sync-cards-from-live.mjs --input <json> --check          # 只报告差异，不改文件
 *
 * 输入 JSON 支持两种形态：游戏内「导出卡牌」的 {game,format,version,cards:[...]}
 * 或裸数组 [...]（本机 Edge localStorage 提取脚本 .tmp/extract_sdt_cards.py 的产物）。
 *
 * 原理：沙箱求值 cards.js 得到源码有效卡库（完整 ensure 迁移链 + 已外置的 cards-sync.json
 * 覆盖批次），与实机卡库按 id diff；结果写进 game/data/cards-sync.json（沿用 TABLETOP10/11 的
 * 整卡覆盖+补种+退役模式），version 自动递增 → 播种 KEY 变化，让所有旧环境重播一次拉齐到实机版。
 * 2026-09-11 架构批次 6：产物从「cards.js 内嵌代码块」改为纯 JSON 数据，脚本不再改写源码。
 * 幂等：整份重写，不产生堆积。
 */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const TOOL_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(TOOL_DIR, '..');
const CARDS_JS = path.join(ROOT, 'game', 'src', 'cards.js');
const SYNC_JSON = path.join(ROOT, 'game', 'data', 'cards-sync.json');

function fail(message) { throw new Error(`[sync-cards] ${message}`); }
function arg(name, argv) { const i = argv.indexOf(name); return i >= 0 ? argv[i + 1] : undefined; }

function readSyncDoc() {
  if (!fs.existsSync(SYNC_JSON)) return { version: 0, note: '', changelog: [], cards: [], retire: [] };
  try { return JSON.parse(fs.readFileSync(SYNC_JSON, 'utf8')); }
  catch (e) { fail(`cards-sync.json 解析失败: ${e.message}`); }
}

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
// cards.js 已改为从 data-loader 读 DATA.cardsSync，沙箱里补上同名数据端口
function sourceCardLibrary() {
  const source = fs.readFileSync(CARDS_JS, 'utf8');
  const body = source
    .replace(/^\s*import\s+[^;]+;\s*$/gm, '')
    .replace(/^\s*export\s*\{[^}]+\};?\s*$/gm, '');
  const sandbox = {
    console,
    window: { SDT: { Icons: { img: n => `[[icon:${n}]]`, TYPE_ART: {} } } },
    DATA: { cardsSync: readSyncDoc() },
    // cards.js 的卡面渲染已外迁（cards.view.js，2026-09-11 批次 1）；沙箱剥掉 import 后
    // 这两个名字会变成未定义引用，按「不渲染只取数据」的口径补空实现。
    cardHTML: () => '',
    cardBackHTML: () => '',
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

function buildDoc(upserts, changed, retire, version, prev, sourceLib) {
  // 2026-09-12 事故修复：整份重写曾丢弃历史批次里"源码不定义的纯实机卡"
  // （cc-chase-slash 等 7 张网页版自建卡差点永久丢失）。本轮 diff 之外的旧条目，
  // 只要源码有效卡库不存在且不在本轮退役名单，必须原样保留。
  const newIds = new Set([...changed, ...upserts].map(c => c.id));
  const srcIds = new Set(sourceLib.filter(c => c.id).map(c => c.id));
  const carried = (prev.cards || []).filter(c =>
    c.id && !newIds.has(c.id) && !srcIds.has(c.id) && !retire.includes(c.id));
  const cards = [...changed, ...upserts, ...carried]
    .sort((a, b) => String(a.id) < String(b.id) ? -1 : 1)
    .map(normalize);
  const stamp = new Date().toISOString().slice(0, 10);
  const changelog = [
    `${stamp} 实机卡库同步（v${version}）：覆盖 ${changed.length} / 新增 ${upserts.length} / 退役名单 ${retire.length}${carried.length ? ` / 保留历史实机卡 ${carried.length}` : ''}`,
    ...(prev.changelog || []),
  ];
  return {
    version,
    note: '实机卡库定版覆盖批次数据（同步自网页版实机卡库）。由 scripts/sync-cards-from-live.mjs 生成，勿手改；重跑该脚本整份重写。',
    changelog,
    cards,
    retire,
  };
}

function main() {
  const argv = process.argv.slice(2);
  const input = arg('--input', argv);
  const checkOnly = argv.includes('--check');
  if (!input) {
    console.error('用法: node scripts/sync-cards-from-live.mjs --input <实机卡库.json> [--check]');
    process.exit(1);
  }
  const prev = readSyncDoc();
  const sourceLib = sourceCardLibrary();
  const liveLib = readLiveLibrary(input);
  const { upserts, changed, retire: retireDiff, noId } = diff(sourceLib, liveLib);
  // 退役名单单调累积（2026-09-13）：diff 只算得出「源码有效卡库定义过、实机没有」的卡，
  // 而覆盖批次里的纯实机卡（源码不定义，如 cards.js 已整卡退役的 tt7-drunksong）退役后
  // diff 再也算不出来，整份重写就会把退役条目丢掉——tt-peach/tt6-timeskip 已因此丢过一次
  // （见 changelog v14）。口径：本轮 diff ∪ 历史退役；实机仍在的 id 解除退役（老板在实机
  // 重建同 id 时走覆盖批次，不再被清掉）。
  const liveIds = new Set(liveLib.filter(c => c.id).map(c => c.id));
  const retire = [...new Set([...retireDiff, ...(prev.retire || [])])].filter(id => !liveIds.has(id));
  const retireChanged = JSON.stringify(retire) !== JSON.stringify(prev.retire || []);
  console.log(`[sync-cards] 源码有效卡库 ${sourceLib.length} 张；实机 ${liveLib.length} 张`);
  console.log(`[sync-cards] 新增 ${upserts.length} / 覆盖 ${changed.length} / 本轮退役 ${retireDiff.length} / 退役名单累计 ${retire.length}${noId.length ? ` / 无id跳过 ${noId.length}` : ''}`);
  for (const c of changed) console.log(`  ~ 覆盖 ${c.id} ${c.name || ''}`);
  for (const c of upserts) console.log(`  + 新增 ${c.id} ${c.name || ''}`);
  for (const id of retireDiff) console.log(`  - 本轮退役 ${id}`);
  for (const c of noId) console.log(`  ? 无id跳过: ${c.name || JSON.stringify(c).slice(0, 40)}`);

  if (checkOnly) { console.log('[sync-cards] --check 模式，未改写文件'); return; }
  if (!upserts.length && !changed.length && !retireChanged) {
    console.log('[sync-cards] 无差异，cards-sync.json 无需更新');
    return;
  }

  const version = (Number(prev.version) || 0) + 1;
  const doc = buildDoc(upserts, changed, retire, version, prev, sourceLib);
  fs.writeFileSync(SYNC_JSON, JSON.stringify(doc, null, 2) + '\n', 'utf8');
  console.log(`[sync-cards] game/data/cards-sync.json 已更新（sync v${version}，覆盖批次 ${changed.length + upserts.length} 张 + 退役名单 ${retire.length} 张）`);
}

main();
