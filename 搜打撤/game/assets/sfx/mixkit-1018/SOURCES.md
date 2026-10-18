# Mixkit成品游戏音效（2026-10-18）

本轮从 [Mixkit](https://mixkit.co/free-sound-effects/) 下载40份完整WAV，用于当前106个音效事件。选择面向界面、奖励、胜利、卡牌、兵器与法术的成品声音；老板已否决的上轮实物拼配版退出运行映射，旧文件保留。

按钮使用 `2568.wav`（Cool interface click tone，原文件0.20秒）；普通获得物品 `2020.wav`（Small win）；钱币反馈 `2021.wav` / `269.wav`；升级与成就 `600.wav`（Achievement bell）；稀有奖励 `2015.wav`（Winning chimes）；胜利与通关 `270.wav`（Fantasy game success notification）。现行映射唯一来源为 `game/src/audio/sound.samples.catalog.js`。

所有WAV保持下载原字节，不裁切、不做离线滤波或配平，仅调运行增益。原有游戏总线高频衰减、限幅、静音和并发仍生效；前摇220ms和护盾增加420ms的运行上限保留。40件素材中有候选备用，运行引用由catalog决定。

## 许可与来源

[Mixkit Sound Effects Free License](https://mixkit.co/license/#sfxFree) 明确允许用于电子游戏及商业项目，允许将音效纳入范围更大的终端产品；禁止将音效单独作为素材、工具、模板或随源码再分发。本目录音频仅作本地运行资源，不进Git，不对外发布成音效库。随游戏交付时按终端产品许可处理。

逐件标题、来源分类页、下载地址、字节数、SHA256、原时长/采样率/声道见 `docs/evidence/2026-10-18-premium-ui-sfx/receipt.json`。许可页面快照为同目录 `sources/sfx-license.html`，分类来源页为 `sources/mixkit-*.html`。同源原件获取脚本为 `download.py`；网络读取遇主站429后改用来源下载弹窗已公开的WAV CDN结构，未继续密集请求主站。

## 试听与状态

`game/sfx-audition.html?set=web&version=mixkit` 展示新版，按钮与奖励优先。仅供老板本地选样，禁止作为独立素材库公开发布。试听按相对增益播放，不包含游戏总线滤波、限幅和并发。

老板要求“不用验证，我来验证”，本轮不运行测试、构建、浏览器验收或人工听感验证；下载与接入不等于听感通过。音乐未修改。
