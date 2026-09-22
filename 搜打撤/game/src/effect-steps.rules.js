/* 由 effect-steps.js 拆出（2026-09-22 六文件重构批1）。原第 1229-1302 行，逐字搬迁。
 * 铁律：顺序即语义——本分节在壳 effect-steps.js 的 concat 顺序即旧 if 链物理顺序，勿重排。
 * 共享端口由壳经参数 s 注入（deps 展开 + esc/hitFoe + 模块级常量），本文件零 import。 */
export function rulesSteps(s) {
  const {combat, log, releaseHandMatches, setShaTransform, setConsumeFireball, setStealthStrike, registerTurnStartText, esc} = s;
  return [
      /* ============ 战斗规则登记段 ============ */
      {
        id: 'rule.shaTransform', gate: 'always', label: '「杀」化为另一张卡（不朽神剑/青龙化身）',
        when: (ctx) => ctx.desc.match(/[‘’“”「」]?(?:杀|初始攻击)[‘’“”「」]?\s*化为\s*[‘’“”「」]?(?:(\d+)\s*张)?([^\s，。；;、‘’“”「」]{1,8})/),
        run: (ctx, m) => {
          if (typeof setShaTransform !== 'function') return;
          setShaTransform(m[2]);
          log(`[[icon:recycle]] <b>战斗规则</b>：你的「初始攻击」在本场战斗中化为【<b>${esc(m[2])}</b>】`, 'ok');
          ctx.did = true;
        },
      },
      {
        id: 'rule.consumeFireball', gate: 'always', label: '每消耗 1 张卡牌施放火球（深渊降焰）',
        when: (ctx) => ctx.desc.match(/每\s*消耗\s*1\s*张卡牌[^。]*?施放\s*(?:(\d+)\s*次)?[‘’“”「」]?火球/),
        run: (ctx, m) => {
          if (typeof setConsumeFireball !== 'function') return;
          setConsumeFireball(m[1] ? +m[1] : 1);
          log(`[[icon:fire]] <b>战斗规则</b>：每消耗 1 张卡牌，自动施放火球`, 'ok');
          ctx.did = true;
        },
      },
      {
        id: 'rule.turnStartDiscover', gate: 'always', label: '句内嵌「回合开始时发现 N 张」拆出为延迟段（万法乾坤）',
        when: (ctx) => ctx.desc.match(/回合开始时[^。]*?(发现[^。]*?（?\s*(?:\d+|[一两二三四五])?\s*张[^。]*?)$/),
        run: (ctx, m) => {
          if (typeof registerTurnStartText !== 'function') return;
          registerTurnStartText(m[1], String(ctx.card.name || ''));
          log(`[[icon:hourglass]] <b>回合开始时</b>：【${esc(ctx.card.name)}】${esc(m[1])}（下个回合开始起每回合生效）`, 'sys');
          ctx.did = true;
        },
      },
      {
        id: 'rule.stealthStrike', gate: 'always', label: '破隐一击伤害翻倍（白梅落影·妄）',
        when: (ctx) => /破隐[^。]*?伤害翻倍/.test(ctx.desc) ? true : null,
        run: (ctx) => {
          if (typeof setStealthStrike !== 'function') return;
          setStealthStrike(true);
          log('[[icon:runner]] <b>战斗规则</b>：破隐一击——从潜行中发动的攻击伤害翻倍', 'ok');
          ctx.did = true;
        },
      },
      {
        id: 'release.curseLayers', gate: 'fresh', label: '每有 1 层诅咒释放一次「杀」（流光照影）',
        when: (ctx) => (/每有一层诅咒[^。]*?释放(?:一次)?[‘'“]?(?:杀|初始攻击)/.test(ctx.desc) && typeof releaseHandMatches === 'function') ? true : null,
        run: (ctx) => {
          const layers = ctx.curseTarget
            ? combat.CURSES.filter(k => combat.CURSE_META[k].stack)
                .reduce((a, k) => a + (ctx.curseTarget.status[k] || 0), 0)
            : 0;
          let released = 0;
          for (let i = 0; i < layers && i < 10; i++) released += releaseHandMatches('杀', 0);
          log(`[[icon:recycle]] <b>流光照影</b>：目标身负 ${layers} 层诅咒，释放了 ${released} 次「初始攻击」`, 'sys');
          ctx.did = true;
        },
      },
      {
        id: 'release.lastCardTrigger', gate: 'fresh', label: '「若本牌为最后一张手牌触发 N 次」识别（出牌结算判定）',
        when: (ctx) => /最后一张手牌[^。；]*?触发\s*(?:\d+\s*)?次/.test(ctx.desc) ? true : null,
        run: (ctx) => {
          log('[[icon:cards]] 最后一张手牌条件：手牌已空时整卡效果触发 2 次（出牌结算判定）', 'sys');
          ctx.did = true;
        },
      },
      {
        id: 'release.handMatches', gate: 'fresh', label: '直接释放手牌中的所有「箭/杀/火球」（连弩）',
        when: (ctx) => (typeof releaseHandMatches === 'function') ? ctx.desc.match(/直接释放手牌中的所有[‘’“”「」]?(初始攻击|箭|杀|火球)[’’”」]?/) : null,
        run: (ctx, m) => {
          const drawEach = (ctx.desc.match(/每(?:释放|打出)\s*1\s*张[^。]*?抽\s*(\d+)\s*张牌/) || [])[1];
          const relKey = m[1] === '初始攻击' ? '杀' : m[1];
          const released = releaseHandMatches(relKey, drawEach ? +drawEach : 0);
          if (released) { log(`[[icon:swords]] <b>连弩</b>：释放了手牌中 ${released} 张「${m[1]}」`, 'ok'); ctx.did = true; }
        },
      },
  
  ];
}
