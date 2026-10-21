import type { CardSnapshot } from '../hub/game.store.types';
import type { BattleOperationName, OperationTarget, HostedBattleRuleName } from './card-rules.capability.types';

export type TriggerPoint = 'onPlay' | 'onAcquire' | 'onDraw' | 'onConsume' | 'onTurnStart' | 'onTurnEnd'
  | 'onBattleStart' | 'onKill' | 'onDamaged' | 'onPlayCard' | 'onFreezeDealt';
export type EquipmentPoint = 'onEquip' | 'battleStart' | 'skill';
export type NumericCardField = 'dmg' | 'heal' | 'armor' | 'draw';
export interface ExecutionOperation {
  op: BattleOperationName;
  amount?: number;
  amountField?: NumericCardField;
  target?: OperationTarget;
  [parameter: string]: unknown;
}
export type TriggerDeclarations<TOperation = ExecutionOperation> = Partial<{ [point in TriggerPoint]: TOperation[] }> & { duration?: number; replay?: { on: 'lastHand'; times: number } };
export type EquipmentDeclarations<TOperation = ExecutionOperation> = {
  passive?: { aura?: { atk?: number; spellPower?: number; deckCap?: number; focus?: number }; cond?: { hasCurse?: true; vsFreeze?: number }; heroSkillCost?: { maxHand: number; cost: number }; damageResponse?: { damage: number; drawChance: number; draw: number }; alternatingRefund?: { types: ('武术' | '法术')[]; amount: number }; infusionUnlock?: { fuel: number; spellPower: number; draw: number } };
  onEquip?: TOperation[];
  battleStart?: TOperation[];
  skill?: { ops?: TOperation[] };
};
export type ExecutionCard<TOperation = ExecutionOperation> = Omit<CardSnapshot, 'rules'> & {
  id?: string; type?: string; dmgType?: string; dmg?:number; heal?:number; armor?:number; draw?:number;
  _registeredTriggers?: TriggerDeclarations<TOperation>;
  rules?: {
    version?: number;
    triggers?: TriggerDeclarations<TOperation>;
    equip?: EquipmentDeclarations<TOperation>;
    battle?: { requirements?:{kind?:string,count?:unknown,type?:string}[]; hosted?: HostedBattleRuleName[]; ignoresSilence?: true; target?: { side: 'enemy' | 'self' | null; area:boolean } };
    bag?: unknown;
  };
};
export type ExecutionPlan<TOperation = ExecutionOperation> = { kind:'structured' | 'text'; ops:TOperation[] | undefined };
