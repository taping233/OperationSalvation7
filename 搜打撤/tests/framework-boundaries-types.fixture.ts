import { createShopCommands, applyCommissionDiscount } from '../game/src/run/shop-commands.js';
import { createEventCommands, settleEventCommand } from '../game/src/run/event-commands.js';
import { triggerExecutionPlan, equipmentExecutionPlan, cardPlayExecutionPlan, createCardRuleExecutionView } from '../game/src/cards/card-execution-plan.js';
import type { ShopPorts, EventPorts, EventSettlementInput } from '../game/src/run/run-domain-commands.types';
import type { ExecutionCard } from '../game/src/cards/card-execution-plan.types';

const card = { id:'test', name:'测试', type:'法术' };
const slot = { card, price:2 };
const shopPorts: ShopPorts = { state:{ coins:5, ownedCards:[], shopStock:[slot] },
  canReceive: () => true, newUid: () => 'owned-1', isSellable: () => true, sellPrice: () => 1, save: () => true };
const shop = createShopCommands(shopPorts);
const result = await shop.buy({ index:0, quote:{ slot, card, price:2, replenish:false } });
if (result.ok) { const price:number = result.price; const saved:boolean = result.saved; void [price, saved]; }
else { const reason:string = result.reason; void reason; }
// @ts-expect-error UID factories must return strings.
createShopCommands({ ...shopPorts, newUid: () => 42 });
// @ts-expect-error Price callbacks must return numeric prices.
createShopCommands({ ...shopPorts, sellPrice: () => '2' });
// @ts-expect-error Quote price and index are numeric, not strings.
shop.buy({ index:'0', quote:{ slot, card, price:'2', replenish:false } });
// @ts-expect-error Sell commands require an owned identity and its original card.
shop.sell({ uid:'owned-1', quote:{ card } });
// @ts-expect-error Commission drafts retain numeric slot indexes.
applyCommissionDiscount({ stock:[slot], pending:{ status:'pending', slots:['0'] }, quotes:[{ slot, card }], current:() => true, save:() => true });
// @ts-expect-error Successful trade fields are inaccessible before narrowing the rejection.
const unconditionalPrice:number = result.price;
void unconditionalPrice;

const eventPorts:EventPorts = { state:{ coins:1, hp:10, maxHp:10, layerIdx:0, trackPos:0, ownedCards:[] },
  grantCard: (_card, options) => options.silent };
const events = createEventCommands(eventPorts);
const spent:boolean = events.spendCoins(1, { current: () => true, receipt:{}, field:'paid' });
const claimed:boolean = events.claimCard(card);
void [spent, claimed];
events.recode([{ uid:'owned-1', card }], [card], [{ uid:'owned-1', id:'test' }], () => [card]);
// @ts-expect-error Resource amounts are numbers.
events.reinforceLife('10');
// @ts-expect-error Current-page predicates must return boolean.
events.spendCoins(1, { current: () => 'yes' });
// @ts-expect-error Recode eligibility returns cards, not card IDs.
events.recode([{ uid:'owned-1', card }], [card], undefined, () => ['test']);
// @ts-expect-error Claim requires a complete choice receipt.
events.claimChoice({ key:'0,0', index:0, card, current:() => true });
const settlement: EventSettlementInput = { state:eventPorts.state, record:{}, settling:new WeakSet(), run:() => true, consumeCell:() => undefined };
const settled:boolean = settleEventCommand(settlement);
void settled;
// @ts-expect-error A settlement port serializes the location snapshot, not a string.
settleEventCommand({ ...settlement, serializeReward: () => 'saved' });

const ruleCard:ExecutionCard = { ...card, rules:{ triggers:{ onPlay:[{ op:'heal', amountField:'heal' }] }, equip:{ skill:{ ops:[] } } } };
const plan = cardPlayExecutionPlan(ruleCard);
const structured:boolean = plan.suppressImmediateText;
void structured;
triggerExecutionPlan(ruleCard, 'onTurnStart');
equipmentExecutionPlan(ruleCard, 'skill');
createCardRuleExecutionView(ruleCard, [{ op:'damage', target:'chosenEnemy', amount:3 }]);
// @ts-expect-error Unknown trigger points cannot claim structured ownership.
triggerExecutionPlan(ruleCard, 'onTypo');
// @ts-expect-error Equipment ownership has a separate set of execution points.
equipmentExecutionPlan(ruleCard, 'onPlay');
// @ts-expect-error Only numeric card fields can own amountField.
plan.ownsField('desc');
// @ts-expect-error Typed execution plans use the existing rule vocabulary.
triggerExecutionPlan({ rules:{ triggers:{ onPlay:[{ op:'typo' }] } } }, 'onPlay');
// The unvalidated execution view deliberately accepts malformed declarations for schema preflight.
createCardRuleExecutionView({}, [{ op:'typo' }]);
// @ts-expect-error Equipment skills hold an ops container, not a naked operation list.
equipmentExecutionPlan({ rules:{ equip:{ skill:[] } } }, 'skill');
// Whole-card replay and passive equipment are declaration containers, not operation lists.
const replayAndPassive:ExecutionCard = { rules:{ triggers:{ replay:{ on:'lastHand', times:2 } },
  equip:{ passive:{ heroSkillCost:{maxHand:3,cost:0},damageResponse:{damage:1,drawChance:0.5,draw:1},
    alternatingRefund:{types:['武术','法术'],amount:1},infusionUnlock:{fuel:3,spellPower:2,draw:1} } } } };
const passivePlan = cardPlayExecutionPlan(replayAndPassive).equipment('passive');
void passivePlan.kind;
// @ts-expect-error A replay declaration has an explicit lastHand trigger condition.
const invalidReplay:ExecutionCard = {rules:{triggers:{replay:{on:'typo',times:2}}}};
// @ts-expect-error heroSkillCost stores maxHand/cost, not an operation amount field.
const invalidPassive:ExecutionCard = {rules:{equip:{passive:{heroSkillCost:{amount:2}}}}};
void [invalidReplay,invalidPassive];
