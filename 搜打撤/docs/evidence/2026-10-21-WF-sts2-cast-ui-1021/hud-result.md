# 战斗 HUD 边界整改（2026-10-21）

本线仅修改 battle-stage.css 与已失效的阅读约束测试；没有改 DOM、点击命令、玩法、手牌组逻辑或卡面尺寸。battle-infusion.css / battle-discover.css 未改。

公共边界：抽牌堆从底部合并资源栏独立出来，定位顶栏右侧、选项左边（top 34px，right 为外边距 + 184px）；左下能量面板宽176px、最小高76px，图标44px，数字40px。HUD 外边距56px，右控制列248px，手牌两端共用64px控制区余量。1920逻辑舞台中，能量右缘232px、手牌左缘296px；手牌右缘1552px、右控制列左缘1616px。260px卡面及悬停不缩放契约保持，密集手牌仍由原布局算法调整叠放。

选材模式继续用原有更高优先级的手牌位置与隐藏控制规则；透明 resource-dock 用 display:contents 保留原子树与锁定入口。玻璃背景只落在紧凑能量面板和各独立控件，不再画合并大资源栏。

## 已验证

- scoped handoff：3个候选CSS、随后精确测试文件均 exit 0，相关编辑占用0。
- npm run test:target -- tests/battle-decision-readability.test.js tests/battle-hand-layout.test.js tests/battle-hand-hit-input.test.js tests/battle-potion-bar-layout.test.js tests/battle-infusion-action-layout.test.js tests/battle-card-results.test.js：exit 0；6文件108用例通过。
- node node_modules/stylelint/bin/stylelint.mjs game/css/battle-stage.css：exit 0。
- node node_modules/eslint/bin/eslint.js tests/battle-decision-readability.test.js：exit 0。
- 现有测试中旧320px合并栏、52px能量数字、48px固定HUD边距断言，更新为牌库/能量分开定位、手牌与控制区共用参数的设计约束；没有新增镜像尺寸测试。

## 待父会话实页

本线未开浏览器、未启服务、未build。父会话当前内置浏览器窗口为1280×720（恢复后的当前窗口；未主动改尺寸），负责真实控件、手牌端点和悬停阅读的可见边界。上文坐标为源码定义的1920逻辑舞台预算，不冒充浏览器测量。

## 冻结字节

基线为 .tmp/sts2-cast-ui-1021-hud-before 中原始字节。没有用 HEAD 覆盖工作区；下表只计本次HUD增量。

| 路径 | 自有差异 | 修改前SHA256 | 修改后SHA256 |
| --- | --- | --- | --- |
| game/css/battle-stage.css | +12/-12 | 7aecb775cc217bfc6a1b3b237d93fba731402346c1e70245695e209af080da7a | ce8586cf7398c3cbba6089c081d00a032be2d596da5ff2c6decef84bd46018f8 |
| tests/battle-decision-readability.test.js | +9/-4 | 026aaec6f4838392ce9110d9d97036d6f9f5cea4c7e1b954b303cb3f26c5476a | 01dbb7ed2a76e92d1a8185fd9c26ce833fe5b45ff37ca99ba4860bfcd39b2932 |

<details><summary>本线完整补丁</summary>

