import { escAttr } from '../core/shared.js';
import { currentCardDescription } from '../cards/card-state-presentation.js';
import { displayCardDescription } from '../cards/card-description-text.js';
import '../../css/battle-equipment.css';

export function equipmentInfoHTML(equipment, busy = false, snapshot = null) {
  const e = equipment;
  // Older previews omit the domain projection and retain their existing state.
  const availability = e.skillAvailability || {
    usable: !!e.skill && !busy && !e.used,
    state: !e.skill ? 'passive' : e.used ? 'used' : busy ? 'busy' : 'ready',
    why: e.skill ? (e.used ? '主动技能本场已用过' : busy ? '行动结算中，暂不可发动' : '') : '被动装备',
  };
  const { state } = availability;
  const disabled = !availability.usable;
  const note = availability.why || (state === 'ready' ? '点击发动主动技能' : state === 'passive' ? '被动装备' : '暂不可发动主动技能');
  const baseDescription = displayCardDescription(e.desc || '', e.card?.id, e.card);
  const skillDescription = e.skill && !(e.desc || '').includes(e.skill)
    ? [baseDescription, `主动技能：${e.skill}`].filter(Boolean).join('；') : baseDescription;
  const description = currentCardDescription(skillDescription, e.card, e.uid, snapshot ? { snapshot } : null);
  const tip = `data-ui-tip data-ui-tip-title="${escAttr(e.name)}" data-ui-tip-text="${escAttr(description)}" data-ui-tip-note="${escAttr(note)}"`;
  const status = { used:'已使用', busy:'结算中', ready:'可发动', passive:'被动', unavailable:'条件不足' }[state];
  const image = e.card && window.SDT?.Art?.cardIcon ? window.SDT.Art.cardIcon(e.card, { low:true }) : '';
  const art = `<span class="sts-equip-art" aria-hidden="true">${image || '[[icon:tools]]'}</span>`;
  const marker = state !== 'passive' ? `<span class="sts-equip-state" aria-hidden="true">[[icon:${state === 'used' ? 'check' : 'bolt'}]]</span>` : '';
  const label = escAttr(`${e.name}，${status}，${note}，${description || '查看完整说明'}`);
  if (state === 'passive') return `<span class="sts-equip" data-equip-state="passive" tabindex="0" role="group" ${tip} aria-label="${label}">${art}</span>`;
  const button = `<button type="button" ${disabled ? 'class="sts-equip-disabled-action"' : 'class="sts-equip"'} data-equip-state="${state}" data-act="btEquipSkill" data-uid="${escAttr(e.uid)}" ${disabled ? 'disabled' : tip} aria-label="${label}">${art}${marker}</button>`;
  // A disabled native button cannot receive focus; its icon wrapper remains a
  // reading target while the original action stays disabled.
  return disabled ? `<span class="sts-equip" data-equip-state="${state}" tabindex="0" role="group" ${tip} aria-label="${label}">${button}</span>` : button;
}
