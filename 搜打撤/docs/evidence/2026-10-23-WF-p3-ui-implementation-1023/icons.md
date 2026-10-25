# 语义图标库接入记录

状态：图形库与公共 API 已接入，消费者迁移和当前窗口实页验收由主会话统一完成。本记录不把本地 SVG 缩略图复核视为游戏实页验收。

## 可见变化

68 张原生 SVG 使用透明背景、32 × 32 光学网格、2.2 px 主笔画。轮廓为冷白金属，内部少量灰金标记区分关键动作；没有烘焙光晕、阴影或选中状态。牌堆、卡面、卡片操作、容器与状态分别形成可区分形状。普通盾牌、免疫、减伤和破甲也使用独立内部结构，不能只靠颜色辨认。

原先 11 组中 30 个旧键各自改用独立 SVG；chart/info 分别改为统计和提示，不再借 archive/scroll。警告、搜索、无穷、固定与雪花分别接 warning/search/infinity/pin/status-freeze。问号保留未知含义与错误回退。

coin 仍使用地图栏金币原画，altar 仍使用现有手绘祭坛，旧 PNG 未覆盖或删除。卡背预览、地图原画、按钮尺寸、命中盒与玩法状态未在本属地改动。

## 文件与 API

- `game/assets/ui/semantic-icons/*.svg`：68 张小尺寸功能图形。
- `game/src/core/semantic-icons.js`：显式键与路径注册，不根据旁边文案猜图。
- `game/src/core/icons-bitmap.js`：保持 url/img/rich/hydrate/TYPE_ART/NAMES API，优先使用语义 SVG；NAMES 当前共 98 个键。调用者自定义 alt、class 与未知键只报一次的诊断均保留。
- `tests/semantic-icons.test.js`：重复图形隔离、实际文件、原画来源、字符语义、安全水合与错误回退的回归覆盖。

所有路径仍走 assetUrl()，版本化和发布路径规则继续由现有公共入口处理。带文字的装饰图由消费者按现有 aria-hidden 包装，纯图标按钮由消费者提供中文动作名；本次不改写旧 img API 的默认 alt 行为。

### 原重复组旧键（30）

- `archive`
- `folder`
- `trash`
- `arrow`
- `exit`
- `upload`
- `bag`
- `pocket`
- `pouch`
- `book`
- `cards`
- `notes`
- `save`
- `scroll`
- `broom`
- `pen`
- `tools`
- `crystal`
- `gem`
- `door`
- `home`
- `helmet`
- `plate`
- `shield`
- `hourglass`
- `mouse`
- `lantern`
- `sparkles`
- `play`
- `skip`

### 独立提示与符号键（7）

- `chart`
- `info`
- `question`
- `warning`
- `search`
- `infinity`
- `pin`

### 显式业务键（15）

- `draw-pile`
- `consumed-pile`
- `hand-pages`
- `draw-card`
- `safe-slot`
- `spell-pouch`
- `card-library`
- `card-back`
- `card-craft`
- `sell-cards`
- `pet-egg`
- `pass-fragment`
- `pearl-box`
- `infuse`
- `spell-power`

### 战斗状态键（16）

- `status-armor-break`
- `status-atk-down`
- `status-atk-up`
- `status-bleed`
- `status-cosmos-form`
- `status-dodge`
- `status-freeze`
- `status-heal-ban`
- `status-immune`
- `status-moon-form`
- `status-poison`
- `status-reduce`
- `status-silence`
- `status-spell-up`
- `status-stealth`
- `status-sword-form`

## 验证

2026-10-24 完成以下定向检查：

