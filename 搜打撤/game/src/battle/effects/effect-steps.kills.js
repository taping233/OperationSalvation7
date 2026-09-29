/* 由 effect-steps.js 拆出（2026-09-22 六文件重构批1）。原第 825-1129 行，逐字搬迁。
 * 铁律：顺序即语义——本分节在壳 effect-steps.js 的 concat 顺序即旧 if 链物理顺序，勿重排。
 * 共享端口由壳经参数 s 注入（deps 展开 + esc/hitFoe + 模块级常量），本文件零 import。 */
export function killsSteps(s) {
  const {combat, getAlive, log, heal, pushFloat, queueDiscover, randomDiscoverCard, addTempCard, allCards, random01, getPlayerHp, getHandSize, getHandCards, burstPoison, deckDraw, fleeBattle, getPlayerCaster, damagePlayer, setNextSpellTwice, randomAcquired, esc, hitFoe, POOL_NUM_MAP, parsePoolNoun, isRandomObtainable} = s;
  const paced = steps => Object.assign((...args) => {
    const iterator = steps(...args);
    let next = iterator.next();
    while (!next.done) next = iterator.next();
    return next.value;
  }, { steps });
  return [
      /* ============ 击杀 / 行动 / 资源段 ============ */
      {
        id: 'kill.minions', gate: 'fresh', label: '消灭 N 名敌人（可带攻击力门槛，无门槛优先残血）',
        when: (ctx) => ctx.desc.match(/消灭\s*(\d+)\s*名(?:\s*攻击力\s*(\d+)\s*点?及以下)?/),
        run: paced(function* (ctx, m) {
          const n = +m[1];
          const cap = m[2] ? +m[2] : null;
          let targets;
          if (cap != null) {
            targets = getAlive().filter(f => !f.dead && (f.affix ? false : true) && (f.atk || 0) <= cap).slice(0, n);
          } else {
            targets = getAlive().filter(f => !f.dead && f.hp > 0 && f.hp < (f.maxHp || f.hp)).slice(0, n);
          }
          let killed = 0;
          for (const f of targets) {
            if (f.dead) continue;
            yield { kind: 'windup', targets: [f] };
            if (f.dead) continue;
            f.hp = 0; f.dead = true;
            log(`[[icon:skull]] <b>${esc(f.name)}</b> 被消灭！`, 'ok');
            killed++;
            ctx.did = true;
            if (killed === 1) pushFloat({ unit: 'self', text: '', cls: 'stk sticker-boom' });
            yield { kind: 'hit' };
          }
        }),
      },
      {
        id: 'cast.nextSpellTimes', gate: 'fresh', label: '「下一张法术施放 N 次」（元素风暴，2026-09-16 老板：删注能，直接打出即注册）',
        when: (ctx) => ctx.desc.match(/下一张(?:法术|招式)?施放\s*(\d+)\s*次/),
        run: (ctx, m) => {
          if (typeof setNextSpellTwice !== 'function') return;
          setNextSpellTwice(+m[1]);
          log(`[[icon:sparkles]] <b>元素风暴</b>：下一张法术将施放 ${m[1]} 次`, 'ok');
          ctx.did = true;
        },
      },
      {
        id: 'dmg.taunt', gate: 'fresh', label: '扰敌：迫使前两名敌人相互攻击',
        when: (ctx) => /迫使其?相互攻击/.test(ctx.desc) ? true : null,
        run: paced(function* (ctx) {
          const ts = getAlive().slice(0, 2);
          if (ts.length === 2) {
            yield { kind: 'windup', targets: [ts[1]] };
            if (ts[1].dead) return;
            const r = hitFoe(ctx, ts[1], 0, combat.TYPES.ATTACK, { atk: ts[0].atk });
            log(`[[icon:swords]] <b>扰敌</b>：${esc(ts[0].name)} 被迫攻击 ${esc(ts[1].name)}，造成 ${r.dealt} 点伤害`, 'sys');
            ctx.did = true;
            yield { kind: 'hit' };
          }
        }),
      },
      {
        id: 'dmg.attackAll', gate: 'fresh', label: '攻击全体敌人（按攻击力结算）',
        when: (ctx) => /攻击全体敌人/.test(ctx.desc) ? true : null,
        run: paced(function* (ctx) {
          const caster = getPlayerCaster ? getPlayerCaster() : {};
          const targets = getAlive().slice();
          if (targets.length) yield { kind: 'windup', targets };
          let total = 0;
          for (const target of targets) total += hitFoe(ctx, target, 0, combat.TYPES.ATTACK, caster).dealt;
          if (targets.length) yield { kind: 'hit' };
          log(`[[icon:swords]] <b>${esc(ctx.card.name)}</b>：攻击全体敌人，共造成 ${total} 点攻击伤害`, 'sys');
          ctx.did = true;
        }),
      },
      {
        id: 'dmg.loseLife', gate: 'fresh', label: '损失 N 点生命（恶魔之力）',
        when: (ctx) => ctx.desc.match(/损失\s*(\d+)\s*点?(?:生命|血)/),
        run: (ctx, m) => {
          if (typeof damagePlayer !== 'function') return;
          damagePlayer(+m[1]);
          ctx.did = true;
        },
      },
      {
        id: 'dmg.negHp', gate: 'fresh', label: '自伤「-N 血」',
        when: (ctx) => ctx.desc.match(/[-－]\s*(\d+)\s*点?血/),
        run: (ctx, m) => {
          if (typeof damagePlayer !== 'function') return;
          damagePlayer(+m[1]);
          ctx.did = true;
        },
      },
      {
        id: 'def.armorLoss', gate: 'fresh', label: '回合结束护甲衰减「-N 点」（坚盾）',
        when: (ctx) => ctx.desc.match(/[-－]\s*(\d+)\s*点?\s*$/),
        run: (ctx, m) => {
          const n = +m[1];
          ctx.pdef.armor = Math.max(0, ctx.pdef.armor - n);
          log(`[[icon:plate]] 护甲衰减：-${n} 点（当前 ${ctx.pdef.armor}）`, 'warn');
          ctx.did = true;
        },
      },
      {
        id: 'heal.upTo', gate: 'fresh', label: '回复至 N 血（沐愈光辉）',
        when: (ctx) => ctx.desc.match(/回复\s*至\s*(\d+)\s*血/),
        run: (ctx, m) => {
          const want = +m[1];
          const cur = getPlayerHp();
          if ((ctx.pstat.status.healban || 0) > 0) {
            log(`[[icon:heart]] 禁疗中：回复至 ${want} 血无效（还剩 ${ctx.pstat.status.healban} 回合）`, 'warn');
          } else if (want > cur) {
            heal(want - cur);
            pushFloat({ unit: 'self', text: '', cls: 'stk sticker-heal', warm: true });
            log(`[[icon:heart]] 回复至 <b>${want}</b> 血（当前 ${cur}，回复 ${want - cur}）`, 'ok');
          } else {
            log(`[[icon:heart]] 回复至 ${want} 血：当前 ${cur} 不低于目标值，无变化`, 'ok');
          }
          ctx.did = true;
        },
      },
      {
        id: 'curse.immobilize', gate: 'fresh', label: '无法行动（制敌 → 冰冻 1 回合）',
        when: (ctx) => (/无法行动/.test(ctx.desc) && /下回合|下个回合|本回合/.test(ctx.desc)) ? true : null,
        run: (ctx) => {
          if (ctx.curseTarget) {
            combat.addCurse(ctx.curseTarget, 'freeze', 1);
            log(`[[icon:crystal]] <b>${esc(ctx.curseTarget.name)}</b> 无法行动（冰冻 1 回合）`, 'sys');
            ctx.did = true;
          }
        },
      },
      {
        id: 'curse.poisonDouble', gate: 'fresh', label: '中毒层数翻倍并立即触发毒伤（花鸩）',
        when: (ctx) => /中毒层数翻倍/.test(ctx.desc) ? true : null,
        run: (ctx) => {
          if (ctx.curseTarget) {
            combat.addCurse(ctx.curseTarget, 'poison', ctx.curseTarget.status.poison || 0);   // 加倍：再叠自身当前层数
            const burst = burstPoison(ctx.curseTarget) || { dealt: 0 };   // 目标没中毒时端口返回 null，按 0 点毒伤结算
            log(`[[icon:skull]] <b>${esc(ctx.curseTarget.name)}</b> 中毒翻倍至 ${ctx.curseTarget.status.poison} 层并立即触发 ${burst.dealt} 点毒伤`, 'sys');
            ctx.did = true;
          }
        },
      },
      {
        id: 'curse.poisonBurstN', gate: 'fresh', label: '立即触发 N 次目标全部毒伤（毒爆）',
        when: (ctx) => ctx.desc.match(/立即触发\s*(\d+)\s*次[^。]*?毒伤/),
        run: (ctx, m) => {
          if (!ctx.curseTarget) return;
          const times = Math.max(1, +m[1]);
          let total = 0;
          for (let i = 0; i < times; i++) {
            const burst = burstPoison(ctx.curseTarget) || { dealt: 0 };   // 中毒层数不衰减，每次引爆都吃满全部层数
            total += burst.dealt;
          }
          log(`[[icon:skull]] <b>${esc(ctx.curseTarget.name)}</b> 毒伤引爆 ${times} 次，共 <b>${total}</b> 点固定伤害（${ctx.curseTarget.status.poison || 0} 层中毒保留）`, 'sys');
          ctx.did = true;
        },
      },
      {
        id: 'hand.fillRandom', gate: 'fresh', label: '置入随机卡牌直至手牌达到 N 张（浪掷风吟）',
        when: (ctx) => ctx.desc.match(/置入随机卡牌直至手牌达到\s*(\d+)\s*张/),
        run: (ctx, m) => {
          const want = +m[1];
          let put = 0, spells = 0;
          while (getHandSize() < want) {
            const c = randomDiscoverCard(null);
            if (!c) break;
            addTempCard(c); put++;
            if (typeof randomAcquired === 'function') randomAcquired(c);   // 阿猫的礼物：随机获取触发
            if (c.type === '法术') spells++;
          }
          const perM = ctx.desc.match(/每置入\s*1\s*张法术[^。]*?回复\s*(\d+)\s*血/);
          const healedN = perM ? +perM[1] : 0;
          if (healedN && spells > 0) {
            heal(healedN * spells);
            pushFloat({ unit: 'self', text: '', cls: 'stk sticker-heal', warm: true });
            log(`[[icon:cards]] <b>${esc(ctx.card.name)}</b>：置入 ${put} 张随机卡牌（手牌达到 ${getHandSize()} 张），其中 ${spells} 张法术 → 回复 ${healedN * spells} 血`, 'loot');
          } else {
            log(`[[icon:cards]] <b>${esc(ctx.card.name)}</b>：置入 ${put} 张随机卡牌（手牌达到 ${getHandSize()} 张）`, 'loot');
          }
          if (put) ctx.did = true;
        },
      },
      {
        id: 'hand.copyRandom', gate: 'fresh', label: '获得一张随机手牌的复制（刀剑形态）',
        when: (ctx) => /获得一张随机手牌的复制/.test(ctx.desc) ? true : null,
        run: (ctx) => {
          const cards = getHandCards();
          if (cards.length) {
            const tpl = cards[Math.floor(random01() * cards.length)];
            if (tpl) {
              addTempCard(tpl.card);
              log(`[[icon:cards]] 复制了手牌中的【<b>${esc(tpl.card.name)}</b>】（置入手牌）`, 'loot');
              ctx.did = true;
            }
          }
        },
      },
      {
        id: 'hand.tokenPass', gate: 'fresh', label: '获得员工通行证A/B（战后消散）',
        when: (ctx) => /获得\s*1\s*张员工通行证B或员工通行证A/.test(ctx.desc) ? true : null,
        run: (ctx) => {
          const pool = allCards().filter(c => c.id === 'tt-token-gold' || c.id === 'tt-token-color');
          if (pool.length) {
            const got = pool[Math.floor(random01() * pool.length)];
            addTempCard(got);
            log(`[[icon:sparkles]] 获得【<b>${esc(got.name)}</b>】（令牌，战后消散）`, 'loot');
            ctx.did = true;
          }
        },
      },
      {
        id: 'misc.flee', gate: 'fresh', label: '非 BOSS 战逃跑一次（烟雾弹）',
        when: (ctx) => (/逃跑一次|非 BOSS 战逃跑/.test(ctx.desc) && typeof fleeBattle === 'function') ? true : null,
        run: (ctx) => { fleeBattle(); ctx.did = true; },
      },
      {
        id: 'buff.randomBlessing', gate: 'fresh', label: '随机获取一项祝福（天国之门）',
        when: (ctx) => /随机获取一项祝福/.test(ctx.desc) ? true : null,
        run: (ctx) => {
          const cand = [];
          if (/潜行/.test(ctx.desc)) cand.push({ key: 'stealth', run: () => combat.addBlessing(ctx.pstat, 'stealth', 1), name: '潜行' });
          if (/攻击力/.test(ctx.desc)) cand.push({ key: 'atkUp', run: () => combat.addBlessing(ctx.pstat, 'atkUp', 1), name: '攻击力 +1' });
          if (/法伤/.test(ctx.desc)) cand.push({ key: 'spellUp', run: () => combat.addBlessing(ctx.pstat, 'spellUp', 1), name: '法伤 +1' });
          if (/减伤/.test(ctx.desc)) cand.push({ key: 'reduce', run: () => combat.addBlessing(ctx.pstat, 'reduce', 1), name: '减伤 1' });
          if (/护甲/.test(ctx.desc)) cand.push({ key: '_armor', run: () => { ctx.pdef.armor += 5; }, name: '护甲 5' });
          if (/净化/.test(ctx.desc)) cand.push({ key: '_purify', run: () => combat.purify(ctx.pstat), name: '净化' });
          if (cand.length) {
            const fresh = cand.filter(c => c.key.startsWith('_') || !((ctx.pstat.status[c.key] || 0) > 0));
            const pool = fresh.length ? fresh : cand;
            const pick = pool[Math.floor(random01() * pool.length)];
            pick.run();
            log(`[[icon:sparkles]] <b>祝福·${esc(pick.name)}</b>（随机祝福，优先不重复）`, 'ok');
            ctx.did = true;
          }
        },
      },
      {
        id: 'draw.fromDeck', gate: 'fresh', label: '从牌库中抽取 N 张指定类型（武装）',
        when: (ctx) => ctx.desc.match(/从牌库中抽取\s*(\d+)\s*张?(初始攻击|装备|法术|武术|杀)牌?/),
        run: (ctx, m) => {
          const kind = (m[2] === '杀' || m[2] === '初始攻击') ? '杀' : m[2];
          deckDraw({ n: +m[1], type: kind });
          ctx.did = true;
        },
      },
      {
        id: 'heal.allies', gate: 'fresh', label: '治疗所有队友（银河幻境）',
        when: (ctx) => /治疗所有队友|治疗全体/.test(ctx.desc) ? true : null,
        run: (ctx) => {
          heal(3);
          pushFloat({ unit: 'self', text: '', cls: 'stk sticker-heal', warm: true });
          log(`[[icon:heart]] 治疗所有队友：回复 <b>3</b> 点生命`, 'ok');
          ctx.did = true;
        },
      },
      {
        id: 'hand.curseCards', gate: 'fresh', label: '随机获取 N 张能施加诅咒的卡牌/招式（厄运）',
        when: (ctx) => ctx.desc.match(/随机获取\s*(\d+)\s*张能施加诅咒的(卡牌|招式)/),
        run: (ctx, m) => {
          const wantType = m[2] === '招式' ? '武术' : null;
          const pool = allCards().filter(c =>
            c.rarity !== '衍生' && ['武术', '法术', '装备', '能力卡'].includes(c.type) &&
            (!wantType || c.type === wantType) &&
            /诅咒|中毒|流血|冰冻|沉默|破甲|禁疗/.test(String(c.desc || '')));
          let got = 0;
          for (let i = 0; i < +m[1] && pool.length; i++) {
            const c = pool[Math.floor(random01() * pool.length)];
            addTempCard(c); got++;
          }
          log(`[[icon:skull]] <b>${esc(ctx.card.name)}</b>：随机获得 ${got} 张【能施加诅咒${wantType ? '的招式' : ''}】的卡牌（置入手牌，战后消散）`, 'loot');
          if (got) ctx.did = true;
        },
      },
      {
        id: 'discover.potion', gate: 'fresh', label: '发现 1 瓶药水并直接释放（药水魔法）',
        when: (ctx) => ctx.desc.match(/发现\s*1?\s*瓶药水/),
        run: (ctx) => {
          queueDiscover({ n: 1, act: 'potion', pred: parsePoolNoun('药水', ctx.myClass) });
          log(`[[icon:flask]] <b>${esc(ctx.card.name)}</b>：发现 1 瓶药水并直接释放`, 'sys');
          ctx.did = true;
        },
      },
      {
        id: 'discover.infuseFree', gate: 'fresh', label: '发现一张注能卡，使其无需注能（灵能召唤）',
        when: (ctx) => /发现\s*(?:一|1)\s*张注能卡/.test(ctx.desc) ? true : null,
        run: (ctx) => {
          const pred = parsePoolNoun('注能', ctx.myClass);
          const c = pred ? randomDiscoverCard(pred) : null;
          if (c) {
            addTempCard({ ...c, _noInfuse: true });
            log(`[[icon:crystal]] <b>灵能召唤</b>：发现【<b>${esc(c.name)}</b>】，其无需注能即可打出`, 'loot');
          } else log('[[icon:question]] 没有可发现的注能卡', 'dim');
          ctx.did = true;
        },
      },
      {
        // 第十二批（2026-09-23）：基础开发「随机获取两张0费招式」/ 突破进展「0/1/2 费各一张」——
        // 「随机获取」直接随机入手，不走发现面板（同魔法锅炉口径）；先于 discover.pool 声明抢占。
        id: 'rand.getCostedMoves', gate: 'fresh', label: '随机获取 N 张指定费用招式（直接入手）',
        when: (ctx) => {
          if (/随机获取\s*(?:两|2)\s*张\s*0费招式/.test(ctx.desc)) return [0, 0];
          if (/随机获取\s*1?\s*张\s*0费[，,]\s*一\s*张\s*1费[，,]\s*一\s*张\s*2费招式/.test(ctx.desc)) return [0, 1, 2];
          return null;
        },
        run: (ctx, costs) => {
          const got = [];
          for (const k of costs) {
            const base = parsePoolNoun(`${k}费招式`, ctx.myClass);
            const c = base && typeof isRandomObtainable === 'function'
              ? randomDiscoverCard(x => base(x) && isRandomObtainable(x)) : null;
            if (c) {
              addTempCard(c);
              if (typeof randomAcquired === 'function') randomAcquired(c);
              got.push(c.name);
            }
          }
          if (got.length) log(`[[icon:cards]] <b>${esc(ctx.card.name)}</b>：随机获取 ${got.length} 张招式（${got.map(esc).join('、')}）`, 'loot');
          else log(`[[icon:question]] <b>${esc(ctx.card.name)}</b>：卡池里没有符合条件的招式`, 'dim');
          ctx.did = true;
        },
      },
      {
        id: 'discover.pool', gate: 'fresh', label: '发现/随机获取/获得 N 张 ______（统一入口 + 限制卡池）',
        when: (ctx) => {
          // 「该牌时」= 获得/消耗时才触发的被动，出牌时跳过
          // 结尾组 +招式（第十二批 2026-09-23：发现/获取「N 费招式」）
          const dPool = !/该牌时/.test(ctx.desc)
            ? ctx.desc.match(/(?:发现|随机获取|获取|获得)(?:并直接施放)?\s*(?:(\d+|[一两二三四五])\s*[张种])?\s*([^，。；,\s]{0,8}?)(卡牌|的卡|的牌|能力卡|牌|卡|招式)/)
            : null;
          return dPool || null;
        },
        run: (ctx, dPool) => {
          const n0 = POOL_NUM_MAP[dPool[1]] != null ? POOL_NUM_MAP[dPool[1]] : (dPool[1] ? +dPool[1] : 1);
          // 招式尾拼回名词（2费招式 → parsePoolNoun 才能同时吃费用+武术两道限制）；牌/卡尾维持原样丢弃
          const noun = (dPool[2] || '') + (dPool[3] === '招式' ? '招式' : '');
          const pred = parsePoolNoun(noun, ctx.myClass);
          const n = /等量随机卡牌/.test(ctx.desc) ? 2 : n0;   // 魔法锅炉「发现等量随机卡牌」（消耗至多 2 张）
          let act = null;
          // 需求 #17（2026-09-09）：「并直接施放 / 并施放 / 并释放」都算直接释放
          if (/并直接施放/.test(dPool[0]) || /并将其释放|并(?:直接)?(?:施放|释放)/.test(ctx.desc)) act = 'play';
          if (/获取剩下(两|2)张/.test(ctx.desc)) act = 'playKeep';
          // 二刀流（2026-09-10 需求）：「并额外获得1张复制」→ 发现的卡连本体共 2 张置入手牌
          if (/并额外获得\s*1\s*张复制/.test(ctx.desc)) act = 'dup';
          // 挖宝：「并获得等同于其价格的护甲」；江湖救急：「回合开始时将其消耗」
          queueDiscover({ n, pred, act,
            priceArmor: /获得等同于(?:其|该卡|该牌)价格的护甲/.test(ctx.desc),
            consumeTempAtTurn: /回合开始时将其消耗/.test(ctx.desc),
            // 第十二批（2026-09-23）：魔法新发现「使其变为0费」/ 高端研发「回合开始时使其-1费」
            zeroCost: /使其变为0费/.test(ctx.desc),
            decayEachTurn: /回合开始时[，,]?\s*使其-1费/.test(ctx.desc) });
          const label = pred ? noun.replace(/的$/, '') : '';
          log(`[[icon:question]] <b>${esc(ctx.card.name)}</b>：${act === 'play' ? '发现并直接施放' : act === 'playKeep' ? '发现（施放 1 张，其余入手）' : '发现'} ${n} 张${label ? `【${esc(label)}】` : ''}卡牌${pred ? '（限制卡池）' : ''}`, 'sys');
          ctx.did = true;
        },
      },
  
  ];
}
