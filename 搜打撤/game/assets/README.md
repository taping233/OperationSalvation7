# 素材目录（预留）

当前 v0.1 渲染全部由代码程序化绘制，无需外部素材（保证离线双击即可运行）。

## M3 计划接入的免费素材（CC0 公有领域，可商用）

- [Kenney Roguelike / Modern Interior 系列](https://kenney.nl/assets) — 俯视角瓦片、家具、宝箱、角色
- [Micro Roguelike 8×8（itch.io）](https://kenney-assets.itch.io/micro-roguelike)
- [社区扩展 Mini Roguelike（OpenGameArt）](https://opengameart.org/content/mini-roguelike-8x8-tiles)

接入方式：把瓦片图集放入本目录，将 `renderer.js` 中的程序化绘制替换为 `drawImage` 即可；
地图数据（`mapData.js` 的 ASCII 网格 + 实体层）无需改动。

注意：Kenney 图集瓦片之间常有 1px 间距，导入 Tiled/引擎时需正确配置 spacing/margin。
