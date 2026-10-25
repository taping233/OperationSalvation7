/** Historical battle identities only. No catalog/runtime lookup belongs here.
 * Callers retain their existing structured-authority gates: some old paths test
 * array declarations, others use execution ownership (including builtin rules).
 * Name-based text contracts intentionally remain distinct from library identity.
 */
export const isStarterAttackIdentity = card => !!card && (card.id === 'starter-attack' || (!card.id && card.name === '初始攻击'));
export const isStarterAttackTextName = card => card?.name === '初始攻击' || card?.name === '杀';
export const matchesStarterAttackCostName = card => /^(杀|初始攻击)$/.test(card.name || '');
export const isStarterAttackPoolMember = (card, starterId = 'starter-attack') => card.id === starterId || isStarterAttackTextName(card);
export const isArrowRuneCard = card => card.name === '箭' || card.id === 'token-arrow';

export const isLegacyRotSeed = card => card?.id === 'cc-rot-seed';
export const usesNonLethalDamage = card => !!card?._cardDamagePolicy?.nonLethal
  || card?.id === 'tt13-mercy' && !Array.isArray(card.rules?.triggers?.onPlay);
export const doublesLegacyBleed = card => card?.id === 'tt3-fly-arrowhawk' || /流血伤害翻倍/.test(String(card?.desc || ''));
export const hasLegacySealUnlock = card => !!card && !card.rules?.equip?.passive
  && (card.id === 'tt3-element-seal' || card.rules?.battle?.hosted?.includes('element-seal'));
export const hasLegacyStealthBreakBonus = card => card.id === 'tt7-ghostblade'
  && card.rules?.battle?.hosted?.includes('stealth-break-bonus') === true;
export const isLegacyBloodpoison = card => card.id === 'tt7-bloodpoison';
export const isLegacyEmergencySupply = card => card.id === 'cmtn1wnhhym';
export const isLegacySearchChest = card => card.id === 'cmtn28jv33wx';
export const isLegacySearchChestOperation = (card, operation) => isLegacySearchChest(card) && operation.n === 3
  && operation.pool?.kind === '随机' && operation.dest === 'hand' && operation.act === undefined && operation.filter === undefined;
export const legacyDeckBottomCandidateCount = (card, count) => card.id === 'tt3-dig-treasure' ? 3 : count;
export const repeatsLegacyTurnStart = card => card.id === 'cmtn7err0a7';
export const legacyTurnStartDescription = (card, desc) => repeatsLegacyTurnStart(card)
  ? desc.replace(/（[^）]*从这些中随机[^）]*）|祝福包括[^。]*(?:。|$)/g, '') : desc;
export const hasLegacyManaSurge = card => card.id === 'cc-mana-surge'
  || card.rules?.battle?.hosted?.includes('mana-surge') || /法力奔涌/.test(String(card.name || ''));
export const isLegacyProvoke = card => card?.id === 'tt7-provoke' && !Array.isArray(card.rules?.triggers?.onPlay);
export const hasLegacyMindControlTarget = card => card?.id === 'tt13-mind-control' && !Array.isArray(card.rules?.triggers?.onPlay);
export const isLegacyScaleArmor = card => card.id === 'tt13-scale-armor';
export const isLegacyAstrolabe = card => card.id === 'tt13-astrolabe';
export const isLegacySealedHero = card => card?.id === 'tt8-hero-sealer';
export const isLegacyCatGift = card => card?.id === 'tt2-apollo';
// Display admission and actual transformation historically have different owners.
export const needsLegacyImitateSource = (card, builtinOwns) => (!builtinOwns && card.id === 'tt7-imitate')
  || card.rules?.battle?.hosted?.includes('imitate');
export const hasLegacyImitateTransform = (card, ownsOnPlay) => !ownsOnPlay
  && (card?.id === 'tt7-imitate' || card?.rules?.battle?.hosted?.includes('imitate'));
