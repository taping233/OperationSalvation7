using System;
using Sdt.UI.Kit;
using UnityEngine;
using UnityEngine.UI;
using E = Sdt.UI.Screens.Menu.CurrentHomeElements;

namespace Sdt.UI.Screens.Menu
{
    // menu-feedback.js confirmAction: confirmation precedes any persisted deletion.
    public sealed class HomeInboxDeleteDialog : Panel
    {
        public Action Confirm;
        public override void Build()
        {
            var card=E.Box(transform,"feedback-delete-confirm",650,380,620,300);
            var face=card.gameObject.AddComponent<Image>();face.color=E.Hex("#19232D");
            E.Text(card,"title","删除这条留言？",26,E.Hex("#E8EEF4"),24,24,572,48);
            CurrentReadingPreference.Bind(E.Text(card,"description","删除后无法恢复，可先导出这条留言。",22,E.Hex("#C1CBD4"),24,84,572,110));
            var cancel=E.Box(card,"cancel",286,216,138,52);E.Hit(cancel,Close);
            E.Text(cancel,"label","返回",20,E.Hex("#DDE7EE"),20,0,100,52);
            var confirm=E.Box(card,"confirm",438,216,158,52);E.Hit(confirm,()=>{Confirm?.Invoke();Close();});
            E.Text(confirm,"label","删除留言",20,E.Hex("#F0B9AE"),20,0,120,52);
        }
    }
}
