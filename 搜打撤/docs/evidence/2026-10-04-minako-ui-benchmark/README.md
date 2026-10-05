# 2026-10-04 米娜可 PV 美术 UI 基准拆解（minako-ui-benchmark）

## 这是什么

老板指定 B 站 PV《大二个人独立游戏！〈米娜可：孤注一掷！!!〉不辍学不贷款》为美术 UI 动效参考（判断：做得好，值得拆解）。本目录含：拆解证据帧 + 落地计划报告 `美术UI升级计划.md`。

- 视频：https://www.bilibili.com/video/BV1PL3c6gEKF/（UP 主 MinaKo噜，52s，源 4K，2026-07-27 发布，播放 6.3 万）
- 本地片源：`%TEMP%\BV1PL3c6gEKF-minako.mp4`（720p durl 直链下载，11.7 MB）
  SHA256 `0f8bd3154f4b14aaf435fd98b7c57e1c54023aa085d2cf0d2471553e2ccd7f0b`
- 重新获取方式（免登录 API）：
  1. `curl "https://api.bilibili.com/x/player/pagelist?bvid=BV1PL3c6gEKF"` 取 cid（当前 40340621954）
  2. `curl "https://api.bilibili.com/x/player/playurl?bvid=...&cid=...&qn=64&platform=html5&high_quality=1&fnval=1"` 取 durl[0].url
  3. 带 `Referer: https://www.bilibili.com/` 下载

## 证据帧清单（frames/）

| 文件 | 内容 | 用途 |
|---|---|---|
| sheet-1fps.jpg | 逐秒缩略总览（52 格） | 时间结构/节奏 |
| sheetA_1-9.jpg | 镜头帧 1-9（标题卡/手机UI/视觉小说） | 波普 UI 皮静态拆解 |
| sheetB_10-18.jpg | 镜头帧 10-18（面板/棋盘实录） | 场景美术+HUD |
| sheetC_19-26.jpg | 镜头帧 19-26（蓝图/建造/成果） | 建造反馈+收尾 |
| burst1_title.jpg | 0.5-6s @8fps 连续帧 | 标题入场动效逐帧 |
| burst2_ui-morph.jpg | 14-20s @4fps 连续帧 | 一镜到底 UI 变形（聊天→面板→加载） |
| burst3_cuts.jpg | 22.5-28.5s @8fps 连续帧 | 快切卡点蒙太奇 |
| burst4_build.jpg | 40-52s @6fps 连续帧 | 蓝图→城市生长（剪辑加速/倒放） |
| scene-01..25.jpg（14 张） | 原生 1280×720 关键帧 | 细部参考 |

拆解方法：yt-dlp 旧版解析失败 → B 站开放 API 直链下载 mp4 → ffmpeg 场景检测（26 镜头，阈值 0.22）+ 逐秒/逐段抽帧 → AI 视觉逐帧分析 × 8 张 + 会话内整片观看交叉确认。

## 局限（引用本证据时须知）

1. **音频盲区**：BGM/配音/音效与卡点是否同步未验证（无音频分析）。
2. **AI 视觉读帧**：视觉结构/动效模式结论多源交叉、置信度高；帧内具体文字内容（UI 文案、标题拼写）置信度低，不作依据。
3. **画质**：分析用 720p，源 4K；像素级细节（材质纹理、抗锯齿）不可辨。
4. **版权口径**：PV 帧仅作内部参考证据，只借形制不搬素材（同 onetake PolyForm 先例口径）。

## 结论入口

→ `美术UI升级计划.md`（全维度对照 + 批次计划 + 验收标准；PENDING #37 待拍板）
