# 移除出征整备人物横栏

按老板截图删除人物缩略图、名字和“更换人物”按钮所在横栏，同时去掉100px专用网格行，避免顶部留下空白。仓库候选和携带区沿原两列填满内容。顶部“返回人物选择”及02人物步骤入口保留。

仅修改game/src/hub/game.hub.depart.js、game/css/departure-selected.css；去掉人物条渲染，不更换或删除任何素材，其他图片选择器与路径沿用。修改前副本.tmp/depart-person-bar-remove-1025/before/。按老板持续要求未验证、测试、静态检查、实页或构建；未提交或推送。

## 后续：移除推荐装配按钮排

按老板新增截图移除“预览推荐装配 / 应用预览 / 撤销推荐”整排按钮。推荐控件同步在面板不存在时直接返回，保留手动选牌与既有业务接口。仅改game/src/hub/game.hub.depart.js；修改前副本.tmp/depart-recommend-bar-remove-1025/before.js。按要求未验证，未提交。
