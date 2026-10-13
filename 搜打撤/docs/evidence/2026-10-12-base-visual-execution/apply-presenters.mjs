import fs from 'node:fs';
function replace(path, before, after) {
  const source = fs.readFileSync(path, 'utf8');
  if (source.split(before).length !== 2) throw new Error(`Ambiguous patch: ${path} ${before.slice(0,70)}`);
  fs.writeFileSync(path, source.replace(before, after));
}
replace('game/src/hub/hub.archive-v3.js',
  '<section class="av3-reward-inbox av12-record-workspace">',
  '<section class="av3-reward-inbox av12-record-workspace" data-empty="${rows.length === 0}">');
replace('game/src/hub/hub.personnel.js',
  '在仓库归档该人物的职业卡或能力卡，获得经验。',
  '用该人物的职业卡或能力卡培养；卡牌转为经验并消耗。');
replace('game/src/hub/hub.personnel.js',
  "'安全格加成在携带时生效'}</p>` :",
  "'安全格加成在携带时生效'}</p>${!maxed && base.data.rations < cost ? '<button class=\"base-link source-link\" data-act=\"hubTab\" data-tab=\"shop\" data-trade-mode=\"buy\" data-trade-key=\"rations\">交易所补充口粮 →</button>' : ''}` :");
replace('game/src/hub/hub.facilities.js',
  '${why ? `<p class="hint" role="status">${esc(why)}</p>` : \'\'}</div>',
  '${why ? `<p class="hint" role="status">${esc(why)}</p>${base.data.wood < facility.cost && !maxed ? \'<button class="base-link source-link" data-act="hubTab" data-tab="shop" data-trade-mode="buy" data-trade-key="wood">交易所补充木材 →</button>\' : \'\'}` : \'\'}</div>');
replace('game/src/hub/hub.courtyard-v3.js',
  "${rain ? '' : '<canvas class=\"courtyard-v3-backdrop\" aria-hidden=\"true\"></canvas>'}",
  '<canvas class="courtyard-v3-backdrop" aria-hidden="true"></canvas>');
replace('game/src/hub/hub.courtyard-v3.js',
  '<details open class="courtyard-v3-settings">',
  '${rain ? \'\' : \'<button type="button" class="courtyard-v3-feed" data-courtyard-control="interact">投喂</button>\'}<details class="courtyard-v3-settings">');
replace('game/src/hub/hub.courtyard-v3.js',
  '<button type="button" data-courtyard-control="interact">${rain ? \'雨势：细雨\' : \'投喂\'}</button>',
  '${rain ? \'<button type="button" data-courtyard-control="interact">雨势：细雨</button>\' : \'\'}');
replace('game/src/hub/hub.courtyard-v3.js',
  'if (rain || disposed || !backdrop) return;',
  'if (disposed || !backdrop) return;');
replace('game/src/hub/hub.courtyard-v3.js',
  'if (!rain) { backdrop.width = width; backdrop.height = height; drawBackdrop(); }',
  'backdrop.width = width; backdrop.height = height; drawBackdrop();');
replace('game/src/hub/hub.courtyard-v3.js',
  'engine = rain ? createRainTableau(canvas) : createKoiPond(canvas);',
  'engine = rain ? createRainTableau(canvas, { sceneBackdrop:true }) : createKoiPond(canvas);');
replace('game/src/hub/hub.courtyard-v3.js',
  '  if (!rain) {\n    image = new Image();',
  '  {\n    image = new Image();');
replace('game/src/hub/courtyard.rain-tableau.js',
  'export function createRainTableau(canvas) {',
  'export function createRainTableau(canvas, { sceneBackdrop = false } = {}) {');
replace('game/src/hub/courtyard.rain-tableau.js',
  '  const drawPaper = colors => {',
  `  const drawPaper = colors => {
    // Painted scenery is drawn once by the separate backdrop canvas.
    if (sceneBackdrop) {
      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = 'rgba(17,40,47,.46)';
      ctx.fillRect(0, 0, width, height);
      return;
    }`);
console.log('Presentation patches applied; state and economy commands unchanged');
