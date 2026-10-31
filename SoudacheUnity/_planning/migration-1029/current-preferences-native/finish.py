from pathlib import Path
exec((Path(__file__).parent/'prepare.py').read_text(encoding='utf-8'))
def new(path,text):
 dest=draft/'candidate'/path;dest.parent.mkdir(parents=True,exist_ok=True);dest.write_text(text,encoding='utf-8')
new('Assets/Scripts/Sdt.UI/Kit/CurrentNativePerformance.cs','''// Native consumers of the current performance-settings.css named decorative layers.
namespace Sdt.UI.Kit
{
    public static class CurrentNativePerformance
    {
        public static bool Available => true;
        public static bool Low => CurrentUiPreferences.Quality == "low";
        public static bool High => CurrentUiPreferences.Quality == "high";
    }
}
''')
new('Assets/Scripts/Sdt.UI/Kit/CurrentReadingPreference.cs','''// review-ui.css and card-layout-selected.css: only explicitly bound reading surfaces.
using UnityEngine;
using UnityEngine.UI;

namespace Sdt.UI.Kit
{
    [RequireComponent(typeof(Text))]
    public sealed class CurrentReadingPreference : MonoBehaviour
    {
        Text _text;
        int _baseSize;
        float _baseSpacing, _lastScale = -1;
        bool _body;
        public static void Bind(Text text, bool body = true)
        {
            var view = text.gameObject.AddComponent<CurrentReadingPreference>();
            view._text = text; view._baseSize = text.fontSize; view._baseSpacing = text.lineSpacing;
            view._body = body; view.Apply();
        }
        public static bool CardZoom(Transform target)
        {
            for (var at = target; at != null; at = at.parent)
                if (at.name == "cardZoom" || at.name == "inventory-zoom" || at.name == "reward-cardZoom") return true;
            return false;
        }
        void OnEnable() { CurrentUiPreferences.Changed += Apply; }
        void OnDisable() { CurrentUiPreferences.Changed -= Apply; }
        void LateUpdate()
        {
            // A card's existing zoom transform is applied after CardFace.Create.
            if (_text != null && !Mathf.Approximately(_lastScale, Scale())) Apply();
        }
        float Scale()
        {
            var canvas = GetComponentInParent<Canvas>();
            return canvas == null ? 1 : Mathf.Max(.01f, Mathf.Abs(transform.lossyScale.y / canvas.transform.lossyScale.y));
        }
        void Apply()
        {
            if (_text == null) return;
            _lastScale = Scale();
            bool large = CurrentUiPreferences.ReadingLarge;
            _text.fontSize = large ? Mathf.Max(1, Mathf.RoundToInt(26 / _lastScale)) : _baseSize;
            _text.lineSpacing = large && _body ? 1.7f : _baseSpacing;
            LayoutRebuilder.MarkLayoutForRebuild(_text.rectTransform);
        }
    }
}
''')
# Do not apply reading-large to #tooltip, inventory-zoom-rules, photo rules, names or controls.
candidate(targets[5],[('description.lineSpacing=1.1f;','description.lineSpacing=1.1f;\n            if(CurrentReadingPreference.CardZoom(face))CurrentReadingPreference.Bind(description,false);')])
candidate(targets[3],[('copy.lineSpacing = 1.65f;','copy.lineSpacing = 1.65f; CurrentReadingPreference.Bind(copy);')])
candidate(targets[4],[('foreach (string entry in _entries) UIKit.IconText(scroll.transform, entry).fontSize = 20;','foreach (string entry in _entries) { var copy = UIKit.IconText(scroll.transform, entry); copy.fontSize = 20; CurrentReadingPreference.Bind(copy); }')])
dialogs='Assets/Scripts/Sdt.UI/Screens/Menu/CurrentSettingsDialogs.cs'
candidate(dialogs,[('CurrentSettingsPage.Copy(_card,message,22,124,"#C4D0DA");','CurrentReadingPreference.Bind(CurrentSettingsPage.Copy(_card,message,22,124,"#C4D0DA"));'),('_resolved=false;CurrentSettingsPage.Copy(_card,error,18,60,"#E7BBC2");','_resolved=false;CurrentReadingPreference.Bind(CurrentSettingsPage.Copy(_card,error,18,60,"#E7BBC2"));')])
inbox='Assets/Scripts/Sdt.UI/Screens/Menu/HomeInboxDeleteDialog.cs'
candidate(inbox,[('E.Text(card,"description","删除后无法恢复，可先导出这条留言。",22,E.Hex("#C1CBD4"),24,84,572,86);','CurrentReadingPreference.Bind(E.Text(card,"description","删除后无法恢复，可先导出这条留言。",22,E.Hex("#C1CBD4"),24,84,572,110));')])
# This native selector describes the consumers that actually exist; browser canvas/cache are not promised.
settings=draft/'candidate'/targets[2]
text=settings.read_text(encoding='utf-8').replace('"减少光效，节省性能。":CurrentUiPreferences.Quality=="high"?"精细画面，完整光效。":"画质与性能均衡。"','"关闭标题雪雾与光束，静止装饰呼吸。":CurrentUiPreferences.Quality=="high"?"保留标题完整光效、雾雪与装饰呼吸。":"保留标题光效与远雪，减少近雪和雾层。"')
settings.write_text(text,encoding='utf-8')
for p in [dialogs,inbox]:receipt['productionFreeze'][p]=sha(root/p)
(draft/'receipt.json').write_text(json.dumps(receipt,ensure_ascii=False,indent=2),encoding='utf-8')
# Fail closed if a production owner changed a candidate since its inspected baseline.
for p,h in receipt['productionFreeze'].items():assert sha(root/p)==h,p
for path in (draft/'candidate').rglob('*.cs'):
 relative=path.relative_to(draft/'candidate');dest=root/relative
 if dest.exists():assert str(relative).replace('\\','/') in receipt['productionFreeze'],relative
 dest.write_bytes(path.read_bytes())
(draft/'production-freeze.json').write_text(json.dumps({str(p.relative_to(root)).replace('\\','/'):sha(p) for p in [root/x.relative_to(draft/'candidate') for x in (draft/'candidate').rglob('*.cs')]},indent=2),encoding='utf-8')
print('Applied and froze native preference consumers')
