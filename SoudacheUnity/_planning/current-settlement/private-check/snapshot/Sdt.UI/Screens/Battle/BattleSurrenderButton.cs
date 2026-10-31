using System;
using UnityEngine;
using UnityEngine.UI;
using Sdt.Run;

namespace Sdt.UI.Screens.Battle
{
    /// <summary>现行战斗撤离的两步确认；2.6秒后自动取消。</summary>
    public sealed class BattleSurrenderButton : MonoBehaviour
    {
        Button _button; Text _text; Image _background; Action _surrender;
        string _normalText; Color _normalInk, _normalBackground; bool _boss; float _until;
        public void Configure(Button button, bool boss, Action surrender)
        {
            _button = button; _boss = boss; _surrender = surrender;
            _text = button.GetComponentInChildren<Text>(); _background = button.GetComponent<Image>();
            _normalText = _text.text; _normalInk = _text.color; _normalBackground = _background.color;
            button.onClick.AddListener(Click);
            if (boss) _text.color = BtColors.Dim;
        }
        void Click()
        {
            if (_boss)
            {
                AudioService.I.PlaySfx("deny");
                GameRuntime.I.Bus.Emit(new ToastRequested { Text = "首脑战不可撤离，击败首脑或战败即终局", Tone = "warn" });
                return;
            }
            AudioService.I.PlaySfx("click");
            if (_until > Time.unscaledTime) { ResetConfirmation(); _surrender?.Invoke(); return; }
            _until = Time.unscaledTime + 2.6f;
            _text.text = "[[icon:cross]] 确认撤离？本局判负";
            _text.color = new Color32(246, 221, 214, 255);
            _background.color = new Color32(97, 36, 31, 255);
        }
        void Update() { if (_until > 0 && Time.unscaledTime >= _until) ResetConfirmation(); }
        void ResetConfirmation()
        {
            _until = 0;
            if (_text != null) { _text.text = _normalText; _text.color = _normalInk; }
            if (_background != null) _background.color = _normalBackground;
        }
    }
}
