from pathlib import Path
p=Path('_planning/migration-1029/save/Program.cs');s=p.read_text(encoding='utf-8-sig')
a=s.index('  string valid=File.ReadAllText(SaveSystem.ProfilePath);')
s=s[:a]+'''  Start(4);var other=CardDatabase.All.First(c=>c.rarity=="古朴"&&c.type=="资源"&&c.id!=card.id);g.State.ownedCards[1].card=other;g.SaveCurrent();stash=g.Base.StashUsed;Assert(g.DoExtract()!=null,"第四档撤离");
  Fail(()=>Assert(g.ExtractStashOne(0)==null,"单堆入库失败返回空"));Assert(g.Base.StashUsed==stash,"单堆失败回滚");Assert(g.ExtractStashOne(0)!=null&&g.Base.StashUsed==stash+1,"单堆成功入库");
  reloaded=new SaveSystem();Assert(reloaded.GetSettlement(4).left.Sum(x=>x.count)==1,"重启保留剩余一张");g.ExtractStashAll();Assert(g.Base.StashUsed==stash+2,"单堆后剩余入库");g.FinishExtract();
  Start(5);stash=g.Base.StashUsed;Assert(g.AbandonRun()!=null&&g.Base.StashUsed==stash+1,"放弃抢运非带入安全卡");g.AbandonRun();Assert(g.Base.StashUsed==stash+1,"放弃抢运幂等");
  Start(5);int owned=g.State.ownedCards.Count,coins=g.State.coins,kills=g.Base.stats.kills;int granted=0;g.Bus.On<CardGranted>(e=>granted++);
  Fail(()=>Assert(!g.TryPersistMutation(()=>{g.GrantCard(other);g.State.coins+=10;g.Meta.Track("kill",new MetaProgress.TrackData{cls=g.State.myClass});},out var why)&&!string.IsNullOrEmpty(why),"公共复合变更失败返回原因"));Assert(g.State.ownedCards.Count==owned&&g.State.coins==coins&&g.Base.stats.kills==kills&&granted==0,"复合奖励回滚且不发成功事件");
  Assert(g.TryPersistMutation(()=>{g.GrantCard(other);g.State.coins+=10;g.Meta.Track("kill",new MetaProgress.TrackData{cls=g.State.myClass});},out _)&&granted==1&&g.Base.stats.kills==kills+1,"复合奖励单次提交");
  g.State.coins+=7;Fail(()=>g.SaveCurrent());Assert(g.State.coins==coins+17,"普通保存失败保留内存待重试");g.SaveCurrent();Assert(new SaveSystem().ReadSlot(5).coins==coins+17,"普通保存重试成功");
  g.Base.stash.Add(new StashStack{card=card,count=2});g.Base.Save();int available=g.Base.stash.Where(x=>x.card.id==card.id).Sum(x=>x.count);int started=0;g.Bus.On<RunStarted>(e=>started++);int oldSeed=g.State.seed.Value;
  Fail(()=>g.NewRun(5,ch,"standard",new Dictionary<string,int>{{card.name,1}}));Assert(g.State.seed==oldSeed&&g.Base.stash.Where(x=>x.card.id==card.id).Sum(x=>x.count)==available&&started==0,"新局失败不扣携带且不发开局事件");
  g.NewRun(5,ch,"standard",new Dictionary<string,int>{{card.name,1}});Assert(g.Base.stash.Where(x=>x.card.id==card.id).Sum(x=>x.count)==available-1&&g.State.ownedCards.Any(o=>o.card.id==card.id&&o.brought==1)&&started==1,"新局扣仓和携带同时提交");
'''+s[a:]
p.write_text(s,encoding='utf-8')
