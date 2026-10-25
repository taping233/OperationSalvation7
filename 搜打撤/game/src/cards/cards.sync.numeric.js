
/** Fill derived numeric fields without changing the library derivation contract.
 * The library port is read lazily so callers may replace their active library. */
export function createNumericCardMigrations({ library }) {
  return {

    // 伤害类型词条回填：只补缺失值，绝不覆盖玩家已标注的 dmgType（每次启动运行）
    ensureDmgTypes() {
      const cards = library().all();
      let dirty = false;
      cards.forEach((c) => {
        if (c.dmgType) return;
        const dt = library().deriveDmgType(c);
        if (dt) { c.dmgType = dt; dirty = true; }
      });
      if (dirty) library().saveAll(cards);
    },

    // 抽卡词条推导（ensureEffectFields 回填用，只读不写）：
    // 已标注 draw → 原样；描述「抽 N 张牌」→ N（与 battle.js 的描述结算同一线）。
    // 2026-09-08 词条统一（老板指示）：「抽 N 张」（省略「牌」字）与「抽 N-M 张」区间
    // （取下限）同样视为抽卡词条；「从牌库中抽取」（检索牌库）与「额外抽」（形态
    // 每回合效果）不是一次性抽牌，不计入，避免卡面出现误导角标。

    // 效果词条回填（draw/infuse/heal/armor）：只补缺失值，
    // 绝不覆盖玩家已在制作坊标注的值（每次启动运行）
    ensureEffectFields() {
      const cards = library().all();
      let dirty = false;
      const tryFill = (c, key, val) => {
        if (val && +(c[key] || 0) !== val) { c[key] = val; dirty = true; }
      };
      cards.forEach((c) => {
        tryFill(c, 'draw', library().deriveDraw(c));
        tryFill(c, 'infuse', library().deriveInfuse(c));
        tryFill(c, 'heal', library().deriveHeal(c));
        tryFill(c, 'armor', library().deriveArmor(c));
      });
      if (dirty) library().saveAll(cards);
    },

    // 伤害数值回填（2026-09-04 新增）：描述写明「N′」但 dmg 字段缺失的法术卡
    // 自动补入 dmg 与 spell 伤害类型（如 银刺 5′ / 冰刺 1′ / 闪电链 3′）。
    // 只补缺失值，绝不覆盖已标注的 dmg（每次启动运行）
    ensureDmgValues() {
      const cards = library().all();
      let dirty = false;
      cards.forEach((c) => {
        if (+(c.dmg || 0) > 0) return;
        const v = library().deriveDmgValue(c);
        if (v > 0) {
          c.dmg = v;
          if (!library().DMG_TYPE_META[c.dmgType]) c.dmgType = 'spell';
          dirty = true;
        }
      });
      if (dirty) library().saveAll(cards);
    },
  };
}
