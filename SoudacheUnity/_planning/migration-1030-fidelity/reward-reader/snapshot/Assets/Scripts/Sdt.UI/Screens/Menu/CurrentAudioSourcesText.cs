namespace Sdt.UI.Screens.Menu { internal static class CurrentAudioSourcesText { public const string Value = @"# Battle SFX 来源与许可档案

> 2026-10-04 老板令「音效全部换成开源版，不要用明日方舟改的那版」：核心 27 件整体替换为可查证 CC0 来源
> （原 27 件为 9-06 快照入库，无逐文件来源档案；原件备份于
> `docs/evidence/2026-10-04-sfx-opensource/originals-replaced-2026-10-04/`，git 历史亦可回溯）。
> 处理链：静音修剪 → 48kHz 立体声重采样 → 时长对齐 → RMS 对齐被替换原件（保持混音平衡）→ 峰值限幅 -1 dBFS →
> libvorbis q5。逐件处理数据见 `docs/evidence/2026-10-04-sfx-opensource/processing-report.json`。
> 本目录内全部文件均为 CC0 1.0（https://creativecommons.org/publicdomain/zero/1.0/），可商用，署名可选。

## 核心池（2026-10-04 替换，27 件）

| 文件 | 语义 | 来源素材 | 来源包（均 CC0） |
| --- | --- | --- | --- |
| `hit-1.ogg` | 攻击命中 | `bfh1_metal_hit_02.ogg` | [75 CC0 breaking / falling / hit sfx](https://opengameart.org/content/75-cc0-breaking-falling-hit-sfx) · rubberduck |
| `hit-2.ogg` | 攻击命中 | `bfh1_hit_07.ogg` | 同上 |
| `hit-3.ogg` | 攻击命中 | `bfh1_metal_hit_04.ogg` | 同上 |
| `hit-4.ogg` | 攻击命中 | `bfh1_hit_10.ogg` | 同上 |
| `hurt-1.ogg` | 我方受伤 | `creature_hurt_01.ogg` | [80 CC0 RPG SFX](https://opengameart.org/content/80-cc0-rpg-sfx) · rubberduck |
| `hurt-2.ogg` | 我方受伤 | `creature_hurt_02.ogg` | 同上 |
| `parry-1.ogg` | 格挡 | `sword-clash-03.wav`（裁 0.17s） | [Fantasy Sound Effects (Tinysized SFX)](https://opengameart.org/content/fantasy-sound-effects-tinysized-sfx) · Tinysized / vehiclemusic.eu |
| `parry-2.ogg` | 格挡 | `sword-clash-05.wav`（裁 0.13s） | 同上 |
| `curse-1.ogg` | 诅咒 | `spell_01.ogg`（裁 0.22s） | [80 CC0 RPG SFX](https://opengameart.org/content/80-cc0-rpg-sfx) · rubberduck |
| `curse-2.ogg` | 诅咒 | `spell_fire_07.ogg`（裁 0.22s） | 同上 |
| `heal-1.ogg` | 治疗 | `vial-glass-uncork-01.wav` | Fantasy Sound Effects (Tinysized SFX)（同上） |
| `heal-2.ogg` | 治疗 | `water-pour-01.wav`（裁 0.6s） | 同上 |
| `heal-3.ogg` | 治疗 | `water-drop-01.wav` | 同上 |
| `chestshake-1.ogg` | 宝箱摇动 | `cloth-pouch-shake-02.wav`（裁 0.32s） | 同上 |
| `chestshake-2.ogg` | 宝箱摇动 | `bottle-pills-shake-01.wav` | 同上 |
| `chestburst-1.ogg` | 宝箱爆开 | `bfh1_wood_breaking_03.ogg` | 75 CC0 breaking / falling / hit sfx（同上） |
| `chestburst-2.ogg` | 宝箱爆开 | `bfh1_breaking_02.ogg` | 同上 |
| `chestburst-3.ogg` | 宝箱爆开 | `bfh1_glass_breaking_02.ogg` | 同上 |
| `reveal-1.ogg` | 开箱揭晓 | `item_gem_01.ogg` | 80 CC0 RPG SFX（同上） |
| `reveal-2.ogg` | 开箱揭晓 | `item_gem_03.ogg` | 同上 |
| `reveal-3.ogg` | 开箱揭晓 | `item_gem_04.ogg` | 同上 |
| `legend-1.ogg` | 高稀有惊喜 | `jingles_HIT01.ogg` | [Music Jingles](https://kenney.nl/assets/music-jingles) · Kenney（包内 License.txt） |
| `legend-2.ogg` | 高稀有惊喜 | `jingles_HIT03.ogg` | 同上 |
| `legend-3.ogg` | 高稀有惊喜 | `jingles_HIT07.ogg` | 同上 |
| `victory-1.ogg` | 胜利 | `jingles_HIT02.ogg` | 同上 |
| `victory-2.ogg` | 胜利 | `jingles_HIT05.ogg` | 同上 |
| `defeat-1.ogg` | 败北 | `jingles_STEEL00.ogg` | 同上 |

来源文件原件留档（SHA256 与许可页快照）：
- rubberduck 两包：`docs/evidence/2026-09-30-sfx-alternatives/C-cc0-action/materials/{rubberduck-breaks,rubberduck-rpg}/`，页面快照同目录 `*-source.html`；
- Tinysized：同 `…/materials/vehicle-tinysized/`（含原作者 readme.txt，CC0 声明）；
- Kenney Music Jingles：`docs/evidence/2026-10-04-sfx-opensource/sources/music-jingles/`（含 License.txt；zip >1MB 留本地不入 git）。

## Kenney Casino 实录池（09-20 65a31f7 入库，保留未动，9 件）

`draw-1..4.ogg`（cardSlide×4）、`shuffle-1.ogg`（cardShuffle）、`cardPlace-1..4.ogg`（cardPlace×4）
来自 [Casino Audio](https://kenney.nl/assets/casino-audio)（CC0），当时认证据 `assets/sfx/kenney-license.txt`（Impact Sounds 附带件）与提交记录；归档源见 `B-cc0-ui/sources/casino-audio__*.ogg`。

## additions（保留未动，4 件）

`additions/card-select.ogg`（Interface Sounds/select_001）、`additions/card-discard.ogg`（Interface Sounds/drop_001）、
`additions/shield-up.ogg`（Sci-fi Sounds/forceField_000）、`additions/kill-impact.ogg`（Sci-fi Sounds/explosionCrunch_000）
—— Kenney CC0，逐件许可档案见 [additions/SOURCES.md](additions/SOURCES.md)。

## 本目录不含的内容（sfx 根与 jsfxr，均无许可负担，保留未动）

- sfx 根 17 件 wav（click1-5 / rollover1-6 / switch1-6）：Kenney [UI Audio](https://kenney.nl/assets/ui-audio)（CC0），
  见 `assets/sfx/LICENSE.txt`（GitHub 镜像：`Calinou/kenney-ui-audio`）。
- `jsfxr/` 5 件 wav（pickup/confirm/error/levelup/hit）：本项目 jsfxr 管线程序化自产（非第三方素材）；
  `sound.js` 注释所引 `scripts/jsfxr-generate.cjs` 现不在库（仅记录，未动代码）。
"; } }