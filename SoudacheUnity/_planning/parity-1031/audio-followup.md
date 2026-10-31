# 末轮音频定向对照（2026-11-01）

当前集中验收已完成，见[本轮结果](../../../搜打撤/docs/evidence/2026-10-31-unity-parity/README.md)。以下为分片实施记录，待验/未运行等时态按记录当时理解。

状态：已完成当前可达门控、播放倍率与已确证基地成功音的最小补修，生产冻结，等待主会话集中验证。本片只读源和本地API、修改授权代码；未运行测试、Unity或播放器，没有听音比较或逐样本一致声明。

## 已核实来源和完成修改

| 条件 | 当前源 | Unity修正 |
| --- | --- | --- |
| 子页打开时通用点击/悬停静音，具名声音仍播放 | `sound.js:90–108`：overlay、sugLayer、cardZoom、打开dialog | `AudioService.IsSubpageOpen`委托在`ShouldPlay`之前拒绝click/hover；`App`绑定SuggestionBox打开或当前Panel非TitleScreen。无Panel与Title首页保留普通工具点击。不会给被抑制click登记冷却而误吞随后deny。 |
| 首页导航入口静音 | `sound.js:232–246`、`index.html`中的`.home-plate` | `CurrentHomeElements.Hit`对挂载`CurrentHomePlate`的实际首页板块跳过click；壁纸、静音、信箱等其他工具保留原声音入口。 |
| 只有foeLunge接受调用方变速 | `sound.samples.player.js:93`：foeLunge限制1..1.5，其他事件仅取cue.rate | `AudioService`按实际消费者限制倍率；删除无现行配置来源的随机rate区间解析。普通hit调用虽传倍率，当前Vite消费者会忽略，Unity不再多生效。 |
| 详情成功音 | `game.hub.pages.js:236,263,305,330,364`、`game.hub.runtime.js:379` | 保护/取消保护及Done成功各响一次ding；失败、旧owner、取消、初始攻击sha直接处理不响。 |
| 基地交易成功音 | `hub.trade-shop-v5.js:176–179,216–224` | 购入/实际出售成功后各响一次ding，武装确认与失败不响；原Log/Toast不另播放声音。 |

## 确定遗漏与声学边界

`sound.js:41–52`明确让全部短采样经过共享SFX增益、4500Hz/-4dB高频搁架，再经过threshold=-6dB、knee=8dB、ratio=12、attack=.003s、release=.18s的共享压缩器。Unity现已接正式`CurrentSfxMixer/SFX`资源：十个voice统一路由，BgmA/BgmB不进入该组；资源缺失/组不唯一明确诊断且停止SFX，不绕过总线播放。共享压缩由主会话生成的正式Mixer处理，不能换成逐声道压缩；Howler的BGM当前走HTML5，不经过该WebAudio masterComp，不能用全局AudioListener把BGM也压缩。

固定线性搁架由每voice的`CurrentSfxHighShelf`执行，沿用原AudioSource播放；同一线性滤波器可分配到求和前。实际处理内核`CurrentSfxShelfKernel`使用归一化二阶高频搁架、每声道预分配状态；原生输出采样率由AudioService主线程统一读取并计算不可变系数。配置变更只订阅一次，经现有AudioService.Update统一更新十个内核，桥没有各自Update/事件监听。主线程发布系数与原子复用重置信号，历史只由音频线程写；OnAudioFilterRead没有UnityAPI、分配或锁。

本机Unity内置共享压缩效果的Ratio上限10；主会话明确采用native10、保留source12差异，不另建播放引擎/插件。其余阈值、knee、attack、release由生成器逐项核验/回读。此片没有生成Mixer或执行原生验证，正式资源与后端差异证据由主会话归档。

现行CurrentAudioCues所有`1.5×gain×gainScale`最大为`.975`，滑条dB增益不超过1；因此原生`Clamp01`未截掉任何当前cue，不为潜在未来增益另建层。逐帧原生衰减、Unity重采样/解码、WebAudio压缩器内部包络与声道链接都不能据参数相同便声称逐样本声学等价。

原生后台继续运行而AudioService没有与`document.hidden`等价的声音暂停入口，属于待明确平台可见性映射的差异；仅失去焦点也可能仍可见，不直接将`OnApplicationFocus(false)`冒充源hidden。此片未扩写窗口/后台系统。

正式Mixer创建与可用效果由局内属地只读调查本机Unity 6000.6.7f1并编写一次性生成器；运行时仅使用公开AudioMixer/AudioMixerGroup，不反射内部Editor API。没有引入新的音频引擎或原生插件。

## 待集中验证

保留已有ShouldPlay冷却与声道策略检查；增加真实Settings/其他子页的click/hover不增加声音序列且不写click时间戳，随后deny可播、ding可播；Title往返与SuggestionBox边界；hit传1.18仍pitch1、foeLunge传.5/2分别为1/1.5，其他cue固定rate。Standalone基地的成交仅响一次、末张武装不响、关闭后旧回调不修改来源由专有HubParity覆盖。主会话维护`CurrentParityValidation.cs`，本片没有并写该文件。

搁架可直接反射实例化internal `Sdt.Run.CurrentSfxShelfKernel`，调用`SetSampleRate(int)`、`Process(float[],int)`、`RequestReset()`；48kHz长正弦低频接近0dB、高频接近-4dB，重置后零输入无残留，分块连续、左右声道独立且结果有限。检查实际Process，不另复制滤波公式。路由检查十voice共用唯一SFX组、两个BGM组为null；资源缺失时不能响未压缩声音。
