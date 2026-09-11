# 字体资产（Godot 版）

来源与许可（全部 OFL，允许随软件分发）：

- `NotoSansSC-VF.ttf`：Noto Sans SC 全量可变字体（wght 100-900，30,890 字形），
  复制自本机 `C:\Windows\Fonts\NotoSansSC-VF.ttf`。已设为 `project.godot` 默认主题字体
  （`gui/theme/custom_font`）；粗体用 FontVariation wght=700（`ThemeTokens.NotoBold`）。
- `cascadia-code-400/700.woff2`：Cascadia Code 等宽子集，复制自网页版
  `搜打撤/game/assets/fonts/`（只读源）。ASCII 全覆盖（119 字形，0 缺字），
  用于数字/英文角标（`ThemeTokens.Mono/MonoBold`）。

## 子集缺字检查结论（2026-09-12，wave1-B）

网页版 `notosans-sc-400/700.woff2` 子集（1,692 字形）按游戏高频文本核对：
样本 = 搜打撤/game/data/*.json（cards-sync/achievements/pets/map/scenes 全量字符串）
+ src/characters.js 中文字符串 + SoudacheGodot src/**/*.cs 全部中文字符串。
样本唯一 CJK 字符 860（游戏侧）+ 572（Godot UI 侧）。

**结果：缺 38 字**（游戏侧 34：企养劫勿厉咕哨嘎国堂孵峙桃棱母汪浩烛犀狗猫督秣织肃葵蛋财邦雪马驯鸦鹅；
Godot UI 侧另有 扉栗翎训靶）——宠物/成就文本（蛋孵驯猫狗等）明显是子集建成后新增的。
按 HANDOFF §7 风险 2 口径「缺字换全量字体」处理：弃用 Noto 子集，改用上面的全量 VF。
全量字体对上述 union 缺字复检为 0。原 woff2 子集已从本目录移除（网页版原件未动）。
