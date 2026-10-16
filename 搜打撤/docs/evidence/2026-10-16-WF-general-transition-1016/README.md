# 通用远征过场

战斗与首脑入口共用通用远征图及“旅途继续”文案；资源等待页使用同图全屏呈现。场次归属、资源等待、输入阻断、失败后简化显示和取消释放沿原生命周期。

## 图片

- 老板否定首轮直接内置生成的工业废墟图，未用于最终素材。
- 按后续要求改用 NAI V5 起稿，再用内置 ImageGen 按项目默认画风 v1.0 重绘。2048×1152 请求 HTTP402；1344×768 免费尺寸请求 HTTP200。完整请求见 `nai-request-v1.json`、`nai-request-v2.json`、`redraw-request.json`。
- 第一版重绘错误移除了原 NAI 左侧虚化；老板指出后，用原 NAI 作景深参考，仅修复左侧近景与远景的虚化，石门和红布条保留清晰。最终请求见 `blur-correction-request.json`，最终资产校验值见 `receipt.json`；前版收据保留 `receipt-v1.json`。
- 最终运行图：`game/assets/scenes/transition-general-1016.webp`，1672×941、148636 bytes。原始 NAI 与内置输出均超过1MB，位于根 `.tmp/nai/general-transition-1016/`，不入 Git；获取方式及 SHA256 保留在请求和收据中。

## 验证

- 5套82项定向测试通过，覆盖 battle-entry-readiness、battle-entry-view、run-architecture、contracts、architecture-boundaries。最终文案与样式调整后复验前三套41项通过；最后仅修图，复用源码验证。
- 定向 ESLint、docs:check、自有路径 diff --check 通过。
- 素材审计工作区95项错误、617项历史警告，错误含其他会话开箱帧未登记；本图 issues 为0。未更改其他资产债。最终图片替换后重新核对清单 bytes/SHA256。
- 平台：Codex 内置浏览器，地址 `http://127.0.0.1:5200/`，当前窗口1523×956，无多尺寸测试。真实输入进入档位01，恢复到既有奖励页面；未继续游戏或完整打一场战斗。
- 外观检查使用实际 `createBattleEntryGate` 挂载的构造舞台，等待依赖由CDP控制；失败后按钮使用真实定位器点击，确认 waiting→degraded、inert解除、遮幕移除。斜切图用实际 `showRunTransition` 构造，截图时将时长延为4000ms，仅验证呈现，不代表真实节点整链路通过。
- `transition-blur-final.png` 为最终恢复虚化后的等待页截图；`transition-preview.png`、`transition-fallback.png`、`node-cut-preview.png` 为前版修图之前的界面/生命周期证据。构造场景及临时DOM已释放，无新服务，原5200服务保留。未build、提交或推送。