- `npx vitest run tests/semantic-icons.test.js tests/icon-hydration.test.js --reporter=dot`：2 文件、12 测试通过。
- `npx eslint game/src/core/icons-bitmap.js game/src/core/semantic-icons.js tests/semantic-icons.test.js`：通过。
- 使用已配置运行环境中的 Sharp 本地渲染全部 68 张图的 13 / 22 / 64 px，共 204 次；图形均非空，四角 alpha=0。先建立牌堆、背包、安全格、冰冻、注能五个样本，再扩展完整库；整库接触表复核后缩短搜索柄、区分盾牌和免疫的内部结构。
- 安全水合继续先转义文本，备注中的 HTML 保持字面内容；新图标不会给属性文本引入图像。
- BMP 字符转换只覆盖已注册符号，页面原有 ✓ / ✦ / ⌕ / ◇ 等装饰或完成标记继续保留原字形，避免修复字符正则时误变成问号。

验证时遇到的首轮测试路径在 Windows/jsdom 下解析到盘符根目录，已改用工作区绝对解析；修复后的整组定向测试通过。没有启动服务、构建、提交或操作浏览器。

## 待主会话完成

- 沿调用位置与动态数据迁移同键多义，尤其 cards/crystal/sparkles/pocket/pouch 的具体用途；通用键更换图形不能代替消费者的语义拆分。
- 更新生成资源清单和发布别名，验证发布路径。
- 在当前窗口实际控件中核对 13–22 px、60–76 px、悬停/焦点/禁用/选中与浅色宿主。库不强加全局滤镜；现有选中宿主的 brightness / opacity 等仍由页面控制。
- 卡背与牌堆运行图维持玩家选择；状态值、短名和单位说明仍由对应玩法与排布整改负责。

## SVG 指纹

下表只用于定位本次交付的准确图形，不代表消费者或实页验收销账。

