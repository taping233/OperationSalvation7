# 庭院动画来源

仅接入下列 MIT 许可的渲染核心，全部本地运行；未接远端 iframe、遥测、外部字体、音频文件或第三方脚本。

运行时正本位于 `game/src/hub/courtyard-vendor/`，由 hub.courtyard-v3.js 相对导入。此目录的 JavaScript 保留为本轮来源审核副本，不再由游戏源码导入；原 MIT 许可同时随运行时正本保存。这样运行时代码沿项目源码边界检查，资产目录不承担可执行依赖。

| 文件 | 上游与固定提交 | 处理 |
| --- | --- | --- |
| RainSimulation.js / RainRenderer.js | [rubenvieira/rain-simulator](https://github.com/rubenvieira/rain-simulator/tree/2f3390cd4ccb4e898856dea4ddb8c6d635a90553)，提交 `2f3390cd4ccb4e898856dea4ddb8c6d635a90553` | 原 `src/simulation/RainSimulation.ts`、`src/rendering/RainRenderer.ts` 通过项目现有 esbuild 去除类型，未执行上游脚本、安装依赖或构建上游项目。原 MIT 许可见 rain-LICENSE.txt。 |
| KoiPond.js | [rzrabbi/interactive-koi-pond](https://github.com/rzrabbi/interactive-koi-pond/tree/d8e2b1527630dfb4cccf646c0d8266cd95e2bb4f)，提交 `d8e2b1527630dfb4cccf646c0d8266cd95e2bb4f` | 原 script.js 中鱼体、投喂、涟漪核心包装成 createKoiPond(canvas)；移除全局 Wallpaper/Lively 桥接、window 输入、自动 RAF；增加实例 resize/render/tap/dispose 和有界食物/涟漪；传统鱼色调整为与项目相容的纸白、暖金与朱橙。原 MIT 许可见 koi-LICENSE.txt。 |

雨滴最多 90 个、尾珠最多 260 个；锦鲤固定 9 条，食物和涟漪各最多 24 个。页面管理 RAF、输入、可见性、减少动态效果和音频生命期。音频由本项目 Web Audio 噪声合成，在用户点击后创建，关闭或离页后销毁。

未使用的首选候选：Binix-Rainy-Glass-Simulator 的 README 声称 MIT，实际树无 LICENSE 且另有 Shadertoy 来源说明；nagomi 为 PolyForm Noncommercial License 1.0.0；krvnishka/koi-pond 与 li-cai/koipond 未显示明确 LICENSE。本次不复制这些候选的实现或素材。
