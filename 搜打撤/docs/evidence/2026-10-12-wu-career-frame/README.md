# 人物职业框（2026-10-12）

老板先令制作无职业框并接入原设计网页；内置当前窗口已观察新旧同图、换金蝉脱壳、手牌尺寸与居中放大。老板认可“还可以”，随后令“不用给我看了，把职业卡都做了”。本轮已完成五人物框及共用卡面映射，完成未提交。

## 接入

无保留已认可候选SVG原字节；黑像剑盾、白塔塔尖冰晶、星月月牙枝叶、常无欲虚空眼，各有独立SVG。无人物职业卡回退neutral.svg。五个职业标记沿现有cf0..cf4，不改渲染器、卡牌数据、品质判定或存档。

card-layout-selected.css新增职业映射导入；只覆盖rv6，有效棱彩等品质继续使用原框。旧rose/frames.css、设计页HTML及他会话接入说明未改；预览只在旧JS末尾导入独立模块。

现行职业框说明独立写入docs/cards/career-frames.md；card-display.md原素框描述仍属他会话活跃占用，未覆盖。

## 验证与边界

- 6SVG XML解析、3CSS PostCSS解析、2预览JS语法通过。
- 5职业映射、全部CSS资源路径、导入顺序、rv6范围与无框候选字节相等检查通过。
- 原设计页无框已实页观察；修正放大居中与金蝉脱壳横图构图规则。最终横图构图修订及五人物正式入口未实页核验；遵老板指示不再开浏览器展示或输出截图。
- 纯SVG/CSS无Vitest、全量、build、性能AB；正式入口的不同尺寸外扩视觉仍由老板实看。未提交/推送、无新服务，复用5200。

## SVG SHA256

```text
baita.svg 3d6eafed8d9974b958cffc85d573922371af3468c8303aca4227198262fc6e04
changwuyu.svg fdcab13e06cb4a306aafed85135c51c1b33963d3c387a3725f498aa6042b3b67
heixiang.svg 58bb6492339cfed4ffd4f931a9a3a34b4388375924026c938aec67c118013ed6
neutral.svg 17cf6ea54b56ac4f054b1a3db87e8ff39a82386ccb34383fc379168929bce3b2
wu.svg 83fc8315b14f0b8e5cff9df01aa593ede1bc0439c70ae37e5d1b24afe5a97053
xingyue.svg 29cc2e5be3f6f1779011b88d2b538367eacc71e26dc6379cc7a726ea2ae7b127
```
