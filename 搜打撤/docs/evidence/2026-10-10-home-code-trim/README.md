# 首页冗余代码清理

2026-10-10，老板要求清理首页冗余前端代码。本轮限定当前首页顶部横带与壁纸重复声明，不删除文件。

依据与改动：

- index.html原横带两组共六份标题，home-polish.css将第二组及第一组后两份display:none；改为一份标题，同时移除隐藏多副本的规则。
- title-p0.css旧homeBandScroll被home-polish.css同一顶部横带animation:none覆盖，全文引用仅此；删除旧动画声明、关键帧和只服务该动画的暂停规则。横带宽度与flex收敛到现行auto/none。
- 横带早期字体、颜色与字距被title-p0.css同特异性后置视觉系统及home-polish.css高特异性规则覆盖，去早期声明。
- home-polish.css早期homeDrift 72s被后面的48s+homeWake完整覆盖；仅保留现行声明，合并到壁纸主体规则。

按静态级联依据保留现行外观：胶片颗粒、斜边黄线、壁纸视差、菜单悬停/点击与各入口动作未改。沿用老板免检测要求，未测试、未实页、未build、未提交；运行效果未复核。
