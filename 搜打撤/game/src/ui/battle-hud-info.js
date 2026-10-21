import { escAttr } from '../core/shared.js';
import '../../css/battle-hud-clarity.css';

export function playerCombatStatsHTML(player, pdef, status) {
  const atkBuff = status.atkUp || 0, spellBuff = status.spellUp || 0;
  const atk = (player.atk || 0) + atkBuff;
  const spell = (player.spellPower || 0) + spellBuff;
  const stat = (label, icon, value, detail) => `<span class="sts-stat" tabindex="0" data-ui-tip data-ui-tip-title="${label}" data-ui-tip-text="${escAttr(detail)}">[[icon:${icon}]] ${label} ${value}</span>`;
  return stat('攻', 'swords', atk, `基础攻击 ${player.atk || 0}${atkBuff ? `，攻击强化 +${atkBuff}` : ''}`)
    + (spell > 0 ? stat('法伤', 'crystal', spell, `基础法伤 ${player.spellPower || 0}${spellBuff ? `，法术强化 +${spellBuff}` : ''}`) : '')
    + (pdef.shield ? `<span class="sts-stat">[[icon:shield]] 盾 ${pdef.shield}</span>` : '')
    + (pdef.guard ? '<span class="sts-stat">格挡中</span>' : '');
}

export function turnForecastHTML(forecast) {
  return `<p class="bt-turn-forecast${forecast.lethal ? ' lethal' : ''}" tabindex="0" aria-live="polite" data-ui-tip data-ui-tip-title="承伤估算" data-ui-tip-text="${escAttr(forecast.note)}"><span class="bt-forecast-damage">估算承伤 <b>${forecast.damage}</b></span><span class="bt-forecast-hp">余 <b>${forecast.hpAfter}</b> 生命</span>${forecast.lethal ? '<span class="bt-forecast-warning">可能致死</span>' : ''}</p>`;
}
