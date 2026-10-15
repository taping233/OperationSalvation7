import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { RULE_CONFIG } from '../game/src/core/rule-config.js';

// EXP-003（2026-09-29）：撤离打包屏/帮助曾承诺「消耗口袋自动回收（基地可复原）」，
// 与结算规则（game/src/hub/extraction.commands.js:56-63 逐张 random()<1/3，
// 保留的进基地口袋用钥匙复原、未保留的散失）不符=欺骗玩家。本文件锁定准确文案。
const altar = readFileSync('game/src/run/game.run.altar.js', 'utf8');
const bag = readFileSync('game/src/hub/game.bag.js', 'utf8') + readFileSync('game/src/hub/game.bag.view2.js', 'utf8');
const session = readFileSync('game/src/run/game.session.js', 'utf8');

describe('EXP-003 撤离消耗口袋文案与规则一致', () => {
  it('规则权威：pocketKeepChance 为 1/3，文案口径与其一致', () => {
    expect(RULE_CONFIG.extraction.pocketKeepChance).toBeCloseTo(1 / 3);
    // 文案中出现的比例字面量必须仍是 1/3（若调概率需同步改文案并更新本断言）
    expect(altar).toContain('每张仅 1/3 概率带回');
    expect(altar).toContain('每张 1/3 概率保留');
    expect(bag).toContain('每张仅 1/3 概率带回基地');
  });

  it('打包屏帮助不再承诺「自动回收」，改为逐张 1/3 结算表述', () => {
    expect(altar).not.toContain('自动回收');
    expect(altar).toContain('消耗口袋逐张结算，每张仅 1/3 概率带回');
    expect(altar).toContain('保留的进基地口袋（用钥匙复原），未带回的散失');
  });

  it('打包屏消耗口袋行展示掷骰结果（带回/散失张数），不再写「已自动回收」', () => {
    expect(altar).not.toContain('已自动回收');
    // 数字来自 game.pendingExtraction 的 totalPocketCount/lostPocketCount 快照
    expect(altar).toContain('pocketPending.lostPocketCount || 0');
    expect(altar).toContain('每张 1/3 概率保留 · 带回 ');
    expect(altar).toContain('张（基地可复原）· 散失 ');
  });

  it('局内背包口袋文案不再宣称基地可（免费）复原整袋', () => {
    expect(bag).not.toContain('免费复原');
    expect(bag).not.toContain('基地/火堆可复原');
    expect(bag).toContain('撤离时每张仅 1/3 概率带回基地口袋（用钥匙复原）');
    expect(bag).toContain('火堆休整复原 2 张 / 能源结晶 3 张 · 撤离每张 1/3 概率带回口袋');
  });

  it('准确表述不被回归：结算日志与出发清空提示保持原口径', () => {
    // altar 结算日志（既有准确表述，勿改）
    expect(altar).toContain('只有 1/3 保留（带回 ');
    // game.session.js 出发整理提示（EXP-003 核实为准确，不得动）
    expect(session).toContain('张未复原的卡牌消散了');
  });
});
