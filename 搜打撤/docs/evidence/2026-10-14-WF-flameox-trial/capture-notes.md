# 采集复现说明

在当前 Codex 内置浏览器打开 `http://localhost:5200/?perfProbe=1`，不调整窗口。使用 tab 的 cdp capability：Profiler.enable → Profiler.setSamplingInterval({interval:1000}) → Profiler.start → UI 操作 → Profiler.stop，保存返回 profile 对象为 .cpuprofile。动作包括标题空闲、打开照相馆、武术/全部分类切换。初次打开和空闲 CPU 区间包含模型/工具往返等待，不能把整个区间当成动作耗时。

探针通过真实按钮输入选择「测当前页面」或「测受控平移」，待状态从采样中变为 JSON 后保存 #vitePerfResult 的文字。受控平移不是手动拖动。

地图与战斗采用 127.0.0.1 来源，把 localStorage 复制到 Map 并仅在该标签页重定义 window.localStorage 为 getItem/setItem/removeItem/clear/key/length 的内存实现；原对象另存于窗口，只读取用于前后内容比较。通过现有档位载入副本，再使用现有 battle 剧本构造测试战斗。导航离开即撤除隔离，不回写测试副本。

背景计时：暂时包装 SDT.UI._checkPageBg，调用原方法前后 performance.now()，finally 写入 name/start/durationMs。PerformanceObserver({entryTypes:['longtask']}) 记录 start/duration。三次真实按钮开关照相馆后读取记录，不改变原方法返回值。

尺寸计时：暂时包装 HTMLElement.prototype 的 offsetWidth/offsetHeight/offsetTop/offsetLeft 与 Element.prototype 的 clientWidth/clientHeight 可配置 getter，以及 window.getComputedStyle；保留原 descriptor/原函数，调用原方法前后计时，仅超过 1 ms 时保存 Error().stack。真实打开照相馆并切换武术/全部分类，保存记录。getter 包装不会修复或跳过布局，也不是性能 A/B。

结束时还原原函数/descriptor、断开观察者、Profiler.disable 并关闭本会话标签页。没有留下页面全局修改。存档前后原文仅在缓存本地保存，报告只保存其 SHA 与相等结论。