| 键 | SHA256 |
| --- | --- |
| archive | d0732811bac1b7fbd3ee2b7a26d8e6613df3050ba91ad0bb5bbf91715fdd8a10 |
| arrow | 7dcfe44ce9926c34949d1207d5da7a279252ff7399296ea87bc347fdc3a5221e |
| bag | 4c6129960417fa625914250f3f42eebe8654cfb84b90e6d5f54ca51980365ea9 |
| book | 336648e14729ad8ffe203c2b0bd3eafe3be3d1e7f7dce46301c06af846ded18e |
| broom | 10b8cfbcda580e925d06fc5f40194740affa7f7f1c9c1fb92ad975dc8ccdbaf7 |
| card-back | 6b04d723765facab0cbe262dfd8ee7a7c5d6a61cf63e298f3618a1acee1c68c1 |
| card-craft | 324c1942ab5821f2a9416033db47691f849f02a2b2ef50e50ecb837d9faeba21 |
| card-library | 90cd14eb1dab2ba30c6d857af10a197aa63ee5a7b1f5444abd46edee159a89d8 |
| cards | 8114d4e9562e2c1e4f6380a5de9b47aa13ae8af9419b89ac465d6d546f21dac3 |
| chart | e84e676c38ca3abeb5358ac4e2051f6344d106c2f0e7cabf21a350a8f8800092 |
| consumed-pile | 15ee36fc4d37fb6914aaa13a13d866ddd6049c3281128aa11c36f4bd3431a6a9 |
| crystal | 32fd0c11bd6c91453b3471e21d5f73f7f236cb627200fe73c67b3183416063d1 |
| door | c1e6e84dcbb5b0870f1f9e972fc084e1459ec7febd850867e19f45be411cbcee |
| draw-card | b0ecb454d9656c9239b5859f907dfb00b0d32d371c5c7eb495957cab21273bfe |
| draw-pile | fefc349b3de1a26a3776d257c80eb72c3d766f29c65b12a34caed62f8aa89232 |
| exit | 3ac55b90fef2b1a1bd401c2d5eda2caf411b0f391d8070678eb20624472d1d4a |
| folder | 1b45a9c4595f33e7683fed1a4478546bac0a36ae5a0cf4834b9ce95fb25196cd |
| gem | 0e797886f2b29c23ab36b9f4adbac4ee43f07e25f0c30f3253d27b9ab1105ff7 |
| hand-pages | 4ed544f7744db1a8caca0dc359f06dfcc4ecdfa57539963bc6afb492c76018ab |
| helmet | f030c08bda3fa79668cc4eecf60e29ca4c245890d9ea2ea14b3bfc93d905861f |
| home | f5e3f7705d987ca8109116e7b47842a4db8754318c60e7cd5f7c7671acb41ad0 |
| hourglass | 35f7ce54b04d1e5064b024cbfa8ac97b105d86330c8e3db0c8d7bac959b2de22 |
| infinity | 28c3eb6e0e82cf2cad7982b4addcc349cf22b72c5ebf838662314a321dad5032 |
| info | 04bbaa4fad501545b906703c1fac6dff716058975965875dccb8ab38f20720c6 |
| infuse | 129598abe54ca922f15f4bd2184ed80b9243b2a8fe27b16fb908deecad22dd05 |
| lantern | 179cd07129d891a9ecf4550d53448e4bc7a4fb0d3238037ca1f9b81b9f4891bb |
| mouse | 2fb324358115bc4ecfce676fa632b387df64b998d30eefa7f5357e5bc29fa4df |
| notes | d94debfbcbebec4845d6985f063452ac80ce4ac11b357f8c7c7babbf62015f35 |
| pass-fragment | 3050c50c3a4d90ca3641be08e8fa2341c691288c87c282b407cf11a4fc9c5063 |
| pearl-box | 09d8a9314e06c0b650a5015fba662a99a201b98a7b44bccf641f388692b8128c |
| pen | 6acbda02259578485340e29aca158c6e8e01d8760677b34838d9107d2f3e3cbc |
| pet-egg | fe5776cdd28dc124df591bc2907c13fd0f654548f879d60060c802ebd934ad7e |
| pin | 65ebfc975d0748e2925005033a5a2d3a2c5c91e0c440e4ea1bb43029a07a46f1 |
| plate | 07cfdb450554a34a34c97bf7fef4b5bf24ee389c17ce73415a6b3ab67b267362 |
| play | 4619d3a357e7ba7eaf1a9e0037145928fd0c68bcaf931fc7a91aa035db4f26c1 |
| pocket | ae04eaaacccffe6db56c7e9f49ad66f8bf3d9a27dba4cbbb4ed2b17792a97a3b |
| pouch | dfcbb6f214b8ad5174520afda13568216634256249d913f7a11d1cde607238bb |
| question | aae9b329f8214fd502a90e24270cfb5f9cc9e19013103e42e1c59433d114e0be |
| safe-slot | 17e2e5e17d0eefc1447053bd18dcfe6fc57bc581cca9636b8c1ae36047c5b2ce |
| save | 85fb550d18917ca97c6719706a9a83ad5caa2c35acc08f2e34a370ae01749a10 |
| scroll | 3b4a879312959031bf6cb3fc4959229af5f59150a2d39e56afd1a38077f31fdd |
| search | ce5ba0cc5c01550e4f56d8ddfb4d9d37164db7ec5745a8047b1655fe6cc2c829 |
| sell-cards | 881aeded16120a6681b2ebb1f39f07641197390f317dcef1b889e7c09b6f15ff |
| shield | 591a9a8174bace45de025c9bef6ddfe740ea495f61a0af489a4483f98afb88bc |
| skip | 0c8254bda061c3855f387955f5927813fdba066425b3d09c22590c0e8b012a18 |
| sparkles | 60a34c946474349975cbde49c421f382edc8ac2238ae5181aa8527946e54e76c |
| spell-pouch | 8bd8542416d3891600ca84cb620d814ed48c2f065d480d47e758e2ae8d88c284 |
| spell-power | c4a7438d670d939aa907ac60c816edb83e7bfdd22091483280b18b66da819c7c |
| status-armor-break | 09b21038603993110774d2d73f32894592ee99a4844f62ba148e6131751227e1 |
| status-atk-down | b3bfb4f223d1785789541ea65f3ae14b1bfb57dab9aa4c863ae44614361d8a2f |
| status-atk-up | eacc7953adbe1370a90040139cb0d1df3a3fe5c370ebc10696b8b8167a81df07 |
| status-bleed | e206137d2449f11501903b7bdb773a21708b5b51447f1c0f0ac75867854454c8 |
| status-cosmos-form | 8ed8f6c7fbb2c63fb54d1c0f7ca03924ae885bb7cb546780872beda4be69a166 |
| status-dodge | c42a90b084fde8bf67a91ef8c8c1644288572f7e48e8586438c6d60f3c9ce230 |
| status-freeze | 09b51d2aeae8fa37a9f0055048230fadf1dc1974126d1524d8b2fa81bd3b379e |
| status-heal-ban | 218f50f48fc06b97b7f7258bdd9f52b9813640ef157296697dabba7204316de6 |
| status-immune | b8f7a52d62cd9b5809681f6eeb678aa68911e92a9aaca0176cb55270b81a3d25 |
| status-moon-form | 239eaed04bc1cab0de15cc922cb77edab16cc47432662901316feecf979893cd |
| status-poison | 75b65aaf49b9bdbf6fc51dcb9138e020b1652962f4f49dc544c4ef507a13b7b7 |
| status-reduce | af6c98e6380483f8094a1f7573a9426dfaf436153b0a3af198bb7c29f503512c |
| status-silence | e539a18d3b5178d7ebf7a66026fc884667fef14e6eb9956376e2e64151d224a5 |
| status-spell-up | e7df2ad3d06e9ce4bf5af22cb95fad8aab8af4f5572428f071995610448b1340 |
| status-stealth | 25600363d641f122ea40e37bbf17e4fdd59bdff7ec78a506d9a0037906aa6853 |
| status-sword-form | 352a9cf7d800fdebfed50673de7979abec1b43c41cd8c490e8f7e52ec945888b |
| tools | 5bef647b79916304b56e45a9ef522980e3831cb184bed73257e59b66595f334d |
| trash | e3f7579ab66eba3baf16d9c40394a6d95a655c0e25cc88266dc341256beb1dda |
| upload | 063c213a16298163f4347fde0c415975e0aead412bb384056950378a3c4ee965 |
| warning | 3199ce394227327e5dd5cfdd5bf101c2111b9ac32f1398e257f94c7af0134e72 |

