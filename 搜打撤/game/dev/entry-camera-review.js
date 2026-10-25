import { buildDerived, enterLayer, game, cam, setLobby } from '../src/run/game.session.js';
import { setExpeditionPreview } from '../src/run/expedition.view.js';
import { careerSkillButtonHTML } from '../src/battle/view/battle.skill-view.js';
import { slamSkillFor } from '../src/battle/bag/battle.slam-skill.js';
import { createTermTipRenderer } from '../src/ui/term-tips.runtime.js';

// Production entry and refresh, generated map, memory preferences, no run save.
window.addEventListener('load', () => {
  const tools = document.createElement('div');
  tools.style.cssText = 'position:fixed;top:80px;left:20px;z-index:9999;background:#142c38;color:white;padding:12px;font:18px sans-serif';
  tools.innerHTML = '<button id="entry-review-start">准备跨层</button> <button id="entry-review-go">进入第二层</button><output id="entry-review-result"></output>';
  document.body.append(tools);
  document.querySelector('#entry-review-start').onclick = () => {
    buildDerived('entry-camera-review');
    game.runActive = true;
    game.moveTarget = null;
    setLobby(false);
    document.querySelector('#title').hidden = true;
    window.SDT.UI.hideOverlay({ immediate:true });
    enterLayer(0, game.layerData[0].entrances[0], { deferSave:true });
    setExpeditionPreview(game, { li:0, idx:game.trackPos });
    window.SDT.UI.refresh(game);
    cam.frameExploration(game);
    document.querySelector('#entry-review-result').textContent = `旧层详情占位 ${Math.round(cam.detailInset)}px`;
  };
  document.querySelector('#entry-review-go').onclick = () => {
    const at = game.layerData[1].entrances[0];
    enterLayer(1, at, { glideCam:true, deferSave:true });
    setTimeout(() => {
      const p = game.nodePos[1][at], screen = cam.worldToScreen(p.x, p.y);
      const error = Math.hypot(screen.x - (cam.viewW - cam.detailInset) / 2, screen.y - cam.viewH / 2);
      document.querySelector('#entry-review-result').textContent = `第2层入口偏差 ${error.toFixed(2)}px · 详情占位 ${Math.round(cam.detailInset)}px`;
    }, 700);
  };
  const skill = slamSkillFor('侠客');
  const host = document.createElement('div');
  host.style.cssText = 'position:fixed;bottom:90px;left:45%;z-index:9999';
  host.innerHTML = careerSkillButtonHTML({ skill, state:'ready', availability:'可用', effect:skill.hint, disabled:false });
  host.querySelector('img').style.width = '64px';
  document.body.append(host);
  const tip = createTermTipRenderer(() => tip.hide(), () => true);
  host.addEventListener('pointerenter', () => tip.show(host.querySelector('[data-ui-tip]')));
  host.addEventListener('pointerleave', () => tip.hide());
});
