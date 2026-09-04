# -*- coding: utf-8 -*-
# 临时帧率基线脚本：headless Chromium 打开地图页，统计 rAF 间隔分布与 Renderer.draw 耗时
import http.server, threading, functools, statistics, sys
sys.stdout.reconfigure(encoding='utf-8')
from playwright.sync_api import sync_playwright

ROOT = r"C:\Users\太平\Documents\ChatGPT\代号柒\搜打撤\prototypes\map-system"
handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory=ROOT)
srv = http.server.ThreadingHTTPServer(("127.0.0.1", 8791), handler)
threading.Thread(target=srv.serve_forever, daemon=True).start()

with sync_playwright() as p:
    b = p.chromium.launch(headless=True)
    pg = b.new_page(viewport={"width": 1600, "height": 900})
    pg.on("console", lambda m: print("[console]", m.type, m.text[:200]))
    pg.on("pageerror", lambda e: print("[pageerror]", e))
    pg.goto("http://127.0.0.1:8791/index.html")
    pg.wait_for_timeout(3000)
    # 关掉标题封面（若可关）
    pg.evaluate("""() => {
      const t = document.querySelector('#title');
      if (t && !t.hidden) { const btn = document.querySelector('#title .title-start, #btnStart, .title-actions button');
        if (btn) btn.click(); else t.hidden = true; }
    }""")
    pg.wait_for_timeout(1000)
    stats = pg.evaluate("""async () => {
      const gaps = []; const drawMs = [];
      const raf = () => new Promise(r => requestAnimationFrame(r));
      // 预热
      for (let i=0;i<30;i++) await raf();
      const orig = window.SDT.Renderer.draw;
      window.SDT.Renderer.draw = function(...a){ const t0=performance.now(); const r=orig.apply(this,a); drawMs.push(performance.now()-t0); return r; };
      let last = performance.now();
      for (let i=0;i<120;i++) { await raf(); const n = performance.now(); gaps.push(n-last); last = n; }
      window.SDT.Renderer.draw = orig;
      gaps.sort((a,b)=>a-b);
      const slow = gaps.filter(g => g > 20).length;
      return { fpsAvg: +(1000/(gaps.reduce((s,g)=>s+g,0)/gaps.length)).toFixed(1),
               p50: +gaps[Math.floor(gaps.length*0.5)].toFixed(1),
               p95: +gaps[Math.floor(gaps.length*0.95)].toFixed(1),
               max: +gaps[gaps.length-1].toFixed(1),
               slowFrames: slow,
               drawP50: +(drawMs.slice().sort((a,b)=>a-b)[Math.floor(drawMs.length*0.5)]||0).toFixed(2),
               drawMax: +(Math.max(...drawMs,0)).toFixed(2) };
    }""")
    print("结果:", stats)
    b.close()
srv.shutdown()
