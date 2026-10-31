import { recodeSourceMatches } from './event-recode-candidates.js';

// The application supplies existing coin modifiers, damage/terminal handling and
// card admission. These ports retain their rules without importing the facade.
/** @param {import('./run-domain-commands.types').EventPorts} ports */
export function createEventCommands({ state, gainCoins, heal, damage, grantCard, canRecode }) {
  let executing = false;
  /** @param {() => boolean} run */
  const guarded = run => {
    if (executing) return false;
    executing = true;
    try { return run(); } finally { executing = false; }
  };
  /** @param {number} amount @param {import('./run-domain-commands.types').SpendInput} [options] */
  function spendCoins(amount, { current = () => true, receipt, field, value = true } = {}) {
    return guarded(() => {
      if (!current() || !Number.isFinite(amount) || amount < 0) return false;
      if (receipt && field && Object.hasOwn(receipt, field) && receipt[field] === value) return true;
      if (!Number.isFinite(state.coins) || state.coins < amount) return false;
      state.coins -= amount;
      if (receipt && field) receipt[field] = value;
      return true;
    });
  }
  /** @param {import('./run-domain-commands.types').RunCard | null | undefined} card */
  function claimCard(card) {
    return guarded(() => {
      if (!card || !grantCard) return false;
      const previous = new Set(state.ownedCards);
      let granted = false;
      try { granted = grantCard(card, { silent:true }) === true; }
      catch { /* Admission can succeed before a presentation port throws. */ }
      return granted || state.ownedCards.some(entry => !previous.has(entry) && entry.card?.id === card.id);
    });
  }
  /**
   * @param {import('./run-domain-commands.types').RunOwnedCard[]} entries
   * @param {import('./run-domain-commands.types').RunCard[]} cards
   * @param {import('./run-domain-commands.types').RecodeSource[] | undefined} sources
   * @param {(card:import('./run-domain-commands.types').RunCard) => import('./run-domain-commands.types').RunCard[]} eligible
   */
  function recode(entries, cards, sources, eligible) {
    return guarded(() => {
      if (!entries.length || entries.length !== cards.length || new Set(entries).size !== entries.length
        || entries.some((entry, i) => !state.ownedCards.includes(entry) || !recodeSourceMatches(entry, sources?.[i])
          || !cards[i] || !eligible(entry.card).some(candidate => candidate.id === cards[i].id))) return false;
      if (canRecode && !canRecode(entries, cards)) return false;
      const replacements = cards.map(card => ({ ...card }));
      entries.forEach((entry, i) => { entry.card = replacements[i]; });
      return true;
    });
  }
  return {
    spendCoins, claimCard, recode,
    /** @param {import('./run-domain-commands.types').ChoiceInput} input */
    claimChoice:({ record, key, index, card, current }) => {
      if (!current() || state.nodeRewards?.[key] !== record || record.taken !== null
        || !Number.isInteger(index) || !card || record.cardIds[index] !== card.id) return false;
      record.taken = index;
      if (claimCard(card)) return true;
      record.taken = null;
      return false;
    },
    /** @param {number} amount */
    gainCoins:amount => gainCoins?.(amount),
    /** @param {number} amount */
    heal:amount => heal?.(amount),
    /** @param {number} amount @param {string} reason */
    damage:(amount, reason) => damage?.(amount, reason),
    gainFragment:() => { state.fragments = (state.fragments || 0) + 1; },
    /** @param {number} amount */
    reinforceLife:amount => {
      if (!Number.isFinite(amount) || amount < 0 || !Number.isFinite(state.hp) || !Number.isFinite(state.maxHp)) return false;
      Object.assign(state, { maxHp:state.maxHp + amount, hp:state.hp + amount });
      return true;
    },
    /** @param {number} amount */
    sacrificeLife:amount => {
      if (!Number.isFinite(amount) || amount < 0 || !Number.isFinite(state.hp)) return false;
      state.hp = Math.max(1, state.hp - amount);
      return true;
    },
  };
}

// Reserve the node before invoking reward admission, then keep any completed
// resource/card/reward handoff even if its presentation throws. Rejected work
// restores only reservation metadata; it never rewinds an accepted reward.
/** @param {import('./run-domain-commands.types').EventSettlementInput} input */
export function settleEventCommand({ state, record, settling, run, consume = true, consumeCell, serializeReward }) {
  if (!record || record.settled || settling.has(record)) return false;
  const key = `${state.layerIdx},${state.trackPos}`;
  const visited = state.visited || (state.visited = {});
  const hadVisited = Object.prototype.hasOwnProperty.call(visited, key), previousVisited = visited[key];
  const hadSettled = Object.prototype.hasOwnProperty.call(record, 'settled'), previousSettled = record.settled;
  const hadChoice = Object.prototype.hasOwnProperty.call(record, 'actionChoice'), previousChoice = record.actionChoice;
  /** @type {('coins' | 'fragments' | 'hp' | 'maxHp')[]} */
  const resourceKeys = ['coins', 'fragments', 'hp', 'maxHp'];
  const beforeResources = resourceKeys.map(name => state[name]);
  const beforeCards = new Map(state.ownedCards.map(entry => [entry, entry.card]));
  let beforeReward = null;
  try { beforeReward = serializeReward?.(state); } catch { /* 承接事实在执行后单独核验。 */ }
  settling.add(record);
  try {
    // 奖励页可能在 run 内先保存待领快照；该首份快照必须同时持有事件完成凭据。
    record.settled = true;
    delete record.actionChoice;
    if (consume) consumeCell();
    let result, failure;
    try { result = run(); }
    catch (error) { failure = error; }
    let reward = null;
    try { reward = serializeReward?.(state); } catch { /* 未确认的承接不能当作成功。 */ }
    const adopted = reward && reward.seed === state.seed && reward.layerIdx === state.layerIdx
      && reward.trackPos === state.trackPos && JSON.stringify(reward) !== JSON.stringify(beforeReward);
    const granted = resourceKeys.some((name, i) => state[name] !== beforeResources[i])
      || state.ownedCards.some(entry => !beforeCards.has(entry) || beforeCards.get(entry) !== entry.card);
    if ((result === false || failure) && !adopted && !granted) {
      if (hadSettled) record.settled = previousSettled;
      else delete record.settled;
      if (hadChoice) record.actionChoice = previousChoice;
      else delete record.actionChoice;
      if (state.visited === visited) {
        if (hadVisited) visited[key] = previousVisited;
        else delete visited[key];
      }
      if (failure) console.warn('[event] 结算未完成，保留当前选择', failure);
      return false;
    }
    return true;
  } finally { settling.delete(record); }
}
