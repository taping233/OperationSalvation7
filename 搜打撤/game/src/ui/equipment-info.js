import { esc, escAttr } from '../core/shared.js';

export function equipmentInfoHTML(equipment, busy = false) {
  const e = equipment;
  const disabled = busy || e.used;
  const note = e.skill ? (e.used ? '主动技能本场已用过' : busy ? '行动结算中，暂不可发动' : '点击发动主动技能') : '';
  const description = e.skill && !(e.desc || '').includes(e.skill)
    ? [e.desc, `主动技能：${e.skill}`].filter(Boolean).join('；') : e.desc || '';
  const tip = `data-ui-tip data-ui-tip-title="${escAttr(e.name)}" data-ui-tip-text="${escAttr(description)}" data-ui-tip-note="${escAttr(note)}"`;
  if (!e.skill) return `<span class="sts-equip" tabindex="0" ${tip}>[[icon:tools]] ${esc(e.name)}</span>`;
  const button = `<button class="sts-equip has-skill${e.used ? ' used' : ''}" data-act="btEquipSkill" data-uid="${escAttr(e.uid)}" ${disabled ? 'disabled' : tip} aria-label="${escAttr(e.name)}主动技能：${escAttr(e.skill)}${e.used ? '，本场已使用' : ''}">[[icon:tools]] ${esc(e.name)}${e.used ? '' : ' [[icon:bolt]]'}</button>`;
  // Disabled actions remain disabled; a separate focus target exposes their rules.
  return disabled ? `<span tabindex="0" ${tip}>${button}</span>` : button;
}