## 增量资源登记

2026-10-24 仅向 `game/assets/asset-manifest.json` 追加本次 68 张 SVG 的 path/ext/bytes/sha256/license/source，count 从 1610 同步为 1678。既有 1610 条记录及其余元数据逐项保持原值，原文件排版与行尾保留。登记许可为“项目原创SVG代码绘制”，source 指向本记录；按现有审计工具对 SVG 以 LF 归一计算 bytes/SHA256。

写前读取 SHA256 `94bb9fc0d65c01d3b6c87e3007ea7ada6593909e4ef953cae0b8e5607f4c2526`，落盘前再次校验一致；写后 SHA256 为 `5215a799148b112ae05941e19663017f435c6fb33cdcdfd6f7ef783d0ec1780d`。未改 generated/art-manifest、债基线或发布排除。

定向审计见 [assets-check.json](assets-check.json)：selected 范围 68 资源、0 错误，ok=true。全局口径另报 ok=true、errorCount=0、historicalWarningCount=570；定向通过不代表全局资源债清空。

资源发布指纹审查另需主会话处理：`scripts/runtime-asset-redundancy.mjs` 的 `hasOpaqueAssetPaths()` 将 `icons-bitmap.js` 与新增 `semantic-icons.js` 均判为动态路径消费者。`scripts/runtime-asset-redundancy-review.mjs` 的 `opaqueConsumers` 里前者现有指纹已不匹配，后者尚未登记；本属地未更新该审查基线。当前规则会保留被审查的资源候选，不能把这条待审查项当作已恢复精简发布。

## 发布消费者复审

2026-10-24 按主会话授权，只更新 `scripts/runtime-asset-redundancy-review.mjs` 的 `opaqueConsumers` 中 `icons-bitmap.js` 指纹，并登记 `semantic-icons.js`；其他消费者、候选排除、精简决策和债基线均保持原值。以上“尚未登记”待办在本次复审后已解决。