```diff
--- a/game/css/battle-stage.css
+++ b/game/css/battle-stage.css
@@ -84,19 +84,20 @@
 #overlay .battle-stage.sts .sts-intent .ic{flex:none;width:26px;height:26px}
 #overlay .battle-stage.sts .can-target:not(.dead){cursor:crosshair}
 #overlay .battle-stage.sts .drag-over:not(.dead){outline:none}
-#overlay .battle-stage.sts .sts-hud{position:absolute;inset:0;box-sizing:border-box;padding:0 48px 40px;margin:0;min-height:0;display:grid;grid-template-columns:minmax(0,1fr) 264px;grid-template-rows:minmax(0,1fr) auto auto;gap:14px 0;border:0;background:none;box-shadow:none;z-index:9;pointer-events:none}
+/* Hand edges share the occupied control widths; reading a card never enters either side lane. */
+#overlay .battle-stage.sts .sts-hud{--battle-hud-edge:56px;--battle-hud-bottom:40px;--battle-energy-width:176px;--battle-tactics-width:248px;--battle-hand-control-gap:64px;position:absolute;inset:0;box-sizing:border-box;padding:0 var(--battle-hud-edge) var(--battle-hud-bottom);margin:0;min-height:0;display:grid;grid-template-columns:minmax(0,1fr) var(--battle-tactics-width);grid-template-rows:minmax(0,1fr) auto auto;gap:14px 0;border:0;background:none;box-shadow:none;z-index:9;pointer-events:none}
 #overlay .battle-stage.sts .sts-hud button,#overlay .battle-stage.sts .sts-hud [role="button"]{pointer-events:auto}
-#overlay .battle-stage.sts .sts-resource-dock{position:absolute;left:56px;bottom:40px;width:max-content;max-width:320px;min-height:104px;display:flex;align-items:center;gap:16px;box-sizing:border-box;padding:12px 18px;border:1px solid var(--battle-line);border-radius:14px;background:var(--battle-glass)}
-#overlay .battle-stage.sts .sts-hud-l{position:static;display:flex;gap:6px}
+#overlay .battle-stage.sts .sts-resource-dock{display:contents}
+#overlay .battle-stage.sts .sts-hud-l{position:absolute;top:34px;right:calc(var(--battle-hud-edge) + 184px);display:flex;gap:6px;max-width:var(--battle-energy-width);pointer-events:auto}
 #overlay .battle-stage.sts .sts-hud-l:empty{display:none}
-#overlay .battle-stage.sts .sts-energy-wrap{position:static;display:flex;flex-direction:row;align-items:center;gap:8px;transform:none;margin:0;padding:6px 0}
+#overlay .battle-stage.sts .sts-energy-wrap{position:absolute;left:var(--battle-hud-edge);bottom:var(--battle-hud-bottom);width:var(--battle-energy-width);min-height:76px;box-sizing:border-box;display:flex;align-items:center;transform:none;margin:0;padding:10px 12px;border:1px solid var(--battle-line);border-radius:12px;background:var(--battle-glass);color:#d7eaf0;pointer-events:auto}
 #overlay .battle-stage.sts .battle-energy-label{font-size:12px;color:#abc0cf}
-#overlay .battle-stage.sts .sts-energy{position:static;display:flex;align-items:center;gap:10px;width:auto;height:auto;margin:0;padding:0;border:0;background:none;box-shadow:none;clip-path:none;color:#f3e5c6;pointer-events:auto}
+#overlay .battle-stage.sts .sts-energy{position:static;display:flex;align-items:center;justify-content:center;gap:6px;width:100%;height:auto;margin:0;padding:0;border:0;background:none;box-shadow:none;clip-path:none;color:#f3e5c6;pointer-events:auto}
 #overlay .battle-stage.sts .sts-energy::before,#overlay .battle-stage.sts .sts-energy::after{content:none}
-#overlay .battle-stage.sts .sts-energy>b{font-size:52px;font-weight:600;line-height:1}
-#overlay .battle-stage.sts .sts-energy>span{font-size:22px;color:#c4d8e1}
+#overlay .battle-stage.sts .sts-energy>b{font-size:40px;font-weight:600;line-height:1}
+#overlay .battle-stage.sts .sts-energy>span{font-size:20px;color:#c4d8e1;white-space:nowrap}
 #overlay .battle-stage.sts .sts-energy>.ic{width:26px;height:30px;align-self:center}
-#overlay .battle-stage.sts .sts-energy>.battle-energy-emblem{display:block;width:68px;height:68px;object-fit:contain;pointer-events:none}
+#overlay .battle-stage.sts .sts-energy>.battle-energy-emblem{display:block;flex:none;width:44px;height:44px;object-fit:contain;pointer-events:none}
 #overlay .battle-stage.sts .bt-pile{position:relative;display:inline-flex;align-items:center;gap:7px;min-width:0;min-height:48px;margin:0;padding:7px 9px;border:1px solid var(--battle-line);border-radius:8px;background:var(--battle-glass);color:#e8efed;box-shadow:none;font:inherit;pointer-events:auto}
 #overlay .battle-stage.sts .bt-pile>b{position:static;width:auto;height:auto;padding:0;border:0;background:none;color:#e2eff3;font-size:24px;line-height:1}
 #overlay .battle-stage.sts .bt-pilecard{display:block;width:24px;height:34px;overflow:hidden}
@@ -117,7 +118,7 @@
 #overlay .battle-stage.sts .bt-slam-btn:disabled{opacity:1;cursor:default;border-color:#e6ece433;box-shadow:inset 0 1px 0 #f2f8fa14}
 #overlay .battle-stage.sts .bt-slam-btn:disabled .battle-skill-art{opacity:.4;filter:grayscale(.35)}
 #overlay .battle-stage.sts .bt-slam-btn:hover:not(:disabled),#overlay .battle-stage.sts .bt-slam-btn:focus-visible{border-color:#d9d2af;outline:2px solid #d9d2af55;outline-offset:3px}
-#overlay .battle-stage.sts .sts-hand{position:absolute;left:300px;right:330px;bottom:92px;width:auto;height:300px;min-height:0;margin:0;padding:0;display:block;overflow:visible;background:none;border:0;box-shadow:none;pointer-events:none}
+#overlay .battle-stage.sts .sts-hand{position:absolute;left:calc(var(--battle-hud-edge) + var(--battle-energy-width) + var(--battle-hand-control-gap));right:calc(var(--battle-hud-edge) + var(--battle-tactics-width) + var(--battle-hand-control-gap));bottom:92px;width:auto;height:300px;min-height:0;margin:0;padding:0;display:block;overflow:visible;background:none;border:0;box-shadow:none;pointer-events:none}
 #overlay .battle-stage.sts .bt-slot{position:absolute;left:50%;top:0;bottom:auto;width:calc(260px * var(--fs,1));height:calc(390px * var(--fs,1) + 56px);margin:0;outline:none;border:0;background:none;transform:translateX(calc(-50% + var(--fx,0px)));z-index:calc(10 + var(--hand-index,0));pointer-events:none}
 #overlay .battle-stage.sts .bt-slot::after{content:'';position:absolute;left:0;top:calc(390px * var(--fs,1));bottom:0;width:calc(260px * var(--fs,1));z-index:-1;pointer-events:auto}
 #overlay .battle-stage.sts .bt-card{position:relative;isolation:isolate;width:100%;height:calc(390px * var(--fs,1));margin:0;padding:0;background:none;border:0;border-radius:4px;box-shadow:none;transform-origin:center bottom;transition:transform .16s cubic-bezier(.22,.75,.3,1);pointer-events:auto;touch-action:none}
@@ -145,7 +146,7 @@
 #overlay .battle-stage.sts .sts-hand>.ov-empty{position:absolute;top:300px;left:0;right:0;color:#c5d9e2;text-align:center;font-size:22px}
 #overlay .battle-stage.sts[data-phase="enemy"] .sts-hand{opacity:.3;translate:0 90px;pointer-events:none}
 #overlay .battle-stage.sts[data-phase="enemy"] .sts-hand *{pointer-events:none}
-#overlay .battle-stage.sts .sts-tactics{position:static;grid-column:2;grid-row:3;align-self:end;width:264px;box-sizing:border-box;margin:0;padding:16px;display:flex;flex-direction:column;align-items:stretch;gap:14px;background:var(--battle-glass);border:1px solid var(--battle-line);border-radius:14px;pointer-events:auto}
+#overlay .battle-stage.sts .sts-tactics{position:static;grid-column:2;grid-row:3;align-self:end;width:var(--battle-tactics-width);box-sizing:border-box;margin:0;padding:16px;display:flex;flex-direction:column;align-items:stretch;gap:14px;background:var(--battle-glass);border:1px solid var(--battle-line);border-radius:14px;pointer-events:auto}
 #overlay .battle-stage.sts .bt-turn-forecast{display:grid;gap:4px;margin:0;color:#d1e0e7;font-size:20px;text-align:left;line-height:1.3}
 #overlay .battle-stage.sts .bt-forecast-damage{display:flex;align-items:baseline;justify-content:space-between;gap:10px}
 #overlay .battle-stage.sts .bt-turn-forecast b{font-size:30px;font-weight:700;color:#edf6f8}
@@ -183,14 +184,13 @@
 
 /* Printed card names remain part of the shared face; battle adds no duplicate strip. */
 #overlay .battle-stage.sts .bt-card[data-hand-state="selected"]{outline:2px solid #c8e8f0;outline-offset:3px}
-#overlay .battle-stage.sts .sts-energy-wrap{color:#d7eaf0}
 
 #overlay .battle-stage.sts .bt-slot:has(.click-selected){z-index:95}
 #overlay .battle-stage.sts .bt-card.click-selected:not(.aim-lift){transform:translateY(0)}
 #overlay .battle-stage.sts[data-phase="enemy"] .bt-turn-forecast{visibility:hidden}
 
 /* Blur is limited to fixed controls; dragged cards and the painted world stay sharp. */
-#overlay .battle-stage.sts :is(.sts-encounter,.sts-options>summary,.sts-resource-dock,.sts-tactics,.bt-pile,.bt-hand-page,.bt-slam-btn,.sts-unit-vitals){backdrop-filter:blur(14px) saturate(115%);box-shadow:var(--battle-glass-shadow)}
+#overlay .battle-stage.sts :is(.sts-encounter,.sts-options>summary,.sts-energy-wrap,.sts-tactics,.bt-pile,.bt-hand-page,.bt-slam-btn,.sts-unit-vitals){backdrop-filter:blur(14px) saturate(115%);box-shadow:var(--battle-glass-shadow)}
 @supports not (backdrop-filter:blur(1px)){#overlay .battle-stage.sts{--battle-panel:#263640a8}}
 
 /* Keep persistent card results in the central HUD lane, clear of items.
--- a/tests/battle-decision-readability.test.js
+++ b/tests/battle-decision-readability.test.js
@@ -75,8 +75,9 @@
     expect(declarations(battle, `${stage} .sts-hp>span`)).toContain('font-size:22px');
     expect(declarations(battle, `${stage} .sts-intent`)).toContain('position:relative');
     expect(declarations(battle, `${stage} .sts-intent`)).not.toContain('100% + 120px');
-    expect(declarations(battle, `${stage} .sts-resource-dock`)).toContain('max-width:320px');
-    expect(declarations(battle, `${stage} .sts-energy>b`)).toContain('font-size:52px');
+    expect(declarations(battle, `${stage} .sts-resource-dock`)).toContain('display:contents');
+    expect(declarations(battle, `${stage} .sts-hud-l`)).toMatch(/position:absolute;top:/);
+    expect(declarations(battle, `${stage} .sts-energy-wrap`)).toContain('bottom:var(--battle-hud-bottom)');
     expect(declarations(battle, `${stage} #btSelf>.sts-hand-tools`)).toContain('left:4px');
     expect(declarations(battle, `${stage} #btSelf>.sts-hand-tools`)).toContain('top:calc(100% - 170px)');
   });
