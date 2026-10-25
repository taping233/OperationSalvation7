# 共用转场渐进揭幕

完成未提交。老板反馈多处转场硬切，已修正共用揭幕：整层遮幕与内部插画共同退场，避免内层已经透明、外层仍遮住下一幕，直到移除才跳变。普通插画与继承场景揭幕至少680ms；照相馆已设置的760ms继续沿用。通用brief短幕保留原时长；出征/撤离专用控制器同步等待完整淡出，跳过保持140ms，减少动态保持直接完成。

范围：ui/transition-handoff.js、departure-cinematic.js；css/transition-handoff.css、silent-node-film.css；tests/held-scene-handoff.test.js；game/dev/transition-reveal-review.html。保留所有既有未提交改动。测试中的原始嵌套CSS由项目现用expandComponentScopes展开后交给jsdom，以匹配开发服务处理；未修改生产CSS编译配置。

末轮定向3文件20项通过：held-scene-handoff、departure-handoff、map-passage；两源码ESLint、两样式Stylelint、定向diff空白检查通过。初次扩展screen-entry-performance的两项旧帧数/揭幕时点断言失败，未改该文件、未确认基线归因，不宣称全量通过。一次测试尝试用esbuild直接展开CSS因jsdom的TypedArray环境冲突失败，已改用现有项目展开器，末轮全部目标通过。

当前Codex内置浏览器当前窗口（默认1280×720）：自有复核页通过真实按钮分别运行生产revealTransition的photo/camp/held，以及createDepartureCinematic的departure；下一幕采用构造色块与文字以识别遮幕是否真正透明。逐帧读取最外层opacity，四种各采到79个0.02—0.98之间的透明帧，末帧photo/camp/held为0，departure约0.000708，均随后移除自有遮幕；error/warn为空。此证据验证共用生产控制器的渐进揭幕，不代表真实存档全流程或所有页面实测。

复用现有5200服务，无新服务、安装、build、提交或推送。
