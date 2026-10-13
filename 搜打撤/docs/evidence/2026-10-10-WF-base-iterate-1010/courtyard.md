# 听雨与锦鲤庭院

状态：实现待接入、待内置浏览器当前窗口复核。基地壳接入与台账由主会话维护。

老板新增需求是从 GitHub 找雨景与锦鲤池塘，作为基地独立空间。已从明确 MIT 许可的两个仓库提取本地核心，不安装包，不运行上游脚本，不编译桌面程序，不嵌外网。

## 许可和路线

- [rubenvieira/rain-simulator](https://github.com/rubenvieira/rain-simulator/tree/2f3390cd4ccb4e898856dea4ddb8c6d635a90553)：MIT，Copyright 2026 Ruben Vieira。雨滴模拟和 Canvas 渲染两核心无运行时依赖；用现有 esbuild 剥离 TS 类型后作为本地 ESM。
- [rzrabbi/interactive-koi-pond](https://github.com/rzrabbi/interactive-koi-pond/tree/d8e2b1527630dfb4cccf646c0d8266cd95e2bb4f)：MIT，Copyright 2026 Rezaye Rabbi (RzX)。程序锦鲤核心纯原生 Canvas；包装成实例，移除上游全局监听、桌面壁纸桥与自动动画。
- Binix 的 README 标注 MIT，但无独立 LICENSE 且列了 Shadertoy 来源；nagomi 使用 PolyForm Noncommercial；另外两个锦鲤候选没有明确许可证。本轮未接这些候选。

原始源码仅保存于本会话临时目录 `C:/Users/太平/AppData/Local/Temp/WF-courtyard-1010/`，不纳入项目。项目只留审核后的核心、原始许可和 [来源记录](../../../game/assets/vendor/base-courtyard/SOURCE.md)。

## 接入

`courtyardV3HTML(view)` 返回独立页，view 为 `rain` 或 `koi`。`mountCourtyardV3(root, view)` 在已挂载内容中启动该实例，并返回可重复调用的 dispose；基地每次重绘或离开庭院前须调用旧 dispose。导入 `base-courtyard-v3.css`，不混入旧侧栏。

听雨页提供细雨/大雨、声音、暂停；雨滴可点击生成。背景引用项目现有 greenhouse 原画，远景模糊，按钮不模糊。锦鲤页提供投喂、声音、暂停；点击水面投喂并产生涟漪，锦鲤追逐食物。场景不消耗游戏口粮或改存档。

音频初始关闭，仅手动创建；隐藏页面与暂停会挂起，离页关闭。减少动效时静态呈现，不发出持续 RAF；静态画面仍可点击出现雨滴或食物。像素宽度有预算上限，未对其他窗口尺寸进行验收。

## 验证

已通过：4 个 JavaScript 文件的 `node --check`；主接入模块和专属测试的 ESLint；`node node_modules/vitest/vitest.mjs run tests/hub-courtyard-v3.test.js --reporter=dot`，1 文件、4 测试通过，覆盖单 RAF、默认无音频、暂停/恢复、隐藏页、减少动效、真实控件对应投喂、重复销毁及手动音频关闭。测试的 Canvas 核心使用 mock，验证生命期和入口，不冒充视觉结论。

另外对实际本地 RainSimulation、RainRenderer、KoiPond 核心运行 500 帧无 DOM 绘制烟测，以轻量 Canvas API mock 接收绘制调用；雨滴坐标均为有限数，锦鲤 render/tap/resize/dispose 无异常。此烟测证明核心调用可完成，不证明真实画布外观或性能。

vendor 静态检查无外部脚本 import、fetch、window 全局监听或自动 requestAnimationFrame；只保留 RainRenderer 内创建离屏 canvas 的 document.createElement。原 LICENSE 保留字节内容，来源固定提交写在 SOURCE.md。没有执行上游 install/build 或任何仓库脚本。

未核项：实页外观、雨滴透明/折射、鱼体运动、声音听感、真实输入以及接入离页销毁由主会话使用当前窗口内置浏览器验证。本子任务不启动游戏服务、不操作游戏 tab、不 build、不提交。
