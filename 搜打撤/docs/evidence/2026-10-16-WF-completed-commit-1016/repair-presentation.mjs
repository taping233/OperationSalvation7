import fs from 'node:fs';
function edit(file, replacements) {
  let text = fs.readFileSync(file, 'utf8').replaceAll('\r\n','\n');
  for (const [before, after] of replacements) {
    if (!text.includes(before)) throw Error(file + ': ' + before);
    text = text.replaceAll(before, after);
  }
  fs.writeFileSync(file, text);
}
edit('tests/battle-hand-inspector.test.js', [
  ["expect(Aim.clickSelectedUid).toBe('inspect-card');\n  expect(document.querySelectorAll('.bt-hand-detail'))", "expect(Aim.aim?.uid).toBe('inspect-card'); expect(Aim.aim?.leftDown).toBe(false);\n  expect(document.querySelectorAll('.bt-hand-detail'))"],
  ["expect(Aim.aim).toBeNull();\n  expect(Aim.clickSelectedUid).toBe('inspect-card');\n  expect(card().classList.contains('click-selected')).toBe(true);", "expect(Aim.aim?.uid).toBe('inspect-card'); expect(Aim.aim?.leftDown).toBe(false);\n  expect(Aim.clickSelectedUid).toBeNull();\n  expect(card().classList.contains('aim-lift')).toBe(true);"],
  ["expect(stage().querySelector('#btSelf.can-target')).not.toBeNull();", "expect(BattleSession.getSnapshot().energy).toBe(before.energy);"],
  ["foldedSlot.click(); // Native click after the captured pointerup must not toggle it off.\n  expect(Aim.clickSelectedUid).toBe('inspect-card');", "foldedSlot.click(); // The release leaves this hand card following the pointer.\n  expect(Aim.aim?.uid).toBe('inspect-card');"],
  ["expect(enemy.querySelector('.sts-headrow>b').textContent).toBe(name);", "expect(enemy.getAttribute('aria-label')).toContain(name); expect(enemy.querySelector('.sts-headrow>b')).toBeNull();"],
  ["expect(skill.querySelector('.battle-skill-copy>b').textContent).toBe(name);", "expect(skill.closest('.battle-skill-help').dataset.uiTipTitle).toBe(name);"],
  ["expect(skill.querySelector('.battle-skill-cost>b').textContent).toBe(String(cost));", "expect(skill.querySelector('.battle-skill-fee').textContent).toBe(String(cost));"],
  ["expect(skill.querySelector('.battle-skill-cost>small').textContent).toBe('费');", "expect(skill.getAttribute('aria-label')).toContain(`${cost}费`);"],
  ["expect(skill.querySelector('.battle-skill-availability').textContent).toBe('可用');", "expect(skill.getAttribute('aria-label')).toContain('可用');"],
  ["expect(skill.querySelector('.battle-skill-status').textContent).toContain(effect);", "expect(skill.getAttribute('aria-label')).toContain(effect);"],
  ["expect(locked.querySelector('.battle-skill-availability').textContent).toBe(`差 ${cost} 费`);", "expect(locked.getAttribute('aria-label')).toContain(`差 ${cost} 费`);"],
  ["expect(locked.querySelector('.battle-skill-status').textContent).toContain(effect);", "expect(locked.getAttribute('aria-label')).toContain(effect);"],
  ["expect(stage().querySelector('.battle-skill-availability').textContent).toBe('选目标');", "expect(stage().querySelector('[data-act=btSlam]').getAttribute('aria-label')).toContain('选目标');"],
  ["expect(used.querySelector('.battle-skill-availability').textContent).toBe('已使用');", "expect(used.getAttribute('aria-label')).toContain('已使用');"],
  ["side === 'self' ? '自己，按 Enter 确认目标'", "side === 'self' ? '未选择人物，自己，按 Enter 确认目标'"],
  ["expect(head.querySelectorAll('img.ic')).toHaveLength(1);", "expect(head.querySelectorAll('img.ic')).toHaveLength(0);"],
  ["expect(head.querySelector('[data-asset-key=\"icon-cross\"]')).not.toBeNull();", "expect(stage().querySelector('.sts-foe').classList.contains('dead')).toBe(true);"],
]);
edit('tests/battle-tools-lifecycle.test.js', [
  ['expect(bagButton.disabled).toBe(true);\n    bagButton.click();', 'expect(bagButton).toBeNull();'],
  ["expect(skill().textContent).toContain('已使用')", "expect(skill().getAttribute('aria-label')).toContain('已使用')"],
  ["UI.el.ovBody.querySelector('[data-act=\"btDiscover\"][data-i=\"0\"]').click(); await settle();", "await new Promise(resolve => setTimeout(resolve, 360));\n    UI.el.ovBody.querySelector('[data-act=\"btDiscover\"][data-i=\"0\"]').click(); await settle();"],
]);
edit('tests/boot.test.js', [
  ['// Shift+Enter remains an explicit inspector shortcut; normal play needs no inspector button.', '// The full card is readable inline; Shift+Enter no longer opens a second inspector.'],
  ["key(face, 'Enter', { shiftKey: true });\n      expect(document.querySelector('.bt-hand-detail')).not.toBeNull();", "key(face, 'Enter', { shiftKey: true });\n      expect(document.querySelector('.bt-hand-detail')).toBeNull();"],
]);
edit('tests/battle-entry-view.test.js', [
  ["expect(card.querySelector('.bt-rest-name')?.textContent).toBe(card.querySelector('.hsc-name')?.textContent);\n    expect(card.querySelector('.bt-rest-name')?.getAttribute('aria-hidden')).toBe('true');", "expect(card.querySelector('.bt-rest-name')).toBeNull();\n    expect(card.querySelector('.hsc-name')?.textContent).toBeTruthy();"],
  [".toBe('284px')", ".toBe('64px')"],
  ["[[1,'winter-street'],[2,'frozen-ruins'],[3,'contaminated-core']]", "[[1,'winter-platform-minimal'],[2,'winter-platform-minimal'],[3,'winter-platform-minimal']]"],
  ['.toHaveLength(1);\n  expect(world.querySelector(\'.scene-static\')).not.toBeNull();expect(overlay.querySelector(\'.battle-scene-foreground\')).toBeNull();', '.toHaveLength(2);\n  expect(world.querySelector(\'.scene-static\')).toBeNull();expect(overlay.querySelector(\'.battle-scene-foreground\')).not.toBeNull();'],
  ["expect(overlay.querySelectorAll('.battle-scene-layer')).toHaveLength(1);\n  expect(overlay.querySelector('.battle-scene-foreground')).toBeNull();", "expect(overlay.querySelectorAll('.battle-scene-layer')).toHaveLength(2);\n  expect(overlay.querySelector('.battle-scene-foreground')).not.toBeNull();"],
  ["HTMLImageElement.prototype.decode.mockImplementation(function () { return this.src.includes('frozen-ruins') ? oldDecode.promise : Promise.resolve(); });", "HTMLImageElement.prototype.decode.mockReturnValue(oldDecode.promise);"],
  ["start([], {layerIdx:0,isBoss:true});await flush();", "HTMLImageElement.prototype.decode.mockResolvedValue();\n  start([], {layerIdx:0,isBoss:true});await flush();"],
  [".toBe('contaminated-core')", ".toBe('winter-platform-minimal')"],
  ["expect(overlay.querySelector('.battle-scene-foreground')).toBeNull();\n});", "expect(overlay.querySelector('.battle-scene-foreground')).not.toBeNull();\n});"],
]);
