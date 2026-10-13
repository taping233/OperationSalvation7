# 选档卡片边框

老板要求参考二游补有质感的卡框。浏览明日方舟分队界面参考（https://naavik.co/deep-dives/arknights-tower-defense-redefined/）与重返未来1999设计作品（https://koikoi.me/REVERSE-1999-UI-design），并查看已有 r07-1999-roster.jpg。最终采用项目自己的冷灰金属外沿、内圈细刻线与不对称短角饰；最近游玩档位用暖金边沿，hover/focus提亮。这是结合现有配色的设计取舍，未复制外部素材。

仅追加 page-slot-select.css 卡框规则，保留上一轮卡距与信息留白。渐变外沿与内嵌亮暗线形成厚度，角饰伪元素 pointer-events:none。PostCSS 解析通过；Codex内置 http://127.0.0.1:5200/ 当前1523×956实页，真实点击进入城市查看五卡，外沿/内线/角饰可见，最近档位金色可辨。五卡无内部高度裁切，所有操作按钮均在卡内，error日志为空；截图 after.png。

未点进入档位/覆盖/删除，未核其他尺寸与完整存档行为，未跑测试套件、未build、未提交。复用5200，无新服务。
