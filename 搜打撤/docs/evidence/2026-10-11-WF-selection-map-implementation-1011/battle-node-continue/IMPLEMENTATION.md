# 战斗与节点续作 2026-10-11

已实施：三列明确格位。左列当前能量与职业技能上下陈列；中央手牌跨两行；右列背包/设置/撤离和结束回合跨两行。根因是旧 `.sts-hand`、`.sts-hand-tools` 均 `grid-column:2; grid-row:1`，`.sts-tactics` 仍第三列，而重构只设置四列模板。由本域高特异性最终规则明确覆盖格位、宽度、负margin、对齐；未触全局缩放。

附加界面：设置选项网格、清楚checkbox点击区；选择/发现/支付卡网格允许wrap；可操作卡键盘焦点。既有支付/消耗/发现/抉择/编组/牌库/墓地/战斗背包展示结构与业务保留。

奖励：真实Cards.rarityOf输出的data-reward-rarity作为等级字样，史诗/传说/棱彩陈列216px、普通190px；高稀有标题更大。卡名仍只由卡面显示，抽取、授予与容量不改。

商店：批准WebP未编辑。货位仅下部价签承托文字；收购服务移除旧hover位移/厚阴影与内双框，补服务/返回焦点。

场景守卫：四decode全部完成后再启层，同时核捕获world/front引用、stage._battleToken、DOM连接、overlay未隐藏和四图naturalWidth。防旧Promise在同token重挂时启用新层。四URL仍空，冬季素材由根代理制作；五箱接口仍待map_chest素材。

验证：3CSS PostCSS解析、battle.view.js node --check与ESLint、目标git diff --check通过；直接Vitest三文件22项通过（battle-hand-selection-rules、sys03-loot-shop-txn、chest-click-flow）。未build、未提交、未启服务、未操作浏览器。一次Python写入因旧版本不支持Path.write_text newline参数失败，随后open newline修正，未污染文件。

待根当前窗口：普通战6/12叠中央手牌、技能不压卡、结束回合独立右列；首脑牌堆与编组；全部战斗附加面板；商店九货位5/4及收购服务；混合高稀有奖励、逐张收取/容量满。静态验证不是视觉通过。

根当前IAB 1280×720 / dpr1.25 已确认三组操作台成立，截图continue-current-window/01-battle-layout.png。反馈浮动背包盖住结束回合；已补仅可见战斗主壳或battle-decision附加壳时隐藏#bagBtnFloat。地图和其他面板不匹配该规则。CSS解析/diff-check通过，消失后的实页由根复核。

四冬季景层已接入 `battle.view.js`，通过new URL相对模块定位runtime，canvas比例1672/941、footLine=.74。四份runtime SHA256逐项匹配winter-layer-continue/assets-receipt.json；未修改图像。四decode完成检查新增UI._lastMode==='battle'；旧Promise身份、token、connected、hidden守卫保留；resize/模式/隐藏/HMR清理均在。JS语法/ESLint/diff-check通过。真实脚线、合成遮挡与天气效果待根IAB当前窗口，不以静态检查代替。

根实页09-battle-winter-layers.png确认四层真实加载1672×941、同rect、前景z7/unitFramesz6、脚线承托成立；发现world越界覆盖topbar。已仅对world增加按arena坐标计算clip-path:inset，上下左右超出部分精确裁边，不裁整个arena；topbar单独z9，arena保持overflowvisible供actor/意图/目标越界。四图共享原等比变换与前景UI mask不变。

五族候选已接：small/medium/large/class/boss均640²18frames、24fps，90运行文件存在核对通过。各帧使用静态new URL供Vite正确识别。仅renderSearch当前族创建Image并decode，不warm所有族、不retain帧缓存；搜索780ms结束而decode未齐时等待，同一context解码完成才开帧。skip/reduced/turbo直接结果；跨箱/模式/隐藏/suspend/HMR使旧context失效，旧Promise不启动；解码失败安全进入实际结果。先接三族阶段2文件19项通过（sys03-loot-shop-txn/chest-click-flow），随后class/boss仅相同配置扩充，ESLint/90文件存在/diff-check通过。全部为根允许接入的候选，非老板美术批准。当前真实播放、其余四族联系板及顶栏修复由根IAB核。

当前窗口设置/空战斗背包短壳反馈已处理：仅设置或不含任何battle-bag-slot的空背包标记battle-decision-compact，900px紧凑宽度、高度自动；内容与短footer主按钮居中。长卡列表/支付/牌库保持原滚动与固定footer。商店已有内置整理背包，仅可见shop-pg隐藏浮bag；奖励没有内置背包按钮且满容量需腾格，保留浮bag移至上缘top84/right24，避开固定收取操作。ESLint、CSS解析与目标diff-check通过，实际结果待根同步IAB。

已给根现行真实卡触发入口：付款铸甲+装备或快意恩仇+两初始攻击；发现神秘召唤；注能镭射/龙焰射线；抉择花开两面；选牌施放剑荡妖邪/复制深红丝袋主动技能。独立act=consume文本路径存在，但现行铸甲/快意恩仇已走structured requirements付款，未发现能保证由现行库单独触发consume的卡，不改业务制造入口。开发者无存档testRun：在棋盘Ctrl+L调试搜索卡点结果grantCard后关闭，用现有强制遭遇战重新开战；战斗中先直接胜利辅助/领奖回棋盘再发卡，记录开发者真实输入和辅助边界。强制BOSS自动确认编组，编组应走祭坛实际入口。