@@ -108,14 +109,18 @@
     expect(hud).toContain('display:grid');
     expect(hud).toContain('grid-template-rows:minmax(0,1fr) auto auto');
     expect(hud).toContain('gap:14px 0');
-    expect(hud).toContain('padding:0 48px 40px');
+    expect(hud).toContain('padding:0 var(--battle-hud-edge) var(--battle-hud-bottom)');
     const piles = declarations(battle, `${stage} .sts-hud-r`);
     expect(piles).toContain('position:static'); expect(piles).toContain('grid-row:2');
     expect(piles).toContain('flex-wrap:wrap'); expect(piles).not.toContain('bottom:284px');
     const tactics = declarations(battle, `${stage} .sts-tactics`);
     expect(tactics).toContain('position:static'); expect(tactics).toContain('grid-row:3');
     expect(tactics).not.toContain('bottom:40px');
-    expect(declarations(battle, `${stage} .sts-hand`)).toContain('position:absolute');
+    expect(tactics).toContain('width:var(--battle-tactics-width)');
+    const handLane = declarations(battle, `${stage} .sts-hand`);
+    expect(handLane).toContain('position:absolute');
+    expect(handLane).toContain('left:calc(var(--battle-hud-edge) + var(--battle-energy-width) + var(--battle-hand-control-gap))');
+    expect(handLane).toContain('right:calc(var(--battle-hud-edge) + var(--battle-tactics-width) + var(--battle-hand-control-gap))');
   });
 
   it('keeps the skill icon, fee and disabled state legible with the explanation supplied by hover/focus', () => {
```

</details>


## 最终补记：牌库位于能量正上方

老板最终指定牌库放在能量上边。此前“顶栏右侧、选项左边”的位置已被替换：牌库与能量共同占左侧176px窄列，left共用HUD外边距56px，牌库列内居中；牌库bottom = HUD bottom40px + energy height76px + resource gap16px，即距下沿132px，位于能量正上方并留16px间距。能量高度与牌库偏移共用变量。

手牌两端64px控制区余量、260px卡面、右侧控制列、职业技能位置和选材模式均保持。仅改battle-stage.css及对应readability定位约束。

本次快速反馈：test:target tests/battle-decision-readability.test.js，exit 0，11用例通过；目标Stylelint与ESLint均exit 0。当前窗口实页仍由父会话同步原页复验，本线未开服务或浏览器。

以下SHA覆盖最后修正后的冻结字节；此前表格及补丁作为上一版历史保留。

| 路径 | 修改前SHA256 | 最终SHA256 |
| --- | --- | --- |
| game/css/battle-stage.css | ce8586cf7398c3cbba6089c081d00a032be2d596da5ff2c6decef84bd46018f8 | a72a3cdfe26f642fdc86752cc360c4b1f651cccb2c51789c17889e79ed78b9f6 |
| tests/battle-decision-readability.test.js | 01dbb7ed2a76e92d1a8185fd9c26ce833fe5b45ff37ca99ba4860bfcd39b2932 | 99cc6c02e790ef42e892aaa44d218dcded739b24d63e898836778e88a134e137 |

```diff
--- a/game/css/battle-stage.css
+++ b/game/css/battle-stage.css
@@ -85,12 +85,12 @@
 #overlay .battle-stage.sts .can-target:not(.dead){cursor:crosshair}
 #overlay .battle-stage.sts .drag-over:not(.dead){outline:none}
 /* Hand edges share the occupied control widths; reading a card never enters either side lane. */
-#overlay .battle-stage.sts .sts-hud{--battle-hud-edge:56px;--battle-hud-bottom:40px;--battle-energy-width:176px;--battle-tactics-width:248px;--battle-hand-control-gap:64px;position:absolute;inset:0;box-sizing:border-box;padding:0 var(--battle-hud-edge) var(--battle-hud-bottom);margin:0;min-height:0;display:grid;grid-template-columns:minmax(0,1fr) var(--battle-tactics-width);grid-template-rows:minmax(0,1fr) auto auto;gap:14px 0;border:0;background:none;box-shadow:none;z-index:9;pointer-events:none}
+#overlay .battle-stage.sts .sts-hud{--battle-hud-edge:56px;--battle-hud-bottom:40px;--battle-energy-width:176px;--battle-energy-height:76px;--battle-resource-gap:16px;--battle-tactics-width:248px;--battle-hand-control-gap:64px;position:absolute;inset:0;box-sizing:border-box;padding:0 var(--battle-hud-edge) var(--battle-hud-bottom);margin:0;min-height:0;display:grid;grid-template-columns:minmax(0,1fr) var(--battle-tactics-width);grid-template-rows:minmax(0,1fr) auto auto;gap:14px 0;border:0;background:none;box-shadow:none;z-index:9;pointer-events:none}
 #overlay .battle-stage.sts .sts-hud button,#overlay .battle-stage.sts .sts-hud [role="button"]{pointer-events:auto}
 #overlay .battle-stage.sts .sts-resource-dock{display:contents}
-#overlay .battle-stage.sts .sts-hud-l{position:absolute;top:34px;right:calc(var(--battle-hud-edge) + 184px);display:flex;gap:6px;max-width:var(--battle-energy-width);pointer-events:auto}
+#overlay .battle-stage.sts .sts-hud-l{position:absolute;left:var(--battle-hud-edge);bottom:calc(var(--battle-hud-bottom) + var(--battle-energy-height) + var(--battle-resource-gap));width:var(--battle-energy-width);display:flex;justify-content:center;gap:6px;pointer-events:auto}
 #overlay .battle-stage.sts .sts-hud-l:empty{display:none}
-#overlay .battle-stage.sts .sts-energy-wrap{position:absolute;left:var(--battle-hud-edge);bottom:var(--battle-hud-bottom);width:var(--battle-energy-width);min-height:76px;box-sizing:border-box;display:flex;align-items:center;transform:none;margin:0;padding:10px 12px;border:1px solid var(--battle-line);border-radius:12px;background:var(--battle-glass);color:#d7eaf0;pointer-events:auto}
+#overlay .battle-stage.sts .sts-energy-wrap{position:absolute;left:var(--battle-hud-edge);bottom:var(--battle-hud-bottom);width:var(--battle-energy-width);min-height:var(--battle-energy-height);box-sizing:border-box;display:flex;align-items:center;transform:none;margin:0;padding:10px 12px;border:1px solid var(--battle-line);border-radius:12px;background:var(--battle-glass);color:#d7eaf0;pointer-events:auto}
 #overlay .battle-stage.sts .battle-energy-label{font-size:12px;color:#abc0cf}
 #overlay .battle-stage.sts .sts-energy{position:static;display:flex;align-items:center;justify-content:center;gap:6px;width:100%;height:auto;margin:0;padding:0;border:0;background:none;box-shadow:none;clip-path:none;color:#f3e5c6;pointer-events:auto}
 #overlay .battle-stage.sts .sts-energy::before,#overlay .battle-stage.sts .sts-energy::after{content:none}
--- a/tests/battle-decision-readability.test.js
+++ b/tests/battle-decision-readability.test.js
@@ -76,8 +76,15 @@
     expect(declarations(battle, `${stage} .sts-intent`)).toContain('position:relative');
     expect(declarations(battle, `${stage} .sts-intent`)).not.toContain('100% + 120px');
     expect(declarations(battle, `${stage} .sts-resource-dock`)).toContain('display:contents');
-    expect(declarations(battle, `${stage} .sts-hud-l`)).toMatch(/position:absolute;top:/);
-    expect(declarations(battle, `${stage} .sts-energy-wrap`)).toContain('bottom:var(--battle-hud-bottom)');
+    const drawPile = declarations(battle, `${stage} .sts-hud-l`);
+    const energy = declarations(battle, `${stage} .sts-energy-wrap`);
+    for (const region of [drawPile, energy]) {
+      expect(region).toContain('left:var(--battle-hud-edge)');
+      expect(region).toContain('width:var(--battle-energy-width)');
+    }
+    expect(drawPile).toContain('bottom:calc(var(--battle-hud-bottom) + var(--battle-energy-height) + var(--battle-resource-gap))');
+    expect(energy).toContain('bottom:var(--battle-hud-bottom)');
+    expect(energy).toContain('min-height:var(--battle-energy-height)');
     expect(declarations(battle, `${stage} #btSelf>.sts-hand-tools`)).toContain('left:4px');
     expect(declarations(battle, `${stage} #btSelf>.sts-hand-tools`)).toContain('top:calc(100% - 170px)');
   });
```
