export type BattleOperationName = 'damage' | 'heal' | 'armor' | 'draw' | 'status' | 'discover'
  | 'curse' | 'acquire' | 'coins' | 'blessing' | 'energy' | 'refillEnergy' | 'energyCap' | 'maxHp' | 'deckCap' | 'cleanse'
  | 'stealAtk' | 'noDrawNext' | 'extraTurn' | 'execute' | 'summon' | 'registerRule' | 'transform'
  | 'foeFight' | 'copyRandom' | 'adjustCurse' | 'restoreHeroSkill' | 'recruitEnemy'
  | 'insertCards' | 'fillHand' | 'castRandomSpells' | 'equipCapacity' | 'release' | 'consumeHand'
  | 'handSelect' | 'swapDiscoverCosts' | 'markEnemy' | 'schedule' | 'castDrawn' | 'castStored'
  | 'registerInfusionBonus' | 'transformCards' | 'choice' | 'randomCurse' | 'randomBlessing' | 'freezeFirstEnemies' | 'discoverCopies';
export type OperationTarget = 'chosenEnemy' | 'allEnemies' | 'randomEnemy' | 'self' | 'allAllies';
export type AcquireDestination = 'hand' | 'deck' | 'discover';
export type AcquireAction = 'play' | 'playKeep' | 'dup' | 'zeroCost' | 'costMinusOne' | 'decay' | 'noInfuse';
export type HostedBattleRuleName = 'imitate' | 'mana-surge' | 'rot-seed' | 'charge-fireball'
  | 'pouch-container' | 'pearl-container' | 'venom-staff' | 'element-seal' | 'cost-swap'
  | 'dark-fort' | 'nature-staff' | 'ranger-chain' | 'sovereign' | 'assassin'
  | 'consume-fireball' | 'seal-chain' | 'gate-choices' | 'kill-transform' | 'mystery-potion'
  | 'guardian' | 'mage' | 'priest' | 'ranger' | 'sword' | 'warlock'
  | 'frost-sword' | 'crimson-pouch' | 'fate-wheel' | 'boiler' | 'azure-sword' | 'chaos-eye'
  | 'immortal-blade' | 'master-staff' | 'silver-runesword' | 'sapper-bomb' | 'wolf-bow'
  | 'reverse-bow' | 'twinwater-mail' | 'temporary-hand-cards' | 'keep-self-in-hand'
  | 'bleed-gated-armor-break' | 'choose-and-cast-melee' | 'draw-and-price-damage'
  | 'double-target-poison-daggers' | 'stealth-break-bonus' | 'last-hand-repeat-all'
  | 'burst-existing-poison' | 'infused-immune-spell' | 'untouched-target-freeze' | 'infused-ray'
  | 'three-choice-lamp' | 'infused-price-heal' | 'infused-fireball-burst'
  | 'infused-repeating-lifesteal' | 'double-and-burst-poison' | 'infused-damage-bonus'
  | 'class-ability-acquire' | 'delayed-heal-item' | 'damage-and-draw' | 'foe-fight-select';
export interface CardRuleIssue { readonly cardId: string; readonly path: string; readonly message: string }
/** supported means the battle-entry capability check passed, not every game domain is implemented. */
export type CardRuleCapability =
  | { readonly kind: 'legacy' | 'supported'; readonly ok: true }
  | { readonly kind: 'invalid' | 'unsupported'; readonly ok: false; readonly issues: readonly CardRuleIssue[] };
export interface RuleWarningPort { warn(message: string): void }
