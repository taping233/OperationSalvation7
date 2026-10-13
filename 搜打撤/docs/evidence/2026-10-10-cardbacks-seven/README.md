# 七款卡背制作与接入

七款均已生成并接入现有卡背样式链。老板确认黄褐“行囊粗布”、皮纸“猎手皮纸”和朱红“富商锦缎”三款后，授权全部完成；补齐仓廪木纹、弑神黑曜、核心星轨与忠犬爪印。未修改卡背编号、解锁、装备选择、存档或玩法。

使用内置 imagegen。生成共同提示为竖向2:3、主题直接可读、低细节手绘大色块、硬边明暗、概括笔触、完整矩形边框、无文字或人物；每款提示主题见 `receipt.json` 的 `promptBrief`。前后三款已确认出图和游戏现有 `bound-shadow.webp` 卡面为画风参考，禁止冰雪及与主题无关的装饰。

生成原图路径及原始SHA256保存在 `receipt.json`；原图超过1MB，未复制到Git交付范围，可按生成来源取得。运行图片为 `game/assets/card-backs/{classic,wolf,coin,vault,boss,altar,pet}.webp`，512×768，每张84–129KB。`prepare-assets.py` 仅进行缩放、WebP编码、生成预览与哈希，不重新绘图。`integrate-assets.py` 保留其他清单条目，增加本轮7条来源登记。

接入修改仅为 `game/css/scenes.css` 卡背块和 `game/assets/asset-manifest.json` 本轮条目。原CSS渐变纹理与小图标由完整绘图取代；不修改另一会话活跃占用的 `cards.view.js`。

## 验证

- `tests/base-meta.test.js`：11项通过，包括默认卡背、解锁与领取机制。所给第二个测试路径没有对应文件，实际仅执行该文件；不宣称牌堆测试通过。
- 自有CSS/清单diff检查通过；七个资产的登记、尺寸、字节与SHA256定向核对通过。
- Codex内置浏览器127.0.0.1:5200，当前窗口真实输入进入档位1收藏页：7款图片可见、锁标和默认使用中标记正常，计算背景均指向对应WebP，旧中心图标隐藏。截图 `collection-after.png`。
- 档位3背包DOM背景指向新的classic.webp；真实双击打开卡牌大图，随后共享工作区HMR回标题页。真实翻面外观、战斗牌堆外观未验，不将DOM样式覆盖当作真实翻面通过。
- `asset-audit --check --paths-json` 全库增量检查失败：18项为其他卡面、字体、动画JSON和ui/ak路径的未登记资产，本轮7款未出现在错误中。未扩大修改，也未宣称全库资产门通过。
- 未build、提交或推送；编辑完成释放，完成未提交归属保留。

总览：`seven-cardbacks.png`。资源源图和提示主题：`receipt.json`。
