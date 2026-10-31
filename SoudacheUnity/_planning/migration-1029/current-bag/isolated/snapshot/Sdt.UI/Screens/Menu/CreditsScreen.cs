// index.html #homeCredits + title-credits.js / final title-credits.css, native dialog equivalent.
using System.Collections;
using Sdt.UI.Kit;
using UnityEngine;
using UnityEngine.UI;
using E = Sdt.UI.Screens.Menu.CurrentHomeElements;

namespace Sdt.UI.Screens.Menu
{
    public sealed class CreditsScreen : Panel
    {
        CanvasGroup _frame;
        readonly System.Collections.Generic.List<NameRegion> _names = new System.Collections.Generic.List<NameRegion>();
        bool _closing;
        float _age;
        sealed class NameRegion { public RectTransform rect; public CanvasGroup group; public Vector2 pos; public float delay, flight; }
        public override void Build()
        {
            var outside = UIKit.Panel("homeCreditsBackdrop", transform);
            E.Hit((RectTransform)outside.transform, BeginClose);
            var frame = E.Box(transform, "homeCredits", 560, 202, 800, 676);
            var face = frame.gameObject.AddComponent<Image>(); face.color = Theme.HexA("#18232E", .94f); face.raycastTarget = true;
            var outline = frame.gameObject.AddComponent<Outline>(); outline.effectColor = Theme.HexA("#D5E1ED", .15f); outline.effectDistance = new Vector2(1,-1);
            _frame = E.Group(frame);
            var back = E.Box(frame,"home-credits-back",18,16,64,58);
            E.Hit(back,BeginClose);
            var exitIcon = E.Art(back,"linked-back",20,17,24,24); exitIcon.color = E.Hex("#AEBECB");
            var title = E.Text(frame,"homeCreditsTitle","制作名单",40,E.Hex("#E9EDF0"),32,72,736,56,4);
            title.alignment = TextAnchor.MiddleCenter;
            E.Fill(frame,"heading-rule",Theme.HexA("#D3C29B",.6f),356,140,88,1);
            Section(frame,"制作团队",166);
            Name(frame,"制作人","太平",90,211,300,40,.22f,-80);
            Name(frame,"游戏设计师","创",410,211,300,40,.32f,80);
            Section(frame,"特别鸣谢",329);
            Name(frame,"精神支柱","Tang",250,374,300,34,.5f,80);
            E.Fill(frame,"models-rule",Theme.HexA("#C4D4DF",.2f),80,493,640,1);
            Section(frame,"额外感谢  大模型",516);
            string[] names={"Gpt","Glm","Mimo","Claude","Deepseek"};
            var labels=new System.Collections.Generic.List<Text>();float total=28*(names.Length-1);
            foreach(string model in names)
            {
                var label=E.Text(frame,"credits-model",model,26,E.Hex("#C7D4DD"),0,558,200,50,.3f);
                labels.Add(label);total+=label.preferredWidth;
            }
            float modelX=(800-total)/2;
            foreach(var label in labels){label.rectTransform.anchoredPosition=new Vector2(modelX,-558);modelX+=label.preferredWidth+28;}
        }
        void Section(Transform parent,string text,float top)
        {
            var t=E.Text(parent,"credits-section-title",text,18,E.Hex("#CDBB98"),32,top,736,26,2);
            t.alignment=TextAnchor.MiddleCenter;
        }
        void Name(Transform parent,string role,string value,float x,float y,float w,int size,float delay,float flight)
        {
            var region=E.Box(parent,"home-makers-list",x,y,w,104);
            var roleText=E.Text(region,"dt",role,22,E.Hex("#B8C5CF"),0,0,w,33,.5f);
            roleText.alignment=TextAnchor.MiddleCenter;
            var nameText=E.Text(region,"dd",value,size,E.Hex(value=="Tang" ? "#C3D4DF" : "#F1EADB"),0,39,w,56,1);
            nameText.alignment=TextAnchor.MiddleCenter;
            _names.Add(new NameRegion{rect=region,pos=region.anchoredPosition,group=E.Group(region),delay=delay,flight=flight});
        }
        void Update()
        {
            if(_closing || _frame==null)return;
            _age+=Time.unscaledDeltaTime;
            _frame.alpha=CurrentHomeMotion.Reduced ? 1 : Mathf.Clamp01(_age/.4f);
            foreach(var n in _names)
            {
                float t=CurrentHomeMotion.Reduced ? 1 : CurrentHomeMotion.Ease(Mathf.Clamp01((_age-n.delay)/.8f),.22f,1,.36f,1);
                n.group.alpha=t;n.rect.anchoredPosition=n.pos+new Vector2(n.flight*(1-t),0);
            }
        }
        public override void CloseFromEscape()=>BeginClose();
        void BeginClose(){if(!_closing)StartCoroutine(CloseAnimated());}
        IEnumerator CloseAnimated()
        {
            _closing=true;
            if(!CurrentHomeMotion.Reduced)
                for(float t=0;t<.18f;t+=Time.unscaledDeltaTime){_frame.alpha=1-t/.18f;yield return null;}
            Close();
        }
    }
}
