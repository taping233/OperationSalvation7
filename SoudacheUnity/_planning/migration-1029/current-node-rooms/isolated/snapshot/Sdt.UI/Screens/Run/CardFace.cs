// Current paper-card presentation: source card-layout-selected.css and card-frame-layout.json.
using UnityEngine;
using UnityEngine.UI;
using Sdt.Core;
using Sdt.UI.Kit;

namespace Sdt.UI.Screens.Run
{
    public enum CardSize { Sm=0, Md=1, Lg=2, Xl=3 }
    public static class CardFace
    {
        public static Sdt.Res.CurrentCardPresentation.Context BattleDescription(Sdt.Core.Battle.BattleSnapshot snapshot,string uid=null)
        {
            if(snapshot?.Player==null)return null;
            int Bonus(string key)=>snapshot.Pstat?.Status!=null&&snapshot.Pstat.Status.TryGetValue(key,out int value)?value:0;
            var context=new Sdt.Res.CurrentCardPresentation.Context { Attack=snapshot.Player.Atk+Bonus("atkUp"),SpellPower=snapshot.Player.SpellPower+Bonus("spellUp") };
            if(uid!=null){
                context.AstrolabePhase=0;
                foreach(var equipment in snapshot.Equipment??System.Array.Empty<Sdt.Core.Battle.EquipmentSnapshot>())if(equipment.uid==uid){context.AstrolabePhase=equipment.alternatingPhase;context.AstrolabeTriggered=equipment.alternatingTriggered;break;}
            }
            return context;
        }
        public static Vector2 SizeOf(CardSize size)
        {
            switch(size){case CardSize.Sm:return new Vector2(96,134);case CardSize.Md:return new Vector2(140,196);case CardSize.Lg:return new Vector2(220,308);default:return new Vector2(280,392);}
        }
        static RectTransform Rect(string name,Transform parent)
        {
            var go=new GameObject(name,typeof(RectTransform));go.transform.SetParent(parent,false);return go.GetComponent<RectTransform>();
        }
        static void Area(RectTransform rect,Vector2 min,Vector2 max)
        {
            rect.anchorMin=min;rect.anchorMax=max;rect.offsetMin=rect.offsetMax=Vector2.zero;
        }
        static Image Paper(RectTransform rect)
        {
            var image=rect.gameObject.AddComponent<Image>();image.sprite=Sdt.Res.Res.CardFrame("interior");image.color=image.sprite!=null?Color.white:UiPalette.Hex("#E1DDCF");image.raycastTarget=false;return image;
        }
        public static GameObject Create(CardDef card,CardSize size,Transform parent,bool showVal=true,CardFaceOptions options=null)
        {
            options??=new CardFaceOptions();var dim=SizeOf(size);var root=Rect("card-"+(card?.id??"unknown"),parent);root.sizeDelta=dim;
            var hit=root.gameObject.AddComponent<Image>();hit.color=Color.clear;
            var layout=root.gameObject.AddComponent<LayoutElement>();layout.preferredWidth=dim.x;layout.preferredHeight=dim.y;layout.minWidth=dim.x;layout.minHeight=dim.y;layout.flexibleWidth=layout.flexibleHeight=0;
            // Preserve host slots while fitting the existing 512x768 artwork at its natural ratio.
            float width=Mathf.Min(dim.x,dim.y*2f/3f),height=width*1.5f;
            var canvas=Rect("paper-card",root);canvas.anchorMin=canvas.anchorMax=Vector2.one*.5f;canvas.sizeDelta=new Vector2(width,height);
            string key=CardVisual.FrameKey(card);var frame=CardVisual.Frames[key];var pigment=UiPalette.Hex(CardVisual.Pigment(key));
            var face=Rect("face",canvas);Area(face,new Vector2(frame.Left/frame.CanvasWidth,1-(frame.Top+frame.Height)/frame.CanvasHeight),new Vector2((frame.Left+frame.Width)/frame.CanvasWidth,1-frame.Top/frame.CanvasHeight));
            float faceWidth=width*frame.Width/frame.CanvasWidth;
            var paper=face.gameObject.AddComponent<Image>();paper.color=UiPalette.Hex("#DED9CB");paper.raycastTarget=false;
            BuildArt(card,size,face);
            BuildCopy(card,size,face,faceWidth,pigment,options);
            var type=Rect("type-strip",face);type.anchorMin=type.anchorMax=new Vector2(.5f,.47f);type.sizeDelta=new Vector2(faceWidth*.88f,Mathf.Max(10,faceWidth*.1077f));Paper(type);type.localEulerAngles=new Vector3(0,0,1);
            string rarity=CardVisual.EffectiveRarity(card),secondary=string.IsNullOrEmpty(card?.cls)?rarity:card.cls;
            var typeText=UIKit.Label(type,(card?.type??"?")+" · "+secondary,Mathf.Max(6,Mathf.RoundToInt(faceWidth*.0517f)),pigment);UiExt.Stretch(typeText.rectTransform);typeText.alignment=TextAnchor.MiddleCenter;
            var border=Rect("frame-"+key,canvas);Area(border,Vector2.zero,Vector2.one);var frameImage=border.gameObject.AddComponent<Image>();frameImage.sprite=Sdt.Res.Res.CardFrame(key);frameImage.color=frameImage.sprite!=null?Color.white:Color.clear;frameImage.preserveAspect=true;frameImage.raycastTarget=false;
            if(CardVisual.ShowCost(card,options.HideCost)){
                // Match the source z9 cost layer: the tag also extends over the painted frame.
                var costLayer=Rect("cost-layer",canvas);Area(costLayer,face.anchorMin,face.anchorMax);
                BuildCost(card,costLayer,faceWidth,pigment,options);
            }
            if(showVal&&card!=null)BuildValue(card,canvas,width);
            // The current paper-card CSS hides hsc-dmg; retain its semantic data without a red legacy badge.
            if(CardVisual.ShowDamage(card)){
                var mark=UIKit.IconText(root,"[[icon:"+CardVisual.DamageIcon(card)+"]] "+CardVisual.DamageText(card,options.SpellDamageBonus));mark.name="hsc-dmg";mark.gameObject.SetActive(false);
            }
            return root.gameObject;
        }
        static void BuildArt(CardDef card,CardSize size,RectTransform face)
        {
            var viewport=Rect("art",face);Area(viewport,new Vector2(0,.47f),Vector2.one);viewport.gameObject.AddComponent<RectMask2D>();
            var backing=viewport.gameObject.AddComponent<Image>();backing.color=UiPalette.Hex("#242A35");backing.raycastTarget=false;
            var sprite=card!=null?Sdt.Res.Res.CardIllustration(card.id,card.art,card.type,card.name,size<=CardSize.Md):null;
            var art=Rect("illustration",viewport);Area(art,Vector2.zero,Vector2.one);var image=art.gameObject.AddComponent<Image>();image.sprite=sprite;image.raycastTarget=false;image.color=sprite!=null?Color.white:Color.clear;
            if(sprite!=null){var fit=art.gameObject.AddComponent<AspectRatioFitter>();fit.aspectMode=AspectRatioFitter.AspectMode.EnvelopeParent;fit.aspectRatio=sprite.rect.width/sprite.rect.height;}
            else{
                var symbol=Rect("type-art",viewport);symbol.anchorMin=symbol.anchorMax=Vector2.one*.5f;symbol.sizeDelta=Vector2.one*40;
                var fallback=symbol.gameObject.AddComponent<Image>();fallback.sprite=Sdt.Res.Res.Ui(TypeArt(card?.type));fallback.preserveAspect=true;fallback.raycastTarget=false;fallback.color=fallback.sprite!=null?Color.white:Color.clear;
            }
        }
        static void BuildCopy(CardDef card,CardSize size,RectTransform face,float width,Color pigment,CardFaceOptions options)
        {
            var copy=Rect("copy",face);Area(copy,Vector2.zero,new Vector2(1,.47f));Paper(copy);
            var content=Rect("copy-content",copy);Area(content,Vector2.zero,Vector2.one);content.offsetMin=new Vector2(width*.0603f,width*.056f);content.offsetMax=new Vector2(-width*.0603f,-width*.1034f);
            var flow=content.gameObject.AddComponent<VerticalLayoutGroup>();flow.spacing=width*.043f;flow.childControlWidth=flow.childControlHeight=true;flow.childForceExpandWidth=true;flow.childForceExpandHeight=false;
            int nameSize=Mathf.Max(8,Mathf.RoundToInt(width*.0905f));
            var title=UIKit.Label(content,card?.name??"",nameSize,pigment);title.fontStyle=FontStyle.Bold;title.alignment=TextAnchor.MiddleCenter;title.horizontalOverflow=HorizontalWrapMode.Wrap;title.verticalOverflow=VerticalWrapMode.Overflow;
            // Text is measured before the layout pass; supply its real width rather than the
            // RectTransform default (100px), so multi-line names reserve the right height.
            float copyWidth=width*(1-2*.0603f);
            title.rectTransform.SetSizeWithCurrentAnchors(RectTransform.Axis.Horizontal,copyWidth);
            var titleLayout=title.gameObject.AddComponent<LayoutElement>();titleLayout.preferredHeight=title.preferredHeight;titleLayout.minHeight=nameSize*1.35f;titleLayout.flexibleHeight=0;
            var viewport=Rect("rules",content);var le=viewport.gameObject.AddComponent<LayoutElement>();le.minHeight=8;le.flexibleHeight=1;viewport.gameObject.AddComponent<RectMask2D>();
            string currentDescription=Sdt.Res.CurrentCardPresentation.Description(card,options.DescriptionContext);
            int descriptionSize=Mathf.Max(6,Mathf.RoundToInt(width*(currentDescription.Length>55?.056f:.0603f)));
            var description=UIKit.Label(viewport,currentDescription,descriptionSize,UiPalette.Hex("#383E42"));description.alignment=TextAnchor.UpperCenter;description.horizontalOverflow=HorizontalWrapMode.Wrap;description.verticalOverflow=VerticalWrapMode.Overflow;
            description.lineSpacing=1.1f;description.rectTransform.anchorMin=new Vector2(0,1);description.rectTransform.anchorMax=Vector2.one;description.rectTransform.pivot=new Vector2(.5f,1);description.rectTransform.offsetMin=description.rectTransform.offsetMax=Vector2.zero;
            if(options.ScrollDescription){
                var target=viewport.gameObject.AddComponent<Image>();target.color=Color.clear;target.raycastTarget=true;
                var scroll=viewport.gameObject.AddComponent<ScrollRect>();scroll.horizontal=false;scroll.vertical=true;scroll.viewport=viewport;scroll.content=description.rectTransform;scroll.movementType=ScrollRect.MovementType.Clamped;scroll.scrollSensitivity=14;
                var fit=description.gameObject.AddComponent<ContentSizeFitter>();fit.verticalFit=ContentSizeFitter.FitMode.PreferredSize;
            }else{Area(description.rectTransform,Vector2.zero,Vector2.one);description.verticalOverflow=VerticalWrapMode.Truncate;}
        }
        static void BuildCost(CardDef card,RectTransform face,float width,Color pigment,CardFaceOptions options)
        {
            var cost=Rect("cost",face);cost.anchorMin=cost.anchorMax=new Vector2(0,1);cost.pivot=new Vector2(0,1);cost.anchoredPosition=new Vector2(-width*.0258f,width*.0129f);cost.sizeDelta=new Vector2(width*.1509f,width*.1854f);cost.localEulerAngles=new Vector3(0,0,3);Paper(cost);
            string tone=CardVisual.CostTone(card,options);Color ink=tone=="down"?UiPalette.Hex("#285839"):tone=="up"?UiPalette.Hex("#8D3931"):Color.black;
            var value=UIKit.Label(cost,CardVisual.Cost(card,options).ToString(),Mathf.Max(9,Mathf.RoundToInt(width*.1164f)),ink);UiExt.Stretch(value.rectTransform);value.fontStyle=FontStyle.Bold;value.alignment=TextAnchor.MiddleCenter;
            value.font=Sdt.Res.Res.NumberBold;
            var underline=Rect("cost-underline",cost);Area(underline,new Vector2(.17f,.12f),new Vector2(.83f,.19f));var color=underline.gameObject.AddComponent<Image>();color.color=tone=="normal"?pigment:ink;color.raycastTarget=false;
        }
        static void BuildValue(CardDef card,RectTransform canvas,float width)
        {
            var value=Rect("value",canvas);value.anchorMin=value.anchorMax=new Vector2(1,0);value.pivot=new Vector2(1,0);value.anchoredPosition=new Vector2(-width*.042f,width*.042f);
            var label=UIKit.Label(value,CardLibrary.SellPrice(card).ToString(),Mathf.Max(7,Mathf.RoundToInt(width*.072f)),UiPalette.Hex("#F0CF78"));
            label.fontStyle=FontStyle.Bold;label.alignment=TextAnchor.MiddleRight;label.horizontalOverflow=HorizontalWrapMode.Overflow;
            label.font=Sdt.Res.Res.NumberBold;
            float numberWidth=Mathf.Ceil(label.preferredWidth)+2,tagWidth=width*.19f+numberWidth;
            value.sizeDelta=new Vector2(tagWidth,width*.166f);
            // Source hsc-val: padded 14cqw coin, scale 2.325, and a dark number backing.
            var backing=Rect("value-backing",value);Area(backing,Vector2.zero,Vector2.one);
            backing.offsetMin=new Vector2(width*.05f,width*.037f);backing.offsetMax=new Vector2(-width*.006f,-width*.037f);
            var background=backing.gameObject.AddComponent<Image>();background.color=UiPalette.HexA("#090B0E",.95f);background.raycastTarget=false;
            var outline=backing.gameObject.AddComponent<Outline>();outline.effectColor=UiPalette.HexA("#C8A75A",.4f);outline.effectDistance=Vector2.one*Mathf.Max(.3f,width*.002f);
            var coin=Rect("value-coin",value);coin.anchorMin=coin.anchorMax=new Vector2(0,.5f);coin.anchoredPosition=new Vector2(width*.092f,0);coin.sizeDelta=Vector2.one*width*.14f*2.325f;
            var icon=coin.gameObject.AddComponent<Image>();icon.sprite=Sdt.Res.Res.Ui("coin");icon.preserveAspect=true;icon.raycastTarget=false;
            var text=label.rectTransform;text.anchorMin=text.anchorMax=new Vector2(1,.5f);text.pivot=new Vector2(1,.5f);text.anchoredPosition=new Vector2(-width*.022f,0);text.sizeDelta=new Vector2(numberWidth,width*.10f);
            text.SetAsLastSibling();
        }
        public static string TypeArt(string type)
        {
            switch(type){case "武术":return "swords";case "法术":return "sparkles";case "生物":return "paw";case "道具":return "flask";case "装备":return "shield";case "事件":return "dice";case "能力卡":case "英雄卡":return "helmet";case "资源":return "wood";default:return "question";}
        }
        public static GameObject CardBack(CardSize size,Transform parent)
        {
            var root=Rect("card-back",parent);root.sizeDelta=SizeOf(size);var image=root.gameObject.AddComponent<Image>();image.sprite=Sdt.Res.Res.CardBack(Sdt.Run.GameRuntime.I.Base.BackSel);image.preserveAspect=true;image.color=image.sprite!=null?Color.white:UiPalette.Hex("#182B38");
            if(image.sprite==null){var label=UIKit.Label(root,"柒",size==CardSize.Sm?28:44,UiPalette.AkMint);UiExt.Stretch(label.rectTransform);label.alignment=TextAnchor.MiddleCenter;}
            return root.gameObject;
        }
        public static GameObject Gem(Transform parent,int n,Color color,float font,bool bottomLeft=false,bool bottomRight=false)
        {
            var root=Rect("gem",parent);root.anchorMin=root.anchorMax=bottomLeft?Vector2.zero:bottomRight?new Vector2(1,0):Vector2.one;root.sizeDelta=Vector2.one*font*1.6f;
            root.gameObject.AddComponent<LayoutElement>().ignoreLayout=true;var image=root.gameObject.AddComponent<Image>();image.color=color;image.raycastTarget=false;
            var label=UIKit.Label(root,n.ToString(),Mathf.RoundToInt(font),Color.white);UiExt.Stretch(label.rectTransform);label.alignment=TextAnchor.MiddleCenter;return root.gameObject;
        }
    }
}