审查确认：semantic-icons 的 68 个键由固定白名单解析到 `assets/ui/semantic-icons/<key>.svg`；icons-bitmap 先经已注册键与错误回退，再选此目录或旧 PNG 路径。金币和祭坛仍显式使用现有原画路径；本次不删除旧 PNG，不把新增语义图指向模组资源，也不扩大资源排除范围。两模块均由现有 hasOpaqueAssetPaths 检测为动态消费者，登记实际源码按 LF 归一后的 SHA256。

| 消费者 | 复审 SHA256 |
| --- | --- |
| game/src/core/icons-bitmap.js | c0efeda56e5fc74caa2dcbcd2405ea681af33129cdfc9b0658b7dda050edcc1e |
| game/src/core/semantic-icons.js | 18f153eebe05797f8e23295f04e65b8bb2f6d70fbb67c360eafc7617ba082d54 |

复审文件写前 SHA256 为 `0a45bd61b688dc9b9fde685fdcacac46d66d6cd59c492ea5963212c99e7a4901`，落盘前复核一致；写后为 `893f8bda1fd4565c5385d3188bb0c8baafdca3fcee3e62b366869b8c67ec2272`。

复审后执行 `npx vitest run tests/runtime-asset-redundancy.test.js --reporter=dot`：31 项中 28 通过、3 失败，退出码 1。失败定位为该文件第 69、152、189 行；前两项明确报告 `game/src/battle/view/battle.layers.js` 当前源码与既有消费者指纹不匹配，触发“保留资源”保护，第三项因此未取得预期排除集合。已授权的两个图标消费者指纹单独核对均匹配。没有修改 battle.layers 的指纹、断言或其他发布基线，整组测试仍待其负责会话复审后补验。

## 战斗层资源调用复审

2026-10-24 按主会话补充授权，仅复审并更新 `opaqueConsumers` 中 `game/src/battle/view/battle.layers.js`。本轮 diff 包含状态芯片抽离/差分更新及界面信息排列，注能、冰冻和庇幕小图改为显式语义键。逐项检查当前资源构造：`SDT.Art.battleArt/classArt/monsterArt/has/decodeIn`、`allyFigure(a.name)` 与 `assetUrl(source)`；共 8 个调用表达式及三张盟友原画静态路径与当前 HEAD 相同。HEAD 源码指纹并非上一条登记指纹，因此该比较只作为资源表达式未新增的证据，同时直接审查了全部当前动态调用。

三张盟友原画为 federal-patrol-v1 / federal-shooter-v1 / sealed-limb-v1，目录仍为 `assets/portraits/allies/`。单位角色与敌人原画继续经 Art 入口解析，新增状态组件只输出已注册图标宏，不新增原画 URL 构造。本次不新增发布排除、不动其他消费者指纹或债基线。

目标源码 SHA256 `df40e89651ea0831a6f8b0e65eea8daac7e751f962797db92297b679547221be` 已在写前再次核对；复审文件 SHA256 `893f8bda1fd4565c5385d3188bb0c8baafdca3fcee3e62b366869b8c67ec2272` 同样作为写前守卫，写后为 `967cde0c4c84b24b8b554721fb83380eea744287649adaa14e59e89f57018669`。此前 28 通过 / 3 失败的记录保留，以下补记重新验证结果。

## 图形像素与尺寸复核

针对全部 68 个键，分别以 13 / 22 / 64 px 渲染，源图统一 viewBox 32 × 32，渲染输出尺寸逐项一致。除比较 SVG 字节外，另比较每尺寸完整 RGBA 像素 SHA256，并把冷白/灰金统一为白色、深色填充归黑后生成二值几何图，比较形状 SHA256，以排除“只换颜色/字节仍同形”的遗漏。

