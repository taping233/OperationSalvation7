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
export type TriggerDeclarations = Partial<{ [point in TriggerPoint]: ExecutionOperation[] }> & { duration?: number };
export type EquipmentDeclarations = {
  onEquip?: ExecutionOperation[];
  battleStart?: ExecutionOperation[];
  skill?: { ops?: ExecutionOperation[] };
};
export type ExecutionCard = Omit<CardSnapshot, 'rules'> & {
  id?: string; type?: string; dmgType?: string; dmg?:number; heal?:number; armor?:number; draw?:number;
  _registeredTriggers?: TriggerDeclarations;
  rules?: {
    version?: number;
    triggers?: TriggerDeclarations;
    equip?: EquipmentDeclarations;
    battle?: { hosted?: HostedBattleRuleName[]; ignoresSilence?: true; target?: { side: 'enemy' | 'self' | null; area:boolean } };
    bag?: unknown;
  };
};
export type ExecutionPlan = { kind:'structured' | 'text'; ops:ExecutionOperation[] | undefined };
