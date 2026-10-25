# 战场连续地面

本方案已按老板“改回去”撤回。原地面恢复为修改前121902字节，SHA256为`1745ba35497c047d8fbde33555fcfa12e45b835df6e43fe2905fc814389d1169`；CSS与本任务前备份逐字节一致，manifest地面字段及对应素材说明恢复，其他改动保留。见[撤回核对](revert.json)。以下保留已撤回方案的历史实现与验收证据，不代表当前运行效果。

## 实现与来源

- 运行图：`game/assets/scenes/battle/platform-painterly-1025-v3/ground.webp`；1659×948、RGBA WebP、质量94/method6，198696字节。完整画布未缩放、裁切或加滤镜。
- 使用内置imagegen对原地面层局部编辑，提示词见[prompt.txt](prompt.txt)，源图与产物SHA256、旧字节备份、其余三层指纹见[import.json](import.json)。源PNG为1038395字节，保留在该记录指定的Codex生成目录，不进入Git；获取方式为内置imagegen原图编辑。
- `game/css/battle-stage.css`仅在现行冬日废站作用域放开场景容器的地面溢出，并按68%站脚锚点扩展地面高度，补足原整体上移110px形成的底部空缺。角色、血条、手牌和按钮几何不改。
- 素材清单仅更新现行ground条目，计数和其他条目保留；`game/assets/README.md`的战斗场景说明同步为当前四层来源。

## 验证

- [素材检查](asset-check.json)：退出0，目标通过；全局摘要0错误、569项历史警告，不将旧警告记为本轮修复。
- [样式检查](style-check.json)：退出0，无解析错误和警告。
- [文档检查](docs-check.json)：退出0；最终核对运行图与manifest指纹一致，其余三层指纹保持不变。
- 当前Codex内置浏览器、1280×720窗口，真实点击标题开发遭遇战，不写存档；目视检查黑像与两名联邦巡防兵。最终地面完整、人物落脚正常、血条/手牌/结束回合无遮挡；[layout.json](layout.json)记录地面bottom=720.004px、舞台bottom=720px，无横向溢出，地面pointer-events为none。
- 稳定取景：[改前](before-stable.png) / [改后](after-final.png)，来源分别见[改前记录](before-stable.json)和[最终记录](after-final.json)。截图支持外观与资源加载范围，未验证完整战斗输入链或性能。
- `before.png`与`after.png`在共享树热更新后捕获到标题，`before-battle.png`仍处入场阶段，不作战场通过证据；`after-stable.png`保留回合横幅，最终以`after-final.png`为准。原始记录保留，不覆写失败采集。

未覆盖：首脑、召唤物和密集敌阵、其他窗口尺寸、完整战斗流程、性能、生产构建及全量测试；未提交或推送，无新服务。
