# 音效全量换开源（WF-sfx-opensource-1004）

<!-- cleanup-status-20261019 -->
> 2026-10-19清理后提示：本报告及本目录附件记录当时状态，其中提及的旧资源、旧音频实现或旧交付路径可能已按批准清单删除。“保留原文件/保留旧包”不代表今天仍可访问。当前保留包、替代入口与执行回执见[清理后状态](../../CLEANUP-STATUS.md)；下文历史验收结论与原始内容保持。


- 老板令（10-04）：「音效改为开源版，不要用明日方舟改的那版」「把现在的所有音效全部换成开源的即可，你可以自己去 github 上面找」。
- 会话：Friday（ZCode 本会话）。属地与登记：PARALLEL-REGISTRY 活跃行同名；无服务、无 build、未提交。

## 结论

现役发声链 `game/src/audio/sound.js` 的战斗/开箱采样池共 40 件 ogg：核心 27 件（hit/hurt/parry/curse/heal/chestshake/chestburst/reveal/legend/victory/defeat）9-06 快照入库、无逐文件来源档案，已**整体替换为可查证 CC0 来源**；另 13 件（draw/shuffle/cardPlace 9 件=Kenney Casino、additions 4 件=Kenney Interface/Sci-fi）原有 CC0 档案，保留未动。sfx 根 17 件 wav（click/rollover/switch）=Kenney UI Audio CC0（`sfx/LICENSE.txt` 在案），jsfxr 5 件=项目管线自产——均保留。**零代码改动**（sound.js 按固定路径取文件，同名覆盖即全量生效）。

## 替换明细

逐件「目标文件 → 来源素材 → 来源包 → 处理参数 → 旧件对照」见 `game/assets/sfx/battle/SOURCES.md`（许可档案唯一入口）与 `processing-report.json`（数字）。来源包四种，全部 CC0 1.0：

- 75 CC0 breaking / falling / hit sfx · rubberduck（OpenGameArt）——hit×4、chestburst×2（hit-2/4 与 chestburst-1/2/3 实取）
- 80 CC0 RPG SFX · rubberduck（OpenGameArt）——hurt×2、curse×2、reveal×3
- Fantasy Sound Effects (Tinysized SFX) · vehiclemusic.eu（OpenGameArt）——parry×2、heal×3、chestshake×2
- Music Jingles · Kenney（kenney.nl 官方直链下载）——legend×3、victory×2、defeat×1

源文件留档：rubberduck×2 与 Tinysized 在 `docs/evidence/2026-09-30-sfx-alternatives/C-cc0-action/materials/`（含页面快照）；Music Jingles 在本目录 `sources/music-jingles/`（License.txt + Hit jingles 全池 17 件）。kenney 两 zip 留本地不入 git，SHA256 见 `sources/sha256.txt`。Interface Sounds 包下载核验后未选用（已删解压树，zip 留本地）。

## 处理链（reproduce-process.py 可复跑）

静音修剪(-45dB) → 48kHz 立体声重采样 → 时长对齐（原槽位 ±，硬切加 8ms fade）→ RMS 对齐被替换原件中位（保持 BATTLE_GAIN 混音平衡）→ 峰值限幅 -1 dBFS → libvorbis q5。输出峰值全部 ≤ -0.8 dBFS。

## 验证（2026-10-04）

1. ffmpeg 全量解码：battle 40/40 OK。
2. 资产清单重登记 27 条（bytes+license 指向 SOURCES.md）；`asset-audit --check` 本 27 件 0 报错，历史 1162 警告未变。
3. 定向测试：tests/sound-bank.test.js 绿；tests/asset-audit.test.js 1 例失败=**预存在**（5 件 `ui/home-v2/*.webp` 他人未登记素材 unlisted，与本任务无关，未动）。
4. 内置浏览器实页（127.0.0.1:5200 现役服务）：页面正常加载；页面上下文 fetch 27/27=200 audio/ogg；WebAudio `decodeAudioData`（与 sound.js 同链路）27/27 解码通过。
5. 听感验收待老板：进战斗打一场（命中/受伤/格挡/出牌/抽牌/洗牌/胜负句）+开一次宝箱（摇动→爆开→揭晓/高稀有）。

## 待老板决策（已登记 PENDING）

- 休眠的明日方舟衍生资产仍在库（不接入任何运行链路）：`game/assets/sfx/alternatives/arknights{,-adjusted,-expansion,-runtime}/` 共 188 ogg + `docs/evidence/2026-09-30-sfx-alternatives/A-arknights/originals/`（方舟原音频 3 wav）与 A/A2 processed-wav——删除或保留请拍板（删除另需按规审批清单）。
- 若个件听感不满意：Hit jingles 全池 17 件与四包原素材都在证据目录，可指定单件重选重做，不影响其余。
