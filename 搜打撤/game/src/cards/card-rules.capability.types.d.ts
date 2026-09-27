export type BattleOperationName = 'damage' | 'heal' | 'armor' | 'draw' | 'status' | 'discover'
  | 'curse' | 'acquire' | 'coins' | 'blessing' | 'energy' | 'energyCap' | 'maxHp' | 'deckCap';
export type OperationTarget = 'chosenEnemy' | 'allEnemies' | 'randomEnemy' | 'self';
export type AcquireDestination = 'hand' | 'deck' | 'discover';
export type AcquireAction = 'play' | 'playKeep' | 'dup' | 'zeroCost' | 'decay' | 'noInfuse';
export interface CardRuleIssue { readonly cardId: string; readonly path: string; readonly message: string }
/** supported means the battle-entry capability check passed, not every game domain is implemented. */
export type CardRuleCapability =
  | { readonly kind: 'legacy' | 'supported'; readonly ok: true }
  | { readonly kind: 'invalid' | 'unsupported'; readonly ok: false; readonly issues: readonly CardRuleIssue[] };
export interface RuleWarningPort { warn(message: string): void }
