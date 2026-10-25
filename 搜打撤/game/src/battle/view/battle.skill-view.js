import { esc, escAttr } from '../../core/shared.js';

const SKILL_ART = Object.freeze({
  fixed:new URL('../../../assets/ui/battle-controls-glass-1016/fixed.webp', import.meta.url).href,
  attack:new URL('../../../assets/ui/battle-controls-glass-1016/attack.webp', import.meta.url).href,
  acquire:new URL('../../../assets/ui/battle-controls-glass-1016/acquire.webp', import.meta.url).href,
  fireball:new URL('../../../assets/ui/battle-controls-glass-1016/fireball.webp', import.meta.url).href,
  heal:new URL('../../../assets/ui/battle-controls-glass-1016/heal.webp', import.meta.url).href,
  spell:new URL('../../../assets/ui/battle-controls-glass-1016/spell.webp', import.meta.url).href,
});

// One icon is the action; the complete explanation is only exposed on hover/focus.
export function careerSkillButtonHTML({ skill, state, availability, effect, disabled }) {
  const mark = state === 'used' ? '✓' : state === 'targeting' ? '◎' : '';
  const label = `${skill.name}，${skill.cost}费，${availability}，${effect}；每回合一次`;
  return `<span class="ui-tip-anchor battle-skill-help" data-ui-tip data-ui-tip-title="${escAttr(skill.name)}" data-ui-tip-text="${escAttr(skill.hint || effect)}"${disabled ? ` tabindex="0" role="group" aria-label="${escAttr(`${skill.name}，${availability}，技能说明`)}"` : ''}>
    <button type="button" class="bt-slam-btn${state === 'targeting' ? ' active' : ''}" data-act="btSlam" data-skill-state="${escAttr(state)}"
    aria-label="${escAttr(label)}"${disabled ? ' disabled' : ''}>
    <img class="battle-skill-art" src="${escAttr(SKILL_ART[skill.kind] || SKILL_ART.attack)}" alt="" draggable="false" decoding="async">
    <span class="battle-skill-fee" aria-hidden="true">${esc(String(skill.cost))}</span>
    ${mark ? `<span class="battle-skill-mark" aria-hidden="true">${mark}</span>` : ''}
    </button>
  </span>`;
}