```json
{
  "renderCount": 204,
  "results": [
    {
      "size": 13,
      "keys": 68,
      "rgbaDuplicateGroups": [],
      "neutralGeometryDuplicateGroups": []
    },
    {
      "size": 22,
      "keys": 68,
      "rgbaDuplicateGroups": [],
      "neutralGeometryDuplicateGroups": []
    },
    {
      "size": 64,
      "keys": 68,
      "rgbaDuplicateGroups": [],
      "neutralGeometryDuplicateGroups": []
    }
  ]
}
```

结果不等于人类辨识度保证，仍与当前窗口控件实页验收合用。pocket 与 safe-slot 本次使用不同几何：前者为缝边口袋，后者为提手/锁芯安全盒；消费者表达安全格时统一显式采用 safe-slot，因此没有通过同义别名隐去不同用途。本库中未保留像素或归一形状完全相同的别名。

## 战斗层复审后闭包回归

执行 `npx vitest run tests/runtime-asset-redundancy.test.js tests/semantic-icons.test.js tests/icon-hydration.test.js --reporter=dot`：3 文件共 43 项，41 通过、2 失败，退出码 1。semantic-icons 全部 6 项通过；runtime 30/31 通过，原 battle.layers 动态消费者失败已消除；icon-hydration 5/6 通过。

当前两项失败分别为：

- icon-hydration:80 仍期待旧安全格宏 `lock`，已迁移消费者实际输出 `safe-slot`；可访问性契约仍需消费者负责会话将该旧图标预期随变更同步，本属地未擅改其断言。
- runtime-asset-redundancy:152 的总排除集合受三个 selector 家族旧指纹保护。失配定位为 slot-weather 下 `ui/game.menu.pages.js` / `ui/menu-slots.js`；retired-scenes 下 `run/chests.js` / `run/game.session.death.js` / `css/entry-events.css` / `css/scenes.css`；chests 下也包含 `run/chests.js`。路径均相对 game/src（css 路径相对 game）。未更新这些未授权的 selector 指纹。

公共图标的两项消费者指纹及本次 battle.layers 指纹均已核对当前源码，未以测试断言或基线修改掩盖剩余问题。

## 最终集成检查（2026-10-24）

注册表 68 个语义键、磁盘 68 个 SVG、资产清单 68 条目标登记逐项一致；公开 NAMES 共 98 键，资产清单 count 与数组实际条数均为 1678。所有目标路径、ext、LF 归一 bytes/SHA256、原创许可和来源记录匹配；当前文件也与既有 assets-check.json 的 68 项 SHA256 一致。因此复用已完成的 204 次尺寸/像素复核和定向资产审计，没有重复渲染或重跑全局审计。三个已授权动态消费者的登记指纹仍与当前源码匹配。

卡片负责会话已把 icon-hydration:80 的安全格预期同步为 safe-slot。因该输入已变化，定向重跑 `npx vitest run tests/semantic-icons.test.js tests/icon-hydration.test.js --reporter=dot`：2 文件、12 项全部通过。前述安全格旧预期失败已解决；runtime selector 的六个外属地文件仍保留此前失败边界，本次没有重复执行或修改这些 selector。不能把本轮 12 项通过表述为 runtime 全套已通过。

### 可交付总览

复用现成 [68 图总览 PNG](C:/Users/太平/AppData/Local/Temp/p3-semantic-icon-full.png)，1260 × 1440、191013 bytes，SHA256 `30d215faae31e9f03ef5d9c94e00c415dfac03382813bdede14d0c93c22ea47d`。已直接检查现有图，pearl-box 位于第五行第二项，当前 PNG 包含完整 68 键。首次生成的旧版确为 67 键，之后已在同一路径覆盖为 68 键；若此前另存了旧副本，应按此 SHA256 和 pearl-box 标记区分。早期五样本图 `p3-semantic-icon-five.png` 只用于试样，不是完整交付图。本次没有新绘制或重新生成总览。

### 本片实际修改文件集合

以下 75 个项目文件由本片实际新增或修改；不包含其他代理迁移的消费者、实页截图、safe-slot 的旧测试预期修复或主会话总台账。路径均相对搜打撤。临时 PNG 两份的路径已在上方交付说明中列出，不计入项目文件集合。

