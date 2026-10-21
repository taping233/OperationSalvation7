import type { CardSnapshot } from './game.store.types';
export interface Preset { id?: string; name?: string; characterId?: string; petId?: string; picks?: {card: {cardId: string; variantKey?: string}; count: number}[] }
export interface PreparationBase { stash?: {card: CardSnapshot; count: number; variantKey?: string}[]; characters?: Record<string, unknown>; pets?: Record<string, unknown>; petSel?: string }
export interface Pet { id: string; name?: string; effect?: {extraSha?: number; shaToFireball?: boolean} }
export interface PreviewOptions {baseSnapshot?: PreparationBase; preset?: Preset; mode?: string; cardCatalog?: CardSnapshot[]; characters?: {id:string; name?:string}[]; pets?: Pet[]; bagCapacity?: number; starterCount?: number; starterCard?: CardSnapshot}
export interface IntentPayload { presetId?: string; targetId?: string; field?: string; value?: string; cardId?: string; count?: number }
export interface Intent {type: string; payload: IntentPayload}
export interface Preparation {tracked: string[]; presets: Preset[]}
export interface ViewOptions extends Omit<PreviewOptions,'preset'> {preparation?: Preparation; catalogVersion?: string; busy?: boolean; error?: string}
