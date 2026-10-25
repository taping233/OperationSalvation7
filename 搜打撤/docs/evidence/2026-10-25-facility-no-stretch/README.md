# 建设页去掉竖向拉伸

建设页外层取消旧camp-page-in与通用弹层入场；设施展示区由portrait动效分类改为content，不套人物放大。设施导航、展示与详情固定--page-y为0、--page-scale及独立scale为1，保留既有基地横向平移动效。

仅修改game/css/base-archive-facilities-v12.css、game/src/ui/page-motion-profiles.js。修改前副本.tmp/facility-no-stretch-1025/before/。按老板持续要求未验证，当前为已实现待实际查看；未构建、提交或推送。

## 后续：庭院同类拉伸

庭院外层page-in与通用弹层入场停用，courtyard-v3-scene从portrait移到content，标题、景观选择、水面和工具组件固定竖向位移0及缩放1，保留横向滑动。未改画布尺寸、锦鲤/投喂/雨景逻辑。仅改base-courtyard-v3.css与page-motion-profiles.js；修改前副本.tmp/courtyard-no-stretch-1025/before/。按老板要求未验证，未提交。
