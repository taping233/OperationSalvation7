# 环层横幅旧样式收拢

已按源码加载顺序，删除 `#layerBanner` 组件在 `base.css`、`winter.css` 中的 9 条失效声明。最终规则保留原位置与选择器；本批没有新增覆盖规则，也没有改动状态、动画或减少动态效果分支。

正式入口 `game/index.html` 的相关加载顺序为：`base.css` → `scenes.css` → `winter.css` → `expedition.css` → `page-expedition-hud.css` → `ak-skin.css`。下表行号取本批操作前源码。

| 原位置 | 选择器与删除项 | 保留来源及原因 |
| --- | --- | --- |
| `base.css:150` | `#layerBanner`：`top:10px` | `winter.css:42` 同选择器设为 `20px`。 |
| `base.css:152` | `#layerBanner`：`padding:5px 32px 6px` | `winter.css:42` 同选择器设为 `10px 28px`。 |
| `base.css:152` | `#layerBanner`：旧渐变 `background` | `expedition.css:320` 同选择器设为 `#191a1cdb`。 |
| `base.css:154` | `#layerBanner .lb-zh`：`letter-spacing:8px` | `page-expedition-hud.css:167` 同选择器设为 `7px`。 |
| `base.css:154` | `#layerBanner .lb-zh`：旧 `text-shadow` | `page-expedition-hud.css:168` 同选择器给出最终双层阴影。 |
| `base.css:155` | `#layerBanner .lb-en`：`color:var(--ak-yellow)` | 后加载的 `expedition.css:321` 有同选择器常规颜色；`winter.css:881` 的同选择器重要颜色声明也保留。 |
| `winter.css:42` | `#layerBanner .lb-zh`：`letter-spacing:5px` | `page-expedition-hud.css:167` 同选择器设为 `7px`。 |
| `winter.css:490` | `#layerBanner`：`background:transparent` | `expedition.css:320` 同选择器设置最终背景。 |
| `winter.css:490` | `#layerBanner`：`border-bottom:0` | `expedition.css:320` 同选择器的后置 `border:1px solid #9a9c9e2e` 完整覆盖底边宽度、样式与颜色，随后 `border-bottom-color:#d0b76799` 设置最终底边色。 |

移除了上述删除产生的空基础块及已不描述现行样式的透明背景注释。没有删除文件。操作前原字节保留在 `css-before/banner-base.css`、`css-before/banner-winter.css`；它们是接续前一 HUD 清理批次后的基线。

状态：按老板要求仅整改，未运行测试、浏览器、HTTP、构建、lint、类型检查或级联验证脚本。本批结论依据源码与相关差异阅读；此前 29 项 HUD 测试和级联对比对应前一批，不能视为本批验收。
