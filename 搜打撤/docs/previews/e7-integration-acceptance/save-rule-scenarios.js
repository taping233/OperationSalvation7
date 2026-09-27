// E7-only preparation/inspection. All gameplay actions remain on the real page.
export function register(ctx) {
  const faultKey = 'e7-next-storage-fault';
  const sampleKey = 'e7-save-rule-samples';
  const battleKey = 'e7-rule-before';
  const clone = value => JSON.parse(JSON.stringify(value));
  const slotKeys = slot => ({ run: `sdt-save-v2-slot${slot}`, base: `sdt-base-v2-slot${slot}`, journal: `sdt-tx-v1-slot${slot}` });
  const rawSlot = slot => Object.fromEntries(Object.entries(slotKeys(slot)).map(([name, key]) => [name, localStorage.getItem(key)]));
  const samples = () => JSON.parse(sessionStorage.getItem(sampleKey) || '{}');
  const logText = () => document.getElementById('log')?.textContent || '';
  const add = (id, label, handler) => ctx.register(id, label, async () => {
    ctx.assertIsolatedOrigin();
    return handler();
  });
  function disarm() {
    ctx.disarmStorageFault();
    sessionStorage.setItem(faultKey, JSON.stringify({ enabled: false }));
  }
  function recoverable(slot) {
    const cards = ctx.getSDT().Cards;
    // all() is the mutable, storage-backed player catalog and can be empty.
    // SHA is the production starter definition used by ordinary run creation.
    const attack = cards?.SHA;
    if (!attack?.id) throw new Error('生产初始牌定义 Cards.SHA 尚未就绪');
    // E5 ordinary() shape, deliberately without version to exercise migration.
    return {
      seed: `e7-recovery-${slot}`, mapSeed: `e7-recovery-${slot}`,
      generatorVersion: 3, layoutVersion: 9, layerIdx: 0, trackPos: 0,
      hp: 50, maxHp: 50, atk: 4, coins: 23, turn: 1, mode: 'standard',
      myClass: '战士', characterId: 'heixiang', inventory: [],
      ownedCards: [0, 1, 2].map(i => ({ uid: `e7-${slot}-attack-${i}`, card: clone(attack) })),
      cardOrder: [], usedPocket: [], eventLog: [], discovered: [], elapsed: 0,
      e7Sample: 'constructed-no-version-legacy-map-3-9',
    };
  }
  async function prepare(slot, kind, run, faultTarget = null) {
    const game = ctx.getGame();
    if (game.battleActive || game.state !== 'title') throw new Error('请先通过主页面返回标题，再准备样本；准备不会替你退出或保存当前局。');
    if (rawSlot(slot).journal !== null) throw new Error(`档位 ${slot} 有 journal，保留现场，不覆盖该样本。`);
    disarm();
    const before = rawSlot(slot);
    await ctx.writeSample(slot, { run, base: { version: 2, stash: [], pocket: [], stats: { playSeconds: 0 } } });
    const prepared = rawSlot(slot);
    const all = samples();
    all[slot] = { kind, before, prepared, faultTarget, preparedAt: new Date().toISOString() };
    sessionStorage.setItem(sampleKey, JSON.stringify(all));
    if (faultTarget) {
      const fault = { enabled: true, slot, method: 'setItem', key: slotKeys(slot)[faultTarget], times: 1 };
      sessionStorage.setItem(faultKey, JSON.stringify(fault));
      ctx.armStorageFault(fault);
    }
    ctx.record('e5-sample-prepared', {
      slot, kind, before, prepared, faultTarget,
      classification: '构造/固定隔离样本准备；尚未执行真实菜单操作',
      next: `点击主页面“开始游戏”，再点档位 0${slot}“继续对局”；完成后点“E5 记录恢复结果”。`,
      fault: faultTarget ? '仅目标键首次写入抛错；实际命中次数由宿主故障包装器记录。' : '无故障注入',
    });
  }
  add('e5-bad', 'E5 准备03坏结构', () => prepare(3, 'unsafe-ownedCards', { ...recoverable(3), ownedCards: [null], discovered: {} }));
  add('e5-old', 'E5 准备03原旧档', () => prepare(3, 'fixed-save-v1-run', {
    // Exact data from tests/fixtures/save-v1-run.json: no invented map identity.
    layerIdx: 1, trackPos: 7, hp: 19, maxHp: 30, coins: 23, turn: 14, atk: 6,
    mode: 'elite', myClass: '战士', inventory: [{ id: 'wood', name: '木材', n: 2 }],
    ownedCards: [{ uid: 'legacy-card-1', card: { id: 'builtin-sha', name: '初始攻击', type: '武术', cost: 1 } }],
    cardOrder: ['初始攻击'], usedPocket: [], eventLog: ['旧档仍在进行'],
    discovered: ['outer:door:1'], diceHistory: [4, 2, 6], elapsed: 321,
  }));
  add('e5-good', 'E5 准备04可恢复旧格式', () => prepare(4, 'constructed-recoverable-3-9', recoverable(4)));
  add('e5-run-fail', 'E5 准备05进度回写失败', () => prepare(5, 'run-write-failure', recoverable(5), 'run'));
  add('e5-base-fail', 'E5 准备05基地回写失败', () => prepare(5, 'base-write-failure', { ...recoverable(5), elapsed: 11 }, 'base'));
  add('e5-disarm', 'E5 停用存储故障', () => {
    disarm();
    ctx.record('e5-storage-fault-disabled', { enabled: false, note: '保留故障与样本记录，不删除存储键。' });
  });
  add('e5-capture', 'E5 记录恢复结果', async () => {
    const session = await import('/src/run/game.session.js');
    const game = ctx.getGame();
    const visibleError = document.getElementById('slotRestoreError');
    const rows = Object.entries(samples()).map(([slot, item]) => {
      const current = rawSlot(+slot);
      let parsed = null;
      try { parsed = JSON.parse(current.run); } catch { /* Raw evidence remains available. */ }
      return {
        slot: +slot, kind: item.kind, prepared: item.prepared, current,
        rawUnchanged: Object.fromEntries(Object.keys(current).map(key => [key, current[key] === item.prepared[key]])),
        persisted: { version: parsed?.version, hasMapSnapshot: !!parsed?.mapSnapshot },
        enteredThisSlot: session.getActiveSlot() === +slot && game.runActive,
      };
    });
    ctx.record('e5-recovery-observation', {
      rows, state: game.state, activeSlot: session.getActiveSlot(), runActive: game.runActive,
      hp: game.hp, coins: game.coins, mapIdentity: [game.generatorVersion, game.layoutVersion],
      visibleError: visibleError && !visibleError.hidden ? visibleError.textContent : null,
      logText: logText(),
      boundary: '进入完成、原串变化与故障命中分别记录；本按钮不调用loadGame/saveGame，不推断loadGame.persistence返回值。',
    });
  });
  async function resources() {
    const runtime = await import('/src/battle/battle.runtime.js');
    const game = ctx.getGame();
    return {
      battleToken: ctx.getSDT().Battle.getSnapshot().battleToken,
      hand: [...runtime.hand], consumed: [...runtime.consumed], played: [...runtime.played],
      grave: [...runtime.grave], discard: [...runtime.discard], energy: runtime.energy,
      coins: game.coins, fuels: runtime.infuseFuels, hp: game.hp, maxHp: game.maxHp,
      foes: runtime.foes.map(foe => ({ id: foe.id, hp: foe.hp })),
    };
  }
  function ruleCard(kind) {
    const card = {
      id: `e7-${kind}`, name: `E7 ${kind}`, type: '法术', cost: 1,
      desc: '获得 99 枚金币。',
      rules: { version: 1, battle: { target: { side: null, area: false } },
        triggers: { onPlay: [{ op: 'coins', n: 3 }, { op: 'coins', n: 5 }] } },
    };
    if (kind === 'unsupported-onPlay') {
      card.rules.battle.requirements = [{ kind: 'handCards', count: 1, type: '法术' }];
      card.rules.triggers.onPlay.push({ op: 'acquire', n: 1, pool: { kind: '随机' }, dest: 'hand', act: 'play' });
    }
    if (kind === 'unsupported-beginInfuse') {
      card.infuse = 1;
      card.desc = '注能(1)：获得 4 枚金币。';
      card.rules.triggers = { onDraw: [{ op: 'coins', n: 4 }] };
    }
    if (kind === 'invalid') card.rules.version = 999;
    if (kind === 'legacy') {
      const bandage = ctx.getSDT().Cards.STARTERS?.find(entry => entry.id === 'starter-emergency-bandage');
      if (!bandage) throw new Error('生产应急绷带定义尚未就绪。');
      return clone(bandage);
    }
    return card;
  }
  async function inject(kind) {
    const game = ctx.getGame(), battle = ctx.getSDT().Battle;
    if (!game.battleActive || !battle?.getSnapshot) throw new Error('先在真实主页面进入普通战斗，再准备规则样本。');
    const snap = battle.getSnapshot();
    if (snap.busy || snap.actionQueueLength || snap.deckSelection || snap.pendingTarget || snap.infusing || snap.handSelecting || snap.choosing || snap.discovering) {
      throw new Error('请等战斗空闲，并关闭当前选牌/目标/发现流程后再准备。');
    }
    const runtime = await import('/src/battle/battle.runtime.js');
    const { inspectCardRuleCapability } = await import('/src/cards/card-rules.capability.js');
    const card = ruleCard(kind);
    const capability = inspectCardRuleCapability(card);
    const expectedKind = kind.startsWith('unsupported-') ? 'unsupported' : kind;
    if (capability.kind !== expectedKind) throw new Error(`样本分类错误：预期${expectedKind}，实际${JSON.stringify(capability)}；未覆盖手牌。`);
    const uid = snap.hand.find(handUid => runtime.cardOverrides.has(handUid) ||
      game.ownedCards.some(entry => entry.uid === handUid) || runtime.granted.some(entry => entry.uid === handUid));
    if (!uid || snap.energy < card.cost) throw new Error(`需要可用手牌及${card.cost}点能量；请正常推进回合。`);
    if (kind.startsWith('unsupported-') && snap.hand.length < 2) throw new Error('未支持样本需要源牌之外至少一张手牌，用于支付或注能燃料。');
    if (kind === 'legacy' && (game.maxHp - game.hp < 2 || (snap.pstat?.status?.healban || 0) > 0)) {
      throw new Error('应急绷带需要自然受击后缺少至少2点生命且无禁疗；准备按钮不改生命或状态。');
    }
    // Production transient card overrides preserve the real game, session and UI.
    runtime.cardOverrides.set(uid, card);
    if (kind.startsWith('unsupported-')) {
      const other = snap.hand.find(handUid => handUid !== uid);
      runtime.cardOverrides.set(other, {
        id: 'e7-support', name: kind === 'unsupported-onPlay' ? 'E7 支付牌' : 'E7 燃料牌', type: '法术', cost: 0, desc: '',
      });
    }
    battle.commands.refreshView();
    const before = await resources();
    sessionStorage.setItem(battleKey, JSON.stringify({ kind, uid, card, before }));
    ctx.record('e6-rule-prepared', {
      kind, uid, card, capability, before,
      classification: '在真实战斗内覆盖测试手牌；非自然卡库抽取；尚未出牌',
      source: kind === 'legacy' ? '生产Cards.STARTERS中的应急绷带原定义' : '合成规则能力门样本',
      next: kind === 'unsupported-beginInfuse' ? `点击主页面“${card.name}”的注能角标，再点“E6 记录出牌结果”。` :
        `点击主页面手牌“${card.name}”完成真实出牌，再点“E6 记录出牌结果”。`,
      expected: kind.startsWith('unsupported-') || kind === 'invalid' ? '明确拒绝；全部资源不变；不弹支付/注能选择。' :
        kind === 'supported' ? '扣1能量，金币依次+3、+5，不能按描述+99。' : '真实无rules应急绷带：0能量费用、生命+2、登记played。',
    });
  }
  for (const [kind, label] of [
    ['unsupported-onPlay', 'E6 准备未支持支付门'], ['unsupported-beginInfuse', 'E6 准备未支持注能入口'],
    ['invalid', 'E6 准备非法规则牌'], ['supported', 'E6 准备合法结构化牌'], ['legacy', 'E6 准备legacy应急绷带'],
  ]) {
    add(`e6-${kind}`, label, () => inject(kind));
  }
  add('e6-capture', 'E6 记录出牌结果', async () => {
    const saved = JSON.parse(sessionStorage.getItem(battleKey) || 'null');
    if (!saved) throw new Error('尚未准备E6手牌样本。');
    const snap = ctx.getSDT().Battle?.getSnapshot();
    if (!ctx.getGame().battleActive || !snap) throw new Error('样本战斗已结束；不可把下一场结果归给本样本。');
    const after = await resources();
    if (after.battleToken !== saved.before.battleToken) throw new Error('战斗归属已变化，请保留记录并重新准备样本。');
    ctx.record('e6-rule-observation', {
      ...saved, after, resourcesUnchanged: JSON.stringify(after) === JSON.stringify(saved.before),
      coinDelta: after.coins - saved.before.coins, energyDelta: after.energy - saved.before.energy,
      hpDelta: after.hp - saved.before.hp,
      pending: { busy: snap.busy, queue: snap.actionQueueLength, handSelecting: !!snap.handSelecting,
        infusing: !!snap.infusing, target: !!snap.pendingTarget },
      logText: logText(),
      boundary: '此按钮只观察；需结合真实点击证据和页面提示判断，准备后未点击时资源相同不能算拒绝通过。',
    });
  });
}
