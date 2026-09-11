namespace Soudache;

// ported from 搜打撤/game/src/narrative.js parseChoice 返回结构：
// { label, effect, detail, tone } —— label 为玩家可见选项文本，
// 其余三项来自选项文本内隐藏的 @@key=value@@ 元数据。
public readonly record struct NarrativeChoice(
    string Label,
    string Effect,
    string Detail,
    string Tone);
