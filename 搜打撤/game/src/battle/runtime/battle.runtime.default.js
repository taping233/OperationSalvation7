import { createBattleRuntime } from './battle.runtime.factory.js';
import * as combat from '../core/combat.js';

export const defaultBattleRuntime = createBattleRuntime({ combat });
