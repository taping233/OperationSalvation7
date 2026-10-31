# 默认桌面包：第一次最终独立实绘审查

**结论：本轮42张新实绘中确认4项需关闭的差异，已交 Root；不能将 Player1 标为整体视觉通过。** 其余已覆盖画面未发现新的确证 P1/P2。四项现已代码修复并静态复核，仍须用新构建对应画面与动作验证；不以旧图证明新补丁。

只读审查，未运行 Unity、构建、浏览器、OS输入或修改产品。本报告检查的是 `fidelity-1030/desktop-final-player-1`，不是早前 Fidelity 包的截图。

## 输入可信度和边界

- `result.json` passed，81条记录中42次真实 backbuffer capture；`process.json` exit0、无超时，实际默认 `Build/Desktop/代号柒.exe`，BuildGUID `ce4c060a81664db7bf661b9e01dae9e9`。
- 所有42张PNG直接核尺寸均为2560×1440；DPI120、D3D12/RTX3060、ScaleWithScreenSize/ScreenSpaceOverlay、CanvasScaler1.333、backbuffer scale1。宿主 zeroAlphaAndNonactivating=true，未使用OS硬件输入。Win32 visible位用于绘图，不等于宿主实际可见。
- 已独立看过全部42张新图总览；对指南长文、重编结果/失败提示/阅读器、编组头部、商店资源、结算和整档导出作7块原像素裁图复查。另直接看了商店原生参考的market/inspection；参考离屏图不替代正常Standalone。
- 读取密度分析：22个文本样本内容、字体设置和外层host不变，glyph density由1.333至2.0等，42张图尺寸一致；原像素裁图中文字清楚、中文折行和失败footer可读。此证据不是全部未覆盖文案和全部分辨率通过。
- `player1-inputs.json` 记录42张原PNG的SHA256；overview仅用作查找，`native-crop-*`均为原像素裁切，无锐化/放大/重绘。

## 确认项及关闭条件

| 项目 | 新实际证据/根因 | 本轮状态 |
| --- | --- | --- |
| P2 商店金币过小 | `player-shop`及inspection/exchange，标题金币几乎只剩一粒。active expedition-shop.css为透明留白图专设占位header48/货位36等，内部.ic为1.7倍；Native丢掉消费者补偿，用18/30字号inline icon代替 | 商店作者新增唯一专用Coin Row，六处接线并保留原sprite；只读核过参数和单/双行状态对齐。待新normal截图确认 |
| P2 大blur规则网格重影 | `player-recode-reader`中背景原卡/字形按网格重复；旧Composite在blur18用7×7、18逻辑px步距复制，不能形成源CSS Gaussian18的连续模糊 | Root只改大blur采样，复用原shader，小blur/牌堆路径保留；待新reader/设置页实际图 |
| P2 指南安全格编组说明错误 | `player-guide-more-4`将安全格与容器并称不可编组。实际source battle.lifecycle.domain.js:419与Native BattleSession.cs:467均只排stored/pouch等，未排safe | Unity `/pages/4/notes/0/text`已按具体实现纠正，领域未改，copy收据已更新；待新第5章正文 |
| P2 活跃奖励阅读器仍旧实色 | `player-card-native-density`及真正CurrentRewardTile→CurrentRewardCardZoom仍.96实色；Source chests.js:658/event-card-choice.js:124用expedition通用444.72/18%blur，hideNote=true并带领取脚注 | 作者已复用DepartureCardZoom，显式hideNote/脚注与既有命令适配。独立核过owner/receipt/run/LiveState、关闭后再Claim、旧按钮拒绝、Chest/非Chest footer。待新真实宝箱阅读/领取一次与满包返程 |

## 已区分的取证时机和源行为

- `player-shop-commission-receipt`在组件自有0.65s Arrival中途拍摄，整页alpha未回1而露出底层商店。Capture只等CurrentRunFilm，未等组件arrival；Root已加稳定等待。这是本图不足，未据此改产品过场。
- 编组共享HUD应保留。Source run-top-bar.css z-index210/height104、透明，隐藏名单不含formation；battle-decision workspace仍viewport−88居中。当前实际按钮/数字与编组标题没有字形覆盖，不能凭容器矩形相交擅自推移/隐藏。
- 受控战斗图中的白色敌人占位不作为真实敌人美术验收。测试构造的敌人、受控数值和位置不能证明普通导航/平衡；普通图素材和原始RNG另有定向证据。
- 失败截图中的文件占用警告由本轮真实隔离文件锁产生，不是普通打开页面就失败；后续截图短时仍能见到该toast，未据此误判结算持久化失败。

## 本轮原生结果复核

- shop-source-3：result passed、48记录、369输入运行前后相同，复核时当前输入也无漂移；实际库存命令/构造EventSystem pointer及submit、真实文件锁。检查覆盖成交保留/离店重试不重发、附赠一次、默认与动作异常回滚、凭据候选/投点/第二格应用失败保留/宣告分开/反馈输入防抢焦点。未证明原始商店RNG等价或1920离屏等于当前实际桌面视觉。
- slot-archive-1：result passed、五项记录、369输入稳定；真实NewRun/LoadRun、跨槽战斗checkpoint重绑、待整理结算恢复、两SaveSystem实例防旧缓存覆盖、整档损坏拒部分修复，均有明确断言。UI导入交互尚由下一次正常Standalone补取。

## 对下一次复核的要求

按新增改动定向核：金币六入口与价格不换行；大blur不再规则重影；指南安全格正确；真实奖励reader无备注、脚注选择/领取/满包动作正确、一次发卡和旧按钮拒绝；凭据arrival完全稳定；新UI整档预览默认取消/确认与返回。未变化页面可以复用本轮限定证据，不为固定次数重读/重跑。
