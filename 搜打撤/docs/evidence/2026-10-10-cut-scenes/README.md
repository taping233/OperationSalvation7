# 六个界面的专用过场图

2026-10-10，Friday，WF-cut-scenes-1010。完成未提交。

六张现行图均按老板指定的 **NovelAI 4.5 底稿 → 内置 ImageGen 按默认块面画风重绘** 制作并接入，不再共用一张城廓图。

| 入口 | 图像内容 | 现行素材 |
| --- | --- | --- |
| 基地 | 雪夜门楼与入口暖灯 | `game/assets/scenes/transition-camp-v2.webp` |
| 照相馆 | 古董相机与照片 | `game/assets/scenes/transition-photo-v2.webp` |
| 出征 | 雪地路线、路标与远山 | `game/assets/scenes/transition-field-v2.webp` |
| 遭遇战 | 废墟巷道与暗红危险点 | `game/assets/scenes/transition-battle-v2.webp` |
| 首脑接敌 | 温室竞技场与冷色天光 | `game/assets/scenes/transition-boss-v2.webp` |
| 首页成就总览 | 月桂盾徽与荣誉档案 | `game/assets/scenes/transition-achievement-v2.webp` |

## 接入与来源

六图在 `camp-entry.js` 随模块预热，斜切和字牌共用工厂、按目的页选图。既有基地/照相馆/跑局入口生命周期保留。首页成就同步挂载页面后追加980ms装饰切幕；关闭、换页或Escape立即清理，不接管输入或奖励逻辑，减少动态时不挂切幕。馆内筛选、翻页及奖章详情不重播入口切幕。

NAI全部显式使用 `nai-diffusion-4-5-full`、1344×768；请求/回执分别为 `nai-requests-v2.json`、`nai-receipts-v2.json`。重绘的底稿与画风参考角色在 `redraw-prompts-v2.json` 明确说明。内置输出路径为 `generated-inputs-v2.json`，本地源PNG、来源SHA、编码和运行素材SHA为 `receipt-v2.json`。现行WebP均1280×720、quality86、method6，总283314字节。

底稿和重绘PNG本地保留于 `game/art-source/ui/cut-scenes-20261010/`，该目录.gitignore排除PNG，获取方式与SHA见回执。直接生成的v1为被制作流程替代的候选，保留原文件和登记，不作为现行入口。

## 本轮验收

- `verification-final.json`：11件自有资产（5件v1候选+6件v2）登记、大小、源图SHA和运行素材SHA通过；官方资产审计本轮资产0问题，23项范围外错误未改。
- 4个定向测试文件共38项：37通过，1项现成就空态文案旧断言失败（测试期待“第一枚奖章”，现行文案为“尚未获得奖章”）。本轮新增成就切幕关闭/换页清理及减少动态测试通过；相关3文件共30项通过。
- ESLint和docs:check通过，不build、不提交。
- `browser-final.json`：当前窗口Codex内置浏览器，真实按钮切换六种静止切幕预览，图片均加载；首页真实“成就总览”入口确认使用成就v2，自动清理、返回和Escape清理正常，console error0。
- 预览截图证明选图、加载和裁切；成就实页截图证明真实入口。未新跑完整远征或战斗流程，未测试其他窗口尺寸。
- NAI生成、等待和验证进程均已退出，无本会话后台或新端口服务。

静止组件预览：`game/art-source/ui/cut-scenes-20261010/preview.html`。六张截图为 `*-v2.png`；成就实际入口为 `game-achievement-entry.png`。