from pathlib import Path
p=Path(__file__).resolve().parent
s=(p.parent/'current-core-independent/final-review/scan-source.mjs').read_text(encoding='utf-8-sig')
s=s.replace("path.resolve(taskDir, '../../../..')","path.resolve(taskDir, '../../..')")
prefix=s[:s.index('  const allowed=')]
tail=r'''
  const scenarios=[];
  function add(name,id,cfg={}) {scenarios.push({name,id,...cfg});}
  for(const hp of [0,1,11,12,13,30,59,60])add('heal-'+hp,'tt7-holyglow',{hp});
  for(const healban of [0,1,3])add('healban-'+healban,'tt7-holyglow',{hp:5,healban});
  add('heal-max-cap','tt7-holyglow',{hp:3,maxHp:8});
  for(const id of ['tt3-nature-form','tt8-hero-guardian'])for(const energy of [2,10])add(id+'-'+energy,id,{energy});
  for(const freeze of [-2,0,1,4])add('extend-'+freeze,'tt3-firm-barrier',{freeze});
  for(const seed of [0,1,2,123,999,2147483647])for(const id of ['tt3-nuke-ray','tt12-infectray'])add(id+'-'+seed,id,{seed});
  add('replay-draw','tt7-marchrush',{draw:4});
  add('replay-empty','tt7-marchrush',{draw:0});
  add('replay-other','tt7-marchrush',{other:'starter-attack',draw:0});
  add('replay-retained','tt7-marchrush',{other:'cmtn233trmeg',draw:0});
  add('replay-after-empty','tt7-marchrush',{draw:4,other:'starter-attack',consume:true});
  add('replay-async-draw','tt7-marchrush',{draw:4,asyncChoice:true,other:'starter-attack'});
  add('replay-async-empty','tt7-marchrush',{draw:0,asyncChoice:true,other:'starter-attack'});
  const norm=s=>Object.fromEntries(Object.entries(s||{}).filter(([k,v])=>typeof v==='number'&&v!==0).sort());
  const output=[];
  for(const q of scenarios){
    const card=structuredClone(cards.find(c=>c.id===q.id));
    if(q.consume)card.rules.triggers.onPlay.push({op:'consumeHand',all:true,trigger:false});
    if(q.asyncChoice)card.rules.triggers.onPlay.unshift({op:'handSelect',n:1,type:'武术',act:'play'});
    const f=fixture([card,...(q.other?[q.other]:[]),...Array.from({length:q.draw??0},()=> 'starter-attack')],false,false,q.seed??123);
    f.r.set$hand(['o0',...(q.other?['o1']:[])]);
    f.r.set$drawPile(Array.from({length:q.draw??0},(_,i)=>'o'+(i+(q.other?2:1))));f.r.set$discard([]);
    f.r.G.hp=q.hp??30;f.r.G.maxHp=q.maxHp??60;f.r.pstat.status.healban=q.healban??0;
    f.r.foes[0].status.freeze=q.freeze??0;f.r.set$maxEnergy(10);f.r.set$energy(q.energy??10);
    const submission=f.engine.submitCardPlay('o0',f.engine.targetSide(card)==='self'?'self':0,true);await f.engine.idle();
    if(q.asyncChoice){f.engine.pickHandSelect('o1');await f.engine.idle();}
    if(submission.status==='rejected')throw Error(JSON.stringify({q,submission}));output.push({q,input:f.owned,after:{hp:f.r.G.hp,energy:f.r.energy,maxEnergy:f.r.maxEnergy,armor:f.r.pdef.armor,hand:f.r.hand.length,draw:f.r.drawPile.length,status:norm(f.r.foes[0].status)},rng:f.engine.random.snapshot()});
    f.engine.finish(null);
  }
  fs.writeFileSync(path.join(taskDir,'boundary-source.json'),JSON.stringify(output,null,2));console.log(output.length);
}finally{await server.close();}
'''
(p/'source-boundaries.mjs').write_text(prefix+tail,encoding='utf-8')






