# 初始宠物改名旺财

2026-10-15，Friday，聊天01a13fe8。老板要求游戏初始宠物改名，并覆盖各处名称。

## 改动

12文件17处名称替换：game/data/pets.json；game/src/hub/{base,base-state,meta}.js；game/src/run/game.session.js；tests/{base-inventory-lifecycle-audit,bag-page-lifecycle-review,fresh-run-settlement,m06-sources-view}.test.js；docs/{rules,game-compendium}.md；docs/previews/m04/loadout.html。

稳定ID仍为dog。持有、等级、携带选择均按ID保存；伙伴详情、整备、安全格与新失败结算通过公共宠物数据读取名称。历史证据、旧快照与冻结Godot项目保留原文，不作为现行名称来源。

## 验证

- test:target：上述4份测试及compendium.test.js，5文件86项通过。
- docs:check：466个相对链接，无findings。
- rg：game、tests及docs现行文件旧名零命中，排除所有evidence/archive/node_modules目录。
- Codex当前窗口内置浏览器，http://127.0.0.1:5200/，现有服务，档位01：真实点击进入基地→配置→伙伴，详情标题和查看标签均显示旺财；Lv.1、生命上限+5、安全格2格。当前窗口截图已目视核对。
- 真实点击基地→出征整备→下一步，随行宠物按钮显示“paw 旺财 Lv.1”。未点击出发。控制台error列表为空。

背包与失败结算由定向测试覆盖，未为本次改名重新实玩失败结算。未build、提交或推送，无新服务。
