from pathlib import Path
p=Path(__file__).parent/'ui'
def edit(name,old,new):
 f=p/name;s=f.read_text(encoding='utf-8-sig');assert s.count(old)==1,(name,old[:70],s.count(old));f.write_text(s.replace(old,new),encoding='utf-8')
edit('BattleEvents.cs','CommandResult SelectRuleHand(string uid);','CommandResult SelectRuleHand(string uid);\n        CommandResult ConfirmRuleHandPayment(long selectionId, string[] materialUids);')
edit('BattleBridge.cs','public CommandResult SelectRuleHand(string uid) => _s.SelectRuleHand(uid);','public CommandResult SelectRuleHand(string uid) => _s.SelectRuleHand(uid);\n        public CommandResult ConfirmRuleHandPayment(long selectionId, string[] materialUids) => _s.ConfirmRuleHandPayment(selectionId, materialUids);')
edit('BattleScreen.cs','if (snap.RuleHandSelection != null) { if (snap.RuleHandSelection.candidateUids.Contains(bc.Uid)) cmd.SelectRuleHand(bc.Uid); return; }','if (snap.RuleHandSelection != null) { if (snap.RuleHandSelection.act=="payment") ToggleRulePayment(bc.Uid, snap, api); else if (snap.RuleHandSelection.candidateUids.Contains(bc.Uid)) cmd.SelectRuleHand(bc.Uid); return; }')
edit('BattleRuleInputs.cs','bool _skillTargeting;', '''bool _skillTargeting;
        readonly System.Collections.Generic.Dictionary<string,string> _paymentPicked = new System.Collections.Generic.Dictionary<string,string>();
        long _paymentSelectionId;
        string _paymentBattleToken;
        bool _paymentSubmitting;
        void SyncPaymentDraft(BattleSnapshot s)
        {
            long id=s.RuleHandSelection?.act=="payment" ? s.RuleHandSelection.selectionId : 0;
            if(_paymentSelectionId!=id || _paymentBattleToken!=s.BattleToken)
            { _paymentPicked.Clear(); _paymentSelectionId=id; _paymentBattleToken=s.BattleToken; }
        }
        void ToggleRulePayment(string uid,BattleSnapshot s,IBattleViewApi api)
        {
            SyncPaymentDraft(s); var selection=s.RuleHandSelection;
            if(_paymentSubmitting || selection?.act!="payment") return;
            if(_paymentPicked.ContainsKey(uid)) _paymentPicked.Remove(uid);
            else if(selection.candidateUids.Contains(uid) && s.Hand.Contains(uid) && _paymentPicked.Count<selection.n && api.FindCard(uid)?.Card!=null)
                _paymentPicked.Add(uid,JsonUtility.ToJson(api.FindCard(uid).Card));
            BuildStage(s);
        }
        bool PaymentDraftValid(BattleSnapshot s,IBattleViewApi api)
        {
            var selection=s?.RuleHandSelection;
            return !_paymentSubmitting && s!=null && !s.over && !s.Busy && (s.Phase=="player" || s.Phase=="targeting")
                && selection?.act=="payment" && _paymentBattleToken==s.BattleToken && _paymentSelectionId==selection.selectionId
                && _paymentPicked.Count==selection.n && _paymentPicked.All(p=>s.Hand.Contains(p.Key) && selection.candidateUids.Contains(p.Key)
                    && api.FindCard(p.Key)?.Card!=null && JsonUtility.ToJson(api.FindCard(p.Key).Card)==p.Value);
        }
        void ConfirmPaymentDraft(string token,long selectionId,IBattleViewApi api,IBattleCommands commands)
        {
            var current=GameSnapshotRef.Current;
            if(UiStack.Top!=this || PresentationBusy || current?.BattleToken!=token || current.RuleHandSelection?.selectionId!=selectionId || !PaymentDraftValid(current,api)) return;
            _paymentSubmitting=true;
            try { var result=commands.ConfirmRuleHandPayment(selectionId,_paymentPicked.Keys.ToArray()); if(!result.Ok) RunLog.Log(result.Reason,"warn"); }
            finally { _paymentSubmitting=false; _paymentPicked.Clear(); BuildStage(GameSnapshotRef.Current); }
        }''')
edit('BattleRuleInputs.cs','bool selecting = s.RuleHandSelection != null;','SyncPaymentDraft(s);\n            bool selecting = s.RuleHandSelection != null;')
edit('BattleRuleInputs.cs','if (selecting) card.SetOff(!s.RuleHandSelection.candidateUids.Contains(card.Uid));','if (selecting) { card.SetOff(!s.RuleHandSelection.candidateUids.Contains(card.Uid)); if(s.RuleHandSelection.act=="payment") card.Lift=_paymentPicked.ContainsKey(card.Uid); }')
edit('BattlePresentation.cs',': s.RuleHandSelection != null ? "hand-choice:" + string.Join("|", s.RuleHandSelection.candidateUids)',': s.RuleHandSelection != null ? "hand-choice:" + s.BattleToken + ":" + s.RuleHandSelection.selectionId + ":" + string.Join("|", s.RuleHandSelection.candidateUids) + ":" + string.Join("|", _paymentPicked.Keys) + ":" + PaymentDraftValid(s,api)')
edit('BattlePresentation.cs',': s.RuleHandSelection != null ? "选择一张高亮手牌"',': s.RuleHandSelection?.act=="payment" ? "选择消耗代价  已选 " + _paymentPicked.Count + "/" + s.RuleHandSelection.n + " 张材料"\n                : s.RuleHandSelection != null ? "选择一张高亮手牌"')
edit('BattlePresentation.cs','if (s.RuleHandSelection == null) BtBtn.Mini(_prompt, "取消 Esc",','if(s.RuleHandSelection?.act=="payment") { var token=s.BattleToken; long id=s.RuleHandSelection.selectionId; BtBtn.Mini(_prompt,"确定",()=>ConfirmPaymentDraft(token,id,api,cmd),true,PaymentDraftValid(s,api)); }\n            if (s.RuleHandSelection == null) BtBtn.Mini(_prompt, "取消 Esc",')
