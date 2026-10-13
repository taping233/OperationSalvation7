# 稀有度识别与卡面信息精简

老板要求一眼看出稀有度，底部额外攻击、伤害类型和价值可以不上卡面。本轮只更新待选三款样板 `game/card-design-options-v2.html`，正式游戏外观尚未接入。

三款均用整圈边框、不同标记及稀有度文字共同编码；古朴浅银、稀有蓝、史诗紫、传说金、棱彩全息，初始/职业/衍生独立标记。取消底部stats/value、独立攻击徽章和卡类小字，保留名称、费用与完整技能效果。正文中的伤害数值仍是规则的一部分。

现行 `card-rarity.js` 的rarityOf将hero牌判为棱彩，因此预览青龙化身使用实际棱彩，修正旧预览直接读原始rarity而显示稀有的问题。新增8种外观色样按钮，清楚标明色样与卡牌实际稀有度的区别；切换样本自动恢复实际稀有度，不改游戏数据。

2026-10-10 Codex内置浏览器 http://127.0.0.1:5200/card-design-options-v2.html 当前窗口：三款均显示实际棱彩，stats/value/attack元素数量0；长文案clientHeight与scrollHeight分别92/92、104/104、81/81，无截字和横向溢出。真实输入切换传说/史诗/稀有并恢复实际状态通过，稀有CSS色值#409eea、传说#e9b642，error零条。截图prism.png / legendary-swatch.png / epic-swatch.png / rare-swatch.png；色样图不代表青龙化身真实稀有度。

内嵌模块脚本语法检查、自有diff检查通过。未跑Vitest、未build、未提交，无新服务。PENDING39保留选版，已确认的设计约束已回写。
