# SFX 共享压缩器资源生成

当前集中验收已完成，见[本轮结果](../../../搜打撤/docs/evidence/2026-10-31-unity-parity/README.md)。以下为分片实施记录，待验/未运行等时态按记录当时理解。

生成器已写好、尚未运行。统一原生阶段执行 `Sdt.Editor.CurrentSfxMixerAuthoring.Generate`，环境变量 `SDT_UNITY_CHECK_OUTPUT` 指向本轮证据目录；同步入口可配 Unity `-executeMethod` 与 `-quit`。可独立执行 `Inspect` 只写参数报告。报告为该目录的 `sfx-mixer-authoring.json`。

它先枚举并写出本机完整原生效果名、混音器效果名与每个参数的 name/description/units/displayScale/displayExponent/minRange/maxRange/defaultValue，再验证并生成 `Assets/Resources/CurrentSfxMixer.mixer`。正式路由是 Master 下的唯一 SFX 组，组内顺序为 Attenuation、Duck Volume。运行时资源名 `CurrentSfxMixer`，组名 `SFX`；十个短音效声道共享该组，BGM 的两个 AudioSource 保持不接此混音器。

本机 6000.6.7f1 的 `UnityEditor.Audio.MixerEffectDefinitions.Refresh` 托管定义说明 Sidechain Mix 是外部 sidechain 与本组 source 的检测混合；raw=1 对应 100% 外部检测。生成器将其设 raw=0、SendTarget=null，因此检测 SFX 汇总后的本组信号。关闭 wet-mix 与 bypass，所有源都先汇总再经过一个非线性压缩器。

参数使用 native raw 值并逐项即时与保存后回读：Threshold=-6dB、Knee=8dB、Attack Time=.003秒（显示3ms）、Release Time=.18秒（显示180ms）、Make-up Gain=0dB、Sidechain Mix=0。Ratio 的原生 raw 范围为 .2..10、显示单位为 % 且 displayScale=100；本轮 Root 明确采用 native Ratio=10，源 WebAudio Ratio=12。报告同时记录12与10及该原生上限，不宣称逐样本动态处理等价。

缺准确参数、单位/比例改变、实际范围不容纳请求、检测描述不符或回读失败都会写失败原因并抛错，不猜名、不静默钳制、不替换效果。此一次性入口拒绝覆盖已有资源；若创建后验证失败，报告保留 createdAssetPath，统一流程必须停下处理该未认证资源，不自动删除文件。

本轮只新增生成器、其 meta 和此说明，没有启动 Unity、生成 mixer、编译或测试。原生生成后须集中核对报告成功状态、资源GUID、10声道路由/BGM独立、源式 shelf、禁音和多声部汇总压缩；生成器不承担播放框架或每声道压缩。
