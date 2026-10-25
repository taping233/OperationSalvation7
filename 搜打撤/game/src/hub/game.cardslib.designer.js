/* Read-only compatibility boundary for the frozen card-writing tools.
 * Creation/import requests return to the library; exports retain the existing format.
 * CARD_DESIGNER_WRITES_ENABLED remains false in the shared public facade. */
const SDT = window.SDT;
const UI = window.SDT.UI;
import { esc } from '../core/shared.js';

export function createCardDesigner(deps) {
  function showCardsExportOverlay() {
    deps.setCardPageOpen(false);
    const json = JSON.stringify({ game: 'sdt', format: 'cards', version: 2, cards: SDT.Cards.all() }, null, 2);
    UI.showOverlay('[[icon:upload]] 导出卡牌', `
      <p class="ov-note">把下面的 JSON 发给开发者/AI，即可把卡牌接入战斗系统。</p>
      <textarea id="ovExport" class="ov-textarea" readonly>${esc(json)}</textarea>
      <div class="ov-btns">
        <button class="ov-btn ok" data-act="copyCards">复制到剪贴板</button>
        <button class="ov-btn" data-act="downloadCards">下载文件</button>
        <button class="ov-btn" data-act="backLib">← 返回照相馆</button>
      </div>`);
    UI.act('copyCards', async () => {
      try { await navigator.clipboard.writeText(json); UI.log('卡牌 JSON 已复制', 'ok'); }
      catch { UI.log('复制失败，请手动全选复制', 'warn'); }
    });
    UI.act('downloadCards', () => {
      const blob = new Blob([json], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'sdt-cards.json';
      a.click();
      URL.revokeObjectURL(a.href);
    });
    UI.act('backLib', () => deps.openCardLibrary());
  }

  return {
    openCardDesigner: () => { deps.openCardLibrary(); },
    closeDesigner: () => { deps.closeLibPage(); },
    showCardsImportOverlay: () => { deps.openCardLibrary(); },
    showCardsExportOverlay,
  };
}
