from pathlib import Path
import hashlib,json
p=Path(__file__).resolve().parent;root=p.parents[3]
sha=lambda f:hashlib.sha256(f.read_bytes()).hexdigest()
production='Assets/Scripts/Sdt.UI/Screens/Run/CardFace.cs'
text=(root/production).read_text(encoding='utf-8-sig')
old='if(CurrentReadingPreference.CardZoom(face))CurrentReadingPreference.Bind(description,false);description.rectTransform.anchorMin='
assert text.count(old)==1
text=text.replace(old,'bool readingZoom=CurrentReadingPreference.CardZoom(face);\n            if(readingZoom)CurrentReadingPreference.Bind(description,false);description.rectTransform.anchorMin=')
old='var fit=description.gameObject.AddComponent<ContentSizeFitter>();fit.verticalFit=ContentSizeFitter.FitMode.PreferredSize;'
assert text.count(old)==1
text=text.replace(old,old+'\n                if(readingZoom)DescriptionScrollbar(scroll,viewport);')
old='        static void BuildCost(CardDef card,RectTransform face,float width,Color pigment,CardFaceOptions options)'
assert text.count(old)==1
text=text.replace(old,'''        // card-layout-selected.css: hsc-desc overflow:auto, thin #69818d scrollbar.
        // Reuse the existing inner ScrollRect. The card and its host keep their source dimensions.
        static void DescriptionScrollbar(ScrollRect scroll,RectTransform viewport)
        {
            var track=Rect("rules-scrollbar",viewport);track.anchorMin=new Vector2(1,0);track.anchorMax=Vector2.one;
            track.pivot=new Vector2(1,.5f);track.offsetMin=new Vector2(-6,0);track.offsetMax=Vector2.zero;
            var hit=track.gameObject.AddComponent<Image>();hit.color=Color.clear;
            var slider=Rect("handle",track);Area(slider,Vector2.zero,Vector2.one);
            var ink=slider.gameObject.AddComponent<Image>();ink.color=UiPalette.Hex("#69818D");
            var bar=track.gameObject.AddComponent<Scrollbar>();bar.direction=Scrollbar.Direction.BottomToTop;
            bar.handleRect=slider;bar.targetGraphic=ink;bar.transition=Selectable.Transition.None;
            scroll.verticalScrollbar=bar;scroll.verticalScrollbarVisibility=ScrollRect.ScrollbarVisibility.AutoHide;
        }
'''+old)
(p/'CardFace.cs.candidate').write_text(text,encoding='utf-8')
sources=['index.html','css/card-layout-selected.css','css/review-ui.css','css/inventory-zoom.css','css/cover-details.css','src/ui/card-zoom-controller.js','src/ui/card-zoom-content.js','src/ui/inventory-zoom.js']
receipt={'state':'private candidate only; no production mutation; native scroll proof pending','productionBefore':{production:sha(root/production)},'source':{key:sha(root.parent/'搜打撤/game'/key) for key in sources},'candidate':sha(p/'CardFace.cs.candidate')}
(p/'receipt.json').write_text(json.dumps(receipt,ensure_ascii=False,indent=2),encoding='utf-8')
print('Prepared one shared CardFace candidate; production remains frozen')
