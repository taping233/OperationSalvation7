import { escAttr } from '../core/shared.js';
import '../../css/battle-equipment.css';

export function equipmentInfoHTML(equipment, busy = false) {
  const e = equipment;
  const disabled = busy || e.used;
  const note = e.skill ? (e.used ? '主动技能本场已用过' : busy ? '行动结算中，暂不可发动' : '点击发动主动技能') : '被动装备';
  const description = e.skill && !(e.desc || '').includes(e.skill)
    ? [e.desc, `主动技能：${e.skill}`].filter(Boolean).join('；') : e.desc || '';
  const tip = `data-ui-tip data-ui-tip-title="${escAttr(e.name)}" data-ui-tip-text="${escAttr(description)}" data-ui-tip-note="${escAttr(note)}"`;
  const state = !e.skill ? 'passive' : e.used ? 'used' : busy ? 'busy' : 'ready';
  const status = state === 'used' ? '已使用' : state === 'busy' ? '结算中' : state === 'ready' ? '可发动' : '被动';
  const image = e.card && window.SDT?.Art?.cardIcon ? window.SDT.Art.cardIcon(e.card, { low:true }) : '';
  const art = `<span class="sts-equip-art" aria-hidden="true">${image || '[[icon:tools]]'}</span>`;
  const marker = e.skill ? `<span class="sts-equip-state" aria-hidden="true">[[icon:${e.used ? 'check' : 'bolt'}]]</span>` : '';
  const label = escAttr(`${e.name}，${status}，${description || '查看完整说明'}`);
  if (!e.skill) return `<span class="sts-equip" data-equip-state="passive" tabindex="0" role="group" ${tip} aria-label="${label}">${art}</span>`;
  const button = `<button type="button" ${disabled ? 'class="sts-equip-disabled-action"' : 'class="sts-equip"'} data-equip-state="${state}" data-act="btEquipSkill" data-uid="${escAttr(e.uid)}" ${disabled ? 'disabled' : tip} aria-label="${label}">${art}${marker}</button>`;
  // A disabled native button cannot receive focus; its icon wrapper remains a
  // reading target while the original action stays disabled.
  return disabled ? `<span class="sts-equip" data-equip-state="${state}" tabindex="0" role="group" ${tip} aria-label="${label}">${button}</span>` : button;
}
