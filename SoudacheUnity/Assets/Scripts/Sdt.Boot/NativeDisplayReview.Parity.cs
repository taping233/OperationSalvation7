// Additional explicit background-review specimens for the 1031 parity changes.
using System;
using System.Collections;
using System.Collections.Generic;
using System.Linq;
using Sdt.Core;
using Sdt.Core.Battle;
using Sdt.Run;
using Sdt.UI.Kit;
using Sdt.UI.Screens.Battle;
using Sdt.UI.Screens.Run;
using UnityEngine;
using UnityEngine.EventSystems;
using UnityEngine.UI;

namespace Sdt.Boot
{
    public sealed partial class NativeDisplayReview
    {
        IEnumerator ParityBattle()
        {
            if (!Guard(() => {
                NewPresentationFixture(); var game = GameRuntime.I;
                game.State.ownedCards.Clear(); game.State.usedPocket.Clear(); game.State.hp = game.State.maxHp = 1000;
                game.State.atk = 0; game.State.Phase = "idle";
                game.State.ownedCards.Add(new Sdt.Core.OwnedCard { uid = "display-material-pouch", card = CardLibrary.FindById("tt3-crimson-pouch").Clone() });
                var infusion = CardLibrary.All().First(card => card.type == "法术"
                    && Math.Max(card.infuse ?? 0, CardLibrary.DeriveInfuse(card)) > 0 && card.cost <= GameRules.BattleEnergy);
                game.State.ownedCards.Add(new Sdt.Core.OwnedCard { uid = "display-real-infusion", card = infusion.Clone() });
                int index = 0;
                foreach (var definition in CardLibrary.All().Where(card => card.type == "武术" && !card.unrandom).Take(8))
                {
                    var card = definition.Clone(); card.cost = 0; card.dmg = 0; card.rules = null;
                    game.State.ownedCards.Add(new Sdt.Core.OwnedCard { uid = "display-material-" + index++, card = card });
                }
                game.Bus.Emit(new BattleRequested { Request = new BattleRequest { Name = "选材实绘复核", Foes = new List<EnemyStats> { new EnemyStats { id = "display-material-foe", name = "受控敌人", hp = 10000, atk = 0 } } } });
            })) yield break;
            float began = Time.realtimeSinceStartup;
            while (!(UiStack.Top is BattleScreen) || CurrentRunFilm.Active)
            {
                if (Time.realtimeSinceStartup - began > 10) { Fail(new TimeoutException("Material review battle did not open.")); yield break; }
                yield return null;
            }
            var session = BattleViewApi.Session;
            if (!Guard(() => { var result = session.PlayCard("display-material-pouch", -1, false); if (!result.Ok) throw new InvalidOperationException("Review equipment could not be played."); })) yield break;
            yield return new WaitForSecondsRealtime(.65f);
            if (!Guard(() => { if (!session.UseEquipment("display-material-pouch").Ok) throw new InvalidOperationException("Review selection could not open."); })) yield break;
            yield return Capture("player-hand-material", false);
            if (!Guard(() => {
                var card = UiStack.Top.GetComponentsInChildren<BattleCard>().First(view => view.Uid == "display-material-0");
                var input = new PointerEventData(EventSystem.current) { button = PointerEventData.InputButton.Left, position = RectTransformUtility.WorldToScreenPoint(App.Canvas.worldCamera, card.CardRt.position) };
                ExecuteEvents.Execute(card.gameObject, input, ExecuteEvents.pointerDownHandler);
                ExecuteEvents.Execute(card.gameObject, input, ExecuteEvents.pointerUpHandler);
                var confirm = UiStack.Top.GetComponentsInChildren<Button>().Single(button => button.GetComponentInChildren<Text>()?.text == "确定");
                var selected = UiStack.Top.GetComponentsInChildren<BattleCard>().Single(view => view.Uid == "display-material-0");
                if (!confirm.IsInteractable() || !selected.MaterialSelected || session.Snapshot.RuleHandSelection == null || !session.Snapshot.Hand.Contains("display-material-0")
                    || UiStack.Top.GetComponentsInChildren<RectTransform>().Any(rect => rect.name == "infusion-workspace" && rect.gameObject.activeInHierarchy))
                    throw new InvalidOperationException("Actual material draft was not selected without committing.");
            })) yield break;
            yield return Capture("player-hand-material-picked", false);
            if (!Guard(() => {
                ClickNamed("hand-material-cancel");
                if (session.Snapshot.RuleHandSelection != null || !session.Snapshot.Hand.Contains("display-material-0")) throw new InvalidOperationException("Cancelled hand selection consumed its material.");
                var result = session.PlayCard("display-real-infusion", -2, false);
                if (result.Ok || result.Reason != "select infusion" || session.Snapshot.Infusing?.Uid != "display-real-infusion" || session.Snapshot.RuleHandSelection != null)
                    throw new InvalidOperationException("Expected genuine infusion selection.");
            })) yield break;
            yield return Capture("player-infusion", false);
            RectTransform infusionSource = null; string fuelUid = null;
            if (!Guard(() => {
                infusionSource = UiStack.Top.GetComponentsInChildren<RectTransform>().Single(rect => rect.name == "infusion-source-card");
                var fuel = UiStack.Top.GetComponentsInChildren<BattleCard>().First(card => card.Infusion && !card.Off);
                fuelUid = fuel.Uid;
                var input = new PointerEventData(EventSystem.current) { button = PointerEventData.InputButton.Left, position = RectTransformUtility.WorldToScreenPoint(App.Canvas.worldCamera, fuel.CardRt.position) };
                ExecuteEvents.Execute(fuel.gameObject, input, ExecuteEvents.pointerDownHandler); ExecuteEvents.Execute(fuel.gameObject, input, ExecuteEvents.pointerUpHandler);
                if (session.Snapshot.Infusing.Picked.Count != 1 || session.Snapshot.Infusing.Picked[0] != fuelUid
                    || !ReferenceEquals(infusionSource, UiStack.Top.GetComponentsInChildren<RectTransform>().Single(rect => rect.name == "infusion-source-card"))
                    || UiStack.Top.GetComponentInChildren<CurrentArenaFilter>() == null)
                    throw new InvalidOperationException("True infusion did not retain the source UID and arena-only filter.");
            })) yield break;
            yield return Capture("player-infusion-picked", false);
            if (!Guard(() => {
                var back = UiStack.Top.GetComponentsInChildren<Button>().Single(button => button.GetComponentInChildren<Text>()?.text == "返回"); ClickButton(back);
                if (session.Snapshot.Infusing != null || !session.Snapshot.Hand.Contains("display-real-infusion") || !session.Snapshot.Hand.Contains(fuelUid)
                    || !UiStack.Top.GetComponentsInChildren<RectTransform>().Any(rect => rect.name == "sts-arena"))
                    throw new InvalidOperationException("Infusion return did not restore arena and unconsumed cards.");
            })) yield break;
            yield return Capture("player-infusion-return", false);
            if (!Guard(() => {
                var root = UiStack.Top.GetComponentsInChildren<RectTransform>().First(rect => rect.name == "fx");
                var kinds = new[] { "slash", "block", "magic", "fire", "ice", "lightning", "poison", "heal", "curse", "pulse", "trail", "death", "buff", "debuff", "draw", "boss" };
                for (int i = 0; i < kinds.Length; i++)
                {
                    if (BattleArtFx.Cell(kinds[i]) == null) throw new InvalidOperationException("Current atlas cell missing: " + kinds[i]);
                    BattleArtFx.Spawn(root, new Vector2((i % 4 - 1.5f) * 210, (1.5f - i / 4) * 155), kinds[i], 155, 1800);
                }
                var mounted = root.GetComponentsInChildren<BattleArtFx>();
                foreach (string kind in kinds) if (!mounted.Any(effect => effect.name == "bt-fx-art " + kind)) throw new InvalidOperationException("Atlas specimen did not mount: " + kind);
                _records.Add(new { kind = "constructed-production-atlas-specimen", cells = kinds.Length, naturalCombatTimingClaim = false });
            })) yield break;
            yield return new WaitForSecondsRealtime(.09f);
            yield return Capture("player-fx-atlas-specimen", false);
        }
    }
}
