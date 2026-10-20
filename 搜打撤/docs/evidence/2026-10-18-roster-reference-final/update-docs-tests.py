from pathlib import Path
root = Path(__file__).resolve().parents[3]
p = root / 'tests/hub-personnel-portrait.test.js'
t = p.read_text(encoding='utf-8').replace("import { assetUrl } from '../game/src/core/asset-url.js';\n", '')
t = t.replace("const cutoutUrl = assetUrl('assets/portraits/personnel/wu-default-cutout-v1.webp');", "const defaultUrl = '/original/侠客/default.webp';").replace('cutoutUrl', 'defaultUrl')
t = t.replace('configuration-only default portrait override', 'shared default portraits in personnel').replace('uses the versioned transparent Wu main image and its own visible bounds', 'uses the same default Wu source as the roster without legacy crop bounds')
t = t.replace("toBe('body')", "toBe('canvas')").replace("toBe('true')", "toBe('false')")
t = t.replace("toBe('-58.544922%')", "toBe('')").replace("toBe((.92 * 1536 / 1519).toFixed(6))", "toBe('')").replace('expect(skinUrl).not.toHaveBeenCalled();', "expect(skinUrl).toHaveBeenCalledWith('侠客', 'default');")
start = t.index("  it('scopes transparent-stage")
end = t.index("  it('updates the retained", start)
t = t[:start] + '''  it('uses white backing and normal blending only for default portraits', () => {
    const rules = [];
    postcss.parse(readFileSync('game/css/base-personnel-v12.css', 'utf8')).walkRules(rule => {
      if (rule.selector.includes('[data-skin="default"]')) rules.push(rule);
    });
    const values = rule => Object.fromEntries(rule.nodes.filter(node => node.type === 'decl').map(node => [node.prop, node.value]));
    expect(rules.some(rule => values(rule).background === '#fff')).toBe(true);
    expect(rules.some(rule => values(rule)['mix-blend-mode'] === 'normal')).toBe(true);
    const stageRule = rules.find(rule => values(rule).background === '#fff');
    document.body.innerHTML = `<div id="overlay"><div id="hubMain" class="base-frame-v7">${personnelHTML('wu')}</div></div>`;
    expect(document.querySelector('.pv12-agent-image-stage').matches(stageRule.selector)).toBe(true);
    owned.get('wu').selectedSkinId = 'casual';
    document.querySelector('#hubMain').innerHTML = personnelHTML('wu');
    expect(document.querySelector('.pv12-agent-image-stage').matches(stageRule.selector)).toBe(false);
  });

''' + t[end:]
t = t.replace("expect(image.getAttribute('src')).toContain('wu-default-cutout-v1.webp');", "expect(decodeURI(image.getAttribute('src'))).toContain(defaultUrl);")
p.write_text(t, encoding='utf-8')
for role in ['wu','changwuyu','baita','heixiang','xingyue']:
 p = root / f'docs/character-bible/{role}.md'
 t = p.read_text(encoding='utf-8')
 t = t.replace('2026-10-18按默认精修半厚涂重绘并统一为1024×1536，保留站姿、服装与背剑', '2026-10-18按老板指定的10-16原图直接替换，1024×1536白底、交错站姿，无可见背剑')
 t = t.replace('于2026-10-18按默认精修半厚涂重绘', '于2026-10-18按老板指定的10-16无原图画法重绘')
 t = t.replace('../evidence/2026-10-18-roster-unified/README.md', '../evidence/2026-10-18-roster-reference-final/README.md')
 if role == 'wu':
  lines = t.splitlines()
  lines = ['- **本版武器**：老板指定的现行原图没有可见背剑；后续任务指定武器时另按对应设定核对。' if line.startswith('- **武器形制**：') else line for line in lines]
  t = '\n'.join(lines) + '\n'
 p.write_text(t, encoding='utf-8')
p = root / 'docs/character-bible/README.md'
t = p.read_text(encoding='utf-8').replace('10-18统一重绘，站姿与身份保留', '10-18替换为老板指定10-16原图，交错站姿、无可见背剑')
t = t.replace('五图于2026-10-18按默认精修半厚涂重绘，统一1024×1536与安全留白', '五图于2026-10-18按老板指定10-16参考接入：无使用原图，四人按其块面画法重绘，统一1024×1536')
t = t.replace('../evidence/2026-10-18-roster-unified/README.md', '../evidence/2026-10-18-roster-reference-final/README.md')
p.write_text(t, encoding='utf-8')
p = root / 'docs/production/art/VISUAL-BIBLE.md'
t = p.read_text(encoding='utf-8').replace('当前五张运行立绘于2026-10-18按默认精修半厚涂统一重绘，均为1024×1536竖版，整图等比缩放并统一安全留白，白塔保留坐姿', '当前五张运行立绘于2026-10-18按老板指定参考接入：无直接使用10-16原图，其他四人按其块面画法重绘，均为1024×1536竖版，白塔保留坐姿；培养与选人共用默认立绘，培养默认图使用白底与完整画布')
t = t.replace('../../evidence/2026-10-18-roster-unified/README.md', '../../evidence/2026-10-18-roster-reference-final/README.md')
p.write_text(t, encoding='utf-8')
print('Tests and current character documentation updated')
