import { describe, expect, it } from 'vitest';
import { suppressLegacyImmediateText, isLegacyDropExcluded } from '../game/src/cards/card-compatibility.js';
import { cardPlayExecutionPlan } from '../game/src/cards/card-execution-plan.js';

const legacyStaff = () => ({ id: 'tt2-venomstaff', rules: { version: 1, battle: { hosted: ['venom-staff'] } } });

describe('historical card compatibility boundary', () => {
  it('keeps the legacy staff passive without swallowing a custom card immediate effect', () => {
    expect(cardPlayExecutionPlan(legacyStaff()).suppressImmediateText).toBe(true);
    expect(cardPlayExecutionPlan({ ...legacyStaff(), id: 'custom-staff' }).suppressImmediateText).toBe(false);
    expect(cardPlayExecutionPlan({ id: 'tt2-venomstaff', name: '毒杖' }).suppressImmediateText).toBe(false);
  });

  it.each(['triggers', 'equip', 'bag'])('explicit %s declarations leave the historical exception', domain => {
    const card = legacyStaff();
    card.rules[domain] = {};
    expect(suppressLegacyImmediateText(card)).toBe(false);
  });

  it('keeps an explicit empty onPlay as the sole immediate authority', () => {
    const card = legacyStaff();
    card.rules.triggers = { onPlay: [] };
    expect(suppressLegacyImmediateText(card)).toBe(false);
    expect(cardPlayExecutionPlan(card)).toMatchObject({ onPlay: { kind: 'structured', ops: [] }, suppressImmediateText: true });
  });

  it('identifies the historical drop exclusion by identity, never by renamed display text', () => {
    expect(isLegacyDropExcluded({ id: 'tt-token-color', name: '玩家改名' })).toBe(true);
    expect(isLegacyDropExcluded({ id: 'custom-token', name: '员工通行证A' })).toBe(false);
  });
});