```text
game/src/core/icons-bitmap.js
game/src/core/semantic-icons.js
game/assets/ui/semantic-icons/archive.svg
game/assets/ui/semantic-icons/arrow.svg
game/assets/ui/semantic-icons/bag.svg
game/assets/ui/semantic-icons/book.svg
game/assets/ui/semantic-icons/broom.svg
game/assets/ui/semantic-icons/card-back.svg
game/assets/ui/semantic-icons/card-craft.svg
game/assets/ui/semantic-icons/card-library.svg
game/assets/ui/semantic-icons/cards.svg
game/assets/ui/semantic-icons/chart.svg
game/assets/ui/semantic-icons/consumed-pile.svg
game/assets/ui/semantic-icons/crystal.svg
game/assets/ui/semantic-icons/door.svg
game/assets/ui/semantic-icons/draw-card.svg
game/assets/ui/semantic-icons/draw-pile.svg
game/assets/ui/semantic-icons/exit.svg
game/assets/ui/semantic-icons/folder.svg
game/assets/ui/semantic-icons/gem.svg
game/assets/ui/semantic-icons/hand-pages.svg
game/assets/ui/semantic-icons/helmet.svg
game/assets/ui/semantic-icons/home.svg
game/assets/ui/semantic-icons/hourglass.svg
game/assets/ui/semantic-icons/infinity.svg
game/assets/ui/semantic-icons/info.svg
game/assets/ui/semantic-icons/infuse.svg
game/assets/ui/semantic-icons/lantern.svg
game/assets/ui/semantic-icons/mouse.svg
game/assets/ui/semantic-icons/notes.svg
game/assets/ui/semantic-icons/pass-fragment.svg
game/assets/ui/semantic-icons/pearl-box.svg
game/assets/ui/semantic-icons/pen.svg
game/assets/ui/semantic-icons/pet-egg.svg
game/assets/ui/semantic-icons/pin.svg
game/assets/ui/semantic-icons/plate.svg
game/assets/ui/semantic-icons/play.svg
game/assets/ui/semantic-icons/pocket.svg
game/assets/ui/semantic-icons/pouch.svg
game/assets/ui/semantic-icons/question.svg
game/assets/ui/semantic-icons/safe-slot.svg
game/assets/ui/semantic-icons/save.svg
game/assets/ui/semantic-icons/scroll.svg
game/assets/ui/semantic-icons/search.svg
game/assets/ui/semantic-icons/sell-cards.svg
game/assets/ui/semantic-icons/shield.svg
game/assets/ui/semantic-icons/skip.svg
game/assets/ui/semantic-icons/sparkles.svg
game/assets/ui/semantic-icons/spell-pouch.svg
game/assets/ui/semantic-icons/spell-power.svg
game/assets/ui/semantic-icons/status-armor-break.svg
game/assets/ui/semantic-icons/status-atk-down.svg
game/assets/ui/semantic-icons/status-atk-up.svg
game/assets/ui/semantic-icons/status-bleed.svg
game/assets/ui/semantic-icons/status-cosmos-form.svg
game/assets/ui/semantic-icons/status-dodge.svg
game/assets/ui/semantic-icons/status-freeze.svg
game/assets/ui/semantic-icons/status-heal-ban.svg
game/assets/ui/semantic-icons/status-immune.svg
game/assets/ui/semantic-icons/status-moon-form.svg
game/assets/ui/semantic-icons/status-poison.svg
game/assets/ui/semantic-icons/status-reduce.svg
game/assets/ui/semantic-icons/status-silence.svg
game/assets/ui/semantic-icons/status-spell-up.svg
game/assets/ui/semantic-icons/status-stealth.svg
game/assets/ui/semantic-icons/status-sword-form.svg
game/assets/ui/semantic-icons/tools.svg
game/assets/ui/semantic-icons/trash.svg
game/assets/ui/semantic-icons/upload.svg
game/assets/ui/semantic-icons/warning.svg
tests/semantic-icons.test.js
game/assets/asset-manifest.json
scripts/runtime-asset-redundancy-review.mjs
docs/evidence/2026-10-23-WF-p3-ui-implementation-1023/icons.md
docs/evidence/2026-10-23-WF-p3-ui-implementation-1023/assets-check.json
```

