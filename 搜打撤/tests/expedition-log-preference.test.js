import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
let hudMethods;
beforeAll(async()=>{
  window.SDT={Icons:{rich:text=>text}};
  ({hudMethods}=await import('../game/src/ui/hud.js'));
});
beforeEach(()=>{localStorage.clear();document.body.innerHTML='<section id="logPanel"><div id="log"></div></section>';});
describe('地图日志偏好',()=>{
  it.each([null,'0','1'])('默认收起而显式偏好%s不被首条/清空覆盖',preference=>{
    if(preference!==null)localStorage.setItem('sdt-log-collapsed',preference);
    const ctx={el:{log:document.getElementById('log'),logPanel:document.getElementById('logPanel')}};
    hudMethods.log.call(ctx,'实际日志');
    expect(ctx.el.log.textContent).toBe('实际日志');
    expect(ctx.el.logPanel.classList.contains('collapsed')).toBe(preference!=='0');
    hudMethods.clearLog.call(ctx);
    expect(ctx.el.log.textContent).toBe('');
    expect(ctx.el.logPanel.classList.contains('collapsed')).toBe(preference!=='0');
    expect(localStorage.getItem('sdt-log-collapsed')).toBe(preference);
  });
});