## 只读 CSS 集成审查

范围限于 discovery-selection / card-layout-selected / card-state-motion / bag-design-system / expedition-inventory / battle-discover / selection-state-motion / settings-navigation 的相关 selector 与本轮 diff。为核实减动效兜底，补读了 winter.css:27 和 interface-motion.css 的游戏内减动效作用域；没有修改 CSS、运行浏览器或扩大构建验证。

### 已修正并复核的覆盖

- card-state-motion.css:2–5 当前给受控背包卡使用完整 `body #overlay .card.bag-page .bag-v2 .bag-tile.card-face[data-card-state-motion]` 宿主，压过 expedition-inventory.css:103–107 的旧 transform transition；不会再因较低优先级让 CSS transform 过渡混入公共运动服务。
- selection-state-motion.css:34–46 当前以完整背包宿主压过 expedition-inventory.css:37–50 的原分区 hover；正常模式只变选中绘制层，真实按钮 transform 为 none；游戏内和系统减动效均显式保留 none。
- 系统 reduce 的过渡原本已有 winter.css:27 全局 `animation:none!important;transition:none!important` 兜底。先前只比较两个局部文件而推断“OS reduce 仍有过渡”的说法不准确；真正缺口是游戏内减动效的低优先级，以及 hover 状态仍可瞬间产生静态上移。上述完整宿主修正补齐这两个缺口。

### 焦点与选中确认

- card-layout-selected.css:5–14 仅强制清除宿主 border-color / box-shadow，已不强制清除 outline。discovery-selection.css:25–39 的业务选中框属于独立子元素，并以 data-discovery-selected + aria-pressed 双状态显示，不会被宿主去边框规则抹除；焦点则由真实按钮 outline 表达。
- 战斗发现页 battle-discover.css:74 的焦点规则比公共卡面 outline 更具体，保留 3 px、10 px offset；普通发现按钮使用 discovery-selection.css:38–39 的 3 px、6 px offset。两者是不同宿主的尺寸适配，业务选中金框与键盘冷色焦点可同时存在，不互相删除。
- reward 的 card-state-motion.css:9–10、背包的 bag-design-system.css:66 均比公共卡面焦点更具体。背包模板 game.bag.view2.js:56 让真实卡片宿主接收焦点，并移除子卡的 tabindex，因此不会形成两个卡面焦点框。
- 选中移动底板仅在 data-selection-motion-ready 且非减动效时接管填色（selection-state-motion.css:21–24）；首次未测量与减动效时回落 settings-navigation.css:71–75、bag-design-system.css:23/47 的静态选中底色。底板的 pointer-events:none 不占用点击；选中项的普通 hover 填色已被 :not(.on) / :not([aria-selected=true]) 排除。
- settings-navigation.css:195–203 的 hover / active 排除 disabled、aria-disabled、aria-busy；241–242 保留按钮和输入的焦点 outline。258–264 对游戏内与 OS 减动效同时设置 animation/transition none!important，不会被分组入场 keyframe 的更高普通优先级反盖。
- battle-discover.css:75–79 对两种减动效都将卡片 hover transform 归零；系统兜底之外，游戏内 body.reduce-motion 的规则与 hover 规则等优先级且位置更后，能够生效。

### 交由卡片负责会话处理的精确遗漏

审查时 card-layout-selected.css:172 的 hsc-state-aura 呼吸只在 OS reduce（189）关闭；游戏内 body.reduce-motion 的256–258只列标题/稀有度光晕，未包含状态呼吸。interface-motion 的游戏内保护只覆盖层容器，不能替代子元素这条动画。已报告主会话并由其交卡片代理修复；本片未动源码。该项须以卡片负责会话最终修订与验证记录销账，其余所列 selector 没有发现新的明确覆盖冲突。
